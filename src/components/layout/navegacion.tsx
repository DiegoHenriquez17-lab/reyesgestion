"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  BookUser,
  Bus,
  CalendarCheck,
  CalendarClock,
  FileBarChart,
  History,
  LayoutDashboard,
  Lock,
  Menu,
  Route,
  Search,
  Settings,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECCIONES = [
  {
    titulo: null,
    items: [
      { href: "/", texto: "Panel principal", icono: LayoutDashboard },
      { href: "/buscar", texto: "Buscar", icono: Search },
      { href: "/alertas", texto: "Alertas", icono: Bell, contador: true },
    ],
  },
  {
    titulo: "Cobranza",
    items: [
      { href: "/alumnos", texto: "Alumnos", icono: Users },
      { href: "/pagos", texto: "Pagos", icono: Wallet },
      { href: "/mensualidades", texto: "Mensualidades", icono: CalendarCheck },
      { href: "/informes", texto: "Informes", icono: FileBarChart },
      { href: "/cierres", texto: "Cierre de mes", icono: Lock },
    ],
  },
  {
    // Versión 2 agregará aquí: Conductores, Documentos y vencimientos, Mantenciones
    titulo: "Flota y servicios",
    items: [
      { href: "/buses", texto: "Buses", icono: Bus },
      { href: "/servicios", texto: "Servicios", icono: Route },
    ],
  },
  {
    titulo: "Herramientas",
    items: [
      { href: "/importar", texto: "Importar datos", icono: Upload },
      { href: "/recordatorios", texto: "Recordatorios", icono: CalendarClock },
      { href: "/personas", texto: "Personas", icono: BookUser },
      { href: "/auditoria", texto: "Auditoría", icono: History },
      { href: "/configuracion", texto: "Configuración", icono: Settings },
    ],
  },
];

function Enlaces({ totalAlertas, alNavegar }: { totalAlertas: number; alNavegar?: () => void }) {
  const ruta = usePathname();
  return (
    <nav className="space-y-5">
      {SECCIONES.map((s, i) => (
        <div key={i}>
          {s.titulo && <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-marca-200/70">{s.titulo}</p>}
          <ul className="space-y-0.5">
            {s.items.map((it) => {
              const activo = it.href === "/" ? ruta === "/" : ruta.startsWith(it.href);
              const Icono = it.icono;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={alNavegar}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                      activo ? "bg-white/15 text-white" : "text-marca-100 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icono className="size-4 shrink-0" />
                    <span className="flex-1">{it.texto}</span>
                    {"contador" in it && it.contador && totalAlertas > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{totalAlertas}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function BarraLateral({ totalAlertas, empresa }: { totalAlertas: number; empresa: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-marca-900 px-3 py-4 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-lg font-black text-white ring-1 ring-white/20">R</span>
        <span>
          <span className="block text-sm font-bold text-white">Reyes Gestión</span>
          <span className="block text-[11px] text-marca-200">{empresa}</span>
        </span>
      </Link>
      <div className="flex-1 overflow-y-auto">
        <Enlaces totalAlertas={totalAlertas} />
      </div>
    </aside>
  );
}

export function MenuMovil({ totalAlertas }: { totalAlertas: number }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button onClick={() => setAbierto(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Abrir menú">
        <Menu className="size-5" />
      </button>
      {abierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setAbierto(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-marca-900 px-3 py-4">
            <div className="mb-5 flex items-center justify-between px-2">
              <span className="font-bold text-white">Reyes Gestión</span>
              <button onClick={() => setAbierto(false)} className="rounded p-1 text-marca-100 hover:bg-white/10" aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            <Enlaces totalAlertas={totalAlertas} alNavegar={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  );
}
