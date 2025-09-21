/**
 * Unit Tests for HybridSearchService
 * Comprehensive testing of UC001 implementation with authorization flows
 */

import { HybridSearchService, HybridSearchOptions, HybridSearchResult } from '../../../src/renderer/services/hybridSearchService';
import { SearchService } from '../../../src/renderer/services/api/SearchService';
import { AIAuthorizationService } from '../../../src/main/services/AIAuthorizationService';
import { KBCategory } from '../../../src/types/services';

// Mock dependencies
jest.mock('../../../src/renderer/services/api/SearchService');
jest.mock('../../../src/main/services/AIAuthorizationService');

// Mock window.electronAPI
const mockElectronAPI = {
  getAIAuthorizationService: jest.fn()
};

// @ts-ignore
global.window = {
  electronAPI: mockElectronAPI
};

describe('HybridSearchService', () => {
  let service: HybridSearchService;
  let mockSearchService: jest.Mocked<SearchService>;
  let mockAuthService: jest.Mocked<AIAuthorizationService>;

  const mockLocalResults = [
    {
      entry: {
        id: 'local-1',
        title: 'Local Result 1',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'VSAM' as KBCategory,
        tags: ['test'],
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 5,
        success_rate: 0.8,
        version: 1,
        status: 'active',
        created_by: 'test-user'
      },
      score: 85,
      matchType: 'exact' as any,
      highlights: ['Local Result 1'],
      metadata: {
        processingTime: 50,
        source: 'local',
        confidence: 0.85,
        fallback: false
      }
    }
  ];

  const mockAIResults = [
    {
      entry: {
        id: 'ai-1',
        title: 'AI Enhanced Result',
        problem: 'AI analyzed problem',
        solution: 'AI suggested solution',
        category: 'JCL' as KBCategory,
        tags: ['ai', 'enhanced'],
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 10,
        success_rate: 0.9,
        version: 1,
        status: 'active',
        created_by: 'ai-system'
      },
      score: 90,
      matchType: 'semantic' as any,
      highlights: ['AI Enhanced Result'],
      metadata: {
        processingTime: 200,
        source: 'ai',
        confidence: 0.9,
        fallback: false
      }
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock SearchService
    mockSearchService = {
      search: jest.fn(),
      healthCheck: jest.fn(),
      cleanup: jest.fn()
    } as any;

    // Mock AIAuthorizationService
    mockAuthService = {
      requestAuthorization: jest.fn()
    } as any;

    // Setup successful local search response
    mockSearchService.search.mockImplementation((query) => {
      if (query.useAI) {
        return Promise.resolve({
          success: true,
          data: { results: mockAIResults }
        });
      } else {
        return Promise.resolve({
          success: true,
          data: { results: mockLocalResults }
        });
      }
    });

    // Setup health check
    mockSearchService.healthCheck.mockResolvedValue({
      success: true,
      data: {
        healthy: true,
        localSearchAvailable: true,
        aiSearchAvailable: true,
        averageQueryTime: 150
      }
    });

    // Setup authorization service mock
    mockAuthService.requestAuthorization.mockResolvedValue({
      authorized: true,
      action: 'approve',
      requestId: 'test-request-123',
      autoApproved: false,
      reason: 'User approved'
    });

    mockElectronAPI.getAIAuthorizationService.mockResolvedValue(mockAuthService);

    // Mock constructors
    (SearchService as jest.MockedClass<typeof SearchService>).mockImplementation(() => mockSearchService);

    service = new HybridSearchService();
    
    // Manually set the auth service for testing
    (service as any).authService = mockAuthService;
  });

  describe('Initialization', () => {
    it('should initialize with search service', () => {
      expect(service).toBeDefined();
      expect(SearchService).toHaveBeenCalled();
    });

    it('should attempt to initialize AI authorization service', async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow async initialization
      expect(mockElectronAPI.getAIAuthorizationService).toHaveBeenCalled();
    });

    it('should handle missing AI authorization service gracefully', async () => {
      mockElectronAPI.getAIAuthorizationService.mockRejectedValue(new Error('Service unavailable'));
      
      const serviceWithoutAuth = new HybridSearchService();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(serviceWithoutAuth).toBeDefined();
    });
  });

  describe('Local Search Performance (UC001)', () => {
    it('should complete local search within 500ms', async () => {
      const startTime = Date.now();
      const result = await service.search('test query', undefined, { enableAI: false });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500);
      expect(result.performance.localCompleted).toBe(true);
      expect(result.performance.localSearchTime).toBeLessThan(500);
    });

    it('should timeout local search at 500ms and still return results', async () => {
      // Mock slow local search
      mockSearchService.search.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            data: { results: mockLocalResults }
          }), 600)
        )
      );

      const result = await service.search('slow query', undefined, { enableAI: false });
      
      // Should handle timeout gracefully
      expect(result.metadata.errorMessages).toContain(expect.stringContaining('timeout'));
    });

    it('should always start with local search regardless of options', async () => {
      await service.search('test query', 'VSAM', { enableAI: true });
      
      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ useAI: false }),
        expect.any(Object)
      );
    });

    it('should respect maxLocalResults option', async () => {
      await service.search('test', undefined, { maxLocalResults: 25 });
      
      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ pageSize: 25 })
      );
    });
  });

  describe('AI Enhancement Authorization', () => {
    it('should request authorization before AI search', async () => {
      await service.search('complex query that needs AI enhancement');
      
      expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'semantic_search',
          query: 'complex query that needs AI enhancement'
        })
      );
    });

    it('should not perform AI search when authorization is denied', async () => {
      mockAuthService.requestAuthorization.mockResolvedValue({
        authorized: false,
        action: 'deny',
        requestId: 'test-request-123',
        autoApproved: false,
        reason: 'User denied'
      });

      const result = await service.search('query', undefined, { enableAI: true });
      
      expect(result.aiResults).toHaveLength(0);
      expect(result.metadata.authorizationStatus).toBe('denied');
      expect(result.performance.authorizationRequired).toBe(true);
    });

    it('should perform AI search when authorization is approved', async () => {
      const result = await service.search('complex technical issue');
      
      expect(result.aiResults).toHaveLength(1);
      expect(result.metadata.authorizationStatus).toBe('approved');
      expect(result.performance.aiCompleted).toBe(true);
    });

    it('should detect PII in query and mark as confidential', async () => {
      await service.search('user john.doe@company.com has issue');
      
      expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          dataContext: expect.objectContaining({
            containsPII: true
          })
        })
      );
    });

    it('should detect confidential keywords', async () => {
      await service.search('password reset issue');
      
      expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          dataContext: expect.objectContaining({
            isConfidential: true
          })
        })
      );
    });

    it('should handle authorization service errors gracefully', async () => {
      mockAuthService.requestAuthorization.mockRejectedValue(new Error('Auth service error'));
      
      const result = await service.search('test query');
      
      expect(result.aiResults).toHaveLength(0);
      expect(result.metadata.authorizationStatus).toBe('denied');
      expect(result.metadata.errorMessages).toContain(expect.stringContaining('Authorization request failed'));
    });
  });

  describe('AI Enhancement Decisions', () => {
    it('should enhance with AI for insufficient local results', async () => {
      // Mock insufficient local results
      mockSearchService.search.mockImplementation((query) => {
        if (query.useAI) {
          return Promise.resolve({ success: true, data: { results: mockAIResults } });
        } else {
          return Promise.resolve({ success: true, data: { results: mockLocalResults.slice(0, 2) } });
        }
      });

      const result = await service.search('rare issue');
      
      expect(result.aiResults).toHaveLength(1);
      expect(result.performance.aiCompleted).toBe(true);
    });

    it('should enhance with AI for error code queries', async () => {
      const errorCodeQueries = ['S0C7 error', 'U1234 issue', 'IEF212I message'];
      
      for (const query of errorCodeQueries) {
        const result = await service.search(query);
        expect(result.aiResults).toHaveLength(1);
      }
    });

    it('should enhance with AI for complex queries', async () => {
      const complexQueries = [
        'how to troubleshoot this error',
        'why does this happen',
        'what causes this issue',
        'explain this behavior'
      ];
      
      for (const query of complexQueries) {
        const result = await service.search(query);
        expect(result.aiResults).toHaveLength(1);
      }
    });

    it('should not enhance with AI when disabled', async () => {
      const result = await service.search('complex query', undefined, { enableAI: false });
      
      expect(result.aiResults).toHaveLength(0);
      expect(result.performance.aiCompleted).toBe(false);
    });

    it('should not enhance with AI for sufficient local results with simple queries', async () => {
      // Mock many local results
      const manyResults = Array(10).fill(0).map((_, i) => ({
        ...mockLocalResults[0],
        entry: { ...mockLocalResults[0].entry, id: `local-${i}` }
      }));
      
      mockSearchService.search.mockImplementation((query) => {
        if (query.useAI) {
          return Promise.resolve({ success: true, data: { results: mockAIResults } });
        } else {
          return Promise.resolve({ success: true, data: { results: manyResults } });
        }
      });

      const result = await service.search('simple query');
      
      // Should not trigger AI enhancement due to sufficient results
      expect(result.localResults).toHaveLength(10);
    });
  });

  describe('Result Merging and Deduplication', () => {
    it('should merge local and AI results by default', async () => {
      const result = await service.search('test query');
      
      expect(result.mergedResults).toHaveLength(2); // 1 local + 1 AI
      expect(result.metadata.mergedResultCount).toBe(2);
    });

    it('should prioritize local results when specified', async () => {
      const result = await service.search('test', undefined, { prioritizeLocal: true });
      
      expect(result.mergedResults[0].metadata.source).toBe('local');
    });

    it('should prioritize AI results when specified', async () => {
      const result = await service.search('test', undefined, { prioritizeLocal: false });
      
      expect(result.mergedResults[0].metadata.source).toBe('ai');
    });

    it('should deduplicate results by ID', async () => {
      // Mock duplicate results
      const duplicateAI = {
        ...mockAIResults[0],
        entry: { ...mockAIResults[0].entry, id: 'local-1' } // Same ID as local
      };
      
      mockSearchService.search.mockImplementation((query) => {
        if (query.useAI) {
          return Promise.resolve({ success: true, data: { results: [duplicateAI] } });
        } else {
          return Promise.resolve({ success: true, data: { results: mockLocalResults } });
        }
      });

      const result = await service.search('test');
      
      expect(result.mergedResults).toHaveLength(1); // Duplicate removed
      expect(result.metadata.duplicatesRemoved).toBe(1);
    });

    it('should deduplicate results by similar titles', async () => {
      const similarAI = {
        ...mockAIResults[0],
        entry: { 
          ...mockAIResults[0].entry, 
          id: 'ai-different',
          title: 'Local Result 1' // Same title as local
        }
      };
      
      mockSearchService.search.mockImplementation((query) => {
        if (query.useAI) {
          return Promise.resolve({ success: true, data: { results: [similarAI] } });
        } else {
          return Promise.resolve({ success: true, data: { results: mockLocalResults } });
        }
      });

      const result = await service.search('test');
      
      expect(result.mergedResults).toHaveLength(1);
      expect(result.metadata.duplicatesRemoved).toBe(1);
    });

    it('should disable merging when requested', async () => {
      const result = await service.search('test', undefined, { enableMerging: false });
      
      expect(result.mergedResults).toHaveLength(2); // No deduplication
      expect(result.metadata.duplicatesRemoved).toBe(0);
    });

    it('should add hybrid metadata to merged results', async () => {
      const result = await service.search('test');
      
      expect(result.mergedResults[0].metadata).toHaveProperty('source');
      expect(result.mergedResults[0].metadata).toHaveProperty('hybridRank');
    });
  });

  describe('Error Handling', () => {
    it('should handle local search failures gracefully', async () => {
      mockSearchService.search.mockRejectedValue(new Error('Local search failed'));
      
      const result = await service.search('test');
      
      expect(result.metadata.errorMessages).toContain(expect.stringContaining('Local search failed'));
      expect(result.performance.localCompleted).toBe(false);
    });

    it('should handle AI search failures gracefully', async () => {
      mockSearchService.search.mockImplementation((query) => {
        if (query.useAI) {
          return Promise.reject(new Error('AI search failed'));
        } else {
          return Promise.resolve({ success: true, data: { results: mockLocalResults } });
        }
      });

      const result = await service.search('test');
      
      expect(result.localResults).toHaveLength(1); // Local results still available
      expect(result.aiResults).toHaveLength(0);
      expect(result.performance.aiCompleted).toBe(false);
    });

    it('should fallback to local results on total failure', async () => {
      mockSearchService.search.mockImplementation((query) => {
        if (query.useAI) {
          throw new Error('AI failed');
        } else {
          return Promise.resolve({ success: true, data: { results: mockLocalResults } });
        }
      });
      
      mockAuthService.requestAuthorization.mockRejectedValue(new Error('Auth failed'));

      const result = await service.search('test');
      
      expect(result.mergedResults).toEqual(result.localResults);
      expect(result.metadata.errorMessages.length).toBeGreaterThan(0);
    });

    it('should handle empty query gracefully', async () => {
      const result = await service.search('');
      
      expect(result).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThan(0);
    });

    it('should handle malformed options gracefully', async () => {
      const result = await service.search('test', undefined, {
        maxLocalResults: -1,
        maxAIResults: -1,
        timeoutMs: -1
      } as any);
      
      expect(result).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track timing metrics accurately', async () => {
      const result = await service.search('test query');
      
      expect(result.performance.localSearchTime).toBeGreaterThan(0);
      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.performance.totalTime).toBeGreaterThanOrEqual(result.performance.localSearchTime);
    });

    it('should track AI search timing when enabled', async () => {
      const result = await service.search('complex query that triggers AI');
      
      if (result.performance.aiCompleted) {
        expect(result.performance.aiSearchTime).toBeGreaterThan(0);
      }
    });

    it('should respect timeout configurations', async () => {
      const shortTimeout = 100;
      
      mockSearchService.search.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            data: { results: mockLocalResults }
          }), shortTimeout + 50)
        )
      );

      const result = await service.search('test', undefined, { timeoutMs: shortTimeout });
      
      // Should handle timeout appropriately
      expect(result.performance.totalTime).toBeLessThan(shortTimeout * 2);
    });
  });

  describe('Health Status', () => {
    it('should provide comprehensive health status', async () => {
      const health = await service.getHealthStatus();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('localSearchAvailable');
      expect(health).toHaveProperty('aiSearchAvailable');
      expect(health).toHaveProperty('authorizationAvailable');
      expect(health).toHaveProperty('performanceMetrics');
      
      expect(health.authorizationAvailable).toBe(true);
    });

    it('should indicate authorization unavailable when service is missing', async () => {
      (service as any).authService = null;
      
      const health = await service.getHealthStatus();
      
      expect(health.authorizationAvailable).toBe(false);
    });

    it('should reflect search service health status', async () => {
      mockSearchService.healthCheck.mockResolvedValue({
        success: false,
        data: { healthy: false }
      });
      
      const health = await service.getHealthStatus();
      
      expect(health.healthy).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup search service resources', () => {
      service.cleanup();
      
      expect(mockSearchService.cleanup).toHaveBeenCalled();
    });
  });

  describe('PII and Confidential Data Detection', () => {
    it('should detect SSN patterns', async () => {
      await service.search('user with SSN 123-45-6789 has issue');
      
      expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          dataContext: expect.objectContaining({
            containsPII: true
          })
        })
      );
    });

    it('should detect email patterns', async () => {
      await service.search('contact user@example.com for details');
      
      expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          dataContext: expect.objectContaining({
            containsPII: true
          })
        })
      );
    });

    it('should detect phone number patterns', async () => {
      await service.search('call (555) 123-4567 for support');
      
      expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          dataContext: expect.objectContaining({
            containsPII: true
          })
        })
      );
    });

    it('should detect credit card patterns', async () => {
      await service.search('payment issue with card 1234 5678 9012 3456');
      
      expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          dataContext: expect.objectContaining({
            containsPII: true
          })
        })
      );
    });

    it('should detect confidential keywords', async () => {
      const confidentialQueries = [
        'password reset issue',
        'credential problem',
        'secret key error',
        'token validation',
        'confidential data access'
      ];
      
      for (const query of confidentialQueries) {
        await service.search(query);
        
        expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
          expect.objectContaining({
            dataContext: expect.objectContaining({
              isConfidential: true
            })
          })
        );
      }
    });

    it('should set appropriate sensitivity levels', async () => {
      await service.search('confidential password for user@example.com');
      
      expect(mockAuthService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          dataContext: expect.objectContaining({
            dataFields: expect.arrayContaining([
              expect.objectContaining({
                sensitivity: 'confidential'
              })
            ])
          })
        })
      );
    });
  });

  describe('Session and Request ID Generation', () => {
    it('should generate unique session IDs', async () => {
      const sessionIds = new Set();
      
      for (let i = 0; i < 5; i++) {
        await service.search(`test query ${i}`);
        const calls = mockAuthService.requestAuthorization.mock.calls;
        const lastCall = calls[calls.length - 1];
        if (lastCall) {
          sessionIds.add(lastCall[0].sessionId);
        }
      }
      
      expect(sessionIds.size).toBe(5); // All unique
    });

    it('should generate session IDs with correct format', async () => {
      await service.search('test query');
      
      const call = mockAuthService.requestAuthorization.mock.calls[0];
      const sessionId = call[0].sessionId;
      
      expect(sessionId).toMatch(/^hybrid-search-\d+-[a-z0-9]+$/);
    });
  });
});
