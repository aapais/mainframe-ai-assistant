#!/usr/bin/env node

/**
 * Build Performance Monitor
 *
 * Monitors build performance metrics including timing, memory usage,
 * bundle sizes, and optimization effectiveness
 */

const fs = require('fs').promises;
const path = require('path');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);

class BuildPerformanceMonitor {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.buildDir = options.buildDir || path.join(this.projectRoot, 'dist');
    this.reportsDir = options.reportsDir || path.join(this.projectRoot, 'reports');
    this.iterations = options.iterations || 3;
    this.verbose = options.verbose || false;
    this.metrics = {
      builds: [],
      system: {},
      averages: {}
    };
  }

  log(message, level = 'info') {
    if (this.verbose || level === 'error' || level === 'warn') {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      const prefix = {
        info: '📊',
        success: '✅',
        warn: '⚠️',
        error: '❌'
      }[level] || 'ℹ️';

      console.log(`[${timestamp}] ${prefix} ${message}`);
    }
  }

  async collectSystemInfo() {
    this.metrics.system = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100, // GB
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100, // GB
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    };

    // Get npm version
    try {
      const npmResult = await execAsync('npm --version');
      this.metrics.system.npmVersion = npmResult.stdout.trim();
    } catch (error) {
      this.metrics.system.npmVersion = 'unknown';
    }

    // Get build tool versions
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      this.metrics.system.dependencies = {
        vite: packageJson.devDependencies?.vite || packageJson.dependencies?.vite,
        webpack: packageJson.devDependencies?.webpack || packageJson.dependencies?.webpack,
        typescript: packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript,
        react: packageJson.dependencies?.react,
        vue: packageJson.dependencies?.vue
      };
    } catch (error) {
      this.log('Could not read package.json for dependency versions', 'warn');
    }
  }

  async measureBuildPerformance(iteration) {
    this.log(`Starting build performance measurement ${iteration + 1}/${this.iterations}`);

    // Clean build directory
    try {
      await fs.rm(this.buildDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }

    const buildMetrics = {
      iteration: iteration + 1,
      startTime: Date.now(),
      memoryBefore: process.memoryUsage(),
      systemMemoryBefore: {
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      }
    };

    try {
      // Monitor memory during build
      const memoryMonitor = this.startMemoryMonitoring();

      // Execute build
      const buildStart = process.hrtime.bigint();
      const result = await execAsync('npm run build', {
        cwd: this.projectRoot,
        timeout: 600000, // 10 minutes
        env: { ...process.env, NODE_ENV: 'production' }
      });
      const buildEnd = process.hrtime.bigint();

      // Stop memory monitoring
      clearInterval(memoryMonitor.interval);

      buildMetrics.endTime = Date.now();
      buildMetrics.duration = buildMetrics.endTime - buildMetrics.startTime;
      buildMetrics.durationPrecise = Number(buildEnd - buildStart) / 1_000_000; // Convert to ms
      buildMetrics.memoryAfter = process.memoryUsage();
      buildMetrics.systemMemoryAfter = {
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      };
      buildMetrics.peakMemory = memoryMonitor.peak;
      buildMetrics.avgMemory = memoryMonitor.samples.length > 0 ?
        memoryMonitor.samples.reduce((a, b) => a + b, 0) / memoryMonitor.samples.length : 0;

      // Analyze build output
      buildMetrics.output = await this.analyzeBuildOutput();

      // Check for warnings/errors
      buildMetrics.warnings = this.extractWarnings(result.stderr);
      buildMetrics.errors = this.extractErrors(result.stderr);

      this.log(`Build ${iteration + 1} completed in ${buildMetrics.duration}ms`);

    } catch (error) {
      buildMetrics.error = error.message;
      buildMetrics.failed = true;
      this.log(`Build ${iteration + 1} failed: ${error.message}`, 'error');
    }

    this.metrics.builds.push(buildMetrics);
    return buildMetrics;
  }

  startMemoryMonitoring() {
    const monitor = {
      peak: 0,
      samples: [],
      interval: null
    };

    monitor.interval = setInterval(() => {
      const usage = process.memoryUsage();
      const systemUsage = os.totalmem() - os.freemem();

      monitor.samples.push(usage.rss);
      monitor.peak = Math.max(monitor.peak, usage.rss);
    }, 1000); // Sample every second

    return monitor;
  }

  async analyzeBuildOutput() {
    const analysis = {
      totalSize: 0,
      files: {
        js: [],
        css: [],
        html: [],
        assets: []
      },
      optimization: {}
    };

    try {
      // Analyze main build directory
      await this.analyzeDirectory(this.buildDir, analysis, '');

      // Calculate optimization metrics
      analysis.optimization = {
        hasSourceMaps: analysis.files.js.some(f =>
          analysis.files.js.some(mapFile => mapFile.name === f.name + '.map')
        ),
        hasMinification: this.checkMinification(analysis.files.js),
        hasCompression: this.checkCompression(analysis.files),
        bundleCount: analysis.files.js.length,
        largestBundle: Math.max(...analysis.files.js.map(f => f.size), 0),
        smallestBundle: Math.min(...analysis.files.js.map(f => f.size), Infinity)
      };

    } catch (error) {
      this.log(`Error analyzing build output: ${error.message}`, 'error');
    }

    return analysis;
  }

  async analyzeDirectory(dir, analysis, basePath) {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const relativePath = path.join(basePath, item.name);

        if (item.isDirectory()) {
          await this.analyzeDirectory(fullPath, analysis, relativePath);
        } else {
          const stats = await fs.stat(fullPath);
          const fileInfo = {
            name: item.name,
            path: relativePath,
            size: stats.size,
            modified: stats.mtime
          };

          analysis.totalSize += stats.size;

          // Categorize files
          if (item.name.endsWith('.js')) {
            analysis.files.js.push(fileInfo);
          } else if (item.name.endsWith('.css')) {
            analysis.files.css.push(fileInfo);
          } else if (item.name.endsWith('.html')) {
            analysis.files.html.push(fileInfo);
          } else {
            analysis.files.assets.push(fileInfo);
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
  }

  checkMinification(jsFiles) {
    // Simple heuristic: check if average line length suggests minification
    // In a real implementation, you might actually read file contents
    return jsFiles.length > 0 && jsFiles.some(f => f.size > 10000); // Assume larger files are minified
  }

  checkCompression(files) {
    // Check for compressed versions or compression-friendly names
    const allFiles = [...files.js, ...files.css, ...files.assets];
    return allFiles.some(f =>
      f.name.includes('.gz') ||
      f.name.includes('.br') ||
      f.name.match(/\.[a-f0-9]{8,}\.(js|css)$/) // Hashed filenames suggest build optimization
    );
  }

  extractWarnings(stderr) {
    const warnings = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn')) {
        warnings.push(line.trim());
      }
    }

    return warnings;
  }

  extractErrors(stderr) {
    const errors = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('error') && !line.toLowerCase().includes('0 errors')) {
        errors.push(line.trim());
      }
    }

    return errors;
  }

  calculateAverages() {
    const successfulBuilds = this.metrics.builds.filter(b => !b.failed);

    if (successfulBuilds.length === 0) {
      this.log('No successful builds to analyze', 'warn');
      return;
    }

    this.metrics.averages = {
      duration: this.average(successfulBuilds.map(b => b.duration)),
      durationPrecise: this.average(successfulBuilds.map(b => b.durationPrecise)),
      totalSize: this.average(successfulBuilds.map(b => b.output?.totalSize || 0)),
      jsFiles: this.average(successfulBuilds.map(b => b.output?.files?.js?.length || 0)),
      cssFiles: this.average(successfulBuilds.map(b => b.output?.files?.css?.length || 0)),
      peakMemory: this.average(successfulBuilds.map(b => b.peakMemory || 0)),
      avgMemory: this.average(successfulBuilds.map(b => b.avgMemory || 0)),
      warningCount: this.average(successfulBuilds.map(b => b.warnings?.length || 0)),
      errorCount: this.average(successfulBuilds.map(b => b.errors?.length || 0))
    };

    // Calculate standard deviations for key metrics
    this.metrics.averages.durationStdDev = this.standardDeviation(
      successfulBuilds.map(b => b.duration),
      this.metrics.averages.duration
    );

    this.metrics.averages.sizeStdDev = this.standardDeviation(
      successfulBuilds.map(b => b.output?.totalSize || 0),
      this.metrics.averages.totalSize
    );
  }

  average(numbers) {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  standardDeviation(numbers, mean) {
    if (numbers.length === 0) return 0;

    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    const avgSquaredDiff = this.average(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  async generateReport() {
    const report = {
      summary: {
        totalBuilds: this.metrics.builds.length,
        successfulBuilds: this.metrics.builds.filter(b => !b.failed).length,
        failedBuilds: this.metrics.builds.filter(b => b.failed).length,
        avgDuration: Math.round(this.metrics.averages.duration || 0),
        avgSizeMB: Math.round((this.metrics.averages.totalSize || 0) / 1024 / 1024 * 100) / 100,
        consistency: {
          durationVariability: Math.round(this.metrics.averages.durationStdDev || 0),
          sizeVariability: Math.round((this.metrics.averages.sizeStdDev || 0) / 1024 / 1024 * 100) / 100
        }
      },
      system: this.metrics.system,
      builds: this.metrics.builds,
      averages: this.metrics.averages,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString()
    };

    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    const avgDuration = this.metrics.averages.duration || 0;
    const avgSize = this.metrics.averages.totalSize || 0;

    // Performance recommendations
    if (avgDuration > 60000) { // > 1 minute
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Build time is quite long. Consider enabling caching or optimizing dependencies.'
      });
    }

    if (avgSize > 50 * 1024 * 1024) { // > 50MB
      recommendations.push({
        type: 'size',
        priority: 'medium',
        message: 'Bundle size is large. Consider code splitting and tree shaking.'
      });
    }

    // Memory recommendations
    const avgPeakMemory = this.metrics.averages.peakMemory || 0;
    if (avgPeakMemory > 2 * 1024 * 1024 * 1024) { // > 2GB
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'High memory usage during build. Consider increasing Node.js memory limit.'
      });
    }

    // Consistency recommendations
    const durationStdDev = this.metrics.averages.durationStdDev || 0;
    if (durationStdDev > avgDuration * 0.2) { // > 20% variation
      recommendations.push({
        type: 'consistency',
        priority: 'low',
        message: 'Build times are inconsistent. Check for background processes or caching issues.'
      });
    }

    // Optimization recommendations
    const successfulBuilds = this.metrics.builds.filter(b => !b.failed);
    if (successfulBuilds.length > 0) {
      const hasSourceMaps = successfulBuilds.some(b => b.output?.optimization?.hasSourceMaps);
      if (!hasSourceMaps) {
        recommendations.push({
          type: 'optimization',
          priority: 'low',
          message: 'Consider enabling source maps for better debugging experience.'
        });
      }
    }

    return recommendations;
  }

  async saveReport(report) {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(this.reportsDir, `build-performance-${timestamp}.json`);

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      this.log(`Performance report saved to: ${reportPath}`, 'success');

      // Also save a latest report
      const latestPath = path.join(this.reportsDir, 'build-performance-latest.json');
      await fs.writeFile(latestPath, JSON.stringify(report, null, 2));

      return reportPath;
    } catch (error) {
      this.log(`Failed to save report: ${error.message}`, 'error');
      throw error;
    }
  }

  displaySummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('          BUILD PERFORMANCE SUMMARY');
    console.log('='.repeat(60));

    console.log(`\n📊 Build Statistics:`);
    console.log(`   Total Builds: ${report.summary.totalBuilds}`);
    console.log(`   Successful: ${report.summary.successfulBuilds}`);
    console.log(`   Failed: ${report.summary.failedBuilds}`);

    console.log(`\n⏱️  Performance Metrics:`);
    console.log(`   Average Duration: ${report.summary.avgDuration}ms`);
    console.log(`   Duration Variability: ±${report.summary.consistency.durationVariability}ms`);
    console.log(`   Average Bundle Size: ${report.summary.avgSizeMB}MB`);
    console.log(`   Size Variability: ±${report.summary.consistency.sizeVariability}MB`);

    console.log(`\n🖥️  System Information:`);
    console.log(`   Platform: ${report.system.platform} ${report.system.arch}`);
    console.log(`   CPUs: ${report.system.cpus}`);
    console.log(`   Memory: ${report.system.totalMemory}GB total`);
    console.log(`   Node: ${report.system.nodeVersion}`);

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach((rec, index) => {
        const priority = {
          high: '🔴',
          medium: '🟡',
          low: '🟢'
        }[rec.priority] || '⚪';

        console.log(`   ${priority} ${rec.message}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }

  async run() {
    this.log('Starting build performance monitoring...');

    // Collect system information
    await this.collectSystemInfo();

    // Run multiple build iterations
    for (let i = 0; i < this.iterations; i++) {
      await this.measureBuildPerformance(i);

      // Brief pause between builds
      if (i < this.iterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Calculate averages and generate report
    this.calculateAverages();
    const report = await this.generateReport();

    // Save and display report
    await this.saveReport(report);
    this.displaySummary(report);

    return report;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    iterations: parseInt(args.find(arg => arg.startsWith('--iterations='))?.split('=')[1]) || 3,
    buildDir: args.find(arg => arg.startsWith('--build-dir='))?.split('=')[1],
    projectRoot: args.find(arg => arg.startsWith('--project-root='))?.split('=')[1],
    reportsDir: args.find(arg => arg.startsWith('--reports-dir='))?.split('=')[1]
  };

  const monitor = new BuildPerformanceMonitor(options);

  monitor.run()
    .then(report => {
      const hasIssues = report.summary.failedBuilds > 0 ||
                       report.recommendations.some(r => r.priority === 'high');

      if (hasIssues) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Performance monitoring failed:', error.message);
      process.exit(1);
    });
}

module.exports = { BuildPerformanceMonitor };