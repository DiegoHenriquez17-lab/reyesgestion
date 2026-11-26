import Link from "next/link";
import { requerirUsuario } from "@/server/auth/sesion";
import { listarBuses } from "@/server/modulos/catalogos";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { accionGuardarBus } from "./acciones";
import { FormularioBus } from "./formulario";

export const metadata = { title: "Buses" };

export default async function PaginaBuses() {
  await requerirUsuario(["admin", "operador"]);
  const lista = await listarBuses();
  return (
    <>
      <EncabezadoPagina
        titulo="Buses"
        descripcion="Administra los buses y sus asignaciones."
        acciones={<Link href="/flota" className="enlace text-sm">Control de flota y vencimientos</Link>}
      />
      <Tarjeta titulo="Agregar bus" className="mb-6">
        <FormularioBus accion={accionGuardarBus.bind(null, null)} />
      </Tarjeta>
      <div className="space-y-3">
        {lista.map(({ bus, totalAlumnos }) => (
          <details key={bus.id} className="tarjeta p-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
              <span className="text-lg font-bold">Bus {bus.numero}</span>
              {bus.patente && <Insignia>{bus.patente}</Insignia>}
              {!bus.activo && <Insignia color="gris">Inactivo</Insignia>}
              <Link href={`/alumnos?bus=${bus.id}`} className="enlace text-sm">
                {totalAlumnos} alumno(s)
              </Link>
              <span className="ml-auto text-xs text-slate-500">Editar ▾</span>
            </summary>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <FormularioBus accion={accionGuardarBus.bind(null, bus.id)} bus={bus} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
