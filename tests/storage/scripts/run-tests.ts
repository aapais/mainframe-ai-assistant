#!/usr/bin/env ts-node
/**
 * Test Runner Script for Storage Service
 * Provides convenient commands for running different test suites
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  maxWorkers?: string | number;
  description: string;
}

const TEST_SUITES: Record<string, TestSuite> = {
  unit: {
    name: 'Unit Tests',
    pattern: 'tests/storage/unit/**/*.test.ts',
    timeout: 10000,
    maxWorkers: '75%',
    description: 'Fast isolated tests for individual components'
  },
  integration: {
    name: 'Integration Tests',
    pattern: 'tests/storage/integration/**/*.test.ts',
    timeout: 30000,
    maxWorkers: '50%',
    description: 'Tests for component interactions and real dependencies'
  },
  performance: {
    name: 'Performance Tests',
    pattern: 'tests/storage/performance/**/*.test.ts',
    timeout: 60000,
    maxWorkers: 1,
    description: 'Benchmarks and performance validation tests'
  },
  e2e: {
    name: 'End-to-End Tests',
    pattern: 'tests/storage/e2e/**/*.test.ts',
    timeout: 120000,
    maxWorkers: 1,
    description: 'Complete workflow tests from start to finish'
  },
  all: {
    name: 'All Tests',
    pattern: 'tests/storage/**/*.test.ts',
    timeout: 120000,
    maxWorkers: '50%',
    description: 'Complete test suite'
  }
};

interface RunOptions {
  suite: string;
  watch?: boolean;
  coverage?: boolean;
  verbose?: boolean;
  updateSnapshots?: boolean;
  bail?: boolean;
  silent?: boolean;
  maxWorkers?: string | number;
  testNamePattern?: string;
  testPathPattern?: string;
  setupTimeout?: number;
  ci?: boolean;
}

class TestRunner {
  private projectRoot: string;

  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../..');
  }

  async run(options: RunOptions): Promise<void> {
    const suite = TEST_SUITES[options.suite];
    if (!suite) {
      console.error(`❌ Unknown test suite: ${options.suite}`);
      this.printUsage();
      process.exit(1);
    }

    console.log(`🧪 Running ${suite.name}`);
    console.log(`📝 ${suite.description}`);
    console.log('');

    await this.setupEnvironment();
    
    const jestArgs = this.buildJestArgs(suite, options);
    const success = await this.executeJest(jestArgs);
    
    if (!success) {
      process.exit(1);
    }
  }

  private async setupEnvironment(): Promise<void> {
    // Ensure temp directories exist
    const tempDirs = [
      'tests/storage/temp',
      'tests/storage/temp/unit',
      'tests/storage/temp/integration',
      'tests/storage/temp/performance',
      'tests/storage/temp/e2e'
    ];

    for (const dir of tempDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }

    // Set environment variables
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    
    // Memory settings for Node.js
    if (!process.env.NODE_OPTIONS) {
      process.env.NODE_OPTIONS = '--max-old-space-size=4096';
    }
  }

  private buildJestArgs(suite: TestSuite, options: RunOptions): string[] {
    const args = [
      '--config', 'tests/storage/jest.config.js',
      '--testMatch', `<rootDir>/${suite.pattern}`,
      '--testTimeout', suite.timeout.toString()
    ];

    // Workers
    if (options.maxWorkers !== undefined) {
      args.push('--maxWorkers', options.maxWorkers.toString());
    } else if (suite.maxWorkers !== undefined) {
      args.push('--maxWorkers', suite.maxWorkers.toString());
    }

    // Coverage
    if (options.coverage) {
      args.push('--coverage');
      args.push('--coverageDirectory', 'coverage/storage');
    }

    // Watch mode
    if (options.watch) {
      args.push('--watch');
    }

    // Verbose output
    if (options.verbose) {
      args.push('--verbose');
    }

    // Update snapshots
    if (options.updateSnapshots) {
      args.push('--updateSnapshot');
    }

    // Bail on first failure
    if (options.bail) {
      args.push('--bail');
    }

    // Silent mode
    if (options.silent) {
      args.push('--silent');
    }

    // CI mode
    if (options.ci) {
      args.push('--ci');
      args.push('--watchAll=false');
      args.push('--coverage');
    }

    // Test name pattern
    if (options.testNamePattern) {
      args.push('--testNamePattern', options.testNamePattern);
    }

    // Test path pattern
    if (options.testPathPattern) {
      args.push('--testPathPattern', options.testPathPattern);
    }

    return args;
  }

  private async executeJest(args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const jestPath = path.join(this.projectRoot, 'node_modules/.bin/jest');
      const isWindows = os.platform() === 'win32';
      const command = isWindows ? 'jest.cmd' : 'jest';
      
      console.log(`🏃 Executing: ${command} ${args.join(' ')}`);
      console.log('');

      const child = spawn(command, args, {
        cwd: this.projectRoot,
        stdio: 'inherit',
        shell: isWindows,
        env: {
          ...process.env,
          FORCE_COLOR: '1' // Enable colored output
        }
      });

      child.on('close', (code) => {
        console.log('');
        if (code === 0) {
          console.log('✅ Tests completed successfully');
          resolve(true);
        } else {
          console.log(`❌ Tests failed with code ${code}`);
          resolve(false);
        }
      });

      child.on('error', (error) => {
        console.error(`❌ Failed to start test runner: ${error.message}`);
        resolve(false);
      });
    });
  }

  printUsage(): void {
    console.log('Storage Service Test Runner');
    console.log('');
    console.log('Usage: npm run test:storage [options] <suite>');
    console.log('');
    console.log('Suites:');
    Object.entries(TEST_SUITES).forEach(([key, suite]) => {
      console.log(`  ${key.padEnd(12)} - ${suite.description}`);
    });
    console.log('');
    console.log('Options:');
    console.log('  --watch              Run in watch mode');
    console.log('  --coverage           Generate coverage report');
    console.log('  --verbose            Verbose output');
    console.log('  --update-snapshots   Update snapshots');
    console.log('  --bail               Stop on first failure');
    console.log('  --silent             Silent mode');
    console.log('  --ci                 CI mode');
    console.log('  --workers <n>        Number of workers');
    console.log('  --name-pattern <p>   Test name pattern');
    console.log('  --path-pattern <p>   Test path pattern');
    console.log('');
    console.log('Examples:');
    console.log('  npm run test:storage unit');
    console.log('  npm run test:storage integration --coverage');
    console.log('  npm run test:storage performance --verbose');
    console.log('  npm run test:storage e2e --ci');
    console.log('  npm run test:storage unit --watch');
  }

  async benchmark(): Promise<void> {
    console.log('🏁 Running Storage Service Benchmark Suite');
    console.log('');

    const benchmarkSuites = ['unit', 'integration', 'performance'];
    const results: Array<{ suite: string; time: number; success: boolean }> = [];

    for (const suiteName of benchmarkSuites) {
      console.log(`📊 Benchmarking ${suiteName} tests...`);
      
      const startTime = Date.now();
      const success = await this.executeJest([
        '--config', 'tests/storage/jest.config.js',
        '--testMatch', `<rootDir>/${TEST_SUITES[suiteName].pattern}`,
        '--testTimeout', TEST_SUITES[suiteName].timeout.toString(),
        '--maxWorkers', '50%',
        '--silent'
      ]);
      const endTime = Date.now();
      
      results.push({
        suite: suiteName,
        time: endTime - startTime,
        success
      });
    }

    console.log('');
    console.log('📈 Benchmark Results:');
    console.log('');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = (result.time / 1000).toFixed(2);
      console.log(`  ${status} ${result.suite.padEnd(12)} - ${time}s`);
    });
    
    const totalTime = results.reduce((sum, r) => sum + r.time, 0);
    const successCount = results.filter(r => r.success).length;
    
    console.log('');
    console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Success rate: ${successCount}/${results.length} (${((successCount / results.length) * 100).toFixed(1)}%)`);
  }

  async validateEnvironment(): Promise<boolean> {
    console.log('🔍 Validating test environment...');
    
    const checks = [
      {
        name: 'Node.js version',
        check: () => {
          const version = process.version;
          const major = parseInt(version.slice(1).split('.')[0]);
          return major >= 16;
        },
        message: 'Node.js 16+ required'
      },
      {
        name: 'Jest installation',
        check: () => {
          const jestPath = path.join(this.projectRoot, 'node_modules/.bin/jest');
          return fs.existsSync(jestPath) || fs.existsSync(`${jestPath}.cmd`);
        },
        message: 'Jest not found. Run npm install'
      },
      {
        name: 'TypeScript configuration',
        check: () => {
          const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
          return fs.existsSync(tsconfigPath);
        },
        message: 'tsconfig.json not found'
      },
      {
        name: 'Source files',
        check: () => {
          const srcPath = path.join(this.projectRoot, 'src/services/storage');
          return fs.existsSync(srcPath);
        },
        message: 'Storage source files not found'
      },
      {
        name: 'Available memory',
        check: () => {
          const totalMem = os.totalmem() / 1024 / 1024 / 1024; // GB
          return totalMem >= 2; // At least 2GB
        },
        message: 'Insufficient memory (2GB+ recommended)'
      }
    ];

    let allPassed = true;
    
    for (const check of checks) {
      const passed = check.check();
      const status = passed ? '✅' : '❌';
      console.log(`  ${status} ${check.name}`);
      
      if (!passed) {
        console.log(`      ${check.message}`);
        allPassed = false;
      }
    }

    console.log('');
    
    if (allPassed) {
      console.log('✅ Environment validation passed');
    } else {
      console.log('❌ Environment validation failed');
    }

    return allPassed;
  }
}

// CLI Interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  // Parse command line arguments
  const options: RunOptions = {
    suite: 'all',
    watch: args.includes('--watch'),
    coverage: args.includes('--coverage'),
    verbose: args.includes('--verbose'),
    updateSnapshots: args.includes('--update-snapshots'),
    bail: args.includes('--bail'),
    silent: args.includes('--silent'),
    ci: args.includes('--ci')
  };

  // Extract values for options with parameters
  const workersIndex = args.indexOf('--workers');
  if (workersIndex !== -1 && args[workersIndex + 1]) {
    options.maxWorkers = args[workersIndex + 1];
  }

  const namePatternIndex = args.indexOf('--name-pattern');
  if (namePatternIndex !== -1 && args[namePatternIndex + 1]) {
    options.testNamePattern = args[namePatternIndex + 1];
  }

  const pathPatternIndex = args.indexOf('--path-pattern');
  if (pathPatternIndex !== -1 && args[pathPatternIndex + 1]) {
    options.testPathPattern = args[pathPatternIndex + 1];
  }

  // Get suite name (first non-option argument)
  const suiteArg = args.find(arg => !arg.startsWith('--') && 
    !args[args.indexOf(arg) - 1]?.startsWith('--'));
  if (suiteArg) {
    options.suite = suiteArg;
  }

  // Handle special commands
  if (args.includes('--help') || args.includes('-h')) {
    runner.printUsage();
    return;
  }

  if (args.includes('--benchmark')) {
    await runner.benchmark();
    return;
  }

  if (args.includes('--validate')) {
    const valid = await runner.validateEnvironment();
    process.exit(valid ? 0 : 1);
    return;
  }

  // Validate environment before running tests
  const environmentValid = await runner.validateEnvironment();
  if (!environmentValid) {
    process.exit(1);
  }

  // Run tests
  await runner.run(options);
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunner, TEST_SUITES };