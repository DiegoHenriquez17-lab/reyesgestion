import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { recordatorios } from "@/server/db/schema";
import { auditar, type Contexto } from "@/server/auditoria";
import { ErrorNegocio } from "@/server/errores";
import { esFechaIso } from "@/lib/fechas";

const esquema = z.object({
  titulo: z.string().trim().min(2, "Escribe el recordatorio").max(200),
  detalle: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || null),
  fecha: z.string().refine(esFechaIso, "Fecha inválida"),
  entidadTipo: z.string().optional().nullable(),
  entidadId: z.coerce.number().int().positive().optional().nullable(),
});

export async function crearRecordatorio(ctx: Contexto, entrada: unknown) {
  const d = esquema.parse(entrada);
  return db.transaction(async (tx) => {
    const [r] = await tx
      .insert(recordatorios)
      .values({ ...d, entidadTipo: d.entidadTipo ?? null, entidadId: d.entidadId ?? null, creadoPor: ctx.usuarioId })
      .returning();
    await auditar(tx, ctx, { accion: "crear", entidad: "recordatorio", entidadId: r.id, resumen: r.titulo, despues: r });
    return r;
  });
}

export async function cambiarEstadoRecordatorio(ctx: Contexto, id: number, estado: "hecho" | "cancelado" | "pendiente") {
  return db.transaction(async (tx) => {
    const [antes] = await tx.select().from(recordatorios).where(eq(recordatorios.id, id));
    if (!antes) throw new ErrorNegocio("El recordatorio no existe.");
    const [r] = await tx
      .update(recordatorios)
      .set({ estado, completadoEn: estado === "pendiente" ? null : new Date() })
      .where(eq(recordatorios.id, id))
      .returning();
    await auditar(tx, ctx, { accion: `recordatorio_${estado}`, entidad: "recordatorio", entidadId: id, resumen: r.titulo, antes, despues: r });
  });
}

export async function listarRecordatorios(soloPendientes = true) {
  return db
    .select()
    .from(recordatorios)
    .where(soloPendientes ? eq(recordatorios.estado, "pendiente") : sql`true`)
    .orderBy(asc(recordatorios.fecha))
    .limit(200);
}
