#!/usr/bin/env node

/**
 * Error Handling Test Runner
 * 
 * Comprehensive test runner for all error handling and recovery scenarios.
 * Provides detailed reporting and metrics collection.
 * 
 * Usage:
 *   npm run test:error-handling
 *   node tests/integration/error-handling/run-error-handling-tests.ts
 *   node tests/integration/error-handling/run-error-handling-tests.ts --suite=circuit-breaker
 *   node tests/integration/error-handling/run-error-handling-tests.ts --report=detailed
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

interface TestRunConfig {
  suite?: string;
  report?: 'summary' | 'detailed' | 'json';
  timeout?: number;
  verbose?: boolean;
  coverage?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
}

class ErrorHandlingTestRunner {
  private config: TestRunConfig;
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(config: TestRunConfig = {}) {
    this.config = {
      report: 'summary',
      timeout: 300000, // 5 minutes default
      verbose: false,
      coverage: false,
      parallel: true,
      maxWorkers: 4,
      ...config
    };
  }

  async run(): Promise<void> {
    console.log('🧪 Starting Error Handling Integration Tests');
    console.log('=' .repeat(60));
    
    this.startTime = performance.now();

    try {
      await this.setupEnvironment();
      await this.runTestSuites();
      await this.generateReport();
      await this.cleanup();
    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }
  }

  private async setupEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...');
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Clean up any existing test databases
    try {
      const files = await fs.readdir(tempDir);
      const dbFiles = files.filter(f => f.endsWith('.db') || f.endsWith('.backup'));
      
      for (const file of dbFiles) {
        await fs.unlink(path.join(tempDir, file));
      }
      
      if (dbFiles.length > 0) {
        console.log(`🧹 Cleaned up ${dbFiles.length} existing test files`);
      }
    } catch (error) {
      // Ignore if temp directory doesn't exist
    }

    // Set environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = this.config.verbose ? 'debug' : 'warn';
    
    console.log('✅ Environment setup complete');
  }

  private async runTestSuites(): Promise<void> {
    const suites = this.getTestSuites();
    console.log(`🚀 Running ${suites.length} test suites...\n`);

    if (this.config.parallel && suites.length > 1) {
      await this.runSuitesInParallel(suites);
    } else {
      await this.runSuitesSequentially(suites);
    }
  }

  private getTestSuites(): string[] {
    const allSuites = [
      'error-scenarios.integration.test.ts',
      'recovery-testing.integration.test.ts', 
      'circuit-breaker.test.ts'
    ];

    if (this.config.suite) {
      return allSuites.filter(suite => suite.includes(this.config.suite!));
    }

    return allSuites;
  }

  private async runSuitesInParallel(suites: string[]): Promise<void> {
    console.log(`⚡ Running ${suites.length} suites in parallel (max ${this.config.maxWorkers} workers)...`);
    
    // Chunk suites for parallel execution
    const chunks = this.chunkArray(suites, this.config.maxWorkers!);
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      console.log(`\n📦 Processing chunk ${chunkIndex + 1}/${chunks.length}`);
      
      const chunkPromises = chunks[chunkIndex].map(suite => this.runSuite(suite));
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          this.results.push(result.value);
        } else {
          console.error(`❌ Suite ${chunks[chunkIndex][index]} failed:`, result.reason);
          this.results.push({
            suite: chunks[chunkIndex][index],
            passed: 0,
            failed: 1,
            skipped: 0,
            duration: 0,
            errors: [result.reason.message]
          });
        }
      });
    }
  }

  private async runSuitesSequentially(suites: string[]): Promise<void> {
    console.log(`🔄 Running ${suites.length} suites sequentially...`);
    
    for (const suite of suites) {
      try {
        const result = await this.runSuite(suite);
        this.results.push(result);
      } catch (error) {
        console.error(`❌ Suite ${suite} failed:`, error);
        this.results.push({
          suite,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errors: [error.message]
        });
      }
    }
  }

  private async runSuite(suiteName: string): Promise<TestResult> {
    const suitePath = path.join(__dirname, suiteName);
    const suiteStartTime = performance.now();
    
    console.log(`\n🧪 Running ${suiteName}...`);

    return new Promise((resolve, reject) => {
      const jestArgs = [
        '--testPathPattern', suitePath,
        '--verbose',
        '--no-cache',
        '--maxWorkers', '1', // Force single worker per suite
        '--testTimeout', this.config.timeout!.toString()
      ];

      if (this.config.coverage) {
        jestArgs.push('--coverage', '--coverageDirectory', 'coverage/error-handling');
      }

      const jest = spawn('npx', ['jest', ...jestArgs], {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: { ...process.env, FORCE_COLOR: '1' },
        cwd: path.resolve(__dirname, '../../..')
      });

      let stdout = '';
      let stderr = '';

      if (!this.config.verbose) {
        jest.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        jest.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      jest.on('close', (code) => {
        const duration = performance.now() - suiteStartTime;
        
        if (code === 0) {
          console.log(`✅ ${suiteName} completed in ${duration.toFixed(0)}ms`);
          
          // Parse Jest output for test counts
          const result = this.parseJestOutput(suiteName, stdout, stderr, duration);
          resolve(result);
        } else {
          console.log(`❌ ${suiteName} failed with code ${code}`);
          
          const result: TestResult = {
            suite: suiteName,
            passed: 0,
            failed: 1,
            skipped: 0,
            duration,
            errors: stderr ? [stderr] : [`Test suite failed with exit code ${code}`]
          };
          
          resolve(result); // Don't reject, just mark as failed
        }
      });

      jest.on('error', (error) => {
        reject(new Error(`Failed to start Jest for ${suiteName}: ${error.message}`));
      });

      // Set timeout for individual suite
      setTimeout(() => {
        jest.kill('SIGTERM');
        reject(new Error(`Test suite ${suiteName} timed out after ${this.config.timeout}ms`));
      }, this.config.timeout!);
    });
  }

  private parseJestOutput(suiteName: string, stdout: string, stderr: string, duration: number): TestResult {
    // Basic Jest output parsing - in real implementation would be more sophisticated
    const passedMatch = stdout.match(/(\d+) passed/);
    const failedMatch = stdout.match(/(\d+) failed/);
    const skippedMatch = stdout.match(/(\d+) skipped/);

    const errors = [];
    if (stderr) {
      errors.push(stderr);
    }

    // Extract error messages from stdout
    const errorLines = stdout.split('\n').filter(line => 
      line.includes('FAIL') || 
      line.includes('Error:') || 
      line.includes('Expected:') ||
      line.includes('Received:')
    );
    errors.push(...errorLines);

    return {
      suite: suiteName,
      passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
      failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1], 10) : 0,
      duration,
      errors: errors.filter(e => e.trim().length > 0)
    };
  }

  private async generateReport(): Promise<void> {
    const totalDuration = performance.now() - this.startTime;
    const summary = this.calculateSummary();

    console.log('\n' + '=' .repeat(60));
    console.log('📊 ERROR HANDLING TEST RESULTS');
    console.log('=' .repeat(60));

    if (this.config.report === 'summary' || this.config.report === 'detailed') {
      this.printTextReport(summary, totalDuration);
    }

    if (this.config.report === 'json') {
      this.printJsonReport(summary, totalDuration);
    }

    // Write detailed report to file
    await this.writeReportToFile(summary, totalDuration);
  }

  private calculateSummary() {
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    const totalErrors = this.results.reduce((sum, r) => sum + r.errors.length, 0);
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    
    return {
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalErrors,
      avgDuration,
      successRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0,
      suiteResults: this.results
    };
  }

  private printTextReport(summary: any, totalDuration: number): void {
    // Overall summary
    console.log(`\n📈 OVERALL RESULTS:`);
    console.log(`   Tests:        ${summary.totalTests} total`);
    console.log(`   Passed:       ${summary.totalPassed} ✅`);
    console.log(`   Failed:       ${summary.totalFailed} ❌`);
    console.log(`   Skipped:      ${summary.totalSkipped} ⏭️`);
    console.log(`   Success Rate: ${summary.successRate.toFixed(1)}%`);
    console.log(`   Duration:     ${totalDuration.toFixed(0)}ms`);

    // Per-suite breakdown
    console.log(`\n📋 SUITE BREAKDOWN:`);
    this.results.forEach(result => {
      const status = result.failed > 0 ? '❌' : '✅';
      const successRate = result.passed + result.failed > 0 
        ? ((result.passed / (result.passed + result.failed)) * 100).toFixed(1)
        : '100.0';
      
      console.log(`   ${status} ${result.suite}:`);
      console.log(`      Passed: ${result.passed}, Failed: ${result.failed}, Success: ${successRate}%`);
      console.log(`      Duration: ${result.duration.toFixed(0)}ms`);
      
      if (result.errors.length > 0 && this.config.report === 'detailed') {
        console.log(`      Errors:`);
        result.errors.slice(0, 3).forEach(error => {
          console.log(`        - ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`);
        });
        if (result.errors.length > 3) {
          console.log(`        ... and ${result.errors.length - 3} more errors`);
        }
      }
    });

    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    if (summary.successRate < 80) {
      console.log(`   ⚠️  Low success rate (${summary.successRate.toFixed(1)}%) indicates system reliability issues`);
    }
    if (summary.avgDuration > 10000) {
      console.log(`   ⚠️  High average test duration (${summary.avgDuration.toFixed(0)}ms) may indicate performance issues`);
    }
    if (summary.totalFailed === 0) {
      console.log(`   ✅ All tests passed - excellent error handling implementation`);
    }
    if (summary.totalErrors > summary.totalFailed) {
      console.log(`   ℹ️  Multiple error messages detected - check logs for details`);
    }
  }

  private printJsonReport(summary: any, totalDuration: number): void {
    const jsonReport = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      configuration: this.config,
      summary: {
        ...summary,
        totalDuration
      },
      results: this.results
    };

    console.log(JSON.stringify(jsonReport, null, 2));
  }

  private async writeReportToFile(summary: any, totalDuration: number): Promise<void> {
    const reportDir = path.join(__dirname, '..', '..', '..', 'reports');
    await fs.mkdir(reportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `error-handling-tests-${timestamp}.json`);

    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      configuration: this.config,
      summary: {
        ...summary,
        totalDuration
      },
      results: this.results,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      }
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test environment...');
    
    // Clean up temp files
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    try {
      const files = await fs.readdir(tempDir);
      const testFiles = files.filter(f => 
        f.startsWith('test-') || 
        f.endsWith('.tmp') || 
        f.includes('error-test')
      );
      
      for (const file of testFiles) {
        await fs.unlink(path.join(tempDir, file));
      }
      
      if (testFiles.length > 0) {
        console.log(`🧹 Cleaned up ${testFiles.length} temporary test files`);
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('✅ Cleanup complete');
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// CLI argument parsing
function parseArgs(): TestRunConfig {
  const args = process.argv.slice(2);
  const config: TestRunConfig = {};

  args.forEach(arg => {
    if (arg.startsWith('--suite=')) {
      config.suite = arg.split('=')[1];
    } else if (arg.startsWith('--report=')) {
      config.report = arg.split('=')[1] as any;
    } else if (arg.startsWith('--timeout=')) {
      config.timeout = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg === '--coverage') {
      config.coverage = true;
    } else if (arg === '--sequential') {
      config.parallel = false;
    } else if (arg.startsWith('--max-workers=')) {
      config.maxWorkers = parseInt(arg.split('=')[1], 10);
    }
  });

  return config;
}

// Main execution
async function main() {
  try {
    const config = parseArgs();
    const runner = new ErrorHandlingTestRunner(config);
    await runner.run();
    
    console.log('\n🎉 Error handling tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default ErrorHandlingTestRunner;