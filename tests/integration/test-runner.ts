#!/usr/bin/env node

/**
 * Master Test Runner for MVP1 Knowledge Base Assistant
 * 
 * Orchestrates all test suites including:
 * - Unit tests
 * - Integration tests
 * - E2E tests
 * - Performance tests
 * - Error handling tests
 * - Reliability tests
 * - Accessibility tests
 * 
 * Provides comprehensive reporting and MVP1 requirement validation.
 * 
 * Usage:
 *   npm run test:all
 *   npm run test:mvp1
 *   node tests/integration/test-runner.ts
 *   node tests/integration/test-runner.ts --suite=unit --parallel
 *   node tests/integration/test-runner.ts --validate-mvp1 --report=comprehensive
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import os from 'os';

import { TestConfig, TestRunConfig, TestSuiteConfig } from './test-config';
import { TestReporter, TestReport, SuiteResult, TestMetrics } from './test-reporter';
import { MVP1Validator, MVP1Requirements, ValidationResult } from './mvp1-validation';

export interface TestSuiteResult {
  suite: string;
  category: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
  warnings: string[];
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  performance?: {
    avgResponseTime: number;
    p95ResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  requirements?: {
    functional: string[];
    nonFunctional: string[];
    satisfied: boolean;
  };
}

export interface MasterTestResult {
  startTime: string;
  endTime: string;
  totalDuration: number;
  configuration: TestRunConfig;
  suites: TestSuiteResult[];
  summary: {
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    successRate: number;
    avgDuration: number;
  };
  mvp1Validation?: ValidationResult;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    memory: NodeJS.MemoryUsage;
    cpus: number;
  };
  recommendations: string[];
}

export class MasterTestRunner extends EventEmitter {
  private config: TestRunConfig;
  private reporter: TestReporter;
  private validator: MVP1Validator;
  private results: TestSuiteResult[] = [];
  private startTime: number = 0;
  private testConfig: TestConfig;

  constructor(config: TestRunConfig = {}) {
    super();
    
    this.testConfig = new TestConfig();
    this.config = this.testConfig.mergeWithDefaults(config);
    this.reporter = new TestReporter(this.config);
    this.validator = new MVP1Validator();

    this.setupEventHandlers();
  }

  async run(): Promise<MasterTestResult> {
    console.log('🚀 Starting Master Test Runner for MVP1 Knowledge Base Assistant');
    console.log('=' .repeat(80));
    
    this.startTime = performance.now();
    const startDate = new Date();

    try {
      await this.preRunSetup();
      await this.runTestSuites();
      const mvp1Validation = await this.validateMVP1Requirements();
      const result = await this.generateMasterReport(startDate, mvp1Validation);
      await this.postRunCleanup();
      
      return result;
    } catch (error) {
      console.error('💥 Master test runner failed:', error);
      throw error;
    }
  }

  private async preRunSetup(): Promise<void> {
    console.log('🔧 Setting up test environment...');
    
    // Create necessary directories
    const dirs = ['temp', 'reports', 'coverage', 'logs'];
    for (const dir of dirs) {
      const dirPath = path.join(process.cwd(), dir);
      await fs.mkdir(dirPath, { recursive: true });
    }

    // Clean up old test artifacts
    await this.cleanupTestArtifacts();

    // Set environment variables
    this.setupEnvironmentVariables();

    // Validate test configuration
    await this.validateTestConfiguration();

    console.log('✅ Test environment setup complete');
  }

  private async cleanupTestArtifacts(): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp');
    const reportsDir = path.join(process.cwd(), 'reports');
    
    try {
      // Clean temp directory
      const tempFiles = await fs.readdir(tempDir);
      const testFiles = tempFiles.filter(f => 
        f.startsWith('test-') || 
        f.endsWith('.tmp') || 
        f.includes('mock') ||
        f.endsWith('.db')
      );
      
      for (const file of testFiles) {
        await fs.unlink(path.join(tempDir, file));
      }
      
      if (testFiles.length > 0) {
        console.log(`🧹 Cleaned up ${testFiles.length} temporary test files`);
      }

      // Clean old reports if configured
      if (this.config.cleanOldReports) {
        const reportFiles = await fs.readdir(reportsDir);
        const cutoffTime = Date.now() - (this.config.reportRetentionDays! * 24 * 60 * 60 * 1000);
        
        let cleanedCount = 0;
        for (const file of reportFiles) {
          const filePath = path.join(reportsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        }
        
        if (cleanedCount > 0) {
          console.log(`🧹 Cleaned up ${cleanedCount} old report files`);
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not clean all artifacts:', error.message);
    }
  }

  private setupEnvironmentVariables(): void {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = this.config.verbose ? 'debug' : 'warn';
    process.env.TEST_TIMEOUT = this.config.testTimeout?.toString() || '30000';
    
    // Performance testing optimizations
    if (this.config.suites?.includes('performance')) {
      process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=4096';
    }

    // Coverage configuration
    if (this.config.coverage) {
      process.env.COVERAGE = 'true';
      process.env.NYC_CONFIG = JSON.stringify(this.testConfig.getCoverageConfig());
    }
  }

  private async validateTestConfiguration(): Promise<void> {
    const errors: string[] = [];

    // Check required dependencies
    const requiredPackages = ['jest', 'electron', 'better-sqlite3'];
    const packageJson = JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
    );

    for (const pkg of requiredPackages) {
      if (!packageJson.dependencies?.[pkg] && !packageJson.devDependencies?.[pkg]) {
        errors.push(`Missing required package: ${pkg}`);
      }
    }

    // Check test files exist
    const requiredTestDirs = ['tests/unit', 'tests/integration', 'tests/e2e'];
    for (const dir of requiredTestDirs) {
      try {
        await fs.access(path.join(process.cwd(), dir));
      } catch {
        errors.push(`Missing test directory: ${dir}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Test configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  private async runTestSuites(): Promise<void> {
    const suites = this.getTestSuites();
    console.log(`🧪 Running ${suites.length} test suites...`);
    
    if (this.config.parallel && suites.length > 1) {
      await this.runSuitesInParallel(suites);
    } else {
      await this.runSuitesSequentially(suites);
    }

    console.log(`✅ Completed ${suites.length} test suites`);
  }

  private getTestSuites(): TestSuiteConfig[] {
    const allSuites = this.testConfig.getTestSuites();
    
    // Filter suites based on configuration
    let filteredSuites = allSuites;
    
    if (this.config.suites && this.config.suites.length > 0) {
      filteredSuites = allSuites.filter(suite => 
        this.config.suites!.some(configSuite => 
          suite.name.includes(configSuite) || suite.category === configSuite
        )
      );
    }

    if (this.config.skipSuites && this.config.skipSuites.length > 0) {
      filteredSuites = filteredSuites.filter(suite =>
        !this.config.skipSuites!.some(skipSuite =>
          suite.name.includes(skipSuite) || suite.category === skipSuite
        )
      );
    }

    return filteredSuites;
  }

  private async runSuitesInParallel(suites: TestSuiteConfig[]): Promise<void> {
    console.log(`⚡ Running suites in parallel (max ${this.config.maxWorkers} workers)...`);
    
    const chunks = this.chunkArray(suites, this.config.maxWorkers || 4);
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      console.log(`\n📦 Processing chunk ${chunkIndex + 1}/${chunks.length}`);
      
      const chunkPromises = chunks[chunkIndex].map(suite => this.runTestSuite(suite));
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          this.results.push(result.value);
        } else {
          const suite = chunks[chunkIndex][index];
          console.error(`❌ Suite ${suite.name} failed:`, result.reason);
          
          this.results.push({
            suite: suite.name,
            category: suite.category,
            passed: 0,
            failed: 1,
            skipped: 0,
            duration: 0,
            errors: [result.reason?.message || 'Unknown error'],
            warnings: []
          });
        }
      });
    }
  }

  private async runSuitesSequentially(suites: TestSuiteConfig[]): Promise<void> {
    console.log(`🔄 Running suites sequentially...`);
    
    for (const suite of suites) {
      try {
        const result = await this.runTestSuite(suite);
        this.results.push(result);
      } catch (error) {
        console.error(`❌ Suite ${suite.name} failed:`, error);
        
        this.results.push({
          suite: suite.name,
          category: suite.category,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errors: [error.message],
          warnings: []
        });
      }
    }
  }

  private async runTestSuite(suite: TestSuiteConfig): Promise<TestSuiteResult> {
    const suiteStartTime = performance.now();
    console.log(`\n🧪 Running ${suite.category}/${suite.name}...`);

    this.emit('suiteStart', suite);

    try {
      const result = await this.executeTestSuite(suite);
      const duration = performance.now() - suiteStartTime;
      
      const suiteResult: TestSuiteResult = {
        ...result,
        suite: suite.name,
        category: suite.category,
        duration
      };

      console.log(`✅ ${suite.name} completed - Passed: ${result.passed}, Failed: ${result.failed}, Duration: ${duration.toFixed(0)}ms`);
      
      this.emit('suiteComplete', suiteResult);
      return suiteResult;
    } catch (error) {
      const duration = performance.now() - suiteStartTime;
      console.log(`❌ ${suite.name} failed after ${duration.toFixed(0)}ms`);
      
      const errorResult: TestSuiteResult = {
        suite: suite.name,
        category: suite.category,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        errors: [error.message],
        warnings: []
      };

      this.emit('suiteError', { suite, error });
      return errorResult;
    }
  }

  private async executeTestSuite(suite: TestSuiteConfig): Promise<Omit<TestSuiteResult, 'suite' | 'category' | 'duration'>> {
    return new Promise((resolve, reject) => {
      const args = this.buildJestArguments(suite);
      
      console.log(`   Command: jest ${args.join(' ')}`);
      
      const jest = spawn('npx', ['jest', ...args], {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: { 
          ...process.env, 
          FORCE_COLOR: '1',
          TEST_SUITE: suite.name,
          TEST_CATEGORY: suite.category
        },
        cwd: process.cwd()
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

      const timeout = setTimeout(() => {
        jest.kill('SIGTERM');
        reject(new Error(`Test suite ${suite.name} timed out after ${this.config.testTimeout}ms`));
      }, this.config.testTimeout || 300000);

      jest.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          const result = this.parseJestOutput(stdout, stderr);
          resolve(result);
        } else {
          reject(new Error(`Test suite failed with exit code ${code}. stderr: ${stderr}`));
        }
      });

      jest.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start Jest: ${error.message}`));
      });
    });
  }

  private buildJestArguments(suite: TestSuiteConfig): string[] {
    const args: string[] = [];

    // Test pattern
    if (suite.pattern) {
      args.push('--testPathPattern', suite.pattern);
    } else {
      args.push('--testPathPattern', suite.path);
    }

    // Configuration
    args.push('--verbose');
    args.push('--no-cache');
    args.push('--maxWorkers', '1'); // One worker per suite
    args.push('--testTimeout', (this.config.testTimeout || 30000).toString());
    args.push('--forceExit');
    args.push('--detectOpenHandles');

    // Coverage
    if (this.config.coverage) {
      args.push('--coverage');
      args.push('--coverageDirectory', `coverage/${suite.category}`);
      args.push('--coverageReporters', 'json', 'text-summary');
    }

    // JSON output for parsing
    args.push('--json');
    args.push('--outputFile', path.join(process.cwd(), 'temp', `${suite.name}-results.json`));

    // Suite-specific arguments
    if (suite.args) {
      args.push(...suite.args);
    }

    return args;
  }

  private parseJestOutput(stdout: string, stderr: string): Omit<TestSuiteResult, 'suite' | 'category' | 'duration'> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Extract errors from stderr
    if (stderr) {
      const errorLines = stderr.split('\n').filter(line => 
        line.trim().length > 0 &&
        !line.includes('[2K') && // Remove terminal control codes
        !line.includes('[999D') &&
        !line.includes('--watch')
      );
      errors.push(...errorLines);
    }

    // Parse Jest JSON output if available
    let jestResults;
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*"success":\s*(true|false)[\s\S]*\}/);
      if (jsonMatch) {
        jestResults = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fallback to regex parsing
    }

    if (jestResults) {
      return {
        passed: jestResults.numPassedTests || 0,
        failed: jestResults.numFailedTests || 0,
        skipped: jestResults.numPendingTests || 0,
        errors,
        warnings,
        coverage: jestResults.coverageMap ? this.extractCoverageInfo(jestResults.coverageMap) : undefined
      };
    }

    // Fallback regex parsing
    const passedMatch = stdout.match(/(\d+) passed/);
    const failedMatch = stdout.match(/(\d+) failed/);
    const skippedMatch = stdout.match(/(\d+) skipped/);

    return {
      passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
      failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1], 10) : 0,
      errors,
      warnings
    };
  }

  private extractCoverageInfo(coverageMap: any): { statements: number; branches: number; functions: number; lines: number } {
    // Simplified coverage extraction - would need more sophisticated parsing in real implementation
    return {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    };
  }

  private async validateMVP1Requirements(): Promise<ValidationResult | undefined> {
    if (!this.config.validateMVP1) {
      return undefined;
    }

    console.log('\n🔍 Validating MVP1 requirements...');
    
    const testResults = this.results;
    const validationResult = await this.validator.validateRequirements(testResults);
    
    if (validationResult.passed) {
      console.log('✅ MVP1 requirements validation passed');
    } else {
      console.log('❌ MVP1 requirements validation failed');
      console.log('Missing requirements:', validationResult.missingRequirements);
    }

    return validationResult;
  }

  private async generateMasterReport(startDate: Date, mvp1Validation?: ValidationResult): Promise<MasterTestResult> {
    const endDate = new Date();
    const totalDuration = performance.now() - this.startTime;

    const summary = {
      totalTests: this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0),
      totalPassed: this.results.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: this.results.reduce((sum, r) => sum + r.failed, 0),
      totalSkipped: this.results.reduce((sum, r) => sum + r.skipped, 0),
      successRate: 0,
      avgDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length || 0
    };

    summary.successRate = summary.totalTests > 0 ? (summary.totalPassed / summary.totalTests) * 100 : 0;

    const masterResult: MasterTestResult = {
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      totalDuration,
      configuration: this.config,
      suites: this.results,
      summary,
      mvp1Validation,
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        cpus: os.cpus().length
      },
      recommendations: this.generateRecommendations()
    };

    // Generate reports
    await this.reporter.generateComprehensiveReport(masterResult);

    return masterResult;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const summary = {
      totalTests: this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0),
      totalPassed: this.results.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: this.results.reduce((sum, r) => sum + r.failed, 0),
      successRate: 0
    };
    
    summary.successRate = summary.totalTests > 0 ? (summary.totalPassed / summary.totalTests) * 100 : 0;

    // Success rate recommendations
    if (summary.successRate < 80) {
      recommendations.push('🔴 Low test success rate - investigate failing tests and improve code quality');
    } else if (summary.successRate < 95) {
      recommendations.push('🟡 Moderate test success rate - review and fix failing tests');
    } else {
      recommendations.push('🟢 Excellent test success rate - maintain current quality standards');
    }

    // Performance recommendations
    const performanceSuites = this.results.filter(r => r.category === 'performance');
    if (performanceSuites.some(r => r.failed > 0)) {
      recommendations.push('⚠️ Performance tests failing - optimize slow operations and memory usage');
    }

    // Error handling recommendations
    const errorHandlingSuites = this.results.filter(r => r.category === 'error-handling');
    if (errorHandlingSuites.some(r => r.failed > 0)) {
      recommendations.push('⚠️ Error handling tests failing - improve error recovery and resilience');
    }

    // Coverage recommendations
    const hasLowCoverage = this.results.some(r => 
      r.coverage && (
        r.coverage.statements < 80 ||
        r.coverage.branches < 80 ||
        r.coverage.functions < 80 ||
        r.coverage.lines < 80
      )
    );
    
    if (hasLowCoverage) {
      recommendations.push('📊 Low test coverage detected - add more comprehensive tests');
    }

    // Duration recommendations
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    if (avgDuration > 30000) { // 30 seconds
      recommendations.push('⏱️ Long test duration detected - optimize test performance and consider parallel execution');
    }

    return recommendations;
  }

  private async postRunCleanup(): Promise<void> {
    console.log('\n🧹 Performing post-run cleanup...');
    
    // Clean up temporary Jest output files
    const tempDir = path.join(process.cwd(), 'temp');
    try {
      const files = await fs.readdir(tempDir);
      const resultFiles = files.filter(f => f.endsWith('-results.json'));
      
      for (const file of resultFiles) {
        await fs.unlink(path.join(tempDir, file));
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    // Reset environment
    delete process.env.TEST_SUITE;
    delete process.env.TEST_CATEGORY;
    
    console.log('✅ Cleanup complete');
  }

  private setupEventHandlers(): void {
    this.on('suiteStart', (suite: TestSuiteConfig) => {
      if (this.config.verbose) {
        console.log(`📋 Starting ${suite.category}/${suite.name}`);
      }
    });

    this.on('suiteComplete', (result: TestSuiteResult) => {
      const status = result.failed === 0 ? '✅' : '❌';
      const successRate = result.passed + result.failed > 0 
        ? ((result.passed / (result.passed + result.failed)) * 100).toFixed(1)
        : '100.0';
      
      console.log(`   ${status} ${result.suite}: ${result.passed}P ${result.failed}F ${result.skipped}S (${successRate}%)`);
    });

    this.on('suiteError', ({ suite, error }) => {
      console.error(`   💥 ${suite.name} encountered an error:`, error.message);
    });
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Public methods for external usage
  getResults(): TestSuiteResult[] {
    return [...this.results];
  }

  async exportResults(format: 'json' | 'xml' | 'junit' = 'json', outputPath?: string): Promise<string> {
    return this.reporter.exportResults(this.results, format, outputPath);
  }
}

// CLI argument parsing
function parseArgs(): TestRunConfig {
  const args = process.argv.slice(2);
  const config: TestRunConfig = {};

  args.forEach(arg => {
    if (arg.startsWith('--suites=')) {
      config.suites = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--skip=')) {
      config.skipSuites = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--report=')) {
      config.reportFormat = arg.split('=')[1] as any;
    } else if (arg.startsWith('--timeout=')) {
      config.testTimeout = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg === '--coverage') {
      config.coverage = true;
    } else if (arg === '--parallel') {
      config.parallel = true;
    } else if (arg === '--sequential') {
      config.parallel = false;
    } else if (arg.startsWith('--max-workers=')) {
      config.maxWorkers = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--validate-mvp1') {
      config.validateMVP1 = true;
    } else if (arg === '--fail-fast') {
      config.failFast = true;
    } else if (arg === '--clean-reports') {
      config.cleanOldReports = true;
    }
  });

  return config;
}

// Main execution function
export async function main(): Promise<void> {
  try {
    console.log('🎯 MVP1 Knowledge Base Assistant - Master Test Runner');
    console.log(`Node.js: ${process.version}, Platform: ${os.platform()}, Arch: ${os.arch()}`);
    console.log('=' .repeat(80));
    
    const config = parseArgs();
    const runner = new MasterTestRunner(config);
    
    const result = await runner.run();
    
    // Print final summary
    console.log('\n' + '=' .repeat(80));
    console.log('🎉 MASTER TEST EXECUTION COMPLETE');
    console.log('=' .repeat(80));
    console.log(`📊 Total Tests: ${result.summary.totalTests}`);
    console.log(`✅ Passed: ${result.summary.totalPassed}`);
    console.log(`❌ Failed: ${result.summary.totalFailed}`);
    console.log(`⏭️  Skipped: ${result.summary.totalSkipped}`);
    console.log(`📈 Success Rate: ${result.summary.successRate.toFixed(2)}%`);
    console.log(`⏱️  Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);
    
    if (result.mvp1Validation) {
      console.log(`🎯 MVP1 Validation: ${result.mvp1Validation.passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    // Exit with appropriate code
    const exitCode = result.summary.totalFailed > 0 ? 1 : 0;
    if (exitCode !== 0) {
      console.log('\n💥 Some tests failed. Check the detailed report for more information.');
    } else {
      console.log('\n🎊 All tests passed successfully!');
    }
    
    process.exit(exitCode);
  } catch (error) {
    console.error('\n💥 Master test runner failed:', error);
    process.exit(1);
  }
}

// Export for programmatic usage
export default MasterTestRunner;

// Run if called directly
if (require.main === module) {
  main();
}