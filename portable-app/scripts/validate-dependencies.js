#!/usr/bin/env node

/**
 * Dependency Validation Script
 * Checks if critical dependencies and entry points are available
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Mainframe AI Assistant Dependencies...\n');

// Check package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('✅ package.json found and valid');
} catch (error) {
  console.error('❌ package.json error:', error.message);
  process.exit(1);
}

// Check critical dependencies in package.json
const criticalDeps = [
  'vite', 'electron', 'electron-builder', 'typescript',
  'react', 'react-dom', '@vitejs/plugin-react'
];

const missingDeps = [];
const versionIssues = [];

criticalDeps.forEach(dep => {
  const inDeps = packageJson.dependencies?.[dep];
  const inDevDeps = packageJson.devDependencies?.[dep];

  if (!inDeps && !inDevDeps) {
    missingDeps.push(dep);
  } else {
    console.log(`✅ ${dep}: ${inDeps || inDevDeps}`);
  }
});

// Check main entry points
const mainEntryPoints = [
  'src/main/index.ts',
  'src/main/preload.ts',
  'vite.config.ts',
  'tsconfig.json'
];

mainEntryPoints.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

// Check build directories
const buildDirs = ['src', 'src/main', 'src/renderer'];
buildDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    console.log(`✅ ${dir}/ directory exists`);
  } else {
    console.log(`❌ ${dir}/ directory missing`);
  }
});

// Check node_modules critical packages
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules directory exists');

  // Check if critical packages are installed
  const installedPackages = fs.readdirSync(nodeModulesPath)
    .filter(name => !name.startsWith('.'));

  criticalDeps.forEach(dep => {
    if (installedPackages.includes(dep) ||
        installedPackages.some(pkg => pkg.startsWith('@') && pkg.includes(dep))) {
      console.log(`✅ ${dep} package directory found`);
    } else {
      console.log(`⚠️  ${dep} package directory not found`);
    }
  });
} else {
  console.log('❌ node_modules directory missing');
}

// Summary
console.log('\n📊 SUMMARY');
console.log('==========');

if (missingDeps.length > 0) {
  console.log(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
} else {
  console.log('✅ All critical dependencies defined in package.json');
}

console.log(`📦 Package.json main entry: ${packageJson.main}`);
console.log(`🔧 Available scripts: ${Object.keys(packageJson.scripts || {}).length}`);

// Quick fixes
console.log('\n🔧 QUICK FIXES');
console.log('==============');

if (missingDeps.length > 0) {
  console.log('Run: npm install --save-dev', missingDeps.join(' '));
}

console.log('To fix version conflicts: npm install --force');
console.log('To reinstall cleanly: rm -rf node_modules package-lock.json && npm install');

console.log('\n✨ Validation complete!');