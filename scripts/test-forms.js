#!/usr/bin/env node

/**
 * Form Testing Suite Runner
 * 
 * Comprehensive test runner for form components with coverage reporting,
 * accessibility testing, and performance benchmarks.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
};

function colorize(text, color) {
  return `${color}${text}${COLORS.RESET}`;
}

function log(message, color = COLORS.RESET) {
  console.log(colorize(message, color));
}

class FormTestRunner {
  constructor() {
    this.testSuites = {
      unit: [
        'src/services/__tests__/ValidationService.test.ts',
        'src/renderer/components/common/__tests__/Button.test.tsx',
      ],
      component: [
        'src/renderer/components/forms/__tests__/KBEntryForm.test.tsx',
      ],
      integration: [
        'src/renderer/components/__tests__/FormIntegration.test.tsx',
      ],
      accessibility: [
        'src/renderer/components/__tests__/Accessibility.test.tsx',
      ],
      errorHandling: [
        'src/renderer/components/__tests__/ErrorHandling.test.tsx',
      ],
      persistence: [
        'src/renderer/components/__tests__/FormPersistence.test.tsx',
      ],
    };

    this.coverageThresholds = {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      forms: {
        branches: 85,
        functions: 90,
        lines: 85,
        statements: 85,
      },
      validation: {
        branches: 90,
        functions: 95,
        lines: 90,
        statements: 90,
      },
    };
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true,
        ...options,
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  async runTestSuite(suiteName, options = {}) {
    const { watch = false, coverage = false, verbose = false } = options;
    
    log(`\n${colorize('Running', COLORS.CYAN)} ${colorize(suiteName, COLORS.BRIGHT)} ${colorize('test suite...', COLORS.CYAN)}`);
    
    const files = this.testSuites[suiteName];
    if (!files || files.length === 0) {
      log(`No test files found for suite: ${suiteName}`, COLORS.YELLOW);
      return;
    }

    const jestArgs = [
      ...files,
      '--passWithNoTests',
    ];

    if (coverage) {
      jestArgs.push('--coverage');
      jestArgs.push('--coverageDirectory=coverage/forms');
    }

    if (verbose) {
      jestArgs.push('--verbose');
    }

    if (watch) {
      jestArgs.push('--watch');
    }

    try {
      await this.runCommand('npx', ['jest', ...jestArgs]);
      log(`✅ ${suiteName} tests passed!`, COLORS.GREEN);
    } catch (error) {
      log(`❌ ${suiteName} tests failed!`, COLORS.RED);
      throw error;
    }
  }

  async runAllTests(options = {}) {
    const { coverage = true, bail = false } = options;
    
    log(colorize('\n🧪 Starting Comprehensive Form Test Suite\n', COLORS.BRIGHT));
    
    const suiteOrder = ['unit', 'component', 'integration', 'accessibility', 'errorHandling', 'persistence'];
    let failedSuites = [];

    for (const suite of suiteOrder) {
      try {
        await this.runTestSuite(suite, { coverage: coverage && suite === 'unit' });
      } catch (error) {
        failedSuites.push(suite);
        if (bail) {
          log(`\n❌ Stopping due to failed test suite: ${suite}`, COLORS.RED);
          process.exit(1);
        }
      }
    }

    if (coverage) {
      await this.generateCoverageReport();
    }

    this.printSummary(failedSuites);
    return failedSuites.length === 0;
  }

  async runAccessibilityTests() {
    log(colorize('\n♿ Running Accessibility Tests\n', COLORS.MAGENTA));
    
    try {
      await this.runCommand('npx', [
        'jest',
        'src/renderer/components/__tests__/Accessibility.test.tsx',
        '--verbose',
      ]);
      log('✅ All accessibility tests passed!', COLORS.GREEN);
    } catch (error) {
      log('❌ Accessibility tests failed!', COLORS.RED);
      throw error;
    }
  }

  async runPerformanceTests() {
    log(colorize('\n⚡ Running Performance Tests\n', COLORS.YELLOW));
    
    const performanceArgs = [
      'jest',
      '--testNamePattern=Performance|performance',
      '--verbose',
      '--maxWorkers=1', // Run performance tests in isolation
    ];

    try {
      await this.runCommand('npx', performanceArgs);
      log('✅ Performance tests completed!', COLORS.GREEN);
    } catch (error) {
      log('❌ Performance tests failed!', COLORS.RED);
      throw error;
    }
  }

  async generateCoverageReport() {
    log(colorize('\n📊 Generating Coverage Report...\n', COLORS.BLUE));
    
    const coverageArgs = [
      'jest',
      '--coverage',
      '--coverageDirectory=coverage/forms',
      '--coverageReporters=text,lcov,html',
      '--collectCoverageFrom=src/renderer/components/forms/**/*.{ts,tsx}',
      '--collectCoverageFrom=src/renderer/components/common/**/*.{ts,tsx}',
      '--collectCoverageFrom=src/services/ValidationService.ts',
      '--coveragePathIgnorePatterns=__tests__',
      ...Object.values(this.testSuites).flat(),
    ];

    try {
      await this.runCommand('npx', coverageArgs);
      
      // Check if coverage meets thresholds
      await this.checkCoverageThresholds();
      
    } catch (error) {
      log('⚠️ Coverage report generation failed', COLORS.YELLOW);
    }
  }

  async checkCoverageThresholds() {
    const coveragePath = path.join(process.cwd(), 'coverage/forms/coverage-summary.json');
    
    if (!fs.existsSync(coveragePath)) {
      log('⚠️ Coverage summary not found', COLORS.YELLOW);
      return;
    }

    try {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const total = coverage.total;
      
      log('\n📈 Coverage Summary:', COLORS.BLUE);
      log(`  Lines: ${total.lines.pct}%`);
      log(`  Branches: ${total.branches.pct}%`);
      log(`  Functions: ${total.functions.pct}%`);
      log(`  Statements: ${total.statements.pct}%`);
      
      const thresholds = this.coverageThresholds.global;
      const passed = 
        total.lines.pct >= thresholds.lines &&
        total.branches.pct >= thresholds.branches &&
        total.functions.pct >= thresholds.functions &&
        total.statements.pct >= thresholds.statements;
      
      if (passed) {
        log('✅ Coverage thresholds met!', COLORS.GREEN);
      } else {
        log('❌ Coverage thresholds not met!', COLORS.RED);
        log(`Expected: ${thresholds.lines}% lines, ${thresholds.branches}% branches, ${thresholds.functions}% functions, ${thresholds.statements}% statements`);
      }
      
    } catch (error) {
      log('⚠️ Error reading coverage report', COLORS.YELLOW);
    }
  }

  async runLintAndFormat() {
    log(colorize('\n🔍 Running Code Quality Checks...\n', COLORS.CYAN));
    
    try {
      // Run ESLint
      await this.runCommand('npx', [
        'eslint',
        'src/renderer/components/**/*.{ts,tsx}',
        'src/services/ValidationService.ts',
        '--fix',
      ]);
      log('✅ ESLint passed!', COLORS.GREEN);
      
      // Run Prettier
      await this.runCommand('npx', [
        'prettier',
        '--write',
        'src/renderer/components/**/*.{ts,tsx}',
        'src/services/ValidationService.ts',
      ]);
      log('✅ Prettier formatting completed!', COLORS.GREEN);
      
    } catch (error) {
      log('❌ Code quality checks failed!', COLORS.RED);
    }
  }

  printSummary(failedSuites) {
    log(colorize('\n🏁 Test Summary\n', COLORS.BRIGHT));
    
    const totalSuites = Object.keys(this.testSuites).length;
    const passedSuites = totalSuites - failedSuites.length;
    
    log(`Total Test Suites: ${totalSuites}`);
    log(`Passed: ${colorize(passedSuites, COLORS.GREEN)}`);
    log(`Failed: ${colorize(failedSuites.length, failedSuites.length > 0 ? COLORS.RED : COLORS.GREEN)}`);
    
    if (failedSuites.length > 0) {
      log('\nFailed Suites:', COLORS.RED);
      failedSuites.forEach(suite => {
        log(`  - ${suite}`, COLORS.RED);
      });
    }
    
    if (failedSuites.length === 0) {
      log(colorize('\n🎉 All tests passed! Great job!', COLORS.GREEN));
    } else {
      log(colorize('\n❌ Some tests failed. Please review and fix.', COLORS.RED));
    }
  }

  printHelp() {
    log(colorize('\n📚 Form Test Runner Help\n', COLORS.BRIGHT));
    log('Usage: node scripts/test-forms.js [command] [options]\n');
    
    log(colorize('Commands:', COLORS.CYAN));
    log('  all             Run all test suites');
    log('  unit            Run unit tests');
    log('  component       Run component tests');
    log('  integration     Run integration tests');
    log('  accessibility   Run accessibility tests');
    log('  errorHandling   Run error handling tests');
    log('  persistence     Run persistence tests');
    log('  performance     Run performance tests');
    log('  coverage        Generate coverage report');
    log('  lint            Run code quality checks');
    log('  help            Show this help message\n');
    
    log(colorize('Options:', COLORS.CYAN));
    log('  --watch         Watch for changes');
    log('  --verbose       Verbose output');
    log('  --no-coverage   Skip coverage report');
    log('  --bail          Stop on first failure\n');
    
    log(colorize('Examples:', COLORS.YELLOW));
    log('  node scripts/test-forms.js all');
    log('  node scripts/test-forms.js unit --watch');
    log('  node scripts/test-forms.js accessibility --verbose');
    log('  node scripts/test-forms.js all --no-coverage --bail');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  const options = {
    watch: args.includes('--watch'),
    verbose: args.includes('--verbose'),
    coverage: !args.includes('--no-coverage'),
    bail: args.includes('--bail'),
  };

  const runner = new FormTestRunner();

  try {
    switch (command) {
      case 'help':
      case '--help':
      case '-h':
        runner.printHelp();
        break;
        
      case 'all':
        const success = await runner.runAllTests(options);
        process.exit(success ? 0 : 1);
        break;
        
      case 'accessibility':
        await runner.runAccessibilityTests();
        break;
        
      case 'performance':
        await runner.runPerformanceTests();
        break;
        
      case 'coverage':
        await runner.generateCoverageReport();
        break;
        
      case 'lint':
        await runner.runLintAndFormat();
        break;
        
      default:
        if (runner.testSuites[command]) {
          await runner.runTestSuite(command, options);
        } else {
          log(`Unknown command: ${command}`, COLORS.RED);
          log('Run "node scripts/test-forms.js help" for usage information.', COLORS.YELLOW);
          process.exit(1);
        }
        break;
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, COLORS.RED);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}