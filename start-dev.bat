@echo off
setlocal

cd /d "%~dp0"

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting client...
  start "Client" cmd /k "cd /d ""%~dp0client"" && set ""NODE_PATH=%~dp0client\node_modules"" && npm run dev"
) else (
  echo Client is already running on port 3000. Skipping.
)

netstat -ano | findstr /R /C:":4000 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting server...
  start "Server" cmd /k "cd /d ""%~dp0server"" && npm run start:dev"
) else (
  echo Server is already running on port 4000. Skipping.
)

echo.
echo Development services checked.
exit /b
