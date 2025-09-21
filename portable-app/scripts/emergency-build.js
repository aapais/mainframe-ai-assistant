/**
 * Emergency Build Script for Week 2
 * Simplified build process that bypasses complex dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚨 EMERGENCY BUILD - Week 2 Simplified Version');

// Check if we're in the right directory
const packagePath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packagePath)) {
  console.error('❌ package.json not found. Run this from the project root.');
  process.exit(1);
}

// 1. Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  if (fs.existsSync('./dist')) {
    fs.rmSync('./dist', { recursive: true, force: true });
  }
  console.log('✅ Cleaned dist directory');
} catch (error) {
  console.warn('⚠️ Could not clean dist directory:', error.message);
}

// 2. Install dependencies if needed
console.log('📦 Checking dependencies...');
try {
  // Check if node_modules exists and has key dependencies
  if (!fs.existsSync('./node_modules') ||
      !fs.existsSync('./node_modules/electron') ||
      !fs.existsSync('./node_modules/react')) {
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit', cwd: process.cwd() });
  }
  console.log('✅ Dependencies ready');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// 3. Copy essential assets
console.log('📁 Setting up essential assets...');
try {
  // Ensure assets directory exists
  if (!fs.existsSync('./assets')) {
    fs.mkdirSync('./assets', { recursive: true });
  }

  // Create simple icon if it doesn't exist
  const iconDir = './assets/icons';
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
    console.log('📝 Created icons directory (add icon files manually)');
  }

  console.log('✅ Assets ready');
} catch (error) {
  console.warn('⚠️ Asset setup warning:', error.message);
}

// 4. Build main process (simplified)
console.log('🔨 Building main process...');
try {
  // Use the simplified main file
  const originalMain = './src/main/index.ts';
  const simplifiedMain = './src/main/index-simple.ts';

  if (fs.existsSync(simplifiedMain)) {
    // Temporarily replace the main file
    if (fs.existsSync(originalMain)) {
      fs.renameSync(originalMain, './src/main/index-complex.ts.bak');
    }
    fs.copyFileSync(simplifiedMain, originalMain);
    console.log('📝 Using simplified main process');
  }

  execSync('npm run build:main', { stdio: 'inherit', cwd: process.cwd() });
  console.log('✅ Main process built');
} catch (error) {
  console.error('❌ Failed to build main process:', error.message);

  // Restore original main file if it was backed up
  const backupMain = './src/main/index-complex.ts.bak';
  if (fs.existsSync(backupMain)) {
    fs.renameSync(backupMain, './src/main/index.ts');
  }

  process.exit(1);
}

// 5. Build renderer process
console.log('🎨 Building renderer process...');
try {
  execSync('npm run build:renderer', { stdio: 'inherit', cwd: process.cwd() });
  console.log('✅ Renderer process built');
} catch (error) {
  console.error('❌ Failed to build renderer process:', error.message);
  console.log('💡 Try running: npm run dev:renderer to check for errors');
  process.exit(1);
}

// 6. Test the build
console.log('🧪 Testing build...');
try {
  // Check if dist files exist
  const mainDist = './dist/main/index.js';
  const rendererDist = './dist/index.html';

  if (!fs.existsSync(mainDist)) {
    throw new Error('Main process build missing');
  }

  if (!fs.existsSync(rendererDist)) {
    throw new Error('Renderer process build missing');
  }

  console.log('✅ Build files verified');
} catch (error) {
  console.error('❌ Build verification failed:', error.message);
  process.exit(1);
}

console.log('🎉 EMERGENCY BUILD COMPLETED SUCCESSFULLY!');
console.log('');
console.log('📋 Next steps:');
console.log('  1. Run: npm start');
console.log('  2. Test basic functionality');
console.log('  3. Check for any console errors');
console.log('');
console.log('🐛 If there are issues:');
console.log('  1. Check the console for errors');
console.log('  2. Verify IPC communication');
console.log('  3. Ensure KB content is loading');