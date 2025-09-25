'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MLModelMonitor = void 0;
class MLModelMonitor {
  config;
  modelMetrics = new Map();
  alerts = [];
  driftDetectors = new Map();
  performanceBaselines = new Map();
  constructor(config = {}) {
    this.config = config;
  }
  async startMonitoring(modelId, model) {
    console.log(`Starting monitoring for model: ${modelId}`);
    if (!this.modelMetrics.has(modelId)) {
      this.modelMetrics.set(modelId, []);
    }
    this.initializeDriftDetector(modelId, model);
    const baseline = await this.captureBaseline(modelId, model);
    this.performanceBaselines.set(modelId, baseline);
  }
  async recordPrediction(modelId, input, prediction, actualValue, latency) {
    const timestamp = new Date();
    await this.updateModelMetrics(modelId, {
      latency: latency || 0,
      timestamp,
      input,
      prediction,
      actualValue,
    });
    if (actualValue !== undefined) {
      await this.checkForDrift(modelId, input, prediction, actualValue);
    }
    await this.checkPerformanceThresholds(modelId);
  }
  async captureBaseline(modelId, model) {
    return {
      modelId,
      accuracy: model.accuracy,
      latency: 50,
      throughput: 100,
      errorRate: 0.01,
      memoryUsage: 100 * 1024 * 1024,
      lastUpdated: new Date(),
      predictionCount: 0,
      driftScore: 0,
    };
  }
  initializeDriftDetector(modelId, model) {
    const detector = {
      featureStats: new Map(),
      labelDistribution: new Map(),
      windowSize: 1000,
      driftThreshold: 0.1,
    };
    this.driftDetectors.set(modelId, detector);
  }
  async updateModelMetrics(modelId, predictionData) {
    const currentMetrics = this.getCurrentMetrics(modelId);
    const updatedMetrics = {
      ...currentMetrics,
      latency: this.updateMovingAverage(currentMetrics.latency, predictionData.latency, 0.1),
      predictionCount: currentMetrics.predictionCount + 1,
      lastUpdated: predictionData.timestamp,
    };
    const metricsHistory = this.modelMetrics.get(modelId) || [];
    metricsHistory.push(updatedMetrics);
    if (metricsHistory.length > 1000) {
      metricsHistory.shift();
    }
    this.modelMetrics.set(modelId, metricsHistory);
  }
  getCurrentMetrics(modelId) {
    const metricsHistory = this.modelMetrics.get(modelId) || [];
    return (
      metricsHistory[metricsHistory.length - 1] ||
      this.performanceBaselines.get(modelId) || {
        modelId,
        accuracy: 0,
        latency: 0,
        throughput: 0,
        errorRate: 0,
        memoryUsage: 0,
        lastUpdated: new Date(),
        predictionCount: 0,
        driftScore: 0,
      }
    );
  }
  updateMovingAverage(current, newValue, alpha) {
    return alpha * newValue + (1 - alpha) * current;
  }
  async checkForDrift(modelId, input, prediction, actualValue) {
    const detector = this.driftDetectors.get(modelId);
    if (!detector) return;
    const featureDrift = await this.detectFeatureDrift(modelId, input, detector);
    const labelDrift = await this.detectLabelDrift(modelId, actualValue, detector);
    const conceptDrift = await this.detectConceptDrift(modelId, prediction, actualValue, detector);
    const driftScore = Math.max(
      featureDrift.driftScore,
      labelDrift.driftScore,
      conceptDrift.driftScore
    );
    const currentMetrics = this.getCurrentMetrics(modelId);
    currentMetrics.driftScore = driftScore;
    if (driftScore > detector.driftThreshold) {
      await this.generateDriftAlert(modelId, {
        isDrift: true,
        driftScore,
        driftType: this.determineDriftType(featureDrift, labelDrift, conceptDrift),
        affectedFeatures: featureDrift.affectedFeatures || [],
        recommendation: driftScore > 0.3 ? 'retrain' : 'monitor',
      });
    }
  }
  async detectFeatureDrift(modelId, input, detector) {
    const features = this.extractFeatures(input);
    const affectedFeatures = [];
    let maxDrift = 0;
    for (const [featureName, value] of Object.entries(features)) {
      if (typeof value !== 'number') continue;
      if (!detector.featureStats.has(featureName)) {
        detector.featureStats.set(featureName, {
          mean: value,
          std: 0,
          samples: [value],
        });
        continue;
      }
      const stats = detector.featureStats.get(featureName);
      stats.samples.push(value);
      if (stats.samples.length > detector.windowSize) {
        stats.samples.shift();
      }
      const newMean = stats.samples.reduce((sum, val) => sum + val, 0) / stats.samples.length;
      const newStd = Math.sqrt(
        stats.samples.reduce((sum, val) => sum + Math.pow(val - newMean, 2), 0) /
          stats.samples.length
      );
      const drift = Math.abs(newMean - stats.mean) / (stats.std + 0.001);
      if (drift > 2.0) {
        affectedFeatures.push(featureName);
        maxDrift = Math.max(maxDrift, drift / 5.0);
      }
      stats.mean = newMean;
      stats.std = newStd;
    }
    return {
      driftScore: Math.min(maxDrift, 1.0),
      affectedFeatures,
    };
  }
  async detectLabelDrift(modelId, actualValue, detector) {
    const labelStr = String(actualValue);
    if (!detector.labelDistribution.has(labelStr)) {
      detector.labelDistribution.set(labelStr, 0);
    }
    detector.labelDistribution.set(labelStr, detector.labelDistribution.get(labelStr) + 1);
    const totalSamples = Array.from(detector.labelDistribution.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    if (totalSamples < 100) {
      return { driftScore: 0 };
    }
    const entropy = this.calculateEntropy(detector.labelDistribution, totalSamples);
    const expectedEntropy = Math.log2(detector.labelDistribution.size);
    const driftScore = Math.abs(entropy - expectedEntropy) / expectedEntropy;
    return { driftScore: Math.min(driftScore, 1.0) };
  }
  async detectConceptDrift(modelId, prediction, actualValue, detector) {
    const isCorrect = this.isPredictionCorrect(prediction, actualValue);
    if (!detector.accuracyWindow) {
      detector.accuracyWindow = [];
    }
    detector.accuracyWindow.push(isCorrect ? 1 : 0);
    if (detector.accuracyWindow.length > detector.windowSize) {
      detector.accuracyWindow.shift();
    }
    if (detector.accuracyWindow.length < 50) {
      return { driftScore: 0 };
    }
    const recentAccuracy =
      detector.accuracyWindow.reduce((sum, val) => sum + val, 0) / detector.accuracyWindow.length;
    const baseline = this.performanceBaselines.get(modelId);
    if (!baseline) return { driftScore: 0 };
    const accuracyDrop = baseline.accuracy - recentAccuracy;
    const driftScore = Math.max(0, accuracyDrop * 2);
    return { driftScore: Math.min(driftScore, 1.0) };
  }
  extractFeatures(input) {
    const features = {};
    if (typeof input === 'object' && input !== null) {
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'number') {
          features[key] = value;
        } else if (typeof value === 'string') {
          features[`${key}_length`] = value.length;
        } else if (Array.isArray(value)) {
          features[`${key}_count`] = value.length;
        }
      }
    }
    return features;
  }
  calculateEntropy(distribution, totalSamples) {
    let entropy = 0;
    for (const count of distribution.values()) {
      if (count > 0) {
        const probability = count / totalSamples;
        entropy -= probability * Math.log2(probability);
      }
    }
    return entropy;
  }
  isPredictionCorrect(prediction, actualValue) {
    if (typeof prediction === 'number' && typeof actualValue === 'number') {
      return Math.abs(prediction - actualValue) < 0.1;
    }
    return String(prediction) === String(actualValue);
  }
  determineDriftType(featureDrift, labelDrift, conceptDrift) {
    const maxDrift = Math.max(
      featureDrift.driftScore,
      labelDrift.driftScore,
      conceptDrift.driftScore
    );
    if (conceptDrift.driftScore === maxDrift) return 'concept';
    if (labelDrift.driftScore === maxDrift) return 'label';
    return 'feature';
  }
  async generateDriftAlert(modelId, driftResult) {
    const alert = {
      modelId,
      type: 'drift_detected',
      severity: driftResult.driftScore > 0.5 ? 'high' : 'medium',
      message: `${driftResult.driftType} drift detected with score ${driftResult.driftScore.toFixed(3)}`,
      timestamp: new Date(),
      metrics: {
        drift_score: driftResult.driftScore,
        affected_features: driftResult.affectedFeatures.length,
      },
      recommendations: this.getDriftRecommendations(driftResult),
    };
    this.alerts.push(alert);
    console.warn(`DRIFT ALERT: ${alert.message}`);
  }
  getDriftRecommendations(driftResult) {
    const recommendations = [];
    switch (driftResult.recommendation) {
      case 'retrain':
        recommendations.push('Retrain the model with recent data');
        recommendations.push('Evaluate model performance on new data distribution');
        break;
      case 'monitor':
        recommendations.push('Continue monitoring for drift progression');
        recommendations.push('Collect more data to confirm drift pattern');
        break;
      case 'investigate':
        recommendations.push('Investigate data quality issues');
        recommendations.push('Check for external factors affecting input distribution');
        break;
    }
    if (driftResult.affectedFeatures.length > 0) {
      recommendations.push(`Focus on features: ${driftResult.affectedFeatures.join(', ')}`);
    }
    return recommendations;
  }
  async checkPerformanceThresholds(modelId) {
    const currentMetrics = this.getCurrentMetrics(modelId);
    const baseline = this.performanceBaselines.get(modelId);
    if (!baseline) return;
    if (currentMetrics.latency > baseline.latency * 2) {
      await this.generatePerformanceAlert(modelId, 'high_latency', {
        current_latency: currentMetrics.latency,
        baseline_latency: baseline.latency,
      });
    }
    if (currentMetrics.errorRate > baseline.errorRate * 3) {
      await this.generatePerformanceAlert(modelId, 'error_spike', {
        current_error_rate: currentMetrics.errorRate,
        baseline_error_rate: baseline.errorRate,
      });
    }
  }
  async generatePerformanceAlert(modelId, type, metrics) {
    const alert = {
      modelId,
      type,
      severity: 'medium',
      message: `Performance issue detected: ${type}`,
      timestamp: new Date(),
      metrics,
      recommendations: this.getPerformanceRecommendations(type),
    };
    this.alerts.push(alert);
    console.warn(`PERFORMANCE ALERT: ${alert.message}`);
  }
  getPerformanceRecommendations(type) {
    switch (type) {
      case 'high_latency':
        return [
          'Check server resources and scaling',
          'Optimize model inference code',
          'Consider model compression techniques',
        ];
      case 'error_spike':
        return [
          'Check input data quality',
          'Review recent model or code changes',
          'Monitor system dependencies',
        ];
      default:
        return ['Investigate the performance issue'];
    }
  }
  async getModelHealth(modelId) {
    const currentMetrics = this.getCurrentMetrics(modelId);
    const recentAlerts = this.alerts
      .filter(alert => alert.modelId === modelId)
      .filter(alert => Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const trends = await this.calculatePerformanceTrends(modelId);
    let status = 'healthy';
    if (recentAlerts.some(alert => alert.severity === 'critical')) {
      status = 'critical';
    } else if (
      recentAlerts.some(alert => alert.severity === 'high') ||
      currentMetrics.driftScore > 0.3
    ) {
      status = 'warning';
    }
    return {
      status,
      metrics: currentMetrics,
      recentAlerts,
      trends,
    };
  }
  async calculatePerformanceTrends(modelId) {
    const metricsHistory = this.modelMetrics.get(modelId) || [];
    if (metricsHistory.length < 10) {
      return [];
    }
    const trends = [];
    const recentMetrics = metricsHistory.slice(-50);
    const metrics = ['accuracy', 'latency', 'errorRate', 'driftScore'];
    for (const metric of metrics) {
      const values = recentMetrics.map(m => m[metric]);
      const trend = this.calculateTrend(values);
      trends.push({
        metric,
        trend: trend.slope > 0.01 ? 'improving' : trend.slope < -0.01 ? 'degrading' : 'stable',
        changeRate: trend.slope,
        significance: trend.r2,
        timeWindow: '50 measurements',
      });
    }
    return trends;
  }
  calculateTrend(values) {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = values.reduce((sum, val) => sum + val * val, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = x.reduce((sum, xi, i) => {
      const predicted = slope * xi + (sumY - slope * sumX) / n;
      return sum + Math.pow(values[i] - predicted, 2);
    }, 0);
    const r2 = 1 - ssResidual / ssTotal;
    return { slope, r2 };
  }
  getAlerts(modelId) {
    if (modelId) {
      return this.alerts.filter(alert => alert.modelId === modelId);
    }
    return this.alerts;
  }
  clearAlerts(modelId) {
    if (modelId) {
      this.alerts = this.alerts.filter(alert => alert.modelId !== modelId);
    } else {
      this.alerts = [];
    }
  }
  getModelMetrics(modelId) {
    return this.modelMetrics.get(modelId) || [];
  }
}
exports.MLModelMonitor = MLModelMonitor;
//# sourceMappingURL=MLModelMonitor.js.map
