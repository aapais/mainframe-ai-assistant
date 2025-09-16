#!/bin/bash

# Script to fix formatting issues in TypeScript files
echo "Fixing cacheController.ts formatting..."

# Fix the malformed cacheController.ts by reformatting it properly
if [ -f "src/api/cache/cacheController.ts" ]; then
    # Use sed to fix the problematic line by adding proper line breaks
    sed -i 's/}    \/\*\*/}\n\n  \/\*\*/g' src/api/cache/cacheController.ts
    sed -i 's/\*\/   async/\*\/\n  async/g' src/api/cache/cacheController.ts
    sed -i 's/;     try/;\n    try/g' src/api/cache/cacheController.ts
    sed -i 's/;       const/;\n      const/g' src/api/cache/cacheController.ts
    sed -i 's/;              /;\n\n      /g' src/api/cache/cacheController.ts
    echo "cacheController.ts formatting fixed"
fi

# Check if csstype is corrupted
if [ -f "node_modules/csstype/index.d.ts" ]; then
    echo "Checking csstype integrity..."
    # Look for syntax errors
    if grep -q "export.*Globals.*string.*{}" node_modules/csstype/index.d.ts; then
        echo "csstype appears to be correctly formatted"
    else
        echo "csstype may be corrupted"
    fi
fi

echo "Format fixes complete"