import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { sesiones, usuarios } from "@/server/db/schema";
import { entorno } from "@/server/entorno";
import type { Contexto } from "@/server/auditoria";
import type { Rol } from "@/lib/constantes";
import { COOKIE_SESION } from "@/lib/sesion-cookie";

export { COOKIE_SESION };

export type UsuarioSesion = { id: number; nombre: string; email: string; rol: Rol };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea la sesión en BD y deja la cookie (solo desde Server Actions / Route Handlers). */
export async function iniciarSesion(usuarioId: number) {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + entorno.SESSION_DIAS * 86_400_000);
  const h = await headers();
  await db.insert(sesiones).values({
    id: hashToken(token),
    usuarioId,
    expiraEn: expira,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  await db.update(usuarios).set({ ultimoAcceso: new Date() }).where(eq(usuarios.id, usuarioId));
  // Limpieza de sesiones vencidas
  await db.delete(sesiones).where(lt(sesiones.expiraEn, new Date()));

  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: entorno.NODE_ENV === "production",
    path: "/",
    expires: expira,
  });
}

export async function cerrarSesion() {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_SESION)?.value;
  if (token) await db.delete(sesiones).where(eq(sesiones.id, hashToken(token)));
  almacen.delete(COOKIE_SESION);
}

/** Usuario de la solicitud actual (una sola consulta por solicitud gracias a `cache`). */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;
  const [fila] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, email: usuarios.email, rol: usuarios.rol })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(and(eq(sesiones.id, hashToken(token)), gt(sesiones.expiraEn, new Date()), eq(usuarios.activo, true)));
  return fila ?? null;
});

/** Exige sesión (y opcionalmente un rol). Redirige a /login si no hay sesión. */
export async function requerirUsuario(roles?: Rol[]): Promise<UsuarioSesion> {
  const u = await obtenerUsuarioActual();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.rol)) redirect("/?error=permiso");
  return u;
}

/** Igual que requerirUsuario, pero para Server Actions: lanza error en vez de redirigir por rol. */
export async function contextoAccion(roles: Rol[] = ["admin", "operador"]): Promise<Contexto & { rol: Rol }> {
  const u = await obtenerUsuarioActual();
  if (!u) redirect("/login");
  if (!roles.includes(u.rol)) {
    const { ErrorNegocio } = await import("@/server/errores");
    throw new ErrorNegocio("No tienes permiso para realizar esta acción.");
  }
  const h = await headers();
  return {
    usuarioId: u.id,
    usuarioNombre: u.nombre,
    rol: u.rol,
    origen: "ui",
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}
