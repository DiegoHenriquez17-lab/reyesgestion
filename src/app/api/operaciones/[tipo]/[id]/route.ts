import { obtenerUsuarioActual } from "@/server/auth/sesion";
import { generarDocumentoOperacion } from "@/server/informes/operaciones";
import { informeAPdf } from "@/server/informes/exportar";

export async function GET(_: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  if (!await obtenerUsuarioActual()) return new Response("No autorizado", { status: 401 });
  const { tipo, id } = await params;
  if ((tipo !== "cotizacion" && tipo !== "contrato") || !/^\d{1,10}$/.test(id) || Number(id) < 1 || Number(id) > 2147483647) {
    return new Response("Documento no encontrado", { status: 404 });
  }
  const documento = await generarDocumentoOperacion(tipo, Number(id));
  if (!documento) return new Response("Documento no encontrado", { status: 404 });
  return new Response(new Uint8Array(informeAPdf(documento)), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${tipo}-${id}.pdf"`, "Cache-Control": "private, no-store",
  } });
}
