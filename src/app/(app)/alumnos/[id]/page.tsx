import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/server/auth/sesion";
import { obtenerFichaAlumno } from "@/server/modulos/alumnos";
import { hoy } from "@/server/fechas";
import { AccionConMotivo, BotonAccion } from "@/components/ui/acciones";
import { Aviso, BotonEnlace, DatoFicha, EncabezadoPagina, Indicador, Insignia, Pesos, Tarjeta } from "@/components/ui/basicos";
import { EstadoMensualidadInsignia, EstadoPagoInsignia } from "@/components/ui/estados";
import { ESTADO_ALUMNO_ETIQUETA, MEDIO_PAGO_ETIQUETA } from "@/lib/constantes";
import { formatearFecha, formatearFechaHora, formatearPeriodo, formatearPesos, nombreCompleto } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { accionCambiarEstadoMensualidad } from "../../mensualidades/acciones";
import { accionAgregarResponsable, accionQuitarResponsable } from "../acciones";
import { FormularioResponsable } from "./formulario-responsable";

export default async function FichaAlumno({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const ficha = await obtenerFichaAlumno(Number(id));
  if (!ficha) notFound();
  const { alumno, resumen } = ficha;
  const p = alumno.persona;
  const hoyStr = hoy();
  const puedeEditar = usuario.rol !== "consulta";
  const aplicacionesPorMes = new Map<number, typeof ficha.aplicaciones>();
  for (const a of ficha.aplicaciones) aplicacionesPorMes.set(a.mensualidadId, [...(aplicacionesPorMes.get(a.mensualidadId) ?? []), a]);

  return (
    <>
      {sp.creado && <div className="mb-4"><Aviso tipo="exito">Alumno creado correctamente.</Aviso></div>}
      <EncabezadoPagina
        volver={{ href: "/alumnos", texto: "Alumnos" }}
        titulo={nombreCompleto(p)}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            {p.rut && <span>{formatearRut(p.rut)}</span>}
            <Insignia color={alumno.estado === "activo" ? "verde" : "gris"}>{ESTADO_ALUMNO_ETIQUETA[alumno.estado]}</Insignia>
            {alumno.bus && <Insignia color="azul">Bus {alumno.bus.numero}</Insignia>}
            {alumno.servicio && <Insignia>{alumno.servicio.nombre}</Insignia>}
          </span>
        }
        acciones={
          puedeEditar && (
            <>
              <BotonEnlace href={`/alumnos/${alumno.id}/editar`} variante="secundario">
                Editar
              </BotonEnlace>
              <BotonEnlace href={`/pagos/nuevo?alumno=${alumno.id}`} variante="exito">
                Registrar pago
              </BotonEnlace>
            </>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Deuda vencida" valor={formatearPesos(resumen.deudaVencida)} detalle={`${resumen.mesesVencidos} mes(es)`} color={resumen.deudaVencida > 0 ? "rojo" : "verde"} />
        <Indicador etiqueta="Por vencer" valor={formatearPesos(resumen.porVencer)} color="amarillo" />
        <Indicador etiqueta="Total pagado" valor={formatearPesos(resumen.totalPagado)} color="verde" />
        <Indicador etiqueta="Tarifa mensual" valor={formatearPesos(alumno.tarifaMensual)} detalle={alumno.diaVencimiento ? `Vence el día ${alumno.diaVencimiento}` : "Vencimiento general"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tarjeta titulo="Mensualidades">
            {ficha.mensualidades.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aún no hay mensualidades. Se generan en{" "}
                <Link href="/mensualidades" className="enlace">
                  Mensualidades
                </Link>
                .
              </p>
            ) : (
              <div className="-mx-4 overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th className="text-right">Monto</th>
                      <th className="text-right">Pagado</th>
                      <th className="text-right">Saldo</th>
                      <th>Estado</th>
                      <th className="hidden md:table-cell">Pagos</th>
                      {puedeEditar && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.mensualidades.map((m) => {
                      const vencida = m.fechaVencimiento < hoyStr;
                      const aps = aplicacionesPorMes.get(m.id) ?? [];
                      return (
                        <tr key={m.id}>
                          <td>
                            <span className="font-medium">{formatearPeriodo(m.periodo)}</span>
                            <span className="block text-[11px] text-slate-500">vence {formatearFecha(m.fechaVencimiento)}</span>
                          </td>
                          <td className="text-right">
                            <Pesos monto={m.monto} />
                          </td>
                          <td className="text-right">
                            <Pesos monto={m.montoPagado} />
                          </td>
                          <td className="text-right font-semibold">
                            <Pesos monto={["condonada", "no_recuperable", "anulada"].includes(m.estado) ? 0 : m.monto - m.montoPagado} />
                          </td>
                          <td>
                            <EstadoMensualidadInsignia estado={m.estado} vencida={vencida} />
                          </td>
                          <td className="hidden text-xs md:table-cell">
                            {aps.map((a) => (
                              <Link key={a.id} href={`/pagos/${a.pagoId}`} className="enlace block">
                                #{a.pagoId} · {formatearFecha(a.fechaPago)} · {formatearPesos(a.monto)}
                                {a.estadoVerificacion === "por_verificar" && " (por verificar)"}
                              </Link>
                            ))}
                          </td>
                          {puedeEditar && (
                            <td className="text-right">
                              {(m.estado === "pendiente" || m.estado === "parcial") && (
                                <details className="relative inline-block text-left">
                                  <summary className="cursor-pointer list-none text-xs font-semibold text-slate-500 hover:text-slate-800">⋯</summary>
                                  <div className="absolute right-0 z-10 mt-1 w-72 space-y-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                                    <AccionConMotivo accion={accionCambiarEstadoMensualidad} texto="Condonar" ocultos={{ id: m.id, estado: "condonada" }} titulo="Condonar mensualidad" />
                                    <AccionConMotivo
                                      accion={accionCambiarEstadoMensualidad}
                                      texto="Marcar no recuperable"
                                      ocultos={{ id: m.id, estado: "no_recuperable" }}
                                      titulo="Monto no recuperable"
                                      variante="peligro"
                                    />
                                  </div>
                                </details>
                              )}
                              {["condonada", "no_recuperable"].includes(m.estado) && (
                                <AccionConMotivo accion={accionCambiarEstadoMensualidad} texto="Revertir" ocultos={{ id: m.id, estado: "pendiente" }} titulo="Volver a pendiente" />
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Pagos">
            {ficha.pagos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin pagos registrados.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Fecha</th>
                      <th>Origen</th>
                      <th className="text-right">Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.pagos.map((pg) => (
                      <tr key={pg.id}>
                        <td>
                          <Link href={`/pagos/${pg.id}`} className="enlace">
                            #{pg.id}
                          </Link>
                        </td>
                        <td>{formatearFecha(pg.fechaPago)}</td>
                        <td>
                          {pg.nombreOrigen ?? (pg.pagador ? nombreCompleto(pg.pagador) : "—")}
                          <span className="block text-[11px] text-slate-500">{MEDIO_PAGO_ETIQUETA[pg.medio]}</span>
                        </td>
                        <td className="text-right">
                          <Pesos monto={pg.monto} />
                        </td>
                        <td>
                          <EstadoPagoInsignia verificacion={pg.estadoVerificacion} conciliacion={pg.estadoConciliacion} anulado={!!pg.anuladoEn} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Historial de cambios">
            {ficha.historial.length === 0 ? (
              <p className="text-sm text-slate-500">Sin movimientos.</p>
            ) : (
              <ol className="space-y-3">
                {ficha.historial.map((h) => (
                  <li key={h.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                    <p className="text-xs text-slate-500">
                      {formatearFechaHora(h.fecha)} · {h.usuario ?? "Sistema"} · <span className="font-mono">{h.accion}</span>
                    </p>
                    <p className="text-slate-800">{h.resumen}</p>
                    {h.cambios && h.cambios.length > 0 && h.accion === "actualizar" && (
                      <ul className="mt-1 text-xs text-slate-600">
                        {h.cambios.slice(0, 6).map((c) => (
                          <li key={c.campo}>
                            <span className="font-medium">{c.campo}:</span> {String(c.antes ?? "—")} → {String(c.despues ?? "—")}
                          </li>
                        ))}
                      </ul>
                    )}
                    {h.motivo && <p className="text-xs italic text-slate-500">Motivo: {h.motivo}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Tarjeta>
        </div>

        <div className="space-y-6">
          <Tarjeta titulo="Datos">
            <dl className="grid grid-cols-2 gap-3">
              <DatoFicha etiqueta="Teléfono">{p.telefono}</DatoFicha>
              <DatoFicha etiqueta="Correo">{p.email}</DatoFicha>
              <div className="col-span-2">
                <DatoFicha etiqueta="Domicilio">{[p.direccion, p.comuna].filter(Boolean).join(", ")}</DatoFicha>
              </div>
              <DatoFicha etiqueta="Colegio">{alumno.establecimiento}</DatoFicha>
              <DatoFicha etiqueta="Curso">{alumno.curso}</DatoFicha>
              <DatoFicha etiqueta="Ingreso">{alumno.fechaIngreso && formatearFecha(alumno.fechaIngreso)}</DatoFicha>
              <DatoFicha etiqueta="Retiro">{alumno.fechaRetiro && formatearFecha(alumno.fechaRetiro)}</DatoFicha>
              {alumno.observaciones && (
                <div className="col-span-2">
                  <DatoFicha etiqueta="Observaciones">{alumno.observaciones}</DatoFicha>
                </div>
              )}
            </dl>
            <Link href={`/personas/${p.id}`} className="enlace mt-3 inline-block text-xs">
              Ver ficha de persona →
            </Link>
          </Tarjeta>

          <Tarjeta titulo="Apoderados y pagadores">
            {alumno.responsables.length === 0 && <p className="mb-3 text-sm text-slate-500">Sin apoderados registrados.</p>}
            <ul className="mb-3 space-y-3">
              {alumno.responsables
                .sort((a, b) => Number(b.esTitular) - Number(a.esTitular))
                .map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/personas/${r.persona.id}`} className="enlace text-sm">
                        {nombreCompleto(r.persona)}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.esTitular && <Insignia color="azul">Titular</Insignia>}
                        {r.esApoderado && !r.esTitular && <Insignia>Apoderado</Insignia>}
                        {r.esPagador && <Insignia color="verde">Pagador</Insignia>}
                        {r.parentesco && <Insignia>{r.parentesco}</Insignia>}
                      </div>
                      <p className="text-xs text-slate-500">{[r.persona.rut && formatearRut(r.persona.rut), r.persona.telefono].filter(Boolean).join(" · ")}</p>
                    </div>
                    {puedeEditar && (
                      <BotonAccion accion={accionQuitarResponsable.bind(null, alumno.id, r.id)} variante="fantasma" confirmar="¿Quitar a esta persona de los responsables?">
                        Quitar
                      </BotonAccion>
                    )}
                  </li>
                ))}
            </ul>
            {puedeEditar && <FormularioResponsable accion={accionAgregarResponsable.bind(null, alumno.id)} />}
          </Tarjeta>

          <Tarjeta titulo="Documentos">
            {ficha.documentos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin documentos.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {ficha.documentos.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documentos/${d.id}`} target="_blank" className="enlace">
                      {d.nombreOriginal}
                    </a>
                    <span className="ml-1 text-xs text-slate-500">({d.tipo})</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
