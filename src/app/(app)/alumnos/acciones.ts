"use server";

import { redirect } from "next/navigation";
import { ejecutarAccion } from "@/server/acciones";
import {
  actualizarFichaAlumno,
  crearAlumno,
  desvincularResponsable,
  vincularResponsable,
} from "@/server/modulos/alumnos";
import { obtenerOCrearPersona, posiblesDuplicados } from "@/server/modulos/personas";
import { ErrorNegocio } from "@/server/errores";
import { esquemaPersona, formDataAObjeto } from "@/lib/validaciones";
import { nombreCompleto } from "@/lib/formato";
import type { ResultadoAccion } from "@/lib/utils";

function separar(fd: FormData) {
  const o = formDataAObjeto(fd, ["apEsTitular", "apEsPagador", "confirmarDuplicado"]);
  const persona = {
    nombres: o.nombres,
    apellidos: o.apellidos,
    rut: o.rut,
    telefono: o.telefono,
    email: o.email,
    direccion: o.direccion,
    comuna: o.comuna,
    observaciones: o.observacionesPersona,
  };
  const alumno = {
    establecimiento: o.establecimiento,
    curso: o.curso,
    busId: o.busId,
    servicioId: o.servicioId,
    tarifaMensual: o.tarifaMensual || "0",
    diaVencimiento: o.diaVencimiento,
    fechaIngreso: o.fechaIngreso,
    fechaRetiro: o.fechaRetiro,
    estado: o.estado || "activo",
    observaciones: o.observaciones,
  };
  return { o, persona, alumno };
}

export async function accionCrearAlumno(_: unknown, fd: FormData): Promise<ResultadoAccion<unknown>> {
  const { o, persona, alumno } = separar(fd);
  const r = await ejecutarAccion(
    async (ctx) => {
      const datosPersona = esquemaPersona.parse(persona);
      if (!o.confirmarDuplicado) {
        const dupes = await posiblesDuplicados(datosPersona, { limite: 3 });
        if (dupes.length) {
          throw new ErrorNegocio(
            `Posible registro existente: ${dupes.map((d) => `${nombreCompleto(d.persona)}${d.persona.rut ? ` (${d.persona.rut})` : ""} — ${d.motivo}`).join("; ")}. ` +
              "Búscalo en el buscador o marca «Crear de todas formas».",
          );
        }
      }
      const apNombre = String(o.apNombres ?? "").trim();
      return crearAlumno(ctx, {
        persona: datosPersona,
        alumno,
        apoderado: apNombre
          ? {
              persona: esquemaPersona.parse({
                nombres: apNombre,
                apellidos: o.apApellidos,
                rut: o.apRut,
                telefono: o.apTelefono,
                email: o.apEmail,
              }),
              esApoderado: true,
              esTitular: !!o.apEsTitular,
              esPagador: !!o.apEsPagador,
              parentesco: String(o.apParentesco ?? "") || null,
            }
          : null,
      });
    },
    { revalidar: ["/alumnos", "/"] },
  );
  if (r.ok) redirect(`/alumnos/${(r.datos as { id: number }).id}?creado=1`);
  return r;
}

export async function accionEditarAlumno(id: number, _: unknown, fd: FormData) {
  const { o, persona, alumno } = separar(fd);
  const r = await ejecutarAccion((ctx) => actualizarFichaAlumno(ctx, id, { persona, alumno }, String(o.motivo ?? "") || null), {
    revalidar: [`/alumnos/${id}`, "/alumnos"],
  });
  if (r.ok) redirect(`/alumnos/${id}`);
  return r;
}

export async function accionAgregarResponsable(alumnoId: number, _: unknown, fd: FormData) {
  const o = formDataAObjeto(fd, ["esApoderado", "esTitular", "esPagador"]);
  return ejecutarAccion(
    async (ctx) => {
      const persona = await obtenerOCrearPersona(
        ctx,
        esquemaPersona.parse({ nombres: o.nombres, apellidos: o.apellidos, rut: o.rut, telefono: o.telefono, email: o.email }),
      );
      return vincularResponsable(ctx, alumnoId, persona.id, {
        esApoderado: !!o.esApoderado,
        esTitular: !!o.esTitular,
        esPagador: !!o.esPagador,
        parentesco: String(o.parentesco ?? "") || null,
      });
    },
    { revalidar: [`/alumnos/${alumnoId}`], mensaje: "Responsable agregado." },
  );
}

export async function accionQuitarResponsable(alumnoId: number, responsableId: number, _estado?: unknown, _fd?: FormData) {
  return ejecutarAccion((ctx) => desvincularResponsable(ctx, responsableId, "Quitado desde la ficha"), {
    revalidar: [`/alumnos/${alumnoId}`],
  });
}
