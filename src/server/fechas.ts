import { entorno } from "@/server/entorno";
import { hoyEn, inicioDeMes } from "@/lib/fechas";

/** Hoy según la zona horaria de la empresa (APP_TIMEZONE). */
export function hoy(): string {
  return hoyEn(entorno.APP_TIMEZONE);
}

/** Periodo actual 'YYYY-MM-01'. */
export function periodoActual(): string {
  return inicioDeMes(hoy());
}
