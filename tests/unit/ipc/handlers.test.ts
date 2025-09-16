/**
 * Unit Tests for IPC Handlers
 * 
 * Comprehensive unit tests for all IPC handler functions including
 * validation, error handling, and business logic testing.
 */

import { 
  KnowledgeBaseHandler 
} from '../../../src/main/ipc/handlers/KnowledgeBaseHandler';
import { 
  SearchHandler 
} from '../../../src/main/ipc/handlers/SearchHandler';
import { 
  MetricsHandler 
} from '../../../src/main/ipc/handlers/MetricsHandler';
import { 
  IPCHandlerRegistry 
} from '../../../src/main/ipc/IPCHandlerRegistry';

import {
  validSearchRequest,
  validCreateRequest,
  validMetricsRequest,
  validKBEntry,
  invalidRequests,
  testErrors
} from '../../fixtures/ipc-test-data';

import {
  MockKnowledgeDB,
  MockCacheManager,
  assertValidIPCResponse,
  assertValidIPCError,
  PerformanceTracker
} from '../../helpers/ipc-test-utils';

import { 
  IPCErrorCode,
  KBSearchRequest,
  KBEntryCreateRequest,
  MetricsRequest
} from '../../../src/types/ipc';

describe('KnowledgeBaseHandler', () => {
  let handler: KnowledgeBaseHandler;
  let mockDB: MockKnowledgeDB;
  let mockCache: MockCacheManager;

  beforeEach(() => {
    mockDB = new MockKnowledgeDB([validKBEntry]);
    mockCache = new MockCacheManager();
    handler = new KnowledgeBaseHandler(mockDB as any, mockCache as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return successful search results', async () => {
      const response = await handler.search(validSearchRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.results).toEqual(expect.any(Array));
      expect(response.data.total).toEqual(expect.any(Number));
      expect(response.executionTime).toBeGreaterThan(0);
    });

    it('should handle empty search results gracefully', async () => {
      const emptySearchRequest = {
        ...validSearchRequest,
        query: 'nonexistent-search-term-12345'
      };

      const response = await handler.search(emptySearchRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.results).toEqual([]);
      expect(response.data.total).toBe(0);
    });

    it('should validate search parameters', async () => {
      const invalidRequest = {
        ...validSearchRequest,
        query: '' // Empty query
      };

      const response = await handler.search(invalidRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(IPCErrorCode.VALIDATION_ERROR);
    });

    it('should respect search limits', async () => {
      const limitedRequest = {
        ...validSearchRequest,
        limit: 5
      };

      const response = await handler.search(limitedRequest);
      
      expect(response.success).toBe(true);
      expect(response.data.results.length).toBeLessThanOrEqual(5);
    });

    it('should handle category filtering', async () => {
      const categoryRequest = {
        ...validSearchRequest,
        filters: {
          category: 'VSAM' as any
        }
      };

      const response = await handler.search(categoryRequest);
      
      expect(response.success).toBe(true);
      // All results should match the category filter
      response.data.results.forEach((result: any) => {
        expect(result.category).toBe('VSAM');
      });
    });

    it('should utilize cache for repeated searches', async () => {
      // First search
      const response1 = await handler.search(validSearchRequest);
      expect(response1.success).toBe(true);

      // Second identical search should be faster (cached)
      const tracker = new PerformanceTracker();
      const searchId = tracker.start('cached-search');
      
      const response2 = await handler.search(validSearchRequest);
      tracker.end(searchId);
      
      expect(response2.success).toBe(true);
      expect(response2.metadata?.cached).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const errorDB = {
        search: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      };
      
      const errorHandler = new KnowledgeBaseHandler(errorDB as any, mockCache as any);
      const response = await errorHandler.search(validSearchRequest);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(IPCErrorCode.INTERNAL_ERROR);
    });
  });

  describe('createEntry', () => {
    it('should successfully create a new KB entry', async () => {
      const response = await handler.createEntry(validCreateRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.id).toEqual(expect.any(String));
      expect(response.data.entry.title).toBe(validCreateRequest.entry.title);
    });

    it('should validate required entry fields', async () => {
      const invalidCreateRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: '' // Missing required field
        }
      };

      const response = await handler.createEntry(invalidCreateRequest);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(IPCErrorCode.VALIDATION_ERROR);
    });

    it('should sanitize entry content', async () => {
      const maliciousRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: '<script>alert("xss")</script>',
          problem: 'Normal problem'
        }
      };

      const response = await handler.createEntry(maliciousRequest);
      
      expect(response.success).toBe(true);
      expect(response.data.entry.title).not.toContain('<script>');
    });

    it('should handle duplicate entries appropriately', async () => {
      // Create first entry
      const response1 = await handler.createEntry(validCreateRequest);
      expect(response1.success).toBe(true);

      // Attempt to create duplicate
      const response2 = await handler.createEntry(validCreateRequest);
      
      // Should either succeed with new ID or fail with appropriate error
      if (!response2.success) {
        expect(response2.error?.code).toBe(IPCErrorCode.DUPLICATE_ENTRY);
      } else {
        expect(response2.data.id).not.toBe(response1.data.id);
      }
    });

    it('should auto-generate tags based on content', async () => {
      const response = await handler.createEntry(validCreateRequest);
      
      expect(response.success).toBe(true);
      expect(response.data.entry.tags).toEqual(expect.any(Array));
      expect(response.data.entry.tags.length).toBeGreaterThan(0);
    });
  });

  describe('getEntry', () => {
    it('should retrieve existing entry by ID', async () => {
      const getRequest = {
        ...validCreateRequest,
        channel: 'kb:get' as any,
        entryId: validKBEntry.id
      };

      const response = await handler.getEntry(getRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.entry.id).toBe(validKBEntry.id);
    });

    it('should return not found for non-existent entry', async () => {
      const getRequest = {
        ...validCreateRequest,
        channel: 'kb:get' as any,
        entryId: 'non-existent-id'
      };

      const response = await handler.getEntry(getRequest);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(IPCErrorCode.NOT_FOUND);
    });

    it('should track entry views for metrics', async () => {
      const getRequest = {
        ...validCreateRequest,
        channel: 'kb:get' as any,
        entryId: validKBEntry.id
      };

      await handler.getEntry(getRequest);
      
      // Verify usage was recorded
      const updatedEntry = await mockDB.getEntry(validKBEntry.id);
      expect(updatedEntry.usage_count).toBeGreaterThan(validKBEntry.usage_count || 0);
    });
  });

  describe('updateEntry', () => {
    it('should successfully update existing entry', async () => {
      const updateRequest = {
        ...validCreateRequest,
        channel: 'kb:update' as any,
        entryId: validKBEntry.id,
        updates: {
          title: 'Updated Title',
          tags: ['updated', 'tag']
        }
      };

      const response = await handler.updateEntry(updateRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.entry.title).toBe('Updated Title');
    });

    it('should validate update permissions', async () => {
      const unauthorizedRequest = {
        ...validCreateRequest,
        channel: 'kb:update' as any,
        entryId: validKBEntry.id,
        userId: 'unauthorized-user', // Different user
        updates: { title: 'Unauthorized Update' }
      };

      const response = await handler.updateEntry(unauthorizedRequest);
      
      // Should check permissions and potentially deny
      if (!response.success) {
        expect(response.error?.code).toBe(IPCErrorCode.UNAUTHORIZED);
      }
    });
  });

  describe('deleteEntry', () => {
    it('should successfully delete existing entry', async () => {
      const deleteRequest = {
        ...validCreateRequest,
        channel: 'kb:delete' as any,
        entryId: validKBEntry.id
      };

      const response = await handler.deleteEntry(deleteRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
    });

    it('should handle deletion of non-existent entry', async () => {
      const deleteRequest = {
        ...validCreateRequest,
        channel: 'kb:delete' as any,
        entryId: 'non-existent-id'
      };

      const response = await handler.deleteEntry(deleteRequest);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(IPCErrorCode.NOT_FOUND);
    });
  });

  describe('recordFeedback', () => {
    it('should record successful usage feedback', async () => {
      const feedbackRequest = {
        ...validCreateRequest,
        channel: 'kb:feedback' as any,
        entryId: validKBEntry.id,
        successful: true,
        comment: 'This solution worked perfectly'
      };

      const response = await handler.recordFeedback(feedbackRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
    });

    it('should record failure feedback with details', async () => {
      const feedbackRequest = {
        ...validCreateRequest,
        channel: 'kb:feedback' as any,
        entryId: validKBEntry.id,
        successful: false,
        comment: 'Solution did not work in my environment'
      };

      const response = await handler.recordFeedback(feedbackRequest);
      
      expect(response.success).toBe(true);
      
      // Verify failure count was incremented
      const updatedEntry = await mockDB.getEntry(validKBEntry.id);
      expect(updatedEntry.failure_count).toBeGreaterThan(validKBEntry.failure_count || 0);
    });
  });
});

describe('SearchHandler', () => {
  let handler: SearchHandler;
  let mockDB: MockKnowledgeDB;

  beforeEach(() => {
    mockDB = new MockKnowledgeDB([validKBEntry]);
    handler = new SearchHandler(mockDB as any);
  });

  describe('semanticSearch', () => {
    it('should perform AI-enhanced semantic search', async () => {
      const semanticRequest = {
        ...validSearchRequest,
        useAI: true,
        channel: 'search:semantic' as any
      };

      const response = await handler.semanticSearch(semanticRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.results).toEqual(expect.any(Array));
      expect(response.data.searchType).toBe('semantic');
    });

    it('should fallback to basic search when AI fails', async () => {
      // Mock AI service failure
      const failingHandler = new SearchHandler(mockDB as any, {
        findSimilar: jest.fn().mockRejectedValue(new Error('AI service unavailable'))
      } as any);

      const response = await failingHandler.semanticSearch(validSearchRequest);
      
      expect(response.success).toBe(true);
      expect(response.data.searchType).toBe('fallback');
      expect(response.metadata?.warnings).toContain('AI search failed, using fallback');
    });

    it('should include confidence scores in AI results', async () => {
      const response = await handler.semanticSearch({
        ...validSearchRequest,
        useAI: true
      });

      if (response.success && response.data.results.length > 0) {
        response.data.results.forEach((result: any) => {
          expect(result.confidence).toEqual(expect.any(Number));
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(100);
        });
      }
    });
  });

  describe('autocomplete', () => {
    it('should provide search suggestions', async () => {
      const autocompleteRequest = {
        ...validSearchRequest,
        channel: 'search:autocomplete' as any,
        query: 'VSAM',
        limit: 5
      };

      const response = await handler.autocomplete(autocompleteRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.suggestions).toEqual(expect.any(Array));
      expect(response.data.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should prioritize popular search terms', async () => {
      const response = await handler.autocomplete({
        ...validSearchRequest,
        query: 'V'
      });

      if (response.success && response.data.suggestions.length > 1) {
        // Suggestions should be ordered by popularity/relevance
        const suggestions = response.data.suggestions;
        expect(suggestions[0].priority).toBeGreaterThanOrEqual(suggestions[1].priority);
      }
    });
  });
});

describe('MetricsHandler', () => {
  let handler: MetricsHandler;
  let mockDB: MockKnowledgeDB;

  beforeEach(() => {
    mockDB = new MockKnowledgeDB([validKBEntry]);
    handler = new MetricsHandler(mockDB as any);
  });

  describe('getMetrics', () => {
    it('should return comprehensive system metrics', async () => {
      const response = await handler.getMetrics(validMetricsRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.summary).toBeDefined();
      expect(response.data.summary.totalEntries).toEqual(expect.any(Number));
      expect(response.data.summary.totalSearches).toEqual(expect.any(Number));
    });

    it('should support different timeframes', async () => {
      const timeframes = ['1h', '24h', '7d', '30d'];
      
      for (const timeframe of timeframes) {
        const request = {
          ...validMetricsRequest,
          timeframe
        };

        const response = await handler.getMetrics(request);
        
        expect(response.success).toBe(true);
        expect(response.data.timeframe).toBe(timeframe);
      }
    });

    it('should include performance metrics', async () => {
      const response = await handler.getMetrics({
        ...validMetricsRequest,
        includeDetails: true
      });

      expect(response.success).toBe(true);
      expect(response.data.performance).toBeDefined();
      expect(response.data.performance.averageSearchTime).toEqual(expect.any(Number));
      expect(response.data.performance.cacheHitRate).toEqual(expect.any(Number));
    });

    it('should handle large datasets efficiently', async () => {
      const tracker = new PerformanceTracker();
      const metricsId = tracker.start('metrics-generation');
      
      const response = await handler.getMetrics(validMetricsRequest);
      const duration = tracker.end(metricsId);
      
      expect(response.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const response = await handler.getUsageStats(validMetricsRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.topEntries).toEqual(expect.any(Array));
      expect(response.data.topSearchTerms).toEqual(expect.any(Array));
    });
  });
});

describe('IPCHandlerRegistry', () => {
  let registry: IPCHandlerRegistry;
  let mockDB: MockKnowledgeDB;
  let mockCache: MockCacheManager;

  beforeEach(() => {
    mockDB = new MockKnowledgeDB();
    mockCache = new MockCacheManager();
    registry = new IPCHandlerRegistry();
  });

  describe('handler registration', () => {
    it('should register handlers correctly', () => {
      const handler = jest.fn();
      registry.register('test:channel', handler);
      
      expect(registry.getHandler('test:channel')).toBe(handler);
    });

    it('should prevent duplicate registrations', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      registry.register('test:channel', handler1);
      
      expect(() => {
        registry.register('test:channel', handler2);
      }).toThrow('Handler already registered for channel: test:channel');
    });

    it('should unregister handlers', () => {
      const handler = jest.fn();
      registry.register('test:channel', handler);
      
      expect(registry.getHandler('test:channel')).toBe(handler);
      
      registry.unregister('test:channel');
      
      expect(registry.getHandler('test:channel')).toBeUndefined();
    });
  });

  describe('handler execution', () => {
    it('should execute registered handlers', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ success: true });
      registry.register('test:channel', mockHandler);
      
      const request = { channel: 'test:channel', data: 'test' };
      await registry.execute('test:channel', request);
      
      expect(mockHandler).toHaveBeenCalledWith(request);
    });

    it('should handle missing handlers gracefully', async () => {
      const result = await registry.execute('non:existent', {} as any);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(IPCErrorCode.HANDLER_NOT_FOUND);
    });

    it('should catch and handle handler errors', async () => {
      const failingHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      registry.register('test:failing', failingHandler);
      
      const result = await registry.execute('test:failing', {} as any);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(IPCErrorCode.INTERNAL_ERROR);
    });
  });

  describe('middleware support', () => {
    it('should execute middleware before handlers', async () => {
      const middlewareOrder: string[] = [];
      
      const middleware = jest.fn().mockImplementation((req, next) => {
        middlewareOrder.push('middleware');
        return next();
      });
      
      const handler = jest.fn().mockImplementation(() => {
        middlewareOrder.push('handler');
        return { success: true };
      });
      
      registry.use(middleware);
      registry.register('test:middleware', handler);
      
      await registry.execute('test:middleware', {} as any);
      
      expect(middlewareOrder).toEqual(['middleware', 'handler']);
    });
  });
});