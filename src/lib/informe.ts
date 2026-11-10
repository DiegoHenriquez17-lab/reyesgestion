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
  { codigo: "ingresos_bus", nombre: "Ingresos por bus", descripcion: "Recaudación de cada bus mes a mes durante un año.", parametro: "anio" },
  { codigo: "comparacion_mensual", nombre: "Comparación mensual / informe anual", descripcion: "Esperado vs. recaudado de cada mes del año y total anual.", parametro: "anio" },
] as const;

export type CodigoInforme = (typeof CATALOGO_INFORMES)[number]["codigo"];
