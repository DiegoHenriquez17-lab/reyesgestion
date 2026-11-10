"use client";

import { AreaTexto, BotonEnviar, Campo, Casilla, Formulario, Selector, type AccionFormulario } from "@/components/ui/formularios";
import { ESTADOS_ALUMNO, ESTADO_ALUMNO_ETIQUETA } from "@/lib/constantes";

type Valores = Record<string, string | number | null | undefined>;

export function FormularioAlumno({
  accion,
  buses,
  servicios,
  valores = {},
  modo,
}: {
  accion: AccionFormulario;
  buses: { id: number; numero: string }[];
  servicios: { id: number; nombre: string; tarifaReferencia: number | null }[];
  valores?: Valores;
  modo: "crear" | "editar";
}) {
  const v = (k: string) => (valores[k] ?? "") as string;
  return (
    <Formulario accion={accion}>
      {(e) => (
        <>
          <fieldset className="tarjeta p-4">
            <legend className="px-1 text-sm font-bold text-slate-800">Datos del alumno</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo etiqueta="Nombres" nombre="nombres" required defaultValue={v("nombres")} errores={e} autoFocus={modo === "crear"} />
              <Campo etiqueta="Apellidos" nombre="apellidos" defaultValue={v("apellidos")} errores={e} />
              <Campo etiqueta="RUT" nombre="rut" placeholder="12.345.678-9" defaultValue={v("rut")} errores={e} />
              <Campo etiqueta="Teléfono" nombre="telefono" type="tel" defaultValue={v("telefono")} errores={e} />
              <Campo etiqueta="Domicilio" nombre="direccion" defaultValue={v("direccion")} errores={e} className="lg:col-span-2" />
              <Campo etiqueta="Comuna" nombre="comuna" defaultValue={v("comuna")} errores={e} />
              <Campo etiqueta="Colegio" nombre="establecimiento" defaultValue={v("establecimiento")} errores={e} />
              <Campo etiqueta="Curso" nombre="curso" defaultValue={v("curso")} errores={e} />
              <Campo etiqueta="Correo" nombre="email" type="email" defaultValue={v("email")} errores={e} />
            </div>
          </fieldset>

          <fieldset className="tarjeta p-4">
            <legend className="px-1 text-sm font-bold text-slate-800">Servicio y cobro</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Selector
                etiqueta="Bus"
                nombre="busId"
                vacio="Sin bus asignado"
                defaultValue={v("busId")}
                opciones={buses.map((b) => ({ valor: b.id, texto: `Bus ${b.numero}` }))}
                errores={e}
              />
              <Selector
                etiqueta="Servicio"
                nombre="servicioId"
                vacio="Sin servicio"
                defaultValue={v("servicioId")}
                opciones={servicios.map((s) => ({ valor: s.id, texto: s.nombre }))}
                errores={e}
              />
              <Campo etiqueta="Tarifa mensual ($)" nombre="tarifaMensual" inputMode="numeric" required defaultValue={v("tarifaMensual")} errores={e} placeholder="95000" />
              <Campo
                etiqueta="Día de vencimiento"
                nombre="diaVencimiento"
                type="number"
                min={1}
                max={31}
                defaultValue={v("diaVencimiento")}
                errores={e}
                ayuda="Vacío = el general"
              />
              <Campo etiqueta="Fecha de ingreso" nombre="fechaIngreso" type="date" defaultValue={v("fechaIngreso")} errores={e} />
              <Campo etiqueta="Fecha de retiro" nombre="fechaRetiro" type="date" defaultValue={v("fechaRetiro")} errores={e} />
              <Selector
                etiqueta="Estado"
                nombre="estado"
                defaultValue={v("estado") || "activo"}
                opciones={ESTADOS_ALUMNO.map((s) => ({ valor: s, texto: ESTADO_ALUMNO_ETIQUETA[s] }))}
                errores={e}
              />
            </div>
            <AreaTexto etiqueta="Observaciones" nombre="observaciones" defaultValue={v("observaciones")} className="mt-3" />
          </fieldset>

          {modo === "crear" && (
            <fieldset className="tarjeta p-4">
              <legend className="px-1 text-sm font-bold text-slate-800">Apoderado (opcional)</legend>
              <p className="mb-3 text-xs text-slate-500">Si el RUT ya existe en el sistema, se vincula la persona existente (no se duplica).</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Campo etiqueta="Nombres" nombre="apNombres" errores={e} />
                <Campo etiqueta="Apellidos" nombre="apApellidos" errores={e} />
                <Campo etiqueta="RUT" nombre="apRut" errores={e} />
                <Campo etiqueta="Teléfono" nombre="apTelefono" type="tel" errores={e} />
                <Campo etiqueta="Correo" nombre="apEmail" type="email" errores={e} />
                <Campo etiqueta="Parentesco" nombre="apParentesco" placeholder="Madre, padre…" errores={e} />
              </div>
              <div className="mt-3 flex flex-wrap gap-5">
                <Casilla etiqueta="Apoderado titular" nombre="apEsTitular" defaultChecked />
                <Casilla etiqueta="Es quien paga" nombre="apEsPagador" defaultChecked />
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {modo === "crear" ? (
              <Casilla etiqueta="Crear de todas formas aunque exista alguien parecido" nombre="confirmarDuplicado" />
            ) : (
              <Campo etiqueta="Motivo del cambio (opcional)" nombre="motivo" className="min-w-64 flex-1" />
            )}
            <BotonEnviar tamano="lg">{modo === "crear" ? "Crear alumno" : "Guardar cambios"}</BotonEnviar>
          </div>
        </>
      )}
    </Formulario>
  );
}
