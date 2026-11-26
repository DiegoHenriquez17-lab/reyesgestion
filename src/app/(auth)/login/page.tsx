import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/server/auth/sesion";
import { accionLogin, hayUsuarios } from "../acciones";
import { FormularioLogin } from "./formulario";
import { entorno } from "@/server/entorno";

export const metadata = { title: "Ingresar" };

export default async function PaginaLogin() {
  if (await obtenerUsuarioActual()) redirect("/");
  if (entorno.REGISTRO_INICIAL_WEB && !(await hayUsuarios())) redirect("/primer-usuario");
  return <FormularioLogin accion={accionLogin} />;
}
