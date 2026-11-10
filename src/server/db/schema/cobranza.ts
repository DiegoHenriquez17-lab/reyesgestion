import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import {
  ESTADOS_CONCILIACION,
  ESTADOS_DEVOLUCION,
  ESTADOS_MENSUALIDAD,
  ESTADOS_VERIFICACION,
  MEDIOS_PAGO,
  ORIGENES_PAGO,
} from "@/lib/constantes";
import { marcasDeTiempo } from "./_comun";
import { alumnos } from "./alumnos";
import { documentos, importaciones } from "./documentos";
import { personas } from "./personas";
import { usuarios } from "./usuarios";

/**
 * MENSUALIDADES: lo que cada alumno DEBE pagar cada mes (el cobro esperado).
 * El monto se congela al generarla; cambiar la tarifa del alumno no altera meses ya generados.
 */
export const mensualidades = pgTable(
  "mensualidades",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    alumnoId: integer()
      .notNull()
      .references(() => alumnos.id),
    /** Primer día del mes cobrado (ej: 2027-08-01). */
    periodo: date({ mode: "string" }).notNull(),
    monto: integer().notNull(),
    fechaVencimiento: date({ mode: "string" }).notNull(),
    /** Suma de lo aplicado desde pagos (se mantiene en cada conciliación). */
    montoPagado: integer().notNull().default(0),
    estado: text({ enum: ESTADOS_MENSUALIDAD }).notNull().default("pendiente"),
    observaciones: text(),
    ...marcasDeTiempo,
  },
  (t) => [
    uniqueIndex("mensualidades_alumno_periodo_uq").on(t.alumnoId, t.periodo),
    index("mensualidades_periodo_idx").on(t.periodo),
    index("mensualidades_estado_idx").on(t.estado),
    check("mensualidades_monto_ck", sql`${t.monto} >= 0 and ${t.montoPagado} >= 0`),
  ],
);

/**
 * PAGOS: dinero recibido (o informado por voucher).
 * Dos dimensiones independientes:
 *   - verificación: ¿el dinero está realmente en la cuenta?  (por_verificar / verificado)
 *   - conciliación: ¿a qué alumno y mes corresponde?          (por_conciliar / conciliado)
 */
export const pagos = pgTable(
  "pagos",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    fechaPago: date({ mode: "string" }).notNull(),
    monto: integer().notNull(),
    medio: text({ enum: MEDIOS_PAGO }).notNull().default("transferencia"),
    banco: text(),
    numeroOperacion: text(),
    /** Nombre tal como aparece en la transferencia / voucher (puede no ser el apoderado). */
    nombreOrigen: text(),
    rutOrigen: text(),
    pagadorId: integer().references(() => personas.id),
    /** Alumno principal al que corresponde (si se conoce). */
    alumnoId: integer().references(() => alumnos.id),
    estadoVerificacion: text({ enum: ESTADOS_VERIFICACION }).notNull().default("verificado"),
    estadoConciliacion: text({ enum: ESTADOS_CONCILIACION }).notNull().default("por_conciliar"),
    montoAplicado: integer().notNull().default(0),
    origen: text({ enum: ORIGENES_PAGO }).notNull().default("manual"),
    documentoId: integer().references(() => documentos.id),
    importacionId: integer().references(() => importaciones.id),
    observaciones: text(),
    anuladoEn: timestamp({ withTimezone: true }),
    motivoAnulacion: text(),
    registradoPor: integer().references(() => usuarios.id),
    ...marcasDeTiempo,
  },
  (t) => [
    index("pagos_fecha_idx").on(t.fechaPago),
    index("pagos_alumno_idx").on(t.alumnoId),
    index("pagos_pagador_idx").on(t.pagadorId),
    index("pagos_estados_idx").on(t.estadoVerificacion, t.estadoConciliacion),
    index("pagos_operacion_idx").on(t.numeroOperacion),
    check("pagos_monto_ck", sql`${t.monto} > 0 and ${t.montoAplicado} >= 0 and ${t.montoAplicado} <= ${t.monto}`),
  ],
);

/** Aplicación de un pago a una o más mensualidades (permite pagos parciales y de varios meses). */
export const pagoAplicaciones = pgTable(
  "pago_aplicaciones",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    pagoId: integer()
      .notNull()
      .references(() => pagos.id, { onDelete: "cascade" }),
    mensualidadId: integer()
      .notNull()
      .references(() => mensualidades.id),
    monto: integer().notNull(),
    creadoPor: integer().references(() => usuarios.id),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("pago_aplicaciones_uq").on(t.pagoId, t.mensualidadId),
    index("pago_aplicaciones_mensualidad_idx").on(t.mensualidadId),
    check("pago_aplicaciones_monto_ck", sql`${t.monto} > 0`),
  ],
);

export const devoluciones = pgTable(
  "devoluciones",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    alumnoId: integer().references(() => alumnos.id),
    pagoId: integer().references(() => pagos.id),
    personaId: integer().references(() => personas.id),
    monto: integer().notNull(),
    motivo: text().notNull(),
    estado: text({ enum: ESTADOS_DEVOLUCION }).notNull().default("pendiente"),
    fechaSolicitud: date({ mode: "string" }).notNull(),
    fechaRealizada: date({ mode: "string" }),
    observaciones: text(),
    ...marcasDeTiempo,
  },
  (t) => [check("devoluciones_monto_ck", sql`${t.monto} > 0`)],
);

/**
 * Movimientos importados desde cartolas bancarias (Excel del banco).
 * La "huella" evita importar dos veces el mismo movimiento.
 */
export const movimientosBancarios = pgTable(
  "movimientos_bancarios",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    banco: text(),
    cuenta: text(),
    fecha: date({ mode: "string" }).notNull(),
    monto: integer().notNull(),
    descripcion: text(),
    nombreContraparte: text(),
    rutContraparte: text(),
    numeroOperacion: text(),
    huella: text().notNull(),
    importacionId: integer().references(() => importaciones.id),
    pagoId: integer().references(() => pagos.id),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("movimientos_huella_uq").on(t.huella), index("movimientos_fecha_idx").on(t.fecha)],
);

/** CIERRE DE MES: congela el estado del mes. Cambios posteriores quedan marcados en auditoría. */
export const cierresMes = pgTable("cierres_mes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  periodo: date({ mode: "string" }).notNull().unique(),
  estado: text({ enum: ["cerrado", "reabierto"] }).notNull().default("cerrado"),
  /** Fotografía de los totales al momento del cierre. */
  resumen: jsonb().$type<Record<string, unknown>>().notNull(),
  cerradoPor: integer().references(() => usuarios.id),
  cerradoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  reabiertoPor: integer().references(() => usuarios.id),
  reabiertoEn: timestamp({ withTimezone: true }),
  motivoReapertura: text(),
});
