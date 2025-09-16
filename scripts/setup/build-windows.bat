@echo off
echo.
echo ===============================================
echo  Accenture Mainframe AI Assistant Builder
echo ===============================================
echo.

echo [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+ first.
    pause
    exit /b 1
)
echo ✅ Node.js found

echo.
echo [2/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [3/5] Generating icons...
call npm run build:icons
if %errorlevel% neq 0 (
    echo ❌ Failed to generate icons
    pause
    exit /b 1
)

echo.
echo [4/5] Testing build configuration...
call node scripts/test-build.js
if %errorlevel% neq 0 (
    echo ❌ Build validation failed
    pause
    exit /b 1
)

echo.
echo [5/5] Building Windows installer...
call npm run dist:win
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo.
echo 🎉 Build completed successfully!
echo 📦 Check the dist-packages/ folder for your installer
echo.
pause
