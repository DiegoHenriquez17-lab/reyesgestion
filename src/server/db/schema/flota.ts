import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { TIPOS_SERVICIO } from "@/lib/constantes";
import { eliminacionLogica, marcasDeTiempo } from "./_comun";
import { documentos } from "./documentos";
import { personas } from "./personas";

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

export const conductores = pgTable("conductores", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  personaId: integer().notNull().unique().references(() => personas.id),
  claseLicencia: text(),
  activo: boolean().notNull().default(true),
  observaciones: text(),
  ...marcasDeTiempo,
});

export const documentosControl = pgTable("documentos_control", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  busId: integer().references(() => buses.id),
  conductorId: integer().references(() => conductores.id),
  documentoId: integer().references(() => documentos.id),
  tipo: text().notNull(),
  fechaEmision: date(),
  fechaVencimiento: date().notNull(),
  observaciones: text(),
  ...marcasDeTiempo,
  ...eliminacionLogica,
}, (t) => [
  check("documentos_control_un_titular", sql`num_nonnulls(${t.busId}, ${t.conductorId}) = 1`),
  check("documentos_control_fechas", sql`${t.fechaEmision} <= ${t.fechaVencimiento}`),
  index("documentos_control_vencimiento_idx").on(t.fechaVencimiento).where(sql`${t.eliminadoEn} is null`),
]);

export const lecturasKilometraje = pgTable("lecturas_kilometraje", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  busId: integer().notNull().references(() => buses.id),
  fecha: date().notNull(),
  kilometraje: integer().notNull(),
  ...marcasDeTiempo,
}, (t) => [
  check("lecturas_kilometraje_positivo", sql`${t.kilometraje} >= 0`),
  index("lecturas_kilometraje_bus_fecha_idx").on(t.busId, t.fecha, t.id),
]);

export const planesMantencion = pgTable("planes_mantencion", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  busId: integer().notNull().references(() => buses.id),
  tarea: text().notNull(),
  proximaFecha: date(),
  proximoKm: integer(),
  intervaloDias: integer(),
  intervaloKm: integer(),
  activo: boolean().notNull().default(true),
  ...marcasDeTiempo,
}, (t) => [check("planes_mantencion_activo_con_plazo", sql`not ${t.activo} or num_nonnulls(${t.proximaFecha}, ${t.proximoKm}) > 0`)]);

export const mantenciones = pgTable("mantenciones", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  planId: integer().references(() => planesMantencion.id),
  busId: integer().notNull().references(() => buses.id),
  tarea: text().notNull(),
  fecha: date().notNull(),
  kilometraje: integer(),
  costo: integer().notNull(),
  observaciones: text(),
  ...marcasDeTiempo,
}, (t) => [index("mantenciones_bus_fecha_idx").on(t.busId, t.fecha)]);

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
