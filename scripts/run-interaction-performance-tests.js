#!/usr/bin/env node

/**
 * Run Interaction Performance Tests Script
 *
 * Comprehensive script to execute interaction responsiveness tests
 * with detailed reporting and performance analysis.
 *
 * Usage:
 *   npm run test:performance:interaction
 *   node scripts/run-interaction-performance-tests.js
 *   node scripts/run-interaction-performance-tests.js --watch
 *   node scripts/run-interaction-performance-tests.js --coverage
 */

const { spawn } = require('child_process');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const path = require('path');

// Configuration
const CONFIG = {
  jestConfig: 'jest.config.interaction-performance.js',
  reportDir: 'tests/performance/reports',
  suiteRunner: 'tests/performance/interaction-performance-suite.ts',
  testPattern: 'tests/performance/**/*.test.ts',
  timeout: 300000, // 5 minutes
  maxWorkers: process.env.CI ? 1 : '50%'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  watch: args.includes('--watch'),
  coverage: args.includes('--coverage'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  ci: args.includes('--ci') || process.env.CI,
  failFast: args.includes('--fail-fast'),
  suite: args.find(arg => arg.startsWith('--suite='))?.split('=')[1],
  reporter: args.find(arg => arg.startsWith('--reporter='))?.split('=')[1] || 'default'
};

console.log('🚀 Starting Interaction Performance Test Suite');
console.log('='.repeat(60));

if (options.verbose) {
  console.log('📋 Test Configuration:');
  console.log(`   Jest Config: ${CONFIG.jestConfig}`);
  console.log(`   Report Directory: ${CONFIG.reportDir}`);
  console.log(`   Max Workers: ${CONFIG.maxWorkers}`);
  console.log(`   Timeout: ${CONFIG.timeout / 1000}s`);
  console.log(`   CI Mode: ${options.ci}`);
  console.log(`   Coverage: ${options.coverage}`);
  console.log(`   Watch Mode: ${options.watch}`);
  console.log('');
}

/**
 * Ensure report directory exists
 */
function ensureReportDirectory() {
  const reportPath = join(process.cwd(), CONFIG.reportDir);
  if (!existsSync(reportPath)) {
    mkdirSync(reportPath, { recursive: true });
    console.log(`📁 Created report directory: ${reportPath}`);
  }
}

/**
 * Build Jest command with options
 */
function buildJestCommand() {
  const jestArgs = [
    'jest',
    `--config=${CONFIG.jestConfig}`,
    `--maxWorkers=${CONFIG.maxWorkers}`,
    `--testTimeout=${CONFIG.timeout}`
  ];

  if (options.watch) {
    jestArgs.push('--watch');
  }

  if (options.coverage) {
    jestArgs.push('--coverage');
    jestArgs.push('--coverageDirectory=tests/performance/reports/coverage');
  }

  if (options.verbose) {
    jestArgs.push('--verbose');
  }

  if (options.ci) {
    jestArgs.push('--ci');
    jestArgs.push('--watchAll=false');
    jestArgs.push('--passWithNoTests');
  }

  if (options.failFast) {
    jestArgs.push('--bail');
  }

  if (options.suite) {
    // Filter tests by suite name
    jestArgs.push(`--testNamePattern="${options.suite}"`);
  }

  // Add reporter configuration
  if (options.reporter === 'json') {
    jestArgs.push('--json');
    jestArgs.push(`--outputFile=${CONFIG.reportDir}/jest-results.json`);
  }

  return jestArgs;
}

/**
 * Run Jest tests
 */
async function runJestTests() {
  return new Promise((resolve, reject) => {
    const jestArgs = buildJestCommand();

    console.log('🧪 Running Jest Performance Tests...');
    if (options.verbose) {
      console.log(`   Command: npx ${jestArgs.join(' ')}`);
    }

    const jestProcess = spawn('npx', jestArgs, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    jestProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Jest tests completed successfully');
        resolve(code);
      } else if (code === 1) {
        console.log('⚠️ Jest tests completed with failures');
        resolve(code); // Don't reject on test failures
      } else {
        console.error(`❌ Jest process exited with code ${code}`);
        reject(new Error(`Jest failed with exit code ${code}`));
      }
    });

    jestProcess.on('error', (error) => {
      console.error('❌ Failed to start Jest process:', error);
      reject(error);
    });
  });
}

/**
 * Run comprehensive performance suite
 */
async function runPerformanceSuite() {
  if (!existsSync(CONFIG.suiteRunner)) {
    console.log('⚠️ Performance suite runner not found, skipping comprehensive analysis');
    return;
  }

  console.log('\n📊 Running Comprehensive Performance Analysis...');

  return new Promise((resolve, reject) => {
    const suiteProcess = spawn('npx', ['tsx', CONFIG.suiteRunner], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    suiteProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Performance suite completed successfully');
        resolve(code);
      } else {
        console.error(`❌ Performance suite exited with code ${code}`);
        reject(new Error(`Performance suite failed with exit code ${code}`));
      }
    });

    suiteProcess.on('error', (error) => {
      console.error('❌ Failed to start performance suite:', error);
      reject(error);
    });
  });
}

/**
 * Generate summary report
 */
function generateSummaryReport() {
  const reportPath = join(process.cwd(), CONFIG.reportDir);
  const summaryPath = join(reportPath, 'test-summary.json');

  const summary = {
    timestamp: new Date().toISOString(),
    testSuite: 'Interaction Performance Tests',
    configuration: {
      jestConfig: CONFIG.jestConfig,
      maxWorkers: CONFIG.maxWorkers,
      timeout: CONFIG.timeout,
      coverage: options.coverage,
      ci: options.ci
    },
    thresholds: {
      inputLatency: '< 50ms',
      frameRate: '> 55fps',
      clickResponse: '< 100ms',
      scrollJank: '< 3 frames',
      debounceEffectiveness: '> 75%'
    },
    reportFiles: [
      'interaction-performance-report.html',
      'interaction-performance-report.json',
      'interaction-performance-report.md',
      'interaction-performance-junit.xml'
    ]
  };

  if (options.coverage) {
    summary.reportFiles.push('coverage/index.html');
  }

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`📄 Test summary saved to: ${summaryPath}`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    const startTime = Date.now();

    // Setup
    ensureReportDirectory();

    // Run tests
    const jestExitCode = await runJestTests();

    // Run comprehensive suite if not in watch mode
    if (!options.watch) {
      try {
        await runPerformanceSuite();
      } catch (error) {
        console.warn('⚠️ Comprehensive performance suite failed, but continuing...');
        if (options.verbose) {
          console.warn(error.message);
        }
      }

      // Generate summary
      generateSummaryReport();
    }

    const duration = (Date.now() - startTime) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Interaction Performance Testing Complete!');
    console.log(`⏱️ Total Duration: ${duration.toFixed(2)}s`);

    if (!options.watch) {
      console.log('\n📊 Generated Reports:');
      console.log(`   • HTML Report: ${CONFIG.reportDir}/interaction-performance-report.html`);
      console.log(`   • JSON Report: ${CONFIG.reportDir}/interaction-performance-report.json`);
      console.log(`   • Markdown Report: ${CONFIG.reportDir}/interaction-performance-report.md`);
      console.log(`   • JUnit XML: ${CONFIG.reportDir}/interaction-performance-junit.xml`);

      if (options.coverage) {
        console.log(`   • Coverage Report: ${CONFIG.reportDir}/coverage/index.html`);
      }
    }

    // Performance thresholds reminder
    console.log('\n🎯 Performance Targets:');
    console.log('   • Input Latency: < 50ms');
    console.log('   • Frame Rate: > 55fps');
    console.log('   • Click Response: < 100ms');
    console.log('   • Scroll Jank: < 3 frames');
    console.log('   • Debounce Effectiveness: > 75%');

    // Exit with Jest's exit code
    process.exit(jestExitCode);

  } catch (error) {
    console.error('\n❌ Interaction Performance Testing Failed:', error.message);

    if (options.verbose) {
      console.error(error.stack);
    }

    console.log('\n🔧 Troubleshooting Tips:');
    console.log('   • Check that all dependencies are installed: npm install');
    console.log('   • Verify Jest configuration: jest.config.interaction-performance.js');
    console.log('   • Ensure test files exist in tests/performance/');
    console.log('   • Try running with --verbose for more details');
    console.log('   • Check that Node.js version >= 16');

    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️ Test run interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Test run terminated');
  process.exit(1);
});

// Catch unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run main function
main();