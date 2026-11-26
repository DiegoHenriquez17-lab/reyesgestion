import "server-only";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, type DbOTx } from "@/server/db";
import {
  alumnoResponsables,
  alumnos,
  buses,
  cierresMes,
  devoluciones,
  mensualidades,
  pagoAplicaciones,
  pagos,
  personas,
  servicios,
} from "@/server/db/schema";
import { leerConfig } from "@/server/configuracion";
import { entorno } from "@/server/entorno";
import { hoy } from "@/server/fechas";
import { finDeMes, sumarDias, sumarMeses } from "@/lib/fechas";
import { formatearFechaHora, formatearPeriodo, nombreCompleto, nombreMes } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import type { CodigoInforme, FilaInforme, Indicador, Informe, SeccionInforme } from "@/lib/informe";
import { ESTADO_CONCILIACION_ETIQUETA, ESTADO_VERIFICACION_ETIQUETA, MEDIO_PAGO_ETIQUETA } from "@/lib/constantes";
import { listarConductores, listarDocumentosControl, listarMantenciones } from "@/server/modulos/flota";
import { informeOperaciones } from "./operaciones";

const OTROS = "Otros servicios";

async function encabezado(tx: DbOTx = db) {
  return {
    empresa: String(await leerConfig("empresa.nombre", tx)),
    generadoEn: formatearFechaHora(new Date(), entorno.APP_TIMEZONE),
  };
}

const titularSql = sql<string | null>`(select pr.nombres || ' ' || pr.apellidos from ${alumnoResponsables} r
  join ${personas} pr on pr.id = r.persona_id where r.alumno_id = ${alumnos.id} order by r.es_titular desc, r.id limit 1)`;
const telefonoTitularSql = sql<string | null>`(select pr.telefono from ${alumnoResponsables} r
  join ${personas} pr on pr.id = r.persona_id where r.alumno_id = ${alumnos.id} order by r.es_titular desc, r.id limit 1)`;

function agruparPorBus<T extends { busNumero: string | null }>(filas: T[]) {
  const grupos = new Map<string, T[]>();
  for (const f of filas) {
    const clave = f.busNumero ? `Bus ${f.busNumero}` : OTROS;
    grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
  }
  return [...grupos.entries()].sort(([a], [b]) => {
    if (a === OTROS) return 1;
    if (b === OTROS) return -1;
    return a.localeCompare(b, "es", { numeric: true });
  });
}

const sumaCampo = (filas: FilaInforme[], campo: string) => filas.reduce((s, f) => s + Number(f[campo] ?? 0), 0);

/** Totales del periodo (se usan en el informe, el panel y el cierre de mes). */
export async function resumenRecaudacion(periodo: string, tx: DbOTx = db) {
  const filas = await detalleRecaudacion(periodo, tx);
  const esperado = filas.reduce((s, f) => s + f.monto, 0);
  const recaudado = filas.reduce((s, f) => s + f.recaudado, 0);
  const porVerificar = filas.reduce((s, f) => s + f.porVerificar, 0);
  const condonado = filas.filter((f) => f.estado === "condonada").reduce((s, f) => s + f.monto - f.recaudado - f.porVerificar, 0);
  const noRecuperable = filas
    .filter((f) => f.estado === "no_recuperable")
    .reduce((s, f) => s + f.monto - f.recaudado - f.porVerificar, 0);
  const pendiente = filas
    .filter((f) => ["pendiente", "parcial", "pagada"].includes(f.estado))
    .reduce((s, f) => s + Math.max(0, f.monto - f.recaudado - f.porVerificar), 0);
  const parciales = filas.filter((f) => f.estado === "parcial");
  const [dev] = await tx
    .select({ total: sql<number>`coalesce(sum(${devoluciones.monto}), 0)::int` })
    .from(devoluciones)
    .where(
      and(
        ne(devoluciones.estado, "anulada"),
        sql`${devoluciones.fechaSolicitud} between ${periodo} and ${finDeMes(periodo)}`,
      ),
    );
  const [sinConciliar] = await tx
    .select({ total: sql<number>`coalesce(sum(${pagos.monto} - ${pagos.montoAplicado}), 0)::int` })
    .from(pagos)
    .where(
      and(
        isNull(pagos.anuladoEn),
        eq(pagos.estadoVerificacion, "verificado"),
        ne(pagos.estadoConciliacion, "conciliado"),
        sql`${pagos.fechaPago} between ${periodo} and ${finDeMes(periodo)}`,
      ),
    );
  return {
    periodo,
    alumnos: filas.length,
    esperado,
    recaudado,
    porVerificar,
    pendiente,
    parcialesCantidad: parciales.length,
    parcialesSaldo: parciales.reduce((s, f) => s + f.monto - f.recaudado - f.porVerificar, 0),
    devoluciones: dev?.total ?? 0,
    condonado,
    noRecuperable,
    recibidoSinConciliar: sinConciliar?.total ?? 0,
    porcentaje: esperado > 0 ? (recaudado / esperado) * 100 : 0,
  };
}

async function detalleRecaudacion(periodo: string, tx: DbOTx = db) {
  return tx
    .select({
      mensualidadId: mensualidades.id,
      alumnoId: alumnos.id,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      busNumero: buses.numero,
      servicio: servicios.nombre,
      titular: titularSql,
      monto: mensualidades.monto,
      estado: mensualidades.estado,
      recaudado: sql<number>`coalesce(sum(${pagoAplicaciones.monto}) filter (where ${pagos.estadoVerificacion} = 'verificado'), 0)::int`,
      porVerificar: sql<number>`coalesce(sum(${pagoAplicaciones.monto}) filter (where ${pagos.estadoVerificacion} = 'por_verificar'), 0)::int`,
      fechas: sql<string | null>`string_agg(distinct to_char(${pagos.fechaPago}, 'DD/MM'), ', ')`,
    })
    .from(mensualidades)
    .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .leftJoin(buses, eq(buses.id, alumnos.busId))
    .leftJoin(servicios, eq(servicios.id, alumnos.servicioId))
    .leftJoin(pagoAplicaciones, eq(pagoAplicaciones.mensualidadId, mensualidades.id))
    .leftJoin(pagos, eq(pagos.id, pagoAplicaciones.pagoId))
    .where(and(eq(mensualidades.periodo, periodo), ne(mensualidades.estado, "anulada")))
    .groupBy(mensualidades.id, alumnos.id, personas.id, buses.id, servicios.id)
    .orderBy(personas.apellidos, personas.nombres);
}

function etiquetaEstadoFila(f: { estado: string; monto: number; recaudado: number; porVerificar: number }) {
  if (f.estado === "condonada") return "Condonada";
  if (f.estado === "no_recuperable") return "No recuperable";
  if (f.recaudado >= f.monto) return "Pagado";
  if (f.recaudado + f.porVerificar >= f.monto && f.porVerificar > 0) return "Por verificar";
  if (f.recaudado + f.porVerificar > 0) return "Parcial";
  return "Pendiente";
}

export async function informeRecaudacion(periodo: string, tx: DbOTx = db, resumen?: Awaited<ReturnType<typeof resumenRecaudacion>>): Promise<Informe> {
  const [enc, filas, r] = await Promise.all([encabezado(tx), detalleRecaudacion(periodo, tx), resumen ?? resumenRecaudacion(periodo, tx)]);
  const secciones: SeccionInforme[] = agruparPorBus(filas).map(([titulo, lista]) => {
    const filasInf: FilaInforme[] = lista.map((f) => ({
      alumno: nombreCompleto(f),
      apoderado: f.titular,
      servicio: f.servicio,
      esperado: f.monto,
      recaudado: f.recaudado,
      porVerificar: f.porVerificar,
      pendiente: ["condonada", "no_recuperable"].includes(f.estado) ? 0 : Math.max(0, f.monto - f.recaudado - f.porVerificar),
      estado: etiquetaEstadoFila(f),
      fechas: f.fechas,
    }));
    return {
      titulo,
      filas: filasInf,
      subtotal: {
        alumno: `Subtotal ${titulo} (${lista.length})`,
        esperado: sumaCampo(filasInf, "esperado"),
        recaudado: sumaCampo(filasInf, "recaudado"),
        porVerificar: sumaCampo(filasInf, "porVerificar"),
        pendiente: sumaCampo(filasInf, "pendiente"),
      },
    };
  });
  const indicadores: Indicador[] = [
    { etiqueta: "Total esperado", valor: r.esperado, tipo: "pesos" },
    { etiqueta: "Total recaudado", valor: r.recaudado, tipo: "pesos", destacado: true },
    { etiqueta: "Total pendiente", valor: r.pendiente, tipo: "pesos" },
    { etiqueta: "Pagos por verificar", valor: r.porVerificar, tipo: "pesos" },
    { etiqueta: `Pagos parciales (${r.parcialesCantidad})`, valor: r.parcialesSaldo, tipo: "pesos" },
    { etiqueta: "Devoluciones", valor: r.devoluciones, tipo: "pesos" },
    { etiqueta: "No recuperable", valor: r.noRecuperable, tipo: "pesos" },
    { etiqueta: "Condonado", valor: r.condonado, tipo: "pesos" },
    { etiqueta: "% de recaudación", valor: r.porcentaje, tipo: "porcentaje", destacado: true },
  ];
  return {
    codigo: "recaudacion",
    titulo: `Informe de recaudación — ${formatearPeriodo(periodo)}`,
    subtitulo: `${r.alumnos} mensualidades`,
    ...enc,
    indicadores,
    columnas: [
      { clave: "alumno", titulo: "Alumno", ancho: 30 },
      { clave: "apoderado", titulo: "Apoderado titular", ancho: 26 },
      { clave: "servicio", titulo: "Servicio", ancho: 18 },
      { clave: "esperado", titulo: "Esperado", tipo: "pesos", ancho: 12 },
      { clave: "recaudado", titulo: "Recaudado", tipo: "pesos", ancho: 12 },
      { clave: "porVerificar", titulo: "Por verificar", tipo: "pesos", ancho: 12 },
      { clave: "pendiente", titulo: "Pendiente", tipo: "pesos", ancho: 12 },
      { clave: "estado", titulo: "Estado", ancho: 13 },
      { clave: "fechas", titulo: "Fecha(s) pago", ancho: 12 },
    ],
    secciones,
    totalGeneral: {
      alumno: "TOTAL GENERAL",
      esperado: r.esperado,
      recaudado: r.recaudado,
      porVerificar: r.porVerificar,
      pendiente: r.pendiente,
    },
    notas:
      r.recibidoSinConciliar > 0
        ? [`Además hay ${r.recibidoSinConciliar.toLocaleString("es-CL")} pesos recibidos en el mes que aún no están conciliados.`]
        : undefined,
  };
}

export async function informeMorosidad(): Promise<Informe> {
  const enc = await encabezado();
  const hoyStr = hoy();
  const filas = await db
    .select({
      alumnoId: alumnos.id,
      nombres: personas.nombres,
      apellidos: personas.apellidos,
      busNumero: buses.numero,
      titular: titularSql,
      telefono: telefonoTitularSql,
      meses: sql<number>`count(*)::int`,
      deuda: sql<number>`sum(${mensualidades.monto} - ${mensualidades.montoPagado})::int`,
      desde: sql<string>`min(${mensualidades.periodo})::text`,
      periodos: sql<string>`string_agg(to_char(${mensualidades.periodo}, 'MM/YYYY'), ', ' order by ${mensualidades.periodo})`,
    })
    .from(mensualidades)
    .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .leftJoin(buses, eq(buses.id, alumnos.busId))
    .where(
      and(inArray(mensualidades.estado, ["pendiente", "parcial"]), sql`${mensualidades.fechaVencimiento} < ${hoyStr}`, isNull(alumnos.eliminadoEn)),
    )
    .groupBy(alumnos.id, personas.id, buses.id)
    .orderBy(sql`sum(${mensualidades.monto} - ${mensualidades.montoPagado}) desc`);

  const secciones = agruparPorBus(filas).map(([titulo, lista]) => {
    const f: FilaInforme[] = lista.map((x) => ({
      alumno: nombreCompleto(x),
      apoderado: x.titular,
      telefono: x.telefono,
      meses: x.meses,
      periodos: x.periodos,
      deuda: x.deuda,
    }));
    return { titulo, filas: f, subtotal: { alumno: `Subtotal ${titulo} (${lista.length})`, meses: sumaCampo(f, "meses"), deuda: sumaCampo(f, "deuda") } };
  });
  const total = filas.reduce((s, f) => s + f.deuda, 0);
  return {
    codigo: "morosidad",
    titulo: "Informe de deudas y morosidad",
    subtitulo: `Mensualidades vencidas al ${hoyStr.split("-").reverse().join("/")}`,
    ...enc,
    indicadores: [
      { etiqueta: "Alumnos con deuda", valor: filas.length, tipo: "numero" },
      { etiqueta: "Con 2 o más meses", valor: filas.filter((f) => f.meses >= 2).length, tipo: "numero" },
      { etiqueta: "Deuda vencida total", valor: total, tipo: "pesos", destacado: true },
    ],
    columnas: [
      { clave: "alumno", titulo: "Alumno", ancho: 30 },
      { clave: "apoderado", titulo: "Apoderado", ancho: 28 },
      { clave: "telefono", titulo: "Teléfono", ancho: 14 },
      { clave: "meses", titulo: "Meses", tipo: "numero", ancho: 8 },
      { clave: "periodos", titulo: "Periodos adeudados", ancho: 30 },
      { clave: "deuda", titulo: "Deuda", tipo: "pesos", ancho: 14 },
    ],
    secciones,
    totalGeneral: { alumno: "TOTAL GENERAL", meses: filas.reduce((s, f) => s + f.meses, 0), deuda: total },
  };
}

async function informeListaPagos(
  codigo: CodigoInforme,
  titulo: string,
  condicion: ReturnType<typeof and>,
  subtitulo?: string,
): Promise<Informe> {
  const enc = await encabezado();
  const porApoderado = codigo === "pagos_apoderado";
  const lista = await db.query.pagos.findMany({
    where: condicion,
    with: { alumno: { with: { persona: true } }, pagador: true },
    orderBy: (p, { asc }) => [asc(p.fechaPago), asc(p.id)],
  });
  const filas: FilaInforme[] = lista.map((p) => ({
    id: p.id,
    fecha: p.fechaPago,
    origen: p.nombreOrigen ?? (p.pagador ? nombreCompleto(p.pagador) : null),
    rut: p.rutOrigen ? formatearRut(p.rutOrigen) : null,
    alumno: p.alumno ? nombreCompleto(p.alumno.persona) : null,
    medio: MEDIO_PAGO_ETIQUETA[p.medio],
    operacion: p.numeroOperacion,
    verificacion: ESTADO_VERIFICACION_ETIQUETA[p.estadoVerificacion],
    conciliacion: ESTADO_CONCILIACION_ETIQUETA[p.estadoConciliacion],
    monto: p.monto,
    sinAsignar: p.monto - p.montoAplicado,
  }));
  let secciones: SeccionInforme[] = [{ filas }];
  if (codigo === "pagos_alumno" || porApoderado) {
    const titulares = porApoderado ? await db.select({ alumnoId: alumnoResponsables.alumnoId, persona: personas }).from(alumnoResponsables)
      .innerJoin(personas, eq(personas.id, alumnoResponsables.personaId)).where(eq(alumnoResponsables.esTitular, true)) : [];
    const titularPorAlumno = new Map(titulares.map((t) => [t.alumnoId, t.persona]));
    const grupos = new Map<string, { titulo: string; filas: FilaInforme[] }>();
    lista.forEach((p, i) => {
      const persona = porApoderado ? p.pagador ?? titularPorAlumno.get(p.alumnoId ?? 0) : p.alumno?.persona;
      const clave = persona ? `persona-${persona.id}` : porApoderado && p.nombreOrigen ? `origen-${p.nombreOrigen.toLowerCase()}` : "sin_asignar";
      const titulo = persona ? nombreCompleto(persona) : porApoderado ? p.nombreOrigen ?? "Sin responsable identificado" : "Sin alumno asignado";
      const grupo = grupos.get(clave) ?? { titulo, filas: [] };
      grupo.filas.push(filas[i]);
      grupos.set(clave, grupo);
    });
    secciones = [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, "es")).map((g) => ({ ...g,
      subtotal: { origen: "Subtotal", monto: sumaCampo(g.filas, "monto"), sinAsignar: sumaCampo(g.filas, "sinAsignar") } }));
  }
  return {
    codigo,
    titulo,
    subtitulo,
    ...enc,
    indicadores: [
      { etiqueta: "Cantidad de pagos", valor: filas.length, tipo: "numero" },
      { etiqueta: "Monto total", valor: sumaCampo(filas, "monto"), tipo: "pesos", destacado: true },
      { etiqueta: "Sin asignar", valor: sumaCampo(filas, "sinAsignar"), tipo: "pesos" },
    ],
    columnas: [
      { clave: "id", titulo: "N°", tipo: "numero", ancho: 6 },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha", ancho: 11 },
      { clave: "origen", titulo: "Origen / pagador", ancho: 28 },
      { clave: "alumno", titulo: "Alumno", ancho: 26 },
      { clave: "medio", titulo: "Medio", ancho: 13 },
      { clave: "operacion", titulo: "N° operación", ancho: 14 },
      { clave: "verificacion", titulo: "Verificación", ancho: 14 },
      { clave: "conciliacion", titulo: "Conciliación", ancho: 14 },
      { clave: "monto", titulo: "Monto", tipo: "pesos", ancho: 12 },
      { clave: "sinAsignar", titulo: "Sin asignar", tipo: "pesos", ancho: 12 },
    ],
    secciones,
    totalGeneral: { origen: "TOTAL", monto: sumaCampo(filas, "monto"), sinAsignar: sumaCampo(filas, "sinAsignar") },
  };
}

async function informeIngresosPorServicio(periodo: string): Promise<Informe> {
  const [enc, datos] = await Promise.all([encabezado(), detalleRecaudacion(periodo)]);
  const porServicio = new Map<string, { servicio: string; esperado: number; recaudado: number; porVerificar: number }>();
  for (const d of datos) {
    const servicio = d.servicio ?? "Sin servicio asignado";
    const fila = porServicio.get(servicio) ?? { servicio, esperado: 0, recaudado: 0, porVerificar: 0 };
    fila.esperado += d.monto;
    fila.recaudado += d.recaudado;
    fila.porVerificar += d.porVerificar;
    porServicio.set(servicio, fila);
  }
  const filas = [...porServicio.values()].sort((a, b) => a.servicio.localeCompare(b.servicio, "es"));
  return { ...enc, codigo: "ingresos_servicio", titulo: `Ingresos por servicio · ${formatearPeriodo(periodo)}`,
    columnas: [{ clave: "servicio", titulo: "Servicio" }, { clave: "esperado", titulo: "Esperado", tipo: "pesos" },
      { clave: "recaudado", titulo: "Recaudado", tipo: "pesos" }, { clave: "porVerificar", titulo: "Por verificar", tipo: "pesos" }],
    secciones: [{ filas }], totalGeneral: { servicio: "TOTAL GENERAL", esperado: sumaCampo(filas, "esperado"),
      recaudado: sumaCampo(filas, "recaudado"), porVerificar: sumaCampo(filas, "porVerificar") } };
}

async function recaudadoPorMesYBus(anio: number) {
  return db
    .select({
      periodo: sql<string>`${mensualidades.periodo}::text`,
      busNumero: buses.numero,
      esperado: sql<number>`sum(${mensualidades.monto})::int`,
    })
    .from(mensualidades)
    .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
    .leftJoin(buses, eq(buses.id, alumnos.busId))
    .where(sql`extract(year from ${mensualidades.periodo}) = ${anio} and ${mensualidades.estado} <> 'anulada'`)
    .groupBy(mensualidades.periodo, buses.numero);
}

async function recaudadoVerificadoPorMesYBus(anio: number) {
  return db
    .select({
      periodo: sql<string>`${mensualidades.periodo}::text`,
      busNumero: buses.numero,
      recaudado: sql<number>`coalesce(sum(${pagoAplicaciones.monto}), 0)::int`,
    })
    .from(pagoAplicaciones)
    .innerJoin(pagos, and(eq(pagos.id, pagoAplicaciones.pagoId), eq(pagos.estadoVerificacion, "verificado")))
    .innerJoin(mensualidades, eq(mensualidades.id, pagoAplicaciones.mensualidadId))
    .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
    .leftJoin(buses, eq(buses.id, alumnos.busId))
    .where(sql`extract(year from ${mensualidades.periodo}) = ${anio}`)
    .groupBy(mensualidades.periodo, buses.numero);
}

export async function informeIngresosPorBus(anio: number): Promise<Informe> {
  const enc = await encabezado();
  const datos = await recaudadoVerificadoPorMesYBus(anio);
  const busesUnicos = [...new Set(datos.map((d) => (d.busNumero ? `Bus ${d.busNumero}` : OTROS)))].sort((a, b) =>
    a === OTROS ? 1 : b === OTROS ? -1 : a.localeCompare(b, "es", { numeric: true }),
  );
  const filas: FilaInforme[] = busesUnicos.map((bus) => {
    const fila: FilaInforme = { bus };
    let total = 0;
    for (let m = 1; m <= 12; m++) {
      const periodo = `${anio}-${String(m).padStart(2, "0")}-01`;
      const v = datos
        .filter((d) => d.periodo === periodo && (d.busNumero ? `Bus ${d.busNumero}` : OTROS) === bus)
        .reduce((s, d) => s + d.recaudado, 0);
      fila[`m${m}`] = v || null;
      total += v;
    }
    fila.total = total;
    return fila;
  });
  const totalGeneral: FilaInforme = { bus: "TOTAL GENERAL" };
  for (let m = 1; m <= 12; m++) totalGeneral[`m${m}`] = sumaCampo(filas, `m${m}`);
  totalGeneral.total = sumaCampo(filas, "total");
  return {
    codigo: "ingresos_bus",
    titulo: `Ingresos por bus — ${anio}`,
    subtitulo: "Recaudación verificada asignada a mensualidades de cada mes",
    ...enc,
    indicadores: [{ etiqueta: `Total recaudado ${anio}`, valor: Number(totalGeneral.total), tipo: "pesos", destacado: true }],
    columnas: [
      { clave: "bus", titulo: "Bus", ancho: 16 },
      ...Array.from({ length: 12 }, (_, i) => ({ clave: `m${i + 1}`, titulo: nombreMes(i + 1).slice(0, 3), tipo: "pesos" as const, ancho: 11 })),
      { clave: "total", titulo: "Total", tipo: "pesos", ancho: 13 },
    ],
    secciones: [{ filas }],
    totalGeneral,
  };
}

export async function informeComparacionMensual(anio: number): Promise<Informe> {
  const enc = await encabezado();
  const [esperados, recaudados] = await Promise.all([recaudadoPorMesYBus(anio), recaudadoVerificadoPorMesYBus(anio)]);
  const filas: FilaInforme[] = [];
  for (let m = 1; m <= 12; m++) {
    const periodo = `${anio}-${String(m).padStart(2, "0")}-01`;
    const esperado = esperados.filter((e) => e.periodo === periodo).reduce((s, e) => s + e.esperado, 0);
    const recaudado = recaudados.filter((e) => e.periodo === periodo).reduce((s, e) => s + e.recaudado, 0);
    if (esperado === 0 && recaudado === 0) continue;
    filas.push({
      mes: periodo,
      esperado,
      recaudado,
      diferencia: esperado - recaudado,
      porcentaje: esperado ? (recaudado / esperado) * 100 : null,
    });
  }
  const te = sumaCampo(filas, "esperado");
  const tr = sumaCampo(filas, "recaudado");
  return {
    codigo: "comparacion_mensual",
    titulo: `Comparación mensual — ${anio}`,
    subtitulo: "Informe anual de recaudación",
    ...enc,
    indicadores: [
      { etiqueta: "Esperado del año", valor: te, tipo: "pesos" },
      { etiqueta: "Recaudado del año", valor: tr, tipo: "pesos", destacado: true },
      { etiqueta: "% anual", valor: te ? (tr / te) * 100 : 0, tipo: "porcentaje" },
    ],
    columnas: [
      { clave: "mes", titulo: "Mes", tipo: "periodo", ancho: 18 },
      { clave: "esperado", titulo: "Esperado", tipo: "pesos", ancho: 15 },
      { clave: "recaudado", titulo: "Recaudado", tipo: "pesos", ancho: 15 },
      { clave: "diferencia", titulo: "Pendiente", tipo: "pesos", ancho: 15 },
      { clave: "porcentaje", titulo: "% recaudación", tipo: "porcentaje", ancho: 14 },
    ],
    secciones: [{ filas }],
    totalGeneral: { mes: "TOTAL ANUAL", esperado: te, recaudado: tr, diferencia: te - tr, porcentaje: te ? (tr / te) * 100 : null },
  };
}

/** Punto de entrada único: genera cualquier informe del catálogo. */
async function informeDocumentos(vencidos: boolean): Promise<Informe> {
  const [enc, registros] = await Promise.all([encabezado(), listarDocumentosControl()]);
  const inicio = hoy();
  const fin = sumarDias(inicio, 60);
  const filas = registros.filter(({ documento }) => vencidos ? documento.fechaVencimiento < inicio
    : documento.fechaVencimiento >= inicio && documento.fechaVencimiento <= fin).map(({ documento, bus, nombres, apellidos }) => ({
      titular: bus ? `Bus ${bus}` : nombreCompleto({ nombres: nombres ?? "", apellidos }),
      tipo: documento.tipo, emision: documento.fechaEmision, vencimiento: documento.fechaVencimiento, observaciones: documento.observaciones,
    }));
  return { ...enc, codigo: vencidos ? "documentos_vencidos" : "documentos_por_vencer", titulo: vencidos ? "Documentos vencidos" : "Documentos por vencer",
    columnas: [{ clave: "titular", titulo: "Bus o conductor" }, { clave: "tipo", titulo: "Documento" },
      { clave: "emision", titulo: "Emisión", tipo: "fecha" }, { clave: "vencimiento", titulo: "Vencimiento", tipo: "fecha" },
      { clave: "observaciones", titulo: "Observaciones" }], secciones: [{ filas }] };
}

async function informeMantenciones(anio: number): Promise<Informe> {
  const [enc, registros] = await Promise.all([encabezado(), listarMantenciones()]);
  const grupos = agruparPorBus(registros.filter(({ mantencion }) => mantencion.fecha.startsWith(`${anio}-`)).map(({ mantencion, numero }) => ({
    busNumero: numero, bus: `Bus ${numero}`, tarea: mantencion.tarea, fecha: mantencion.fecha, kilometraje: mantencion.kilometraje, costo: mantencion.costo,
  })));
  const secciones = grupos.map(([titulo, filas]) => ({ titulo, filas, subtotal: { bus: titulo, costo: sumaCampo(filas, "costo") } }));
  return { ...enc, codigo: "gastos_mantencion", titulo: `Gastos de mantención · ${anio}`,
    columnas: [{ clave: "bus", titulo: "Bus" }, { clave: "tarea", titulo: "Mantención" }, { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "kilometraje", titulo: "Kilometraje", tipo: "numero" }, { clave: "costo", titulo: "Costo", tipo: "pesos" }],
    secciones, totalGeneral: { bus: "TOTAL GENERAL", costo: sumaCampo(secciones.map((s) => s.subtotal), "costo") } };
}

async function informeConductores(): Promise<Informe> {
  const [enc, registros] = await Promise.all([encabezado(), listarConductores()]);
  const filas = registros.map(({ persona, conductor }) => ({ nombre: nombreCompleto(persona), rut: persona.rut ? formatearRut(persona.rut) : null,
    telefono: persona.telefono, clase: conductor.claseLicencia, estado: conductor.activo ? "Activo" : "Inactivo" }));
  return { ...enc, codigo: "conductores", titulo: "Conductores",
    columnas: [{ clave: "nombre", titulo: "Conductor" }, { clave: "rut", titulo: "RUT" }, { clave: "telefono", titulo: "Teléfono" },
      { clave: "clase", titulo: "Clase de licencia" }, { clave: "estado", titulo: "Estado" }], secciones: [{ filas }] };
}

export async function generarInforme(codigo: CodigoInforme, p: { periodo?: string; anio?: number; cierre?: boolean }): Promise<Informe> {
  const periodo = p.periodo ?? `${hoy().slice(0, 7)}-01`;
  const anio = p.anio ?? Number(hoy().slice(0, 4));
  switch (codigo) {
    case "recaudacion": {
      if (p.cierre) {
        const [c] = await db.select({ resumen: cierresMes.resumen }).from(cierresMes).where(eq(cierresMes.periodo, periodo));
        const archivado = c?.resumen.informe as Informe | undefined;
        if (archivado) return { ...archivado, subtitulo: ["Informe guardado al cierre", archivado.subtitulo].filter(Boolean).join(" · ") };
      }
      return informeRecaudacion(periodo);
    }
    case "morosidad":
      return informeMorosidad();
    case "por_verificar":
      return informeListaPagos("por_verificar", "Pagos por verificar", and(isNull(pagos.anuladoEn), eq(pagos.estadoVerificacion, "por_verificar")));
    case "por_conciliar":
      return informeListaPagos(
        "por_conciliar",
        "Pagos por conciliar",
        and(isNull(pagos.anuladoEn), eq(pagos.estadoVerificacion, "verificado"), ne(pagos.estadoConciliacion, "conciliado")),
      );
    case "pagos_recibidos":
    case "pagos_alumno":
    case "pagos_apoderado":
      return informeListaPagos(
        codigo,
        `${codigo === "pagos_alumno" ? "Pagos por alumno" : codigo === "pagos_apoderado" ? "Pagos por apoderado o pagador" : "Pagos recibidos"} · ${formatearPeriodo(periodo)}`,
        and(isNull(pagos.anuladoEn), sql`${pagos.fechaPago} between ${periodo} and ${finDeMes(periodo)}`),
      );
    case "ingresos_bus":
      return informeIngresosPorBus(anio);
    case "ingresos_servicio":
      return informeIngresosPorServicio(periodo);
    case "comparacion_mensual":
      return informeComparacionMensual(anio);
    case "documentos_vencidos":
      return informeDocumentos(true);
    case "documentos_por_vencer":
      return informeDocumentos(false);
    case "gastos_mantencion":
      return informeMantenciones(anio);
    case "conductores":
      return informeConductores();
    case "cotizaciones":
    case "servicios_realizados":
    case "contratos":
      return informeOperaciones(codigo, anio);
  }
}

/** Recaudación de los últimos N meses (para el gráfico del panel). */
export async function tendenciaRecaudacion(meses = 6) {
  // Dos consultas agrupadas en paralelo (en vez de varias por mes): importante cuando la base está lejos
  const fin = `${hoy().slice(0, 7)}-01`;
  const inicio = sumarMeses(fin, -(meses - 1));
  const enRango = sql`${mensualidades.periodo} between ${inicio} and ${fin}`;
  const [esperados, recaudados] = await Promise.all([
    db
      .select({ periodo: sql<string>`${mensualidades.periodo}::text`, total: sql<number>`sum(${mensualidades.monto})::int` })
      .from(mensualidades)
      .where(and(enRango, ne(mensualidades.estado, "anulada")))
      .groupBy(mensualidades.periodo),
    db
      .select({ periodo: sql<string>`${mensualidades.periodo}::text`, total: sql<number>`sum(${pagoAplicaciones.monto})::int` })
      .from(pagoAplicaciones)
      .innerJoin(pagos, and(eq(pagos.id, pagoAplicaciones.pagoId), eq(pagos.estadoVerificacion, "verificado")))
      .innerJoin(mensualidades, eq(mensualidades.id, pagoAplicaciones.mensualidadId))
      .where(and(enRango, ne(mensualidades.estado, "anulada")))
      .groupBy(mensualidades.periodo),
  ]);
  const esp = new Map(esperados.map((e) => [e.periodo, e.total]));
  const rec = new Map(recaudados.map((r) => [r.periodo, r.total]));
  return Array.from({ length: meses }, (_, i) => {
    const periodo = sumarMeses(inicio, i);
    return { periodo, esperado: esp.get(periodo) ?? 0, recaudado: rec.get(periodo) ?? 0 };
  });
}
