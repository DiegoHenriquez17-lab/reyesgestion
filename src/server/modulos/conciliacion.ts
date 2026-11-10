import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { alumnoResponsables, alumnos, mensualidades, personaAlias, personas } from "@/server/db/schema";
import { leerConfig } from "@/server/configuracion";
import { coincidenciaNombres, normalizarTexto, palabras } from "@/lib/texto";
import { formatearPeriodo, formatearPesos, nombreCompleto } from "@/lib/formato";
import type { Aplicacion } from "./pagos";

export type Sugerencia = {
  alumnoId: number;
  alumnoNombre: string;
  titular: string | null;
  puntaje: number;
  razones: string[];
  aplicaciones: (Aplicacion & { periodo: string; saldo: number })[];
  pagadorPersonaId: number | null;
};

/**
 * Propone a qué alumno y mes(es) podría corresponder un pago.
 * IMPORTANTE: solo SUGIERE con sus razones. Nunca concilia por sí misma;
 * si no hay coincidencia suficiente, el pago queda "por conciliar" para asignación manual.
 */
export async function sugerirConciliacion(pago: {
  monto: number;
  montoAplicado: number;
  nombreOrigen: string | null;
  rutOrigen: string | null;
  pagadorId: number | null;
  alumnoId: number | null;
}): Promise<Sugerencia[]> {
  const minimo = Number(await leerConfig("conciliacion.coincidencia_minima"));
  const disponible = pago.monto - pago.montoAplicado;

  const listaAlumnos = await db
    .select({ id: alumnos.id, personaId: alumnos.personaId, nombres: personas.nombres, apellidos: personas.apellidos, rut: personas.rut })
    .from(alumnos)
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .where(isNull(alumnos.eliminadoEn));
  if (listaAlumnos.length === 0) return [];

  const responsables = await db
    .select({
      alumnoId: alumnoResponsables.alumnoId,
      personaId: personas.id,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      rut: personas.rut,
      esTitular: alumnoResponsables.esTitular,
      esPagador: alumnoResponsables.esPagador,
    })
    .from(alumnoResponsables)
    .innerJoin(personas, eq(personas.id, alumnoResponsables.personaId));
  const alias = await db.select().from(personaAlias);

  const nombreOrigen = normalizarTexto(pago.nombreOrigen);
  const palabrasOrigen = palabras(pago.nombreOrigen);

  const puntajes = new Map<number, { puntaje: number; razones: string[]; pagadorPersonaId: number | null }>();
  const sumar = (alumnoId: number, puntos: number, razon: string, pagadorPersonaId: number | null = null) => {
    const actual = puntajes.get(alumnoId) ?? { puntaje: 0, razones: [], pagadorPersonaId: null };
    actual.puntaje = Math.max(actual.puntaje, puntos) + (actual.puntaje > 0 ? 0.05 : 0);
    actual.razones.push(razon);
    if (pagadorPersonaId && !actual.pagadorPersonaId) actual.pagadorPersonaId = pagadorPersonaId;
    puntajes.set(alumnoId, actual);
  };

  if (pago.alumnoId) sumar(pago.alumnoId, 1, "Alumno indicado en el pago");

  for (const r of responsables) {
    if (pago.pagadorId && r.personaId === pago.pagadorId) sumar(r.alumnoId, 0.95, `Pagador registrado: ${nombreCompleto(r)}`, r.personaId);
    if (pago.rutOrigen && r.rut === pago.rutOrigen) sumar(r.alumnoId, 0.95, `RUT del origen coincide con ${nombreCompleto(r)}`, r.personaId);
    if (nombreOrigen) {
      const c = coincidenciaNombres(pago.nombreOrigen, nombreCompleto(r));
      if (c >= 0.75) sumar(r.alumnoId, 0.6 + c * 0.3, `Nombre coincide con ${r.esTitular ? "apoderado titular" : r.esPagador ? "pagador" : "apoderado"} ${nombreCompleto(r)}`, r.personaId);
    }
  }

  // Alias aprendidos de conciliaciones anteriores
  if (nombreOrigen) {
    for (const a of alias) {
      if (normalizarTexto(a.alias) !== nombreOrigen) continue;
      for (const r of responsables.filter((x) => x.personaId === a.personaId)) {
        sumar(r.alumnoId, 0.97, `Nombre ya usado antes por ${nombreCompleto(r)} (pagador conocido)`, r.personaId);
      }
    }
  }

  for (const a of listaAlumnos) {
    if (pago.rutOrigen && a.rut === pago.rutOrigen) sumar(a.id, 0.9, "RUT del origen es el del alumno");
    if (palabrasOrigen.length < 2) continue;
    const c = coincidenciaNombres(pago.nombreOrigen, nombreCompleto(a));
    if (c >= 0.75) sumar(a.id, 0.7, "Nombre coincide con el del alumno");
    // Convención chilena: un apellido del pagador suele ser apellido del alumno (madre/padre)
    const apellidosAlumno = palabras(a.apellidos);
    const comunes = apellidosAlumno.filter((ap) => palabrasOrigen.includes(ap));
    if (comunes.length) {
      sumar(a.id, 0.35 + 0.15 * comunes.length, `Apellido en común con el alumno: ${comunes.join(", ")}`);
    }
  }

  const ids = [...puntajes.keys()];
  if (ids.length === 0) return [];

  const pendientes = await db
    .select()
    .from(mensualidades)
    .where(and(inArray(mensualidades.alumnoId, ids), inArray(mensualidades.estado, ["pendiente", "parcial"])))
    .orderBy(mensualidades.periodo);

  const salida: Sugerencia[] = [];
  for (const [alumnoId, info] of puntajes) {
    const deudas = pendientes.filter((m) => m.alumnoId === alumnoId);
    // Coincidencia exacta de monto con un mes o con la suma de meses consecutivos más antiguos
    let acumulado = 0;
    let exacto = false;
    for (const m of deudas) {
      acumulado += m.monto - m.montoPagado;
      if (acumulado === disponible) {
        exacto = true;
        break;
      }
    }
    const mismoMonto = deudas.find((m) => m.monto - m.montoPagado === disponible);
    if (deudas.length === 0) {
      // Sin deuda no hay dónde aplicar el pago: baja la prioridad (salvo que lo identifique un dato seguro)
      info.puntaje = info.puntaje >= 0.9 ? info.puntaje : info.puntaje * 0.6;
      info.razones.push("No tiene meses con saldo pendiente");
    } else if (mismoMonto) {
      info.puntaje += 0.15;
      info.razones.push(`Monto ${formatearPesos(disponible)} coincide con el saldo de ${formatearPeriodo(mismoMonto.periodo)}`);
    } else if (exacto) {
      info.puntaje += 0.1;
      info.razones.push("Monto coincide con la suma de los meses pendientes más antiguos");
    }

    // Propuesta: si hay un mes con el mismo saldo úsalo; si no, reparte de lo más antiguo a lo más nuevo
    const aplicaciones: Sugerencia["aplicaciones"] = [];
    if (mismoMonto) {
      aplicaciones.push({ mensualidadId: mismoMonto.id, monto: disponible, periodo: mismoMonto.periodo, saldo: disponible });
    } else {
      let restante = disponible;
      for (const m of deudas) {
        if (restante <= 0) break;
        const saldo = m.monto - m.montoPagado;
        const monto = Math.min(saldo, restante);
        aplicaciones.push({ mensualidadId: m.id, monto, periodo: m.periodo, saldo });
        restante -= monto;
      }
    }

    const alumno = listaAlumnos.find((a) => a.id === alumnoId);
    const titular = responsables.filter((r) => r.alumnoId === alumnoId).sort((a, b) => Number(b.esTitular) - Number(a.esTitular))[0];
    salida.push({
      alumnoId,
      alumnoNombre: nombreCompleto(alumno),
      titular: titular ? nombreCompleto(titular) : null,
      puntaje: Math.min(1, Math.round(info.puntaje * 100) / 100),
      razones: [...new Set(info.razones)],
      aplicaciones,
      pagadorPersonaId: info.pagadorPersonaId,
    });
  }

  return salida
    .filter((s) => s.puntaje >= minimo * 0.6 && (s.aplicaciones.length > 0 || s.puntaje >= minimo))
    .sort((a, b) => Number(b.aplicaciones.length > 0) - Number(a.aplicaciones.length > 0) || b.puntaje - a.puntaje)
    .slice(0, 5);
}

/** ¿La sugerencia es suficientemente buena para destacarla como "probable"? */
export async function umbralSugerencia() {
  return Number(await leerConfig("conciliacion.coincidencia_minima"));
}
