"use client";

import { useMemo, useState } from "react";
import { normalizarTexto } from "@/lib/texto";

export type OpcionAlumno = { id: number; nombre: string; detalle?: string | null };

/** Buscador de alumno dentro de un formulario (filtra mientras se escribe). */
export function SelectorAlumno({
  alumnos,
  valor,
  alCambiar,
  nombre = "alumnoId",
  etiqueta = "Alumno",
}: {
  alumnos: OpcionAlumno[];
  valor: number | null;
  alCambiar: (id: number | null) => void;
  nombre?: string;
  etiqueta?: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const elegido = alumnos.find((a) => a.id === valor) ?? null;
  const filtrados = useMemo(() => {
    const q = normalizarTexto(texto);
    const base = q ? alumnos.filter((a) => normalizarTexto(`${a.nombre} ${a.detalle ?? ""}`).includes(q)) : alumnos;
    return base.slice(0, 30);
  }, [texto, alumnos]);

  return (
    <div className="relative">
      <span className="etiqueta">{etiqueta}</span>
      <input type="hidden" name={nombre} value={valor ?? ""} />
      {elegido ? (
        <div className="campo flex items-center justify-between">
          <span>
            <span className="font-semibold">{elegido.nombre}</span>
            {elegido.detalle && <span className="ml-2 text-xs text-slate-500">{elegido.detalle}</span>}
          </span>
          <button type="button" onClick={() => alCambiar(null)} className="text-xs font-semibold text-slate-500 hover:text-red-600">
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <input
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
            placeholder="Escribe el nombre del alumno o apoderado…"
            className="campo"
          />
          {abierto && filtrados.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {filtrados.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      alCambiar(a.id);
                      setTexto("");
                      setAbierto(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-marca-50"
                  >
                    <span className="font-medium">{a.nombre}</span>
                    {a.detalle && <span className="block text-xs text-slate-500">{a.detalle}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
