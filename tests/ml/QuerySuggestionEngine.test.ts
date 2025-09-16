import { QuerySuggestionEngine } from '../../src/services/ml/QuerySuggestionEngine';
import { TrainingData } from '../../src/types/ml';

describe('QuerySuggestionEngine', () => {
  let engine: QuerySuggestionEngine;
  let mockTrainingData: TrainingData;

  beforeEach(() => {
    engine = new QuerySuggestionEngine();
    mockTrainingData = {
      features: [
        'search for documents',
        'find files',
        'document search',
        'file search',
        'search documents',
        'find document',
        'search file',
        'document finder',
        'file finder',
        'search tool'
      ],
      labels: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      metadata: {
        queryFrequencies: {
          'search': 100,
          'find': 80,
          'document': 60,
          'file': 50
        }
      }
    };
  });

  describe('training', () => {
    it('should train successfully with valid data', async () => {
      const evaluation = await engine.train(mockTrainingData);

      expect(evaluation).toBeDefined();
      expect(evaluation.accuracy).toBeGreaterThan(0);
      expect(evaluation.precision).toBeGreaterThan(0);
      expect(evaluation.recall).toBeGreaterThan(0);
      expect(evaluation.f1Score).toBeGreaterThan(0);
    });

    it('should build trie structure from training data', async () => {
      await engine.train(mockTrainingData);

      const suggestions = await engine.getSuggestions('search', undefined, 5);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.query.includes('search'))).toBe(true);
    });

    it('should calculate feature importance', async () => {
      const evaluation = await engine.train(mockTrainingData);

      expect(evaluation.featureImportance).toBeDefined();
      expect(Object.keys(evaluation.featureImportance!).length).toBeGreaterThan(0);
    });
  });

  describe('suggestion generation', () => {
    beforeEach(async () => {
      await engine.train(mockTrainingData);
    });

    it('should generate suggestions for partial queries', async () => {
      const suggestions = await engine.getSuggestions('search', undefined, 3);

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeLessThanOrEqual(3);
      expect(suggestions.every(s => s.confidence > 0 && s.confidence <= 1)).toBe(true);
    });

    it('should generate different types of suggestions', async () => {
      const suggestions = await engine.getSuggestions('find', undefined, 5);

      const sources = new Set(suggestions.map(s => s.source));
      expect(sources.size).toBeGreaterThan(0);
    });

    it('should rank suggestions by confidence', async () => {
      const suggestions = await engine.getSuggestions('doc', undefined, 5);

      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].confidence).toBeLessThanOrEqual(suggestions[i - 1].confidence);
      }
    });

    it('should handle empty partial query', async () => {
      const suggestions = await engine.getSuggestions('', undefined, 3);

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('should limit suggestions to requested maximum', async () => {
      const maxSuggestions = 2;
      const suggestions = await engine.getSuggestions('search', undefined, maxSuggestions);

      expect(suggestions.length).toBeLessThanOrEqual(maxSuggestions);
    });
  });

  describe('personalized suggestions', () => {
    beforeEach(async () => {
      await engine.train(mockTrainingData);
    });

    it('should provide personalized suggestions when user ID provided', async () => {
      const userId = 'user123';
      await engine.updateUserContext(userId, 'search documents', true);

      const suggestions = await engine.getSuggestions('search', userId, 3);

      expect(suggestions).toBeDefined();
      expect(suggestions.some(s => s.metadata?.type === 'personalized')).toBe(true);
    });

    it('should update user context on interactions', async () => {
      const userId = 'user456';

      await engine.updateUserContext(userId, 'find files', true);
      await engine.updateUserContext(userId, 'search documents', false);

      // Context should be updated (no direct way to test internal state)
      const suggestions = await engine.getSuggestions('find', userId, 3);
      expect(suggestions).toBeDefined();
    });
  });

  describe('model management', () => {
    it('should return model info after training', async () => {
      await engine.train(mockTrainingData);

      const modelInfo = engine.getModelInfo();
      expect(modelInfo).toBeDefined();
      expect(modelInfo!.id).toBeDefined();
      expect(modelInfo!.type).toBeDefined();
      expect(modelInfo!.accuracy).toBeGreaterThan(0);
    });

    it('should save model successfully', async () => {
      await engine.train(mockTrainingData);

      // Mock save operation
      await expect(engine.saveModel('/mock/path')).resolves.not.toThrow();
    });

    it('should load model successfully', async () => {
      // Mock load operation
      await expect(engine.loadModel('/mock/path')).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle training with empty data', async () => {
      const emptyData: TrainingData = {
        features: [],
        labels: [],
        metadata: {}
      };

      await expect(engine.train(emptyData)).resolves.not.toThrow();
    });

    it('should handle special characters in queries', async () => {
      await engine.train(mockTrainingData);

      const suggestions = await engine.getSuggestions('search-files@domain.com', undefined, 3);
      expect(suggestions).toBeDefined();
    });

    it('should handle very long partial queries', async () => {
      await engine.train(mockTrainingData);

      const longQuery = 'search for documents in the system with specific criteria and filters applied';
      const suggestions = await engine.getSuggestions(longQuery, undefined, 3);
      expect(suggestions).toBeDefined();
    });

    it('should handle queries with different cases', async () => {
      await engine.train(mockTrainingData);

      const lowerSuggestions = await engine.getSuggestions('search', undefined, 3);
      const upperSuggestions = await engine.getSuggestions('SEARCH', undefined, 3);

      expect(lowerSuggestions.length).toBeGreaterThan(0);
      expect(upperSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      // Create larger training dataset for performance testing
      const largeTrainingData: TrainingData = {
        features: Array.from({ length: 1000 }, (_, i) => `query ${i} with search terms`),
        labels: Array.from({ length: 1000 }, () => 1),
        metadata: {}
      };
      await engine.train(largeTrainingData);
    });

    it('should generate suggestions quickly', async () => {
      const start = Date.now();
      await engine.getSuggestions('query', undefined, 10);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should handle concurrent suggestion requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        engine.getSuggestions('search', undefined, 5)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(suggestions => {
        expect(suggestions).toBeDefined();
        expect(suggestions.length).toBeLessThanOrEqual(5);
      });
    });
  });
});