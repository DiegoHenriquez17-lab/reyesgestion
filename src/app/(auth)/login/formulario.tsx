"use client";

import { BotonEnviar, Campo, Formulario, type AccionFormulario } from "@/components/ui/formularios";

export function FormularioLogin({ accion }: { accion: AccionFormulario }) {
  return (
    <Formulario accion={accion}>
      <h2 className="text-lg font-bold text-slate-800">Ingresar</h2>
      <Campo etiqueta="Correo" nombre="email" type="email" autoComplete="username" required autoFocus />
      <Campo etiqueta="Contraseña" nombre="clave" type="password" autoComplete="current-password" required />
      <BotonEnviar className="w-full" textoEnviando="Ingresando…">
        Ingresar
      </BotonEnviar>
    </Formulario>
  );
}
