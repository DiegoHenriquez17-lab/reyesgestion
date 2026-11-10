import Link from "next/link";
import { requerirUsuario } from "@/server/auth/sesion";
import { listarPagos, type FiltrosPagos } from "@/server/modulos/pagos";
import { BotonEnlace, EncabezadoPagina, EstadoVacio, Pesos } from "@/components/ui/basicos";
import { EstadoPagoInsignia } from "@/components/ui/estados";
import { MEDIO_PAGO_ETIQUETA, ORIGEN_PAGO_ETIQUETA, type EstadoConciliacion, type EstadoVerificacion } from "@/lib/constantes";
import { formatearFecha, nombreCompleto } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pagos" };

const PESTANAS = [
  { clave: "todos", texto: "Todos", params: {} },
  { clave: "verificar", texto: "Por verificar", params: { verificacion: "por_verificar" } },
  { clave: "conciliar", texto: "Por conciliar", params: { conciliacion: "no_conciliado" } },
  { clave: "conciliados", texto: "Conciliados", params: { conciliacion: "conciliado" } },
] as const;

type Sp = { verificacion?: string; conciliacion?: string; q?: string; desde?: string; hasta?: string };

export default async function PaginaPagos({ searchParams }: { searchParams: Promise<Sp> }) {
  await requerirUsuario();
  const sp = await searchParams;
  const filtros: FiltrosPagos = {
    verificacion: sp.verificacion as EstadoVerificacion | undefined,
    conciliacion: sp.conciliacion as EstadoConciliacion | "no_conciliado" | undefined,
    q: sp.q,
    desde: sp.desde,
    hasta: sp.hasta,
  };
  const lista = await listarPagos(filtros);
  const activa =
    sp.verificacion === "por_verificar" ? "verificar" : sp.conciliacion === "no_conciliado" ? "conciliar" : sp.conciliacion === "conciliado" ? "conciliados" : "todos";
  const total = lista.reduce((s, p) => s + p.monto, 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Pagos"
        descripcion={`${lista.length} pago(s) · ${total.toLocaleString("es-CL", { style: "currency", currency: "CLP" })}`}
        acciones={
          <>
            <BotonEnlace href="/importar?destino=pagos" variante="secundario">
              Importar cartola
            </BotonEnlace>
            <BotonEnlace href="/importar?destino=pagos&modo=foto" variante="secundario">
              Subir voucher
            </BotonEnlace>
            <BotonEnlace href="/pagos/nuevo" variante="exito">
              + Registrar pago
            </BotonEnlace>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={{ pathname: "/pagos", query: p.params }}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold",
              activa === p.clave ? "border-marca-700 text-marca-800" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {p.texto}
          </Link>
        ))}
      </div>

      <form className="tarjeta mb-4 grid gap-3 p-3 sm:grid-cols-4">
        {sp.verificacion && <input type="hidden" name="verificacion" value={sp.verificacion} />}
        {sp.conciliacion && <input type="hidden" name="conciliacion" value={sp.conciliacion} />}
        <input name="q" defaultValue={sp.q} placeholder="Nombre, N° operación o monto" className="campo sm:col-span-2" />
        <input type="date" name="desde" defaultValue={sp.desde} className="campo" aria-label="Desde" />
        <div className="flex gap-2">
          <input type="date" name="hasta" defaultValue={sp.hasta} className="campo" aria-label="Hasta" />
          <button className="rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white">Filtrar</button>
        </div>
      </form>

      {lista.length === 0 ? (
        <EstadoVacio titulo="No hay pagos con estos filtros" accion={<BotonEnlace href="/pagos/nuevo">Registrar pago</BotonEnlace>} />
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Quién paga</th>
                <th className="hidden md:table-cell">Alumno</th>
                <th className="text-right">Monto</th>
                <th>Estado</th>
                <th className="hidden lg:table-cell">Origen</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pagos/${p.id}`} className="enlace">
                      #{p.id}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{formatearFecha(p.fechaPago)}</td>
                  <td>
                    {p.nombreOrigen ?? (p.pagador ? nombreCompleto(p.pagador) : <span className="text-slate-400">No identificado</span>)}
                    <span className="block text-[11px] text-slate-500">
                      {MEDIO_PAGO_ETIQUETA[p.medio]}
                      {p.numeroOperacion && ` · Op. ${p.numeroOperacion}`}
                    </span>
                  </td>
                  <td className="hidden md:table-cell">
                    {p.alumno ? (
                      <Link href={`/alumnos/${p.alumno.id}`} className="enlace">
                        {nombreCompleto(p.alumno.persona)}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-right font-semibold">
                    <Pesos monto={p.monto} />
                    {p.montoAplicado > 0 && p.montoAplicado < p.monto && (
                      <span className="block text-[11px] font-normal text-amber-700">
                        sin asignar <Pesos monto={p.monto - p.montoAplicado} />
                      </span>
                    )}
                  </td>
                  <td>
                    <EstadoPagoInsignia verificacion={p.estadoVerificacion} conciliacion={p.estadoConciliacion} anulado={!!p.anuladoEn} />
                  </td>
                  <td className="hidden text-xs text-slate-500 lg:table-cell">{ORIGEN_PAGO_ETIQUETA[p.origen]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
