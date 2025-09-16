@echo off
:: Accenture Mainframe AI Assistant - Simple Windows Build Script
:: This batch file provides a simple interface to build the Windows installer

setlocal EnableDelayedExpansion

echo.
echo ===============================================================
echo  Accenture Mainframe AI Assistant - Windows Installer Builder
echo ===============================================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not available
    echo Please ensure Node.js is properly installed
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are available
echo.

:: Install dependencies
echo 📦 Installing dependencies...
npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed
echo.

:: Create icons
echo 🎨 Creating application icons...
npm run build:icons
if errorlevel 1 (
    echo ERROR: Failed to create icons
    pause
    exit /b 1
)

echo ✅ Icons created
echo.

:: Build the Electron package and installer
echo 🔨 Building Windows installer...
npx electron-builder --win --x64 --config electron-builder.yml
if errorlevel 1 (
    echo ERROR: Failed to build installer
    pause
    exit /b 1
)

echo.
echo ===============================================================
echo 🎉 BUILD SUCCESSFUL!
echo ===============================================================
echo.

:: Check if installer was created
if exist "dist-installer\Accenture-Mainframe-AI-Setup.exe" (
    echo ✅ Windows installer created successfully!
    echo 📦 Location: dist-installer\Accenture-Mainframe-AI-Setup.exe
    echo.
    echo You can now distribute this installer to Windows machines.
    echo The installer will create desktop shortcuts and Start Menu entries.
    echo.
) else (
    echo ❌ Warning: Installer file not found in expected location
    echo Please check the dist-installer directory
    echo.
)

echo Build completed at %date% %time%
echo.

:: Ask if user wants to open the output directory
set /p "opendir=Open output directory? (y/n): "
if /i "!opendir!"=="y" (
    if exist "dist-installer" (
        explorer "dist-installer"
    ) else (
        echo Output directory not found
    )
)

echo.
echo Press any key to exit...
pause >nul