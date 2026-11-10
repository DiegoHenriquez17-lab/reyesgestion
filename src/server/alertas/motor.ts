import "server-only";
import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { alertas, reglasAlerta } from "@/server/db/schema";
import { guardarConfig, leerConfig } from "@/server/configuracion";
import { hoy as hoyServidor } from "@/server/fechas";
import { NIVEL_ALERTA_PESO } from "@/lib/constantes";
import { generadorDe, type AlertaCandidata } from "./generadores";

const CLAVE_ULTIMA_EJECUCION = "alertas.ultima_ejecucion";
const LOCK_ALERTAS = 727_001; // identificador arbitrario del candado de PostgreSQL

export type ResultadoRecalculo = { ejecutado: boolean; nuevas: number; actualizadas: number; resueltas: number };

/**
 * MOTOR DE ALERTAS
 * Evalúa todas las reglas activas y sincroniza la tabla `alertas`:
 *   - crea las nuevas,
 *   - actualiza nivel/texto de las existentes (y reactiva descartadas si empeoran),
 *   - marca como resueltas las que ya no se cumplen (ej: la mensualidad se pagó).
 * Cada módulo nuevo (buses, conductores…) solo debe agregar su generador.
 */
export async function recalcularAlertas(opciones: { forzar?: boolean } = {}): Promise<ResultadoRecalculo> {
  const sinCambios = { ejecutado: false, nuevas: 0, actualizadas: 0, resueltas: 0 };

  if (!opciones.forzar) {
    const intervalo = await leerConfig("alertas.intervalo_minutos");
    const ultima = (await db.query.configuracion.findFirst({
      where: (c, { eq }) => eq(c.clave, CLAVE_ULTIMA_EJECUCION),
    }))?.valor as string | undefined;
    if (ultima && Date.now() - new Date(ultima).getTime() < Number(intervalo) * 60_000) return sinCambios;
  }

  return db.transaction(async (tx) => {
    // Evita que dos recálculos corran al mismo tiempo
    const [{ ok }] = await tx.execute<{ ok: boolean }>(sql`select pg_try_advisory_xact_lock(${LOCK_ALERTAS}) as ok`);
    if (!ok) return sinCambios;

    const hoy = hoyServidor();
    const reglas = await tx.select().from(reglasAlerta);
    const activas = reglas.filter((r) => r.activa && generadorDe(r.codigo));
    const inactivas = reglas.filter((r) => !r.activa).map((r) => r.codigo);

    const candidatas: AlertaCandidata[] = [];
    for (const regla of activas) {
      candidatas.push(...(await generadorDe(regla.codigo)!(tx, regla, hoy)));
    }

    const codigos = activas.map((r) => r.codigo);
    const existentes = codigos.length
      ? await tx.select().from(alertas).where(inArray(alertas.reglaCodigo, codigos))
      : [];
    const porClave = new Map(existentes.map((a) => [a.clave, a]));

    let nuevas = 0;
    let actualizadas = 0;
    const ahora = new Date();
    const aInsertar: (typeof alertas.$inferInsert)[] = [];

    for (const c of candidatas) {
      const e = porClave.get(c.clave);
      if (!e) {
        aInsertar.push({ ...c, estado: "activa", primeraVez: ahora, ultimaVez: ahora });
        nuevas++;
        continue;
      }
      let estado = e.estado;
      if (e.estado === "resuelta") estado = "activa";
      if (e.estado === "pospuesta" && e.pospuestaHasta && e.pospuestaHasta <= hoy) estado = "activa";
      if (
        e.estado === "descartada" &&
        e.nivelDescartado &&
        NIVEL_ALERTA_PESO[c.nivel] > NIVEL_ALERTA_PESO[e.nivelDescartado]
      )
        estado = "activa";

      const cambio =
        estado !== e.estado ||
        c.nivel !== e.nivel ||
        c.titulo !== e.titulo ||
        (c.detalle ?? null) !== e.detalle ||
        (c.enlace ?? null) !== e.enlace;
      if (!cambio) continue;
      await tx
        .update(alertas)
        .set({
          nivel: c.nivel,
          titulo: c.titulo,
          detalle: c.detalle ?? null,
          enlace: c.enlace ?? null,
          fechaReferencia: c.fechaReferencia ?? null,
          estado,
          ultimaVez: ahora,
          ...(e.estado === "resuelta" ? { primeraVez: ahora, resueltaEn: null } : {}),
        })
        .where(eq(alertas.id, e.id));
      actualizadas++;
    }

    for (let i = 0; i < aInsertar.length; i += 500) {
      await tx.insert(alertas).values(aInsertar.slice(i, i + 500));
    }

    // Resolver las que ya no se cumplen + las de reglas desactivadas
    const clavesVigentes = candidatas.map((c) => c.clave);
    let resueltas = 0;
    if (codigos.length) {
      const r = await tx
        .update(alertas)
        .set({ estado: "resuelta", resueltaEn: ahora })
        .where(
          and(
            inArray(alertas.reglaCodigo, codigos),
            ne(alertas.estado, "resuelta"),
            clavesVigentes.length ? notInArray(alertas.clave, clavesVigentes) : undefined,
          ),
        )
        .returning({ id: alertas.id });
      resueltas += r.length;
    }
    if (inactivas.length) {
      const r = await tx
        .update(alertas)
        .set({ estado: "resuelta", resueltaEn: ahora })
        .where(and(inArray(alertas.reglaCodigo, inactivas), ne(alertas.estado, "resuelta")))
        .returning({ id: alertas.id });
      resueltas += r.length;
    }

    await guardarConfig(CLAVE_ULTIMA_EJECUCION, ahora.toISOString(), null, tx);
    return { ejecutado: true, nuevas, actualizadas, resueltas };
  });
}
