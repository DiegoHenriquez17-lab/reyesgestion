"use client";

import { BotonEnviar, Casilla, Formulario, type AccionFormulario } from "@/components/ui/formularios";
import { NIVELES_ALERTA, NIVEL_ALERTA_ETIQUETA, type NivelAlerta } from "@/lib/constantes";

const ETIQUETA_PARAMETRO: Record<string, string> = {
  meses: "Cantidad de meses seguidos",
  dias: "Días de antigüedad",
  dia_limite: "Día límite del mes siguiente",
  nivel: "Color de la alerta",
};

export function FormularioRegla({
  accion,
  regla,
}: {
  accion: AccionFormulario;
  regla: { activa: boolean; umbrales: { dias: number; nivel: NivelAlerta }[]; parametros: Record<string, number | string | boolean> };
}) {
  const filas = [...regla.umbrales, ...Array.from({ length: Math.max(0, 4 - regla.umbrales.length) }, () => null)];
  const usaUmbrales = regla.umbrales.length > 0 || !("nivel" in regla.parametros);
  return (
    <Formulario accion={accion}>
      <Casilla nombre="activa" etiqueta="Regla activa" defaultChecked={regla.activa} />
      {usaUmbrales && (
        <div>
          <p className="etiqueta">Avisos</p>
          <div className="space-y-2">
            {filas.map((u, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span>Avisar</span>
                <input name={`dias_${i}`} type="number" min={0} defaultValue={u ? Math.abs(u.dias) : ""} className="campo w-20" placeholder="—" />
                <span>días</span>
                <select name={`sentido_${i}`} defaultValue={u && u.dias < 0 ? "despues" : "antes"} className="campo w-auto">
                  <option value="antes">antes (o el mismo día si es 0)</option>
                  <option value="despues">después (atraso)</option>
                </select>
                <span>→</span>
                <select name={`nivel_${i}`} defaultValue={u?.nivel ?? ""} className="campo w-auto">
                  <option value="">(sin usar)</option>
                  {NIVELES_ALERTA.map((n) => (
                    <option key={n} value={n}>
                      Alerta {NIVEL_ALERTA_ETIQUETA[n].toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Se usa el aviso más urgente que corresponda. Deja vacíos los que no necesites.</p>
        </div>
      )}
      {Object.keys(regla.parametros).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(regla.parametros).map(([k, v]) =>
            k === "nivel" ? (
              <label key={k}>
                <span className="etiqueta">{ETIQUETA_PARAMETRO[k]}</span>
                <select name={`param_${k}`} defaultValue={String(v)} className="campo">
                  {NIVELES_ALERTA.map((n) => (
                    <option key={n} value={n}>
                      {NIVEL_ALERTA_ETIQUETA[n]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label key={k}>
                <span className="etiqueta">{ETIQUETA_PARAMETRO[k] ?? k}</span>
                <input name={`param_${k}`} defaultValue={String(v)} className="campo" />
              </label>
            ),
          )}
        </div>
      )}
      <BotonEnviar tamano="sm">Guardar regla</BotonEnviar>
    </Formulario>
  );
}
