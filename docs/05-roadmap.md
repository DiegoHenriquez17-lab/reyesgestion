# 5. Hoja de ruta

## Versión 1 — Cobranza escolar ✅ (construida, en pruebas locales)

Alumnos · apoderados · pagadores · mensualidades · pagos (manual, voucher con IA, cartola Excel) · conciliación asistida · buscador · informes PDF/Excel · alertas configurables · recordatorios · cierre de mes · auditoría · usuarios y permisos · importación Excel/Word/PDF/foto con validación.

### Pendientes / mejoras sugeridas para cerrar V1

- [ ] Probar con planillas y vouchers reales de la empresa y ajustar los sinónimos de columnas (`src/lib/importacion-campos.ts`).
- [ ] Activar `ANTHROPIC_API_KEY` y probar fotos de planillas, vouchers y PDF reales.
- [ ] Registro de devoluciones desde la ficha del alumno (la tabla y las alertas ya existen).
- [ ] Generación automática de mensualidades el día 1 de cada mes (tarea programada).
- [ ] Exportar a Excel el listado de alumnos y la ficha de estado de cuenta por alumno/apoderado.
- [ ] Preguntas en lenguaje natural en el buscador ("¿quiénes deben agosto?", "¿cuánto recaudamos en agosto?") usando IA sobre consultas predefinidas.
- [x] Base de datos oficial creada en Supabase (São Paulo) con migraciones y seguridad RLS → [docs/07-base-oficial.md](07-base-oficial.md).
- [ ] Pasar el proyecto Supabase a plan Pro antes del uso diario con datos reales (respaldos automáticos).
- [ ] Cambiar la contraseña de la base oficial (quedó visible en una captura): Supabase → Database → Settings → Reset database password, y actualizar solo `.env.oficial`.
- [ ] Hosting de la aplicación: elegir proveedor, dominio, HTTPS (ver más abajo).

## Versión 2 — Flota: buses, conductores, documentos y mantenciones

Nuevas tablas previstas (se relacionan con lo existente):

- `conductores` (rol de `personas`): licencia, clase, vencimiento.
- `documentos_control`: documento con vencimiento de un bus o conductor (revisión técnica, SOAP, permiso de circulación, seguro, MTT, licencia, certificados, capacitaciones). Fecha de emisión, vencimiento y archivo adjunto (la IA lee la foto y propone las fechas).
- `planes_mantencion` y `mantenciones`: por kilometraje o fecha (aceite, neumáticos, frenos, correas, batería…), con costo por bus.
- `lecturas_kilometraje`.

Alertas nuevas (solo se agrega un generador por regla, el motor ya existe): revisión técnica / SOAP / permiso / seguro / MTT por vencer y vencidos; licencias y certificados de conductores; mantención por km ("Bus 17: próxima mantención en 1.000 km") o por fecha.

Informes: documentos vencidos y por vencer, gastos de mantención, costos por bus, conductores.

## Versión 3 — Servicios, cotizaciones y contratos

- `cotizaciones` → `servicios_realizados` (viajes especiales y turismo): cliente, fecha, bus y conductor asignados, documentación.
- `contratos`: partes, vigencia, montos, archivo; alertas a 30 / 7 días y vencido.
- Generación de documentos (cotización y contrato en PDF/Word desde plantillas).
- Recordatorios: servicio próximo, cotización pendiente, conductor/bus sin asignar.

## Versión 4 — Conciliación bancaria avanzada e IA

- Importación de cartolas por banco con formatos guardados.
- Evaluar API bancaria (o agregadores) para traer movimientos automáticamente.
- Conciliación automática de alta confianza (siempre con revisión de lo dudoso).
- Asistente de preguntas: "¿cuánto genera cada bus?", "¿qué bus necesita mantención?", "¿qué servicios tenemos esta semana?".

## Hosting (cuando terminemos las pruebas locales)

Opciones a evaluar: VPS con Docker (control total, costo bajo), o Vercel/Netlify + PostgreSQL administrado (Supabase, Neon, RDS). Requisitos: HTTPS, respaldos diarios automáticos fuera del servidor, almacenamiento de archivos (S3/R2 — solo hay que cambiar `src/server/almacenamiento.ts`) y variables de entorno de producción.
