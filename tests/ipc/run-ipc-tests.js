#!/usr/bin/env node

/**
 * IPC Test Suite Runner
 * Comprehensive test runner for all IPC communication tests
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

function logSection(title) {
  console.log('\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize('='.repeat(60), 'cyan'));
}

function logSubsection(title) {
  console.log('\n' + colorize(`→ ${title}`, 'blue'));
  console.log(colorize('-'.repeat(40), 'blue'));
}

class IPCTestRunner {
  constructor() {
    this.testSuites = [
      {
        name: 'Comprehensive IPC Tests',
        file: 'IPC.comprehensive.test.ts',
        description: 'Full IPC communication test suite'
      },
      {
        name: 'Security & Validation Tests',
        file: 'IPC.security.test.ts',
        description: 'IPC security and input validation'
      },
      {
        name: 'Performance Tests',
        file: 'IPC.performance.test.ts',
        description: 'IPC performance and load testing'
      },
      {
        name: 'Context Bridge Tests',
        file: 'IPC.contextBridge.test.ts',
        description: 'Context bridge and preload security'
      },
      {
        name: 'Edge Cases & Integration',
        file: 'IPC.edgeCases.test.ts',
        description: 'Edge cases and integration scenarios'
      }
    ];
    
    this.options = {
      coverage: false,
      verbose: false,
      watch: false,
      suite: null,
      timeout: 30000,
      maxWorkers: '50%',
      bail: false,
      detectLeaks: false,
      ci: false
    };
    
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      suites: []
    };
  }

  parseArguments() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--coverage':
        case '-c':
          this.options.coverage = true;
          break;
        case '--verbose':
        case '-v':
          this.options.verbose = true;
          break;
        case '--watch':
        case '-w':
          this.options.watch = true;
          break;
        case '--suite':
        case '-s':
          this.options.suite = args[++i];
          break;
        case '--timeout':
        case '-t':
          this.options.timeout = parseInt(args[++i]);
          break;
        case '--max-workers':
          this.options.maxWorkers = args[++i];
          break;
        case '--bail':
        case '-b':
          this.options.bail = true;
          break;
        case '--detect-leaks':
          this.options.detectLeaks = true;
          break;
        case '--ci':
          this.options.ci = true;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
        default:
          if (arg.startsWith('-')) {
            log(`Unknown option: ${arg}`, 'red');
            process.exit(1);
          }
      }
    }
  }

  showHelp() {
    logSection('IPC Test Suite Runner');
    
    console.log(`
Usage: node run-ipc-tests.js [options]

Options:
  -c, --coverage       Generate coverage report
  -v, --verbose        Verbose output
  -w, --watch          Watch mode for development
  -s, --suite <name>   Run specific test suite
  -t, --timeout <ms>   Set test timeout (default: 30000)
  --max-workers <n>    Set number of workers (default: 50%)
  -b, --bail           Stop on first failure
  --detect-leaks       Enable memory leak detection
  --ci                 CI mode with optimized settings
  -h, --help           Show this help

Available test suites:`);
    
    this.testSuites.forEach((suite, index) => {
      console.log(`  ${index + 1}. ${colorize(suite.name, 'green')}`);
      console.log(`     ${suite.description}`);
      console.log(`     File: ${suite.file}\n`);
    });
    
    console.log(`Examples:
  node run-ipc-tests.js --coverage --verbose
  node run-ipc-tests.js --suite "Comprehensive IPC Tests"
  node run-ipc-tests.js --watch --suite "Performance Tests"
  node run-ipc-tests.js --ci --bail`);
  }

  validateEnvironment() {
    logSubsection('Environment Validation');
    
    // Check Node.js version
    const nodeVersion = process.version;
    log(`Node.js version: ${nodeVersion}`, 'green');
    
    if (parseInt(nodeVersion.slice(1)) < 18) {
      log('Warning: Node.js 18+ recommended for optimal testing', 'yellow');
    }
    
    // Check if Jest is available
    try {
      execSync('npx jest --version', { stdio: 'pipe' });
      log('✓ Jest is available', 'green');
    } catch (error) {
      log('✗ Jest not found. Please install dependencies.', 'red');
      process.exit(1);
    }
    
    // Check if TypeScript is configured
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      log('✓ TypeScript configuration found', 'green');
    } else {
      log('⚠ TypeScript configuration not found', 'yellow');
    }
    
    // Check test files
    const testDir = path.join(process.cwd(), 'tests', 'ipc');
    if (fs.existsSync(testDir)) {
      log('✓ IPC test directory found', 'green');
      
      const testFiles = this.testSuites.map(suite => suite.file);
      const missingFiles = testFiles.filter(file => 
        !fs.existsSync(path.join(testDir, file))
      );
      
      if (missingFiles.length > 0) {
        log(`⚠ Missing test files: ${missingFiles.join(', ')}`, 'yellow');
      } else {
        log('✓ All test files found', 'green');
      }
    } else {
      log('✗ IPC test directory not found', 'red');
      process.exit(1);
    }
    
    // Check memory availability
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const memoryGB = (totalMemory / 1024 / 1024 / 1024).toFixed(1);
    const freeGB = (freeMemory / 1024 / 1024 / 1024).toFixed(1);
    
    log(`Memory: ${freeGB}GB free of ${memoryGB}GB total`, 'green');
    
    if (freeMemory < 1024 * 1024 * 1024) { // Less than 1GB free
      log('⚠ Low memory available. Consider closing other applications.', 'yellow');
    }
  }

  buildJestCommand() {
    const configPath = path.join(process.cwd(), 'tests', 'ipc', 'jest.config.ipc.js');
    
    let cmd = `npx jest --config="${configPath}"`;
    
    if (this.options.coverage) {
      cmd += ' --coverage';
    }
    
    if (this.options.verbose) {
      cmd += ' --verbose';
    }
    
    if (this.options.watch) {
      cmd += ' --watch';
    }
    
    if (this.options.suite) {
      const suite = this.testSuites.find(s => 
        s.name.toLowerCase().includes(this.options.suite.toLowerCase()) ||
        s.file.toLowerCase().includes(this.options.suite.toLowerCase())
      );
      
      if (suite) {
        cmd += ` --testNamePattern="${suite.name}"`;
        log(`Running specific suite: ${suite.name}`, 'blue');
      } else {
        log(`Suite not found: ${this.options.suite}`, 'red');
        log('Available suites:', 'yellow');
        this.testSuites.forEach(s => log(`  - ${s.name}`, 'yellow'));
        process.exit(1);
      }
    }
    
    if (this.options.timeout !== 30000) {
      cmd += ` --testTimeout=${this.options.timeout}`;
    }
    
    if (this.options.maxWorkers !== '50%') {
      cmd += ` --maxWorkers=${this.options.maxWorkers}`;
    }
    
    if (this.options.bail) {
      cmd += ' --bail';
    }
    
    if (this.options.detectLeaks) {
      cmd += ' --detectLeaks';
    }
    
    if (this.options.ci) {
      cmd += ' --ci --coverage --watchAll=false --maxWorkers=2';
    }
    
    return cmd;
  }

  async runTests() {
    logSection('Running IPC Tests');
    
    const startTime = Date.now();
    const command = this.buildJestCommand();
    
    logSubsection('Test Configuration');
    log(`Command: ${command}`, 'cyan');
    log(`Timeout: ${this.options.timeout}ms`, 'cyan');
    log(`Workers: ${this.options.maxWorkers}`, 'cyan');
    log(`Coverage: ${this.options.coverage ? 'enabled' : 'disabled'}`, 'cyan');
    log(`CI Mode: ${this.options.ci ? 'enabled' : 'disabled'}`, 'cyan');
    
    try {
      logSubsection('Test Execution');
      
      const output = execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '1'
        }
      });
      
      this.results.duration = Date.now() - startTime;
      
      logSubsection('Test Results');
      log('✓ All tests completed successfully!', 'green');
      
    } catch (error) {
      this.results.duration = Date.now() - startTime;
      
      logSubsection('Test Results');
      log('✗ Some tests failed', 'red');
      
      if (error.status) {
        log(`Exit code: ${error.status}`, 'red');
      }
      
      process.exit(error.status || 1);
    }
  }

  generateSummary() {
    logSubsection('Test Summary');
    
    const durationSeconds = (this.results.duration / 1000).toFixed(2);
    log(`Total execution time: ${durationSeconds}s`, 'cyan');
    
    // Check if coverage report exists
    const coverageDir = path.join(process.cwd(), 'coverage', 'ipc');
    if (this.options.coverage && fs.existsSync(coverageDir)) {
      log('Coverage report generated:', 'green');
      log(`  📄 HTML: ${path.join(coverageDir, 'lcov-report', 'index.html')}`, 'green');
      log(`  📄 LCOV: ${path.join(coverageDir, 'lcov.info')}`, 'green');
      
      // Try to read coverage summary
      const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
      if (fs.existsSync(coverageSummaryPath)) {
        try {
          const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
          const total = coverageSummary.total;
          
          log('Coverage Summary:', 'blue');
          log(`  Lines: ${total.lines.pct}%`, total.lines.pct >= 85 ? 'green' : 'yellow');
          log(`  Functions: ${total.functions.pct}%`, total.functions.pct >= 90 ? 'green' : 'yellow');
          log(`  Branches: ${total.branches.pct}%`, total.branches.pct >= 85 ? 'green' : 'yellow');
          log(`  Statements: ${total.statements.pct}%`, total.statements.pct >= 85 ? 'green' : 'yellow');
        } catch (error) {
          log('Could not read coverage summary', 'yellow');
        }
      }
    }
    
    // Check for test execution report
    const reportPath = path.join(process.cwd(), 'coverage', 'ipc', 'test-execution-report.json');
    if (fs.existsSync(reportPath)) {
      log('Detailed execution report available:', 'green');
      log(`  📄 JSON: ${reportPath}`, 'green');
      log(`  📄 Markdown: ${path.join(path.dirname(reportPath), 'test-summary.md')}`, 'green');
    }
  }

  async run() {
    try {
      logSection('IPC Test Suite Runner');
      
      this.parseArguments();
      this.validateEnvironment();
      await this.runTests();
      this.generateSummary();
      
      log('\n✨ IPC test execution completed successfully!', 'green');
      
    } catch (error) {
      log(`\n✗ Error: ${error.message}`, 'red');
      process.exit(1);
    }
  }
}

// Run the test suite
if (require.main === module) {
  const runner = new IPCTestRunner();
  runner.run().catch(console.error);
}

module.exports = IPCTestRunner;
