import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Carga .env / .env.local igual que Next.js
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
