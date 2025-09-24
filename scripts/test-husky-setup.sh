#!/bin/bash

echo "🧪 Testing Husky Pre-commit Hook Setup"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Test 1: Check if Husky is installed
echo "1. Checking Husky installation..."
if command -v npx husky >/dev/null 2>&1; then
    print_status 0 "Husky is installed"
else
    print_status 1 "Husky is not installed"
    exit 1
fi

# Test 2: Check if .husky directory exists
echo "2. Checking .husky directory..."
if [ -d ".husky" ]; then
    print_status 0 ".husky directory exists"
else
    print_status 1 ".husky directory not found"
    exit 1
fi

# Test 3: Check if pre-commit hook exists and is executable
echo "3. Checking pre-commit hook..."
if [ -f ".husky/pre-commit" ] && [ -x ".husky/pre-commit" ]; then
    print_status 0 "pre-commit hook exists and is executable"
else
    print_status 1 "pre-commit hook missing or not executable"
    exit 1
fi

# Test 4: Check if commit-msg hook exists and is executable
echo "4. Checking commit-msg hook..."
if [ -f ".husky/commit-msg" ] && [ -x ".husky/commit-msg" ]; then
    print_status 0 "commit-msg hook exists and is executable"
else
    print_status 1 "commit-msg hook missing or not executable"
    exit 1
fi

# Test 5: Check if lint-staged is configured
echo "5. Checking lint-staged configuration..."
if grep -q "lint-staged" package.json; then
    print_status 0 "lint-staged is configured in package.json"
else
    print_status 1 "lint-staged configuration not found in package.json"
    exit 1
fi

# Test 6: Check if commitlint is configured
echo "6. Checking commitlint configuration..."
if [ -f ".commitlintrc.js" ]; then
    print_status 0 "commitlint configuration exists"
else
    print_status 1 "commitlint configuration not found"
    exit 1
fi

# Test 7: Check if ESLint configuration exists
echo "7. Checking ESLint configuration..."
if [ -f ".eslintrc.js" ]; then
    print_status 0 "ESLint configuration exists"
else
    print_status 1 "ESLint configuration not found"
    exit 1
fi

# Test 8: Check if Prettier configuration exists
echo "8. Checking Prettier configuration..."
if [ -f ".prettierrc.js" ]; then
    print_status 0 "Prettier configuration exists"
else
    print_status 1 "Prettier configuration not found"
    exit 1
fi

# Test 9: Test commitlint with a valid message
echo "9. Testing commitlint with valid commit message..."
echo "feat: add new feature" | npx commitlint >/dev/null 2>&1
if [ $? -eq 0 ]; then
    print_status 0 "commitlint accepts valid commit messages"
else
    print_status 1 "commitlint failed with valid commit message"
fi

# Test 10: Test commitlint with an invalid message
echo "10. Testing commitlint with invalid commit message..."
echo "invalid commit message" | npx commitlint >/dev/null 2>&1
if [ $? -ne 0 ]; then
    print_status 0 "commitlint rejects invalid commit messages"
else
    print_status 1 "commitlint should reject invalid commit messages"
fi

echo ""
echo "🎉 Husky setup test completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Try making a commit to test the hooks in action"
echo "   2. Use conventional commit format: 'feat: description'"
echo "   3. Ensure your code passes linting before committing"
echo ""
print_warning "Note: The pre-commit hook will run ESLint, Prettier, TypeScript checks, and tests"
print_warning "Make sure your staged files are properly formatted and pass all checks"