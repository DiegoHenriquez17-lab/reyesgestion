import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { fecha, fechaOpcional, idOpcional, textoOpcional } from "@/lib/validaciones";
import { TIPOS_CONTROL_BUS, TIPOS_CONTROL_CONDUCTOR } from "@/lib/flota";
import { sumarDias } from "@/lib/fechas";
import { db, type DbOTx, type Tx } from "@/server/db";
import { buses, conductores, documentosControl, lecturasKilometraje, mantenciones, personas, planesMantencion } from "@/server/db/schema";
import { auditar, type Contexto } from "@/server/auditoria";
import { ErrorNegocio } from "@/server/errores";
import { guardarArchivo, tipoFuenteDeArchivo } from "@/server/almacenamiento";
import { hoy } from "@/server/fechas";

const id = z.coerce.number().int().positive().max(2147483647);
const entero = z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number).pipe(z.number().int().min(0).max(2147483647));
const enteroOpcional = z.union([entero, z.literal(""), z.null(), z.undefined()]).transform((v) => typeof v === "number" ? v : null);
const motivo = z.string().trim().min(3, "Indica el motivo del cambio").max(500);

export const kmActualSql = sql<number | null>`(select km.kilometraje from ${lecturasKilometraje} km
  where km.bus_id = ${buses.id} order by km.fecha desc, km.id desc limit 1)`;

export async function listarConductores(tx: DbOTx = db) {
  return tx.select({ conductor: conductores, persona: personas }).from(conductores)
    .innerJoin(personas, eq(personas.id, conductores.personaId))
    .where(isNull(personas.eliminadoEn)).orderBy(asc(personas.apellidos), asc(personas.nombres));
}

export async function listarDocumentosControl(tx: DbOTx = db, titular?: "bus" | "conductor", tipo?: string) {
  return tx.select({ documento: documentosControl, bus: buses.numero, nombres: personas.nombres, apellidos: personas.apellidos })
    .from(documentosControl).leftJoin(buses, eq(buses.id, documentosControl.busId))
    .leftJoin(conductores, eq(conductores.id, documentosControl.conductorId)).leftJoin(personas, eq(personas.id, conductores.personaId))
    .where(and(isNull(documentosControl.eliminadoEn), isNull(buses.eliminadoEn), isNull(personas.eliminadoEn),
      titular === "bus" ? isNotNull(documentosControl.busId) : titular === "conductor" ? isNotNull(documentosControl.conductorId) : undefined,
      tipo ? eq(documentosControl.tipo, tipo) : undefined))
    .orderBy(asc(documentosControl.fechaVencimiento), asc(documentosControl.id));
}

export async function listarPlanes(tx: DbOTx = db) {
  return tx.select({ plan: planesMantencion, numero: buses.numero, kilometraje: kmActualSql }).from(planesMantencion)
    .innerJoin(buses, eq(planesMantencion.busId, buses.id)).where(isNull(buses.eliminadoEn))
    .orderBy(asc(buses.numero), asc(planesMantencion.tarea));
}

export async function listarMantenciones(limite?: number) {
  const consulta = db.select({ mantencion: mantenciones, numero: buses.numero }).from(mantenciones)
    .innerJoin(buses, eq(mantenciones.busId, buses.id)).orderBy(desc(mantenciones.fecha), desc(mantenciones.id));
  return limite ? consulta.limit(limite) : consulta;
}

export async function guardarConductor(ctx: Contexto, registroId: number | null, entrada: unknown, txExterna?: Tx) {
  const datos = z.object({ personaId: id, claseLicencia: textoOpcional, observaciones: textoOpcional, activo: z.boolean(), motivo: textoOpcional }).parse(entrada);
  const { motivo: razon, ...campos } = datos;
  const guardar = async (tx: Tx) => {
    const [persona] = await tx.select().from(personas).where(and(eq(personas.id, datos.personaId), isNull(personas.eliminadoEn)));
    if (!persona) throw new ErrorNegocio("Selecciona una persona vigente.");
    const [antes] = registroId === null ? [] : await tx.select().from(conductores).where(eq(conductores.id, registroId)).for("update");
    if (registroId !== null && (!antes || antes.personaId !== datos.personaId)) throw new ErrorNegocio("La ficha de conductor no está disponible.");
    const [despues] = antes
      ? await tx.update(conductores).set(campos).where(eq(conductores.id, antes.id)).returning()
      : await tx.insert(conductores).values(campos).onConflictDoNothing().returning();
    if (!despues) throw new ErrorNegocio("Esta persona ya tiene ficha de conductor.");
    await auditar(tx, ctx, { accion: antes ? "actualizar" : "crear", entidad: "conductor", entidadId: despues.id, antes, despues, motivo: antes ? motivo.parse(razon) : razon });
    return despues;
  };
  return txExterna ? guardar(txExterna) : db.transaction(guardar);
}

async function comprobarBus(tx: Tx, busId: number) {
  const [bus] = await tx.select({ id: buses.id }).from(buses).where(and(eq(buses.id, busId), isNull(buses.eliminadoEn))).for("update");
  if (!bus) throw new ErrorNegocio("Selecciona un bus vigente.");
}

const esquemaControl = z.object({
  busId: idOpcional, conductorId: idOpcional, tipo: z.string().trim().min(1).max(120),
  fechaEmision: fechaOpcional, fechaVencimiento: fecha, observaciones: textoOpcional, motivo: textoOpcional,
});

export async function guardarDocumentoControl(ctx: Contexto, registroId: number | null, entrada: unknown, archivo?: File, txExterna?: Tx) {
  const { motivo: razon, ...datos } = esquemaControl.parse(entrada);
  if (Boolean(datos.busId) === Boolean(datos.conductorId)) throw new ErrorNegocio("Selecciona un bus o un conductor.");
  const tipos = datos.busId ? TIPOS_CONTROL_BUS : TIPOS_CONTROL_CONDUCTOR;
  if (!tipos.includes(datos.tipo)) throw new ErrorNegocio("Selecciona un tipo de documento válido para el titular.");
  if (datos.fechaEmision && datos.fechaEmision > datos.fechaVencimiento) throw new ErrorNegocio("El vencimiento debe ser igual o posterior a la emisión.");
  const fuente = archivo?.size ? tipoFuenteDeArchivo(archivo.name, archivo.type) : null;
  if (archivo?.size && fuente !== "pdf" && fuente !== "imagen" && fuente !== "word") throw new ErrorNegocio("Adjunta un PDF, Word o una foto.");
  const motivoCambio = registroId === null ? razon : motivo.parse(razon);

  const guardar = async (tx: Tx) => {
    if (datos.busId) await comprobarBus(tx, datos.busId);
    if (datos.conductorId) {
      const [c] = await tx.select({ id: conductores.id }).from(conductores).innerJoin(personas, eq(personas.id, conductores.personaId))
        .where(and(eq(conductores.id, datos.conductorId), isNull(personas.eliminadoEn)));
      if (!c) throw new ErrorNegocio("Selecciona un conductor vigente.");
    }
    const [antes] = registroId === null ? [] : await tx.select().from(documentosControl)
      .where(and(eq(documentosControl.id, registroId), isNull(documentosControl.eliminadoEn))).for("update");
    if (registroId !== null && !antes) throw new ErrorNegocio("El documento no está disponible.");
    const adjunto = archivo?.size ? await guardarArchivo(archivo, { tipo: "certificado", usuarioId: ctx.usuarioId, entidadTipo: "documento_control", entidadId: antes?.id }, tx) : null;
    const campos = { ...datos, documentoId: adjunto?.documento.id ?? antes?.documentoId ?? null };
    const [despues] = antes ? await tx.update(documentosControl).set(campos).where(eq(documentosControl.id, antes.id)).returning()
      : await tx.insert(documentosControl).values(campos).returning();
    await auditar(tx, ctx, { accion: antes ? "actualizar" : "crear", entidad: "documento_control", entidadId: despues.id, antes, despues, motivo: motivoCambio });
    return despues;
  };
  return txExterna ? guardar(txExterna) : db.transaction(guardar);
}

export async function archivarDocumentoControl(ctx: Contexto, registroId: number, entrada: unknown) {
  const razon = motivo.parse(entrada);
  await db.transaction(async (tx) => {
    const [antes] = await tx.select().from(documentosControl).where(and(eq(documentosControl.id, registroId), isNull(documentosControl.eliminadoEn))).for("update");
    if (!antes) throw new ErrorNegocio("El documento ya no está vigente.");
    const [despues] = await tx.update(documentosControl).set({ eliminadoEn: new Date() }).where(eq(documentosControl.id, registroId)).returning();
    await auditar(tx, ctx, { accion: "archivar", entidad: "documento_control", entidadId: registroId, antes, despues, motivo: razon });
  });
}

async function anotarKm(tx: Tx, ctx: Contexto, datos: { busId: number; fecha: string; kilometraje: number }) {
  const [limites] = await tx.select({
    anterior: sql<number | null>`max(${lecturasKilometraje.kilometraje}) filter (where ${lecturasKilometraje.fecha} <= ${datos.fecha})`,
    siguiente: sql<number | null>`min(${lecturasKilometraje.kilometraje}) filter (where ${lecturasKilometraje.fecha} > ${datos.fecha})`,
  }).from(lecturasKilometraje).where(eq(lecturasKilometraje.busId, datos.busId));
  if ((limites.anterior !== null && datos.kilometraje < limites.anterior) || (limites.siguiente !== null && datos.kilometraje > limites.siguiente)) {
    throw new ErrorNegocio("El kilometraje no coincide con las lecturas registradas antes o después de esa fecha.");
  }
  const [lectura] = await tx.insert(lecturasKilometraje).values(datos).returning();
  await auditar(tx, ctx, { accion: "crear", entidad: "lectura_kilometraje", entidadId: lectura.id, despues: lectura });
}

export async function registrarKilometraje(ctx: Contexto, entrada: unknown) {
  const datos = z.object({ busId: id, fecha, kilometraje: entero }).parse(entrada);
  if (datos.fecha > hoy()) throw new ErrorNegocio("La fecha de la lectura debe ser hoy o anterior.");
  await db.transaction(async (tx) => {
    await comprobarBus(tx, datos.busId);
    await anotarKm(tx, ctx, datos);
  });
}

export async function guardarPlan(ctx: Contexto, registroId: number | null, entrada: unknown) {
  const { motivo: razon, ...datos } = z.object({ busId: id, tarea: z.string().trim().min(1).max(120), proximaFecha: fechaOpcional,
    proximoKm: enteroOpcional, intervaloDias: idOpcional, intervaloKm: idOpcional, activo: z.boolean(), motivo: textoOpcional }).parse(entrada);
  if (datos.activo && !datos.proximaFecha && datos.proximoKm === null) throw new ErrorNegocio("Indica una fecha o un kilometraje objetivo.");
  if (datos.intervaloDias && !datos.proximaFecha) throw new ErrorNegocio("Indica la primera fecha de mantención para usar un intervalo de días.");
  if (datos.intervaloKm && datos.proximoKm === null) throw new ErrorNegocio("Indica el primer kilometraje objetivo para usar un intervalo en km.");
  const motivoCambio = registroId === null ? razon : motivo.parse(razon);
  return db.transaction(async (tx) => {
    await comprobarBus(tx, datos.busId);
    const [antes] = registroId === null ? [] : await tx.select().from(planesMantencion).where(eq(planesMantencion.id, registroId)).for("update");
    if (registroId !== null && (!antes || antes.busId !== datos.busId)) throw new ErrorNegocio("El plan de mantención no está disponible.");
    const [despues] = antes ? await tx.update(planesMantencion).set(datos).where(eq(planesMantencion.id, antes.id)).returning()
      : await tx.insert(planesMantencion).values(datos).returning();
    await auditar(tx, ctx, { accion: antes ? "actualizar" : "crear", entidad: "plan_mantencion", entidadId: despues.id, antes, despues, motivo: motivoCambio });
    return despues;
  });
}

export async function completarMantencion(ctx: Contexto, entrada: unknown) {
  const datos = z.object({ planId: id, fecha, kilometraje: enteroOpcional, costo: entero, observaciones: textoOpcional }).parse(entrada);
  if (datos.fecha > hoy()) throw new ErrorNegocio("Registra la mantención después de realizarla.");
  return db.transaction(async (tx) => {
    const [referencia] = await tx.select({ busId: planesMantencion.busId }).from(planesMantencion).where(eq(planesMantencion.id, datos.planId));
    if (!referencia) throw new ErrorNegocio("El plan no existe.");
    await comprobarBus(tx, referencia.busId);
    const [plan] = await tx.select().from(planesMantencion).where(eq(planesMantencion.id, datos.planId)).for("update");
    if (!plan?.activo) throw new ErrorNegocio("El plan ya no está activo.");
    const [ultima] = await tx.select({ fecha: mantenciones.fecha }).from(mantenciones).where(eq(mantenciones.planId, plan.id))
      .orderBy(desc(mantenciones.fecha), desc(mantenciones.id)).limit(1);
    if (ultima && ultima.fecha >= datos.fecha) throw new ErrorNegocio("Ya existe una mantención de este plan para esta fecha o una posterior.");
    if (plan.intervaloKm && datos.kilometraje === null) throw new ErrorNegocio("Indica el kilometraje para calcular el próximo plazo.");
    const proximoKm = plan.intervaloKm && datos.kilometraje !== null ? datos.kilometraje + plan.intervaloKm : null;
    if (proximoKm !== null && proximoKm > 2147483647) throw new ErrorNegocio("El próximo kilometraje excede el rango permitido.");
    if (datos.kilometraje !== null) await anotarKm(tx, ctx, { busId: plan.busId, fecha: datos.fecha, kilometraje: datos.kilometraje });
    const [realizada] = await tx.insert(mantenciones).values({ ...datos, busId: plan.busId, tarea: plan.tarea }).returning();
    const proximaFecha = plan.intervaloDias ? sumarDias(datos.fecha, plan.intervaloDias) : null;
    const [actualizado] = await tx.update(planesMantencion).set({ proximaFecha, proximoKm, activo: proximaFecha !== null || proximoKm !== null })
      .where(eq(planesMantencion.id, plan.id)).returning();
    await auditar(tx, ctx, { accion: "crear", entidad: "mantencion", entidadId: realizada.id, despues: realizada });
    await auditar(tx, ctx, { accion: "actualizar", entidad: "plan_mantencion", entidadId: plan.id, antes: plan, despues: actualizado, motivo: `Mantención #${realizada.id} realizada` });
    return realizada;
  });
}
