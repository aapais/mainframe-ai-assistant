/**
 * Comprehensive Integration Test Runner
 *
 * Orchestrates all integration tests with detailed reporting,
 * performance metrics, and failure analysis.
 *
 * @author Integration Tester Agent
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

// ===========================
// TEST SUITE CONFIGURATION
// ===========================

interface TestSuite {
  name: string;
  description: string;
  files: string[];
  timeout: number;
  retries: number;
  parallel: boolean;
  tags: string[];
  requirements: string[];
}

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  failures: TestFailure[];
  performance: PerformanceMetrics;
  accessibility: AccessibilityResults;
}

interface TestFailure {
  test: string;
  error: string;
  stack?: string;
  category: 'functional' | 'performance' | 'accessibility' | 'integration';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface PerformanceMetrics {
  averageResponseTime: number;
  memoryUsage: number;
  operationsPerSecond: number;
  slowestTests: Array<{ name: string; duration: number }>;
}

interface AccessibilityResults {
  violations: number;
  passes: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
  categories: Record<string, number>;
}

// ===========================
// TEST SUITE DEFINITIONS
// ===========================

const TEST_SUITES: TestSuite[] = [
  {
    name: 'category-tag-integration',
    description: 'Complete categorization and tagging system integration',
    files: ['CategoryTagSystem.integration.test.tsx'],
    timeout: 300000, // 5 minutes
    retries: 2,
    parallel: false,
    tags: ['integration', 'core', 'category', 'tag'],
    requirements: ['database', 'ui-components', 'services']
  },
  {
    name: 'performance-benchmarks',
    description: 'Performance benchmarking and optimization validation',
    files: ['PerformanceBenchmark.integration.test.ts'],
    timeout: 600000, // 10 minutes
    retries: 1,
    parallel: false,
    tags: ['performance', 'benchmarks', 'optimization'],
    requirements: ['large-datasets', 'memory-profiling']
  },
  {
    name: 'accessibility-compliance',
    description: 'WCAG 2.1 AA accessibility compliance testing',
    files: ['AccessibilityCompliance.integration.test.tsx'],
    timeout: 300000, // 5 minutes
    retries: 2,
    parallel: true,
    tags: ['accessibility', 'wcag', 'a11y', 'compliance'],
    requirements: ['axe-core', 'screen-reader-testing']
  }
];

// ===========================
// TEST RUNNER CLASS
// ===========================

export class IntegrationTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private outputDir: string;

  constructor(outputDir: string = './test-reports') {
    this.outputDir = outputDir;
    this.ensureOutputDirectory();
  }

  /**
   * Run all integration test suites
   */
  async runAllSuites(): Promise<{
    success: boolean;
    summary: TestSummary;
    results: TestResult[];
  }> {
    console.log('🚀 Starting Comprehensive Integration Test Suite');
    console.log('=' .repeat(60));

    this.startTime = performance.now();

    for (const suite of TEST_SUITES) {
      console.log(`\n📋 Running Suite: ${suite.name}`);
      console.log(`   ${suite.description}`);
      console.log(`   Files: ${suite.files.join(', ')}`);
      console.log(`   Tags: ${suite.tags.join(', ')}`);

      const result = await this.runSuite(suite);
      this.results.push(result);

      // Print immediate results
      this.printSuiteResults(result);

      // Stop on critical failures unless in CI mode
      if (result.failures.some(f => f.severity === 'critical') && !process.env.CI) {
        console.log('🛑 Critical failure detected. Stopping test run.');
        break;
      }
    }

    const totalDuration = performance.now() - this.startTime;
    const summary = this.generateSummary(totalDuration);

    // Generate comprehensive reports
    await this.generateReports(summary);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Integration Test Suite Complete');
    this.printSummary(summary);

    return {
      success: summary.overallSuccess,
      summary,
      results: this.results
    };
  }

  /**
   * Run a specific test suite
   */
  async runSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = performance.now();

    try {
      // Set up environment for suite
      await this.setupSuiteEnvironment(suite);

      // Run Jest with custom configuration
      const jestResult = await this.runJestSuite(suite);

      // Collect performance metrics
      const performance = await this.collectPerformanceMetrics(suite, jestResult);

      // Collect accessibility results
      const accessibility = await this.collectAccessibilityResults(suite, jestResult);

      const duration = performance.now() - startTime;

      return {
        suite: suite.name,
        passed: jestResult.numPassedTests,
        failed: jestResult.numFailedTests,
        skipped: jestResult.numPendingTests,
        duration,
        coverage: jestResult.coveragePercentage,
        failures: this.parseFailures(jestResult.testResults),
        performance,
        accessibility
      };

    } catch (error) {
      const duration = performance.now() - startTime;

      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        failures: [{
          test: 'Suite Setup',
          error: error instanceof Error ? error.message : String(error),
          category: 'integration',
          severity: 'critical'
        }],
        performance: {
          averageResponseTime: 0,
          memoryUsage: 0,
          operationsPerSecond: 0,
          slowestTests: []
        },
        accessibility: {
          violations: 0,
          passes: 0,
          wcagLevel: 'A',
          categories: {}
        }
      };
    }
  }

  /**
   * Set up environment for specific test suite
   */
  private async setupSuiteEnvironment(suite: TestSuite): Promise<void> {
    // Set environment variables based on suite requirements
    process.env.NODE_ENV = 'test';
    process.env.TEST_SUITE = suite.name;

    if (suite.requirements.includes('database')) {
      process.env.TEST_DATABASE = 'memory';
    }

    if (suite.requirements.includes('large-datasets')) {
      process.env.GENERATE_LARGE_DATASETS = 'true';
    }

    if (suite.requirements.includes('memory-profiling')) {
      process.env.ENABLE_MEMORY_PROFILING = 'true';
      // Expose garbage collector for memory tests
      if (global.gc) {
        process.env.EXPOSE_GC = 'true';
      }
    }
  }

  /**
   * Run Jest for a specific suite
   */
  private async runJestSuite(suite: TestSuite): Promise<any> {
    return new Promise((resolve, reject) => {
      const jestArgs = [
        '--testPathPattern', suite.files.join('|'),
        '--testTimeout', suite.timeout.toString(),
        '--maxWorkers', suite.parallel ? '4' : '1',
        '--coverage',
        '--coverageDirectory', join(this.outputDir, 'coverage', suite.name),
        '--json',
        '--outputFile', join(this.outputDir, 'raw', `${suite.name}.json`)
      ];

      if (suite.retries > 0) {
        jestArgs.push('--testFailureExitCode', '0'); // Don't exit on failures
      }

      const jestProcess = spawn('npx', ['jest', ...jestArgs], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      jestProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      jestProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      jestProcess.on('close', (code) => {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Jest execution failed: ${stderr || 'Unknown error'}`));
        }
      });

      // Handle timeout
      setTimeout(() => {
        jestProcess.kill('SIGTERM');
        reject(new Error(`Suite ${suite.name} timed out after ${suite.timeout}ms`));
      }, suite.timeout + 30000); // Extra 30s buffer
    });
  }

  /**
   * Collect performance metrics from test results
   */
  private async collectPerformanceMetrics(suite: TestSuite, jestResult: any): Promise<PerformanceMetrics> {
    const testResults = jestResult.testResults || [];
    const durations = testResults.map((result: any) => result.perfStats?.end - result.perfStats?.start || 0);

    return {
      averageResponseTime: durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length || 0,
      memoryUsage: this.getMemoryUsage(),
      operationsPerSecond: this.calculateOperationsPerSecond(testResults),
      slowestTests: this.findSlowestTests(testResults, 5)
    };
  }

  /**
   * Collect accessibility results from test output
   */
  private async collectAccessibilityResults(suite: TestSuite, jestResult: any): Promise<AccessibilityResults> {
    // Parse accessibility violations from test output
    const accessibilityTests = jestResult.testResults
      ?.filter((result: any) => result.testFilePath?.includes('Accessibility'))
      || [];

    let violations = 0;
    let passes = 0;
    const categories: Record<string, number> = {};

    accessibilityTests.forEach((test: any) => {
      test.assertionResults?.forEach((assertion: any) => {
        if (assertion.title?.includes('accessibility') || assertion.title?.includes('axe')) {
          if (assertion.status === 'passed') {
            passes++;
          } else if (assertion.status === 'failed') {
            violations++;
            // Categorize violation types
            const category = this.categorizeAccessibilityViolation(assertion.failureMessages?.[0] || '');
            categories[category] = (categories[category] || 0) + 1;
          }
        }
      });
    });

    return {
      violations,
      passes,
      wcagLevel: violations === 0 ? 'AA' : violations < 5 ? 'A' : 'A',
      categories
    };
  }

  /**
   * Parse test failures from Jest results
   */
  private parseFailures(testResults: any[]): TestFailure[] {
    const failures: TestFailure[] = [];

    testResults.forEach(result => {
      result.assertionResults?.forEach((assertion: any) => {
        if (assertion.status === 'failed') {
          failures.push({
            test: `${result.testFilePath}:${assertion.title}`,
            error: assertion.failureMessages?.join('\n') || 'Unknown error',
            stack: assertion.stack,
            category: this.categorizeFailure(assertion.title, assertion.failureMessages?.[0] || ''),
            severity: this.categorizeFailureSeverity(assertion.failureMessages?.[0] || '')
          });
        }
      });
    });

    return failures;
  }

  /**
   * Generate comprehensive test summary
   */
  private generateSummary(totalDuration: number): TestSummary {
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);

    const criticalFailures = this.results.flatMap(r => r.failures)
      .filter(f => f.severity === 'critical').length;

    const averageCoverage = this.results
      .filter(r => r.coverage !== undefined)
      .reduce((sum, r) => sum + (r.coverage || 0), 0) / this.results.length;

    const performanceIssues = this.results
      .filter(r => r.performance.averageResponseTime > 1000).length;

    const accessibilityIssues = this.results
      .reduce((sum, r) => sum + r.accessibility.violations, 0);

    return {
      overallSuccess: totalFailed === 0 && criticalFailures === 0,
      totalDuration,
      suiteCount: this.results.length,
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      passRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0,
      averageCoverage,
      criticalFailures,
      performanceIssues,
      accessibilityIssues,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate detailed reports
   */
  private async generateReports(summary: TestSummary): Promise<void> {
    // HTML Report
    await this.generateHTMLReport(summary);

    // JSON Report
    await this.generateJSONReport(summary);

    // JUnit XML Report (for CI integration)
    await this.generateJUnitReport(summary);

    // Performance Report
    await this.generatePerformanceReport();

    // Accessibility Report
    await this.generateAccessibilityReport();

    console.log(`\n📁 Reports generated in: ${this.outputDir}`);
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(summary: TestSummary): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .danger { color: #dc3545; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { padding: 15px; background: #f8f9fa; border-radius: 5px; text-align: center; }
        .failures { margin: 20px 0; }
        .failure { background: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 3px; }
        .recommendations { background: #d1ecf1; padding: 15px; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Integration Test Report</h1>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Duration:</strong> ${this.formatDuration(summary.totalDuration)}</p>
        <p class="${summary.overallSuccess ? 'success' : 'danger'}">
            <strong>Status:</strong> ${summary.overallSuccess ? 'PASSED' : 'FAILED'}
        </p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Total Tests</h3>
            <div style="font-size: 2em;">${summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Pass Rate</h3>
            <div style="font-size: 2em; color: ${summary.passRate >= 90 ? '#28a745' : summary.passRate >= 75 ? '#ffc107' : '#dc3545'};">
                ${summary.passRate.toFixed(1)}%
            </div>
        </div>
        <div class="metric">
            <h3>Coverage</h3>
            <div style="font-size: 2em;">${summary.averageCoverage.toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>Critical Issues</h3>
            <div style="font-size: 2em; color: ${summary.criticalFailures > 0 ? '#dc3545' : '#28a745'};">
                ${summary.criticalFailures}
            </div>
        </div>
    </div>

    <h2>Suite Results</h2>
    ${this.results.map(result => `
        <div class="suite">
            <h3>${result.suite}</h3>
            <p><strong>Duration:</strong> ${this.formatDuration(result.duration)}</p>
            <p><strong>Tests:</strong>
                <span class="success">${result.passed} passed</span>,
                <span class="danger">${result.failed} failed</span>,
                <span class="warning">${result.skipped} skipped</span>
            </p>
            ${result.coverage ? `<p><strong>Coverage:</strong> ${result.coverage.toFixed(1)}%</p>` : ''}
            <p><strong>Performance:</strong> ${result.performance.averageResponseTime.toFixed(2)}ms avg response</p>
            <p><strong>Accessibility:</strong> ${result.accessibility.violations} violations, ${result.accessibility.passes} passes</p>
        </div>
    `).join('')}

    ${summary.criticalFailures > 0 ? `
        <div class="failures">
            <h2>Critical Failures</h2>
            ${this.results.flatMap(r => r.failures)
                .filter(f => f.severity === 'critical')
                .map(f => `
                    <div class="failure">
                        <h4>${f.test}</h4>
                        <p><strong>Category:</strong> ${f.category}</p>
                        <pre>${f.error}</pre>
                    </div>
                `).join('')}
        </div>
    ` : ''}

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>
    `;

    writeFileSync(join(this.outputDir, 'integration-report.html'), html);
  }

  /**
   * Generate JSON report
   */
  private async generateJSONReport(summary: TestSummary): Promise<void> {
    const report = {
      summary,
      results: this.results,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        ci: !!process.env.CI
      }
    };

    writeFileSync(
      join(this.outputDir, 'integration-report.json'),
      JSON.stringify(report, null, 2)
    );
  }

  /**
   * Generate JUnit XML report for CI integration
   */
  private async generateJUnitReport(summary: TestSummary): Promise<void> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${summary.totalTests}" failures="${summary.totalFailed}" time="${(summary.totalDuration / 1000).toFixed(3)}">
${this.results.map(result => `
  <testsuite name="${result.suite}" tests="${result.passed + result.failed + result.skipped}" failures="${result.failed}" time="${(result.duration / 1000).toFixed(3)}">
    ${result.failures.map(failure => `
    <testcase name="${failure.test}" classname="${result.suite}">
      <failure message="${failure.error.split('\n')[0]}" type="${failure.category}">
        ${failure.error}
      </failure>
    </testcase>
    `).join('')}
  </testsuite>
`).join('')}
</testsuites>`;

    writeFileSync(join(this.outputDir, 'junit-report.xml'), xml);
  }

  /**
   * Generate performance-specific report
   */
  private async generatePerformanceReport(): Promise<void> {
    const performanceData = this.results.map(result => ({
      suite: result.suite,
      averageResponseTime: result.performance.averageResponseTime,
      memoryUsage: result.performance.memoryUsage,
      operationsPerSecond: result.performance.operationsPerSecond,
      slowestTests: result.performance.slowestTests
    }));

    writeFileSync(
      join(this.outputDir, 'performance-report.json'),
      JSON.stringify(performanceData, null, 2)
    );

    console.log('📊 Performance report generated');
  }

  /**
   * Generate accessibility-specific report
   */
  private async generateAccessibilityReport(): Promise<void> {
    const accessibilityData = this.results.map(result => ({
      suite: result.suite,
      violations: result.accessibility.violations,
      passes: result.accessibility.passes,
      wcagLevel: result.accessibility.wcagLevel,
      categories: result.accessibility.categories
    }));

    writeFileSync(
      join(this.outputDir, 'accessibility-report.json'),
      JSON.stringify(accessibilityData, null, 2)
    );

    console.log('♿ Accessibility report generated');
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  private ensureOutputDirectory(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }

    // Create subdirectories
    ['raw', 'coverage'].forEach(dir => {
      const path = join(this.outputDir, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    });
  }

  private printSuiteResults(result: TestResult): void {
    const status = result.failed === 0 ? '✅ PASSED' : '❌ FAILED';
    const duration = this.formatDuration(result.duration);

    console.log(`   ${status} in ${duration}`);
    console.log(`   Tests: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);

    if (result.failures.length > 0) {
      console.log(`   ⚠️  ${result.failures.length} failures detected`);
    }
  }

  private printSummary(summary: TestSummary): void {
    console.log(`
📈 Overall Results:
   Status: ${summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}
   Duration: ${this.formatDuration(summary.totalDuration)}
   Tests: ${summary.totalTests} total
   Pass Rate: ${summary.passRate.toFixed(1)}%
   Coverage: ${summary.averageCoverage.toFixed(1)}%
   Critical Issues: ${summary.criticalFailures}
   Performance Issues: ${summary.performanceIssues}
   Accessibility Issues: ${summary.accessibilityIssues}
    `);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  private getMemoryUsage(): number {
    if (typeof (performance as any).memory !== 'undefined') {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private calculateOperationsPerSecond(testResults: any[]): number {
    // Simplified calculation based on test count and duration
    const totalTests = testResults.length;
    const totalDuration = testResults.reduce((sum, result) => {
      return sum + (result.perfStats?.end - result.perfStats?.start || 1000);
    }, 0);

    return totalDuration > 0 ? (totalTests / totalDuration) * 1000 : 0;
  }

  private findSlowestTests(testResults: any[], limit: number): Array<{ name: string; duration: number }> {
    return testResults
      .map(result => ({
        name: result.testFilePath?.split('/').pop() || 'Unknown',
        duration: result.perfStats?.end - result.perfStats?.start || 0
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  private categorizeFailure(title: string, message: string): TestFailure['category'] {
    if (title.includes('performance') || message.includes('timeout')) return 'performance';
    if (title.includes('accessibility') || message.includes('axe')) return 'accessibility';
    if (title.includes('integration') || message.includes('database')) return 'integration';
    return 'functional';
  }

  private categorizeFailureSeverity(message: string): TestFailure['severity'] {
    if (message.includes('critical') || message.includes('fatal')) return 'critical';
    if (message.includes('memory') || message.includes('timeout')) return 'high';
    if (message.includes('warning') || message.includes('deprecated')) return 'medium';
    return 'low';
  }

  private categorizeAccessibilityViolation(message: string): string {
    if (message.includes('color-contrast')) return 'Color Contrast';
    if (message.includes('keyboard') || message.includes('focus')) return 'Keyboard Navigation';
    if (message.includes('aria') || message.includes('label')) return 'ARIA Labels';
    if (message.includes('heading') || message.includes('landmark')) return 'Structure';
    return 'Other';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const totalFailures = this.results.reduce((sum, r) => sum + r.failed, 0);
    const avgCoverage = this.results.reduce((sum, r) => sum + (r.coverage || 0), 0) / this.results.length;
    const performanceIssues = this.results.filter(r => r.performance.averageResponseTime > 1000);
    const accessibilityViolations = this.results.reduce((sum, r) => sum + r.accessibility.violations, 0);

    if (totalFailures > 0) {
      recommendations.push(`Address ${totalFailures} test failures to improve system reliability`);
    }

    if (avgCoverage < 80) {
      recommendations.push(`Increase test coverage from ${avgCoverage.toFixed(1)}% to at least 80%`);
    }

    if (performanceIssues.length > 0) {
      recommendations.push(`Optimize performance for ${performanceIssues.length} slow test suites`);
    }

    if (accessibilityViolations > 0) {
      recommendations.push(`Fix ${accessibilityViolations} accessibility violations for WCAG compliance`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Great work! All tests are passing with good coverage and performance.');
    }

    return recommendations;
  }
}

// ===========================
// INTERFACES
// ===========================

interface TestSummary {
  overallSuccess: boolean;
  totalDuration: number;
  suiteCount: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  passRate: number;
  averageCoverage: number;
  criticalFailures: number;
  performanceIssues: number;
  accessibilityIssues: number;
  recommendations: string[];
}

// ===========================
// CLI RUNNER
// ===========================

if (require.main === module) {
  const runner = new IntegrationTestRunner('./test-reports');

  runner.runAllSuites()
    .then(({ success, summary }) => {
      console.log('\n🏁 Integration test run complete');

      if (success) {
        console.log('✅ All tests passed successfully!');
        process.exit(0);
      } else {
        console.log('❌ Some tests failed. Check the reports for details.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

export { IntegrationTestRunner, TEST_SUITES };