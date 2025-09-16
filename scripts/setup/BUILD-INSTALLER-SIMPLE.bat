@echo off
echo ===============================================
echo   ACCENTURE MAINFRAME AI ASSISTANT
echo   Building Windows Installer
echo ===============================================
echo.

:: Create output directory
echo Creating output directory...
if not exist "dist-installer" mkdir dist-installer

:: Check for electron-builder
echo Checking for electron-builder...
npx electron-builder --version >nul 2>&1
if errorlevel 1 (
    echo Installing electron-builder...
    npm install --save-dev electron-builder
)

:: Build the Windows installer
echo.
echo Building Windows installer...
echo This may take 5-10 minutes...
echo.

:: Try to build with electron-builder
npx electron-builder --win --config electron-builder.yml --publish never

:: Check if build was successful
if exist "dist\*.exe" (
    echo.
    echo ===============================================
    echo   BUILD SUCCESSFUL!
    echo.
    echo   Installer created in: dist\
    echo ===============================================

    :: Copy to dist-installer for consistency
    if not exist "dist-installer" mkdir dist-installer
    copy /Y "dist\*.exe" "dist-installer\"

    echo.
    echo   Also copied to: dist-installer\
    echo ===============================================
) else (
    echo.
    echo ===============================================
    echo   BUILD FAILED!
    echo.
    echo   Trying alternative method...
    echo ===============================================

    :: Alternative: Create portable package
    call :CreatePortablePackage
)

echo.
pause
exit /b

:CreatePortablePackage
echo.
echo Creating portable package instead...
echo.

:: Create portable folder structure
if not exist "dist-installer\Accenture-Mainframe-AI-Portable" mkdir "dist-installer\Accenture-Mainframe-AI-Portable"

:: Copy necessary files
echo Copying application files...
xcopy /E /I /Y "src" "dist-installer\Accenture-Mainframe-AI-Portable\src"
copy /Y "package.json" "dist-installer\Accenture-Mainframe-AI-Portable\"
copy /Y "ABRIR_APLICACAO.bat" "dist-installer\Accenture-Mainframe-AI-Portable\"

:: Create a launcher batch file
echo @echo off > "dist-installer\Accenture-Mainframe-AI-Portable\START.bat"
echo echo Starting Accenture Mainframe AI Assistant... >> "dist-installer\Accenture-Mainframe-AI-Portable\START.bat"
echo start "" "%~dp0src\mainframe-knowledge-base.html" >> "dist-installer\Accenture-Mainframe-AI-Portable\START.bat"

echo.
echo ===============================================
echo   PORTABLE PACKAGE CREATED!
echo.
echo   Location: dist-installer\Accenture-Mainframe-AI-Portable\
echo
echo   To run: Execute START.bat in that folder
echo ===============================================

exit /b