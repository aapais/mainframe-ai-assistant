#!/bin/bash

# Script to identify orphaned components
DEFINITELY_ORPHANED=()
POSSIBLY_ORPHANED=()
KEEP=()

echo "=== COMPREHENSIVE ORPHANED COMPONENT ANALYSIS ==="

check_component() {
    local file=$1
    local component=$(basename "$file" .tsx)
    local dir=$(dirname "$file")

    # Skip test files
    if [[ "$file" == *"test"* ]] || [[ "$file" == *"__tests__"* ]]; then
        return
    fi

    echo "Checking: $component"

    # Check for imports (excluding self-references)
    local imports=$(grep -r "import.*$component" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "$file:" | wc -l)
    local tests_only=$(grep -r "import.*$component" src/tests tests/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
    local examples_only=$(grep -r "import.*$component" src/examples/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)

    if [ "$imports" -eq 0 ]; then
        DEFINITELY_ORPHANED+=("$file")
        echo "  ❌ DEFINITELY ORPHANED: 0 imports"
    elif [ "$imports" -eq "$tests_only" ] || [ "$imports" -eq "$examples_only" ]; then
        POSSIBLY_ORPHANED+=("$file")
        echo "  ⚠️  POSSIBLY ORPHANED: Only in tests/examples"
    else
        KEEP+=("$file")
        echo "  ✅ KEEP: $imports production imports"
    fi
}

# Check search directory
echo -e "\n=== SEARCH DIRECTORY ==="
for file in src/renderer/components/search/*.tsx; do
    if [ -f "$file" ]; then
        check_component "$file"
    fi
done

# Check layout directory
echo -e "\n=== LAYOUT DIRECTORY ==="
for file in src/renderer/components/layout/*.tsx; do
    if [ -f "$file" ]; then
        check_component "$file"
    fi
done

# Check common directory
echo -e "\n=== COMMON DIRECTORY ==="
for file in src/renderer/components/common/*.tsx; do
    if [ -f "$file" ]; then
        check_component "$file"
    fi
done

# Check performance directory
echo -e "\n=== PERFORMANCE DIRECTORY ==="
for file in src/renderer/components/performance/*.tsx; do
    if [ -f "$file" ]; then
        check_component "$file"
    fi
done

# Check forms directory
echo -e "\n=== FORMS DIRECTORY ==="
for file in src/renderer/components/forms/*.tsx; do
    if [ -f "$file" ]; then
        check_component "$file"
    fi
done

# Print summary
echo -e "\n\n=== SUMMARY REPORT ==="
echo "DEFINITELY ORPHANED (${#DEFINITELY_ORPHANED[@]} components):"
for comp in "${DEFINITELY_ORPHANED[@]}"; do
    echo "  - $comp"
done

echo -e "\nPOSSIBLY ORPHANED (${#POSSIBLY_ORPHANED[@]} components):"
for comp in "${POSSIBLY_ORPHANED[@]}"; do
    echo "  - $comp"
done

echo -e "\nKEEP (${#KEEP[@]} components):"
for comp in "${KEEP[@]}"; do
    echo "  - $comp"
done

echo -e "\nTotal components analyzed: $((${#DEFINITELY_ORPHANED[@]} + ${#POSSIBLY_ORPHANED[@]} + ${#KEEP[@]}))"