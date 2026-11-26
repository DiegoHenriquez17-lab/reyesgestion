"use server";

import { formDataAObjeto } from "@/lib/validaciones";
import { ejecutarAccion } from "@/server/acciones";
import { resolverDevolucion, solicitarDevolucion } from "@/server/modulos/devoluciones";

const revalidar = ["/devoluciones", "/pagos", "/alertas", "/informes", "/"];

export async function accionSolicitarDevolucion(_: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => solicitarDevolucion(ctx, formDataAObjeto(fd)), { revalidar, mensaje: "Devolución pendiente registrada." });
}

export async function accionResolverDevolucion(id: number, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => resolverDevolucion(ctx, id, formDataAObjeto(fd)), { revalidar, mensaje: "Devolución actualizada." });
}
