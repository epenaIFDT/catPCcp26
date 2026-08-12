# Levanta el servidor estatico local del catalogo VASTEC (publico + panel
# admin) y abre el navegador solo. Puerto 8123 esta en un rango excluido de
# Windows (ver admin-local/RESUMEN-PROYECTO.md seccion 8) -- se usa 3000 por
# defecto.
#
# Uso:
#   cd F:\proyectos\FichasNew
#   .\ScriptsLocales\iniciar_servidor_local.ps1
#   .\ScriptsLocales\iniciar_servidor_local.ps1 -Puerto 8080

param(
    [int]$Puerto = 3000
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$proyecto = Split-Path -Parent $scriptDir
$url = "http://localhost:$Puerto/"

function Get-PythonCommand {
    foreach ($candidato in @("python", "py")) {
        if (Get-Command $candidato -ErrorAction SilentlyContinue) { return $candidato }
    }
    return $null
}

$python = Get-PythonCommand
if (-not $python) {
    Write-Host "ERROR: no se encontro Python instalado (ni 'python' ni 'py')." -ForegroundColor Red
    Write-Host "Instalalo desde https://www.python.org/downloads/ (marca 'Add python.exe to PATH' durante la instalacion) y volve a correr este script." -ForegroundColor Yellow
    exit 1
}

# Si ya hay algo escuchando en ese puerto (server de una sesion anterior
# que quedo corriendo), no intentar levantar otro -- solo abrir el navegador.
$enUso = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue
if ($enUso) {
    Write-Host "Ya hay un servidor escuchando en el puerto $Puerto -- abriendo el navegador nomas." -ForegroundColor Yellow
    Start-Process $url
    exit 0
}

Write-Host "Catalogo publico: $url" -ForegroundColor Cyan
Write-Host "Panel admin:      ${url}admin-local/" -ForegroundColor Cyan
Write-Host "`nCtrl+C para detener el servidor.`n"

# Abre el navegador un instante despues de arrancar, sin bloquear el
# servidor (que se queda corriendo en primer plano hasta Ctrl+C, como de costumbre).
Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 1; Start-Process $u } -ArgumentList $url | Out-Null

Set-Location $proyecto
& $python -m http.server $Puerto
