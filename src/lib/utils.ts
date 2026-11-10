import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos. */
export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}

/** Resultado estándar de una acción del servidor (para formularios). */
export type ResultadoAccion<T = undefined> =
  | { ok: true; mensaje?: string; datos?: T }
  | { ok: false; error: string; errores?: Record<string, string[]> };
