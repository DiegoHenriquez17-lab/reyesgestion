import { requerirUsuario } from "@/server/auth/sesion";
import { listarServicios } from "@/server/modulos/catalogos";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { TIPO_SERVICIO_ETIQUETA } from "@/lib/constantes";
import { formatearPesos } from "@/lib/formato";
import { accionGuardarServicio } from "../acciones";
import { FormularioServicio } from "../formularios-catalogo";

export const metadata = { title: "Servicios" };

export default async function PaginaServicios() {
  await requerirUsuario(["admin", "operador"]);
  const lista = await listarServicios();
  return (
    <>
      <EncabezadoPagina titulo="Servicios" volver={{ href: "/configuracion", texto: "Configuración" }} />
      <Tarjeta titulo="Agregar servicio" className="mb-6">
        <FormularioServicio accion={accionGuardarServicio.bind(null, null)} />
      </Tarjeta>
      <div className="space-y-3">
        {lista.map((s) => (
          <details key={s.id} className="tarjeta p-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
              <span className="font-bold">{s.nombre}</span>
              <Insignia>{TIPO_SERVICIO_ETIQUETA[s.tipo]}</Insignia>
              {s.tarifaReferencia != null && <span className="text-sm text-slate-500">{formatearPesos(s.tarifaReferencia)}</span>}
              {!s.activo && <Insignia color="gris">Inactivo</Insignia>}
              <span className="ml-auto text-xs text-slate-500">Editar ▾</span>
            </summary>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <FormularioServicio accion={accionGuardarServicio.bind(null, s.id)} servicio={s} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
