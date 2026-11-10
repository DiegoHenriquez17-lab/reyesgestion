# 2. Arquitectura

## Stack elegido y por qué

| Pieza | Elección | Motivo |
|---|---|---|
| Aplicación | **Next.js 16 + React 19 + TypeScript** | Un solo proyecto para pantallas y servidor (Server Components + Server Actions); rápido, moderno, fácil de alojar después (Vercel, VPS, Docker). |
| Base de datos | **PostgreSQL 18** | Robusta, relacional, transacciones, búsqueda aproximada (`pg_trgm`) y sin tildes (`unaccent`). Estándar en cualquier hosting. |
| Acceso a datos | **Drizzle ORM** + `postgres.js` | Tipado de punta a punta, SQL explícito, migraciones versionadas en `drizzle/`. |
| Validación | **Zod 4** | Las mismas reglas validan formularios, importaciones y respuestas de la IA. |
| Estilos | **Tailwind CSS 4** | Interfaz consistente y adaptable a celular sin hojas de estilo sueltas. |
| IA / OCR | **Claude (Anthropic API)** | Lee fotos, PDF (incluso escaneados) y Word, y devuelve datos estructurados con nivel de confianza. |
| Excel / Word | **ExcelJS**, **mammoth** | Lectura de .xlsx/.csv y de tablas o texto de .docx. |
| Informes | **ExcelJS**, **jsPDF + autotable** | Un mismo informe se ve en pantalla y se exporta a PDF y Excel. |
| Contraseñas | **Argon2id** | Estándar actual para guardar contraseñas. |

Modo de renderizado: la app es 100 % interna y dinámica (todo depende de la sesión), por eso `cacheComponents` está desactivado en `next.config.ts` y cada página se renderiza por solicitud.

## Carpetas

```
sistemareyes/
├── README.md                  ← inicio rápido
├── docs/                      ← esta documentación
├── .env.example               ← plantilla de variables (sin secretos)
├── .env.local                 ← variables reales (NO se sube a git)
├── docker-compose.yml         ← PostgreSQL 18 de desarrollo
├── drizzle.config.ts          ← configuración de migraciones
├── drizzle/                   ← migraciones SQL versionadas
├── scripts/
│   ├── db/seed.ts             ← datos iniciales obligatorios
│   ├── db/demo.ts             ← datos ficticios de prueba
│   ├── db/respaldo.ps1        ← respaldo pg_dump
│   ├── db/crear-base-local.ps1← alternativa: base en PostgreSQL instalado en Windows
│   └── alertas.ts             ← recálculo de alertas (tarea programada)
├── storage/                   ← archivos subidos (vouchers, fotos, PDF) — NO va a git
└── src/
    ├── proxy.ts               ← redirección a /login sin sesión + cabeceras de seguridad
    ├── app/
    │   ├── (auth)/            ← login y primer usuario
    │   ├── (app)/             ← todo lo que requiere sesión (una carpeta por módulo)
    │   │   ├── page.tsx       ← panel principal
    │   │   ├── alumnos/ pagos/ mensualidades/ informes/ importar/
    │   │   ├── alertas/ recordatorios/ cierres/ auditoria/ personas/ buscar/
    │   │   └── configuracion/ (buses, servicios, alertas, usuarios)
    │   └── api/               ← descarga de documentos e informes (con sesión)
    ├── components/            ← componentes visuales reutilizables
    ├── lib/                   ← utilidades compartidas (RUT, fechas, montos, catálogos, validaciones)
    └── server/                ← lógica de negocio (solo servidor)
        ├── db/schema/         ← definición de tablas
        ├── auth/              ← sesiones y contraseñas
        ├── alertas/           ← motor de alertas, reglas y generadores
        ├── importacion/       ← lectores, IA, análisis de duplicados y aplicación
        ├── informes/          ← informes y exportación PDF/Excel
        ├── modulos/           ← servicios: alumnos, personas, pagos, conciliación, mensualidades…
        ├── auditoria.ts       ← registro de auditoría y control de meses cerrados
        ├── configuracion.ts   ← configuración editable (valores por defecto en un solo lugar)
        └── acciones.ts        ← envoltorio estándar de Server Actions
```

## Capas

1. **Pantallas** (`src/app/(app)/…/page.tsx`): consultan datos con los servicios y muestran.
2. **Acciones** (`acciones.ts` de cada módulo): reciben formularios, llaman al servicio vía `ejecutarAccion()` (sesión, permisos, errores legibles, recálculo de alertas y refresco).
3. **Servicios** (`src/server/modulos`): reglas de negocio. Toda modificación ocurre en una transacción y llama a `auditar()`.
4. **Esquema** (`src/server/db/schema`): tablas y relaciones.

Regla: las pantallas nunca escriben en la base directamente; siempre a través de un servicio auditado.

## Flujos clave

- **Importación:** subir archivo → (Excel/CSV/Word con tabla) proponer mapeo de columnas → analizar cada fila (normalizar, detectar duplicados / cambios / errores) → el usuario decide fila por fila o en bloque → guardar solo lo confirmado (cada fila en su propia transacción, con motivo "Importación #N, fila M").
- **Conciliación:** un pago recibido busca coincidencias por pagador registrado, RUT, nombres alternativos aprendidos, nombre del apoderado y apellidos del alumno; muestra razones y meses posibles; el usuario confirma. Al conciliar puede "recordar" el nombre de la transferencia como pagador → la próxima vez la sugerencia es casi segura.
- **Alertas:** `recalcularAlertas()` evalúa las reglas activas, crea/actualiza/resuelve alertas (una por regla + registro). Se ejecuta tras cada cambio, al abrir el sistema (cada N minutos) y con `pnpm alertas`. Una alerta descartada reaparece si empeora (ej. amarilla → roja).

## Seguridad

- Contraseñas con Argon2id; sesiones con token aleatorio guardado como hash (cookie `httpOnly`, `sameSite=lax`, `secure` en producción).
- Bloqueo temporal tras 5 intentos fallidos de ingreso; intentos registrados en auditoría.
- Roles: **Administrador** (todo), **Operador** (registra y modifica; no anula pagos ni configura), **Solo consulta**.
- Documentos servidos solo con sesión (`/api/documentos/[id]`), nunca desde una carpeta pública.
- Server Actions protegidas contra CSRF por Next.js (verificación de origen).
- Respaldos con `pnpm db:respaldo` (programables).
