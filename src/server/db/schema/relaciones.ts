import { relations } from "drizzle-orm";
import { alumnoResponsables, alumnos } from "./alumnos";
import { mensualidades, pagoAplicaciones, pagos } from "./cobranza";
import { documentos } from "./documentos";
import { buses, servicios } from "./flota";
import { personaAlias, personas } from "./personas";

export const personasRel = relations(personas, ({ many }) => ({
  alumnos: many(alumnos),
  responsabilidades: many(alumnoResponsables),
  alias: many(personaAlias),
}));

export const personaAliasRel = relations(personaAlias, ({ one }) => ({
  persona: one(personas, { fields: [personaAlias.personaId], references: [personas.id] }),
}));

export const alumnosRel = relations(alumnos, ({ one, many }) => ({
  persona: one(personas, { fields: [alumnos.personaId], references: [personas.id] }),
  bus: one(buses, { fields: [alumnos.busId], references: [buses.id] }),
  servicio: one(servicios, { fields: [alumnos.servicioId], references: [servicios.id] }),
  responsables: many(alumnoResponsables),
  mensualidades: many(mensualidades),
}));

export const alumnoResponsablesRel = relations(alumnoResponsables, ({ one }) => ({
  alumno: one(alumnos, { fields: [alumnoResponsables.alumnoId], references: [alumnos.id] }),
  persona: one(personas, { fields: [alumnoResponsables.personaId], references: [personas.id] }),
}));

export const mensualidadesRel = relations(mensualidades, ({ one, many }) => ({
  alumno: one(alumnos, { fields: [mensualidades.alumnoId], references: [alumnos.id] }),
  aplicaciones: many(pagoAplicaciones),
}));

export const pagosRel = relations(pagos, ({ one, many }) => ({
  alumno: one(alumnos, { fields: [pagos.alumnoId], references: [alumnos.id] }),
  pagador: one(personas, { fields: [pagos.pagadorId], references: [personas.id] }),
  documento: one(documentos, { fields: [pagos.documentoId], references: [documentos.id] }),
  aplicaciones: many(pagoAplicaciones),
}));

export const pagoAplicacionesRel = relations(pagoAplicaciones, ({ one }) => ({
  pago: one(pagos, { fields: [pagoAplicaciones.pagoId], references: [pagos.id] }),
  mensualidad: one(mensualidades, { fields: [pagoAplicaciones.mensualidadId], references: [mensualidades.id] }),
}));

export const busesRel = relations(buses, ({ many }) => ({ alumnos: many(alumnos) }));
export const serviciosRel = relations(servicios, ({ many }) => ({ alumnos: many(alumnos) }));
