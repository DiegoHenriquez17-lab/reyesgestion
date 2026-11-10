"use client";

import { useActionState, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn, type ResultadoAccion } from "@/lib/utils";
import { Aviso, clasesBoton } from "./basicos";

export type AccionFormulario = (estado: ResultadoAccion<unknown> | null, fd: FormData) => Promise<ResultadoAccion<unknown> | null>;

/**
 * Formulario conectado a una Server Action. Muestra errores generales y por campo,
 * y el estado "guardando…" sin escribir lógica en cada pantalla.
 */
export function Formulario({
  accion,
  children,
  className,
  alExito,
  reiniciar = false,
  mostrarExito = true,
}: {
  accion: AccionFormulario;
  children: ReactNode | ((errores: Record<string, string[]>) => ReactNode);
  className?: string;
  alExito?: (r: ResultadoAccion<unknown>) => void;
  reiniciar?: boolean;
  mostrarExito?: boolean;
}) {
  const [estado, ejecutar] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) {
      if (reiniciar) ref.current?.reset();
      alExito?.(estado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  const errores = estado && !estado.ok ? (estado.errores ?? {}) : {};
  return (
    <form ref={ref} action={ejecutar} className={cn("space-y-4", className)}>
      {estado && !estado.ok && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado?.ok && estado.mensaje && mostrarExito && <Aviso tipo="exito">{estado.mensaje}</Aviso>}
      {typeof children === "function" ? children(errores) : children}
    </form>
  );
}

export function BotonEnviar({
  children,
  textoEnviando = "Guardando…",
  variante = "primario",
  tamano = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  textoEnviando?: string;
  variante?: "primario" | "secundario" | "peligro" | "exito" | "fantasma";
  tamano?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={cn(clasesBoton({ variante, tamano }), className)} {...props}>
      {pending ? textoEnviando : children}
    </button>
  );
}

export function Campo({
  etiqueta,
  nombre,
  errores,
  ayuda,
  className,
  ...props
}: ComponentProps<"input"> & { etiqueta: string; nombre: string; errores?: Record<string, string[]>; ayuda?: string }) {
  const err = errores?.[nombre];
  return (
    <label className={cn("block", className)}>
      <span className="etiqueta">
        {etiqueta}
        {props.required && <span className="text-red-500"> *</span>}
      </span>
      <input name={nombre} className={cn("campo", err && "border-red-400")} {...props} />
      {ayuda && !err && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
      {err && <span className="mt-1 block text-xs text-red-600">{err[0]}</span>}
    </label>
  );
}

export function Selector({
  etiqueta,
  nombre,
  opciones,
  errores,
  vacio,
  className,
  ...props
}: ComponentProps<"select"> & {
  etiqueta: string;
  nombre: string;
  opciones: { valor: string | number; texto: string }[];
  errores?: Record<string, string[]>;
  vacio?: string;
}) {
  const err = errores?.[nombre];
  return (
    <label className={cn("block", className)}>
      <span className="etiqueta">
        {etiqueta}
        {props.required && <span className="text-red-500"> *</span>}
      </span>
      <select name={nombre} className={cn("campo", err && "border-red-400")} {...props}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {err && <span className="mt-1 block text-xs text-red-600">{err[0]}</span>}
    </label>
  );
}

export function AreaTexto({ etiqueta, nombre, errores, className, ...props }: ComponentProps<"textarea"> & { etiqueta: string; nombre: string; errores?: Record<string, string[]> }) {
  const err = errores?.[nombre];
  return (
    <label className={cn("block", className)}>
      <span className="etiqueta">
        {etiqueta}
        {props.required && <span className="text-red-500"> *</span>}
      </span>
      <textarea name={nombre} rows={3} className={cn("campo", err && "border-red-400")} {...props} />
      {err && <span className="mt-1 block text-xs text-red-600">{err[0]}</span>}
    </label>
  );
}

export function Casilla({ etiqueta, nombre, className, ...props }: ComponentProps<"input"> & { etiqueta: ReactNode; nombre: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm text-slate-700", className)}>
      <input type="checkbox" name={nombre} className="size-4 rounded border-slate-300 text-marca-700 focus:ring-marca-500" {...props} />
      {etiqueta}
    </label>
  );
}
