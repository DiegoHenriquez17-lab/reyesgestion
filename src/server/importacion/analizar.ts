import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { alumnoResponsables, alumnos, buses, mensualidades, personas, servicios } from "@/server/db/schema";
import { leerConfig } from "@/server/configuracion";
import { buscarPersonaPorRut, posiblesDuplicados } from "@/server/modulos/personas";
import { pagosSimilares } from "@/server/modulos/pagos";
import { sugerirConciliacion } from "@/server/modulos/conciliacion";
import { resolverBus, resolverServicio } from "@/server/modulos/catalogos";
import { normalizarRut, rutEsValido } from "@/lib/rut";
import { parsearFecha, aPeriodo } from "@/lib/fechas";
import { formatearPeriodo, formatearPesos, indiceMes, nombreCompleto, parsearMonto } from "@/lib/formato";
import { capitalizarNombre, coincidenciaNombres, normalizarTexto, separarNombre } from "@/lib/texto";
import { NO_IDENTIFICADO, type AccionFila, type DecisionFila, type MedioPago } from "@/lib/constantes";

export type Confianzas = Record<string, "alta" | "media" | "baja">;

export type ResultadoAnalisis = {
  datos: Record<string, unknown>;
  accion: AccionFila;
  registroExistenteId: number | null;
  registroExistente: Record<string, unknown> | null;
  diferencias: { campo: string; actual: unknown; nuevo: unknown }[];
  advertencias: string[];
  decision: DecisionFila | null;
};

const vacio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const texto = (v: unknown) => (vacio(v) ? null : String(v).trim());

/** Aplica el mapeo columna → campo a una fila original. */
export function aplicarMapeo(original: Record<string, unknown>, mapeo: Record<string, string | null>) {
  const salida: Record<string, unknown> = {};
  for (const [col, campo] of Object.entries(mapeo)) {
    if (!campo) continue;
    const v = original[col];
    if (vacio(v)) continue;
    // Si dos columnas van al mismo campo, se concatenan (ej. "Nombres" + "Apellidos")
    salida[campo] = vacio(salida[campo]) ? v : `${salida[campo]} ${v}`;
  }
  return salida;
}

function advertenciasDeConfianza(confianzas: Confianzas | undefined, etiquetas: Record<string, string>) {
  if (!confianzas) return [];
  return Object.entries(confianzas)
    .filter(([, n]) => n === "baja")
    .map(([campo]) => `Lectura dudosa en «${etiquetas[campo] ?? campo}»: revisar contra el documento.`);
}

// ───────────────────────────── ALUMNOS ─────────────────────────────

async function analizarFilaAlumnoBase(
  m: Record<string, unknown>,
  contexto: { rutsVistos: Set<string>; confianzas?: Confianzas },
): Promise<ResultadoAnalisis> {
  const adv: string[] = [];
  // Nombre del alumno
  let nombres = texto(m.alumno_nombres);
  let apellidos = texto(m.alumno_apellidos);
  const completo = texto(m.alumno_nombre_completo);
  if (completo && !nombres) ({ nombres, apellidos } = separarNombre(completo));
  if (!nombres) {
    return {
      datos: { original: m },
      accion: "error",
      registroExistenteId: null,
      registroExistente: null,
      diferencias: [],
      advertencias: [`Nombre del alumno: ${NO_IDENTIFICADO}`],
      decision: "omitir",
    };
  }
  nombres = capitalizarNombre(nombres);
  apellidos = capitalizarNombre(apellidos ?? "");

  let rut = null as string | null;
  if (!vacio(m.alumno_rut)) {
    if (rutEsValido(m.alumno_rut)) rut = normalizarRut(m.alumno_rut);
    else adv.push(`RUT del alumno «${m.alumno_rut}» no es válido: se dejará en blanco.`);
  }
  if (rut && contexto.rutsVistos.has(rut)) adv.push(`El RUT ${rut} aparece más de una vez en el archivo.`);
  if (rut) contexto.rutsVistos.add(rut);

  const tarifa = vacio(m.tarifa) ? null : parsearMonto(m.tarifa);
  if (!vacio(m.tarifa) && tarifa === null) adv.push(`Tarifa «${m.tarifa}» no es un monto válido.`);
  const dia = vacio(m.dia_vencimiento) ? null : Number(String(m.dia_vencimiento).replace(/\D/g, ""));

  const bus = vacio(m.bus) ? null : await resolverBus(m.bus);
  if (!vacio(m.bus) && !bus) adv.push(`El bus «${m.bus}» no existe en el sistema. Créalo en el menú Flota y servicios → Buses y vuelve a analizar, o quedará sin bus.`);
  const servicio = vacio(m.servicio) ? null : await resolverServicio(m.servicio);
  if (!vacio(m.servicio) && !servicio) adv.push(`El servicio «${m.servicio}» no existe. Créalo en el menú Flota y servicios → Servicios o quedará sin servicio.`);

  let apoderado: Record<string, unknown> | null = null;
  const nombreAp = texto(m.apoderado_nombre);
  if (nombreAp) {
    const sep = separarNombre(nombreAp);
    let rutAp: string | null = null;
    if (!vacio(m.apoderado_rut)) {
      if (rutEsValido(m.apoderado_rut)) rutAp = normalizarRut(m.apoderado_rut);
      else adv.push(`RUT del apoderado «${m.apoderado_rut}» no es válido: se dejará en blanco.`);
    }
    apoderado = {
      nombres: capitalizarNombre(sep.nombres),
      apellidos: capitalizarNombre(sep.apellidos),
      rut: rutAp,
      telefono: texto(m.apoderado_telefono),
      email: texto(m.apoderado_email)?.toLowerCase() ?? null,
      parentesco: texto(m.apoderado_parentesco),
    };
  } else if (!vacio(m.apoderado_telefono) || !vacio(m.apoderado_rut)) {
    adv.push(`Hay datos del apoderado pero falta su nombre: ${NO_IDENTIFICADO}.`);
  }

  const datos = {
    persona: { nombres, apellidos, rut, direccion: texto(m.direccion), comuna: texto(m.comuna) },
    alumno: {
      establecimiento: texto(m.establecimiento),
      curso: texto(m.curso),
      busId: bus?.id ?? null,
      busTexto: texto(m.bus),
      servicioId: servicio?.id ?? null,
      servicioTexto: texto(m.servicio),
      tarifaMensual: tarifa,
      diaVencimiento: dia && dia >= 1 && dia <= 31 ? dia : null,
      observaciones: texto(m.observaciones),
    },
    apoderado,
    confianzas: contexto.confianzas ?? null,
  };
  adv.push(
    ...advertenciasDeConfianza(contexto.confianzas, {
      alumno_nombre_completo: "Nombre del alumno",
      alumno_rut: "RUT del alumno",
      tarifa: "Tarifa",
      bus: "Bus",
      apoderado_nombre: "Apoderado",
      apoderado_rut: "RUT del apoderado",
      apoderado_telefono: "Teléfono",
    }),
  );

  // Datos que no se pudieron interpretar: el usuario debe revisarlos antes de guardar
  const dudoso = (!vacio(m.tarifa) && tarifa === null) || Object.values(contexto.confianzas ?? {}).includes("baja");

  // ¿Ya existe?
  const candidatos = await posiblesDuplicados({ nombres, apellidos, rut }, { limite: 3 });
  if (candidatos.length === 0) {
    return dudoso
      ? { datos, accion: "requiere_revision", registroExistenteId: null, registroExistente: null, diferencias: [], advertencias: adv, decision: null }
      : { datos, accion: "crear", registroExistenteId: null, registroExistente: null, diferencias: [], advertencias: adv, decision: "crear" };
  }
  const mejor = candidatos[0];
  const ficha = await fichaComparable(mejor.persona.id);
  // Mismo RUT pero nombre distinto = conflicto: nunca se actualiza automáticamente
  const nombreArchivo = `${nombres} ${apellidos}`;
  const conflictoRut = mejor.motivo === "Mismo RUT" && coincidenciaNombres(nombreArchivo, nombreCompleto(mejor.persona)) < 0.5;
  if (conflictoRut) {
    return {
      datos: { ...datos, persona: { ...datos.persona, rut: null } },
      accion: "posible_duplicado",
      registroExistenteId: ficha.alumno?.id ?? null,
      registroExistente: ficha.resumen,
      diferencias: [{ campo: "Nombre", actual: nombreCompleto(mejor.persona), nuevo: nombreArchivo }],
      advertencias: [
        ...adv,
        `CONFLICTO: el RUT ${rut} ya pertenece a ${nombreCompleto(mejor.persona)}, pero el archivo dice «${nombreArchivo}». Revisa cuál es correcto. Si eliges «Crear como nuevo», se creará sin RUT.`,
      ],
      decision: null,
    };
  }
  const seguro = mejor.motivo === "Mismo RUT";

  if (!ficha.alumno) {
    if (seguro) {
      adv.push(`${nombreCompleto(mejor.persona)} ya existe en el sistema (sin ficha de alumno): se creará su ficha usando la persona existente.`);
      return {
        datos: { ...datos, personaExistenteId: mejor.persona.id },
        accion: "crear",
        registroExistenteId: null,
        registroExistente: ficha.resumen,
        diferencias: [],
        advertencias: adv,
        decision: "crear",
      };
    }
    return {
      datos: { ...datos, personaExistenteId: mejor.persona.id },
      accion: "posible_duplicado",
      registroExistenteId: null,
      registroExistente: ficha.resumen,
      diferencias: [],
      advertencias: [...adv, `Posible persona existente: ${nombreCompleto(mejor.persona)} (${mejor.motivo}).`],
      decision: null,
    };
  }

  const diferencias = compararAlumno(ficha, datos);
  if (seguro || mejor.motivo === "Mismo nombre") {
    if (diferencias.length === 0) {
      return { datos, accion: "sin_cambios", registroExistenteId: ficha.alumno.id, registroExistente: ficha.resumen, diferencias, advertencias: adv, decision: "omitir" };
    }
    if (seguro) {
      return { datos, accion: "actualizar", registroExistenteId: ficha.alumno.id, registroExistente: ficha.resumen, diferencias, advertencias: adv, decision: "actualizar" };
    }
  }
  return {
    datos,
    accion: "posible_duplicado",
    registroExistenteId: ficha.alumno.id,
    registroExistente: ficha.resumen,
    diferencias,
    advertencias: [...adv, `Posible registro existente (${mejor.motivo}).`],
    decision: null,
  };
}

async function fichaComparable(personaId: number) {
  const [p] = await db.select().from(personas).where(eq(personas.id, personaId));
  const [a] = await db
    .select({ alumno: alumnos, busNumero: buses.numero, servicioNombre: servicios.nombre })
    .from(alumnos)
    .leftJoin(buses, eq(buses.id, alumnos.busId))
    .leftJoin(servicios, eq(servicios.id, alumnos.servicioId))
    .where(and(eq(alumnos.personaId, personaId), isNull(alumnos.eliminadoEn)));
  const resp = a
    ? await db
        .select({ nombres: personas.nombres, apellidos: personas.apellidos, rut: personas.rut, telefono: personas.telefono, esTitular: alumnoResponsables.esTitular })
        .from(alumnoResponsables)
        .innerJoin(personas, eq(personas.id, alumnoResponsables.personaId))
        .where(eq(alumnoResponsables.alumnoId, a.alumno.id))
    : [];
  const titular = resp.sort((x, y) => Number(y.esTitular) - Number(x.esTitular))[0];
  return {
    persona: p,
    alumno: a?.alumno ?? null,
    responsables: resp,
    resumen: {
      personaId: p.id,
      alumnoId: a?.alumno.id ?? null,
      nombre: nombreCompleto(p),
      rut: p.rut,
      direccion: p.direccion,
      bus: a?.busNumero ?? null,
      servicio: a?.servicioNombre ?? null,
      tarifa: a?.alumno.tarifaMensual ?? null,
      establecimiento: a?.alumno.establecimiento ?? null,
      curso: a?.alumno.curso ?? null,
      apoderado: titular ? nombreCompleto(titular) : null,
    } as Record<string, unknown>,
  };
}

function compararAlumno(
  ficha: Awaited<ReturnType<typeof fichaComparable>>,
  datos: { persona: Record<string, unknown>; alumno: Record<string, unknown>; apoderado: Record<string, unknown> | null },
) {
  const dif: { campo: string; actual: unknown; nuevo: unknown }[] = [];
  const comparar = (campo: string, actual: unknown, nuevo: unknown, mostrarNuevo: unknown = nuevo) => {
    if (vacio(nuevo)) return;
    if (normalizarTexto(actual) !== normalizarTexto(nuevo)) dif.push({ campo, actual: actual ?? null, nuevo: mostrarNuevo });
  };
  comparar("RUT", ficha.persona.rut, datos.persona.rut);
  comparar("Domicilio", ficha.persona.direccion, datos.persona.direccion);
  comparar("Comuna", ficha.persona.comuna, datos.persona.comuna);
  comparar("Colegio", ficha.alumno?.establecimiento, datos.alumno.establecimiento);
  comparar("Curso", ficha.alumno?.curso, datos.alumno.curso);
  if (datos.alumno.busId) comparar("Bus", ficha.resumen.bus, datos.alumno.busTexto);
  if (datos.alumno.servicioId) comparar("Servicio", ficha.resumen.servicio, datos.alumno.servicioTexto);
  if (datos.alumno.tarifaMensual !== null && datos.alumno.tarifaMensual !== ficha.alumno?.tarifaMensual) {
    dif.push({ campo: "Tarifa mensual", actual: formatearPesos(ficha.alumno?.tarifaMensual ?? 0), nuevo: formatearPesos(Number(datos.alumno.tarifaMensual)) });
  }
  if (datos.apoderado) {
    const nombreNuevo = `${datos.apoderado.nombres} ${datos.apoderado.apellidos}`.trim();
    const yaEsta = ficha.responsables.some(
      (r) => (datos.apoderado!.rut && r.rut === datos.apoderado!.rut) || normalizarTexto(nombreCompleto(r)) === normalizarTexto(nombreNuevo),
    );
    if (!yaEsta) dif.push({ campo: "Apoderado", actual: ficha.resumen.apoderado, nuevo: nombreNuevo });
  }
  return dif;
}

// ───────────────────────────── PAGOS ─────────────────────────────

function parsearMedio(v: unknown): MedioPago {
  const t = normalizarTexto(v);
  if (/efectivo|caja/.test(t)) return "efectivo";
  if (/deposito/.test(t)) return "deposito";
  if (/cheque/.test(t)) return "cheque";
  if (/tarjeta|debito|credito|webpay|redcompra/.test(t)) return "tarjeta";
  if (!t || /transf|tef|banco/.test(t)) return "transferencia";
  return "otro";
}

function parsearPeriodoTexto(v: unknown, fechaPago: string | null): string | null {
  if (vacio(v)) return null;
  const s = String(v).trim();
  const directo = aPeriodo(s);
  if (directo) return directo;
  let m = /^(\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) return aPeriodo(`${m[2]}-${m[1].padStart(2, "0")}`);
  m = /^([a-záéíóúñ]+)\s*(?:de\s*)?(\d{4})?$/i.exec(s);
  if (m) {
    const mes = indiceMes(m[1]);
    const anio = m[2] ?? fechaPago?.slice(0, 4);
    if (mes && anio) return `${anio}-${String(mes).padStart(2, "0")}-01`;
  }
  return null;
}

export async function analizarFilaPago(
  m: Record<string, unknown>,
  contexto: { confianzas?: Confianzas; operacionesVistas: Set<string> },
): Promise<ResultadoAnalisis> {
  const adv: string[] = [];
  const fechaPago = parsearFecha(m.fecha_pago);
  const monto = parsearMonto(m.monto);
  if (!fechaPago) adv.push(`Fecha de pago: ${vacio(m.fecha_pago) ? NO_IDENTIFICADO : `«${m.fecha_pago}» no es una fecha clara`}.`);
  if (monto === null || monto <= 0) adv.push(`Monto: ${vacio(m.monto) ? NO_IDENTIFICADO : `«${m.monto}» no es un monto válido`}.`);

  let rutOrigen: string | null = null;
  if (!vacio(m.rut_origen)) {
    if (rutEsValido(m.rut_origen)) rutOrigen = normalizarRut(m.rut_origen);
    else adv.push(`RUT de origen «${m.rut_origen}» no es válido.`);
  }
  const numeroOperacion = texto(m.numero_operacion);
  if (numeroOperacion && contexto.operacionesVistas.has(numeroOperacion)) adv.push(`El N° de operación ${numeroOperacion} se repite en el archivo.`);
  if (numeroOperacion) contexto.operacionesVistas.add(numeroOperacion);

  const nombreOrigen = texto(m.nombre_origen);
  const datos: Record<string, unknown> = {
    fechaPago,
    monto,
    nombreOrigen,
    rutOrigen,
    banco: texto(m.banco),
    numeroOperacion,
    medio: parsearMedio(m.medio),
    observaciones: [texto(m.descripcion), texto(m.observaciones)].filter(Boolean).join(" — ") || null,
    alumnoTexto: texto(m.alumno_nombre),
    periodo: parsearPeriodoTexto(m.periodo, fechaPago),
    confianzas: contexto.confianzas ?? null,
    sugerencia: null,
    conciliar: false,
  };
  adv.push(
    ...advertenciasDeConfianza(contexto.confianzas, {
      fecha_pago: "Fecha",
      monto: "Monto",
      nombre_origen: "Nombre de quien paga",
      numero_operacion: "N° de operación",
      rut_origen: "RUT",
    }),
  );

  if (!fechaPago || monto === null || monto <= 0) {
    return { datos, accion: "requiere_revision", registroExistenteId: null, registroExistente: null, diferencias: [], advertencias: adv, decision: null };
  }

  const similares = await pagosSimilares({ numeroOperacion, monto, fechaPago, nombreOrigen });
  if (similares.length) {
    const s = similares[0];
    return {
      datos,
      accion: "posible_duplicado",
      registroExistenteId: s.id,
      registroExistente: { id: s.id, fecha: s.fechaPago, monto: s.monto, nombre: s.nombreOrigen, operacion: s.numeroOperacion },
      diferencias: [],
      advertencias: [...adv, `Posible pago ya registrado: #${s.id} ${formatearPesos(s.monto)} del ${s.fechaPago}.`],
      decision: "omitir",
    };
  }

  // Sugerencia de conciliación (solo sugerencia: el usuario decide)
  const preseleccion = Number(await leerConfig("conciliacion.coincidencia_minima"));
  let sugerencia: Awaited<ReturnType<typeof sugerirConciliacion>>[number] | null = null;
  if (datos.alumnoTexto) {
    const sim = sql<number>`similarity(${personas.textoBusqueda}, ${normalizarTexto(datos.alumnoTexto)})`;
    const [al] = await db
      .select({ id: alumnos.id, nombres: personas.nombres, apellidos: personas.apellidos, sim })
      .from(alumnos)
      .innerJoin(personas, eq(personas.id, alumnos.personaId))
      .where(and(isNull(alumnos.eliminadoEn), sql`${sim} > 0.5`))
      .orderBy(desc(sim))
      .limit(1);
    if (al) {
      const lista = await sugerirConciliacion({ monto, montoAplicado: 0, nombreOrigen, rutOrigen, pagadorId: null, alumnoId: al.id });
      sugerencia = lista.find((s) => s.alumnoId === al.id) ?? null;
      if (sugerencia) sugerencia.razones.unshift(`El documento indica el alumno «${datos.alumnoTexto}»`);
    }
  } else {
    sugerencia = (await sugerirConciliacion({ monto, montoAplicado: 0, nombreOrigen, rutOrigen, pagadorId: null, alumnoId: null }))[0] ?? null;
  }
  // Si el documento indica el mes, se prioriza esa mensualidad
  if (sugerencia && datos.periodo) {
    const [mPeriodo] = await db
      .select()
      .from(mensualidades)
      .where(and(eq(mensualidades.alumnoId, sugerencia.alumnoId), eq(mensualidades.periodo, String(datos.periodo))));
    if (mPeriodo && mPeriodo.monto - mPeriodo.montoPagado > 0) {
      const saldo = mPeriodo.monto - mPeriodo.montoPagado;
      sugerencia.aplicaciones = [{ mensualidadId: mPeriodo.id, monto: Math.min(saldo, monto), periodo: mPeriodo.periodo, saldo }];
      sugerencia.razones.push(`El documento indica el mes ${formatearPeriodo(mPeriodo.periodo)}`);
    }
  }
  if (sugerencia && sugerencia.puntaje < preseleccion) sugerencia = sugerencia.puntaje >= preseleccion * 0.6 ? sugerencia : null;
  datos.sugerencia = sugerencia;
  // Se preselecciona solo si la coincidencia es muy alta y hay meses con saldo; el usuario igual lo revisa
  datos.conciliar = !!sugerencia && sugerencia.puntaje >= 0.9 && sugerencia.aplicaciones.length > 0;
  if (!sugerencia) adv.push("Sin coincidencia clara con un alumno: quedará como PAGO POR CONCILIAR.");

  return { datos, accion: "crear", registroExistenteId: null, registroExistente: null, diferencias: [], advertencias: adv, decision: "crear" };
}

/**
 * Analiza una fila de alumno y además verifica que el RUT del apoderado, si ya existe,
 * corresponda a una persona con el mismo nombre (si no, exige revisión humana).
 */
export async function analizarFilaAlumno(
  m: Record<string, unknown>,
  contexto: { rutsVistos: Set<string>; confianzas?: Confianzas },
): Promise<ResultadoAnalisis> {
  const r = await analizarFilaAlumnoBase(m, contexto);
  const ap = r.datos.apoderado as { nombres: string; apellidos: string; rut: string | null } | null | undefined;
  if (ap?.rut) {
    const existente = await buscarPersonaPorRut(ap.rut);
    const nombreArchivo = `${ap.nombres} ${ap.apellidos}`;
    if (existente && coincidenciaNombres(nombreArchivo, nombreCompleto(existente)) < 0.5) {
      r.advertencias.push(
        `CONFLICTO: el RUT del apoderado ${ap.rut} pertenece a ${nombreCompleto(existente)}, pero el archivo dice «${nombreArchivo}». Revisa antes de guardar.`,
      );
      if (r.accion === "crear" || r.accion === "actualizar") r.accion = "requiere_revision";
      r.decision = null;
    }
  }
  return r;
}
