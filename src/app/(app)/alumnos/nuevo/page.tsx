import { requerirUsuario } from "@/server/auth/sesion";
import { listarBuses, listarServicios } from "@/server/modulos/catalogos";
import { EncabezadoPagina } from "@/components/ui/basicos";
import { accionCrearAlumno } from "../acciones";
import { FormularioAlumno } from "../formulario-alumno";

export const metadata = { title: "Nuevo alumno" };

export default async function PaginaNuevoAlumno({ searchParams }: { searchParams: Promise<{ nombre?: string }> }) {
  await requerirUsuario(["admin", "operador"]);
  const [buses, servicios, sp] = await Promise.all([listarBuses(true), listarServicios(true), searchParams]);
  const [nombres, ...resto] = (sp.nombre ?? "").split(" ");
  return (
    <>
      <EncabezadoPagina titulo="Nuevo alumno" volver={{ href: "/alumnos", texto: "Alumnos" }} />
      <FormularioAlumno
        modo="crear"
        accion={accionCrearAlumno}
        buses={buses.map((b) => b.bus)}
        servicios={servicios}
        valores={{ nombres, apellidos: resto.join(" ") }}
      />
    </>
  );
}
