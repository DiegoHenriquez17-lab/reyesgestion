import { requerirUsuario } from "@/server/auth/sesion";
import { hoy } from "@/server/fechas";
import { EncabezadoPagina } from "@/components/ui/basicos";
import { CATALOGO_INFORMES } from "@/lib/informe";

export const metadata = { title: "Informes" };

export default async function PaginaInformes() {
  await requerirUsuario();
  const h = hoy();
  return (
    <>
      <EncabezadoPagina titulo="Informes" descripcion="Elige el informe y el periodo. Todos se pueden ver en pantalla y descargar en PDF o Excel." />
      <div className="grid gap-4 md:grid-cols-2">
        {CATALOGO_INFORMES.map((inf) => (
          <form key={inf.codigo} action={`/informes/${inf.codigo}`} className="tarjeta flex flex-col p-4">
            <h2 className="font-bold text-slate-900">{inf.nombre}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-500">{inf.descripcion}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {inf.parametro === "periodo" && (
                <label>
                  <span className="etiqueta">Mes</span>
                  <input type="month" name="periodo" defaultValue={h.slice(0, 7)} className="campo" />
                </label>
              )}
              {inf.parametro === "anio" && (
                <label>
                  <span className="etiqueta">Año</span>
                  <input type="number" name="anio" defaultValue={h.slice(0, 4)} min={2020} max={2100} className="campo w-28" />
                </label>
              )}
              <button className="rounded-lg bg-marca-700 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-800">Generar informe</button>
            </div>
          </form>
        ))}
      </div>
    </>
  );
}
