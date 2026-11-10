import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { ESTADOS_ALERTA, MODULOS, NIVELES_ALERTA, type NivelAlerta } from "@/lib/constantes";
import { usuarios } from "./usuarios";

/**
 * AUDITORÍA: QUIÉN — CUÁNDO — QUÉ CAMBIÓ — POR QUÉ.
 * Solo se inserta; nunca se modifica ni se elimina desde la aplicación.
 */
export const auditoria = pgTable(
  "auditoria",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    fecha: timestamp({ withTimezone: true }).notNull().defaultNow(),
    usuarioId: integer().references(() => usuarios.id),
    accion: text().notNull(),
    entidad: text().notNull(),
    entidadId: text(),
    /** Descripción legible: "Vincenzo Verri — Julio 2027". */
    resumen: text(),
    antes: jsonb(),
    despues: jsonb(),
    cambios: jsonb().$type<{ campo: string; antes: unknown; despues: unknown }[]>(),
    motivo: text(),
    origen: text({ enum: ["ui", "importacion", "ia", "sistema"] })
      .notNull()
      .default("ui"),
    /** true si el cambio afectó un mes ya cerrado. */
    periodoCerrado: boolean().notNull().default(false),
    ip: text(),
  },
  (t) => [
    index("auditoria_entidad_idx").on(t.entidad, t.entidadId),
    index("auditoria_fecha_idx").on(t.fecha),
    index("auditoria_usuario_idx").on(t.usuarioId),
  ],
);

export type UmbralAlerta = { dias: number; nivel: NivelAlerta };

/**
 * REGLAS DE ALERTA (configurables desde la UI).
 * `umbrales`: "cuando falten ≤ N días para la fecha de referencia → nivel".
 *   N positivo = días ANTES; 0 = el mismo día; N negativo = días DESPUÉS (atraso).
 *   Ej. revisión técnica: [{30,amarillo},{7,naranja},{0,rojo}]
 */
export const reglasAlerta = pgTable("reglas_alerta", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  codigo: text().notNull().unique(),
  modulo: text({ enum: MODULOS }).notNull(),
  nombre: text().notNull(),
  descripcion: text(),
  activa: boolean().notNull().default(true),
  umbrales: jsonb().$type<UmbralAlerta[]>().notNull().default([]),
  parametros: jsonb().$type<Record<string, number | string | boolean>>().notNull().default({}),
  actualizadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  actualizadoPor: integer().references(() => usuarios.id),
});

/** ALERTAS generadas por el motor. Una por (regla + registro), identificada por `clave`. */
export const alertas = pgTable(
  "alertas",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clave: text().notNull(),
    reglaCodigo: text().notNull(),
    modulo: text({ enum: MODULOS }).notNull(),
    nivel: text({ enum: NIVELES_ALERTA }).notNull(),
    titulo: text().notNull(),
    detalle: text(),
    entidadTipo: text(),
    entidadId: integer(),
    /** Ruta dentro del sistema para ir directo al registro. */
    enlace: text(),
    fechaReferencia: date({ mode: "string" }),
    estado: text({ enum: ESTADOS_ALERTA }).notNull().default("activa"),
    pospuestaHasta: date({ mode: "string" }),
    /** Nivel que tenía cuando se descartó: si empeora, la alerta reaparece. */
    nivelDescartado: text({ enum: NIVELES_ALERTA }),
    atendidaPor: integer().references(() => usuarios.id),
    primeraVez: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ultimaVez: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resueltaEn: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("alertas_clave_uq").on(t.clave),
    index("alertas_estado_nivel_idx").on(t.estado, t.nivel),
    index("alertas_entidad_idx").on(t.entidadTipo, t.entidadId),
  ],
);

/** RECORDATORIOS manuales ("llamar a apoderado", "renovar contrato"…). */
export const recordatorios = pgTable(
  "recordatorios",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    titulo: text().notNull(),
    detalle: text(),
    fecha: date({ mode: "string" }).notNull(),
    entidadTipo: text(),
    entidadId: integer(),
    estado: text({ enum: ["pendiente", "hecho", "cancelado"] })
      .notNull()
      .default("pendiente"),
    creadoPor: integer().references(() => usuarios.id),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completadoEn: timestamp({ withTimezone: true }),
  },
  (t) => [index("recordatorios_fecha_idx").on(t.estado, t.fecha)],
);

/** CONFIGURACIÓN general editable (clave → valor JSON). Evita valores fijos en el código. */
export const configuracion = pgTable("configuracion", {
  clave: text().primaryKey(),
  valor: jsonb().notNull(),
  descripcion: text(),
  actualizadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  actualizadoPor: integer().references(() => usuarios.id),
});
