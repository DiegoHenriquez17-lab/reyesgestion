import "server-only";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { DbOTx } from "@/server/db";
import {
  alumnos,
  cierresMes,
  devoluciones,
  mensualidades,
  pagos,
  personas,
  recordatorios,
  type reglasAlerta,
} from "@/server/db/schema";
import { leerConfig } from "@/server/configuracion";
import { diferenciaDias, fechaVencimiento, inicioDeMes, sumarDias, sumarMeses } from "@/lib/fechas";
import { formatearPeriodo, formatearPesos, nombreCompleto } from "@/lib/formato";
import type { Modulo, NivelAlerta } from "@/lib/constantes";
import { nivelDeParametro, nivelPorUmbral, textoPlazo } from "./umbrales";

export type AlertaCandidata = {
  clave: string;
  reglaCodigo: string;
  modulo: Modulo;
  nivel: NivelAlerta;
  titulo: string;
  detalle?: string;
  entidadTipo?: string;
  entidadId?: number;
  enlace?: string;
  fechaReferencia?: string;
};

type Regla = typeof reglasAlerta.$inferSelect;
type Generador = (tx: DbOTx, regla: Regla, hoy: string) => Promise<AlertaCandidata[]>;

const base = (regla: Regla, entidadTipo: string, entidadId: number) => ({
  clave: `${regla.codigo}:${entidadTipo}:${entidadId}`,
  reglaCodigo: regla.codigo,
  modulo: regla.modulo,
  entidadTipo,
  entidadId,
});

/** Mensualidades pendientes/parciales con su alumno. */
async function mensualidadesAbiertas(tx: DbOTx) {
  return tx
    .select({
      id: mensualidades.id,
      alumnoId: mensualidades.alumnoId,
      periodo: mensualidades.periodo,
      monto: mensualidades.monto,
      montoPagado: mensualidades.montoPagado,
      estado: mensualidades.estado,
      fechaVencimiento: mensualidades.fechaVencimiento,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
    })
    .from(mensualidades)
    .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .where(and(inArray(mensualidades.estado, ["pendiente", "parcial"]), isNull(alumnos.eliminadoEn)));
}

const GENERADORES: Record<string, Generador> = {
  "pagos.mensualidad": async (tx, regla, hoy) => {
    const filas = await mensualidadesAbiertas(tx);
    const salida: AlertaCandidata[] = [];
    for (const m of filas) {
      const dias = diferenciaDias(hoy, m.fechaVencimiento);
      const nivel = nivelPorUmbral(dias, regla.umbrales);
      if (!nivel) continue;
      const saldo = m.monto - m.montoPagado;
      salida.push({
        ...base(regla, "mensualidad", m.id),
        nivel,
        titulo: `Mensualidad ${textoPlazo(dias)}`,
        detalle: `${nombreCompleto(m)} — ${formatearPeriodo(m.periodo)} — saldo ${formatearPesos(saldo)}`,
        enlace: `/alumnos/${m.alumnoId}`,
        fechaReferencia: m.fechaVencimiento,
      });
    }
    return salida;
  },

  "pagos.meses_consecutivos": async (tx, regla, hoy) => {
    const minimo = Number(regla.parametros.meses ?? 2);
    const nivel = nivelDeParametro(regla.parametros.nivel, "rojo");
    const filas = (await mensualidadesAbiertas(tx)).filter((m) => m.fechaVencimiento < hoy);
    const porAlumno = new Map<number, typeof filas>();
    for (const m of filas) porAlumno.set(m.alumnoId, [...(porAlumno.get(m.alumnoId) ?? []), m]);
    const salida: AlertaCandidata[] = [];
    for (const [alumnoId, lista] of porAlumno) {
      const periodos = lista.map((m) => m.periodo).sort();
      // racha más larga de meses consecutivos
      let racha = 1;
      let mejor = 1;
      for (let i = 1; i < periodos.length; i++) {
        racha = sumarMeses(periodos[i - 1], 1) === periodos[i] ? racha + 1 : 1;
        mejor = Math.max(mejor, racha);
      }
      if (mejor < minimo) continue;
      const deuda = lista.reduce((s, m) => s + m.monto - m.montoPagado, 0);
      salida.push({
        ...base(regla, "alumno", alumnoId),
        nivel,
        titulo: `${mejor} meses consecutivos pendientes`,
        detalle: `${nombreCompleto(lista[0])} — deuda vencida ${formatearPesos(deuda)} (${periodos.map(formatearPeriodo).join(", ")})`,
        enlace: `/alumnos/${alumnoId}`,
      });
    }
    return salida;
  },

  "pagos.pago_parcial": async (tx, regla) => {
    const nivel = nivelDeParametro(regla.parametros.nivel, "amarillo");
    const filas = (await mensualidadesAbiertas(tx)).filter((m) => m.estado === "parcial");
    return filas.map((m) => ({
      ...base(regla, "mensualidad", m.id),
      nivel,
      titulo: "Pago parcial",
      detalle: `${nombreCompleto(m)} — ${formatearPeriodo(m.periodo)} — pagado ${formatearPesos(m.montoPagado)} de ${formatearPesos(m.monto)}`,
      enlace: `/alumnos/${m.alumnoId}`,
      fechaReferencia: m.fechaVencimiento,
    }));
  },

  "pagos.por_verificar": async (tx, regla, hoy) => {
    const filas = await tx
      .select({ id: pagos.id, monto: pagos.monto, nombreOrigen: pagos.nombreOrigen, creadoEn: pagos.creadoEn })
      .from(pagos)
      .where(and(eq(pagos.estadoVerificacion, "por_verificar"), isNull(pagos.anuladoEn)));
    const salida: AlertaCandidata[] = [];
    for (const p of filas) {
      const ref = p.creadoEn.toISOString().slice(0, 10);
      const nivel = nivelPorUmbral(diferenciaDias(hoy, ref), regla.umbrales);
      if (!nivel) continue;
      salida.push({
        ...base(regla, "pago", p.id),
        nivel,
        titulo: "Pago por verificar",
        detalle: `${formatearPesos(p.monto)} — ${p.nombreOrigen ?? "origen no identificado"}`,
        enlace: `/pagos/${p.id}`,
        fechaReferencia: ref,
      });
    }
    return salida;
  },

  "pagos.por_conciliar": async (tx, regla, hoy) => {
    const filas = await tx
      .select({
        id: pagos.id,
        monto: pagos.monto,
        montoAplicado: pagos.montoAplicado,
        nombreOrigen: pagos.nombreOrigen,
        fechaPago: pagos.fechaPago,
      })
      .from(pagos)
      .where(and(eq(pagos.estadoVerificacion, "verificado"), ne(pagos.estadoConciliacion, "conciliado"), isNull(pagos.anuladoEn)));
    const salida: AlertaCandidata[] = [];
    for (const p of filas) {
      const nivel = nivelPorUmbral(diferenciaDias(hoy, p.fechaPago), regla.umbrales);
      if (!nivel) continue;
      salida.push({
        ...base(regla, "pago", p.id),
        nivel,
        titulo: "Pago por conciliar",
        detalle: `${formatearPesos(p.monto - p.montoAplicado)} sin asignar — ${p.nombreOrigen ?? "origen no identificado"}`,
        enlace: `/pagos/${p.id}`,
        fechaReferencia: p.fechaPago,
      });
    }
    return salida;
  },

  "pagos.deuda_antigua": async (tx, regla, hoy) => {
    const dias = Number(regla.parametros.dias ?? 90);
    const nivel = nivelDeParametro(regla.parametros.nivel, "rojo");
    const limite = sumarDias(hoy, -dias);
    const filas = (await mensualidadesAbiertas(tx)).filter((m) => m.fechaVencimiento < limite);
    const porAlumno = new Map<number, { nombre: string; deuda: number; desde: string }>();
    for (const m of filas) {
      const a = porAlumno.get(m.alumnoId) ?? { nombre: nombreCompleto(m), deuda: 0, desde: m.periodo };
      a.deuda += m.monto - m.montoPagado;
      if (m.periodo < a.desde) a.desde = m.periodo;
      porAlumno.set(m.alumnoId, a);
    }
    return [...porAlumno].map(([alumnoId, a]) => ({
      ...base(regla, "alumno", alumnoId),
      nivel,
      titulo: `Deuda con más de ${dias} días`,
      detalle: `${a.nombre} — ${formatearPesos(a.deuda)} desde ${formatearPeriodo(a.desde)}`,
      enlace: `/alumnos/${alumnoId}`,
    }));
  },

  "pagos.devolucion_pendiente": async (tx, regla, hoy) => {
    const filas = await tx.select().from(devoluciones).where(eq(devoluciones.estado, "pendiente"));
    const salida: AlertaCandidata[] = [];
    for (const d of filas) {
      const nivel = nivelPorUmbral(diferenciaDias(hoy, d.fechaSolicitud), regla.umbrales);
      if (!nivel) continue;
      salida.push({
        ...base(regla, "devolucion", d.id),
        nivel,
        titulo: "Devolución pendiente",
        detalle: `${formatearPesos(d.monto)} — ${d.motivo}`,
        enlace: d.alumnoId ? `/alumnos/${d.alumnoId}` : "/pagos",
        fechaReferencia: d.fechaSolicitud,
      });
    }
    return salida;
  },

  "pagos.mensualidades_sin_generar": async (tx, regla, hoy) => {
    const meses = await leerConfig("cobranza.meses_cobro", tx);
    const periodo = inicioDeMes(hoy);
    if (!meses.includes(Number(periodo.slice(5, 7)))) return [];
    const [fila] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(alumnos)
      .where(
        and(
          eq(alumnos.estado, "activo"),
          isNull(alumnos.eliminadoEn),
          sql`${alumnos.tarifaMensual} > 0`,
          sql`not exists (select 1 from ${mensualidades} m where m.alumno_id = ${alumnos.id} and m.periodo = ${periodo})`,
        ),
      );
    if (!fila || fila.total === 0) return [];
    return [
      {
        clave: `${regla.codigo}:periodo:${periodo}`,
        reglaCodigo: regla.codigo,
        modulo: regla.modulo,
        nivel: nivelDeParametro(regla.parametros.nivel, "amarillo"),
        titulo: `Faltan mensualidades de ${formatearPeriodo(periodo)}`,
        detalle: `${fila.total} alumno(s) activo(s) sin mensualidad generada para este mes.`,
        enlace: `/mensualidades?periodo=${periodo.slice(0, 7)}`,
        fechaReferencia: periodo,
      },
    ];
  },

  "pagos.cierre_mes": async (tx, regla, hoy) => {
    const anterior = sumarMeses(inicioDeMes(hoy), -1);
    const [cerrado] = await tx
      .select({ id: cierresMes.id })
      .from(cierresMes)
      .where(and(eq(cierresMes.periodo, anterior), eq(cierresMes.estado, "cerrado")));
    if (cerrado) return [];
    const [hayDatos] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(mensualidades)
      .where(eq(mensualidades.periodo, anterior));
    if (!hayDatos || hayDatos.total === 0) return [];
    const limite = fechaVencimiento(inicioDeMes(hoy), Number(regla.parametros.dia_limite ?? 10));
    const dias = diferenciaDias(hoy, limite);
    const nivel = nivelPorUmbral(dias, regla.umbrales);
    if (!nivel) return [];
    return [
      {
        clave: `${regla.codigo}:periodo:${anterior}`,
        reglaCodigo: regla.codigo,
        modulo: regla.modulo,
        nivel,
        titulo: `Cierre de ${formatearPeriodo(anterior)} pendiente`,
        detalle: `Plazo sugerido: ${textoPlazo(dias, "vence", "vencido")}.`,
        enlace: `/cierres`,
        fechaReferencia: limite,
      },
    ];
  },

  "general.recordatorio": async (tx, regla, hoy) => {
    const filas = await tx.select().from(recordatorios).where(eq(recordatorios.estado, "pendiente"));
    const salida: AlertaCandidata[] = [];
    for (const r of filas) {
      const dias = diferenciaDias(hoy, r.fecha);
      const nivel = nivelPorUmbral(dias, regla.umbrales);
      if (!nivel) continue;
      salida.push({
        ...base(regla, "recordatorio", r.id),
        nivel,
        titulo: r.titulo,
        detalle: [r.detalle, `Recordatorio: ${textoPlazo(dias, "es", "atrasado")}`].filter(Boolean).join(" — "),
        enlace: "/recordatorios",
        fechaReferencia: r.fecha,
      });
    }
    return salida;
  },
};

export function generadorDe(codigo: string): Generador | undefined {
  return GENERADORES[codigo];
}
