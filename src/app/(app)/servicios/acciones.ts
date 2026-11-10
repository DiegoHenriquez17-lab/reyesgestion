"use server";

import { ejecutarAccion } from "@/server/acciones";
import { guardarServicio } from "@/server/modulos/catalogos";
import { formDataAObjeto } from "@/lib/validaciones";

export async function accionGuardarServicio(id: number | null, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => guardarServicio(ctx, id, formDataAObjeto(fd, ["activo"])), {
    roles: ["admin", "operador"],
    revalidar: ["/servicios", "/alumnos"],
    mensaje: "Servicio guardado.",
  });
}
