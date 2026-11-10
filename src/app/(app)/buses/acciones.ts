"use server";

import { ejecutarAccion } from "@/server/acciones";
import { guardarBus } from "@/server/modulos/catalogos";
import { formDataAObjeto } from "@/lib/validaciones";

export async function accionGuardarBus(id: number | null, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => guardarBus(ctx, id, formDataAObjeto(fd, ["activo"])), {
    roles: ["admin", "operador"],
    revalidar: ["/buses", "/alumnos"],
    mensaje: "Bus guardado.",
  });
}
