# Accenture Mainframe AI Assistant - Windows Installer

## 🚀 Quick Start (For Windows Users)

This project creates a complete Windows installer for the Accenture Mainframe AI Assistant. The installer produces a single `.exe` file that can be distributed to Windows machines.

### Prerequisites
- **Windows 10/11** (required for building Windows installers)
- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **PowerShell** or **Command Prompt**

### Build Commands

**Option 1: PowerShell Script (Recommended)**
```powershell
.\build-windows-installer.ps1
```

**Option 2: Batch File (Simple)**
```cmd
build-installer.cmd
```

**Option 3: Manual Steps**
```cmd
npm install
npm run build:icons
npx electron-builder --win --x64 --config electron-builder.yml
```

### Output
- **File**: `dist-installer\Accenture-Mainframe-AI-Setup.exe`
- **Size**: ~150-200 MB (includes Node.js runtime)
- **Target**: Windows 10/11 x64

## 📦 What You Get

The installer creates:
- ✅ **Desktop Shortcut** - "Accenture Mainframe AI Assistant"
- ✅ **Start Menu Entry** - Under "Accenture" folder
- ✅ **Program Files Installation** - Professional installation location
- ✅ **Uninstaller** - Clean uninstall process
- ✅ **File Associations** - `.mainframe` files open with the app
- ✅ **Registry Integration** - Proper Windows registry entries

## 🎯 Features

### Professional Electron App
- **Modern UI** - React-like components with Accenture branding
- **Security First** - Disabled Node integration, context isolation enabled
- **Performance Optimized** - Efficient rendering and state management
- **Cross-platform Ready** - Built on Electron framework

### Enterprise-Grade Installer
- **NSIS-based** - Professional Windows installer technology
- **Accenture Branding** - Custom colors, logos, and messaging
- **License Agreement** - Software license acceptance flow
- **Custom Installation** - User can choose installation directory
- **Digital Signature Ready** - Structure supports code signing

### Application Features
- 📊 **Dashboard** - Overview of system status and metrics
- 📚 **Knowledge Base** - Manage and organize information
- 🔍 **Smart Search** - AI-powered search capabilities
- 📈 **Analytics** - Performance and usage analytics
- ⚙️ **Settings** - Configurable preferences
- 🎨 **Theming** - Professional Accenture color scheme

## 🔧 Build Validation

Before building, run the validation script:
```cmd
node scripts/validate-build-setup.js
```

This checks:
- ✅ All required files are present
- ✅ Configuration is valid
- ✅ Dependencies are installed
- ✅ Icons are generated
- ✅ Build scripts are ready

## 📁 Project Structure

```
mainframe-ai-assistant/
├── 📂 build/                          # Build assets & icons
│   ├── 🖼️ icon.ico                   # Windows app icon
│   ├── 🖼️ icon.png                   # Cross-platform icon
│   ├── 📄 license.txt                # Software license
│   └── 📄 installer.nsh              # NSIS customization
├── 📂 src/main/                       # Electron main process
│   ├── ⚡ main.js                     # Main Electron process
│   └── 🔒 preload.js                 # Security preload script
├── 📂 scripts/                        # Build utilities
│   ├── 🎨 create-icons.js            # Icon generation
│   └── ✅ validate-build-setup.js    # Build validation
├── 📂 docs/                           # Documentation
│   └── 📖 WINDOWS_INSTALLER_GUIDE.md # Detailed build guide
├── ⚙️ electron-builder.yml           # Build configuration
├── 📦 package.json                   # Project dependencies
├── 🌐 index.html                     # Application UI
├── 💻 app.js                         # Application logic
├── 🔨 build-windows-installer.ps1    # PowerShell build script
└── 🔨 build-installer.cmd            # Batch build script
```

## 🎨 Customization

### Change Branding
1. **Icons**: Replace files in `build/` directory
2. **Colors**: Edit CSS in `index.html` and `app.js`
3. **Company Info**: Update `package.json` and `electron-builder.yml`
4. **License**: Modify `build/license.txt`

### Build Options
```powershell
# Clean build (removes previous artifacts)
.\build-windows-installer.ps1 -Clean

# Skip dependency installation
.\build-windows-installer.ps1 -SkipInstall

# Verbose output for debugging
.\build-windows-installer.ps1 -Verbose

# Custom output directory
.\build-windows-installer.ps1 -OutputDir "release"
```

## 🛠️ Development

### Local Testing
```cmd
# Run in development mode
npm run electron

# Run with dev tools
npm run electron:dev
```

### Icon Creation
```cmd
# Generate all icon formats
npm run build:icons

# Creates: build/icon.svg, build/icon.png, build/icon.ico
```

### Build Different Architectures
```cmd
# Windows x64 (default)
npx electron-builder --win --x64

# Windows x86 (32-bit)
npx electron-builder --win --ia32

# Both architectures
npx electron-builder --win --x64 --ia32
```

## 🔍 Troubleshooting

### Common Issues

**❌ Node.js not found**
- Install Node.js from [nodejs.org](https://nodejs.org/)
- Restart terminal after installation

**❌ Permission denied**
- Run PowerShell as Administrator
- Or use different output directory

**❌ Build fails**
- Run: `node scripts/validate-build-setup.js`
- Check error messages in build output
- Ensure all files exist

**❌ Icons missing**
- Run: `npm run build:icons`
- Check `build/` directory exists

### Debug Mode
```powershell
# Enable detailed logging
$env:DEBUG="electron-builder"
npx electron-builder --win --x64
```

## 🚀 Distribution

### Internal Distribution
- **Network Share**: Copy installer to company network
- **Email**: Send installer file to users
- **Software Center**: Add to enterprise catalog

### Installation Commands
```cmd
# Silent installation
Accenture-Mainframe-AI-Setup.exe /S

# Install to custom directory
Accenture-Mainframe-AI-Setup.exe /D=C:\Custom\Path

# Create installation log
Accenture-Mainframe-AI-Setup.exe /L=install.log
```

## 📊 Build Metrics

After successful build:
- **Installer Size**: ~150-200 MB
- **Installation Size**: ~400-500 MB
- **Startup Time**: < 3 seconds
- **Memory Usage**: ~100-150 MB
- **Build Time**: 2-5 minutes (depending on machine)

## 🔐 Security Features

- **No Node Integration** - Renderer process isolated from Node.js
- **Context Isolation** - Secure communication between processes
- **CSP Ready** - Content Security Policy support
- **Preload Script** - Controlled API exposure
- **Input Validation** - All user inputs validated
- **External Link Handling** - Opens links in default browser

## 📈 Performance Optimizations

- **Lazy Loading** - Components loaded as needed
- **Efficient Rendering** - Minimal DOM updates
- **Memory Management** - Proper cleanup and garbage collection
- **Asset Optimization** - Compressed images and resources
- **Startup Optimization** - Fast application launch

## 🆘 Support

For build issues:
1. **Check**: `docs/WINDOWS_INSTALLER_GUIDE.md` for detailed instructions
2. **Validate**: Run `node scripts/validate-build-setup.js`
3. **Debug**: Use verbose build mode
4. **Contact**: Development team with error details

---

**📅 Last Updated**: December 2024
**🔧 Version**: 1.0.0
**🏢 Company**: Accenture
**💜 Slogan**: Let there be change