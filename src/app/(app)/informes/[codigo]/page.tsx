import { notFound } from "next/navigation";
import { requerirUsuario } from "@/server/auth/sesion";
import { generarInforme } from "@/server/informes";
import { BotonEnlace, EncabezadoPagina } from "@/components/ui/basicos";
import { VistaInforme } from "@/components/informe-vista";
import { CATALOGO_INFORMES, type CodigoInforme } from "@/lib/informe";
import { aPeriodo } from "@/lib/fechas";

export default async function PaginaInforme({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ periodo?: string; anio?: string }>;
}) {
  await requerirUsuario();
  const { codigo } = await params;
  const sp = await searchParams;
  const def = CATALOGO_INFORMES.find((i) => i.codigo === codigo);
  if (!def) notFound();
  const periodo = aPeriodo(sp.periodo) ?? undefined;
  const anio = Number(sp.anio) || undefined;
  const informe = await generarInforme(codigo as CodigoInforme, { periodo, anio });
  const query = new URLSearchParams();
  if (sp.periodo) query.set("periodo", sp.periodo);
  if (sp.anio) query.set("anio", sp.anio);

  return (
    <>
      <EncabezadoPagina
        volver={{ href: "/informes", texto: "Informes" }}
        titulo={informe.titulo}
        descripcion={`${informe.subtitulo ? `${informe.subtitulo} · ` : ""}Generado ${informe.generadoEn}`}
        acciones={
          <>
            {def.parametro === "periodo" && (
              <form className="flex gap-2">
                <input type="month" name="periodo" defaultValue={(periodo ?? "").slice(0, 7)} className="campo" />
                <button className="rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">Ver</button>
              </form>
            )}
            {def.parametro === "anio" && (
              <form className="flex gap-2">
                <input type="number" name="anio" defaultValue={anio ?? ""} placeholder="Año" className="campo w-24" />
                <button className="rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">Ver</button>
              </form>
            )}
            <BotonEnlace href={`/api/informes/${codigo}?${query}&formato=pdf&ver=1`} variante="secundario" prefetch={false} target="_blank">
              Ver PDF
            </BotonEnlace>
            <BotonEnlace href={`/api/informes/${codigo}?${query}&formato=pdf`} variante="secundario" prefetch={false}>
              Descargar PDF
            </BotonEnlace>
            <BotonEnlace href={`/api/informes/${codigo}?${query}&formato=xlsx`} variante="secundario" prefetch={false}>
              Descargar Excel
            </BotonEnlace>
          </>
        }
      />
      <VistaInforme informe={informe} />
    </>
  );
}
