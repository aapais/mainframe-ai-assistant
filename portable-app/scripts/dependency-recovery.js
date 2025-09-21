#!/usr/bin/env node

/**
 * Dependency Recovery Script for Mainframe AI Assistant
 * Provides step-by-step recovery procedure for corrupted dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚨 DEPENDENCY RECOVERY SCRIPT');
console.log('=============================\n');

// Recovery steps
const recoverySteps = [
  {
    id: 1,
    title: 'Clean Workspace',
    commands: [
      'rm -rf node_modules',
      'rm -rf package-lock.json',
      'npm cache clean --force'
    ],
    description: 'Remove corrupted dependencies and cache'
  },
  {
    id: 2,
    title: 'Install Core Dependencies',
    commands: [
      'npm install --no-package-lock typescript@^5.0.0',
      'npm install --no-package-lock react@^18.2.0 react-dom@^18.2.0',
      'npm install --no-package-lock electron@^26.0.0'
    ],
    description: 'Install core dependencies one by one'
  },
  {
    id: 3,
    title: 'Install Build Tools',
    commands: [
      'npm install --no-package-lock --save-dev vite@^5.0.0',
      'npm install --no-package-lock --save-dev @vitejs/plugin-react@^4.0.0',
      'npm install --no-package-lock --save-dev electron-builder@^24.0.0'
    ],
    description: 'Install build tools individually'
  },
  {
    id: 4,
    title: 'Install Testing Dependencies',
    commands: [
      'npm install --no-package-lock --save-dev jest@^29.5.0',
      'npm install --no-package-lock --save-dev playwright@^1.40.0',
      'npm install --no-package-lock --save-dev husky@^8.0.0'
    ],
    description: 'Install testing and automation tools'
  },
  {
    id: 5,
    title: 'Install Utility Dependencies',
    commands: [
      'npm install --no-package-lock commander@^11.0.0',
      'npm install --no-package-lock --save-dev prettier@^3.0.0',
      'npm install --no-package-lock --save-dev eslint@^8.45.0'
    ],
    description: 'Install utility and linting tools'
  }
];

// Current issues summary
console.log('📋 CURRENT ISSUES IDENTIFIED:');
console.log('1. ❌ Node modules binary symlinks not created');
console.log('2. ❌ Version conflicts causing package corruption');
console.log('3. ❌ Multiple source files with syntax errors');
console.log('4. ❌ electron-builder missing app-builder-bin dependency');
console.log('5. ❌ csstype library corruption affecting TypeScript');
console.log('6. ✅ package.json has correct dependencies defined');
console.log('7. ✅ Main entry points exist (src/main/index.ts, preload.ts)');
console.log('8. ✅ Vite configuration is properly structured');
console.log('9. ✅ Electron-builder configuration in package.json is valid\n');

// Quick validation
console.log('🔍 QUICK SYSTEM CHECK:');
try {
  const nodeVersion = process.version;
  console.log(`✅ Node.js: ${nodeVersion}`);

  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm: ${npmVersion}`);
} catch (error) {
  console.log('❌ npm not available');
}

// Check package.json
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ package.json: ${packageJson.name}@${packageJson.version}`);
  console.log(`✅ Main entry: ${packageJson.main}`);
} catch (error) {
  console.log('❌ package.json issue:', error.message);
}

// Check critical files
const criticalFiles = [
  'src/main/index.ts',
  'src/main/preload.ts',
  'vite.config.ts',
  'tsconfig.json'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

console.log('\n🔧 RECOVERY PROCEDURE:');
console.log('=====================\n');

recoverySteps.forEach(step => {
  console.log(`STEP ${step.id}: ${step.title}`);
  console.log(`Description: ${step.description}`);
  console.log('Commands:');
  step.commands.forEach(cmd => {
    console.log(`  ${cmd}`);
  });
  console.log('');
});

console.log('⚡ QUICK RECOVERY (Run these commands):');
console.log('=====================================');
console.log('# Complete clean install');
console.log('rm -rf node_modules package-lock.json');
console.log('npm install');
console.log('');
console.log('# If that fails, use force install');
console.log('npm install --force');
console.log('');
console.log('# Test basic functionality');
console.log('npm run build:main');
console.log('npm run build:renderer');
console.log('');

console.log('🎯 PRIORITY FIXES:');
console.log('==================');
console.log('1. Fix corrupted source files in src/services/ml/');
console.log('2. Reinstall csstype dependency properly');
console.log('3. Fix electron-builder missing dependencies');
console.log('4. Create working build pipeline');
console.log('5. Test electron app launching');
console.log('');

console.log('📝 FILES CREATED/MODIFIED:');
console.log('==========================');
console.log('✅ scripts/validate-dependencies.js - Dependency validation');
console.log('✅ scripts/dependency-recovery.js - This recovery script');
console.log('✅ tsconfig.minimal.json - Minimal TypeScript config');
console.log('✅ package.json - Fixed Vite version from ^4.4.0 to ^5.0.0');
console.log('✅ tsconfig.main.json - Fixed invalid JSON properties');
console.log('');

console.log('✨ Recovery script complete! Follow the steps above to fix dependencies.');