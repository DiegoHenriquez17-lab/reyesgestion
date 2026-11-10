import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/server/auth/sesion";
import { obtenerPago } from "@/server/modulos/pagos";
import { sugerirConciliacion, umbralSugerencia } from "@/server/modulos/conciliacion";
import { listarAlumnos } from "@/server/modulos/alumnos";
import { AccionConMotivo, BotonAccion } from "@/components/ui/acciones";
import { Aviso, DatoFicha, EncabezadoPagina, Pesos, Tarjeta } from "@/components/ui/basicos";
import { EstadoPagoInsignia } from "@/components/ui/estados";
import { MEDIO_PAGO_ETIQUETA, ORIGEN_PAGO_ETIQUETA } from "@/lib/constantes";
import { formatearFecha, formatearFechaHora, formatearPeriodo, formatearPesos, nombreCompleto } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { accionAnularPago, accionConciliar, accionMensualidadesDeAlumno, accionQuitarAplicacion, accionVerificar } from "../acciones";
import { ConciliacionManual, TarjetaSugerencia } from "./conciliacion";

export default async function DetallePago({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ registrado?: string }> }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const sp = await searchParams;
  const pago = await obtenerPago(Number(id));
  if (!pago) notFound();
  const puedeEditar = usuario.rol !== "consulta";
  const disponible = pago.monto - pago.montoAplicado;
  const conciliable = !pago.anuladoEn && pago.estadoVerificacion !== "rechazado" && disponible > 0;
  const [sugerencias, umbral, alumnos] = conciliable
    ? await Promise.all([sugerirConciliacion(pago), umbralSugerencia(), listarAlumnos({ estado: "todos" })])
    : [[], 0, []];
  const esImagen = pago.documento?.mime.startsWith("image/");

  return (
    <>
      {sp.registrado && <div className="mb-4"><Aviso tipo="exito">Pago registrado.</Aviso></div>}
      <EncabezadoPagina
        volver={{ href: "/pagos", texto: "Pagos" }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            Pago #{pago.id} · <Pesos monto={pago.monto} />
          </span>
        }
        descripcion={<EstadoPagoInsignia verificacion={pago.estadoVerificacion} conciliacion={pago.estadoConciliacion} anulado={!!pago.anuladoEn} />}
      />

      {pago.anuladoEn && (
        <div className="mb-4">
          <Aviso tipo="error">
            Pago anulado el {formatearFechaHora(pago.anuladoEn)}. Motivo: {pago.motivoAnulacion}
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tarjeta titulo="Datos del pago">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DatoFicha etiqueta="Fecha">{formatearFecha(pago.fechaPago)}</DatoFicha>
              <DatoFicha etiqueta="Monto">{formatearPesos(pago.monto)}</DatoFicha>
              <DatoFicha etiqueta="Sin asignar">{formatearPesos(disponible)}</DatoFicha>
              <DatoFicha etiqueta="Quién paga">{pago.nombreOrigen ?? (pago.pagador ? nombreCompleto(pago.pagador) : null)}</DatoFicha>
              <DatoFicha etiqueta="RUT origen">{pago.rutOrigen && formatearRut(pago.rutOrigen)}</DatoFicha>
              <DatoFicha etiqueta="Medio">{MEDIO_PAGO_ETIQUETA[pago.medio]}</DatoFicha>
              <DatoFicha etiqueta="Banco">{pago.banco}</DatoFicha>
              <DatoFicha etiqueta="N° operación">{pago.numeroOperacion}</DatoFicha>
              <DatoFicha etiqueta="Origen del registro">{ORIGEN_PAGO_ETIQUETA[pago.origen]}</DatoFicha>
              {pago.alumno && (
                <DatoFicha etiqueta="Alumno">
                  <Link href={`/alumnos/${pago.alumno.id}`} className="enlace">
                    {nombreCompleto(pago.alumno.persona)}
                  </Link>
                </DatoFicha>
              )}
              {pago.observaciones && (
                <div className="col-span-full">
                  <DatoFicha etiqueta="Observaciones">{pago.observaciones}</DatoFicha>
                </div>
              )}
            </dl>
          </Tarjeta>

          {pago.aplicaciones.length > 0 && (
            <Tarjeta titulo="Aplicado a">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Mes</th>
                    <th className="text-right">Monto</th>
                    {puedeEditar && <th />}
                  </tr>
                </thead>
                <tbody>
                  {pago.aplicaciones.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/alumnos/${a.mensualidad.alumnoId}`} className="enlace">
                          {nombreCompleto(a.mensualidad.alumno.persona)}
                        </Link>
                      </td>
                      <td>{formatearPeriodo(a.mensualidad.periodo)}</td>
                      <td className="text-right">
                        <Pesos monto={a.monto} />
                      </td>
                      {puedeEditar && (
                        <td className="text-right">
                          <AccionConMotivo accion={accionQuitarAplicacion.bind(null, pago.id)} texto="Quitar" ocultos={{ aplicacionId: a.id }} titulo="Quitar aplicación" />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          )}

          {conciliable && puedeEditar && (
            <Tarjeta titulo={pago.montoAplicado > 0 ? `Conciliar el saldo restante (${formatearPesos(disponible)})` : "Conciliar pago"}>
              <div className="space-y-4">
                {sugerencias.length > 0 ? (
                  sugerencias.map((s) => (
                    <TarjetaSugerencia key={s.alumnoId} s={s} accion={accionConciliar.bind(null, pago.id)} nombreOrigen={pago.nombreOrigen} umbral={umbral} />
                  ))
                ) : (
                  <Aviso tipo="advertencia">
                    🟡 <strong>PAGO POR CONCILIAR.</strong> No se encontró una coincidencia clara: asígnalo manualmente.
                  </Aviso>
                )}
                <details className="rounded-lg border border-slate-200 p-3" open={sugerencias.length === 0}>
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">Asignar manualmente a otro alumno</summary>
                  <div className="mt-3">
                    <ConciliacionManual
                      accion={accionConciliar.bind(null, pago.id)}
                      cargarMensualidades={accionMensualidadesDeAlumno}
                      disponible={disponible}
                      nombreOrigen={pago.nombreOrigen}
                      alumnos={alumnos.map((a) => ({ id: a.id, nombre: nombreCompleto(a), detalle: a.titular ? `Apoderado: ${a.titular}` : null }))}
                    />
                  </div>
                </details>
              </div>
            </Tarjeta>
          )}
        </div>

        <div className="space-y-6">
          {puedeEditar && !pago.anuladoEn && (
            <Tarjeta titulo="Verificación del dinero">
              <p className="mb-3 text-sm text-slate-600">
                {pago.estadoVerificacion === "por_verificar"
                  ? "El comprobante fue informado, pero falta confirmar que el dinero está en la cuenta."
                  : pago.estadoVerificacion === "verificado"
                    ? "El dinero está confirmado como recibido."
                    : "El pago fue rechazado."}
              </p>
              <div className="flex flex-wrap gap-2">
                {pago.estadoVerificacion !== "verificado" && (
                  <BotonAccion accion={accionVerificar.bind(null, pago.id)} ocultos={{ estado: "verificado" }} variante="exito">
                    Confirmar dinero recibido
                  </BotonAccion>
                )}
                {pago.estadoVerificacion === "por_verificar" && (
                  <AccionConMotivo accion={accionVerificar.bind(null, pago.id)} ocultos={{ estado: "rechazado" }} texto="Rechazar" variante="peligro" titulo="Rechazar pago" />
                )}
                {pago.estadoVerificacion === "verificado" && (
                  <AccionConMotivo accion={accionVerificar.bind(null, pago.id)} ocultos={{ estado: "por_verificar" }} texto="Volver a «por verificar»" titulo="Cambiar a por verificar" />
                )}
              </div>
            </Tarjeta>
          )}

          <Tarjeta titulo="Comprobante">
            {pago.documento ? (
              <a href={`/api/documentos/${pago.documento.id}`} target="_blank" className="block">
                {esImagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/documentos/${pago.documento.id}`} alt="Comprobante" className="w-full rounded-lg border border-slate-200" />
                ) : (
                  <span className="enlace">{pago.documento.nombreOriginal}</span>
                )}
              </a>
            ) : (
              <p className="text-sm text-slate-500">Sin comprobante adjunto.</p>
            )}
          </Tarjeta>

          {usuario.rol === "admin" && !pago.anuladoEn && (
            <Tarjeta titulo="Anular pago">
              <p className="mb-2 text-xs text-slate-500">El pago no se borra: queda anulado y se deshacen sus aplicaciones. Queda en la auditoría.</p>
              <AccionConMotivo accion={accionAnularPago.bind(null, pago.id)} texto="Anular pago" variante="peligro" titulo="¿Anular este pago?" />
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
