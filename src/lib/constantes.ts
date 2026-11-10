/**
 * Catálogos de valores del dominio (compartidos por servidor y cliente).
 * Las etiquetas visibles se definen aquí para no repetir textos en la UI.
 */

export const ROLES = ["admin", "operador", "consulta"] as const;
export type Rol = (typeof ROLES)[number];
export const ROL_ETIQUETA: Record<Rol, string> = {
  admin: "Administrador",
  operador: "Operador",
  consulta: "Solo consulta",
};

export const ESTADOS_ALUMNO = ["activo", "suspendido", "retirado"] as const;
export type EstadoAlumno = (typeof ESTADOS_ALUMNO)[number];
export const ESTADO_ALUMNO_ETIQUETA: Record<EstadoAlumno, string> = {
  activo: "Activo",
  suspendido: "Suspendido",
  retirado: "Retirado",
};

export const TIPOS_SERVICIO = ["escolar", "especial", "turismo", "otro"] as const;
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];
export const TIPO_SERVICIO_ETIQUETA: Record<TipoServicio, string> = {
  escolar: "Transporte escolar",
  especial: "Servicio especial",
  turismo: "Turismo",
  otro: "Otro",
};

export const ESTADOS_MENSUALIDAD = ["pendiente", "parcial", "pagada", "condonada", "no_recuperable", "anulada"] as const;
export type EstadoMensualidad = (typeof ESTADOS_MENSUALIDAD)[number];
export const ESTADO_MENSUALIDAD_ETIQUETA: Record<EstadoMensualidad, string> = {
  pendiente: "Pendiente",
  parcial: "Pago parcial",
  pagada: "Pagada",
  condonada: "Condonada",
  no_recuperable: "No recuperable",
  anulada: "Anulada",
};

export const MEDIOS_PAGO = ["transferencia", "efectivo", "deposito", "cheque", "tarjeta", "otro"] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];
export const MEDIO_PAGO_ETIQUETA: Record<MedioPago, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  deposito: "Depósito",
  cheque: "Cheque",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

/** ¿El dinero está confirmado? (dinero recibido) */
export const ESTADOS_VERIFICACION = ["por_verificar", "verificado", "rechazado"] as const;
export type EstadoVerificacion = (typeof ESTADOS_VERIFICACION)[number];
export const ESTADO_VERIFICACION_ETIQUETA: Record<EstadoVerificacion, string> = {
  por_verificar: "Por verificar",
  verificado: "Dinero recibido",
  rechazado: "Rechazado",
};

/** ¿El pago está asignado a alumno(s) y mes(es)? (pago conciliado) */
export const ESTADOS_CONCILIACION = ["por_conciliar", "parcial", "conciliado"] as const;
export type EstadoConciliacion = (typeof ESTADOS_CONCILIACION)[number];
export const ESTADO_CONCILIACION_ETIQUETA: Record<EstadoConciliacion, string> = {
  por_conciliar: "Por conciliar",
  parcial: "Conciliado parcial",
  conciliado: "Conciliado",
};

export const ORIGENES_PAGO = ["manual", "voucher", "excel_banco", "importacion", "api"] as const;
export type OrigenPago = (typeof ORIGENES_PAGO)[number];
export const ORIGEN_PAGO_ETIQUETA: Record<OrigenPago, string> = {
  manual: "Ingreso manual",
  voucher: "Voucher / comprobante",
  excel_banco: "Cartola bancaria",
  importacion: "Importación",
  api: "API bancaria",
};

export const ESTADOS_DEVOLUCION = ["pendiente", "realizada", "anulada"] as const;
export type EstadoDevolucion = (typeof ESTADOS_DEVOLUCION)[number];

export const NIVELES_ALERTA = ["info", "amarillo", "naranja", "rojo"] as const;
export type NivelAlerta = (typeof NIVELES_ALERTA)[number];
export const NIVEL_ALERTA_ETIQUETA: Record<NivelAlerta, string> = {
  info: "Informativa",
  amarillo: "Amarilla",
  naranja: "Naranja",
  rojo: "Roja",
};
export const NIVEL_ALERTA_PESO: Record<NivelAlerta, number> = { info: 0, amarillo: 1, naranja: 2, rojo: 3 };

export const ESTADOS_ALERTA = ["activa", "pospuesta", "descartada", "resuelta"] as const;
export type EstadoAlerta = (typeof ESTADOS_ALERTA)[number];

export const MODULOS = ["pagos", "alumnos", "buses", "conductores", "mantenciones", "contratos", "servicios", "general"] as const;
export type Modulo = (typeof MODULOS)[number];
export const MODULO_ETIQUETA: Record<Modulo, string> = {
  pagos: "Pagos",
  alumnos: "Alumnos",
  buses: "Buses",
  conductores: "Conductores",
  mantenciones: "Mantenciones",
  contratos: "Contratos",
  servicios: "Servicios",
  general: "General",
};

export const TIPOS_FUENTE_IMPORTACION = ["excel", "csv", "word", "pdf", "imagen"] as const;
export type TipoFuenteImportacion = (typeof TIPOS_FUENTE_IMPORTACION)[number];

export const DESTINOS_IMPORTACION = ["alumnos", "pagos"] as const;
export type DestinoImportacion = (typeof DESTINOS_IMPORTACION)[number];
export const DESTINO_IMPORTACION_ETIQUETA: Record<DestinoImportacion, string> = {
  alumnos: "Alumnos y apoderados",
  pagos: "Pagos / comprobantes",
};

export const ESTADOS_IMPORTACION = ["analizando", "en_revision", "aplicada", "cancelada", "error"] as const;
export type EstadoImportacion = (typeof ESTADOS_IMPORTACION)[number];
export const ESTADO_IMPORTACION_ETIQUETA: Record<EstadoImportacion, string> = {
  analizando: "Analizando",
  en_revision: "En revisión",
  aplicada: "Aplicada",
  cancelada: "Cancelada",
  error: "Error",
};

/** Acción que el sistema PROPONE para una fila importada (nunca se aplica sola). */
export const ACCIONES_FILA = ["crear", "actualizar", "sin_cambios", "posible_duplicado", "requiere_revision", "error"] as const;
export type AccionFila = (typeof ACCIONES_FILA)[number];
export const ACCION_FILA_ETIQUETA: Record<AccionFila, string> = {
  crear: "Nuevo registro",
  actualizar: "Cambio detectado",
  sin_cambios: "Sin cambios",
  posible_duplicado: "Posible registro existente",
  requiere_revision: "Requiere revisión",
  error: "Con errores",
};

/** Decisión que toma el usuario para cada fila. */
export const DECISIONES_FILA = ["crear", "actualizar", "mantener", "fusionar", "omitir"] as const;
export type DecisionFila = (typeof DECISIONES_FILA)[number];
export const DECISION_FILA_ETIQUETA: Record<DecisionFila, string> = {
  crear: "Crear como nuevo",
  actualizar: "Actualizar",
  mantener: "Mantener actual",
  fusionar: "Fusionar",
  omitir: "Omitir",
};

export const TIPOS_DOCUMENTO = ["voucher", "planilla", "contrato", "certificado", "foto", "factura", "otro"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Texto estándar cuando la IA no logra identificar un dato. */
export const NO_IDENTIFICADO = "Información no identificada / requiere revisión";
