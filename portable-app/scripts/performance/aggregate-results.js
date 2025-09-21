#!/usr/bin/env node

/**
 * Performance Results Aggregator
 * Combines and aggregates performance test results from multiple sources
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

class PerformanceAggregator {
  constructor(inputPath, options = {}) {
    this.inputPath = inputPath;
    this.options = {
      format: 'summary',
      includeBaseline: true,
      calculateStatistics: true,
      ...options
    };
    this.aggregated = {
      metadata: {
        timestamp: new Date().toISOString(),
        test_run_id: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
        commit_sha: process.env.GITHUB_SHA || 'unknown',
        branch: process.env.GITHUB_REF_NAME || 'unknown',
        environment: process.env.NODE_ENV || 'development'
      },
      summary: {
        total_tests: 0,
        test_types: [],
        total_metrics: 0,
        duration_ms: 0
      },
      results: {},
      baseline: {},
      statistics: {},
      trends: {}
    };
  }

  /**
   * Aggregate all performance results
   */
  async aggregate() {
    console.log('📊 Aggregating performance results...');

    const files = this.discoverResultFiles();
    console.log(`📁 Found ${files.length} result files`);

    for (const file of files) {
      await this.processResultFile(file);
    }

    if (this.options.calculateStatistics) {
      this.calculateStatistics();
    }

    this.generateSummary();
    this.detectTrends();

    return this.aggregated;
  }

  /**
   * Discover all result files in the input path
   */
  discoverResultFiles() {
    const files = [];

    try {
      const stats = fs.statSync(this.inputPath);

      if (stats.isDirectory()) {
        this.scanDirectory(this.inputPath, files);
      } else if (stats.isFile() && this.inputPath.endsWith('.json')) {
        files.push(this.inputPath);
      }
    } catch (error) {
      console.error(`❌ Error accessing input path: ${error.message}`);
    }

    return files;
  }

  /**
   * Recursively scan directory for result files
   */
  scanDirectory(dirPath, files) {
    try {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory() && !entry.startsWith('.')) {
          this.scanDirectory(fullPath, files);
        } else if (stats.isFile() && entry.endsWith('.json')) {
          // Include performance-related JSON files
          if (this.isPerformanceResultFile(entry)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Cannot read directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Check if file is a performance result file
   */
  isPerformanceResultFile(filename) {
    const patterns = [
      'performance', 'benchmark', 'load-test', 'metrics',
      'comparison', 'baseline', 'lighthouse', 'jest'
    ];

    return patterns.some(pattern => filename.toLowerCase().includes(pattern));
  }

  /**
   * Process individual result file
   */
  async processResultFile(filePath) {
    try {
      console.log(`📄 Processing: ${path.basename(filePath)}`);

      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);

      // Determine test type from filename or content
      const testType = this.determineTestType(filePath, data);

      // Add to summary
      this.aggregated.summary.total_tests++;
      if (!this.aggregated.summary.test_types.includes(testType)) {
        this.aggregated.summary.test_types.push(testType);
      }

      // Process different types of result files
      if (this.isComparisonFile(filePath)) {
        this.processComparisonFile(data, testType);
      } else if (this.isBaselineFile(filePath)) {
        this.processBaselineFile(data, testType);
      } else {
        this.processStandardResultFile(data, testType);
      }

    } catch (error) {
      console.error(`❌ Error processing ${filePath}: ${error.message}`);
    }
  }

  /**
   * Determine test type from file path or content
   */
  determineTestType(filePath, data) {
    const filename = path.basename(filePath).toLowerCase();

    // Check filename patterns
    if (filename.includes('unit')) return 'unit';
    if (filename.includes('integration')) return 'integration';
    if (filename.includes('e2e')) return 'e2e';
    if (filename.includes('load')) return 'load';
    if (filename.includes('lighthouse')) return 'lighthouse';
    if (filename.includes('benchmark')) return 'benchmark';

    // Check data content
    if (data.testType) return data.testType;
    if (data.type) return data.type;

    // Default fallback
    return 'performance';
  }

  /**
   * Check if file is a comparison result
   */
  isComparisonFile(filePath) {
    return path.basename(filePath).toLowerCase().includes('comparison');
  }

  /**
   * Check if file is a baseline result
   */
  isBaselineFile(filePath) {
    return path.basename(filePath).toLowerCase().includes('baseline');
  }

  /**
   * Process comparison file
   */
  processComparisonFile(data, testType) {
    if (!this.aggregated.results[testType]) {
      this.aggregated.results[testType] = {};
    }

    // Merge comparison metrics
    if (data.metrics) {
      for (const metric of data.metrics) {
        const metricKey = metric.name || metric.metric;
        this.aggregated.results[testType][metricKey] = {
          current: metric.current,
          baseline: metric.baseline,
          change_percent: metric.change_percent || metric.change,
          status: metric.status,
          impact: metric.impact
        };

        this.aggregated.summary.total_metrics++;
      }
    }

    // Store comparison summary
    if (data.summary) {
      this.aggregated.results[testType]._comparison_summary = data.summary;
    }
  }

  /**
   * Process baseline file
   */
  processBaselineFile(data, testType) {
    this.aggregated.baseline[testType] = data;
  }

  /**
   * Process standard result file
   */
  processStandardResultFile(data, testType) {
    if (!this.aggregated.results[testType]) {
      this.aggregated.results[testType] = {};
    }

    // Flatten and merge metrics
    const metrics = this.flattenMetrics(data);
    Object.assign(this.aggregated.results[testType], metrics);

    this.aggregated.summary.total_metrics += Object.keys(metrics).length;

    // Extract duration if available
    if (data.duration || data.execution_time) {
      this.aggregated.summary.duration_ms += data.duration || data.execution_time;
    }
  }

  /**
   * Flatten nested metrics into dot notation
   */
  flattenMetrics(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Skip metadata and non-metric objects
        if (!['metadata', 'config', 'options', 'summary'].includes(key)) {
          Object.assign(flattened, this.flattenMetrics(value, newKey));
        }
      } else if (typeof value === 'number') {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Calculate statistical aggregations
   */
  calculateStatistics() {
    console.log('📈 Calculating statistics...');

    for (const [testType, metrics] of Object.entries(this.aggregated.results)) {
      this.aggregated.statistics[testType] = {};

      // Group related metrics
      const metricGroups = this.groupMetrics(metrics);

      for (const [groupName, groupMetrics] of Object.entries(metricGroups)) {
        this.aggregated.statistics[testType][groupName] = {
          count: groupMetrics.length,
          values: groupMetrics.map(m => m.value),
          ...this.calculateMetricStatistics(groupMetrics.map(m => m.value))
        };
      }
    }
  }

  /**
   * Group related metrics together
   */
  groupMetrics(metrics) {
    const groups = {
      response_time: [],
      memory: [],
      cpu: [],
      throughput: [],
      errors: [],
      bundle_size: [],
      other: []
    };

    for (const [metricName, value] of Object.entries(metrics)) {
      if (typeof value !== 'number') continue;

      const metric = { name: metricName, value };

      if (metricName.toLowerCase().includes('response') || metricName.toLowerCase().includes('latency')) {
        groups.response_time.push(metric);
      } else if (metricName.toLowerCase().includes('memory')) {
        groups.memory.push(metric);
      } else if (metricName.toLowerCase().includes('cpu')) {
        groups.cpu.push(metric);
      } else if (metricName.toLowerCase().includes('throughput') || metricName.toLowerCase().includes('rps')) {
        groups.throughput.push(metric);
      } else if (metricName.toLowerCase().includes('error')) {
        groups.errors.push(metric);
      } else if (metricName.toLowerCase().includes('bundle') || metricName.toLowerCase().includes('size')) {
        groups.bundle_size.push(metric);
      } else {
        groups.other.push(metric);
      }
    }

    // Remove empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, metrics]) => metrics.length > 0)
    );
  }

  /**
   * Calculate statistics for a set of values
   */
  calculateMetricStatistics(values) {
    if (values.length === 0) return {};

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      mean: mean,
      median: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
      stddev: this.calculateStandardDeviation(values, mean)
    };
  }

  /**
   * Calculate percentile value
   */
  calculatePercentile(sortedValues, percentile) {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values, mean) {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Generate summary information
   */
  generateSummary() {
    console.log('📋 Generating summary...');

    const summary = this.aggregated.summary;

    // Calculate overall performance indicators
    let totalImproved = 0;
    let totalDegraded = 0;
    let totalUnchanged = 0;

    for (const [testType, metrics] of Object.entries(this.aggregated.results)) {
      for (const [metricName, metricData] of Object.entries(metrics)) {
        if (typeof metricData === 'object' && metricData.status) {
          switch (metricData.status) {
            case 'improved':
              totalImproved++;
              break;
            case 'degraded':
              totalDegraded++;
              break;
            case 'unchanged':
              totalUnchanged++;
              break;
          }
        }
      }
    }

    summary.performance_changes = {
      improved: totalImproved,
      degraded: totalDegraded,
      unchanged: totalUnchanged,
      total: totalImproved + totalDegraded + totalUnchanged
    };

    // Overall performance trend
    const totalChanges = totalImproved + totalDegraded;
    if (totalChanges > 0) {
      const improvementRatio = totalImproved / totalChanges;
      summary.overall_trend = improvementRatio > 0.6 ? 'improved' :
                              improvementRatio < 0.4 ? 'degraded' : 'mixed';
    } else {
      summary.overall_trend = 'stable';
    }
  }

  /**
   * Detect performance trends
   */
  detectTrends() {
    console.log('📊 Detecting trends...');

    // This is a simplified trend analysis
    // In a real implementation, you would analyze historical data
    const trends = {};

    for (const [testType, metrics] of Object.entries(this.aggregated.results)) {
      trends[testType] = {
        trending_up: [],
        trending_down: [],
        stable: []
      };

      for (const [metricName, metricData] of Object.entries(metrics)) {
        if (typeof metricData === 'object' && metricData.change_percent !== undefined) {
          const change = metricData.change_percent;

          if (Math.abs(change) < 5) {
            trends[testType].stable.push({ metric: metricName, change });
          } else if (change > 0) {
            trends[testType].trending_up.push({ metric: metricName, change });
          } else {
            trends[testType].trending_down.push({ metric: metricName, change });
          }
        }
      }
    }

    this.aggregated.trends = trends;
  }

  /**
   * Format output based on specified format
   */
  formatOutput(format) {
    switch (format) {
      case 'summary':
        return this.createSummaryOutput();
      case 'detailed':
        return this.aggregated;
      case 'compact':
        return this.createCompactOutput();
      default:
        return this.aggregated;
    }
  }

  /**
   * Create summary output
   */
  createSummaryOutput() {
    return {
      metadata: this.aggregated.metadata,
      summary: this.aggregated.summary,
      key_metrics: this.extractKeyMetrics(),
      performance_status: this.getPerformanceStatus()
    };
  }

  /**
   * Create compact output
   */
  createCompactOutput() {
    return {
      timestamp: this.aggregated.metadata.timestamp,
      test_types: this.aggregated.summary.test_types,
      overall_trend: this.aggregated.summary.overall_trend,
      total_metrics: this.aggregated.summary.total_metrics,
      changes: this.aggregated.summary.performance_changes
    };
  }

  /**
   * Extract key performance metrics
   */
  extractKeyMetrics() {
    const keyMetrics = {};

    for (const [testType, metrics] of Object.entries(this.aggregated.results)) {
      keyMetrics[testType] = {};

      // Extract commonly important metrics
      const importantPatterns = [
        'response_time', 'throughput', 'memory_usage', 'cpu_usage',
        'error_rate', 'p95', 'p99'
      ];

      for (const [metricName, metricValue] of Object.entries(metrics)) {
        if (importantPatterns.some(pattern => metricName.toLowerCase().includes(pattern))) {
          keyMetrics[testType][metricName] = metricValue;
        }
      }
    }

    return keyMetrics;
  }

  /**
   * Get overall performance status
   */
  getPerformanceStatus() {
    const changes = this.aggregated.summary.performance_changes;
    const trend = this.aggregated.summary.overall_trend;

    let status = 'good';
    let message = 'Performance is stable';

    if (trend === 'improved') {
      status = 'excellent';
      message = 'Performance has improved';
    } else if (trend === 'degraded') {
      status = changes.degraded > changes.improved * 2 ? 'poor' : 'warning';
      message = 'Performance regressions detected';
    } else if (trend === 'mixed') {
      status = 'warning';
      message = 'Mixed performance changes detected';
    }

    return { status, message, trend };
  }
}

// CLI interface
program
  .name('aggregate-results')
  .description('Aggregate performance test results')
  .requiredOption('-i, --input <path>', 'Input file or directory containing results')
  .requiredOption('-o, --output <path>', 'Output file for aggregated results')
  .option('-f, --format <format>', 'Output format (summary, detailed, compact)', 'detailed')
  .option('--no-statistics', 'Skip statistical calculations')
  .option('--no-baseline', 'Exclude baseline data')
  .action(async (options) => {
    try {
      console.log('📊 Performance Results Aggregator');
      console.log(`📁 Input: ${options.input}`);
      console.log(`📄 Output: ${options.output}`);
      console.log(`📋 Format: ${options.format}`);

      const aggregator = new PerformanceAggregator(options.input, {
        format: options.format,
        includeBaseline: options.baseline,
        calculateStatistics: options.statistics
      });

      const results = await aggregator.aggregate();
      const output = aggregator.formatOutput(options.format);

      // Save results
      fs.writeFileSync(options.output, JSON.stringify(output, null, 2));

      console.log('✅ Aggregation complete');
      console.log(`📊 Test Types: ${results.summary.test_types.join(', ')}`);
      console.log(`📈 Total Metrics: ${results.summary.total_metrics}`);
      console.log(`🎯 Overall Trend: ${results.summary.overall_trend}`);

      // Set GitHub Actions outputs
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::set-output name=test-types::${results.summary.test_types.join(',')}`);
        console.log(`::set-output name=total-metrics::${results.summary.total_metrics}`);
        console.log(`::set-output name=overall-trend::${results.summary.overall_trend}`);
      }

    } catch (error) {
      console.error('❌ Aggregation failed:', error.message);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}

module.exports = PerformanceAggregator;