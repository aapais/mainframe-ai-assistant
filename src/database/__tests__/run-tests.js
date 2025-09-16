#!/usr/bin/env node

/**
 * Comprehensive Database Test Runner
 * 
 * This script runs all database tests with proper reporting and coverage analysis.
 * It supports different test suites and provides detailed performance metrics.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class DatabaseTestRunner {
  constructor() {
    this.testResults = {
      unit: null,
      integration: null,
      performance: null,
      errorHandling: null
    };
    
    this.startTime = Date.now();
    this.config = {
      maxWorkers: 1, // Important for SQLite to avoid file locking issues
      timeout: 60000, // 60 seconds default timeout
      verbose: process.argv.includes('--verbose'),
      coverage: process.argv.includes('--coverage'),
      ci: process.argv.includes('--ci'),
      suite: this.extractSuite() || 'all'
    };
  }

  extractSuite() {
    const suiteArg = process.argv.find(arg => arg.startsWith('--suite='));
    return suiteArg ? suiteArg.split('=')[1] : null;
  }

  async run() {
    console.log('🧪 Starting Comprehensive Database Test Suite');
    console.log('='.repeat(60));
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
    console.log(`CPUs: ${os.cpus().length}`);
    console.log(`Test Suite: ${this.config.suite}`);
    console.log('='.repeat(60));

    try {
      await this.setupTestEnvironment();
      
      if (this.config.suite === 'all' || this.config.suite === 'unit') {
        await this.runUnitTests();
      }
      
      if (this.config.suite === 'all' || this.config.suite === 'integration') {
        await this.runIntegrationTests();
      }
      
      if (this.config.suite === 'all' || this.config.suite === 'performance') {
        await this.runPerformanceTests();
      }
      
      if (this.config.suite === 'all' || this.config.suite === 'error-handling') {
        await this.runErrorHandlingTests();
      }

      await this.generateReport();
      await this.cleanup();

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    // Ensure test directories exist
    const testDirs = [
      path.join(__dirname, 'temp'),
      path.join(__dirname, 'temp', 'backups'),
      path.join(__dirname, 'temp', 'migrations'),
      path.join(__dirname, '..', '..', '..', 'coverage', 'database')
    ];

    for (const dir of testDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    console.log('✅ Test environment ready');
  }

  async runUnitTests() {
    console.log('🔍 Running Unit Tests...');
    this.testResults.unit = await this.executeJest('unit/**/*.test.ts', {
      displayName: 'Unit Tests',
      testPathPattern: 'unit'
    });
  }

  async runIntegrationTests() {
    console.log('🔗 Running Integration Tests...');
    this.testResults.integration = await this.executeJest('integration/**/*.test.ts', {
      displayName: 'Integration Tests',
      testPathPattern: 'integration',
      timeout: 120000 // 2 minutes for integration tests
    });
  }

  async runPerformanceTests() {
    console.log('🚀 Running Performance Tests...');
    this.testResults.performance = await this.executeJest('performance/**/*.test.ts', {
      displayName: 'Performance Tests',
      testPathPattern: 'performance',
      timeout: 300000, // 5 minutes for performance tests
      maxWorkers: 1 // Sequential execution for accurate performance measurement
    });
  }

  async runErrorHandlingTests() {
    console.log('⚠️ Running Error Handling Tests...');
    this.testResults.errorHandling = await this.executeJest('error-handling/**/*.test.ts', {
      displayName: 'Error Handling Tests',
      testPathPattern: 'error-handling',
      timeout: 180000 // 3 minutes for error handling tests
    });
  }

  async executeJest(pattern, options = {}) {
    return new Promise((resolve, reject) => {
      const jestConfig = {
        preset: 'ts-jest',
        testEnvironment: 'node',
        testMatch: [`<rootDir>/${pattern}`],
        setupFilesAfterEnv: ['<rootDir>/test-utils/setup.ts'],
        maxWorkers: options.maxWorkers || this.config.maxWorkers,
        testTimeout: options.timeout || this.config.timeout,
        verbose: this.config.verbose,
        collectCoverage: this.config.coverage,
        coverageDirectory: path.join(__dirname, '..', '..', '..', 'coverage', 'database'),
        coverageReporters: ['text', 'lcov', 'html', 'cobertura'],
        forceExit: true,
        detectOpenHandles: true,
        ...(this.config.ci && {
          ci: true,
          coverage: true,
          watchAll: false
        })
      };

      const configPath = path.join(__dirname, 'temp', `jest-${options.testPathPattern || 'config'}.json`);
      fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));

      const jestArgs = [
        '--config', configPath,
        '--rootDir', __dirname,
        '--passWithNoTests'
      ];

      if (options.displayName) {
        console.log(`  Running: ${options.displayName}`);
      }

      const jest = spawn('npx', ['jest', ...jestArgs], {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        cwd: path.join(__dirname, '..', '..', '..')
      });

      let output = '';
      let errorOutput = '';

      if (!this.config.verbose) {
        jest.stdout?.on('data', (data) => {
          output += data.toString();
        });

        jest.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      jest.on('close', (code) => {
        const result = {
          success: code === 0,
          code,
          output,
          errorOutput,
          pattern,
          options
        };

        if (code === 0) {
          console.log(`  ✅ ${options.displayName || pattern} completed successfully`);
        } else {
          console.log(`  ❌ ${options.displayName || pattern} failed (exit code: ${code})`);
          if (!this.config.verbose && errorOutput) {
            console.log('Error output:', errorOutput);
          }
        }

        resolve(result);
      });

      jest.on('error', (error) => {
        console.error(`  ❌ Failed to start Jest: ${error.message}`);
        reject(error);
      });
    });
  }

  async generateReport() {
    const totalTime = Date.now() - this.startTime;
    const results = Object.values(this.testResults).filter(r => r !== null);
    const successfulTests = results.filter(r => r.success);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST EXECUTION REPORT');
    console.log('='.repeat(60));
    
    console.log(`Total execution time: ${this.formatDuration(totalTime)}`);
    console.log(`Test suites: ${results.length}`);
    console.log(`Successful: ${successfulTests.length}`);
    console.log(`Failed: ${results.length - successfulTests.length}`);
    
    // Detailed results
    Object.entries(this.testResults).forEach(([suite, result]) => {
      if (result) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${suite.padEnd(15)} - ${result.success ? 'PASSED' : `FAILED (${result.code})`}`);
      }
    });

    // Performance summary
    if (this.testResults.performance && this.testResults.performance.success) {
      console.log('\n📈 PERFORMANCE HIGHLIGHTS');
      console.log('-'.repeat(30));
      console.log('Performance test results saved to coverage directory');
    }

    // Coverage summary
    if (this.config.coverage) {
      console.log('\n📋 COVERAGE INFORMATION');
      console.log('-'.repeat(30));
      console.log(`Coverage reports: ${path.join(__dirname, '..', '..', '..', 'coverage', 'database')}`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(20));
    
    if (results.some(r => !r.success)) {
      console.log('• Fix failing tests before deployment');
    }
    
    if (this.config.suite !== 'all') {
      console.log('• Run full test suite (--suite=all) before production deployment');
    }
    
    console.log('• Monitor performance regression with baseline comparisons');
    console.log('• Review error handling test results for production readiness');
    
    console.log('\n' + '='.repeat(60));
    
    // Exit with appropriate code
    const overallSuccess = results.every(r => r.success);
    if (!overallSuccess) {
      console.log('❌ Some tests failed. Check the output above.');
      process.exit(1);
    } else {
      console.log('✅ All tests passed successfully!');
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      // Clean up temporary files
      const tempDir = path.join(__dirname, 'temp');
      if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(file => {
          const filePath = path.join(tempDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile() && (file.endsWith('.db') || file.endsWith('.json'))) {
            fs.unlinkSync(filePath);
          }
        });
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Database Test Runner

Usage: node run-tests.js [options]

Options:
  --suite=<name>    Run specific test suite (unit|integration|performance|error-handling|all)
  --coverage        Generate code coverage report
  --verbose         Show detailed output
  --ci              Run in CI mode with coverage
  --help, -h        Show this help message

Examples:
  node run-tests.js                    # Run all tests
  node run-tests.js --suite=unit       # Run only unit tests
  node run-tests.js --coverage         # Run with coverage
  node run-tests.js --ci               # Run in CI mode
  node run-tests.js --suite=performance --verbose  # Verbose performance tests
`);
  process.exit(0);
}

// Run tests
const runner = new DatabaseTestRunner();
runner.run().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});