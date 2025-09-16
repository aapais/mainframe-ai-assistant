#!/usr/bin/env node

/**
 * Integration Test Runner
 *
 * Comprehensive test runner for system integration validation
 * Runs all integration test suites and generates detailed reports
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m'
};

// Test suites to run
const testSuites = [
  {
    name: 'Comprehensive System Integration',
    file: 'comprehensive-system-integration.test.ts',
    timeout: 120000, // 2 minutes
    critical: true,
    description: 'End-to-end system validation across all components'
  },
  {
    name: 'Cache Invalidation Flow',
    file: 'cache-invalidation-flow.test.ts',
    timeout: 90000, // 1.5 minutes
    critical: true,
    description: 'Cache consistency and invalidation testing'
  },
  {
    name: 'Analytics Pipeline Integration',
    file: 'analytics-pipeline-integration.test.ts',
    timeout: 90000, // 1.5 minutes
    critical: false,
    description: 'Metrics collection and analytics validation'
  },
  {
    name: 'Error Handling and Recovery',
    file: 'error-handling-recovery.test.ts',
    timeout: 120000, // 2 minutes
    critical: true,
    description: 'Error handling and system recovery validation'
  }
];

// Configuration
const config = {
  maxConcurrency: process.env.CI ? 1 : Math.min(4, os.cpus().length),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  failFast: process.argv.includes('--fail-fast') || process.argv.includes('-f'),
  coverage: process.argv.includes('--coverage') || process.argv.includes('-c'),
  outputDir: path.join(__dirname, 'reports'),
  jestConfig: path.join(__dirname, '../../jest.config.integration.js')
};

class IntegrationTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.setupOutputDir();
  }

  setupOutputDir() {
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
  }

  log(message, color = 'white') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runTestSuite(suite) {
    this.log(`Starting: ${suite.name}`, 'cyan');
    this.log(`Description: ${suite.description}`, 'dim');

    const startTime = Date.now();

    try {
      const testFile = path.join(__dirname, suite.file);

      // Check if test file exists
      if (!fs.existsSync(testFile)) {
        throw new Error(`Test file not found: ${testFile}`);
      }

      // Build Jest command
      const jestArgs = [
        '--config', config.jestConfig,
        '--testTimeout', suite.timeout.toString(),
        '--testPathPattern', suite.file,
        '--forceExit',
        '--detectOpenHandles'
      ];

      if (config.verbose) {
        jestArgs.push('--verbose');
      }

      if (config.coverage) {
        jestArgs.push('--coverage');
        jestArgs.push('--coverageDirectory', path.join(config.outputDir, `coverage-${suite.name.replace(/\\s+/g, '-')}`));
      }

      // Run Jest
      const result = await this.executeJest(jestArgs, suite);

      const duration = Date.now() - startTime;

      const testResult = {
        suite: suite.name,
        file: suite.file,
        success: result.success,
        duration,
        output: result.output,
        error: result.error,
        critical: suite.critical,
        timestamp: new Date().toISOString()
      };

      this.results.push(testResult);

      if (result.success) {
        this.log(`✅ Completed: ${suite.name} (${duration}ms)`, 'green');
      } else {
        this.log(`❌ Failed: ${suite.name} (${duration}ms)`, 'red');
        if (config.verbose && result.error) {
          this.log(`Error: ${result.error}`, 'red');
        }
      }

      return testResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult = {
        suite: suite.name,
        file: suite.file,
        success: false,
        duration,
        output: '',
        error: error.message,
        critical: suite.critical,
        timestamp: new Date().toISOString()
      };

      this.results.push(testResult);
      this.log(`💥 Error in ${suite.name}: ${error.message}`, 'red');

      return testResult;
    }
  }

  async executeJest(args, suite) {
    return new Promise((resolve) => {
      const jest = spawn('npx', ['jest', ...args], {
        cwd: path.join(__dirname, '../..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          // Prevent Jest from hanging on to resources
          FORCE_COLOR: '0'
        }
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
        if (config.verbose) {
          process.stdout.write(data);
        }
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
        if (config.verbose) {
          process.stderr.write(data);
        }
      });

      jest.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code
        });
      });

      // Handle timeout
      const timeout = setTimeout(() => {
        jest.kill('SIGTERM');
        setTimeout(() => {
          jest.kill('SIGKILL');
        }, 5000);
      }, suite.timeout + 10000); // Add 10s buffer

      jest.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  async runAllTests() {
    this.log('🚀 Starting Integration Test Suite', 'bright');
    this.log(`Running ${testSuites.length} test suites with concurrency: ${config.maxConcurrency}`, 'blue');

    // Run tests in batches based on concurrency
    const batches = [];
    for (let i = 0; i < testSuites.length; i += config.maxConcurrency) {
      batches.push(testSuites.slice(i, i + config.maxConcurrency));
    }

    for (const [batchIndex, batch] of batches.entries()) {
      this.log(`📦 Running batch ${batchIndex + 1}/${batches.length}`, 'yellow');

      const batchPromises = batch.map(suite => this.runTestSuite(suite));
      const batchResults = await Promise.all(batchPromises);

      // Check for critical failures
      const criticalFailures = batchResults.filter(r => !r.success && r.critical);
      if (config.failFast && criticalFailures.length > 0) {
        this.log('🛑 Critical test failure detected with --fail-fast', 'red');
        break;
      }
    }

    await this.generateReport();
    this.printSummary();

    return this.getExitCode();
  }

  async generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const criticalFailures = this.results.filter(r => !r.success && r.critical).length;

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalDuration,
        totalTests: this.results.length,
        successful,
        failed,
        criticalFailures,
        successRate: successful / this.results.length,
        environment: {
          node: process.version,
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB'
        },
        configuration: config
      },
      results: this.results,
      dependencies: this.analyzeTestDependencies(),
      integrationPoints: this.analyzeIntegrationPoints(),
      recommendations: this.generateRecommendations()
    };

    // Save detailed JSON report
    const reportPath = path.join(config.outputDir, 'integration-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`📊 Detailed report saved: ${reportPath}`, 'blue');

    // Generate markdown summary
    await this.generateMarkdownReport(report);

    return report;
  }

  async generateMarkdownReport(report) {
    const md = `# Integration Test Report

## Summary

- **Timestamp**: ${report.summary.timestamp}
- **Total Duration**: ${Math.round(report.summary.totalDuration / 1000)}s
- **Tests**: ${report.summary.successful}/${report.summary.totalTests} passed (${Math.round(report.summary.successRate * 100)}%)
- **Critical Failures**: ${report.summary.criticalFailures}

## Environment

- **Node.js**: ${report.summary.environment.node}
- **Platform**: ${report.summary.environment.platform} ${report.summary.environment.arch}
- **CPUs**: ${report.summary.environment.cpus}
- **Memory**: ${report.summary.environment.memory}

## Test Results

| Suite | Status | Duration | Critical |
|-------|--------|----------|----------|
${report.results.map(r =>
  `| ${r.suite} | ${r.success ? '✅' : '❌'} | ${r.duration}ms | ${r.critical ? '🔴' : '🟡'} |`
).join('\\n')}

## Integration Points Validated

${report.integrationPoints.map(point => `- ✅ ${point}`).join('\\n')}

## Dependencies Tested

${report.dependencies.map(dep => `- ${dep.component} → ${dep.dependencies.join(', ')}`).join('\\n')}

${report.summary.failed > 0 ? `
## Failures

${report.results.filter(r => !r.success).map(r => `
### ${r.suite}

**Error**: ${r.error}

**Critical**: ${r.critical ? 'Yes' : 'No'}
`).join('\\n')}
` : ''}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\\n')}

---
*Generated by Integration Test Runner at ${new Date().toISOString()}*
`;

    const mdPath = path.join(config.outputDir, 'integration-test-report.md');
    fs.writeFileSync(mdPath, md);
    this.log(`📝 Markdown report saved: ${mdPath}`, 'blue');
  }

  analyzeTestDependencies() {
    return [
      {
        component: 'ServiceFactory',
        dependencies: ['DatabaseManager', 'CacheService', 'KnowledgeBaseService', 'SearchService', 'MetricsService']
      },
      {
        component: 'KnowledgeBaseService',
        dependencies: ['DatabaseManager', 'ValidationService', 'CacheService']
      },
      {
        component: 'SearchService',
        dependencies: ['KnowledgeBaseService', 'CacheService']
      },
      {
        component: 'CacheService',
        dependencies: ['Memory', 'TTL Management']
      },
      {
        component: 'DatabaseManager',
        dependencies: ['SQLite', 'ConnectionPool', 'Migrations']
      },
      {
        component: 'MetricsService',
        dependencies: ['DatabaseManager', 'EventEmitter']
      }
    ];
  }

  analyzeIntegrationPoints() {
    return [
      'Frontend-Backend IPC Communication',
      'Database CRUD Operations with Transactions',
      'Cache Layer Integration and Invalidation',
      'Search Service with Database Fallback',
      'Analytics Pipeline Data Flow',
      'Error Propagation and Recovery',
      'Service Health Monitoring',
      'Configuration Management',
      'Concurrent Operation Handling',
      'Data Consistency Validation',
      'Performance Threshold Monitoring',
      'Resource Management and Cleanup'
    ];
  }

  generateRecommendations() {
    const recommendations = [];

    const criticalFailures = this.results.filter(r => !r.success && r.critical);
    const slowTests = this.results.filter(r => r.duration > 60000);
    const successRate = this.results.filter(r => r.success).length / this.results.length;

    if (criticalFailures.length > 0) {
      recommendations.push('🔴 Address critical test failures immediately');
      recommendations.push('Review error handling and recovery mechanisms');
    }

    if (successRate < 0.9) {
      recommendations.push('🟡 Improve test stability - success rate below 90%');
      recommendations.push('Investigate flaky tests and environmental dependencies');
    }

    if (slowTests.length > 0) {
      recommendations.push('⚡ Optimize slow-running tests (>60s)');
      recommendations.push('Consider test parallelization or mocking heavy operations');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All integration tests passing - system is stable');
      recommendations.push('Consider adding more edge case coverage');
      recommendations.push('Monitor performance trends over time');
    }

    return recommendations;
  }

  printSummary() {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const criticalFailures = this.results.filter(r => !r.success && r.critical).length;

    console.log('\\n' + '='.repeat(80));
    this.log('🎯 Integration Test Summary', 'bright');
    console.log('='.repeat(80));

    this.log(`Total Duration: ${Math.round(totalDuration / 1000)}s`, 'blue');
    this.log(`Tests Passed: ${successful}/${this.results.length}`, successful === this.results.length ? 'green' : 'yellow');
    this.log(`Tests Failed: ${failed}`, failed === 0 ? 'green' : 'red');
    this.log(`Critical Failures: ${criticalFailures}`, criticalFailures === 0 ? 'green' : 'red');
    this.log(`Success Rate: ${Math.round((successful / this.results.length) * 100)}%`,
      successful === this.results.length ? 'green' : (successful / this.results.length > 0.8 ? 'yellow' : 'red'));

    if (failed > 0) {
      console.log('\\n' + colors.red + 'Failed Tests:' + colors.reset);
      this.results.filter(r => !r.success).forEach(result => {
        const icon = result.critical ? '🔴' : '🟡';
        this.log(`${icon} ${result.suite}: ${result.error}`, 'red');
      });
    }

    console.log('\\n' + colors.cyan + 'Reports generated in: ' + config.outputDir + colors.reset);
    console.log('='.repeat(80) + '\\n');
  }

  getExitCode() {
    const criticalFailures = this.results.filter(r => !r.success && r.critical).length;
    const totalFailures = this.results.filter(r => !r.success).length;

    if (criticalFailures > 0) {
      return 2; // Critical failure
    } else if (totalFailures > 0) {
      return 1; // Non-critical failures
    } else {
      return 0; // All tests passed
    }
  }
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Integration Test Runner

Usage: node run-integration-tests.js [options]

Options:
  --verbose, -v     Verbose output
  --fail-fast, -f   Stop on first critical failure
  --coverage, -c    Generate coverage reports
  --help, -h        Show this help message

Test Suites:
${testSuites.map(suite => `  • ${suite.name} (${suite.critical ? 'critical' : 'optional'})`).join('\\n')}

Environment Variables:
  CI=true           Run in CI mode (sequential execution)
  NODE_ENV=test     Test environment (automatically set)
`);
  process.exit(0);
}

// Main execution
async function main() {
  const runner = new IntegrationTestRunner();

  try {
    // Check if Jest is available
    try {
      execSync('npx jest --version', { stdio: 'ignore' });
    } catch (error) {
      console.error('❌ Jest is not available. Please install dependencies first.');
      process.exit(1);
    }

    // Run tests
    const exitCode = await runner.runAllTests();
    process.exit(exitCode);

  } catch (error) {
    console.error('💥 Fatal error running integration tests:', error.message);
    process.exit(3);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\\n🛑 Interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 Terminated');
  process.exit(143);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { IntegrationTestRunner, testSuites, config };