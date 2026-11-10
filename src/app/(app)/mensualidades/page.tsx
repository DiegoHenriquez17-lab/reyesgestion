import Link from "next/link";
import { requerirUsuario } from "@/server/auth/sesion";
import { alumnosSinMensualidad, listarMensualidadesPeriodo } from "@/server/modulos/mensualidades";
import { periodosCerrados } from "@/server/auditoria";
import { db } from "@/server/db";
import { hoy } from "@/server/fechas";
import { AccionConMotivo } from "@/components/ui/acciones";
import { Aviso, EncabezadoPagina, EstadoVacio, Insignia, Pesos } from "@/components/ui/basicos";
import { EstadoMensualidadInsignia } from "@/components/ui/estados";
import { aPeriodo, sumarMeses } from "@/lib/fechas";
import { formatearFecha, formatearPeriodo, nombreCompleto } from "@/lib/formato";
import { accionCambiarMontoMensualidad } from "./acciones";
import { GenerarMensualidades } from "./generar";

export const metadata = { title: "Mensualidades" };

export default async function PaginaMensualidades({ searchParams }: { searchParams: Promise<{ periodo?: string; estado?: string }> }) {
  const usuario = await requerirUsuario();
  const sp = await searchParams;
  const hoyStr = hoy();
  const periodo = aPeriodo(sp.periodo) ?? `${hoyStr.slice(0, 7)}-01`;
  const [lista, faltantes, cerrados] = await Promise.all([listarMensualidadesPeriodo(periodo), alumnosSinMensualidad(periodo), periodosCerrados(db, [periodo])]);
  const filtradas = sp.estado ? lista.filter((m) => m.estado === sp.estado) : lista;
  const total = lista.reduce((s, m) => s + m.monto, 0);
  const pagado = lista.reduce((s, m) => s + m.montoPagado, 0);
  const puedeEditar = usuario.rol !== "consulta";

  return (
    <>
      <EncabezadoPagina
        titulo={`Mensualidades — ${formatearPeriodo(periodo)}`}
        descripcion={`${lista.length} mensualidades · esperado ${total.toLocaleString("es-CL", { style: "currency", currency: "CLP" })} · pagado ${pagado.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}`}
        acciones={
          <div className="flex items-center gap-2">
            <Link href={`/mensualidades?periodo=${sumarMeses(periodo, -1).slice(0, 7)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              ←
            </Link>
            <form className="flex gap-2">
              <input type="month" name="periodo" defaultValue={periodo.slice(0, 7)} className="campo" />
              <button className="rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">Ir</button>
            </form>
            <Link href={`/mensualidades?periodo=${sumarMeses(periodo, 1).slice(0, 7)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              →
            </Link>
          </div>
        }
      />

      {cerrados.length > 0 && (
        <div className="mb-4">
          <Aviso tipo="info">🔒 Este mes está cerrado. Cualquier cambio exigirá un motivo y quedará marcado en la auditoría.</Aviso>
        </div>
      )}

      {puedeEditar && faltantes.length > 0 && (
        <div className="tarjeta mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="font-semibold text-amber-900">{faltantes.length} alumno(s) activo(s) sin mensualidad en {formatearPeriodo(periodo)}</p>
            <p className="text-xs text-amber-800">
              {faltantes
                .slice(0, 6)
                .map((a) => nombreCompleto(a))
                .join(", ")}
              {faltantes.length > 6 ? "…" : ""}
            </p>
          </div>
          <GenerarMensualidades periodo={periodo.slice(0, 7)} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {[
          ["", "Todas"],
          ["pendiente", "Pendientes"],
          ["parcial", "Parciales"],
          ["pagada", "Pagadas"],
          ["condonada", "Condonadas"],
          ["no_recuperable", "No recuperables"],
        ].map(([v, t]) => (
          <Link
            key={v}
            href={`/mensualidades?periodo=${periodo.slice(0, 7)}${v ? `&estado=${v}` : ""}`}
            className={`rounded-full px-3 py-1 font-semibold ${(sp.estado ?? "") === v ? "bg-marca-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {t}
          </Link>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <EstadoVacio
          titulo="Sin mensualidades para mostrar"
          descripcion={lista.length === 0 ? "Genera las mensualidades del mes para los alumnos activos." : undefined}
          accion={lista.length === 0 && puedeEditar ? <GenerarMensualidades periodo={periodo.slice(0, 7)} /> : undefined}
        />
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Bus</th>
                <th className="text-right">Monto</th>
                <th className="text-right">Pagado</th>
                <th className="text-right">Saldo</th>
                <th>Vence</th>
                <th>Estado</th>
                {puedeEditar && <th />}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/alumnos/${m.alumnoId}`} className="enlace">
                      {nombreCompleto(m)}
                    </Link>
                  </td>
                  <td>{m.busNumero ? <Insignia color="azul">{m.busNumero}</Insignia> : "—"}</td>
                  <td className="text-right">
                    <Pesos monto={m.monto} />
                  </td>
                  <td className="text-right">
                    <Pesos monto={m.montoPagado} />
                  </td>
                  <td className="text-right font-semibold">
                    <Pesos monto={["pendiente", "parcial"].includes(m.estado) ? m.monto - m.montoPagado : 0} />
                  </td>
                  <td className="whitespace-nowrap">{formatearFecha(m.fechaVencimiento)}</td>
                  <td>
                    <EstadoMensualidadInsignia estado={m.estado} vencida={m.fechaVencimiento < hoyStr} />
                  </td>
                  {puedeEditar && (
                    <td className="text-right">
                      {["pendiente", "parcial"].includes(m.estado) && (
                        <AccionConMotivo accion={accionCambiarMontoMensualidad} texto="Cambiar monto" ocultos={{ id: m.id }} titulo="Nuevo monto" textoConfirmar="Guardar">
                          <input name="monto" defaultValue={m.monto} inputMode="numeric" className="campo" required />
                        </AccionConMotivo>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
