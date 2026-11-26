import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { ESTADOS_COTIZACION, ESTADOS_VIAJE } from "@/lib/operaciones";
import { marcasDeTiempo } from "./_comun";
import { documentos } from "./documentos";
import { buses, conductores, servicios } from "./flota";
import { personas } from "./personas";

export const cotizaciones = pgTable("cotizaciones", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  clienteId: integer().notNull().references(() => personas.id),
  servicioId: integer().notNull().references(() => servicios.id),
  detalle: text().notNull(),
  fechaSolicitud: date().notNull(),
  fechaServicio: date().notNull(),
  monto: integer().notNull(),
  estado: text({ enum: ESTADOS_COTIZACION }).notNull().default("pendiente"),
  ...marcasDeTiempo,
}, (t) => [index("cotizaciones_estado_fecha_idx").on(t.estado, t.fechaServicio)]);

export const viajes = pgTable("viajes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cotizacionId: integer().unique().references(() => cotizaciones.id),
  clienteId: integer().notNull().references(() => personas.id),
  servicioId: integer().notNull().references(() => servicios.id),
  busId: integer().references(() => buses.id),
  conductorId: integer().references(() => conductores.id),
  fecha: date().notNull(),
  detalle: text().notNull(),
  monto: integer().notNull(),
  documentacionLista: boolean().notNull().default(false),
  estado: text({ enum: ESTADOS_VIAJE }).notNull().default("programado"),
  ...marcasDeTiempo,
}, (t) => [index("viajes_estado_fecha_idx").on(t.estado, t.fecha)]);

export const contratos = pgTable("contratos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  clienteId: integer().notNull().references(() => personas.id),
  servicioId: integer().notNull().references(() => servicios.id),
  documentoId: integer().references(() => documentos.id),
  titulo: text().notNull(),
  detalle: text().notNull(),
  fechaInicio: date().notNull(),
  fechaVencimiento: date().notNull(),
  monto: integer().notNull(),
  activo: boolean().notNull().default(true),
  ...marcasDeTiempo,
}, (t) => [check("contratos_fechas", sql`${t.fechaInicio} <= ${t.fechaVencimiento}`), index("contratos_vencimiento_idx").on(t.fechaVencimiento)]);
