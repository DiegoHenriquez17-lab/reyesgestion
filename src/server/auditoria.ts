import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { DbOTx } from "@/server/db";
import { auditoria, cierresMes } from "@/server/db/schema";
import { ErrorNegocio } from "@/server/errores";
import { formatearPeriodo } from "@/lib/formato";

/** Quién está haciendo la operación y desde dónde. Se pasa a todos los servicios. */
export type Contexto = {
  usuarioId: number | null;
  usuarioNombre: string;
  origen: "ui" | "importacion" | "ia" | "sistema";
  ip?: string | null;
};

export const contextoSistema: Contexto = { usuarioId: null, usuarioNombre: "Sistema", origen: "sistema" };

const CAMPOS_IGNORADOS = new Set(["creadoEn", "actualizadoEn", "textoBusqueda", "aliasNormalizado"]);

/** Lista de cambios campo a campo entre dos versiones de un registro. */
export function calcularCambios(antes: Record<string, unknown> | null | undefined, despues: Record<string, unknown> | null | undefined) {
  const cambios: { campo: string; antes: unknown; despues: unknown }[] = [];
  const claves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  for (const campo of claves) {
    if (CAMPOS_IGNORADOS.has(campo)) continue;
    const a = antes?.[campo] ?? null;
    const d = despues?.[campo] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(d)) cambios.push({ campo, antes: a, despues: d });
  }
  return cambios;
}

function limpiar(obj: Record<string, unknown> | null | undefined) {
  if (!obj) return null;
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !CAMPOS_IGNORADOS.has(k)));
}

export type EventoAuditoria = {
  accion: string;
  entidad: string;
  entidadId?: string | number | null;
  resumen?: string;
  antes?: Record<string, unknown> | null;
  despues?: Record<string, unknown> | null;
  motivo?: string | null;
  periodoCerrado?: boolean;
};

/** Registra un evento de auditoría. Debe llamarse dentro de la misma transacción del cambio. */
export async function auditar(tx: DbOTx, ctx: Contexto, e: EventoAuditoria) {
  const cambios = e.antes || e.despues ? calcularCambios(e.antes, e.despues) : null;
  await tx.insert(auditoria).values({
    usuarioId: ctx.usuarioId,
    accion: e.accion,
    entidad: e.entidad,
    entidadId: e.entidadId == null ? null : String(e.entidadId),
    resumen: e.resumen,
    antes: limpiar(e.antes),
    despues: limpiar(e.despues),
    cambios,
    motivo: e.motivo?.trim() || null,
    origen: ctx.origen,
    periodoCerrado: e.periodoCerrado ?? false,
    ip: ctx.ip ?? null,
  });
}

/** Devuelve los periodos (de la lista) que están cerrados. */
export async function periodosCerrados(tx: DbOTx, periodos: string[]): Promise<string[]> {
  const unicos = [...new Set(periodos.filter(Boolean))];
  if (unicos.length === 0) return [];
  const filas = await tx
    .select({ periodo: cierresMes.periodo })
    .from(cierresMes)
    .where(and(inArray(cierresMes.periodo, unicos), eq(cierresMes.estado, "cerrado")));
  return filas.map((f) => f.periodo);
}

/**
 * Si algún periodo está cerrado, exige un motivo. Devuelve true si se tocó un mes cerrado
 * (para marcarlo en la auditoría).
 */
export async function exigirMotivoSiCerrado(tx: DbOTx, periodos: string[], motivo?: string | null): Promise<boolean> {
  const cerrados = await periodosCerrados(tx, periodos);
  if (cerrados.length === 0) return false;
  if (!motivo || motivo.trim().length < 5) {
    throw new ErrorNegocio(
      `${cerrados.map(formatearPeriodo).join(", ")} ${cerrados.length > 1 ? "están cerrados" : "está cerrado"}. ` +
        "Para modificarlo debes indicar el motivo (queda registrado en la auditoría).",
    );
  }
  return true;
}
