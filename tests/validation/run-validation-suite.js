#!/usr/bin/env node

/**
 * Unified Test Runner for Vite + React + Electron Validation
 *
 * This script orchestrates all validation tests:
 * - Dependency validation
 * - Server startup tests
 * - Browser automation tests
 * - Integration validation
 * - Performance benchmarks
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ValidationSuite {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../');
    this.results = {
      nodeTests: { status: 'pending', duration: 0, details: [] },
      browserTests: { status: 'pending', duration: 0, details: [] },
      integrationTests: { status: 'pending', duration: 0, details: [] },
      performanceTests: { status: 'pending', duration: 0, details: [] }
    };
    this.viteServer = null;
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warning: '\x1b[33m', // Yellow
      reset: '\x1b[0m'
    };

    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runValidationSuite() {
    this.log('🚀 Starting Comprehensive Validation Suite', 'info');
    this.log(`📁 Project Root: ${this.projectRoot}`, 'info');

    try {
      // Check prerequisites
      await this.checkPrerequisites();

      // Run test phases
      await this.runNodeTests();
      await this.runBrowserTests();
      await this.runIntegrationTests();
      await this.runPerformanceTests();

      // Generate final report
      await this.generateFinalReport();

      this.log('🎉 All validation tests completed successfully!', 'success');
    } catch (error) {
      this.log(`❌ Validation suite failed: ${error.message}`, 'error');
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async checkPrerequisites() {
    this.log('🔍 Checking Prerequisites...', 'info');

    // Check Node.js version
    const nodeVersion = process.version;
    const nodeVersionNumber = parseInt(nodeVersion.slice(1));
    if (nodeVersionNumber < 18) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
    }

    // Check npm version
    try {
      const { stdout } = await execAsync('npm --version');
      const npmVersion = parseInt(stdout.trim());
      if (npmVersion < 9) {
        this.log(`⚠️  npm version ${npmVersion} detected, 9+ recommended`, 'warning');
      }
    } catch (error) {
      throw new Error('npm not found or not working');
    }

    // Check package.json
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    // Check if node_modules exists, install if not
    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      this.log('📦 Installing dependencies...', 'info');
      await execAsync('npm install', { cwd: this.projectRoot });
    }

    this.log('✅ Prerequisites check passed', 'success');
  }

  async runNodeTests() {
    this.log('🧪 Running Node.js-based Tests...', 'info');
    const startTime = Date.now();

    try {
      // Run comprehensive test plan
      const testPlanPath = path.join(__dirname, 'comprehensive-test-plan.js');
      await this.executeScript(testPlanPath);

      this.results.nodeTests.status = 'passed';
      this.results.nodeTests.details = [
        'Dependency validation passed',
        'File structure validation passed',
        'Configuration validation passed'
      ];

      this.log('✅ Node.js tests completed successfully', 'success');
    } catch (error) {
      this.results.nodeTests.status = 'failed';
      this.results.nodeTests.details = [error.message];
      throw new Error(`Node.js tests failed: ${error.message}`);
    } finally {
      this.results.nodeTests.duration = Date.now() - startTime;
    }
  }

  async runBrowserTests() {
    this.log('🌐 Running Browser Tests...', 'info');
    const startTime = Date.now();

    try {
      // Check if Playwright is available
      try {
        await execAsync('npx playwright --version');
      } catch (error) {
        this.log('⚠️  Playwright not found, installing...', 'warning');
        await execAsync('npm install -D @playwright/test');
        await execAsync('npx playwright install');
      }

      // Run browser validation tests
      const browserTestPath = path.join(__dirname, 'browser-validation.spec.ts');
      const { stdout, stderr } = await execAsync(
        `npx playwright test ${browserTestPath} --reporter=json`,
        { cwd: this.projectRoot }
      );

      // Parse Playwright results
      try {
        const testResults = JSON.parse(stdout);
        const passed = testResults.stats?.passed || 0;
        const failed = testResults.stats?.failed || 0;

        if (failed > 0) {
          throw new Error(`${failed} browser tests failed`);
        }

        this.results.browserTests.status = 'passed';
        this.results.browserTests.details = [
          `${passed} browser tests passed`,
          'Vite server startup validated',
          'React application loading confirmed',
          'UI functionality verified'
        ];
      } catch (parseError) {
        // Fallback: check if tests passed by looking for success indicators
        if (stdout.includes('passed') && !stdout.includes('failed')) {
          this.results.browserTests.status = 'passed';
          this.results.browserTests.details = ['Browser tests completed successfully'];
        } else {
          throw new Error('Browser tests failed or could not parse results');
        }
      }

      this.log('✅ Browser tests completed successfully', 'success');
    } catch (error) {
      this.results.browserTests.status = 'failed';
      this.results.browserTests.details = [error.message];
      this.log(`⚠️  Browser tests failed: ${error.message}`, 'warning');
      // Don't throw - browser tests are important but not critical for basic setup
    } finally {
      this.results.browserTests.duration = Date.now() - startTime;
    }
  }

  async runIntegrationTests() {
    this.log('🔗 Running Integration Tests...', 'info');
    const startTime = Date.now();

    try {
      // Test Vite server startup and shutdown
      await this.testViteServerLifecycle();

      // Test build process
      await this.testBuildProcess();

      // Test TypeScript compilation
      await this.testTypeScriptCompilation();

      this.results.integrationTests.status = 'passed';
      this.results.integrationTests.details = [
        'Vite server lifecycle tested',
        'Build process validated',
        'TypeScript compilation verified'
      ];

      this.log('✅ Integration tests completed successfully', 'success');
    } catch (error) {
      this.results.integrationTests.status = 'failed';
      this.results.integrationTests.details = [error.message];
      throw new Error(`Integration tests failed: ${error.message}`);
    } finally {
      this.results.integrationTests.duration = Date.now() - startTime;
    }
  }

  async runPerformanceTests() {
    this.log('⚡ Running Performance Tests...', 'info');
    const startTime = Date.now();

    try {
      // Test startup time
      const viteStartupTime = await this.measureViteStartupTime();

      // Test build time
      const buildTime = await this.measureBuildTime();

      // Test bundle size
      const bundleSize = await this.measureBundleSize();

      this.results.performanceTests.status = 'passed';
      this.results.performanceTests.details = [
        `Vite startup time: ${viteStartupTime}ms`,
        `Build time: ${buildTime}ms`,
        `Bundle size: ${bundleSize} KB`
      ];

      this.log('✅ Performance tests completed successfully', 'success');
    } catch (error) {
      this.results.performanceTests.status = 'failed';
      this.results.performanceTests.details = [error.message];
      this.log(`⚠️  Performance tests failed: ${error.message}`, 'warning');
      // Don't throw - performance tests are informational
    } finally {
      this.results.performanceTests.duration = Date.now() - startTime;
    }
  }

  async testViteServerLifecycle() {
    this.log('🔄 Testing Vite server lifecycle...', 'info');

    return new Promise((resolve, reject) => {
      let serverStarted = false;
      const timeout = setTimeout(() => {
        if (!serverStarted) {
          if (this.viteServer) this.viteServer.kill();
          reject(new Error('Vite server failed to start within 30 seconds'));
        }
      }, 30000);

      this.viteServer = spawn('npm', ['run', 'dev'], {
        cwd: this.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.viteServer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Local:') && output.includes('3000')) {
          serverStarted = true;
          clearTimeout(timeout);

          // Test server shutdown
          setTimeout(() => {
            this.viteServer.kill();
            this.viteServer = null;
            resolve();
          }, 2000);
        }
      });

      this.viteServer.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Error') && !output.includes('warning')) {
          clearTimeout(timeout);
          this.viteServer.kill();
          reject(new Error(`Vite server error: ${output}`));
        }
      });

      this.viteServer.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async testBuildProcess() {
    this.log('🏗️  Testing build process...', 'info');

    try {
      // Clean previous build
      const distPath = path.join(this.projectRoot, 'dist');
      if (fs.existsSync(distPath)) {
        fs.rmSync(distPath, { recursive: true, force: true });
      }

      // Run build
      await execAsync('npm run build', { cwd: this.projectRoot });

      // Verify build output
      if (!fs.existsSync(distPath)) {
        throw new Error('Build output directory not created');
      }

      const buildFiles = fs.readdirSync(distPath);
      if (buildFiles.length === 0) {
        throw new Error('Build output is empty');
      }

      this.log('✅ Build process validated', 'success');
    } catch (error) {
      throw new Error(`Build process failed: ${error.message}`);
    }
  }

  async testTypeScriptCompilation() {
    this.log('📝 Testing TypeScript compilation...', 'info');

    try {
      await execAsync('npm run typecheck', { cwd: this.projectRoot });
      this.log('✅ TypeScript compilation validated', 'success');
    } catch (error) {
      throw new Error(`TypeScript compilation failed: ${error.message}`);
    }
  }

  async measureViteStartupTime() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let serverStarted = false;

      const timeout = setTimeout(() => {
        if (!serverStarted) {
          if (this.viteServer) this.viteServer.kill();
          reject(new Error('Vite startup measurement timeout'));
        }
      }, 30000);

      this.viteServer = spawn('npm', ['run', 'dev'], {
        cwd: this.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.viteServer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Local:') && output.includes('3000')) {
          serverStarted = true;
          const startupTime = Date.now() - startTime;
          clearTimeout(timeout);

          setTimeout(() => {
            this.viteServer.kill();
            this.viteServer = null;
            resolve(startupTime);
          }, 1000);
        }
      });

      this.viteServer.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async measureBuildTime() {
    const startTime = Date.now();

    try {
      await execAsync('npm run build', { cwd: this.projectRoot });
      return Date.now() - startTime;
    } catch (error) {
      throw new Error(`Build time measurement failed: ${error.message}`);
    }
  }

  async measureBundleSize() {
    const distPath = path.join(this.projectRoot, 'dist');

    if (!fs.existsSync(distPath)) {
      throw new Error('Build output not found for bundle size measurement');
    }

    let totalSize = 0;
    const files = fs.readdirSync(distPath, { recursive: true });

    for (const file of files) {
      const filePath = path.join(distPath, file);
      if (fs.statSync(filePath).isFile()) {
        totalSize += fs.statSync(filePath).size;
      }
    }

    return Math.round(totalSize / 1024); // Return size in KB
  }

  async executeScript(scriptPath) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Script ${path.basename(scriptPath)} exited with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  async cleanup() {
    this.log('🧹 Cleaning up...', 'info');

    if (this.viteServer) {
      this.viteServer.kill();
      this.viteServer = null;
    }

    // Kill any remaining Vite processes
    try {
      await execAsync('pkill -f "vite"').catch(() => {}); // Ignore errors
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async generateFinalReport() {
    this.log('📊 Generating Final Report...', 'info');

    const totalDuration = Date.now() - this.startTime;
    const passed = Object.values(this.results).filter(r => r.status === 'passed').length;
    const failed = Object.values(this.results).filter(r => r.status === 'failed').length;
    const total = Object.keys(this.results).length;

    const report = {
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      summary: {
        total,
        passed,
        failed,
        success: failed === 0
      },
      testPhases: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        projectRoot: this.projectRoot
      }
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'validation-suite-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Console summary
    this.log('\n📋 VALIDATION SUITE SUMMARY', 'info');
    this.log(`Duration: ${Math.round(totalDuration / 1000)}s`, 'info');
    this.log(`Total Phases: ${total}`, 'info');
    this.log(`Passed: ${passed}`, 'success');
    this.log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');

    // Detailed results
    for (const [phase, result] of Object.entries(this.results)) {
      const statusIcon = {
        passed: '✅',
        failed: '❌',
        pending: '⏳'
      }[result.status];

      this.log(`\n${statusIcon} ${phase.toUpperCase()} (${result.duration}ms):`, 'info');
      result.details.forEach(detail => {
        this.log(`  • ${detail}`, 'info');
      });
    }

    this.log(`\n📁 Full report: ${reportPath}`, 'info');

    if (failed > 0) {
      throw new Error(`${failed} test phases failed`);
    }
  }
}

// Export for programmatic use
module.exports = ValidationSuite;

// Run if called directly
if (require.main === module) {
  const suite = new ValidationSuite();
  suite.runValidationSuite().catch(error => {
    console.error('Validation suite failed:', error.message);
    process.exit(1);
  });
}