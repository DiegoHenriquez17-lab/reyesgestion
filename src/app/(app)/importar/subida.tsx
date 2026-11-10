"use client";

import { useState } from "react";
import { Camera, FileUp } from "lucide-react";
import { Aviso } from "@/components/ui/basicos";
import { AreaTexto, BotonEnviar, Casilla, Formulario } from "@/components/ui/formularios";
import type { DestinoImportacion } from "@/lib/constantes";
import { cn } from "@/lib/utils";
import { accionSubirArchivo } from "./acciones";

export function FormularioSubida({ destinoInicial, modoFoto, iaDisponible }: { destinoInicial: DestinoImportacion; modoFoto: boolean; iaDisponible: boolean }) {
  const [destino, setDestino] = useState<DestinoImportacion>(destinoInicial);
  const [archivo, setArchivo] = useState<File | null>(null);
  const ext = archivo?.name.split(".").pop()?.toLowerCase() ?? "";
  const necesitaIa = !!archivo && (archivo.type.startsWith("image/") || ext === "pdf");
  const esWord = ext === "docx";
  const esTabla = ["xlsx", "xlsm", "csv"].includes(ext);

  return (
    <Formulario accion={accionSubirArchivo}>
      <div className="tarjeta space-y-5 p-5">
        <div>
          <p className="etiqueta">¿Qué información contiene?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["alumnos", "Alumnos y apoderados", "Nóminas, planillas de alumnos, buses, tarifas"],
                ["pagos", "Pagos / comprobantes", "Vouchers, cartolas bancarias, planillas de pagos"],
              ] as const
            ).map(([v, t, d]) => (
              <label
                key={v}
                className={cn(
                  "cursor-pointer rounded-lg border p-3 transition",
                  destino === v ? "border-marca-500 bg-marca-50 ring-2 ring-marca-100" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <input type="radio" name="destino" value={v} checked={destino === v} onChange={() => setDestino(v)} className="sr-only" />
                <span className="block text-sm font-bold text-slate-800">{t}</span>
                <span className="block text-xs text-slate-500">{d}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="etiqueta">Archivo</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 p-5 text-center hover:border-marca-400 hover:bg-marca-50/40">
              <FileUp className="size-6 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Elegir archivo</span>
              <span className="text-xs text-slate-500">Excel, CSV, Word, PDF o imagen</span>
              <input
                type="file"
                accept=".xlsx,.xlsm,.csv,.docx,.pdf,image/*"
                className="sr-only"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-violet-300 p-5 text-center hover:border-violet-500 hover:bg-violet-50/40",
                modoFoto && "border-violet-500 bg-violet-50 ring-2 ring-violet-100",
              )}
            >
              <Camera className="size-6 text-violet-600" />
              <span className="text-sm font-semibold text-slate-700">Tomar foto</span>
              <span className="text-xs text-slate-500">Planilla, voucher o documento</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {archivo && (
            <p className="mt-2 text-sm text-slate-700">
              Seleccionado: <strong>{archivo.name}</strong> ({(archivo.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
          {/* Un solo campo "archivo" se envía: copiamos la selección al input con nombre */}
          <ArchivoOculto archivo={archivo} />
        </div>

        {(necesitaIa || esWord) && (
          <div className="space-y-3 rounded-lg bg-violet-50 p-3">
            {!iaDisponible && necesitaIa && (
              <Aviso tipo="advertencia">La lectura con IA no está configurada todavía (falta ANTHROPIC_API_KEY). Este archivo no se podrá leer.</Aviso>
            )}
            {esWord && <Casilla nombre="usarIa" etiqueta="Leer con IA (si el Word no es una tabla)" />}
            <p className="text-xs text-violet-900">
              La IA solo transcribe lo que está escrito. Lo que no se lea con claridad quedará como «información no identificada» para que tú lo completes.
            </p>
            <AreaTexto etiqueta="Indicaciones para la IA (opcional)" nombre="indicaciones" placeholder="Ej: es la nómina del bus 16, marzo 2027" />
          </div>
        )}

        {destino === "pagos" && (esTabla || !archivo) && (
          <Casilla nombre="verificado" defaultChecked etiqueta="Es una cartola del banco: el dinero ya está confirmado" />
        )}

        <BotonEnviar tamano="lg" className="w-full" textoEnviando={necesitaIa ? "Leyendo con IA… (puede tardar un minuto)" : "Analizando…"}>
          Analizar archivo
        </BotonEnviar>
      </div>
    </Formulario>
  );
}

/** Mantiene un único input "archivo" con el archivo elegido (por cualquiera de los dos botones). */
function ArchivoOculto({ archivo }: { archivo: File | null }) {
  return (
    <input
      type="file"
      name="archivo"
      className="hidden"
      ref={(el) => {
        if (!el) return;
        const dt = new DataTransfer();
        if (archivo) dt.items.add(archivo);
        el.files = dt.files;
      }}
    />
  );
}
