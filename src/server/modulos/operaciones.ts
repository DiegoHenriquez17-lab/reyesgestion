import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { ESTADOS_COTIZACION, ESTADOS_VIAJE } from "@/lib/operaciones";
import { fecha, idOpcional, textoOpcional } from "@/lib/validaciones";
import { guardarArchivo, tipoFuenteDeArchivo } from "@/server/almacenamiento";
import { auditar, type Contexto } from "@/server/auditoria";
import { db, type DbOTx, type Tx } from "@/server/db";
import { buses, conductores, contratos, cotizaciones, personas, servicios, viajes } from "@/server/db/schema";
import { ErrorNegocio } from "@/server/errores";
import { hoy } from "@/server/fechas";

const base = {
  clienteId: z.coerce.number().int().positive().max(2147483647), servicioId: z.coerce.number().int().positive().max(2147483647),
  detalle: z.string().trim().min(3, "Describe el servicio o las condiciones").max(6000),
  monto: z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number).pipe(z.number().int().min(0).max(2147483647)),
  motivo: textoOpcional,
};

function motivoCambio(antes: unknown, razon: string | null) {
  if (antes && !razon) throw new ErrorNegocio("Indica el motivo del cambio.");
  return razon;
}

async function comprobarClienteServicio(tx: Tx, datos: { clienteId: number; servicioId: number }) {
  const [cliente] = await tx.select({ id: personas.id }).from(personas).where(and(eq(personas.id, datos.clienteId), isNull(personas.eliminadoEn)));
  const [servicio] = await tx.select({ id: servicios.id }).from(servicios).where(and(eq(servicios.id, datos.servicioId), isNull(servicios.eliminadoEn)));
  if (!cliente || !servicio) throw new ErrorNegocio("Selecciona un cliente y un servicio vigentes.");
}

export function listarCotizaciones(tx: DbOTx = db, estado?: typeof ESTADOS_COTIZACION[number], id?: number) {
  return tx.select({ cotizacion: cotizaciones, cliente: personas, servicio: servicios.nombre, viajeId: viajes.id })
    .from(cotizaciones).innerJoin(personas, eq(personas.id, cotizaciones.clienteId)).innerJoin(servicios, eq(servicios.id, cotizaciones.servicioId))
    .leftJoin(viajes, eq(viajes.cotizacionId, cotizaciones.id))
    .where(and(estado ? eq(cotizaciones.estado, estado) : undefined, id ? eq(cotizaciones.id, id) : undefined))
    .orderBy(desc(cotizaciones.fechaSolicitud), desc(cotizaciones.id));
}

export function listarViajes(tx: DbOTx = db, estado?: typeof ESTADOS_VIAJE[number]) {
  return tx.select({ viaje: viajes, cliente: personas, servicio: servicios.nombre, bus: buses.numero }).from(viajes)
    .innerJoin(personas, eq(personas.id, viajes.clienteId)).innerJoin(servicios, eq(servicios.id, viajes.servicioId)).leftJoin(buses, eq(buses.id, viajes.busId))
    .where(estado ? eq(viajes.estado, estado) : undefined).orderBy(desc(viajes.fecha), desc(viajes.id));
}

export function listarContratos(tx: DbOTx = db, id?: number) {
  return tx.select({ contrato: contratos, cliente: personas, servicio: servicios.nombre }).from(contratos)
    .innerJoin(personas, eq(personas.id, contratos.clienteId)).innerJoin(servicios, eq(servicios.id, contratos.servicioId))
    .where(id ? eq(contratos.id, id) : undefined).orderBy(desc(contratos.fechaVencimiento), desc(contratos.id));
}

export async function guardarCotizacion(ctx: Contexto, id: number | null, entrada: unknown) {
  const { motivo, ...datos } = z.object({ ...base, fechaSolicitud: fecha, fechaServicio: fecha, estado: z.enum(ESTADOS_COTIZACION) }).parse(entrada);
  if (datos.fechaServicio < datos.fechaSolicitud) throw new ErrorNegocio("El servicio debe ser igual o posterior a la fecha de solicitud.");
  return db.transaction(async (tx) => {
    await comprobarClienteServicio(tx, datos);
    const [antes] = id === null ? [] : await tx.select().from(cotizaciones).where(eq(cotizaciones.id, id)).for("update");
    if (id !== null && !antes) throw new ErrorNegocio("La cotización no existe.");
    const razon = motivoCambio(antes, motivo);
    if (antes) {
      const [viaje] = await tx.select({ id: viajes.id }).from(viajes).where(eq(viajes.cotizacionId, antes.id));
      if (viaje && (datos.estado !== "aceptada" || datos.clienteId !== antes.clienteId || datos.servicioId !== antes.servicioId)) {
        throw new ErrorNegocio("Esta cotización ya está vinculada a un viaje. Mantén su cliente, servicio y estado aceptado.");
      }
    }
    const [despues] = antes ? await tx.update(cotizaciones).set(datos).where(eq(cotizaciones.id, antes.id)).returning()
      : await tx.insert(cotizaciones).values(datos).returning();
    await auditar(tx, ctx, { accion: antes ? "actualizar" : "crear", entidad: "cotizacion", entidadId: despues.id, antes, despues, motivo: razon });
    return despues;
  });
}

export async function programarCotizacion(ctx: Contexto, id: number) {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(cotizaciones).where(eq(cotizaciones.id, id)).for("update");
    if (c?.estado !== "aceptada") throw new ErrorNegocio("Acepta la cotización antes de programar el viaje.");
    await comprobarClienteServicio(tx, c);
    const [viaje] = await tx.insert(viajes).values({ cotizacionId: c.id, clienteId: c.clienteId, servicioId: c.servicioId,
      fecha: c.fechaServicio, monto: c.monto, detalle: c.detalle }).onConflictDoNothing().returning();
    if (!viaje) throw new ErrorNegocio("Esta cotización ya tiene un viaje programado.");
    await auditar(tx, ctx, { accion: "crear", entidad: "viaje", entidadId: viaje.id, despues: viaje, motivo: `Cotización #${c.id} aceptada` });
    return viaje;
  });
}

export async function guardarViaje(ctx: Contexto, id: number | null, entrada: unknown) {
  const { motivo, ...datos } = z.object({ ...base, busId: idOpcional, conductorId: idOpcional,
    fecha, estado: z.enum(ESTADOS_VIAJE), documentacionLista: z.boolean() }).parse(entrada);
  if (datos.estado === "realizado" && datos.fecha > hoy()) throw new ErrorNegocio("La fecha del servicio realizado debe ser hoy o anterior.");
  return db.transaction(async (tx) => {
    await comprobarClienteServicio(tx, datos);
    const [antes] = id === null ? [] : await tx.select().from(viajes).where(eq(viajes.id, id)).for("update");
    if (id !== null && !antes) throw new ErrorNegocio("El viaje no existe.");
    if (antes?.cotizacionId && (antes.clienteId !== datos.clienteId || antes.servicioId !== datos.servicioId)) {
      throw new ErrorNegocio("El cliente y el servicio de este viaje vienen de la cotización aceptada.");
    }
    if (datos.busId && datos.busId !== antes?.busId) {
      const [bus] = await tx.select({ id: buses.id }).from(buses).where(and(eq(buses.id, datos.busId), eq(buses.activo, true), isNull(buses.eliminadoEn)));
      if (!bus) throw new ErrorNegocio("Selecciona un bus activo.");
    }
    if (datos.conductorId && datos.conductorId !== antes?.conductorId) {
      const [conductor] = await tx.select({ id: conductores.id }).from(conductores).innerJoin(personas, eq(personas.id, conductores.personaId))
        .where(and(eq(conductores.id, datos.conductorId), eq(conductores.activo, true), isNull(personas.eliminadoEn)));
      if (!conductor) throw new ErrorNegocio("Selecciona un conductor activo.");
    }
    const razon = motivoCambio(antes, motivo);
    const [despues] = antes ? await tx.update(viajes).set(datos).where(eq(viajes.id, antes.id)).returning()
      : await tx.insert(viajes).values(datos).returning();
    await auditar(tx, ctx, { accion: antes ? "actualizar" : "crear", entidad: "viaje", entidadId: despues.id, antes, despues, motivo: razon });
    return despues;
  });
}

export async function guardarContrato(ctx: Contexto, id: number | null, entrada: unknown, archivo?: File) {
  const { motivo, ...datos } = z.object({ ...base, titulo: z.string().trim().min(3).max(140), fechaInicio: fecha, fechaVencimiento: fecha, activo: z.boolean() }).parse(entrada);
  if (datos.fechaVencimiento < datos.fechaInicio) throw new ErrorNegocio("El vencimiento debe ser igual o posterior al inicio.");
  if (archivo?.size && !["pdf", "word", "imagen"].includes(tipoFuenteDeArchivo(archivo.name, archivo.type) ?? "")) throw new ErrorNegocio("Adjunta un PDF, Word o una foto.");
  return db.transaction(async (tx) => {
    await comprobarClienteServicio(tx, datos);
    const [antes] = id === null ? [] : await tx.select().from(contratos).where(eq(contratos.id, id)).for("update");
    if (id !== null && !antes) throw new ErrorNegocio("El contrato no existe.");
    const razon = motivoCambio(antes, motivo);
    const adjunto = archivo?.size ? await guardarArchivo(archivo, { tipo: "contrato", usuarioId: ctx.usuarioId, entidadTipo: "contrato", entidadId: antes?.id }, tx) : null;
    const campos = { ...datos, documentoId: adjunto?.documento.id ?? antes?.documentoId ?? null };
    const [despues] = antes ? await tx.update(contratos).set(campos).where(eq(contratos.id, antes.id)).returning() : await tx.insert(contratos).values(campos).returning();
    await auditar(tx, ctx, { accion: antes ? "actualizar" : "crear", entidad: "contrato", entidadId: despues.id, antes, despues, motivo: razon });
    return despues;
  });
}
