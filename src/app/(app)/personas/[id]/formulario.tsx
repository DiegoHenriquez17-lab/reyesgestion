"use client";

import { AreaTexto, BotonEnviar, Campo, Formulario, type AccionFormulario } from "@/components/ui/formularios";

type P = { nombres: string; apellidos: string; rut: string | null; telefono: string | null; email: string | null; direccion: string | null; comuna: string | null; observaciones: string | null };

export function FormularioPersona({ accion, persona }: { accion: AccionFormulario; persona: P }) {
  return (
    <Formulario accion={accion}>
      {(e) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombres" nombre="nombres" required defaultValue={persona.nombres} errores={e} />
            <Campo etiqueta="Apellidos" nombre="apellidos" defaultValue={persona.apellidos} errores={e} />
            <Campo etiqueta="RUT" nombre="rut" defaultValue={persona.rut ?? ""} errores={e} />
            <Campo etiqueta="Teléfono" nombre="telefono" defaultValue={persona.telefono ?? ""} errores={e} />
            <Campo etiqueta="Correo" nombre="email" defaultValue={persona.email ?? ""} errores={e} />
            <Campo etiqueta="Comuna" nombre="comuna" defaultValue={persona.comuna ?? ""} errores={e} />
            <Campo etiqueta="Domicilio" nombre="direccion" defaultValue={persona.direccion ?? ""} errores={e} className="sm:col-span-2" />
          </div>
          <AreaTexto etiqueta="Observaciones" nombre="observaciones" defaultValue={persona.observaciones ?? ""} />
          <div className="flex flex-wrap items-end gap-3">
            <Campo etiqueta="Motivo del cambio (opcional)" nombre="motivo" className="flex-1" />
            <BotonEnviar>Guardar</BotonEnviar>
          </div>
        </>
      )}
    </Formulario>
  );
}
