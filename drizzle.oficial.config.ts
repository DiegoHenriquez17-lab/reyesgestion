import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "drizzle-kit";

/**
 * Migraciones contra la BASE OFICIAL (Supabase). Lee SOLO .env.oficial,
 * para que nunca se mezcle con la base de desarrollo.
 *   Uso: pnpm oficial:migrar
 */
if (!existsSync(".env.oficial")) {
  throw new Error("Falta el archivo .env.oficial (copia .env.oficial.example y pega la contraseña de Supabase).");
}
const vars = parseEnv(readFileSync(".env.oficial", "utf8"));
const url = vars.DATABASE_URL;
if (!url || url.includes("[YOUR-PASSWORD]") || url.includes("PEGAR_")) {
  throw new Error("DATABASE_URL de .env.oficial no tiene la contraseña real todavía.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
