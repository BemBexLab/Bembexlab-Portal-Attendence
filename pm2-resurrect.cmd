@echo off
set "PM2_HOME=%~dp0.pm2"
call "%APPDATA%\npm\pm2.cmd" resurrect
