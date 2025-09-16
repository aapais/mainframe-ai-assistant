#!/usr/bin/env node

/**
 * Search Service Test Runner
 * Comprehensive test execution with performance monitoring
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  unit: {
    pattern: 'SearchService.unit.test.ts',
    description: 'Unit Tests - Search algorithms, tokenization, scoring',
    timeout: 30000
  },
  integration: {
    pattern: 'SearchService.integration.test.ts', 
    description: 'Integration Tests - API endpoints, database, cache',
    timeout: 60000
  },
  performance: {
    pattern: 'SearchService.performance.test.ts',
    description: 'Performance Tests - Load, stress, spike, endurance',
    timeout: 120000
  },
  quality: {
    pattern: 'SearchService.quality.test.ts',
    description: 'Quality Tests - Relevance, ranking accuracy, fuzzy matching',
    timeout: 45000
  },
  benchmark: {
    pattern: 'SearchService.benchmark.test.ts',
    description: 'Benchmark Tests - Response time, throughput, memory',
    timeout: 180000
  }
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  const line = '='.repeat(60);
  console.log(colorize(line, 'cyan'));
  console.log(colorize(`🧪 ${title}`, 'bright'));
  console.log(colorize(line, 'cyan'));
}

function printSection(title) {
  console.log(colorize(`\n📋 ${title}`, 'blue'));
  console.log(colorize('-'.repeat(40), 'blue'));
}

async function runJestTest(pattern, timeout) {
  return new Promise((resolve, reject) => {
    const jestArgs = [
      '--testPathPattern', pattern,
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      '--timeout', timeout.toString()
    ];

    console.log(colorize(`🚀 Running: jest ${jestArgs.join(' ')}`, 'cyan'));
    
    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../../'),
      env: { 
        ...process.env, 
        NODE_ENV: 'test',
        FORCE_COLOR: '1'
      }
    });

    jest.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    jest.on('error', (err) => {
      console.error(colorize(`❌ Jest process error: ${err.message}`, 'red'));
      reject(err);
    });
  });
}

async function generateCoverageReport() {
  return new Promise((resolve) => {
    console.log(colorize('\n📊 Generating coverage report...', 'magenta'));
    
    const coverage = spawn('npx', ['jest', '--coverage', '--testPathPattern', 'SearchService'], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../../'),
      env: { ...process.env, NODE_ENV: 'test' }
    });

    coverage.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function runTestSuite(suiteName) {
  const config = TEST_CONFIG[suiteName];
  if (!config) {
    console.error(colorize(`❌ Unknown test suite: ${suiteName}`, 'red'));
    return false;
  }

  printSection(`${config.description}`);
  
  const startTime = Date.now();
  const success = await runJestTest(config.pattern, config.timeout);
  const duration = Date.now() - startTime;
  
  const status = success ? 
    colorize('✅ PASSED', 'green') : 
    colorize('❌ FAILED', 'red');
  
  console.log(`${status} - Duration: ${duration}ms`);
  return success;
}

async function runAllTests() {
  printHeader('SearchService Comprehensive Test Suite');
  
  const results = {};
  const startTime = Date.now();
  
  // Run test suites in order
  for (const [suiteName, config] of Object.entries(TEST_CONFIG)) {
    try {
      results[suiteName] = await runTestSuite(suiteName);
    } catch (error) {
      console.error(colorize(`❌ Error running ${suiteName}: ${error.message}`, 'red'));
      results[suiteName] = false;
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Generate coverage report
  await generateCoverageReport();
  
  // Print summary
  printSection('Test Results Summary');
  
  let passedCount = 0;
  let totalCount = Object.keys(results).length;
  
  for (const [suiteName, passed] of Object.entries(results)) {
    const config = TEST_CONFIG[suiteName];
    const status = passed ? 
      colorize('✅ PASSED', 'green') : 
      colorize('❌ FAILED', 'red');
    
    console.log(`${status} ${suiteName.padEnd(12)} - ${config.description}`);
    
    if (passed) passedCount++;
  }
  
  console.log(colorize('\n📈 Overall Results:', 'bright'));
  console.log(`   Passed: ${colorize(passedCount.toString(), 'green')}/${totalCount}`);
  console.log(`   Duration: ${colorize(Math.round(totalDuration / 1000) + 's', 'cyan')}`);
  console.log(`   Success Rate: ${colorize(Math.round(passedCount / totalCount * 100) + '%', passedCount === totalCount ? 'green' : 'yellow')}`);
  
  if (passedCount === totalCount) {
    console.log(colorize('\n🎉 All tests passed! SearchService is performing optimally.', 'green'));
    return true;
  } else {
    console.log(colorize(`\n⚠️  ${totalCount - passedCount} test suite(s) failed. Please review the results above.`, 'yellow'));
    return false;
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run all tests
    const success = await runAllTests();
    process.exit(success ? 0 : 1);
  } else {
    // Run specific test suite
    const suiteName = args[0];
    
    if (suiteName === '--help' || suiteName === '-h') {
      printHeader('SearchService Test Runner - Help');
      console.log('Usage: node run-search-tests.js [suite]');
      console.log('\nAvailable test suites:');
      
      for (const [name, config] of Object.entries(TEST_CONFIG)) {
        console.log(`  ${colorize(name.padEnd(12), 'cyan')} - ${config.description}`);
      }
      
      console.log(`\n${colorize('Examples:', 'bright')}`);
      console.log('  node run-search-tests.js                 # Run all tests');
      console.log('  node run-search-tests.js unit           # Run unit tests only');
      console.log('  node run-search-tests.js performance    # Run performance tests only');
      console.log('  node run-search-tests.js benchmark      # Run benchmark tests only');
      return;
    }
    
    if (suiteName === '--list') {
      console.log('Available test suites:');
      for (const name of Object.keys(TEST_CONFIG)) {
        console.log(`  ${name}`);
      }
      return;
    }
    
    // Run specific suite
    printHeader(`SearchService Test Suite: ${suiteName}`);
    const success = await runTestSuite(suiteName);
    
    if (success) {
      console.log(colorize(`\n✅ ${suiteName} tests completed successfully!`, 'green'));
    } else {
      console.log(colorize(`\n❌ ${suiteName} tests failed!`, 'red'));
    }
    
    process.exit(success ? 0 : 1);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('❌ Unhandled Rejection:', 'red'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(colorize('❌ Uncaught Exception:', 'red'), error);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error(colorize(`❌ Test runner error: ${error.message}`, 'red'));
  process.exit(1);
});