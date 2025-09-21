#!/usr/bin/env node

/**
 * Deployment Instructions Generator for Accenture Mainframe AI Assistant
 * Creates comprehensive deployment guide and validates setup
 */

const fs = require('fs');
const path = require('path');

function generateDeploymentInstructions() {
  console.log('📋 Generating deployment instructions for Accenture Mainframe AI Assistant...\n');

  const instructions = `# Accenture Mainframe AI Assistant - Windows Deployment Guide

## 🎯 Overview
This guide provides step-by-step instructions to build and deploy the Accenture Mainframe AI Assistant Windows installer.

## 📋 Prerequisites

### System Requirements
- **Operating System**: Windows 10 or later (64-bit)
- **Node.js**: Version 18.0.0 or later
- **NPM**: Version 9.0.0 or later
- **Git**: Latest version
- **Visual Studio Build Tools**: Required for native modules

### Installation Steps
1. **Install Node.js**: Download from https://nodejs.org/
2. **Install Git**: Download from https://git-scm.com/
3. **Install Visual Studio Build Tools**:
   \`\`\`cmd
   npm install --global windows-build-tools
   \`\`\`

## 🚀 Build Process

### Step 1: Clone and Setup
\`\`\`cmd
git clone <repository-url>
cd mainframe-ai-assistant
npm install
\`\`\`

### Step 2: Generate Icons
\`\`\`cmd
npm run build:icons
\`\`\`

### Step 3: Test Configuration
\`\`\`cmd
node scripts/test-build.js
\`\`\`

### Step 4: Build Windows Installer
\`\`\`cmd
npm run dist:win
\`\`\`

### Step 5: Build Portable Version (Optional)
\`\`\`cmd
npm run pack
\`\`\`

## 📦 Build Outputs

After successful build, you'll find the following files in \`dist-packages/\`:

### Windows Installer
- **\`Accenture Mainframe AI Assistant-1.0.0-Setup.exe\`** - Full installer (NSIS)
- **\`Accenture Mainframe AI Assistant-1.0.0-ia32-Setup.exe\`** - 32-bit installer
- **\`Accenture Mainframe AI Assistant-1.0.0-x64-Setup.exe\`** - 64-bit installer

### Portable Version
- **\`Accenture Mainframe AI Assistant-1.0.0-Portable.exe\`** - Portable executable

### Additional Files
- **\`latest.yml\`** - Auto-updater metadata
- **\`checksums.json\`** - File integrity verification
- **\`verification.json\`** - Build verification data

## 🎨 Installer Features

### NSIS Installer Capabilities
- ✅ **Custom Installation Directory**: Users can choose install location
- ✅ **Desktop Shortcut**: Automatic desktop shortcut creation
- ✅ **Start Menu Integration**: Accenture folder in Start Menu
- ✅ **Uninstaller**: Complete removal with data cleanup
- ✅ **File Associations**: .mainframe files open with the app
- ✅ **Registry Integration**: Proper Windows integration
- ✅ **No Admin Required**: User-level installation

### Branding Elements
- 🎨 **Accenture Purple Theme**: Custom gradient branding
- 🏢 **Corporate Identity**: Professional installer appearance
- 📄 **License Agreement**: Accenture software license
- 🔧 **Custom Icons**: Accenture-themed application icons

## 🔧 Troubleshooting

### Common Build Issues

#### Issue: "electron-builder not found"
**Solution**:
\`\`\`cmd
npm install --save-dev electron-builder@latest
npm run dist:win
\`\`\`

#### Issue: "Missing icon files"
**Solution**:
\`\`\`cmd
npm run build:icons
npm run dist:win
\`\`\`

#### Issue: "NSIS error"
**Solution**:
1. Ensure Windows build tools are installed
2. Run as Administrator if needed
3. Check antivirus software isn't blocking

#### Issue: "Node-gyp build errors"
**Solution**:
\`\`\`cmd
npm install --global node-gyp
npm config set msvs_version 2019
npm rebuild
\`\`\`

### Build Environment Issues

#### WSL/Linux Build Notes
- Electron GUI apps may not run in WSL
- Use Windows native environment for testing
- Cross-platform builds work from Linux

#### Memory Issues
- Increase Node.js heap size if needed:
  \`\`\`cmd
  set NODE_OPTIONS="--max-old-space-size=4096"
  npm run dist:win
  \`\`\`

## 📊 Validation Checklist

### Pre-Build Validation
- [ ] All source files present
- [ ] Icons generated successfully
- [ ] Package.json configuration correct
- [ ] Dependencies installed
- [ ] License file exists
- [ ] NSIS script configured

### Post-Build Validation
- [ ] Installer executes without errors
- [ ] Application launches correctly
- [ ] Desktop shortcut created
- [ ] Start menu entries present
- [ ] Uninstaller works properly
- [ ] File associations registered

### Testing Checklist
- [ ] Install on clean Windows machine
- [ ] Test all application features
- [ ] Verify branding appears correctly
- [ ] Test uninstall process
- [ ] Check for leftover files/registry entries

## 🚀 Deployment Options

### Internal Distribution
1. **Network Share**: Place installer on company network
2. **Software Center**: Deploy via SCCM/Intune
3. **Email Distribution**: Send installer to users
4. **USB Distribution**: Copy to portable media

### Professional Deployment
1. **Code Signing**: Sign executable for Windows trust
2. **MSI Packaging**: Convert to MSI for enterprise deployment
3. **Group Policy**: Deploy via Active Directory
4. **Auto-Updates**: Configure update server

## 🔐 Security Considerations

### Code Signing (Production)
\`\`\`cmd
# Sign the executable with company certificate
signtool sign /f "AcuentureCert.p12" /p "password" "setup.exe"
\`\`\`

### Antivirus Whitelisting
- Submit to major antivirus vendors
- Request whitelisting for corporate deployment
- Test with company antivirus software

## 📈 Monitoring & Analytics

### Installation Tracking
- Monitor deployment success rates
- Track user adoption metrics
- Collect crash reports and feedback

### Performance Monitoring
- Application startup times
- Memory usage patterns
- Feature usage analytics

## 🆘 Support Information

### End User Support
- **Help Documentation**: Built into application
- **Support Portal**: https://www.accenture.com/mainframe-ai-assistant/support
- **Issue Reporting**: Built-in feedback system

### Technical Support
- **Build Issues**: Check GitHub Issues
- **Deployment Questions**: Contact IT Support
- **Feature Requests**: Product team backlog

## 📞 Contact Information

**Development Team**: AI Development Team
**Support Email**: support@accenture.com
**Documentation**: https://www.accenture.com/mainframe-ai-assistant
**Version**: 1.0.0
**Last Updated**: ${new Date().toISOString().split('T')[0]}

---

© 2024 Accenture. All rights reserved.
"Let there be change"
`;

  // Write instructions to file
  const instructionsPath = path.join(__dirname, '..', 'DEPLOYMENT_GUIDE.md');
  fs.writeFileSync(instructionsPath, instructions);

  console.log('✅ Deployment instructions generated successfully!');
  console.log(`📄 Instructions saved to: ${instructionsPath}`);

  // Generate quick start script
  const quickStartScript = `@echo off
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
`;

  const scriptPath = path.join(__dirname, '..', 'build-windows.bat');
  fs.writeFileSync(scriptPath, quickStartScript);

  console.log(`📄 Quick start script saved to: ${scriptPath}`);

  // Create a PowerShell version too
  const psScript = `# Accenture Mainframe AI Assistant Builder (PowerShell)
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
`;

  const psScriptPath = path.join(__dirname, '..', 'build-windows.ps1');
  fs.writeFileSync(psScriptPath, psScript);

  console.log(`📄 PowerShell script saved to: ${psScriptPath}`);

  console.log('\n🎯 Next Steps:');
  console.log('   1. Copy project to a Windows machine');
  console.log('   2. Run build-windows.bat (or build-windows.ps1)');
  console.log('   3. Test the generated installer');
  console.log('   4. Deploy to end users');

  return true;
}

if (require.main === module) {
  generateDeploymentInstructions();
}

module.exports = { generateDeploymentInstructions };