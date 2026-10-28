@echo off
setlocal
cd /d "%~dp0"
node "scripts\openclass-start.mjs" %*
set "OPENCLASS_EXIT=%ERRORLEVEL%"
if not "%OPENCLASS_EXIT%"=="0" pause
exit /b %OPENCLASS_EXIT%
