import type { Modulo } from "@/lib/constantes";
import type { UmbralAlerta } from "@/server/db/schema";

/**
 * Reglas de alerta iniciales. `pnpm db:seed` las inserta UNA vez; después se configuran
 * desde Configuración → Alertas (activar/desactivar, días de aviso y colores).
 *
 * Umbrales: "si faltan ≤ N días para la fecha de referencia → nivel".
 *   N > 0: días antes · N = 0: el mismo día (o ya vencido) · N < 0: días de atraso.
 */
export type ReglaPorDefecto = {
  codigo: string;
  modulo: Modulo;
  nombre: string;
  descripcion: string;
  umbrales: UmbralAlerta[];
  parametros: Record<string, number | string | boolean>;
};

export const REGLAS_POR_DEFECTO: ReglaPorDefecto[] = [
  {
    codigo: "pagos.mensualidad",
    modulo: "pagos",
    nombre: "Mensualidad por vencer / vencida",
    descripcion: "Mensualidades pendientes o parciales según su fecha de vencimiento.",
    umbrales: [
      { dias: 5, nivel: "amarillo" },
      { dias: -1, nivel: "naranja" },
      { dias: -30, nivel: "rojo" },
    ],
    parametros: {},
  },
  {
    codigo: "pagos.meses_consecutivos",
    modulo: "pagos",
    nombre: "Meses consecutivos pendientes",
    descripcion: "Alumnos con varios meses seguidos vencidos sin pagar.",
    umbrales: [],
    parametros: { meses: 2, nivel: "rojo" },
  },
  {
    codigo: "pagos.pago_parcial",
    modulo: "pagos",
    nombre: "Pago parcial",
    descripcion: "Mensualidades con abono incompleto.",
    umbrales: [],
    parametros: { nivel: "amarillo" },
  },
  {
    codigo: "pagos.por_verificar",
    modulo: "pagos",
    nombre: "Pago por verificar",
    descripcion: "Comprobantes informados cuyo dinero aún no se confirma en el banco.",
    umbrales: [
      { dias: 0, nivel: "amarillo" },
      { dias: -3, nivel: "naranja" },
      { dias: -10, nivel: "rojo" },
    ],
    parametros: {},
  },
  {
    codigo: "pagos.por_conciliar",
    modulo: "pagos",
    nombre: "Pago por conciliar",
    descripcion: "Dinero recibido que aún no está asignado a un alumno y mes.",
    umbrales: [
      { dias: 0, nivel: "amarillo" },
      { dias: -7, nivel: "naranja" },
      { dias: -20, nivel: "rojo" },
    ],
    parametros: {},
  },
  {
    codigo: "pagos.deuda_antigua",
    modulo: "pagos",
    nombre: "Deuda antigua",
    descripcion: "Alumnos con saldo vencido hace más de N días.",
    umbrales: [],
    parametros: { dias: 90, nivel: "rojo" },
  },
  {
    codigo: "pagos.devolucion_pendiente",
    modulo: "pagos",
    nombre: "Devolución pendiente",
    descripcion: "Devoluciones de dinero solicitadas y aún no realizadas.",
    umbrales: [
      { dias: 0, nivel: "amarillo" },
      { dias: -15, nivel: "naranja" },
      { dias: -30, nivel: "rojo" },
    ],
    parametros: {},
  },
  {
    codigo: "pagos.mensualidades_sin_generar",
    modulo: "pagos",
    nombre: "Mensualidades del mes sin generar",
    descripcion: "Alumnos activos que aún no tienen la mensualidad del mes en curso.",
    umbrales: [],
    parametros: { nivel: "amarillo" },
  },
  {
    codigo: "pagos.cierre_mes",
    modulo: "pagos",
    nombre: "Cierre de mes pendiente",
    descripcion: "El mes anterior aún no se ha cerrado. Referencia: día límite del mes siguiente.",
    umbrales: [
      { dias: 5, nivel: "amarillo" },
      { dias: 0, nivel: "naranja" },
      { dias: -10, nivel: "rojo" },
    ],
    parametros: { dia_limite: 10 },
  },
  {
    codigo: "general.recordatorio",
    modulo: "general",
    nombre: "Recordatorios",
    descripcion: "Recordatorios manuales próximos o atrasados.",
    umbrales: [
      { dias: 3, nivel: "amarillo" },
      { dias: 0, nivel: "naranja" },
      { dias: -1, nivel: "rojo" },
    ],
    parametros: {},
  },
];
