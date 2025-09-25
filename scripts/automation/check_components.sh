#!/bin/bash

echo "=== EXHAUSTIVE COMPONENT USAGE CHECK ==="

# Get all component files (excluding old, tests, and node_modules)
find /mnt/c/mainframe-ai-assistant/src/renderer/components -name "*.tsx" -not -path "*/old/*" -not -path "*/__tests__/*" -not -name "*.test.*" | while read -r file; do
    component_name=$(basename "$file" .tsx)

    # Count imports of this component
    import_count=$(grep -r "import.*$component_name" /mnt/c/mainframe-ai-assistant/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)

    # Show component and usage count
    echo "$component_name: $import_count uses"

    # If 0 uses, add to list
    if [ "$import_count" -eq 0 ]; then
        echo "   UNUSED: $file"
    fi
done