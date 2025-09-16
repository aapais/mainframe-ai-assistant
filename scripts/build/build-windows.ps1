# Accenture Mainframe AI Assistant Builder (PowerShell)
Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " Accenture Mainframe AI Assistant Builder" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[3/5] Generating icons..." -ForegroundColor Yellow
npm run build:icons
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate icons" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[4/5] Testing build configuration..." -ForegroundColor Yellow
node scripts/test-build.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build validation failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[5/5] Building Windows installer..." -ForegroundColor Yellow
npm run dist:win
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "🎉 Build completed successfully!" -ForegroundColor Green
Write-Host "📦 Check the dist-packages/ folder for your installer" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
