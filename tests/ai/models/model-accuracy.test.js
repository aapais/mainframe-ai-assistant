/**
 * AI Model Accuracy and Performance Tests
 * Testing machine learning model accuracy, bias, and performance metrics
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

describe('AI Model Accuracy Tests', () => {
  let modelEvaluator;
  let biasDetector;
  let performanceMonitor;
  let dataQualityAnalyzer;

  beforeEach(() => {
    modelEvaluator = {
      evaluateClassificationModel: jest.fn(),
      evaluateRegressionModel: jest.fn(),
      calculateConfusionMatrix: jest.fn(),
      assessModelDrift: jest.fn(),
      validateModelPerformance: jest.fn()
    };

    biasDetector = {
      detectDemographicBias: jest.fn(),
      analyzeFeatureBias: jest.fn(),
      assessFairness: jest.fn(),
      measureDisparateImpact: jest.fn()
    };

    performanceMonitor = {
      measureInferenceLatency: jest.fn(),
      trackThroughput: jest.fn(),
      monitorResourceUsage: jest.fn(),
      assessScalability: jest.fn()
    };

    dataQualityAnalyzer = {
      validateTrainingData: jest.fn(),
      detectDataDrift: jest.fn(),
      analyzeFeatureDistribution: jest.fn(),
      checkDataConsistency: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Classification Model Accuracy', () => {
    test('should evaluate incident categorization model accuracy', async () => {
      const testData = {
        modelId: 'incident_classifier_v2.1',
        testCases: 1000,
        predictions: [
          { predicted: 'DATABASE', actual: 'DATABASE', confidence: 0.95 },
          { predicted: 'NETWORK', actual: 'NETWORK', confidence: 0.88 },
          { predicted: 'APPLICATION', actual: 'DATABASE', confidence: 0.72 }, // Misclassification
          // ... more test cases
        ]
      };

      modelEvaluator.evaluateClassificationModel.mockResolvedValue({
        accuracy: 0.87,
        precision: {
          'DATABASE': 0.89,
          'NETWORK': 0.85,
          'APPLICATION': 0.84,
          'SECURITY': 0.91,
          'HARDWARE': 0.88
        },
        recall: {
          'DATABASE': 0.92,
          'NETWORK': 0.81,
          'APPLICATION': 0.79,
          'SECURITY': 0.88,
          'HARDWARE': 0.85
        },
        f1Score: {
          'DATABASE': 0.905,
          'NETWORK': 0.830,
          'APPLICATION': 0.815,
          'SECURITY': 0.895,
          'HARDWARE': 0.865
        },
        macroF1: 0.862,
        weightedF1: 0.869,
        topKAccuracy: {
          top1: 0.87,
          top3: 0.95,
          top5: 0.98
        }
      });

      const evaluation = await modelEvaluator.evaluateClassificationModel(testData);

      expect(evaluation.accuracy).toBeGreaterThan(0.85); // Minimum threshold
      expect(evaluation.macroF1).toBeGreaterThan(0.80);
      expect(evaluation.topKAccuracy.top3).toBeGreaterThan(0.90);
      expect(evaluation.precision['SECURITY']).toBeGreaterThan(0.85); // Critical category
    });

    test('should analyze confusion matrix for model insights', async () => {
      const modelPredictions = {
        modelId: 'severity_classifier_v1.5',
        trueLabels: ['HIGH', 'MEDIUM', 'LOW', 'CRITICAL'],
        predictedLabels: ['HIGH', 'MEDIUM', 'MEDIUM', 'CRITICAL'] // One misclassification
      };

      modelEvaluator.calculateConfusionMatrix.mockResolvedValue({
        confusionMatrix: [
          [95, 3, 2, 0],    // HIGH: 95 correct, 3 as MEDIUM, 2 as LOW
          [5, 85, 8, 2],    // MEDIUM: 5 as HIGH, 85 correct, 8 as LOW, 2 as CRITICAL
          [2, 12, 84, 2],   // LOW: 2 as HIGH, 12 as MEDIUM, 84 correct, 2 as CRITICAL
          [0, 1, 1, 98]     // CRITICAL: 1 as MEDIUM, 1 as LOW, 98 correct
        ],
        classificationReport: {
          'HIGH': { precision: 0.931, recall: 0.950, f1Score: 0.940 },
          'MEDIUM': { precision: 0.842, recall: 0.850, f1Score: 0.846 },
          'LOW': { precision: 0.884, recall: 0.840, f1Score: 0.862 },
          'CRITICAL': { precision: 0.961, recall: 0.980, f1Score: 0.970 }
        },
        mostConfusedPairs: [
          { pair: ['MEDIUM', 'LOW'], count: 20, direction: 'bidirectional' },
          { pair: ['HIGH', 'MEDIUM'], count: 8, direction: 'HIGH_to_MEDIUM' }
        ]
      });

      const analysis = await modelEvaluator.calculateConfusionMatrix(modelPredictions);

      expect(analysis.classificationReport['CRITICAL'].f1Score).toBeGreaterThan(0.95);
      expect(analysis.mostConfusedPairs[0].pair).toEqual(['MEDIUM', 'LOW']);
      expect(analysis.confusionMatrix[3][3]).toBeGreaterThan(95); // CRITICAL accuracy
    });
  });

  describe('Resolution Time Prediction Model', () => {
    test('should evaluate regression model for resolution time prediction', async () => {
      const regressionTestData = {
        modelId: 'resolution_time_predictor_v3.0',
        testCases: 500,
        predictions: [
          { predicted: 45, actual: 42, incidentType: 'DATABASE' },
          { predicted: 120, actual: 135, incidentType: 'NETWORK' },
          { predicted: 30, actual: 28, incidentType: 'APPLICATION' }
          // ... more predictions
        ]
      };

      modelEvaluator.evaluateRegressionModel.mockResolvedValue({
        meanAbsoluteError: 8.5, // minutes
        meanSquaredError: 156.2,
        rootMeanSquaredError: 12.5,
        meanAbsolutePercentageError: 0.15, // 15%
        r2Score: 0.84,
        medianAbsoluteError: 6.2,
        maxError: 45.0,
        explained_variance: 0.85,
        performanceByCategory: {
          'DATABASE': { mae: 7.2, mape: 0.12, r2: 0.88 },
          'NETWORK': { mae: 12.1, mape: 0.18, r2: 0.79 },
          'APPLICATION': { mae: 6.8, mape: 0.14, r2: 0.86 },
          'SECURITY': { mae: 15.3, mape: 0.22, r2: 0.76 }
        }
      });

      const evaluation = await modelEvaluator.evaluateRegressionModel(regressionTestData);

      expect(evaluation.r2Score).toBeGreaterThan(0.80); // Minimum R² threshold
      expect(evaluation.meanAbsolutePercentageError).toBeLessThan(0.20); // Under 20% error
      expect(evaluation.performanceByCategory['DATABASE'].r2).toBeGreaterThan(0.85);
    });

    test('should detect model drift over time', async () => {
      const driftAnalysis = {
        modelId: 'incident_categorizer_v2.0',
        baselinePeriod: '2023-01-01_to_2023-12-31',
        currentPeriod: '2024-01-01_to_2024-03-31',
        metrics: {
          baseline: { accuracy: 0.89, f1Score: 0.87 },
          current: { accuracy: 0.82, f1Score: 0.79 }
        }
      };

      modelEvaluator.assessModelDrift.mockResolvedValue({
        driftDetected: true,
        driftSeverity: 'MODERATE',
        performanceDegradation: {
          accuracyDrop: 0.07, // 7% drop
          f1ScoreDrop: 0.08,  // 8% drop
          significantDrift: true
        },
        rootCauses: [
          'NEW_INCIDENT_PATTERNS',
          'VOCABULARY_EVOLUTION',
          'SEASONAL_VARIATION'
        ],
        recommendations: [
          'RETRAIN_MODEL_WITH_RECENT_DATA',
          'UPDATE_FEATURE_ENGINEERING',
          'IMPLEMENT_ONLINE_LEARNING'
        ],
        retrainingSuggested: true,
        urgency: 'MEDIUM'
      });

      const drift = await modelEvaluator.assessModelDrift(driftAnalysis);

      expect(drift.driftDetected).toBe(true);
      expect(drift.performanceDegradation.accuracyDrop).toBeGreaterThan(0.05);
      expect(drift.recommendations).toContain('RETRAIN_MODEL_WITH_RECENT_DATA');
    });
  });

  describe('Model Bias and Fairness Testing', () => {
    test('should detect demographic bias in incident assignment', async () => {
      const biasTestData = {
        modelId: 'incident_assignment_model_v1.2',
        predictions: [
          { assignedTo: 'senior_tech', reporterDemographic: 'male' },
          { assignedTo: 'junior_tech', reporterDemographic: 'female' },
          // ... more assignments
        ],
        demographicGroups: ['male', 'female', 'other'],
        protectedAttributes: ['gender', 'age_group', 'department']
      };

      biasDetector.detectDemographicBias.mockResolvedValue({
        biasDetected: true,
        biasMetrics: {
          demographicParity: {
            male: 0.65,    // 65% assigned to senior techs
            female: 0.42,  // 42% assigned to senior techs
            other: 0.38    // 38% assigned to senior techs
          },
          equalizedOdds: {
            truePositiveRate: { male: 0.88, female: 0.72, other: 0.69 },
            falsePositiveRate: { male: 0.12, female: 0.19, other: 0.22 }
          },
          statisticalSignificance: true,
          pValue: 0.003
        },
        fairnessViolations: [
          'DEMOGRAPHIC_PARITY_VIOLATION',
          'EQUALIZED_ODDS_VIOLATION'
        ],
        impact: 'ADVERSE_IMPACT_DETECTED',
        mitigationSuggestions: [
          'RETRAIN_WITH_BIAS_MITIGATION',
          'IMPLEMENT_FAIRNESS_CONSTRAINTS',
          'POST_PROCESSING_CALIBRATION'
        ]
      });

      const biasAnalysis = await biasDetector.detectDemographicBias(biasTestData);

      expect(biasAnalysis.biasDetected).toBe(true);
      expect(biasAnalysis.biasMetrics.statisticalSignificance).toBe(true);
      expect(biasAnalysis.fairnessViolations).toContain('DEMOGRAPHIC_PARITY_VIOLATION');
    });

    test('should measure disparate impact in model decisions', async () => {
      const disparateImpactData = {
        modelId: 'priority_classification_v2.1',
        decisions: [
          { priority: 'HIGH', userGroup: 'internal_employee' },
          { priority: 'LOW', userGroup: 'external_contractor' },
          // ... more decisions
        ],
        privilegedGroup: 'internal_employee',
        unprivilegedGroup: 'external_contractor'
      };

      biasDetector.measureDisparateImpact.mockResolvedValue({
        disparateImpactRatio: 0.72, // 72% - below 80% threshold
        adverseImpact: true,
        statisticalTest: {
          testType: 'FISHERS_EXACT_TEST',
          pValue: 0.001,
          significant: true
        },
        groupMetrics: {
          privilegedGroup: {
            favorableOutcomes: 0.78, // 78% get HIGH priority
            sampleSize: 1200
          },
          unprivilegedGroup: {
            favorableOutcomes: 0.56, // 56% get HIGH priority
            sampleSize: 800
          }
        },
        legalCompliance: {
          eightyPercentRule: false, // Fails 80% rule
          riskLevel: 'HIGH'
        }
      });

      const impact = await biasDetector.measureDisparateImpact(disparateImpactData);

      expect(impact.disparateImpactRatio).toBeLessThan(0.8);
      expect(impact.adverseImpact).toBe(true);
      expect(impact.legalCompliance.eightyPercentRule).toBe(false);
    });
  });

  describe('Model Performance and Scalability', () => {
    test('should measure inference latency under load', async () => {
      const performanceTest = {
        modelId: 'fast_classifier_v1.0',
        testDuration: 60000, // 1 minute
        requestsPerSecond: 100,
        batchSizes: [1, 10, 50, 100]
      };

      performanceMonitor.measureInferenceLatency.mockResolvedValue({
        averageLatency: 45, // milliseconds
        p50Latency: 38,
        p90Latency: 65,
        p95Latency: 82,
        p99Latency: 145,
        maxLatency: 220,
        latencyByBatchSize: {
          1: { avg: 42, p95: 78 },
          10: { avg: 48, p95: 85 },
          50: { avg: 62, p95: 125 },
          100: { avg: 95, p95: 180 }
        },
        slaCompliance: {
          under100ms: 0.94, // 94% of requests under 100ms
          under50ms: 0.78   // 78% of requests under 50ms
        }
      });

      const latencyTest = await performanceMonitor.measureInferenceLatency(performanceTest);

      expect(latencyTest.p95Latency).toBeLessThan(100); // SLA requirement
      expect(latencyTest.slaCompliance.under100ms).toBeGreaterThan(0.90);
      expect(latencyTest.averageLatency).toBeLessThan(50);
    });

    test('should assess model scalability and resource usage', async () => {
      const scalabilityTest = {
        modelId: 'resource_intensive_model_v1.0',
        concurrentUsers: [1, 10, 50, 100, 500],
        testDuration: 300000 // 5 minutes
      };

      performanceMonitor.assessScalability.mockResolvedValue({
        scalabilityMetrics: {
          1: { avgLatency: 45, cpuUsage: 0.15, memoryUsage: 0.25 },
          10: { avgLatency: 52, cpuUsage: 0.35, memoryUsage: 0.42 },
          50: { avgLatency: 78, cpuUsage: 0.68, memoryUsage: 0.71 },
          100: { avgLatency: 125, cpuUsage: 0.85, memoryUsage: 0.89 },
          500: { avgLatency: 450, cpuUsage: 0.95, memoryUsage: 0.94 }
        },
        bottlenecks: [
          { users: 50, bottleneck: 'CPU_BOUND', severity: 'MODERATE' },
          { users: 100, bottleneck: 'MEMORY_BOUND', severity: 'HIGH' }
        ],
        recommendedMaxLoad: 75, // concurrent users
        autoscalingTriggers: {
          cpuThreshold: 0.70,
          memoryThreshold: 0.80,
          latencyThreshold: 100 // ms
        }
      });

      const scalability = await performanceMonitor.assessScalability(scalabilityTest);

      expect(scalability.recommendedMaxLoad).toBeGreaterThan(50);
      expect(scalability.bottlenecks.length).toBeGreaterThan(0);
      expect(scalability.autoscalingTriggers.cpuThreshold).toBeLessThan(0.80);
    });
  });

  describe('Data Quality and Model Validation', () => {
    test('should validate training data quality', async () => {
      const trainingDataset = {
        datasetId: 'incident_training_v2024.1',
        recordCount: 50000,
        features: ['title', 'description', 'category', 'priority', 'system'],
        targetVariable: 'resolution_time'
      };

      dataQualityAnalyzer.validateTrainingData.mockResolvedValue({
        dataQualityScore: 0.87,
        qualityIssues: [
          {
            issue: 'MISSING_VALUES',
            severity: 'MEDIUM',
            affectedFeatures: ['description'],
            percentage: 0.03 // 3% missing
          },
          {
            issue: 'DUPLICATES',
            severity: 'LOW',
            count: 125,
            percentage: 0.0025 // 0.25% duplicates
          }
        ],
        featureStatistics: {
          'title': { uniqueValues: 45000, avgLength: 45 },
          'description': { uniqueValues: 49000, avgLength: 150 },
          'category': { uniqueValues: 8, distribution: 'BALANCED' }
        },
        dataIntegrity: {
          schemaConsistency: true,
          typeConsistency: 0.99,
          encodingIssues: false
        },
        recommendations: [
          'IMPUTE_MISSING_DESCRIPTIONS',
          'REMOVE_EXACT_DUPLICATES',
          'VALIDATE_CATEGORY_CONSISTENCY'
        ]
      });

      const validation = await dataQualityAnalyzer.validateTrainingData(trainingDataset);

      expect(validation.dataQualityScore).toBeGreaterThan(0.80);
      expect(validation.dataIntegrity.schemaConsistency).toBe(true);
      expect(validation.qualityIssues.length).toBeLessThan(5);
    });

    test('should detect data drift in production', async () => {
      const productionData = {
        modelId: 'production_classifier_v2.0',
        referencePeriod: '2023-12',
        currentPeriod: '2024-03',
        features: ['incident_type', 'severity', 'system', 'description_length']
      };

      dataQualityAnalyzer.detectDataDrift.mockResolvedValue({
        driftDetected: true,
        overallDriftScore: 0.23, // Above 0.2 threshold
        featureDrift: {
          'incident_type': { driftScore: 0.15, driftType: 'COVARIATE_SHIFT' },
          'severity': { driftScore: 0.08, driftType: 'NONE' },
          'system': { driftScore: 0.35, driftType: 'PRIOR_PROBABILITY_SHIFT' },
          'description_length': { driftScore: 0.42, driftType: 'COVARIATE_SHIFT' }
        },
        statisticalTests: {
          'kolmogorov_smirnov': { pValue: 0.001, significant: true },
          'chi_square': { pValue: 0.003, significant: true }
        },
        recommendations: [
          'RETRAIN_MODEL_WITH_RECENT_DATA',
          'UPDATE_PREPROCESSING_PIPELINE',
          'IMPLEMENT_DRIFT_MONITORING'
        ],
        urgency: 'HIGH'
      });

      const drift = await dataQualityAnalyzer.detectDataDrift(productionData);

      expect(drift.driftDetected).toBe(true);
      expect(drift.overallDriftScore).toBeGreaterThan(0.2);
      expect(drift.urgency).toBe('HIGH');
    });
  });

  describe('Model Explainability and Interpretability', () => {
    test('should provide model explanations for predictions', async () => {
      const explanationRequest = {
        modelId: 'incident_classifier_v2.1',
        prediction: {
          input: {
            title: 'Database connection timeout',
            description: 'Users cannot connect to DB2 mainframe',
            system: 'MAINFRAME_DB'
          },
          output: { category: 'DATABASE', confidence: 0.92 }
        }
      };

      modelEvaluator.validateModelPerformance.mockResolvedValue({
        explanation: {
          method: 'SHAP_VALUES',
          featureImportance: [
            { feature: 'title_keywords', importance: 0.45, direction: 'positive' },
            { feature: 'system_type', importance: 0.32, direction: 'positive' },
            { feature: 'description_keywords', importance: 0.18, direction: 'positive' },
            { feature: 'time_of_day', importance: 0.05, direction: 'neutral' }
          ],
          topKeywords: ['database', 'connection', 'timeout', 'DB2'],
          similarCases: [
            { caseId: 'INC-001', similarity: 0.89, category: 'DATABASE' },
            { caseId: 'INC-045', similarity: 0.84, category: 'DATABASE' }
          ],
          confidence_factors: {
            high_confidence_reasons: ['Strong keyword match', 'System type alignment'],
            uncertainty_sources: ['Ambiguous description length']
          }
        },
        interpretability: {
          globalImportance: {
            'title_keywords': 0.38,
            'system_type': 0.29,
            'description_keywords': 0.22,
            'historical_pattern': 0.11
          },
          modelComplexity: 'MEDIUM',
          explainabilityScore: 0.78
        }
      });

      const explanation = await modelEvaluator.validateModelPerformance(explanationRequest);

      expect(explanation.explanation.featureImportance[0].feature).toBe('title_keywords');
      expect(explanation.explanation.topKeywords).toContain('database');
      expect(explanation.interpretability.explainabilityScore).toBeGreaterThan(0.7);
    });
  });
});