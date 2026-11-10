import Link from "next/link";
import { requerirUsuario } from "@/server/auth/sesion";
import { listarPersonas } from "@/server/modulos/personas";
import { EncabezadoPagina } from "@/components/ui/basicos";
import { nombreCompleto } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";

export const metadata = { title: "Personas" };

export default async function PaginaPersonas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requerirUsuario();
  const { q } = await searchParams;
  const lista = await listarPersonas(q, 200);
  return (
    <>
      <EncabezadoPagina titulo="Personas" descripcion="Registro único de personas (alumnos, apoderados, pagadores). Desde aquí puedes fusionar fichas duplicadas." />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nombre, RUT, teléfono…" className="campo" />
        <button className="rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white">Buscar</button>
      </form>
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>RUT</th>
              <th>Teléfono</th>
              <th className="hidden md:table-cell">Correo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/personas/${p.id}`} className="enlace">
                    {nombreCompleto(p)}
                  </Link>
                </td>
                <td>{p.rut ? formatearRut(p.rut) : "—"}</td>
                <td>{p.telefono ?? "—"}</td>
                <td className="hidden md:table-cell">{p.email ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
