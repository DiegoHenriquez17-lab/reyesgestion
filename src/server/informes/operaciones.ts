import "server-only";
import type { Informe, TipoDato } from "@/lib/informe";
import { formatearFechaHora, nombreCompleto } from "@/lib/formato";
import { ESTADO_OPERACION_ETIQUETA } from "@/lib/operaciones";
import { formatearRut } from "@/lib/rut";
import { db } from "@/server/db";
import { leerConfig } from "@/server/configuracion";
import { entorno } from "@/server/entorno";
import { listarContratos, listarCotizaciones, listarViajes } from "@/server/modulos/operaciones";

async function encabezado() {
  return { empresa: String(await leerConfig("empresa.nombre")), generadoEn: formatearFechaHora(new Date(), entorno.APP_TIMEZONE) };
}

export async function generarDocumentoOperacion(tipo: "cotizacion" | "contrato", id: number): Promise<Informe | null> {
  const enc = await encabezado();
  const columnas = [{ clave: "detalle", titulo: "Detalle y condiciones", ancho: 60 }];
  if (tipo === "cotizacion") {
    const [registro] = await listarCotizaciones(db, undefined, id);
    if (!registro) return null;
    const { cotizacion: c, cliente, servicio } = registro;
    return { ...enc, codigo: tipo, titulo: `Cotización N° ${c.id}`, subtitulo: `${servicio} · ${nombreCompleto(cliente)}`,
      indicadores: [{ etiqueta: "Fecha de solicitud", valor: c.fechaSolicitud, tipo: "fecha" }, { etiqueta: "Fecha del servicio", valor: c.fechaServicio, tipo: "fecha" },
        { etiqueta: "Total", valor: c.monto, tipo: "pesos", destacado: true }, { etiqueta: "Estado", valor: ESTADO_OPERACION_ETIQUETA[c.estado] }],
      columnas, secciones: [{ filas: [{ detalle: c.detalle }] }] };
  }
  const [registro] = await listarContratos(db, id);
  if (!registro) return null;
  const { contrato: c, cliente, servicio } = registro;
  return { ...enc, codigo: tipo, titulo: `Borrador de contrato N° ${c.id}`, subtitulo: `${c.titulo} · ${servicio}`,
    indicadores: [{ etiqueta: "Cliente", valor: nombreCompleto(cliente) }, { etiqueta: "RUT", valor: cliente.rut ? formatearRut(cliente.rut) : null },
      { etiqueta: "Inicio", valor: c.fechaInicio, tipo: "fecha" }, { etiqueta: "Vencimiento", valor: c.fechaVencimiento, tipo: "fecha" },
      { etiqueta: "Monto", valor: c.monto, tipo: "pesos", destacado: true }],
    columnas, secciones: [{ filas: [{ detalle: c.detalle }] }], notas: ["Firma empresa: ____________________", "Firma cliente: ____________________"] };
}

const columnasBase = [{ clave: "cliente", titulo: "Cliente" }, { clave: "servicio", titulo: "Servicio" }, { clave: "monto", titulo: "Monto", tipo: "pesos" as TipoDato }];

export async function informeOperaciones(codigo: "cotizaciones" | "servicios_realizados" | "contratos", anio: number): Promise<Informe> {
  const enc = await encabezado();
  if (codigo === "cotizaciones") {
    const filas = (await listarCotizaciones()).filter(({ cotizacion }) => cotizacion.fechaSolicitud.startsWith(`${anio}-`))
      .map(({ cotizacion: c, cliente, servicio }) => ({ cliente: nombreCompleto(cliente), servicio, monto: c.monto, fecha: c.fechaServicio, estado: ESTADO_OPERACION_ETIQUETA[c.estado] }));
    return { ...enc, codigo, titulo: `Cotizaciones · ${anio}`, columnas: [...columnasBase, { clave: "fecha", titulo: "Fecha del servicio", tipo: "fecha" }, { clave: "estado", titulo: "Estado" }], secciones: [{ filas }] };
  }
  if (codigo === "servicios_realizados") {
    const filas = (await listarViajes(db, "realizado")).filter(({ viaje }) => viaje.fecha.startsWith(`${anio}-`))
      .map(({ viaje, cliente, servicio, bus }) => ({ cliente: nombreCompleto(cliente), servicio, monto: viaje.monto, bus: bus ? `Bus ${bus}` : null, fecha: viaje.fecha }));
    return { ...enc, codigo, titulo: `Servicios realizados · ${anio}`, columnas: [...columnasBase, { clave: "fecha", titulo: "Fecha", tipo: "fecha" }, { clave: "bus", titulo: "Bus" }],
      secciones: [{ filas }], totalGeneral: { cliente: "TOTAL GENERAL", monto: filas.reduce((total, f) => total + f.monto, 0) } };
  }
  const filas = (await listarContratos()).map(({ contrato: c, cliente, servicio }) => ({ cliente: nombreCompleto(cliente), servicio, monto: c.monto,
    titulo: c.titulo, vencimiento: c.fechaVencimiento, estado: c.activo ? "Activo" : "Inactivo" }));
  return { ...enc, codigo, titulo: "Contratos", columnas: [...columnasBase, { clave: "titulo", titulo: "Contrato" },
    { clave: "vencimiento", titulo: "Vencimiento", tipo: "fecha" }, { clave: "estado", titulo: "Estado" }], secciones: [{ filas }] };
}
