"use client";

import { useState, useTransition } from "react";
import { BotonEnviar, Casilla, Formulario, type AccionFormulario } from "@/components/ui/formularios";
import { SelectorAlumno, type OpcionAlumno } from "@/components/ui/selector-alumno";
import { Insignia } from "@/components/ui/basicos";
import { formatearPeriodo, formatearPesos } from "@/lib/formato";

type Sugerencia = {
  alumnoId: number;
  alumnoNombre: string;
  titular: string | null;
  puntaje: number;
  razones: string[];
  aplicaciones: { mensualidadId: number; monto: number; periodo: string; saldo: number }[];
  pagadorPersonaId: number | null;
};

/** Sugerencia de la conciliación: el sistema propone, el usuario confirma. */
export function TarjetaSugerencia({
  s,
  accion,
  nombreOrigen,
  umbral,
}: {
  s: Sugerencia;
  accion: AccionFormulario;
  nombreOrigen: string | null;
  umbral: number;
}) {
  const probable = s.puntaje >= umbral;
  return (
    <Formulario accion={accion}>
      <div className={`rounded-lg border p-3 ${probable ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">Posible alumno: {s.alumnoNombre}</p>
            {s.titular && <p className="text-xs text-slate-600">Apoderado titular: {s.titular}</p>}
          </div>
          <Insignia color={probable ? "verde" : "amarillo"}>Coincidencia {Math.round(s.puntaje * 100)}%</Insignia>
        </div>
        <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
          {s.razones.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {s.aplicaciones.length === 0 ? (
          <p className="mt-2 text-xs text-amber-700">Este alumno no tiene meses con saldo pendiente.</p>
        ) : (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Se aplicaría a:</p>
            {s.aplicaciones.map((a) => (
              <label key={a.mensualidadId} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {formatearPeriodo(a.periodo)} <span className="text-xs text-slate-500">(saldo {formatearPesos(a.saldo)})</span>
                </span>
                <input name={`aplicar_${a.mensualidadId}`} defaultValue={a.monto} inputMode="numeric" className="campo w-28 text-right" />
              </label>
            ))}
          </div>
        )}
        {nombreOrigen && !s.pagadorPersonaId && (
          <div className="mt-3 space-y-1">
            <input type="hidden" name="nombrePagador" value={nombreOrigen} />
            <Casilla nombre="registrarPagador" etiqueta={<span className="text-xs">Recordar a «{nombreOrigen}» como pagador de este alumno</span>} defaultChecked />
          </div>
        )}
        {s.pagadorPersonaId && <input type="hidden" name="pagadorPersonaId" value={s.pagadorPersonaId} />}
        {s.aplicaciones.length > 0 && (
          <div className="mt-3">
            <input name="motivo" placeholder="Motivo (obligatorio solo si el mes está cerrado)" className="campo mt-2 text-xs" />
            <p className="mb-2 mt-2 text-sm font-semibold text-slate-800">¿Desea conciliar este pago?</p>
            <BotonEnviar variante="exito" tamano="sm" textoEnviando="Conciliando…">
              Sí, conciliar
            </BotonEnviar>
          </div>
        )}
      </div>
    </Formulario>
  );
}

type MensualidadSaldo = { id: number; periodo: string; saldo: number; fechaVencimiento: string };

/** Conciliación manual: el usuario elige alumno y meses. */
export function ConciliacionManual({
  accion,
  alumnos,
  cargarMensualidades,
  disponible,
  nombreOrigen,
}: {
  accion: AccionFormulario;
  alumnos: OpcionAlumno[];
  cargarMensualidades: (id: number) => Promise<MensualidadSaldo[]>;
  disponible: number;
  nombreOrigen: string | null;
}) {
  const [alumnoId, setAlumnoId] = useState<number | null>(null);
  const [lista, setLista] = useState<MensualidadSaldo[]>([]);
  const [cargando, iniciar] = useTransition();
  const elegirAlumno = (id: number | null) => {
    setAlumnoId(id);
    setLista([]);
    if (id) iniciar(async () => setLista(await cargarMensualidades(id)));
  };

  // Propuesta: repartir el saldo disponible desde el mes más antiguo
  const propuestas = lista.reduce<{ restante: number; montos: number[] }>(
    (acc, m) => {
      const monto = Math.max(0, Math.min(m.saldo, acc.restante));
      return { restante: acc.restante - monto, montos: [...acc.montos, monto] };
    },
    { restante: disponible, montos: [] },
  ).montos;

  return (
    <Formulario accion={accion}>
      <SelectorAlumno alumnos={alumnos} valor={alumnoId} alCambiar={elegirAlumno} nombre="_alumno" />
      {cargando && <p className="text-sm text-slate-500">Cargando…</p>}
      {alumnoId && !cargando && lista.length === 0 && <p className="text-sm text-amber-700">Sin meses con saldo.</p>}
      {lista.length > 0 && (
        <div className="space-y-1">
          {lista.map((m, i) => {
            const propuesto = propuestas[i];
            return (
              <label key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {formatearPeriodo(m.periodo)} <span className="text-xs text-slate-500">(saldo {formatearPesos(m.saldo)})</span>
                </span>
                <input name={`aplicar_${m.id}`} defaultValue={propuesto || ""} placeholder="0" inputMode="numeric" className="campo w-28 text-right" />
              </label>
            );
          })}
          {nombreOrigen && (
            <>
              <input type="hidden" name="nombrePagador" value={nombreOrigen} />
              <Casilla nombre="registrarPagador" etiqueta={<span className="text-xs">Recordar a «{nombreOrigen}» como pagador de este alumno</span>} />
            </>
          )}
          <input name="motivo" placeholder="Motivo (obligatorio solo si el mes está cerrado)" className="campo mt-2 text-xs" />
          <BotonEnviar variante="exito" tamano="sm">
            Conciliar
          </BotonEnviar>
        </div>
      )}
    </Formulario>
  );
}
