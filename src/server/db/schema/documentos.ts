import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import {
  ACCIONES_FILA,
  DECISIONES_FILA,
  DESTINOS_IMPORTACION,
  ESTADOS_IMPORTACION,
  TIPOS_DOCUMENTO,
  TIPOS_FUENTE_IMPORTACION,
} from "@/lib/constantes";
import { eliminacionLogica } from "./_comun";
import { usuarios } from "./usuarios";

/**
 * DOCUMENTOS: todo archivo subido (voucher, foto, PDF, Excel, Word).
 * El archivo físico vive en STORAGE_DIR; aquí queda su ficha y a qué registro pertenece.
 */
export const documentos = pgTable(
  "documentos",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombreOriginal: text().notNull(),
    /** Ruta relativa dentro de STORAGE_DIR. */
    ruta: text().notNull(),
    mime: text().notNull(),
    tamano: bigint({ mode: "number" }).notNull(),
    sha256: text().notNull(),
    tipo: text({ enum: TIPOS_DOCUMENTO }).notNull().default("otro"),
    /** Registro al que pertenece (ej: entidad "pago", id 15). */
    entidadTipo: text(),
    entidadId: integer(),
    subidoPor: integer().references(() => usuarios.id),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...eliminacionLogica,
  },
  (t) => [index("documentos_entidad_idx").on(t.entidadTipo, t.entidadId), index("documentos_sha_idx").on(t.sha256)],
);

/**
 * IMPORTACIONES: cada carga masiva o lectura por IA.
 * Flujo obligatorio: IMPORTAR → ANALIZAR → MOSTRAR → VALIDAR → GUARDAR.
 */
export const importaciones = pgTable("importaciones", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tipoFuente: text({ enum: TIPOS_FUENTE_IMPORTACION }).notNull(),
  destino: text({ enum: DESTINOS_IMPORTACION }).notNull(),
  documentoId: integer().references(() => documentos.id),
  estado: text({ enum: ESTADOS_IMPORTACION }).notNull().default("analizando"),
  /** Columnas detectadas en el archivo. */
  columnas: jsonb().$type<string[]>(),
  /** Mapeo columna del archivo → campo del sistema (propuesto y luego confirmado). */
  mapeo: jsonb().$type<Record<string, string | null>>(),
  /** Opciones elegidas por el usuario (ej: { verificado: true } para cartolas bancarias). */
  opciones: jsonb().$type<{ verificado?: boolean; hoja?: string; filaEncabezado?: number }>(),
  /** Respuesta estructurada de la IA (cuando aplica), guardada tal cual para trazabilidad. */
  extraccionIa: jsonb(),
  resumen: jsonb().$type<Record<string, number>>(),
  error: text(),
  creadoPor: integer().references(() => usuarios.id),
  aplicadoPor: integer().references(() => usuarios.id),
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  aplicadaEn: timestamp({ withTimezone: true }),
});

/** Cada fila / registro detectado dentro de una importación, con su propuesta y decisión. */
export const importacionFilas = pgTable(
  "importacion_filas",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    importacionId: integer()
      .notNull()
      .references(() => importaciones.id, { onDelete: "cascade" }),
    numeroFila: integer().notNull(),
    datosOriginales: jsonb().$type<Record<string, unknown>>().notNull(),
    /** Datos normalizados según el mapeo (lo que se guardaría). */
    datos: jsonb().$type<Record<string, unknown>>().notNull(),
    accionPropuesta: text({ enum: ACCIONES_FILA }).notNull(),
    /** Registro existente con el que coincide (persona / alumno / pago). */
    registroExistenteId: integer(),
    registroExistente: jsonb().$type<Record<string, unknown>>(),
    diferencias: jsonb().$type<{ campo: string; actual: unknown; nuevo: unknown }[]>(),
    advertencias: jsonb().$type<string[]>(),
    decision: text({ enum: DECISIONES_FILA }),
    estado: text({ enum: ["pendiente", "aplicada", "omitida", "error"] })
      .notNull()
      .default("pendiente"),
    resultadoId: integer(),
    error: text(),
  },
  (t) => [uniqueIndex("importacion_filas_uq").on(t.importacionId, t.numeroFila)],
);
