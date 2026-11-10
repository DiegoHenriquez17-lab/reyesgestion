import "server-only";
import { hash, verify } from "@node-rs/argon2";

/** Hash de contraseñas con Argon2id (estándar recomendado actual). */
export function hashClave(clave: string): Promise<string> {
  return hash(clave, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verificarClave(hashGuardado: string, clave: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, clave);
  } catch {
    return false;
  }
}

/** Reglas mínimas de contraseña. Devuelve el problema o null si es aceptable. */
export function problemaDeClave(clave: string): string | null {
  if (clave.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) return "La contraseña debe combinar letras y números.";
  return null;
}
