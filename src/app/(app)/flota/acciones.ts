"use server";

import { formDataAObjeto } from "@/lib/validaciones";
import { ejecutarAccion } from "@/server/acciones";
import { archivarDocumentoControl, completarMantencion, guardarConductor, guardarDocumentoControl, guardarPlan, registrarKilometraje } from "@/server/modulos/flota";
import { proponerDocumento } from "@/server/importacion/documento";
import { ErrorNegocio } from "@/server/errores";

const revalidar = ["/flota", "/buses", "/informes", "/alertas", "/"];

export async function accionLeerAdjunto(fd: FormData) {
  return ejecutarAccion((ctx) => {
    const archivo = fd.get("archivo");
    if (!(archivo instanceof File)) throw new ErrorNegocio("Selecciona un archivo.");
    return proponerDocumento(ctx, archivo, "documento_flota");
  }, { revalidar: [], alertas: false });
}

export async function accionConductor(id: number | null, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => guardarConductor(ctx, id, formDataAObjeto(fd, ["activo"])), { revalidar, mensaje: "Conductor guardado." });
}

export async function accionDocumentoControl(id: number | null, _: unknown, fd: FormData) {
  const archivo = fd.get("archivo");
  return ejecutarAccion((ctx) => guardarDocumentoControl(ctx, id, formDataAObjeto(fd), archivo instanceof File ? archivo : undefined),
    { revalidar, mensaje: "Documento guardado." });
}

export async function accionArchivarDocumento(id: number, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => archivarDocumentoControl(ctx, id, fd.get("motivo")), { revalidar, mensaje: "Documento archivado." });
}

export async function accionKilometraje(_: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => registrarKilometraje(ctx, formDataAObjeto(fd)), { revalidar, mensaje: "Kilometraje registrado." });
}

export async function accionPlan(id: number | null, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => guardarPlan(ctx, id, formDataAObjeto(fd, ["activo"])), { revalidar, mensaje: "Plan guardado." });
}

export async function accionCompletarMantencion(_: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => completarMantencion(ctx, formDataAObjeto(fd)), { revalidar, mensaje: "Mantención registrada." });
}
