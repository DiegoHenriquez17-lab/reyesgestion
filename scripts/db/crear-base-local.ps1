<#
  REYES GESTIÓN — ALTERNATIVA A DOCKER: crea usuario y base en el PostgreSQL instalado en Windows.

  Qué hace:
    1. Lee DB_USER, DB_PASSWORD, DB_NAME y DB_PORT desde .env.local.
    2. Se conecta a PostgreSQL como superusuario (por defecto "postgres").
       -> psql te pedirá la contraseña del superusuario que definiste al instalar PostgreSQL.
    3. Crea el rol de la aplicación y la base de datos (UTF-8, orden alfabético español).
       Si ya existen, no hace nada (se puede ejecutar varias veces).

  Uso (desde la carpeta del proyecto, en PowerShell):
    powershell -ExecutionPolicy Bypass -File scripts\db\crear-base-local.ps1
#>
param(
  [string]$SuperUsuario = "postgres"
)

$ErrorActionPreference = "Stop"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envFile = Join-Path $raiz ".env.local"

if (-not (Test-Path $envFile)) {
  Write-Host "No existe .env.local. Copia .env.example como .env.local y completa DATABASE_URL." -ForegroundColor Red
  exit 1
}

function LeerVariable($nombre, $porDefecto) {
  $l = Get-Content $envFile | Where-Object { $_ -match "^\s*$nombre\s*=" } | Select-Object -First 1
  if ($l) { return ($l -split '=', 2)[1].Trim().Trim('"') }
  return $porDefecto
}
$appUser = LeerVariable "DB_USER" "reyes_app"
$appPass = LeerVariable "DB_PASSWORD" $null
$appDb = LeerVariable "DB_NAME" "reyes_gestion"
$pgPort = [int](LeerVariable "DB_PORT" "5432")
$pgHost = "localhost"
if (-not $appPass) { Write-Host "DB_PASSWORD no está definido en .env.local" -ForegroundColor Red; exit 1 }
if ($pgPort -ne 5432) {
  Write-Host "Aviso: DB_PORT=$pgPort. Para usar el PostgreSQL instalado en Windows cambia DB_PORT=5432 en .env.local." -ForegroundColor Yellow
}

# Buscar psql (PATH o instalación estándar de Windows)
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
  $psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.FullName -replace '.*PostgreSQL\\(\d+)\\.*', '$1') } -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) { Write-Host "No se encontró psql.exe. ¿Está instalado PostgreSQL?" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "PostgreSQL : $psql"
Write-Host "Servidor   : ${pgHost}:$pgPort"
Write-Host "Base       : $appDb"
Write-Host "Usuario app: $appUser"
Write-Host ""
Write-Host "Ingresa la contraseña del superusuario '$SuperUsuario' de PostgreSQL cuando se solicite." -ForegroundColor Yellow

$sql = @'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_pass')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_pass') \gexec
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE ''es-CL'' LOCALE ''C''', :'app_db', :'app_user')
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'app_db') \gexec
SELECT 'Base de datos lista: ' || :'app_db' AS resultado;
'@

$tmp = New-TemporaryFile
# UTF-8 SIN BOM (psql no acepta el BOM que agrega PowerShell 5.1)
[System.IO.File]::WriteAllText($tmp.FullName, $sql, (New-Object System.Text.UTF8Encoding($false)))
try {
  & $psql -h $pgHost -p $pgPort -U $SuperUsuario -d postgres -v ON_ERROR_STOP=1 `
    -v "app_user=$appUser" -v "app_pass=$appPass" -v "app_db=$appDb" -f $tmp
  if ($LASTEXITCODE -ne 0) { throw "psql terminó con error ($LASTEXITCODE)" }
  Write-Host ""
  Write-Host "Listo. Ahora ejecuta:  pnpm db:migrar  y luego  pnpm db:seed" -ForegroundColor Green
}
finally {
  Remove-Item $tmp -ErrorAction SilentlyContinue
}
