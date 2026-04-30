@echo off
REM Бот на этом ПК, API и Redis на сервере (при необходимости поменяй IP).
setlocal
cd /d "%~dp0\.."
set "API_URL=http://62.181.53.36:8000"
set "REDIS_URL=redis://62.181.53.36:6379/0"
echo API_URL=%API_URL%
echo REDIS_URL=%REDIS_URL%
echo.
python -m bot.main
if errorlevel 1 pause
endlocal
