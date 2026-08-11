@echo off
setlocal

cd /d "%~dp0"

echo Starting client...
start "Client" cmd /k "cd /d ""%~dp0client"" && npm run dev"

echo Starting server...
start "Server" cmd /k "cd /d ""%~dp0server"" && npm run start:dev"

echo.
echo Client and server started in separate terminals.
exit /b
