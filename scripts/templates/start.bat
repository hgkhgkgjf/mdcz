@echo off
setlocal

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

if "%MDCZ_WEB_DIST_DIR%"=="" set "MDCZ_WEB_DIST_DIR=%DIR%\web"
if "%PORT%"=="" set "PORT=3838"
if "%MDCZ_HOST%"=="" set "MDCZ_HOST=127.0.0.1"

cd /d "%DIR%"
node "%DIR%\server.js" %*
endlocal
