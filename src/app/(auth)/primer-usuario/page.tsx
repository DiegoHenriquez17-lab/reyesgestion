import { redirect } from "next/navigation";
import { connection } from "next/server";
import { entorno } from "@/server/entorno";
import { accionPrimerUsuario, hayUsuarios } from "../acciones";
import { FormularioPrimerUsuario } from "./formulario";

export const metadata = { title: "Primer usuario" };

export default async function PaginaPrimerUsuario() {
  await connection();
  if (!entorno.REGISTRO_INICIAL_WEB || await hayUsuarios()) redirect("/login");
  return <FormularioPrimerUsuario accion={accionPrimerUsuario} />;
}
