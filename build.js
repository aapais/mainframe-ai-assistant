const fs = require('fs');
const path = require('path');

console.log('🚀 Building Accenture Mainframe AI Assistant\n');
console.log('📦 This is a zero-dependency build!\n');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
  console.log('✅ Created dist directory');
}

// Files to include in the build
const filesToCopy = [
  'Accenture-Mainframe-AI-Assistant-Integrated.html',
  'server.js',
  'package.json',
  'kb-assistant.db'
];

// Copy files to dist
console.log('\n📂 Copying files:');
filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(distDir, file);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ⚠️  ${file} not found`);
  }
});

// Create a minimal package.json for production
const prodPackageJson = {
  name: "accenture-mainframe-assistant",
  version: "2.0.0",
  description: "Mainframe AI Assistant - Zero Build Dependencies",
  main: "server.js",
  scripts: {
    start: "node server.js"
  },
  dependencies: {
    "express": "^4.18.2",
    "better-sqlite3": "^9.2.2"
  },
  engines: {
    node: ">=14.0.0"
  }
};

fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(prodPackageJson, null, 2)
);
console.log('\n✅ Created production package.json');

// Create start script
const startScript = `#!/bin/bash
echo "🚀 Starting Accenture Mainframe AI Assistant"
echo "📊 Installing minimal dependencies (2 only)..."
npm install --production
echo "✅ Dependencies installed"
echo "🌐 Starting server..."
node server.js
`;

fs.writeFileSync(path.join(distDir, 'start.sh'), startScript);
fs.chmodSync(path.join(distDir, 'start.sh'), '755');
console.log('✅ Created start script');

// Create README
const readme = `# Accenture Mainframe AI Assistant - Production Build

## 🚀 Zero-Build Architecture
This application uses React via CDN - no build process needed!

## 📦 Minimal Dependencies
- express (backend server)
- better-sqlite3 (database)

## 🏃 How to Run
1. Install dependencies: \`npm install\`
2. Start server: \`npm start\`
3. Open browser: http://localhost:3001/Accenture-Mainframe-AI-Assistant-Integrated.html

## 🎯 Features
- No Webpack/Vite/Build tools needed
- React 18 via CDN
- SQLite database (no entry_type column)
- All entries are incidents
- Resolved incidents = Knowledge Base

## 📊 Current Data
- 13 incidents in database
- Status determines if active or knowledge
`;

fs.writeFileSync(path.join(distDir, 'README.md'), readme);
console.log('✅ Created README');

// Show summary
console.log('\n' + '='.repeat(50));
console.log('✨ BUILD COMPLETE!');
console.log('='.repeat(50));
console.log(`\n📁 Output: ${distDir}`);
console.log('\n🎯 What we built:');
console.log('   • HTML file with React via CDN (no build needed)');
console.log('   • Express server (2 dependencies only)');
console.log('   • SQLite database');
console.log('   • Start script');

console.log('\n🚀 To deploy:');
console.log('   1. Copy the dist folder to your server');
console.log('   2. Run: cd dist && npm install');
console.log('   3. Run: npm start');

console.log('\n✅ No Vite, No Webpack, No Build Problems!');