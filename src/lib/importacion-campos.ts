import type { DestinoImportacion } from "./constantes";
import { normalizarTexto } from "./texto";

/**
 * Campos del sistema que se pueden cargar por importación, con los nombres de columna
 * habituales (sinónimos) para proponer el mapeo automáticamente.
 * Para reconocer una columna nueva basta con agregar su nombre a `sinonimos`.
 */
export type CampoImportacion = { clave: string; etiqueta: string; sinonimos: string[]; obligatorio?: boolean };

export const CAMPOS_IMPORTACION: Record<DestinoImportacion, CampoImportacion[]> = {
  alumnos: [
    {
      clave: "alumno_nombre_completo",
      etiqueta: "Nombre del alumno (completo)",
      sinonimos: ["nombre", "alumno", "nombre alumno", "nombre del alumno", "estudiante", "nombre completo", "pasajero"],
      obligatorio: true,
    },
    { clave: "alumno_nombres", etiqueta: "Nombres del alumno", sinonimos: ["nombres", "nombres alumno"] },
    { clave: "alumno_apellidos", etiqueta: "Apellidos del alumno", sinonimos: ["apellidos", "apellido", "apellidos alumno"] },
    { clave: "alumno_rut", etiqueta: "RUT del alumno", sinonimos: ["rut", "rut alumno", "run", "rut del alumno", "rut estudiante"] },
    { clave: "direccion", etiqueta: "Domicilio", sinonimos: ["direccion", "domicilio", "dir", "direccion alumno", "lugar de retiro", "retiro"] },
    { clave: "comuna", etiqueta: "Comuna", sinonimos: ["comuna", "ciudad", "sector"] },
    { clave: "establecimiento", etiqueta: "Colegio / establecimiento", sinonimos: ["colegio", "establecimiento", "escuela", "liceo"] },
    { clave: "curso", etiqueta: "Curso", sinonimos: ["curso", "nivel", "grado"] },
    { clave: "bus", etiqueta: "Bus asignado", sinonimos: ["bus", "n bus", "no bus", "numero bus", "micro", "furgon", "vehiculo", "maquina"] },
    { clave: "servicio", etiqueta: "Servicio", sinonimos: ["servicio", "recorrido", "ruta", "jornada", "tipo servicio"] },
    {
      clave: "tarifa",
      etiqueta: "Tarifa mensual",
      sinonimos: ["valor", "tarifa", "mensualidad", "monto", "precio", "valor mensual", "cuota", "arancel"],
    },
    { clave: "dia_vencimiento", etiqueta: "Día de vencimiento", sinonimos: ["dia vencimiento", "vencimiento", "dia pago", "dia de pago"] },
    {
      clave: "apoderado_nombre",
      etiqueta: "Apoderado (nombre completo)",
      sinonimos: ["apoderado", "nombre apoderado", "apoderado titular", "madre", "padre", "tutor", "responsable"],
    },
    { clave: "apoderado_rut", etiqueta: "RUT del apoderado", sinonimos: ["rut apoderado", "rut del apoderado", "rut madre", "rut padre"] },
    {
      clave: "apoderado_telefono",
      etiqueta: "Teléfono del apoderado",
      sinonimos: ["telefono", "fono", "celular", "whatsapp", "telefono apoderado", "contacto", "movil"],
    },
    { clave: "apoderado_email", etiqueta: "Correo del apoderado", sinonimos: ["email", "correo", "mail", "correo electronico", "e mail"] },
    { clave: "apoderado_parentesco", etiqueta: "Parentesco", sinonimos: ["parentesco", "relacion"] },
    { clave: "observaciones", etiqueta: "Observaciones", sinonimos: ["observaciones", "obs", "notas", "comentarios", "nota"] },
  ],
  pagos: [
    { clave: "fecha_pago", etiqueta: "Fecha de pago", sinonimos: ["fecha", "fecha pago", "fecha de pago", "fecha transferencia", "fecha operacion", "fecha movimiento"], obligatorio: true },
    { clave: "monto", etiqueta: "Monto", sinonimos: ["monto", "valor", "abono", "importe", "abonos", "monto abono", "deposito", "total", "pago"], obligatorio: true },
    {
      clave: "nombre_origen",
      etiqueta: "Nombre de quien paga",
      sinonimos: ["nombre", "nombre origen", "titular", "ordenante", "remitente", "de", "origen", "nombre destinatario", "pagador", "apoderado"],
    },
    { clave: "rut_origen", etiqueta: "RUT de quien paga", sinonimos: ["rut", "rut origen", "rut ordenante", "rut remitente"] },
    { clave: "banco", etiqueta: "Banco", sinonimos: ["banco", "banco origen", "institucion"] },
    {
      clave: "numero_operacion",
      etiqueta: "N° de operación",
      sinonimos: ["n operacion", "numero operacion", "operacion", "n documento", "documento", "comprobante", "folio", "codigo", "id transaccion", "n transaccion"],
    },
    { clave: "medio", etiqueta: "Medio de pago", sinonimos: ["medio", "forma de pago", "medio de pago", "tipo"] },
    { clave: "descripcion", etiqueta: "Descripción / glosa", sinonimos: ["descripcion", "glosa", "detalle", "concepto", "comentario"] },
    { clave: "alumno_nombre", etiqueta: "Alumno (si se indica)", sinonimos: ["alumno", "estudiante", "nombre alumno"] },
    { clave: "periodo", etiqueta: "Mes que paga", sinonimos: ["mes", "periodo", "mes pagado", "mes que paga"] },
    { clave: "observaciones", etiqueta: "Observaciones", sinonimos: ["observaciones", "obs", "notas"] },
  ],
};

/** Propone el mapeo columna → campo comparando con los sinónimos (cada campo se usa una vez). */
export function proponerMapeo(columnas: string[], destino: DestinoImportacion): Record<string, string | null> {
  const campos = CAMPOS_IMPORTACION[destino];
  const usados = new Set<string>();
  const mapeo: Record<string, string | null> = {};
  const norm = (s: string) => normalizarTexto(s).replace(/[°º#.:]/g, "").replace(/\s+/g, " ").trim();

  // 1ª pasada: coincidencia exacta; 2ª pasada: la columna contiene el sinónimo
  for (const pasada of [1, 2]) {
    for (const col of columnas) {
      if (mapeo[col]) continue;
      const c = norm(col);
      for (const campo of campos) {
        if (usados.has(campo.clave)) continue;
        const coincide = campo.sinonimos.some((s) => (pasada === 1 ? c === s : c.includes(s) && s.length >= 4));
        if (coincide) {
          mapeo[col] = campo.clave;
          usados.add(campo.clave);
          break;
        }
      }
    }
  }
  for (const col of columnas) if (!(col in mapeo)) mapeo[col] = null;
  return mapeo;
}

export function etiquetaCampo(destino: DestinoImportacion, clave: string): string {
  return CAMPOS_IMPORTACION[destino].find((c) => c.clave === clave)?.etiqueta ?? clave;
}
