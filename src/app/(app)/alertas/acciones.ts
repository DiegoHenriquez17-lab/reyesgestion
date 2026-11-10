"use server";

import { eq } from "drizzle-orm";
import { ejecutarAccion } from "@/server/acciones";
import { recalcularAlertas } from "@/server/alertas/motor";
import { auditar } from "@/server/auditoria";
import { db } from "@/server/db";
import { alertas, reglasAlerta } from "@/server/db/schema";
import { ErrorNegocio } from "@/server/errores";
import { esFechaIso } from "@/lib/fechas";
import { NIVELES_ALERTA, type NivelAlerta } from "@/lib/constantes";

export async function accionRecalcular() {
  return ejecutarAccion(() => recalcularAlertas({ forzar: true }), {
    revalidar: ["/", "/alertas"],
    alertas: false,
    mensaje: (r) => `Alertas actualizadas: ${r.nuevas} nuevas, ${r.resueltas} resueltas.`,
  });
}

export async function accionPosponer(id: number, _: unknown, fd: FormData) {
  const hasta = String(fd.get("hasta") ?? "");
  return ejecutarAccion(
    async (ctx) => {
      if (!esFechaIso(hasta)) throw new ErrorNegocio("Indica hasta qué fecha posponer.");
      await db.update(alertas).set({ estado: "pospuesta", pospuestaHasta: hasta, atendidaPor: ctx.usuarioId }).where(eq(alertas.id, id));
    },
    { revalidar: ["/", "/alertas"], alertas: false, mensaje: "Alerta pospuesta." },
  );
}

export async function accionDescartar(id: number, _?: unknown, _fd?: FormData) {
  return ejecutarAccion(
    async (ctx) => {
      const [a] = await db.select().from(alertas).where(eq(alertas.id, id));
      if (!a) throw new ErrorNegocio("La alerta no existe.");
      await db.update(alertas).set({ estado: "descartada", nivelDescartado: a.nivel, atendidaPor: ctx.usuarioId }).where(eq(alertas.id, id));
    },
    { revalidar: ["/", "/alertas"], alertas: false, mensaje: "Alerta descartada (reaparece si empeora)." },
  );
}

export async function accionReactivar(id: number, _?: unknown, _fd?: FormData) {
  return ejecutarAccion(
    async () => {
      await db.update(alertas).set({ estado: "activa", pospuestaHasta: null, nivelDescartado: null }).where(eq(alertas.id, id));
    },
    { revalidar: ["/", "/alertas"], alertas: false },
  );
}

/** Guarda la configuración de una regla (activa, umbrales y parámetros). */
export async function accionGuardarRegla(codigo: string, _: unknown, fd: FormData) {
  return ejecutarAccion(
    async (ctx) => {
      const [antes] = await db.select().from(reglasAlerta).where(eq(reglasAlerta.codigo, codigo));
      if (!antes) throw new ErrorNegocio("La regla no existe.");
      const umbrales: { dias: number; nivel: NivelAlerta }[] = [];
      for (let i = 0; i < 6; i++) {
        const diasTxt = fd.get(`dias_${i}`);
        const nivel = String(fd.get(`nivel_${i}`) ?? "");
        const sentido = String(fd.get(`sentido_${i}`) ?? "antes");
        if (diasTxt === null || String(diasTxt).trim() === "" || !nivel) continue;
        const n = Math.abs(Number(diasTxt));
        if (!Number.isFinite(n)) throw new ErrorNegocio("Los días deben ser números.");
        if (!(NIVELES_ALERTA as readonly string[]).includes(nivel)) throw new ErrorNegocio("Nivel inválido.");
        umbrales.push({ dias: sentido === "despues" ? -n : n, nivel: nivel as NivelAlerta });
      }
      const parametros: Record<string, number | string | boolean> = { ...antes.parametros };
      for (const [k, v] of fd.entries()) {
        if (!k.startsWith("param_")) continue;
        const clave = k.slice(6);
        const valor = String(v);
        parametros[clave] = /^-?\d+(\.\d+)?$/.test(valor) ? Number(valor) : valor;
      }
      const activa = fd.get("activa") === "on";
      const [despues] = await db
        .update(reglasAlerta)
        .set({ activa, umbrales: umbrales.sort((a, b) => b.dias - a.dias), parametros, actualizadoEn: new Date(), actualizadoPor: ctx.usuarioId })
        .where(eq(reglasAlerta.codigo, codigo))
        .returning();
      await auditar(db, ctx, { accion: "configurar_alerta", entidad: "regla_alerta", entidadId: codigo, resumen: antes.nombre, antes, despues });
    },
    { roles: ["admin"], revalidar: ["/configuracion/alertas", "/", "/alertas"], mensaje: "Regla guardada." },
  );
}
