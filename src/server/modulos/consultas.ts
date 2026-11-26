import "server-only";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { normalizarTexto } from "@/lib/texto";
import { inicioDeMes, sumarDias } from "@/lib/fechas";
import { formatearFecha, formatearPeriodo, formatearPesos, indiceMes, nombreCompleto } from "@/lib/formato";
import { db } from "@/server/db";
import { alertas } from "@/server/db/schema";
import { hoy } from "@/server/fechas";
import { generarInforme, resumenRecaudacion } from "@/server/informes";
import { listarMensualidadesPeriodo } from "./mensualidades";
import { listarViajes } from "./operaciones";
import { listarPagos } from "./pagos";

type Respuesta = { titulo: string; enlace: string; filas: { texto: string; detalle?: string | null; enlace?: string | null }[] };

/** Interpreta preguntas frecuentes y consulta únicamente los servicios de lectura existentes. */
export async function consultarGestion(pregunta: string): Promise<Respuesta | null> {
  const q = normalizarTexto(pregunta).replace(/[¿?¡!.,]/g, " ").replace(/\s+/g, " ").trim();
  if (!/^(quien(?:es)?|cuanto(?:s)?|cuanta(?:s)?|que|cual(?:es)?)\b/.test(q) && !/^(pagos por verificar|deudas vencidas|morosidad)$/.test(q)) return null;
  const actual = hoy();
  const anio = Number(/\b(20\d{2})\b/.exec(q)?.[1] ?? actual.slice(0, 4));
  const mes = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.exec(q)?.[1];
  const mesNumero = mes ? indiceMes(mes) : null;
  const periodo = mesNumero ? `${anio}-${String(mesNumero).padStart(2, "0")}-01` : inicioDeMes(actual);
  const enlacePeriodo = `periodo=${periodo.slice(0, 7)}`;

  if (/\b(recaud\w*|ingres\w*|genera\w*)\b/.test(q) && /\bbus(?:es)?\b/.test(q)) {
    const informe = await generarInforme("ingresos_bus", { anio });
    return { titulo: `Recaudación por bus en ${anio}`, enlace: `/informes/ingresos_bus?anio=${anio}`, filas: informe.secciones.flatMap((s) => s.filas).map((f) => ({
      texto: String(f.bus), detalle: formatearPesos(Number(f.total ?? 0)),
    })) };
  }
  if (/\b(recaud\w*|ingres\w*)\b/.test(q)) {
    if (!mes && /\b(20\d{2}|anual|ano)\b/.test(q)) {
      const inf = await generarInforme("comparacion_mensual", { anio });
      return { titulo: `Recaudación de ${anio}`, enlace: `/informes/comparacion_mensual?anio=${anio}`,
        filas: [{ texto: "Total conciliado y verificado", detalle: formatearPesos(Number(inf.totalGeneral?.recaudado ?? 0)) }] };
    }
    const r = await resumenRecaudacion(periodo);
    return { titulo: `Recaudación de ${formatearPeriodo(periodo)}`, enlace: `/informes/recaudacion?${enlacePeriodo}`,
      filas: [{ texto: "Conciliado y verificado", detalle: formatearPesos(r.recaudado) }, { texto: "Pendiente", detalle: formatearPesos(r.pendiente) },
        { texto: "Recibido sin conciliar", detalle: formatearPesos(r.recibidoSinConciliar) }] };
  }
  if (/\b(debe\w*|deud\w*|moros\w*)\b/.test(q)) {
    const minimo = /\b(dos|2) meses\b/.test(q) ? 2 : /\b(tres|3) meses\b/.test(q) ? 3 : null;
    if (minimo !== null || /\bmoros\w*\b/.test(q)) {
      const inf = await generarInforme("morosidad", {});
      return { titulo: minimo ? `Alumnos con ${minimo} meses pendientes o más` : "Alumnos con deuda vencida", enlace: "/informes/morosidad",
        filas: inf.secciones.flatMap((s) => s.filas).filter((f) => !minimo || Number(f.meses) >= minimo).map((f) => ({
          texto: String(f.alumno), detalle: `${f.meses} mes(es) · ${formatearPesos(Number(f.deuda))}`,
        })) };
    }
    const filas = (await listarMensualidadesPeriodo(periodo)).filter((m) => (m.estado === "pendiente" || m.estado === "parcial") && m.monto > m.montoPagado);
    return { titulo: `Alumnos con saldo de ${formatearPeriodo(periodo)}`, enlace: `/mensualidades?${enlacePeriodo}`,
      filas: filas.map((m) => ({ texto: nombreCompleto(m), detalle: formatearPesos(m.monto - m.montoPagado), enlace: `/alumnos/${m.alumnoId}` })) };
  }
  if (/\bpor verificar\b/.test(q)) {
    const pagos = await listarPagos({ verificacion: "por_verificar" }, 20);
    return { titulo: "Pagos por verificar", enlace: "/informes/por_verificar", filas: pagos.map((p) => ({
      texto: `Pago #${p.id} · ${p.nombreOrigen ?? "Sin nombre"}`, detalle: formatearPesos(p.monto), enlace: `/pagos/${p.id}`,
    })) };
  }
  if (/\b(esta semana|proximos 7 dias)\b/.test(q) && /\b(servicios?|viajes?)\b/.test(q)) {
    const diasDesdeLunes = (new Date(`${actual}T00:00:00Z`).getUTCDay() + 6) % 7;
    const desde = q.includes("esta semana") ? sumarDias(actual, -diasDesdeLunes) : actual;
    const hasta = sumarDias(desde, 6);
    const viajes = (await listarViajes()).filter(({ viaje }) => viaje.estado !== "cancelado" && viaje.fecha >= desde && viaje.fecha <= hasta);
    return { titulo: `Viajes del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`, enlace: "/operaciones#viajes", filas: viajes.map(({ viaje, servicio, cliente }) => ({
      texto: servicio, detalle: `${formatearFecha(viaje.fecha)} · ${nombreCompleto(cliente)}`, enlace: `/operaciones#viaje-${viaje.id}`,
    })) };
  }
  const documentos = /\b(documentos?|licencias?|vencim\w*)\b/.test(q) && /\b(venc\w*|proxim\w*)\b/.test(q);
  const mantencion = /\b(mantencion\w*|mantenimiento\w*)\b/.test(q);
  if (documentos || mantencion) {
    const soloConductores = /\bconductor\w*\b/.test(q);
    const modulos = mantencion ? ["mantenciones"] as const : soloConductores ? ["conductores"] as const : ["buses", "conductores"] as const;
    const registros = await db.select().from(alertas).where(and(eq(alertas.estado, "activa"), inArray(alertas.modulo, [...modulos]),
      mantencion ? undefined : or(like(alertas.reglaCodigo, "buses.documento.%"), like(alertas.reglaCodigo, "conductores.documento.%")))).limit(50);
    return { titulo: mantencion ? "Mantenciones que requieren atención" : soloConductores ? "Documentos de conductores que requieren atención" : "Vencimientos de documentos", enlace: mantencion ? "/flota#mantenciones" : "/flota#documentos",
      filas: registros.map((a) => ({ texto: a.titulo, detalle: a.detalle, enlace: a.enlace })) };
  }
  return null;
}
