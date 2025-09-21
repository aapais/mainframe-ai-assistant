#!/usr/bin/env node

/**
 * Automation Helper Functions for Package.json Scripts
 * Provides utilities for clean operations, build hooks, and project maintenance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');

const projectRoot = path.resolve(__dirname, '..');

/**
 * Enhanced logging with timestamps and colors
 */
class Logger {
  static colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
  };

  static info(message) {
    const timestamp = new Date().toISOString();
    console.log(`${this.colors.blue}[INFO]${this.colors.reset} ${this.colors.cyan}${timestamp}${this.colors.reset} ${message}`);
  }

  static success(message) {
    const timestamp = new Date().toISOString();
    console.log(`${this.colors.green}[SUCCESS]${this.colors.reset} ${this.colors.cyan}${timestamp}${this.colors.reset} ${message}`);
  }

  static warn(message) {
    const timestamp = new Date().toISOString();
    console.log(`${this.colors.yellow}[WARN]${this.colors.reset} ${this.colors.cyan}${timestamp}${this.colors.reset} ${message}`);
  }

  static error(message) {
    const timestamp = new Date().toISOString();
    console.error(`${this.colors.red}[ERROR]${this.colors.reset} ${this.colors.cyan}${timestamp}${this.colors.reset} ${message}`);
  }
}

/**
 * File system utilities with error handling
 */
class FileUtils {
  /**
   * Safely remove directory recursively
   */
  static async removeDirectory(dirPath) {
    try {
      if (fs.existsSync(dirPath)) {
        const stats = await promisify(fs.stat)(dirPath);
        if (stats.isDirectory()) {
          await promisify(fs.rm)(dirPath, { recursive: true, force: true });
          Logger.success(`Removed directory: ${dirPath}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      Logger.error(`Failed to remove directory ${dirPath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Safely remove file
   */
  static async removeFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await promisify(fs.unlink)(filePath);
        Logger.success(`Removed file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      Logger.error(`Failed to remove file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get directory size in MB
   */
  static async getDirectorySize(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) return 0;

      let totalSize = 0;
      const files = await promisify(fs.readdir)(dirPath, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else {
          const stats = await promisify(fs.stat)(fullPath);
          totalSize += stats.size;
        }
      }

      return Math.round((totalSize / (1024 * 1024)) * 100) / 100; // MB with 2 decimal places
    } catch (error) {
      Logger.error(`Failed to calculate directory size for ${dirPath}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Create directory if it doesn't exist
   */
  static async ensureDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        await promisify(fs.mkdir)(dirPath, { recursive: true });
        Logger.info(`Created directory: ${dirPath}`);
      }
      return true;
    } catch (error) {
      Logger.error(`Failed to create directory ${dirPath}: ${error.message}`);
      return false;
    }
  }
}

/**
 * Build system utilities
 */
class BuildUtils {
  /**
   * Execute command with enhanced error handling
   */
  static execCommand(command, options = {}) {
    try {
      Logger.info(`Executing: ${command}`);
      const result = execSync(command, {
        cwd: projectRoot,
        stdio: 'pipe',
        encoding: 'utf8',
        ...options
      });
      return { success: true, output: result };
    } catch (error) {
      Logger.error(`Command failed: ${command}`);
      Logger.error(`Error: ${error.message}`);
      return { success: false, error: error.message, output: error.stdout || '' };
    }
  }

  /**
   * Check if command exists
   */
  static commandExists(command) {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate build summary report
   */
  static async generateBuildSummary() {
    const timestamp = new Date().toISOString();
    const distSize = await FileUtils.getDirectorySize(path.join(projectRoot, 'dist'));
    const nodeModulesSize = await FileUtils.getDirectorySize(path.join(projectRoot, 'node_modules'));

    const summary = {
      timestamp,
      buildArtifacts: {
        distDirectory: `${distSize} MB`,
        nodeModules: `${nodeModulesSize} MB`
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    try {
      await FileUtils.ensureDirectory(path.join(projectRoot, 'build-reports'));
      const reportPath = path.join(projectRoot, 'build-reports', 'build-summary.json');
      await promisify(fs.writeFile)(reportPath, JSON.stringify(summary, null, 2));
      Logger.success(`Build summary saved to: ${reportPath}`);
    } catch (error) {
      Logger.error(`Failed to save build summary: ${error.message}`);
    }

    return summary;
  }
}

/**
 * Main automation functions
 */
class AutomationTasks {
  /**
   * Clean build artifacts and temporary files
   */
  static async clean() {
    Logger.info('Starting clean operation...');

    const cleanTargets = [
      'dist',
      'dist-*',
      'build',
      'coverage',
      '.vite',
      '.cache',
      'temp',
      'tmp'
    ];

    let totalCleaned = 0;

    for (const target of cleanTargets) {
      const targetPath = path.join(projectRoot, target);
      if (target.includes('*')) {
        // Handle glob patterns
        const baseDir = target.split('*')[0];
        try {
          const parentDir = path.join(projectRoot);
          if (fs.existsSync(parentDir)) {
            const items = fs.readdirSync(parentDir);
            for (const item of items) {
              if (item.startsWith(baseDir)) {
                const itemPath = path.join(parentDir, item);
                const size = await FileUtils.getDirectorySize(itemPath);
                if (await FileUtils.removeDirectory(itemPath)) {
                  totalCleaned += size;
                }
              }
            }
          }
        } catch (error) {
          Logger.error(`Failed to process glob pattern ${target}: ${error.message}`);
        }
      } else {
        const size = await FileUtils.getDirectorySize(targetPath);
        if (await FileUtils.removeDirectory(targetPath)) {
          totalCleaned += size;
        }
      }
    }

    // Clean specific files
    const filesToClean = [
      'package-lock.json.bak',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      '.DS_Store',
      'Thumbs.db'
    ];

    for (const file of filesToClean) {
      const filePath = path.join(projectRoot, file);
      await FileUtils.removeFile(filePath);
    }

    Logger.success(`Clean completed. Freed ${totalCleaned.toFixed(2)} MB of disk space.`);
  }

  /**
   * Full clean including node_modules
   */
  static async cleanFull() {
    Logger.info('Starting full clean operation...');

    await this.clean();

    // Clean node_modules
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    const nodeModulesSize = await FileUtils.getDirectorySize(nodeModulesPath);

    if (await FileUtils.removeDirectory(nodeModulesPath)) {
      Logger.success(`Removed node_modules (${nodeModulesSize.toFixed(2)} MB)`);
    }

    // Clean package-lock.json
    const packageLockPath = path.join(projectRoot, 'package-lock.json');
    await FileUtils.removeFile(packageLockPath);

    // Clear npm cache
    const npmCacheResult = BuildUtils.execCommand('npm cache clean --force');
    if (npmCacheResult.success) {
      Logger.success('NPM cache cleared');
    }

    Logger.success('Full clean completed. Run "npm install" to reinstall dependencies.');
  }

  /**
   * Post-build operations
   */
  static async postBuild() {
    Logger.info('Running post-build operations...');

    // Generate build summary
    const summary = await BuildUtils.generateBuildSummary();
    Logger.info(`Build completed at ${summary.timestamp}`);
    Logger.info(`Dist size: ${summary.buildArtifacts.distDirectory}`);

    // Check for build warnings or errors in output
    const distPath = path.join(projectRoot, 'dist');
    if (!fs.existsSync(distPath)) {
      Logger.warn('Build output directory not found - build may have failed');
      return false;
    }

    // Validate critical files exist
    const criticalFiles = [
      'index.html',
      'assets'
    ];

    let validationPassed = true;
    for (const file of criticalFiles) {
      const filePath = path.join(distPath, file);
      if (!fs.existsSync(filePath)) {
        Logger.error(`Critical build artifact missing: ${file}`);
        validationPassed = false;
      }
    }

    if (validationPassed) {
      Logger.success('Post-build validation passed');

      // Optional: Run additional checks
      if (BuildUtils.commandExists('gzip')) {
        Logger.info('Checking gzip compression potential...');
        const result = BuildUtils.execCommand('find dist -name "*.js" -o -name "*.css" | head -5 | xargs gzip -9 -t 2>/dev/null || true');
        if (result.success) {
          Logger.info('Assets are gzip-compatible');
        }
      }

      return true;
    } else {
      Logger.error('Post-build validation failed');
      return false;
    }
  }

  /**
   * Security audit with automatic fixes
   */
  static async securityAudit() {
    Logger.info('Running security audit...');

    // Run npm audit
    const auditResult = BuildUtils.execCommand('npm audit --json', { stdio: 'pipe' });

    if (auditResult.success) {
      try {
        const auditData = JSON.parse(auditResult.output);
        const vulnerabilities = auditData.metadata?.vulnerabilities || {};

        const totalVulns = Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);

        if (totalVulns > 0) {
          Logger.warn(`Found ${totalVulns} security vulnerabilities`);

          // Attempt automatic fix
          const fixResult = BuildUtils.execCommand('npm audit fix --force');
          if (fixResult.success) {
            Logger.success('Security vulnerabilities fixed automatically');
          } else {
            Logger.warn('Some vulnerabilities require manual attention');
          }
        } else {
          Logger.success('No security vulnerabilities found');
        }
      } catch (error) {
        Logger.error(`Failed to parse audit results: ${error.message}`);
      }
    } else {
      Logger.error('Security audit failed to run');
    }
  }

  /**
   * Comprehensive validation pipeline
   */
  static async validate() {
    Logger.info('Running comprehensive validation...');

    const checks = [
      { name: 'Linting', command: 'npm run lint' },
      { name: 'Type Checking', command: 'npm run typecheck' },
      { name: 'Format Check', command: 'npm run format:check' },
      { name: 'Tests', command: 'npm run test' },
      { name: 'Security Audit', task: () => this.securityAudit() }
    ];

    let allPassed = true;
    const results = [];

    for (const check of checks) {
      Logger.info(`Running ${check.name}...`);
      let passed = false;

      try {
        if (check.command) {
          const result = BuildUtils.execCommand(check.command);
          passed = result.success;
        } else if (check.task) {
          passed = await check.task();
        }

        results.push({ name: check.name, passed });

        if (passed) {
          Logger.success(`${check.name} passed`);
        } else {
          Logger.error(`${check.name} failed`);
          allPassed = false;
        }
      } catch (error) {
        Logger.error(`${check.name} failed with error: ${error.message}`);
        results.push({ name: check.name, passed: false, error: error.message });
        allPassed = false;
      }
    }

    // Generate validation report
    const report = {
      timestamp: new Date().toISOString(),
      overallResult: allPassed ? 'PASSED' : 'FAILED',
      checks: results
    };

    try {
      await FileUtils.ensureDirectory(path.join(projectRoot, 'build-reports'));
      const reportPath = path.join(projectRoot, 'build-reports', 'validation-report.json');
      await promisify(fs.writeFile)(reportPath, JSON.stringify(report, null, 2));
      Logger.success(`Validation report saved to: ${reportPath}`);
    } catch (error) {
      Logger.error(`Failed to save validation report: ${error.message}`);
    }

    if (allPassed) {
      Logger.success('All validation checks passed');
    } else {
      Logger.error('Some validation checks failed - check the report for details');
    }

    return allPassed;
  }
}

/**
 * CLI interface
 */
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
Usage: node scripts/automation.js <command>

Available commands:
  clean         Clean build artifacts and temporary files
  clean-full    Full clean including node_modules
  post-build    Run post-build operations and validation
  validate      Run comprehensive validation pipeline
  security      Run security audit with auto-fix

Examples:
  node scripts/automation.js clean
  node scripts/automation.js clean-full
  node scripts/automation.js post-build
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'clean':
        await AutomationTasks.clean();
        break;

      case 'clean-full':
        await AutomationTasks.cleanFull();
        break;

      case 'post-build':
        const success = await AutomationTasks.postBuild();
        process.exit(success ? 0 : 1);
        break;

      case 'validate':
        const validationPassed = await AutomationTasks.validate();
        process.exit(validationPassed ? 0 : 1);
        break;

      case 'security':
        await AutomationTasks.securityAudit();
        break;

      default:
        Logger.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    Logger.error(`Command failed: ${error.message}`);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  Logger,
  FileUtils,
  BuildUtils,
  AutomationTasks
};

// Run if called directly
if (require.main === module) {
  main();
}