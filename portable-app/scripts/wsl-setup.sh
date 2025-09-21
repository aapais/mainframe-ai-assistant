#!/bin/bash
# WSL2 Configuration Setup Script for mainframe-ai-assistant
# This script configures WSL2 for optimal file operations with Windows filesystem

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== WSL2 Configuration Setup ===${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in WSL
if [[ ! -f /proc/sys/fs/binfmt_misc/WSLInterop ]]; then
    print_error "This script must be run in WSL2"
    exit 1
fi

print_status "Current WSL version: $(cat /proc/version | grep -o 'Microsoft.*')"

# Backup current wsl.conf
if [[ -f /etc/wsl.conf ]]; then
    print_status "Backing up current /etc/wsl.conf"
    sudo cp /etc/wsl.conf /etc/wsl.conf.backup.$(date +%Y%m%d_%H%M%S)
fi

# Create optimized WSL configuration
print_status "Creating optimized WSL configuration..."
sudo tee /etc/wsl.conf > /dev/null << 'EOF'
[boot]
systemd=true

[user]
default=andreapais

[automount]
enabled=true
root=/mnt/
options="metadata,uid=1000,gid=1000,umask=022,fmask=11,case=off"
mountFsTab=false

[network]
generateHosts=true
generateResolvConf=true

[interop]
enabled=true
appendWindowsPath=true

[filesystem]
umask=0022
EOF

# Configure npm for WSL2/Windows filesystem
print_status "Configuring npm for WSL2..."

# Set npm cache to WSL filesystem for better performance
npm config set cache "/home/andreapais/.npm-cache"

# Configure npm for Windows filesystem compatibility
npm config set script-shell "/bin/bash"
npm config set unsafe-perm true

# Create .npmrc in project root with Windows-compatible settings
cat > /mnt/c/mainframe-ai-assistant/.npmrc << 'EOF'
# npm configuration for WSL2/Windows filesystem compatibility
audit=false
fund=false
progress=true
strict-peer-deps=false
legacy-peer-deps=true

# Performance optimizations
prefer-offline=true
cache-max=864000000

# Windows filesystem compatibility
script-shell=/bin/bash
unsafe-perm=true
EOF

print_status "npm configuration updated"

# Test file operations
print_status "Testing file operations..."
TEST_FILE="/mnt/c/mainframe-ai-assistant/.wsl-test-$(date +%s)"
if touch "$TEST_FILE" && rm "$TEST_FILE"; then
    print_status "File operations test: PASSED"
else
    print_error "File operations test: FAILED"
fi

# Create Windows Defender exclusion script
print_status "Creating Windows Defender exclusion script..."
cat > /mnt/c/mainframe-ai-assistant/scripts/setup-windows-defender.ps1 << 'EOF'
# PowerShell script to configure Windows Defender exclusions for WSL2 development
# Run this script as Administrator in PowerShell

Write-Host "Configuring Windows Defender exclusions for WSL2 development..." -ForegroundColor Green

# Exclude WSL2 VM files and distributions
Add-MpPreference -ExclusionPath "$env:USERPROFILE\AppData\Local\Packages\*CanonicalGroupLimited*"
Add-MpPreference -ExclusionPath "$env:USERPROFILE\AppData\Local\Docker"
Add-MpPreference -ExclusionPath "\\wsl$"

# Exclude project directory
Add-MpPreference -ExclusionPath "C:\mainframe-ai-assistant"

# Exclude common development processes
Add-MpPreference -ExclusionProcess "node.exe"
Add-MpPreference -ExclusionProcess "npm.exe"
Add-MpPreference -ExclusionProcess "wsl.exe"
Add-MpPreference -ExclusionProcess "wslhost.exe"

# Exclude development file extensions
$extensions = @(".js", ".ts", ".json", ".md", ".yml", ".yaml", ".lock")
foreach ($ext in $extensions) {
    Add-MpPreference -ExclusionExtension $ext
}

Write-Host "Windows Defender exclusions configured successfully!" -ForegroundColor Green
Write-Host "Please restart Windows for changes to take full effect." -ForegroundColor Yellow
EOF

chmod +x /mnt/c/mainframe-ai-assistant/scripts/setup-windows-defender.ps1

print_status "Setup scripts created successfully!"

echo -e "${BLUE}=== Next Steps ===${NC}"
print_warning "1. Exit WSL and restart it for configuration changes to take effect:"
print_warning "   - In PowerShell: wsl --shutdown"
print_warning "   - Then restart WSL"
print_warning ""
print_warning "2. Run Windows Defender exclusion script as Administrator in PowerShell:"
print_warning "   cd C:\\mainframe-ai-assistant\\scripts"
print_warning "   .\\setup-windows-defender.ps1"
print_warning ""
print_warning "3. Optionally restart Windows for full effect"

print_status "WSL2 configuration setup completed!"