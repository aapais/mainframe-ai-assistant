/**
 * Component Interaction Test Runner
 *
 * Comprehensive test runner for all component interaction tests.
 * Provides orchestration, reporting, and performance tracking.
 *
 * @author UI Testing Specialist
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface TestSuite {
  name: string;
  description: string;
  testFile: string;
  category: 'core' | 'integration' | 'performance' | 'accessibility';
  timeout?: number;
  dependencies?: string[];
}

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  errors?: string[];
}

interface TestRunnerConfig {
  parallel?: boolean;
  maxWorkers?: number;
  timeout?: number;
  coverage?: boolean;
  watch?: boolean;
  verbose?: boolean;
  failFast?: boolean;
  suites?: string[];
  outputFormat?: 'json' | 'html' | 'text';
  outputFile?: string;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Component Interaction Framework',
    description: 'Core testing framework and utilities',
    testFile: 'ComponentInteractionTestSuite.ts',
    category: 'core',
    timeout: 30000
  },
  {
    name: 'Search Component Interactions',
    description: 'Search interface and component communication',
    testFile: 'SearchComponentInteraction.test.tsx',
    category: 'integration',
    timeout: 60000,
    dependencies: ['ComponentInteractionTestSuite.ts']
  },
  {
    name: 'Layout Navigation Interactions',
    description: 'Layout components and navigation patterns',
    testFile: 'LayoutNavigationInteraction.test.tsx',
    category: 'integration',
    timeout: 45000,
    dependencies: ['ComponentInteractionTestSuite.ts']
  },
  {
    name: 'KB Manager Form Integration',
    description: 'Knowledge base management and form interactions',
    testFile: 'KBManagerFormInteraction.test.tsx',
    category: 'integration',
    timeout: 90000,
    dependencies: ['ComponentInteractionTestSuite.ts']
  },
  {
    name: 'Event Propagation State Management',
    description: 'Event handling and state management patterns',
    testFile: 'EventPropagationStateManagement.test.tsx',
    category: 'core',
    timeout: 45000,
    dependencies: ['ComponentInteractionTestSuite.ts']
  },
  {
    name: 'Component Composition Patterns',
    description: 'HOCs, render props, and composition patterns',
    testFile: 'ComponentCompositionPatterns.test.tsx',
    category: 'core',
    timeout: 60000,
    dependencies: ['ComponentInteractionTestSuite.ts']
  },
  {
    name: 'Modal Overlay Interactions',
    description: 'Modal components and overlay behaviors',
    testFile: 'ModalOverlayInteraction.test.tsx',
    category: 'integration',
    timeout: 75000,
    dependencies: ['ComponentInteractionTestSuite.ts']
  },
  {
    name: 'Performance Optimization Patterns',
    description: 'Memoization, virtualization, and performance patterns',
    testFile: 'PerformanceOptimizationPatterns.test.tsx',
    category: 'performance',
    timeout: 120000,
    dependencies: ['ComponentInteractionTestSuite.ts']
  },
  {
    name: 'Component Isolation Dependencies',
    description: 'Component isolation and dependency injection',
    testFile: 'ComponentIsolationDependency.test.tsx',
    category: 'core',
    timeout: 60000,
    dependencies: ['ComponentInteractionTestSuite.ts']
  }
];

export class ComponentInteractionTestRunner {
  private config: TestRunnerConfig;
  private results: Map<string, TestResult> = new Map();
  private startTime: number = 0;

  constructor(config: TestRunnerConfig = {}) {
    this.config = {
      parallel: true,
      maxWorkers: 4,
      timeout: 300000, // 5 minutes total
      coverage: true,
      watch: false,
      verbose: false,
      failFast: false,
      outputFormat: 'text',
      ...config
    };
  }

  /**
   * Run all or specified test suites
   */
  async runTests(suitesToRun?: string[]): Promise<Map<string, TestResult>> {
    this.startTime = Date.now();
    console.log('🧪 Starting Component Interaction Tests...\n');

    const suitesToExecute = suitesToRun
      ? TEST_SUITES.filter(suite => suitesToRun.includes(suite.name))
      : TEST_SUITES;

    if (this.config.verbose) {
      console.log(`Running ${suitesToExecute.length} test suites:`);
      suitesToExecute.forEach(suite => {
        console.log(`  - ${suite.name} (${suite.category})`);
      });
      console.log('');
    }

    try {
      if (this.config.parallel) {
        await this.runTestsInParallel(suitesToExecute);
      } else {
        await this.runTestsSequentially(suitesToExecute);
      }

      await this.generateReport();
      return this.results;
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    }
  }

  /**
   * Run tests in parallel
   */
  private async runTestsInParallel(suites: TestSuite[]): Promise<void> {
    const chunks = this.chunkArray(suites, this.config.maxWorkers || 4);

    for (const chunk of chunks) {
      const promises = chunk.map(suite => this.runSingleTest(suite));
      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        this.results.set(chunk[index].name, result);
      });

      if (this.config.failFast && results.some(result => result.failed > 0)) {
        throw new Error('Test failed and failFast is enabled');
      }
    }
  }

  /**
   * Run tests sequentially
   */
  private async runTestsSequentially(suites: TestSuite[]): Promise<void> {
    for (const suite of suites) {
      const result = await this.runSingleTest(suite);
      this.results.set(suite.name, result);

      if (this.config.failFast && result.failed > 0) {
        throw new Error('Test failed and failFast is enabled');
      }
    }
  }

  /**
   * Run a single test suite
   */
  private async runSingleTest(suite: TestSuite): Promise<TestResult> {
    const startTime = Date.now();

    try {
      console.log(`🔄 Running: ${suite.name}`);

      const testPath = path.join(__dirname, suite.testFile);
      const jestCommand = this.buildJestCommand(testPath, suite);

      if (this.config.verbose) {
        console.log(`   Command: ${jestCommand}`);
      }

      const { stdout, stderr } = await execAsync(jestCommand, {
        timeout: suite.timeout || this.config.timeout,
        cwd: process.cwd()
      });

      const result = this.parseJestOutput(stdout, stderr, suite.name);
      result.duration = Date.now() - startTime;

      if (result.failed === 0) {
        console.log(`✅ ${suite.name} (${result.duration}ms)`);
      } else {
        console.log(`❌ ${suite.name} (${result.failed} failed, ${result.duration}ms)`);
      }

      return result;

    } catch (error: any) {
      const result: TestResult = {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        errors: [error.message]
      };

      console.log(`💥 ${suite.name} crashed (${result.duration}ms)`);
      if (this.config.verbose) {
        console.log(`   Error: ${error.message}`);
      }

      return result;
    }
  }

  /**
   * Build Jest command for a test suite
   */
  private buildJestCommand(testPath: string, suite: TestSuite): string {
    const parts = ['npx jest'];

    // Test file
    parts.push(`"${testPath}"`);

    // Coverage
    if (this.config.coverage) {
      parts.push('--coverage');
      parts.push('--coverageReporters=json-summary');
    }

    // Output format
    parts.push('--json');

    // Timeout
    if (suite.timeout) {
      parts.push(`--testTimeout=${suite.timeout}`);
    }

    // Verbose
    if (this.config.verbose) {
      parts.push('--verbose');
    }

    // Silent mode for cleaner output
    if (!this.config.verbose) {
      parts.push('--silent');
    }

    return parts.join(' ');
  }

  /**
   * Parse Jest output to extract test results
   */
  private parseJestOutput(stdout: string, stderr: string, suiteName: string): TestResult {
    try {
      const jsonOutput = JSON.parse(stdout);
      const testResults = jsonOutput.testResults[0];

      const result: TestResult = {
        suite: suiteName,
        passed: testResults.numPassingTests || 0,
        failed: testResults.numFailingTests || 0,
        skipped: testResults.numPendingTests || 0,
        duration: testResults.perfStats?.end - testResults.perfStats?.start || 0
      };

      // Extract coverage if available
      if (jsonOutput.coverageMap) {
        const coverage = this.extractCoverage(jsonOutput.coverageMap);
        if (coverage) {
          result.coverage = coverage;
        }
      }

      // Extract errors
      if (testResults.failureMessage) {
        result.errors = [testResults.failureMessage];
      }

      return result;

    } catch (error) {
      return {
        suite: suiteName,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: 0,
        errors: [`Failed to parse test output: ${error.message}`]
      };
    }
  }

  /**
   * Extract coverage information
   */
  private extractCoverage(coverageMap: any): { statements: number; branches: number; functions: number; lines: number } | null {
    try {
      const files = Object.keys(coverageMap);
      if (files.length === 0) return null;

      let totalStatements = 0;
      let coveredStatements = 0;
      let totalBranches = 0;
      let coveredBranches = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;
      let totalLines = 0;
      let coveredLines = 0;

      files.forEach(file => {
        const fileCoverage = coverageMap[file];

        totalStatements += Object.keys(fileCoverage.s).length;
        coveredStatements += Object.values(fileCoverage.s).filter((hits: any) => hits > 0).length;

        totalBranches += Object.keys(fileCoverage.b).length;
        coveredBranches += Object.values(fileCoverage.b).filter((branch: any) => branch.some((hits: number) => hits > 0)).length;

        totalFunctions += Object.keys(fileCoverage.f).length;
        coveredFunctions += Object.values(fileCoverage.f).filter((hits: any) => hits > 0).length;

        totalLines += Object.keys(fileCoverage.l).length;
        coveredLines += Object.values(fileCoverage.l).filter((hits: any) => hits > 0).length;
      });

      return {
        statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
        branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
        lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
      };

    } catch (error) {
      console.warn('Failed to extract coverage:', error);
      return null;
    }
  }

  /**
   * Generate test report
   */
  private async generateReport(): Promise<void> {
    const totalDuration = Date.now() - this.startTime;
    const summary = this.calculateSummary();

    console.log('\n📊 Component Interaction Test Results');
    console.log('=====================================');
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Suites: ${summary.totalSuites}`);
    console.log(`Tests: ${summary.totalTests} (${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped)`);

    if (summary.coverage) {
      console.log('\n📈 Coverage Summary:');
      console.log(`  Statements: ${summary.coverage.statements.toFixed(1)}%`);
      console.log(`  Branches: ${summary.coverage.branches.toFixed(1)}%`);
      console.log(`  Functions: ${summary.coverage.functions.toFixed(1)}%`);
      console.log(`  Lines: ${summary.coverage.lines.toFixed(1)}%`);
    }

    console.log('\n📋 Suite Details:');
    this.results.forEach((result, suiteName) => {
      const status = result.failed > 0 ? '❌' : '✅';
      console.log(`  ${status} ${suiteName}: ${result.passed} passed, ${result.failed} failed (${result.duration}ms)`);

      if (result.errors && result.errors.length > 0 && this.config.verbose) {
        result.errors.forEach(error => {
          console.log(`     Error: ${error}`);
        });
      }
    });

    // Generate file output if specified
    if (this.config.outputFile) {
      await this.writeReportToFile(summary, totalDuration);
    }

    console.log('\n' + (summary.failed > 0 ? '❌ Some tests failed' : '✅ All tests passed'));
  }

  /**
   * Calculate test summary
   */
  private calculateSummary() {
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const coverageData: { statements: number[]; branches: number[]; functions: number[]; lines: number[] } = {
      statements: [],
      branches: [],
      functions: [],
      lines: []
    };

    this.results.forEach(result => {
      totalTests += result.passed + result.failed + result.skipped;
      passed += result.passed;
      failed += result.failed;
      skipped += result.skipped;

      if (result.coverage) {
        coverageData.statements.push(result.coverage.statements);
        coverageData.branches.push(result.coverage.branches);
        coverageData.functions.push(result.coverage.functions);
        coverageData.lines.push(result.coverage.lines);
      }
    });

    const coverage = coverageData.statements.length > 0 ? {
      statements: coverageData.statements.reduce((a, b) => a + b, 0) / coverageData.statements.length,
      branches: coverageData.branches.reduce((a, b) => a + b, 0) / coverageData.branches.length,
      functions: coverageData.functions.reduce((a, b) => a + b, 0) / coverageData.functions.length,
      lines: coverageData.lines.reduce((a, b) => a + b, 0) / coverageData.lines.length
    } : null;

    return {
      totalSuites: this.results.size,
      totalTests,
      passed,
      failed,
      skipped,
      coverage
    };
  }

  /**
   * Write report to file
   */
  private async writeReportToFile(summary: any, totalDuration: number): Promise<void> {
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      summary,
      results: Array.from(this.results.entries()).map(([name, result]) => ({
        name,
        ...result
      }))
    };

    try {
      if (this.config.outputFormat === 'json') {
        await fs.promises.writeFile(
          this.config.outputFile!,
          JSON.stringify(reportData, null, 2)
        );
      } else if (this.config.outputFormat === 'html') {
        const htmlReport = this.generateHtmlReport(reportData);
        await fs.promises.writeFile(this.config.outputFile!, htmlReport);
      } else {
        const textReport = this.generateTextReport(reportData);
        await fs.promises.writeFile(this.config.outputFile!, textReport);
      }

      console.log(`📁 Report saved to: ${this.config.outputFile}`);
    } catch (error) {
      console.warn(`Failed to write report file: ${error.message}`);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(data: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Component Interaction Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .suite { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .passed { border-left: 5px solid #4CAF50; }
        .failed { border-left: 5px solid #f44336; }
        .coverage { display: flex; gap: 20px; margin-top: 10px; }
        .metric { text-align: center; }
    </style>
</head>
<body>
    <h1>Component Interaction Test Report</h1>

    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Generated:</strong> ${data.timestamp}</p>
        <p><strong>Duration:</strong> ${data.duration}ms</p>
        <p><strong>Suites:</strong> ${data.summary.totalSuites}</p>
        <p><strong>Tests:</strong> ${data.summary.totalTests} (${data.summary.passed} passed, ${data.summary.failed} failed)</p>

        ${data.summary.coverage ? `
        <div class="coverage">
            <div class="metric">
                <div>Statements</div>
                <div><strong>${data.summary.coverage.statements.toFixed(1)}%</strong></div>
            </div>
            <div class="metric">
                <div>Branches</div>
                <div><strong>${data.summary.coverage.branches.toFixed(1)}%</strong></div>
            </div>
            <div class="metric">
                <div>Functions</div>
                <div><strong>${data.summary.coverage.functions.toFixed(1)}%</strong></div>
            </div>
            <div class="metric">
                <div>Lines</div>
                <div><strong>${data.summary.coverage.lines.toFixed(1)}%</strong></div>
            </div>
        </div>
        ` : ''}
    </div>

    <h2>Test Suites</h2>
    ${data.results.map((result: any) => `
        <div class="suite ${result.failed > 0 ? 'failed' : 'passed'}">
            <h3>${result.name}</h3>
            <p>Passed: ${result.passed} | Failed: ${result.failed} | Skipped: ${result.skipped}</p>
            <p>Duration: ${result.duration}ms</p>
            ${result.errors ? `<p><strong>Errors:</strong> ${result.errors.join(', ')}</p>` : ''}
        </div>
    `).join('')}
</body>
</html>
    `;
  }

  /**
   * Generate text report
   */
  private generateTextReport(data: any): string {
    let report = 'Component Interaction Test Report\n';
    report += '=================================\n\n';
    report += `Generated: ${data.timestamp}\n`;
    report += `Duration: ${data.duration}ms\n`;
    report += `Suites: ${data.summary.totalSuites}\n`;
    report += `Tests: ${data.summary.totalTests} (${data.summary.passed} passed, ${data.summary.failed} failed)\n\n`;

    if (data.summary.coverage) {
      report += 'Coverage:\n';
      report += `  Statements: ${data.summary.coverage.statements.toFixed(1)}%\n`;
      report += `  Branches: ${data.summary.coverage.branches.toFixed(1)}%\n`;
      report += `  Functions: ${data.summary.coverage.functions.toFixed(1)}%\n`;
      report += `  Lines: ${data.summary.coverage.lines.toFixed(1)}%\n\n`;
    }

    report += 'Suite Details:\n';
    data.results.forEach((result: any) => {
      report += `\n${result.name}:\n`;
      report += `  Passed: ${result.passed}\n`;
      report += `  Failed: ${result.failed}\n`;
      report += `  Skipped: ${result.skipped}\n`;
      report += `  Duration: ${result.duration}ms\n`;
      if (result.errors) {
        report += `  Errors: ${result.errors.join(', ')}\n`;
      }
    });

    return report;
  }

  /**
   * Utility function to chunk array
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// CLI interface
export async function runComponentInteractionTests(
  suites?: string[],
  config: TestRunnerConfig = {}
): Promise<void> {
  const runner = new ComponentInteractionTestRunner(config);

  try {
    const results = await runner.runTests(suites);
    const hasFailures = Array.from(results.values()).some(result => result.failed > 0);

    if (hasFailures) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Export test suites for external use
export { TEST_SUITES };
export default ComponentInteractionTestRunner;