# Mueve el archivo .sqlite recien descargado (boton "Descargar .sqlite" del
# panel admin) desde Descargas hacia admin-local/data/vastec-admin.sqlite,
# reemplazando el archivo real. Correrlo despues de cada sesion de trabajo
# en el panel para que el archivo en disco quede al dia con lo que se
# guardo en el navegador (IndexedDB) durante esa sesion -- ver
# admin-local/RESUMEN-PROYECTO.md seccion 5: el archivo en disco y lo que
# usa el panel (IndexedDB del navegador) NO son la misma cosa.
#
# IMPORTANTE: este script es un .ps1, requiere PowerShell (no funciona desde
# el Simbolo del sistema / cmd.exe). Si al ejecutarlo ves un error como
# "no se reconoce como un comando interno o externo", estas en cmd.exe --
# abri PowerShell (buscalo en el menu de inicio) y volve a intentar, o usa
# el archivo actualizar_sqlite_desde_descargas.bat de esta misma carpeta
# (funciona desde cualquiera de los dos).
#
# Uso:
#   cd F:\proyectos\FichasNew
#   .\ScriptsLocales\actualizar_sqlite_desde_descargas.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$proyecto = Split-Path -Parent $scriptDir
$downloads = [Environment]::GetFolderPath('UserProfile') + '\Downloads'
$destino = "$proyecto\admin-local\data\vastec-admin.sqlite"

$archivo = Get-ChildItem -Path $downloads -Filter "vastec-admin*.sqlite" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($null -eq $archivo) {
    Write-Host "NO ENCONTRADO: vastec-admin*.sqlite en $downloads" -ForegroundColor Red
    Write-Host "Primero apreta el boton '💾 Descargar .sqlite' en el panel admin (arriba de todo, junto al titulo)." -ForegroundColor Yellow
    exit 1
}

# Respaldo del archivo anterior por las dudas (se sobreescribe en cada
# corrida, no acumula historial - es solo para poder deshacer la ultima
# sincronizacion si algo salio mal).
if (Test-Path $destino) {
    Copy-Item $destino "$destino.bak" -Force
    Write-Host "Respaldo del archivo anterior: vastec-admin.sqlite.bak"
}

Copy-Item $archivo.FullName $destino -Force
Write-Host "OK: $($archivo.Name) ($([math]::Round($archivo.Length / 1KB)) KB) -> $destino" -ForegroundColor Green

Write-Host "`n--- Verificando tablas y filas ---"
& python "$scriptDir\verificar_sqlite.py" $destino

Write-Host "`nListo. admin-local/data/vastec-admin.sqlite actualizado con lo ultimo guardado en el navegador." -ForegroundColor Cyan
Write-Host "(Este archivo esta en admin-local/, gitignored -- no hace falta ningun git push por esto.)"
