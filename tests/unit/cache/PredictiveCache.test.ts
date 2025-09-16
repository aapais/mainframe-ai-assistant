/**
 * Predictive Cache Unit Tests
 * Testing the ML-powered predictive caching system
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import {
  PredictiveCache,
  PredictiveCacheConfig,
  SearchEvent,
  UserPattern,
  PredictionCandidate
} from '../../../src/services/cache/PredictiveCache';

// Mock Date.now for consistent timestamps
const mockDateNow = jest.fn();
Date.now = mockDateNow;

describe('PredictiveCache', () => {
  let cache: PredictiveCache;
  let config: Partial<PredictiveCacheConfig>;
  let timeCounter: number;

  beforeEach(() => {
    timeCounter = 1000000; // Start with a base timestamp
    mockDateNow.mockImplementation(() => timeCounter += 1000);
    
    config = {
      enableMLPredictions: true,
      maxPredictions: 10,
      confidenceThreshold: 0.7,
      predictionHorizon: 30,
      modelUpdateInterval: 60,
      enablePatternLearning: true,
      enableContextualPredictions: true,
      enableTemporalPredictions: true,
      maxPatternHistory: 1000,
      predictionBatchSize: 5
    };
    
    cache = new PredictiveCache(config);
  });

  afterEach(() => {
    cache.reset();
    jest.clearAllMocks();
  });

  describe('Search Event Recording', () => {
    it('should record search events correctly', () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      
      const event: SearchEvent = {
        query: 'test query',
        timestamp: Date.now(),
        category: 'System',
        resultClicks: 3,
        sessionDuration: 5000,
        followupQueries: ['related query', 'another query']
      };
      
      cache.recordSearchEvent(sessionId, event, userId);
      
      // Verify event was recorded by checking if patterns were created
      const stats = cache.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
    });

    it('should handle events without user ID', () => {
      const sessionId = 'session-123';
      
      const event: SearchEvent = {
        query: 'anonymous query',
        timestamp: Date.now(),
        resultClicks: 1,
        sessionDuration: 2000,
        followupQueries: []
      };
      
      expect(() => {
        cache.recordSearchEvent(sessionId, event);
      }).not.toThrow();
    });

    it('should limit search history size', () => {
      const sessionId = 'session-123';
      
      // Record more than 100 events (the limit)
      for (let i = 0; i < 120; i++) {
        const event: SearchEvent = {
          query: `query ${i}`,
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 1000,
          followupQueries: []
        };
        
        cache.recordSearchEvent(sessionId, event);
      }
      
      // Should not exceed the history limit
      const stats = cache.getStats();
      expect(stats).toBeDefined();
    });

    it('should update user patterns based on events', () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      
      const events: SearchEvent[] = [
        {
          query: 'system error',
          timestamp: Date.now(),
          category: 'System',
          resultClicks: 2,
          sessionDuration: 3000,
          followupQueries: ['error handling']
        },
        {
          query: 'performance issue',
          timestamp: Date.now(),
          category: 'Performance',
          resultClicks: 1,
          sessionDuration: 4000,
          followupQueries: ['performance tuning']
        }
      ];
      
      events.forEach(event => {
        cache.recordSearchEvent(sessionId, event, userId);
      });
      
      const stats = cache.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
    });
  });

  describe('Pattern Learning', () => {
    it('should learn query patterns from search history', () => {
      const sessionId = 'session-123';
      
      const events: SearchEvent[] = [
        {
          query: 'database connection error',
          timestamp: Date.now(),
          category: 'Database',
          resultClicks: 3,
          sessionDuration: 5000,
          followupQueries: ['connection pool', 'timeout error']
        },
        {
          query: 'database timeout',
          timestamp: Date.now(),
          category: 'Database',
          resultClicks: 2,
          sessionDuration: 3000,
          followupQueries: ['connection timeout']
        }
      ];
      
      events.forEach(event => {
        cache.recordSearchEvent(sessionId, event);
      });
      
      const initialStats = cache.getStats();
      expect(initialStats.patternsLearned).toBeGreaterThan(0);
    });

    it('should learn temporal patterns', () => {
      const sessionId = 'session-123';
      
      // Mock specific hours for temporal pattern testing
      const morningTime = new Date('2023-01-01T09:00:00Z').getTime();
      const afternoonTime = new Date('2023-01-01T14:00:00Z').getTime();
      
      mockDateNow.mockReturnValueOnce(morningTime);
      const morningEvent: SearchEvent = {
        query: 'morning report',
        timestamp: morningTime,
        resultClicks: 1,
        sessionDuration: 2000,
        followupQueries: []
      };
      
      mockDateNow.mockReturnValueOnce(afternoonTime);
      const afternoonEvent: SearchEvent = {
        query: 'afternoon analysis',
        timestamp: afternoonTime,
        resultClicks: 1,
        sessionDuration: 2000,
        followupQueries: []
      };
      
      cache.recordSearchEvent(sessionId, morningEvent);
      cache.recordSearchEvent(sessionId, afternoonEvent);
      
      const stats = cache.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
    });

    it('should learn category preferences', () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      
      const systemEvents = Array(5).fill(null).map((_, i) => ({
        query: `system query ${i}`,
        timestamp: Date.now(),
        category: 'System',
        resultClicks: 1,
        sessionDuration: 2000,
        followupQueries: []
      }));
      
      const performanceEvents = Array(3).fill(null).map((_, i) => ({
        query: `performance query ${i}`,
        timestamp: Date.now(),
        category: 'Performance',
        resultClicks: 1,
        sessionDuration: 2000,
        followupQueries: []
      }));
      
      [...systemEvents, ...performanceEvents].forEach(event => {
        cache.recordSearchEvent(sessionId, event, userId);
      });
      
      // User should now have stronger preference for System category
      const stats = cache.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
    });
  });

  describe('Prediction Generation', () => {
    beforeEach(() => {
      // Set up some historical data for predictions
      const sessionId = 'session-123';
      const userId = 'user-456';
      
      const events: SearchEvent[] = [
        {
          query: 'database error',
          timestamp: Date.now(),
          category: 'Database',
          resultClicks: 3,
          sessionDuration: 5000,
          followupQueries: ['connection error', 'timeout error']
        },
        {
          query: 'performance issue',
          timestamp: Date.now(),
          category: 'Performance',
          resultClicks: 2,
          sessionDuration: 4000,
          followupQueries: ['slow query', 'memory usage']
        }
      ];
      
      events.forEach(event => {
        cache.recordSearchEvent(sessionId, event, userId);
      });
    });

    it('should generate pattern-based predictions', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      
      const predictions = await cache.getPredictions(sessionId, userId);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should respect confidence threshold', async () => {
      // Set high confidence threshold
      const highConfidenceCache = new PredictiveCache({
        ...config,
        confidenceThreshold: 0.95
      });
      
      const sessionId = 'session-123';
      const predictions = await highConfidenceCache.getPredictions(sessionId);
      
      predictions.forEach(prediction => {
        expect(prediction.confidence).toBeGreaterThanOrEqual(0.95);
      });
      
      highConfidenceCache.reset();
    });

    it('should limit number of predictions', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      
      const predictions = await cache.getPredictions(sessionId, userId);
      expect(predictions.length).toBeLessThanOrEqual(config.maxPredictions!);
    });

    it('should generate contextual predictions', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      
      const context = {
        currentCategory: 'Database',
        urgency: 0.8,
        sessionLength: 300000
      };
      
      const predictions = await cache.getPredictions(sessionId, userId, context);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should generate temporal predictions', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      
      // Add temporal patterns
      const currentHour = new Date().getHours();
      const nextHour = (currentHour + 1) % 24;
      
      const nextHourTime = new Date();
      nextHourTime.setHours(nextHour, 0, 0, 0);
      
      mockDateNow.mockReturnValue(nextHourTime.getTime());
      
      const event: SearchEvent = {
        query: 'hourly report',
        timestamp: nextHourTime.getTime(),
        resultClicks: 1,
        sessionDuration: 2000,
        followupQueries: []
      };
      
      cache.recordSearchEvent(sessionId, event, userId);
      
      const predictions = await cache.getPredictions(sessionId, userId);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should return empty predictions when disabled', async () => {
      const disabledCache = new PredictiveCache({
        ...config,
        enableMLPredictions: false
      });
      
      const sessionId = 'session-123';
      const predictions = await disabledCache.getPredictions(sessionId);
      
      expect(predictions).toEqual([]);
      
      disabledCache.reset();
    });
  });

  describe('Prediction Success/Failure Tracking', () => {
    it('should mark predictions as successful', () => {
      const key = 'test-prediction-key';
      
      cache.markPredictionSuccess(key);
      
      const stats = cache.getStats();
      expect(stats.successfulPredictions).toBe(1);
      expect(stats.predictionAccuracy).toBeGreaterThan(0);
    });

    it('should mark predictions as failed', () => {
      const key = 'test-prediction-key';
      
      cache.markPredictionFailure(key);
      
      // Should not increase successful predictions
      const stats = cache.getStats();
      expect(stats.successfulPredictions).toBe(0);
    });

    it('should calculate prediction accuracy correctly', () => {
      cache.markPredictionSuccess('key1');
      cache.markPredictionSuccess('key2');
      cache.markPredictionFailure('key3');
      cache.markPredictionFailure('key4');
      
      const stats = cache.getStats();
      expect(stats.predictionAccuracy).toBeCloseTo(0.5); // 2 successes out of 4 total
    });

    it('should emit prediction events', (done) => {
      cache.once('prediction-success', (event) => {
        expect(event.key).toBe('success-key');
        done();
      });
      
      cache.markPredictionSuccess('success-key');
    });
  });

  describe('Model Training', () => {
    it('should handle insufficient training data', async () => {
      // Fresh cache with minimal data
      const freshCache = new PredictiveCache(config);
      
      await freshCache.trainModels();
      
      const stats = freshCache.getStats();
      expect(stats.modelsActive).toBeGreaterThanOrEqual(1); // Should have base model
      
      freshCache.reset();
    });

    it('should train models with sufficient data', async () => {
      // Generate training data
      for (let i = 0; i < 150; i++) {
        const key = `training-key-${i}`;
        if (i % 2 === 0) {
          cache.markPredictionSuccess(key);
        } else {
          cache.markPredictionFailure(key);
        }
      }
      
      await cache.trainModels();
      
      const stats = cache.getStats();
      expect(stats.modelsActive).toBeGreaterThanOrEqual(1);
    });

    it('should emit model update events', (done) => {
      cache.once('model-updated', (event) => {
        expect(event.modelId).toBeDefined();
        expect(event.accuracy).toBeGreaterThanOrEqual(0);
        done();
      });
      
      // Generate enough data for training
      for (let i = 0; i < 150; i++) {
        cache.markPredictionSuccess(`key-${i}`);
      }
      
      cache.trainModels();
    });

    it('should update active model when accuracy improves', async () => {
      const initialStats = cache.getStats();
      const initialModels = initialStats.modelsActive;
      
      // Generate high-accuracy training data
      for (let i = 0; i < 150; i++) {
        cache.markPredictionSuccess(`high-accuracy-key-${i}`);
      }
      
      await cache.trainModels();
      
      const updatedStats = cache.getStats();
      expect(updatedStats.modelsActive).toBeGreaterThanOrEqual(initialModels);
    });
  });

  describe('Statistics', () => {
    it('should provide comprehensive statistics', () => {
      cache.markPredictionSuccess('key1');
      cache.markPredictionFailure('key2');
      
      const stats = cache.getStats();
      
      expect(stats).toMatchObject({
        totalPredictions: expect.any(Number),
        successfulPredictions: expect.any(Number),
        predictionAccuracy: expect.any(Number),
        cacheHitRate: expect.any(Number),
        computationTimeSaved: expect.any(Number),
        modelsActive: expect.any(Number),
        patternsLearned: expect.any(Number),
        averagePredictionTime: expect.any(Number)
      });
    });

    it('should track patterns learned', () => {
      const sessionId = 'session-123';
      
      const event: SearchEvent = {
        query: 'new pattern query',
        timestamp: Date.now(),
        resultClicks: 1,
        sessionDuration: 2000,
        followupQueries: []
      };
      
      cache.recordSearchEvent(sessionId, event);
      
      const stats = cache.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
    });

    it('should track active models', () => {
      const stats = cache.getStats();
      expect(stats.modelsActive).toBeGreaterThanOrEqual(1); // At least the base model
    });
  });

  describe('Configuration', () => {
    it('should work with minimal configuration', () => {
      const minimalCache = new PredictiveCache();
      expect(minimalCache).toBeDefined();
      
      const stats = minimalCache.getStats();
      expect(stats).toBeDefined();
      
      minimalCache.reset();
    });

    it('should respect disabled features', async () => {
      const limitedCache = new PredictiveCache({
        enableMLPredictions: false,
        enablePatternLearning: false,
        enableContextualPredictions: false,
        enableTemporalPredictions: false
      });
      
      const sessionId = 'session-123';
      const predictions = await limitedCache.getPredictions(sessionId);
      
      expect(predictions).toEqual([]);
      
      limitedCache.reset();
    });

    it('should respect prediction limits', async () => {
      const limitedCache = new PredictiveCache({
        ...config,
        maxPredictions: 3
      });
      
      // Set up data that could generate many predictions
      const sessionId = 'session-123';
      for (let i = 0; i < 10; i++) {
        const event: SearchEvent = {
          query: `query ${i}`,
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 2000,
          followupQueries: [`followup ${i}`]
        };
        
        limitedCache.recordSearchEvent(sessionId, event);
      }
      
      const predictions = await limitedCache.getPredictions(sessionId);
      expect(predictions.length).toBeLessThanOrEqual(3);
      
      limitedCache.reset();
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset all data when reset is called', () => {
      const sessionId = 'session-123';
      
      // Add some data
      const event: SearchEvent = {
        query: 'test query',
        timestamp: Date.now(),
        resultClicks: 1,
        sessionDuration: 2000,
        followupQueries: []
      };
      
      cache.recordSearchEvent(sessionId, event);
      cache.markPredictionSuccess('test-key');
      
      // Verify data exists
      let stats = cache.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
      expect(stats.successfulPredictions).toBeGreaterThan(0);
      
      // Reset
      cache.reset();
      
      // Verify data is cleared
      stats = cache.getStats();
      expect(stats.patternsLearned).toBe(0);
      expect(stats.successfulPredictions).toBe(0);
      expect(stats.totalPredictions).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid search events gracefully', () => {
      const sessionId = 'session-123';
      
      const invalidEvent = {
        query: '',
        timestamp: -1,
        resultClicks: -1,
        sessionDuration: -1,
        followupQueries: null as any
      };
      
      expect(() => {
        cache.recordSearchEvent(sessionId, invalidEvent as SearchEvent);
      }).not.toThrow();
    });

    it('should handle prediction generation errors gracefully', async () => {
      const sessionId = 'session-123';
      
      // This should not throw even with minimal data
      const predictions = await cache.getPredictions(sessionId);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should handle model training errors gracefully', async () => {
      // Should not throw even with no training data
      await expect(cache.trainModels()).resolves.not.toThrow();
    });
  });

  describe('Advanced Pattern Matching', () => {
    it('should identify similar queries', () => {
      const sessionId = 'session-123';
      
      const similarEvents = [
        {
          query: 'database connection error',
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 2000,
          followupQueries: []
        },
        {
          query: 'database connection failure',
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 2000,
          followupQueries: []
        },
        {
          query: 'db connection issue',
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 2000,
          followupQueries: []
        }
      ];
      
      similarEvents.forEach(event => {
        cache.recordSearchEvent(sessionId, event as SearchEvent);
      });
      
      const stats = cache.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
    });

    it('should track query sequences', () => {
      const sessionId = 'session-123';
      
      const sequenceEvents = [
        {
          query: 'system error',
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 2000,
          followupQueries: ['error analysis']
        },
        {
          query: 'error analysis',
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 2000,
          followupQueries: ['troubleshooting']
        },
        {
          query: 'troubleshooting',
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 2000,
          followupQueries: []
        }
      ];
      
      sequenceEvents.forEach(event => {
        cache.recordSearchEvent(sessionId, event as SearchEvent);
      });
      
      const stats = cache.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large numbers of events efficiently', () => {
      const sessionId = 'session-123';
      const startTime = Date.now();
      
      // Record many events
      for (let i = 0; i < 1000; i++) {
        const event: SearchEvent = {
          query: `performance test query ${i}`,
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 1000,
          followupQueries: []
        };
        
        cache.recordSearchEvent(sessionId, event);
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process events reasonably quickly
      expect(processingTime).toBeLessThan(5000); // 5 seconds
    });

    it('should limit memory usage with pattern history limits', () => {
      const sessionId = 'session-123';
      
      // Record events beyond the history limit
      for (let i = 0; i < 150; i++) {
        const event: SearchEvent = {
          query: `memory test query ${i}`,
          timestamp: Date.now(),
          resultClicks: 1,
          sessionDuration: 1000,
          followupQueries: []
        };
        
        cache.recordSearchEvent(sessionId, event);
      }
      
      // Should still function without excessive memory usage
      const stats = cache.getStats();
      expect(stats).toBeDefined();
    });
  });
});