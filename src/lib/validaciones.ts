import { z } from "zod";
import { ESTADOS_ALUMNO, MEDIOS_PAGO, TIPOS_SERVICIO } from "./constantes";
import { esFechaIso } from "./fechas";
import { parsearMonto } from "./formato";
import { normalizarRut, rutEsValido } from "./rut";

/** Texto opcional: "" → null, con recorte de espacios. */
const textoOpcional = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const idOpcional = z
  .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
  .optional()
  .transform((v) =>
  typeof v === "number" ? v : null,
);

const monto = z
  .union([z.string(), z.number()])
  .transform((v, c) => {
    const n = parsearMonto(v);
    if (n === null || n < 0) {
      c.addIssue({ code: "custom", message: "Monto inválido" });
      return z.NEVER;
    }
    return n;
  });

const fecha = z.string().refine(esFechaIso, "Fecha inválida (use AAAA-MM-DD)");
const fechaOpcional = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || esFechaIso(v), "Fecha inválida");

export const rutOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v, c) => {
    if (!v) return null;
    if (!rutEsValido(v)) {
      c.addIssue({ code: "custom", message: "RUT inválido (revisa el dígito verificador)" });
      return z.NEVER;
    }
    return normalizarRut(v);
  });

export const esquemaPersona = z.object({
  nombres: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  apellidos: z.string().trim().max(120).default(""),
  rut: rutOpcional,
  telefono: textoOpcional,
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Correo inválido"),
  direccion: textoOpcional,
  comuna: textoOpcional,
  observaciones: textoOpcional,
});
export type DatosPersona = z.infer<typeof esquemaPersona>;

export const esquemaAlumno = z.object({
  establecimiento: textoOpcional,
  curso: textoOpcional,
  busId: idOpcional,
  servicioId: idOpcional,
  tarifaMensual: monto,
  diaVencimiento: z
    .union([z.coerce.number().int().min(1).max(31), z.literal(""), z.null()])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null)),
  fechaIngreso: fechaOpcional,
  fechaRetiro: fechaOpcional,
  estado: z.enum(ESTADOS_ALUMNO).default("activo"),
  observaciones: textoOpcional,
});
export type DatosAlumno = z.infer<typeof esquemaAlumno>;

export const esquemaResponsable = z.object({
  esApoderado: z.boolean().default(true),
  esTitular: z.boolean().default(false),
  esPagador: z.boolean().default(false),
  parentesco: textoOpcional,
});
export type DatosResponsable = z.infer<typeof esquemaResponsable>;

export const esquemaPago = z.object({
  fechaPago: fecha,
  monto: monto.refine((n) => n > 0, "El monto debe ser mayor a cero"),
  medio: z.enum(MEDIOS_PAGO).default("transferencia"),
  banco: textoOpcional,
  numeroOperacion: textoOpcional,
  nombreOrigen: textoOpcional,
  rutOrigen: rutOpcional,
  pagadorId: idOpcional,
  alumnoId: idOpcional,
  verificado: z.boolean().default(true),
  observaciones: textoOpcional,
});
export type DatosPago = z.infer<typeof esquemaPago>;

export const esquemaBus = z.object({
  numero: z.string().trim().min(1, "Indica el número del bus").max(20),
  patente: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase().replace(/[^A-Z0-9]/g, "") : null)),
  descripcion: textoOpcional,
  capacidad: z
    .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null)),
  activo: z.boolean().default(true),
  observaciones: textoOpcional,
});

export const esquemaServicio = z.object({
  nombre: z.string().trim().min(1, "Indica el nombre").max(120),
  tipo: z.enum(TIPOS_SERVICIO).default("escolar"),
  descripcion: textoOpcional,
  tarifaReferencia: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : parsearMonto(v))),
  activo: z.boolean().default(true),
});

/** Convierte FormData en objeto plano (checkbox "on" → true). */
export function formDataAObjeto(fd: FormData, booleanos: string[] = []): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") obj[k] = v;
  for (const b of booleanos) obj[b] = fd.get(b) === "on" || fd.get(b) === "true";
  return obj;
}

/** Errores de Zod agrupados por campo (para mostrarlos en el formulario). */
export function erroresPorCampo(error: z.ZodError): Record<string, string[]> {
  const salida: Record<string, string[]> = {};
  for (const i of error.issues) {
    const k = i.path.join(".") || "_";
    (salida[k] ??= []).push(i.message);
  }
  return salida;
}

/**
 * Valida una actualización PARCIAL devolviendo solo los campos que venían en la entrada.
 * Evita que los valores por defecto del esquema sobrescriban datos existentes.
 */
export function parsearParcial<S extends z.ZodObject>(esquema: S, entrada: unknown): Partial<z.infer<S>> {
  const datos = esquema.partial().parse(entrada) as Record<string, unknown>;
  const presentes = new Set(Object.keys((entrada ?? {}) as object));
  return Object.fromEntries(Object.entries(datos).filter(([k]) => presentes.has(k))) as Partial<z.infer<S>>;
}
