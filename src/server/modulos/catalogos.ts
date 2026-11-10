import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { alumnos, buses, servicios } from "@/server/db/schema";
import { auditar, type Contexto } from "@/server/auditoria";
import { ErrorNegocio } from "@/server/errores";
import { esquemaBus, esquemaServicio } from "@/lib/validaciones";

export async function listarBuses(soloActivos = false) {
  const totalAlumnos = sql<number>`(select count(*) from ${alumnos} a where a.bus_id = ${buses.id} and a.eliminado_en is null and a.estado = 'activo')::int`;
  return db
    .select({ bus: buses, totalAlumnos })
    .from(buses)
    .where(and(isNull(buses.eliminadoEn), soloActivos ? eq(buses.activo, true) : undefined))
    .orderBy(sql`case when ${buses.numero} ~ '^[0-9]+$' then lpad(${buses.numero}, 6, '0') else ${buses.numero} end`);
}

export async function listarServicios(soloActivos = false) {
  return db
    .select()
    .from(servicios)
    .where(and(isNull(servicios.eliminadoEn), soloActivos ? eq(servicios.activo, true) : undefined))
    .orderBy(asc(servicios.nombre));
}

export async function guardarBus(ctx: Contexto, id: number | null, entrada: unknown) {
  const datos = esquemaBus.parse(entrada);
  return db.transaction(async (tx) => {
    const [dupe] = await tx
      .select({ id: buses.id })
      .from(buses)
      .where(and(eq(buses.numero, datos.numero), isNull(buses.eliminadoEn)));
    if (dupe && dupe.id !== id) throw new ErrorNegocio(`Ya existe el bus ${datos.numero}.`);
    if (id) {
      const [antes] = await tx.select().from(buses).where(eq(buses.id, id));
      if (!antes) throw new ErrorNegocio("El bus no existe.");
      const [b] = await tx.update(buses).set(datos).where(eq(buses.id, id)).returning();
      await auditar(tx, ctx, { accion: "actualizar", entidad: "bus", entidadId: id, resumen: `Bus ${b.numero}`, antes, despues: b });
      return b;
    }
    const [b] = await tx.insert(buses).values(datos).returning();
    await auditar(tx, ctx, { accion: "crear", entidad: "bus", entidadId: b.id, resumen: `Bus ${b.numero}`, despues: b });
    return b;
  });
}

export async function guardarServicio(ctx: Contexto, id: number | null, entrada: unknown) {
  const datos = esquemaServicio.parse(entrada);
  return db.transaction(async (tx) => {
    const [dupe] = await tx
      .select({ id: servicios.id })
      .from(servicios)
      .where(and(sql`lower(${servicios.nombre}) = lower(${datos.nombre})`, isNull(servicios.eliminadoEn)));
    if (dupe && dupe.id !== id) throw new ErrorNegocio(`Ya existe el servicio "${datos.nombre}".`);
    if (id) {
      const [antes] = await tx.select().from(servicios).where(eq(servicios.id, id));
      if (!antes) throw new ErrorNegocio("El servicio no existe.");
      const [s] = await tx.update(servicios).set(datos).where(eq(servicios.id, id)).returning();
      await auditar(tx, ctx, { accion: "actualizar", entidad: "servicio", entidadId: id, resumen: s.nombre, antes, despues: s });
      return s;
    }
    const [s] = await tx.insert(servicios).values(datos).returning();
    await auditar(tx, ctx, { accion: "crear", entidad: "servicio", entidadId: s.id, resumen: s.nombre, despues: s });
    return s;
  });
}

/** Busca un bus por número o patente (usado por importaciones). */
export async function resolverBus(valor: unknown) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const texto = String(valor).trim().replace(/^bus\s*/i, "").replace(/^n[°º]\s*/i, "");
  const [b] = await db
    .select()
    .from(buses)
    .where(
      and(
        isNull(buses.eliminadoEn),
        sql`(${buses.numero} = ${texto} or upper(${buses.patente}) = ${texto.toUpperCase().replace(/[^A-Z0-9]/g, "")})`,
      ),
    );
  return b ?? null;
}

export async function resolverServicio(valor: unknown) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const [s] = await db
    .select()
    .from(servicios)
    .where(and(isNull(servicios.eliminadoEn), sql`f_unaccent(lower(${servicios.nombre})) = f_unaccent(lower(${String(valor).trim()}))`));
  return s ?? null;
}
