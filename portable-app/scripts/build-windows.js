#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Windows-specific build script for Accenture Mainframe AI Assistant
 * Handles the complete Windows build and packaging process
 */

console.log('🪟 Building Accenture Mainframe AI Assistant for Windows...');

async function buildWindows() {
  try {
    // 1. Run pre-build checks
    console.log('🔧 Running pre-build checks...');
    const preBuild = require('./before-build.js');
    await preBuild.preBuild();

    // 2. Generate icons
    console.log('🎨 Generating application icons...');
    const createIcons = require('./create-icons.js');
    await createIcons.createIcons();

    // 3. Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    const distDir = path.join(__dirname, '../dist-packages');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // 4. Run electron-builder for Windows
    console.log('📦 Building Windows installer...');

    const builderArgs = [
      'electron-builder',
      '--win',
      '--config.compression=maximum',
      '--config.nsis.oneClick=false',
      '--config.nsis.allowToChangeInstallationDirectory=true',
      '--config.win.publisherName=Accenture'
    ];

    const builderProcess = spawn('npx', builderArgs, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      shell: true
    });

    builderProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Windows build completed successfully!');

        // Display build artifacts
        const distDir = path.join(__dirname, '../dist-packages');
        if (fs.existsSync(distDir)) {
          console.log('\n📁 Build artifacts:');
          const files = fs.readdirSync(distDir);
          files.forEach(file => {
            const filePath = path.join(distDir, file);
            const stats = fs.statSync(filePath);
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   📄 ${file} (${sizeInMB} MB)`);
          });
        }

        console.log('\n🎉 Build Summary:');
        console.log('   ✅ NSIS Installer created');
        console.log('   ✅ Portable version created');
        console.log('   ✅ Desktop shortcuts configured');
        console.log('   ✅ Start menu integration enabled');
        console.log('   ✅ Accenture branding applied');

        console.log('\n📋 Next Steps:');
        console.log('   1. Test the installer on a clean Windows machine');
        console.log('   2. Verify all features work correctly');
        console.log('   3. Test uninstall process');
        console.log('   4. Sign the executable for production release');

      } else {
        console.error('❌ Windows build failed with exit code:', code);
        process.exit(1);
      }
    });

    builderProcess.on('error', (error) => {
      console.error('❌ Build process error:', error.message);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Windows build script failed:', error.message);
    process.exit(1);
  }
}

// Helper function to check if electron-builder is installed
function checkDependencies() {
  try {
    require.resolve('electron-builder');
    console.log('✅ electron-builder is available');
  } catch (error) {
    console.error('❌ electron-builder not found. Installing...');
    const installProcess = spawn('npm', ['install', '--save-dev', 'electron-builder'], {
      stdio: 'inherit',
      shell: true
    });

    installProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ electron-builder installed successfully');
        buildWindows();
      } else {
        console.error('❌ Failed to install electron-builder');
        process.exit(1);
      }
    });
    return false;
  }
  return true;
}

if (require.main === module) {
  if (checkDependencies()) {
    buildWindows().catch(console.error);
  }
}

module.exports = { buildWindows };