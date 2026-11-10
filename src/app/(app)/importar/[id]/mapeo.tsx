"use client";

import { BotonEnviar, Casilla, Formulario, type AccionFormulario } from "@/components/ui/formularios";
import type { CampoImportacion } from "@/lib/importacion-campos";
import type { DestinoImportacion } from "@/lib/constantes";

export function FormularioMapeo({
  accion,
  columnas,
  mapeo,
  campos,
  ejemplo,
  destino,
  verificado,
}: {
  accion: AccionFormulario;
  columnas: string[];
  mapeo: Record<string, string | null>;
  campos: CampoImportacion[];
  ejemplo: Record<string, unknown>[];
  destino: DestinoImportacion;
  verificado: boolean;
}) {
  const mostrar = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    return String(v);
  };
  return (
    <Formulario accion={accion} mostrarExito={false}>
      <div className="-mx-4 overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Columna del archivo</th>
              <th>Significa…</th>
              <th>Ejemplos</th>
            </tr>
          </thead>
          <tbody>
            {columnas.map((c) => (
              <tr key={c}>
                <td className="font-semibold">{c}</td>
                <td>
                  <select name={`col:${c}`} defaultValue={mapeo[c] ?? ""} className="campo min-w-56">
                    <option value="">— No importar —</option>
                    {campos.map((campo) => (
                      <option key={campo.clave} value={campo.clave}>
                        {campo.etiqueta}
                        {campo.obligatorio ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="max-w-xs text-xs text-slate-500">
                  {ejemplo
                    .map((f) => mostrar(f[c]))
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {destino === "pagos" && <Casilla nombre="verificado" defaultChecked={verificado} etiqueta="Estos pagos ya están confirmados en el banco (cartola bancaria)" />}
      <div className="flex justify-end">
        <BotonEnviar textoEnviando="Analizando filas…">Confirmar y analizar</BotonEnviar>
      </div>
    </Formulario>
  );
}
