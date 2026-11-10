"use client";

import { AreaTexto, BotonEnviar, Campo, Formulario } from "@/components/ui/formularios";
import { accionCrearRecordatorio } from "./acciones";

export function FormularioRecordatorio({ hoy }: { hoy: string }) {
  return (
    <Formulario accion={accionCrearRecordatorio} reiniciar>
      {(e) => (
        <>
          <Campo etiqueta="¿Qué hay que recordar?" nombre="titulo" required errores={e} placeholder="Llamar a apoderado de…" />
          <Campo etiqueta="Fecha" nombre="fecha" type="date" required defaultValue={hoy} errores={e} />
          <AreaTexto etiqueta="Detalle" nombre="detalle" />
          <BotonEnviar>Guardar recordatorio</BotonEnviar>
        </>
      )}
    </Formulario>
  );
}
