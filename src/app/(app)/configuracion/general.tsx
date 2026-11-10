"use client";

import { BotonEnviar, Campo, Formulario } from "@/components/ui/formularios";
import { nombreMes } from "@/lib/formato";
import { accionGuardarGeneral } from "./acciones";

type Valores = { empresaNombre: string; empresaRut: string; dia: number; meses: number[]; coincidencia: number; intervalo: number };

export function FormularioGeneral({ valores }: { valores: Valores }) {
  return (
    <Formulario accion={accionGuardarGeneral}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre de la empresa" nombre="empresa_nombre" defaultValue={valores.empresaNombre} required />
        <Campo etiqueta="RUT de la empresa" nombre="empresa_rut" defaultValue={valores.empresaRut} />
        <Campo etiqueta="Día de vencimiento de mensualidades" nombre="dia_vencimiento" type="number" min={1} max={31} defaultValue={valores.dia} required />
        <Campo
          etiqueta="Coincidencia mínima para sugerir (0,1 a 1)"
          nombre="coincidencia"
          type="number"
          step="0.05"
          min={0.1}
          max={1}
          defaultValue={valores.coincidencia}
          ayuda="Más alto = sugerencias más estrictas al conciliar pagos."
        />
        <Campo etiqueta="Recalcular alertas cada (minutos)" nombre="intervalo" type="number" min={1} defaultValue={valores.intervalo} />
      </div>
      <div>
        <p className="etiqueta">Meses en que se cobra mensualidad</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="meses" value={m} defaultChecked={valores.meses.includes(m)} className="size-4" />
              {nombreMes(m)}
            </label>
          ))}
        </div>
      </div>
      <BotonEnviar>Guardar configuración</BotonEnviar>
    </Formulario>
  );
}
