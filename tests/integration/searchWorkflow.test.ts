/**
 * Integration Tests for Complete Search Workflow
 * Testing end-to-end search functionality with real database and services
 */

import Database from 'better-sqlite3';
import { HybridSearchService } from '../../src/renderer/services/hybridSearchService';
import { SearchService } from '../../src/renderer/services/api/SearchService';
import { AIAuthorizationService } from '../../src/main/services/AIAuthorizationService';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { KBEntry, KBCategory } from '../../src/types/services';
import { promises as fs } from 'fs';
import path from 'path';

describe('Search Workflow Integration Tests', () => {
  let db: Database.Database;
  let knowledgeDB: KnowledgeDB;
  let searchService: SearchService;
  let hybridSearchService: HybridSearchService;
  let authService: AIAuthorizationService;
  let tempDbPath: string;

  const testEntries: KBEntry[] = [
    {
      id: 'vsam-001',
      title: 'VSAM Status 35 - File Not Found',
      problem: 'Program receives VSAM status code 35 when attempting to open a file',
      solution: 'Check if the dataset exists in the catalog and verify the DD statement points to the correct dataset name',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-01-15'),
      usage_count: 25,
      success_rate: 0.92,
      version: 1,
      status: 'active',
      created_by: 'senior-analyst'
    },
    {
      id: 'jcl-001',
      title: 'JCL Error - Invalid Step Name',
      problem: 'JCL job fails with JCL ERROR message about invalid step name',
      solution: 'Ensure step names are 8 characters or less and contain only alphanumeric characters',
      category: 'JCL',
      tags: ['jcl', 'syntax-error', 'step-name'],
      created_at: new Date('2024-01-10'),
      updated_at: new Date('2024-01-10'),
      usage_count: 15,
      success_rate: 0.87,
      version: 1,
      status: 'active',
      created_by: 'jcl-expert'
    },
    {
      id: 'batch-001',
      title: 'S0C7 Abend in COBOL Program',
      problem: 'COBOL program terminates with S0C7 data exception abend',
      solution: 'Check for invalid numeric data in COMP-3 fields and ensure proper data validation',
      category: 'Batch',
      tags: ['s0c7', 'abend', 'cobol', 'data-exception'],
      created_at: new Date('2024-01-20'),
      updated_at: new Date('2024-01-20'),
      usage_count: 40,
      success_rate: 0.95,
      version: 1,
      status: 'active',
      created_by: 'cobol-specialist'
    },
    {
      id: 'db2-001',
      title: 'DB2 SQL Error -803 Duplicate Key',
      problem: 'INSERT statement fails with SQLCODE -803 duplicate key error',
      solution: 'Check for existing records with the same primary key values or use MERGE statement instead',
      category: 'DB2',
      tags: ['db2', 'sql-803', 'duplicate-key', 'primary-key'],
      created_at: new Date('2024-01-12'),
      updated_at: new Date('2024-01-12'),
      usage_count: 30,
      success_rate: 0.88,
      version: 1,
      status: 'active',
      created_by: 'db2-admin'
    },
    {
      id: 'functional-001',
      title: 'How to Handle File Processing Errors',
      problem: 'Need best practices for handling various file processing errors in batch jobs',
      solution: 'Implement comprehensive error handling with proper logging, retry logic, and graceful degradation',
      category: 'Functional',
      tags: ['best-practices', 'error-handling', 'file-processing', 'batch'],
      created_at: new Date('2024-01-08'),
      updated_at: new Date('2024-01-08'),
      usage_count: 20,
      success_rate: 0.90,
      version: 1,
      status: 'active',
      created_by: 'system-architect'
    }
  ];

  beforeAll(async () => {
    // Create temporary database
    tempDbPath = path.join(__dirname, '../../temp', `test-${Date.now()}.db`);
    await fs.mkdir(path.dirname(tempDbPath), { recursive: true });
    
    db = new Database(tempDbPath);
    knowledgeDB = new KnowledgeDB(tempDbPath);
    
    await knowledgeDB.initialize();
    
    // Insert test data
    for (const entry of testEntries) {
      await knowledgeDB.saveEntry(entry);
    }
  });

  beforeEach(async () => {
    // Create fresh service instances for each test
    searchService = new SearchService();
    
    // Mock AI Authorization Service for testing
    authService = {
      requestAuthorization: jest.fn().mockResolvedValue({
        authorized: true,
        action: 'approve',
        requestId: 'test-auth-123',
        autoApproved: false,
        reason: 'Test environment approval'
      })
    } as any;
    
    hybridSearchService = new HybridSearchService();
    
    // Inject dependencies for testing
    (hybridSearchService as any).authService = authService;
    (searchService as any).knowledgeDB = knowledgeDB;
  });

  afterAll(async () => {
    // Cleanup
    if (db) {
      db.close();
    }
    
    try {
      await fs.unlink(tempDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Local Search Workflow', () => {
    it('should perform fast local search within performance requirements', async () => {
      const startTime = Date.now();
      
      const result = await hybridSearchService.search('VSAM status 35', undefined, { enableAI: false });
      
      const endTime = Date.now();
      const searchTime = endTime - startTime;
      
      expect(searchTime).toBeLessThan(500); // UC001 requirement
      expect(result.performance.localCompleted).toBe(true);
      expect(result.performance.localSearchTime).toBeLessThan(500);
      expect(result.localResults.length).toBeGreaterThan(0);
      
      // Should find the VSAM entry
      const vsamResult = result.localResults.find(r => r.entry.id === 'vsam-001');
      expect(vsamResult).toBeDefined();
      expect(vsamResult!.entry.title).toContain('VSAM Status 35');
    });

    it('should search across all categories', async () => {
      const result = await hybridSearchService.search('error', undefined, { enableAI: false });
      
      expect(result.localResults.length).toBeGreaterThan(1);
      
      // Should find entries from multiple categories
      const categories = new Set(result.localResults.map(r => r.entry.category));
      expect(categories.size).toBeGreaterThan(1);
    });

    it('should filter by category when specified', async () => {
      const result = await hybridSearchService.search('error', 'DB2', { enableAI: false });
      
      expect(result.localResults.length).toBeGreaterThan(0);
      
      // All results should be from DB2 category
      const allDB2 = result.localResults.every(r => r.entry.category === 'DB2');
      expect(allDB2).toBe(true);
    });

    it('should rank results by relevance and usage', async () => {
      const result = await hybridSearchService.search('abend', undefined, { enableAI: false });
      
      expect(result.localResults.length).toBeGreaterThan(0);
      
      // Results should be ordered by score (descending)
      for (let i = 1; i < result.localResults.length; i++) {
        expect(result.localResults[i-1].score).toBeGreaterThanOrEqual(result.localResults[i].score);
      }
    });

    it('should handle fuzzy matching for typos', async () => {
      const result = await hybridSearchService.search('VSEM status', undefined, { enableAI: false });
      
      // Should still find VSAM results despite typo
      expect(result.localResults.length).toBeGreaterThan(0);
      const vsamResult = result.localResults.find(r => r.entry.title.includes('VSAM'));
      expect(vsamResult).toBeDefined();
    });

    it('should search in tags effectively', async () => {
      const result = await hybridSearchService.search('s0c7', undefined, { enableAI: false });
      
      expect(result.localResults.length).toBeGreaterThan(0);
      
      // Should find entry with s0c7 tag
      const s0c7Result = result.localResults.find(r => r.entry.tags?.includes('s0c7'));
      expect(s0c7Result).toBeDefined();
    });
  });

  describe('Hybrid Search Workflow with Authorization', () => {
    it('should request authorization for AI enhancement', async () => {
      const result = await hybridSearchService.search('how to troubleshoot complex issues');
      
      expect(authService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'semantic_search',
          query: 'how to troubleshoot complex issues'
        })
      );
      
      expect(result.performance.authorizationRequired).toBe(true);
      expect(result.metadata.authorizationStatus).toBe('approved');
    });

    it('should merge local and AI results when authorized', async () => {
      // Mock AI results
      const mockAIResults = [{
        entry: {
          id: 'ai-generated-1',
          title: 'AI-Enhanced Troubleshooting Guide',
          problem: 'Complex system troubleshooting scenarios',
          solution: 'AI-generated comprehensive troubleshooting approach',
          category: 'Functional' as KBCategory,
          tags: ['ai-enhanced', 'troubleshooting'],
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 0,
          success_rate: 0.0,
          version: 1,
          status: 'active',
          created_by: 'ai-system'
        },
        score: 95,
        matchType: 'semantic' as any,
        highlights: ['AI-Enhanced Troubleshooting'],
        metadata: {
          processingTime: 250,
          source: 'ai',
          confidence: 0.95,
          fallback: false
        }
      }];
      
      // Mock the search service to return AI results
      jest.spyOn(searchService, 'search').mockImplementation((query) => {
        if (query.useAI) {
          return Promise.resolve({
            success: true,
            data: { results: mockAIResults }
          });
        } else {
          return Promise.resolve({
            success: true,
            data: { results: [] }
          });
        }
      });
      
      const result = await hybridSearchService.search('complex troubleshooting best practices');
      
      expect(result.aiResults.length).toBeGreaterThan(0);
      expect(result.mergedResults.length).toBeGreaterThan(0);
      expect(result.performance.aiCompleted).toBe(true);
    });

    it('should handle authorization denial gracefully', async () => {
      // Mock authorization denial
      (authService.requestAuthorization as jest.Mock).mockResolvedValue({
        authorized: false,
        action: 'deny',
        requestId: 'test-deny-123',
        autoApproved: false,
        reason: 'User denied AI access'
      });
      
      const result = await hybridSearchService.search('confidential system information');
      
      expect(result.aiResults).toHaveLength(0);
      expect(result.metadata.authorizationStatus).toBe('denied');
      expect(result.performance.aiCompleted).toBe(false);
      
      // Should still have local results
      expect(result.localResults.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect PII and request appropriate authorization', async () => {
      const piiQuery = 'user john.doe@company.com needs help with issue';
      
      await hybridSearchService.search(piiQuery);
      
      expect(authService.requestAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          dataContext: expect.objectContaining({
            containsPII: true
          })
        })
      );
    });

    it('should prioritize local results in merged output', async () => {
      const result = await hybridSearchService.search('best practices', undefined, { prioritizeLocal: true });
      
      if (result.mergedResults.length > 1) {
        const firstResult = result.mergedResults[0];
        expect(firstResult.metadata.source).toBe('local');
      }
    });

    it('should deduplicate merged results effectively', async () => {
      // This test would need mock data that creates duplicates
      const result = await hybridSearchService.search('file processing');
      
      const ids = new Set(result.mergedResults.map(r => r.entry.id));
      expect(ids.size).toBe(result.mergedResults.length); // No duplicate IDs
      
      expect(result.metadata.duplicatesRemoved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Search Performance and Quality', () => {
    it('should meet performance requirements for various query types', async () => {
      const queries = [
        'VSAM',
        'S0C7 error handling',
        'DB2 SQL optimization',
        'JCL step name validation',
        'best practices for error handling'
      ];
      
      for (const query of queries) {
        const startTime = Date.now();
        const result = await hybridSearchService.search(query, undefined, { enableAI: false });
        const endTime = Date.now();
        
        expect(endTime - startTime).toBeLessThan(500);
        expect(result.performance.localCompleted).toBe(true);
      }
    });

    it('should provide relevant results for technical queries', async () => {
      const technicalQueries = [
        { query: 'VSAM status 35', expectedCategory: 'VSAM' },
        { query: 'S0C7 abend', expectedCategory: 'Batch' },
        { query: 'SQL -803 error', expectedCategory: 'DB2' },
        { query: 'JCL syntax error', expectedCategory: 'JCL' }
      ];
      
      for (const { query, expectedCategory } of technicalQueries) {
        const result = await hybridSearchService.search(query, undefined, { enableAI: false });
        
        expect(result.localResults.length).toBeGreaterThan(0);
        
        // At least one result should be from the expected category
        const hasExpectedCategory = result.localResults.some(r => r.entry.category === expectedCategory);
        expect(hasExpectedCategory).toBe(true);
      }
    });

    it('should handle concurrent searches effectively', async () => {
      const queries = ['VSAM', 'DB2', 'JCL', 'Batch', 'Functional'];
      
      const searchPromises = queries.map(query => 
        hybridSearchService.search(query, undefined, { enableAI: false })
      );
      
      const results = await Promise.all(searchPromises);
      
      // All searches should complete successfully
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.performance.localCompleted).toBe(true);
        expect(result.performance.localSearchTime).toBeLessThan(500);
      });
    });

    it('should maintain search quality under load', async () => {
      const concurrentSearches = 10;
      const query = 'error handling best practices';
      
      const promises = Array(concurrentSearches).fill(0).map(() => 
        hybridSearchService.search(query, undefined, { enableAI: false })
      );
      
      const results = await Promise.all(promises);
      
      // All searches should return consistent results
      const firstResultCount = results[0].localResults.length;
      results.forEach(result => {
        expect(result.localResults.length).toBe(firstResultCount);
        expect(result.performance.localCompleted).toBe(true);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from database connection issues', async () => {
      // Temporarily close the database to simulate connection issue
      db.close();
      
      const result = await hybridSearchService.search('test query', undefined, { enableAI: false });
      
      // Should handle error gracefully
      expect(result.metadata.errorMessages).toBeDefined();
      expect(result.metadata.errorMessages!.length).toBeGreaterThan(0);
      
      // Recreate database for cleanup
      db = new Database(tempDbPath);
    });

    it('should handle malformed queries gracefully', async () => {
      const malformedQueries = [
        '',
        '   ',
        null as any,
        undefined as any,
        'a'.repeat(1000), // Very long query
        'SELECT * FROM table', // SQL injection attempt
        '<script>alert("xss")</script>' // XSS attempt
      ];
      
      for (const query of malformedQueries) {
        const result = await hybridSearchService.search(query, undefined, { enableAI: false });
        
        // Should not throw errors
        expect(result).toBeDefined();
        expect(result.performance.totalTime).toBeGreaterThan(0);
      }
    });

    it('should handle authorization service failures', async () => {
      // Mock authorization service failure
      (authService.requestAuthorization as jest.Mock).mockRejectedValue(new Error('Auth service down'));
      
      const result = await hybridSearchService.search('complex query needing AI');
      
      // Should still complete with local results
      expect(result.localResults).toBeDefined();
      expect(result.aiResults).toHaveLength(0);
      expect(result.metadata.errorMessages).toContain(expect.stringContaining('Authorization request failed'));
    });

    it('should timeout long-running searches appropriately', async () => {
      // Mock slow search
      const slowSearchService = {
        search: jest.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              success: true,
              data: { results: [] }
            }), 600) // Longer than 500ms timeout
          )
        )
      };
      
      (hybridSearchService as any).searchService = slowSearchService;
      
      const result = await hybridSearchService.search('slow query', undefined, { enableAI: false });
      
      // Should handle timeout gracefully
      expect(result.metadata.errorMessages).toBeDefined();
    });
  });

  describe('Integration Health Checks', () => {
    it('should provide comprehensive health status', async () => {
      const health = await hybridSearchService.getHealthStatus();
      
      expect(health).toEqual(expect.objectContaining({
        healthy: expect.any(Boolean),
        localSearchAvailable: expect.any(Boolean),
        aiSearchAvailable: expect.any(Boolean),
        authorizationAvailable: expect.any(Boolean),
        performanceMetrics: expect.objectContaining({
          averageLocalSearchTime: expect.any(Number),
          averageAISearchTime: expect.any(Number),
          averageAuthorizationTime: expect.any(Number)
        })
      }));
    });

    it('should detect when services are unavailable', async () => {
      // Remove auth service
      (hybridSearchService as any).authService = null;
      
      const health = await hybridSearchService.getHealthStatus();
      
      expect(health.authorizationAvailable).toBe(false);
    });
  });

  describe('End-to-End User Scenarios', () => {
    it('should handle typical support analyst workflow', async () => {
      // Scenario: Support analyst searching for VSAM issues
      const result1 = await hybridSearchService.search('VSAM file not found');
      expect(result1.localResults.length).toBeGreaterThan(0);
      
      // Drill down to specific category
      const result2 = await hybridSearchService.search('status 35', 'VSAM');
      expect(result2.localResults.every(r => r.entry.category === 'VSAM')).toBe(true);
      
      // Look for related error codes
      const result3 = await hybridSearchService.search('VSAM status codes');
      expect(result3.performance.localSearchTime).toBeLessThan(500);
    });

    it('should handle developer troubleshooting workflow', async () => {
      // Scenario: Developer investigating a crash
      const result1 = await hybridSearchService.search('S0C7 abend COBOL');
      expect(result1.localResults.length).toBeGreaterThan(0);
      
      // Look for similar issues
      const result2 = await hybridSearchService.search('data exception abend');
      expect(result2.localResults.length).toBeGreaterThan(0);
      
      // Search for best practices
      const result3 = await hybridSearchService.search('how to prevent data exceptions');
      // This should trigger AI enhancement
      expect(result3.performance.authorizationRequired).toBe(true);
    });

    it('should handle system administrator workflow', async () => {
      // Scenario: Admin looking up procedures
      const result1 = await hybridSearchService.search('DB2 duplicate key error');
      expect(result1.localResults.length).toBeGreaterThan(0);
      
      // Search across multiple categories
      const result2 = await hybridSearchService.search('error handling');
      const categories = new Set(result2.localResults.map(r => r.entry.category));
      expect(categories.size).toBeGreaterThan(1);
    });
  });
});
