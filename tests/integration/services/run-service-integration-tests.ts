#!/usr/bin/env node

/**
 * Service Integration Test Runner
 * 
 * Executes comprehensive integration tests for Gemini Service and Pattern Detection
 * with proper setup, teardown, and reporting.
 * 
 * @author Service Testing Specialist
 * @version 1.0.0
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestConfig {
  testFiles: string[];
  timeout: number;
  coverage: boolean;
  verbose: boolean;
  bail: boolean;
}

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  coverage?: number;
  error?: string;
}

class ServiceIntegrationTestRunner {
  private config: TestConfig;
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(config: Partial<TestConfig> = {}) {
    this.config = {
      testFiles: [
        'gemini-service.integration.test.ts',
        'pattern-detector.integration.test.ts'
      ],
      timeout: 120000, // 2 minutes per test file
      coverage: false,
      verbose: false,
      bail: false,
      ...config
    };
  }

  async run(): Promise<boolean> {
    this.startTime = Date.now();
    
    console.log('🚀 Starting Service Integration Tests');
    console.log('=====================================');
    
    this.printConfiguration();
    
    let allPassed = true;
    
    for (const testFile of this.config.testFiles) {
      const result = await this.runTestFile(testFile);
      this.results.push(result);
      
      if (!result.passed) {
        allPassed = false;
        if (this.config.bail) {
          console.log('💥 Stopping on first failure (--bail)');
          break;
        }
      }
    }
    
    this.printSummary();
    
    return allPassed;
  }

  private async runTestFile(testFile: string): Promise<TestResult> {
    const testPath = path.join(__dirname, testFile);
    const startTime = Date.now();
    
    console.log(`\n📋 Running: ${testFile}`);
    console.log('─'.repeat(50));
    
    if (!fs.existsSync(testPath)) {
      return {
        testFile,
        passed: false,
        duration: 0,
        error: `Test file not found: ${testPath}`
      };
    }
    
    try {
      // Build Jest command
      const jestCmd = this.buildJestCommand(testPath);
      
      console.log(`📌 Command: ${jestCmd}`);
      
      // Execute test
      const output = execSync(jestCmd, {
        cwd: path.join(__dirname, '../../..'),
        timeout: this.config.timeout,
        encoding: 'utf8'
      });
      
      const duration = Date.now() - startTime;
      
      if (this.config.verbose) {
        console.log(output);
      }
      
      // Parse coverage if enabled
      let coverage: number | undefined;
      if (this.config.coverage) {
        coverage = this.parseCoverage(output);
      }
      
      console.log(`✅ Passed in ${duration}ms`);
      
      return {
        testFile,
        passed: true,
        duration,
        coverage
      };
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      console.log(`❌ Failed in ${duration}ms`);
      
      if (this.config.verbose) {
        console.log(error.stdout || error.message);
      }
      
      return {
        testFile,
        passed: false,
        duration,
        error: error.message
      };
    }
  }

  private buildJestCommand(testPath: string): string {
    const cmd = ['npx', 'jest'];
    
    // Test file
    cmd.push(`"${testPath}"`);
    
    // Configuration
    cmd.push('--testTimeout=120000');
    cmd.push('--detectOpenHandles');
    cmd.push('--forceExit');
    
    if (this.config.coverage) {
      cmd.push('--coverage');
      cmd.push('--coverageReporters=text-lcov');
      cmd.push('--coverageReporters=text');
    }
    
    if (this.config.verbose) {
      cmd.push('--verbose');
    }
    
    // Environment variables
    const envVars = [
      'NODE_ENV=test',
      'FORCE_COLOR=1'
    ];
    
    return envVars.join(' ') + ' ' + cmd.join(' ');
  }

  private parseCoverage(output: string): number | undefined {
    // Parse coverage from Jest output
    const coverageMatch = output.match(/All files[^\|]*\|[^\|]*\|[^\|]*\|[^\|]*\|\s*(\d+\.?\d*)/);
    if (coverageMatch) {
      return parseFloat(coverageMatch[1]);
    }
    return undefined;
  }

  private printConfiguration(): void {
    console.log('Configuration:');
    console.log(`  Test Files: ${this.config.testFiles.length}`);
    console.log(`  Timeout: ${this.config.timeout}ms per file`);
    console.log(`  Coverage: ${this.config.coverage ? 'enabled' : 'disabled'}`);
    console.log(`  Verbose: ${this.config.verbose ? 'enabled' : 'disabled'}`);
    console.log(`  Bail on failure: ${this.config.bail ? 'enabled' : 'disabled'}`);
    console.log('');
  }

  private printSummary(): void {
    const totalTime = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    
    console.log('\n🎯 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total Time: ${totalTime}ms`);
    
    if (this.config.coverage) {
      const avgCoverage = this.results
        .filter(r => r.coverage !== undefined)
        .reduce((sum, r) => sum + (r.coverage || 0), 0) / this.results.length;
      
      if (!isNaN(avgCoverage)) {
        console.log(`Average Coverage: ${avgCoverage.toFixed(2)}%`);
      }
    }
    
    console.log('\nDetailed Results:');
    console.log('─'.repeat(80));
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      const coverage = result.coverage ? `${result.coverage.toFixed(1)}%` : 'N/A';
      
      console.log(`${status} ${result.testFile.padEnd(40)} ${duration.padStart(8)} ${coverage.padStart(8)}`);
      
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    if (failed === 0) {
      console.log('\n🎉 All integration tests passed!');
    } else {
      console.log(`\n💥 ${failed} test file(s) failed`);
    }
  }
}

// Command line interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  const config: Partial<TestConfig> = {
    coverage: args.includes('--coverage'),
    verbose: args.includes('--verbose'),
    bail: args.includes('--bail')
  };
  
  // Parse specific test files
  const fileArgs = args.filter(arg => arg.endsWith('.test.ts'));
  if (fileArgs.length > 0) {
    config.testFiles = fileArgs;
  }
  
  // Parse timeout
  const timeoutIndex = args.indexOf('--timeout');
  if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
    config.timeout = parseInt(args[timeoutIndex + 1]) * 1000;
  }
  
  try {
    const runner = new ServiceIntegrationTestRunner(config);
    const success = await runner.run();
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Help text
function printHelp(): void {
  console.log(`
Service Integration Test Runner

Usage: npm run test:services [options]

Options:
  --coverage          Generate coverage report
  --verbose           Show detailed test output  
  --bail             Stop on first failure
  --timeout <seconds> Set timeout per test file (default: 120)
  --help             Show this help

Examples:
  npm run test:services
  npm run test:services -- --coverage --verbose
  npm run test:services -- gemini-service.integration.test.ts
  npm run test:services -- --timeout 180 --bail
`);
}

if (args.includes('--help')) {
  printHelp();
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ServiceIntegrationTestRunner, TestConfig, TestResult };