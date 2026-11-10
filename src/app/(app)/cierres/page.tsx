import Link from "next/link";
import { requerirUsuario } from "@/server/auth/sesion";
import { listarCierres } from "@/server/modulos/cierres";
import { hoy } from "@/server/fechas";
import { AccionConMotivo } from "@/components/ui/acciones";
import { EncabezadoPagina, Insignia, Pesos, Tarjeta } from "@/components/ui/basicos";
import { sumarMeses } from "@/lib/fechas";
import { formatearFechaHora, formatearPeriodo, formatearPorcentaje } from "@/lib/formato";
import { accionCerrarMes, accionReabrirMes } from "./acciones";

export const metadata = { title: "Cierre de mes" };

type Resumen = { esperado?: number; recaudado?: number; pendiente?: number; porVerificar?: number; porcentaje?: number };

export default async function PaginaCierres() {
  const usuario = await requerirUsuario();
  const lista = await listarCierres();
  const anterior = sumarMeses(`${hoy().slice(0, 7)}-01`, -1);
  return (
    <>
      <EncabezadoPagina
        titulo="Cierre de mes"
        descripcion="Al cerrar un mes se guarda una fotografía de sus totales. Después, cualquier cambio que lo afecte exige un motivo y queda marcado en la auditoría."
      />
      {usuario.rol !== "consulta" && (
        <Tarjeta titulo="Cerrar un mes" className="mb-6">
          <AccionConMotivo accion={accionCerrarMes} texto="Cerrar mes…" variante="primario" requiereMotivo={false} titulo="¿Qué mes quieres cerrar?" textoConfirmar="Cerrar mes">
            <input type="month" name="periodo" defaultValue={anterior.slice(0, 7)} className="campo" required />
            <p className="text-xs text-slate-500">
              Revisa antes el{" "}
              <Link href={`/informes/recaudacion?periodo=${anterior.slice(0, 7)}`} className="enlace">
                informe de recaudación
              </Link>
              .
            </p>
          </AccionConMotivo>
        </Tarjeta>
      )}
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Estado</th>
              <th className="text-right">Esperado</th>
              <th className="text-right">Recaudado</th>
              <th className="text-right">Pendiente</th>
              <th className="text-right">%</th>
              <th>Cerrado por</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500">
                  Aún no se ha cerrado ningún mes.
                </td>
              </tr>
            )}
            {lista.map(({ cierre: c, cerradoPorNombre }) => {
              const r = c.resumen as Resumen;
              return (
                <tr key={c.id}>
                  <td className="font-semibold">
                    <Link href={`/informes/recaudacion?periodo=${c.periodo.slice(0, 7)}`} className="enlace">
                      {formatearPeriodo(c.periodo)}
                    </Link>
                  </td>
                  <td>
                    <Insignia color={c.estado === "cerrado" ? "verde" : "amarillo"}>{c.estado === "cerrado" ? "🔒 Cerrado" : "Reabierto"}</Insignia>
                    {c.motivoReapertura && <span className="block text-[11px] text-slate-500">Motivo: {c.motivoReapertura}</span>}
                  </td>
                  <td className="text-right">
                    <Pesos monto={r.esperado} />
                  </td>
                  <td className="text-right">
                    <Pesos monto={r.recaudado} />
                  </td>
                  <td className="text-right">
                    <Pesos monto={r.pendiente} />
                  </td>
                  <td className="text-right">{formatearPorcentaje(r.porcentaje)}</td>
                  <td className="text-xs">
                    {cerradoPorNombre}
                    <span className="block text-slate-500">{formatearFechaHora(c.cerradoEn)}</span>
                  </td>
                  <td className="text-right">
                    {usuario.rol === "admin" && c.estado === "cerrado" && (
                      <AccionConMotivo accion={accionReabrirMes} ocultos={{ periodo: c.periodo }} texto="Reabrir" titulo="Reabrir mes" />
                    )}
                    {usuario.rol !== "consulta" && c.estado === "reabierto" && (
                      <AccionConMotivo accion={accionCerrarMes} ocultos={{ periodo: c.periodo.slice(0, 7) }} texto="Volver a cerrar" requiereMotivo={false} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
