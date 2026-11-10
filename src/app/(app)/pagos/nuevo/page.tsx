import { requerirUsuario } from "@/server/auth/sesion";
import { listarAlumnos } from "@/server/modulos/alumnos";
import { hoy } from "@/server/fechas";
import { EncabezadoPagina } from "@/components/ui/basicos";
import { nombreCompleto } from "@/lib/formato";
import { accionMensualidadesDeAlumno, accionRegistrarPago } from "../acciones";
import { FormularioPago } from "./formulario-pago";

export const metadata = { title: "Registrar pago" };

export default async function PaginaNuevoPago({ searchParams }: { searchParams: Promise<{ alumno?: string }> }) {
  await requerirUsuario(["admin", "operador"]);
  const [alumnos, sp] = await Promise.all([listarAlumnos({ estado: "todos" }), searchParams]);
  const titulares = Object.fromEntries(alumnos.filter((a) => a.titular).map((a) => [a.id, a.titular as string]));
  return (
    <>
      <EncabezadoPagina titulo="Registrar pago" descripcion="Alumno → mes → monto → guardar." volver={{ href: "/pagos", texto: "Pagos" }} />
      <FormularioPago
        accion={accionRegistrarPago}
        cargarMensualidades={accionMensualidadesDeAlumno}
        alumnoInicial={sp.alumno ? Number(sp.alumno) : null}
        hoy={hoy()}
        titulares={titulares}
        alumnos={alumnos.map((a) => ({
          id: a.id,
          nombre: nombreCompleto(a),
          detalle: [a.titular && `Apoderado: ${a.titular}`, a.busNumero && `Bus ${a.busNumero}`, a.deuda > 0 && `Debe ${a.deuda.toLocaleString("es-CL")}`]
            .filter(Boolean)
            .join(" · "),
        }))}
      />
    </>
  );
}
