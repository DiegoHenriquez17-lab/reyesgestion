import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { requerirUsuario } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { auditoria, usuarios } from "@/server/db/schema";
import { entorno } from "@/server/entorno";
import { EncabezadoPagina, Insignia } from "@/components/ui/basicos";
import { formatearFechaHora } from "@/lib/formato";

export const metadata = { title: "Auditoría" };

type Sp = { q?: string; entidad?: string; usuario?: string; desde?: string; hasta?: string; cerrado?: string };

export default async function PaginaAuditoria({ searchParams }: { searchParams: Promise<Sp> }) {
  await requerirUsuario(["admin", "operador"]);
  const sp = await searchParams;
  const c: SQL[] = [];
  if (sp.entidad) c.push(eq(auditoria.entidad, sp.entidad));
  if (sp.usuario) c.push(eq(auditoria.usuarioId, Number(sp.usuario)));
  if (sp.desde) c.push(sql`${auditoria.fecha} >= ${sp.desde}::date`);
  if (sp.hasta) c.push(sql`${auditoria.fecha} < (${sp.hasta}::date + 1)`);
  if (sp.cerrado) c.push(eq(auditoria.periodoCerrado, true));
  if (sp.q) c.push(sql`(${auditoria.resumen} ilike ${"%" + sp.q + "%"} or ${auditoria.motivo} ilike ${"%" + sp.q + "%"})`);
  const [filas, listaUsuarios, entidades] = await Promise.all([
    db
      .select({ a: auditoria, usuario: usuarios.nombre })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(c.length ? and(...c) : undefined)
      .orderBy(desc(auditoria.fecha))
      .limit(300),
    db.select({ id: usuarios.id, nombre: usuarios.nombre }).from(usuarios),
    db.selectDistinct({ entidad: auditoria.entidad }).from(auditoria),
  ]);

  return (
    <>
      <EncabezadoPagina titulo="Auditoría" descripcion="Quién — cuándo — qué cambió — por qué. Este registro no se puede modificar ni borrar." />
      <form className="tarjeta mb-4 grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <input name="q" defaultValue={sp.q} placeholder="Buscar en resumen o motivo" className="campo lg:col-span-2" />
        <select name="entidad" defaultValue={sp.entidad ?? ""} className="campo">
          <option value="">Todo</option>
          {entidades.map((e) => (
            <option key={e.entidad} value={e.entidad}>
              {e.entidad}
            </option>
          ))}
        </select>
        <select name="usuario" defaultValue={sp.usuario ?? ""} className="campo">
          <option value="">Todos los usuarios</option>
          {listaUsuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
        <input type="date" name="desde" defaultValue={sp.desde} className="campo" />
        <div className="flex gap-2">
          <input type="date" name="hasta" defaultValue={sp.hasta} className="campo" />
          <button className="rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white">Filtrar</button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="cerrado" value="1" defaultChecked={!!sp.cerrado} /> Solo cambios en meses cerrados
        </label>
      </form>
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Cuándo</th>
              <th>Quién</th>
              <th>Qué</th>
              <th>Detalle</th>
              <th>Por qué</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ a, usuario }) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs">{formatearFechaHora(a.fecha, entorno.APP_TIMEZONE)}</td>
                <td className="text-sm">
                  {usuario ?? "Sistema"}
                  {a.origen !== "ui" && <span className="block text-[11px] text-slate-500">vía {a.origen}</span>}
                </td>
                <td>
                  <span className="font-mono text-xs">{a.accion}</span>
                  <span className="block text-[11px] text-slate-500">
                    {a.entidad} {a.entidadId && `#${a.entidadId}`}
                  </span>
                  {a.periodoCerrado && <Insignia color="rojo">Mes cerrado</Insignia>}
                </td>
                <td className="text-sm">
                  {a.resumen}
                  {a.cambios && a.cambios.length > 0 && (
                    <details className="mt-1 text-xs text-slate-600">
                      <summary className="cursor-pointer">{a.cambios.length} cambio(s)</summary>
                      <ul className="mt-1 space-y-0.5">
                        {a.cambios.map((ch) => (
                          <li key={ch.campo}>
                            <span className="font-medium">{ch.campo}:</span> {JSON.stringify(ch.antes)} → {JSON.stringify(ch.despues)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="text-sm italic text-slate-600">{a.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
