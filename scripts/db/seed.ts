/**
 * Datos iniciales OBLIGATORIOS (idempotente: se puede ejecutar varias veces).
 *   - Configuración general por defecto
 *   - Reglas de alerta por defecto
 *   - Usuario administrador (solo si no existe ningún usuario y SEED_ADMIN_* está definido)
 *
 * Uso: pnpm db:seed
 */
import "../_entorno";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { configuracion, reglasAlerta, usuarios } from "@/server/db/schema";
import { CONFIG_POR_DEFECTO } from "@/server/configuracion";
import { REGLAS_POR_DEFECTO } from "@/server/alertas/reglas-por-defecto";
import { hashClave, problemaDeClave } from "@/server/auth/clave";

async function main() {
  // 1) Configuración: solo inserta claves que no existan (no pisa lo editado por el usuario)
  for (const [clave, { valor, descripcion }] of Object.entries(CONFIG_POR_DEFECTO)) {
    await db.insert(configuracion).values({ clave, valor, descripcion }).onConflictDoNothing();
  }
  console.log(`✓ Configuración (${Object.keys(CONFIG_POR_DEFECTO).length} claves)`);

  // 2) Reglas de alerta: inserta las que falten (no modifica las ya configuradas)
  for (const r of REGLAS_POR_DEFECTO) {
    await db.insert(reglasAlerta).values(r).onConflictDoNothing({ target: reglasAlerta.codigo });
  }
  console.log(`✓ Reglas de alerta (${REGLAS_POR_DEFECTO.length})`);

  // 3) Administrador inicial
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(usuarios);
  const { SEED_ADMIN_NOMBRE, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (total > 0) {
    console.log("• Ya existen usuarios: no se crea administrador.");
  } else if (process.env.APP_ENTORNO === "oficial") {
    // En la base oficial nunca se usa el administrador de prueba: se crea en /primer-usuario
    console.log("• Base oficial: crea el administrador en la pantalla /primer-usuario (con tu propia contraseña).");
  } else if (SEED_ADMIN_EMAIL && SEED_ADMIN_PASSWORD) {
    const problema = problemaDeClave(SEED_ADMIN_PASSWORD);
    if (problema) throw new Error(`SEED_ADMIN_PASSWORD: ${problema}`);
    await db.insert(usuarios).values({
      nombre: SEED_ADMIN_NOMBRE || "Administrador",
      email: SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash: await hashClave(SEED_ADMIN_PASSWORD),
      rol: "admin",
    });
    console.log(`✓ Administrador creado: ${SEED_ADMIN_EMAIL} (contraseña en .env.local)`);
  } else {
    console.log("• Sin SEED_ADMIN_*: crea el primer usuario en http://localhost:3000/primer-usuario");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ Error en seed:", e);
    process.exit(1);
  });
