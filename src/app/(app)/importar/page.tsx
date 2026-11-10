import Link from "next/link";
import { requerirUsuario } from "@/server/auth/sesion";
import { listarImportaciones } from "@/server/importacion";
import { iaHabilitada } from "@/server/entorno";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { DESTINO_IMPORTACION_ETIQUETA, ESTADO_IMPORTACION_ETIQUETA, type DestinoImportacion } from "@/lib/constantes";
import { formatearFechaHora } from "@/lib/formato";
import { FormularioSubida } from "./subida";

export const metadata = { title: "Importar datos" };

export default async function PaginaImportar({ searchParams }: { searchParams: Promise<{ destino?: string; modo?: string }> }) {
  await requerirUsuario(["admin", "operador"]);
  const [sp, lista] = await Promise.all([searchParams, listarImportaciones()]);
  const destino = (sp.destino === "pagos" ? "pagos" : sp.destino === "alumnos" ? "alumnos" : "alumnos") as DestinoImportacion;

  return (
    <>
      <EncabezadoPagina
        titulo="Importar datos"
        descripcion="Excel, Word, PDF o fotos. El sistema analiza, te muestra lo que encontró y solo guarda lo que tú confirmes."
      />
      <div className="mb-6 grid grid-cols-5 gap-1 rounded-xl border border-marca-100 bg-marca-50 p-2 text-[10px] font-semibold text-marca-900 sm:gap-2 sm:p-3 sm:text-xs">
        {["1. Importar", "2. Analizar", "3. Mostrar", "4. Validar (tú)", "5. Guardar"].map((p) => (
          <span key={p} className="rounded-lg bg-white px-1 py-1.5 text-center ring-1 ring-marca-100">
            {p}
          </span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FormularioSubida destinoInicial={destino} modoFoto={sp.modo === "foto"} iaDisponible={iaHabilitada()} />
        </div>
        <Tarjeta titulo="Importaciones recientes" className="lg:col-span-2">
          {lista.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay importaciones.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lista.map(({ imp, usuario }) => (
                <li key={imp.id} className="py-2">
                  <Link href={`/importar/${imp.id}`} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="text-sm font-semibold text-slate-800">
                        #{imp.id} · {DESTINO_IMPORTACION_ETIQUETA[imp.destino]}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {imp.tipoFuente.toUpperCase()} · {formatearFechaHora(imp.creadoEn)} · {usuario}
                      </span>
                    </span>
                    <Insignia
                      color={imp.estado === "aplicada" ? "verde" : imp.estado === "en_revision" ? "amarillo" : imp.estado === "error" ? "rojo" : "gris"}
                    >
                      {ESTADO_IMPORTACION_ETIQUETA[imp.estado]}
                    </Insignia>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
