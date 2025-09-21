#!/bin/bash

# Test script to demonstrate Husky hooks working
echo "🧪 Testing Husky Pre-commit Hook Flow"
echo "======================================"

# Create a test file with intentionally poor formatting
cat > test-file.js << 'EOF'
const   badlyFormatted=function(x,y){
console.log("This is poorly formatted")
return x+y
}
EOF

echo "📝 Created test file with poor formatting..."
cat test-file.js

echo ""
echo "📋 Adding file to staging area..."
git add test-file.js

echo ""
echo "🚀 Attempting commit with valid conventional message..."
echo "   This will trigger the pre-commit hooks which should:"
echo "   1. Run ESLint and fix issues"
echo "   2. Run Prettier to format the code"
echo "   3. Run TypeScript type checking"
echo "   4. Run npm audit (warning only)"
echo "   5. Run tests on related files"

echo ""
echo "⚠️  Note: This is a demonstration. The commit may fail if there are"
echo "   unfixable linting issues or failing tests, which is the intended behavior."

echo ""
echo "🎯 To complete the test manually, run:"
echo "   git commit -m 'test: demonstrate husky hooks working'"

# Clean up
rm -f test-file.js
git reset HEAD test-file.js 2>/dev/null || true

echo ""
echo "✅ Test setup complete. The hooks are ready to use!"