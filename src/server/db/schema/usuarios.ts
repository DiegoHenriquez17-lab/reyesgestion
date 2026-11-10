import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { ROLES } from "@/lib/constantes";
import { marcasDeTiempo } from "./_comun";

export const usuarios = pgTable(
  "usuarios",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    nombre: text().notNull(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    rol: text({ enum: ROLES }).notNull().default("operador"),
    activo: boolean().notNull().default(true),
    ultimoAcceso: timestamp({ withTimezone: true }),
    ...marcasDeTiempo,
  },
  (t) => [uniqueIndex("usuarios_email_uq").on(sql`lower(${t.email})`)],
);

/** Sesiones activas. Se guarda solo el hash SHA-256 del token (nunca el token). */
export const sesiones = pgTable(
  "sesiones",
  {
    id: text().primaryKey(),
    usuarioId: integer()
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    expiraEn: timestamp({ withTimezone: true }).notNull(),
    ip: text(),
    userAgent: text(),
    creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sesiones_usuario_idx").on(t.usuarioId)],
);
