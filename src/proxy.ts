import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/sesion-cookie";

/**
 * Verificación optimista: si no hay cookie de sesión, redirige a /login.
 * La validación real de la sesión se hace en el servidor (requerirUsuario) en cada página y acción.
 */
const PUBLICAS = ["/login", "/primer-usuario"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLICAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!request.cookies.has(COOKIE_SESION)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const respuesta = NextResponse.next();
  respuesta.headers.set("X-Frame-Options", "DENY");
  respuesta.headers.set("X-Content-Type-Options", "nosniff");
  respuesta.headers.set("Referrer-Policy", "same-origin");
  return respuesta;
}

export const config = {
  // Todo excepto archivos estáticos de Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
