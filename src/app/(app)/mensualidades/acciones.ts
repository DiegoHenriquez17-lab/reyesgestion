"use server";

import { ejecutarAccion } from "@/server/acciones";
import { cambiarEstadoMensualidad, cambiarMontoMensualidad, generarMensualidades } from "@/server/modulos/mensualidades";
import { aPeriodo } from "@/lib/fechas";
import { parsearMonto } from "@/lib/formato";
import { ErrorNegocio } from "@/server/errores";

export async function accionGenerarMensualidades(_: unknown, fd: FormData) {
  const periodo = aPeriodo(String(fd.get("periodo") ?? ""));
  return ejecutarAccion(
    async (ctx) => {
      if (!periodo) throw new ErrorNegocio("Selecciona el mes a generar.");
      return generarMensualidades(ctx, periodo);
    },
    {
      revalidar: ["/mensualidades", "/"],
      mensaje: (r) => (r.creadas ? `Se generaron ${r.creadas} mensualidades.` : "Todos los alumnos activos ya tenían su mensualidad."),
    },
  );
}

export async function accionCambiarEstadoMensualidad(_: unknown, fd: FormData) {
  const id = Number(fd.get("id"));
  const estado = String(fd.get("estado")) as "condonada" | "no_recuperable" | "anulada" | "pendiente";
  return ejecutarAccion((ctx) => cambiarEstadoMensualidad(ctx, id, estado, String(fd.get("motivo") ?? "")), {
    revalidar: ["/mensualidades", "/alumnos", "/"],
    mensaje: "Estado actualizado.",
  });
}

export async function accionCambiarMontoMensualidad(_: unknown, fd: FormData) {
  const id = Number(fd.get("id"));
  const monto = parsearMonto(fd.get("monto"));
  return ejecutarAccion(
    async (ctx) => {
      if (monto === null) throw new ErrorNegocio("Monto inválido.");
      return cambiarMontoMensualidad(ctx, id, monto, String(fd.get("motivo") ?? ""));
    },
    { revalidar: ["/mensualidades", "/alumnos", "/"], mensaje: "Monto actualizado." },
  );
}
