@echo off
setlocal
cd /d "%~dp0\.."

REM Локальный backend и Redis (перебивают docker-значения из .env при старте Python)
set "API_URL=http://127.0.0.1:8000"
set "REDIS_URL=redis://127.0.0.1:6379/0"

echo API_URL=%API_URL%
echo REDIS_URL=%REDIS_URL%
echo.

python -m bot.main
if errorlevel 1 pause
endlocal
