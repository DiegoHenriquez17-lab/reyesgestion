"use server";

import { redirect } from "next/navigation";
import { ejecutarAccion } from "@/server/acciones";
import {
  aplicarImportacion,
  analizarImportacion,
  cancelarImportacion,
  confirmarMapeo,
  decidirFila,
  decidirPorAccion,
  iniciarImportacion,
} from "@/server/importacion";
import { contextoAccion } from "@/server/auth/sesion";
import { revalidatePath } from "next/cache";
import { DECISIONES_FILA, DESTINOS_IMPORTACION, type DecisionFila, type DestinoImportacion } from "@/lib/constantes";
import { ErrorNegocio } from "@/server/errores";
import type { ResultadoAccion } from "@/lib/utils";

export async function accionSubirArchivo(_: unknown, fd: FormData): Promise<ResultadoAccion<unknown>> {
  const archivo = fd.get("archivo");
  const destino = String(fd.get("destino")) as DestinoImportacion;
  const r = await ejecutarAccion(
    async (ctx) => {
      if (!(archivo instanceof File) || archivo.size === 0) throw new ErrorNegocio("Selecciona un archivo o toma una foto.");
      if (!DESTINOS_IMPORTACION.includes(destino)) throw new ErrorNegocio("Indica qué tipo de información contiene.");
      return iniciarImportacion(ctx, archivo, destino, {
        usarIa: fd.get("usarIa") === "on",
        indicaciones: String(fd.get("indicaciones") ?? "").trim() || undefined,
        verificado: destino === "pagos" ? fd.get("verificado") === "on" : undefined,
      });
    },
    { revalidar: ["/importar"], alertas: false },
  );
  if (r.ok) redirect(`/importar/${(r.datos as { id: number }).id}`);
  return r;
}

export async function accionConfirmarMapeo(id: number, _: unknown, fd: FormData) {
  const mapeo: Record<string, string | null> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("col:")) mapeo[k.slice(4)] = String(v) || null;
  }
  return ejecutarAccion((ctx) => confirmarMapeo(ctx, id, mapeo, { verificado: fd.get("verificado") === "on" }), {
    revalidar: [`/importar/${id}`],
    alertas: false,
  });
}

export async function accionReanalizar(id: number) {
  return ejecutarAccion(() => analizarImportacion(id), { revalidar: [`/importar/${id}`], alertas: false, mensaje: "Análisis actualizado." });
}

export async function accionDecidirFila(id: number, filaId: number, decision: string, conciliar?: boolean) {
  await contextoAccion();
  const d = decision ? (decision as DecisionFila) : null;
  if (d && !DECISIONES_FILA.includes(d)) throw new ErrorNegocio("Decisión inválida.");
  await decidirFila(id, filaId, d, conciliar);
  revalidatePath(`/importar/${id}`);
}

export async function accionDecidirTodas(id: number, _: unknown, fd: FormData) {
  return ejecutarAccion(() => decidirPorAccion(id, String(fd.get("accion")), String(fd.get("decision")) as DecisionFila), {
    revalidar: [`/importar/${id}`],
    alertas: false,
  });
}

export async function accionAplicar(id: number) {
  return ejecutarAccion((ctx) => aplicarImportacion(ctx, id), {
    revalidar: ["/", "/alumnos", "/pagos", `/importar/${id}`],
    mensaje: (c) =>
      `Listo: ${c.aplicadas} guardado(s), ${c.omitidas} omitido(s)` +
      (c.errores ? `, ${c.errores} con error (revísalos abajo)` : "") +
      (c.sinDecision ? `, ${c.sinDecision} pendiente(s) de decisión` : "") +
      ".",
  });
}

export async function accionCancelar(id: number) {
  return ejecutarAccion((ctx) => cancelarImportacion(ctx, id), { revalidar: ["/importar", `/importar/${id}`], alertas: false });
}
