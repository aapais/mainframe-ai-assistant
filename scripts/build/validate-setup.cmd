@echo off
:: Quick validation script for Windows installer build setup

echo.
echo ===============================================================
echo  Accenture Mainframe AI Assistant - Setup Validator
echo ===============================================================
echo.

echo 🔍 Checking build setup...
echo.

node scripts/validate-build-setup.js

if errorlevel 1 (
    echo.
    echo ❌ Build setup has issues. Please fix them before building.
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ✅ Build setup is ready!
    echo.
    echo You can now run:
    echo   • build-installer.cmd
    echo   • .\build-windows-installer.ps1
    echo   • npm run build:complete
    echo.
)

pause