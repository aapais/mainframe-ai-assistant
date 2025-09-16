#!/bin/bash

echo "🚀 Starting Complete Dependency Fix Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Clean environment
print_status "Step 1: Cleaning environment..."
rm -rf node_modules package-lock.json
npm cache clean --force

# Step 2: Install core dependencies
print_status "Step 2: Installing core dependencies..."
npm install --save \
  zod \
  uuid \
  axios \
  express \
  @types/uuid \
  @types/express \
  @types/node \
  @types/react \
  @types/react-dom

# Step 3: Install Electron dependencies
print_status "Step 3: Installing Electron dependencies..."
npm install --save-dev \
  electron \
  electron-builder \
  @electron/rebuild

# Step 4: Install build tools
print_status "Step 4: Installing build tools..."
npm install --save-dev \
  typescript \
  vite \
  @vitejs/plugin-react \
  concurrently

# Step 5: Install missing dependencies detected from errors
print_status "Step 5: Installing additional detected dependencies..."
npm install --save \
  react \
  react-dom \
  react-router-dom \
  sqlite3 \
  better-sqlite3

# Step 6: Rebuild native modules
print_status "Step 6: Rebuilding native modules..."
npm rebuild

# Special handling for better-sqlite3
if [ -d "node_modules/better-sqlite3" ]; then
    print_status "Rebuilding better-sqlite3..."
    cd node_modules/better-sqlite3
    npm run build-release || print_warning "better-sqlite3 rebuild had issues"
    cd ../..
fi

# Step 7: Run electron-rebuild
print_status "Step 7: Running electron-rebuild..."
npx electron-rebuild || print_warning "Electron rebuild had issues"

# Step 8: Fix vulnerabilities
print_status "Step 8: Checking for vulnerabilities..."
npm audit fix || print_warning "Some vulnerabilities could not be auto-fixed"

# Step 9: Verify installation
print_status "Step 9: Verifying installation..."
npm ls --depth=0

# Step 10: Test build
print_status "Step 10: Testing build..."
npm run build:main || print_warning "Main build has issues"
npm run build:renderer || print_warning "Renderer build has issues"

echo ""
echo "========================================="
echo "🎉 Dependency Fix Script Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Run 'npm run build' to test the complete build"
echo "2. Run 'npm run typecheck' to check for TypeScript errors"
echo "3. Run 'npm test' to run tests"
echo ""
echo "If you still have issues, try:"
echo "  - Deleting node_modules and package-lock.json again"
echo "  - Running 'npm cache clean --force'"
echo "  - Running this script again"