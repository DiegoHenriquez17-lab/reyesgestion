"use client";

import { BotonEnviar, Campo, Casilla, Formulario, Selector, type AccionFormulario } from "@/components/ui/formularios";
import { ROLES, ROL_ETIQUETA, TIPOS_SERVICIO, TIPO_SERVICIO_ETIQUETA } from "@/lib/constantes";

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
