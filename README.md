# Reyes Gestión

Sistema administrativo integral para **Transportes y Turismo Reyes**.

> *Ingresar la información una sola vez y poder encontrarla y relacionarla desde cualquier módulo.*

Una sola base de datos centralizada, alertas en todos los módulos, carga de datos desde Excel / Word / PDF / fotografías (con IA) y **validación humana obligatoria** antes de guardar: *IMPORTAR → ANALIZAR → MOSTRAR → VALIDAR → GUARDAR*.

---

## Estado actual: Versión 1 (desarrollo local)

| Módulo | Estado |
|---|---|
| Alumnos, apoderados y pagadores (ficha única por persona, sin duplicados) | ✅ |
| Mensualidades (generación mensual, condonar, no recuperable, cambio de monto con motivo) | ✅ |
| Pagos: manual, voucher (foto/PDF con IA), cartola Excel | ✅ |
| Dinero recibido ≠ pago conciliado · conciliación asistida con sugerencias | ✅ |
| Importación Excel / CSV / Word / PDF / foto con mapeo, duplicados y "cambio detectado" | ✅ |
| Buscador global (sin tildes, tolera errores de tipeo, RUT, teléfono, monto, N° operación) | ✅ |
| Motor de alertas configurable (amarilla / naranja / roja) + recordatorios | ✅ |
| Informes en pantalla, PDF y Excel (recaudación mensual con subtotales por bus, morosidad, etc.) | ✅ |
| Cierre de mes con fotografía de totales | ✅ |
| Auditoría: quién — cuándo — qué cambió — por qué | ✅ |
| Usuarios, roles y permisos | ✅ |

Próximas versiones (buses, conductores, mantenciones, contratos, conciliación bancaria avanzada): ver [docs/05-roadmap.md](docs/05-roadmap.md).

---

## Bases de datos

- **Pruebas / desarrollo**: PostgreSQL 18 en Docker (`pnpm dev`, distintivo amarillo *PRUEBAS*).
- **Oficial**: Supabase, São Paulo (`pnpm oficial:app`, distintivo verde *BASE OFICIAL*). Detalle en [docs/07-base-oficial.md](docs/07-base-oficial.md).

## Inicio rápido (Windows)

Requisitos: **Node.js 24**, **pnpm**, **Docker Desktop**. Detalle completo en [docs/04-instalacion-local.md](docs/04-instalacion-local.md).

```bash
pnpm install
```

```bash
pnpm db:docker
```

```bash
pnpm db:migrar
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

Abrir <http://localhost:3000>. El usuario administrador de desarrollo está en `.env.local` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). **Cámbialo antes de usar datos reales.**

Datos ficticios para probar (opcional):

```bash
pnpm db:demo
```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta el sistema en modo desarrollo (http://localhost:3000) |
| `pnpm db:docker` / `pnpm db:docker:parar` | Inicia / detiene PostgreSQL 18 en Docker (puerto 5433) |
| `pnpm db:migrar` | Aplica las migraciones pendientes a la base de datos |
| `pnpm db:generar` | Genera una nueva migración después de cambiar el esquema |
| `pnpm db:seed` | Datos iniciales obligatorios (configuración, reglas de alerta, admin) |
| `pnpm db:demo` | Datos ficticios de demostración (solo si no hay alumnos) |
| `pnpm db:studio` | Explorador visual de la base de datos (Drizzle Studio) |
| `pnpm db:respaldo` | Respaldo de la base con `pg_dump` en `respaldos/` |
| `pnpm alertas` | Recalcula todas las alertas (para tarea programada diaria) |
| `pnpm typecheck` · `pnpm lint` | Verificación de tipos y estilo |
| `pnpm oficial:app` · `oficial:migrar` · `oficial:seed` · `oficial:respaldo` | Lo mismo, contra la **base oficial** (Supabase). Ver [docs/07-base-oficial.md](docs/07-base-oficial.md) |

---

## Tecnología

**Next.js 16** (React 19, TypeScript) · **PostgreSQL 18** · **Drizzle ORM** · **Tailwind CSS 4** · **Zod** · **Claude (Anthropic)** para lectura de documentos · ExcelJS · jsPDF · Argon2.

Por qué este stack y cómo está organizado: [docs/02-arquitectura.md](docs/02-arquitectura.md).

## Documentación

1. [Visión y principios](docs/01-vision-y-principios.md)
2. [Arquitectura y carpetas](docs/02-arquitectura.md)
3. [Base de datos](docs/03-base-de-datos.md)
4. [Instalación local paso a paso](docs/04-instalacion-local.md)
5. [Hoja de ruta (versiones 1 a 4)](docs/05-roadmap.md)
6. [IA y carga de datos](docs/06-ia-y-carga-de-datos.md)
7. [Base de datos oficial (Supabase)](docs/07-base-oficial.md)
