import Link from "next/link";
import { requerirUsuario } from "@/server/auth/sesion";
import { listarAlumnos } from "@/server/modulos/alumnos";
import { listarBuses, listarServicios } from "@/server/modulos/catalogos";
import { BotonEnlace, EncabezadoPagina, EstadoVacio, Insignia, Pesos } from "@/components/ui/basicos";
import { ESTADOS_ALUMNO, ESTADO_ALUMNO_ETIQUETA, type EstadoAlumno } from "@/lib/constantes";
import { nombreCompleto } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";

export const metadata = { title: "Alumnos" };

type Filtros = { q?: string; bus?: string; servicio?: string; estado?: string; deuda?: string };

export default async function PaginaAlumnos({ searchParams }: { searchParams: Promise<Filtros> }) {
  await requerirUsuario();
  const f = await searchParams;
  const estado = (f.estado ?? "activo") as EstadoAlumno | "todos";
  const [lista, buses, servicios] = await Promise.all([
    listarAlumnos({
      q: f.q,
      busId: f.bus ? Number(f.bus) : undefined,
      servicioId: f.servicio ? Number(f.servicio) : undefined,
      estado,
      soloConDeuda: f.deuda === "1",
    }),
    listarBuses(),
    listarServicios(),
  ]);
  const deudaTotal = lista.reduce((s, a) => s + a.deuda, 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Alumnos"
        descripcion={`${lista.length} alumno(s)${deudaTotal ? ` · deuda vencida ${deudaTotal.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}` : ""}`}
        acciones={
          <>
            <BotonEnlace href="/importar?destino=alumnos" variante="secundario">
              Importar
            </BotonEnlace>
            <BotonEnlace href="/alumnos/nuevo">+ Nuevo alumno</BotonEnlace>
          </>
        }
      />

      <form className="tarjeta mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <input name="q" defaultValue={f.q} placeholder="Nombre, RUT, apoderado…" className="campo lg:col-span-2" />
        <select name="bus" defaultValue={f.bus ?? ""} className="campo">
          <option value="">Todos los buses</option>
          {buses.map(({ bus }) => (
            <option key={bus.id} value={bus.id}>
              Bus {bus.numero}
            </option>
          ))}
        </select>
        <select name="servicio" defaultValue={f.servicio ?? ""} className="campo">
          <option value="">Todos los servicios</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={estado} className="campo">
          <option value="todos">Todos los estados</option>
          {ESTADOS_ALUMNO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_ALUMNO_ETIQUETA[e]}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" name="deuda" value="1" defaultChecked={f.deuda === "1"} className="size-4" /> Con deuda
          </label>
          <button className="ml-auto rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white">Filtrar</button>
        </div>
      </form>

      {lista.length === 0 ? (
        <EstadoVacio
          titulo="No hay alumnos con estos filtros"
          descripcion="Puedes crear un alumno manualmente o importar una planilla Excel completa."
          accion={<BotonEnlace href="/alumnos/nuevo">Crear alumno</BotonEnlace>}
        />
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Alumno</th>
                <th className="hidden md:table-cell">Apoderado</th>
                <th>Bus</th>
                <th className="hidden lg:table-cell">Servicio</th>
                <th className="text-right">Tarifa</th>
                <th className="text-right">Deuda vencida</th>
                <th className="hidden sm:table-cell">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/alumnos/${a.id}`} className="enlace">
                      {nombreCompleto(a)}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {[a.rut && formatearRut(a.rut), a.establecimiento, a.curso].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="hidden md:table-cell">{a.titular ?? <span className="text-slate-400">—</span>}</td>
                  <td>{a.busNumero ? <Insignia color="azul">Bus {a.busNumero}</Insignia> : <span className="text-slate-400">—</span>}</td>
                  <td className="hidden lg:table-cell">{a.servicioNombre ?? "—"}</td>
                  <td className="text-right">
                    <Pesos monto={a.tarifaMensual} />
                  </td>
                  <td className="text-right">
                    {a.deuda > 0 ? (
                      <span className="font-semibold text-red-700">
                        <Pesos monto={a.deuda} />
                        <span className="block text-[11px] font-normal">{a.mesesDeuda} mes(es)</span>
                      </span>
                    ) : (
                      <span className="text-emerald-700">Al día</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell">
                    <Insignia color={a.estado === "activo" ? "verde" : a.estado === "suspendido" ? "amarillo" : "gris"}>
                      {ESTADO_ALUMNO_ETIQUETA[a.estado]}
                    </Insignia>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
