import "server-only";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { alumnoResponsables, alumnos, buses, pagos, personaAlias, personas } from "@/server/db/schema";
import { normalizarTexto } from "@/lib/texto";
import { normalizarRut } from "@/lib/rut";
import { parsearMonto } from "@/lib/formato";

export type ResultadoBusqueda = {
  personas: {
    id: number;
    nombre: string;
    rut: string | null;
    telefono: string | null;
    alumnoId: number | null;
    roles: string[];
    alumnosACargo: { id: number; nombre: string }[];
  }[];
  buses: { id: number; numero: string; patente: string | null; totalAlumnos: number }[];
  pagos: { id: number; fecha: string; monto: number; nombreOrigen: string | null; operacion: string | null }[];
};

/**
 * BUSCADOR GLOBAL: escribe "Jorge", un RUT, un teléfono, un N° de operación o un monto
 * y encuentra todo lo relacionado (como alumno, apoderado, pagador, bus o pago).
 * Tolera tildes y errores de tipeo (búsqueda aproximada con pg_trgm).
 */
export async function buscarTodo(texto: string, limite = 12): Promise<ResultadoBusqueda> {
  const q = normalizarTexto(texto);
  if (q.length < 2) return { personas: [], buses: [], pagos: [] };
  const rut = normalizarRut(texto);
  const comoRut = rut && /\d{6,}/.test(rut) ? rut : null;

  const similitud = sql<number>`greatest(word_similarity(${q}, ${personas.textoBusqueda}),
     coalesce((select max(word_similarity(${q}, pa.alias_normalizado)) from ${personaAlias} pa where pa.persona_id = ${personas.id}), 0))`;
  const filasPersonas = await db
    .select({
      id: personas.id,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      rut: personas.rut,
      telefono: personas.telefono,
      similitud,
    })
    .from(personas)
    .where(
      and(
        isNull(personas.eliminadoEn),
        or(
          sql`${personas.textoBusqueda} like ${"%" + q + "%"}`,
          sql`${q} <% ${personas.textoBusqueda}`,
          comoRut ? eq(personas.rut, comoRut) : undefined,
          sql`exists (select 1 from ${personaAlias} pa where pa.persona_id = ${personas.id} and (pa.alias_normalizado like ${"%" + q + "%"} or ${q} <% pa.alias_normalizado))`,
        ),
      ),
    )
    .orderBy(desc(similitud), personas.apellidos)
    .limit(limite);

  const ids = filasPersonas.map((p) => p.id);
  const comoAlumno = ids.length
    ? await db
        .select({ id: alumnos.id, personaId: alumnos.personaId, estado: alumnos.estado })
        .from(alumnos)
        .where(and(inArray(alumnos.personaId, ids), isNull(alumnos.eliminadoEn)))
    : [];
  const aCargo = ids.length
    ? await db
        .select({
          personaId: alumnoResponsables.personaId,
          alumnoId: alumnos.id,
          esTitular: alumnoResponsables.esTitular,
          esPagador: alumnoResponsables.esPagador,
          esApoderado: alumnoResponsables.esApoderado,
          nombres: personas.nombres,
          apellidos: personas.apellidos,
        })
        .from(alumnoResponsables)
        .innerJoin(alumnos, eq(alumnos.id, alumnoResponsables.alumnoId))
        .innerJoin(personas, eq(personas.id, alumnos.personaId))
        .where(inArray(alumnoResponsables.personaId, ids))
    : [];

  const resultadoPersonas = filasPersonas.map((p) => {
    const al = comoAlumno.find((a) => a.personaId === p.id);
    const cargos = aCargo.filter((c) => c.personaId === p.id);
    const roles = [
      al && "Alumno",
      cargos.some((c) => c.esTitular) && "Apoderado titular",
      cargos.some((c) => c.esApoderado && !c.esTitular) && "Apoderado",
      cargos.some((c) => c.esPagador) && "Pagador",
    ].filter(Boolean) as string[];
    return {
      id: p.id,
      nombre: `${p.nombres} ${p.apellidos}`.trim(),
      rut: p.rut,
      telefono: p.telefono,
      alumnoId: al?.id ?? null,
      roles,
      alumnosACargo: cargos.map((c) => ({ id: c.alumnoId, nombre: `${c.nombres} ${c.apellidos}`.trim() })),
    };
  });

  const textoBus = texto.trim().replace(/^bus\s*/i, "");
  const filasBuses = await db
    .select({
      id: buses.id,
      numero: buses.numero,
      patente: buses.patente,
      totalAlumnos: sql<number>`(select count(*) from ${alumnos} a where a.bus_id = ${buses.id} and a.eliminado_en is null and a.estado = 'activo')::int`,
    })
    .from(buses)
    .where(
      and(
        isNull(buses.eliminadoEn),
        or(eq(buses.numero, textoBus), sql`upper(coalesce(${buses.patente}, '')) like ${"%" + textoBus.toUpperCase().replace(/[^A-Z0-9]/g, "") + "%"}`),
      ),
    )
    .limit(5);

  const monto = parsearMonto(texto);
  const filasPagos = await db
    .select({
      id: pagos.id,
      fecha: pagos.fechaPago,
      monto: pagos.monto,
      nombreOrigen: pagos.nombreOrigen,
      operacion: pagos.numeroOperacion,
    })
    .from(pagos)
    .where(
      and(
        isNull(pagos.anuladoEn),
        or(
          texto.trim().length >= 4 ? sql`${pagos.numeroOperacion} ilike ${"%" + texto.trim() + "%"}` : undefined,
          monto && monto >= 1000 ? eq(pagos.monto, monto) : undefined,
          q.length >= 3 ? sql`f_unaccent(lower(coalesce(${pagos.nombreOrigen}, ''))) like ${"%" + q + "%"}` : undefined,
        ),
      ),
    )
    .orderBy(desc(pagos.fechaPago))
    .limit(8);

  return { personas: resultadoPersonas, buses: filasBuses.filter((b) => b.patente || b.numero === textoBus), pagos: filasPagos };
}
