#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Accenture Mainframe AI Assistant with dual framework support...\n');

try {
  // Build current Vite version
  console.log('📦 Building Vite version...');
  execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
  
  // Install Next.js dependencies if needed
  const appDir = path.join(process.cwd(), 'app');
  if (fs.existsSync(path.join(appDir, 'package.json'))) {
    console.log('\n📦 Installing Next.js dependencies...');
    execSync('npm install', { stdio: 'inherit', cwd: appDir });
    
    // Build Next.js version
    console.log('\n📦 Building Next.js version...');
    execSync('npm run build', { stdio: 'inherit', cwd: appDir });
  }
  
  console.log('\n✅ Both builds completed successfully!');
  console.log('\n🔧 Available commands:');
  console.log('  npm run dev         - Start Vite development server (port 3000)');
  console.log('  npm run dev:next    - Start Next.js development server (port 3001)');
  console.log('  npm run electron    - Launch Electron app');
  
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
