import { timestamp } from "drizzle-orm/pg-core";

/** Columnas de trazabilidad comunes a casi todas las tablas. */
export const marcasDeTiempo = {
  creadoEn: timestamp({ withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Eliminación lógica: los registros nunca se borran físicamente desde la UI. */
export const eliminacionLogica = {
  eliminadoEn: timestamp({ withTimezone: true }),
};
