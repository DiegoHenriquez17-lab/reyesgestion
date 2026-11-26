import { formatearFecha, formatearNumero, formatearPeriodo, formatearPesos, formatearPorcentaje } from "./formato";

/**
 * Estructura común de todos los informes. La misma estructura se muestra en pantalla
 * y se exporta a PDF y Excel, así cada informe se programa una sola vez.
 */
export type TipoDato = "texto" | "pesos" | "fecha" | "numero" | "porcentaje" | "periodo";

export type ColumnaInforme = { clave: string; titulo: string; tipo?: TipoDato; ancho?: number };

export type FilaInforme = Record<string, string | number | null>;

export type SeccionInforme = {
  titulo?: string;
  filas: FilaInforme[];
  subtotal?: FilaInforme;
};

export type Indicador = { etiqueta: string; valor: number | string | null; tipo?: TipoDato; destacado?: boolean };

export type Informe = {
  codigo: string;
  titulo: string;
  subtitulo?: string;
  empresa: string;
  generadoEn: string;
  indicadores?: Indicador[];
  columnas: ColumnaInforme[];
  secciones: SeccionInforme[];
  totalGeneral?: FilaInforme;
  notas?: string[];
};

export function formatearValor(valor: unknown, tipo: TipoDato = "texto"): string {
  if (valor === null || valor === undefined || valor === "") return "";
  switch (tipo) {
    case "pesos":
      return formatearPesos(Number(valor));
    case "numero":
      return formatearNumero(Number(valor));
    case "porcentaje":
      return formatearPorcentaje(Number(valor));
    case "fecha":
      return formatearFecha(String(valor));
    case "periodo":
      return formatearPeriodo(String(valor));
    default:
      return String(valor);
  }
}

export const esNumerico = (tipo?: TipoDato) => tipo === "pesos" || tipo === "numero" || tipo === "porcentaje";

/** Catálogo de informes disponibles (lo usa la pantalla de Informes). */
export const CATALOGO_INFORMES = [
  { codigo: "recaudacion", nombre: "Recaudación mensual", descripcion: "Esperado, recaudado, pendiente y detalle por alumno con subtotales por bus.", parametro: "periodo" },
  { codigo: "morosidad", nombre: "Deudas y morosidad", descripcion: "Alumnos con mensualidades vencidas, meses adeudados y contacto del apoderado.", parametro: null },
  { codigo: "por_verificar", nombre: "Pagos por verificar", descripcion: "Comprobantes informados que falta confirmar en el banco.", parametro: null },
  { codigo: "por_conciliar", nombre: "Pagos por conciliar", descripcion: "Dinero recibido que aún no se asigna a alumno y mes.", parametro: null },
  { codigo: "pagos_recibidos", nombre: "Pagos recibidos", descripcion: "Todos los pagos registrados en un mes (por fecha de pago).", parametro: "periodo" },
  { codigo: "pagos_alumno", nombre: "Pagos por alumno", descripcion: "Pagos del mes agrupados por alumno.", parametro: "periodo" },
  { codigo: "pagos_apoderado", nombre: "Pagos por apoderado o pagador", descripcion: "Pagos del mes agrupados por responsable o pagador identificado.", parametro: "periodo" },
  { codigo: "ingresos_bus", nombre: "Ingresos por bus", descripcion: "Recaudación de cada bus mes a mes durante un año.", parametro: "anio" },
  { codigo: "ingresos_servicio", nombre: "Ingresos por servicio", descripcion: "Recaudación escolar conciliada del mes por servicio asignado.", parametro: "periodo" },
  { codigo: "comparacion_mensual", nombre: "Comparación mensual / informe anual", descripcion: "Esperado vs. recaudado de cada mes del año y total anual.", parametro: "anio" },
  { codigo: "documentos_vencidos", nombre: "Documentos vencidos", descripcion: "Documentos vigentes en el registro con fecha de vencimiento ya superada.", parametro: null },
  { codigo: "documentos_por_vencer", nombre: "Documentos por vencer", descripcion: "Vencimientos dentro de los próximos 60 días.", parametro: null },
  { codigo: "gastos_mantencion", nombre: "Gastos de mantención", descripcion: "Mantenciones realizadas, costos y subtotales por bus.", parametro: "anio" },
  { codigo: "conductores", nombre: "Conductores", descripcion: "Directorio, contacto, clase de licencia y estado.", parametro: null },
  { codigo: "cotizaciones", nombre: "Cotizaciones", descripcion: "Cotizaciones ingresadas, montos y estado de cada solicitud.", parametro: "anio" },
  { codigo: "servicios_realizados", nombre: "Servicios realizados", descripcion: "Viajes realizados, bus asignado y montos contratados.", parametro: "anio" },
  { codigo: "contratos", nombre: "Contratos", descripcion: "Clientes, servicios, montos y vencimientos.", parametro: null },
] as const;

export type CodigoInforme = (typeof CATALOGO_INFORMES)[number]["codigo"];
