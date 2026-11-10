import Link from "next/link";
import { Camera, FileBarChart, FileSpreadsheet, UserPlus, Wallet } from "lucide-react";
import { requerirUsuario } from "@/server/auth/sesion";
import { datosPanel } from "@/server/modulos/panel";
import { hoy } from "@/server/fechas";
import { Aviso, Indicador, Insignia, Pesos, Tarjeta, colorNivel, puntoNivel } from "@/components/ui/basicos";
import { formatearFecha, formatearPeriodo, formatearPesos, formatearPorcentaje, nombreMes } from "@/lib/formato";
import { diferenciaDias } from "@/lib/fechas";
import { NIVEL_ALERTA_ETIQUETA } from "@/lib/constantes";
import { cn } from "@/lib/utils";

export const metadata = { title: "Panel principal" };

const ACCESOS = [
  { href: "/pagos/nuevo", texto: "Registrar pago", icono: Wallet, color: "bg-emerald-600" },
  { href: "/importar?destino=pagos&modo=foto", texto: "Subir voucher / foto", icono: Camera, color: "bg-violet-600" },
  { href: "/alumnos/nuevo", texto: "Nuevo alumno", icono: UserPlus, color: "bg-marca-700" },
  { href: "/importar", texto: "Importar Excel / PDF", icono: FileSpreadsheet, color: "bg-sky-600" },
  { href: "/informes", texto: "Informes", icono: FileBarChart, color: "bg-slate-700" },
];

export default async function PaginaPanel({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [usuario, d, sp] = await Promise.all([requerirUsuario(), datosPanel(), searchParams]);
  const hoyStr = hoy();
  const maxTendencia = Math.max(1, ...d.tendencia.map((t) => Math.max(t.esperado, t.recaudado)));
  const [anio, mes, dia] = hoyStr.split("-").map(Number);

  return (
    <div className="space-y-6">
      {sp.error === "permiso" && <Aviso tipo="error">No tienes permiso para ver esa sección.</Aviso>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {dia} de {nombreMes(mes, false)} de {anio}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Hola, {usuario.nombre.split(" ")[0]}</h1>
        </div>
        {d.totalAlertas > 0 ? (
          <Link href="/alertas" className="text-sm font-semibold text-red-700 hover:underline">
            {d.totalAlertas} cosa(s) requieren tu atención{d.alertasRojas > 0 ? ` · ${d.alertasRojas} urgentes` : ""} →
          </Link>
        ) : (
          <Insignia color="verde">Todo al día</Insignia>
        )}
      </div>

      {/* Accesos rápidos: pocos pasos para lo más frecuente */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACCESOS.map((a) => (
          <Link key={a.href} href={a.href} className="tarjeta flex items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg text-white", a.color)}>
              <a.icono className="size-5" />
            </span>
            <span className="text-sm font-semibold text-slate-800">{a.texto}</span>
          </Link>
        ))}
      </div>

      {/* Indicadores del mes */}
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{formatearPeriodo(d.periodo)}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Esperado del mes" valor={formatearPesos(d.resumen.esperado)} detalle={`${d.resumen.alumnos} mensualidades`} href={`/informes/recaudacion?periodo=${d.periodo.slice(0, 7)}`} />
          <Indicador
            etiqueta="Recaudado"
            valor={formatearPesos(d.resumen.recaudado)}
            detalle={`${formatearPorcentaje(d.resumen.porcentaje)} de lo esperado`}
            color="verde"
            href={`/informes/recaudacion?periodo=${d.periodo.slice(0, 7)}`}
          />
          <Indicador etiqueta="Pendiente del mes" valor={formatearPesos(d.resumen.pendiente)} color="amarillo" href={`/mensualidades?periodo=${d.periodo.slice(0, 7)}`} />
          <Indicador
            etiqueta="Deuda vencida total"
            valor={formatearPesos(d.morosos?.deuda ?? 0)}
            detalle={`${d.morosos?.alumnos ?? 0} alumno(s) con deuda`}
            color="rojo"
            href="/informes/morosidad"
          />
          <Indicador
            etiqueta="Pagos por verificar"
            valor={d.porVerificar?.n ?? 0}
            detalle={formatearPesos(d.porVerificar?.monto ?? 0)}
            color="amarillo"
            href="/pagos?verificacion=por_verificar"
          />
          <Indicador
            etiqueta="Pagos por conciliar"
            valor={d.porConciliar?.n ?? 0}
            detalle={`${formatearPesos(d.porConciliar?.monto ?? 0)} sin asignar`}
            color="amarillo"
            href="/pagos?conciliacion=no_conciliado"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Alertas agrupadas */}
        <Tarjeta
          className="lg:col-span-2"
          titulo="Requiere tu atención"
          acciones={
            <Link href="/alertas" className="enlace text-xs">
              Ver todas
            </Link>
          }
        >
          {d.gruposAlertas.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No hay alertas activas. 👌</p>
          ) : (
            <div className="space-y-4">
              {d.gruposAlertas.map((g) => (
                <div key={g.codigo}>
                  <Link href={`/alertas?regla=${g.codigo}`} className="mb-1.5 flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", puntoNivel[g.nivelMax])} />
                    <span className="text-sm font-bold text-slate-800">{g.nombre}</span>
                    <Insignia color={colorNivel[g.nivelMax]}>{g.total}</Insignia>
                  </Link>
                  <ul className="ml-4 divide-y divide-slate-100 border-l border-slate-200 pl-3">
                    {g.items.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 py-1.5">
                        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", puntoNivel[a.nivel])} title={NIVEL_ALERTA_ETIQUETA[a.nivel]} />
                        <Link href={a.enlace ?? "/alertas"} className="min-w-0 flex-1 text-sm hover:text-marca-700">
                          <span className="font-medium">{a.titulo}</span>
                          {a.detalle && <span className="block truncate text-xs text-slate-500">{a.detalle}</span>}
                        </Link>
                      </li>
                    ))}
                    {g.total > g.items.length && (
                      <li className="py-1.5 text-xs">
                        <Link href={`/alertas?regla=${g.codigo}`} className="enlace">
                          y {g.total - g.items.length} más…
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

        <div className="space-y-6">
          <Tarjeta
            titulo="Recordatorios"
            acciones={
              <Link href="/recordatorios" className="enlace text-xs">
                Agregar
              </Link>
            }
          >
            {d.recordatorios.length === 0 ? (
              <p className="text-sm text-slate-500">Sin recordatorios pendientes.</p>
            ) : (
              <ul className="space-y-2">
                {d.recordatorios.map((r) => {
                  const dias = diferenciaDias(hoyStr, r.fecha);
                  return (
                    <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-800">{r.titulo}</span>
                      <Insignia color={dias < 0 ? "rojo" : dias <= 3 ? "amarillo" : "gris"}>{formatearFecha(r.fecha)}</Insignia>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Recaudación últimos 6 meses">
            <div className="flex h-36 items-end gap-2">
              {d.tendencia.map((t) => (
                <div key={t.periodo} className="flex flex-1 flex-col items-center gap-1">
                  <div className="relative flex h-28 w-full items-end justify-center gap-0.5">
                    <div className="w-1/2 rounded-t bg-slate-200" style={{ height: `${(t.esperado / maxTendencia) * 100}%` }} title={`Esperado ${formatearPesos(t.esperado)}`} />
                    <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${(t.recaudado / maxTendencia) * 100}%` }} title={`Recaudado ${formatearPesos(t.recaudado)}`} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{nombreMes(Number(t.periodo.slice(5, 7))).slice(0, 3)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded bg-slate-300" /> Esperado
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded bg-emerald-500" /> Recaudado
              </span>
              <span className="ml-auto">
                <Pesos monto={d.tendencia.reduce((s, t) => s + t.recaudado, 0)} />
              </span>
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
