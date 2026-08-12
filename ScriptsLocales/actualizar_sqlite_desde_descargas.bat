@echo off
REM Funciona tanto desde el Simbolo del sistema (cmd.exe) como haciendo
REM doble clic en el Explorador. Internamente llama al script real de
REM PowerShell (actualizar_sqlite_desde_descargas.ps1) en esta misma carpeta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizar_sqlite_desde_descargas.ps1"
pause
