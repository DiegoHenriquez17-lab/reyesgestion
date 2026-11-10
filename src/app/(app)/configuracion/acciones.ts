"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ejecutarAccion } from "@/server/acciones";
import { auditar } from "@/server/auditoria";
import { guardarConfig, leerConfig } from "@/server/configuracion";
import { hashClave, problemaDeClave } from "@/server/auth/clave";
import { db } from "@/server/db";
import { sesiones, usuarios } from "@/server/db/schema";
import { ErrorNegocio } from "@/server/errores";
import { ROLES } from "@/lib/constantes";

export async function accionGuardarGeneral(_: unknown, fd: FormData) {
  return ejecutarAccion(
    async (ctx) => {
      const dia = Number(fd.get("dia_vencimiento"));
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new ErrorNegocio("El día de vencimiento debe estar entre 1 y 31.");
      const meses = fd.getAll("meses").map(Number).filter((m) => m >= 1 && m <= 12);
      if (meses.length === 0) throw new ErrorNegocio("Selecciona al menos un mes de cobro.");
      const coincidencia = Number(fd.get("coincidencia"));
      if (!(coincidencia > 0 && coincidencia <= 1)) throw new ErrorNegocio("La coincidencia mínima debe estar entre 0,1 y 1.");
      const intervalo = Number(fd.get("intervalo"));
      const antes = {
        nombre: await leerConfig("empresa.nombre"),
        dia: await leerConfig("cobranza.dia_vencimiento"),
        meses: await leerConfig("cobranza.meses_cobro"),
      };
      await db.transaction(async (tx) => {
        await guardarConfig("empresa.nombre", String(fd.get("empresa_nombre") ?? "").trim(), ctx.usuarioId, tx);
        await guardarConfig("empresa.rut", String(fd.get("empresa_rut") ?? "").trim(), ctx.usuarioId, tx);
        await guardarConfig("cobranza.dia_vencimiento", dia, ctx.usuarioId, tx);
        await guardarConfig("cobranza.meses_cobro", meses.sort((a, b) => a - b), ctx.usuarioId, tx);
        await guardarConfig("conciliacion.coincidencia_minima", coincidencia, ctx.usuarioId, tx);
        await guardarConfig("alertas.intervalo_minutos", Number.isFinite(intervalo) && intervalo > 0 ? intervalo : 5, ctx.usuarioId, tx);
        await auditar(tx, ctx, { accion: "configurar", entidad: "configuracion", resumen: "Configuración general", antes, despues: { nombre: fd.get("empresa_nombre"), dia, meses } });
      });
    },
    { roles: ["admin"], revalidar: ["/configuracion", "/"], mensaje: "Configuración guardada." },
  );
}


const esquemaUsuario = z.object({
  nombre: z.string().trim().min(2, "Indica el nombre"),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  rol: z.enum(ROLES),
  clave: z.string().optional(),
});

export async function accionGuardarUsuario(id: number | null, _: unknown, fd: FormData) {
  return ejecutarAccion(
    async (ctx) => {
      const d = esquemaUsuario.parse(Object.fromEntries(fd));
      const activo = fd.get("activo") === "on";
      if (id === ctx.usuarioId && (!activo || d.rol !== "admin")) throw new ErrorNegocio("No puedes quitarte a ti mismo el rol de administrador ni desactivarte.");
      const [dupe] = await db.select({ id: usuarios.id }).from(usuarios).where(sql`lower(${usuarios.email}) = ${d.email}`);
      if (dupe && dupe.id !== id) throw new ErrorNegocio("Ya existe un usuario con ese correo.");
      if (!id || d.clave) {
        const problema = problemaDeClave(d.clave ?? "");
        if (problema) throw new ErrorNegocio(problema);
      }
      const valores = {
        nombre: d.nombre,
        email: d.email,
        rol: d.rol,
        activo: id ? activo : true,
        ...(d.clave ? { passwordHash: await hashClave(d.clave) } : {}),
      };
      if (id) {
        const [antes] = await db.select().from(usuarios).where(eq(usuarios.id, id));
        const [u] = await db.update(usuarios).set(valores).where(eq(usuarios.id, id)).returning();
        if (!u.activo || d.clave) await db.delete(sesiones).where(eq(sesiones.usuarioId, id));
        await auditar(db, ctx, {
          accion: "actualizar",
          entidad: "usuario",
          entidadId: id,
          resumen: u.nombre,
          antes: { ...antes, passwordHash: undefined },
          despues: { ...u, passwordHash: d.clave ? "(cambiada)" : undefined },
        });
      } else {
        const [u] = await db.insert(usuarios).values({ ...valores, passwordHash: valores.passwordHash! }).returning();
        await auditar(db, ctx, { accion: "crear", entidad: "usuario", entidadId: u.id, resumen: `${u.nombre} (${u.rol})` });
      }
    },
    { roles: ["admin"], revalidar: ["/configuracion/usuarios"], mensaje: "Usuario guardado.", alertas: false },
  );
}
