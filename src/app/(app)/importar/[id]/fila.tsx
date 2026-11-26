"use client";

import { useState, useTransition } from "react";
import { Insignia } from "@/components/ui/basicos";
import { BotonEnviar, Campo, Formulario } from "@/components/ui/formularios";
import { CAMPOS_IMPORTACION } from "@/lib/importacion-campos";
import {
  ACCION_FILA_ETIQUETA,
  DECISION_FILA_ETIQUETA,
  MEDIO_PAGO_ETIQUETA,
  NO_IDENTIFICADO,
  type AccionFila,
  type DecisionFila,
  type DestinoImportacion,
  type MedioPago,
} from "@/lib/constantes";
import { formatearFecha, formatearPeriodo, formatearPesos } from "@/lib/formato";
import { formatearRut } from "@/lib/rut";
import { cn } from "@/lib/utils";
import { accionCorregirFila, accionDecidirFila } from "../acciones";

type Fila = {
  id: number;
  numeroFila: number;
  datos: Record<string, unknown>;
  accionPropuesta: AccionFila;
  registroExistente: Record<string, unknown> | null;
  registroExistenteId: number | null;
  diferencias: { campo: string; actual: unknown; nuevo: unknown }[] | null;
  advertencias: string[] | null;
  decision: DecisionFila | null;
  estado: "pendiente" | "aplicada" | "omitida" | "error";
  resultadoId: number | null;
  error: string | null;
};

const COLOR: Record<AccionFila, "verde" | "azul" | "gris" | "amarillo" | "naranja" | "rojo"> = {
  crear: "verde",
  actualizar: "azul",
  sin_cambios: "gris",
  posible_duplicado: "naranja",
  requiere_revision: "amarillo",
  error: "rojo",
};

function opcionesPara(accion: AccionFila, destino: DestinoImportacion, hayExistente = false): DecisionFila[] {
  if (destino === "pagos") return accion === "error" ? ["omitir"] : ["crear", "omitir"];
  switch (accion) {
    case "crear":
      return ["crear", "omitir"];
    case "actualizar":
      return ["actualizar", "fusionar", "mantener", "omitir"];
    case "sin_cambios":
      return ["omitir", "actualizar"];
    case "posible_duplicado":
      return ["actualizar", "mantener", "fusionar", "crear", "omitir"];
    case "requiere_revision":
      return hayExistente ? ["actualizar", "fusionar", "mantener", "crear", "omitir"] : ["crear", "omitir"];
    default:
      return ["omitir"];
  }
}

const Valor = ({ v }: { v: unknown }) =>
  v === null || v === undefined || v === "" ? <span className="text-amber-700">{NO_IDENTIFICADO}</span> : <>{String(v)}</>;

export function FilaRevision({ fila, valores, destino, importacionId, editable }: { fila: Fila; valores: Record<string, unknown>; destino: DestinoImportacion; importacionId: number; editable: boolean }) {
  const [guardando, iniciar] = useTransition();
  const [editando, editar] = useState(false);
  const d = fila.datos;
  const decidir = (decision: string, conciliar?: boolean) => iniciar(() => accionDecidirFila(importacionId, fila.id, decision, conciliar));

  return (
    <div
      className={cn(
        "tarjeta p-4",
        fila.estado === "aplicada" && "border-emerald-200 bg-emerald-50/40",
        fila.estado === "omitida" && "opacity-60",
        fila.error && "border-red-300",
        guardando && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">#{fila.numeroFila}</span>
          <Insignia color={COLOR[fila.accionPropuesta]}>{ACCION_FILA_ETIQUETA[fila.accionPropuesta]}</Insignia>
          {fila.estado === "aplicada" && <Insignia color="verde">Guardado</Insignia>}
          {fila.estado === "omitida" && <Insignia>Omitido</Insignia>}
        </div>
        {editable && (
          <select value={fila.decision ?? ""} onChange={(e) => decidir(e.target.value)} disabled={guardando} className={cn("campo w-auto", !fila.decision && "border-amber-400 bg-amber-50")}>
            <option value="">— Decide —</option>
            {opcionesPara(fila.accionPropuesta, destino, fila.registroExistenteId != null).map((o) => (
              <option key={o} value={o}>
                {DECISION_FILA_ETIQUETA[o]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-3">{destino === "alumnos" ? <DatosAlumno d={d} /> : destino === "pagos" ? <DatosPago d={d} /> : <DatosConductor d={d} />}</div>

      {fila.registroExistente && (
        <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Registro actual</p>
            {destino !== "pagos" ? (
              <p>
                {String(fila.registroExistente.nombre ?? "")}
                {fila.registroExistente.bus ? ` — Bus ${fila.registroExistente.bus}` : ""}
                {fila.registroExistente.tarifa != null ? ` — ${formatearPesos(Number(fila.registroExistente.tarifa))}` : ""}
                {fila.registroExistente.apoderado ? ` — Apoderado: ${fila.registroExistente.apoderado}` : ""}
                {fila.registroExistente.clase ? ` · Licencia ${fila.registroExistente.clase}` : ""}
              </p>
            ) : (
              <p>
                Pago #{String(fila.registroExistente.id)} — {formatearPesos(Number(fila.registroExistente.monto))} — {formatearFecha(String(fila.registroExistente.fecha))}
                {fila.registroExistente.nombre ? ` — ${fila.registroExistente.nombre}` : ""}
              </p>
            )}
          </div>
          {fila.diferencias && fila.diferencias.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-blue-700">Cambio detectado</p>
              <ul className="space-y-0.5">
                {fila.diferencias.map((c) => (
                  <li key={c.campo}>
                    <span className="font-medium">{c.campo}:</span> <span className="text-slate-500 line-through">{String(c.actual ?? "—")}</span> →{" "}
                    <span className="font-semibold text-blue-800">{String(c.nuevo)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {destino === "pagos" && d.sugerencia ? (
        <SugerenciaPago d={d} editable={editable} alCambiar={(v) => decidir(fila.decision ?? "crear", v)} />
      ) : null}

      {fila.advertencias && fila.advertencias.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-amber-800">
          {fila.advertencias.map((a) => (
            <li key={a}>⚠ {a}</li>
          ))}
        </ul>
      )}
      {fila.error && <p className="mt-2 text-sm font-semibold text-red-700">Error al guardar: {fila.error}</p>}
      {editable && <div className="mt-3 border-t border-slate-100 pt-2">
        <button type="button" className="enlace text-sm" aria-expanded={editando} onClick={() => editar(!editando)}>{editando ? "Cerrar edición" : "Corregir datos de la fila"}</button>
        {editando && <Formulario accion={accionCorregirFila.bind(null, importacionId, fila.id)} className="mt-2" alExito={() => editar(false)}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS_IMPORTACION[destino].map(({ clave, etiqueta }) => <Campo key={clave} etiqueta={etiqueta} nombre={clave} defaultValue={String(valores[clave] ?? "")} maxLength={500} />)}
          </div>
          <BotonEnviar tamano="sm" variante="secundario">Actualizar revisión</BotonEnviar>
        </Formulario>}
      </div>}
    </div>
  );
}

function DatosConductor({ d }: { d: Record<string, unknown> }) {
  const persona = d.persona as { nombres: string; apellidos: string; telefono?: string; rut?: string } | undefined;
  if (!persona) return <p className="text-sm text-red-700">Sin nombre de conductor identificado.</p>;
  return <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
    <div><dt className="text-xs text-slate-500">Conductor</dt><dd className="font-semibold">{persona.nombres} {persona.apellidos}</dd></div>
    <div><dt className="text-xs text-slate-500">RUT</dt><dd>{persona.rut ? formatearRut(persona.rut) : "—"}</dd></div>
    <div><dt className="text-xs text-slate-500">Clase</dt><dd><Valor v={d.claseLicencia} /></dd></div>
    <div><dt className="text-xs text-slate-500">Vencimiento</dt><dd>{d.fechaVencimiento ? formatearFecha(String(d.fechaVencimiento)) : <Valor v={null} />}</dd></div>
  </dl>;
}

function DatosAlumno({ d }: { d: Record<string, unknown> }) {
  const p = (d.persona ?? {}) as Record<string, unknown>;
  const a = (d.alumno ?? {}) as Record<string, unknown>;
  const ap = d.apoderado as Record<string, unknown> | null;
  if (!d.persona) return <p className="text-sm text-red-700">Sin nombre de alumno identificado.</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
      <div className="col-span-2">
        <dt className="text-[11px] uppercase text-slate-500">Alumno</dt>
        <dd className="font-semibold">
          {String(p.nombres)} {String(p.apellidos ?? "")}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">RUT</dt>
        <dd>{p.rut ? formatearRut(String(p.rut)) : <span className="text-slate-400">—</span>}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">Tarifa</dt>
        <dd>{a.tarifaMensual != null ? formatearPesos(Number(a.tarifaMensual)) : <span className="text-slate-400">—</span>}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">Bus</dt>
        <dd>{a.busTexto ? String(a.busTexto) : "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">Servicio</dt>
        <dd>{a.servicioTexto ? String(a.servicioTexto) : "—"}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-[11px] uppercase text-slate-500">Domicilio</dt>
        <dd>{[p.direccion, p.comuna].filter(Boolean).join(", ") || "—"}</dd>
      </div>
      {ap && (
        <div className="col-span-full">
          <dt className="text-[11px] uppercase text-slate-500">Apoderado</dt>
          <dd>
            {String(ap.nombres)} {String(ap.apellidos ?? "")}
            {ap.rut ? ` · ${formatearRut(String(ap.rut))}` : ""}
            {ap.telefono ? ` · ${ap.telefono}` : ""}
          </dd>
        </div>
      )}
    </dl>
  );
}

function DatosPago({ d }: { d: Record<string, unknown> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-[11px] uppercase text-slate-500">Fecha</dt>
        <dd>{d.fechaPago ? formatearFecha(String(d.fechaPago)) : <Valor v={null} />}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">Monto</dt>
        <dd className="font-semibold">{d.monto != null ? formatearPesos(Number(d.monto)) : <Valor v={null} />}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-[11px] uppercase text-slate-500">Quién paga</dt>
        <dd>
          <Valor v={d.nombreOrigen} />
          {d.rutOrigen ? ` · ${formatearRut(String(d.rutOrigen))}` : ""}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">Banco</dt>
        <dd>{d.banco ? String(d.banco) : "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">N° operación</dt>
        <dd>{d.numeroOperacion ? String(d.numeroOperacion) : "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">Medio</dt>
        <dd>{MEDIO_PAGO_ETIQUETA[(d.medio as MedioPago) ?? "transferencia"]}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase text-slate-500">Mes indicado</dt>
        <dd>{d.periodo ? formatearPeriodo(String(d.periodo)) : "—"}</dd>
      </div>
    </dl>
  );
}

function SugerenciaPago({ d, editable, alCambiar }: { d: Record<string, unknown>; editable: boolean; alCambiar: (v: boolean) => void }) {
  const s = d.sugerencia as { alumnoNombre: string; titular: string | null; puntaje: number; razones: string[]; aplicaciones: { periodo: string; monto: number }[] };
  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">Posible alumno: {s.alumnoNombre}</span>
          {s.titular && <span className="text-slate-600"> · Apoderado: {s.titular}</span>}
        </p>
        <Insignia color={s.puntaje >= 0.9 ? "verde" : "amarillo"}>{Math.round(s.puntaje * 100)}%</Insignia>
      </div>
      <p className="mt-1 text-xs text-slate-600">{s.razones.join(" · ")}</p>
      {s.aplicaciones.length > 0 && (
        <p className="mt-1 text-xs">
          Mes posible: <strong>{s.aplicaciones.map((a) => `${formatearPeriodo(a.periodo)} (${formatearPesos(a.monto)})`).join(", ")}</strong>
        </p>
      )}
      {editable && s.aplicaciones.length > 0 && (
        <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={!!d.conciliar} onChange={(e) => alCambiar(e.target.checked)} className="size-4" />
          Conciliar con esta sugerencia al guardar
        </label>
      )}
      {!d.conciliar && <p className="mt-1 text-xs text-amber-800">Si no se marca, quedará como 🟡 PAGO POR CONCILIAR.</p>}
    </div>
  );
}
