/**
 * Abre el sistema conectado a la BASE OFICIAL (puerto 3001).
 * Carga .env.oficial por encima de .env.local y arranca Next.js.
 *   Uso: pnpm oficial:app            (desarrollo)
 *        pnpm oficial:app -- start   (versión compilada, después de "next build")
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

if (!existsSync(".env.oficial")) {
  console.error("✗ Falta .env.oficial (copia .env.oficial.example y pega la conexión de Supabase).");
  process.exit(1);
}
const vars = parseEnv(readFileSync(".env.oficial", "utf8"));
if (!vars.DATABASE_URL || /PEGAR_|\[YOUR-PASSWORD\]/.test(vars.DATABASE_URL)) {
  console.error("✗ DATABASE_URL de .env.oficial todavía no tiene la conexión real.");
  process.exit(1);
}

const modo = process.argv[2] === "start" ? "start" : "dev";
const puerto = process.env.PORT_OFICIAL ?? process.env.PORT ?? "3001";
const hijo = spawn(process.execPath, ["node_modules/next/dist/bin/next", modo, "-p", puerto], {
  stdio: "inherit",
  env: { ...process.env, ...vars },
});
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const senal of ["SIGINT", "SIGTERM"]) process.on(senal, () => hijo.kill(senal));
