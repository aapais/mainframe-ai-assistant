#!/usr/bin/env node
/**
 * Comprehensive Test Runner
 * Executes the complete test suite with quality validation and reporting
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ComprehensiveTestRunner {
  constructor() {
    this.results = {
      unit: { status: 'pending', coverage: 0, duration: 0 },
      integration: { status: 'pending', duration: 0 },
      e2e: { status: 'pending', duration: 0 },
      performance: { status: 'pending', benchmarks: {} },
      accessibility: { status: 'pending', violations: 0 },
      overall: { status: 'pending', score: 0 }
    };

    this.config = {
      coverage: {
        threshold: 90,
        critical: 95
      },
      performance: {
        maxSearchTime: 1000,
        maxMemoryMB: 512,
        minThroughput: 50
      },
      accessibility: {
        maxViolations: 0
      }
    };

    this.verbose = process.argv.includes('--verbose');
    this.bail = process.argv.includes('--bail');
    this.types = this.parseTestTypes();
  }

  parseTestTypes() {
    const typesArg = process.argv.find(arg => arg.startsWith('--types='));
    if (typesArg) {
      return typesArg.split('=')[1].split(',');
    }
    return ['unit', 'integration', 'e2e', 'performance', 'accessibility'];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔍',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      performance: '⚡'
    }[level] || 'ℹ️';

    if (this.verbose || level !== 'info') {
      console.log(`${prefix} [${timestamp}] ${message}`);
    }
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      this.log(`Running: ${command} ${args.join(' ')}`);

      const child = spawn(command, args, {
        stdio: this.verbose ? 'inherit' : 'pipe',
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (!this.verbose) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code === 0) {
          this.log(`Command completed in ${duration}ms`, 'success');
          resolve({ code, stdout, stderr, duration });
        } else {
          this.log(`Command failed with code ${code} after ${duration}ms`, 'error');
          if (!this.verbose && stderr) {
            console.error(stderr);
          }

          if (this.bail) {
            reject(new Error(`Command failed: ${command}`));
          } else {
            resolve({ code, stdout, stderr, duration, failed: true });
          }
        }
      });

      child.on('error', (error) => {
        this.log(`Command error: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  async runUnitTests() {
    if (!this.types.includes('unit')) return;

    this.log('Starting unit tests...', 'info');

    try {
      const result = await this.runCommand('npm', ['run', 'test:unit', '--', '--coverage', '--ci']);

      this.results.unit.duration = result.duration;
      this.results.unit.status = result.failed ? 'failed' : 'passed';

      // Parse coverage from output
      if (result.stdout) {
        const coverageMatch = result.stdout.match(/All files[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*([0-9.]+)/);
        if (coverageMatch) {
          this.results.unit.coverage = parseFloat(coverageMatch[1]);
        }
      }

      if (this.results.unit.coverage < this.config.coverage.threshold) {
        this.log(`Unit test coverage ${this.results.unit.coverage}% below threshold ${this.config.coverage.threshold}%`, 'warning');
      }

      this.log(`Unit tests completed: ${this.results.unit.status} (${this.results.unit.coverage}% coverage)`,
        this.results.unit.status === 'passed' ? 'success' : 'error');

    } catch (error) {
      this.results.unit.status = 'failed';
      this.log(`Unit tests failed: ${error.message}`, 'error');
    }
  }

  async runIntegrationTests() {
    if (!this.types.includes('integration')) return;

    this.log('Starting integration tests...', 'info');

    try {
      const result = await this.runCommand('npm', ['run', 'test:integration']);

      this.results.integration.duration = result.duration;
      this.results.integration.status = result.failed ? 'failed' : 'passed';

      this.log(`Integration tests completed: ${this.results.integration.status}`,
        this.results.integration.status === 'passed' ? 'success' : 'error');

    } catch (error) {
      this.results.integration.status = 'failed';
      this.log(`Integration tests failed: ${error.message}`, 'error');
    }
  }

  async runE2ETests() {
    if (!this.types.includes('e2e')) return;

    this.log('Starting E2E tests...', 'info');

    try {
      // Build application first
      await this.runCommand('npm', ['run', 'build']);

      const result = await this.runCommand('npm', ['run', 'test:e2e']);

      this.results.e2e.duration = result.duration;
      this.results.e2e.status = result.failed ? 'failed' : 'passed';

      this.log(`E2E tests completed: ${this.results.e2e.status}`,
        this.results.e2e.status === 'passed' ? 'success' : 'error');

    } catch (error) {
      this.results.e2e.status = 'failed';
      this.log(`E2E tests failed: ${error.message}`, 'error');
    }
  }

  async runPerformanceTests() {
    if (!this.types.includes('performance')) return;

    this.log('Starting performance tests...', 'performance');

    try {
      const result = await this.runCommand('npm', ['run', 'test:performance:benchmark']);

      this.results.performance.duration = result.duration;
      this.results.performance.status = result.failed ? 'failed' : 'passed';

      // Parse performance metrics
      if (fs.existsSync('benchmark-results.json')) {
        const benchmarks = JSON.parse(fs.readFileSync('benchmark-results.json', 'utf8'));
        this.results.performance.benchmarks = benchmarks;

        // Validate performance requirements
        if (benchmarks.averageTime > this.config.performance.maxSearchTime) {
          this.log(`Performance: Average search time ${benchmarks.averageTime}ms exceeds ${this.config.performance.maxSearchTime}ms`, 'warning');
        }
      }

      this.log(`Performance tests completed: ${this.results.performance.status}`,
        this.results.performance.status === 'passed' ? 'success' : 'error');

    } catch (error) {
      this.results.performance.status = 'failed';
      this.log(`Performance tests failed: ${error.message}`, 'error');
    }
  }

  async runAccessibilityTests() {
    if (!this.types.includes('accessibility')) return;

    this.log('Starting accessibility tests...', 'info');

    try {
      const result = await this.runCommand('npm', ['run', 'test:accessibility']);

      this.results.accessibility.duration = result.duration;
      this.results.accessibility.status = result.failed ? 'failed' : 'passed';

      // Parse accessibility violations
      if (fs.existsSync('accessibility-reports/violations.json')) {
        const violations = JSON.parse(fs.readFileSync('accessibility-reports/violations.json', 'utf8'));
        this.results.accessibility.violations = violations.length;

        if (this.results.accessibility.violations > this.config.accessibility.maxViolations) {
          this.log(`Accessibility: ${this.results.accessibility.violations} violations found`, 'warning');
        }
      }

      this.log(`Accessibility tests completed: ${this.results.accessibility.status} (${this.results.accessibility.violations} violations)`,
        this.results.accessibility.status === 'passed' ? 'success' : 'error');

    } catch (error) {
      this.results.accessibility.status = 'failed';
      this.log(`Accessibility tests failed: ${error.message}`, 'error');
    }
  }

  calculateOverallScore() {
    let score = 0;
    let weights = { unit: 0.4, integration: 0.25, e2e: 0.2, performance: 0.1, accessibility: 0.05 };

    Object.keys(weights).forEach(type => {
      if (this.results[type].status === 'passed') {
        score += weights[type] * 100;
      }
    });

    // Bonus points for high coverage
    if (this.results.unit.coverage >= this.config.coverage.critical) {
      score += 5;
    }

    // Penalty for violations
    if (this.results.accessibility.violations > 0) {
      score -= this.results.accessibility.violations * 2;
    }

    return Math.max(0, Math.min(100, score));
  }

  generateReport() {
    const overallScore = this.calculateOverallScore();
    this.results.overall.score = overallScore;
    this.results.overall.status = overallScore >= 80 ? 'passed' : 'failed';

    const report = `
===============================================
    COMPREHENSIVE TEST RESULTS SUMMARY
===============================================

📊 Test Results:
${this.types.map(type => {
  const result = this.results[type];
  const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${Math.round(result.duration / 1000)}s)` : '';
  return `  ${icon} ${type.toUpperCase()}: ${result.status.toUpperCase()}${duration}`;
}).join('\n')}

📈 Quality Metrics:
  Coverage: ${this.results.unit.coverage}% ${this.results.unit.coverage >= this.config.coverage.threshold ? '✅' : '❌'}
  Performance: ${this.results.performance.benchmarks.averageTime || 'N/A'}ms ${this.results.performance.benchmarks.averageTime <= this.config.performance.maxSearchTime ? '✅' : '❌'}
  Accessibility: ${this.results.accessibility.violations} violations ${this.results.accessibility.violations === 0 ? '✅' : '❌'}

🎯 Overall Score: ${overallScore.toFixed(1)}/100 ${overallScore >= 80 ? '✅ PASSED' : '❌ FAILED'}

${this.generateRecommendations()}

===============================================
Report generated: ${new Date().toISOString()}
===============================================
`;

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.unit.coverage < this.config.coverage.threshold) {
      recommendations.push(`🔧 Increase test coverage to ${this.config.coverage.threshold}%+`);
    }

    if (this.results.performance.benchmarks.averageTime > this.config.performance.maxSearchTime) {
      recommendations.push('⚡ Optimize search performance');
    }

    if (this.results.accessibility.violations > 0) {
      recommendations.push('♿ Fix accessibility violations');
    }

    const failedTests = Object.keys(this.results).filter(type =>
      this.results[type].status === 'failed'
    );

    if (failedTests.length > 0) {
      recommendations.push(`🔴 Fix failing tests: ${failedTests.join(', ')}`);
    }

    if (recommendations.length === 0) {
      return '🎉 All quality metrics are meeting requirements!';
    }

    return `💡 Recommendations:\n${recommendations.map(r => `  ${r}`).join('\n')}`;
  }

  async saveResults() {
    const resultsFile = 'comprehensive-test-results.json';
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    this.log(`Test results saved to ${resultsFile}`, 'success');

    // Generate HTML report if quality analyzer is available
    try {
      await this.runCommand('node', ['tests/quality-metrics/TestCoverageAnalyzer.ts']);
    } catch (error) {
      this.log('Could not generate quality report', 'warning');
    }
  }

  async run() {
    const startTime = Date.now();

    this.log('🚀 Starting comprehensive test suite...', 'success');
    this.log(`Running test types: ${this.types.join(', ')}`, 'info');

    try {
      // Run tests in parallel where possible
      await Promise.all([
        this.runUnitTests(),
        this.runIntegrationTests()
      ]);

      // Run E2E and performance tests sequentially (they need more resources)
      await this.runE2ETests();
      await this.runPerformanceTests();
      await this.runAccessibilityTests();

      const totalDuration = Date.now() - startTime;
      this.log(`All tests completed in ${Math.round(totalDuration / 1000)}s`, 'success');

      // Generate and display report
      const report = this.generateReport();
      console.log(report);

      // Save results
      await this.saveResults();

      // Exit with appropriate code
      const success = this.results.overall.status === 'passed';
      process.exit(success ? 0 : 1);

    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  runner.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { ComprehensiveTestRunner };