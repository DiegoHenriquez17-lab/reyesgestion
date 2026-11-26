import "server-only";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { ESTADOS_DEVOLUCION } from "@/lib/constantes";
import { inicioDeMes } from "@/lib/fechas";
import { fecha, idOpcional, textoOpcional } from "@/lib/validaciones";
import { auditar, bloquearCobranza, exigirMotivoSiCerrado, type Contexto } from "@/server/auditoria";
import { db } from "@/server/db";
import { alumnos, devoluciones, pagos, personas } from "@/server/db/schema";
import { ErrorNegocio } from "@/server/errores";
import { hoy } from "@/server/fechas";

const motivo = z.string().trim().min(3, "Indica el motivo").max(500);
const id = z.coerce.number().int().positive().max(2147483647);

export function listarDevoluciones(alumnoId?: number) {
  return db.select({ devolucion: devoluciones, persona: personas }).from(devoluciones).leftJoin(alumnos, eq(alumnos.id, devoluciones.alumnoId))
    .leftJoin(personas, eq(personas.id, alumnos.personaId)).where(alumnoId ? eq(devoluciones.alumnoId, alumnoId) : undefined)
    .orderBy(desc(devoluciones.fechaSolicitud), desc(devoluciones.id));
}

export async function solicitarDevolucion(ctx: Contexto, entrada: unknown) {
  const datos = z.object({ alumnoId: id, pagoId: idOpcional, fechaSolicitud: fecha, motivo, observaciones: textoOpcional,
    monto: z.coerce.number().int().positive().max(2147483647) }).parse(entrada);
  if (datos.fechaSolicitud > hoy()) throw new ErrorNegocio("La fecha de solicitud debe ser hoy o anterior.");
  return db.transaction(async (tx) => {
    await bloquearCobranza(tx);
    const [a] = await tx.select().from(alumnos).where(and(eq(alumnos.id, datos.alumnoId), isNull(alumnos.eliminadoEn)));
    if (!a) throw new ErrorNegocio("Selecciona un alumno vigente.");
    const periodoCerrado = await exigirMotivoSiCerrado(tx, [inicioDeMes(datos.fechaSolicitud)], datos.motivo);
    if (datos.pagoId) {
      const [p] = await tx.select().from(pagos).where(and(eq(pagos.id, datos.pagoId), isNull(pagos.anuladoEn))).for("update");
      if (!p || p.alumnoId !== a.id || p.estadoVerificacion !== "verificado") throw new ErrorNegocio("Selecciona un pago verificado que esté vinculado al alumno.");
      const [registrado] = await tx.select({ monto: sql<number>`coalesce(sum(${devoluciones.monto}), 0)::int` }).from(devoluciones)
        .where(and(eq(devoluciones.pagoId, p.id), ne(devoluciones.estado, "anulada")));
      if (registrado.monto + datos.monto > p.monto) throw new ErrorNegocio("El monto solicitado supera lo disponible para devolver en este pago.");
    }
    const [d] = await tx.insert(devoluciones).values(datos).returning();
    await auditar(tx, ctx, { accion: "crear", entidad: "devolucion", entidadId: d.id, despues: d, motivo: datos.motivo, periodoCerrado });
    return d;
  });
}

export async function resolverDevolucion(ctx: Contexto, registroId: number, entrada: unknown) {
  const datos = z.object({ estado: z.enum(ESTADOS_DEVOLUCION).exclude(["pendiente"]), fechaRealizada: z.string().optional(), motivo }).parse(entrada);
  return db.transaction(async (tx) => {
    await bloquearCobranza(tx);
    const [antes] = await tx.select().from(devoluciones).where(eq(devoluciones.id, registroId)).for("update");
    if (antes?.estado !== "pendiente") throw new ErrorNegocio("Esta devolución ya fue resuelta.");
    const fechaRealizada = datos.estado === "realizada" ? fecha.parse(datos.fechaRealizada) : null;
    if (fechaRealizada && (fechaRealizada < antes.fechaSolicitud || fechaRealizada > hoy())) throw new ErrorNegocio("La fecha de devolución debe estar entre la solicitud y hoy.");
    const periodos = [inicioDeMes(antes.fechaSolicitud), ...(fechaRealizada ? [inicioDeMes(fechaRealizada)] : [])];
    const periodoCerrado = await exigirMotivoSiCerrado(tx, periodos, datos.motivo);
    const [despues] = await tx.update(devoluciones).set({ estado: datos.estado, fechaRealizada }).where(eq(devoluciones.id, registroId)).returning();
    await auditar(tx, ctx, { accion: datos.estado === "realizada" ? "realizar" : "anular", entidad: "devolucion", entidadId: registroId, antes, despues, motivo: datos.motivo, periodoCerrado });
    return despues;
  });
}
