#!/usr/bin/env node

/**
 * Search Service Test Validation
 * Validates test files and configuration
 */

const fs = require('fs');
const path = require('path');

// Test files to validate
const TEST_FILES = [
  'SearchService.unit.test.ts',
  'SearchService.integration.test.ts',
  'SearchService.performance.test.ts',
  'SearchService.quality.test.ts',
  'SearchService.benchmark.test.ts',
];

function colorize(text, color) {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
  };
  return `${colors[color]}${text}${colors.reset}`;
}

function validateFile(filePath) {
  const issues = [];

  if (!fs.existsSync(filePath)) {
    issues.push('File does not exist');
    return issues;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check for required test structure
  if (!content.includes('describe(')) {
    issues.push('Missing describe blocks');
  }

  if (!content.includes('test(') && !content.includes('it(')) {
    issues.push('Missing test cases');
  }

  if (!content.includes('expect(')) {
    issues.push('Missing expectations');
  }

  // Check for SearchService import
  if (!content.includes('SearchService')) {
    issues.push('Missing SearchService import/usage');
  }

  // Performance test specific checks
  if (filePath.includes('performance') || filePath.includes('benchmark')) {
    if (!content.includes('performance.now()') && !content.includes('Date.now()')) {
      issues.push('Missing performance timing measurements');
    }

    if (!content.includes('1000') && !content.includes('SEARCH_TIME_MS')) {
      issues.push('Missing 1-second response time validation');
    }
  }

  // Quality test specific checks
  if (filePath.includes('quality')) {
    if (!content.includes('score') && !content.includes('ranking')) {
      issues.push('Missing quality/relevance validation');
    }
  }

  return issues;
}

function validatePackageJson() {
  const packagePath = path.resolve(__dirname, '../../../package.json');

  if (!fs.existsSync(packagePath)) {
    return ['package.json not found'];
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const scripts = packageJson.scripts || {};

  const issues = [];

  // Check for test scripts
  const requiredScripts = [
    'test:search',
    'test:search:unit',
    'test:search:integration',
    'test:search:performance',
    'test:search:quality',
    'test:search:benchmark',
  ];

  for (const script of requiredScripts) {
    if (!scripts[script]) {
      issues.push(`Missing script: ${script}`);
    }
  }

  // Check Jest configuration
  if (!packageJson.jest) {
    issues.push('Missing Jest configuration');
  }

  return issues;
}

function validateTestSetup() {
  const setupPath = path.resolve(__dirname, '../../test-setup.ts');

  if (!fs.existsSync(setupPath)) {
    return ['test-setup.ts not found'];
  }

  const content = fs.readFileSync(setupPath, 'utf8');
  const issues = [];

  if (!content.includes('@testing-library/jest-dom')) {
    issues.push('Missing jest-dom setup');
  }

  if (!content.includes('performance')) {
    issues.push('Missing performance test configuration');
  }

  return issues;
}

function main() {
  console.log(colorize('🔍 Validating SearchService Test Suite', 'cyan'));
  console.log('='.repeat(50));

  let totalIssues = 0;

  // Validate test files
  console.log(colorize('\n📁 Test Files:', 'blue'));
  for (const testFile of TEST_FILES) {
    const filePath = path.resolve(__dirname, testFile);
    const issues = validateFile(filePath);

    if (issues.length === 0) {
      console.log(colorize(`✅ ${testFile}`, 'green'));
    } else {
      console.log(colorize(`❌ ${testFile}`, 'red'));
      issues.forEach(issue => {
        console.log(colorize(`   - ${issue}`, 'red'));
      });
      totalIssues += issues.length;
    }
  }

  // Validate package.json
  console.log(colorize('\n📦 Package Configuration:', 'blue'));
  const packageIssues = validatePackageJson();
  if (packageIssues.length === 0) {
    console.log(colorize('✅ package.json scripts configured', 'green'));
  } else {
    console.log(colorize('❌ package.json issues:', 'red'));
    packageIssues.forEach(issue => {
      console.log(colorize(`   - ${issue}`, 'red'));
    });
    totalIssues += packageIssues.length;
  }

  // Validate test setup
  console.log(colorize('\n⚙️  Test Setup:', 'blue'));
  const setupIssues = validateTestSetup();
  if (setupIssues.length === 0) {
    console.log(colorize('✅ test-setup.ts configured', 'green'));
  } else {
    console.log(colorize('❌ test-setup.ts issues:', 'red'));
    setupIssues.forEach(issue => {
      console.log(colorize(`   - ${issue}`, 'red'));
    });
    totalIssues += setupIssues.length;
  }

  // Validate test runner
  console.log(colorize('\n🏃 Test Runner:', 'blue'));
  const runnerPath = path.resolve(__dirname, 'run-search-tests.js');
  if (fs.existsSync(runnerPath)) {
    console.log(colorize('✅ run-search-tests.js exists', 'green'));

    // Check if executable
    try {
      fs.accessSync(runnerPath, fs.constants.X_OK);
      console.log(colorize('✅ run-search-tests.js is executable', 'green'));
    } catch {
      console.log(colorize('⚠️  run-search-tests.js is not executable', 'yellow'));
    }
  } else {
    console.log(colorize('❌ run-search-tests.js not found', 'red'));
    totalIssues++;
  }

  // Summary
  console.log(colorize('\n📊 Validation Summary:', 'cyan'));
  if (totalIssues === 0) {
    console.log(colorize('🎉 All validations passed! Test suite is ready.', 'green'));
    console.log(colorize('\n🚀 Quick Start:', 'blue'));
    console.log('   npm run test:search                    # Run all tests');
    console.log('   npm run test:search:performance        # Performance tests');
    console.log('   npm run test:search:benchmark          # Benchmark tests');
  } else {
    console.log(colorize(`❌ Found ${totalIssues} issue(s) that need to be addressed.`, 'red'));
    console.log(colorize('\n🔧 Please fix the issues above before running tests.', 'yellow'));
  }

  process.exit(totalIssues === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { validateFile, validatePackageJson, validateTestSetup };
