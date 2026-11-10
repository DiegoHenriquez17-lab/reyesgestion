import "server-only";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { alertas, alumnos, mensualidades, pagos, recordatorios, reglasAlerta } from "@/server/db/schema";
import { hoy, periodoActual } from "@/server/fechas";
import { resumenRecaudacion, tendenciaRecaudacion } from "@/server/informes";
import { NIVEL_ALERTA_PESO, type NivelAlerta } from "@/lib/constantes";

/** Todo lo que el panel principal necesita en una sola llamada. */
export async function datosPanel() {
  const periodo = periodoActual();
  const hoyStr = hoy();
  const [resumen, tendencia, porVerificar, porConciliar, morosos, activas, reglas, proximos] = await Promise.all([
    resumenRecaudacion(periodo),
    tendenciaRecaudacion(6),
    db
      .select({ n: sql<number>`count(*)::int`, monto: sql<number>`coalesce(sum(${pagos.monto}),0)::int` })
      .from(pagos)
      .where(and(isNull(pagos.anuladoEn), eq(pagos.estadoVerificacion, "por_verificar"))),
    db
      .select({ n: sql<number>`count(*)::int`, monto: sql<number>`coalesce(sum(${pagos.monto} - ${pagos.montoAplicado}),0)::int` })
      .from(pagos)
      .where(and(isNull(pagos.anuladoEn), eq(pagos.estadoVerificacion, "verificado"), ne(pagos.estadoConciliacion, "conciliado"))),
    db
      .select({
        alumnos: sql<number>`count(distinct ${mensualidades.alumnoId})::int`,
        deuda: sql<number>`coalesce(sum(${mensualidades.monto} - ${mensualidades.montoPagado}),0)::int`,
      })
      .from(mensualidades)
      .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
      .where(
        and(
          sql`${mensualidades.estado} in ('pendiente','parcial')`,
          sql`${mensualidades.fechaVencimiento} < ${hoyStr}`,
          isNull(alumnos.eliminadoEn),
        ),
      ),
    db.select().from(alertas).where(eq(alertas.estado, "activa")).orderBy(desc(alertas.ultimaVez)),
    db.select({ codigo: reglasAlerta.codigo, nombre: reglasAlerta.nombre }).from(reglasAlerta),
    db.select().from(recordatorios).where(eq(recordatorios.estado, "pendiente")).orderBy(asc(recordatorios.fecha)).limit(5),
  ]);

  // Agrupar alertas por regla, de la más grave a la menos grave
  const nombres = new Map(reglas.map((r) => [r.codigo, r.nombre]));
  const grupos = new Map<string, { codigo: string; nombre: string; nivelMax: NivelAlerta; total: number; items: typeof activas }>();
  for (const a of activas) {
    const g = grupos.get(a.reglaCodigo) ?? { codigo: a.reglaCodigo, nombre: nombres.get(a.reglaCodigo) ?? a.reglaCodigo, nivelMax: a.nivel, total: 0, items: [] };
    g.total++;
    g.items.push(a);
    if (NIVEL_ALERTA_PESO[a.nivel] > NIVEL_ALERTA_PESO[g.nivelMax]) g.nivelMax = a.nivel;
    grupos.set(a.reglaCodigo, g);
  }
  const gruposAlertas = [...grupos.values()]
    .map((g) => ({ ...g, items: g.items.sort((x, y) => NIVEL_ALERTA_PESO[y.nivel] - NIVEL_ALERTA_PESO[x.nivel]).slice(0, 5) }))
    .sort((a, b) => NIVEL_ALERTA_PESO[b.nivelMax] - NIVEL_ALERTA_PESO[a.nivelMax] || b.total - a.total);

  return {
    periodo,
    resumen,
    tendencia,
    porVerificar: porVerificar[0],
    porConciliar: porConciliar[0],
    morosos: morosos[0],
    totalAlertas: activas.length,
    alertasRojas: activas.filter((a) => a.nivel === "rojo").length,
    gruposAlertas,
    recordatorios: proximos,
  };
}
