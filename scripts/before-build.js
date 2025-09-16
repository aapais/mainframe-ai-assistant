#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Pre-build script for Accenture Mainframe AI Assistant
 * Ensures all necessary files and configurations are in place
 */

console.log('🔧 Running pre-build checks...');

async function preBuild() {
  try {
    // 1. Ensure build directory exists with all necessary files
    const buildDir = path.join(__dirname, '../build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
      console.log('✅ Created build directory');
    }

    // 2. Check for required icon files
    const requiredIcons = ['icon.ico', 'icon.icns', 'icon.png'];
    for (const icon of requiredIcons) {
      const iconPath = path.join(buildDir, icon);
      if (!fs.existsSync(iconPath)) {
        console.warn(`⚠️  Missing icon file: ${icon}`);
        console.log('   Running icon generation script...');
        require('./create-icons.js').createIcons();
        break;
      }
    }

    // 3. Ensure license file exists
    const licensePath = path.join(buildDir, 'license.txt');
    if (!fs.existsSync(licensePath)) {
      console.warn('⚠️  Missing license.txt file');
      return;
    }

    // 4. Ensure NSIS installer script exists
    const nsisPath = path.join(buildDir, 'installer.nsh');
    if (!fs.existsSync(nsisPath)) {
      console.warn('⚠️  Missing installer.nsh file');
      return;
    }

    // 5. Validate main entry point
    const mainFile = path.join(__dirname, '../src/main/electron-simple.js');
    if (!fs.existsSync(mainFile)) {
      console.error('❌ Main electron file not found:', mainFile);
      process.exit(1);
    }

    // 6. Validate preload script
    const preloadFile = path.join(__dirname, '../src/main/preload.js');
    if (!fs.existsSync(preloadFile)) {
      console.error('❌ Preload script not found:', preloadFile);
      process.exit(1);
    }

    // 7. Validate HTML file
    const htmlFile = path.join(__dirname, '../index.html');
    if (!fs.existsSync(htmlFile)) {
      console.error('❌ Main HTML file not found:', htmlFile);
      process.exit(1);
    }

    // 8. Validate app.js file
    const appFile = path.join(__dirname, '../app.js');
    if (!fs.existsSync(appFile)) {
      console.warn('⚠️  app.js file not found, creating placeholder...');
      const appContent = `// Accenture Mainframe AI Assistant
// Main application logic

console.log('Accenture Mainframe AI Assistant is starting...');

// Initialize application
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, application ready');

    // Add any additional startup logic here
    if (window.electronAPI) {
      console.log('Electron API available');
    }

    if (window.accentureAPI) {
      console.log('Accenture API available:', window.accentureAPI.brandInfo);
    }
  });
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    name: 'Accenture Mainframe AI Assistant',
    version: '1.0.0'
  };
}`;
      fs.writeFileSync(appFile, appContent);
      console.log('✅ Created app.js placeholder');
    }

    // 9. Create dist-packages directory
    const distDir = path.join(__dirname, '../dist-packages');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
      console.log('✅ Created dist-packages directory');
    }

    // 10. Validate package.json
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    if (packageJson.main !== 'src/main/electron-simple.js') {
      console.warn('⚠️  package.json main field should point to electron-simple.js');
    }

    if (!packageJson.build || !packageJson.build.appId) {
      console.error('❌ Missing electron-builder configuration in package.json');
      process.exit(1);
    }

    console.log('✅ Pre-build checks completed successfully');
    console.log('🚀 Ready to build Accenture Mainframe AI Assistant');

  } catch (error) {
    console.error('❌ Pre-build check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  preBuild().catch(console.error);
}

module.exports = { preBuild };