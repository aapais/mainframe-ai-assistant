#!/bin/bash

# Fix Dependencies Script for Mainframe AI Assistant
# This script resolves npm installation issues and sets up a clean development environment

echo "🔧 Fixing Dependencies for Mainframe AI Assistant"
echo "=================================================="

# Step 1: Complete cleanup
echo "Step 1: Cleaning up existing installation..."
rm -rf node_modules package-lock.json npm-debug.log* .npm

# Step 2: Install dependencies via yarn (more reliable than npm for this setup)
echo "Step 2: Trying yarn as alternative package manager..."
if command -v yarn &> /dev/null; then
    echo "Using yarn for installation..."
    yarn install --legacy-peer-deps
else
    echo "Yarn not available, installing core dependencies manually..."
    # Create node_modules structure manually for development
    mkdir -p node_modules/.bin

    # Copy from global if available
    if [ -d "/home/andreapais/.nvm/versions/node/v22.19.0/lib/node_modules/vite" ]; then
        echo "Linking vite from global installation..."
        ln -s "/home/andreapais/.nvm/versions/node/v22.19.0/lib/node_modules/vite" node_modules/vite
        ln -s "/home/andreapais/.nvm/versions/node/v22.19.0/lib/node_modules/vite/bin/vite.js" node_modules/.bin/vite
    else
        echo "Installing vite globally first..."
        npm install -g vite@latest --force
        ln -s "/home/andreapais/.nvm/versions/node/v22.19.0/lib/node_modules/vite" node_modules/vite
        ln -s "/home/andreapais/.nvm/versions/node/v22.19.0/lib/node_modules/vite/bin/vite.js" node_modules/.bin/vite
    fi
fi

# Step 3: Verify installation
echo "Step 3: Verifying installation..."
if [ -f "node_modules/.bin/vite" ]; then
    echo "✅ Vite installed successfully"
    ./node_modules/.bin/vite --version
else
    echo "❌ Vite installation failed"
fi

# Step 4: Create a minimal package.json for development
echo "Step 4: Ensuring minimal development setup..."
if [ ! -f "node_modules/@types/node/package.json" ]; then
    npm install @types/node --force --no-package-lock 2>/dev/null || true
fi

echo "🎉 Dependency fix attempt complete!"
echo "Try running 'npm run dev' or './node_modules/.bin/vite' to test"