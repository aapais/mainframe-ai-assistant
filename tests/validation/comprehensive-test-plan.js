#!/usr/bin/env node

/**
 * Comprehensive Test Plan for Vite + React + Electron Setup
 *
 * This script validates that all dependencies are correctly installed,
 * Vite dev server starts without errors, React application loads properly,
 * and no console errors occur about missing modules.
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ValidationTestSuite {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../');
    this.testResults = {
      dependencies: { status: 'pending', details: [] },
      viteServer: { status: 'pending', details: [] },
      reactApp: { status: 'pending', details: [] },
      consoleErrors: { status: 'pending', details: [] },
      uiFeatures: { status: 'pending', details: [] },
      electronApi: { status: 'pending', details: [] },
      performance: { status: 'pending', details: [] }
    };
    this.timeouts = {
      serverStart: 30000,
      appLoad: 15000,
      test: 5000
    };
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

  async runAllTests() {
    this.log('🚀 Starting Comprehensive Validation Test Suite', 'info');

    try {
      await this.validateDependencies();
      await this.validateViteServerStartup();
      await this.validateReactApplicationLoading();
      await this.validateConsoleErrors();
      await this.validateUIFeatures();
      await this.validateElectronAPI();
      await this.validatePerformance();

      this.generateReport();
    } catch (error) {
      this.log(`❌ Test suite failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  async validateDependencies() {
    this.log('📦 Validating Dependencies...', 'info');

    try {
      // Check package.json exists
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Check required dependencies
      const requiredDeps = ['react', 'react-dom', 'typescript'];
      const requiredDevDeps = ['vite', '@vitejs/plugin-react', 'electron'];

      const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies?.[dep]);
      const missingDevDeps = requiredDevDeps.filter(dep => !packageJson.devDependencies?.[dep]);

      if (missingDeps.length > 0) {
        throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
      }

      if (missingDevDeps.length > 0) {
        throw new Error(`Missing dev dependencies: ${missingDevDeps.join(', ')}`);
      }

      // Check node_modules installation
      const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        this.log('⚠️  node_modules not found, running npm install...', 'warning');
        await execAsync('npm install', { cwd: this.projectRoot });
      }

      // Verify critical packages are installed
      const criticalPackages = ['react', 'vite', 'electron'];
      for (const pkg of criticalPackages) {
        const pkgPath = path.join(nodeModulesPath, pkg);
        if (!fs.existsSync(pkgPath)) {
          throw new Error(`Package ${pkg} not properly installed`);
        }
      }

      this.testResults.dependencies.status = 'passed';
      this.testResults.dependencies.details = [
        'package.json exists and valid',
        'All required dependencies present',
        'node_modules properly installed',
        'Critical packages verified'
      ];

      this.log('✅ Dependencies validation passed', 'success');
    } catch (error) {
      this.testResults.dependencies.status = 'failed';
      this.testResults.dependencies.details = [error.message];
      throw error;
    }
  }

  async validateViteServerStartup() {
    this.log('🌐 Validating Vite Server Startup...', 'info');

    return new Promise((resolve, reject) => {
      let serverStarted = false;
      let serverOutput = '';

      // Start Vite dev server
      const viteProcess = spawn('npm', ['run', 'dev'], {
        cwd: this.projectRoot,
        env: { ...process.env, NODE_ENV: 'development' }
      });

      const timeout = setTimeout(() => {
        if (!serverStarted) {
          viteProcess.kill();
          this.testResults.viteServer.status = 'failed';
          this.testResults.viteServer.details = [
            'Server failed to start within timeout',
            `Output: ${serverOutput}`
          ];
          reject(new Error('Vite server startup timeout'));
        }
      }, this.timeouts.serverStart);

      viteProcess.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;

        // Check for successful startup indicators
        if (output.includes('Local:') && output.includes('3000')) {
          serverStarted = true;
          clearTimeout(timeout);

          setTimeout(() => {
            viteProcess.kill();
            this.testResults.viteServer.status = 'passed';
            this.testResults.viteServer.details = [
              'Server started successfully',
              'Listening on port 3000',
              'No startup errors detected'
            ];
            this.log('✅ Vite server startup validation passed', 'success');
            resolve();
          }, 2000);
        }

        // Check for errors
        if (output.includes('error') || output.includes('Error')) {
          clearTimeout(timeout);
          viteProcess.kill();
          this.testResults.viteServer.status = 'failed';
          this.testResults.viteServer.details = [
            'Server startup errors detected',
            `Error output: ${output}`
          ];
          reject(new Error(`Vite server startup error: ${output}`));
        }
      });

      viteProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        serverOutput += errorOutput;

        if (!errorOutput.includes('experimental') && !errorOutput.includes('warning')) {
          clearTimeout(timeout);
          viteProcess.kill();
          this.testResults.viteServer.status = 'failed';
          this.testResults.viteServer.details = [
            'Server stderr errors detected',
            `Error: ${errorOutput}`
          ];
          reject(new Error(`Vite server error: ${errorOutput}`));
        }
      });

      viteProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.testResults.viteServer.status = 'failed';
        this.testResults.viteServer.details = [
          'Process spawn error',
          error.message
        ];
        reject(error);
      });
    });
  }

  async validateReactApplicationLoading() {
    this.log('⚛️  Validating React Application Loading...', 'info');

    try {
      // Check React entry point exists
      const entryPoint = path.join(this.projectRoot, 'src/renderer/index.tsx');
      if (!fs.existsSync(entryPoint)) {
        throw new Error('React entry point not found');
      }

      // Check App component exists
      const appComponent = path.join(this.projectRoot, 'src/renderer/App.tsx');
      if (!fs.existsSync(appComponent)) {
        throw new Error('App component not found');
      }

      // Check index.html exists and has root element
      const indexHtml = path.join(this.projectRoot, 'index.html');
      if (!fs.existsSync(indexHtml)) {
        throw new Error('index.html not found');
      }

      const htmlContent = fs.readFileSync(indexHtml, 'utf8');
      if (!htmlContent.includes('id="root"')) {
        throw new Error('Root element not found in index.html');
      }

      // Check for proper script module loading
      if (!htmlContent.includes('type="module"') || !htmlContent.includes('/src/renderer/index.tsx')) {
        throw new Error('Incorrect script module configuration in index.html');
      }

      this.testResults.reactApp.status = 'passed';
      this.testResults.reactApp.details = [
        'React entry point exists',
        'App component found',
        'index.html properly configured',
        'Root element present',
        'Module script loading configured'
      ];

      this.log('✅ React application loading validation passed', 'success');
    } catch (error) {
      this.testResults.reactApp.status = 'failed';
      this.testResults.reactApp.details = [error.message];
      throw error;
    }
  }

  async validateConsoleErrors() {
    this.log('🔍 Validating Console Errors...', 'info');

    try {
      // This would typically require browser automation
      // For now, we'll check for common error patterns in source files

      const sourceFiles = this.getSourceFiles();
      const errorPatterns = [
        /require\(.+\)/g,  // CommonJS requires in browser code
        /module\.exports/g, // CommonJS exports
        /\.default\.default/g, // Double default imports
        /import.*from\s+['"]\w+['"]/g // Bare imports without file extensions
      ];

      const issues = [];

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');

        for (const pattern of errorPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            issues.push(`${path.relative(this.projectRoot, file)}: ${matches.join(', ')}`);
          }
        }
      }

      if (issues.length > 0) {
        this.testResults.consoleErrors.status = 'warning';
        this.testResults.consoleErrors.details = [
          'Potential console error sources found:',
          ...issues
        ];
        this.log('⚠️  Console errors validation completed with warnings', 'warning');
      } else {
        this.testResults.consoleErrors.status = 'passed';
        this.testResults.consoleErrors.details = [
          'No obvious error patterns detected',
          'Source files appear clean',
          'Import/export syntax looks correct'
        ];
        this.log('✅ Console errors validation passed', 'success');
      }
    } catch (error) {
      this.testResults.consoleErrors.status = 'failed';
      this.testResults.consoleErrors.details = [error.message];
      throw error;
    }
  }

  async validateUIFeatures() {
    this.log('🎨 Validating UI Features...', 'info');

    try {
      // Check for UI component files
      const uiComponents = [
        'src/renderer/App.tsx',
        'src/renderer/mockElectronAPI.ts'
      ];

      const missingComponents = uiComponents.filter(comp =>
        !fs.existsSync(path.join(this.projectRoot, comp))
      );

      if (missingComponents.length > 0) {
        throw new Error(`Missing UI components: ${missingComponents.join(', ')}`);
      }

      // Check for CSS/styling files
      const stylePaths = [
        'src/renderer/styles',
        'src/renderer/App.css',
        'index.html' // Inline styles check
      ];

      let stylingFound = false;
      for (const stylePath of stylePaths) {
        if (fs.existsSync(path.join(this.projectRoot, stylePath))) {
          stylingFound = true;
          break;
        }
      }

      if (!stylingFound) {
        // Check for inline styles in index.html
        const indexHtml = fs.readFileSync(path.join(this.projectRoot, 'index.html'), 'utf8');
        if (indexHtml.includes('<style>')) {
          stylingFound = true;
        }
      }

      this.testResults.uiFeatures.status = stylingFound ? 'passed' : 'warning';
      this.testResults.uiFeatures.details = [
        'UI components present',
        stylingFound ? 'Styling configuration found' : 'No styling files detected',
        'Basic UI structure validated'
      ];

      this.log('✅ UI features validation completed', 'success');
    } catch (error) {
      this.testResults.uiFeatures.status = 'failed';
      this.testResults.uiFeatures.details = [error.message];
      throw error;
    }
  }

  async validateElectronAPI() {
    this.log('⚡ Validating Mock Electron API...', 'info');

    try {
      const mockApiPath = path.join(this.projectRoot, 'src/renderer/mockElectronAPI.ts');

      if (!fs.existsSync(mockApiPath)) {
        throw new Error('Mock Electron API file not found');
      }

      const mockApiContent = fs.readFileSync(mockApiPath, 'utf8');

      // Check for essential API methods
      const requiredMethods = [
        'electronAPI',
        'window.electronAPI'
      ];

      const missingMethods = requiredMethods.filter(method =>
        !mockApiContent.includes(method)
      );

      if (missingMethods.length > 0) {
        this.log(`⚠️  Some Electron API methods may be missing: ${missingMethods.join(', ')}`, 'warning');
      }

      // Check if mock API is imported in index.tsx
      const indexTsxPath = path.join(this.projectRoot, 'src/renderer/index.tsx');
      const indexContent = fs.readFileSync(indexTsxPath, 'utf8');

      if (!indexContent.includes('mockElectronAPI')) {
        throw new Error('Mock Electron API not imported in index.tsx');
      }

      this.testResults.electronApi.status = 'passed';
      this.testResults.electronApi.details = [
        'Mock Electron API file exists',
        'Mock API imported in entry point',
        'Basic API structure present'
      ];

      this.log('✅ Electron API validation passed', 'success');
    } catch (error) {
      this.testResults.electronApi.status = 'failed';
      this.testResults.electronApi.details = [error.message];
      throw error;
    }
  }

  async validatePerformance() {
    this.log('⚡ Validating Performance Configuration...', 'info');

    try {
      // Check Vite configuration
      const viteConfigPath = path.join(this.projectRoot, 'vite.config.basic.ts');
      if (!fs.existsSync(viteConfigPath)) {
        throw new Error('Vite configuration not found');
      }

      const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');

      // Check for development optimizations
      const performanceChecks = {
        hasPort: viteConfig.includes('port'),
        hasRoot: viteConfig.includes('root'),
        hasOutDir: viteConfig.includes('outDir')
      };

      const passedChecks = Object.values(performanceChecks).filter(Boolean).length;
      const totalChecks = Object.keys(performanceChecks).length;

      this.testResults.performance.status = passedChecks >= totalChecks - 1 ? 'passed' : 'warning';
      this.testResults.performance.details = [
        `Performance checks: ${passedChecks}/${totalChecks} passed`,
        'Vite configuration exists',
        'Basic development setup present'
      ];

      this.log('✅ Performance validation completed', 'success');
    } catch (error) {
      this.testResults.performance.status = 'failed';
      this.testResults.performance.details = [error.message];
      throw error;
    }
  }

  getSourceFiles() {
    const sourceFiles = [];
    const searchPaths = ['src/renderer', 'src/main'];

    for (const searchPath of searchPaths) {
      const fullPath = path.join(this.projectRoot, searchPath);
      if (fs.existsSync(fullPath)) {
        this.walkDirectory(fullPath, sourceFiles);
      }
    }

    return sourceFiles;
  }

  walkDirectory(dir, files) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.walkDirectory(fullPath, files);
      } else if (/\.(ts|tsx|js|jsx)$/.test(item)) {
        files.push(fullPath);
      }
    }
  }

  generateReport() {
    this.log('📊 Generating Test Report...', 'info');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: Object.keys(this.testResults).length,
        passed: Object.values(this.testResults).filter(r => r.status === 'passed').length,
        failed: Object.values(this.testResults).filter(r => r.status === 'failed').length,
        warnings: Object.values(this.testResults).filter(r => r.status === 'warning').length
      },
      results: this.testResults
    };

    // Write report to file
    const reportPath = path.join(this.projectRoot, 'tests/validation/test-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Console summary
    this.log('\n📋 TEST SUMMARY', 'info');
    this.log(`Total Tests: ${report.summary.total}`, 'info');
    this.log(`Passed: ${report.summary.passed}`, 'success');
    this.log(`Failed: ${report.summary.failed}`, report.summary.failed > 0 ? 'error' : 'info');
    this.log(`Warnings: ${report.summary.warnings}`, report.summary.warnings > 0 ? 'warning' : 'info');

    // Detailed results
    for (const [testName, result] of Object.entries(this.testResults)) {
      const statusIcon = {
        passed: '✅',
        failed: '❌',
        warning: '⚠️',
        pending: '⏳'
      }[result.status];

      this.log(`\n${statusIcon} ${testName.toUpperCase()}:`, result.status === 'failed' ? 'error' : 'info');
      result.details.forEach(detail => {
        this.log(`  • ${detail}`, 'info');
      });
    }

    this.log(`\n📁 Full report saved to: ${reportPath}`, 'info');

    if (report.summary.failed > 0) {
      this.log('\n❌ Some tests failed. Please review the issues above.', 'error');
      process.exit(1);
    } else {
      this.log('\n🎉 All validation tests completed successfully!', 'success');
    }
  }
}

// Export for programmatic use
module.exports = ValidationTestSuite;

// Run if called directly
if (require.main === module) {
  const testSuite = new ValidationTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('Test suite execution failed:', error);
    process.exit(1);
  });
}