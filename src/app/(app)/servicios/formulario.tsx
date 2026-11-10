"use client";

import { BotonEnviar, Campo, Casilla, Formulario, Selector, type AccionFormulario } from "@/components/ui/formularios";
import { TIPOS_SERVICIO, TIPO_SERVICIO_ETIQUETA } from "@/lib/constantes";

type Servicio = { nombre: string; tipo: (typeof TIPOS_SERVICIO)[number]; descripcion: string | null; tarifaReferencia: number | null; activo: boolean };

export function FormularioServicio({ accion, servicio }: { accion: AccionFormulario; servicio?: Servicio }) {
  return (
    <Formulario accion={accion} reiniciar={!servicio}>
      {(e) => (
        <div className="grid items-end gap-3 sm:grid-cols-6">
          <Campo etiqueta="Nombre" nombre="nombre" required defaultValue={servicio?.nombre} errores={e} className="sm:col-span-2" />
          <Selector
            etiqueta="Tipo"
            nombre="tipo"
            defaultValue={servicio?.tipo ?? "escolar"}
            opciones={TIPOS_SERVICIO.map((t) => ({ valor: t, texto: TIPO_SERVICIO_ETIQUETA[t] }))}
          />
          <Campo etiqueta="Tarifa referencia" nombre="tarifaReferencia" inputMode="numeric" defaultValue={servicio?.tarifaReferencia ?? ""} errores={e} />
          <Campo etiqueta="Descripción" nombre="descripcion" defaultValue={servicio?.descripcion ?? ""} errores={e} />
          <div className="flex items-center gap-3">
            <Casilla nombre="activo" etiqueta="Activo" defaultChecked={servicio?.activo ?? true} />
            <BotonEnviar tamano="sm">{servicio ? "Guardar" : "Agregar"}</BotonEnviar>
          </div>
        </div>
      )}
    </Formulario>
  );
}
