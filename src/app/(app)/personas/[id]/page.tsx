import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/server/auth/sesion";
import { obtenerPersona, posiblesDuplicados, relacionesDePersona } from "@/server/modulos/personas";
import { AccionConMotivo } from "@/components/ui/acciones";
import { DatoFicha, EncabezadoPagina, Insignia, Pesos, Tarjeta } from "@/components/ui/basicos";
import { EstadoPagoInsignia } from "@/components/ui/estados";
import { formatearFecha, nombreCompleto } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { accionEditarPersona, accionFusionar } from "../acciones";
import { FormularioPersona } from "./formulario";

export default async function FichaPersona({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const persona = await obtenerPersona(Number(id));
  if (!persona) notFound();
  const [rel, dupes] = await Promise.all([relacionesDePersona(persona.id), posiblesDuplicados(persona, { excluirId: persona.id })]);
  const puedeEditar = usuario.rol !== "consulta";

  return (
    <>
      <EncabezadoPagina
        volver={{ href: "/personas", texto: "Personas" }}
        titulo={nombreCompleto(persona)}
        descripcion={
          <span className="flex flex-wrap gap-2">
            {persona.rut && formatearRut(persona.rut)}
            {rel.comoAlumno && <Insignia color="azul">Alumno</Insignia>}
            {rel.comoResponsable.some((r) => r.esApoderado) && <Insignia>Apoderado</Insignia>}
            {rel.comoResponsable.some((r) => r.esPagador) && <Insignia color="verde">Pagador</Insignia>}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {rel.comoAlumno && (
            <Tarjeta titulo="Como alumno">
              <Link href={`/alumnos/${rel.comoAlumno.id}`} className="enlace">
                Ver ficha de alumno →
              </Link>
              <span className="ml-2 text-sm text-slate-500">
                {rel.comoAlumno.bus && `Bus ${rel.comoAlumno.bus.numero}`} {rel.comoAlumno.servicio?.nombre}
              </span>
            </Tarjeta>
          )}
          {rel.comoResponsable.length > 0 && (
            <Tarjeta titulo="Alumnos a cargo">
              <ul className="space-y-2">
                {rel.comoResponsable.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/alumnos/${r.alumnoId}`} className="enlace">
                      {nombreCompleto(r.alumno.persona)}
                    </Link>
                    {r.esTitular && <Insignia color="azul">Titular</Insignia>}
                    {r.esPagador && <Insignia color="verde">Pagador</Insignia>}
                    {r.parentesco && <Insignia>{r.parentesco}</Insignia>}
                    {r.alumno.bus && <span className="text-xs text-slate-500">Bus {r.alumno.bus.numero}</span>}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
          <Tarjeta titulo="Pagos realizados">
            {rel.pagosRealizados.length === 0 ? (
              <p className="text-sm text-slate-500">Sin pagos asociados como pagador.</p>
            ) : (
              <table className="tabla">
                <tbody>
                  {rel.pagosRealizados.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/pagos/${p.id}`} className="enlace">
                          #{p.id}
                        </Link>
                      </td>
                      <td>{formatearFecha(p.fechaPago)}</td>
                      <td className="text-right">
                        <Pesos monto={p.monto} />
                      </td>
                      <td>
                        <EstadoPagoInsignia verificacion={p.estadoVerificacion} conciliacion={p.estadoConciliacion} anulado={!!p.anuladoEn} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tarjeta>
          {puedeEditar && (
            <Tarjeta titulo="Editar datos">
              <FormularioPersona accion={accionEditarPersona.bind(null, persona.id)} persona={persona} />
            </Tarjeta>
          )}
        </div>
        <div className="space-y-6">
          <Tarjeta titulo="Datos">
            <dl className="space-y-2">
              <DatoFicha etiqueta="Teléfono">{persona.telefono}</DatoFicha>
              <DatoFicha etiqueta="Correo">{persona.email}</DatoFicha>
              <DatoFicha etiqueta="Domicilio">{[persona.direccion, persona.comuna].filter(Boolean).join(", ")}</DatoFicha>
              <DatoFicha etiqueta="Observaciones">{persona.observaciones}</DatoFicha>
            </dl>
          </Tarjeta>
          {rel.alias.length > 0 && (
            <Tarjeta titulo="También aparece como">
              <ul className="space-y-1 text-sm">
                {rel.alias.map((a) => (
                  <li key={a.id}>
                    {a.alias} <span className="text-xs text-slate-500">({a.origen})</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
          {dupes.length > 0 && puedeEditar && (
            <Tarjeta titulo="Posibles duplicados">
              <ul className="space-y-3">
                {dupes.map((d) => (
                  <li key={d.persona.id} className="text-sm">
                    <Link href={`/personas/${d.persona.id}`} className="enlace">
                      {nombreCompleto(d.persona)}
                    </Link>
                    <span className="ml-1 text-xs text-slate-500">
                      {d.persona.rut && formatearRut(d.persona.rut)} · {d.motivo}
                    </span>
                    <div className="mt-1">
                      <AccionConMotivo
                        accion={accionFusionar}
                        ocultos={{ principalId: persona.id, duplicadoId: d.persona.id }}
                        texto="Fusionar en esta ficha"
                        titulo={`Unir ${nombreCompleto(d.persona)} dentro de ${nombreCompleto(persona)}`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
