@echo off
schtasks /End /TN "Taprint Print Agent" >nul 2>nul
schtasks /Delete /TN "Taprint Print Agent" /F
taskkill /F /FI "WINDOWTITLE eq Taprint*" >nul 2>nul
echo Removed. If a print agent is still running, end "node.exe" in Task Manager.
pause
