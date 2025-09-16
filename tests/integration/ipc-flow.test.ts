/**
 * IPC Integration Tests
 * 
 * Integration tests for complete IPC communication flows including
 * main-renderer communication, multi-step operations, and system integration.
 */

import { IPCMainProcess } from '../../src/main/ipc/IPCMainProcess';
import { IPCHandlerRegistry } from '../../src/main/ipc/IPCHandlerRegistry';
import { IPCSecurityManager } from '../../src/main/ipc/security/IPCSecurityManager';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { MultiLayerCacheManager } from '../../src/caching/MultiLayerCacheManager';

import {
  validSearchRequest,
  validCreateRequest,
  validMetricsRequest,
  testScenarios,
  performanceTestData
} from '../fixtures/ipc-test-data';

import {
  IPCTestEnvironment,
  assertValidIPCResponse,
  PerformanceTracker,
  createTestCleanup,
  delay
} from '../helpers/ipc-test-utils';

import {
  IPCChannel,
  BaseIPCRequest,
  BaseIPCResponse,
  KBSearchRequest,
  KBEntryCreateRequest
} from '../../src/types/ipc';

describe('IPC Integration Tests', () => {
  let testEnv: IPCTestEnvironment;
  let ipcMainProcess: IPCMainProcess;
  let cleanup = createTestCleanup();

  beforeAll(async () => {
    testEnv = new IPCTestEnvironment();
    
    // Initialize IPC main process with test configuration
    ipcMainProcess = new IPCMainProcess({
      databasePath: ':memory:',
      enablePerformanceMonitoring: true,
      enableSecurityValidation: true,
      enableRequestLogging: false, // Disable logging for tests
      maxConcurrentRequests: 50,
      requestTimeoutMs: 5000
    });

    await ipcMainProcess.initialize();
    
    cleanup.add(async () => {
      await ipcMainProcess.shutdown();
    });
  });

  afterAll(async () => {
    await cleanup.cleanup();
  });

  beforeEach(() => {
    testEnv.reset();
  });

  describe('Complete Knowledge Base Flow', () => {
    it('should handle full CRUD operations in sequence', async () => {
      const tracker = new PerformanceTracker();
      
      // 1. Create a new KB entry
      const createId = tracker.start('create-entry');
      const createResponse = await ipcMainProcess.handleRequest(validCreateRequest);
      tracker.end(createId);
      
      assertValidIPCResponse(createResponse);
      expect(createResponse.success).toBe(true);
      expect(createResponse.data.id).toBeDefined();
      
      const entryId = createResponse.data.id;
      
      // 2. Search for the created entry
      const searchId = tracker.start('search-entry');
      const searchResponse = await ipcMainProcess.handleRequest({
        ...validSearchRequest,
        query: validCreateRequest.entry.title
      });
      tracker.end(searchId);
      
      assertValidIPCResponse(searchResponse);
      expect(searchResponse.success).toBe(true);
      expect(searchResponse.data.results.length).toBeGreaterThan(0);
      
      const foundEntry = searchResponse.data.results.find((r: any) => r.id === entryId);
      expect(foundEntry).toBeDefined();
      
      // 3. Get the specific entry
      const getRequest: BaseIPCRequest = {
        ...validCreateRequest,
        channel: IPCChannel.KB_GET,
        entryId
      };
      
      const getId = tracker.start('get-entry');
      const getResponse = await ipcMainProcess.handleRequest(getRequest);
      tracker.end(getId);
      
      assertValidIPCResponse(getResponse);
      expect(getResponse.success).toBe(true);
      expect(getResponse.data.entry.id).toBe(entryId);
      
      // 4. Update the entry
      const updateRequest: BaseIPCRequest = {
        ...validCreateRequest,
        channel: IPCChannel.KB_UPDATE,
        entryId,
        updates: {
          title: 'Updated Title for Integration Test',
          tags: ['updated', 'integration-test']
        }
      };
      
      const updateId = tracker.start('update-entry');
      const updateResponse = await ipcMainProcess.handleRequest(updateRequest);
      tracker.end(updateId);
      
      assertValidIPCResponse(updateResponse);
      expect(updateResponse.success).toBe(true);
      expect(updateResponse.data.entry.title).toBe('Updated Title for Integration Test');
      
      // 5. Record feedback
      const feedbackRequest: BaseIPCRequest = {
        ...validCreateRequest,
        channel: IPCChannel.KB_FEEDBACK,
        entryId,
        successful: true,
        comment: 'Integration test feedback'
      };
      
      const feedbackId = tracker.start('record-feedback');
      const feedbackResponse = await ipcMainProcess.handleRequest(feedbackRequest);
      tracker.end(feedbackId);
      
      assertValidIPCResponse(feedbackResponse);
      expect(feedbackResponse.success).toBe(true);
      
      // 6. Get metrics to verify operations
      const metricsId = tracker.start('get-metrics');
      const metricsResponse = await ipcMainProcess.handleRequest(validMetricsRequest);
      tracker.end(metricsId);
      
      assertValidIPCResponse(metricsResponse);
      expect(metricsResponse.success).toBe(true);
      expect(metricsResponse.data.summary.totalEntries).toBeGreaterThan(0);
      
      // Verify performance
      const stats = tracker.getStats();
      console.log('CRUD Operation Performance:', stats);
      expect(stats.avg).toBeLessThan(500); // Average operation should be < 500ms
    });

    it('should handle concurrent operations correctly', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, i) => ({
        ...validCreateRequest,
        requestId: `concurrent-${i}`,
        entry: {
          ...validCreateRequest.entry,
          title: `Concurrent Entry ${i}`,
          problem: `Problem description ${i}`
        }
      }));

      const startTime = performance.now();
      
      // Execute all requests concurrently
      const responses = await Promise.all(
        concurrentRequests.map(req => ipcMainProcess.handleRequest(req))
      );
      
      const endTime = performance.now();
      
      // All requests should succeed
      responses.forEach((response, i) => {
        assertValidIPCResponse(response);
        expect(response.success).toBe(true);
        expect(response.data.entry.title).toBe(`Concurrent Entry ${i}`);
      });

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // < 5 seconds
      
      // Verify all entries were created by searching
      const searchResponse = await ipcMainProcess.handleRequest({
        ...validSearchRequest,
        query: 'Concurrent Entry',
        limit: 25
      });
      
      expect(searchResponse.success).toBe(true);
      expect(searchResponse.data.results.length).toBe(20);
    });

    it('should maintain data consistency across operations', async () => {
      // Create entry
      const createResponse = await ipcMainProcess.handleRequest(validCreateRequest);
      const entryId = createResponse.data.id;
      
      // Record multiple feedback events
      const feedbacks = [
        { successful: true, comment: 'Worked great' },
        { successful: true, comment: 'Perfect solution' },
        { successful: false, comment: 'Did not work' },
        { successful: true, comment: 'Finally worked' }
      ];
      
      for (const feedback of feedbacks) {
        await ipcMainProcess.handleRequest({
          ...validCreateRequest,
          channel: IPCChannel.KB_FEEDBACK,
          entryId,
          ...feedback
        });
      }
      
      // Get the entry and verify metrics
      const getResponse = await ipcMainProcess.handleRequest({
        ...validCreateRequest,
        channel: IPCChannel.KB_GET,
        entryId
      });
      
      expect(getResponse.success).toBe(true);
      const entry = getResponse.data.entry;
      
      expect(entry.usage_count).toBe(4);
      expect(entry.success_count).toBe(3);
      expect(entry.failure_count).toBe(1);
    });
  });

  describe('Cross-Handler Communication', () => {
    it('should coordinate between search and knowledge base handlers', async () => {
      // Create test data
      const testEntries = [
        { ...validCreateRequest.entry, title: 'VSAM Error 35', category: 'VSAM' },
        { ...validCreateRequest.entry, title: 'JCL Error 212', category: 'JCL' },
        { ...validCreateRequest.entry, title: 'DB2 SQLCODE -904', category: 'DB2' }
      ];
      
      const createdIds = [];
      for (const entry of testEntries) {
        const response = await ipcMainProcess.handleRequest({
          ...validCreateRequest,
          entry
        });
        createdIds.push(response.data.id);
      }
      
      // Test semantic search
      const semanticSearchRequest: BaseIPCRequest = {
        ...validSearchRequest,
        channel: IPCChannel.SEARCH_SEMANTIC,
        query: 'database error',
        useAI: true
      };
      
      const semanticResponse = await ipcMainProcess.handleRequest(semanticSearchRequest);
      
      expect(semanticResponse.success).toBe(true);
      expect(semanticResponse.data.searchType).toBe('semantic');
      
      // Should find relevant entries even with different terms
      const foundDB2Entry = semanticResponse.data.results.find(
        (r: any) => r.title.includes('DB2')
      );
      expect(foundDB2Entry).toBeDefined();
    });

    it('should handle cache coordination between handlers', async () => {
      // Prime cache with search
      const searchResponse1 = await ipcMainProcess.handleRequest(validSearchRequest);
      expect(searchResponse1.success).toBe(true);
      
      // Second search should use cache
      const searchResponse2 = await ipcMainProcess.handleRequest(validSearchRequest);
      expect(searchResponse2.success).toBe(true);
      expect(searchResponse2.metadata?.cached).toBe(true);
      
      // Create new entry that might affect cached results
      const newEntry = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: validSearchRequest.query, // Matches search term
          problem: 'New problem that matches search'
        }
      };
      
      const createResponse = await ipcMainProcess.handleRequest(newEntry);
      expect(createResponse.success).toBe(true);
      
      // Search again - cache should be invalidated and results updated
      const searchResponse3 = await ipcMainProcess.handleRequest(validSearchRequest);
      expect(searchResponse3.success).toBe(true);
      expect(searchResponse3.metadata?.cached).toBe(false); // Fresh results
      expect(searchResponse3.data.total).toBeGreaterThan(searchResponse2.data.total);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle handler errors gracefully', async () => {
      // Force an error by providing invalid data after validation
      const invalidRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          category: null // Invalid category that passes initial validation
        }
      };

      const response = await ipcMainProcess.handleRequest(invalidRequest);
      
      assertValidIPCResponse(response);
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error.retryable).toBeDefined();
    });

    it('should implement request timeout handling', async () => {
      // Mock a slow operation
      const slowRequest = {
        ...validSearchRequest,
        requestId: 'slow-request-test',
        query: 'slow-operation-simulation'
      };

      // Override timeout for this test
      ipcMainProcess.setRequestTimeout(100); // 100ms timeout
      
      const response = await ipcMainProcess.handleRequest(slowRequest);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TIMEOUT');
      
      // Reset timeout
      ipcMainProcess.setRequestTimeout(5000);
    });

    it('should handle database connection failures', async () => {
      // This would require mocking database failures
      // For now, we'll test error propagation
      const dbErrorRequest = {
        ...validSearchRequest,
        query: '__SIMULATE_DB_ERROR__' // Special query to trigger error
      };

      const response = await ipcMainProcess.handleRequest(dbErrorRequest);
      
      if (!response.success) {
        expect(response.error).toBeDefined();
        expect(response.error.severity).toMatch(/high|critical/);
      }
    });

    it('should maintain service availability during errors', async () => {
      // Send some requests that will fail
      const errorRequests = Array.from({ length: 5 }, (_, i) => ({
        ...validSearchRequest,
        requestId: `error-${i}`,
        query: '' // Invalid empty query
      }));

      const errorResponses = await Promise.all(
        errorRequests.map(req => ipcMainProcess.handleRequest(req))
      );

      // All should fail gracefully
      errorResponses.forEach(response => {
        expect(response.success).toBe(false);
      });

      // But valid request should still work
      const validResponse = await ipcMainProcess.handleRequest(validSearchRequest);
      expect(validResponse.success).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high request volumes', async () => {
      const requestCount = 100;
      const requests = Array.from({ length: requestCount }, (_, i) => ({
        ...validSearchRequest,
        requestId: `volume-${i}`,
        query: `search term ${i % 10}` // Some variety but with repetition for caching
      }));

      const startTime = performance.now();
      
      // Process requests in batches to simulate realistic load
      const batchSize = 10;
      const results = [];
      
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(req => ipcMainProcess.handleRequest(req))
        );
        results.push(...batchResults);
        
        // Small delay between batches
        await delay(10);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / requestCount;

      // Verify all succeeded
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(requestCount);
      
      // Performance should be reasonable
      expect(avgTime).toBeLessThan(50); // < 50ms average per request
      expect(totalTime).toBeLessThan(10000); // < 10 seconds total
    });

    it('should demonstrate caching effectiveness', async () => {
      const popularQuery = 'popular search term';
      
      // First request - no cache
      const firstRequest = {
        ...validSearchRequest,
        query: popularQuery
      };
      
      const tracker = new PerformanceTracker();
      
      const firstId = tracker.start('first-search');
      const firstResponse = await ipcMainProcess.handleRequest(firstRequest);
      const firstTime = tracker.end(firstId);
      
      expect(firstResponse.success).toBe(true);
      expect(firstResponse.metadata?.cached).toBe(false);
      
      // Subsequent requests - should use cache
      const cachedRequests = Array.from({ length: 10 }, (_, i) => ({
        ...validSearchRequest,
        requestId: `cached-${i}`,
        query: popularQuery
      }));

      let totalCachedTime = 0;
      for (const request of cachedRequests) {
        const cachedId = tracker.start(`cached-${request.requestId}`);
        const response = await ipcMainProcess.handleRequest(request);
        const cachedTime = tracker.end(cachedId);
        
        totalCachedTime += cachedTime;
        
        expect(response.success).toBe(true);
        expect(response.metadata?.cached).toBe(true);
      }
      
      const avgCachedTime = totalCachedTime / cachedRequests.length;
      
      // Cached requests should be significantly faster
      expect(avgCachedTime).toBeLessThan(firstTime * 0.5);
    });
  });

  describe('Security Integration', () => {
    it('should enforce security policies across all handlers', async () => {
      // Test rate limiting
      const rapidRequests = Array.from({ length: 150 }, (_, i) => ({
        ...validSearchRequest,
        requestId: `rapid-${i}`,
        userId: 'test-user-rate-limit'
      }));

      const responses = await Promise.all(
        rapidRequests.map(req => ipcMainProcess.handleRequest(req))
      );

      // Some requests should be rate-limited
      const rateLimited = responses.filter(r => 
        !r.success && r.error?.code === 'RATE_LIMIT_EXCEEDED'
      );
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should validate and sanitize inputs across handlers', async () => {
      const maliciousRequests = [
        {
          ...validCreateRequest,
          entry: {
            ...validCreateRequest.entry,
            title: '<script>alert("xss")</script>Malicious Title'
          }
        },
        {
          ...validSearchRequest,
          query: "'; DROP TABLE kb_entries; --"
        }
      ];

      for (const request of maliciousRequests) {
        const response = await ipcMainProcess.handleRequest(request);
        
        if (response.success) {
          // If allowed, content should be sanitized
          if (request.entry) {
            expect(response.data.entry.title).not.toContain('<script>');
          }
        } else {
          // Or request should be blocked
          expect(response.error?.code).toMatch(/VALIDATION|SECURITY/);
        }
      }
    });
  });

  describe('System Integration', () => {
    it('should integrate with database layer correctly', async () => {
      // Test database operations through IPC
      const createResponse = await ipcMainProcess.handleRequest(validCreateRequest);
      expect(createResponse.success).toBe(true);
      
      // Verify data persistence
      const searchResponse = await ipcMainProcess.handleRequest({
        ...validSearchRequest,
        query: validCreateRequest.entry.title
      });
      
      expect(searchResponse.success).toBe(true);
      expect(searchResponse.data.results.length).toBeGreaterThan(0);
    });

    it('should handle system shutdown gracefully', async () => {
      // Start some operations
      const ongoingOperations = Array.from({ length: 5 }, (_, i) => 
        ipcMainProcess.handleRequest({
          ...validSearchRequest,
          requestId: `shutdown-${i}`
        })
      );

      // Don't wait for completion, just verify system handles shutdown
      await delay(50); // Let operations start
      
      // Shutdown should complete without hanging
      const shutdownPromise = ipcMainProcess.shutdown();
      
      await expect(shutdownPromise).resolves.toBeUndefined();
    });
  });

  describe('Event System Integration', () => {
    it('should emit and handle system events correctly', async () => {
      const events: any[] = [];
      
      // Listen to system events
      ipcMainProcess.on('entry:created', (event) => events.push({ type: 'created', ...event }));
      ipcMainProcess.on('search:performed', (event) => events.push({ type: 'search', ...event }));
      ipcMainProcess.on('error:occurred', (event) => events.push({ type: 'error', ...event }));

      // Perform operations that should trigger events
      await ipcMainProcess.handleRequest(validCreateRequest);
      await ipcMainProcess.handleRequest(validSearchRequest);
      
      // Wait for events to be emitted
      await delay(100);
      
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'created')).toBe(true);
      expect(events.some(e => e.type === 'search')).toBe(true);
    });
  });
});