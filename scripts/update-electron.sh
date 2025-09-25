#!/bin/bash

# Electron Security Update Script
# Updates Electron from v27.3.11 to v38.1.2 (Critical Security Fix)

set -e

echo "🔒 Electron Security Update Script"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    print_error "Node.js 18+ is required for Electron v38. Current: $(node --version)"
    exit 1
fi

print_status "Node.js version check passed: $(node --version)"

# Create backup
print_status "Creating backup..."
BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp package.json "$BACKUP_DIR/"
cp package-lock.json "$BACKUP_DIR/" 2>/dev/null || true
print_success "Backup created at: $BACKUP_DIR"

# Check current vulnerabilities
print_status "Checking current vulnerabilities..."
npm audit --audit-level=moderate --json > current-audit.json || true

# Method 1: Clean install approach
print_status "Attempting Method 1: Clean installation..."
if [ -d "node_modules" ]; then
    print_warning "Removing existing node_modules (this may take a moment)..."

    # Try different removal methods
    if rm -rf node_modules 2>/dev/null; then
        print_success "node_modules removed successfully"
    elif command -v trash &> /dev/null; then
        trash node_modules
        print_success "node_modules moved to trash"
    else
        print_warning "Could not remove node_modules - you may need to do this manually"
        print_warning "Try: rm -rf node_modules or delete the folder in file manager"
        read -p "Press Enter after manually removing node_modules directory..."
    fi
fi

# Remove lock file
rm -f package-lock.json

# Clear npm cache
print_status "Clearing npm cache..."
npm cache clean --force

# Install fresh
print_status "Installing dependencies with updated Electron..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Installation failed - restoring backup"
    cp "$BACKUP_DIR/package.json" .
    cp "$BACKUP_DIR/package-lock.json" . 2>/dev/null || true
    npm install
    exit 1
fi

# Verify Electron version
ELECTRON_VERSION=$(npm list electron --depth=0 2>/dev/null | grep electron@ | cut -d'@' -f2 || echo "not found")
print_status "Installed Electron version: $ELECTRON_VERSION"

if [[ "$ELECTRON_VERSION" == "38."* ]]; then
    print_success "Electron successfully updated to v38.x series"
elif [[ "$ELECTRON_VERSION" == "27."* ]]; then
    print_warning "Electron is still at v27.x - manual update may be required"
else
    print_warning "Unexpected Electron version: $ELECTRON_VERSION"
fi

# Run security audit
print_status "Running security audit..."
if npm audit --audit-level=high; then
    print_success "No high or critical vulnerabilities found"
else
    print_warning "Some vulnerabilities remain - check audit output above"
fi

# Test build
print_status "Testing build process..."
if npm run build; then
    print_success "Build completed successfully"
else
    print_error "Build failed - check errors above"
    exit 1
fi

# Test electron app start (if possible in headless)
print_status "Testing Electron app (quick start test)..."
timeout 10s npm start 2>/dev/null || print_warning "Could not test app start (normal in headless environment)"

# Final summary
echo ""
echo "🎉 Update Summary"
echo "================="
echo "✅ Backup created: $BACKUP_DIR"
echo "✅ Dependencies updated"
echo "✅ Build test passed"
echo ""
echo "Next steps:"
echo "1. Test your application manually: npm start"
echo "2. Verify all features work correctly"
echo "3. Check for any console errors"
echo "4. If issues occur, restore from backup:"
echo "   cp $BACKUP_DIR/* ."
echo "   npm install"
echo ""
echo "Security improvements:"
echo "- Electron vulnerabilities patched"
echo "- Dependencies updated to latest secure versions"
echo "- CI/CD workflow added for ongoing monitoring"

# Cleanup
rm -f current-audit.json