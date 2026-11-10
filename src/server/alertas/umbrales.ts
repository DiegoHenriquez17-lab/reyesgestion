import { NIVELES_ALERTA, type NivelAlerta } from "@/lib/constantes";
import type { UmbralAlerta } from "@/server/db/schema";

/**
 * Determina el nivel de alerta según los días que faltan para la fecha de referencia.
 * Recorre los umbrales de mayor a menor cantidad de días y se queda con el último que aplica
 * (el más urgente). Devuelve null si todavía no corresponde avisar.
 */
export function nivelPorUmbral(diasRestantes: number, umbrales: UmbralAlerta[]): NivelAlerta | null {
  const ordenados = [...umbrales].sort((a, b) => b.dias - a.dias);
  let nivel: NivelAlerta | null = null;
  for (const u of ordenados) if (diasRestantes <= u.dias) nivel = u.nivel;
  return nivel;
}

export function nivelDeParametro(valor: unknown, porDefecto: NivelAlerta = "amarillo"): NivelAlerta {
  return (NIVELES_ALERTA as readonly string[]).includes(String(valor)) ? (valor as NivelAlerta) : porDefecto;
}

/** Texto amigable: "vence en 5 días", "vence hoy", "vencida hace 3 días". */
export function textoPlazo(diasRestantes: number, verbo = "vence", vencido = "vencida"): string {
  if (diasRestantes > 1) return `${verbo} en ${diasRestantes} días`;
  if (diasRestantes === 1) return `${verbo} mañana`;
  if (diasRestantes === 0) return `${verbo} hoy`;
  if (diasRestantes === -1) return `${vencido} hace 1 día`;
  return `${vencido} hace ${-diasRestantes} días`;
}
