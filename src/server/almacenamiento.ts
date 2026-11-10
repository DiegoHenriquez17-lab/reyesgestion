import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, type DbOTx } from "@/server/db";
import { documentos } from "@/server/db/schema";
import { entorno } from "@/server/entorno";
import { ErrorNegocio } from "@/server/errores";
import type { TipoDocumento } from "@/lib/constantes";

/**
 * Almacenamiento de archivos en disco local (STORAGE_DIR).
 * Más adelante se puede reemplazar por almacenamiento en la nube (S3/R2)
 * cambiando solo este módulo.
 */
// Rutas dinámicas en tiempo de ejecución (carpeta de archivos subidos): se excluyen del análisis de empaquetado
const raiz = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), entorno.STORAGE_DIR);

export const MIME_PERMITIDOS: Record<string, string[]> = {
  imagen: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  pdf: ["application/pdf"],
  excel: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ],
  word: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

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
  const relativa = path.join(/*turbopackIgnore: true*/ carpeta, `${randomUUID()}${ext}`);
  await mkdir(path.join(/*turbopackIgnore: true*/ raiz(), carpeta), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ raiz(), relativa), buffer);

  const [doc] = await tx
    .insert(documentos)
    .values({
      nombreOriginal: archivo.name.slice(0, 250),
      ruta: relativa.replaceAll("\\", "/"),
      mime: archivo.type || "application/octet-stream",
      tamano: archivo.size,
      sha256,
      tipo: opciones.tipo,
      entidadTipo: opciones.entidadTipo,
      entidadId: opciones.entidadId,
      subidoPor: opciones.usuarioId,
    })
    .returning();
  return { documento: doc, buffer };
}

export async function leerArchivo(ruta: string): Promise<Buffer> {
  const completa = path.resolve(/*turbopackIgnore: true*/ raiz(), ruta);
  // Protección: nunca leer fuera de la carpeta de almacenamiento
  if (!completa.startsWith(raiz() + path.sep)) throw new ErrorNegocio("Ruta de archivo inválida.");
  return readFile(completa);
}
