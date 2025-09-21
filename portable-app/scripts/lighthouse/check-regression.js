#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class PerformanceRegressionChecker {
  constructor() {
    this.baselineFile = path.join(__dirname, '../../config/lighthouse/baseline.json');
    this.reportsDir = path.join(__dirname, '../../reports/lighthouse');
    this.thresholds = {
      performance: 0.05, // 5% degradation threshold
      fcp: 200, // 200ms threshold for FCP
      lcp: 300, // 300ms threshold for LCP
      tti: 500, // 500ms threshold for TTI
      cls: 0.02, // 0.02 threshold for CLS
      bundleSize: 0.1 // 10% size increase threshold
    };
  }

  loadBaseline() {
    try {
      if (fs.existsSync(this.baselineFile)) {
        return JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'));
      }
      console.log('📊 No baseline found, current run will be set as baseline');
      return null;
    } catch (error) {
      console.error('❌ Error loading baseline:', error.message);
      return null;
    }
  }

  getLatestReport() {
    try {
      const files = fs.readdirSync(this.reportsDir)
        .filter(f => f.endsWith('.json') && !f.includes('manifest'))
        .sort()
        .reverse();

      if (files.length === 0) {
        throw new Error('No Lighthouse reports found');
      }

      const latestFile = files[0];
      const reportPath = path.join(this.reportsDir, latestFile);
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
      console.error('❌ Error loading latest report:', error.message);
      process.exit(1);
    }
  }

  extractMetrics(report) {
    const { categories, audits } = report;

    return {
      performance: categories.performance.score,
      accessibility: categories.accessibility.score,
      bestPractices: categories['best-practices'].score,
      seo: categories.seo.score,
      fcp: audits['first-contentful-paint'].numericValue,
      lcp: audits['largest-contentful-paint'].numericValue,
      tti: audits['interactive'].numericValue,
      cls: audits['cumulative-layout-shift'].numericValue,
      fid: audits['max-potential-fid'].numericValue,
      bundleSize: this.getBundleSize(audits),
      timestamp: Date.now(),
      url: report.requestedUrl
    };
  }

  getBundleSize(audits) {
    const resourceSummary = audits['resource-summary'];
    if (resourceSummary && resourceSummary.details && resourceSummary.details.items) {
      const totalItem = resourceSummary.details.items.find(item => item.resourceType === 'total');
      return totalItem ? totalItem.size : 0;
    }
    return 0;
  }

  checkRegression(baseline, current) {
    const regressions = [];
    const improvements = [];

    // Performance score regression
    if (baseline.performance - current.performance > this.thresholds.performance) {
      regressions.push({
        metric: 'Performance Score',
        baseline: `${Math.round(baseline.performance * 100)}%`,
        current: `${Math.round(current.performance * 100)}%`,
        diff: `-${Math.round((baseline.performance - current.performance) * 100)}%`,
        severity: 'high'
      });
    } else if (current.performance - baseline.performance > this.thresholds.performance) {
      improvements.push({
        metric: 'Performance Score',
        baseline: `${Math.round(baseline.performance * 100)}%`,
        current: `${Math.round(current.performance * 100)}%`,
        diff: `+${Math.round((current.performance - baseline.performance) * 100)}%`
      });
    }

    // Core Web Vitals regression
    const metrics = [
      { key: 'fcp', name: 'First Contentful Paint', threshold: this.thresholds.fcp, unit: 'ms' },
      { key: 'lcp', name: 'Largest Contentful Paint', threshold: this.thresholds.lcp, unit: 'ms' },
      { key: 'tti', name: 'Time to Interactive', threshold: this.thresholds.tti, unit: 'ms' },
      { key: 'fid', name: 'First Input Delay', threshold: 100, unit: 'ms' }
    ];

    metrics.forEach(({ key, name, threshold, unit }) => {
      const diff = current[key] - baseline[key];
      if (diff > threshold) {
        regressions.push({
          metric: name,
          baseline: `${Math.round(baseline[key])}${unit}`,
          current: `${Math.round(current[key])}${unit}`,
          diff: `+${Math.round(diff)}${unit}`,
          severity: diff > threshold * 2 ? 'high' : 'medium'
        });
      } else if (diff < -threshold) {
        improvements.push({
          metric: name,
          baseline: `${Math.round(baseline[key])}${unit}`,
          current: `${Math.round(current[key])}${unit}`,
          diff: `${Math.round(diff)}${unit}`
        });
      }
    });

    // CLS regression (different logic since lower is better)
    const clsDiff = current.cls - baseline.cls;
    if (clsDiff > this.thresholds.cls) {
      regressions.push({
        metric: 'Cumulative Layout Shift',
        baseline: baseline.cls.toFixed(3),
        current: current.cls.toFixed(3),
        diff: `+${clsDiff.toFixed(3)}`,
        severity: clsDiff > this.thresholds.cls * 2 ? 'high' : 'medium'
      });
    } else if (clsDiff < -this.thresholds.cls) {
      improvements.push({
        metric: 'Cumulative Layout Shift',
        baseline: baseline.cls.toFixed(3),
        current: current.cls.toFixed(3),
        diff: clsDiff.toFixed(3)
      });
    }

    // Bundle size regression
    const sizeDiff = current.bundleSize - baseline.bundleSize;
    const sizeThreshold = baseline.bundleSize * this.thresholds.bundleSize;
    if (sizeDiff > sizeThreshold) {
      regressions.push({
        metric: 'Bundle Size',
        baseline: `${Math.round(baseline.bundleSize / 1024)}KB`,
        current: `${Math.round(current.bundleSize / 1024)}KB`,
        diff: `+${Math.round(sizeDiff / 1024)}KB`,
        severity: sizeDiff > sizeThreshold * 2 ? 'high' : 'medium'
      });
    } else if (sizeDiff < -sizeThreshold) {
      improvements.push({
        metric: 'Bundle Size',
        baseline: `${Math.round(baseline.bundleSize / 1024)}KB`,
        current: `${Math.round(current.bundleSize / 1024)}KB`,
        diff: `${Math.round(sizeDiff / 1024)}KB`
      });
    }

    return { regressions, improvements };
  }

  generateReport(baseline, current, regressions, improvements) {
    console.log('\n🔍 LIGHTHOUSE PERFORMANCE REGRESSION ANALYSIS');
    console.log('='.repeat(50));

    if (!baseline) {
      console.log('📊 No baseline found - setting current metrics as baseline');
      return;
    }

    console.log(`\n📈 Current Performance: ${Math.round(current.performance * 100)}%`);
    console.log(`📊 Baseline Performance: ${Math.round(baseline.performance * 100)}%`);

    if (regressions.length > 0) {
      console.log('\n❌ PERFORMANCE REGRESSIONS DETECTED:');
      regressions.forEach(regression => {
        const severity = regression.severity === 'high' ? '🔴' : '🟡';
        console.log(`${severity} ${regression.metric}: ${regression.baseline} → ${regression.current} (${regression.diff})`);
      });
    }

    if (improvements.length > 0) {
      console.log('\n✅ PERFORMANCE IMPROVEMENTS:');
      improvements.forEach(improvement => {
        console.log(`🟢 ${improvement.metric}: ${improvement.baseline} → ${improvement.current} (${improvement.diff})`);
      });
    }

    if (regressions.length === 0 && improvements.length === 0) {
      console.log('\n✅ No significant performance changes detected');
    }

    // Generate detailed comparison
    console.log('\n📊 DETAILED METRICS COMPARISON:');
    console.log('-'.repeat(50));
    console.log(`FCP: ${Math.round(baseline.fcp)}ms → ${Math.round(current.fcp)}ms`);
    console.log(`LCP: ${Math.round(baseline.lcp)}ms → ${Math.round(current.lcp)}ms`);
    console.log(`TTI: ${Math.round(baseline.tti)}ms → ${Math.round(current.tti)}ms`);
    console.log(`CLS: ${baseline.cls.toFixed(3)} → ${current.cls.toFixed(3)}`);
    console.log(`Bundle: ${Math.round(baseline.bundleSize / 1024)}KB → ${Math.round(current.bundleSize / 1024)}KB`);

    return regressions.length === 0;
  }

  run() {
    console.log('🚀 Starting performance regression check...');

    const baseline = this.loadBaseline();
    const latestReport = this.getLatestReport();
    const currentMetrics = this.extractMetrics(latestReport);

    if (!baseline) {
      // No baseline exists, save current as baseline
      this.saveBaseline(currentMetrics);
      console.log('✅ Baseline saved successfully');
      return true;
    }

    const { regressions, improvements } = this.checkRegression(baseline, currentMetrics);
    const passed = this.generateReport(baseline, currentMetrics, regressions, improvements);

    // Update baseline if on main branch and no regressions
    if (process.env.GITHUB_REF === 'refs/heads/main' && passed) {
      this.saveBaseline(currentMetrics);
      console.log('\n📝 Baseline updated with current metrics');
    }

    if (!passed) {
      console.log('\n❌ Performance regression check FAILED');
      const highSeverityRegressions = regressions.filter(r => r.severity === 'high');
      if (highSeverityRegressions.length > 0) {
        console.log('🔴 High severity regressions detected - failing CI');
        process.exit(1);
      } else {
        console.log('🟡 Medium severity regressions detected - warning only');
      }
    } else {
      console.log('\n✅ Performance regression check PASSED');
    }

    return passed;
  }

  saveBaseline(metrics) {
    try {
      fs.writeFileSync(this.baselineFile, JSON.stringify(metrics, null, 2));
    } catch (error) {
      console.error('❌ Error saving baseline:', error.message);
    }
  }
}

// Run the regression check
if (require.main === module) {
  const checker = new PerformanceRegressionChecker();
  checker.run();
}

module.exports = PerformanceRegressionChecker;