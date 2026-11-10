"use client";

import { BotonEnviar, Campo, Formulario, type AccionFormulario } from "@/components/ui/formularios";

export function FormularioPrimerUsuario({ accion }: { accion: AccionFormulario }) {
  return (
    <Formulario accion={accion}>
      {(e) => (
        <>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Crear administrador</h2>
            <p className="text-sm text-slate-500">Es la primera vez que se usa el sistema. Crea tu cuenta de administrador.</p>
          </div>
          <Campo etiqueta="Nombre" nombre="nombre" required errores={e} />
          <Campo etiqueta="Correo" nombre="email" type="email" required errores={e} />
          <Campo etiqueta="Contraseña" nombre="clave" type="password" required errores={e} ayuda="Mínimo 10 caracteres, con letras y números." />
          <Campo etiqueta="Repetir contraseña" nombre="clave2" type="password" required errores={e} />
          <BotonEnviar className="w-full">Crear y entrar</BotonEnviar>
        </>
      )}
    </Formulario>
  );
}
