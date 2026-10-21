@echo off
rem Runs the agent forever without a window (started by Windows at sign-in). Output goes to agent.log.
cd /d "%~dp0"
:loop
node agent.mjs > agent.log 2>&1
timeout /t 5 /nobreak >nul
goto loop
