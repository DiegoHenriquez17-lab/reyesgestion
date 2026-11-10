import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { TIPOS_SERVICIO } from "@/lib/constantes";
import { eliminacionLogica, marcasDeTiempo } from "./_comun";

/**
 * BUSES. En la Versión 1 solo se usa para asignar alumnos y agrupar informes.
 * La Versión 2 agrega documentación, vencimientos y mantenciones.
 */
export const buses = pgTable(
  "buses",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Número interno con que la empresa identifica el bus (ej: "16"). */
    numero: text().notNull(),
    patente: text(),
    descripcion: text(),
    capacidad: integer(),
    activo: boolean().notNull().default(true),
    observaciones: text(),
    ...marcasDeTiempo,
    ...eliminacionLogica,
  },
  (t) => [
    uniqueIndex("buses_numero_uq").on(t.numero).where(sql`${t.eliminadoEn} is null`),
    uniqueIndex("buses_patente_uq").on(t.patente).where(sql`${t.patente} is not null and ${t.eliminadoEn} is null`),
  ],
);

/** Catálogo de servicios (recorridos escolares, servicios especiales, etc.). */
export const servicios = pgTable(
  "servicios",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombre: text().notNull(),
    tipo: text({ enum: TIPOS_SERVICIO }).notNull().default("escolar"),
    descripcion: text(),
    tarifaReferencia: integer(),
    activo: boolean().notNull().default(true),
    ...marcasDeTiempo,
    ...eliminacionLogica,
  },
  (t) => [uniqueIndex("servicios_nombre_uq").on(sql`lower(${t.nombre})`).where(sql`${t.eliminadoEn} is null`)],
);
