import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { entorno } from "@/server/entorno";
import * as schema from "./schema";

/**
 * Conexión única a PostgreSQL. En desarrollo se reutiliza entre recargas
 * (hot reload) para no abrir conexiones nuevas en cada cambio de código.
 */
const globalParaDb = globalThis as unknown as { _pgCliente?: ReturnType<typeof postgres> };

const cliente =
  globalParaDb._pgCliente ??
  postgres(entorno.DATABASE_URL, {
    max: entorno.DATABASE_MAX_CONEXIONES,
    prepare: entorno.DATABASE_PREPARE,
    // Cierra conexiones ociosas (importante con poolers como el de Supabase)
    idle_timeout: 30,
    // Las fechas tipo DATE se manejan como texto 'YYYY-MM-DD' para evitar desfases de zona horaria.
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalParaDb._pgCliente = cliente;

export const db = drizzle(cliente, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOTx = Db | Tx;
export { schema };
