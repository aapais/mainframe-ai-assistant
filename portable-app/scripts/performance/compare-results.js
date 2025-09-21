#!/usr/bin/env node

/**
 * Performance Results Comparison Tool
 * Compares current performance results with baseline
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

class PerformanceComparator {
  constructor(baselinePath, currentPath, testType) {
    this.baselinePath = baselinePath;
    this.currentPath = currentPath;
    this.testType = testType;
    this.comparison = {
      testType,
      timestamp: new Date().toISOString(),
      summary: {
        total_metrics: 0,
        improved: 0,
        degraded: 0,
        unchanged: 0,
        new_metrics: 0,
        missing_metrics: 0
      },
      metrics: [],
      recommendations: []
    };
  }

  /**
   * Compare performance results
   */
  async compare() {
    console.log(`🔍 Comparing ${this.testType} performance results...`);

    const baseline = this.loadResults(this.baselinePath);
    const current = this.loadResults(this.currentPath);

    if (!baseline || !current) {
      throw new Error('Unable to load baseline or current results');
    }

    console.log(`📊 Baseline metrics: ${Object.keys(baseline).length}`);
    console.log(`📊 Current metrics: ${Object.keys(current).length}`);

    this.compareMetrics(baseline, current);
    this.generateSummary();
    this.generateRecommendations();

    return this.comparison;
  }

  /**
   * Load performance results from file or directory
   */
  loadResults(resultsPath) {
    try {
      const stats = fs.statSync(resultsPath);

      if (stats.isDirectory()) {
        return this.loadResultsFromDirectory(resultsPath);
      } else {
        const content = fs.readFileSync(resultsPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`❌ Failed to load results from ${resultsPath}:`, error.message);
      return null;
    }
  }

  /**
   * Load and merge results from directory
   */
  loadResultsFromDirectory(dirPath) {
    const results = {};

    try {
      const files = fs.readdirSync(dirPath)
        .filter(file => file.endsWith('.json') && file.includes(this.testType));

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Merge results
        Object.assign(results, content);
      }

      return results;
    } catch (error) {
      console.error(`❌ Failed to load results from directory ${dirPath}:`, error.message);
      return null;
    }
  }

  /**
   * Compare metrics between baseline and current
   */
  compareMetrics(baseline, current) {
    const allMetrics = new Set([...Object.keys(baseline), ...Object.keys(current)]);

    for (const metricName of allMetrics) {
      const baselineValue = baseline[metricName];
      const currentValue = current[metricName];

      const metricComparison = this.compareMetric(metricName, baselineValue, currentValue);
      this.comparison.metrics.push(metricComparison);

      // Update summary
      this.comparison.summary.total_metrics++;

      if (metricComparison.status === 'improved') {
        this.comparison.summary.improved++;
      } else if (metricComparison.status === 'degraded') {
        this.comparison.summary.degraded++;
      } else if (metricComparison.status === 'unchanged') {
        this.comparison.summary.unchanged++;
      } else if (metricComparison.status === 'new') {
        this.comparison.summary.new_metrics++;
      } else if (metricComparison.status === 'missing') {
        this.comparison.summary.missing_metrics++;
      }
    }
  }

  /**
   * Compare individual metric
   */
  compareMetric(metricName, baselineValue, currentValue) {
    const comparison = {
      name: metricName,
      baseline: baselineValue,
      current: currentValue,
      status: 'unknown',
      change_percent: 0,
      change_absolute: 0,
      significance: 'none',
      impact: 'none'
    };

    // Handle missing metrics
    if (baselineValue === undefined && currentValue !== undefined) {
      comparison.status = 'new';
      comparison.significance = 'new_metric';
      return comparison;
    }

    if (baselineValue !== undefined && currentValue === undefined) {
      comparison.status = 'missing';
      comparison.significance = 'missing_metric';
      return comparison;
    }

    if (baselineValue === undefined || currentValue === undefined) {
      return comparison;
    }

    // Calculate changes
    if (typeof baselineValue === 'number' && typeof currentValue === 'number') {
      comparison.change_absolute = currentValue - baselineValue;
      comparison.change_percent = baselineValue !== 0
        ? (comparison.change_absolute / baselineValue) * 100
        : 0;

      // Determine status based on metric type and change
      comparison.status = this.determineMetricStatus(metricName, comparison.change_percent);
      comparison.significance = this.determineSignificance(comparison.change_percent);
      comparison.impact = this.determineImpact(metricName, comparison.change_percent);
    } else {
      // Non-numeric comparison
      comparison.status = baselineValue === currentValue ? 'unchanged' : 'changed';
    }

    return comparison;
  }

  /**
   * Determine metric status (improved/degraded/unchanged)
   */
  determineMetricStatus(metricName, changePercent) {
    const threshold = 2; // 2% threshold for significance

    if (Math.abs(changePercent) < threshold) {
      return 'unchanged';
    }

    // Metrics where lower values are better
    const lowerIsBetter = [
      'response_time', 'latency', 'duration', 'memory_usage', 'cpu_usage',
      'error_rate', 'bundle_size', 'load_time', 'ttfb', 'fcp', 'lcp'
    ];

    // Metrics where higher values are better
    const higherIsBetter = [
      'throughput', 'requests_per_second', 'concurrent_users', 'cache_hit_rate',
      'availability', 'success_rate'
    ];

    const isLowerBetter = lowerIsBetter.some(pattern => metricName.toLowerCase().includes(pattern));
    const isHigherBetter = higherIsBetter.some(pattern => metricName.toLowerCase().includes(pattern));

    if (isLowerBetter) {
      return changePercent < 0 ? 'improved' : 'degraded';
    } else if (isHigherBetter) {
      return changePercent > 0 ? 'improved' : 'degraded';
    } else {
      // Unknown metric type, consider any change as changed
      return 'changed';
    }
  }

  /**
   * Determine significance level
   */
  determineSignificance(changePercent) {
    const absChange = Math.abs(changePercent);

    if (absChange < 2) return 'insignificant';
    if (absChange < 10) return 'minor';
    if (absChange < 25) return 'moderate';
    if (absChange < 50) return 'major';
    return 'severe';
  }

  /**
   * Determine performance impact
   */
  determineImpact(metricName, changePercent) {
    const absChange = Math.abs(changePercent);

    // Critical metrics have higher impact thresholds
    const criticalMetrics = ['error_rate', 'availability', 'response_time'];
    const isCritical = criticalMetrics.some(pattern => metricName.toLowerCase().includes(pattern));

    if (isCritical) {
      if (absChange < 1) return 'none';
      if (absChange < 5) return 'low';
      if (absChange < 15) return 'medium';
      return 'high';
    } else {
      if (absChange < 5) return 'none';
      if (absChange < 15) return 'low';
      if (absChange < 30) return 'medium';
      return 'high';
    }
  }

  /**
   * Generate comparison summary
   */
  generateSummary() {
    const summary = this.comparison.summary;

    console.log('\n📈 Comparison Summary:');
    console.log(`   Total Metrics: ${summary.total_metrics}`);
    console.log(`   Improved: ${summary.improved}`);
    console.log(`   Degraded: ${summary.degraded}`);
    console.log(`   Unchanged: ${summary.unchanged}`);
    console.log(`   New: ${summary.new_metrics}`);
    console.log(`   Missing: ${summary.missing_metrics}`);

    // Calculate overall performance change
    const totalChanges = summary.improved + summary.degraded;
    if (totalChanges > 0) {
      const improvementRatio = summary.improved / totalChanges;
      this.comparison.overall_trend = improvementRatio > 0.6 ? 'improved' :
                                      improvementRatio < 0.4 ? 'degraded' : 'mixed';
    } else {
      this.comparison.overall_trend = 'stable';
    }
  }

  /**
   * Generate recommendations based on comparison
   */
  generateRecommendations() {
    const recommendations = [];

    // Analyze significant degradations
    const significantDegradations = this.comparison.metrics.filter(m =>
      m.status === 'degraded' && ['major', 'severe'].includes(m.significance)
    );

    if (significantDegradations.length > 0) {
      recommendations.push({
        type: 'performance_degradation',
        priority: 'high',
        message: `${significantDegradations.length} metrics show significant performance degradation`,
        metrics: significantDegradations.map(m => m.name),
        action: 'Investigate and optimize affected areas before deployment'
      });
    }

    // Analyze error rate increases
    const errorRateIncreases = this.comparison.metrics.filter(m =>
      m.name.toLowerCase().includes('error') && m.status === 'degraded'
    );

    if (errorRateIncreases.length > 0) {
      recommendations.push({
        type: 'reliability_concern',
        priority: 'critical',
        message: 'Error rates have increased',
        metrics: errorRateIncreases.map(m => m.name),
        action: 'Review error logs and fix underlying issues immediately'
      });
    }

    // Analyze resource usage increases
    const resourceIncreases = this.comparison.metrics.filter(m =>
      (m.name.toLowerCase().includes('memory') || m.name.toLowerCase().includes('cpu')) &&
      m.status === 'degraded' && m.impact !== 'none'
    );

    if (resourceIncreases.length > 0) {
      recommendations.push({
        type: 'resource_optimization',
        priority: 'medium',
        message: 'Resource usage has increased',
        metrics: resourceIncreases.map(m => m.name),
        action: 'Optimize algorithms and check for memory leaks'
      });
    }

    // Analyze improvements
    const significantImprovements = this.comparison.metrics.filter(m =>
      m.status === 'improved' && ['major', 'severe'].includes(m.significance)
    );

    if (significantImprovements.length > 0) {
      recommendations.push({
        type: 'performance_improvement',
        priority: 'info',
        message: `${significantImprovements.length} metrics show significant improvement`,
        metrics: significantImprovements.map(m => m.name),
        action: 'Document optimization techniques for future reference'
      });
    }

    // Analyze new metrics
    const newMetrics = this.comparison.metrics.filter(m => m.status === 'new');
    if (newMetrics.length > 0) {
      recommendations.push({
        type: 'baseline_update',
        priority: 'low',
        message: `${newMetrics.length} new metrics detected`,
        metrics: newMetrics.map(m => m.name),
        action: 'Update baseline to include new metrics'
      });
    }

    this.comparison.recommendations = recommendations;
  }
}

// CLI interface
program
  .name('compare-results')
  .description('Compare performance results with baseline')
  .requiredOption('-b, --baseline <path>', 'Baseline results file or directory')
  .requiredOption('-c, --current <path>', 'Current results file or directory')
  .requiredOption('-t, --type <type>', 'Test type (unit, integration, e2e, load)')
  .requiredOption('-o, --output <path>', 'Output file for comparison results')
  .option('--format <format>', 'Output format (json, html)', 'json')
  .action(async (options) => {
    try {
      console.log('🔍 Performance Results Comparator');
      console.log(`📊 Test Type: ${options.type}`);
      console.log(`📁 Baseline: ${options.baseline}`);
      console.log(`📁 Current: ${options.current}`);

      const comparator = new PerformanceComparator(
        options.baseline,
        options.current,
        options.type
      );

      const comparison = await comparator.compare();

      // Save results
      if (options.format === 'json') {
        fs.writeFileSync(options.output, JSON.stringify(comparison, null, 2));
      } else if (options.format === 'html') {
        const htmlReport = generateHTMLReport(comparison);
        fs.writeFileSync(options.output.replace('.json', '.html'), htmlReport);
      }

      console.log(`✅ Comparison complete. Results saved to ${options.output}`);
      console.log(`📈 Overall trend: ${comparison.overall_trend}`);

      // Set GitHub Actions outputs
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::set-output name=trend::${comparison.overall_trend}`);
        console.log(`::set-output name=degraded::${comparison.summary.degraded}`);
        console.log(`::set-output name=improved::${comparison.summary.improved}`);
      }

    } catch (error) {
      console.error('❌ Comparison failed:', error.message);
      process.exit(1);
    }
  });

/**
 * Generate HTML report for comparison results
 */
function generateHTMLReport(comparison) {
  const degradedMetrics = comparison.metrics.filter(m => m.status === 'degraded');
  const improvedMetrics = comparison.metrics.filter(m => m.status === 'improved');

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Comparison Report - ${comparison.testType}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .improved { border-left: 4px solid #28a745; }
        .degraded { border-left: 4px solid #dc3545; }
        .unchanged { border-left: 4px solid #6c757d; }
        .metric-list { max-height: 300px; overflow-y: auto; }
        .metric-item { padding: 8px; border-bottom: 1px solid #eee; }
        .change-positive { color: #28a745; }
        .change-negative { color: #dc3545; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Comparison Report</h1>
        <p><strong>Test Type:</strong> ${comparison.testType}</p>
        <p><strong>Generated:</strong> ${comparison.timestamp}</p>
        <p><strong>Overall Trend:</strong> ${comparison.overall_trend}</p>
    </div>

    <div class="summary">
        <div class="metric-card improved">
            <h3>Improved</h3>
            <div style="font-size: 2em; font-weight: bold;">${comparison.summary.improved}</div>
        </div>
        <div class="metric-card degraded">
            <h3>Degraded</h3>
            <div style="font-size: 2em; font-weight: bold;">${comparison.summary.degraded}</div>
        </div>
        <div class="metric-card unchanged">
            <h3>Unchanged</h3>
            <div style="font-size: 2em; font-weight: bold;">${comparison.summary.unchanged}</div>
        </div>
    </div>

    ${degradedMetrics.length > 0 ? `
    <h2>Degraded Metrics</h2>
    <div class="metric-list">
        ${degradedMetrics.map(m => `
        <div class="metric-item">
            <strong>${m.name}</strong>
            <span class="change-negative">+${m.change_percent.toFixed(1)}%</span>
            <div style="font-size: 0.9em; color: #666;">
                ${m.baseline} → ${m.current} (${m.significance})
            </div>
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${improvedMetrics.length > 0 ? `
    <h2>Improved Metrics</h2>
    <div class="metric-list">
        ${improvedMetrics.map(m => `
        <div class="metric-item">
            <strong>${m.name}</strong>
            <span class="change-positive">${m.change_percent.toFixed(1)}%</span>
            <div style="font-size: 0.9em; color: #666;">
                ${m.baseline} → ${m.current} (${m.significance})
            </div>
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${comparison.recommendations.length > 0 ? `
    <h2>Recommendations</h2>
    <div class="recommendations">
        ${comparison.recommendations.map(r => `
        <div style="margin-bottom: 15px;">
            <strong style="color: ${r.priority === 'critical' ? '#dc3545' : r.priority === 'high' ? '#fd7e14' : '#28a745'};">
                ${r.priority.toUpperCase()}: ${r.message}
            </strong>
            <div>${r.action}</div>
            ${r.metrics ? `<div style="font-size: 0.9em; color: #666;">Affected: ${r.metrics.join(', ')}</div>` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>
  `;
}

if (require.main === module) {
  program.parse();
}

module.exports = PerformanceComparator;