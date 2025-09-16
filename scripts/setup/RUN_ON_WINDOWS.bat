@echo off
echo ================================================
echo   ACCENTURE MAINFRAME AI ASSISTANT
echo   Enterprise Knowledge Base Solution
echo ================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/3] Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

echo [2/3] Starting application...
echo.
echo ================================================
echo   Application will open in a new window
echo
echo   If Electron doesn't work, open this file
echo   in your browser:
echo
echo   src\mainframe-knowledge-base.html
echo ================================================
echo.

:: Try to run Electron
echo Starting Electron application...
call npm start 2>nul

:: If Electron fails, open HTML directly
if %errorlevel% neq 0 (
    echo.
    echo Electron failed. Opening web version...
    start "" "%~dp0src\mainframe-knowledge-base.html"
)

echo.
echo Press any key to exit...
pause >nul