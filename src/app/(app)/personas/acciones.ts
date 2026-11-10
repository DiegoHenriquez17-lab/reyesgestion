"use server";

import { redirect } from "next/navigation";
import { ejecutarAccion } from "@/server/acciones";
import { actualizarPersona, fusionarPersonas } from "@/server/modulos/personas";
import { formDataAObjeto } from "@/lib/validaciones";

export async function accionEditarPersona(id: number, _: unknown, fd: FormData) {
  const o = formDataAObjeto(fd);
  const { motivo, ...datos } = o;
  return ejecutarAccion((ctx) => actualizarPersona(ctx, id, datos, String(motivo ?? "") || null), {
    revalidar: [`/personas/${id}`, "/alumnos"],
    mensaje: "Datos guardados.",
  });
}

export async function accionFusionar(_: unknown, fd: FormData) {
  const principalId = Number(fd.get("principalId"));
  const duplicadoId = Number(fd.get("duplicadoId"));
  const r = await ejecutarAccion((ctx) => fusionarPersonas(ctx, principalId, duplicadoId, String(fd.get("motivo") ?? "")), {
    revalidar: ["/personas", "/alumnos"],
  });
  if (r.ok) redirect(`/personas/${principalId}`);
  return r;
}
