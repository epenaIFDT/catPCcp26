@echo off
REM Funciona tanto desde el Simbolo del sistema (cmd.exe) como haciendo
REM doble clic en el Explorador. Internamente llama al script real de
REM PowerShell (iniciar_servidor_local.ps1) en esta misma carpeta.
REM
REM Uso:
REM   iniciar_servidor_local.bat
REM   iniciar_servidor_local.bat 8080
if "%~1"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar_servidor_local.ps1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar_servidor_local.ps1" -Puerto %~1
)
