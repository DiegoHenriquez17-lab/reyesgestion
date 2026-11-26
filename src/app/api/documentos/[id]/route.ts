import { and, eq, isNull } from "drizzle-orm";
import { obtenerUsuarioActual } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { documentos } from "@/server/db/schema";
import { leerArchivo } from "@/server/almacenamiento";

const MIME_VISTA_PREVIA = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Entrega un archivo almacenado SOLO a usuarios con sesión (protección de documentos). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id) || Number(id) > 2147483647) return new Response("No encontrado", { status: 404 });
  const [doc] = await db
    .select()
    .from(documentos)
    .where(and(eq(documentos.id, Number(id)), isNull(documentos.eliminadoEn)));
  if (!doc) return new Response("No encontrado", { status: 404 });
  try {
    const buffer = await leerArchivo(doc.ruta);
    const vistaPrevia = MIME_VISTA_PREVIA.has(doc.mime);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": vistaPrevia ? doc.mime : "application/octet-stream",
        "Content-Disposition": `${vistaPrevia ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.nombreOriginal).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Archivo no disponible", { status: 404 });
  }
}
