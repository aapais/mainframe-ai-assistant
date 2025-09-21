#!/bin/bash

# Screenshot Automation Script for Settings Modal Testing
# Requires: google-chrome or chromium-browser, ImageMagick (optional)

echo "🚀 Starting Settings Modal Screenshot Automation"
echo "================================================"

# Configuration
APP_URL="http://localhost:5173"
SCREENSHOT_DIR="/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Ensure screenshot directory exists
mkdir -p "$SCREENSHOT_DIR"

# Check if Chrome is available
if command -v google-chrome &> /dev/null; then
    CHROME_CMD="google-chrome"
elif command -v chromium-browser &> /dev/null; then
    CHROME_CMD="chromium-browser"
elif command -v chromium &> /dev/null; then
    CHROME_CMD="chromium"
else
    echo "❌ Chrome/Chromium not found. Please install Google Chrome or Chromium."
    echo "   Ubuntu/Debian: sudo apt install chromium-browser"
    echo "   Or download from: https://www.google.com/chrome/"
    exit 1
fi

echo "✅ Using browser: $CHROME_CMD"

# Check if application is running
echo "🔍 Checking if application is running..."
if curl -s --head "$APP_URL" | grep "200 OK" > /dev/null; then
    echo "✅ Application is running at $APP_URL"
else
    echo "❌ Application is not running at $APP_URL"
    echo "   Please start the application with: npm run dev"
    exit 1
fi

# Function to take screenshot
take_screenshot() {
    local name=$1
    local url=$2
    local wait_time=${3:-2}
    local output_file="$SCREENSHOT_DIR/${TIMESTAMP}_${name}.png"

    echo "📸 Taking screenshot: $name"

    $CHROME_CMD \
        --headless \
        --disable-gpu \
        --no-sandbox \
        --disable-dev-shm-usage \
        --window-size=1280,720 \
        --screenshot="$output_file" \
        "$url" \
        2>/dev/null

    if [ -f "$output_file" ]; then
        echo "   ✅ Saved: $output_file"
        return 0
    else
        echo "   ❌ Failed to capture screenshot"
        return 1
    fi
}

# Take screenshots
echo ""
echo "📸 Capturing Screenshots"
echo "------------------------"

# 1. Homepage
take_screenshot "homepage" "$APP_URL" 3

echo ""
echo "🎯 Manual Screenshots Needed:"
echo "------------------------------"
echo "For complete testing, please manually take these screenshots:"
echo ""
echo "1. 📱 Settings Button Location:"
echo "   - Open $APP_URL in browser"
echo "   - Locate and highlight the Settings button"
echo "   - Save as: settings-button-location.png"
echo ""
echo "2. 🎛️ Settings Modal Opened:"
echo "   - Click the Settings button"
echo "   - Take full modal screenshot"
echo "   - Save as: settings-modal-opened.png"
echo ""
echo "3. 🧭 Sidebar Navigation:"
echo "   - Ensure sidebar is expanded"
echo "   - Show different categories"
echo "   - Save as: sidebar-navigation.png"
echo ""
echo "4. 📍 Breadcrumb Navigation:"
echo "   - Navigate to a subsection"
echo "   - Show breadcrumb trail"
echo "   - Save as: breadcrumb-navigation.png"
echo ""
echo "5. 🔍 Search Functionality:"
echo "   - Focus on search bar"
echo "   - Type some text"
echo "   - Save as: search-functionality.png"
echo ""
echo "6. 📱 Mobile View (if applicable):"
echo "   - Resize browser to mobile width"
echo "   - Open Settings modal"
echo "   - Save as: mobile-responsive.png"
echo ""
echo "7. 💾 Footer Actions:"
echo "   - Highlight Save and Cancel buttons"
echo "   - Save as: footer-buttons.png"

# Generate automated browser command for manual testing
echo ""
echo "🚀 Quick Manual Testing:"
echo "------------------------"
echo "Run this command to open the application in a new browser window:"
echo ""
echo "$CHROME_CMD --new-window --window-size=1280,720 '$APP_URL'"
echo ""

# Test checklist reminder
echo "📋 Testing Checklist:"
echo "---------------------"
cat << 'EOF'
□ Application loads without errors
□ Settings button is visible and clickable
□ Settings modal opens when button is clicked
□ Sidebar navigation shows categories
□ Breadcrumb navigation is present at top
□ Search bar is available (header or sidebar)
□ Footer contains Save and Cancel buttons
□ Modal closes properly when Cancel is clicked
□ Mobile responsive design works correctly
□ All navigation functions work smoothly
EOF

echo ""
echo "📊 Test Results Location:"
echo "-------------------------"
echo "Screenshots saved in: $SCREENSHOT_DIR"
echo "Test report available: /mnt/c/mainframe-ai-assistant/tests/SETTINGS_MODAL_TEST_REPORT.md"
echo ""
echo "🎉 Screenshot automation completed!"
echo "   Remember to perform manual testing for interactive elements."