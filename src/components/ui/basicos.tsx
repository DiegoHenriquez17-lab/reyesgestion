import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatearPesos } from "@/lib/formato";
import type { NivelAlerta } from "@/lib/constantes";

/* ───────── Botones ───────── */
const VARIANTES = {
  primario: "bg-marca-700 text-white hover:bg-marca-800 shadow-sm",
  secundario: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm",
  peligro: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  exito: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  fantasma: "text-slate-600 hover:bg-slate-100",
} as const;
const TAMANOS = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-5 py-3 text-base" } as const;

type PropsBoton = { variante?: keyof typeof VARIANTES; tamano?: keyof typeof TAMANOS };

export function clasesBoton({ variante = "primario", tamano = "md" }: PropsBoton = {}) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTES[variante],
    TAMANOS[tamano],
  );
}

export function Boton({ variante, tamano, className, ...props }: ComponentProps<"button"> & PropsBoton) {
  return <button className={cn(clasesBoton({ variante, tamano }), className)} {...props} />;
}

export function BotonEnlace({
  variante,
  tamano,
  className,
  ...props
}: ComponentProps<typeof Link> & PropsBoton) {
  return <Link className={cn(clasesBoton({ variante, tamano }), className)} {...props} />;
}

/* ───────── Contenedores ───────── */
export function Tarjeta({ className, titulo, acciones, children }: { className?: string; titulo?: ReactNode; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section className={cn("tarjeta", className)}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {titulo && <h2 className="text-sm font-bold text-slate-800">{titulo}</h2>}
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EncabezadoPagina({ titulo, descripcion, acciones, volver }: { titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode; volver?: { href: string; texto: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {volver && (
          <Link href={volver.href} className="mb-1 inline-block text-xs font-medium text-slate-500 hover:text-marca-700">
            ← {volver.texto}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function EstadoVacio({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-semibold text-slate-700">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-md text-sm text-slate-500">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

/* ───────── Insignias y semáforo ───────── */
const COLORES_INSIGNIA = {
  gris: "bg-slate-100 text-slate-700 ring-slate-200",
  azul: "bg-marca-50 text-marca-800 ring-marca-200",
  verde: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amarillo: "bg-amber-50 text-amber-800 ring-amber-200",
  naranja: "bg-orange-50 text-orange-800 ring-orange-200",
  rojo: "bg-red-50 text-red-800 ring-red-200",
  morado: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;
export type ColorInsignia = keyof typeof COLORES_INSIGNIA;

export function Insignia({ color = "gris", children, className }: { color?: ColorInsignia; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", COLORES_INSIGNIA[color], className)}>
      {children}
    </span>
  );
}

export const colorNivel: Record<NivelAlerta, ColorInsignia> = { info: "azul", amarillo: "amarillo", naranja: "naranja", rojo: "rojo" };
export const puntoNivel: Record<NivelAlerta, string> = {
  info: "bg-marca-500",
  amarillo: "bg-amber-400",
  naranja: "bg-orange-500",
  rojo: "bg-red-600",
};

export function Pesos({ monto, className }: { monto: number | null | undefined; className?: string }) {
  return <span className={cn("tabular whitespace-nowrap", className)}>{formatearPesos(monto)}</span>;
}

export function Indicador({ etiqueta, valor, detalle, color = "slate", href }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; color?: "slate" | "verde" | "rojo" | "amarillo" | "azul"; href?: string }) {
  const colores = {
    slate: "text-slate-900",
    verde: "text-emerald-700",
    rojo: "text-red-700",
    amarillo: "text-amber-700",
    azul: "text-marca-700",
  };
  const contenido = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className={cn("tabular mt-1 text-2xl font-bold", colores[color])}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="tarjeta block p-4 transition hover:border-marca-300 hover:shadow">
      {contenido}
    </Link>
  ) : (
    <div className="tarjeta p-4">{contenido}</div>
  );
}

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "exito" | "error" | "advertencia"; children: ReactNode }) {
  const c = {
    info: "border-marca-200 bg-marca-50 text-marca-900",
    exito: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
    advertencia: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <div className={cn("rounded-lg border px-3 py-2 text-sm", c[tipo])}>{children}</div>;
}

export function DatoFicha({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
