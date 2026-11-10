import { obtenerUsuarioActual } from "@/server/auth/sesion";
import { generarInforme } from "@/server/informes";
import { informeAExcel, informeAPdf } from "@/server/informes/exportar";
import { CATALOGO_INFORMES, type CodigoInforme } from "@/lib/informe";
import { aPeriodo } from "@/lib/fechas";

/** Descarga de informes: /api/informes/recaudacion?periodo=2027-08&formato=pdf|xlsx */
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return new Response("No autorizado", { status: 401 });
  const { codigo } = await params;
  if (!CATALOGO_INFORMES.some((i) => i.codigo === codigo)) return new Response("Informe no existe", { status: 404 });
  const url = new URL(request.url);
  const formato = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "pdf";
  const periodo = aPeriodo(url.searchParams.get("periodo")) ?? undefined;
  const anio = Number(url.searchParams.get("anio")) || undefined;
  const informe = await generarInforme(codigo as CodigoInforme, { periodo, anio });
  const nombre = `${informe.titulo.replace(/[^\p{L}\p{N} -]/gu, "").replace(/\s+/g, "_")}.${formato}`;
  const cuerpo = formato === "xlsx" ? await informeAExcel(informe) : informeAPdf(informe);
  return new Response(new Uint8Array(cuerpo), {
    headers: {
      "Content-Type": formato === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      // ?ver=1 abre el PDF en el navegador en vez de descargarlo
      "Content-Disposition": `${url.searchParams.get("ver") === "1" && formato === "pdf" ? "inline" : "attachment"}; filename="${encodeURIComponent(nombre)}"`,
      "Cache-Control": "no-store",
    },
  });
}
