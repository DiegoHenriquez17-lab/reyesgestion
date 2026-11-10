"use client";

import { useActionState, useState, type ReactNode } from "react";
import { cn, type ResultadoAccion } from "@/lib/utils";
import { clasesBoton } from "./basicos";
import { BotonEnviar } from "./formularios";

type Accion = (estado: ResultadoAccion<unknown> | null, fd: FormData) => Promise<ResultadoAccion<unknown> | null>;

/**
 * Botón que despliega un mini formulario para confirmar una acción y (opcionalmente)
 * escribir el motivo, que queda registrado en la auditoría.
 */
export function AccionConMotivo({
  accion,
  texto,
  titulo,
  variante = "secundario",
  requiereMotivo = true,
  placeholder = "Motivo (queda en la auditoría)",
  ocultos = {},
  textoConfirmar = "Confirmar",
  children,
}: {
  accion: Accion;
  texto: ReactNode;
  titulo?: string;
  variante?: "primario" | "secundario" | "peligro" | "exito" | "fantasma";
  requiereMotivo?: boolean;
  placeholder?: string;
  ocultos?: Record<string, string | number>;
  textoConfirmar?: string;
  children?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, ejecutar] = useActionState(async (prev: ResultadoAccion<unknown> | null, fd: FormData) => {
    const r = await accion(prev, fd);
    if (r?.ok) setAbierto(false);
    return r;
  }, null);

  if (!abierto) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <button type="button" onClick={() => setAbierto(true)} className={clasesBoton({ variante, tamano: "sm" })}>
          {texto}
        </button>
        {estado?.ok && estado.mensaje && <span className="text-xs text-emerald-700">{estado.mensaje}</span>}
      </span>
    );
  }
  return (
    <form action={ejecutar} className="w-full min-w-64 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {titulo && <p className="text-sm font-semibold text-slate-800">{titulo}</p>}
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {requiereMotivo && <input name="motivo" required minLength={3} placeholder={placeholder} className="campo" autoFocus />}
      {estado && !estado.ok && <p className="text-xs text-red-600">{estado.error}</p>}
      <div className="flex gap-2">
        <BotonEnviar tamano="sm" variante={variante === "secundario" || variante === "fantasma" ? "primario" : variante} textoEnviando="Procesando…">
          {textoConfirmar}
        </BotonEnviar>
        <button type="button" onClick={() => setAbierto(false)} className={cn(clasesBoton({ variante: "fantasma", tamano: "sm" }))}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Botón simple que ejecuta una acción sin datos extra (con confirmación opcional del navegador). */
export function BotonAccion({
  accion,
  children,
  variante = "secundario",
  confirmar,
  ocultos = {},
}: {
  accion: Accion;
  children: ReactNode;
  variante?: "primario" | "secundario" | "peligro" | "exito" | "fantasma";
  confirmar?: string;
  ocultos?: Record<string, string | number>;
}) {
  const [estado, ejecutar] = useActionState(accion, null);
  return (
    <form
      action={ejecutar}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <BotonEnviar tamano="sm" variante={variante} textoEnviando="…">
        {children}
      </BotonEnviar>
      {estado && !estado.ok && <span className="text-xs text-red-600">{estado.error}</span>}
      {estado?.ok && estado.mensaje && <span className="text-xs text-emerald-700">{estado.mensaje}</span>}
    </form>
  );
}
