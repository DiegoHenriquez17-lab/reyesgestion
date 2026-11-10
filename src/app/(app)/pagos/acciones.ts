"use server";

import { redirect } from "next/navigation";
import { ejecutarAccion } from "@/server/acciones";
import { anularPago, cambiarVerificacion, conciliarPago, quitarAplicacion, registrarPago, type Aplicacion } from "@/server/modulos/pagos";
import { mensualidadesConSaldo } from "@/server/modulos/alumnos";
import { guardarArchivo } from "@/server/almacenamiento";
import { contextoAccion } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { documentos } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { formDataAObjeto } from "@/lib/validaciones";
import { parsearMonto } from "@/lib/formato";
import type { ResultadoAccion } from "@/lib/utils";

function leerAplicaciones(fd: FormData): Aplicacion[] {
  const salida: Aplicacion[] = [];
  for (const [k, v] of fd.entries()) {
    const m = /^aplicar_(\d+)$/.exec(k);
    if (!m) continue;
    const monto = parsearMonto(v);
    if (monto && monto > 0) salida.push({ mensualidadId: Number(m[1]), monto });
  }
  return salida;
}

/** Para el formulario de pago: mensualidades con saldo del alumno elegido. */
export async function accionMensualidadesDeAlumno(alumnoId: number) {
  await contextoAccion(["admin", "operador", "consulta"]);
  const lista = await mensualidadesConSaldo(alumnoId);
  return lista.map((m) => ({ id: m.id, periodo: m.periodo, saldo: m.monto - m.montoPagado, fechaVencimiento: m.fechaVencimiento }));
}

export async function accionRegistrarPago(_: unknown, fd: FormData): Promise<ResultadoAccion<unknown>> {
  const o = formDataAObjeto(fd, ["verificado", "permitirDuplicado"]);
  const aplicaciones = leerAplicaciones(fd);
  const archivo = fd.get("comprobante");
  const r = await ejecutarAccion(
    async (ctx) => {
      return db.transaction(async (tx) => {
        let documentoId: number | null = null;
        if (archivo instanceof File && archivo.size > 0) {
          const { documento } = await guardarArchivo(archivo, { tipo: "voucher", usuarioId: ctx.usuarioId, entidadTipo: "pago" }, tx);
          documentoId = documento.id;
        }
        const pago = await registrarPago(
          ctx,
          {
            datos: o,
            origen: documentoId ? "voucher" : "manual",
            documentoId,
            aplicaciones,
            permitirDuplicado: !!o.permitirDuplicado,
            motivo: String(o.motivo ?? "") || null,
          },
          tx,
        );
        if (documentoId) await tx.update(documentos).set({ entidadId: pago.id }).where(eq(documentos.id, documentoId));
        return pago;
      });
    },
    { revalidar: ["/pagos", "/alumnos", "/"] },
  );
  if (r.ok) redirect(`/pagos/${(r.datos as { id: number }).id}?registrado=1`);
  return r;
}

export async function accionConciliar(pagoId: number, _: unknown, fd: FormData) {
  const o = formDataAObjeto(fd, ["registrarPagador"]);
  const aplicaciones = leerAplicaciones(fd);
  const pagadorPersonaId = Number(o.pagadorPersonaId) || undefined;
  return ejecutarAccion(
    (ctx) =>
      conciliarPago(ctx, pagoId, aplicaciones, {
        motivo: String(o.motivo ?? "").trim() || null,
        registrarPagador: o.registrarPagador ? { personaId: pagadorPersonaId, nombre: String(o.nombrePagador ?? "") } : null,
      }),
    { revalidar: [`/pagos/${pagoId}`, "/pagos", "/alumnos", "/"], mensaje: "Pago conciliado." },
  );
}

export async function accionVerificar(pagoId: number, _: unknown, fd: FormData) {
  const estado = String(fd.get("estado")) as "verificado" | "rechazado" | "por_verificar";
  return ejecutarAccion((ctx) => cambiarVerificacion(ctx, pagoId, estado, String(fd.get("motivo") ?? "") || null), {
    revalidar: [`/pagos/${pagoId}`, "/pagos", "/"],
    mensaje: estado === "verificado" ? "Dinero confirmado." : "Estado actualizado.",
  });
}

export async function accionQuitarAplicacion(pagoId: number, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => quitarAplicacion(ctx, Number(fd.get("aplicacionId")), String(fd.get("motivo") ?? "")), {
    revalidar: [`/pagos/${pagoId}`, "/alumnos", "/"],
    mensaje: "Aplicación quitada.",
  });
}

export async function accionAnularPago(pagoId: number, _: unknown, fd: FormData) {
  return ejecutarAccion((ctx) => anularPago(ctx, pagoId, String(fd.get("motivo") ?? "")), {
    roles: ["admin"],
    revalidar: [`/pagos/${pagoId}`, "/pagos", "/alumnos", "/"],
    mensaje: "Pago anulado.",
  });
}
