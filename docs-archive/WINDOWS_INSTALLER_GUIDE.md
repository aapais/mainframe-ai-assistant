# Windows Installer Build Guide

## Overview

This guide provides complete instructions for building a Windows installer for the Accenture Mainframe AI Assistant on a Windows machine.

## Prerequisites

### Required Software
- **Node.js** (v18.0.0 or later) - Download from [nodejs.org](https://nodejs.org/)
- **npm** (v9.0.0 or later) - Comes with Node.js
- **Windows 10/11** - Required for building Windows installers
- **PowerShell** or **Command Prompt** - For running build scripts

### Verification Commands
```powershell
# Check Node.js version
node --version

# Check npm version
npm --version

# Check if electron-builder is available (will be installed)
npx electron-builder --version
```

## Project Structure

```
mainframe-ai-assistant/
├── build/                          # Build assets
│   ├── icon.ico                   # Windows app icon
│   ├── icon.png                   # Cross-platform icon
│   ├── license.txt                # Software license
│   └── installer.nsh              # NSIS customization
├── src/main/                      # Electron main process
│   ├── main.js                    # Main Electron process
│   └── preload.js                 # Preload script for security
├── electron-builder.yml           # Build configuration
├── package.json                   # Project dependencies
├── index.html                     # Application UI
├── app.js                         # Application logic
├── build-windows-installer.ps1    # PowerShell build script
└── build-installer.cmd            # Batch file build script
```

## Build Methods

### Method 1: PowerShell Script (Recommended)

```powershell
# Navigate to project directory
cd C:\path\to\mainframe-ai-assistant

# Run PowerShell build script
.\build-windows-installer.ps1
```

**PowerShell Script Options:**
```powershell
# Clean build (removes previous artifacts)
.\build-windows-installer.ps1 -Clean

# Skip npm install (if dependencies already installed)
.\build-windows-installer.ps1 -SkipInstall

# Verbose output
.\build-windows-installer.ps1 -Verbose

# Custom output directory
.\build-windows-installer.ps1 -OutputDir "release"

# Combined options
.\build-windows-installer.ps1 -Clean -Verbose
```

### Method 2: Batch File (Simple)

```cmd
# Navigate to project directory
cd C:\path\to\mainframe-ai-assistant

# Run batch build script
build-installer.cmd
```

### Method 3: Manual Commands

```powershell
# Install dependencies
npm install

# Create application icons
npm run build:icons

# Build Windows installer
npx electron-builder --win --x64 --config electron-builder.yml
```

## Build Process Steps

The build process performs the following steps:

1. **Dependency Installation**
   - Installs npm packages from package.json
   - Downloads electron-builder and dependencies

2. **Icon Generation**
   - Creates SVG, PNG, and ICO icons
   - Places icons in the build/ directory

3. **Application Testing**
   - Verifies all required files are present
   - Validates Electron configuration

4. **Package Creation**
   - Bundles the Electron application
   - Creates Windows executable

5. **Installer Generation**
   - Uses NSIS to create professional installer
   - Includes Accenture branding and customization

## Output Files

After successful build, you'll find these files in `dist-installer/`:

- **Accenture-Mainframe-AI-Setup.exe** - Main installer (distribute this)
- **win-unpacked/** - Unpacked application files
- **builder-debug.yml** - Build configuration debug info

## Installer Features

The generated installer includes:

### Professional Installation
- **Custom Branding** - Accenture colors and logos
- **License Agreement** - Software license acceptance
- **Installation Directory** - User can choose install location
- **Progress Indication** - Installation progress feedback

### Windows Integration
- **Desktop Shortcut** - Creates desktop shortcut with custom icon
- **Start Menu Entry** - Adds to Start Menu under "Accenture" folder
- **File Associations** - Associates .mainframe files with the app
- **Registry Entries** - Proper Windows registry integration
- **Uninstaller** - Professional uninstall process

### Security Features
- **Code Signing Ready** - Structure supports code signing
- **User-level Installation** - No admin rights required by default
- **Security Validation** - Validates installation integrity

## Testing the Installer

### Before Distribution
1. **Test on Clean Machine** - Install on a machine without Node.js
2. **Verify Shortcuts** - Check desktop and Start Menu shortcuts work
3. **Test Application** - Ensure app launches and functions correctly
4. **Test Uninstaller** - Verify clean uninstallation

### Test Commands
```powershell
# Install silently (for testing)
Accenture-Mainframe-AI-Setup.exe /S

# Install to specific directory
Accenture-Mainframe-AI-Setup.exe /D=C:\Custom\Path

# Create installer log
Accenture-Mainframe-AI-Setup.exe /L=install.log
```

## Customization Options

### Branding Customization
Edit these files to customize branding:
- `build/installer.nsh` - NSIS installer customization
- `build/license.txt` - Software license text
- `electron-builder.yml` - Build configuration
- `package.json` - Application metadata

### Icon Customization
Replace icons in `build/` directory:
- `icon.ico` - Windows icon (multiple sizes)
- `icon.png` - Cross-platform icon
- `icon.svg` - Vector source icon

### Build Configuration
Modify `electron-builder.yml`:
```yaml
win:
  target:
    - target: nsis
      arch: [x64, ia32]  # Add 32-bit support
  publisherName: "Your Company"  # Change publisher

nsis:
  oneClick: false              # Allow custom install location
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true  # Desktop shortcut
  createStartMenuShortcut: true # Start menu shortcut
```

## Troubleshooting

### Common Issues

**1. Node.js Not Found**
```
Error: 'node' is not recognized as an internal or external command
```
**Solution:** Install Node.js from [nodejs.org](https://nodejs.org/) and restart terminal

**2. Build Permissions Error**
```
Error: EPERM: operation not permitted
```
**Solution:** Run PowerShell as Administrator or use different output directory

**3. Electron Download Issues**
```
Error: Failed to download electron
```
**Solution:** Check internet connection or use corporate proxy settings:
```powershell
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

**4. Icon Generation Issues**
```
Error: Failed to create icons
```
**Solution:** Ensure build/ directory exists and is writable:
```powershell
mkdir build -Force
```

**5. NSIS Installer Issues**
```
Error: NSIS installer creation failed
```
**Solution:** Check that all files referenced in electron-builder.yml exist

### Debug Mode

Run build with debug information:
```powershell
# Enable debug output
$env:DEBUG="electron-builder"
npx electron-builder --win --x64

# Or with PowerShell script
.\build-windows-installer.ps1 -Verbose
```

### Manual Verification

Check build requirements manually:
```powershell
# Verify main files exist
Test-Path src/main/main.js
Test-Path src/main/preload.js
Test-Path index.html
Test-Path app.js

# Verify build assets
Test-Path build/icon.ico
Test-Path build/license.txt
Test-Path build/installer.nsh

# Verify configuration
Test-Path electron-builder.yml
Test-Path package.json
```

## Advanced Configuration

### Code Signing (Optional)

To add code signing to the installer:

1. **Obtain Code Signing Certificate**
   - Purchase from trusted CA (DigiCert, GlobalSign, etc.)
   - Or use internal corporate certificate

2. **Configure electron-builder**
   ```yaml
   win:
     certificateFile: "path/to/certificate.p12"
     certificatePassword: "certificate-password"
   ```

3. **Environment Variable Method**
   ```powershell
   $env:CSC_LINK="path/to/certificate.p12"
   $env:CSC_KEY_PASSWORD="certificate-password"
   ```

### Auto-Update Support (Optional)

Configure automatic updates:
```yaml
publish:
  provider: "github"
  owner: "your-org"
  repo: "mainframe-ai-assistant"
```

### Multiple Architectures

Build for both x64 and x86:
```yaml
win:
  target:
    - target: nsis
      arch: [x64, ia32]
```

## Production Checklist

Before distributing the installer:

- [ ] Test on clean Windows machine
- [ ] Verify all shortcuts work correctly
- [ ] Test application functionality
- [ ] Check uninstaller works properly
- [ ] Validate file associations
- [ ] Test installation in different directories
- [ ] Verify no sensitive data in installer
- [ ] Check installer file size is reasonable
- [ ] Test with antivirus software
- [ ] Validate licensing text is correct

## Distribution

### Internal Distribution
- **Network Share** - Place installer on company network
- **Email** - Send installer to stakeholders
- **Intranet** - Publish download link on company intranet

### External Distribution
- **Website Download** - Host on company website
- **Software Center** - Add to enterprise software catalog
- **USB Drives** - Copy to physical media for offline installation

### File Verification

Provide checksums for verification:
```powershell
# Generate SHA256 checksum
Get-FileHash "Accenture-Mainframe-AI-Setup.exe" -Algorithm SHA256
```

## Support Information

For build issues or questions:
- Check this guide first
- Review error messages in build output
- Test on different Windows versions
- Verify all prerequisites are installed
- Contact development team with specific error details

---

**Build Version:** 1.0.0
**Last Updated:** $(Get-Date)
**Compatible With:** Windows 10/11, Node.js 18+