import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbOTx } from "@/server/db";
import { alumnos, buses, mensualidades, pagoAplicaciones, personas, servicios } from "@/server/db/schema";
import { auditar, exigirMotivoSiCerrado, type Contexto } from "@/server/auditoria";
import { leerConfig } from "@/server/configuracion";
import { ErrorNegocio } from "@/server/errores";
import { fechaVencimiento } from "@/lib/fechas";
import { formatearPeriodo, formatearPesos, nombreCompleto } from "@/lib/formato";
import type { EstadoMensualidad } from "@/lib/constantes";

/**
 * Genera las mensualidades de un periodo para los alumnos activos con tarifa > 0
 * que aún no la tienen. Nunca duplica (índice único alumno+periodo).
 */
export async function generarMensualidades(ctx: Contexto, periodo: string, alumnoIds?: number[]) {
  return db.transaction(async (tx) => {
    await exigirMotivoSiCerrado(tx, [periodo], null);
    const diaGeneral = await leerConfig("cobranza.dia_vencimiento", tx);
    const candidatos = await tx
      .select({ id: alumnos.id, tarifa: alumnos.tarifaMensual, dia: alumnos.diaVencimiento })
      .from(alumnos)
      .where(
        and(
          eq(alumnos.estado, "activo"),
          isNull(alumnos.eliminadoEn),
          sql`${alumnos.tarifaMensual} > 0`,
          sql`(${alumnos.fechaIngreso} is null or ${alumnos.fechaIngreso} <= (${periodo}::date + interval '1 month' - interval '1 day'))`,
          sql`(${alumnos.fechaRetiro} is null or ${alumnos.fechaRetiro} >= ${periodo}::date)`,
          alumnoIds?.length ? inArray(alumnos.id, alumnoIds) : undefined,
        ),
      );
    if (candidatos.length === 0) return { creadas: 0 };
    const creadas = await tx
      .insert(mensualidades)
      .values(
        candidatos.map((a) => ({
          alumnoId: a.id,
          periodo,
          monto: a.tarifa,
          fechaVencimiento: fechaVencimiento(periodo, a.dia ?? Number(diaGeneral)),
        })),
      )
      .onConflictDoNothing()
      .returning({ id: mensualidades.id });
    if (creadas.length) {
      await auditar(tx, ctx, {
        accion: "generar_mensualidades",
        entidad: "periodo",
        entidadId: periodo,
        resumen: `${creadas.length} mensualidades generadas para ${formatearPeriodo(periodo)}`,
      });
    }
    return { creadas: creadas.length };
  });
}

/** Recalcula monto pagado y estado de una mensualidad a partir de sus aplicaciones. */
export async function recalcularMensualidad(tx: DbOTx, id: number) {
  const [m] = await tx.select().from(mensualidades).where(eq(mensualidades.id, id));
  if (!m) return null;
  const [{ suma }] = await tx
    .select({ suma: sql<number>`coalesce(sum(${pagoAplicaciones.monto}), 0)::int` })
    .from(pagoAplicaciones)
    .where(eq(pagoAplicaciones.mensualidadId, id));
  let estado: EstadoMensualidad = m.estado;
  if (!["condonada", "no_recuperable", "anulada"].includes(m.estado)) {
    estado = suma >= m.monto ? "pagada" : suma > 0 ? "parcial" : "pendiente";
  }
  const [nueva] = await tx
    .update(mensualidades)
    .set({ montoPagado: suma, estado })
    .where(eq(mensualidades.id, id))
    .returning();
  return nueva;
}

async function cargarConNombre(tx: DbOTx, id: number) {
  const [fila] = await tx
    .select({ m: mensualidades, nombres: personas.nombres, apellidos: personas.apellidos })
    .from(mensualidades)
    .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .where(eq(mensualidades.id, id));
  if (!fila) throw new ErrorNegocio("La mensualidad no existe.");
  return fila;
}

/** Condonar, marcar no recuperable, anular o volver a pendiente. Siempre con motivo. */
export async function cambiarEstadoMensualidad(
  ctx: Contexto,
  id: number,
  estado: "condonada" | "no_recuperable" | "anulada" | "pendiente",
  motivo: string,
) {
  if (!motivo?.trim()) throw new ErrorNegocio("Debes indicar el motivo del cambio.");
  return db.transaction(async (tx) => {
    const { m, ...p } = await cargarConNombre(tx, id);
    const cerrado = await exigirMotivoSiCerrado(tx, [m.periodo], motivo);
    if (estado === "anulada" && m.montoPagado > 0) {
      throw new ErrorNegocio("No se puede anular una mensualidad con pagos aplicados. Primero quita las aplicaciones.");
    }
    await tx.update(mensualidades).set({ estado }).where(eq(mensualidades.id, id));
    const nueva = estado === "pendiente" ? await recalcularMensualidad(tx, id) : { ...m, estado };
    await auditar(tx, ctx, {
      accion: "cambiar_estado",
      entidad: "mensualidad",
      entidadId: id,
      resumen: `${nombreCompleto(p)} — ${formatearPeriodo(m.periodo)}`,
      antes: m,
      despues: nueva,
      motivo,
      periodoCerrado: cerrado,
    });
  });
}

export async function cambiarMontoMensualidad(ctx: Contexto, id: number, monto: number, motivo: string) {
  if (!Number.isInteger(monto) || monto < 0) throw new ErrorNegocio("Monto inválido.");
  if (!motivo?.trim()) throw new ErrorNegocio("Debes indicar el motivo del cambio de monto.");
  return db.transaction(async (tx) => {
    const { m, ...p } = await cargarConNombre(tx, id);
    const cerrado = await exigirMotivoSiCerrado(tx, [m.periodo], motivo);
    await tx.update(mensualidades).set({ monto }).where(eq(mensualidades.id, id));
    const nueva = await recalcularMensualidad(tx, id);
    await auditar(tx, ctx, {
      accion: "cambiar_monto",
      entidad: "mensualidad",
      entidadId: id,
      resumen: `${nombreCompleto(p)} — ${formatearPeriodo(m.periodo)}: ${formatearPesos(m.monto)} → ${formatearPesos(monto)}`,
      antes: m,
      despues: nueva,
      motivo,
      periodoCerrado: cerrado,
    });
  });
}

/** Mensualidades de un periodo con datos del alumno (para la vista de mensualidades). */
export async function listarMensualidadesPeriodo(periodo: string) {
  return db
    .select({
      id: mensualidades.id,
      alumnoId: alumnos.id,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      busNumero: buses.numero,
      servicioNombre: servicios.nombre,
      monto: mensualidades.monto,
      montoPagado: mensualidades.montoPagado,
      estado: mensualidades.estado,
      fechaVencimiento: mensualidades.fechaVencimiento,
    })
    .from(mensualidades)
    .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .leftJoin(buses, eq(buses.id, alumnos.busId))
    .leftJoin(servicios, eq(servicios.id, alumnos.servicioId))
    .where(eq(mensualidades.periodo, periodo))
    .orderBy(asc(personas.apellidos), asc(personas.nombres));
}

/** Alumnos activos que aún no tienen mensualidad en el periodo. */
export async function alumnosSinMensualidad(periodo: string) {
  return db
    .select({ id: alumnos.id, nombres: personas.nombres, apellidos: personas.apellidos, tarifa: alumnos.tarifaMensual })
    .from(alumnos)
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .where(
      and(
        eq(alumnos.estado, "activo"),
        isNull(alumnos.eliminadoEn),
        sql`not exists (select 1 from ${mensualidades} m where m.alumno_id = ${alumnos.id} and m.periodo = ${periodo})`,
      ),
    )
    .orderBy(asc(personas.apellidos));
}
