# Ejecutador de exportar_productos.py — exporta la tabla "productos" de
# admin-local/data/vastec-admin.sqlite a ScriptsLocales/Data/productos_completo.csv
#
# Uso:
#   cd F:\proyectos\FichasNew
#   .\ScriptsLocales\exportar_productos.ps1
#
# (Si PowerShell bloquea el script por politica de ejecucion:
#   powershell -ExecutionPolicy Bypass -File ScriptsLocales\exportar_productos.ps1 )

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyScript = Join-Path $scriptDir "exportar_productos.py"

function Get-PythonCommand {
    foreach ($candidato in @("python", "py")) {
        $cmd = Get-Command $candidato -ErrorAction SilentlyContinue
        if ($cmd) { return $candidato }
    }
    return $null
}

$python = Get-PythonCommand
if (-not $python) {
    Write-Host "ERROR: no se encontro Python instalado (ni 'python' ni 'py')." -ForegroundColor Red
    Write-Host "Instalalo desde https://www.python.org/downloads/ (marca 'Add python.exe to PATH' durante la instalacion) y volve a correr este script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Exportando tabla de productos a CSV..." -ForegroundColor Cyan
& $python $pyScript
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "Listo." -ForegroundColor Green
} else {
    Write-Host "La exportacion termino con errores (ver arriba)." -ForegroundColor Red
}
exit $exitCode
