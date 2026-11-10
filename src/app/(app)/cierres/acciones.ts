"use server";

import { ejecutarAccion } from "@/server/acciones";
import { cerrarMes, reabrirMes } from "@/server/modulos/cierres";
import { ErrorNegocio } from "@/server/errores";
import { aPeriodo } from "@/lib/fechas";
import { formatearPeriodo } from "@/lib/formato";

export async function accionCerrarMes(_: unknown, fd: FormData) {
  const periodo = aPeriodo(String(fd.get("periodo") ?? ""));
  return ejecutarAccion(
    async (ctx) => {
      if (!periodo) throw new ErrorNegocio("Selecciona el mes.");
      return cerrarMes(ctx, periodo);
    },
    { revalidar: ["/cierres", "/"], mensaje: periodo ? `${formatearPeriodo(periodo)} cerrado.` : undefined },
  );
}

export async function accionReabrirMes(_: unknown, fd: FormData) {
  const periodo = aPeriodo(String(fd.get("periodo") ?? ""));
  return ejecutarAccion(
    async (ctx) => {
      if (!periodo) throw new ErrorNegocio("Mes inválido.");
      return reabrirMes(ctx, periodo, String(fd.get("motivo") ?? ""));
    },
    { roles: ["admin"], revalidar: ["/cierres", "/"], mensaje: "Mes reabierto." },
  );
}
