import { redirect } from "next/navigation";
import { accionPrimerUsuario, hayUsuarios } from "../acciones";
import { FormularioPrimerUsuario } from "./formulario";

export const metadata = { title: "Primer usuario" };

export default async function PaginaPrimerUsuario() {
  if (await hayUsuarios()) redirect("/login");
  return <FormularioPrimerUsuario accion={accionPrimerUsuario} />;
}
