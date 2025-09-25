#!/bin/bash

# Script to check usage of ALL components
echo "=== EXHAUSTIVE COMPONENT USAGE CHECK ==="
echo ""

# Array to store results
UNUSED_COMPONENTS=()
EXAMPLE_COMPONENTS=()
POSSIBLY_UNUSED=()

# Function to check component usage
check_component() {
    local file_path="$1"
    local component_name=$(basename "$file_path" .tsx)
    local component_dir=$(dirname "$file_path")

    # Skip certain files
    if [[ "$file_path" == *"/old/"* ]] || [[ "$file_path" == *".test."* ]] || [[ "$file_path" == *"__tests__"* ]]; then
        return
    fi

    # Check for imports
    local import_count=$(grep -r "import.*$component_name" /mnt/c/mainframe-ai-assistant/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)

    # Also check for dynamic imports and require statements
    local dynamic_import_count=$(grep -r "import.*$component_name" /mnt/c/mainframe-ai-assistant/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
    local require_count=$(grep -r "require.*$component_name" /mnt/c/mainframe-ai-assistant/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)

    local total_usage=$((import_count + dynamic_import_count + require_count))

    echo "Checking: $component_name (in $component_dir) - Usage: $total_usage"

    # Categorize based on usage and path
    if [[ "$file_path" == *"/examples/"* ]] || [[ "$component_name" == *"Example"* ]] || [[ "$component_name" == *"Demo"* ]]; then
        EXAMPLE_COMPONENTS+=("$file_path")
    elif [[ $total_usage -eq 0 ]]; then
        UNUSED_COMPONENTS+=("$file_path")
    elif [[ $total_usage -eq 1 ]]; then
        # Only self-reference, check if it's actually used
        local self_import=$(grep -r "import.*$component_name" "$file_path" 2>/dev/null | wc -l)
        if [[ $self_import -eq $total_usage ]]; then
            POSSIBLY_UNUSED+=("$file_path")
        fi
    fi
}

echo "Scanning all component files..."
echo ""

# Find all component files and check each one
while IFS= read -r -d '' file; do
    check_component "$file"
done < <(find /mnt/c/mainframe-ai-assistant/src/renderer/components -name "*.tsx" -not -path "*/old/*" -not -path "*/__tests__/*" -not -name "*.test.*" -print0)

# Also check examples directory
while IFS= read -r -d '' file; do
    check_component "$file"
done < <(find /mnt/c/mainframe-ai-assistant/src/examples -name "*.tsx" 2>/dev/null -print0)

echo ""
echo "=== RESULTS ==="
echo ""

echo "1. DEFINITELY UNUSED COMPONENTS (${#UNUSED_COMPONENTS[@]} found):"
for component in "${UNUSED_COMPONENTS[@]}"; do
    echo "   - $component"
done

echo ""
echo "2. EXAMPLE/DEMO COMPONENTS (${#EXAMPLE_COMPONENTS[@]} found):"
for component in "${EXAMPLE_COMPONENTS[@]}"; do
    echo "   - $component"
done

echo ""
echo "3. POSSIBLY UNUSED (only self-reference) (${#POSSIBLY_UNUSED[@]} found):"
for component in "${POSSIBLY_UNUSED[@]}"; do
    echo "   - $component"
done

echo ""
echo "Total potentially unused: $((${#UNUSED_COMPONENTS[@]} + ${#EXAMPLE_COMPONENTS[@]} + ${#POSSIBLY_UNUSED[@]}))"