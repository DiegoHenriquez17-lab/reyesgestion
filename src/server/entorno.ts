import { z } from "zod";

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
  APP_TIMEZONE: z.string().default("America/Santiago"),
  SESSION_DIAS: z.coerce.number().int().positive().default(30),
  STORAGE_DIR: z.string().default("./storage"),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(20),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().default("claude-opus-5-5"),
  AI_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  const detalle = resultado.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Configuración inválida en .env.local:\n${detalle}`);
}

export const entorno = resultado.data;
export const iaHabilitada = () => entorno.ANTHROPIC_API_KEY.trim().length > 0;
