/**
 * Fechas como texto ISO 'YYYY-MM-DD' (sin hora) para evitar errores de zona horaria.
 * Los periodos de cobro son siempre el primer día del mes: 'YYYY-MM-01'.
 */

export type FechaIso = string;

/** Fecha de hoy en la zona horaria indicada (por defecto la del sistema). */
export function hoyEn(zona: string): FechaIso {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return partes; // en-CA ya entrega YYYY-MM-DD
}

function aUtc(f: FechaIso): number {
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

function deUtc(ms: number): FechaIso {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Días desde `desde` hasta `hasta` (positivo si `hasta` es posterior). */
export function diferenciaDias(desde: FechaIso, hasta: FechaIso): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000);
}

export function sumarDias(f: FechaIso, dias: number): FechaIso {
  return deUtc(aUtc(f) + dias * 86_400_000);
}

export function diasDelMes(anio: number, mes1a12: number): number {
  return new Date(Date.UTC(anio, mes1a12, 0)).getUTCDate();
}

/** Primer día del mes de una fecha: '2027-08-15' → '2027-08-01' */
export function inicioDeMes(f: FechaIso): FechaIso {
  return `${f.slice(0, 7)}-01`;
}

export function finDeMes(periodo: FechaIso): FechaIso {
  const [a, m] = periodo.split("-").map(Number);
  return `${periodo.slice(0, 7)}-${String(diasDelMes(a, m)).padStart(2, "0")}`;
}

export function sumarMeses(periodo: FechaIso, meses: number): FechaIso {
  const [a, m] = periodo.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${na}-${String(nm).padStart(2, "0")}-01`;
}

/** Fecha de vencimiento de un periodo según el día configurado (ajustado a meses cortos). */
export function fechaVencimiento(periodo: FechaIso, dia: number): FechaIso {
  const [a, m] = periodo.split("-").map(Number);
  const d = Math.min(Math.max(1, dia), diasDelMes(a, m));
  return `${periodo.slice(0, 7)}-${String(d).padStart(2, "0")}`;
}

/** Valida 'YYYY-MM' o 'YYYY-MM-DD' y devuelve el periodo 'YYYY-MM-01'. */
export function aPeriodo(valor: string | null | undefined): FechaIso | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})/.exec(valor);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

export function esFechaIso(valor: unknown): valor is FechaIso {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= diasDelMes(a, m);
}

/**
 * Interpreta fechas escritas de forma habitual en Chile: 15/08/2027, 15-08-27, 2027-08-15,
 * o fechas de Excel (Date / número de serie). Devuelve null si es ambiguo o inválido.
 */
export function parsearFecha(valor: unknown): FechaIso | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  if (typeof valor === "number" && valor > 20000 && valor < 80000) {
    // número de serie de Excel (días desde 1899-12-30)
    return deUtc(Date.UTC(1899, 11, 30) + valor * 86_400_000);
  }
  const s = String(valor).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    const f = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return esFechaIso(f) ? f : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) {
    let anio = Number(m[3]);
    if (anio < 100) anio += 2000;
    const f = `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return esFechaIso(f) ? f : null;
  }
  return null;
}
