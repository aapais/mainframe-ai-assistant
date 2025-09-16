# Accenture Mainframe AI Assistant - Windows Build Script
# This script builds the complete Windows installer on a Windows machine

param(
    [switch]$Clean,
    [switch]$SkipInstall,
    [switch]$Verbose,
    [string]$OutputDir = "dist-installer"
)

$ErrorActionPreference = "Stop"

# Colors for output
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

function Write-ColoredOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor "Magenta"
    Write-Host " $Title" -ForegroundColor "Magenta"
    Write-Host "=" * 60 -ForegroundColor "Magenta"
    Write-Host ""
}

function Test-CommandExists {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Install-NodeModules {
    Write-Section "Installing Dependencies"

    if (-not (Test-CommandExists "npm")) {
        Write-ColoredOutput "❌ npm is not installed. Please install Node.js from https://nodejs.org/" $ColorError
        exit 1
    }

    Write-ColoredOutput "📦 Installing npm dependencies..." $ColorInfo
    npm install

    if ($LASTEXITCODE -ne 0) {
        Write-ColoredOutput "❌ Failed to install npm dependencies" $ColorError
        exit 1
    }

    Write-ColoredOutput "✅ Dependencies installed successfully" $ColorSuccess
}

function Build-Icons {
    Write-Section "Creating Application Icons"

    Write-ColoredOutput "🎨 Generating application icons..." $ColorInfo
    npm run build:icons

    if ($LASTEXITCODE -ne 0) {
        Write-ColoredOutput "❌ Failed to create icons" $ColorError
        exit 1
    }

    Write-ColoredOutput "✅ Icons created successfully" $ColorSuccess
}

function Test-ElectronApp {
    Write-Section "Testing Electron Application"

    Write-ColoredOutput "🧪 Testing Electron app functionality..." $ColorInfo

    # Test if main files exist
    $MainFile = "src/main/main.js"
    $PreloadFile = "src/main/preload.js"
    $IndexFile = "index.html"

    if (-not (Test-Path $MainFile)) {
        Write-ColoredOutput "❌ Main Electron file missing: $MainFile" $ColorError
        exit 1
    }

    if (-not (Test-Path $PreloadFile)) {
        Write-ColoredOutput "❌ Preload file missing: $PreloadFile" $ColorError
        exit 1
    }

    if (-not (Test-Path $IndexFile)) {
        Write-ColoredOutput "❌ Index HTML file missing: $IndexFile" $ColorError
        exit 1
    }

    Write-ColoredOutput "✅ All required files present" $ColorSuccess

    # Optional: Run a quick Electron test (commented out to avoid GUI during CI)
    # Write-ColoredOutput "Starting Electron app for 5 seconds..." $ColorInfo
    # Start-Process "npm" -ArgumentList "run", "electron" -NoNewWindow -Wait -TimeoutSec 5
}

function Build-ElectronPackage {
    Write-Section "Building Electron Package"

    Write-ColoredOutput "🔨 Building Electron application..." $ColorInfo

    # Clean previous builds if requested
    if ($Clean -and (Test-Path $OutputDir)) {
        Write-ColoredOutput "🧹 Cleaning previous build artifacts..." $ColorWarning
        Remove-Item -Recurse -Force $OutputDir
    }

    # Build for Windows x64
    Write-ColoredOutput "📦 Packaging for Windows x64..." $ColorInfo
    npm run package:win

    if ($LASTEXITCODE -ne 0) {
        Write-ColoredOutput "❌ Failed to package Electron app" $ColorError
        exit 1
    }

    Write-ColoredOutput "✅ Electron package created successfully" $ColorSuccess
}

function Create-WindowsInstaller {
    Write-Section "Creating Windows Installer"

    Write-ColoredOutput "🏗️ Creating NSIS installer..." $ColorInfo

    # Use electron-builder to create the installer
    npx electron-builder --win --x64 --config electron-builder.yml

    if ($LASTEXITCODE -ne 0) {
        Write-ColoredOutput "❌ Failed to create Windows installer" $ColorError
        exit 1
    }

    Write-ColoredOutput "✅ Windows installer created successfully" $ColorSuccess
}

function Verify-InstallerOutput {
    Write-Section "Verifying Build Output"

    $InstallerPath = Join-Path $OutputDir "Accenture-Mainframe-AI-Setup.exe"

    if (Test-Path $InstallerPath) {
        $FileInfo = Get-Item $InstallerPath
        $FileSizeMB = [math]::Round($FileInfo.Length / 1MB, 2)

        Write-ColoredOutput "✅ Installer created: $InstallerPath" $ColorSuccess
        Write-ColoredOutput "📊 File size: $FileSizeMB MB" $ColorInfo
        Write-ColoredOutput "📅 Created: $($FileInfo.CreationTime)" $ColorInfo

        # List all files in output directory
        Write-ColoredOutput "📁 Build artifacts:" $ColorInfo
        Get-ChildItem $OutputDir | ForEach-Object {
            $SizeMB = [math]::Round($_.Length / 1MB, 2)
            Write-ColoredOutput "   📄 $($_.Name) ($SizeMB MB)" $ColorInfo
        }

        return $true
    } else {
        Write-ColoredOutput "❌ Installer not found: $InstallerPath" $ColorError

        # List what was actually created
        if (Test-Path $OutputDir) {
            Write-ColoredOutput "🔍 Files in output directory:" $ColorWarning
            Get-ChildItem $OutputDir -Recurse | ForEach-Object {
                Write-ColoredOutput "   📄 $($_.FullName)" $ColorWarning
            }
        }

        return $false
    }
}

function Show-BuildSummary {
    Write-Section "Build Summary"

    $InstallerPath = Join-Path $OutputDir "Accenture-Mainframe-AI-Setup.exe"

    if (Test-Path $InstallerPath) {
        Write-ColoredOutput "🎉 BUILD SUCCESSFUL!" $ColorSuccess
        Write-Host ""
        Write-ColoredOutput "📦 Windows Installer: $InstallerPath" $ColorSuccess
        Write-ColoredOutput "🚀 Ready for distribution on Windows machines" $ColorSuccess
        Write-Host ""
        Write-ColoredOutput "Next steps:" $ColorInfo
        Write-ColoredOutput "1. Test the installer on a clean Windows machine" $ColorInfo
        Write-ColoredOutput "2. Verify desktop shortcuts are created" $ColorInfo
        Write-ColoredOutput "3. Check Start Menu entries" $ColorInfo
        Write-ColoredOutput "4. Test application functionality after installation" $ColorInfo
        Write-Host ""
        Write-ColoredOutput "Installation command:" $ColorInfo
        Write-ColoredOutput "   $InstallerPath" $ColorInfo
    } else {
        Write-ColoredOutput "❌ BUILD FAILED!" $ColorError
        Write-ColoredOutput "Please check the error messages above" $ColorError
    }
}

# Main execution
try {
    Write-Section "Accenture Mainframe AI Assistant - Windows Build"
    Write-ColoredOutput "🏗️ Building Windows installer package..." $ColorInfo
    Write-ColoredOutput "📅 Build started: $(Get-Date)" $ColorInfo

    # Check system requirements
    Write-ColoredOutput "🔍 Checking system requirements..." $ColorInfo

    if (-not (Test-CommandExists "node")) {
        Write-ColoredOutput "❌ Node.js is not installed. Please install from https://nodejs.org/" $ColorError
        exit 1
    }

    $NodeVersion = node --version
    Write-ColoredOutput "✅ Node.js version: $NodeVersion" $ColorSuccess

    if (-not (Test-CommandExists "npm")) {
        Write-ColoredOutput "❌ npm is not available" $ColorError
        exit 1
    }

    $NpmVersion = npm --version
    Write-ColoredOutput "✅ npm version: $NpmVersion" $ColorSuccess

    # Execute build steps
    if (-not $SkipInstall) {
        Install-NodeModules
    }

    Build-Icons
    Test-ElectronApp
    Build-ElectronPackage
    Create-WindowsInstaller

    if (Verify-InstallerOutput) {
        Show-BuildSummary
        exit 0
    } else {
        Write-ColoredOutput "❌ Build verification failed" $ColorError
        exit 1
    }

} catch {
    Write-ColoredOutput "❌ Build failed with error: $($_.Exception.Message)" $ColorError
    Write-ColoredOutput "Stack trace: $($_.ScriptStackTrace)" $ColorError
    exit 1
}

# Usage examples:
<#
# Basic build
.\build-windows-installer.ps1

# Clean build (removes previous artifacts)
.\build-windows-installer.ps1 -Clean

# Skip npm install (if dependencies are already installed)
.\build-windows-installer.ps1 -SkipInstall

# Verbose output
.\build-windows-installer.ps1 -Verbose

# Custom output directory
.\build-windows-installer.ps1 -OutputDir "custom-dist"

# Combined options
.\build-windows-installer.ps1 -Clean -Verbose -OutputDir "release"
#>