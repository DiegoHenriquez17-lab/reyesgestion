import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { Bell, LogOut, Search } from "lucide-react";
import { requerirUsuario } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { alertas } from "@/server/db/schema";
import { leerConfig } from "@/server/configuracion";
import { recalcularAlertas } from "@/server/alertas/motor";
import { entorno } from "@/server/entorno";
import { BarraLateral, MenuMovil } from "@/components/layout/navegacion";
import { ROL_ETIQUETA } from "@/lib/constantes";
import { accionCerrarSesion } from "../(auth)/acciones";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();
  // Mantiene las alertas al día (respeta el intervalo configurado)
  await recalcularAlertas().catch((e) => console.error("alertas", e));
  const [[conteo], empresa] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int`, rojas: sql<number>`count(*) filter (where ${alertas.nivel} = 'rojo')::int` })
      .from(alertas)
      .where(and(eq(alertas.estado, "activa"))),
    leerConfig("empresa.nombre"),
  ]);

  return (
    <div className="min-h-screen">
      <BarraLateral totalAlertas={conteo?.total ?? 0} empresa={String(empresa)} />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur sm:px-5">
          <MenuMovil totalAlertas={conteo?.total ?? 0} />
          <form action="/buscar" className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              placeholder="Buscar alumno, apoderado, RUT, teléfono, N° operación, bus…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-marca-400 focus:bg-white focus:ring-2 focus:ring-marca-100"
            />
          </form>
          {entorno.APP_ENTORNO === "desarrollo" ? (
            <span
              className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-300 sm:px-2.5 sm:py-1 sm:text-[11px]"
              title="Base de datos local de pruebas: los datos aquí no son oficiales"
            >
              Pruebas
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-300 sm:px-2.5 sm:py-1 sm:text-[11px]">
              Base oficial
            </span>
          )}
          <Link href="/alertas" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Alertas">
            <Bell className="size-5" />
            {(conteo?.total ?? 0) > 0 && (
              <span
                className={`absolute -right-0.5 -top-0.5 rounded-full px-1.5 text-[10px] font-bold text-white ${(conteo?.rojas ?? 0) > 0 ? "bg-red-600" : "bg-amber-500"}`}
              >
                {conteo?.total}
              </span>
            )}
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-800">{usuario.nombre}</p>
            <p className="text-[11px] text-slate-500">{ROL_ETIQUETA[usuario.rol]}</p>
          </div>
          <form action={accionCerrarSesion}>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600" title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut className="size-5" />
            </button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl px-3 py-5 sm:px-5 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
