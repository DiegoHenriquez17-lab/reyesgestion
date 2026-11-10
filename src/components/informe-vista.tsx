import { esNumerico, formatearValor, type FilaInforme, type Informe } from "@/lib/informe";
import { cn } from "@/lib/utils";

/** Muestra en pantalla cualquier informe (misma estructura que el PDF / Excel). */
export function VistaInforme({ informe }: { informe: Informe }) {
  const celdas = (f: FilaInforme, clase?: string) =>
    informe.columnas.map((c) => (
      <td key={c.clave} className={cn(esNumerico(c.tipo) && "tabular text-right", "whitespace-nowrap", clase)}>
        {formatearValor(f[c.clave], c.tipo)}
      </td>
    ));
  return (
    <div className="space-y-4">
      {informe.indicadores && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {informe.indicadores.map((i) => (
            <div key={i.etiqueta} className={cn("tarjeta p-3", i.destacado && "border-marca-200 bg-marca-50")}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{i.etiqueta}</p>
              <p className={cn("tabular mt-1 text-lg font-bold", i.destacado ? "text-marca-800" : "text-slate-900")}>{formatearValor(i.valor, i.tipo)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              {informe.columnas.map((c) => (
                <th key={c.clave} className={cn(esNumerico(c.tipo) && "text-right")}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {informe.secciones.map((s, i) => (
              <SeccionFilas key={i} titulo={s.titulo} n={informe.columnas.length}>
                {s.filas.map((f, j) => (
                  <tr key={j}>{celdas(f)}</tr>
                ))}
                {s.subtotal && <tr className="bg-slate-50 font-semibold">{celdas(s.subtotal)}</tr>}
              </SeccionFilas>
            ))}
            {informe.secciones.every((s) => s.filas.length === 0) && (
              <tr>
                <td colSpan={informe.columnas.length} className="py-8 text-center text-slate-500">
                  Sin datos para este informe.
                </td>
              </tr>
            )}
            {informe.totalGeneral && <tr className="bg-marca-50 font-bold text-marca-900">{celdas(informe.totalGeneral)}</tr>}
          </tbody>
        </table>
      </div>
      {informe.notas?.map((n) => (
        <p key={n} className="text-sm italic text-slate-600">
          {n}
        </p>
      ))}
    </div>
  );
}

function SeccionFilas({ titulo, n, children }: { titulo?: string; n: number; children: React.ReactNode }) {
  return (
    <>
      {titulo && (
        <tr>
          <td colSpan={n} className="bg-marca-50/60 font-bold text-marca-900">
            {titulo}
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
