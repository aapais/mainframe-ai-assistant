#!/bin/bash

# Performance Test Suite Runner
# Comprehensive performance and load testing script

set -e

echo "🚀 Starting Comprehensive Performance Test Suite"
echo "=================================================="
echo "Timestamp: $(date)"
echo "Node.js version: $(node --version)"
echo "Platform: $(uname -s) $(uname -m)"
echo "Available memory: $(free -h | grep '^Mem:' | awk '{print $2}' 2>/dev/null || echo 'N/A')"
echo ""

# Check if required dependencies are available
echo "🔍 Checking dependencies..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Run from project root."
    exit 1
fi

echo "✅ Dependencies check passed"
echo ""

# Set up environment variables for performance testing
export NODE_ENV=test
export FORCE_COLOR=1

# Enable garbage collection for memory testing (if available)
export NODE_OPTIONS="--expose-gc --max-old-space-size=4096"

echo "🧪 Running comprehensive performance tests..."
echo ""

# Run the comprehensive performance test suite
if npm run test:performance:comprehensive; then
    echo ""
    echo "✅ Performance test suite completed successfully!"
    echo ""
    echo "📊 Results summary:"
    echo "- Detailed report: tests/integration/performance-report.md"
    echo "- Raw data: tests/integration/performance-results.json"
    echo ""
    echo "💡 To view the report:"
    echo "  cat tests/integration/performance-report.md"
    echo ""
else
    echo ""
    echo "❌ Performance test suite failed!"
    echo ""
    echo "🔍 Check the logs above for details"
    echo "📄 Partial results may be available in tests/integration/"
    exit 1
fi

echo "🎉 Performance testing complete!"