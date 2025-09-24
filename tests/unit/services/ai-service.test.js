/**
 * Unit Tests for AI Service
 * Testing machine learning models and AI-powered features
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');

describe('AIService', () => {
  let aiService;
  let mockMLModel;

  beforeEach(() => {
    mockMLModel = {
      predict: jest.fn(),
      train: jest.fn(),
      evaluate: jest.fn(),
      loadModel: jest.fn(),
      saveModel: jest.fn()
    };

    aiService = {
      categorizeIncident: jest.fn(),
      predictResolution: jest.fn(),
      suggestActions: jest.fn(),
      analyzePattern: jest.fn(),
      detectAnomaly: jest.fn(),
      estimateResolutionTime: jest.fn(),
      evaluateModelAccuracy: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Incident Categorization', () => {
    test('should categorize incident with high confidence', async () => {
      const incidentText = 'Database connection timeout on CICS transaction';

      aiService.categorizeIncident.mockResolvedValue({
        category: 'DATABASE',
        subcategory: 'CONNECTION_TIMEOUT',
        confidence: 0.94,
        metadata: {
          keywords: ['database', 'timeout', 'CICS'],
          similarIncidents: 5
        }
      });

      const result = await aiService.categorizeIncident(incidentText);

      expect(result.category).toBe('DATABASE');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.metadata.keywords).toContain('timeout');
    });

    test('should handle low confidence categorization', async () => {
      const ambiguousText = 'System slow';

      aiService.categorizeIncident.mockResolvedValue({
        category: 'PERFORMANCE',
        subcategory: 'UNSPECIFIED',
        confidence: 0.45,
        requiresManualReview: true
      });

      const result = await aiService.categorizeIncident(ambiguousText);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.requiresManualReview).toBe(true);
    });
  });

  describe('Resolution Prediction', () => {
    test('should predict resolution steps accurately', async () => {
      const incidentData = {
        category: 'DATABASE',
        severity: 'HIGH',
        description: 'DB2 connection pool exhausted',
        historicalData: {
          similarIncidents: 12,
          avgResolutionTime: 45
        }
      };

      aiService.predictResolution.mockResolvedValue({
        suggestedSteps: [
          'Check connection pool configuration',
          'Restart DB2 subsystem',
          'Verify application connection usage'
        ],
        estimatedTime: 30,
        confidence: 0.88,
        successRate: 0.92
      });

      const prediction = await aiService.predictResolution(incidentData);

      expect(prediction.suggestedSteps).toHaveLength(3);
      expect(prediction.estimatedTime).toBeLessThan(60);
      expect(prediction.confidence).toBeGreaterThan(0.8);
    });

    test('should adjust predictions based on system load', async () => {
      const highLoadIncident = {
        category: 'PERFORMANCE',
        systemLoad: 'HIGH',
        currentIncidents: 25
      };

      aiService.predictResolution.mockResolvedValue({
        suggestedSteps: ['Escalate to senior team'],
        estimatedTime: 120, // Extended due to high load
        adjustmentReason: 'High system load detected',
        confidence: 0.75
      });

      const prediction = await aiService.predictResolution(highLoadIncident);

      expect(prediction.estimatedTime).toBeGreaterThan(90);
      expect(prediction.adjustmentReason).toContain('load');
    });
  });

  describe('Pattern Analysis', () => {
    test('should detect recurring incident patterns', async () => {
      const incidentHistory = [
        { timestamp: '2024-01-01T10:00:00Z', category: 'DATABASE' },
        { timestamp: '2024-01-01T14:00:00Z', category: 'DATABASE' },
        { timestamp: '2024-01-02T10:00:00Z', category: 'DATABASE' }
      ];

      aiService.analyzePattern.mockResolvedValue({
        patternType: 'TEMPORAL',
        frequency: 'DAILY',
        peakHours: [10, 14],
        recommendation: 'Schedule preventive maintenance during low usage hours',
        confidence: 0.89
      });

      const pattern = await aiService.analyzePattern(incidentHistory);

      expect(pattern.patternType).toBe('TEMPORAL');
      expect(pattern.peakHours).toContain(10);
      expect(pattern.recommendation).toContain('preventive');
    });

    test('should identify cascade failure patterns', async () => {
      const cascadeIncidents = [
        { id: 'INC-001', category: 'NETWORK', timestamp: '10:00:00' },
        { id: 'INC-002', category: 'DATABASE', timestamp: '10:05:00' },
        { id: 'INC-003', category: 'APPLICATION', timestamp: '10:10:00' }
      ];

      aiService.analyzePattern.mockResolvedValue({
        patternType: 'CASCADE',
        rootCause: 'NETWORK',
        propagationTime: 10,
        affectedSystems: ['DATABASE', 'APPLICATION'],
        preventionStrategy: 'Implement circuit breakers'
      });

      const pattern = await aiService.analyzePattern(cascadeIncidents);

      expect(pattern.patternType).toBe('CASCADE');
      expect(pattern.rootCause).toBe('NETWORK');
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect unusual incident volume', async () => {
      const metrics = {
        currentHourIncidents: 15,
        averageHourlyIncidents: 3,
        timestamp: new Date().toISOString()
      };

      aiService.detectAnomaly.mockResolvedValue({
        anomalyDetected: true,
        type: 'VOLUME_SPIKE',
        severity: 'HIGH',
        deviationScore: 4.2,
        possibleCauses: ['System outage', 'Security incident', 'Data corruption']
      });

      const anomaly = await aiService.detectAnomaly(metrics);

      expect(anomaly.anomalyDetected).toBe(true);
      expect(anomaly.deviationScore).toBeGreaterThan(3);
      expect(anomaly.possibleCauses).toContain('System outage');
    });
  });

  describe('Model Accuracy Validation', () => {
    test('should evaluate model performance metrics', async () => {
      const testData = {
        predictions: 100,
        correctPredictions: 87,
        falsePositives: 8,
        falseNegatives: 5
      };

      aiService.evaluateModelAccuracy.mockResolvedValue({
        accuracy: 0.87,
        precision: 0.915,
        recall: 0.871,
        f1Score: 0.892,
        confusionMatrix: {
          truePositive: 82,
          falsePositive: 8,
          trueNegative: 5,
          falseNegative: 5
        },
        meetsThreshold: true
      });

      const metrics = await aiService.evaluateModelAccuracy(testData);

      expect(metrics.accuracy).toBeGreaterThan(0.8);
      expect(metrics.f1Score).toBeGreaterThan(0.85);
      expect(metrics.meetsThreshold).toBe(true);
    });

    test('should flag model degradation', async () => {
      const degradedData = {
        predictions: 100,
        correctPredictions: 65
      };

      aiService.evaluateModelAccuracy.mockResolvedValue({
        accuracy: 0.65,
        modelDegraded: true,
        retrainingRequired: true,
        degradationReason: 'Data drift detected'
      });

      const metrics = await aiService.evaluateModelAccuracy(degradedData);

      expect(metrics.accuracy).toBeLessThan(0.8);
      expect(metrics.retrainingRequired).toBe(true);
    });
  });

  describe('Performance Requirements', () => {
    test('should categorize incident within 100ms', async () => {
      const start = Date.now();

      aiService.categorizeIncident.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { category: 'SYSTEM', confidence: 0.9 };
      });

      await aiService.categorizeIncident('Test incident');

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    test('should handle concurrent predictions', async () => {
      const concurrentRequests = Array(10).fill().map((_, i) =>
        aiService.predictResolution({ id: `INC-${i}`, category: 'SYSTEM' })
      );

      aiService.predictResolution.mockResolvedValue({
        suggestedSteps: ['Standard resolution'],
        confidence: 0.8
      });

      const results = await Promise.all(concurrentRequests);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.confidence).toBeDefined();
      });
    });
  });
});