#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class BaselineUpdater {
  constructor() {
    this.baselineFile = path.join(__dirname, '../../config/lighthouse/baseline.json');
    this.reportsDir = path.join(__dirname, '../../reports/lighthouse');
    this.historyFile = path.join(__dirname, '../../config/lighthouse/baseline-history.json');
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
      return [];
    } catch (error) {
      console.error('❌ Error loading baseline history:', error.message);
      return [];
    }
  }

  saveHistory(history) {
    try {
      // Keep only last 30 entries
      const trimmedHistory = history.slice(-30);
      fs.writeFileSync(this.historyFile, JSON.stringify(trimmedHistory, null, 2));
    } catch (error) {
      console.error('❌ Error saving baseline history:', error.message);
    }
  }

  getLatestReports() {
    try {
      const files = fs.readdirSync(this.reportsDir)
        .filter(f => f.endsWith('.json') && !f.includes('manifest'))
        .sort()
        .reverse()
        .slice(0, 3); // Get last 3 reports for averaging

      return files.map(file => {
        const reportPath = path.join(this.reportsDir, file);
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      });
    } catch (error) {
      console.error('❌ Error loading reports:', error.message);
      return [];
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
      url: report.requestedUrl,
      environment: {
        userAgent: report.environment.networkUserAgent,
        benchmarkIndex: report.environment.benchmarkIndex
      }
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

  calculateAverageMetrics(metricsArray) {
    if (metricsArray.length === 0) return null;
    if (metricsArray.length === 1) return metricsArray[0];

    const keys = ['performance', 'accessibility', 'bestPractices', 'seo', 'fcp', 'lcp', 'tti', 'cls', 'fid', 'bundleSize'];
    const averaged = {};

    keys.forEach(key => {
      const values = metricsArray.map(m => m[key]).filter(v => v !== undefined && v !== null);
      if (values.length > 0) {
        averaged[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });

    // Use the latest timestamp and environment
    averaged.timestamp = metricsArray[0].timestamp;
    averaged.url = metricsArray[0].url;
    averaged.environment = metricsArray[0].environment;
    averaged.runCount = metricsArray.length;

    return averaged;
  }

  shouldUpdateBaseline(currentBaseline, newMetrics) {
    if (!currentBaseline) return true;

    // Update if significant improvement (>5% in performance score)
    const performanceImprovement = newMetrics.performance - currentBaseline.performance;
    if (performanceImprovement > 0.05) {
      console.log(`📈 Significant performance improvement detected: +${Math.round(performanceImprovement * 100)}%`);
      return true;
    }

    // Update if stable performance over time (no regressions)
    const daysSinceLastUpdate = (Date.now() - currentBaseline.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceLastUpdate > 7) {
      console.log(`📅 Baseline is ${Math.round(daysSinceLastUpdate)} days old - updating`);
      return true;
    }

    // Don't update if regression
    if (newMetrics.performance < currentBaseline.performance - 0.02) {
      console.log('⚠️ Performance regression detected - not updating baseline');
      return false;
    }

    return false;
  }

  generateReport(oldBaseline, newBaseline) {
    console.log('\n📊 BASELINE UPDATE REPORT');
    console.log('='.repeat(50));

    if (!oldBaseline) {
      console.log('🆕 Creating initial baseline');
    } else {
      console.log('🔄 Updating existing baseline');

      const perfDiff = newBaseline.performance - oldBaseline.performance;
      const fcpDiff = newBaseline.fcp - oldBaseline.fcp;
      const lcpDiff = newBaseline.lcp - oldBaseline.lcp;
      const ttiDiff = newBaseline.tti - oldBaseline.tti;
      const clsDiff = newBaseline.cls - oldBaseline.cls;
      const sizeDiff = newBaseline.bundleSize - oldBaseline.bundleSize;

      console.log('\n📈 METRIC CHANGES:');
      console.log(`Performance Score: ${Math.round(oldBaseline.performance * 100)}% → ${Math.round(newBaseline.performance * 100)}% (${perfDiff > 0 ? '+' : ''}${Math.round(perfDiff * 100)}%)`);
      console.log(`First Contentful Paint: ${Math.round(oldBaseline.fcp)}ms → ${Math.round(newBaseline.fcp)}ms (${fcpDiff > 0 ? '+' : ''}${Math.round(fcpDiff)}ms)`);
      console.log(`Largest Contentful Paint: ${Math.round(oldBaseline.lcp)}ms → ${Math.round(newBaseline.lcp)}ms (${lcpDiff > 0 ? '+' : ''}${Math.round(lcpDiff)}ms)`);
      console.log(`Time to Interactive: ${Math.round(oldBaseline.tti)}ms → ${Math.round(newBaseline.tti)}ms (${ttiDiff > 0 ? '+' : ''}${Math.round(ttiDiff)}ms)`);
      console.log(`Cumulative Layout Shift: ${oldBaseline.cls.toFixed(3)} → ${newBaseline.cls.toFixed(3)} (${clsDiff > 0 ? '+' : ''}${clsDiff.toFixed(3)})`);
      console.log(`Bundle Size: ${Math.round(oldBaseline.bundleSize / 1024)}KB → ${Math.round(newBaseline.bundleSize / 1024)}KB (${sizeDiff > 0 ? '+' : ''}${Math.round(sizeDiff / 1024)}KB)`);
    }

    console.log('\n✅ NEW BASELINE METRICS:');
    console.log(`🎯 Performance Score: ${Math.round(newBaseline.performance * 100)}%`);
    console.log(`⚡ First Contentful Paint: ${Math.round(newBaseline.fcp)}ms`);
    console.log(`🎨 Largest Contentful Paint: ${Math.round(newBaseline.lcp)}ms`);
    console.log(`🖱️ Time to Interactive: ${Math.round(newBaseline.tti)}ms`);
    console.log(`📐 Cumulative Layout Shift: ${newBaseline.cls.toFixed(3)}`);
    console.log(`📦 Bundle Size: ${Math.round(newBaseline.bundleSize / 1024)}KB`);
    console.log(`📊 Run Count: ${newBaseline.runCount || 1}`);
  }

  run() {
    console.log('🚀 Starting baseline update process...');

    const reports = this.getLatestReports();
    if (reports.length === 0) {
      console.error('❌ No Lighthouse reports found');
      process.exit(1);
    }

    console.log(`📊 Found ${reports.length} recent reports`);

    // Extract metrics from all reports
    const allMetrics = reports.map(report => this.extractMetrics(report));

    // Calculate average metrics for stability
    const averagedMetrics = this.calculateAverageMetrics(allMetrics);

    // Load current baseline
    let currentBaseline = null;
    try {
      if (fs.existsSync(this.baselineFile)) {
        currentBaseline = JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'));
      }
    } catch (error) {
      console.error('⚠️ Error loading current baseline:', error.message);
    }

    // Check if we should update the baseline
    if (!this.shouldUpdateBaseline(currentBaseline, averagedMetrics)) {
      console.log('ℹ️ Baseline update not required');
      return;
    }

    // Update baseline history
    const history = this.loadHistory();
    if (currentBaseline) {
      history.push({
        ...currentBaseline,
        archivedAt: Date.now()
      });
    }
    this.saveHistory(history);

    // Save new baseline
    try {
      fs.writeFileSync(this.baselineFile, JSON.stringify(averagedMetrics, null, 2));
      this.generateReport(currentBaseline, averagedMetrics);
      console.log('\n✅ Baseline updated successfully');
    } catch (error) {
      console.error('❌ Error saving baseline:', error.message);
      process.exit(1);
    }
  }
}

// Run the baseline updater
if (require.main === module) {
  const updater = new BaselineUpdater();
  updater.run();
}

module.exports = BaselineUpdater;