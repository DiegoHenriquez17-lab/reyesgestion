import "server-only";
import { createHash } from "node:crypto";
import { tipoFuenteDeArchivo } from "@/server/almacenamiento";
import { auditar, type Contexto } from "@/server/auditoria";
import { db } from "@/server/db";
import { entorno, iaHabilitada } from "@/server/entorno";
import { ErrorNegocio } from "@/server/errores";
import { extraerConIa } from "./ia";
import { textoDeWord } from "./lectores";

export async function proponerDocumento(ctx: Contexto, archivo: File, destino: "documento_flota" | "contrato") {
  if (!iaHabilitada()) throw new ErrorNegocio("Configura las claves de IA para leer el documento.");
  if (!archivo.size) throw new ErrorNegocio("Selecciona un archivo.");
  if (archivo.size > entorno.UPLOAD_MAX_MB * 1024 * 1024) throw new ErrorNegocio(`El archivo supera ${entorno.UPLOAD_MAX_MB} MB.`);
  const tipo = tipoFuenteDeArchivo(archivo.name, archivo.type);
  if (tipo !== "pdf" && tipo !== "imagen" && tipo !== "word") throw new ErrorNegocio("Selecciona un PDF, una foto o un documento Word (.docx).");
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const lectura = await extraerConIa({ buffer, tipo, destino, textoWord: tipo === "word" ? await textoDeWord(buffer) : undefined });
  if (lectura.registros.length !== 1) throw new ErrorNegocio(lectura.registros.length ? "El archivo contiene varios registros. Sepáralos para revisar uno a la vez." : "Información no identificada. Revisa el documento y completa los campos manualmente.");
  const campos = Object.fromEntries(Object.entries(lectura.registros[0].campos).map(([campo, dato]) => [campo, dato.confianza === "alta" ? dato.valor : null]));
  await auditar(db, { ...ctx, origen: "ia" }, { accion: "lectura_ia", entidad: destino,
    resumen: "Lectura de adjunto para revisión", despues: { proveedor: lectura.proveedor, modelo: lectura.modelo, respaldo: lectura.respaldo,
      sha256: createHash("sha256").update(buffer).digest("hex") } });
  return { campos, proveedor: lectura.proveedor, respaldo: lectura.respaldo, advertencias: lectura.advertencias };
}
