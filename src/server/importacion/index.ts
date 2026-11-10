import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { alumnos, importacionFilas, importaciones, personas, usuarios } from "@/server/db/schema";
import { auditar, type Contexto } from "@/server/auditoria";
import { guardarArchivo, leerArchivo, tipoFuenteDeArchivo } from "@/server/almacenamiento";
import { iaHabilitada } from "@/server/entorno";
import { ErrorNegocio } from "@/server/errores";
import { actualizarAlumno, crearAlumno, vincularResponsable } from "@/server/modulos/alumnos";
import { actualizarPersona, obtenerOCrearPersona } from "@/server/modulos/personas";
import { registrarPago } from "@/server/modulos/pagos";
import { proponerMapeo } from "@/lib/importacion-campos";
import { normalizarTexto } from "@/lib/texto";
import type { DecisionFila, DestinoImportacion } from "@/lib/constantes";
import type { DatosPersona } from "@/lib/validaciones";
import { analizarFilaAlumno, analizarFilaPago, aplicarMapeo, type Confianzas } from "./analizar";
import { extraerConIa } from "./ia";
import { leerCsv, leerExcel, tablaDeWord, textoDeWord } from "./lectores";

/**
 * PASO 1 — IMPORTAR: guarda el archivo y lo lee.
 *  - Excel / CSV / Word con tabla → se propone el mapeo de columnas (el usuario lo confirma).
 *  - Foto / PDF / Word sin tabla → la IA extrae los registros y se pasa directo a revisión.
 */
export async function iniciarImportacion(
  ctx: Contexto,
  archivo: File,
  destino: DestinoImportacion,
  opciones: { usarIa?: boolean; indicaciones?: string; verificado?: boolean } = {},
) {
  const tipoFuente = tipoFuenteDeArchivo(archivo.name, archivo.type);
  if (!tipoFuente) throw new ErrorNegocio("Formato no soportado. Usa Excel (.xlsx), CSV, Word (.docx), PDF o una foto (JPG/PNG).");

  const { documento, buffer } = await guardarArchivo(archivo, {
    tipo: tipoFuente === "imagen" ? (destino === "pagos" ? "voucher" : "foto") : tipoFuente === "pdf" ? "otro" : "planilla",
    usuarioId: ctx.usuarioId,
    entidadTipo: "importacion",
  });

  const [imp] = await db
    .insert(importaciones)
    .values({
      tipoFuente,
      destino,
      documentoId: documento.id,
      estado: "analizando",
      creadoPor: ctx.usuarioId,
      opciones: { verificado: opciones.verificado ?? (destino === "pagos" && (tipoFuente === "excel" || tipoFuente === "csv")) },
    })
    .returning();

  try {
    let tabla = null as Awaited<ReturnType<typeof leerCsv>> | null;
    if (tipoFuente === "excel") tabla = await leerExcel(buffer);
    else if (tipoFuente === "csv") tabla = await leerCsv(buffer);
    else if (tipoFuente === "word" && !opciones.usarIa) tabla = await tablaDeWord(buffer);

    if (tabla) {
      if (tabla.filas.length === 0) throw new ErrorNegocio("No se encontraron filas con datos.");
      if (tabla.filas.length > 5000) throw new ErrorNegocio("El archivo tiene más de 5.000 filas; divídelo en partes.");
      await guardarFilasOriginales(imp.id, tabla.filas);
      await db
        .update(importaciones)
        .set({ estado: "en_revision", columnas: tabla.columnas, mapeo: proponerMapeo(tabla.columnas, destino) })
        .where(eq(importaciones.id, imp.id));
      return { id: imp.id, requiereMapeo: true };
    }

    // Lectura con IA
    if (!iaHabilitada()) {
      throw new ErrorNegocio(
        "Este archivo necesita lectura con IA, que aún no está configurada (ANTHROPIC_API_KEY). Mientras tanto puedes cargar la información desde Excel o manualmente.",
      );
    }
    const resultado = await extraerConIa({
      buffer,
      tipo: tipoFuente === "csv" || tipoFuente === "excel" ? "pdf" : tipoFuente,
      destino,
      textoWord: tipoFuente === "word" ? await textoDeWord(buffer) : undefined,
      indicaciones: opciones.indicaciones,
    });
    const filas = resultado.registros.map((r) => {
      const valores: Record<string, unknown> = {};
      const confianzas: Confianzas = {};
      for (const [campo, { valor, confianza }] of Object.entries(r.campos)) {
        if (valor !== null && valor !== "") valores[campo] = valor;
        confianzas[campo] = confianza;
      }
      if (r.nota) valores.__nota = r.nota;
      return { ...valores, __confianzas: confianzas };
    });
    await db
      .update(importaciones)
      .set({ extraccionIa: resultado, columnas: null, mapeo: null })
      .where(eq(importaciones.id, imp.id));
    if (filas.length === 0) {
      throw new ErrorNegocio(
        `La IA no encontró registros en el documento (${resultado.tipo_documento}). ${resultado.advertencias.join(" ")}`.trim(),
      );
    }
    await guardarFilasOriginales(imp.id, filas);
    await analizarImportacion(imp.id);
    await auditar(db, { ...ctx, origen: "ia" }, {
      accion: "lectura_ia",
      entidad: "importacion",
      entidadId: imp.id,
      resumen: `${archivo.name}: ${resultado.tipo_documento} — ${filas.length} registro(s) detectados`,
    });
    return { id: imp.id, requiereMapeo: false };
  } catch (e) {
    await db
      .update(importaciones)
      .set({ estado: "error", error: e instanceof Error ? e.message : String(e) })
      .where(eq(importaciones.id, imp.id));
    throw e;
  }
}

async function guardarFilasOriginales(importacionId: number, filas: Record<string, unknown>[]) {
  await db.delete(importacionFilas).where(eq(importacionFilas.importacionId, importacionId));
  const valores = filas.map((f, i) => ({
    importacionId,
    numeroFila: i + 1,
    datosOriginales: JSON.parse(JSON.stringify(f)) as Record<string, unknown>,
    datos: {},
    accionPropuesta: "requiere_revision" as const,
  }));
  for (let i = 0; i < valores.length; i += 500) await db.insert(importacionFilas).values(valores.slice(i, i + 500));
}

/** PASO 2 — confirmar mapeo de columnas (solo Excel/CSV/Word con tabla). */
export async function confirmarMapeo(ctx: Contexto, id: number, mapeo: Record<string, string | null>, opciones: { verificado?: boolean }) {
  const imp = await obtenerImportacionBase(id);
  if (imp.estado !== "en_revision") throw new ErrorNegocio("La importación ya no está en revisión.");
  const usados = Object.values(mapeo).filter(Boolean);
  if (imp.destino === "alumnos" && !usados.includes("alumno_nombre_completo") && !usados.includes("alumno_nombres")) {
    throw new ErrorNegocio("Indica qué columna contiene el nombre del alumno.");
  }
  if (imp.destino === "pagos" && (!usados.includes("monto") || !usados.includes("fecha_pago"))) {
    throw new ErrorNegocio("Indica qué columnas contienen la fecha y el monto del pago.");
  }
  await db
    .update(importaciones)
    .set({ mapeo, opciones: { ...(imp.opciones ?? {}), verificado: opciones.verificado ?? imp.opciones?.verificado } })
    .where(eq(importaciones.id, id));
  await analizarImportacion(id);
  void ctx;
}

/** PASO 3 — ANALIZAR: normaliza cada fila, detecta duplicados y cambios, y propone una acción. */
export async function analizarImportacion(id: number) {
  const imp = await obtenerImportacionBase(id);
  const filas = await db
    .select()
    .from(importacionFilas)
    .where(and(eq(importacionFilas.importacionId, id), eq(importacionFilas.estado, "pendiente")))
    .orderBy(asc(importacionFilas.numeroFila));
  const rutsVistos = new Set<string>();
  const operacionesVistas = new Set<string>();
  const resumen: Record<string, number> = {};

  for (const f of filas) {
    const { __confianzas, __nota, ...originales } = f.datosOriginales as Record<string, unknown> & {
      __confianzas?: Confianzas;
      __nota?: string;
    };
    const mapeados = imp.mapeo ? aplicarMapeo(originales, imp.mapeo) : originales;
    const r =
      imp.destino === "alumnos"
        ? await analizarFilaAlumno(mapeados, { rutsVistos, confianzas: __confianzas })
        : await analizarFilaPago(mapeados, { operacionesVistas, confianzas: __confianzas });
    if (__nota) r.advertencias.push(`Nota de la lectura: ${__nota}`);
    resumen[r.accion] = (resumen[r.accion] ?? 0) + 1;
    await db
      .update(importacionFilas)
      .set({
        datos: r.datos,
        accionPropuesta: r.accion,
        registroExistenteId: r.registroExistenteId,
        registroExistente: r.registroExistente,
        diferencias: r.diferencias,
        advertencias: r.advertencias,
        decision: r.decision,
        error: null,
      })
      .where(eq(importacionFilas.id, f.id));
  }
  await db.update(importaciones).set({ estado: "en_revision", resumen, error: null }).where(eq(importaciones.id, id));
}

export async function decidirFila(id: number, filaId: number, decision: DecisionFila | null, conciliar?: boolean) {
  const [f] = await db
    .select()
    .from(importacionFilas)
    .where(and(eq(importacionFilas.id, filaId), eq(importacionFilas.importacionId, id)));
  if (!f || f.estado !== "pendiente") throw new ErrorNegocio("La fila ya fue procesada.");
  const datos = conciliar === undefined ? f.datos : { ...f.datos, conciliar };
  await db.update(importacionFilas).set({ decision, datos }).where(eq(importacionFilas.id, filaId));
}

/** Aplica la misma decisión a todas las filas pendientes con cierta acción propuesta. */
export async function decidirPorAccion(id: number, accion: string, decision: DecisionFila) {
  await db
    .update(importacionFilas)
    .set({ decision })
    .where(
      and(
        eq(importacionFilas.importacionId, id),
        eq(importacionFilas.estado, "pendiente"),
        eq(importacionFilas.accionPropuesta, accion as never),
      ),
    );
}

/**
 * PASO 4 — GUARDAR: aplica SOLO las filas con decisión del usuario.
 * Cada fila se guarda en su propia transacción: si una falla, el resto continúa y el error queda anotado.
 */
export async function aplicarImportacion(ctxUi: Contexto, id: number) {
  const ctx: Contexto = { ...ctxUi, origen: "importacion" };
  const imp = await obtenerImportacionBase(id);
  if (imp.estado !== "en_revision") throw new ErrorNegocio("La importación no está en revisión.");
  const filas = await db
    .select()
    .from(importacionFilas)
    .where(and(eq(importacionFilas.importacionId, id), eq(importacionFilas.estado, "pendiente")))
    .orderBy(asc(importacionFilas.numeroFila));

  const conteo = { aplicadas: 0, omitidas: 0, errores: 0, sinDecision: 0 };
  for (const f of filas) {
    if (!f.decision) {
      conteo.sinDecision++;
      continue;
    }
    if (f.decision === "omitir" || f.decision === "mantener") {
      await db.update(importacionFilas).set({ estado: "omitida" }).where(eq(importacionFilas.id, f.id));
      conteo.omitidas++;
      continue;
    }
    try {
      const resultadoId = await db.transaction(async (tx) => {
        if (imp.destino === "alumnos") return aplicarFilaAlumno(ctx, tx, f);
        return aplicarFilaPago(ctx, tx, f, imp);
      });
      await db
        .update(importacionFilas)
        .set({ estado: "aplicada", resultadoId, error: null })
        .where(eq(importacionFilas.id, f.id));
      conteo.aplicadas++;
    } catch (e) {
      await db
        .update(importacionFilas)
        .set({ error: e instanceof Error ? e.message : String(e) })
        .where(eq(importacionFilas.id, f.id));
      conteo.errores++;
    }
  }
  const terminado = conteo.sinDecision === 0 && conteo.errores === 0;
  await db
    .update(importaciones)
    .set({
      estado: terminado ? "aplicada" : "en_revision",
      aplicadoPor: ctx.usuarioId,
      aplicadaEn: terminado ? new Date() : null,
    })
    .where(eq(importaciones.id, id));
  await auditar(db, ctx, {
    accion: "aplicar_importacion",
    entidad: "importacion",
    entidadId: id,
    resumen: `Importación #${id}: ${conteo.aplicadas} aplicadas, ${conteo.omitidas} omitidas, ${conteo.errores} con error, ${conteo.sinDecision} sin decisión`,
  });
  return conteo;
}

type Fila = typeof importacionFilas.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function aplicarFilaAlumno(ctx: Contexto, tx: Tx, f: Fila): Promise<number> {
  const d = f.datos as {
    persona: DatosPersona;
    alumno: Record<string, unknown>;
    apoderado: (DatosPersona & { parentesco?: string | null }) | null;
    personaExistenteId?: number;
  };
  const datosAlumno = {
    establecimiento: d.alumno.establecimiento,
    curso: d.alumno.curso,
    busId: d.alumno.busId,
    servicioId: d.alumno.servicioId,
    tarifaMensual: d.alumno.tarifaMensual ?? 0,
    diaVencimiento: d.alumno.diaVencimiento,
    observaciones: d.alumno.observaciones,
  };

  const vincularApoderado = async (alumnoId: number) => {
    if (!d.apoderado) return;
    let personaAp = null as Awaited<ReturnType<typeof obtenerOCrearPersona>> | null;
    if (!d.apoderado.rut) {
      // Sin RUT: reutiliza a un apoderado ya existente con el mismo nombre (hermanos)
      const mismo = await tx
        .select()
        .from(personas)
        .where(
          and(
            isNull(personas.eliminadoEn),
            eq(personas.textoBusqueda, normalizarTexto(`${d.apoderado.nombres} ${d.apoderado.apellidos}`)),
          ),
        );
      if (mismo.length === 1) personaAp = mismo[0];
    }
    personaAp ??= await obtenerOCrearPersona(ctx, { ...d.apoderado, observaciones: null, direccion: null, comuna: null }, tx);
    await vincularResponsable(ctx, alumnoId, personaAp.id, { esApoderado: true, esTitular: true, esPagador: true, parentesco: d.apoderado.parentesco ?? null }, tx);
  };

  if (f.decision === "crear") {
    const alumno = await crearAlumno(
      ctx,
      {
        personaId: d.personaExistenteId && f.accionPropuesta !== "posible_duplicado" ? d.personaExistenteId : null,
        persona: d.persona,
        alumno: { ...datosAlumno, estado: "activo" },
      },
      tx,
    );
    await vincularApoderado(alumno.id);
    return alumno.id;
  }

  // actualizar / fusionar sobre el registro existente
  let alumnoId = f.registroExistenteId;
  if (!alumnoId && d.personaExistenteId) {
    const a = await crearAlumno(ctx, { personaId: d.personaExistenteId, alumno: { ...datosAlumno, estado: "activo" } }, tx);
    alumnoId = a.id;
  }
  if (!alumnoId) throw new ErrorNegocio("No hay registro existente para actualizar.");
  const [actual] = await tx.select().from(alumnos).where(eq(alumnos.id, alumnoId));
  const [personaActual] = await tx.select().from(personas).where(eq(personas.id, actual.personaId));
  const soloVacios = f.decision === "fusionar";
  const elegir = <T,>(actualV: T, nuevoV: T | null | undefined) =>
    nuevoV === null || nuevoV === undefined || nuevoV === "" ? actualV : soloVacios && actualV !== null && actualV !== "" && actualV !== 0 ? actualV : nuevoV;

  await actualizarPersona(
    ctx,
    personaActual.id,
    {
      rut: elegir(personaActual.rut, d.persona.rut),
      direccion: elegir(personaActual.direccion, d.persona.direccion),
      comuna: elegir(personaActual.comuna, d.persona.comuna),
    },
    `Importación #${f.importacionId}, fila ${f.numeroFila}`,
    tx,
  );
  await actualizarAlumno(
    ctx,
    alumnoId,
    {
      establecimiento: elegir(actual.establecimiento, datosAlumno.establecimiento as string | null),
      curso: elegir(actual.curso, datosAlumno.curso as string | null),
      busId: elegir(actual.busId, datosAlumno.busId as number | null) ?? "",
      servicioId: elegir(actual.servicioId, datosAlumno.servicioId as number | null) ?? "",
      tarifaMensual: elegir(actual.tarifaMensual, d.alumno.tarifaMensual as number | null),
      diaVencimiento: elegir(actual.diaVencimiento, datosAlumno.diaVencimiento as number | null) ?? "",
    },
    `Importación #${f.importacionId}, fila ${f.numeroFila} (${f.decision === "fusionar" ? "fusión" : "actualización"})`,
    tx,
  );
  await vincularApoderado(alumnoId);
  return alumnoId;
}

async function aplicarFilaPago(ctx: Contexto, tx: Tx, f: Fila, imp: typeof importaciones.$inferSelect): Promise<number> {
  const d = f.datos as Record<string, unknown> & {
    sugerencia?: { alumnoId: number; pagadorPersonaId: number | null; aplicaciones: { mensualidadId: number; monto: number }[] } | null;
    conciliar?: boolean;
  };
  const conciliar = !!d.conciliar && !!d.sugerencia;
  const esVoucher = imp.tipoFuente === "imagen" || imp.tipoFuente === "pdf";
  const pago = await registrarPago(
    ctx,
    {
      datos: {
        fechaPago: d.fechaPago,
        monto: d.monto,
        medio: d.medio ?? "transferencia",
        banco: d.banco,
        numeroOperacion: d.numeroOperacion,
        nombreOrigen: d.nombreOrigen,
        rutOrigen: d.rutOrigen,
        alumnoId: conciliar ? d.sugerencia!.alumnoId : null,
        pagadorId: conciliar ? d.sugerencia!.pagadorPersonaId : null,
        verificado: !!imp.opciones?.verificado,
        observaciones: d.observaciones,
      },
      origen: esVoucher ? "voucher" : imp.opciones?.verificado ? "excel_banco" : "importacion",
      documentoId: esVoucher ? imp.documentoId : null,
      importacionId: imp.id,
      aplicaciones: conciliar ? d.sugerencia!.aplicaciones.map((a) => ({ mensualidadId: a.mensualidadId, monto: a.monto })) : [],
      permitirDuplicado: f.accionPropuesta === "posible_duplicado" && f.decision === "crear",
      motivo: `Importación #${imp.id}, fila ${f.numeroFila}`,
    },
    tx,
  );
  return pago.id;
}

export async function cancelarImportacion(ctx: Contexto, id: number) {
  await db.update(importaciones).set({ estado: "cancelada" }).where(eq(importaciones.id, id));
  await auditar(db, ctx, { accion: "cancelar_importacion", entidad: "importacion", entidadId: id, resumen: `Importación #${id} cancelada` });
}

async function obtenerImportacionBase(id: number) {
  const [imp] = await db.select().from(importaciones).where(eq(importaciones.id, id));
  if (!imp) throw new ErrorNegocio("La importación no existe.");
  return imp;
}

export async function obtenerImportacion(id: number) {
  const imp = await db.query.importaciones.findFirst({ where: (i, { eq }) => eq(i.id, id) });
  if (!imp) return null;
  const filas = await db.select().from(importacionFilas).where(eq(importacionFilas.importacionId, id)).orderBy(asc(importacionFilas.numeroFila));
  const documento = imp.documentoId ? await db.query.documentos.findFirst({ where: (d, { eq }) => eq(d.id, imp.documentoId!) }) : null;
  return { importacion: imp, filas, documento };
}

export async function listarImportaciones() {
  return db
    .select({ imp: importaciones, usuario: usuarios.nombre })
    .from(importaciones)
    .leftJoin(usuarios, eq(usuarios.id, importaciones.creadoPor))
    .orderBy(desc(importaciones.creadoEn))
    .limit(50);
}

export async function archivoDeImportacion(id: number) {
  const r = await obtenerImportacion(id);
  if (!r?.documento) return null;
  return { documento: r.documento, buffer: await leerArchivo(r.documento.ruta) };
}

