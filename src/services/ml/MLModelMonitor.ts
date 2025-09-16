import { MLModel, ModelEvaluation } from '../../types/ml';

interface ModelMetrics {
  modelId: string;
  accuracy: number;
  latency: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  lastUpdated: Date;
  predictionCount: number;
  driftScore: number;
}

interface PerformanceTrend {
  metric: string;
  trend: 'improving' | 'degrading' | 'stable';
  changeRate: number;
  significance: number;
  timeWindow: string;
}

interface ModelAlert {
  modelId: string;
  type: 'performance_degradation' | 'drift_detected' | 'high_latency' | 'error_spike';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: Record<string, number>;
  recommendations: string[];
}

interface DriftDetectionResult {
  isDrift: boolean;
  driftScore: number;
  driftType: 'feature' | 'label' | 'concept';
  affectedFeatures: string[];
  recommendation: 'retrain' | 'monitor' | 'investigate';
}

export class MLModelMonitor {
  private modelMetrics: Map<string, ModelMetrics[]> = new Map();
  private alerts: ModelAlert[] = [];
  private driftDetectors: Map<string, any> = new Map();
  private performanceBaselines: Map<string, ModelMetrics> = new Map();

  constructor(private config: any = {}) {}

  async startMonitoring(modelId: string, model: MLModel): Promise<void> {
    console.log(`Starting monitoring for model: ${modelId}`);

    // Initialize monitoring for the model
    if (!this.modelMetrics.has(modelId)) {
      this.modelMetrics.set(modelId, []);
    }

    // Set up drift detector
    this.initializeDriftDetector(modelId, model);

    // Record initial baseline
    const baseline = await this.captureBaseline(modelId, model);
    this.performanceBaselines.set(modelId, baseline);
  }

  async recordPrediction(
    modelId: string,
    input: any,
    prediction: any,
    actualValue?: any,
    latency?: number
  ): Promise<void> {
    const timestamp = new Date();

    // Update prediction count and metrics
    await this.updateModelMetrics(modelId, {
      latency: latency || 0,
      timestamp,
      input,
      prediction,
      actualValue
    });

    // Check for drift
    if (actualValue !== undefined) {
      await this.checkForDrift(modelId, input, prediction, actualValue);
    }

    // Check for performance issues
    await this.checkPerformanceThresholds(modelId);
  }

  private async captureBaseline(modelId: string, model: MLModel): Promise<ModelMetrics> {
    return {
      modelId,
      accuracy: model.accuracy,
      latency: 50, // Initial baseline latency
      throughput: 100, // Initial baseline throughput
      errorRate: 0.01,
      memoryUsage: 100 * 1024 * 1024, // 100MB
      lastUpdated: new Date(),
      predictionCount: 0,
      driftScore: 0
    };
  }

  private initializeDriftDetector(modelId: string, model: MLModel): void {
    // Initialize simple drift detector
    const detector = {
      featureStats: new Map<string, { mean: number; std: number; samples: number[] }>(),
      labelDistribution: new Map<string, number>(),
      windowSize: 1000,
      driftThreshold: 0.1
    };

    this.driftDetectors.set(modelId, detector);
  }

  private async updateModelMetrics(modelId: string, predictionData: any): Promise<void> {
    const currentMetrics = this.getCurrentMetrics(modelId);

    // Update metrics
    const updatedMetrics: ModelMetrics = {
      ...currentMetrics,
      latency: this.updateMovingAverage(currentMetrics.latency, predictionData.latency, 0.1),
      predictionCount: currentMetrics.predictionCount + 1,
      lastUpdated: predictionData.timestamp
    };

    // Store metrics history
    const metricsHistory = this.modelMetrics.get(modelId) || [];
    metricsHistory.push(updatedMetrics);

    // Keep only recent metrics (last 1000 entries)
    if (metricsHistory.length > 1000) {
      metricsHistory.shift();
    }

    this.modelMetrics.set(modelId, metricsHistory);
  }

  private getCurrentMetrics(modelId: string): ModelMetrics {
    const metricsHistory = this.modelMetrics.get(modelId) || [];
    return metricsHistory[metricsHistory.length - 1] || this.performanceBaselines.get(modelId) || {
      modelId,
      accuracy: 0,
      latency: 0,
      throughput: 0,
      errorRate: 0,
      memoryUsage: 0,
      lastUpdated: new Date(),
      predictionCount: 0,
      driftScore: 0
    };
  }

  private updateMovingAverage(current: number, newValue: number, alpha: number): number {
    return alpha * newValue + (1 - alpha) * current;
  }

  private async checkForDrift(
    modelId: string,
    input: any,
    prediction: any,
    actualValue: any
  ): Promise<void> {
    const detector = this.driftDetectors.get(modelId);
    if (!detector) return;

    // Feature drift detection
    const featureDrift = await this.detectFeatureDrift(modelId, input, detector);

    // Label drift detection
    const labelDrift = await this.detectLabelDrift(modelId, actualValue, detector);

    // Concept drift detection (prediction vs actual)
    const conceptDrift = await this.detectConceptDrift(modelId, prediction, actualValue, detector);

    // Calculate overall drift score
    const driftScore = Math.max(featureDrift.driftScore, labelDrift.driftScore, conceptDrift.driftScore);

    // Update model metrics with drift score
    const currentMetrics = this.getCurrentMetrics(modelId);
    currentMetrics.driftScore = driftScore;

    // Generate alerts if drift detected
    if (driftScore > detector.driftThreshold) {
      await this.generateDriftAlert(modelId, {
        isDrift: true,
        driftScore,
        driftType: this.determineDriftType(featureDrift, labelDrift, conceptDrift),
        affectedFeatures: featureDrift.affectedFeatures || [],
        recommendation: driftScore > 0.3 ? 'retrain' : 'monitor'
      });
    }
  }

  private async detectFeatureDrift(modelId: string, input: any, detector: any): Promise<{
    driftScore: number;
    affectedFeatures: string[];
  }> {
    const features = this.extractFeatures(input);
    const affectedFeatures: string[] = [];
    let maxDrift = 0;

    for (const [featureName, value] of Object.entries(features)) {
      if (typeof value !== 'number') continue;

      if (!detector.featureStats.has(featureName)) {
        detector.featureStats.set(featureName, {
          mean: value,
          std: 0,
          samples: [value]
        });
        continue;
      }

      const stats = detector.featureStats.get(featureName)!;

      // Add new sample
      stats.samples.push(value);
      if (stats.samples.length > detector.windowSize) {
        stats.samples.shift();
      }

      // Update statistics
      const newMean = stats.samples.reduce((sum, val) => sum + val, 0) / stats.samples.length;
      const newStd = Math.sqrt(
        stats.samples.reduce((sum, val) => sum + Math.pow(val - newMean, 2), 0) / stats.samples.length
      );

      // Calculate drift using Kolmogorov-Smirnov-like test
      const drift = Math.abs(newMean - stats.mean) / (stats.std + 0.001); // Avoid division by zero

      if (drift > 2.0) { // 2-sigma threshold
        affectedFeatures.push(featureName);
        maxDrift = Math.max(maxDrift, drift / 5.0); // Normalize to 0-1 scale
      }

      // Update stored statistics
      stats.mean = newMean;
      stats.std = newStd;
    }

    return {
      driftScore: Math.min(maxDrift, 1.0),
      affectedFeatures
    };
  }

  private async detectLabelDrift(modelId: string, actualValue: any, detector: any): Promise<{
    driftScore: number;
  }> {
    const labelStr = String(actualValue);

    if (!detector.labelDistribution.has(labelStr)) {
      detector.labelDistribution.set(labelStr, 0);
    }

    detector.labelDistribution.set(labelStr, detector.labelDistribution.get(labelStr)! + 1);

    // Simple drift detection based on label distribution changes
    const totalSamples = Array.from(detector.labelDistribution.values())
      .reduce((sum, count) => sum + count, 0);

    if (totalSamples < 100) {
      return { driftScore: 0 }; // Not enough samples
    }

    // Calculate entropy to detect distribution changes
    const entropy = this.calculateEntropy(detector.labelDistribution, totalSamples);
    const expectedEntropy = Math.log2(detector.labelDistribution.size); // Uniform distribution

    const driftScore = Math.abs(entropy - expectedEntropy) / expectedEntropy;

    return { driftScore: Math.min(driftScore, 1.0) };
  }

  private async detectConceptDrift(
    modelId: string,
    prediction: any,
    actualValue: any,
    detector: any
  ): Promise<{ driftScore: number }> {
    // Simple accuracy-based concept drift detection
    const isCorrect = this.isPredictionCorrect(prediction, actualValue);

    // Maintain rolling accuracy window
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

    const recentAccuracy = detector.accuracyWindow.reduce((sum: number, val: number) => sum + val, 0) /
      detector.accuracyWindow.length;

    const baseline = this.performanceBaselines.get(modelId);
    if (!baseline) return { driftScore: 0 };

    const accuracyDrop = baseline.accuracy - recentAccuracy;
    const driftScore = Math.max(0, accuracyDrop * 2); // Scale accuracy drop to 0-1

    return { driftScore: Math.min(driftScore, 1.0) };
  }

  private extractFeatures(input: any): Record<string, any> {
    // Extract numerical features from input
    const features: Record<string, any> = {};

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

  private calculateEntropy(distribution: Map<string, number>, totalSamples: number): number {
    let entropy = 0;

    for (const count of distribution.values()) {
      if (count > 0) {
        const probability = count / totalSamples;
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  private isPredictionCorrect(prediction: any, actualValue: any): boolean {
    // Simple equality check (can be enhanced for different data types)
    if (typeof prediction === 'number' && typeof actualValue === 'number') {
      return Math.abs(prediction - actualValue) < 0.1; // Tolerance for numerical values
    }

    return String(prediction) === String(actualValue);
  }

  private determineDriftType(featureDrift: any, labelDrift: any, conceptDrift: any): DriftDetectionResult['driftType'] {
    const maxDrift = Math.max(featureDrift.driftScore, labelDrift.driftScore, conceptDrift.driftScore);

    if (conceptDrift.driftScore === maxDrift) return 'concept';
    if (labelDrift.driftScore === maxDrift) return 'label';
    return 'feature';
  }

  private async generateDriftAlert(modelId: string, driftResult: DriftDetectionResult): Promise<void> {
    const alert: ModelAlert = {
      modelId,
      type: 'drift_detected',
      severity: driftResult.driftScore > 0.5 ? 'high' : 'medium',
      message: `${driftResult.driftType} drift detected with score ${driftResult.driftScore.toFixed(3)}`,
      timestamp: new Date(),
      metrics: {
        drift_score: driftResult.driftScore,
        affected_features: driftResult.affectedFeatures.length
      },
      recommendations: this.getDriftRecommendations(driftResult)
    };

    this.alerts.push(alert);
    console.warn(`DRIFT ALERT: ${alert.message}`);
  }

  private getDriftRecommendations(driftResult: DriftDetectionResult): string[] {
    const recommendations: string[] = [];

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

  private async checkPerformanceThresholds(modelId: string): Promise<void> {
    const currentMetrics = this.getCurrentMetrics(modelId);
    const baseline = this.performanceBaselines.get(modelId);

    if (!baseline) return;

    // Check latency threshold
    if (currentMetrics.latency > baseline.latency * 2) {
      await this.generatePerformanceAlert(modelId, 'high_latency', {
        current_latency: currentMetrics.latency,
        baseline_latency: baseline.latency
      });
    }

    // Check error rate threshold
    if (currentMetrics.errorRate > baseline.errorRate * 3) {
      await this.generatePerformanceAlert(modelId, 'error_spike', {
        current_error_rate: currentMetrics.errorRate,
        baseline_error_rate: baseline.errorRate
      });
    }
  }

  private async generatePerformanceAlert(
    modelId: string,
    type: ModelAlert['type'],
    metrics: Record<string, number>
  ): Promise<void> {
    const alert: ModelAlert = {
      modelId,
      type,
      severity: 'medium',
      message: `Performance issue detected: ${type}`,
      timestamp: new Date(),
      metrics,
      recommendations: this.getPerformanceRecommendations(type)
    };

    this.alerts.push(alert);
    console.warn(`PERFORMANCE ALERT: ${alert.message}`);
  }

  private getPerformanceRecommendations(type: ModelAlert['type']): string[] {
    switch (type) {
      case 'high_latency':
        return [
          'Check server resources and scaling',
          'Optimize model inference code',
          'Consider model compression techniques'
        ];
      case 'error_spike':
        return [
          'Check input data quality',
          'Review recent model or code changes',
          'Monitor system dependencies'
        ];
      default:
        return ['Investigate the performance issue'];
    }
  }

  async getModelHealth(modelId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: ModelMetrics;
    recentAlerts: ModelAlert[];
    trends: PerformanceTrend[];
  }> {
    const currentMetrics = this.getCurrentMetrics(modelId);
    const recentAlerts = this.alerts
      .filter(alert => alert.modelId === modelId)
      .filter(alert => Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000) // Last 24 hours
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const trends = await this.calculatePerformanceTrends(modelId);

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (recentAlerts.some(alert => alert.severity === 'critical')) {
      status = 'critical';
    } else if (recentAlerts.some(alert => alert.severity === 'high') || currentMetrics.driftScore > 0.3) {
      status = 'warning';
    }

    return {
      status,
      metrics: currentMetrics,
      recentAlerts,
      trends
    };
  }

  private async calculatePerformanceTrends(modelId: string): Promise<PerformanceTrend[]> {
    const metricsHistory = this.modelMetrics.get(modelId) || [];

    if (metricsHistory.length < 10) {
      return [];
    }

    const trends: PerformanceTrend[] = [];
    const recentMetrics = metricsHistory.slice(-50); // Last 50 measurements

    // Calculate trends for key metrics
    const metrics = ['accuracy', 'latency', 'errorRate', 'driftScore'] as const;

    for (const metric of metrics) {
      const values = recentMetrics.map(m => m[metric]);
      const trend = this.calculateTrend(values);

      trends.push({
        metric,
        trend: trend.slope > 0.01 ? 'improving' : trend.slope < -0.01 ? 'degrading' : 'stable',
        changeRate: trend.slope,
        significance: trend.r2,
        timeWindow: '50 measurements'
      });
    }

    return trends;
  }

  private calculateTrend(values: number[]): { slope: number; r2: number } {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = values.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = x.reduce((sum, xi, i) => {
      const predicted = slope * xi + (sumY - slope * sumX) / n;
      return sum + Math.pow(values[i] - predicted, 2);
    }, 0);

    const r2 = 1 - (ssResidual / ssTotal);

    return { slope, r2 };
  }

  getAlerts(modelId?: string): ModelAlert[] {
    if (modelId) {
      return this.alerts.filter(alert => alert.modelId === modelId);
    }
    return this.alerts;
  }

  clearAlerts(modelId?: string): void {
    if (modelId) {
      this.alerts = this.alerts.filter(alert => alert.modelId !== modelId);
    } else {
      this.alerts = [];
    }
  }

  getModelMetrics(modelId: string): ModelMetrics[] {
    return this.modelMetrics.get(modelId) || [];
  }
}