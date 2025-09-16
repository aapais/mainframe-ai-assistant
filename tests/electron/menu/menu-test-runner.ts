/**
 * Comprehensive Menu Test Runner
 *
 * Runs all menu-related tests with proper setup, teardown, and reporting.
 * Includes performance monitoring and cross-platform validation.
 */

import { execSync } from 'child_process';
import { join } from 'path';

interface TestSuiteResult {
  name: string;
  passed: boolean;
  duration: number;
  tests: {
    passed: number;
    failed: number;
    skipped: number;
  };
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  errors?: string[];
}

interface TestRunConfig {
  suites: string[];
  platform?: string;
  coverage?: boolean;
  verbose?: boolean;
  bail?: boolean;
  timeout?: number;
  parallel?: boolean;
}

export class MenuTestRunner {
  private config: TestRunConfig;
  private results: TestSuiteResult[] = [];

  constructor(config: TestRunConfig) {
    this.config = {
      timeout: 30000,
      verbose: false,
      coverage: true,
      parallel: true,
      ...config
    };
  }

  /**
   * Run all menu test suites
   */
  async runAll(): Promise<{ success: boolean; results: TestSuiteResult[] }> {
    console.log('🧪 Starting Menu Test Suite Runner');
    console.log(`Platform: ${process.platform}`);
    console.log(`Suites: ${this.config.suites.join(', ')}`);
    console.log('');

    const startTime = Date.now();

    try {
      // Setup test environment
      await this.setupTestEnvironment();

      // Run test suites
      if (this.config.parallel) {
        await this.runSuitesInParallel();
      } else {
        await this.runSuitesSequentially();
      }

      // Generate report
      const totalDuration = Date.now() - startTime;
      const success = this.results.every(result => result.passed);

      console.log('');
      console.log('📊 Test Results Summary');
      console.log('='.repeat(50));
      this.printSummary(totalDuration);

      if (this.config.coverage) {
        this.printCoverageReport();
      }

      return { success, results: this.results };

    } catch (error) {
      console.error('❌ Test runner failed:', error);
      return { success: false, results: this.results };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Setup test environment
   */
  private async setupTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...');

    // Set environment variables
    process.env.NODE_ENV = 'test';
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

    // Clear any existing test artifacts
    try {
      execSync('rm -rf coverage/menu-tests', { stdio: 'pipe' });
      execSync('mkdir -p coverage/menu-tests', { stdio: 'pipe' });
    } catch (error) {
      // Ignore if directories don't exist
    }

    console.log('✅ Test environment ready');
  }

  /**
   * Run test suites in parallel
   */
  private async runSuitesInParallel(): Promise<void> {
    console.log('🚀 Running test suites in parallel...');

    const promises = this.config.suites.map(suite => this.runSuite(suite));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.results.push({
          name: this.config.suites[index],
          passed: false,
          duration: 0,
          tests: { passed: 0, failed: 1, skipped: 0 },
          errors: [result.reason?.message || 'Unknown error']
        });
      }
    });
  }

  /**
   * Run test suites sequentially
   */
  private async runSuitesSequentially(): Promise<void> {
    console.log('🔄 Running test suites sequentially...');

    for (const suite of this.config.suites) {
      try {
        await this.runSuite(suite);

        if (this.config.bail && !this.results[this.results.length - 1]?.passed) {
          console.log('🛑 Stopping due to test failure (bail mode)');
          break;
        }
      } catch (error) {
        console.error(`❌ Suite ${suite} failed:`, error);

        if (this.config.bail) {
          break;
        }
      }
    }
  }

  /**
   * Run individual test suite
   */
  private async runSuite(suiteName: string): Promise<TestSuiteResult> {
    const startTime = Date.now();
    console.log(`📋 Running ${suiteName}...`);

    try {
      const testFile = this.getTestFilePath(suiteName);
      const jestConfig = this.buildJestConfig(suiteName);

      // Run Jest with custom config
      const command = [
        'npx jest',
        `"${testFile}"`,
        '--config', `"${jestConfig}"`,
        this.config.verbose ? '--verbose' : '',
        this.config.coverage ? '--coverage' : '',
        `--testTimeout=${this.config.timeout}`,
        '--forceExit',
        '--detectOpenHandles'
      ].filter(Boolean).join(' ');

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const result = this.parseJestOutput(suiteName, output, Date.now() - startTime);
      this.results.push(result);

      if (result.passed) {
        console.log(`✅ ${suiteName} passed (${result.duration}ms)`);
      } else {
        console.log(`❌ ${suiteName} failed (${result.duration}ms)`);
      }

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: TestSuiteResult = {
        name: suiteName,
        passed: false,
        duration,
        tests: { passed: 0, failed: 1, skipped: 0 },
        errors: [error.message]
      };

      this.results.push(result);
      console.log(`❌ ${suiteName} failed (${duration}ms)`);

      if (this.config.verbose) {
        console.log(`Error: ${error.message}`);
      }

      return result;
    }
  }

  /**
   * Get test file path for suite
   */
  private getTestFilePath(suiteName: string): string {
    const testFiles: { [key: string]: string } = {
      'menu-interactions': 'tests/electron/menu/menu-interactions.test.ts',
      'context-menu': 'tests/electron/menu/context-menu.test.ts',
      'tray-menu': 'tests/electron/menu/tray-menu.test.ts',
      'keyboard-shortcuts': 'tests/electron/menu/keyboard-shortcuts.test.ts',
      'dynamic-menu-updates': 'tests/electron/menu/dynamic-menu-updates.test.ts',
      'platform-specific': 'tests/electron/menu/platform-specific.test.ts'
    };

    return testFiles[suiteName] || `tests/electron/menu/${suiteName}.test.ts`;
  }

  /**
   * Build Jest configuration for suite
   */
  private buildJestConfig(suiteName: string): string {
    const config = {
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/electron/menu/setup.ts'],
      moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1'
      },
      collectCoverageFrom: [
        'src/main/menu.ts',
        'src/main/**/*.ts'
      ],
      coverageDirectory: `coverage/menu-tests/${suiteName}`,
      coverageReporters: ['json', 'text', 'html'],
      testTimeout: this.config.timeout,
      verbose: this.config.verbose,
      bail: this.config.bail
    };

    const configPath = join(process.cwd(), `jest.config.menu-${suiteName}.js`);
    const fs = require('fs');
    fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)}`);

    return configPath;
  }

  /**
   * Parse Jest output
   */
  private parseJestOutput(suiteName: string, output: string, duration: number): TestSuiteResult {
    try {
      // Extract test results from Jest output
      const passedMatch = output.match(/(\d+) passed/);
      const failedMatch = output.match(/(\d+) failed/);
      const skippedMatch = output.match(/(\d+) skipped/);

      const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;

      // Extract coverage if available
      let coverage;
      const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
      if (coverageMatch) {
        coverage = {
          statements: parseFloat(coverageMatch[1]),
          branches: parseFloat(coverageMatch[2]),
          functions: parseFloat(coverageMatch[3]),
          lines: parseFloat(coverageMatch[4])
        };
      }

      return {
        name: suiteName,
        passed: failed === 0,
        duration,
        tests: { passed, failed, skipped },
        coverage
      };

    } catch (error) {
      return {
        name: suiteName,
        passed: false,
        duration,
        tests: { passed: 0, failed: 1, skipped: 0 },
        errors: ['Failed to parse test output']
      };
    }
  }

  /**
   * Print summary report
   */
  private printSummary(totalDuration: number): void {
    const totalTests = this.results.reduce((sum, result) =>
      sum + result.tests.passed + result.tests.failed + result.tests.skipped, 0);

    const totalPassed = this.results.reduce((sum, result) => sum + result.tests.passed, 0);
    const totalFailed = this.results.reduce((sum, result) => sum + result.tests.failed, 0);
    const totalSkipped = this.results.reduce((sum, result) => sum + result.tests.skipped, 0);

    const passedSuites = this.results.filter(r => r.passed).length;
    const failedSuites = this.results.filter(r => !r.passed).length;

    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Test Suites: ${passedSuites} passed, ${failedSuites} failed, ${this.results.length} total`);
    console.log(`Tests: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped, ${totalTests} total`);
    console.log('');

    // Print individual suite results
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const testsInfo = `${result.tests.passed}/${result.tests.passed + result.tests.failed}`;
      console.log(`${status} ${result.name.padEnd(25)} ${testsInfo.padEnd(8)} ${result.duration}ms`);
    });

    // Print failed suites details
    const failedResults = this.results.filter(r => !r.passed);
    if (failedResults.length > 0) {
      console.log('');
      console.log('❌ Failed Suites:');
      failedResults.forEach(result => {
        console.log(`  • ${result.name}`);
        if (result.errors) {
          result.errors.forEach(error => {
            console.log(`    - ${error}`);
          });
        }
      });
    }
  }

  /**
   * Print coverage report
   */
  private printCoverageReport(): void {
    const coverageResults = this.results.filter(r => r.coverage);

    if (coverageResults.length === 0) {
      console.log('📊 No coverage data available');
      return;
    }

    console.log('');
    console.log('📊 Coverage Report');
    console.log('-'.repeat(50));
    console.log('Suite'.padEnd(25) + 'Stmt'.padEnd(8) + 'Branch'.padEnd(8) + 'Func'.padEnd(8) + 'Lines');
    console.log('-'.repeat(50));

    coverageResults.forEach(result => {
      if (result.coverage) {
        const stmt = `${result.coverage.statements.toFixed(1)}%`;
        const branch = `${result.coverage.branches.toFixed(1)}%`;
        const func = `${result.coverage.functions.toFixed(1)}%`;
        const lines = `${result.coverage.lines.toFixed(1)}%`;

        console.log(
          result.name.padEnd(25) +
          stmt.padEnd(8) +
          branch.padEnd(8) +
          func.padEnd(8) +
          lines
        );
      }
    });

    // Calculate overall coverage
    const avgCoverage = {
      statements: coverageResults.reduce((sum, r) => sum + (r.coverage?.statements || 0), 0) / coverageResults.length,
      branches: coverageResults.reduce((sum, r) => sum + (r.coverage?.branches || 0), 0) / coverageResults.length,
      functions: coverageResults.reduce((sum, r) => sum + (r.coverage?.functions || 0), 0) / coverageResults.length,
      lines: coverageResults.reduce((sum, r) => sum + (r.coverage?.lines || 0), 0) / coverageResults.length
    };

    console.log('-'.repeat(50));
    console.log(
      'Average'.padEnd(25) +
      `${avgCoverage.statements.toFixed(1)}%`.padEnd(8) +
      `${avgCoverage.branches.toFixed(1)}%`.padEnd(8) +
      `${avgCoverage.functions.toFixed(1)}%`.padEnd(8) +
      `${avgCoverage.lines.toFixed(1)}%`
    );
  }

  /**
   * Cleanup test artifacts
   */
  private async cleanup(): Promise<void> {
    try {
      // Clean up temporary Jest config files
      const fs = require('fs');
      const glob = require('glob');

      const configFiles = glob.sync('jest.config.menu-*.js');
      configFiles.forEach((file: string) => {
        try {
          fs.unlinkSync(file);
        } catch (error) {
          // Ignore cleanup errors
        }
      });

    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * CLI interface for running menu tests
 */
export async function runMenuTests(args: string[] = []): Promise<void> {
  const config: TestRunConfig = {
    suites: [
      'menu-interactions',
      'context-menu',
      'tray-menu',
      'keyboard-shortcuts',
      'dynamic-menu-updates',
      'platform-specific'
    ],
    coverage: !args.includes('--no-coverage'),
    verbose: args.includes('--verbose'),
    bail: args.includes('--bail'),
    parallel: !args.includes('--sequential'),
    timeout: args.includes('--timeout') ?
      parseInt(args[args.indexOf('--timeout') + 1]) : 30000
  };

  // Allow filtering specific suites
  const suiteArg = args.find(arg => arg.startsWith('--suite='));
  if (suiteArg) {
    const suite = suiteArg.split('=')[1];
    config.suites = [suite];
  }

  const runner = new MenuTestRunner(config);
  const { success } = await runner.runAll();

  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  runMenuTests(process.argv.slice(2));
}