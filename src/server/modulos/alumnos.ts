import "server-only";
import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, type DbOTx } from "@/server/db";
import {
  alumnoResponsables,
  alumnos,
  auditoria,
  buses,
  documentos,
  mensualidades,
  pagoAplicaciones,
  pagos,
  personas,
  servicios,
  usuarios,
} from "@/server/db/schema";
import { auditar, calcularCambios, type Contexto } from "@/server/auditoria";
import { ErrorNegocio } from "@/server/errores";
import { hoy } from "@/server/fechas";
import {
  esquemaAlumno,
  parsearParcial,
  esquemaPersona,
  esquemaResponsable,
  type DatosPersona,
  type DatosResponsable,
} from "@/lib/validaciones";
import { normalizarTexto } from "@/lib/texto";
import { nombreCompleto } from "@/lib/formato";
import type { EstadoAlumno } from "@/lib/constantes";
import { actualizarPersona, crearPersona, obtenerOCrearPersona, obtenerPersona } from "./personas";

export type EntradaNuevoAlumno = {
  personaId?: number | null;
  persona?: DatosPersona;
  alumno: unknown;
  apoderado?: ({ personaId?: number | null; persona?: DatosPersona } & Partial<DatosResponsable>) | null;
};

/** Crea alumno (y si corresponde su persona y apoderado) en una sola transacción auditada. */
export async function crearAlumno(ctx: Contexto, entrada: EntradaNuevoAlumno, txExterna?: DbOTx) {
  const ejecutar = async (tx: DbOTx) => {
    const persona = entrada.personaId
      ? await obtenerPersona(entrada.personaId, tx)
      : await crearPersona(ctx, esquemaPersona.parse(entrada.persona), tx);
    if (!persona) throw new ErrorNegocio("La persona indicada no existe.");

    const [yaAlumno] = await tx
      .select({ id: alumnos.id })
      .from(alumnos)
      .where(and(eq(alumnos.personaId, persona.id), isNull(alumnos.eliminadoEn)));
    if (yaAlumno) throw new ErrorNegocio(`${nombreCompleto(persona)} ya tiene ficha de alumno.`);

    const datos = esquemaAlumno.parse(entrada.alumno);
    const [alumno] = await tx
      .insert(alumnos)
      .values({ ...datos, personaId: persona.id })
      .returning();
    await auditar(tx, ctx, {
      accion: "crear",
      entidad: "alumno",
      entidadId: alumno.id,
      resumen: nombreCompleto(persona),
      despues: alumno,
    });

    if (entrada.apoderado && (entrada.apoderado.personaId || entrada.apoderado.persona?.nombres)) {
      const ap = entrada.apoderado;
      const personaAp = ap.personaId
        ? await obtenerPersona(ap.personaId, tx)
        : await obtenerOCrearPersona(ctx, esquemaPersona.parse(ap.persona), tx);
      if (!personaAp) throw new ErrorNegocio("El apoderado indicado no existe.");
      await vincularResponsable(ctx, alumno.id, personaAp.id, {
        esApoderado: ap.esApoderado ?? true,
        esTitular: ap.esTitular ?? true,
        esPagador: ap.esPagador ?? true,
        parentesco: ap.parentesco ?? null,
      }, tx);
    }
    return alumno;
  };
  return txExterna ? ejecutar(txExterna) : db.transaction(ejecutar);
}

export async function actualizarAlumno(ctx: Contexto, id: number, entrada: unknown, motivo?: string | null, tx: DbOTx = db) {
  const [actual] = await tx.select().from(alumnos).where(and(eq(alumnos.id, id), isNull(alumnos.eliminadoEn)));
  if (!actual) throw new ErrorNegocio("El alumno no existe.");
  const datos = parsearParcial(esquemaAlumno, entrada);
  if (calcularCambios(actual, { ...actual, ...datos }).length === 0) return actual;
  const [nuevo] = await tx.update(alumnos).set(datos).where(eq(alumnos.id, id)).returning();
  const persona = await obtenerPersona(actual.personaId, tx);
  await auditar(tx, ctx, {
    accion: "actualizar",
    entidad: "alumno",
    entidadId: id,
    resumen: nombreCompleto(persona),
    antes: actual,
    despues: nuevo,
    motivo,
  });
  return nuevo;
}

/** Actualiza datos personales y de alumno en una sola operación. */
export async function actualizarFichaAlumno(
  ctx: Contexto,
  id: number,
  entrada: { persona: unknown; alumno: unknown },
  motivo?: string | null,
) {
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(alumnos).where(eq(alumnos.id, id));
    if (!a) throw new ErrorNegocio("El alumno no existe.");
    await actualizarPersona(ctx, a.personaId, entrada.persona, motivo, tx);
    return actualizarAlumno(ctx, id, entrada.alumno, motivo, tx);
  });
}

export async function vincularResponsable(
  ctx: Contexto,
  alumnoId: number,
  personaId: number,
  entrada: Partial<DatosResponsable>,
  tx: DbOTx = db,
) {
  const datos = esquemaResponsable.parse(entrada);
  if (datos.esTitular) {
    // Solo un apoderado titular por alumno
    await tx.update(alumnoResponsables).set({ esTitular: false }).where(eq(alumnoResponsables.alumnoId, alumnoId));
  }
  const [fila] = await tx
    .insert(alumnoResponsables)
    .values({ alumnoId, personaId, ...datos })
    .onConflictDoUpdate({ target: [alumnoResponsables.alumnoId, alumnoResponsables.personaId], set: datos })
    .returning();
  const persona = await obtenerPersona(personaId, tx);
  await auditar(tx, ctx, {
    accion: "vincular_responsable",
    entidad: "alumno",
    entidadId: alumnoId,
    resumen: `${nombreCompleto(persona)} → ${[datos.esTitular && "titular", datos.esApoderado && "apoderado", datos.esPagador && "pagador"].filter(Boolean).join(", ")}`,
    despues: fila,
  });
  return fila;
}

export async function desvincularResponsable(ctx: Contexto, responsableId: number, motivo?: string | null) {
  return db.transaction(async (tx) => {
    const [r] = await tx.delete(alumnoResponsables).where(eq(alumnoResponsables.id, responsableId)).returning();
    if (!r) throw new ErrorNegocio("La relación no existe.");
    const persona = await obtenerPersona(r.personaId, tx);
    await auditar(tx, ctx, {
      accion: "desvincular_responsable",
      entidad: "alumno",
      entidadId: r.alumnoId,
      resumen: nombreCompleto(persona),
      antes: r,
      motivo,
    });
  });
}

export type FiltrosAlumnos = {
  q?: string;
  busId?: number;
  servicioId?: number;
  estado?: EstadoAlumno | "todos";
  soloConDeuda?: boolean;
};

/** Listado con bus, servicio, apoderado titular y deuda vencida. */
export async function listarAlumnos(f: FiltrosAlumnos = {}) {
  const condiciones: (SQL | undefined)[] = [isNull(alumnos.eliminadoEn)];
  if (f.estado && f.estado !== "todos") condiciones.push(eq(alumnos.estado, f.estado));
  if (f.busId) condiciones.push(eq(alumnos.busId, f.busId));
  if (f.servicioId) condiciones.push(eq(alumnos.servicioId, f.servicioId));
  if (f.q) {
    const q = normalizarTexto(f.q);
    condiciones.push(
      or(
        sql`${personas.textoBusqueda} like ${"%" + q + "%"}`,
        sql`exists (select 1 from ${alumnoResponsables} r join ${personas} pr on pr.id = r.persona_id
                    where r.alumno_id = ${alumnos.id} and pr.texto_busqueda like ${"%" + q + "%"})`,
      ),
    );
  }
  const hoyStr = hoy();
  const deuda = sql<number>`coalesce((select sum(m.monto - m.monto_pagado) from ${mensualidades} m
      where m.alumno_id = ${alumnos.id} and m.estado in ('pendiente','parcial') and m.fecha_vencimiento < ${hoyStr}), 0)::int`;
  const mesesDeuda = sql<number>`(select count(*) from ${mensualidades} m
      where m.alumno_id = ${alumnos.id} and m.estado in ('pendiente','parcial') and m.fecha_vencimiento < ${hoyStr})::int`;
  const titular = sql<string | null>`(select pr.nombres || ' ' || pr.apellidos from ${alumnoResponsables} r
      join ${personas} pr on pr.id = r.persona_id where r.alumno_id = ${alumnos.id}
      order by r.es_titular desc, r.id limit 1)`;

  const filas = await db
    .select({
      id: alumnos.id,
      personaId: personas.id,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      rut: personas.rut,
      telefono: personas.telefono,
      establecimiento: alumnos.establecimiento,
      curso: alumnos.curso,
      estado: alumnos.estado,
      tarifaMensual: alumnos.tarifaMensual,
      busNumero: buses.numero,
      servicioNombre: servicios.nombre,
      titular,
      deuda,
      mesesDeuda,
    })
    .from(alumnos)
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .leftJoin(buses, eq(buses.id, alumnos.busId))
    .leftJoin(servicios, eq(servicios.id, alumnos.servicioId))
    .where(and(...condiciones))
    .orderBy(asc(personas.apellidos), asc(personas.nombres));
  return f.soloConDeuda ? filas.filter((a) => a.deuda > 0) : filas;
}

/** Ficha completa: todo lo relacionado con el alumno en un solo lugar. */
export async function obtenerFichaAlumno(id: number) {
  const alumno = await db.query.alumnos.findFirst({
    where: (a, { and, eq, isNull }) => and(eq(a.id, id), isNull(a.eliminadoEn)),
    with: {
      persona: true,
      bus: true,
      servicio: true,
      responsables: { with: { persona: true } },
    },
  });
  if (!alumno) return null;

  const listaMensualidades = await db
    .select()
    .from(mensualidades)
    .where(eq(mensualidades.alumnoId, id))
    .orderBy(asc(mensualidades.periodo));

  const idsMens = listaMensualidades.map((m) => m.id);
  const aplicaciones = idsMens.length
    ? await db
        .select({
          id: pagoAplicaciones.id,
          mensualidadId: pagoAplicaciones.mensualidadId,
          monto: pagoAplicaciones.monto,
          pagoId: pagos.id,
          fechaPago: pagos.fechaPago,
          estadoVerificacion: pagos.estadoVerificacion,
        })
        .from(pagoAplicaciones)
        .innerJoin(pagos, eq(pagos.id, pagoAplicaciones.pagoId))
        .where(inArray(pagoAplicaciones.mensualidadId, idsMens))
    : [];

  const pagosAlumno = await db.query.pagos.findMany({
    where: (p, { or, eq, inArray }) =>
      or(
        eq(p.alumnoId, id),
        idsMens.length
          ? inArray(
              p.id,
              db.select({ id: pagoAplicaciones.pagoId }).from(pagoAplicaciones).where(inArray(pagoAplicaciones.mensualidadId, idsMens)),
            )
          : undefined,
      ),
    with: { pagador: true },
    orderBy: (p, { desc }) => [desc(p.fechaPago), desc(p.id)],
  });

  const docs = await db
    .select()
    .from(documentos)
    .where(
      and(
        isNull(documentos.eliminadoEn),
        or(
          and(eq(documentos.entidadTipo, "alumno"), eq(documentos.entidadId, id)),
          pagosAlumno.length
            ? and(eq(documentos.entidadTipo, "pago"), inArray(documentos.entidadId, pagosAlumno.map((p) => p.id)))
            : undefined,
        ),
      ),
    );

  const historial = await db
    .select({
      id: auditoria.id,
      fecha: auditoria.fecha,
      accion: auditoria.accion,
      entidad: auditoria.entidad,
      resumen: auditoria.resumen,
      motivo: auditoria.motivo,
      cambios: auditoria.cambios,
      usuario: usuarios.nombre,
    })
    .from(auditoria)
    .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
    .where(
      or(
        and(eq(auditoria.entidad, "alumno"), eq(auditoria.entidadId, String(id))),
        and(eq(auditoria.entidad, "persona"), eq(auditoria.entidadId, String(alumno.personaId))),
        idsMens.length
          ? and(eq(auditoria.entidad, "mensualidad"), inArray(auditoria.entidadId, idsMens.map(String)))
          : undefined,
      ),
    )
    .orderBy(sql`${auditoria.fecha} desc`)
    .limit(100);

  const hoyStr = hoy();
  const vencidas = listaMensualidades.filter(
    (m) => (m.estado === "pendiente" || m.estado === "parcial") && m.fechaVencimiento < hoyStr,
  );
  const resumen = {
    deudaVencida: vencidas.reduce((s, m) => s + m.monto - m.montoPagado, 0),
    mesesVencidos: vencidas.length,
    totalPagado: listaMensualidades.reduce((s, m) => s + m.montoPagado, 0),
    porVencer: listaMensualidades
      .filter((m) => (m.estado === "pendiente" || m.estado === "parcial") && m.fechaVencimiento >= hoyStr)
      .reduce((s, m) => s + m.monto - m.montoPagado, 0),
  };

  return { alumno, mensualidades: listaMensualidades, aplicaciones, pagos: pagosAlumno, documentos: docs, historial, resumen };
}

/** Mensualidades con saldo de un alumno, de la más antigua a la más nueva. */
export async function mensualidadesConSaldo(alumnoId: number, tx: DbOTx = db) {
  return tx
    .select()
    .from(mensualidades)
    .where(and(eq(mensualidades.alumnoId, alumnoId), inArray(mensualidades.estado, ["pendiente", "parcial"])))
    .orderBy(asc(mensualidades.periodo));
}

export async function contarAlumnosActivos() {
  const [r] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(alumnos)
    .where(and(eq(alumnos.estado, "activo"), isNull(alumnos.eliminadoEn)));
  return r?.total ?? 0;
}

