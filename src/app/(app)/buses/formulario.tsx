"use client";

import { BotonEnviar, Campo, Casilla, Formulario, type AccionFormulario } from "@/components/ui/formularios";

type Bus = { numero: string; patente: string | null; descripcion: string | null; capacidad: number | null; activo: boolean };

export function FormularioBus({ accion, bus }: { accion: AccionFormulario; bus?: Bus }) {
  return (
    <Formulario accion={accion} reiniciar={!bus}>
      {(e) => (
        <div className="grid items-end gap-3 sm:grid-cols-6">
          <Campo etiqueta="N° interno" nombre="numero" required defaultValue={bus?.numero} errores={e} placeholder="16" />
          <Campo etiqueta="Patente" nombre="patente" defaultValue={bus?.patente ?? ""} errores={e} />
          <Campo etiqueta="Descripción" nombre="descripcion" defaultValue={bus?.descripcion ?? ""} errores={e} className="sm:col-span-2" />
          <Campo etiqueta="Capacidad" nombre="capacidad" type="number" defaultValue={bus?.capacidad ?? ""} errores={e} />
          <div className="flex items-center gap-3">
            <Casilla nombre="activo" etiqueta="Activo" defaultChecked={bus?.activo ?? true} />
            <BotonEnviar tamano="sm">{bus ? "Guardar" : "Agregar"}</BotonEnviar>
          </div>
        </div>
      )}
    </Formulario>
  );
}
