# Accenture Mainframe AI Assistant - Windows Deployment Guide

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
   ```cmd
   npm install --global windows-build-tools
   ```

## 🚀 Build Process

### Step 1: Clone and Setup
```cmd
git clone <repository-url>
cd mainframe-ai-assistant
npm install
```

### Step 2: Generate Icons
```cmd
npm run build:icons
```

### Step 3: Test Configuration
```cmd
node scripts/test-build.js
```

### Step 4: Build Windows Installer
```cmd
npm run dist:win
```

### Step 5: Build Portable Version (Optional)
```cmd
npm run pack
```

## 📦 Build Outputs

After successful build, you'll find the following files in `dist-packages/`:

### Windows Installer
- **`Accenture Mainframe AI Assistant-1.0.0-Setup.exe`** - Full installer (NSIS)
- **`Accenture Mainframe AI Assistant-1.0.0-ia32-Setup.exe`** - 32-bit installer
- **`Accenture Mainframe AI Assistant-1.0.0-x64-Setup.exe`** - 64-bit installer

### Portable Version
- **`Accenture Mainframe AI Assistant-1.0.0-Portable.exe`** - Portable executable

### Additional Files
- **`latest.yml`** - Auto-updater metadata
- **`checksums.json`** - File integrity verification
- **`verification.json`** - Build verification data

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
```cmd
npm install --save-dev electron-builder@latest
npm run dist:win
```

#### Issue: "Missing icon files"
**Solution**:
```cmd
npm run build:icons
npm run dist:win
```

#### Issue: "NSIS error"
**Solution**:
1. Ensure Windows build tools are installed
2. Run as Administrator if needed
3. Check antivirus software isn't blocking

#### Issue: "Node-gyp build errors"
**Solution**:
```cmd
npm install --global node-gyp
npm config set msvs_version 2019
npm rebuild
```

### Build Environment Issues

#### WSL/Linux Build Notes
- Electron GUI apps may not run in WSL
- Use Windows native environment for testing
- Cross-platform builds work from Linux

#### Memory Issues
- Increase Node.js heap size if needed:
  ```cmd
  set NODE_OPTIONS="--max-old-space-size=4096"
  npm run dist:win
  ```

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
```cmd
# Sign the executable with company certificate
signtool sign /f "AcuentureCert.p12" /p "password" "setup.exe"
```

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
**Last Updated**: 2025-09-16

---

© 2024 Accenture. All rights reserved.
"Let there be change"
