/** Formatos de presentación (pesos chilenos, fechas, nombres). */

const pesos = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

export function formatearPesos(monto: number | null | undefined): string {
  if (monto === null || monto === undefined || Number.isNaN(monto)) return "—";
  return pesos.format(monto);
}

export function formatearNumero(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return numero.format(n);
}

export function formatearPorcentaje(valor: number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  return `${valor.toLocaleString("es-CL", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}%`;
}

/**
 * Convierte textos como "$95.000", "95000", "95.000,00", "CLP 95 000" en número entero.
 * Devuelve null si no se puede interpretar con seguridad (no inventa).
 */
export function parsearMonto(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor) : null;
  let s = String(valor).trim().replace(/clp|\$|\s/gi, "");
  if (!s) return null;
  // Formato chileno: punto = miles, coma = decimales
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+(,\d{1,2})$/.test(s)) s = s.replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function nombreMes(mes1a12: number, mayuscula = true): string {
  const m = MESES[mes1a12 - 1] ?? "";
  return mayuscula ? m.charAt(0).toUpperCase() + m.slice(1) : m;
}

export function indiceMes(nombre: string): number | null {
  const n = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  const i = MESES.findIndex((m) => m === n || m.slice(0, 3) === n.slice(0, 3));
  return i >= 0 ? i + 1 : null;
}

/** "2027-08-01" → "Agosto 2027" */
export function formatearPeriodo(periodo: string | null | undefined): string {
  if (!periodo) return "—";
  const [a, m] = periodo.split("-").map(Number);
  return `${nombreMes(m)} ${a}`;
}

/** "2027-08-15" → "15/08/2027" */
export function formatearFecha(fecha: string | Date | null | undefined): string {
  if (!fecha) return "—";
  if (fecha instanceof Date) {
    return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const [a, m, d] = fecha.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function formatearFechaHora(fecha: Date | string | null | undefined, zona?: string): string {
  if (!fecha) return "—";
  const f = typeof fecha === "string" ? new Date(fecha) : fecha;
  return f.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zona,
  });
}

export function nombreCompleto(p: { nombres?: string | null; apellidos?: string | null } | null | undefined): string {
  if (!p) return "—";
  return [p.nombres, p.apellidos].filter(Boolean).join(" ").trim() || "—";
}
