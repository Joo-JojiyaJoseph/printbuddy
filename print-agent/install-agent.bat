@echo off
title Install Taprint Print Agent
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org first, then run this again.
  pause & exit /b 1
)
if not exist config.json (
  copy config.example.json config.json >nul
  echo Fill in config.json with the server, key and printer, save it, then run this installer again.
  notepad config.json
  pause & exit /b 0
)
echo Checking the printer with a test page...
node agent.mjs --test
if errorlevel 1 (
  echo.
  echo The test page did not print, so nothing was installed. Fix config.json, then run this again.
  pause & exit /b 1
)
schtasks /Create /TN "Taprint Print Agent" /TR "wscript.exe \"%~dp0start-hidden.vbs\"" /SC ONLOGON /F >nul
if errorlevel 1 (
  echo Could not create the start-up task. Right-click this file and choose "Run as administrator", then try again.
  pause & exit /b 1
)
schtasks /Run /TN "Taprint Print Agent" >nul
echo.
echo Done. The Taprint print agent now starts by itself whenever this PC signs in, with no window.
echo Check the admin panel: this shop's kiosk should show "printing ready" within a few seconds.
echo Problems? Open agent.log in this folder.
pause
