/**
 * Workflow Test Runner - Orchestrates end-to-end workflow validation
 * Executes comprehensive test suites with detailed reporting and validation
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { WorkflowTestHelper } from '../helpers/WorkflowTestHelper';
import { PerformanceMonitor } from '../helpers/PerformanceMonitor';
import { DataIntegrityChecker } from '../helpers/DataIntegrityChecker';

export interface TestSuiteConfig {
  name: string;
  testFiles: string[];
  timeout: number;
  parallel: boolean;
  retries: number;
  environment: 'development' | 'staging' | 'production';
}

export interface TestExecutionResult {
  suiteName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  successRate: number;
  errors: Array<{
    test: string;
    error: string;
    screenshot?: string;
  }>;
  performanceMetrics: any;
  integrityReport: any;
}

export interface ComprehensiveTestReport {
  timestamp: Date;
  environment: string;
  totalSuites: number;
  overallSuccessRate: number;
  totalDuration: number;
  suiteResults: TestExecutionResult[];
  recommendations: string[];
  deploymentReadiness: boolean;
}

export class WorkflowTestRunner {
  private workflowHelper: WorkflowTestHelper;
  private performanceMonitor: PerformanceMonitor;
  private dataIntegrityChecker: DataIntegrityChecker;
  private resultsDir: string;

  constructor() {
    this.workflowHelper = new WorkflowTestHelper();
    this.performanceMonitor = new PerformanceMonitor();
    this.dataIntegrityChecker = new DataIntegrityChecker();
    this.resultsDir = path.join(process.cwd(), 'tests/results');
  }

  /**
   * Execute comprehensive workflow validation test suite
   */
  async runComprehensiveValidation(): Promise<ComprehensiveTestReport> {
    console.log('🚀 Starting Comprehensive Workflow Validation');
    console.log('============================================');

    const startTime = Date.now();
    const environment = process.env.NODE_ENV || 'development';

    // Ensure results directory exists
    await fs.mkdir(this.resultsDir, { recursive: true });

    // Initialize monitoring and helpers
    await this.initializeTestEnvironment();

    // Define test suites in order of execution
    const testSuites: TestSuiteConfig[] = [
      {
        name: 'Support Team Operational Validation',
        testFiles: ['tests/e2e-workflows/support-team-operational-validation.test.ts'],
        timeout: 300000, // 5 minutes
        parallel: false,
        retries: 1,
        environment: environment as any
      },
      {
        name: 'Performance and Load Validation',
        testFiles: ['tests/e2e-workflows/performance-load-validation.test.ts'],
        timeout: 600000, // 10 minutes
        parallel: false,
        retries: 0,
        environment: environment as any
      },
      {
        name: 'Integration and Fallback Validation',
        testFiles: ['tests/e2e-workflows/integration-fallback-validation.test.ts'],
        timeout: 300000, // 5 minutes
        parallel: false,
        retries: 1,
        environment: environment as any
      }
    ];

    const suiteResults: TestExecutionResult[] = [];

    // Execute test suites sequentially
    for (const suite of testSuites) {
      console.log(`\n📋 Executing: ${suite.name}`);
      console.log(`   Files: ${suite.testFiles.join(', ')}`);
      console.log(`   Timeout: ${suite.timeout / 1000}s, Retries: ${suite.retries}`);

      const suiteResult = await this.executeSuite(suite);
      suiteResults.push(suiteResult);

      // Log suite results
      console.log(`   ✅ Passed: ${suiteResult.passedTests}`);
      console.log(`   ❌ Failed: ${suiteResult.failedTests}`);
      console.log(`   ⏭️  Skipped: ${suiteResult.skippedTests}`);
      console.log(`   📊 Success Rate: ${(suiteResult.successRate * 100).toFixed(1)}%`);
      console.log(`   ⏱️  Duration: ${(suiteResult.duration / 1000).toFixed(1)}s`);

      // Early termination for critical failures
      if (suiteResult.successRate < 0.7) {
        console.log(`\n⚠️  Critical failure rate in ${suite.name} - stopping execution`);
        break;
      }
    }

    // Finalize monitoring and generate reports
    await this.finalizeTestEnvironment();

    // Generate comprehensive report
    const report = await this.generateComprehensiveReport(environment, suiteResults, startTime);

    // Save report to file
    await this.saveReport(report);

    // Display final results
    await this.displayFinalResults(report);

    return report;
  }

  /**
   * Execute individual test suite
   */
  private async executeSuite(suite: TestSuiteConfig): Promise<TestExecutionResult> {
    const suiteStartTime = Date.now();

    const result: TestExecutionResult = {
      suiteName: suite.name,
      startTime: new Date(suiteStartTime),
      endTime: new Date(),
      duration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      successRate: 0,
      errors: [],
      performanceMetrics: {},
      integrityReport: {}
    };

    try {
      // Prepare Playwright command
      const playwrightCmd = [
        'npx',
        'playwright',
        'test',
        ...suite.testFiles,
        '--timeout', suite.timeout.toString(),
        '--retries', suite.retries.toString(),
        '--reporter=json',
        `--output=${this.resultsDir}/${suite.name.replace(/\s+/g, '-').toLowerCase()}`
      ];

      if (!suite.parallel) {
        playwrightCmd.push('--workers=1');
      }

      console.log(`   🔧 Command: ${playwrightCmd.join(' ')}`);

      // Execute tests
      const testProcess = spawn(playwrightCmd[0], playwrightCmd.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Wait for test completion
      const exitCode = await new Promise<number>((resolve) => {
        testProcess.on('exit', (code) => resolve(code || 0));
      });

      // Parse results
      await this.parseTestResults(result, stdout, stderr, exitCode);

    } catch (error) {
      console.error(`   ❌ Suite execution failed: ${error.message}`);
      result.errors.push({
        test: suite.name,
        error: error.message
      });
    }

    result.endTime = new Date();
    result.duration = Date.now() - suiteStartTime;

    // Calculate success rate
    if (result.totalTests > 0) {
      result.successRate = result.passedTests / result.totalTests;
    }

    // Collect performance metrics for this suite
    result.performanceMetrics = this.performanceMonitor.getPerformanceSummary();

    return result;
  }

  /**
   * Parse Playwright test results from JSON output
   */
  private async parseTestResults(
    result: TestExecutionResult,
    stdout: string,
    stderr: string,
    exitCode: number
  ): Promise<void> {
    try {
      // Look for JSON report in output
      const jsonMatch = stdout.match(/(\{.*\})/s);
      if (jsonMatch) {
        const testResults = JSON.parse(jsonMatch[1]);

        result.totalTests = testResults.stats?.total || 0;
        result.passedTests = testResults.stats?.passed || 0;
        result.failedTests = testResults.stats?.failed || 0;
        result.skippedTests = testResults.stats?.skipped || 0;

        // Extract error details
        if (testResults.suites) {
          this.extractTestErrors(testResults.suites, result.errors);
        }
      } else {
        // Fallback: parse from stdout/stderr
        result.totalTests = this.countOccurrences(stdout, /✓|✗|⊝/g);
        result.passedTests = this.countOccurrences(stdout, /✓/g);
        result.failedTests = this.countOccurrences(stdout, /✗/g);
        result.skippedTests = this.countOccurrences(stdout, /⊝/g);

        if (stderr) {
          result.errors.push({
            test: result.suiteName,
            error: stderr.substring(0, 1000) // Truncate long errors
          });
        }
      }

      // Ensure counts are consistent
      if (result.totalTests === 0) {
        result.totalTests = result.passedTests + result.failedTests + result.skippedTests;
      }

    } catch (error) {
      console.warn(`   ⚠️  Failed to parse test results: ${error.message}`);
      result.errors.push({
        test: 'Result Parsing',
        error: `Failed to parse test output: ${error.message}`
      });
    }
  }

  /**
   * Extract error details from test results recursively
   */
  private extractTestErrors(suites: any[], errors: TestExecutionResult['errors']): void {
    for (const suite of suites) {
      if (suite.tests) {
        for (const test of suite.tests) {
          if (test.status === 'failed') {
            errors.push({
              test: test.title,
              error: test.error?.message || 'Test failed',
              screenshot: test.screenshot || undefined
            });
          }
        }
      }

      if (suite.suites) {
        this.extractTestErrors(suite.suites, errors);
      }
    }
  }

  /**
   * Count occurrences of pattern in text
   */
  private countOccurrences(text: string, pattern: RegExp): number {
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  }

  /**
   * Initialize test environment
   */
  private async initializeTestEnvironment(): Promise<void> {
    console.log('🔧 Initializing test environment...');

    // Start performance monitoring
    this.performanceMonitor.startMonitoring(1000);

    // Initialize test helpers
    await this.workflowHelper.createPerformanceBaseline();

    // Validate initial system state
    const initialIntegrity = await this.dataIntegrityChecker.validateDatabase();
    if (!initialIntegrity.isValid) {
      console.warn('⚠️  Initial data integrity issues detected');
      initialIntegrity.violations.forEach(violation => {
        console.warn(`   - ${violation.type}: ${violation.description}`);
      });
    }

    console.log('✅ Test environment initialized');
  }

  /**
   * Finalize test environment and collect final metrics
   */
  private async finalizeTestEnvironment(): Promise<void> {
    console.log('🏁 Finalizing test environment...');

    // Stop monitoring and generate reports
    this.performanceMonitor.stopMonitoring();
    await this.performanceMonitor.generateReport();

    // Final data integrity check
    const finalIntegrity = await this.dataIntegrityChecker.validateDatabase();
    await this.dataIntegrityChecker.exportReport(finalIntegrity);

    // Cleanup test artifacts
    await this.workflowHelper.cleanup();

    console.log('✅ Test environment finalized');
  }

  /**
   * Generate comprehensive test report
   */
  private async generateComprehensiveReport(
    environment: string,
    suiteResults: TestExecutionResult[],
    startTime: number
  ): Promise<ComprehensiveTestReport> {
    const totalDuration = Date.now() - startTime;

    const totalTests = suiteResults.reduce((sum, r) => sum + r.totalTests, 0);
    const totalPassed = suiteResults.reduce((sum, r) => sum + r.passedTests, 0);
    const overallSuccessRate = totalTests > 0 ? totalPassed / totalTests : 0;

    // Generate recommendations based on results
    const recommendations = this.generateRecommendations(suiteResults);

    // Determine deployment readiness
    const deploymentReadiness = this.assessDeploymentReadiness(suiteResults, overallSuccessRate);

    return {
      timestamp: new Date(),
      environment,
      totalSuites: suiteResults.length,
      overallSuccessRate,
      totalDuration,
      suiteResults,
      recommendations,
      deploymentReadiness
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(suiteResults: TestExecutionResult[]): string[] {
    const recommendations: string[] = [];

    // Analyze success rates
    const lowPerformanceSuites = suiteResults.filter(r => r.successRate < 0.9);
    if (lowPerformanceSuites.length > 0) {
      recommendations.push(
        `Improve test success rates in: ${lowPerformanceSuites.map(s => s.suiteName).join(', ')}`
      );
    }

    // Analyze performance metrics
    const hasPerformanceIssues = suiteResults.some(r =>
      r.performanceMetrics?.alerts?.some((alert: any) => alert.level === 'critical')
    );
    if (hasPerformanceIssues) {
      recommendations.push('Address critical performance alerts before deployment');
    }

    // Analyze error patterns
    const commonErrors = this.findCommonErrors(suiteResults);
    if (commonErrors.length > 0) {
      recommendations.push(`Address common failure patterns: ${commonErrors.join(', ')}`);
    }

    // Analyze test duration
    const slowSuites = suiteResults.filter(r => r.duration > 300000); // > 5 minutes
    if (slowSuites.length > 0) {
      recommendations.push('Optimize test execution time for better development workflow');
    }

    // Default recommendations if no issues found
    if (recommendations.length === 0) {
      recommendations.push('All validation criteria met - system ready for deployment');
      recommendations.push('Continue monitoring performance in production environment');
    }

    return recommendations;
  }

  /**
   * Find common error patterns across test suites
   */
  private findCommonErrors(suiteResults: TestExecutionResult[]): string[] {
    const errorCounts = new Map<string, number>();

    suiteResults.forEach(suite => {
      suite.errors.forEach(error => {
        // Extract key terms from error messages
        const keyTerms = error.error.toLowerCase().match(/\b\w{4,}\b/g) || [];
        keyTerms.forEach(term => {
          errorCounts.set(term, (errorCounts.get(term) || 0) + 1);
        });
      });
    });

    // Return terms that appear in multiple errors
    return Array.from(errorCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([term]) => term)
      .slice(0, 5); // Top 5 common terms
  }

  /**
   * Assess deployment readiness based on test results
   */
  private assessDeploymentReadiness(
    suiteResults: TestExecutionResult[],
    overallSuccessRate: number
  ): boolean {
    // Minimum criteria for deployment readiness
    const criteria = {
      minOverallSuccessRate: 0.85, // 85%
      minSuiteSuccessRate: 0.70,   // 70% per suite
      maxCriticalErrors: 0,         // No critical errors
      maxSuiteFailures: 1          // Max 1 suite can fail completely
    };

    // Check overall success rate
    if (overallSuccessRate < criteria.minOverallSuccessRate) {
      return false;
    }

    // Check individual suite success rates
    const failingSuites = suiteResults.filter(r => r.successRate < criteria.minSuiteSuccessRate);
    if (failingSuites.length > criteria.maxSuiteFailures) {
      return false;
    }

    // Check for critical performance issues
    const hasCriticalAlerts = suiteResults.some(r =>
      r.performanceMetrics?.alerts?.some((alert: any) => alert.level === 'critical')
    );
    if (hasCriticalAlerts) {
      return false;
    }

    // Check for data integrity issues
    const hasIntegrityIssues = suiteResults.some(r =>
      r.integrityReport?.violations?.some((v: any) => v.severity === 'critical')
    );
    if (hasIntegrityIssues) {
      return false;
    }

    return true;
  }

  /**
   * Save comprehensive report to file
   */
  private async saveReport(report: ComprehensiveTestReport): Promise<string> {
    const reportPath = path.join(
      this.resultsDir,
      `comprehensive-validation-report-${Date.now()}.json`
    );

    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      // Also create a human-readable summary
      const summaryPath = reportPath.replace('.json', '-summary.txt');
      const summary = this.generateReportSummary(report);
      await fs.writeFile(summaryPath, summary);

      console.log(`📊 Comprehensive report saved: ${reportPath}`);
      console.log(`📄 Summary report saved: ${summaryPath}`);

      return reportPath;
    } catch (error) {
      console.error(`❌ Failed to save report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate human-readable report summary
   */
  private generateReportSummary(report: ComprehensiveTestReport): string {
    const duration = (report.totalDuration / 1000 / 60).toFixed(1);

    return `
MAINFRAME KB ASSISTANT - COMPREHENSIVE VALIDATION REPORT
========================================================
Generated: ${report.timestamp.toISOString()}
Environment: ${report.environment}
Total Duration: ${duration} minutes

OVERALL RESULTS:
${report.deploymentReadiness ? '🟢' : '🔴'} Deployment Status: ${report.deploymentReadiness ? 'READY' : 'NOT READY'}
📊 Overall Success Rate: ${(report.overallSuccessRate * 100).toFixed(1)}%
📋 Test Suites Executed: ${report.totalSuites}

SUITE BREAKDOWN:
${report.suiteResults.map(suite => `
${suite.successRate >= 0.9 ? '🟢' : suite.successRate >= 0.7 ? '🟡' : '🔴'} ${suite.suiteName}
   Success Rate: ${(suite.successRate * 100).toFixed(1)}%
   Tests: ${suite.totalTests} (✅${suite.passedTests} ❌${suite.failedTests} ⏭️${suite.skippedTests})
   Duration: ${(suite.duration / 1000).toFixed(1)}s
   ${suite.errors.length > 0 ? `Errors: ${suite.errors.length}` : 'No errors'}
`).join('')}

RECOMMENDATIONS:
${report.recommendations.map(rec => `• ${rec}`).join('\n')}

DEPLOYMENT READINESS ASSESSMENT:
${report.deploymentReadiness ?
  '✅ System meets all validation criteria and is ready for deployment' :
  '❌ System does not meet minimum validation criteria - address issues before deployment'
}

For detailed results, see the full JSON report.
`;
  }

  /**
   * Display final results in console
   */
  private async displayFinalResults(report: ComprehensiveTestReport): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('🏆 COMPREHENSIVE WORKFLOW VALIDATION COMPLETE');
    console.log('='.repeat(80));

    console.log(`\n📊 OVERALL RESULTS:`);
    console.log(`   Environment: ${report.environment}`);
    console.log(`   Duration: ${(report.totalDuration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   Success Rate: ${(report.overallSuccessRate * 100).toFixed(1)}%`);
    console.log(`   Suites Executed: ${report.totalSuites}`);

    const statusIcon = report.deploymentReadiness ? '🟢' : '🔴';
    const statusText = report.deploymentReadiness ? 'READY FOR DEPLOYMENT' : 'NEEDS ATTENTION';
    console.log(`\n${statusIcon} DEPLOYMENT STATUS: ${statusText}`);

    if (report.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      report.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }

    if (!report.deploymentReadiness) {
      console.log(`\n⚠️  CRITICAL ISSUES TO ADDRESS:`);
      report.suiteResults.forEach(suite => {
        if (suite.successRate < 0.7) {
          console.log(`   • ${suite.suiteName}: ${(suite.successRate * 100).toFixed(1)}% success rate`);
        }
        if (suite.errors.length > 0) {
          console.log(`   • ${suite.suiteName}: ${suite.errors.length} errors`);
        }
      });
    }

    console.log('\n' + '='.repeat(80));
  }

  /**
   * Run individual test suite by name
   */
  async runSuite(suiteName: string): Promise<TestExecutionResult> {
    const suites: { [key: string]: TestSuiteConfig } = {
      'support-team': {
        name: 'Support Team Operational Validation',
        testFiles: ['tests/e2e-workflows/support-team-operational-validation.test.ts'],
        timeout: 300000,
        parallel: false,
        retries: 1,
        environment: 'development'
      },
      'performance': {
        name: 'Performance and Load Validation',
        testFiles: ['tests/e2e-workflows/performance-load-validation.test.ts'],
        timeout: 600000,
        parallel: false,
        retries: 0,
        environment: 'development'
      },
      'integration': {
        name: 'Integration and Fallback Validation',
        testFiles: ['tests/e2e-workflows/integration-fallback-validation.test.ts'],
        timeout: 300000,
        parallel: false,
        retries: 1,
        environment: 'development'
      }
    };

    const suite = suites[suiteName];
    if (!suite) {
      throw new Error(`Unknown test suite: ${suiteName}`);
    }

    await this.initializeTestEnvironment();
    const result = await this.executeSuite(suite);
    await this.finalizeTestEnvironment();

    return result;
  }

  /**
   * Generate quick validation report (subset of tests for faster feedback)
   */
  async runQuickValidation(): Promise<ComprehensiveTestReport> {
    console.log('⚡ Running Quick Validation (subset of tests)');

    const quickSuites: TestSuiteConfig[] = [
      {
        name: 'Essential Support Team Workflows',
        testFiles: ['tests/e2e-workflows/support-team-operational-validation.test.ts'],
        timeout: 120000, // 2 minutes
        parallel: false,
        retries: 0,
        environment: 'development'
      }
    ];

    await this.initializeTestEnvironment();

    const suiteResults: TestExecutionResult[] = [];
    for (const suite of quickSuites) {
      const result = await this.executeSuite(suite);
      suiteResults.push(result);
    }

    await this.finalizeTestEnvironment();

    const report = await this.generateComprehensiveReport('development', suiteResults, Date.now());
    await this.saveReport(report);

    return report;
  }

  /**
   * Cleanup test environment and resources
   */
  async cleanup(): Promise<void> {
    await this.workflowHelper.cleanup();
    await this.performanceMonitor.cleanup();
    await this.dataIntegrityChecker.cleanup();
  }
}

// CLI entry point when run directly
if (require.main === module) {
  const runner = new WorkflowTestRunner();
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'full':
        case 'comprehensive':
          await runner.runComprehensiveValidation();
          break;
        case 'quick':
          await runner.runQuickValidation();
          break;
        case 'support-team':
        case 'performance':
        case 'integration':
          await runner.runSuite(command);
          break;
        default:
          console.log('Usage: node workflow-test-runner.ts [full|quick|support-team|performance|integration]');
          console.log('  full/comprehensive: Run all validation suites');
          console.log('  quick: Run essential validation only');
          console.log('  support-team: Run support team workflow tests');
          console.log('  performance: Run performance and load tests');
          console.log('  integration: Run integration and fallback tests');
          process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Test execution failed: ${error.message}`);
      process.exit(1);
    } finally {
      await runner.cleanup();
    }
  })();
}