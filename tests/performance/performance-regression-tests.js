/**
 * Performance Regression Testing Framework
 * Detects performance degradation between releases
 */

const { performance } = require('perf_hooks');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class PerformanceRegressionTests {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      baselineFile: config.baselineFile || './baselines/performance-baseline.json',
      regressionThreshold: config.regressionThreshold || 20, // 20% degradation threshold
      improvementThreshold: config.improvementThreshold || 10, // 10% improvement threshold
      confidenceLevel: config.confidenceLevel || 0.95,
      iterations: config.iterations || 50,
      outputDir: config.outputDir || './regression-test-results',
      ...config
    };

    this.currentResults = new Map();
    this.baselineResults = new Map();
    this.regressions = [];
    this.improvements = [];
  }

  /**
   * Execute comprehensive regression testing
   */
  async runRegressionTests() {
    console.log('📈 Starting Performance Regression Testing');
    console.log(`Regression threshold: ${this.config.regressionThreshold}%`);
    console.log(`Improvement threshold: ${this.config.improvementThreshold}%`);

    try {
      await this.ensureOutputDir();

      const regressionResults = {
        timestamp: new Date().toISOString(),
        config: this.config,
        baseline: null,
        current: {},
        analysis: {},
        regressions: [],
        improvements: [],
        summary: null
      };

      // Load baseline performance data
      console.log('📊 Loading baseline performance data...');
      regressionResults.baseline = await this.loadBaseline();

      // Execute current performance tests
      console.log('🔄 Running current performance tests...');
      regressionResults.current = await this.runCurrentTests();

      // Compare and analyze
      console.log('🔍 Analyzing performance changes...');
      regressionResults.analysis = this.analyzePerformanceChanges(
        regressionResults.baseline,
        regressionResults.current
      );

      regressionResults.regressions = this.regressions;
      regressionResults.improvements = this.improvements;
      regressionResults.summary = this.generateRegressionSummary(regressionResults);

      // Save results
      await this.saveRegressionResults(regressionResults);

      // Update baseline if no critical regressions
      if (this.shouldUpdateBaseline(regressionResults)) {
        await this.updateBaseline(regressionResults.current);
      }

      const hasRegressions = regressionResults.regressions.length > 0;
      console.log(`${hasRegressions ? '⚠️' : '✅'} Regression testing completed`);

      if (hasRegressions) {
        console.log(`Found ${regressionResults.regressions.length} performance regressions`);
      } else {
        console.log('No performance regressions detected');
      }

      return regressionResults;

    } catch (error) {
      console.error('❌ Regression testing failed:', error);
      throw error;
    }
  }

  /**
   * Load baseline performance data
   */
  async loadBaseline() {
    try {
      const baselineContent = await fs.readFile(this.config.baselineFile, 'utf8');
      const baseline = JSON.parse(baselineContent);

      console.log(`  Loaded baseline from: ${this.config.baselineFile}`);
      console.log(`  Baseline date: ${baseline.timestamp || 'Unknown'}`);

      return baseline;

    } catch (error) {
      console.warn('  No baseline found, creating new baseline...');
      return null;
    }
  }

  /**
   * Run current performance tests
   */
  async runCurrentTests() {
    const testScenarios = [
      {
        name: 'search-basic',
        endpoint: '/api/search',
        params: { q: 'performance test' },
        importance: 'high'
      },
      {
        name: 'search-complex',
        endpoint: '/api/search',
        params: { q: 'complex query with filters', category: 'tech', sort: 'relevance' },
        importance: 'high'
      },
      {
        name: 'entry-detail',
        endpoint: '/api/entries/1',
        params: {},
        importance: 'medium'
      },
      {
        name: 'entry-list',
        endpoint: '/api/entries',
        params: { limit: 20 },
        importance: 'medium'
      },
      {
        name: 'category-list',
        endpoint: '/api/categories',
        params: {},
        importance: 'low'
      },
      {
        name: 'paginated-search',
        endpoint: '/api/search',
        params: { q: 'pagination test', page: 2, limit: 10 },
        importance: 'medium'
      }
    ];

    const currentResults = {
      timestamp: new Date().toISOString(),
      scenarios: {}
    };

    for (const scenario of testScenarios) {
      console.log(`  Testing scenario: ${scenario.name}`);

      const scenarioResults = await this.testScenarioPerformance(scenario);
      currentResults.scenarios[scenario.name] = scenarioResults;

      this.currentResults.set(scenario.name, scenarioResults);
    }

    return currentResults;
  }

  /**
   * Test single scenario performance
   */
  async testScenarioPerformance(scenario) {
    const measurements = [];
    const errors = [];

    // Warmup
    for (let i = 0; i < 5; i++) {
      try {
        await this.makeRequest(scenario.endpoint, scenario.params);
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Actual measurements
    for (let i = 0; i < this.config.iterations; i++) {
      try {
        const measurement = await this.measureRequest(scenario.endpoint, scenario.params);
        measurements.push(measurement);
      } catch (error) {
        errors.push({
          iteration: i,
          error: error.message,
          timestamp: Date.now()
        });
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }
    console.log(); // New line after progress

    // Calculate statistics
    const responseTimes = measurements.map(m => m.responseTime);
    const statistics = this.calculateStatistics(responseTimes);
    const percentiles = this.calculatePercentiles(responseTimes.sort((a, b) => a - b));

    return {
      scenario: scenario.name,
      importance: scenario.importance,
      measurements: measurements.length,
      errors: errors.length,
      statistics,
      percentiles,
      errorRate: (errors.length / (measurements.length + errors.length)) * 100,
      rawData: measurements
    };
  }

  /**
   * Measure single request
   */
  async measureRequest(endpoint, params) {
    const startTime = performance.now();

    try {
      const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
        params,
        timeout: 10000
      });

      const endTime = performance.now();

      return {
        responseTime: endTime - startTime,
        status: response.status,
        contentLength: response.headers['content-length'] || 0,
        success: true,
        timestamp: Date.now()
      };

    } catch (error) {
      const endTime = performance.now();

      throw {
        responseTime: endTime - startTime,
        error: error.message,
        status: error.response?.status || 0,
        success: false,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Make HTTP request
   */
  async makeRequest(endpoint, params) {
    return axios.get(`${this.config.baseUrl}${endpoint}`, {
      params,
      timeout: 5000
    });
  }

  /**
   * Analyze performance changes between baseline and current
   */
  analyzePerformanceChanges(baseline, current) {
    const analysis = {
      comparisons: {},
      overallChange: 0,
      significantChanges: [],
      statistics: {
        totalScenarios: 0,
        regressions: 0,
        improvements: 0,
        unchanged: 0
      }
    };

    if (!baseline || !baseline.scenarios) {
      console.log('  No baseline available for comparison');
      return analysis;
    }

    // Compare each scenario
    Object.keys(current.scenarios).forEach(scenarioName => {
      const currentScenario = current.scenarios[scenarioName];
      const baselineScenario = baseline.scenarios?.[scenarioName];

      if (!baselineScenario) {
        console.log(`  New scenario detected: ${scenarioName}`);
        return;
      }

      const comparison = this.compareScenarios(baselineScenario, currentScenario, scenarioName);
      analysis.comparisons[scenarioName] = comparison;
      analysis.statistics.totalScenarios++;

      // Categorize changes
      if (comparison.isRegression) {
        analysis.statistics.regressions++;
        this.regressions.push(comparison);
      } else if (comparison.isImprovement) {
        analysis.statistics.improvements++;
        this.improvements.push(comparison);
      } else {
        analysis.statistics.unchanged++;
      }

      // Track significant changes
      if (Math.abs(comparison.changePercent) >= this.config.improvementThreshold) {
        analysis.significantChanges.push(comparison);
      }
    });

    // Calculate overall performance change
    if (analysis.statistics.totalScenarios > 0) {
      const totalChange = Object.values(analysis.comparisons)
        .reduce((sum, comp) => sum + comp.changePercent, 0);
      analysis.overallChange = totalChange / analysis.statistics.totalScenarios;
    }

    return analysis;
  }

  /**
   * Compare two scenarios
   */
  compareScenarios(baseline, current, scenarioName) {
    const comparison = {
      scenario: scenarioName,
      importance: current.importance,
      baseline: {
        mean: baseline.statistics.mean,
        p95: baseline.percentiles.p95,
        p99: baseline.percentiles.p99
      },
      current: {
        mean: current.statistics.mean,
        p95: current.percentiles.p95,
        p99: current.percentiles.p99
      },
      changes: {},
      changePercent: 0,
      isRegression: false,
      isImprovement: false,
      isStatisticallySignificant: false
    };

    // Calculate changes for different metrics
    const metrics = ['mean', 'p95', 'p99'];
    metrics.forEach(metric => {
      const baseValue = comparison.baseline[metric];
      const currentValue = comparison.current[metric];

      if (baseValue && currentValue) {
        const change = ((currentValue - baseValue) / baseValue) * 100;
        comparison.changes[metric] = {
          absolute: currentValue - baseValue,
          percent: change
        };
      }
    });

    // Use P95 as primary metric for comparison
    comparison.changePercent = comparison.changes.p95?.percent || 0;

    // Determine if this is a regression or improvement
    if (comparison.changePercent > this.config.regressionThreshold) {
      comparison.isRegression = true;
      comparison.severity = this.calculateRegressionSeverity(comparison);
    } else if (comparison.changePercent < -this.config.improvementThreshold) {
      comparison.isImprovement = true;
    }

    // Statistical significance test
    comparison.isStatisticallySignificant = this.isStatisticallySignificant(
      baseline.rawData || [],
      current.rawData || []
    );

    return comparison;
  }

  /**
   * Calculate regression severity
   */
  calculateRegressionSeverity(comparison) {
    const changePercent = comparison.changePercent;
    const importance = comparison.importance;

    let severity = 'low';

    if (changePercent > 50) {
      severity = 'critical';
    } else if (changePercent > 30) {
      severity = 'high';
    } else if (changePercent > 20) {
      severity = 'medium';
    }

    // Upgrade severity for high importance scenarios
    if (importance === 'high' && severity === 'low') {
      severity = 'medium';
    } else if (importance === 'high' && severity === 'medium') {
      severity = 'high';
    }

    return severity;
  }

  /**
   * Test for statistical significance using t-test
   */
  isStatisticallySignificant(baseline, current) {
    if (baseline.length < 10 || current.length < 10) {
      return false; // Need sufficient samples
    }

    try {
      const baselineMean = baseline.reduce((sum, val) => sum + val.responseTime, 0) / baseline.length;
      const currentMean = current.reduce((sum, val) => sum + val.responseTime, 0) / current.length;

      const baselineVar = this.calculateVariance(baseline.map(b => b.responseTime), baselineMean);
      const currentVar = this.calculateVariance(current.map(c => c.responseTime), currentMean);

      // Welch's t-test
      const pooledSE = Math.sqrt((baselineVar / baseline.length) + (currentVar / current.length));
      const tScore = Math.abs(currentMean - baselineMean) / pooledSE;

      // Critical value for 95% confidence (approximately 2.0)
      return tScore > 2.0;

    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate variance
   */
  calculateVariance(values, mean) {
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate statistics
   */
  calculateStatistics(values) {
    if (values.length === 0) return { error: 'No data' };

    const sorted = values.sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }

  /**
   * Calculate percentiles
   */
  calculatePercentiles(sortedArray) {
    if (sortedArray.length === 0) return {};

    const percentiles = {};
    const levels = [50, 90, 95, 99];

    levels.forEach(p => {
      const index = Math.ceil((p / 100) * sortedArray.length) - 1;
      percentiles[`p${p}`] = sortedArray[Math.max(0, index)];
    });

    return percentiles;
  }

  /**
   * Generate regression summary
   */
  generateRegressionSummary(results) {
    const summary = {
      hasRegressions: results.regressions.length > 0,
      hasImprovements: results.improvements.length > 0,
      overallChange: results.analysis.overallChange,
      criticalRegressions: results.regressions.filter(r => r.severity === 'critical').length,
      highPriorityRegressions: results.regressions.filter(r => r.severity === 'high').length,
      recommendations: []
    };

    // Generate recommendations
    if (summary.criticalRegressions > 0) {
      summary.recommendations.push('URGENT: Critical performance regressions detected - immediate investigation required');
    }

    if (summary.highPriorityRegressions > 0) {
      summary.recommendations.push('High priority regressions found - schedule performance optimization work');
    }

    if (results.regressions.some(r => !r.isStatisticallySignificant)) {
      summary.recommendations.push('Some regressions may not be statistically significant - increase test iterations for better confidence');
    }

    if (summary.hasImprovements) {
      summary.recommendations.push('Performance improvements detected - consider updating baseline');
    }

    return summary;
  }

  /**
   * Should update baseline?
   */
  shouldUpdateBaseline(results) {
    // Don't update if there are critical regressions
    const criticalRegressions = results.regressions.filter(r => r.severity === 'critical');
    if (criticalRegressions.length > 0) {
      return false;
    }

    // Update if there are significant improvements
    const significantImprovements = results.improvements.filter(i =>
      Math.abs(i.changePercent) > this.config.improvementThreshold
    );

    return significantImprovements.length > 0;
  }

  /**
   * Update baseline with current results
   */
  async updateBaseline(currentResults) {
    console.log('📊 Updating performance baseline...');

    try {
      const baselineDir = path.dirname(this.config.baselineFile);
      await fs.mkdir(baselineDir, { recursive: true });

      await fs.writeFile(
        this.config.baselineFile,
        JSON.stringify(currentResults, null, 2)
      );

      console.log(`  Baseline updated: ${this.config.baselineFile}`);

    } catch (error) {
      console.error('  Failed to update baseline:', error.message);
    }
  }

  /**
   * Save regression test results
   */
  async saveRegressionResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `regression-test-${timestamp}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`📄 Regression test results saved to: ${filepath}`);

    // Save human-readable report
    await this.saveRegressionReport(results, timestamp);
  }

  /**
   * Save human-readable regression report
   */
  async saveRegressionReport(results, timestamp) {
    const report = this.generateRegressionReport(results);
    const filename = `regression-report-${timestamp}.txt`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, report);
    console.log(`📋 Regression report saved to: ${filepath}`);
  }

  /**
   * Generate human-readable regression report
   */
  generateRegressionReport(results) {
    let report = `Performance Regression Test Report
Generated: ${results.timestamp}
Overall Change: ${results.analysis.overallChange.toFixed(2)}%

SUMMARY:
- Total Scenarios: ${results.analysis.statistics.totalScenarios}
- Regressions: ${results.analysis.statistics.regressions}
- Improvements: ${results.analysis.statistics.improvements}
- Unchanged: ${results.analysis.statistics.unchanged}

`;

    if (results.regressions.length > 0) {
      report += `PERFORMANCE REGRESSIONS:\n`;
      results.regressions.forEach(regression => {
        report += `- ${regression.scenario} (${regression.importance}): ${regression.changePercent.toFixed(1)}% slower (${regression.severity})\n`;
        report += `  Baseline P95: ${regression.baseline.p95.toFixed(2)}ms → Current P95: ${regression.current.p95.toFixed(2)}ms\n`;
      });
      report += '\n';
    }

    if (results.improvements.length > 0) {
      report += `PERFORMANCE IMPROVEMENTS:\n`;
      results.improvements.forEach(improvement => {
        report += `- ${improvement.scenario}: ${Math.abs(improvement.changePercent).toFixed(1)}% faster\n`;
        report += `  Baseline P95: ${improvement.baseline.p95.toFixed(2)}ms → Current P95: ${improvement.current.p95.toFixed(2)}ms\n`;
      });
      report += '\n';
    }

    if (results.summary.recommendations.length > 0) {
      report += `RECOMMENDATIONS:\n`;
      results.summary.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
    }

    return report;
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    }
  }
}

module.exports = PerformanceRegressionTests;