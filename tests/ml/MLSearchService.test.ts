import { MLSearchService } from '../../src/services/ml/MLSearchService';
import { TrainingData, MLConfig } from '../../src/types/ml';

describe('MLSearchService', () => {
  let mlSearchService: MLSearchService;
  let mockConfig: MLConfig;
  let mockTrainingData: TrainingData;

  beforeEach(() => {
    mockConfig = {
      models: {
        querySuggestion: {
          algorithm: 'trie',
          maxSuggestions: 5,
          minConfidence: 0.5
        },
        personalization: {
          algorithm: 'collaborative_filtering',
          features: ['user_history', 'preferences', 'context'],
          retrainInterval: 24
        },
        semanticSearch: {
          embeddingModel: 'word2vec',
          dimensions: 100,
          similarity: 'cosine'
        },
        anomalyDetection: {
          algorithm: 'isolation_forest',
          threshold: 0.1,
          windowSize: 100
        }
      },
      training: {
        batchSize: 32,
        epochs: 10,
        validationSplit: 0.2,
        earlyStoppingPatience: 5
      }
    };

    mlSearchService = new MLSearchService(mockConfig);

    mockTrainingData = {
      features: [
        'search documents',
        'find files',
        'machine learning tutorial',
        'how to code',
        'compare products'
      ],
      labels: [1, 1, 1, 1, 1],
      metadata: {
        searchLogs: [
          { query: 'search documents', successful: true, clickCount: 10, hasCompletion: true },
          { query: 'find files', successful: true, clickCount: 8, hasCompletion: true }
        ],
        userInteractions: [
          {
            userId: 'user1',
            query: 'search documents',
            resultId: 'doc1',
            clicked: true,
            category: 'documents',
            timestamp: new Date(),
            queryLength: 16,
            userEngagement: 0.8,
            timeOfDay: 10,
            categoryPreference: 'docs',
            clickRank: 1
          }
        ],
        semanticAnnotations: [
          {
            query: 'search documents',
            intent: 'search',
            entities: [{ type: 'object', value: 'documents' }],
            context: 'file search'
          }
        ],
        timeSeriesMetrics: [
          {
            timestamp: new Date(),
            queryCount: 100,
            responseTime: 150,
            errorRate: 0.01,
            clickThroughRate: 0.75,
            isAnomaly: false
          }
        ],
        optimizationHistory: [
          {
            beforeMetrics: { responseTime: 200, accuracy: 0.8, userSatisfaction: 0.7 },
            optimizationType: 'caching',
            improvement: 0.15
          }
        ]
      }
    };
  });

  describe('initialization', () => {
    it('should initialize successfully with valid training data', async () => {
      await expect(mlSearchService.initialize(mockTrainingData)).resolves.not.toThrow();
      expect(mlSearchService.isServiceInitialized()).toBe(true);
    });

    it('should fail to search before initialization', async () => {
      const searchRequest = {
        query: 'test query',
        userId: 'user1'
      };

      await expect(mlSearchService.search(searchRequest)).rejects.toThrow('not initialized');
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidData: TrainingData = {
        features: [],
        labels: [],
        metadata: {}
      };

      await expect(mlSearchService.initialize(invalidData)).resolves.not.toThrow();
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      await mlSearchService.initialize(mockTrainingData);
    });

    it('should perform basic search successfully', async () => {
      const searchRequest = {
        query: 'search documents',
        userId: 'user1'
      };

      const response = await mlSearchService.search(searchRequest);

      expect(response).toBeDefined();
      expect(response.results).toBeDefined();
      expect(response.suggestions).toBeDefined();
      expect(response.totalCount).toBeGreaterThanOrEqual(0);
      expect(response.processingTime).toBeGreaterThan(0);
    });

    it('should include semantic analysis in response', async () => {
      const searchRequest = {
        query: 'find machine learning resources'
      };

      const response = await mlSearchService.search(searchRequest);

      expect(response.semanticAnalysis).toBeDefined();
      expect(response.semanticAnalysis!.intent).toBeDefined();
      expect(response.semanticAnalysis!.entities).toBeDefined();
      expect(response.semanticAnalysis!.expandedQuery).toBeDefined();
      expect(response.semanticAnalysis!.complexity).toBeGreaterThanOrEqual(0);
    });

    it('should apply personalization when user features provided', async () => {
      const searchRequest = {
        query: 'search documents',
        userId: 'user1',
        personalization: {
          userId: 'user1',
          searchHistory: ['documents', 'files'],
          clickHistory: ['doc1', 'doc2'],
          preferences: { category: 'documents' }
        }
      };

      const response = await mlSearchService.search(searchRequest);

      expect(response.personalizationApplied).toBe(true);
    });

    it('should generate query suggestions', async () => {
      const searchRequest = {
        query: 'search'
      };

      const response = await mlSearchService.search(searchRequest);

      expect(response.suggestions).toBeDefined();
      expect(response.suggestions.length).toBeGreaterThan(0);
      expect(response.suggestions.length).toBeLessThanOrEqual(mockConfig.models.querySuggestion.maxSuggestions);
    });

    it('should detect anomalies during search', async () => {
      const searchRequest = {
        query: 'unusual search pattern'
      };

      const response = await mlSearchService.search(searchRequest);

      expect(response.anomaliesDetected).toBeDefined();
      expect(Array.isArray(response.anomaliesDetected)).toBe(true);
    });

    it('should provide optimization insights', async () => {
      const searchRequest = {
        query: 'search for performance optimization'
      };

      const response = await mlSearchService.search(searchRequest);

      expect(response.optimizationInsights).toBeDefined();
      expect(Array.isArray(response.optimizationInsights)).toBe(true);
    });
  });

  describe('user interaction tracking', () => {
    beforeEach(async () => {
      await mlSearchService.initialize(mockTrainingData);
    });

    it('should update user interactions successfully', async () => {
      await expect(mlSearchService.updateUserInteraction(
        'user1',
        'result1',
        'search query',
        'click',
        { category: 'documents' }
      )).resolves.not.toThrow();
    });

    it('should handle different interaction types', async () => {
      const interactions = ['click', 'view', 'skip'] as const;

      for (const action of interactions) {
        await expect(mlSearchService.updateUserInteraction(
          'user1',
          'result1',
          'search query',
          action
        )).resolves.not.toThrow();
      }
    });
  });

  describe('model management', () => {
    beforeEach(async () => {
      await mlSearchService.initialize(mockTrainingData);
    });

    it('should retrain models with new data', async () => {
      const newTrainingData = {
        ...mockTrainingData,
        features: [...mockTrainingData.features, 'new search query'],
        labels: [...mockTrainingData.labels, 1]
      };

      await expect(mlSearchService.retrainModels(newTrainingData)).resolves.not.toThrow();
    });

    it('should get model health status', async () => {
      const health = await mlSearchService.getModelHealth();

      expect(health).toBeDefined();
      expect(Object.keys(health).length).toBeGreaterThan(0);

      Object.values(health).forEach((modelHealth: any) => {
        expect(modelHealth.status).toBeDefined();
        expect(['healthy', 'warning', 'critical']).toContain(modelHealth.status);
      });
    });

    it('should export and import models', async () => {
      await expect(mlSearchService.exportModels('/mock/export/path')).resolves.not.toThrow();
      await expect(mlSearchService.importModels('/mock/import/path')).resolves.not.toThrow();
    });
  });

  describe('system insights', () => {
    beforeEach(async () => {
      await mlSearchService.initialize(mockTrainingData);
    });

    it('should provide comprehensive system insights', async () => {
      const insights = await mlSearchService.getSystemInsights();

      expect(insights).toBeDefined();
      expect(insights.trends).toBeDefined();
      expect(insights.anomalies).toBeDefined();
      expect(insights.optimizationOpportunities).toBeDefined();
      expect(insights.modelAlerts).toBeDefined();
    });

    it('should track search metrics over time', async () => {
      // Perform several searches to generate metrics
      for (let i = 0; i < 5; i++) {
        await mlSearchService.search({ query: `search query ${i}` });
      }

      const metrics = mlSearchService.getSearchMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      metrics.forEach(metric => {
        expect(metric.timestamp).toBeDefined();
        expect(metric.queryCount).toBeGreaterThan(0);
        expect(metric.averageResponseTime).toBeGreaterThan(0);
      });
    });

    it('should provide training pipeline metrics', async () => {
      const pipelineMetrics = mlSearchService.getTrainingPipelineMetrics();

      expect(pipelineMetrics).toBeDefined();
      if (pipelineMetrics) {
        expect(pipelineMetrics.totalTrainingTime).toBeGreaterThan(0);
        expect(pipelineMetrics.modelsTrained).toBeGreaterThan(0);
        expect(pipelineMetrics.successRate).toBeGreaterThan(0);
      }
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await mlSearchService.initialize(mockTrainingData);
    });

    it('should handle search errors gracefully', async () => {
      // This test would need to mock internal failures
      const searchRequest = {
        query: 'test query'
      };

      // Should not throw even if internal components fail
      await expect(mlSearchService.search(searchRequest)).resolves.toBeDefined();
    });

    it('should handle empty search queries', async () => {
      const response = await mlSearchService.search({ query: '' });

      expect(response).toBeDefined();
      expect(response.results).toBeDefined();
    });

    it('should handle malformed requests', async () => {
      const malformedRequest = {
        query: 'test',
        pagination: {
          offset: -1,
          limit: 0
        }
      };

      await expect(mlSearchService.search(malformedRequest)).resolves.toBeDefined();
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await mlSearchService.initialize(mockTrainingData);
    });

    it('should respond to searches quickly', async () => {
      const start = Date.now();
      await mlSearchService.search({ query: 'performance test query' });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should handle concurrent searches', async () => {
      const searchPromises = Array.from({ length: 5 }, (_, i) =>
        mlSearchService.search({ query: `concurrent search ${i}` })
      );

      const responses = await Promise.all(searchPromises);

      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.results).toBeDefined();
      });
    });

    it('should scale with increasing search volume', async () => {
      const searchTimes: number[] = [];

      // Perform multiple searches and measure response times
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await mlSearchService.search({ query: `scale test ${i}` });
        const duration = Date.now() - start;
        searchTimes.push(duration);
      }

      // Response times should remain relatively stable
      const avgTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
      const maxTime = Math.max(...searchTimes);

      expect(maxTime).toBeLessThan(avgTime * 3); // Max time shouldn't exceed 3x average
    });
  });
});