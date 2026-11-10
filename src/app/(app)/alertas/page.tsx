import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { requerirUsuario } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { alertas, reglasAlerta } from "@/server/db/schema";
import { hoy } from "@/server/fechas";
import { AccionConMotivo, BotonAccion } from "@/components/ui/acciones";
import { BotonEnlace, EncabezadoPagina, EstadoVacio, Insignia, colorNivel, puntoNivel } from "@/components/ui/basicos";
import { MODULO_ETIQUETA, NIVEL_ALERTA_ETIQUETA, NIVEL_ALERTA_PESO, type EstadoAlerta } from "@/lib/constantes";
import { sumarDias } from "@/lib/fechas";
import { formatearFecha } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { accionDescartar, accionPosponer, accionReactivar, accionRecalcular } from "./acciones";

export const metadata = { title: "Alertas" };

export default async function PaginaAlertas({ searchParams }: { searchParams: Promise<{ estado?: string; regla?: string; nivel?: string }> }) {
  const usuario = await requerirUsuario();
  const sp = await searchParams;
  const estado = (sp.estado ?? "activa") as EstadoAlerta;
  const condiciones: SQL[] = [eq(alertas.estado, estado)];
  if (sp.regla) condiciones.push(eq(alertas.reglaCodigo, sp.regla));
  if (sp.nivel) condiciones.push(eq(alertas.nivel, sp.nivel as never));
  const [lista, reglas] = await Promise.all([
    db.select().from(alertas).where(and(...condiciones)).orderBy(desc(alertas.ultimaVez)).limit(500),
    db.select().from(reglasAlerta),
  ]);
  const nombres = new Map(reglas.map((r) => [r.codigo, r.nombre]));
  const ordenadas = lista.sort((a, b) => NIVEL_ALERTA_PESO[b.nivel] - NIVEL_ALERTA_PESO[a.nivel]);
  const enUnaSemana = sumarDias(hoy(), 7);
  const puedeEditar = usuario.rol !== "consulta";

  return (
    <>
      <EncabezadoPagina
        titulo="Alertas y recordatorios"
        descripcion="Todo lo que requiere atención, de todos los módulos. Las alertas se resuelven solas cuando se corrige la causa."
        acciones={
          <>
            {usuario.rol === "admin" && (
              <BotonEnlace href="/configuracion/alertas" variante="secundario">
                Configurar alertas
              </BotonEnlace>
            )}
            <BotonAccion accion={accionRecalcular}>Recalcular ahora</BotonAccion>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {(["activa", "pospuesta", "descartada", "resuelta"] as const).map((e) => (
          <Link
            key={e}
            href={`/alertas?estado=${e}${sp.regla ? `&regla=${sp.regla}` : ""}`}
            className={cn("rounded-full px-3 py-1 font-semibold capitalize", estado === e ? "bg-marca-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}
          >
            {e === "activa" ? "Activas" : e === "pospuesta" ? "Pospuestas" : e === "descartada" ? "Descartadas" : "Resueltas"}
          </Link>
        ))}
        <span className="mx-2 text-slate-300">|</span>
        <form className="flex gap-2">
          <input type="hidden" name="estado" value={estado} />
          <select name="regla" defaultValue={sp.regla ?? ""} className="campo w-auto py-1">
            <option value="">Todas las reglas</option>
            {reglas.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {MODULO_ETIQUETA[r.modulo]} · {r.nombre}
              </option>
            ))}
          </select>
          <button className="rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">Filtrar</button>
        </form>
      </div>

      {ordenadas.length === 0 ? (
        <EstadoVacio titulo="No hay alertas en esta vista" />
      ) : (
        <ul className="space-y-2">
          {ordenadas.map((a) => (
            <li key={a.id} className="tarjeta flex flex-wrap items-start gap-3 p-3">
              <span className={cn("mt-1.5 size-3 shrink-0 rounded-full", puntoNivel[a.nivel])} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={a.enlace ?? "#"} className="font-semibold text-slate-900 hover:text-marca-700">
                    {a.titulo}
                  </Link>
                  <Insignia color={colorNivel[a.nivel]}>{NIVEL_ALERTA_ETIQUETA[a.nivel]}</Insignia>
                  <Insignia>{MODULO_ETIQUETA[a.modulo]}</Insignia>
                </div>
                {a.detalle && <p className="text-sm text-slate-600">{a.detalle}</p>}
                <p className="text-xs text-slate-400">
                  {nombres.get(a.reglaCodigo)}
                  {a.fechaReferencia && ` · fecha de referencia ${formatearFecha(a.fechaReferencia)}`}
                  {a.pospuestaHasta && estado === "pospuesta" && ` · pospuesta hasta ${formatearFecha(a.pospuestaHasta)}`}
                </p>
              </div>
              {puedeEditar && estado === "activa" && (
                <div className="flex flex-wrap gap-2">
                  <AccionConMotivo
                    accion={accionPosponer.bind(null, a.id)}
                    texto="Posponer"
                    requiereMotivo={false}
                    titulo="Posponer hasta"
                    textoConfirmar="Posponer"
                  >
                    <input type="date" name="hasta" defaultValue={enUnaSemana} className="campo" required />
                  </AccionConMotivo>
                  <BotonAccion accion={accionDescartar.bind(null, a.id)} variante="fantasma">
                    Descartar
                  </BotonAccion>
                </div>
              )}
              {puedeEditar && (estado === "pospuesta" || estado === "descartada") && (
                <BotonAccion accion={accionReactivar.bind(null, a.id)} variante="secundario">
                  Reactivar
                </BotonAccion>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
