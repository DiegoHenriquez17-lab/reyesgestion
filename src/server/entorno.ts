import { z } from "zod";
import { PROVEEDORES_IA, RESPALDO_IA } from "@/lib/proveedores-ia";

/**
 * Variables de entorno validadas al iniciar. Si falta algo obligatorio,
 * la aplicación falla con un mensaje claro en vez de comportarse de forma extraña.
 */
const esquema = z.object({
  /** "desarrollo" (base de prueba en Docker) u "oficial" (base real en Supabase). Se muestra en la pantalla. */
  APP_ENTORNO: z.enum(["desarrollo", "oficial"]).default("desarrollo"),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL debe ser una URL postgres:// válida")
    .refine((u) => !u.includes("[YOUR-PASSWORD]") && !u.includes("PEGAR_"), "DATABASE_URL todavía tiene el texto de ejemplo: pega la contraseña real"),
  /** false si se usa un pooler en modo transacción (puerto 6543), que no admite sentencias preparadas. */
  DATABASE_PREPARE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  /** Conexiones simultáneas que abre la aplicación (bajar en planes pequeños de Supabase). */
  DATABASE_MAX_CONEXIONES: z.coerce.number().int().positive().default(10),
  DATABASE_IDLE_TIMEOUT_SEGUNDOS: z.coerce.number().int().positive().default(30),
  APP_TIMEZONE: z.string().default("America/Santiago"),
  SESSION_DIAS: z.coerce.number().int().positive().default(30),
  STORAGE_DIR: z.string().default("./storage"),
  STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
  SUPABASE_URL: z.url({ protocol: /^https$/ }).optional(),
  SUPABASE_STORAGE_KEY: z.string().trim().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).default("reyes-documentos"),
  REGISTRO_INICIAL_WEB: z.enum(["true", "false"]).optional().transform((v) => v ? v === "true" : process.env.NODE_ENV !== "production"),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(20),
  ANTHROPIC_API_KEY: z.string().trim().default(""),
  OPENAI_API_KEY: z.string().trim().default(""),
  GEMINI_API_KEY: z.string().trim().default(""),
  GROQ_API_KEY: z.string().trim().default(""),
  AI_PROVEEDOR_PRINCIPAL: z.enum(PROVEEDORES_IA).default("anthropic"),
  AI_MODEL: z.string().default("claude-opus-5-5"),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GROQ_MODEL: z.string().default("qwen/qwen3.8-27b"),
  AI_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
}).refine((v) => v.STORAGE_DRIVER !== "supabase" || (v.SUPABASE_URL && v.SUPABASE_STORAGE_KEY), {
  path: ["STORAGE_DRIVER"], message: "Supabase Storage requiere SUPABASE_URL y SUPABASE_STORAGE_KEY",
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  const detalle = resultado.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Configuración inválida en .env.local:\n${detalle}`);
}

export const entorno = resultado.data;
export const clavesIa = {
  anthropic: entorno.ANTHROPIC_API_KEY, openai: entorno.OPENAI_API_KEY,
  gemini: entorno.GEMINI_API_KEY, groq: entorno.GROQ_API_KEY,
};
export const ordenIa = [entorno.AI_PROVEEDOR_PRINCIPAL, RESPALDO_IA[entorno.AI_PROVEEDOR_PRINCIPAL]];
export const proveedoresConfigurados = () => ordenIa.filter((proveedor) => Boolean(clavesIa[proveedor]));
export const iaHabilitada = () => proveedoresConfigurados().length > 0;
