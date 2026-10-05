@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows-service.ps1"
if errorlevel 1 (
  echo.
  echo La instalacion no se completo. Revisa el mensaje anterior.
  pause
)
