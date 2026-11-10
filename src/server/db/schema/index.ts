/**
 * Esquema completo de la base de datos de Reyes Gestión.
 *
 *   PERSONAS ─┬─ ALUMNOS ─┬─ RESPONSABLES (apoderados / pagadores)
 *             │           ├─ MENSUALIDADES ── PAGO_APLICACIONES ── PAGOS ── DOCUMENTOS (vouchers)
 *             │           └─ BUS / SERVICIO
 *             └─ ALIAS (nombres bancarios)
 *
 *   Transversal: AUDITORÍA · ALERTAS · REGLAS_ALERTA · RECORDATORIOS · CIERRES_MES · IMPORTACIONES
 *
 * Versión 2 agregará: conductores, documentos de control (vencimientos) y mantenciones.
 * Versión 3: cotizaciones, servicios realizados y contratos.
 */
export * from "./usuarios";
export * from "./personas";
export * from "./flota";
export * from "./alumnos";
export * from "./documentos";
export * from "./cobranza";
export * from "./sistema";
export * from "./relaciones";
