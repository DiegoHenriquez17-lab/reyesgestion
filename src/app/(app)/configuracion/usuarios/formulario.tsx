"use client";

import { BotonEnviar, Campo, Casilla, Formulario, Selector, type AccionFormulario } from "@/components/ui/formularios";
import { ROLES, ROL_ETIQUETA } from "@/lib/constantes";

type Usuario = { nombre: string; email: string; rol: (typeof ROLES)[number]; activo: boolean };

export function FormularioUsuario({ accion, usuario }: { accion: AccionFormulario; usuario?: Usuario }) {
  return (
    <Formulario accion={accion} reiniciar={!usuario}>
      {(e) => (
        <div className="grid items-end gap-3 sm:grid-cols-6">
          <Campo etiqueta="Nombre" nombre="nombre" required defaultValue={usuario?.nombre} errores={e} />
          <Campo etiqueta="Correo" nombre="email" type="email" required defaultValue={usuario?.email} errores={e} className="sm:col-span-2" />
          <Selector etiqueta="Rol" nombre="rol" defaultValue={usuario?.rol ?? "operador"} opciones={ROLES.map((r) => ({ valor: r, texto: ROL_ETIQUETA[r] }))} />
          <Campo
            etiqueta={usuario ? "Nueva contraseña" : "Contraseña"}
            nombre="clave"
            type="password"
            required={!usuario}
            autoComplete="new-password"
            errores={e}
            placeholder={usuario ? "(sin cambio)" : ""}
          />
          <div className="flex items-center gap-3">
            {usuario && <Casilla nombre="activo" etiqueta="Activo" defaultChecked={usuario.activo} />}
            <BotonEnviar tamano="sm">{usuario ? "Guardar" : "Crear"}</BotonEnviar>
          </div>
        </div>
      )}
    </Formulario>
  );
}
