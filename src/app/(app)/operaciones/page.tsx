import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { BotonAccion } from "@/components/ui/acciones";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { AreaTexto, BotonEnviar, Campo, Casilla, Formulario, Selector } from "@/components/ui/formularios";
import { LecturaAdjunto } from "@/components/ui/lectura-adjunto";
import { formatearFecha, formatearPesos, nombreCompleto } from "@/lib/formato";
import { ESTADO_OPERACION_ETIQUETA, ESTADOS_COTIZACION, ESTADOS_VIAJE } from "@/lib/operaciones";
import { requerirUsuario } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { personas } from "@/server/db/schema";
import { hoy } from "@/server/fechas";
import { iaHabilitada } from "@/server/entorno";
import { listarBuses, listarServicios } from "@/server/modulos/catalogos";
import { listarConductores } from "@/server/modulos/flota";
import { listarContratos, listarCotizaciones, listarViajes } from "@/server/modulos/operaciones";
import { accionContrato, accionCotizacion, accionLeerContrato, accionProgramarCotizacion, accionViaje } from "./acciones";

export const metadata = { title: "Operaciones" };

type Opcion = { valor: number; texto: string; activo?: boolean };
type Opciones = { clientes: Opcion[]; servicios: Opcion[]; buses: Opcion[]; conductores: Opcion[] };
type Cotizacion = Awaited<ReturnType<typeof listarCotizaciones>>[number]["cotizacion"];
type Viaje = Awaited<ReturnType<typeof listarViajes>>[number]["viaje"];
type Contrato = Awaited<ReturnType<typeof listarContratos>>[number]["contrato"];
const rejilla = "grid gap-3 sm:grid-cols-2";
const estados = (valores: readonly (keyof typeof ESTADO_OPERACION_ETIQUETA)[]) => valores.map((valor) => ({ valor, texto: ESTADO_OPERACION_ETIQUETA[valor] }));
const seleccionables = (opciones: Opcion[], actual?: number | null) => opciones.filter((o) => o.activo !== false || o.valor === actual);

function CamposBase({ opciones, anterior, detalle }: { opciones: Opciones; anterior?: Cotizacion | Viaje | Contrato; detalle: string }) {
  const vinculado = anterior && "cotizacionId" in anterior && anterior.cotizacionId;
  return <>
    {vinculado ? <><input type="hidden" name="clienteId" value={anterior.clienteId} /><input type="hidden" name="servicioId" value={anterior.servicioId} /></> : <div className={rejilla}>
      <Selector etiqueta="Cliente" nombre="clienteId" opciones={opciones.clientes} defaultValue={anterior?.clienteId ?? ""} vacio="Selecciona" required />
      <Selector etiqueta="Servicio" nombre="servicioId" opciones={seleccionables(opciones.servicios, anterior?.servicioId)} defaultValue={anterior?.servicioId ?? ""} vacio="Selecciona" required />
    </div>}
    <AreaTexto etiqueta={detalle} nombre="detalle" defaultValue={anterior?.detalle ?? ""} maxLength={6000} required />
    <Campo etiqueta="Monto (CLP)" nombre="monto" type="number" min={0} defaultValue={anterior?.monto ?? ""} required />
    {anterior && <Campo etiqueta="Motivo del cambio" nombre="motivo" required />}
  </>;
}

function FormularioCotizacion({ opciones, cotizacion, hoyLocal }: { opciones: Opciones; cotizacion?: Cotizacion; hoyLocal: string }) {
  return <Formulario accion={accionCotizacion.bind(null, cotizacion?.id ?? null)}>
    <CamposBase opciones={opciones} anterior={cotizacion} detalle="Descripción y condiciones" />
    <div className={rejilla}>
      <Campo etiqueta="Fecha de solicitud" nombre="fechaSolicitud" type="date" defaultValue={cotizacion?.fechaSolicitud ?? hoyLocal} required />
      <Campo etiqueta="Fecha del servicio" nombre="fechaServicio" type="date" defaultValue={cotizacion?.fechaServicio ?? ""} required />
    </div>
    <Selector etiqueta="Estado" nombre="estado" opciones={estados(ESTADOS_COTIZACION)} defaultValue={cotizacion?.estado ?? "pendiente"} />
    <BotonEnviar>Guardar cotización</BotonEnviar>
  </Formulario>;
}

function FormularioViaje({ opciones, viaje }: { opciones: Opciones; viaje?: Viaje }) {
  return <Formulario accion={accionViaje.bind(null, viaje?.id ?? null)}>
    <CamposBase opciones={opciones} anterior={viaje} detalle="Recorrido y detalles" />
    <div className={rejilla}>
      <Campo etiqueta="Fecha del viaje" nombre="fecha" type="date" defaultValue={viaje?.fecha ?? ""} required />
      <Selector etiqueta="Estado" nombre="estado" opciones={estados(ESTADOS_VIAJE)} defaultValue={viaje?.estado ?? "programado"} />
      <Selector etiqueta="Bus" nombre="busId" opciones={seleccionables(opciones.buses, viaje?.busId)} defaultValue={viaje?.busId ?? ""} vacio="Por asignar" />
      <Selector etiqueta="Conductor" nombre="conductorId" opciones={seleccionables(opciones.conductores, viaje?.conductorId)} defaultValue={viaje?.conductorId ?? ""} vacio="Por asignar" />
    </div>
    <Casilla etiqueta="Documentación lista" nombre="documentacionLista" defaultChecked={viaje?.documentacionLista ?? false} />
    <BotonEnviar>Guardar viaje</BotonEnviar>
  </Formulario>;
}

function FormularioContrato({ opciones, contrato }: { opciones: Opciones; contrato?: Contrato }) {
  return <Formulario accion={accionContrato.bind(null, contrato?.id ?? null)}>
    <Campo etiqueta="Título" nombre="titulo" defaultValue={contrato?.titulo ?? ""} required />
    <CamposBase opciones={opciones} anterior={contrato} detalle="Condiciones y alcance" />
    <div className={rejilla}>
      <Campo etiqueta="Inicio" nombre="fechaInicio" type="date" defaultValue={contrato?.fechaInicio ?? ""} required />
      <Campo etiqueta="Vencimiento" nombre="fechaVencimiento" type="date" defaultValue={contrato?.fechaVencimiento ?? ""} required />
    </div>
    <LecturaAdjunto accion={iaHabilitada() ? accionLeerContrato : undefined} campos={[{ clave: "titulo", etiqueta: "Título" }, { clave: "cliente", etiqueta: "Cliente" },
      { clave: "fecha_inicio", etiqueta: "Inicio" }, { clave: "fecha_vencimiento", etiqueta: "Vencimiento" }, { clave: "monto", etiqueta: "Monto" }]} />
    <Casilla etiqueta="Contrato activo" nombre="activo" defaultChecked={contrato?.activo ?? true} />
    <BotonEnviar>Guardar contrato</BotonEnviar>
  </Formulario>;
}

function Edicion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <details className="mt-2 rounded-lg border border-slate-200 p-3">
    <summary className="cursor-pointer text-sm font-semibold">{titulo}</summary>
    <div className="mt-3">{children}</div>
  </details>;
}

export default async function PaginaOperaciones() {
  const usuario = await requerirUsuario();
  const editable = usuario.rol !== "consulta";
  const [cs, vs, contratos, clientes, servicios, buses, conductores] = await Promise.all([
    listarCotizaciones(), listarViajes(), listarContratos(),
    editable ? db.select({ id: personas.id, nombres: personas.nombres, apellidos: personas.apellidos, rut: personas.rut }).from(personas)
      .where(isNull(personas.eliminadoEn)).orderBy(asc(personas.apellidos), asc(personas.nombres)) : [],
    listarServicios(), listarBuses(), listarConductores(),
  ]);
  const opciones = {
    clientes: clientes.map((p) => ({ valor: p.id, texto: `${nombreCompleto(p)}${p.rut ? ` · ${p.rut}` : ""}` })),
    servicios: servicios.map((s) => ({ valor: s.id, texto: s.nombre, activo: s.activo })),
    conductores: conductores.map(({ conductor: c, persona }) => ({ valor: c.id, texto: nombreCompleto(persona), activo: c.activo })),
    buses: buses.map(({ bus }) => ({ valor: bus.id, texto: `Bus ${bus.numero}`, activo: bus.activo })),
  };
  const hoyLocal = hoy();
  const puedeCrear = editable && opciones.clientes.length > 0 && opciones.servicios.some((s) => s.activo);
  return <div className="space-y-5">
    <EncabezadoPagina titulo="Operaciones" descripcion="Cotizaciones, viajes y contratos vinculados a clientes y servicios." />
    <nav aria-label="Secciones de operaciones" className="flex flex-wrap gap-4 text-sm">
      <a href="#cotizaciones" className="enlace">Cotizaciones</a><a href="#viajes" className="enlace">Viajes</a><a href="#contratos" className="enlace">Contratos</a>
    </nav>
    {editable && !puedeCrear && <p className="text-sm text-slate-600">Para registrar una operación, crea el cliente en <Link href="/personas" className="enlace">Personas</Link> y un servicio activo en <Link href="/servicios" className="enlace">Servicios</Link>.</p>}
    <section id="cotizaciones" className="scroll-mt-20"><Tarjeta titulo="Cotizaciones">
      {puedeCrear && <Edicion titulo="Nueva cotización"><FormularioCotizacion opciones={opciones} hoyLocal={hoyLocal} /></Edicion>}
      {!cs.length && <p className="py-2 text-sm text-slate-600">Sin cotizaciones.</p>}
      <ul className="divide-y divide-slate-100">{cs.map(({ cotizacion: c, cliente, servicio, viajeId }) => <li key={c.id} id={`cotizacion-${c.id}`} className="scroll-mt-20 space-y-2 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><strong>#{c.id} · {servicio}</strong><span>{nombreCompleto(cliente)} · {formatearFecha(c.fechaServicio)} · {formatearPesos(c.monto)}</span><Insignia>{ESTADO_OPERACION_ETIQUETA[c.estado]}</Insignia></div>
        <p className="whitespace-pre-wrap">{c.detalle}</p>
        <div className="flex flex-wrap items-center gap-3"><a href={`/api/operaciones/cotizacion/${c.id}`} className="enlace">Descargar PDF</a>
          {viajeId && <a href={`#viaje-${viajeId}`} className="enlace">Ver viaje</a>}
          {!viajeId && editable && c.estado === "aceptada" && <BotonAccion accion={accionProgramarCotizacion.bind(null, c.id)} variante="secundario">Programar viaje</BotonAccion>}
        </div>
        {editable && <Edicion titulo="Editar cotización"><FormularioCotizacion opciones={opciones} cotizacion={c} hoyLocal={hoyLocal} /></Edicion>}
      </li>)}</ul>
    </Tarjeta></section>
    <section id="viajes" className="scroll-mt-20"><Tarjeta titulo="Viajes">
      {puedeCrear && <Edicion titulo="Nuevo viaje"><FormularioViaje opciones={opciones} /></Edicion>}
      {!vs.length && <p className="py-2 text-sm text-slate-600">Sin viajes.</p>}
      <ul className="divide-y divide-slate-100">{vs.map(({ viaje: v, cliente, servicio, bus }) => <li key={v.id} id={`viaje-${v.id}`} className="scroll-mt-20 space-y-2 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><strong>{formatearFecha(v.fecha)} · {servicio}</strong><span>{nombreCompleto(cliente)} · {formatearPesos(v.monto)}</span><Insignia>{ESTADO_OPERACION_ETIQUETA[v.estado]}</Insignia></div>
        <p>{bus ? `Bus ${bus}` : "Bus por asignar"} · {opciones.conductores.find((c) => c.valor === v.conductorId)?.texto ?? "Conductor por asignar"} · {v.documentacionLista ? "Documentación lista" : "Documentación pendiente"}</p>
        <p className="whitespace-pre-wrap">{v.detalle}</p>
        {editable && <Edicion titulo="Editar viaje"><FormularioViaje opciones={opciones} viaje={v} /></Edicion>}
      </li>)}</ul>
    </Tarjeta></section>
    <section id="contratos" className="scroll-mt-20"><Tarjeta titulo="Contratos">
      {puedeCrear && <Edicion titulo="Nuevo contrato"><FormularioContrato opciones={opciones} /></Edicion>}
      {!contratos.length && <p className="py-2 text-sm text-slate-600">Sin contratos.</p>}
      <ul className="divide-y divide-slate-100">{contratos.map(({ contrato: c, cliente, servicio }) => <li key={c.id} id={`contrato-${c.id}`} className="scroll-mt-20 space-y-2 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><strong>{c.titulo}</strong><span>{nombreCompleto(cliente)} · {servicio} · {formatearPesos(c.monto)}</span><Insignia color={!c.activo ? "gris" : c.fechaVencimiento < hoyLocal ? "rojo" : "verde"}>{!c.activo ? "Inactivo" : c.fechaVencimiento < hoyLocal ? "Vencido" : "Activo"}</Insignia></div>
        <p>{formatearFecha(c.fechaInicio)} al {formatearFecha(c.fechaVencimiento)}</p>
        <div className="flex flex-wrap gap-3"><a href={`/api/operaciones/contrato/${c.id}`} className="enlace">Descargar borrador PDF</a>
          {c.documentoId && <a href={`/api/documentos/${c.documentoId}`} target="_blank" className="enlace">Abrir adjunto</a>}
        </div>
        {editable && <Edicion titulo="Editar contrato"><FormularioContrato opciones={opciones} contrato={c} /></Edicion>}
      </li>)}</ul>
    </Tarjeta></section>
  </div>;
}
