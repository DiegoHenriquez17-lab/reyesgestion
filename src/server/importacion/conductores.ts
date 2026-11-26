import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NO_IDENTIFICADO, type DecisionFila } from "@/lib/constantes";
import { parsearFecha } from "@/lib/fechas";
import { nombreCompleto } from "@/lib/formato";
import { normalizarRut, rutEsValido } from "@/lib/rut";
import { capitalizarNombre, coincidenciaNombres, separarNombre } from "@/lib/texto";
import type { Contexto } from "@/server/auditoria";
import { db, type DbOTx, type Tx } from "@/server/db";
import { conductores, documentosControl, personas } from "@/server/db/schema";
import { ErrorNegocio } from "@/server/errores";
import { guardarConductor, guardarDocumentoControl } from "@/server/modulos/flota";
import { actualizarPersona, crearPersona, posiblesDuplicados } from "@/server/modulos/personas";
import type { Confianzas, ResultadoAnalisis } from "./analizar";

const texto = (valor: unknown) => valor == null ? null : String(valor).trim() || null;

async function licencia(tx: DbOTx, conductorId: number) {
  const [actual] = await tx.select().from(documentosControl).where(and(eq(documentosControl.conductorId, conductorId),
    eq(documentosControl.tipo, "Licencia"), isNull(documentosControl.eliminadoEn))).orderBy(desc(documentosControl.fechaVencimiento), desc(documentosControl.id)).limit(1);
  return actual;
}

export async function analizarConductor(m: Record<string, unknown>, confianzas?: Confianzas): Promise<ResultadoAnalisis> {
  const nombre = texto(m.conductor_nombre);
  const advertencias = Object.entries(confianzas ?? {}).filter(([, grado]) => grado !== "alta").map(([campo]) => `${campo.replaceAll("_", " ")}: ${NO_IDENTIFICADO}.`);
  if (!nombre) return { datos: {}, accion: "requiere_revision", registroExistente: null, registroExistenteId: null,
    diferencias: [], advertencias: [...advertencias, `Nombre: ${NO_IDENTIFICADO}.`], decision: null };
  const separado = separarNombre(nombre);
  const rut = texto(m.conductor_rut);
  const registrado = rut && rutEsValido(rut) ? normalizarRut(rut) : null;
  if (rut && !registrado) advertencias.push("RUT inválido. Revísalo antes de guardar.");
  const persona = { nombres: capitalizarNombre(separado.nombres), apellidos: capitalizarNombre(separado.apellidos), rut: registrado,
    telefono: texto(m.telefono), direccion: texto(m.direccion) };
  const claseLicencia = texto(m.clase_licencia);
  const fechaVencimiento = parsearFecha(m.vencimiento_licencia);
  if (texto(m.vencimiento_licencia) && !fechaVencimiento) advertencias.push("Vencimiento inválido. Indica día, mes y año.");
  const observaciones = texto(m.observaciones);
  const [coincidencia] = await posiblesDuplicados(persona, { limite: 1 });
  const d = { persona, claseLicencia, fechaVencimiento, observaciones, personaExistenteId: coincidencia?.persona.id ?? null };
  if (!coincidencia) return { datos: d, accion: advertencias.length ? "requiere_revision" : "crear", registroExistente: null,
    registroExistenteId: null, diferencias: [], advertencias, decision: advertencias.length ? null : "crear" };

  const [actual] = await db.select().from(conductores).where(eq(conductores.personaId, coincidencia.persona.id));
  const doc = actual ? await licencia(db, actual.id) : null;
  const registroExistente = { nombre: nombreCompleto(coincidencia.persona), personaId: coincidencia.persona.id, clase: actual?.claseLicencia ?? null };
  const mismoRut = coincidencia.motivo === "Mismo RUT";
  const conflicto = mismoRut && coincidenciaNombres(nombre, registroExistente.nombre) < 0.5;
  const comparables = [
    { campo: "RUT", actual: coincidencia.persona.rut, nuevo: persona.rut }, { campo: "Teléfono", actual: coincidencia.persona.telefono, nuevo: persona.telefono },
    { campo: "Domicilio", actual: coincidencia.persona.direccion, nuevo: persona.direccion }, { campo: "Clase de licencia", actual: actual?.claseLicencia ?? null, nuevo: claseLicencia },
    { campo: "Vencimiento", actual: doc?.fechaVencimiento ?? null, nuevo: fechaVencimiento }, { campo: "Observaciones", actual: actual?.observaciones ?? null, nuevo: observaciones },
  ];
  const diferencias = comparables.filter((c) => c.nuevo !== null && c.nuevo !== c.actual);
  if (!mismoRut || conflicto) {
    advertencias.push(conflicto ? `El RUT pertenece a ${registroExistente.nombre}. Corrige la fila para crear otro conductor.` : `Posible coincidencia con ${registroExistente.nombre}.`);
    return { datos: d, accion: "posible_duplicado", registroExistente, registroExistenteId: actual?.id ?? null, diferencias, advertencias, decision: null };
  }
  if (!actual) return { datos: d, accion: "crear", registroExistente, registroExistenteId: null, diferencias, advertencias, decision: null };
  return { datos: d, accion: cambios(diferencias, advertencias), registroExistente, registroExistenteId: actual.id, diferencias, advertencias,
    decision: diferencias.length || advertencias.length ? null : "omitir" };
}

function cambios(diferencias: ResultadoAnalisis["diferencias"], advertencias: string[]) {
  if (advertencias.length) return "requiere_revision";
  return diferencias.length ? "actualizar" : "sin_cambios";
}

export async function aplicarConductor(ctx: Contexto, tx: Tx, datos: Record<string, unknown>, decision: DecisionFila, motivo: string) {
  const d = datos as { persona?: { nombres: string; apellidos: string; rut: string | null; telefono: string | null; direccion: string | null };
    personaExistenteId: number | null; claseLicencia: string | null; fechaVencimiento: string | null; observaciones: string | null };
  if (!d.persona) throw new ErrorNegocio("Corrige el nombre del conductor antes de guardar.");
  const [existente] = d.personaExistenteId ? await tx.select().from(personas).where(and(eq(personas.id, d.personaExistenteId), isNull(personas.eliminadoEn))) : [];
  const [ficha] = existente ? await tx.select().from(conductores).where(eq(conductores.personaId, existente.id)) : [];
  const reutilizar = existente && (decision !== "crear" || (!ficha && d.persona.rut !== null && d.persona.rut === existente.rut && coincidenciaNombres(nombreCompleto(d.persona), nombreCompleto(existente)) >= 0.5));
  if (!reutilizar && decision !== "crear") throw new ErrorNegocio("No se encontró la persona que se iba a actualizar.");
  const elegir = (actual: string | null | undefined, nuevo: string | null) => (decision === "fusionar" ? actual ?? nuevo : nuevo ?? actual) ?? null;
  const persona = reutilizar ? await actualizarPersona(ctx, existente.id, {
    rut: elegir(existente.rut, d.persona.rut), telefono: elegir(existente.telefono, d.persona.telefono), direccion: elegir(existente.direccion, d.persona.direccion),
  }, motivo, tx) : await crearPersona(ctx, d.persona, tx);
  const actual = reutilizar ? ficha : undefined;
  const c = await guardarConductor(ctx, actual?.id ?? null, { personaId: persona.id, claseLicencia: elegir(actual?.claseLicencia, d.claseLicencia),
    observaciones: elegir(actual?.observaciones, d.observaciones), activo: actual?.activo ?? true, motivo }, tx);
  if (d.fechaVencimiento) {
    const doc = await licencia(tx, c.id);
    if (!doc || (doc.fechaVencimiento !== d.fechaVencimiento && decision !== "fusionar")) {
      await guardarDocumentoControl(ctx, doc?.id ?? null, { conductorId: c.id, tipo: "Licencia", fechaEmision: doc?.fechaEmision,
        fechaVencimiento: d.fechaVencimiento, observaciones: doc?.observaciones, motivo }, undefined, tx);
    }
  }
  return c.id;
}
