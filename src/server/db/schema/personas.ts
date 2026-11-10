import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { eliminacionLogica, marcasDeTiempo } from "./_comun";

/**
 * PERSONAS: registro único de cada ser humano (alumno, apoderado, pagador, conductor…).
 * Un mismo RUT existe una sola vez. Los roles se obtienen por relación.
 */
export const personas = pgTable(
  "personas",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombres: text().notNull(),
    apellidos: text().notNull().default(""),
    /** RUT normalizado sin puntos y con guion: 12345678-K */
    rut: text(),
    telefono: text(),
    email: text(),
    direccion: text(),
    comuna: text(),
    observaciones: text(),
    /** Texto normalizado (minúsculas, sin tildes) para el buscador. Lo calcula la BD. */
    textoBusqueda: text().generatedAlwaysAs(
      sql`f_unaccent(lower(nombres || ' ' || apellidos || ' ' || coalesce(rut, '') || ' ' || coalesce(telefono, '') || ' ' || coalesce(email, '')))`,
    ),
    ...marcasDeTiempo,
    ...eliminacionLogica,
  },
  (t) => [
    uniqueIndex("personas_rut_uq").on(t.rut).where(sql`${t.rut} is not null and ${t.eliminadoEn} is null`),
    index("personas_busqueda_trgm").using("gin", t.textoBusqueda.op("gin_trgm_ops")),
  ],
);

/**
 * Nombres alternativos con que aparece una persona (p. ej. el nombre del titular
 * de la cuenta bancaria en una transferencia). Permite que la conciliación "aprenda".
 */
export const personaAlias = pgTable(
  "persona_alias",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    personaId: integer()
      .notNull()
      .references(() => personas.id, { onDelete: "cascade" }),
    alias: text().notNull(),
    aliasNormalizado: text().generatedAlwaysAs(sql`f_unaccent(lower(alias))`),
    origen: text({ enum: ["banco", "voucher", "manual", "importacion"] }).notNull().default("manual"),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("persona_alias_uq").on(t.personaId, t.aliasNormalizado),
    index("persona_alias_trgm").using("gin", t.aliasNormalizado.op("gin_trgm_ops")),
  ],
);
