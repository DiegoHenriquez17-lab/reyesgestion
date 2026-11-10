import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, smallint, text, uniqueIndex } from "drizzle-orm/pg-core";
import { ESTADOS_ALUMNO } from "@/lib/constantes";
import { eliminacionLogica, marcasDeTiempo } from "./_comun";
import { buses, servicios } from "./flota";
import { personas } from "./personas";

/** ALUMNOS: rol de una persona que usa el transporte. */
export const alumnos = pgTable(
  "alumnos",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    personaId: integer()
      .notNull()
      .references(() => personas.id),
    establecimiento: text(),
    curso: text(),
    busId: integer().references(() => buses.id),
    servicioId: integer().references(() => servicios.id),
    /** Tarifa mensual vigente en pesos chilenos (sin decimales). */
    tarifaMensual: integer().notNull().default(0),
    /** Día de vencimiento propio. Si es nulo se usa el de la configuración general. */
    diaVencimiento: smallint(),
    fechaIngreso: date({ mode: "string" }),
    fechaRetiro: date({ mode: "string" }),
    estado: text({ enum: ESTADOS_ALUMNO }).notNull().default("activo"),
    observaciones: text(),
    ...marcasDeTiempo,
    ...eliminacionLogica,
  },
  (t) => [
    uniqueIndex("alumnos_persona_uq").on(t.personaId).where(sql`${t.eliminadoEn} is null`),
    index("alumnos_bus_idx").on(t.busId),
    index("alumnos_servicio_idx").on(t.servicioId),
    check("alumnos_tarifa_ck", sql`${t.tarifaMensual} >= 0`),
    check("alumnos_dia_venc_ck", sql`${t.diaVencimiento} is null or ${t.diaVencimiento} between 1 and 31`),
  ],
);

/**
 * Relación alumno ↔ persona responsable.
 * Una misma persona puede ser apoderado titular, suplente y/o pagador.
 */
export const alumnoResponsables = pgTable(
  "alumno_responsables",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    alumnoId: integer()
      .notNull()
      .references(() => alumnos.id, { onDelete: "cascade" }),
    personaId: integer()
      .notNull()
      .references(() => personas.id),
    esApoderado: boolean().notNull().default(true),
    esTitular: boolean().notNull().default(false),
    esPagador: boolean().notNull().default(false),
    parentesco: text(),
    ...marcasDeTiempo,
  },
  (t) => [
    uniqueIndex("alumno_responsables_uq").on(t.alumnoId, t.personaId),
    index("alumno_responsables_persona_idx").on(t.personaId),
  ],
);
