<#
  REYES GESTIÓN — Respaldo de la base de datos (pg_dump, formato comprimido).

  Uso:
    pnpm db:respaldo          → base de desarrollo (.env.local)
    pnpm oficial:respaldo     → base OFICIAL (.env.oficial)

  Genera respaldos\<entorno>_AAAA-MM-DD_HHMM.dump y conserva los últimos 30 de cada entorno.
  Programado: Programador de tareas de Windows → acción:
    powershell -ExecutionPolicy Bypass -File "C:\ruta\al\proyecto\scripts\db\respaldo.ps1" -Archivo .env.oficial

  Restaurar (en una base vacía):
    pg_restore --no-owner --no-privileges -d "URI_DE_LA_BASE" archivo.dump
#>
param(
  [string]$Archivo = ".env.local",
  [int]$Conservar = 30
)
$ErrorActionPreference = "Stop"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envFile = Join-Path $raiz $Archivo
if (-not (Test-Path $envFile)) { throw "No existe $Archivo" }

# Lee las variables del archivo (con soporte para ${VARIABLE})
$vars = @{}
foreach ($l in Get-Content $envFile) {
  if ($l -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { $vars[$Matches[1]] = $Matches[2].Trim().Trim('"') }
}
$url = $vars["DATABASE_URL"]
if (-not $url) { throw "DATABASE_URL no está en $Archivo" }
$url = [regex]::Replace($url, '\$\{([A-Za-z_][A-Za-z0-9_]*)\}', { param($m) $vars[$m.Groups[1].Value] })
if ($url -match 'PEGAR_|\[YOUR-PASSWORD\]') { throw "DATABASE_URL de $Archivo todavía no tiene la contraseña real." }
$entorno = if ($vars["APP_ENTORNO"]) { $vars["APP_ENTORNO"] } else { "desarrollo" }

# pg_dump más nuevo disponible (sirve para respaldar servidores de versiones iguales o anteriores)
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
  $pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.FullName -replace '.*PostgreSQL\\(\d+)\\.*', '$1') } -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $pgDump) { throw "No se encontró pg_dump.exe (viene con la instalación de PostgreSQL)." }

$carpeta = Join-Path $raiz "respaldos"
New-Item -ItemType Directory -Force $carpeta | Out-Null
$destino = Join-Path $carpeta ("{0}_{1}.dump" -f $entorno, (Get-Date -Format "yyyy-MM-dd_HHmm"))

Write-Host "Respaldando base '$entorno'..."
& $pgDump --dbname=$url --format=custom --no-owner --no-privileges --schema=public --schema=drizzle --file=$destino
if ($LASTEXITCODE -ne 0) { throw "pg_dump terminó con error" }
Write-Host "Respaldo creado: $destino" -ForegroundColor Green

Get-ChildItem $carpeta -Filter "$($entorno)_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Conservar | Remove-Item
$archivos = if ($vars["STORAGE_DIR"]) { $vars["STORAGE_DIR"] } else { "./storage" }
Write-Host "Nota: los archivos subidos están en '$archivos' (respáldala también)."
