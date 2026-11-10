import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/server/auth/sesion";
import { obtenerImportacion } from "@/server/importacion";
import { Aviso, EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { BotonAccion } from "@/components/ui/acciones";
import {
  ACCION_FILA_ETIQUETA,
  DESTINO_IMPORTACION_ETIQUETA,
  ESTADO_IMPORTACION_ETIQUETA,
  type AccionFila,
} from "@/lib/constantes";
import { CAMPOS_IMPORTACION } from "@/lib/importacion-campos";
import { accionAplicar, accionCancelar, accionConfirmarMapeo, accionDecidirTodas, accionReanalizar } from "../acciones";
import { FormularioMapeo } from "./mapeo";
import { FilaRevision } from "./fila";

const COLOR_ACCION: Record<AccionFila, "verde" | "azul" | "gris" | "amarillo" | "naranja" | "rojo"> = {
  crear: "verde",
  actualizar: "azul",
  sin_cambios: "gris",
  posible_duplicado: "naranja",
  requiere_revision: "amarillo",
  error: "rojo",
};

export default async function PaginaImportacion({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario(["admin", "operador"]);
  const { id } = await params;
  const datos = await obtenerImportacion(Number(id));
  if (!datos) notFound();
  const { importacion: imp, filas, documento } = datos;
  const necesitaMapeo = imp.estado === "en_revision" && imp.resumen == null && imp.mapeo != null;
  const pendientes = filas.filter((f) => f.estado === "pendiente");
  const sinDecision = pendientes.filter((f) => !f.decision).length;
  const ia = imp.extraccionIa as { tipo_documento?: string; resumen?: string; advertencias?: string[] } | null;
  const conteo = (Object.keys(ACCION_FILA_ETIQUETA) as AccionFila[])
    .map((a) => ({ accion: a, n: pendientes.filter((f) => f.accionPropuesta === a).length }))
    .filter((c) => c.n > 0);

  return (
    <>
      <EncabezadoPagina
        volver={{ href: "/importar", texto: "Importar" }}
        titulo={`Importación #${imp.id} — ${DESTINO_IMPORTACION_ETIQUETA[imp.destino]}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            {documento && (
              <a href={`/api/documentos/${documento.id}`} target="_blank" className="enlace">
                {documento.nombreOriginal}
              </a>
            )}
            <Insignia>{imp.tipoFuente.toUpperCase()}</Insignia>
            <Insignia color={imp.estado === "aplicada" ? "verde" : imp.estado === "error" ? "rojo" : "amarillo"}>{ESTADO_IMPORTACION_ETIQUETA[imp.estado]}</Insignia>
            <span>{filas.length} registro(s)</span>
          </span>
        }
        acciones={
          imp.estado === "en_revision" && (
            <BotonAccion accion={accionCancelar.bind(null, imp.id)} variante="fantasma" confirmar="¿Cancelar esta importación? No se guardará nada más.">
              Cancelar importación
            </BotonAccion>
          )
        }
      />

      {imp.estado === "error" && (
        <Aviso tipo="error">
          <strong>No se pudo procesar el archivo:</strong> {imp.error}
        </Aviso>
      )}

      {ia && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
          <p>
            <strong>Lectura con IA:</strong> {ia.tipo_documento} — {ia.resumen}
          </p>
          {ia.advertencias && ia.advertencias.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {ia.advertencias.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs">Compara cada dato con el documento antes de guardar. La IA propone; tú confirmas.</p>
        </div>
      )}

      {necesitaMapeo && imp.columnas && imp.mapeo && (
        <Tarjeta titulo="Paso 2 · ¿Qué significa cada columna?">
          <p className="mb-4 text-sm text-slate-600">
            El sistema propuso el significado de cada columna. Revísalo y corrige lo necesario. Las columnas en «No importar» se ignoran.
          </p>
          <FormularioMapeo
            accion={accionConfirmarMapeo.bind(null, imp.id)}
            columnas={imp.columnas}
            mapeo={imp.mapeo}
            campos={CAMPOS_IMPORTACION[imp.destino]}
            ejemplo={filas.slice(0, 5).map((f) => f.datosOriginales)}
            destino={imp.destino}
            verificado={!!imp.opciones?.verificado}
          />
        </Tarjeta>
      )}

      {!necesitaMapeo && filas.length > 0 && (
        <div className={documento?.mime.startsWith("image/") ? "grid gap-6 xl:grid-cols-3" : ""}>
          {documento?.mime.startsWith("image/") && (
            <div className="xl:sticky xl:top-20 xl:self-start">
              <Tarjeta titulo="Documento original">
                <a href={`/api/documentos/${documento.id}`} target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/documentos/${documento.id}`} alt="Documento importado" className="w-full rounded-lg border border-slate-200" />
                </a>
              </Tarjeta>
            </div>
          )}
          <div className="space-y-4 xl:col-span-2">
            <Tarjeta
              titulo="Paso 3 · Revisa y decide"
              acciones={
                imp.estado === "en_revision" && (
                  <BotonAccion accion={accionReanalizar.bind(null, imp.id)} variante="secundario">
                    Volver a analizar
                  </BotonAccion>
                )
              }
            >
              <div className="flex flex-wrap gap-2">
                {conteo.map((c) => (
                  <Insignia key={c.accion} color={COLOR_ACCION[c.accion]}>
                    {ACCION_FILA_ETIQUETA[c.accion]}: {c.n}
                  </Insignia>
                ))}
                {filas.filter((f) => f.estado === "aplicada").length > 0 && <Insignia color="verde">Guardados: {filas.filter((f) => f.estado === "aplicada").length}</Insignia>}
                {filas.filter((f) => f.estado === "omitida").length > 0 && <Insignia>Omitidos: {filas.filter((f) => f.estado === "omitida").length}</Insignia>}
              </div>
              {imp.estado === "en_revision" && conteo.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-sm">
                  <span className="font-semibold text-slate-600">Decidir en bloque:</span>
                  {conteo.some((c) => c.accion === "crear") && (
                    <BotonAccion accion={accionDecidirTodas.bind(null, imp.id)} ocultos={{ accion: "crear", decision: "crear" }}>
                      Crear todos los nuevos
                    </BotonAccion>
                  )}
                  {conteo.some((c) => c.accion === "actualizar") && (
                    <BotonAccion accion={accionDecidirTodas.bind(null, imp.id)} ocultos={{ accion: "actualizar", decision: "actualizar" }}>
                      Aceptar todos los cambios
                    </BotonAccion>
                  )}
                  {conteo.some((c) => c.accion === "posible_duplicado") && (
                    <BotonAccion accion={accionDecidirTodas.bind(null, imp.id)} ocultos={{ accion: "posible_duplicado", decision: "mantener" }}>
                      Mantener actuales en duplicados
                    </BotonAccion>
                  )}
                </div>
              )}
            </Tarjeta>

            <div className="space-y-3">
              {filas.map((f) => (
                <FilaRevision key={f.id} fila={f} destino={imp.destino} importacionId={imp.id} editable={imp.estado === "en_revision" && f.estado === "pendiente"} />
              ))}
            </div>

            {imp.estado === "en_revision" && (
              <div className="tarjeta sticky bottom-3 flex flex-wrap items-center justify-between gap-3 border-marca-200 p-4 shadow-lg">
                <p className="text-sm text-slate-700">
                  {sinDecision > 0 ? (
                    <span className="font-semibold text-amber-700">{sinDecision} registro(s) esperan tu decisión (no se guardarán hasta que decidas).</span>
                  ) : (
                    "Todo decidido. Solo se guardará lo marcado como Crear / Actualizar / Fusionar."
                  )}
                </p>
                <BotonAccion accion={accionAplicar.bind(null, imp.id)} variante="exito" confirmar="¿Guardar en la base de datos los registros confirmados?">
                  Paso 4 · Guardar lo confirmado
                </BotonAccion>
              </div>
            )}
            {imp.estado === "aplicada" && (
              <Aviso tipo="exito">
                Importación aplicada. Revisa el resultado en{" "}
                <Link href={imp.destino === "alumnos" ? "/alumnos" : "/pagos"} className="enlace">
                  {imp.destino === "alumnos" ? "Alumnos" : "Pagos"}
                </Link>
                .
              </Aviso>
            )}
          </div>
        </div>
      )}
    </>
  );
}
