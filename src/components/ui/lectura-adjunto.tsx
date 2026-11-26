"use client";

import { useRef, useState, useTransition } from "react";
import { NO_IDENTIFICADO } from "@/lib/constantes";
import { PROVEEDOR_IA_ETIQUETA, type ProveedorIa } from "@/lib/proveedores-ia";
import type { ResultadoAccion } from "@/lib/utils";
import { Aviso, clasesBoton } from "./basicos";
import { Campo } from "./formularios";

type Lectura = { campos: Record<string, string | null>; proveedor: ProveedorIa; respaldo: boolean; advertencias: string[] };

export function LecturaAdjunto({ accion, campos }: {
  accion?: (fd: FormData) => Promise<ResultadoAccion<Lectura>>;
  campos: readonly { clave: string; etiqueta: string }[];
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [respuesta, setRespuesta] = useState<ResultadoAccion<Lectura> | null>(null);
  const [leyendo, iniciar] = useTransition();

  function leer() {
    const archivo = entrada.current?.files?.[0];
    if (!accion || !archivo) {
      setRespuesta({ ok: false, error: "Selecciona un archivo primero." });
      return;
    }
    const fd = new FormData();
    fd.set("archivo", archivo);
    iniciar(async () => {
      try {
        const resultado = await accion(fd);
        if (entrada.current?.files?.[0] === archivo) setRespuesta(resultado);
      } catch {
        setRespuesta({ ok: false, error: "La lectura se interrumpió. Vuelve a intentarlo o revisa el documento manualmente." });
      }
    });
  }

  return <div className="space-y-2">
    <Campo ref={entrada} etiqueta="Adjunto" nombre="archivo" type="file" accept=".pdf,.docx,image/*" onChange={() => setRespuesta(null)} />
    {accion && <button type="button" className={clasesBoton({ variante: "secundario", tamano: "sm" })} disabled={leyendo} onClick={leer}>{leyendo ? "Leyendo adjunto…" : "Leer datos con IA"}</button>}
    {respuesta && !respuesta.ok && <Aviso tipo="advertencia">{respuesta.error}</Aviso>}
    {respuesta?.ok && respuesta.datos && <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
      <p className="font-semibold">Propuesta de {PROVEEDOR_IA_ETIQUETA[respuesta.datos.proveedor]}{respuesta.datos.respaldo && " (respaldo)"}</p>
      <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">{campos.map(({ clave, etiqueta }) => <div key={clave} className="contents"><dt className="font-medium">{etiqueta}</dt><dd>{respuesta.datos?.campos[clave] ?? NO_IDENTIFICADO}</dd></div>)}</dl>
      {respuesta.datos.advertencias.map((a, i) => <p className="text-xs text-violet-900" key={i}>{a}</p>)}
      <p className="text-xs">Compara los datos con el adjunto y completa los campos antes de guardar.</p>
    </div>}
  </div>;
}
