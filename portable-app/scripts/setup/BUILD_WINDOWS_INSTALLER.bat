@echo off
echo ============================================
echo   ACCENTURE MAINFRAME AI ASSISTANT
echo   Building Windows Installer Package
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install from: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Installing dependencies...
call npm install --production

echo [2/5] Installing Electron locally...
call npm install electron --save-dev

echo [3/5] Installing electron-packager...
call npm install electron-packager --save-dev

echo [4/5] Creating Windows executable...
echo Building for Windows x64...
call npx electron-packager . "Accenture-Mainframe-AI" --platform=win32 --arch=x64 --out=dist --overwrite --icon=build/icon.ico --app-version=1.0.0 --win32metadata.CompanyName="Accenture" --win32metadata.ProductName="Mainframe AI Assistant" --win32metadata.FileDescription="Enterprise Mainframe Knowledge Base"

echo [5/5] Package created successfully!
echo.
echo ============================================
echo   BUILD COMPLETE!
echo
echo   Your application is ready at:
echo   dist\Accenture-Mainframe-AI-win32-x64\
echo
echo   Run the .exe file to start the application
echo ============================================
echo.
pause