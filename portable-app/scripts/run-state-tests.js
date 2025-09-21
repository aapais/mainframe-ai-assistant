#!/usr/bin/env node

/**
 * State Management Test Runner
 *
 * Comprehensive test execution script for state management validation:
 * - Sequential and parallel test execution
 * - Performance benchmarking
 * - Memory leak detection
 * - Coverage reporting
 * - CI/CD integration
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const CONFIG = {
  testSuites: {
    unit: {
      name: 'Unit Tests',
      pattern: 'tests/state-management/*.test.{ts,tsx}',
      config: 'jest.config.state-management.js',
      timeout: 30000,
    },
    integration: {
      name: 'Integration Tests',
      pattern: 'tests/state-management/*integration*.test.{ts,tsx}',
      config: 'jest.config.state-management.js',
      timeout: 60000,
    },
    performance: {
      name: 'Performance Tests',
      pattern: 'tests/state-management/*performance*.test.{ts,tsx}',
      config: 'jest.config.state-management.js',
      timeout: 120000,
    },
    master: {
      name: 'Master Suite',
      pattern: 'tests/state-management/state-master-suite.test.ts',
      config: 'jest.config.state-management.js',
      timeout: 180000,
    },
  },
  coverage: {
    threshold: 90,
    formats: ['text', 'lcov', 'html', 'json-summary'],
  },
  parallel: {
    enabled: true,
    maxWorkers: Math.max(1, Math.floor(os.cpus().length / 2)),
  },
};

// Utility functions
const log = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',  // Cyan
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    success: '\x1b[32m', // Green
    reset: '\x1b[0m',  // Reset
  };

  console.log(
    `${colors[level] || ''}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`,
    ...args
  );
};

const runCommand = (command, args = [], options = {}) => {
  return new Promise((resolve, reject) => {
    log('info', `Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      if (options.verbose) {
        process.stdout.write(data);
      }
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      if (options.verbose) {
        process.stderr.write(data);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}\nstderr: ${stderr}`));
      }
    });

    child.on('error', reject);
  });
};

const createTestReport = (results) => {
  const reportDir = path.join(process.cwd(), 'test-results', 'state-management');

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
    },
    configuration: CONFIG,
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      duration: results.reduce((acc, r) => acc + r.duration, 0),
    },
  };

  const reportPath = path.join(reportDir, 'execution-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  return { report, reportPath };
};

const generateMarkdownReport = (report, reportPath) => {
  const markdownPath = reportPath.replace('.json', '.md');

  const markdown = `
# State Management Test Report

**Generated:** ${report.timestamp}

## Environment
- **Node.js:** ${report.environment.node}
- **Platform:** ${report.environment.platform} ${report.environment.arch}
- **CPUs:** ${report.environment.cpus}
- **Memory:** ${report.environment.memory}

## Summary
- **Total Tests:** ${report.summary.total}
- **Passed:** ${report.summary.passed}
- **Failed:** ${report.summary.failed}
- **Duration:** ${(report.summary.duration / 1000).toFixed(2)}s

## Test Results

${report.results.map(result => `
### ${result.suite}
- **Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}
- **Duration:** ${(result.duration / 1000).toFixed(2)}s
- **Tests:** ${result.testCount || 'N/A'}
- **Coverage:** ${result.coverage || 'N/A'}%

${result.error ? `**Error:**\n\`\`\`\n${result.error}\n\`\`\`` : ''}
`).join('\n')}

## Configuration

\`\`\`json
${JSON.stringify(report.configuration, null, 2)}
\`\`\`
  `.trim();

  fs.writeFileSync(markdownPath, markdown);
  return markdownPath;
};

// Test execution functions
const runTestSuite = async (suiteKey, suite, options = {}) => {
  const startTime = Date.now();
  log('info', `Starting test suite: ${suite.name}`);

  try {
    const jestArgs = [
      '--config', suite.config,
      '--testPathPattern', suite.pattern,
      '--testTimeout', suite.timeout.toString(),
    ];

    if (options.coverage) {
      jestArgs.push('--coverage');
    }

    if (options.verbose) {
      jestArgs.push('--verbose');
    }

    if (options.bail) {
      jestArgs.push('--bail');
    }

    if (CONFIG.parallel.enabled) {
      jestArgs.push('--maxWorkers', CONFIG.parallel.maxWorkers.toString());
    }

    const result = await runCommand('npx', ['jest', ...jestArgs], {
      verbose: options.verbose,
      cwd: process.cwd(),
    });

    const duration = Date.now() - startTime;
    log('success', `Test suite "${suite.name}" completed in ${(duration / 1000).toFixed(2)}s`);

    // Parse test results
    const testCount = (result.stdout.match(/Tests:\s+(\d+)/)?.[1]) || 'N/A';
    const coverage = (result.stdout.match(/All files\s+\|\s+[\d.]+\s+\|\s+([\d.]+)/)?.[1]) || 'N/A';

    return {
      suite: suite.name,
      success: true,
      duration,
      testCount,
      coverage,
      output: result.stdout,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', `Test suite "${suite.name}" failed:`, error.message);

    return {
      suite: suite.name,
      success: false,
      duration,
      error: error.message,
    };
  }
};

const runAllTests = async (options = {}) => {
  log('info', 'Starting state management test execution');

  const results = [];
  const suiteOrder = options.parallel
    ? Object.keys(CONFIG.testSuites)
    : ['unit', 'integration', 'performance', 'master'];

  if (options.parallel) {
    // Run tests in parallel
    const promises = suiteOrder.map(key =>
      runTestSuite(key, CONFIG.testSuites[key], options)
    );

    const parallelResults = await Promise.allSettled(promises);

    parallelResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          suite: CONFIG.testSuites[suiteOrder[index]].name,
          success: false,
          duration: 0,
          error: result.reason?.message || 'Unknown error',
        });
      }
    });
  } else {
    // Run tests sequentially
    for (const key of suiteOrder) {
      const result = await runTestSuite(key, CONFIG.testSuites[key], options);
      results.push(result);

      if (!result.success && options.bail) {
        log('warn', 'Stopping execution due to test failure (--bail)');
        break;
      }
    }
  }

  return results;
};

// Performance analysis
const analyzePerformance = (results) => {
  const performanceMetrics = {
    totalDuration: results.reduce((acc, r) => acc + r.duration, 0),
    averageDuration: results.reduce((acc, r) => acc + r.duration, 0) / results.length,
    slowestSuite: results.reduce((slowest, current) =>
      current.duration > slowest.duration ? current : slowest
    ),
    fastestSuite: results.reduce((fastest, current) =>
      current.duration < fastest.duration ? current : fastest
    ),
  };

  log('info', 'Performance Analysis:');
  log('info', `  Total Duration: ${(performanceMetrics.totalDuration / 1000).toFixed(2)}s`);
  log('info', `  Average Duration: ${(performanceMetrics.averageDuration / 1000).toFixed(2)}s`);
  log('info', `  Slowest Suite: ${performanceMetrics.slowestSuite.suite} (${(performanceMetrics.slowestSuite.duration / 1000).toFixed(2)}s)`);
  log('info', `  Fastest Suite: ${performanceMetrics.fastestSuite.suite} (${(performanceMetrics.fastestSuite.duration / 1000).toFixed(2)}s)`);

  return performanceMetrics;
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    coverage: args.includes('--coverage') || args.includes('-c'),
    parallel: args.includes('--parallel') || args.includes('-p'),
    bail: args.includes('--bail') || args.includes('-b'),
    help: args.includes('--help') || args.includes('-h'),
  };

  if (options.help) {
    console.log(`
State Management Test Runner

Usage: node run-state-tests.js [options]

Options:
  -v, --verbose    Enable verbose output
  -c, --coverage   Enable coverage reporting
  -p, --parallel   Run tests in parallel
  -b, --bail       Stop on first failure
  -h, --help       Show this help message

Test Suites:
${Object.entries(CONFIG.testSuites).map(([key, suite]) =>
  `  ${key.padEnd(12)} ${suite.name}`
).join('\n')}
    `);
    return;
  }

  try {
    const startTime = Date.now();

    log('info', 'State Management Test Execution Started');
    log('info', `Configuration: ${JSON.stringify(options, null, 2)}`);

    const results = await runAllTests(options);
    const totalDuration = Date.now() - startTime;

    // Analyze results
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    log('info', 'Test Execution Summary:');
    log('info', `  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    log('info', `  Suites Passed: ${passed}`);
    log('info', `  Suites Failed: ${failed}`);

    // Generate reports
    const { report, reportPath } = createTestReport(results);
    const markdownPath = generateMarkdownReport(report, reportPath);

    log('info', `Reports generated:`);
    log('info', `  JSON: ${reportPath}`);
    log('info', `  Markdown: ${markdownPath}`);

    // Performance analysis
    analyzePerformance(results);

    // Exit with appropriate code
    const exitCode = failed > 0 ? 1 : 0;

    if (exitCode === 0) {
      log('success', 'All state management tests completed successfully!');
    } else {
      log('error', `${failed} test suite(s) failed. Check the reports for details.`);
    }

    process.exit(exitCode);

  } catch (error) {
    log('error', 'Test execution failed:', error.message);
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGINT', () => {
  log('warn', 'Test execution interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('warn', 'Test execution terminated');
  process.exit(143);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    log('error', 'Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { runTestSuite, runAllTests, CONFIG };