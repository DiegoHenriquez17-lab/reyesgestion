@AGENTS.md

# Reyes Gestión — guía para trabajar en este repositorio

- Idioma del dominio y de la UI: **español (Chile)**. Nombres de tablas, servicios y componentes en español.
- Lee `docs/01-vision-y-principios.md` antes de cambiar lógica de negocio. Reglas no negociables: la IA no inventa datos, nada se guarda sin validación humana, todo cambio se audita, sin valores fijos en el código (configuración en tabla `configuracion` o `.env.local`).
- Toda escritura en la base pasa por un servicio de `src/server/modulos` dentro de una transacción y llama a `auditar()`. Las Server Actions usan `ejecutarAccion()` (`src/server/acciones.ts`).
- Actualizaciones parciales: usar `parsearParcial()` (evita que los valores por defecto de Zod sobrescriban datos).
- Cambios que afectan un mes cerrado: `exigirMotivoSiCerrado()`.
- Alertas nuevas: agregar la regla en `src/server/alertas/reglas-por-defecto.ts` y su generador en `generadores.ts`.
- Montos en CLP como enteros; fechas como texto `AAAA-MM-DD`.
- Antes de terminar: `pnpm typecheck` y `pnpm lint` sin errores.
- Esquema: editar `src/server/db/schema/`, luego `pnpm db:generar` y `pnpm db:migrar`.
- Dos bases: desarrollo (Docker, `.env.local`) y **oficial** (Supabase, `.env.oficial`, comandos `pnpm oficial:*`). Nunca cargar datos de prueba en la oficial. Ver `docs/07-base-oficial.md`.
- Toda tabla nueva en `public` debe tener RLS activado (lo asegura `scripts/db/asegurar-rls.ts` tras `db:migrar` / `oficial:migrar`). Después de cambiar el esquema oficial, revisar los avisos de seguridad de Supabase.
- Migraciones SQL portables: no asumir el esquema de las extensiones (en Supabase están en `extensions`, en Docker en `public`).
