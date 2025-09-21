#!/bin/bash

# Emergency Cleanup Script for Node Dependencies
# Use this if the main rebuild script fails due to file locks or ENOTEMPTY errors

set -e

echo "🚨 Emergency cleanup script starting..."

# Kill all Node/Electron processes
echo "Killing all Node and Electron processes..."
pkill -f node || true
pkill -f electron || true
pkill -f npm || true
sleep 3

# Force remove node_modules with multiple strategies
echo "Force removing node_modules..."

if [ -d "node_modules" ]; then
    # Strategy 1: Standard removal
    rm -rf node_modules 2>/dev/null || {
        echo "Standard removal failed, trying alternative methods..."

        # Strategy 2: Remove files first, then directories
        find node_modules -type f -delete 2>/dev/null || true
        find node_modules -type d -empty -delete 2>/dev/null || true

        # Strategy 3: Force removal with different flags
        rm -rf node_modules 2>/dev/null || {
            echo "Still having issues, trying to change permissions..."

            # Strategy 4: Change permissions and try again
            chmod -R 755 node_modules 2>/dev/null || true
            rm -rf node_modules 2>/dev/null || true
        }
    }
fi

# Clean all possible lock files and caches
echo "Cleaning all lock files and caches..."
rm -f package-lock.json yarn.lock pnpm-lock.yaml
rm -rf ~/.npm
rm -rf /tmp/npm-*
rm -rf .npm

# Clear system temp files related to npm
echo "Clearing system temporary files..."
find /tmp -name "*npm*" -exec rm -rf {} \; 2>/dev/null || true
find /var/tmp -name "*npm*" -exec rm -rf {} \; 2>/dev/null || true

# Reset npm cache completely
echo "Resetting npm cache..."
npm cache clean --force 2>/dev/null || true
npm config delete cache 2>/dev/null || true
npm config set cache ~/.npm-new 2>/dev/null || true

# Verify cleanup
echo "Verifying cleanup..."
if [ -d "node_modules" ]; then
    echo "❌ node_modules still exists - manual intervention required"
    ls -la node_modules/ | head -10
else
    echo "✅ node_modules successfully removed"
fi

if [ -f "package-lock.json" ]; then
    echo "❌ package-lock.json still exists"
else
    echo "✅ package-lock.json removed"
fi

echo "🎯 Emergency cleanup completed. You can now run the main rebuild script."