#!/usr/bin/env node

/**
 * Production Build Validation Script
 *
 * This script performs comprehensive validation of production builds
 * including structure, integrity, performance, and security checks.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, exec } = require('child_process');
const crypto = require('crypto');
const util = require('util');

const execAsync = util.promisify(exec);

class BuildValidator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.buildDir = options.buildDir || path.join(this.projectRoot, 'dist');
    this.verbose = options.verbose || false;
    this.config = {
      maxBundleSize: options.maxBundleSize || 50 * 1024 * 1024, // 50MB
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      buildTimeout: options.buildTimeout || 300000, // 5 minutes
      ...options.config
    };
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: []
    };
  }

  log(message, level = 'info') {
    if (level === 'error' || this.verbose) {
      const timestamp = new Date().toISOString();
      const prefix = {
        info: '🔍',
        success: '✅',
        warning: '⚠️',
        error: '❌'
      }[level] || 'ℹ️';

      console.log(`[${timestamp}] ${prefix} ${message}`);
    }
  }

  async runCheck(name, checkFn) {
    try {
      this.log(`Running check: ${name}`);
      await checkFn();
      this.results.passed++;
      this.log(`${name}: PASSED`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ check: name, error: error.message });
      this.log(`${name}: FAILED - ${error.message}`, 'error');
    }
  }

  async validateBuildExists() {
    const buildExists = await fs.access(this.buildDir).then(() => true).catch(() => false);
    if (!buildExists) {
      throw new Error(`Build directory does not exist: ${this.buildDir}`);
    }

    const stats = await fs.stat(this.buildDir);
    if (!stats.isDirectory()) {
      throw new Error(`Build path is not a directory: ${this.buildDir}`);
    }
  }

  async validateBuildCommand() {
    this.log('Executing fresh build...');

    // Clean existing build
    await fs.rm(this.buildDir, { recursive: true, force: true });

    const startTime = Date.now();

    try {
      const result = await execAsync('npm run build', {
        cwd: this.projectRoot,
        timeout: this.config.buildTimeout
      });

      const buildTime = Date.now() - startTime;
      this.log(`Build completed in ${buildTime}ms`);

      if (result.stderr && (result.stderr.includes('ERROR') || result.stderr.includes('FAILED'))) {
        throw new Error(`Build completed with errors: ${result.stderr}`);
      }

      if (buildTime > this.config.buildTimeout * 0.9) {
        this.log(`Build time (${buildTime}ms) approaching timeout`, 'warning');
        this.results.warnings++;
      }

    } catch (error) {
      throw new Error(`Build command failed: ${error.message}`);
    }
  }

  async validateDirectoryStructure() {
    const requiredPaths = [
      'index.html',
      'assets'
    ];

    for (const requiredPath of requiredPaths) {
      const fullPath = path.join(this.buildDir, requiredPath);
      const exists = await fs.access(fullPath).then(() => true).catch(() => false);

      if (!exists) {
        throw new Error(`Required path missing: ${requiredPath}`);
      }
    }

    // Validate assets directory has content
    const assetsDir = path.join(this.buildDir, 'assets');
    const assetFiles = await fs.readdir(assetsDir);

    if (assetFiles.length === 0) {
      throw new Error('Assets directory is empty');
    }

    const jsFiles = assetFiles.filter(f => f.endsWith('.js') && !f.includes('.map'));
    const cssFiles = assetFiles.filter(f => f.endsWith('.css') && !f.includes('.map'));

    if (jsFiles.length === 0) {
      throw new Error('No JavaScript bundles found in assets');
    }

    if (cssFiles.length === 0) {
      this.log('No CSS bundles found - this might be expected', 'warning');
      this.results.warnings++;
    }
  }

  async validateHtmlIntegrity() {
    const indexPath = path.join(this.buildDir, 'index.html');
    const content = await fs.readFile(indexPath, 'utf-8');

    // Basic HTML structure
    if (!content.includes('<!DOCTYPE html>')) {
      throw new Error('Missing DOCTYPE declaration');
    }

    const requiredTags = ['<html', '<head>', '</head>', '<body>', '</body>', '</html>'];
    for (const tag of requiredTags) {
      if (!content.includes(tag)) {
        throw new Error(`Missing required HTML tag: ${tag}`);
      }
    }

    // Meta tags
    if (!content.match(/<meta\s+charset=["']utf-8["']/i)) {
      throw new Error('Missing charset meta tag');
    }

    if (!content.match(/<meta\s+name=["']viewport["']/i)) {
      throw new Error('Missing viewport meta tag');
    }

    // Asset references
    const scriptRefs = [...content.matchAll(/src=["']([^"']+\.js)["']/g)].map(m => m[1]);
    const linkRefs = [...content.matchAll(/href=["']([^"']+\.css)["']/g)].map(m => m[1]);

    // Verify referenced assets exist
    for (const ref of [...scriptRefs, ...linkRefs]) {
      if (!ref.startsWith('http') && !ref.startsWith('//')) {
        const assetPath = path.join(this.buildDir, ref.replace(/^\//, ''));
        const exists = await fs.access(assetPath).then(() => true).catch(() => false);

        if (!exists) {
          throw new Error(`Referenced asset does not exist: ${ref}`);
        }
      }
    }
  }

  async validateBundleIntegrity() {
    const assetsDir = path.join(this.buildDir, 'assets');
    const files = await fs.readdir(assetsDir);

    const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));
    const cssFiles = files.filter(f => f.endsWith('.css') && !f.includes('.map'));

    // Validate JavaScript files
    for (const file of jsFiles) {
      const filePath = path.join(assetsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      // Size validation
      if (stats.size === 0) {
        throw new Error(`JavaScript bundle is empty: ${file}`);
      }

      if (stats.size > this.config.maxFileSize) {
        throw new Error(`JavaScript bundle too large: ${file} (${stats.size} bytes)`);
      }

      // Basic syntax validation
      if (content.includes('SyntaxError') || content.includes('Unexpected token')) {
        throw new Error(`JavaScript syntax error in bundle: ${file}`);
      }

      // Minification check
      const lines = content.split('\n');
      const avgLineLength = content.length / lines.length;

      if (avgLineLength < 50) {
        this.log(`JavaScript bundle may not be minified: ${file}`, 'warning');
        this.results.warnings++;
      }
    }

    // Validate CSS files
    for (const file of cssFiles) {
      const filePath = path.join(assetsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      if (stats.size === 0) {
        throw new Error(`CSS bundle is empty: ${file}`);
      }

      // Basic CSS validation
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;

      if (openBraces !== closeBraces) {
        throw new Error(`CSS syntax error (mismatched braces): ${file}`);
      }
    }
  }

  async validateSourceMaps() {
    const assetsDir = path.join(this.buildDir, 'assets');
    const files = await fs.readdir(assetsDir);

    const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));
    const mapFiles = files.filter(f => f.endsWith('.map'));

    for (const jsFile of jsFiles) {
      const jsPath = path.join(assetsDir, jsFile);
      const content = await fs.readFile(jsPath, 'utf-8');

      const sourceMappingMatch = content.match(/\/\/[#@]\s*sourceMappingURL=(.+)$/m);

      if (sourceMappingMatch) {
        const expectedMapFile = jsFile + '.map';

        if (!mapFiles.includes(expectedMapFile)) {
          throw new Error(`Source map not found: ${expectedMapFile}`);
        }

        // Validate source map
        const mapPath = path.join(assetsDir, expectedMapFile);
        const mapContent = await fs.readFile(mapPath, 'utf-8');

        try {
          const sourceMap = JSON.parse(mapContent);

          if (!sourceMap.version || !sourceMap.sources || !sourceMap.mappings) {
            throw new Error(`Invalid source map format: ${expectedMapFile}`);
          }
        } catch (error) {
          throw new Error(`Source map parsing error: ${expectedMapFile} - ${error.message}`);
        }
      }
    }
  }

  async validateSecurity() {
    const assetsDir = path.join(this.buildDir, 'assets');
    const files = await fs.readdir(assetsDir);

    const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

    const sensitivePatterns = [
      /API_SECRET/i,
      /DATABASE_PASSWORD/i,
      /PRIVATE_KEY/i,
      /SECRET_KEY/i,
      /JWT_SECRET/i,
      /console\.log\(/,
      /debugger;/,
      /alert\(/
    ];

    for (const file of jsFiles) {
      const filePath = path.join(assetsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          const isDebugPattern = ['console.log', 'debugger', 'alert'].some(p =>
            pattern.source.includes(p)
          );

          if (isDebugPattern) {
            this.log(`Debug code found in production bundle: ${file}`, 'warning');
            this.results.warnings++;
          } else {
            throw new Error(`Sensitive information found in bundle: ${file}`);
          }
        }
      }
    }
  }

  async validatePerformance() {
    const assetsDir = path.join(this.buildDir, 'assets');
    const files = await fs.readdir(assetsDir);

    let totalBundleSize = 0;

    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        const filePath = path.join(assetsDir, file);
        const stats = await fs.stat(filePath);
        totalBundleSize += stats.size;
      }
    }

    if (totalBundleSize > this.config.maxBundleSize) {
      throw new Error(`Total bundle size too large: ${totalBundleSize} bytes (max: ${this.config.maxBundleSize})`);
    }

    this.log(`Total bundle size: ${(totalBundleSize / 1024 / 1024).toFixed(2)}MB`);

    // Check for gzip compression opportunity
    const largeFiles = files.filter(async file => {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        const filePath = path.join(assetsDir, file);
        const stats = await fs.stat(filePath);
        return stats.size > 100 * 1024; // 100KB
      }
      return false;
    });

    if (largeFiles.length > 0) {
      this.log(`Consider enabling gzip compression for ${largeFiles.length} large files`, 'warning');
      this.results.warnings++;
    }
  }

  async validateOptimization() {
    const assetsDir = path.join(this.buildDir, 'assets');
    const files = await fs.readdir(assetsDir);

    // Check for hashed filenames (cache busting)
    const assetFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.css'));
    const hashedFiles = assetFiles.filter(f =>
      /\.[a-f0-9]{8,}\.(js|css)$/.test(f) || /-[a-f0-9]{8,}\.(js|css)$/.test(f)
    );

    if (hashedFiles.length === 0) {
      this.log('No hashed filenames found - consider enabling for cache busting', 'warning');
      this.results.warnings++;
    }

    // Check for tree shaking
    const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

    for (const file of jsFiles) {
      const filePath = path.join(assetsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Look for tree shaking indicators
      if (content.includes('/* unused harmony export')) {
        this.log(`Potential unused exports found in: ${file}`, 'warning');
        this.results.warnings++;
      }
    }
  }

  async validateEnvironment() {
    const assetsDir = path.join(this.buildDir, 'assets');
    const files = await fs.readdir(assetsDir);

    const jsFiles = files.filter(f => f.endsWith('.js') && !f.includes('.map'));

    for (const file of jsFiles) {
      const filePath = path.join(assetsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for development artifacts
      const devPatterns = [
        'localhost:3000',
        'development',
        'webpack-dev-server',
        'vite/client'
      ];

      for (const pattern of devPatterns) {
        if (content.includes(pattern)) {
          this.log(`Development artifact found in production: ${pattern} in ${file}`, 'warning');
          this.results.warnings++;
        }
      }
    }

    // Check HTML for development content
    const indexPath = path.join(this.buildDir, 'index.html');
    const indexContent = await fs.readFile(indexPath, 'utf-8');

    if (indexContent.includes('localhost') || indexContent.includes('<!-- DEV -->')) {
      this.log('Development content found in production HTML', 'warning');
      this.results.warnings++;
    }
  }

  async run() {
    this.log('Starting production build validation...');

    const checks = [
      ['Build Directory Exists', () => this.validateBuildExists()],
      ['Build Command', () => this.validateBuildCommand()],
      ['Directory Structure', () => this.validateDirectoryStructure()],
      ['HTML Integrity', () => this.validateHtmlIntegrity()],
      ['Bundle Integrity', () => this.validateBundleIntegrity()],
      ['Source Maps', () => this.validateSourceMaps()],
      ['Security', () => this.validateSecurity()],
      ['Performance', () => this.validatePerformance()],
      ['Optimization', () => this.validateOptimization()],
      ['Environment', () => this.validateEnvironment()]
    ];

    for (const [name, checkFn] of checks) {
      await this.runCheck(name, checkFn);
    }

    return this.generateReport();
  }

  generateReport() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;

    const report = {
      summary: {
        total,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        successRate: `${successRate}%`
      },
      status: this.results.failed === 0 ? 'PASSED' : 'FAILED',
      errors: this.results.errors,
      timestamp: new Date().toISOString()
    };

    this.log(`\n=== BUILD VALIDATION REPORT ===`);
    this.log(`Status: ${report.status}`);
    this.log(`Success Rate: ${report.summary.successRate}`);
    this.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
    this.log(`Warnings: ${report.summary.warnings}`);

    if (report.errors.length > 0) {
      this.log('\nErrors:');
      report.errors.forEach(error => {
        this.log(`  • ${error.check}: ${error.error}`, 'error');
      });
    }

    return report;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    buildDir: args.find(arg => arg.startsWith('--build-dir='))?.split('=')[1],
    projectRoot: args.find(arg => arg.startsWith('--project-root='))?.split('=')[1]
  };

  const validator = new BuildValidator(options);

  validator.run()
    .then(report => {
      if (report.status === 'FAILED') {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { BuildValidator };