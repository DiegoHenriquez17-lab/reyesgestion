# 4. Instalación local paso a paso (Windows)

## Requisitos

| Programa | Versión | Comprobar |
|---|---|---|
| Node.js | 24 o superior | `node -v` |
| pnpm | 9 o superior | `pnpm -v` (si falta: `npm install -g pnpm`) |
| Docker Desktop | reciente | abrir Docker Desktop y esperar a que diga *Engine running* |

## 1. Variables de entorno

Si no existe `.env.local`, copia la plantilla y completa los valores:

```bash
copy .env.example .env.local
```

Valores importantes:

- `DB_PASSWORD`: contraseña de la base de desarrollo (inventa una larga).
- `DB_PORT=5433`: puerto del PostgreSQL de Docker (no choca con un PostgreSQL instalado en Windows, que usa 5432).
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`: primer administrador que crea `pnpm db:seed` (mínimo 10 caracteres con letras y números). Si los dejas vacíos, el sistema te pedirá crear el administrador en `/primer-usuario` la primera vez.
- `ANTHROPIC_API_KEY`: clave para la lectura con IA (ver paso 6). Opcional.

## 2. Instalar dependencias

```bash
pnpm install
```

## 3. Base de datos (Docker)

Con Docker Desktop abierto:

```bash
pnpm db:docker
```

Esto crea el contenedor `reyes-gestion-db` (PostgreSQL 18, UTF-8, orden alfabético en español). Los datos quedan en el volumen `reyes_pgdata` y sobreviven a reinicios. Para detenerlo: `pnpm db:docker:parar`.

### Alternativa: PostgreSQL instalado en Windows

1. En `.env.local` cambia `DB_PORT=5432`.
2. Ejecuta (te pedirá la contraseña del usuario `postgres` que pusiste al instalar):

```bash
pnpm db:crear-nativa
```

## 4. Crear las tablas y los datos iniciales

```bash
pnpm db:migrar
```

```bash
pnpm db:seed
```

Opcional, para practicar con datos ficticios (24 alumnos, pagos y alertas):

```bash
pnpm db:demo
```

## 5. Levantar el sistema

```bash
pnpm dev
```

Abrir <http://localhost:3000> e ingresar con el administrador de `.env.local`.

**Desde el celular** (misma red Wi-Fi): abre la dirección *Network* que muestra `pnpm dev` (ej. `http://192.168.1.5:3000`).

## 6. Activar la lectura con IA (fotos, PDF, Word)

1. Crea una cuenta en <https://console.anthropic.com> y genera una API key.
2. Pégala en `.env.local` → `ANTHROPIC_API_KEY=...`
3. Reinicia `pnpm dev`.

Sin clave, todo funciona igual excepto la lectura de fotos, PDF y Word sin tablas (Excel y carga manual siguen disponibles).

## 7. Empezar con datos reales (borrar los de prueba)

⚠ Esto **borra toda la base de desarrollo**:

```bash
docker compose --env-file .env.local down -v
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

## 8. Respaldos

```bash
pnpm db:respaldo
```

Crea `respaldos\reyes_gestion_AAAA-MM-DD_HHMM.dump` (conserva los últimos 30). Respaldar también la carpeta `storage\` (archivos subidos). Se puede programar con el *Programador de tareas* de Windows.

## 9. Alertas automáticas diarias (opcional)

Las alertas se recalculan solas al usar el sistema. Para tenerlas al día aunque nadie entre, programa en el *Programador de tareas*:

```bash
pnpm alertas
```

## Problemas frecuentes

| Problema | Solución |
|---|---|
| `Configuración inválida en .env.local` | Falta una variable obligatoria; compara con `.env.example`. |
| `ECONNREFUSED ...:5433` | Docker Desktop no está abierto o el contenedor está detenido → `pnpm db:docker`. |
| Excel `.xls` antiguo no se lee | Abrirlo en Excel y guardarlo como `.xlsx`. |
| Foto HEIC del iPhone no se lee | Enviarla como JPG (en iPhone: Ajustes → Cámara → Formatos → Más compatible). |
