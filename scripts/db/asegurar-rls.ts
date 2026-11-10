/**
 * Se ejecuta después de cada migración: activa RLS en cualquier tabla nueva del esquema public
 * que todavía no lo tenga (protección de la API automática de Supabase). Es idempotente.
 */
import "../_entorno";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

async function main() {
  const filas = await db.execute<{ tabla: string }>(sql`
    select c.relname as tabla from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  for (const { tabla } of filas) {
    await db.execute(sql.raw(`ALTER TABLE public."${tabla.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`));
    console.log(`✓ RLS activado en ${tabla}`);
  }
  console.log(filas.length ? `✓ Seguridad: ${filas.length} tabla(s) protegidas` : "✓ Seguridad: todas las tablas ya tienen RLS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ Error al asegurar RLS:", e);
    process.exit(1);
  });
