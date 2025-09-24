#!/bin/bash

# TypeScript Testing Framework - Test Runner Script
# Comprehensive script for running TypeScript type tests in various modes

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="$PROJECT_ROOT/tests/typescript"
REPORTS_DIR="$PROJECT_ROOT/reports/typescript"
CONFIG_DIR="$TESTS_DIR/config"

# Default values
MODE="all"
ENVIRONMENT="development"
COVERAGE=true
WATCH=false
PARALLEL=true
VERBOSE=false
OUTPUT_FORMAT="json"
TIMEOUT=300

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show help
show_help() {
    cat << EOF
TypeScript Testing Framework - Test Runner

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -m, --mode MODE         Test mode: all, unit, integration, e2e (default: all)
    -e, --env ENV           Environment: development, production, ci (default: development)
    -c, --coverage          Enable coverage reporting (default: true)
    -w, --watch             Watch mode for development (default: false)
    -p, --parallel          Enable parallel test execution (default: true)
    -v, --verbose           Verbose output (default: false)
    -f, --format FORMAT     Output format: json, html, markdown (default: json)
    -t, --timeout SECONDS   Test timeout in seconds (default: 300)
    --no-coverage           Disable coverage reporting
    --no-parallel           Disable parallel execution
    -h, --help              Show this help message

EXAMPLES:
    $0                                    # Run all tests in development mode
    $0 --mode unit --env ci               # Run unit tests in CI environment
    $0 --watch --no-coverage              # Watch mode without coverage
    $0 --env production --format html     # Production tests with HTML report

ENVIRONMENT VARIABLES:
    CI                      Set to 'true' for CI mode
    NODE_ENV               Node environment (development/production/test)
    JEST_WORKERS           Number of Jest workers (default: auto)
    COVERAGE_THRESHOLD     Coverage threshold percentage (default: 80)
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        --no-coverage)
            COVERAGE=false
            shift
            ;;
        -w|--watch)
            WATCH=true
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        --no-parallel)
            PARALLEL=false
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16 or higher is required (current: $(node --version))"
        exit 1
    fi
    print_success "Node.js version: $(node --version)"

    # Check npm/yarn
    if command -v yarn &> /dev/null; then
        PACKAGE_MANAGER="yarn"
        print_success "Package manager: yarn"
    elif command -v npm &> /dev/null; then
        PACKAGE_MANAGER="npm"
        print_success "Package manager: npm"
    else
        print_error "No package manager found (npm or yarn required)"
        exit 1
    fi

    # Check TypeScript
    if ! command -v npx tsc &> /dev/null; then
        print_error "TypeScript is not installed"
        exit 1
    fi
    print_success "TypeScript version: $(npx tsc --version)"

    # Check Jest
    if [ ! -f "$PROJECT_ROOT/node_modules/.bin/jest" ]; then
        print_error "Jest is not installed. Run 'npm install' or 'yarn install'"
        exit 1
    fi
    print_success "Jest found"
}

# Function to setup environment
setup_environment() {
    print_info "Setting up test environment..."

    # Create reports directory
    mkdir -p "$REPORTS_DIR"

    # Set environment variables
    export NODE_ENV="test"
    export CI_ENVIRONMENT="$ENVIRONMENT"

    if [ "$ENVIRONMENT" = "ci" ]; then
        export CI="true"
        export PARALLEL_JOBS="2"
        export TIMEOUT_MINUTES="5"
    fi

    # Set Jest configuration based on mode
    case $MODE in
        "unit")
            JEST_CONFIG="$CONFIG_DIR/jest.typescript.config.js"
            TEST_PATTERN="tests/typescript/core/**/*.test.ts"
            ;;
        "integration")
            JEST_CONFIG="$CONFIG_DIR/jest.typescript.config.js"
            TEST_PATTERN="tests/typescript/patterns/**/*.test.ts"
            ;;
        "e2e")
            JEST_CONFIG="$CONFIG_DIR/jest.typescript.config.js"
            TEST_PATTERN="tests/typescript/examples/**/*.test.ts"
            ;;
        "all"|*)
            JEST_CONFIG="$CONFIG_DIR/jest.typescript.config.js"
            TEST_PATTERN="tests/typescript/**/*.test.ts"
            ;;
    esac

    print_success "Environment configured for $ENVIRONMENT mode"
}

# Function to compile TypeScript
compile_typescript() {
    print_info "Compiling TypeScript..."

    cd "$PROJECT_ROOT"
    if npx tsc --project "$CONFIG_DIR/tsconfig.test.json" --noEmit; then
        print_success "TypeScript compilation successful"
    else
        print_error "TypeScript compilation failed"
        exit 1
    fi
}

# Function to run type checking
run_type_check() {
    print_info "Running TypeScript type checking..."

    cd "$PROJECT_ROOT"
    if npx tsc --project "$CONFIG_DIR/tsconfig.test.json" --noEmit --strict; then
        print_success "Type checking passed"
    else
        print_error "Type checking failed"
        exit 1
    fi
}

# Function to build Jest command
build_jest_command() {
    local cmd="npx jest --config=\"$JEST_CONFIG\""

    # Add pattern if specified
    if [ "$TEST_PATTERN" != "tests/typescript/**/*.test.ts" ]; then
        cmd="$cmd --testPathPattern=\"$TEST_PATTERN\""
    fi

    # Coverage
    if [ "$COVERAGE" = true ]; then
        cmd="$cmd --coverage"
        cmd="$cmd --coverageDirectory=\"$REPORTS_DIR/coverage\""
    fi

    # Watch mode
    if [ "$WATCH" = true ]; then
        cmd="$cmd --watch"
    fi

    # Parallel execution
    if [ "$PARALLEL" = false ]; then
        cmd="$cmd --runInBand"
    fi

    # Verbose output
    if [ "$VERBOSE" = true ]; then
        cmd="$cmd --verbose"
    fi

    # CI mode
    if [ "$ENVIRONMENT" = "ci" ]; then
        cmd="$cmd --ci --passWithNoTests"
    fi

    # Output format
    case $OUTPUT_FORMAT in
        "json")
            cmd="$cmd --json --outputFile=\"$REPORTS_DIR/test-results.json\""
            ;;
        "html")
            cmd="$cmd --reporters=default --reporters=jest-html-reporters"
            ;;
        "markdown")
            # Will be generated by custom reporter
            ;;
    esac

    echo "$cmd"
}

# Function to run tests
run_tests() {
    print_info "Running TypeScript type tests..."

    local jest_cmd=$(build_jest_command)

    print_info "Jest command: $jest_cmd"

    cd "$PROJECT_ROOT"

    # Set timeout
    timeout "$TIMEOUT" bash -c "$jest_cmd" || {
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            print_error "Tests timed out after $TIMEOUT seconds"
        else
            print_error "Tests failed with exit code $exit_code"
        fi
        exit $exit_code
    }
}

# Function to generate reports
generate_reports() {
    if [ "$WATCH" = true ]; then
        return 0  # Skip report generation in watch mode
    fi

    print_info "Generating reports..."

    # Generate markdown report if JSON exists
    if [ -f "$REPORTS_DIR/test-results.json" ]; then
        node -e "
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('$REPORTS_DIR/test-results.json', 'utf8'));
            const markdown = \`
# TypeScript Type Test Results

## Summary
- **Total Tests**: \${results.numTotalTests || 0}
- **Passed**: \${results.numPassedTests || 0}
- **Failed**: \${results.numFailedTests || 0}
- **Success Rate**: \${((results.numPassedTests || 0) / (results.numTotalTests || 1) * 100).toFixed(1)}%

## Coverage
\${results.coverageMap ? '✅ Coverage data available' : '❌ No coverage data'}

## Details
\\\`\\\`\\\`json
\${JSON.stringify(results, null, 2)}
\\\`\\\`\\\`
\`;
            fs.writeFileSync('$REPORTS_DIR/test-results.md', markdown);
        " 2>/dev/null || print_warning "Could not generate markdown report"
    fi

    # List generated reports
    if [ -d "$REPORTS_DIR" ]; then
        print_success "Reports generated in $REPORTS_DIR:"
        ls -la "$REPORTS_DIR" 2>/dev/null || true
    fi
}

# Function to run CI pipeline
run_ci_pipeline() {
    print_info "Running CI pipeline..."

    cd "$PROJECT_ROOT"
    node -e "
        const { runCICommand } = require('./tests/typescript/config/ci-scripts.ts');
        runCICommand().catch(error => {
            console.error('CI pipeline failed:', error);
            process.exit(1);
        });
    " 2>/dev/null || {
        print_warning "Could not run advanced CI pipeline, falling back to basic testing"
        return 1
    }
}

# Function to cleanup
cleanup() {
    print_info "Cleaning up..."

    # Remove temporary files
    rm -f "$PROJECT_ROOT/test-results.json" 2>/dev/null || true

    print_success "Cleanup completed"
}

# Main execution
main() {
    print_info "Starting TypeScript Testing Framework"
    print_info "Mode: $MODE | Environment: $ENVIRONMENT | Coverage: $COVERAGE"

    # Check prerequisites
    check_prerequisites

    # Setup environment
    setup_environment

    # Compile TypeScript
    compile_typescript

    # Run type checking
    run_type_check

    # For CI environment, try advanced pipeline first
    if [ "$ENVIRONMENT" = "ci" ]; then
        if run_ci_pipeline; then
            print_success "CI pipeline completed successfully"
            exit 0
        else
            print_warning "Advanced CI pipeline failed, continuing with basic tests"
        fi
    fi

    # Run tests
    run_tests

    # Generate reports
    generate_reports

    # Cleanup
    cleanup

    print_success "TypeScript type tests completed successfully!"
}

# Handle interruption
trap cleanup INT TERM

# Run main function
main