import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, type DbOTx } from "@/server/db";
import { configuracion } from "@/server/db/schema";

/**
 * Valores iniciales de la configuración general.
 * Se copian a la tabla `configuracion` con `pnpm db:seed` y luego se editan desde la UI.
 * Este es el ÚNICO lugar donde viven estos valores por defecto.
 */
export const CONFIG_POR_DEFECTO = {
  "empresa.nombre": { valor: "Transportes y Turismo Reyes", descripcion: "Nombre que aparece en informes y documentos." },
  "empresa.rut": { valor: "", descripcion: "RUT de la empresa para encabezados de informes." },
  "cobranza.dia_vencimiento": { valor: 5, descripcion: "Día del mes en que vence la mensualidad (si el alumno no tiene uno propio)." },
  "cobranza.meses_cobro": {
    valor: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    descripcion: "Meses del año en que se cobra mensualidad (1 = enero … 12 = diciembre).",
  },
  "conciliacion.coincidencia_minima": {
    valor: 0.5,
    descripcion: "Coincidencia mínima de nombre (0 a 1) para SUGERIR un alumno al conciliar un pago.",
  },
  "alertas.intervalo_minutos": { valor: 5, descripcion: "Cada cuántos minutos se recalculan las alertas automáticamente." },
} as const satisfies Record<string, { valor: unknown; descripcion: string }>;

export type ClaveConfig = keyof typeof CONFIG_POR_DEFECTO;
type ValorConfig<K extends ClaveConfig> = (typeof CONFIG_POR_DEFECTO)[K]["valor"] extends readonly number[]
  ? number[]
  : (typeof CONFIG_POR_DEFECTO)[K]["valor"] extends number
    ? number
    : (typeof CONFIG_POR_DEFECTO)[K]["valor"] extends string
      ? string
      : unknown;

export async function leerConfig<K extends ClaveConfig>(clave: K, tx: DbOTx = db): Promise<ValorConfig<K>> {
  const [fila] = await tx.select().from(configuracion).where(eq(configuracion.clave, clave));
  return (fila?.valor ?? CONFIG_POR_DEFECTO[clave].valor) as ValorConfig<K>;
}

export async function leerVariasConfig(claves: ClaveConfig[]) {
  const filas = await db.select().from(configuracion).where(inArray(configuracion.clave, claves));
  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
  return Object.fromEntries(claves.map((c) => [c, mapa.get(c) ?? CONFIG_POR_DEFECTO[c].valor])) as Record<
    ClaveConfig,
    unknown
  >;
}

export async function guardarConfig(clave: string, valor: unknown, usuarioId: number | null, tx: DbOTx = db) {
  await tx
    .insert(configuracion)
    .values({ clave, valor, actualizadoPor: usuarioId })
    .onConflictDoUpdate({
      target: configuracion.clave,
      set: { valor, actualizadoPor: usuarioId, actualizadoEn: new Date() },
    });
}
