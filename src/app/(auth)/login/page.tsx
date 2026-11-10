import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/server/auth/sesion";
import { accionLogin, hayUsuarios } from "../acciones";
import { FormularioLogin } from "./formulario";

export const metadata = { title: "Ingresar" };

export default async function PaginaLogin() {
  if (await obtenerUsuarioActual()) redirect("/");
  if (!(await hayUsuarios())) redirect("/primer-usuario");
  return <FormularioLogin accion={accionLogin} />;
}
