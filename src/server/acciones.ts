import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { ZodError } from "zod";
import { contextoAccion } from "@/server/auth/sesion";
import { recalcularAlertas } from "@/server/alertas/motor";
import type { Contexto } from "@/server/auditoria";
import { ErrorNegocio, mensajeDeError } from "@/server/errores";
import { erroresPorCampo } from "@/lib/validaciones";
import type { Rol } from "@/lib/constantes";
import type { ResultadoAccion } from "@/lib/utils";

/**
 * Envoltorio estándar para Server Actions:
 *  - exige sesión y rol,
 *  - convierte errores de validación / negocio en mensajes para el formulario,
 *  - refresca las pantallas afectadas,
 *  - recalcula las alertas en segundo plano después de cada cambio.
 */
export async function ejecutarAccion<T>(
  fn: (ctx: Contexto & { rol: Rol }) => Promise<T>,
  opciones: { roles?: Rol[]; revalidar?: string[]; mensaje?: string | ((r: T) => string); alertas?: boolean } = {},
): Promise<ResultadoAccion<T>> {
  try {
    const ctx = await contextoAccion(opciones.roles);
    const datos = await fn(ctx);
    if (opciones.alertas !== false) {
      // Las alertas se actualizan de inmediato para que el panel refleje el cambio
      try {
        await recalcularAlertas({ forzar: true });
      } catch (e) {
        after(() => console.error("Error al recalcular alertas", e));
      }
    }
    for (const ruta of opciones.revalidar ?? ["/"]) revalidatePath(ruta, "layout");
    const mensaje = typeof opciones.mensaje === "function" ? opciones.mensaje(datos) : opciones.mensaje;
    return { ok: true, mensaje, datos };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ZodError) return { ok: false, error: "Revisa los datos marcados.", errores: erroresPorCampo(e) };
    if (e instanceof ErrorNegocio) return { ok: false, error: e.message, errores: e.campos };
    return { ok: false, error: mensajeDeError(e) };
  }
}
