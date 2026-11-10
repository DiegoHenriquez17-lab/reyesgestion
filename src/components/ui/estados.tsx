import {
  ESTADO_CONCILIACION_ETIQUETA,
  ESTADO_MENSUALIDAD_ETIQUETA,
  ESTADO_VERIFICACION_ETIQUETA,
  type EstadoConciliacion,
  type EstadoMensualidad,
  type EstadoVerificacion,
} from "@/lib/constantes";
import { Insignia, type ColorInsignia } from "./basicos";

const COLOR_MENSUALIDAD: Record<EstadoMensualidad, ColorInsignia> = {
  pendiente: "amarillo",
  parcial: "naranja",
  pagada: "verde",
  condonada: "morado",
  no_recuperable: "rojo",
  anulada: "gris",
};

export function EstadoMensualidadInsignia({ estado, vencida }: { estado: EstadoMensualidad; vencida?: boolean }) {
  if (vencida && (estado === "pendiente" || estado === "parcial")) {
    return <Insignia color="rojo">{estado === "parcial" ? "Parcial vencida" : "Vencida"}</Insignia>;
  }
  return <Insignia color={COLOR_MENSUALIDAD[estado]}>{ESTADO_MENSUALIDAD_ETIQUETA[estado]}</Insignia>;
}

/** Estado combinado del pago: 🟢 pagado y conciliado / 🟡 por conciliar / por verificar. */
export function EstadoPagoInsignia({
  verificacion,
  conciliacion,
  anulado,
}: {
  verificacion: EstadoVerificacion;
  conciliacion: EstadoConciliacion;
  anulado?: boolean;
}) {
  if (anulado) return <Insignia color="gris">Anulado</Insignia>;
  if (verificacion === "rechazado") return <Insignia color="rojo">Rechazado</Insignia>;
  if (verificacion === "por_verificar") {
    return (
      <span className="inline-flex flex-wrap gap-1">
        <Insignia color="naranja">Por verificar</Insignia>
        {conciliacion !== "por_conciliar" && <Insignia color="azul">{ESTADO_CONCILIACION_ETIQUETA[conciliacion]}</Insignia>}
      </span>
    );
  }
  if (conciliacion === "conciliado") return <Insignia color="verde">● Pagado y conciliado</Insignia>;
  if (conciliacion === "parcial") return <Insignia color="amarillo">● Conciliado parcial</Insignia>;
  return <Insignia color="amarillo">● {ESTADO_VERIFICACION_ETIQUETA.verificado} · por conciliar</Insignia>;
}
