import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, type DbOTx } from "@/server/db";
import { documentos } from "@/server/db/schema";
import { entorno } from "@/server/entorno";
import { ErrorNegocio } from "@/server/errores";
import type { TipoDocumento } from "@/lib/constantes";

// Rutas dinámicas en tiempo de ejecución (carpeta de archivos subidos): se excluyen del análisis de empaquetado
const raiz = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), entorno.STORAGE_DIR);
const PREFIJO_REMOTO = "supabase:";

async function solicitarObjeto(ruta: string, operacion: "GET" | "POST" | "DELETE", cuerpo?: Uint8Array<ArrayBuffer>) {
  const clave = entorno.SUPABASE_STORAGE_KEY;
  if (!entorno.SUPABASE_URL || !clave) throw new ErrorNegocio("El almacenamiento de documentos no está configurado.");
  const segmento = ruta.split("/").map(encodeURIComponent).join("/");
  const destino = operacion === "GET" ? "object/authenticated" : "object";
  const url = new URL(`/storage/v1/${destino}/${entorno.SUPABASE_STORAGE_BUCKET}/${segmento}`, entorno.SUPABASE_URL);
  const encabezados = new Headers({ apikey: clave });
  if (!clave.startsWith("sb_secret_")) encabezados.set("Authorization", `Bearer ${clave}`);
  if (cuerpo) encabezados.set("Content-Type", "application/octet-stream");
  const respuesta = await fetch(url, {
    method: operacion, headers: encabezados, body: cuerpo, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!respuesta.ok) throw new ErrorNegocio(`Supabase Storage no pudo completar la operación (HTTP ${respuesta.status}).`);
  return respuesta;
}

export function tipoFuenteDeArchivo(nombre: string, mime: string): "excel" | "csv" | "word" | "pdf" | "imagen" | null {
  const ext = path.extname(nombre).toLowerCase();
  if (ext === ".csv" || mime === "text/csv") return "csv";
  if (ext === ".xlsx" || ext === ".xlsm") return "excel";
  if (ext === ".docx") return "word";
  if (ext === ".pdf" || mime === "application/pdf") return "pdf";
  if ([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].includes(ext) || mime.startsWith("image/")) return "imagen";
  return null;
}

export async function guardarArchivo(
  archivo: File,
  opciones: { tipo: TipoDocumento; usuarioId: number | null; entidadTipo?: string; entidadId?: number },
  tx: DbOTx = db,
) {
  if (!archivo || archivo.size === 0) throw new ErrorNegocio("El archivo está vacío.");
  if (archivo.size > entorno.UPLOAD_MAX_MB * 1024 * 1024) {
    throw new ErrorNegocio(`El archivo supera el máximo de ${entorno.UPLOAD_MAX_MB} MB.`);
  }
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const hoy = new Date();
  const carpeta = path.join(/*turbopackIgnore: true*/ String(hoy.getFullYear()), String(hoy.getMonth() + 1).padStart(2, "0"));
  const ext = path.extname(archivo.name).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
  const relativa = path.join(/*turbopackIgnore: true*/ carpeta, `${randomUUID()}${ext}`).replaceAll("\\", "/");
  const remoto = entorno.STORAGE_DRIVER === "supabase";
  const completa = path.join(/*turbopackIgnore: true*/ raiz(), relativa);
  if (remoto) {
    await solicitarObjeto(relativa, "POST", new Uint8Array(buffer));
  } else {
    await mkdir(path.join(/*turbopackIgnore: true*/ raiz(), carpeta), { recursive: true });
    await writeFile(completa, buffer);
  }

  try {
    const [doc] = await tx.insert(documentos).values({
      nombreOriginal: archivo.name.slice(0, 250),
      ruta: remoto ? `${PREFIJO_REMOTO}${relativa}` : relativa,
      mime: archivo.type || "application/octet-stream",
      tamano: archivo.size,
      sha256,
      tipo: opciones.tipo,
      entidadTipo: opciones.entidadTipo,
      entidadId: opciones.entidadId,
      subidoPor: opciones.usuarioId,
    }).returning();
    return { documento: doc, buffer };
  } catch (error) {
    try {
      if (remoto) await solicitarObjeto(relativa, "DELETE");
      else await unlink(completa);
    } catch {
      console.warn("No se pudo retirar un archivo que quedó sin registro.");
    }
    throw error;
  }
}

export async function leerArchivo(ruta: string): Promise<Buffer> {
  if (ruta.startsWith(PREFIJO_REMOTO)) {
    const relativa = ruta.slice(PREFIJO_REMOTO.length);
    if (!/^\d{4}\/\d{2}\/[a-f0-9-]{36}\.[a-z0-9.]+$/.test(relativa)) throw new ErrorNegocio("Ruta de archivo inválida.");
    const respuesta = await solicitarObjeto(relativa, "GET");
    return Buffer.from(await respuesta.arrayBuffer());
  }
  const completa = path.resolve(/*turbopackIgnore: true*/ raiz(), ruta);
  // Protección: nunca leer fuera de la carpeta de almacenamiento
  if (!completa.startsWith(raiz() + path.sep)) throw new ErrorNegocio("Ruta de archivo inválida.");
  return readFile(completa);
}
