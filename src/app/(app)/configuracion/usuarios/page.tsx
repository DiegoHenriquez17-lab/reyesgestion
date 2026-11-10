import { asc } from "drizzle-orm";
import { requerirUsuario } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { usuarios } from "@/server/db/schema";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { ROL_ETIQUETA } from "@/lib/constantes";
import { formatearFechaHora } from "@/lib/formato";
import { accionGuardarUsuario } from "../acciones";
import { FormularioUsuario } from "./formulario";

export const metadata = { title: "Usuarios" };

export default async function PaginaUsuarios() {
  await requerirUsuario(["admin"]);
  const lista = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, email: usuarios.email, rol: usuarios.rol, activo: usuarios.activo, ultimoAcceso: usuarios.ultimoAcceso })
    .from(usuarios)
    .orderBy(asc(usuarios.nombre));
  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        volver={{ href: "/configuracion", texto: "Configuración" }}
        descripcion="Administrador: todo. Operador: registra y modifica (no anula pagos ni configura). Solo consulta: ve información sin modificar."
      />
      <Tarjeta titulo="Nuevo usuario" className="mb-6">
        <FormularioUsuario accion={accionGuardarUsuario.bind(null, null)} />
      </Tarjeta>
      <div className="space-y-3">
        {lista.map((u) => (
          <details key={u.id} className="tarjeta p-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
              <span className="font-bold">{u.nombre}</span>
              <span className="text-sm text-slate-500">{u.email}</span>
              <Insignia color={u.rol === "admin" ? "azul" : "gris"}>{ROL_ETIQUETA[u.rol]}</Insignia>
              {!u.activo && <Insignia color="rojo">Desactivado</Insignia>}
              <span className="ml-auto text-xs text-slate-500">Último acceso: {formatearFechaHora(u.ultimoAcceso)}</span>
            </summary>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <FormularioUsuario accion={accionGuardarUsuario.bind(null, u.id)} usuario={u} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
