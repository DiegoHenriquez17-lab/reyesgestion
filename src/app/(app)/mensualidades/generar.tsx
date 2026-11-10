"use client";

import { BotonEnviar, Formulario } from "@/components/ui/formularios";
import { accionGenerarMensualidades } from "./acciones";

export function GenerarMensualidades({ periodo }: { periodo: string }) {
  return (
    <Formulario accion={accionGenerarMensualidades} className="space-y-2">
      <input type="hidden" name="periodo" value={periodo} />
      <BotonEnviar textoEnviando="Generando…">Generar mensualidades del mes</BotonEnviar>
    </Formulario>
  );
}
