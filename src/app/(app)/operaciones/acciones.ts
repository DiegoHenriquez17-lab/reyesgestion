"use server";

import { formDataAObjeto } from "@/lib/validaciones";
import { ejecutarAccion } from "@/server/acciones";
import { guardarContrato, guardarCotizacion, guardarViaje, programarCotizacion } from "@/server/modulos/operaciones";
import { proponerDocumento } from "@/server/importacion/documento";
import { ErrorNegocio } from "@/server/errores";

const revalidar = ["/operaciones", "/alertas", "/informes", "/"];

export async function accionLeerContrato(fd: FormData) {
  return ejecutarAccion((ctx) => {
    const archivo = fd.get("archivo");
    if (!(archivo instanceof File)) throw new ErrorNegocio("Selecciona un archivo.");
    return proponerDocumento(ctx, archivo, "contrato");
  }, { revalidar: [], alertas: false });
}

export async function accionCotizacion(id: number | null, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => guardarCotizacion(ctx, id, formDataAObjeto(fd)), { revalidar, mensaje: "Cotización guardada." });
}

export async function accionProgramarCotizacion(id: number) {
  return ejecutarAccion((ctx) => programarCotizacion(ctx, id), { revalidar, mensaje: "Viaje programado. Revisa las asignaciones en Viajes." });
}

export async function accionViaje(id: number | null, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => guardarViaje(ctx, id, formDataAObjeto(fd, ["documentacionLista"])), { revalidar, mensaje: "Viaje guardado." });
}

export async function accionContrato(id: number | null, _: unknown, fd: FormData) {
  const archivo = fd.get("archivo");
  return ejecutarAccion((ctx) => guardarContrato(ctx, id, formDataAObjeto(fd, ["activo"]), archivo instanceof File ? archivo : undefined),
    { revalidar, mensaje: "Contrato guardado." });
}
