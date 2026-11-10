import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { cierresMes, usuarios } from "@/server/db/schema";
import { auditar, type Contexto } from "@/server/auditoria";
import { ErrorNegocio } from "@/server/errores";
import { resumenRecaudacion } from "@/server/informes";
import { formatearPeriodo } from "@/lib/formato";

/** Cierra un mes guardando la fotografía de sus totales. */
export async function cerrarMes(ctx: Contexto, periodo: string) {
  return db.transaction(async (tx) => {
    const [existente] = await tx.select().from(cierresMes).where(eq(cierresMes.periodo, periodo));
    if (existente?.estado === "cerrado") throw new ErrorNegocio(`${formatearPeriodo(periodo)} ya está cerrado.`);
    const resumen = await resumenRecaudacion(periodo, tx);
    const valores = {
      periodo,
      estado: "cerrado" as const,
      resumen,
      cerradoPor: ctx.usuarioId,
      cerradoEn: new Date(),
    };
    const [c] = existente
      ? await tx.update(cierresMes).set(valores).where(eq(cierresMes.id, existente.id)).returning()
      : await tx.insert(cierresMes).values(valores).returning();
    await auditar(tx, ctx, {
      accion: "cerrar_mes",
      entidad: "periodo",
      entidadId: periodo,
      resumen: `Cierre de ${formatearPeriodo(periodo)}`,
      despues: resumen,
    });
    return c;
  });
}

/** Reabre un mes cerrado (solo administradores, con motivo). */
export async function reabrirMes(ctx: Contexto, periodo: string, motivo: string) {
  if (!motivo?.trim()) throw new ErrorNegocio("Indica el motivo de la reapertura.");
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(cierresMes).where(eq(cierresMes.periodo, periodo));
    if (!c || c.estado !== "cerrado") throw new ErrorNegocio("El mes no está cerrado.");
    await tx
      .update(cierresMes)
      .set({ estado: "reabierto", reabiertoPor: ctx.usuarioId, reabiertoEn: new Date(), motivoReapertura: motivo })
      .where(eq(cierresMes.id, c.id));
    await auditar(tx, ctx, {
      accion: "reabrir_mes",
      entidad: "periodo",
      entidadId: periodo,
      resumen: `Reapertura de ${formatearPeriodo(periodo)}`,
      antes: c.resumen,
      motivo,
      periodoCerrado: true,
    });
  });
}

export async function listarCierres() {
  return db
    .select({ cierre: cierresMes, cerradoPorNombre: usuarios.nombre })
    .from(cierresMes)
    .leftJoin(usuarios, eq(usuarios.id, cierresMes.cerradoPor))
    .orderBy(desc(cierresMes.periodo));
}
