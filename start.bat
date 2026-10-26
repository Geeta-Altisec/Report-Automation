@echo off
echo Starting AltiSec Report Automation Platform on localhost:8000...
cd /d "%~dp0"
start http://localhost:8000
node server.js
pause
