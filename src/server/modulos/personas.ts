import "server-only";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db, type DbOTx } from "@/server/db";
import { alumnoResponsables, alumnos, devoluciones, pagos, personaAlias, personas } from "@/server/db/schema";
import { auditar, calcularCambios, type Contexto } from "@/server/auditoria";
import { ErrorNegocio } from "@/server/errores";
import { esquemaPersona, parsearParcial, type DatosPersona } from "@/lib/validaciones";
import { normalizarTexto } from "@/lib/texto";
import { nombreCompleto } from "@/lib/formato";

export type Persona = typeof personas.$inferSelect;

export async function obtenerPersona(id: number, tx: DbOTx = db) {
  const [p] = await tx
    .select()
    .from(personas)
    .where(and(eq(personas.id, id), isNull(personas.eliminadoEn)));
  return p ?? null;
}

export async function buscarPersonaPorRut(rut: string | null, tx: DbOTx = db) {
  if (!rut) return null;
  const [p] = await tx
    .select()
    .from(personas)
    .where(and(eq(personas.rut, rut), isNull(personas.eliminadoEn)));
  return p ?? null;
}

/**
 * Busca personas parecidas (para evitar duplicados).
 * 1) Mismo RUT → coincidencia segura.  2) Nombre muy similar → posible duplicado.
 */
export async function posiblesDuplicados(
  datos: { nombres: string; apellidos?: string | null; rut?: string | null },
  opciones: { excluirId?: number; limite?: number } = {},
  tx: DbOTx = db,
) {
  const condicionExcluir = opciones.excluirId ? ne(personas.id, opciones.excluirId) : undefined;
  if (datos.rut) {
    const porRut = await tx
      .select()
      .from(personas)
      .where(and(eq(personas.rut, datos.rut), isNull(personas.eliminadoEn), condicionExcluir));
    if (porRut.length) return porRut.map((p) => ({ persona: p, motivo: "Mismo RUT" as const, similitud: 1 }));
  }
  const nombre = normalizarTexto(`${datos.nombres} ${datos.apellidos ?? ""}`);
  if (nombre.length < 4) return [];
  const similitud = sql<number>`similarity(f_unaccent(lower(${personas.nombres} || ' ' || ${personas.apellidos})), ${nombre})`;
  const filas = await tx
    .select({ persona: personas, similitud })
    .from(personas)
    .where(and(isNull(personas.eliminadoEn), condicionExcluir, sql`${similitud} > 0.55`))
    .orderBy(desc(similitud))
    .limit(opciones.limite ?? 5);
  return filas.map((f) => ({
    persona: f.persona,
    motivo: (f.similitud > 0.85 ? "Mismo nombre" : "Nombre similar") as "Mismo nombre" | "Nombre similar",
    similitud: f.similitud,
  }));
}

export async function crearPersona(ctx: Contexto, entrada: unknown, tx: DbOTx = db): Promise<Persona> {
  const datos = esquemaPersona.parse(entrada);
  if (datos.rut && (await buscarPersonaPorRut(datos.rut, tx))) {
    throw new ErrorNegocio(`Ya existe una persona con el RUT ${datos.rut}.`);
  }
  const [p] = await tx.insert(personas).values(datos).returning();
  await auditar(tx, ctx, {
    accion: "crear",
    entidad: "persona",
    entidadId: p.id,
    resumen: nombreCompleto(p),
    despues: p,
  });
  return p;
}

export async function actualizarPersona(
  ctx: Contexto,
  id: number,
  entrada: Partial<DatosPersona> | unknown,
  motivo?: string | null,
  tx: DbOTx = db,
): Promise<Persona> {
  const actual = await obtenerPersona(id, tx);
  if (!actual) throw new ErrorNegocio("La persona no existe.");
  const datos = parsearParcial(esquemaPersona, entrada);
  if (datos.rut && datos.rut !== actual.rut) {
    const otra = await buscarPersonaPorRut(datos.rut, tx);
    if (otra && otra.id !== id) throw new ErrorNegocio(`El RUT ${datos.rut} ya pertenece a ${nombreCompleto(otra)}.`);
  }
  // Sin cambios reales: no se escribe ni se audita
  if (calcularCambios(actual, { ...actual, ...datos }).length === 0) return actual;
  const [p] = await tx.update(personas).set(datos).where(eq(personas.id, id)).returning();
  await auditar(tx, ctx, {
    accion: "actualizar",
    entidad: "persona",
    entidadId: id,
    resumen: nombreCompleto(p),
    antes: actual,
    despues: p,
    motivo,
  });
  return p;
}

/** Busca por RUT; si no existe, por nombre exacto; si no, la crea. */
export async function obtenerOCrearPersona(ctx: Contexto, entrada: DatosPersona, tx: DbOTx = db): Promise<Persona> {
  const existente = await buscarPersonaPorRut(entrada.rut, tx);
  if (existente) return existente;
  return crearPersona(ctx, entrada, tx);
}

/** Registra un nombre alternativo (ej. titular de cuenta bancaria). */
export async function agregarAlias(
  tx: DbOTx,
  personaId: number,
  alias: string,
  origen: "banco" | "voucher" | "manual" | "importacion",
) {
  const limpio = alias.trim();
  if (limpio.length < 3) return;
  await tx.insert(personaAlias).values({ personaId, alias: limpio, origen }).onConflictDoNothing();
}

/**
 * FUSIONAR: une dos fichas de la misma persona. Todo lo relacionado con `duplicadoId`
 * pasa a `principalId` y el duplicado queda eliminado lógicamente (recuperable).
 */
export async function fusionarPersonas(ctx: Contexto, principalId: number, duplicadoId: number, motivo: string) {
  if (principalId === duplicadoId) throw new ErrorNegocio("Selecciona dos personas distintas.");
  if (!motivo?.trim()) throw new ErrorNegocio("Indica el motivo de la fusión.");
  return db.transaction(async (tx) => {
    const principal = await obtenerPersona(principalId, tx);
    const duplicado = await obtenerPersona(duplicadoId, tx);
    if (!principal || !duplicado) throw new ErrorNegocio("Alguna de las personas no existe.");

    const [alumnoP] = await tx.select().from(alumnos).where(and(eq(alumnos.personaId, principalId), isNull(alumnos.eliminadoEn)));
    const [alumnoD] = await tx.select().from(alumnos).where(and(eq(alumnos.personaId, duplicadoId), isNull(alumnos.eliminadoEn)));
    if (alumnoP && alumnoD) {
      throw new ErrorNegocio("Ambas personas tienen ficha de alumno. Revisa y elimina una de las fichas de alumno antes de fusionar.");
    }

    // Completar datos vacíos del principal con los del duplicado
    const completar: Partial<DatosPersona> = {};
    for (const k of ["rut", "telefono", "email", "direccion", "comuna"] as const) {
      if (!principal[k] && duplicado[k]) completar[k] = duplicado[k];
    }
    if (duplicado.rut && completar.rut) {
      await tx.update(personas).set({ rut: null }).where(eq(personas.id, duplicadoId));
    }

    await tx.update(alumnos).set({ personaId: principalId }).where(eq(alumnos.personaId, duplicadoId));
    // Responsables: evitar choques de (alumno, persona)
    const respD = await tx.select().from(alumnoResponsables).where(eq(alumnoResponsables.personaId, duplicadoId));
    for (const r of respD) {
      const [ya] = await tx
        .select()
        .from(alumnoResponsables)
        .where(and(eq(alumnoResponsables.alumnoId, r.alumnoId), eq(alumnoResponsables.personaId, principalId)));
      if (ya) {
        await tx
          .update(alumnoResponsables)
          .set({
            esApoderado: ya.esApoderado || r.esApoderado,
            esTitular: ya.esTitular || r.esTitular,
            esPagador: ya.esPagador || r.esPagador,
            parentesco: ya.parentesco ?? r.parentesco,
          })
          .where(eq(alumnoResponsables.id, ya.id));
        await tx.delete(alumnoResponsables).where(eq(alumnoResponsables.id, r.id));
      } else {
        await tx.update(alumnoResponsables).set({ personaId: principalId }).where(eq(alumnoResponsables.id, r.id));
      }
    }
    await tx.update(pagos).set({ pagadorId: principalId }).where(eq(pagos.pagadorId, duplicadoId));
    await tx.update(devoluciones).set({ personaId: principalId }).where(eq(devoluciones.personaId, duplicadoId));
    const aliasD = await tx.select().from(personaAlias).where(eq(personaAlias.personaId, duplicadoId));
    for (const a of aliasD) await agregarAlias(tx, principalId, a.alias, a.origen);
    await agregarAlias(tx, principalId, nombreCompleto(duplicado), "manual");

    const [actualizado] = await tx
      .update(personas)
      .set({
        ...completar,
        observaciones: [principal.observaciones, duplicado.observaciones].filter(Boolean).join("\n") || null,
      })
      .where(eq(personas.id, principalId))
      .returning();
    await tx.update(personas).set({ eliminadoEn: new Date() }).where(eq(personas.id, duplicadoId));

    await auditar(tx, ctx, {
      accion: "fusionar",
      entidad: "persona",
      entidadId: principalId,
      resumen: `${nombreCompleto(duplicado)} (#${duplicadoId}) fusionada en ${nombreCompleto(principal)} (#${principalId})`,
      antes: { principal, duplicado },
      despues: { principal: actualizado },
      motivo,
    });
    return actualizado;
  });
}

/** Roles y relaciones de una persona (para su ficha). */
export async function relacionesDePersona(personaId: number) {
  const comoAlumno = await db.query.alumnos.findFirst({
    where: (a, { and, eq, isNull }) => and(eq(a.personaId, personaId), isNull(a.eliminadoEn)),
    with: { bus: true, servicio: true },
  });
  const comoResponsable = await db.query.alumnoResponsables.findMany({
    where: (r, { eq }) => eq(r.personaId, personaId),
    with: { alumno: { with: { persona: true, bus: true } } },
  });
  const pagosRealizados = await db.query.pagos.findMany({
    where: (p, { eq }) => eq(p.pagadorId, personaId),
    orderBy: (p, { desc }) => [desc(p.fechaPago)],
    limit: 50,
  });
  const alias = await db.select().from(personaAlias).where(eq(personaAlias.personaId, personaId));
  return { comoAlumno, comoResponsable, pagosRealizados, alias };
}

export async function listarPersonas(q: string | undefined, limite = 100) {
  const filtro = q ? normalizarTexto(q) : "";
  return db
    .select()
    .from(personas)
    .where(
      and(
        isNull(personas.eliminadoEn),
        filtro
          ? or(sql`${personas.textoBusqueda} like ${"%" + filtro + "%"}`, sql`${filtro} <% ${personas.textoBusqueda}`)
          : undefined,
      ),
    )
    .orderBy(personas.apellidos, personas.nombres)
    .limit(limite);
}
