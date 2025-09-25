@echo off
echo ============================================================
echo    Accenture Mainframe AI Assistant - Electron Desktop
echo ============================================================
echo.

REM Kill existing processes
echo Cleaning up existing processes...
taskkill /F /IM python.exe 2>nul

REM Start backend
echo Starting backend server...
start /B python scripts\real-db-server.py

REM Wait for backend
timeout /t 2 /nobreak >nul

REM Check backend
curl -s http://localhost:3001/api/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Backend failed to start!
    pause
    exit /b 1
)

echo Backend running on port 3001
echo.
echo Starting Electron Desktop App...
echo The application will open in a new window.
echo Close the window to stop all services.
echo.

REM Run Electron with npx
npx electron@latest main.js

REM Cleanup on exit
echo.
echo Stopping services...
taskkill /F /IM python.exe 2>nul
echo All services stopped
pause