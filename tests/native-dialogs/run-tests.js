#!/usr/bin/env node

/**
 * Test runner for native dialog tests
 * Provides convenient commands for running dialog tests in various configurations
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const TEST_DIR = path.join(__dirname);
const JEST_CONFIG = path.join(TEST_DIR, 'jest.config.js');
const COVERAGE_DIR = path.join(process.cwd(), 'coverage', 'native-dialogs');

// Color codes for output
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

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader() {
  log('cyan', '\n' + '='.repeat(60));
  log('cyan', '               NATIVE DIALOG TESTS');
  log('cyan', '='.repeat(60));
}

function printUsage() {
  log('yellow', '\nUsage: node run-tests.js [command] [options]');
  log('white', '\nCommands:');
  log('green', '  all           Run all dialog tests');
  log('green', '  file          Run file dialog tests only');
  log('green', '  message       Run message dialog tests only');
  log('green', '  confirmation  Run confirmation dialog tests only');
  log('green', '  custom        Run custom dialog tests only');
  log('green', '  cancellation  Run dialog cancellation tests only');
  log('green', '  progress      Run progress dialog tests only');
  log('green', '  integration   Run integration tests only');
  log('green', '  watch         Run tests in watch mode');
  log('green', '  coverage      Run tests with coverage report');
  log('green', '  ci            Run tests in CI mode (no watch, coverage)');
  log('green', '  clean         Clean coverage and temp files');
  log('green', '  help          Show this help message');

  log('white', '\nOptions:');
  log('blue', '  --verbose     Verbose output');
  log('blue', '  --silent      Minimal output');
  log('blue', '  --timeout N   Set test timeout (default: 30000ms)');
  log('blue', '  --maxWorkers N Set max worker processes');
  log('blue', '  --bail        Stop on first test failure');
}

function runJest(testPattern, options = {}) {
  return new Promise((resolve, reject) => {
    const jestArgs = [
      '--config', JEST_CONFIG,
      '--testPathPattern', testPattern,
      '--detectOpenHandles',
      '--forceExit'
    ];

    // Add options
    if (options.coverage) {
      jestArgs.push('--coverage');
    }

    if (options.watch) {
      jestArgs.push('--watch');
    }

    if (options.ci) {
      jestArgs.push('--ci', '--watchAll=false');
    }

    if (options.verbose) {
      jestArgs.push('--verbose');
    }

    if (options.silent) {
      jestArgs.push('--silent');
    }

    if (options.timeout) {
      jestArgs.push('--testTimeout', options.timeout);
    }

    if (options.maxWorkers) {
      jestArgs.push('--maxWorkers', options.maxWorkers);
    }

    if (options.bail) {
      jestArgs.push('--bail');
    }

    log('blue', `\nRunning: npx jest ${jestArgs.join(' ')}`);

    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    jest.on('close', (code) => {
      if (code === 0) {
        log('green', '\n✅ Tests completed successfully!');
        resolve(code);
      } else {
        log('red', '\n❌ Tests failed!');
        reject(new Error(`Jest exited with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      log('red', `\n❌ Error running tests: ${error.message}`);
      reject(error);
    });
  });
}

async function cleanFiles() {
  log('yellow', '\n🧹 Cleaning up files...');

  const dirsToClean = [
    COVERAGE_DIR,
    path.join(TEST_DIR, 'temp'),
    path.join(process.cwd(), 'node_modules/.cache/jest')
  ];

  for (const dir of dirsToClean) {
    try {
      if (fs.existsSync(dir)) {
        await fs.promises.rmdir(dir, { recursive: true });
        log('green', `  ✓ Cleaned ${dir}`);
      }
    } catch (error) {
      log('yellow', `  ⚠ Could not clean ${dir}: ${error.message}`);
    }
  }

  log('green', '\n✅ Cleanup completed!');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const options = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--verbose':
        options.verbose = true;
        break;
      case '--silent':
        options.silent = true;
        break;
      case '--bail':
        options.bail = true;
        break;
      case '--timeout':
        options.timeout = args[++i];
        break;
      case '--maxWorkers':
        options.maxWorkers = args[++i];
        break;
    }
  }

  printHeader();

  try {
    switch (command) {
      case 'all':
        log('bright', '\n🚀 Running all native dialog tests...');
        await runJest('native-dialogs', { ...options, coverage: true });
        break;

      case 'file':
        log('bright', '\n📁 Running file dialog tests...');
        await runJest('file-dialogs.test', options);
        break;

      case 'message':
        log('bright', '\n💬 Running message dialog tests...');
        await runJest('message-dialogs.test', options);
        break;

      case 'confirmation':
        log('bright', '\n❓ Running confirmation dialog tests...');
        await runJest('confirmation-dialogs.test', options);
        break;

      case 'custom':
        log('bright', '\n🎨 Running custom dialog tests...');
        await runJest('custom-dialogs.test', options);
        break;

      case 'cancellation':
        log('bright', '\n🚫 Running dialog cancellation tests...');
        await runJest('dialog-cancellation.test', options);
        break;

      case 'progress':
        log('bright', '\n⏳ Running progress dialog tests...');
        await runJest('progress-dialogs.test', options);
        break;

      case 'integration':
        log('bright', '\n🔗 Running integration tests...');
        await runJest('index.test', options);
        break;

      case 'watch':
        log('bright', '\n👁️ Running tests in watch mode...');
        await runJest('native-dialogs', { ...options, watch: true });
        break;

      case 'coverage':
        log('bright', '\n📊 Running tests with coverage...');
        await runJest('native-dialogs', { ...options, coverage: true });

        // Open coverage report if available
        const coverageReport = path.join(COVERAGE_DIR, 'html-report', 'index.html');
        if (fs.existsSync(coverageReport)) {
          log('cyan', `\n📈 Coverage report: ${coverageReport}`);
        }
        break;

      case 'ci':
        log('bright', '\n🤖 Running tests in CI mode...');
        await runJest('native-dialogs', {
          ...options,
          ci: true,
          coverage: true,
          bail: true,
          maxWorkers: '50%'
        });
        break;

      case 'clean':
        await cleanFiles();
        break;

      case 'help':
      default:
        printUsage();
        break;
    }
  } catch (error) {
    log('red', `\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('yellow', '\n\n⚠️  Tests interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('yellow', '\n\n⚠️  Tests terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    log('red', `\n❌ Unexpected error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runJest, cleanFiles };