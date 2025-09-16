#!/bin/bash

# Script to fix corrupted TypeScript files with literal \n characters

echo "🔧 Fixing corrupted TypeScript files..."

# Fix CacheMetrics.ts
if [ -f "src/monitoring/CacheMetrics.ts" ]; then
    echo "Fixing src/monitoring/CacheMetrics.ts..."
    # Replace literal \n with actual newlines
    sed -i 's/\\n/\
/g' src/monitoring/CacheMetrics.ts
    echo "✅ Fixed CacheMetrics.ts"
fi

# Fix other potentially corrupted files
for file in src/jobs/cacheMaintenance.ts src/middleware/cacheMiddleware.ts; do
    if [ -f "$file" ]; then
        if grep -q '\\n' "$file"; then
            echo "Fixing $file..."
            sed -i 's/\\n/\
/g' "$file"
            echo "✅ Fixed $file"
        fi
    fi
done

echo "✅ File corruption fixes complete"