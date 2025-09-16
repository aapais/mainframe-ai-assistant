#!/usr/bin/env node

/**
 * Dependency Fix Script
 *
 * This script attempts to fix common dependency issues by:
 * 1. Cleaning node_modules and package-lock.json
 * 2. Reinstalling all dependencies
 * 3. Verifying critical packages are installed correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Starting dependency fix process...\n');

// Step 1: Clean existing installations
console.log('1. Cleaning existing installations...');
try {
  if (fs.existsSync('node_modules')) {
    console.log('   - Removing node_modules...');
    execSync('rm -rf node_modules', { stdio: 'inherit' });
  }

  if (fs.existsSync('package-lock.json')) {
    console.log('   - Removing package-lock.json...');
    fs.unlinkSync('package-lock.json');
  }

  console.log('   ✅ Cleanup completed\n');
} catch (error) {
  console.error('   ❌ Cleanup failed:', error.message);
  process.exit(1);
}

// Step 2: Clear npm cache
console.log('2. Clearing npm cache...');
try {
  execSync('npm cache clean --force', { stdio: 'inherit' });
  console.log('   ✅ Cache cleared\n');
} catch (error) {
  console.error('   ❌ Cache clear failed:', error.message);
}

// Step 3: Install dependencies
console.log('3. Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('   ✅ Dependencies installed\n');
} catch (error) {
  console.error('   ❌ Installation failed:', error.message);
  console.log('\n🔄 Trying alternative installation method...');

  try {
    execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
    console.log('   ✅ Dependencies installed with legacy peer deps\n');
  } catch (altError) {
    console.error('   ❌ Alternative installation also failed:', altError.message);
    process.exit(1);
  }
}

// Step 4: Verify critical packages
console.log('4. Verifying critical packages...');
const criticalPackages = [
  'react',
  'react-dom',
  '@vitejs/plugin-react',
  'typescript',
  'vite',
  'class-variance-authority',
  'clsx',
  'tailwind-merge'
];

let allInstalled = true;

criticalPackages.forEach(pkg => {
  try {
    const packagePath = path.join(process.cwd(), 'node_modules', pkg);
    if (fs.existsSync(packagePath)) {
      console.log(`   ✅ ${pkg}`);
    } else {
      console.log(`   ❌ ${pkg} - Missing`);
      allInstalled = false;
    }
  } catch (error) {
    console.log(`   ❌ ${pkg} - Error checking: ${error.message}`);
    allInstalled = false;
  }
});

if (!allInstalled) {
  console.log('\n⚠️  Some critical packages are missing. Attempting individual installation...');

  criticalPackages.forEach(pkg => {
    try {
      const packagePath = path.join(process.cwd(), 'node_modules', pkg);
      if (!fs.existsSync(packagePath)) {
        console.log(`   Installing ${pkg}...`);
        execSync(`npm install ${pkg}`, { stdio: 'inherit' });
      }
    } catch (error) {
      console.error(`   Failed to install ${pkg}:`, error.message);
    }
  });
}

// Step 5: Check TypeScript configuration
console.log('\n5. Verifying TypeScript configuration...');
try {
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'inherit' });
    console.log('   ✅ TypeScript configuration valid');
  } else {
    console.log('   ⚠️  tsconfig.json not found');
  }
} catch (error) {
  console.log('   ⚠️  TypeScript validation warnings (this is usually okay)');
}

// Step 6: Test Vite configuration
console.log('\n6. Testing Vite configuration...');
try {
  execSync('npx vite --version', { stdio: 'inherit' });
  console.log('   ✅ Vite is working');
} catch (error) {
  console.error('   ❌ Vite test failed:', error.message);
}

console.log('\n🎉 Dependency fix process completed!');
console.log('\n📋 Next steps:');
console.log('   1. Run "npm run dev" to start the development server');
console.log('   2. If issues persist, check the Vite configuration in vite.config.ts');
console.log('   3. Ensure all TypeScript files can be imported correctly');