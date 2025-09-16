import { MLTrainingPipeline } from '../../src/services/ml/MLTrainingPipeline';
import { TrainingData } from '../../src/types/ml';

describe('MLTrainingPipeline', () => {
  let pipeline: MLTrainingPipeline;
  let mockTrainingData: TrainingData;

  beforeEach(() => {
    const config = {
      models: ['query_suggestion', 'personalized_ranking', 'semantic_search'],
      dataSource: 'mock',
      validationSplit: 0.2,
      crossValidationFolds: 3,
      hyperparameterTuning: false,
      earlyStoppingPatience: 10,
      maxTrainingTime: 60,
      parallelTraining: true
    };

    pipeline = new MLTrainingPipeline(config);

    mockTrainingData = {
      features: [
        'search documents',
        'find files',
        'document search',
        'file search'
      ],
      labels: [1, 1, 1, 1],
      metadata: {
        searchLogs: [
          { query: 'search documents', successful: true, clickCount: 10 },
          { query: 'find files', successful: true, clickCount: 8 }
        ],
        userInteractions: [
          { userId: 'user1', queryLength: 15, userEngagement: 0.8, timeOfDay: 10, categoryPreference: 'tech', clickRank: 1 },
          { userId: 'user2', queryLength: 12, userEngagement: 0.6, timeOfDay: 14, categoryPreference: 'business', clickRank: 2 }
        ],
        semanticAnnotations: [
          { query: 'search documents', intent: 'find', entities: [{ type: 'object', value: 'documents' }] },
          { query: 'find files', intent: 'find', entities: [{ type: 'object', value: 'files' }] }
        ],
        timeSeriesMetrics: [
          { timestamp: new Date(), queryCount: 100, responseTime: 150, errorRate: 0.01, clickThroughRate: 0.75, isAnomaly: false },
          { timestamp: new Date(), queryCount: 120, responseTime: 180, errorRate: 0.02, clickThroughRate: 0.80, isAnomaly: false }
        ],
        optimizationHistory: [
          { beforeMetrics: { responseTime: 200, accuracy: 0.8, userSatisfaction: 0.7 }, optimizationType: 'caching', improvement: 0.15 }
        ]
      }
    };
  });

  describe('pipeline execution', () => {
    it('should run full pipeline successfully', async () => {
      const metrics = await pipeline.runFullPipeline(mockTrainingData);

      expect(metrics).toBeDefined();
      expect(metrics.modelsTrained).toBeGreaterThan(0);
      expect(metrics.totalTrainingTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(0);
    });

    it('should train specified models only', async () => {
      const singleModelConfig = {
        models: ['query_suggestion'],
        dataSource: 'mock',
        validationSplit: 0.2,
        crossValidationFolds: 3,
        hyperparameterTuning: false,
        earlyStoppingPatience: 10,
        maxTrainingTime: 60,
        parallelTraining: false
      };

      const singleModelPipeline = new MLTrainingPipeline(singleModelConfig);
      const metrics = await singleModelPipeline.runFullPipeline(mockTrainingData);

      expect(metrics.modelsTrained).toBe(1);
      expect(metrics.bestModel).toBe('query_suggestion_engine');
    });

    it('should handle parallel training', async () => {
      const start = Date.now();
      await pipeline.runFullPipeline(mockTrainingData);
      const duration = Date.now() - start;

      // Parallel training should be faster than sequential
      expect(duration).toBeLessThan(10000); // Should complete in reasonable time
    });

    it('should calculate accurate pipeline metrics', async () => {
      const metrics = await pipeline.runFullPipeline(mockTrainingData);

      expect(metrics.averageAccuracy).toBeGreaterThan(0);
      expect(metrics.averageAccuracy).toBeLessThanOrEqual(1);
      expect(metrics.successRate).toBeGreaterThan(0);
      expect(metrics.successRate).toBeLessThanOrEqual(1);
      expect(metrics.resourceUsage).toBeDefined();
    });
  });

  describe('data preparation', () => {
    it('should prepare training data for each model type', async () => {
      // Access private method via casting for testing
      const preparedData = await (pipeline as any).prepareTrainingData(mockTrainingData);

      expect(preparedData.querySuggestion).toBeDefined();
      expect(preparedData.personalizedRanking).toBeDefined();
      expect(preparedData.semanticSearch).toBeDefined();
    });

    it('should handle missing metadata gracefully', async () => {
      const incompleteData: TrainingData = {
        features: ['test query'],
        labels: [1],
        metadata: {}
      };

      await expect(pipeline.runFullPipeline(incompleteData)).resolves.not.toThrow();
    });
  });

  describe('cross-validation', () => {
    it('should perform cross-validation successfully', async () => {
      const validationResults = await pipeline.crossValidate(mockTrainingData, 3);

      expect(validationResults).toBeDefined();
      expect(Object.keys(validationResults).length).toBeGreaterThan(0);

      Object.values(validationResults).forEach(results => {
        expect(results).toHaveLength(3); // 3 folds
        results.forEach(evaluation => {
          expect(evaluation.accuracy).toBeGreaterThanOrEqual(0);
          expect(evaluation.precision).toBeGreaterThanOrEqual(0);
          expect(evaluation.recall).toBeGreaterThanOrEqual(0);
          expect(evaluation.f1Score).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should handle insufficient data for cross-validation', async () => {
      const smallData: TrainingData = {
        features: ['query1', 'query2'],
        labels: [1, 0],
        metadata: {}
      };

      await expect(pipeline.crossValidate(smallData, 5)).resolves.not.toThrow();
    });
  });

  describe('model management', () => {
    it('should save all models successfully', async () => {
      await pipeline.runFullPipeline(mockTrainingData);

      await expect(pipeline.saveAllModels('/mock/path')).resolves.not.toThrow();
    });

    it('should load all models successfully', async () => {
      await expect(pipeline.loadAllModels('/mock/path')).resolves.not.toThrow();
    });

    it('should provide access to trained model services', async () => {
      await pipeline.runFullPipeline(mockTrainingData);

      const services = pipeline.getModelServices();

      expect(services.querySuggestionEngine).toBeDefined();
      expect(services.personalizedRanker).toBeDefined();
      expect(services.semanticSearchEnhancer).toBeDefined();
      expect(services.searchAnomalyDetector).toBeDefined();
      expect(services.predictiveOptimizer).toBeDefined();
    });
  });

  describe('training results', () => {
    it('should track training results for each model', async () => {
      await pipeline.runFullPipeline(mockTrainingData);

      const results = pipeline.getTrainingResults();

      expect(results.size).toBeGreaterThan(0);

      results.forEach((result, modelId) => {
        expect(result.modelId).toBe(modelId);
        expect(result.trainingTime).toBeGreaterThan(0);
        expect(['success', 'failed', 'timeout']).toContain(result.status);
      });
    });

    it('should handle training failures gracefully', async () => {
      // Create a pipeline with invalid configuration to trigger failures
      const invalidConfig = {
        models: ['invalid_model'],
        dataSource: 'mock',
        validationSplit: 0.2,
        crossValidationFolds: 3,
        hyperparameterTuning: false,
        earlyStoppingPatience: 10,
        maxTrainingTime: 60,
        parallelTraining: false
      };

      const invalidPipeline = new MLTrainingPipeline(invalidConfig);

      // Should not throw, but should record failures
      const metrics = await invalidPipeline.runFullPipeline(mockTrainingData);
      expect(metrics).toBeDefined();
    });
  });

  describe('resource management', () => {
    it('should estimate resource usage accurately', async () => {
      const metrics = await pipeline.runFullPipeline(mockTrainingData);

      expect(metrics.resourceUsage.memoryPeak).toBeGreaterThan(0);
      expect(metrics.resourceUsage.cpuTime).toBeGreaterThan(0);
      expect(metrics.resourceUsage.diskSpace).toBeGreaterThan(0);
    });

    it('should complete training within time limits', async () => {
      const start = Date.now();
      await pipeline.runFullPipeline(mockTrainingData);
      const duration = Date.now() - start;

      // Should complete within reasonable time (60 seconds configured max)
      expect(duration).toBeLessThan(60000);
    });
  });

  describe('error handling', () => {
    it('should handle empty training data', async () => {
      const emptyData: TrainingData = {
        features: [],
        labels: [],
        metadata: {}
      };

      await expect(pipeline.runFullPipeline(emptyData)).resolves.not.toThrow();
    });

    it('should handle malformed training data', async () => {
      const malformedData: TrainingData = {
        features: ['query1', 'query2'],
        labels: [1], // Mismatched length
        metadata: null as any
      };

      await expect(pipeline.runFullPipeline(malformedData)).resolves.not.toThrow();
    });
  });
});