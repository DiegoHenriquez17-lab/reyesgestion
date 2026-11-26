import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { AreaTexto, BotonEnviar, Campo, Casilla, Formulario, Selector } from "@/components/ui/formularios";
import { LecturaAdjunto } from "@/components/ui/lectura-adjunto";
import { formatearFecha, formatearNumero, formatearPesos, nombreCompleto } from "@/lib/formato";
import { TAREAS_MANTENCION, TIPOS_CONTROL_BUS, TIPOS_CONTROL_CONDUCTOR } from "@/lib/flota";
import { requerirUsuario } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { buses, conductores, personas } from "@/server/db/schema";
import { hoy } from "@/server/fechas";
import { iaHabilitada } from "@/server/entorno";
import { kmActualSql, listarConductores, listarDocumentosControl, listarMantenciones, listarPlanes } from "@/server/modulos/flota";
import { accionArchivarDocumento, accionCompletarMantencion, accionConductor, accionDocumentoControl, accionKilometraje, accionLeerAdjunto, accionPlan } from "./acciones";

export const metadata = { title: "Control de flota" };

type Opcion = { valor: number; texto: string };
const rejilla = "grid gap-3 sm:grid-cols-2";
const numero = (km: number | null) => km === null ? "Sin lectura" : `${formatearNumero(km)} km`;

function CamposConductor({ conductor }: { conductor?: Awaited<ReturnType<typeof listarConductores>>[number]["conductor"] }) {
  return (
    <>
      <Campo etiqueta="Clase de licencia" nombre="claseLicencia" defaultValue={conductor?.claseLicencia ?? ""} />
      <AreaTexto etiqueta="Observaciones" nombre="observaciones" defaultValue={conductor?.observaciones ?? ""} />
      <Casilla etiqueta="Conductor activo" nombre="activo" defaultChecked={conductor?.activo ?? true} />
      {conductor && <Campo etiqueta="Motivo del cambio" nombre="motivo" required />}
      <BotonEnviar>Guardar conductor</BotonEnviar>
    </>
  );
}

function CamposDocumento({ titular, opciones, existente }: { titular: "bus" | "conductor"; opciones: Opcion[]; existente?: Awaited<ReturnType<typeof listarDocumentosControl>>[number]["documento"] }) {
  const esBus = titular === "bus";
  const tipos = esBus ? TIPOS_CONTROL_BUS : TIPOS_CONTROL_CONDUCTOR;
  return (
    <Formulario accion={accionDocumentoControl.bind(null, existente?.id ?? null)}>
      <div className={rejilla}>
        <Selector etiqueta={esBus ? "Bus" : "Conductor"} nombre={esBus ? "busId" : "conductorId"} opciones={opciones} vacio="Selecciona" defaultValue={(esBus ? existente?.busId : existente?.conductorId) ?? ""} required />
        <Selector etiqueta="Tipo" nombre="tipo" opciones={tipos.map((t) => ({ valor: t, texto: t }))} defaultValue={existente?.tipo ?? tipos[0]} required />
        <Campo etiqueta="Emisión" nombre="fechaEmision" type="date" defaultValue={existente?.fechaEmision ?? ""} />
        <Campo etiqueta="Vencimiento" nombre="fechaVencimiento" type="date" defaultValue={existente?.fechaVencimiento ?? ""} required />
      </div>
      <LecturaAdjunto accion={iaHabilitada() ? accionLeerAdjunto : undefined} campos={[{ clave: "patente", etiqueta: "Patente" }, { clave: "tipo", etiqueta: "Tipo" },
        { clave: "fecha_emision", etiqueta: "Emisión" }, { clave: "fecha_vencimiento", etiqueta: "Vencimiento" }]} />
      <AreaTexto etiqueta="Observaciones" nombre="observaciones" defaultValue={existente?.observaciones ?? ""} />
      {existente && <Campo etiqueta="Motivo del cambio" nombre="motivo" required />}
      <BotonEnviar>Guardar documento</BotonEnviar>
    </Formulario>
  );
}

function CamposPlan({ opciones, plan }: { opciones: Opcion[]; plan?: Awaited<ReturnType<typeof listarPlanes>>[number]["plan"] }) {
  return (
    <Formulario accion={accionPlan.bind(null, plan?.id ?? null)}>
      {plan ? <input type="hidden" name="busId" value={plan.busId} /> : <Selector etiqueta="Bus" nombre="busId" opciones={opciones} vacio="Selecciona" required />}
      <Campo etiqueta="Tarea" nombre="tarea" list="tareas-mantencion" defaultValue={plan?.tarea ?? ""} required />
      <div className={rejilla}>
        <Campo etiqueta="Próxima fecha" nombre="proximaFecha" type="date" defaultValue={plan?.proximaFecha ?? ""} />
        <Campo etiqueta="Próximo kilometraje" nombre="proximoKm" type="number" min={0} defaultValue={plan?.proximoKm ?? ""} />
        <Campo etiqueta="Repetir cada (días)" nombre="intervaloDias" type="number" min={1} defaultValue={plan?.intervaloDias ?? ""} />
        <Campo etiqueta="Repetir cada (km)" nombre="intervaloKm" type="number" min={1} defaultValue={plan?.intervaloKm ?? ""} />
      </div>
      <Casilla etiqueta="Plan activo" nombre="activo" defaultChecked={plan?.activo ?? true} />
      {plan && <Campo etiqueta="Motivo del cambio" nombre="motivo" required />}
      <BotonEnviar>Guardar plan</BotonEnviar>
    </Formulario>
  );
}

export default async function PaginaFlota() {
  const usuario = await requerirUsuario();
  const editable = usuario.rol !== "consulta";
  const hoyLocal = hoy();
  const [listaBuses, listaConductores, documentos, planes, historial, personasSinFicha] = await Promise.all([
    db.select({ id: buses.id, numero: buses.numero, km: kmActualSql }).from(buses).where(isNull(buses.eliminadoEn)).orderBy(asc(buses.numero)),
    listarConductores(), listarDocumentosControl(), listarPlanes(), listarMantenciones(30),
    editable ? db.select({ id: personas.id, nombres: personas.nombres, apellidos: personas.apellidos, rut: personas.rut }).from(personas)
      .leftJoin(conductores, eq(conductores.personaId, personas.id)).where(and(isNull(conductores.id), isNull(personas.eliminadoEn))).orderBy(asc(personas.apellidos), asc(personas.nombres)) : [],
  ]);
  const opcionesBus = listaBuses.map((b) => ({ valor: b.id, texto: `Bus ${b.numero}` }));
  const opcionesConductor = listaConductores.map(({ conductor, persona }) => ({ valor: conductor.id, texto: nombreCompleto(persona) }));

  return (
    <div className="space-y-5">
      <EncabezadoPagina titulo="Control de flota" descripcion="Conductores, vencimientos y mantenciones de los buses." />
      <nav aria-label="Secciones de flota" className="flex flex-wrap gap-4 text-sm">
        <a href="#conductores" className="enlace">Conductores</a>
        <a href="#documentos" className="enlace">Documentos</a>
        <a href="#mantenciones" className="enlace">Mantenciones</a>
      </nav>
      <section id="conductores" className="scroll-mt-20">
        <Tarjeta titulo="Conductores" acciones={editable && <Link href="/importar?destino=conductores" className="enlace text-sm">Importar nómina</Link>}>
          {editable && <details className="mb-4 rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer font-semibold">Agregar conductor</summary>
            <div className="mt-3">
              <p className="mb-3 text-sm text-slate-600">Selecciona su ficha o créala primero en <Link className="enlace" href="/personas">Personas</Link>.</p>
              {personasSinFicha.length > 0 && <Formulario accion={accionConductor.bind(null, null)}>
                <Selector etiqueta="Persona" nombre="personaId" opciones={personasSinFicha.map((p) => ({ valor: p.id, texto: `${nombreCompleto(p)}${p.rut ? ` · ${p.rut}` : ""}` }))} vacio="Selecciona" required />
                <CamposConductor />
              </Formulario>}
            </div>
          </details>}
          {listaConductores.length === 0 && <p className="text-sm text-slate-600">Sin conductores registrados.</p>}
          <ul className="divide-y divide-slate-100">
            {listaConductores.map(({ conductor, persona }) => <li key={conductor.id} id={`conductor-${conductor.id}`} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link className="enlace font-semibold" href={`/personas/${persona.id}`}>{nombreCompleto(persona)}</Link>
                {conductor.claseLicencia && <span>Licencia {conductor.claseLicencia}</span>}
                <Insignia color={conductor.activo ? "verde" : "gris"}>{conductor.activo ? "Activo" : "Inactivo"}</Insignia>
              </div>
              {editable && <details>
                <summary className="cursor-pointer text-sm text-slate-600">Editar conductor</summary>
                <Formulario className="mt-2" accion={accionConductor.bind(null, conductor.id)}>
                  <input type="hidden" name="personaId" value={persona.id} />
                  <CamposConductor conductor={conductor} />
                </Formulario>
              </details>}
            </li>)}
          </ul>
        </Tarjeta>
      </section>

      <section id="documentos" className="scroll-mt-20">
        <Tarjeta titulo="Documentos y vencimientos">
          {editable && <div className={`${rejilla} mb-4`}>
            {([{ titular: "bus", opciones: opcionesBus }, { titular: "conductor", opciones: opcionesConductor }] as const).map(({ titular, opciones }) => opciones.length > 0 && (
              <details key={titular} className="self-start rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer font-semibold">Agregar documento de {titular}</summary>
                <div className="mt-3"><CamposDocumento titular={titular} opciones={opciones} /></div>
              </details>
            ))}
          </div>}
          {documentos.length === 0 && <p className="text-sm text-slate-600">Sin documentos registrados.</p>}
          <ul className="divide-y divide-slate-100">
            {documentos.map(({ documento: d, bus, nombres, apellidos }) => <li key={d.id} id={`documento-${d.id}`} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <strong>{d.tipo}</strong><span>{bus ? `Bus ${bus}` : `${nombres ?? ""} ${apellidos ?? ""}`}</span>
                <Insignia color={d.fechaVencimiento < hoyLocal ? "rojo" : "gris"}>{d.fechaVencimiento < hoyLocal ? "Venció" : "Vence"} {formatearFecha(d.fechaVencimiento)}</Insignia>
                {d.documentoId && <a href={`/api/documentos/${d.documentoId}`} target="_blank" className="enlace">Abrir adjunto</a>}
              </div>
              {editable && <details>
                <summary className="cursor-pointer text-sm text-slate-600">Editar o archivar</summary>
                <div className={`${rejilla} mt-2`}>
                  <CamposDocumento titular={bus ? "bus" : "conductor"} opciones={bus ? opcionesBus : opcionesConductor} existente={d} />
                  <Formulario accion={accionArchivarDocumento.bind(null, d.id)}>
                    <Campo etiqueta="Motivo para archivar" nombre="motivo" required />
                    <BotonEnviar variante="secundario">Archivar documento</BotonEnviar>
                  </Formulario>
                </div>
              </details>}
            </li>)}
          </ul>
        </Tarjeta>
      </section>

      <section id="mantenciones" className="scroll-mt-20 space-y-4">
        <Tarjeta titulo="Kilometraje y planes de mantención">
          <datalist id="tareas-mantencion">{TAREAS_MANTENCION.map((t) => <option key={t} value={t} />)}</datalist>
          {editable && opcionesBus.length > 0 && <div className={`${rejilla} mb-4`}>
            <details className="self-start rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer font-semibold">Registrar kilometraje</summary>
              <Formulario className="mt-3" accion={accionKilometraje}>
                <Selector etiqueta="Bus" nombre="busId" opciones={opcionesBus} vacio="Selecciona" required />
                <Campo etiqueta="Fecha" nombre="fecha" type="date" defaultValue={hoyLocal} max={hoyLocal} required />
                <Campo etiqueta="Kilometraje" nombre="kilometraje" type="number" min={0} required />
                <BotonEnviar>Registrar lectura</BotonEnviar>
              </Formulario>
            </details>
            <details className="self-start rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer font-semibold">Programar mantención</summary>
              <div className="mt-3"><CamposPlan opciones={opcionesBus} /></div>
            </details>
          </div>}
          {listaBuses.length > 0 && <ul className="mb-3 flex flex-wrap gap-2">{listaBuses.map((b) => <li key={b.id}><Insignia>Bus {b.numero} · {numero(b.km)}</Insignia></li>)}</ul>}
          {planes.length === 0 && <p className="text-sm text-slate-600">Sin planes registrados.</p>}
          <ul className="divide-y divide-slate-100">
            {planes.map(({ plan, numero: bus }) => <li key={plan.id} id={`plan-${plan.id}`} className="space-y-2 py-3">
              <p className="text-sm"><strong>Bus {bus} · {plan.tarea}</strong>{plan.activo ? ` · ${[plan.proximaFecha && formatearFecha(plan.proximaFecha), plan.proximoKm !== null && numero(plan.proximoKm)].filter(Boolean).join(" / ")}` : " · Inactivo"}</p>
              {editable && <details>
                <summary className="cursor-pointer text-sm text-slate-600">Administrar plan</summary>
                <div className={`${rejilla} mt-2`}>
                  <CamposPlan opciones={opcionesBus} plan={plan} />
                  {plan.activo && <Formulario accion={accionCompletarMantencion}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <Campo etiqueta="Fecha realizada" nombre="fecha" type="date" defaultValue={hoyLocal} max={hoyLocal} required />
                    <Campo etiqueta="Kilometraje al realizarla" nombre="kilometraje" type="number" min={0} required={Boolean(plan.intervaloKm)} />
                    <Campo etiqueta="Costo (CLP)" nombre="costo" type="number" min={0} required />
                    <AreaTexto etiqueta="Observaciones" nombre="observaciones" />
                    <BotonEnviar variante="exito">Registrar mantención realizada</BotonEnviar>
                  </Formulario>}
                </div>
              </details>}
            </li>)}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Mantenciones realizadas">
          {historial.length === 0 && <p className="text-sm text-slate-600">Sin mantenciones registradas.</p>}
          <ul className="divide-y divide-slate-100 text-sm">
            {historial.map(({ mantencion: m, numero: bus }) => <li key={m.id} className="py-2"><strong>Bus {bus} · {m.tarea}</strong> · {formatearFecha(m.fecha)} · {formatearPesos(m.costo)}{m.observaciones && <p>{m.observaciones}</p>}</li>)}
          </ul>
          <Link className="enlace mt-3 inline-block text-sm" href="/informes/gastos_mantencion">Ver informe de gastos</Link>
        </Tarjeta>
      </section>
    </div>
  );
}
