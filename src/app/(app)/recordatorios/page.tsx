import { requerirUsuario } from "@/server/auth/sesion";
import { listarRecordatorios } from "@/server/modulos/recordatorios";
import { hoy } from "@/server/fechas";
import { BotonAccion } from "@/components/ui/acciones";
import { EncabezadoPagina, EstadoVacio, Insignia, Tarjeta } from "@/components/ui/basicos";
import { diferenciaDias } from "@/lib/fechas";
import { formatearFecha } from "@/lib/formato";
import { accionEstadoRecordatorio } from "./acciones";
import { FormularioRecordatorio } from "./formulario";

export const metadata = { title: "Recordatorios" };

export default async function PaginaRecordatorios({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const usuario = await requerirUsuario();
  const sp = await searchParams;
  const lista = await listarRecordatorios(!sp.todos);
  const hoyStr = hoy();
  return (
    <>
      <EncabezadoPagina titulo="Recordatorios" descripcion="Avisos manuales: aparecen en el panel según su fecha (configurable en Configuración → Alertas)." />
      <div className="grid gap-6 lg:grid-cols-3">
        {usuario.rol !== "consulta" && (
          <Tarjeta titulo="Nuevo recordatorio">
            <FormularioRecordatorio hoy={hoyStr} />
          </Tarjeta>
        )}
        <div className="lg:col-span-2">
          {lista.length === 0 ? (
            <EstadoVacio titulo="Sin recordatorios pendientes" />
          ) : (
            <ul className="space-y-2">
              {lista.map((r) => {
                const dias = diferenciaDias(hoyStr, r.fecha);
                return (
                  <li key={r.id} className="tarjeta flex flex-wrap items-center justify-between gap-3 p-3">
                    <div>
                      <p className="font-semibold text-slate-900">{r.titulo}</p>
                      {r.detalle && <p className="text-sm text-slate-600">{r.detalle}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Insignia color={r.estado !== "pendiente" ? "gris" : dias < 0 ? "rojo" : dias <= 3 ? "amarillo" : "azul"}>
                        {formatearFecha(r.fecha)}
                        {r.estado === "pendiente" && dias < 0 && " · atrasado"}
                      </Insignia>
                      {r.estado === "pendiente" && usuario.rol !== "consulta" && (
                        <>
                          <BotonAccion accion={accionEstadoRecordatorio.bind(null, r.id, "hecho")} variante="exito">
                            Hecho
                          </BotonAccion>
                          <BotonAccion accion={accionEstadoRecordatorio.bind(null, r.id, "cancelado")} variante="fantasma">
                            Cancelar
                          </BotonAccion>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
