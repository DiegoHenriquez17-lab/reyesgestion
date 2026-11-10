"use client";

import { useEffect, useState, useTransition } from "react";
import { BotonEnviar, Campo, Casilla, Formulario, Selector, AreaTexto, type AccionFormulario } from "@/components/ui/formularios";
import { SelectorAlumno, type OpcionAlumno } from "@/components/ui/selector-alumno";
import { MEDIOS_PAGO, MEDIO_PAGO_ETIQUETA } from "@/lib/constantes";
import { formatearFecha, formatearPeriodo, formatearPesos, parsearMonto } from "@/lib/formato";

type MensualidadSaldo = { id: number; periodo: string; saldo: number; fechaVencimiento: string };

export function FormularioPago({
  accion,
  alumnos,
  cargarMensualidades,
  alumnoInicial,
  hoy,
  titulares,
}: {
  accion: AccionFormulario;
  alumnos: OpcionAlumno[];
  cargarMensualidades: (alumnoId: number) => Promise<MensualidadSaldo[]>;
  alumnoInicial: number | null;
  hoy: string;
  titulares: Record<number, string>;
}) {
  const [alumnoId, setAlumnoId] = useState<number | null>(alumnoInicial);
  const [mensualidades, setMensualidades] = useState<MensualidadSaldo[]>([]);
  const [aplicar, setAplicar] = useState<Record<number, string>>({});
  const [montoManual, setMontoManual] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  const cargar = (id: number) =>
    iniciar(async () => {
      const lista = await cargarMensualidades(id);
      setMensualidades(lista);
      // Por defecto se propone el mes más antiguo con saldo
      setAplicar(lista.length ? { [lista[0].id]: String(lista[0].saldo) } : {});
    });

  const elegirAlumno = (id: number | null) => {
    setAlumnoId(id);
    setMensualidades([]);
    setAplicar({});
    setMontoManual(null);
    if (id) cargar(id);
  };

  // Si se llega desde la ficha de un alumno, cargar sus meses al abrir
  useEffect(() => {
    if (alumnoInicial) cargar(alumnoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sumaAplicada = Object.values(aplicar).reduce((s, v) => s + (parsearMonto(v) ?? 0), 0);
  const monto = montoManual ?? (sumaAplicada ? String(sumaAplicada) : "");
  const montoNum = parsearMonto(monto) ?? 0;

  return (
    <Formulario accion={accion}>
      {(e) => (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="tarjeta space-y-4 p-4">
              <SelectorAlumno alumnos={alumnos} valor={alumnoId} alCambiar={elegirAlumno} etiqueta="1. Alumno (opcional: sin alumno queda «por conciliar»)" />
              {alumnoId && (
                <div>
                  <p className="etiqueta">2. Mes(es) que paga</p>
                  {cargando ? (
                    <p className="text-sm text-slate-500">Cargando…</p>
                  ) : mensualidades.length === 0 ? (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      Este alumno no tiene mensualidades con saldo. El pago quedará como saldo a favor por conciliar.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {mensualidades.map((m) => {
                        const marcado = m.id in aplicar;
                        return (
                          <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={(ev) => {
                                setMontoManual(null);
                                setAplicar((a) => {
                                  const n = { ...a };
                                  if (ev.target.checked) n[m.id] = String(m.saldo);
                                  else delete n[m.id];
                                  return n;
                                });
                              }}
                              className="size-4"
                            />
                            <span className="flex-1 text-sm">
                              <span className="font-medium">{formatearPeriodo(m.periodo)}</span>
                              <span className="ml-2 text-xs text-slate-500">
                                saldo {formatearPesos(m.saldo)} · vence {formatearFecha(m.fechaVencimiento)}
                              </span>
                            </span>
                            {marcado && (
                              <input
                                name={`aplicar_${m.id}`}
                                value={aplicar[m.id]}
                                onChange={(ev) => {
                                  setMontoManual(null);
                                  setAplicar((a) => ({ ...a, [m.id]: ev.target.value }));
                                }}
                                inputMode="numeric"
                                className="campo w-28 text-right"
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <AreaTexto etiqueta="Observaciones" nombre="observaciones" />
            <Campo etiqueta="Motivo (solo si el pago afecta un mes ya cerrado)" nombre="motivo" />
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="tarjeta space-y-3 p-4">
              <p className="etiqueta">3. Datos del pago</p>
              <Campo
                etiqueta="Monto recibido ($)"
                nombre="monto"
                required
                inputMode="numeric"
                value={monto}
                onChange={(ev) => setMontoManual(ev.target.value)}
                errores={e}
                className="[&_input]:text-lg [&_input]:font-bold"
              />
              {montoNum > 0 && sumaAplicada > 0 && montoNum !== sumaAplicada && (
                <p className="text-xs text-amber-700">
                  {montoNum > sumaAplicada
                    ? `Quedarán ${formatearPesos(montoNum - sumaAplicada)} sin asignar (por conciliar).`
                    : `Lo aplicado supera el monto en ${formatearPesos(sumaAplicada - montoNum)}.`}
                </p>
              )}
              <Campo etiqueta="Fecha de pago" nombre="fechaPago" type="date" required defaultValue={hoy} errores={e} />
              <Selector etiqueta="Medio" nombre="medio" defaultValue="transferencia" opciones={MEDIOS_PAGO.map((m) => ({ valor: m, texto: MEDIO_PAGO_ETIQUETA[m] }))} />
              <Campo etiqueta="Nombre de quien paga" nombre="nombreOrigen" defaultValue={alumnoId ? (titulares[alumnoId] ?? "") : ""} key={alumnoId ?? 0} errores={e} />
              <div className="grid grid-cols-2 gap-2">
                <Campo etiqueta="Banco" nombre="banco" errores={e} />
                <Campo etiqueta="N° operación" nombre="numeroOperacion" errores={e} />
              </div>
              <Campo etiqueta="RUT de quien paga" nombre="rutOrigen" errores={e} />
              <label className="block">
                <span className="etiqueta">Comprobante (foto o PDF, opcional)</span>
                <input type="file" name="comprobante" accept="image/*,application/pdf" capture="environment" className="block w-full text-sm" />
              </label>
              <Casilla etiqueta="El dinero ya está confirmado (recibido)" nombre="verificado" defaultChecked />
              <Casilla etiqueta="Registrar aunque el N° de operación ya exista" nombre="permitirDuplicado" />
            </div>
            <BotonEnviar tamano="lg" variante="exito" className="w-full">
              Guardar pago
            </BotonEnviar>
          </div>
        </div>
      )}
    </Formulario>
  );
}
