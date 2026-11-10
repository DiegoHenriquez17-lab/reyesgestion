# 7. Base de datos oficial (Supabase)

## Decisión

| | |
|---|---|
| Proveedor | **Supabase** (PostgreSQL administrado) |
| Proyecto | `reyes-gestion` en la organización personal de Diego (DiegoHenriquez17-lab's Org) |
| Región | **São Paulo (sa-east-1)**, la más cercana a Chile |
| Motor | PostgreSQL 17 (el mismo código y las mismas migraciones que la base local) |
| Plan | Gratis mientras se configura. **Pasar a Pro (US$25/mes) antes de usarla a diario con datos reales**: respaldos automáticos diarios (7 días) y el proyecto nunca se pausa. |

Por qué Supabase: es PostgreSQL estándar (no nos amarra: se puede mover a cualquier servidor con `pg_dump`), queda lista para cualquier hosting (Vercel, VPS, Docker), tiene respaldos administrados, panel web para revisar datos y ya la usas en otros proyectos.

## Dos bases, nunca mezcladas

| | Desarrollo / pruebas | Oficial |
|---|---|---|
| Dónde | Docker en tu PC (puerto 5433) | Supabase (São Paulo) |
| Datos | Ficticios (`pnpm db:demo`) | **Reales** |
| Configuración | `.env.local` | `.env.oficial` (+ lo común de `.env.local`) |
| Sistema | `pnpm dev` → http://localhost:3000 | `pnpm oficial:app` → http://localhost:3001 |
| Distintivo en pantalla | **PRUEBAS** (amarillo) | **BASE OFICIAL** (verde) |
| Archivos subidos | `storage/` | `storage-oficial/` |

Protecciones: los datos de demostración se niegan a cargarse en la base oficial; el seed oficial no crea el usuario de prueba; las cookies de sesión son distintas en cada entorno.

## Comandos de la base oficial

| Comando | Qué hace |
|---|---|
| `pnpm oficial:migrar` | Aplica migraciones pendientes y asegura RLS en todas las tablas |
| `pnpm oficial:seed` | Configuración y reglas de alerta iniciales (no toca lo ya editado) |
| `pnpm oficial:app` | Abre el sistema conectado a la base oficial (puerto 3001) |
| `pnpm oficial:respaldo` | Respaldo `pg_dump` en `respaldos\oficial_AAAA-MM-DD_HHMM.dump` |
| `pnpm oficial:alertas` | Recalcula alertas de la base oficial |

## Conexión

`.env.oficial` → `DATABASE_URL` = URI del **Session pooler** de Supabase (botón *Connect* del proyecto), con la contraseña y `?sslmode=require` al final. El Session pooler funciona en redes solo IPv4 (como la mayoría de los hogares en Chile).

Cuando la app vaya a un hosting **serverless** (por ejemplo Vercel), usar el **Transaction pooler** (puerto 6543) y `DATABASE_PREPARE=false`. En un servidor tradicional (VPS / Docker) se mantiene el Session pooler o la conexión directa.

La contraseña se define al crear el proyecto. Si se olvida o se filtra: en el proyecto, menú izquierdo **Database → Settings → Reset database password**, y actualizar `.env.oficial` (y el hosting).

## Seguridad aplicada

- **RLS activado en todas las tablas** (migración `0002_seguridad_rls` + `scripts/db/asegurar-rls.ts` después de cada migración). La app se conecta como dueña de las tablas y no se ve afectada; la API REST/GraphQL automática de Supabase no puede leer ni escribir datos.
- Extensiones de búsqueda (`pg_trgm`, `unaccent`) en el esquema `extensions`, como recomienda Supabase.
- Función `f_unaccent` con `search_path` fijo.
- La contraseña de la base vive solo en `.env.oficial` (fuera de git) y, más adelante, en las variables secretas del hosting.
- Recomendado (opcional): en Supabase → *Project Settings → Data API* desactivar la Data API, porque la app no la usa.

## Respaldos

- Plan gratis: **no hay respaldos automáticos** → ejecutar `pnpm oficial:respaldo` al menos una vez al día (se puede programar en el *Programador de tareas* de Windows) y guardar copias fuera del PC.
- Plan Pro: respaldos automáticos diarios (7 días) restaurables desde el panel. Seguir haciendo un respaldo propio semanal fuera de Supabase.

## Al pasar a hosting

1. Crear el proyecto en el hosting elegido y copiar las variables de `.env.oficial` + las comunes de `.env.local` (sin `SEED_ADMIN_*` ni `DB_*`).
2. `pnpm oficial:migrar` antes de cada despliegue que cambie el esquema.
3. Mover los archivos de `storage-oficial/` a un almacenamiento en la nube (Supabase Storage o S3/R2: solo cambia `src/server/almacenamiento.ts`).
