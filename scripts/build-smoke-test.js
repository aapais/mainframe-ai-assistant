#!/usr/bin/env node

/**
 * Build Smoke Test Script
 *
 * Quick validation tests to verify basic build functionality
 * Designed for fast CI/CD pipeline checks
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class BuildSmokeTest {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.buildDir = options.buildDir || path.join(this.projectRoot, 'dist');
    this.timeout = options.timeout || 60000; // 1 minute
    this.verbose = options.verbose || false;
    this.results = [];
  }

  log(message, type = 'info') {
    if (this.verbose || type === 'error') {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
      console.log(`[${timestamp}] ${prefix} ${message}`);
    }
  }

  async runTest(name, testFn) {
    const startTime = Date.now();

    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, status: 'PASS', duration });
      this.log(`${name}: PASS (${duration}ms)`, 'success');
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({ name, status: 'FAIL', duration, error: error.message });
      this.log(`${name}: FAIL - ${error.message}`, 'error');
      return false;
    }
  }

  async testBuildDirectoryExists() {
    const exists = await fs.access(this.buildDir).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`Build directory does not exist: ${this.buildDir}`);
    }

    const stats = await fs.stat(this.buildDir);
    if (!stats.isDirectory()) {
      throw new Error('Build path is not a directory');
    }
  }

  async testRequiredFilesExist() {
    const requiredFiles = [
      'index.html',
      'assets'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.buildDir, file);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);

      if (!exists) {
        throw new Error(`Required file/directory missing: ${file}`);
      }
    }
  }

  async testHtmlBasicStructure() {
    const indexPath = path.join(this.buildDir, 'index.html');
    const content = await fs.readFile(indexPath, 'utf-8');

    const requiredElements = [
      '<!DOCTYPE html>',
      '<html',
      '<head>',
      '</head>',
      '<body>',
      '</body>',
      '</html>'
    ];

    for (const element of requiredElements) {
      if (!content.includes(element)) {
        throw new Error(`Missing HTML element: ${element}`);
      }
    }

    // Check for meta charset
    if (!content.match(/<meta\s+charset=["']utf-8["']/i)) {
      throw new Error('Missing UTF-8 charset declaration');
    }
  }

  async testJsBundlesExist() {
    const assetsDir = path.join(this.buildDir, 'assets');

    try {
      const files = await fs.readdir(assetsDir);
      const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

      if (jsFiles.length === 0) {
        throw new Error('No JavaScript bundles found');
      }

      // Check that JS files have content
      for (const jsFile of jsFiles.slice(0, 3)) { // Check first 3 files
        const filePath = path.join(assetsDir, jsFile);
        const stats = await fs.stat(filePath);

        if (stats.size === 0) {
          throw new Error(`Empty JavaScript bundle: ${jsFile}`);
        }

        if (stats.size < 100) {
          throw new Error(`Suspiciously small JavaScript bundle: ${jsFile} (${stats.size} bytes)`);
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Assets directory does not exist');
      }
      throw error;
    }
  }

  async testCssBundlesExist() {
    const assetsDir = path.join(this.buildDir, 'assets');

    try {
      const files = await fs.readdir(assetsDir);
      const cssFiles = files.filter(f => f.endsWith('.css') && !f.includes('.map'));

      // CSS might be optional in some projects
      if (cssFiles.length > 0) {
        // If CSS files exist, check they have content
        for (const cssFile of cssFiles.slice(0, 2)) { // Check first 2 files
          const filePath = path.join(assetsDir, cssFile);
          const stats = await fs.stat(filePath);

          if (stats.size === 0) {
            throw new Error(`Empty CSS bundle: ${cssFile}`);
          }
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Assets directory does not exist');
      }
      throw error;
    }
  }

  async testAssetReferences() {
    const indexPath = path.join(this.buildDir, 'index.html');
    const content = await fs.readFile(indexPath, 'utf-8');

    // Extract asset references
    const scriptSources = [...content.matchAll(/src=["']([^"']+\.js)["']/g)].map(m => m[1]);
    const linkHrefs = [...content.matchAll(/href=["']([^"']+\.css)["']/g)].map(m => m[1]);

    // Check that referenced assets exist
    const allReferences = [...scriptSources, ...linkHrefs];

    for (const ref of allReferences) {
      if (!ref.startsWith('http') && !ref.startsWith('//')) {
        const assetPath = path.join(this.buildDir, ref.replace(/^\//, ''));
        const exists = await fs.access(assetPath).then(() => true).catch(() => false);

        if (!exists) {
          throw new Error(`Referenced asset not found: ${ref}`);
        }
      }
    }

    if (scriptSources.length === 0) {
      throw new Error('No JavaScript references found in HTML');
    }
  }

  async testBundleSizes() {
    const assetsDir = path.join(this.buildDir, 'assets');
    const files = await fs.readdir(assetsDir);

    let totalSize = 0;
    const maxIndividualSize = 20 * 1024 * 1024; // 20MB per file
    const maxTotalSize = 100 * 1024 * 1024; // 100MB total

    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        const filePath = path.join(assetsDir, file);
        const stats = await fs.stat(filePath);

        if (stats.size > maxIndividualSize) {
          throw new Error(`Bundle too large: ${file} (${Math.round(stats.size / 1024 / 1024)}MB)`);
        }

        totalSize += stats.size;
      }
    }

    if (totalSize > maxTotalSize) {
      throw new Error(`Total bundle size too large: ${Math.round(totalSize / 1024 / 1024)}MB`);
    }
  }

  async testNoSyntaxErrors() {
    const assetsDir = path.join(this.buildDir, 'assets');
    const files = await fs.readdir(assetsDir);

    const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

    for (const jsFile of jsFiles.slice(0, 3)) { // Check first 3 JS files
      const filePath = path.join(assetsDir, jsFile);
      const content = await fs.readFile(filePath, 'utf-8');

      // Basic syntax error detection
      const errorPatterns = [
        'SyntaxError',
        'Unexpected token',
        'Uncaught ReferenceError',
        'Parse error'
      ];

      for (const pattern of errorPatterns) {
        if (content.includes(pattern)) {
          throw new Error(`Syntax error pattern found in ${jsFile}: ${pattern}`);
        }
      }

      // Very basic structure check
      if (!content.includes('{') || !content.includes('}')) {
        throw new Error(`Invalid JavaScript structure in ${jsFile}`);
      }
    }
  }

  async testFaviconExists() {
    const possibleFavicons = [
      'favicon.ico',
      'favicon.png',
      'icon.png',
      'apple-touch-icon.png'
    ];

    let faviconFound = false;

    for (const favicon of possibleFavicons) {
      const faviconPath = path.join(this.buildDir, favicon);
      const exists = await fs.access(faviconPath).then(() => true).catch(() => false);

      if (exists) {
        faviconFound = true;
        break;
      }
    }

    if (!faviconFound) {
      // This is a warning, not a failure
      this.log('No favicon found - consider adding one for better user experience', 'warning');
    }
  }

  async testBuildCommand() {
    // Test that build command can be executed (without actually running it)
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      if (!packageJson.scripts || !packageJson.scripts.build) {
        throw new Error('No build script found in package.json');
      }

      // Validate build script is not empty
      const buildScript = packageJson.scripts.build.trim();
      if (buildScript.length === 0) {
        throw new Error('Build script is empty');
      }

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('package.json not found');
      }
      throw error;
    }
  }

  async testEnvironmentIndependence() {
    // Check that build doesn't contain development-specific references
    const indexPath = path.join(this.buildDir, 'index.html');
    const content = await fs.readFile(indexPath, 'utf-8');

    const devPatterns = [
      'localhost:3000',
      'webpack-dev-server',
      'vite/client',
      'development'
    ];

    for (const pattern of devPatterns) {
      if (content.includes(pattern)) {
        throw new Error(`Development reference found in production build: ${pattern}`);
      }
    }
  }

  async run() {
    this.log('Starting build smoke tests...');

    const tests = [
      ['Build Directory Exists', () => this.testBuildDirectoryExists()],
      ['Required Files Exist', () => this.testRequiredFilesExist()],
      ['HTML Basic Structure', () => this.testHtmlBasicStructure()],
      ['JavaScript Bundles Exist', () => this.testJsBundlesExist()],
      ['CSS Bundles Exist', () => this.testCssBundlesExist()],
      ['Asset References Valid', () => this.testAssetReferences()],
      ['Bundle Sizes Reasonable', () => this.testBundleSizes()],
      ['No Syntax Errors', () => this.testNoSyntaxErrors()],
      ['Favicon Present', () => this.testFaviconExists()],
      ['Build Script Valid', () => this.testBuildCommand()],
      ['Environment Independence', () => this.testEnvironmentIndependence()]
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const [name, testFn] of tests) {
      const passed = await this.runTest(name, testFn);
      if (passed) passedTests++;
    }

    const summary = this.generateSummary(passedTests, totalTests);
    this.log('\n' + summary);

    return {
      passed: passedTests === totalTests,
      passedTests,
      totalTests,
      results: this.results,
      summary
    };
  }

  generateSummary(passed, total) {
    const successRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;
    const status = passed === total ? '✅ PASSED' : '❌ FAILED';

    const lines = [
      '=== BUILD SMOKE TEST SUMMARY ===',
      `Status: ${status}`,
      `Tests: ${passed}/${total} passed (${successRate}%)`,
      `Duration: ${this.results.reduce((sum, r) => sum + r.duration, 0)}ms`
    ];

    const failures = this.results.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      lines.push('');
      lines.push('Failures:');
      failures.forEach(f => {
        lines.push(`  • ${f.name}: ${f.error}`);
      });
    }

    return lines.join('\n');
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    buildDir: args.find(arg => arg.startsWith('--build-dir='))?.split('=')[1],
    projectRoot: args.find(arg => arg.startsWith('--project-root='))?.split('=')[1],
    timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || 60000
  };

  const smokeTest = new BuildSmokeTest(options);

  smokeTest.run()
    .then(result => {
      if (!result.passed) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Smoke test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { BuildSmokeTest };