@echo off
echo ============================================
echo  Complete Dependency Fix Script for Windows
echo ============================================
echo.

echo [Step 1] Cleaning environment...
rd /s /q node_modules 2>nul
del package-lock.json 2>nul
call npm cache clean --force

echo.
echo [Step 2] Installing core dependencies...
call npm install --save zod uuid axios express @types/uuid @types/express @types/node @types/react @types/react-dom

echo.
echo [Step 3] Installing Electron dependencies...
call npm install --save-dev electron electron-builder @electron/rebuild

echo.
echo [Step 4] Installing build tools...
call npm install --save-dev typescript vite @vitejs/plugin-react concurrently

echo.
echo [Step 5] Installing additional dependencies...
call npm install --save react react-dom react-router-dom sqlite3 better-sqlite3

echo.
echo [Step 6] Rebuilding native modules...
call npm rebuild

echo.
echo [Step 7] Rebuilding better-sqlite3...
if exist "node_modules\better-sqlite3" (
    cd node_modules\better-sqlite3
    call npm run build-release
    cd ..\..
)

echo.
echo [Step 8] Running electron-rebuild...
call npx electron-rebuild

echo.
echo [Step 9] Fixing vulnerabilities...
call npm audit fix

echo.
echo [Step 10] Verifying installation...
call npm ls --depth=0

echo.
echo [Step 11] Testing build...
call npm run build:main
call npm run build:renderer

echo.
echo ============================================
echo  Dependency Fix Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Run 'npm run build' to test the complete build
echo 2. Run 'npm run typecheck' to check for TypeScript errors
echo 3. Run 'npm test' to run tests
echo.
pause