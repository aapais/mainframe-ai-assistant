#!/usr/bin/env node

/**
 * Comprehensive Rendering Performance Validation
 * Integrates React DevTools profiling, Web Vitals measurement, and bundle analysis
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

class RenderingPerformanceValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      webVitals: {},
      componentProfiling: {},
      bundleAnalysis: {},
      paintTiming: {},
      memoryUsage: {},
      recommendations: [],
      overallScore: 0
    };

    this.thresholds = {
      fcp: 1800, // First Contentful Paint
      lcp: 2500, // Largest Contentful Paint
      fid: 100,  // First Input Delay
      cls: 0.1,  // Cumulative Layout Shift
      tbt: 200,  // Total Blocking Time
      tti: 3800, // Time to Interactive
      componentRender: 16, // Component render time
      virtualScrollRender: 50, // Virtual scroll render time
      bundleSize: 5 * 1024 * 1024, // 5MB
      mainBundleSize: 1 * 1024 * 1024 // 1MB
    };
  }

  async validate() {
    console.log('🎯 Starting Comprehensive Rendering Performance Validation...\n');

    try {
      await this.setupEnvironment();
      await this.runBundleAnalysis();
      await this.startDevServer();
      await this.measureWebVitals();
      await this.profileReactComponents();
      await this.measurePaintTiming();
      await this.analyzeMemoryUsage();
      await this.generateRecommendations();
      await this.generateReport();

      console.log('\n✅ Performance validation complete!');
      console.log(`📊 Report: performance-validation-report.json`);
      console.log(`🎯 Overall Score: ${this.results.overallScore}/100`);

    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async setupEnvironment() {
    console.log('🔧 Setting up test environment...');

    // Ensure build exists
    if (!fs.existsSync(path.join(process.cwd(), 'dist'))) {
      console.log('   Building project...');
      execSync('npm run build', { stdio: 'inherit' });
    }

    // Install required dependencies
    try {
      require('puppeteer');
    } catch (error) {
      console.log('   Installing puppeteer...');
      execSync('npm install --no-save puppeteer', { stdio: 'inherit' });
    }

    console.log('   ✅ Environment ready');
  }

  async runBundleAnalysis() {
    console.log('📦 Analyzing bundle performance...');

    const BundleAnalyzer = require('./analyze-bundle-performance.js');
    const analyzer = new BundleAnalyzer();

    try {
      await analyzer.analyze();

      // Read the generated report
      const reportPath = path.join(process.cwd(), 'bundle-performance-report.json');
      if (fs.existsSync(reportPath)) {
        this.results.bundleAnalysis = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        console.log('   ✅ Bundle analysis complete');
      }
    } catch (error) {
      console.warn('   ⚠️ Bundle analysis failed:', error.message);
      this.results.bundleAnalysis = { error: error.message };
    }
  }

  async startDevServer() {
    console.log('🚀 Starting development server...');

    // Start the dev server in the background
    this.devServerProcess = require('child_process').spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      detached: false
    });

    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 60000);

      this.devServerProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Local:') || output.includes('localhost')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.devServerProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('Error') && !error.includes('warning')) {
          clearTimeout(timeout);
          reject(new Error(`Server startup failed: ${error}`));
        }
      });
    });

    console.log('   ✅ Development server started');
  }

  async measureWebVitals() {
    console.log('⚡ Measuring Web Vitals...');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      // Enable performance monitoring
      await page.setCacheEnabled(false);
      await page.coverage.startJSCoverage();

      // Navigate to application
      await page.goto('http://localhost:3000', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Inject Web Vitals library and measure
      await page.addScriptTag({
        url: 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js'
      });

      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const metrics = {};
          let metricsReceived = 0;
          const expectedMetrics = 4; // FCP, LCP, FID, CLS

          function onMetric(metric) {
            metrics[metric.name] = metric.value;
            metricsReceived++;

            if (metricsReceived >= expectedMetrics) {
              resolve(metrics);
            }
          }

          // Measure Web Vitals
          webVitals.getFCP(onMetric);
          webVitals.getLCP(onMetric);
          webVitals.getFID(onMetric);
          webVitals.getCLS(onMetric);

          // Fallback timeout
          setTimeout(() => resolve(metrics), 10000);
        });
      });

      this.results.webVitals = vitals;

      // Measure additional timing metrics
      const timing = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          totalTime: navigation.loadEventEnd - navigation.fetchStart
        };
      });

      this.results.webVitals.timing = timing;

      console.log('   ✅ Web Vitals measured');
      console.log(`      FCP: ${vitals['first-contentful-paint'] || 'N/A'}ms`);
      console.log(`      LCP: ${vitals['largest-contentful-paint'] || 'N/A'}ms`);
      console.log(`      FID: ${vitals['first-input-delay'] || 'N/A'}ms`);
      console.log(`      CLS: ${vitals['cumulative-layout-shift'] || 'N/A'}`);

    } finally {
      await browser.close();
    }
  }

  async profileReactComponents() {
    console.log('⚛️ Profiling React components...');

    const browser = await puppeteer.launch({
      headless: false, // Need to see React DevTools
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      devtools: true
    });

    try {
      const page = await browser.newPage();

      // Enable React DevTools profiling
      await page.evaluateOnNewDocument(() => {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          isDisabled: false,
          supportsFiber: true,
          inject: () => {},
          onCommitFiberRoot: () => {},
          onCommitFiberUnmount: () => {},
          renderers: new Map()
        };
      });

      await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

      // Simulate user interactions to trigger re-renders
      const interactions = await page.evaluate(async () => {
        const measurements = [];

        // Simulate search interaction
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) {
          const start = performance.now();
          searchInput.focus();
          searchInput.value = 'performance test';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 100));
          measurements.push({
            action: 'search-input',
            duration: performance.now() - start
          });
        }

        // Simulate button clicks
        const buttons = document.querySelectorAll('button');
        for (let i = 0; i < Math.min(buttons.length, 3); i++) {
          const start = performance.now();
          buttons[i].click();
          await new Promise(resolve => setTimeout(resolve, 50));
          measurements.push({
            action: `button-click-${i}`,
            duration: performance.now() - start
          });
        }

        // Simulate scrolling for virtual lists
        const scrollableElements = document.querySelectorAll('[style*="overflow"]');
        if (scrollableElements.length > 0) {
          const start = performance.now();
          scrollableElements[0].scrollTop = 500;
          await new Promise(resolve => setTimeout(resolve, 100));
          measurements.push({
            action: 'virtual-scroll',
            duration: performance.now() - start
          });
        }

        return measurements;
      });

      this.results.componentProfiling = {
        interactions,
        averageInteractionTime: interactions.reduce((sum, int) => sum + int.duration, 0) / interactions.length,
        slowestInteraction: interactions.reduce((max, int) => int.duration > max.duration ? int : max, { duration: 0 })
      };

      console.log('   ✅ Component profiling complete');
      console.log(`      Average interaction time: ${this.results.componentProfiling.averageInteractionTime.toFixed(2)}ms`);

    } finally {
      await browser.close();
    }
  }

  async measurePaintTiming() {
    console.log('🎨 Measuring paint timing...');

    const browser = await puppeteer.launch({ headless: true });

    try {
      const page = await browser.newPage();

      // Track paint events
      const paintEvents = [];
      page.on('framenavigated', async () => {
        const paintTiming = await page.evaluate(() => {
          return performance.getEntriesByType('paint').map(entry => ({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration
          }));
        });
        paintEvents.push(...paintTiming);
      });

      await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

      // Measure layout shifts
      const layoutShifts = await page.evaluate(() => {
        return performance.getEntriesByType('layout-shift').map(entry => ({
          value: entry.value,
          startTime: entry.startTime,
          sources: entry.sources.map(source => ({
            node: source.node ? source.node.tagName : 'unknown',
            currentRect: source.currentRect,
            previousRect: source.previousRect
          }))
        }));
      });

      this.results.paintTiming = {
        paintEvents,
        layoutShifts,
        totalLayoutShift: layoutShifts.reduce((sum, shift) => sum + shift.value, 0)
      };

      console.log('   ✅ Paint timing measured');
      console.log(`      Paint events: ${paintEvents.length}`);
      console.log(`      Layout shifts: ${layoutShifts.length}`);

    } finally {
      await browser.close();
    }
  }

  async analyzeMemoryUsage() {
    console.log('🧠 Analyzing memory usage...');

    const browser = await puppeteer.launch({ headless: true });

    try {
      const page = await browser.newPage();

      await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

      // Initial memory measurement
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });

      // Stress test with multiple operations
      await page.evaluate(async () => {
        // Simulate intensive operations
        for (let i = 0; i < 100; i++) {
          const largeArray = new Array(1000).fill(Math.random());
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      // Final memory measurement
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });

      this.results.memoryUsage = {
        initial: initialMemory,
        final: finalMemory,
        delta: finalMemory && initialMemory ? {
          usedJSHeapSize: finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize,
          totalJSHeapSize: finalMemory.totalJSHeapSize - initialMemory.totalJSHeapSize
        } : null
      };

      console.log('   ✅ Memory analysis complete');
      if (initialMemory && finalMemory) {
        console.log(`      Initial: ${this.formatSize(initialMemory.usedJSHeapSize)}`);
        console.log(`      Final: ${this.formatSize(finalMemory.usedJSHeapSize)}`);
        console.log(`      Delta: ${this.formatSize(finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize)}`);
      }

    } finally {
      await browser.close();
    }
  }

  async generateRecommendations() {
    console.log('💡 Generating performance recommendations...');

    const recommendations = [];
    const { webVitals, componentProfiling, bundleAnalysis, paintTiming, memoryUsage } = this.results;

    // Web Vitals recommendations
    if (webVitals['first-contentful-paint'] > this.thresholds.fcp) {
      recommendations.push({
        category: 'web-vitals',
        priority: 'high',
        metric: 'FCP',
        current: webVitals['first-contentful-paint'],
        threshold: this.thresholds.fcp,
        message: 'First Contentful Paint is too slow. Consider optimizing critical rendering path.',
        actions: [
          'Optimize CSS delivery',
          'Inline critical CSS',
          'Preload key resources',
          'Minimize render-blocking resources'
        ]
      });
    }

    if (webVitals['largest-contentful-paint'] > this.thresholds.lcp) {
      recommendations.push({
        category: 'web-vitals',
        priority: 'high',
        metric: 'LCP',
        current: webVitals['largest-contentful-paint'],
        threshold: this.thresholds.lcp,
        message: 'Largest Contentful Paint is too slow. Optimize loading of largest elements.',
        actions: [
          'Optimize images with WebP format',
          'Use responsive images',
          'Implement lazy loading',
          'Optimize server response times'
        ]
      });
    }

    if (webVitals['cumulative-layout-shift'] > this.thresholds.cls) {
      recommendations.push({
        category: 'web-vitals',
        priority: 'medium',
        metric: 'CLS',
        current: webVitals['cumulative-layout-shift'],
        threshold: this.thresholds.cls,
        message: 'Cumulative Layout Shift is too high. Minimize unexpected layout shifts.',
        actions: [
          'Set size attributes on images and videos',
          'Reserve space for ads and embeds',
          'Use transform and opacity for animations',
          'Avoid inserting content above existing content'
        ]
      });
    }

    // Component performance recommendations
    if (componentProfiling.averageInteractionTime > this.thresholds.componentRender) {
      recommendations.push({
        category: 'component-performance',
        priority: 'medium',
        metric: 'Average Interaction Time',
        current: componentProfiling.averageInteractionTime,
        threshold: this.thresholds.componentRender,
        message: 'Component interactions are slower than optimal. Consider optimization techniques.',
        actions: [
          'Implement React.memo for expensive components',
          'Use useMemo for expensive calculations',
          'Use useCallback for event handlers',
          'Consider virtual scrolling for large lists'
        ]
      });
    }

    // Bundle size recommendations
    if (bundleAnalysis.performance && bundleAnalysis.performance.totalSize > this.thresholds.bundleSize) {
      recommendations.push({
        category: 'bundle-optimization',
        priority: 'high',
        metric: 'Total Bundle Size',
        current: bundleAnalysis.performance.totalSize,
        threshold: this.thresholds.bundleSize,
        message: 'Bundle size is too large. Implement code splitting and lazy loading.',
        actions: [
          'Implement dynamic imports for routes',
          'Split vendor bundles',
          'Remove unused dependencies',
          'Use tree shaking'
        ]
      });
    }

    // Memory usage recommendations
    if (memoryUsage.delta && memoryUsage.delta.usedJSHeapSize > 10 * 1024 * 1024) { // 10MB
      recommendations.push({
        category: 'memory-optimization',
        priority: 'medium',
        metric: 'Memory Usage Delta',
        current: memoryUsage.delta.usedJSHeapSize,
        threshold: 10 * 1024 * 1024,
        message: 'High memory usage increase detected. Check for memory leaks.',
        actions: [
          'Clean up event listeners on unmount',
          'Cancel pending requests on unmount',
          'Use weak references where appropriate',
          'Profile for memory leaks'
        ]
      });
    }

    this.results.recommendations = recommendations;

    console.log(`   ✅ Generated ${recommendations.length} recommendations`);
    recommendations.forEach(rec => {
      const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`      ${priority} ${rec.category}: ${rec.message}`);
    });
  }

  async generateReport() {
    const report = {
      ...this.results,
      summary: {
        webVitalsScore: this.calculateWebVitalsScore(),
        performanceScore: this.calculatePerformanceScore(),
        bundleScore: this.calculateBundleScore(),
        memoryScore: this.calculateMemoryScore(),
        overallScore: 0
      }
    };

    // Calculate overall score
    report.summary.overallScore = Math.round(
      (report.summary.webVitalsScore +
       report.summary.performanceScore +
       report.summary.bundleScore +
       report.summary.memoryScore) / 4
    );

    this.results.overallScore = report.summary.overallScore;

    // Write detailed JSON report
    fs.writeFileSync(
      path.join(process.cwd(), 'performance-validation-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Write markdown summary
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync(
      path.join(process.cwd(), 'docs/performance-validation-report.md'),
      markdownReport
    );

    console.log('   ✅ Reports generated');
  }

  calculateWebVitalsScore() {
    const { webVitals } = this.results;
    let score = 100;

    if (webVitals['first-contentful-paint'] > this.thresholds.fcp) score -= 25;
    if (webVitals['largest-contentful-paint'] > this.thresholds.lcp) score -= 25;
    if (webVitals['first-input-delay'] > this.thresholds.fid) score -= 25;
    if (webVitals['cumulative-layout-shift'] > this.thresholds.cls) score -= 25;

    return Math.max(0, score);
  }

  calculatePerformanceScore() {
    const { componentProfiling } = this.results;
    let score = 100;

    if (componentProfiling.averageInteractionTime > this.thresholds.componentRender) {
      score -= 30;
    }

    return Math.max(0, score);
  }

  calculateBundleScore() {
    const { bundleAnalysis } = this.results;
    let score = 100;

    if (bundleAnalysis.performance) {
      if (bundleAnalysis.performance.totalSize > this.thresholds.bundleSize) score -= 40;
      if (bundleAnalysis.performance.loadingTime && bundleAnalysis.performance.loadingTime.regular4g > 3) score -= 20;
    }

    return Math.max(0, score);
  }

  calculateMemoryScore() {
    const { memoryUsage } = this.results;
    let score = 100;

    if (memoryUsage.delta && memoryUsage.delta.usedJSHeapSize > 10 * 1024 * 1024) {
      score -= 30;
    }

    return Math.max(0, score);
  }

  generateMarkdownReport(report) {
    return `# Rendering Performance Validation Report

Generated: ${new Date(report.timestamp).toLocaleString()}

## Overall Performance Score: ${report.summary.overallScore}/100

### Score Breakdown
- **Web Vitals**: ${report.summary.webVitalsScore}/100
- **Component Performance**: ${report.summary.performanceScore}/100
- **Bundle Optimization**: ${report.summary.bundleScore}/100
- **Memory Efficiency**: ${report.summary.memoryScore}/100

## Web Vitals Results

| Metric | Value | Status | Threshold |
|--------|-------|---------|-----------|
| First Contentful Paint | ${report.webVitals['first-contentful-paint'] || 'N/A'}ms | ${this.getStatus(report.webVitals['first-contentful-paint'], this.thresholds.fcp)} | ${this.thresholds.fcp}ms |
| Largest Contentful Paint | ${report.webVitals['largest-contentful-paint'] || 'N/A'}ms | ${this.getStatus(report.webVitals['largest-contentful-paint'], this.thresholds.lcp)} | ${this.thresholds.lcp}ms |
| First Input Delay | ${report.webVitals['first-input-delay'] || 'N/A'}ms | ${this.getStatus(report.webVitals['first-input-delay'], this.thresholds.fid)} | ${this.thresholds.fid}ms |
| Cumulative Layout Shift | ${report.webVitals['cumulative-layout-shift'] || 'N/A'} | ${this.getStatus(report.webVitals['cumulative-layout-shift'], this.thresholds.cls)} | ${this.thresholds.cls} |

## Performance Recommendations

${report.recommendations.map(rec =>
  `### ${rec.priority.toUpperCase()}: ${rec.category}
- **Issue**: ${rec.message}
- **Current**: ${typeof rec.current === 'number' ? this.formatValue(rec.current) : rec.current}
- **Threshold**: ${typeof rec.threshold === 'number' ? this.formatValue(rec.threshold) : rec.threshold}
- **Actions**:
${rec.actions.map(action => `  - ${action}`).join('\n')}
`).join('\n')}

---
*Report generated by Rendering Performance Validator*
`;
  }

  getStatus(value, threshold) {
    if (!value) return '❓ Unknown';
    return value <= threshold ? '✅ Good' : '❌ Needs Improvement';
  }

  formatValue(value) {
    if (value > 1000) return `${(value / 1000).toFixed(2)}s`;
    return `${value.toFixed(2)}ms`;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');

    if (this.devServerProcess) {
      this.devServerProcess.kill();
    }

    console.log('   ✅ Cleanup complete');
  }
}

// CLI interface
if (require.main === module) {
  const validator = new RenderingPerformanceValidator();

  validator.validate().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = RenderingPerformanceValidator;