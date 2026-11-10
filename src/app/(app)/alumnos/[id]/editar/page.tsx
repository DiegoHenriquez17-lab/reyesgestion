import { notFound } from "next/navigation";
import { requerirUsuario } from "@/server/auth/sesion";
import { obtenerFichaAlumno } from "@/server/modulos/alumnos";
import { listarBuses, listarServicios } from "@/server/modulos/catalogos";
import { EncabezadoPagina } from "@/components/ui/basicos";
import { nombreCompleto } from "@/lib/formato";
import { accionEditarAlumno } from "../../acciones";
import { FormularioAlumno } from "../../formulario-alumno";

export default async function EditarAlumno({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario(["admin", "operador"]);
  const { id } = await params;
  const [ficha, buses, servicios] = await Promise.all([obtenerFichaAlumno(Number(id)), listarBuses(), listarServicios()]);
  if (!ficha) notFound();
  const { alumno } = ficha;
  const p = alumno.persona;
  return (
    <>
      <EncabezadoPagina titulo={`Editar: ${nombreCompleto(p)}`} volver={{ href: `/alumnos/${alumno.id}`, texto: "Volver a la ficha" }} />
      <FormularioAlumno
        modo="editar"
        accion={accionEditarAlumno.bind(null, alumno.id)}
        buses={buses.map((b) => b.bus)}
        servicios={servicios}
        valores={{
          nombres: p.nombres,
          apellidos: p.apellidos,
          rut: p.rut,
          telefono: p.telefono,
          email: p.email,
          direccion: p.direccion,
          comuna: p.comuna,
          establecimiento: alumno.establecimiento,
          curso: alumno.curso,
          busId: alumno.busId,
          servicioId: alumno.servicioId,
          tarifaMensual: alumno.tarifaMensual,
          diaVencimiento: alumno.diaVencimiento,
          fechaIngreso: alumno.fechaIngreso,
          fechaRetiro: alumno.fechaRetiro,
          estado: alumno.estado,
          observaciones: alumno.observaciones,
        }}
      />
    </>
  );
}
