import Link from "next/link";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { AreaTexto, BotonEnviar, Campo, Formulario, Selector } from "@/components/ui/formularios";
import { formatearFecha, formatearPesos, nombreCompleto } from "@/lib/formato";
import { requerirUsuario } from "@/server/auth/sesion";
import { hoy } from "@/server/fechas";
import { listarAlumnos } from "@/server/modulos/alumnos";
import { listarDevoluciones } from "@/server/modulos/devoluciones";
import { accionResolverDevolucion, accionSolicitarDevolucion } from "./acciones";

export const metadata = { title: "Devoluciones" };

export default async function PaginaDevoluciones({ searchParams }: { searchParams: Promise<{ alumno?: string }> }) {
  const usuario = await requerirUsuario();
  const editable = usuario.rol !== "consulta";
  const consulta = await searchParams;
  const id = Number(consulta.alumno);
  const alumnoId = Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : undefined;
  const [lista, alumnos] = await Promise.all([listarDevoluciones(alumnoId), editable ? listarAlumnos() : []]);
  const actual = hoy();
  return <div className="space-y-5">
    <EncabezadoPagina titulo="Devoluciones" volver={{ href: "/pagos", texto: "Pagos" }} descripcion="Registra solicitudes y confirma cuando el dinero se haya devuelto." />
    {editable && alumnos.length > 0 && <Tarjeta titulo="Registrar devolución pendiente">
      <Formulario accion={accionSolicitarDevolucion}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Selector etiqueta="Alumno" nombre="alumnoId" opciones={alumnos.map((alumno) => ({ valor: alumno.id, texto: nombreCompleto(alumno) }))} defaultValue={consulta.alumno ?? ""} vacio="Selecciona" required />
          <Campo etiqueta="N° de pago vinculado (opcional)" nombre="pagoId" type="number" min={1} />
          <Campo etiqueta="Monto (CLP)" nombre="monto" type="number" min={1} required />
          <Campo etiqueta="Fecha de solicitud" nombre="fechaSolicitud" type="date" defaultValue={actual} max={actual} required />
        </div>
        <Campo etiqueta="Motivo" nombre="motivo" required />
        <AreaTexto etiqueta="Observaciones" nombre="observaciones" />
        <BotonEnviar>Registrar solicitud</BotonEnviar>
      </Formulario>
    </Tarjeta>}
    <Tarjeta titulo="Solicitudes registradas" acciones={alumnoId && <Link className="enlace text-sm" href="/devoluciones">Ver todas</Link>}>
      {!lista.length && <p className="text-sm text-slate-600">Sin devoluciones registradas.</p>}
      <ul className="divide-y divide-slate-100">{lista.map(({ devolucion: d, persona }) => <li key={d.id} id={`devolucion-${d.id}`} className="scroll-mt-20 space-y-2 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-3"><strong>#{d.id} · {persona ? nombreCompleto(persona) : "Sin alumno"} · {formatearPesos(d.monto)}</strong>
          <Insignia color={d.estado === "pendiente" ? "amarillo" : d.estado === "realizada" ? "verde" : "gris"}>{d.estado === "pendiente" ? "Pendiente" : d.estado === "realizada" ? "Realizada" : "Anulada"}</Insignia>
          <span>{formatearFecha(d.fechaSolicitud)}</span>{d.pagoId && <Link href={`/pagos/${d.pagoId}`} className="enlace">Pago #{d.pagoId}</Link>}
        </div>
        <p>{d.motivo}{d.fechaRealizada && ` · Devuelta el ${formatearFecha(d.fechaRealizada)}`}</p>
        {editable && d.estado === "pendiente" && <details><summary className="cursor-pointer font-semibold">Resolver devolución</summary>
          <Formulario className="mt-2" accion={accionResolverDevolucion.bind(null, d.id)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Selector etiqueta="Estado" nombre="estado" opciones={[{ valor: "realizada", texto: "Realizada" }, { valor: "anulada", texto: "Anulada" }]} />
              <Campo etiqueta="Fecha realizada" nombre="fechaRealizada" type="date" defaultValue={actual} max={actual} />
            </div>
            <Campo etiqueta="Motivo de la actualización" nombre="motivo" required />
            <BotonEnviar variante="secundario">Guardar resolución</BotonEnviar>
          </Formulario>
        </details>}
      </li>)}</ul>
    </Tarjeta>
  </div>;
}
