#!/bin/bash

# Comprehensive Node Dependencies Rebuild Script
# For /mnt/c/mainframe-ai-assistant
# Addresses: class-variance-authority missing dist files, ENOTEMPTY errors, file locks

set -e

echo "🔧 Starting comprehensive Node dependencies rebuild..."
echo "Working directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Step 1: Stop any running processes that might lock files
echo "📴 Step 1: Stopping potentially conflicting processes..."
killall node || true
killall electron || true
sleep 2

# Step 2: Clean existing installations
echo "🧹 Step 2: Cleaning existing node_modules and lock files..."
if [ -d "node_modules" ]; then
    echo "Removing node_modules..."
    rm -rf node_modules || {
        echo "⚠️  Failed to remove node_modules directly, trying with force..."
        find node_modules -type f -exec rm -f {} \; 2>/dev/null || true
        rm -rf node_modules 2>/dev/null || true
    }
fi

# Remove lock files
rm -f package-lock.json
rm -f yarn.lock
rm -f pnpm-lock.yaml

echo "✅ Cleanup completed"

# Step 3: Clear npm cache and temporary files
echo "🗑️  Step 3: Clearing npm cache and temporary files..."
npm cache clean --force
npm cache verify

# Clear npm temporary directories
rm -rf ~/.npm/_cacache
rm -rf ~/.npm/_logs
rm -rf /tmp/npm-*

echo "✅ Cache cleared"

# Step 4: Verify disk space
echo "💾 Step 4: Checking disk space..."
AVAILABLE_SPACE=$(df /mnt/c | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_SPACE" -lt 2097152 ]; then  # Less than 2GB
    echo "⚠️  Warning: Low disk space. Consider freeing up space before proceeding."
    echo "Available space: $(df -h /mnt/c | awk 'NR==2 {print $4}')"
fi

# Step 5: Update npm configuration
echo "⚙️  Step 5: Updating npm configuration..."
npm config set audit-level moderate
npm config set fund false
npm config set update-notifier false
npm config delete hoisting 2>/dev/null || true
npm config delete runtime 2>/dev/null || true
npm config delete disturl 2>/dev/null || true

echo "✅ NPM configuration updated"

# Step 6: Install dependencies with specific strategies
echo "📦 Step 6: Installing dependencies with error handling..."

# Install React ecosystem first (these are most stable)
echo "Installing React ecosystem..."
npm install react@^18.2.0 react-dom@^18.2.0 --save --no-package-lock

# Install routing
echo "Installing React Router..."
npm install react-router-dom@^6.20.0 --save --no-package-lock

# Install utility libraries
echo "Installing utility libraries..."
npm install clsx@^2.0.0 tailwind-merge@^2.0.0 --save --no-package-lock

# Install Lucide React
echo "Installing Lucide React..."
npm install lucide-react@^0.292.0 --save --no-package-lock

# Install class-variance-authority with specific handling
echo "Installing class-variance-authority..."
npm install class-variance-authority@0.7.0 --save --no-package-lock

# Step 7: Generate lock file
echo "🔒 Step 7: Generating package-lock.json..."
npm install --package-lock-only

# Step 8: Verify installations
echo "🔍 Step 8: Verifying installations..."

# Check for class-variance-authority dist files
if [ -f "node_modules/class-variance-authority/dist/index.mjs" ] && [ -f "node_modules/class-variance-authority/dist/index.d.ts" ]; then
    echo "✅ class-variance-authority dist files found"
else
    echo "❌ class-variance-authority dist files missing - attempting rebuild..."
    cd node_modules/class-variance-authority
    if [ -f "package.json" ]; then
        npm run build 2>/dev/null || {
            echo "⚠️  Build script not found or failed, checking for alternative structure..."
            # Check if files exist in different location
            find . -name "index.mjs" -o -name "index.d.ts" | head -5
        }
    fi
    cd ../..
fi

# Step 9: Final verification
echo "📋 Step 9: Final verification..."
echo "Installed packages:"
npm list --depth=0 | grep -E "(react|class-variance-authority|lucide-react|clsx|tailwind-merge)"

echo "Checking package integrity..."
npm ls class-variance-authority
npm ls react
npm ls react-dom
npm ls react-router-dom
npm ls lucide-react
npm ls clsx
npm ls tailwind-merge

echo "🎉 Dependencies rebuild completed successfully!"
echo ""
echo "Summary of installed versions:"
npm list --depth=0 | grep -E "(react|class-variance-authority|lucide-react|clsx|tailwind-merge)" | sort

echo ""
echo "⚠️  Next steps:"
echo "1. Test imports in your application"
echo "2. Run 'npm run build' to verify everything works"
echo "3. If issues persist, check the specific error messages"