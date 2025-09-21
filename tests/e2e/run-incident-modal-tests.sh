#!/bin/bash

# CreateIncidentModal Playwright Test Runner
# Executes comprehensive UI/UX and accessibility tests

set -e

echo "🚀 CreateIncidentModal Test Runner"
echo "=================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed or not in PATH${NC}"
    exit 1
fi

# Check if Playwright is installed
if ! npm list @playwright/test &> /dev/null; then
    echo -e "${YELLOW}⚠️ Playwright not found, installing...${NC}"
    npm install @playwright/test
fi

# Check if browsers are installed
if ! npx playwright --version &> /dev/null; then
    echo -e "${YELLOW}⚠️ Installing Playwright browsers...${NC}"
    npx playwright install
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating test directories...${NC}"
mkdir -p tests/playwright/screenshots
mkdir -p tests/playwright/reports/accessibility
mkdir -p tests/playwright/results
mkdir -p tests/test-results

# Set environment variables
export NODE_ENV=test
export BASE_URL=${BASE_URL:-"http://localhost:5173"}
export API_URL=${API_URL:-"http://localhost:3001/api"}

echo -e "${BLUE}🌐 Test Environment:${NC}"
echo "   BASE_URL: $BASE_URL"
echo "   API_URL: $API_URL"
echo "   NODE_ENV: $NODE_ENV"
echo ""

# Function to run tests with specific configuration
run_tests() {
    local config_file=$1
    local description=$2
    local project_filter=$3

    echo -e "${BLUE}🧪 Running: $description${NC}"
    echo "   Config: $config_file"
    if [ ! -z "$project_filter" ]; then
        echo "   Project: $project_filter"
    fi
    echo ""

    if [ ! -z "$project_filter" ]; then
        npx playwright test --config="$config_file" --project="$project_filter" || {
            echo -e "${RED}❌ Tests failed for $description${NC}"
            return 1
        }
    else
        npx playwright test --config="$config_file" || {
            echo -e "${RED}❌ Tests failed for $description${NC}"
            return 1
        }
    fi

    echo -e "${GREEN}✅ Completed: $description${NC}"
    echo ""
}

# Parse command line arguments
MODE=${1:-"all"}
PROJECT=${2:-""}

case $MODE in
    "all")
        echo -e "${BLUE}🔄 Running all CreateIncidentModal tests...${NC}"
        echo ""

        # Desktop tests
        run_tests "tests/e2e/incident-modal.config.ts" "Desktop Tests (Chromium)" "chromium-desktop"

        # Large screen tests
        run_tests "tests/e2e/incident-modal.config.ts" "Large Screen Tests" "chromium-large"

        # Mobile tests
        run_tests "tests/e2e/incident-modal.config.ts" "Mobile Tests" "mobile"

        # Tablet tests
        run_tests "tests/e2e/incident-modal.config.ts" "Tablet Tests" "tablet"

        # Accessibility tests
        run_tests "tests/e2e/incident-modal.config.ts" "Accessibility Tests (Firefox)" "firefox-accessibility"

        # High contrast tests
        run_tests "tests/e2e/incident-modal.config.ts" "High Contrast Tests" "high-contrast"

        # Performance tests
        run_tests "tests/e2e/incident-modal.config.ts" "Performance Tests" "performance"
        ;;

    "desktop")
        echo -e "${BLUE}🖥️ Running desktop tests only...${NC}"
        run_tests "tests/e2e/incident-modal.config.ts" "Desktop Tests" "chromium-desktop"
        ;;

    "mobile")
        echo -e "${BLUE}📱 Running mobile tests only...${NC}"
        run_tests "tests/e2e/incident-modal.config.ts" "Mobile Tests" "mobile"
        ;;

    "accessibility")
        echo -e "${BLUE}♿ Running accessibility tests only...${NC}"
        run_tests "tests/e2e/incident-modal.config.ts" "Accessibility Tests" "firefox-accessibility"
        run_tests "tests/e2e/incident-modal.config.ts" "High Contrast Tests" "high-contrast"
        ;;

    "performance")
        echo -e "${BLUE}🚀 Running performance tests only...${NC}"
        run_tests "tests/e2e/incident-modal.config.ts" "Performance Tests" "performance"
        ;;

    "quick")
        echo -e "${BLUE}⚡ Running quick test suite...${NC}"
        run_tests "tests/e2e/incident-modal.config.ts" "Quick Tests" "chromium-desktop"
        ;;

    "debug")
        echo -e "${BLUE}🐛 Running tests in debug mode...${NC}"
        npx playwright test --config="tests/e2e/incident-modal.config.ts" --debug --project="chromium-desktop"
        ;;

    "headed")
        echo -e "${BLUE}👀 Running tests with browser UI...${NC}"
        npx playwright test --config="tests/e2e/incident-modal.config.ts" --headed --project="chromium-desktop"
        ;;

    *)
        echo -e "${RED}❌ Unknown mode: $MODE${NC}"
        echo ""
        echo "Available modes:"
        echo "  all          - Run all test suites (default)"
        echo "  desktop      - Desktop browser tests only"
        echo "  mobile       - Mobile device tests only"
        echo "  accessibility- Accessibility and contrast tests"
        echo "  performance  - Performance and load tests"
        echo "  quick        - Quick smoke tests"
        echo "  debug        - Run tests in debug mode"
        echo "  headed       - Run tests with visible browser"
        echo ""
        echo "Usage: $0 [mode] [project]"
        echo "Example: $0 accessibility"
        echo "Example: $0 desktop chromium-large"
        exit 1
        ;;
esac

# Generate final report
echo -e "${BLUE}📊 Generating test reports...${NC}"

# Check if reports were generated
if [ -f "tests/playwright/reports/accessibility/accessibility-report.html" ]; then
    echo -e "${GREEN}✅ Accessibility report: tests/playwright/reports/accessibility/accessibility-report.html${NC}"
fi

if [ -f "tests/playwright/reports/incident-modal/index.html" ]; then
    echo -e "${GREEN}✅ HTML report: tests/playwright/reports/incident-modal/index.html${NC}"
fi

if [ -f "tests/playwright/reports/TEST_SUMMARY.md" ]; then
    echo -e "${GREEN}✅ Summary report: tests/playwright/reports/TEST_SUMMARY.md${NC}"
fi

# Show screenshot directory
if [ -d "tests/playwright/screenshots" ] && [ "$(ls -A tests/playwright/screenshots)" ]; then
    echo -e "${GREEN}📸 Screenshots saved to: tests/playwright/screenshots/${NC}"
    echo "   Available screenshots:"
    ls -la tests/playwright/screenshots/ | grep ".png" | awk '{print "     " $9}'
fi

echo ""
echo -e "${GREEN}🎉 CreateIncidentModal testing completed!${NC}"
echo ""

# Optional: Open reports automatically
if command -v xdg-open &> /dev/null && [ "$DISPLAY" != "" ]; then
    read -p "Open HTML report in browser? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "tests/playwright/reports/incident-modal/index.html" ]; then
            xdg-open "tests/playwright/reports/incident-modal/index.html"
        fi
        if [ -f "tests/playwright/reports/accessibility/accessibility-report.html" ]; then
            xdg-open "tests/playwright/reports/accessibility/accessibility-report.html"
        fi
    fi
fi