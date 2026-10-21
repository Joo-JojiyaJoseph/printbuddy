@echo off
title Taprint Print Agent
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org, install it, then run this again.
  pause
  exit /b 1
)
if not exist config.json (
  copy config.example.json config.json >nul
  echo A settings file was created: config.json
  echo Open it in Notepad, paste your key and website address, save, then run this again.
  notepad config.json
  pause
  exit /b 0
)
:loop
node agent.mjs %*
echo.
echo The print agent stopped. Restarting in 5 seconds. Close this window to quit.
timeout /t 5 >nul
goto loop
