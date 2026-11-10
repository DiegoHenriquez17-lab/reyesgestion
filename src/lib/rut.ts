/** Utilidades para el RUT chileno. */

/** Deja el RUT como "12345678-K" (sin puntos, DV en mayúscula). Devuelve null si no parece RUT. */
export function normalizarRut(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).toUpperCase().replace(/[^0-9K]/g, "");
  if (limpio.length < 2 || limpio.length > 9) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return null;
  return `${Number(cuerpo)}-${dv}`;
}

export function calcularDv(cuerpo: string | number): string {
  let suma = 0;
  let multiplicador = 2;
  const digitos = String(cuerpo).split("").reverse();
  for (const d of digitos) {
    suma += Number(d) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/** true si el dígito verificador es correcto. */
export function rutEsValido(valor: unknown): boolean {
  const n = normalizarRut(valor);
  if (!n) return false;
  const [cuerpo, dv] = n.split("-");
  return calcularDv(cuerpo) === dv;
}

/** "12345678-K" → "12.345.678-K" */
export function formatearRut(valor: string | null | undefined): string {
  const n = normalizarRut(valor);
  if (!n) return valor ?? "";
  const [cuerpo, dv] = n.split("-");
  return `${Number(cuerpo).toLocaleString("es-CL")}-${dv}`;
}
