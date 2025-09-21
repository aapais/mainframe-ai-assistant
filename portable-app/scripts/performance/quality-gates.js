#!/usr/bin/env node

/**
 * Performance Quality Gates Validator
 * Evaluates performance test results against defined quality gates
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

class PerformanceQualityGates {
  constructor(config, results) {
    this.config = config;
    this.results = results;
    this.environment = process.env.NODE_ENV || 'development';
    this.gateResults = {
      passed: false,
      score: 0,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        regressions: 0
      },
      gates: {},
      metrics: [],
      impact: {
        overall: 'none',
        details: []
      },
      recommendations: []
    };
  }

  /**
   * Run all quality gate validations
   */
  async validate() {
    console.log('🚀 Running Performance Quality Gates...');

    for (const [gateName, gateConfig] of Object.entries(this.config.gates)) {
      if (!gateConfig.enabled) {
        console.log(`⏭️  Skipping disabled gate: ${gateName}`);
        continue;
      }

      console.log(`🔍 Evaluating gate: ${gateName}`);
      const gateResult = await this.evaluateGate(gateName, gateConfig);
      this.gateResults.gates[gateName] = gateResult;

      this.updateSummary(gateResult);
      this.updateMetrics(gateName, gateResult);
    }

    this.calculateOverallScore();
    this.determineImpact();
    this.generateRecommendations();

    console.log(`\n📊 Quality Gates Summary:`);
    console.log(`   Overall Status: ${this.gateResults.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Score: ${this.gateResults.score.toFixed(1)}%`);
    console.log(`   Passed: ${this.gateResults.summary.passed}/${this.gateResults.summary.total}`);
    console.log(`   Regressions: ${this.gateResults.summary.regressions}`);

    return this.gateResults;
  }

  /**
   * Evaluate individual quality gate
   */
  async evaluateGate(gateName, gateConfig) {
    const gateResult = {
      name: gateName,
      passed: true,
      score: 100,
      weight: gateConfig.weight,
      critical: gateConfig.critical,
      thresholds: {},
      violations: [],
      regressions: []
    };

    // Apply environment multipliers
    const multipliers = this.config.environments[this.environment]?.multipliers || {};
    const multiplier = multipliers[gateName] || 1.0;

    for (const [thresholdName, thresholdConfig] of Object.entries(gateConfig.thresholds)) {
      const thresholdResult = this.evaluateThreshold(
        gateName,
        thresholdName,
        thresholdConfig,
        multiplier
      );

      gateResult.thresholds[thresholdName] = thresholdResult;

      if (!thresholdResult.passed) {
        gateResult.passed = false;
        gateResult.violations.push(thresholdResult);
      }

      if (thresholdResult.isRegression) {
        gateResult.regressions.push(thresholdResult);
      }

      // Update gate score
      gateResult.score = Math.min(gateResult.score, thresholdResult.score);
    }

    return gateResult;
  }

  /**
   * Evaluate individual threshold
   */
  evaluateThreshold(gateName, thresholdName, thresholdConfig, multiplier) {
    const metricPath = `${gateName}.${thresholdName}`;
    const currentValue = this.getMetricValue(metricPath);
    const baselineValue = this.getBaselineValue(metricPath);

    const result = {
      name: thresholdName,
      passed: true,
      score: 100,
      current: currentValue,
      baseline: baselineValue,
      threshold: thresholdConfig,
      multiplier: multiplier,
      isRegression: false,
      impact: 'none'
    };

    if (currentValue === null || currentValue === undefined) {
      result.passed = false;
      result.score = 0;
      result.violation = 'Metric not found';
      return result;
    }

    // Apply environment multiplier to thresholds
    const adjustedThresholds = this.applyMultiplier(thresholdConfig, multiplier);

    // Check absolute thresholds
    const absoluteCheck = this.checkAbsoluteThresholds(currentValue, adjustedThresholds);
    if (!absoluteCheck.passed) {
      result.passed = false;
      result.score = absoluteCheck.score;
      result.violation = absoluteCheck.violation;
    }

    // Check regression thresholds
    if (baselineValue !== null && baselineValue !== undefined) {
      const regressionCheck = this.checkRegressionThresholds(
        currentValue,
        baselineValue,
        adjustedThresholds
      );

      if (regressionCheck.isRegression) {
        result.isRegression = true;
        result.impact = regressionCheck.impact;

        if (regressionCheck.significant) {
          result.passed = false;
          result.score = Math.min(result.score, regressionCheck.score);
          result.violation = regressionCheck.violation;
        }
      }
    }

    return result;
  }

  /**
   * Get metric value from results
   */
  getMetricValue(metricPath) {
    const pathParts = metricPath.split('.');
    let value = this.results;

    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Get baseline value for comparison
   */
  getBaselineValue(metricPath) {
    if (!this.results.baseline) return null;

    const pathParts = metricPath.split('.');
    let value = this.results.baseline;

    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Apply environment multiplier to thresholds
   */
  applyMultiplier(thresholdConfig, multiplier) {
    const adjusted = { ...thresholdConfig };

    if ('max_ms' in adjusted) adjusted.max_ms *= multiplier;
    if ('max_percent' in adjusted) adjusted.max_percent *= multiplier;
    if ('max_mb' in adjusted) adjusted.max_mb *= multiplier;
    if ('max_kb' in adjusted) adjusted.max_kb *= multiplier;
    if ('min' in adjusted) adjusted.min /= multiplier;

    return adjusted;
  }

  /**
   * Check absolute thresholds
   */
  checkAbsoluteThresholds(currentValue, thresholds) {
    const result = { passed: true, score: 100, violation: null };

    if ('max_ms' in thresholds && currentValue > thresholds.max_ms) {
      const ratio = currentValue / thresholds.max_ms;
      result.passed = false;
      result.score = Math.max(0, 100 - (ratio - 1) * 100);
      result.violation = `Response time ${currentValue}ms exceeds limit ${thresholds.max_ms}ms`;
    }

    if ('max_percent' in thresholds && currentValue > thresholds.max_percent) {
      const ratio = currentValue / thresholds.max_percent;
      result.passed = false;
      result.score = Math.max(0, 100 - (ratio - 1) * 100);
      result.violation = `Value ${currentValue}% exceeds limit ${thresholds.max_percent}%`;
    }

    if ('max_mb' in thresholds && currentValue > thresholds.max_mb) {
      const ratio = currentValue / thresholds.max_mb;
      result.passed = false;
      result.score = Math.max(0, 100 - (ratio - 1) * 100);
      result.violation = `Memory usage ${currentValue}MB exceeds limit ${thresholds.max_mb}MB`;
    }

    if ('max_kb' in thresholds && currentValue > thresholds.max_kb) {
      const ratio = currentValue / thresholds.max_kb;
      result.passed = false;
      result.score = Math.max(0, 100 - (ratio - 1) * 100);
      result.violation = `Size ${currentValue}KB exceeds limit ${thresholds.max_kb}KB`;
    }

    if ('min' in thresholds && currentValue < thresholds.min) {
      const ratio = thresholds.min / currentValue;
      result.passed = false;
      result.score = Math.max(0, 100 - (ratio - 1) * 100);
      result.violation = `Value ${currentValue} below minimum ${thresholds.min}`;
    }

    return result;
  }

  /**
   * Check regression thresholds
   */
  checkRegressionThresholds(currentValue, baselineValue, thresholds) {
    const result = {
      isRegression: false,
      significant: false,
      impact: 'none',
      score: 100,
      violation: null
    };

    if (!('regression_threshold' in thresholds)) {
      return result;
    }

    const changePercent = ((currentValue - baselineValue) / baselineValue) * 100;
    const threshold = thresholds.regression_threshold;

    // Determine if this is a regression based on metric type
    let isRegression = false;
    if ('max_ms' in thresholds || 'max_percent' in thresholds || 'max_mb' in thresholds || 'max_kb' in thresholds) {
      // Higher values are bad
      isRegression = changePercent > threshold;
    } else if ('min' in thresholds) {
      // Lower values are bad
      isRegression = Math.abs(changePercent) > threshold && changePercent < 0;
    }

    if (isRegression) {
      result.isRegression = true;
      result.impact = this.categorizeImpact(Math.abs(changePercent));

      if (Math.abs(changePercent) > threshold * 2) {
        result.significant = true;
        result.score = Math.max(0, 100 - Math.abs(changePercent));
        result.violation = `Significant regression detected: ${changePercent.toFixed(1)}% change`;
      }
    }

    return result;
  }

  /**
   * Categorize performance impact
   */
  categorizeImpact(changePercent) {
    if (changePercent < 5) return 'minimal';
    if (changePercent < 15) return 'moderate';
    if (changePercent < 30) return 'significant';
    return 'severe';
  }

  /**
   * Update summary statistics
   */
  updateSummary(gateResult) {
    this.gateResults.summary.total++;

    if (gateResult.passed) {
      this.gateResults.summary.passed++;
    } else {
      this.gateResults.summary.failed++;
    }

    if (gateResult.regressions.length > 0) {
      this.gateResults.summary.regressions += gateResult.regressions.length;
    }
  }

  /**
   * Update metrics array for reporting
   */
  updateMetrics(gateName, gateResult) {
    for (const [thresholdName, thresholdResult] of Object.entries(gateResult.thresholds)) {
      if (thresholdResult.current !== null && thresholdResult.current !== undefined) {
        const change = thresholdResult.baseline !== null
          ? ((thresholdResult.current - thresholdResult.baseline) / thresholdResult.baseline) * 100
          : 0;

        this.gateResults.metrics.push({
          name: `${gateName}.${thresholdName}`,
          current: thresholdResult.current,
          baseline: thresholdResult.baseline,
          change: change,
          status: thresholdResult.passed ? 'pass' : 'fail',
          impact: thresholdResult.impact
        });
      }
    }
  }

  /**
   * Calculate overall quality gate score
   */
  calculateOverallScore() {
    let totalWeight = 0;
    let weightedScore = 0;
    let criticalFailures = 0;

    for (const gateResult of Object.values(this.gateResults.gates)) {
      totalWeight += gateResult.weight;
      weightedScore += gateResult.score * gateResult.weight;

      if (gateResult.critical && !gateResult.passed) {
        criticalFailures++;
      }
    }

    this.gateResults.score = totalWeight > 0 ? weightedScore / totalWeight : 0;

    // Fail if any critical gates fail or overall score is too low
    const minScore = 70; // Configurable minimum score
    this.gateResults.passed = criticalFailures === 0 && this.gateResults.score >= minScore;
  }

  /**
   * Determine overall performance impact
   */
  determineImpact() {
    const regressions = this.gateResults.summary.regressions;
    const failed = this.gateResults.summary.failed;

    if (regressions === 0 && failed === 0) {
      this.gateResults.impact.overall = 'none';
    } else if (failed === 0 && regressions > 0) {
      // Check if regressions are improvements
      const improvements = this.gateResults.metrics.filter(m =>
        m.change < 0 && (m.name.includes('response_time') || m.name.includes('memory') || m.name.includes('bundle'))
      ).length;

      if (improvements > regressions / 2) {
        this.gateResults.impact.overall = 'improvement';
      } else {
        this.gateResults.impact.overall = 'regression';
      }
    } else {
      this.gateResults.impact.overall = 'degradation';
    }

    // Add impact details
    for (const metric of this.gateResults.metrics) {
      if (metric.status === 'fail' || Math.abs(metric.change) > 10) {
        this.gateResults.impact.details.push({
          metric: metric.name,
          impact: metric.impact,
          change: metric.change
        });
      }
    }
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Analyze failed gates for recommendations
    for (const [gateName, gateResult] of Object.entries(this.gateResults.gates)) {
      if (!gateResult.passed) {
        recommendations.push(...this.getGateRecommendations(gateName, gateResult));
      }
    }

    // Add general recommendations based on regressions
    if (this.gateResults.summary.regressions > 0) {
      recommendations.push({
        type: 'regression',
        priority: 'high',
        message: 'Performance regressions detected. Consider reverting recent changes or optimizing affected areas.'
      });
    }

    this.gateResults.recommendations = recommendations;
  }

  /**
   * Get recommendations for specific gate failures
   */
  getGateRecommendations(gateName, gateResult) {
    const recommendations = [];

    switch (gateName) {
      case 'response_time':
        recommendations.push({
          type: 'optimization',
          priority: 'high',
          message: 'Response time exceeded thresholds. Consider optimizing database queries, adding caching, or reducing payload sizes.'
        });
        break;

      case 'throughput':
        recommendations.push({
          type: 'scaling',
          priority: 'high',
          message: 'Throughput below expectations. Consider horizontal scaling, connection pooling, or load balancing improvements.'
        });
        break;

      case 'resource_usage':
        recommendations.push({
          type: 'resource',
          priority: 'medium',
          message: 'Resource usage is high. Review memory leaks, optimize algorithms, or increase resource allocation.'
        });
        break;

      case 'error_rates':
        recommendations.push({
          type: 'reliability',
          priority: 'critical',
          message: 'Error rates exceed acceptable levels. Investigate error causes and improve error handling.'
        });
        break;

      case 'bundle_size':
        recommendations.push({
          type: 'optimization',
          priority: 'medium',
          message: 'Bundle size is too large. Consider code splitting, tree shaking, or dependency optimization.'
        });
        break;
    }

    return recommendations;
  }
}

// CLI interface
program
  .name('quality-gates')
  .description('Validate performance results against quality gates')
  .requiredOption('-c, --config <path>', 'Quality gates configuration file')
  .requiredOption('-r, --results <path>', 'Performance results file')
  .requiredOption('-o, --output <path>', 'Output file for quality gate results')
  .option('-e, --environment <env>', 'Environment (development, staging, production)', 'development')
  .action(async (options) => {
    try {
      console.log('🚀 Performance Quality Gates Validator');
      console.log(`📁 Config: ${options.config}`);
      console.log(`📊 Results: ${options.results}`);
      console.log(`🌍 Environment: ${options.environment}`);

      // Load configuration and results
      const config = JSON.parse(fs.readFileSync(options.config, 'utf8'));
      const results = JSON.parse(fs.readFileSync(options.results, 'utf8'));

      // Set environment
      process.env.NODE_ENV = options.environment;

      // Run quality gates
      const validator = new PerformanceQualityGates(config, results);
      const gateResults = await validator.validate();

      // Save results
      fs.writeFileSync(options.output, JSON.stringify(gateResults, null, 2));

      // Set GitHub Actions output
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::set-output name=passed::${gateResults.passed}`);
        console.log(`::set-output name=score::${gateResults.score}`);
        console.log(`::set-output name=regressions::${gateResults.summary.regressions}`);
      }

      // Exit with appropriate code
      process.exit(gateResults.passed ? 0 : 1);

    } catch (error) {
      console.error('❌ Quality gates validation failed:', error.message);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}

module.exports = PerformanceQualityGates;