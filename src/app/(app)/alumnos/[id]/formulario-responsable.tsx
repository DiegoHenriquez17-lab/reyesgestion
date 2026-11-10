"use client";

import { useState } from "react";
import { BotonEnviar, Campo, Casilla, Formulario, type AccionFormulario } from "@/components/ui/formularios";

export function FormularioResponsable({ accion }: { accion: AccionFormulario }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="text-sm font-semibold text-marca-700 hover:underline">
        + Agregar apoderado / pagador
      </button>
    );
  }
  return (
    <Formulario accion={accion} reiniciar alExito={() => setAbierto(false)}>
      {(e) => (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Nombres" nombre="nombres" required errores={e} />
            <Campo etiqueta="Apellidos" nombre="apellidos" errores={e} />
            <Campo etiqueta="RUT" nombre="rut" errores={e} />
            <Campo etiqueta="Teléfono" nombre="telefono" errores={e} />
            <Campo etiqueta="Correo" nombre="email" errores={e} />
            <Campo etiqueta="Parentesco" nombre="parentesco" errores={e} />
          </div>
          <div className="flex flex-wrap gap-4">
            <Casilla etiqueta="Apoderado" nombre="esApoderado" defaultChecked />
            <Casilla etiqueta="Titular" nombre="esTitular" />
            <Casilla etiqueta="Pagador" nombre="esPagador" />
          </div>
          <div className="flex gap-2">
            <BotonEnviar tamano="sm">Agregar</BotonEnviar>
            <button type="button" onClick={() => setAbierto(false)} className="text-sm text-slate-500">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Formulario>
  );
}
