/**
 * Regression Detection Algorithm
 * Advanced statistical analysis for performance regression detection
 */

const Stats = require('../utils/statistical-analysis');

class RegressionDetector {
  constructor(config = {}) {
    this.config = {
      // Thresholds for different severity levels
      thresholds: {
        performance: {
          warning: 15,    // 15% performance degradation
          critical: 30    // 30% performance degradation
        },
        memory: {
          warning: 20,    // 20% memory increase
          critical: 40    // 40% memory increase
        },
        reliability: {
          warning: 5,     // 5% success rate decrease
          critical: 10    // 10% success rate decrease
        },
        variability: {
          warning: 50,    // 50% increase in standard deviation
          critical: 100   // 100% increase in standard deviation
        }
      },
      
      // Statistical analysis parameters
      statistics: {
        confidenceLevel: 0.95,
        minSampleSize: 5,
        outlierThreshold: 2.0,  // Z-score threshold for outliers
        trendAnalysisWindow: 10 // Number of recent measurements for trend analysis
      },
      
      // Detection algorithms to use
      algorithms: {
        statistical: true,
        trend: true,
        changePoint: true,
        anomaly: true
      },
      
      ...config
    };
    
    this.stats = new Stats();
  }

  /**
   * Main regression detection method
   */
  async detectRegression(environment, testSuite, currentResult, baseline) {
    if (!baseline || !currentResult.statistics) {
      return {
        testSuite,
        environment,
        hasRegression: false,
        reason: 'No baseline or invalid current result'
      };
    }

    const analysis = {
      testSuite,
      environment,
      timestamp: new Date().toISOString(),
      baseline: baseline.statistics,
      current: currentResult.statistics,
      algorithms: {}
    };

    // Run different detection algorithms
    if (this.config.algorithms.statistical) {
      analysis.algorithms.statistical = await this.statisticalAnalysis(baseline, currentResult);
    }
    
    if (this.config.algorithms.trend) {
      analysis.algorithms.trend = await this.trendAnalysis(baseline, currentResult);
    }
    
    if (this.config.algorithms.changePoint) {
      analysis.algorithms.changePoint = await this.changePointDetection(baseline, currentResult);
    }
    
    if (this.config.algorithms.anomaly) {
      analysis.algorithms.anomaly = await this.anomalyDetection(baseline, currentResult);
    }

    // Combine results from all algorithms
    const combinedResult = this.combineDetectionResults(analysis);
    
    return {
      ...analysis,
      ...combinedResult,
      recommendations: this.generateRecommendations(combinedResult, analysis)
    };
  }

  /**
   * Statistical significance testing
   */
  async statisticalAnalysis(baseline, currentResult) {
    const baseStats = baseline.statistics;
    const currentStats = currentResult.statistics;
    
    const analysis = {
      duration: this.performStatisticalTest(baseStats.duration, currentStats.duration, 'duration'),
      memory: this.performStatisticalTest(baseStats.memory.heap, currentStats.memory.heap, 'memory'),
      reliability: this.performReliabilityTest(baseStats, currentStats)
    };
    
    // Calculate overall statistical significance
    const significantChanges = Object.values(analysis).filter(test => test.isSignificant);
    
    return {
      ...analysis,
      overallSignificance: significantChanges.length > 0,
      significantMetrics: significantChanges.map(test => test.metric),
      confidence: this.calculateOverallConfidence(analysis)
    };
  }

  /**
   * Perform statistical test for specific metric
   */
  performStatisticalTest(baselineMetric, currentMetric, metricName) {
    // Calculate percentage change
    const percentageChange = ((currentMetric.mean - baselineMetric.mean) / baselineMetric.mean) * 100;
    
    // Calculate effect size (Cohen's d)
    const pooledStdDev = Math.sqrt(
      ((baselineMetric.stdDev ** 2) + (currentMetric.stdDev ** 2)) / 2
    );
    const effectSize = Math.abs(currentMetric.mean - baselineMetric.mean) / pooledStdDev;
    
    // Determine significance based on effect size and percentage change
    const thresholds = this.config.thresholds[metricName === 'duration' ? 'performance' : metricName];
    const isSignificant = Math.abs(percentageChange) >= thresholds.warning && effectSize >= 0.5;
    
    // Calculate confidence interval
    const confidenceInterval = this.calculateConfidenceInterval(
      currentMetric.mean,
      currentMetric.stdDev,
      baseline.sampleSize
    );
    
    return {
      metric: metricName,
      percentageChange,
      effectSize,
      isSignificant,
      confidence: confidenceInterval,
      pValue: this.estimatePValue(effectSize),
      severity: this.determineSeverity(percentageChange, thresholds)
    };
  }

  /**
   * Reliability testing (success/error rates)
   */
  performReliabilityTest(baseStats, currentStats) {
    const successRateChange = currentStats.successRate - baseStats.successRate;
    const errorRateChange = currentStats.errorRate - baseStats.errorRate;
    
    const thresholds = this.config.thresholds.reliability;
    const isSignificant = Math.abs(successRateChange) >= thresholds.warning;
    
    return {
      metric: 'reliability',
      successRateChange,
      errorRateChange,
      isSignificant,
      severity: this.determineSeverity(Math.abs(successRateChange), thresholds)
    };
  }

  /**
   * Trend analysis over time
   */
  async trendAnalysis(baseline, currentResult) {
    // Simulate historical data analysis (in real implementation, this would use stored historical data)
    const trendData = this.simulateHistoricalTrend(baseline, currentResult);
    
    const trend = {
      direction: this.calculateTrendDirection(trendData),
      slope: this.calculateTrendSlope(trendData),
      correlation: this.calculateTrendCorrelation(trendData),
      volatility: this.calculateTrendVolatility(trendData)
    };
    
    const isDegradingTrend = trend.direction === 'degrading' && trend.correlation > 0.7;
    const isVolatile = trend.volatility > 0.3;
    
    return {
      ...trend,
      isDegradingTrend,
      isVolatile,
      riskLevel: this.assessTrendRisk(trend)
    };
  }

  /**
   * Change point detection
   */
  async changePointDetection(baseline, currentResult) {
    const currentMean = currentResult.statistics.duration.mean;
    const baselineMean = baseline.statistics.duration.mean;
    
    // CUSUM (Cumulative Sum) algorithm for change point detection
    const cusumResult = this.cusumTest(baselineMean, currentMean, baseline.statistics.duration.stdDev);
    
    // PELT (Pruned Exact Linear Time) simulation
    const peltResult = this.simulatePeltAnalysis(baseline, currentResult);
    
    return {
      cusum: cusumResult,
      pelt: peltResult,
      hasChangePoint: cusumResult.changeDetected || peltResult.changeDetected,
      confidence: Math.max(cusumResult.confidence, peltResult.confidence)
    };
  }

  /**
   * Anomaly detection using statistical methods
   */
  async anomalyDetection(baseline, currentResult) {
    const currentMean = currentResult.statistics.duration.mean;
    const baselineMean = baseline.statistics.duration.mean;
    const baselineStdDev = baseline.statistics.duration.stdDev;
    
    // Z-score based anomaly detection
    const zScore = Math.abs((currentMean - baselineMean) / baselineStdDev);
    const isOutlier = zScore > this.config.statistics.outlierThreshold;
    
    // IQR-based anomaly detection
    const iqrResult = this.iqrAnomalyDetection(baseline, currentResult);
    
    // Modified Z-score using MAD (Median Absolute Deviation)
    const madResult = this.madAnomalyDetection(baseline, currentResult);
    
    return {
      zScore: {
        value: zScore,
        isAnomaly: isOutlier,
        threshold: this.config.statistics.outlierThreshold
      },
      iqr: iqrResult,
      mad: madResult,
      isAnomaly: isOutlier || iqrResult.isAnomaly || madResult.isAnomaly,
      confidence: Math.max(zScore / 3, iqrResult.confidence, madResult.confidence)
    };
  }

  /**
   * Combine results from all detection algorithms
   */
  combineDetectionResults(analysis) {
    const algorithms = analysis.algorithms;
    const detections = [];
    
    // Collect all positive detections
    if (algorithms.statistical?.overallSignificance) {
      detections.push({
        algorithm: 'statistical',
        confidence: algorithms.statistical.confidence,
        severity: this.getMaxSeverity(algorithms.statistical)
      });
    }
    
    if (algorithms.trend?.isDegradingTrend) {
      detections.push({
        algorithm: 'trend',
        confidence: algorithms.trend.correlation,
        severity: algorithms.trend.riskLevel
      });
    }
    
    if (algorithms.changePoint?.hasChangePoint) {
      detections.push({
        algorithm: 'changePoint',
        confidence: algorithms.changePoint.confidence,
        severity: 'warning'
      });
    }
    
    if (algorithms.anomaly?.isAnomaly) {
      detections.push({
        algorithm: 'anomaly',
        confidence: algorithms.anomaly.confidence,
        severity: 'warning'
      });
    }
    
    // Determine overall result
    const isRegression = detections.length > 0;
    const isImprovement = this.detectImprovement(analysis);
    
    const overallSeverity = this.calculateOverallSeverity(detections);
    const overallConfidence = this.calculateCombinedConfidence(detections);
    
    return {
      isRegression,
      isImprovement,
      severity: overallSeverity,
      confidence: overallConfidence,
      detectionCount: detections.length,
      detectingAlgorithms: detections.map(d => d.algorithm),
      summary: this.generateDetectionSummary(detections, analysis)
    };
  }

  /**
   * Generate recommendations based on detected regressions
   */
  generateRecommendations(detectionResult, analysis) {
    const recommendations = [];
    
    if (detectionResult.isRegression) {
      if (detectionResult.severity === 'critical') {
        recommendations.push({
          priority: 'high',
          category: 'immediate_action',
          action: 'Investigate and fix critical performance regression immediately',
          details: 'Performance has degraded significantly beyond acceptable thresholds'
        });
      }
      
      // Specific recommendations based on affected metrics
      if (analysis.algorithms.statistical?.duration?.isSignificant) {
        recommendations.push({
          priority: 'medium',
          category: 'performance_optimization',
          action: 'Profile and optimize slow code paths',
          details: `Duration has increased by ${analysis.algorithms.statistical.duration.percentageChange.toFixed(1)}%`
        });
      }
      
      if (analysis.algorithms.statistical?.memory?.isSignificant) {
        recommendations.push({
          priority: 'medium',
          category: 'memory_optimization',
          action: 'Investigate memory leaks and optimize memory usage',
          details: `Memory usage has increased by ${analysis.algorithms.statistical.memory.percentageChange.toFixed(1)}%`
        });
      }
      
      if (analysis.algorithms.trend?.isDegradingTrend) {
        recommendations.push({
          priority: 'low',
          category: 'monitoring',
          action: 'Increase monitoring frequency and set up alerts',
          details: 'Degrading trend detected - performance is gradually getting worse'
        });
      }
    }
    
    if (detectionResult.isImprovement) {
      recommendations.push({
        priority: 'low',
        category: 'documentation',
        action: 'Document performance improvements and update baselines',
        details: 'Performance has improved - consider updating performance targets'
      });
    }
    
    return recommendations;
  }

  // Utility methods for statistical calculations
  
  calculateConfidenceInterval(mean, stdDev, sampleSize) {
    const tValue = 1.96; // 95% confidence level
    const margin = tValue * (stdDev / Math.sqrt(sampleSize));
    return {
      lower: mean - margin,
      upper: mean + margin,
      margin
    };
  }
  
  estimatePValue(effectSize) {
    // Simplified p-value estimation based on effect size
    if (effectSize >= 2.0) return 0.001;
    if (effectSize >= 1.5) return 0.01;
    if (effectSize >= 1.0) return 0.05;
    if (effectSize >= 0.5) return 0.1;
    return 0.5;
  }
  
  determineSeverity(percentageChange, thresholds) {
    const absChange = Math.abs(percentageChange);
    if (absChange >= thresholds.critical) return 'critical';
    if (absChange >= thresholds.warning) return 'warning';
    return 'normal';
  }
  
  simulateHistoricalTrend(baseline, current) {
    // Simulate trend data - in real implementation, use historical data
    const points = [];
    const baseValue = baseline.statistics.duration.mean;
    const currentValue = current.statistics.duration.mean;
    const steps = 10;
    
    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      const value = baseValue + (currentValue - baseValue) * progress;
      points.push({ timestamp: Date.now() - (steps - i) * 24 * 60 * 60 * 1000, value });
    }
    
    return points;
  }
  
  calculateTrendDirection(trendData) {
    if (trendData.length < 2) return 'unknown';
    const first = trendData[0].value;
    const last = trendData[trendData.length - 1].value;
    const change = (last - first) / first;
    
    if (change > 0.05) return 'degrading';
    if (change < -0.05) return 'improving';
    return 'stable';
  }
  
  calculateTrendSlope(trendData) {
    if (trendData.length < 2) return 0;
    
    const n = trendData.length;
    const sumX = trendData.reduce((sum, point, i) => sum + i, 0);
    const sumY = trendData.reduce((sum, point) => sum + point.value, 0);
    const sumXY = trendData.reduce((sum, point, i) => sum + i * point.value, 0);
    const sumXX = trendData.reduce((sum, point, i) => sum + i * i, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
  
  calculateTrendCorrelation(trendData) {
    if (trendData.length < 2) return 0;
    
    const indices = trendData.map((_, i) => i);
    const values = trendData.map(point => point.value);
    
    return this.stats.correlation(indices, values);
  }
  
  calculateTrendVolatility(trendData) {
    if (trendData.length < 2) return 0;
    
    const values = trendData.map(point => point.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }
  
  assessTrendRisk(trend) {
    if (trend.direction === 'degrading' && trend.correlation > 0.8) return 'high';
    if (trend.direction === 'degrading' && trend.correlation > 0.6) return 'medium';
    if (trend.isVolatile) return 'medium';
    return 'low';
  }
  
  cusumTest(baseline, current, stdDev) {
    const threshold = 2 * stdDev;
    const drift = Math.abs(current - baseline);
    const cusum = Math.max(0, drift - threshold);
    
    return {
      changeDetected: cusum > threshold,
      confidence: Math.min(1, cusum / threshold),
      drift,
      threshold
    };
  }
  
  simulatePeltAnalysis(baseline, current) {
    // Simplified PELT simulation
    const changeSignificance = Math.abs(current.statistics.duration.mean - baseline.statistics.duration.mean) / baseline.statistics.duration.stdDev;
    
    return {
      changeDetected: changeSignificance > 2.0,
      confidence: Math.min(1, changeSignificance / 3.0),
      significance: changeSignificance
    };
  }
  
  iqrAnomalyDetection(baseline, current) {
    // Simplified IQR calculation
    const q1 = baseline.statistics.duration.mean - baseline.statistics.duration.stdDev;
    const q3 = baseline.statistics.duration.mean + baseline.statistics.duration.stdDev;
    const iqr = q3 - q1;
    const currentValue = current.statistics.duration.mean;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const isAnomaly = currentValue < lowerBound || currentValue > upperBound;
    
    return {
      isAnomaly,
      confidence: isAnomaly ? Math.min(1, Math.abs(currentValue - baseline.statistics.duration.mean) / (2 * iqr)) : 0,
      bounds: { lower: lowerBound, upper: upperBound },
      currentValue
    };
  }
  
  madAnomalyDetection(baseline, current) {
    // Modified Z-score using MAD
    const median = baseline.statistics.duration.median;
    const mad = baseline.statistics.duration.stdDev * 0.6745; // Approximate MAD from stdDev
    const currentValue = current.statistics.duration.mean;
    
    const modifiedZScore = 0.6745 * (currentValue - median) / mad;
    const isAnomaly = Math.abs(modifiedZScore) > 3.5;
    
    return {
      isAnomaly,
      confidence: isAnomaly ? Math.min(1, Math.abs(modifiedZScore) / 5) : 0,
      modifiedZScore,
      threshold: 3.5
    };
  }
  
  detectImprovement(analysis) {
    const statistical = analysis.algorithms.statistical;
    if (!statistical) return false;
    
    // Check if there are significant improvements
    const improvements = Object.values(statistical)
      .filter(test => test.isSignificant && test.percentageChange < -10); // 10% improvement
    
    return improvements.length > 0;
  }
  
  getMaxSeverity(statisticalAnalysis) {
    const severities = Object.values(statisticalAnalysis)
      .map(test => test.severity)
      .filter(severity => severity);
    
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('warning')) return 'warning';
    return 'normal';
  }
  
  calculateOverallSeverity(detections) {
    const severities = detections.map(d => d.severity);
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('warning')) return 'warning';
    return 'normal';
  }
  
  calculateCombinedConfidence(detections) {
    if (detections.length === 0) return 0;
    
    // Use weighted average of confidences
    const totalConfidence = detections.reduce((sum, d) => sum + d.confidence, 0);
    return Math.min(1, totalConfidence / detections.length);
  }
  
  calculateOverallConfidence(analysis) {
    const confidences = Object.values(analysis)
      .map(test => test.confidence || 0)
      .filter(conf => conf > 0);
    
    if (confidences.length === 0) return 0;
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }
  
  generateDetectionSummary(detections, analysis) {
    const algorithms = detections.map(d => d.algorithm).join(', ');
    const maxSeverity = this.calculateOverallSeverity(detections);
    
    return {
      message: `Performance regression detected by ${algorithms}`,
      severity: maxSeverity,
      algorithmCount: detections.length,
      affectedMetrics: this.getAffectedMetrics(analysis)
    };
  }
  
  getAffectedMetrics(analysis) {
    const affected = [];
    
    if (analysis.algorithms.statistical?.duration?.isSignificant) {
      affected.push('duration');
    }
    if (analysis.algorithms.statistical?.memory?.isSignificant) {
      affected.push('memory');
    }
    if (analysis.algorithms.statistical?.reliability?.isSignificant) {
      affected.push('reliability');
    }
    
    return affected;
  }
}

module.exports = RegressionDetector;