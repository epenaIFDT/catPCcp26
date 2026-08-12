# Levanta el servidor estatico local del catalogo VASTEC (publico + panel
# admin), accesible desde cualquier equipo de la red local (no solo esta
# PC), y abre el navegador solo. Puerto 8123 esta en un rango excluido de
# Windows (ver admin-local/RESUMEN-PROYECTO.md seccion 8) -- se usa 3000 por
# defecto.
#
# IMPORTANTE: este script es un .ps1, requiere PowerShell (no funciona desde
# el Simbolo del sistema / cmd.exe). Si al ejecutarlo ves un error como
# "no se reconoce como un comando interno o externo", estas en cmd.exe --
# abri PowerShell (buscalo en el menu de inicio) y volve a intentar, o usa
# el archivo iniciar_servidor_local.bat de esta misma carpeta (funciona
# desde cualquiera de los dos).
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

# Filtra loopback y adaptadores virtuales (VMware/VirtualBox/Hyper-V/WSL/
# Tailscale/VPN/Bluetooth) que no son alcanzables por otros equipos de la
# red local fisica -- solo interesa el/los adaptador(es) Wi-Fi/Ethernet
# real(es). VirtualBox/VMware suelen aparecer con nombre generico ("Ethernet
# N"), asi que el filtro cruza tambien la descripcion real del adaptador
# (Get-NetAdapter), no solo su alias.
function Get-LanIPs {
    $adaptadoresVirtuales = Get-NetAdapter -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceDescription -match 'Virtual|VMware|VirtualBox|Hyper-V|Tailscale|TAP|Bluetooth|Loopback' } |
        Select-Object -ExpandProperty Name

    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notmatch '^127\.' -and
            $_.IPAddress -notmatch '^169\.254\.' -and
            $_.InterfaceAlias -notmatch 'Loopback|Virtual|vEthernet|VMware|VirtualBox|Hyper-V|Tailscale|WSL|Default Switch|Bluetooth|Nat' -and
            $_.InterfaceAlias -notin $adaptadoresVirtuales
        } |
        Select-Object -ExpandProperty IPAddress -Unique
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

$lanIPs = @(Get-LanIPs)

Write-Host "Catalogo publico: $url" -ForegroundColor Cyan
Write-Host "Panel admin:      ${url}admin-local/" -ForegroundColor Cyan

if ($lanIPs.Count -gt 0) {
    Write-Host "`nAccesible desde otros equipos de tu red local en:" -ForegroundColor Cyan
    foreach ($ip in $lanIPs) {
        Write-Host "  http://${ip}:$Puerto/" -ForegroundColor Green
    }
    Write-Host "(Compartir SOLO la URL del catalogo publico arriba -- el panel admin no deberia" -ForegroundColor DarkGray
    Write-Host " compartirse fuera de tu propio uso.)" -ForegroundColor DarkGray
    Write-Host "`nSi otro equipo no logra conectarse, puede que el Firewall de Windows este" -ForegroundColor Yellow
    Write-Host "bloqueando la conexion entrante. Para permitirlo (una sola vez, PowerShell" -ForegroundColor Yellow
    Write-Host "como Administrador):" -ForegroundColor Yellow
    Write-Host "  New-NetFirewallRule -DisplayName 'VASTEC Catalogo Local' -Direction Inbound -Protocol TCP -LocalPort $Puerto -Action Allow" -ForegroundColor DarkGray
} else {
    Write-Host "`nNo se detecto una IP de red local (solo localhost) -- si esta PC no tiene" -ForegroundColor Yellow
    Write-Host "Wi-Fi/Ethernet conectado, otros equipos no podran acceder por ahora." -ForegroundColor Yellow
}

Write-Host "`nCtrl+C para detener el servidor.`n"

# Abre el navegador un instante despues de arrancar, sin bloquear el
# servidor (que se queda corriendo en primer plano hasta Ctrl+C, como de costumbre).
Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 1; Start-Process $u } -ArgumentList $url | Out-Null

Set-Location $proyecto
# --bind 0.0.0.0 explicito: escucha en todas las interfaces de red (no solo
# localhost) para que equipos de la red local puedan conectarse.
& $python -m http.server $Puerto --bind 0.0.0.0
