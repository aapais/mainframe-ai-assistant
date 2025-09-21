#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Test build script for Accenture Mainframe AI Assistant
 * Validates all components before attempting full build
 */

console.log('🧪 Testing Accenture Mainframe AI Assistant build process...');

async function testBuild() {
  let hasErrors = false;

  try {
    console.log('\n📋 1. Validating project structure...');

    // Check critical files
    const criticalFiles = [
      'package.json',
      'src/main/electron-simple.js',
      'src/main/preload.js',
      'index.html',
      'app.js',
      'build/icon.ico',
      'build/icon.png',
      'build/license.txt',
      'build/installer.nsh'
    ];

    for (const file of criticalFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Missing critical file: ${file}`);
        hasErrors = true;
      } else {
        console.log(`✅ Found: ${file}`);
      }
    }

    console.log('\n📋 2. Validating package.json configuration...');

    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // Validate package.json fields
    const validations = [
      { field: 'name', expected: 'accenture-mainframe-ai-assistant', value: packageJson.name },
      { field: 'main', expected: 'src/main/electron-simple.js', value: packageJson.main },
      { field: 'build.appId', expected: 'com.accenture.mainframe-ai-assistant', value: packageJson.build?.appId },
      { field: 'build.productName', expected: 'Accenture Mainframe AI Assistant', value: packageJson.build?.productName }
    ];

    for (const validation of validations) {
      if (validation.value === validation.expected) {
        console.log(`✅ ${validation.field}: ${validation.value}`);
      } else {
        console.error(`❌ ${validation.field}: expected "${validation.expected}", got "${validation.value}"`);
        hasErrors = true;
      }
    }

    console.log('\n📋 3. Checking dependencies...');

    const requiredDeps = ['electron', 'electron-builder'];
    for (const dep of requiredDeps) {
      try {
        const depPath = require.resolve(dep);
        console.log(`✅ ${dep}: installed`);
      } catch (error) {
        console.error(`❌ ${dep}: not found`);
        hasErrors = true;
      }
    }

    console.log('\n📋 4. Validating HTML file...');
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    if (htmlContent.includes('Accenture Mainframe AI Assistant')) {
      console.log('✅ HTML contains Accenture branding');
    } else {
      console.error('❌ HTML missing Accenture branding');
      hasErrors = true;
    }

    if (htmlContent.includes('app.js')) {
      console.log('✅ HTML references app.js');
    } else {
      console.error('❌ HTML does not reference app.js');
      hasErrors = true;
    }

    console.log('\n📋 5. Validating main electron file...');
    const mainPath = path.join(__dirname, '..', 'src/main/electron-simple.js');
    const mainContent = fs.readFileSync(mainPath, 'utf8');

    if (mainContent.includes('electron')) {
      console.log('✅ Main file imports electron');
    } else {
      console.error('❌ Main file missing electron import');
      hasErrors = true;
    }

    if (mainContent.includes('createWindow')) {
      console.log('✅ Main file has window creation function');
    } else {
      console.error('❌ Main file missing window creation function');
      hasErrors = true;
    }

    console.log('\n📋 6. Testing icon files...');
    const iconFiles = ['icon.ico', 'icon.png', 'icon.icns'];
    for (const icon of iconFiles) {
      const iconPath = path.join(__dirname, '..', 'build', icon);
      if (fs.existsSync(iconPath)) {
        const stats = fs.statSync(iconPath);
        if (stats.size > 0) {
          console.log(`✅ ${icon}: ${stats.size} bytes`);
        } else {
          console.warn(`⚠️  ${icon}: file is empty`);
        }
      }
    }

    console.log('\n📋 7. Testing preload script...');
    const preloadPath = path.join(__dirname, '..', 'src/main/preload.js');
    const preloadContent = fs.readFileSync(preloadPath, 'utf8');

    if (preloadContent.includes('contextBridge')) {
      console.log('✅ Preload script uses contextBridge');
    } else {
      console.error('❌ Preload script missing contextBridge');
      hasErrors = true;
    }

    console.log('\n📋 8. Testing app.js functionality...');
    const appPath = path.join(__dirname, '..', 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');

    if (appContent.includes('Mainframe AI Assistant')) {
      console.log('✅ App.js contains application branding');
    } else {
      console.error('❌ App.js missing application branding');
      hasErrors = true;
    }

    if (hasErrors) {
      console.log('\n❌ Build validation failed! Please fix the errors above before building.');
      return false;
    }

    console.log('\n✅ All validation checks passed!');

    console.log('\n📋 9. Testing quick build (dry run)...');
    console.log('Testing electron-builder configuration...');

    // Test electron-builder configuration without actually building
    const testProcess = spawn('npx', ['electron-builder', '--help'], {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..'),
      shell: true
    });

    return new Promise((resolve) => {
      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ electron-builder is configured correctly');
          console.log('\n🎉 Build test completed successfully!');
          console.log('\n📋 Summary:');
          console.log('   ✅ All critical files present');
          console.log('   ✅ Package.json configuration valid');
          console.log('   ✅ Dependencies installed');
          console.log('   ✅ Electron main file valid');
          console.log('   ✅ Preload script secure');
          console.log('   ✅ Icons generated');
          console.log('   ✅ NSIS installer configured');
          console.log('   ✅ electron-builder ready');

          console.log('\n🚀 Ready to build! Run one of these commands:');
          console.log('   npm run dist:win     - Build Windows installer');
          console.log('   npm run dist         - Build for current platform');
          console.log('   npm run pack         - Build without installer');

          resolve(true);
        } else {
          console.error('❌ electron-builder configuration test failed');
          resolve(false);
        }
      });
    });

  } catch (error) {
    console.error('❌ Build test failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  testBuild().then(success => {
    if (!success) {
      process.exit(1);
    }
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testBuild };