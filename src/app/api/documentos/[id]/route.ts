import { and, eq, isNull } from "drizzle-orm";
import { obtenerUsuarioActual } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { documentos } from "@/server/db/schema";
import { leerArchivo } from "@/server/almacenamiento";

/** Entrega un archivo almacenado SOLO a usuarios con sesión (protección de documentos). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const [doc] = await db
    .select()
    .from(documentos)
    .where(and(eq(documentos.id, Number(id)), isNull(documentos.eliminadoEn)));
  if (!doc) return new Response("No encontrado", { status: 404 });
  try {
    const buffer = await leerArchivo(doc.ruta);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.nombreOriginal)}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Archivo no disponible", { status: 404 });
  }
}
