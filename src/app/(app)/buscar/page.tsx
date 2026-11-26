import Link from "next/link";
import { requerirUsuario } from "@/server/auth/sesion";
import { buscarTodo } from "@/server/modulos/busqueda";
import { consultarGestion } from "@/server/modulos/consultas";
import { BotonEnlace, EncabezadoPagina, EstadoVacio, Insignia, Pesos, Tarjeta } from "@/components/ui/basicos";
import { formatearFecha } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";

export const metadata = { title: "Buscar" };

export default async function PaginaBuscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requerirUsuario();
  const { q = "" } = await searchParams;
  const consulta = q.trim().length >= 2 ? await consultarGestion(q) : null;
  const r = !consulta && q.trim().length >= 2 ? await buscarTodo(q) : null;
  const total = r ? r.personas.length + r.buses.length + r.pagos.length : 0;

  return (
    <>
      <EncabezadoPagina titulo="Buscar" descripcion="Busca por nombre, RUT, teléfono, N° de operación, monto o bus, o haz una pregunta de gestión." />
      <form className="mb-6 flex gap-2">
        <input name="q" defaultValue={q} autoFocus placeholder="Ej: Jorge, 12.345.678-9, 95000, bus 16…" className="campo text-base" />
        <button className="rounded-lg bg-marca-700 px-5 font-semibold text-white">Buscar</button>
      </form>
      {!q && <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {["¿Cuánto recaudamos este año?", "¿Quiénes deben dos meses?", "¿Qué servicios tenemos esta semana?"].map((p) => <Link key={p} href={`/buscar?q=${encodeURIComponent(p)}`} className="enlace">{p}</Link>)}
      </div>}
      {consulta && <Tarjeta titulo={consulta.titulo} acciones={<Link href={consulta.enlace} className="enlace text-sm">Ver detalle</Link>}>
        {!consulta.filas.length && <p className="text-sm text-slate-600">Sin resultados para esta consulta.</p>}
        <ul className="divide-y divide-slate-100">{consulta.filas.slice(0, 20).map((f, i) => <li key={i} className="flex flex-wrap justify-between gap-3 py-2 text-sm">
          {f.enlace ? <Link href={f.enlace} className="enlace">{f.texto}</Link> : <span>{f.texto}</span>}<span>{f.detalle}</span>
        </li>)}</ul>
      </Tarjeta>}

      {r && total === 0 && (
        <EstadoVacio
          titulo={`No se encontró «${q}»`}
          descripcion="Si es un alumno nuevo, puedes crear su ficha ahora."
          accion={<BotonEnlace href={`/alumnos/nuevo?nombre=${encodeURIComponent(q)}`}>Crear ficha de «{q}»</BotonEnlace>}
        />
      )}

      {r && r.personas.length > 0 && (
        <Tarjeta titulo={`Personas (${r.personas.length})`} className="mb-4">
          <ul className="divide-y divide-slate-100">
            {r.personas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <Link href={p.alumnoId ? `/alumnos/${p.alumnoId}` : `/personas/${p.id}`} className="enlace text-base">
                    {p.nombre}
                  </Link>
                  <p className="text-xs text-slate-500">{[p.rut && formatearRut(p.rut), p.telefono].filter(Boolean).join(" · ")}</p>
                  {p.alumnosACargo.length > 0 && (
                    <p className="mt-1 text-sm text-slate-700">
                      A cargo de:{" "}
                      {p.alumnosACargo.map((a, i) => (
                        <span key={a.id}>
                          {i > 0 && ", "}
                          <Link href={`/alumnos/${a.id}`} className="enlace">
                            {a.nombre}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.roles.length ? p.roles.map((rol) => <Insignia key={rol} color={rol === "Alumno" ? "azul" : rol === "Pagador" ? "verde" : "gris"}>{rol}</Insignia>) : <Insignia>Sin rol</Insignia>}
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {r && r.buses.length > 0 && (
        <Tarjeta titulo="Buses" className="mb-4">
          <ul className="space-y-1">
            {r.buses.map((b) => (
              <li key={b.id}>
                <Link href={`/alumnos?bus=${b.id}`} className="enlace">
                  Bus {b.numero}
                </Link>
                <span className="ml-2 text-sm text-slate-500">
                  {b.patente} · {b.totalAlumnos} alumno(s) activos
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {r && r.pagos.length > 0 && (
        <Tarjeta titulo={`Pagos (${r.pagos.length})`}>
          <ul className="divide-y divide-slate-100">
            {r.pagos.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 py-2 text-sm">
                <Link href={`/pagos/${p.id}`} className="enlace">
                  #{p.id} · {formatearFecha(p.fecha)} · {p.nombreOrigen ?? "sin nombre"}
                  {p.operacion && ` · Op. ${p.operacion}`}
                </Link>
                <Pesos monto={p.monto} className="font-semibold" />
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  );
}
