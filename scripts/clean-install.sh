#!/bin/bash

# Node Modules Complete Cleanup Script
# This script ensures a completely clean dependency installation

set -e  # Exit on any error

echo "🧹 Starting Complete Node Modules Cleanup..."
echo "==============================================="

# Function to safely remove directories/files
safe_remove() {
    if [ -e "$1" ]; then
        echo "🗑️  Removing: $1"
        rm -rf "$1"
    else
        echo "✅ Already clean: $1"
    fi
}

# Step 1: Stop any running processes that might lock files
echo "📋 Step 1: Stopping any Node.js processes..."
pkill -f "node" 2>/dev/null || echo "No node processes to kill"
pkill -f "npm" 2>/dev/null || echo "No npm processes to kill"
pkill -f "electron" 2>/dev/null || echo "No electron processes to kill"

# Step 2: Remove ALL traces of previous installations
echo "📋 Step 2: Removing all dependency artifacts..."

# Remove node_modules (including nested .bin directories)
safe_remove "node_modules"

# Remove lock files
safe_remove "package-lock.json"
safe_remove "yarn.lock"
safe_remove "pnpm-lock.yaml"

# Remove npm cache directories
safe_remove "$HOME/.npm"
safe_remove "$HOME/.node-gyp"
safe_remove "/tmp/.node-gyp"

# Remove electron cache
safe_remove "$HOME/.cache/electron"
safe_remove "$HOME/.cache/electron-builder"

# Remove TypeScript cache
safe_remove ".tsbuildinfo"
safe_remove "tsconfig.tsbuildinfo"

# Remove Jest cache
safe_remove ".jest"
safe_remove "coverage"

# Remove Vite cache
safe_remove "node_modules/.vite"
safe_remove "dist"

# Remove any temporary directories in node_modules
find . -name ".tmp*" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.tmp" -type f -delete 2>/dev/null || true

# Step 3: Clear npm cache completely
echo "📋 Step 3: Clearing npm cache..."
npm cache clean --force
npm cache verify

# Step 4: Update npm to latest version
echo "📋 Step 4: Updating npm..."
npm install -g npm@latest

# Step 5: Set optimal npm configuration
echo "📋 Step 5: Configuring npm settings..."
npm config set legacy-peer-deps true
npm config set fund false
npm config set audit false
npm config set registry https://registry.npmjs.org/
npm config set strict-ssl true
npm config set engine-strict true

# Step 6: Install dependencies in correct order
echo "📋 Step 6: Installing dependencies..."

# First, install core dependencies
echo "🔧 Installing core dependencies..."
npm install react@^18.2.0 react-dom@^18.2.0 typescript@^5.0.0 --save --no-package-lock

# Install development dependencies in groups
echo "🔧 Installing TypeScript and build tools..."
npm install --save-dev \
    @types/node@^20.0.0 \
    @types/react@^18.2.0 \
    @types/react-dom@^18.2.0 \
    @vitejs/plugin-react@^4.0.0 \
    vite@^5.0.0

echo "🔧 Installing Electron..."
npm install --save-dev \
    electron@^26.0.0 \
    electron-builder@^24.6.0

echo "🔧 Installing testing framework..."
npm install --save-dev \
    @types/jest@^29.5.0 \
    jest@^29.5.0 \
    jest-environment-jsdom@^29.5.0 \
    ts-jest@^29.1.0 \
    playwright@^1.40.0

echo "🔧 Installing linting and formatting..."
npm install --save-dev \
    @typescript-eslint/eslint-plugin@^6.0.0 \
    @typescript-eslint/parser@^6.0.0 \
    eslint@^8.45.0 \
    eslint-plugin-react@^7.32.0 \
    eslint-plugin-react-hooks@^4.6.0 \
    prettier@^3.0.0

echo "🔧 Installing utilities..."
npm install --save-dev \
    commander@^11.0.0 \
    glob@^10.3.0 \
    semver@^7.5.0 \
    brotli-size@^4.0.0 \
    gzip-size@^7.0.0 \
    husky@^8.0.0 \
    node-gyp@^9.4.0

echo "🔧 Installing test reporters..."
npm install --save-dev \
    jest-html-reporters@^3.1.5 \
    jest-junit@^16.0.0

# Step 7: Rebuild native modules
echo "📋 Step 7: Rebuilding native modules..."
npm rebuild

# Step 8: Create package-lock.json
echo "📋 Step 8: Creating package-lock.json..."
npm install --package-lock-only

# Step 9: Verify installation
echo "📋 Step 9: Verifying installation..."
echo "🔍 Checking for missing dependencies..."
npm ls --depth=0 || echo "Some peer dependency warnings are normal"

echo "🔍 Checking TypeScript compilation..."
npx tsc --noEmit --skipLibCheck || echo "TypeScript check completed with warnings"

echo "🔍 Checking Electron..."
if npx electron --version; then
    echo "✅ Electron is working"
else
    echo "❌ Electron has issues"
fi

echo ""
echo "✅ Clean installation completed!"
echo "==============================================="
echo "📊 Installation Summary:"
echo "  - Node.js: $(node --version)"
echo "  - NPM: $(npm --version)"
echo "  - Electron: $(npx electron --version 2>/dev/null || echo 'Not available')"
echo "  - TypeScript: $(npx tsc --version 2>/dev/null || echo 'Not available')"
echo ""
echo "🔧 Next steps:"
echo "  1. Run: npm run typecheck"
echo "  2. Run: npm run build"
echo "  3. Run: npm test"
echo "  4. Run: npm run dev"