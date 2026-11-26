"use server";

import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import { usuarios } from "@/server/db/schema";
import { cerrarSesion, iniciarSesion } from "@/server/auth/sesion";
import { hashClave, problemaDeClave, verificarClave } from "@/server/auth/clave";
import { auditar } from "@/server/auditoria";
import { entorno } from "@/server/entorno";
import type { ResultadoAccion } from "@/lib/utils";

// Limitador simple de intentos fallidos (por IP + correo), en memoria del servidor
const intentos = new Map<string, { n: number; hasta: number }>();
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 10 * 60_000;

export async function accionLogin(_: unknown, fd: FormData): Promise<ResultadoAccion> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const clave = String(fd.get("clave") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const clavePrueba = `${ip}|${email}`;
  const registro = intentos.get(clavePrueba);
  if (registro && registro.n >= MAX_INTENTOS && registro.hasta > Date.now()) {
    return { ok: false, error: "Demasiados intentos fallidos. Espera 10 minutos e intenta nuevamente." };
  }
  if (!email || !clave) return { ok: false, error: "Ingresa tu correo y contraseña." };

  const [u] = await db.select().from(usuarios).where(sql`lower(${usuarios.email}) = ${email}`);
  const valido = u && u.activo && (await verificarClave(u.passwordHash, clave));
  if (!valido) {
    const ahora = Date.now();
    for (const [llave, intento] of intentos) if (intento.hasta <= ahora) intentos.delete(llave);
    intentos.set(clavePrueba, { n: (intentos.get(clavePrueba)?.n ?? 0) + 1, hasta: ahora + BLOQUEO_MS });
    await auditar(db, { usuarioId: u?.id ?? null, usuarioNombre: email, origen: "ui", ip }, {
      accion: "login_fallido",
      entidad: "usuario",
      entidadId: u?.id ?? null,
      resumen: `Intento fallido para ${email}`,
    });
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }
  intentos.delete(clavePrueba);
  await iniciarSesion(u.id);
  await auditar(db, { usuarioId: u.id, usuarioNombre: u.nombre, origen: "ui", ip }, {
    accion: "login",
    entidad: "usuario",
    entidadId: u.id,
    resumen: `Inicio de sesión de ${u.nombre}`,
  });
  redirect("/");
}

export async function accionCerrarSesion() {
  await cerrarSesion();
  redirect("/login");
}

const esquemaPrimerUsuario = z
  .object({
    nombre: z.string().trim().min(2, "Indica tu nombre"),
    email: z.string().trim().toLowerCase().email("Correo inválido"),
    clave: z.string(),
    clave2: z.string(),
  })
  .refine((d) => d.clave === d.clave2, { message: "Las contraseñas no coinciden", path: ["clave2"] });

/** Crea el primer administrador. Solo funciona si la base de datos no tiene usuarios. */
export async function accionPrimerUsuario(_: unknown, fd: FormData): Promise<ResultadoAccion> {
  if (!entorno.REGISTRO_INICIAL_WEB) return { ok: false, error: "La creación del administrador inicial desde la web está deshabilitada." };
  if (await hayUsuarios()) return { ok: false, error: "Ya existe un usuario. Inicia sesión." };
  const r = esquemaPrimerUsuario.safeParse(Object.fromEntries(fd));
  if (!r.success) {
    const errores: Record<string, string[]> = {};
    for (const i of r.error.issues) (errores[String(i.path[0])] ??= []).push(i.message);
    return { ok: false, error: "Revisa los datos.", errores };
  }
  const problema = problemaDeClave(r.data.clave);
  if (problema) return { ok: false, error: problema, errores: { clave: [problema] } };
  const passwordHash = await hashClave(r.data.clave);
  const u = await db.transaction(async (tx) => {
    await tx.execute(sql`lock table ${usuarios} in share row exclusive mode`);
    const existente = await tx.select({ id: usuarios.id }).from(usuarios).limit(1);
    if (existente.length) return null;
    const [nuevo] = await tx.insert(usuarios).values({ nombre: r.data.nombre, email: r.data.email, passwordHash, rol: "admin" }).returning();
    await auditar(tx, { usuarioId: nuevo.id, usuarioNombre: nuevo.nombre, origen: "ui" }, {
      accion: "crear", entidad: "usuario", entidadId: nuevo.id, resumen: `Primer administrador: ${nuevo.nombre}`,
    });
    return nuevo;
  });
  if (!u) return { ok: false, error: "Ya existe un usuario. Inicia sesión." };
  await iniciarSesion(u.id);
  redirect("/");
}

export async function hayUsuarios() {
  const filas = await db.select({ id: usuarios.id }).from(usuarios).limit(1);
  return filas.length > 0;
}
