/** Normalización de texto para comparar nombres (sin tildes, minúsculas, espacios simples). */
export function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ@.\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Separa un nombre completo en palabras significativas. */
export function palabras(valor: unknown): string[] {
  return normalizarTexto(valor)
    .split(" ")
    .filter((p) => p.length > 1 && !["de", "del", "la", "las", "los", "y"].includes(p));
}

/**
 * Coincidencia entre dos nombres: proporción de palabras compartidas (0 a 1).
 * Útil para sugerir (nunca para decidir solo) a quién corresponde un pago.
 */
export function coincidenciaNombres(a: unknown, b: unknown): number {
  const pa = new Set(palabras(a));
  const pb = new Set(palabras(b));
  if (pa.size === 0 || pb.size === 0) return 0;
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes++;
  return comunes / Math.min(pa.size, pb.size);
}

/** Capitaliza nombres: "JORGE PÉREZ" → "Jorge Pérez" */
export function capitalizarNombre(valor: string): string {
  return valor
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, letra: string) => sep + letra.toUpperCase());
}

/**
 * Divide un nombre completo en nombres y apellidos.
 * Convención chilena: los dos últimos términos suelen ser los apellidos.
 */
export function separarNombre(completo: string): { nombres: string; apellidos: string } {
  const partes = completo.replace(/\s+/g, " ").trim().split(" ");
  if (partes.length <= 1) return { nombres: partes[0] ?? "", apellidos: "" };
  if (partes.length === 2) return { nombres: partes[0], apellidos: partes[1] };
  return { nombres: partes.slice(0, -2).join(" "), apellidos: partes.slice(-2).join(" ") };
}
