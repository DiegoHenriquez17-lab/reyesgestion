"use server";

import { ejecutarAccion } from "@/server/acciones";
import { cambiarEstadoRecordatorio, crearRecordatorio } from "@/server/modulos/recordatorios";
import { formDataAObjeto } from "@/lib/validaciones";

export async function accionCrearRecordatorio(_: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => crearRecordatorio(ctx, formDataAObjeto(fd)), {
    revalidar: ["/recordatorios", "/"],
    mensaje: "Recordatorio creado.",
  });
}

export async function accionEstadoRecordatorio(id: number, estado: "hecho" | "cancelado", _?: unknown, _fd?: FormData) {
  return ejecutarAccion((ctx) => cambiarEstadoRecordatorio(ctx, id, estado), { revalidar: ["/recordatorios", "/"] });
}
