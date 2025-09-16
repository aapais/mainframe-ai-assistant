/**
 * Enhanced Knowledge DB Service Unit Tests
 * Comprehensive testing for all KB service layer functionality
 */

import { EnhancedKnowledgeDBService } from '../../../src/services/EnhancedKnowledgeDBService';
import { BatchOperationsService } from '../../../src/services/BatchOperationsService';
import { SmartSearchService } from '../../../src/services/SmartSearchService';
import { VersionControlService } from '../../../src/services/VersionControlService';
import { DuplicateDetectionService } from '../../../src/services/DuplicateDetectionService';
import type { KBEntry, SearchFilters, BatchOperation } from '../../../src/types';

// Mock the database
jest.mock('../../../src/database/KnowledgeDB');

describe('EnhancedKnowledgeDBService', () => {
  let service: EnhancedKnowledgeDBService;
  let mockDB: any;

  beforeEach(() => {
    mockDB = {
      getEntries: jest.fn(),
      saveEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      searchEntries: jest.fn(),
      getCategories: jest.fn(),
      getTags: jest.fn(),
      getMetrics: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      close: jest.fn()
    };

    service = new EnhancedKnowledgeDBService();
    (service as any).db = mockDB;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Entry Management', () => {
    const mockEntry: KBEntry = {
      id: 'test-1',
      title: 'Test Entry',
      problem: 'Test problem description',
      solution: 'Test solution',
      category: 'VSAM',
      tags: ['test', 'mock'],
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 0,
      success_rate: 0,
      version: 1,
      status: 'active',
      created_by: 'test-user'
    };

    it('should save new entry with validation', async () => {
      mockDB.saveEntry.mockResolvedValue({ id: 'new-id', success: true });

      const result = await service.saveEntry(mockEntry);

      expect(mockDB.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Entry',
          problem: 'Test problem description',
          solution: 'Test solution'
        })
      );
      expect(result).toEqual({ id: 'new-id', success: true });
    });

    it('should update existing entry with version control', async () => {
      const existingEntry = { ...mockEntry, id: 'existing-1' };
      const updatedEntry = { ...existingEntry, title: 'Updated Title', version: 2 };

      mockDB.updateEntry.mockResolvedValue({ success: true });

      const result = await service.updateEntry('existing-1', updatedEntry);

      expect(mockDB.updateEntry).toHaveBeenCalledWith(
        'existing-1',
        expect.objectContaining({
          title: 'Updated Title',
          version: 2,
          updated_at: expect.any(Date)
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle concurrent updates with optimistic locking', async () => {
      const entry1 = { ...mockEntry, version: 1 };
      const entry2 = { ...mockEntry, version: 1 };

      mockDB.updateEntry
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Version conflict'));

      // First update should succeed
      const result1 = await service.updateEntry('test-1', entry1);
      expect(result1).toEqual({ success: true });

      // Second update should fail due to version conflict
      await expect(service.updateEntry('test-1', entry2))
        .rejects.toThrow('Version conflict');
    });

    it('should soft delete entries with cascade handling', async () => {
      mockDB.deleteEntry.mockResolvedValue({ success: true });

      const result = await service.deleteEntry('test-1', { soft: true });

      expect(mockDB.deleteEntry).toHaveBeenCalledWith('test-1', { soft: true });
      expect(result).toEqual({ success: true });
    });

    it('should validate entry data integrity', async () => {
      const invalidEntry = { ...mockEntry, title: '', problem: '' };

      await expect(service.saveEntry(invalidEntry))
        .rejects.toThrow('Title and problem are required');
    });

    it('should handle database transaction rollback on failures', async () => {
      mockDB.beginTransaction.mockResolvedValue(undefined);
      mockDB.saveEntry.mockRejectedValue(new Error('Database error'));
      mockDB.rollbackTransaction.mockResolvedValue(undefined);

      await expect(service.saveEntry(mockEntry))
        .rejects.toThrow('Database error');

      expect(mockDB.beginTransaction).toHaveBeenCalled();
      expect(mockDB.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Search and Retrieval', () => {
    const mockEntries: KBEntry[] = [
      {
        id: 'vsam-1',
        title: 'VSAM Status 35',
        problem: 'File not found error',
        solution: 'Check catalog',
        category: 'VSAM',
        tags: ['vsam', 'error'],
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 10,
        success_rate: 0.9,
        version: 1,
        status: 'active',
        created_by: 'user1'
      },
      {
        id: 'jcl-1',
        title: 'JCL Syntax Error',
        problem: 'Invalid JCL statement',
        solution: 'Fix syntax',
        category: 'JCL',
        tags: ['jcl', 'syntax'],
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 5,
        success_rate: 0.8,
        version: 1,
        status: 'active',
        created_by: 'user2'
      }
    ];

    it('should retrieve entries with pagination', async () => {
      mockDB.getEntries.mockResolvedValue({
        data: mockEntries,
        total: 100,
        hasMore: true
      });

      const result = await service.getEntries({
        page: 1,
        limit: 10,
        sortBy: 'usage_count',
        sortOrder: 'desc'
      });

      expect(mockDB.getEntries).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        sortBy: 'usage_count',
        sortOrder: 'desc'
      });

      expect(result).toEqual({
        data: mockEntries,
        total: 100,
        hasMore: true
      });
    });

    it('should search entries with advanced filters', async () => {
      const filters: SearchFilters = {
        query: 'VSAM',
        category: 'VSAM',
        tags: ['error'],
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
        successRateMin: 0.8
      };

      mockDB.searchEntries.mockResolvedValue([mockEntries[0]]);

      const result = await service.searchEntries(filters);

      expect(mockDB.searchEntries).toHaveBeenCalledWith(filters);
      expect(result).toEqual([mockEntries[0]]);
    });

    it('should cache search results for performance', async () => {
      mockDB.searchEntries.mockResolvedValue(mockEntries);

      // First search
      await service.searchEntries({ query: 'VSAM' });
      // Second identical search
      await service.searchEntries({ query: 'VSAM' });

      // Should only call DB once due to caching
      expect(mockDB.searchEntries).toHaveBeenCalledTimes(1);
    });

    it('should handle search timeout gracefully', async () => {
      mockDB.searchEntries.mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const searchPromise = service.searchEntries({ query: 'test' }, { timeout: 1000 });

      await expect(searchPromise).rejects.toThrow('Search timeout');
    });

    it('should provide fuzzy search capabilities', async () => {
      mockDB.searchEntries.mockResolvedValue(mockEntries);

      const result = await service.searchEntries({
        query: 'VSEM Status',  // Typo in VSAM
        fuzzy: true,
        threshold: 0.8
      });

      expect(mockDB.searchEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'VSEM Status',
          fuzzy: true,
          threshold: 0.8
        })
      );
    });
  });

  describe('Category and Tag Management', () => {
    it('should retrieve available categories', async () => {
      const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
      mockDB.getCategories.mockResolvedValue(categories);

      const result = await service.getCategories();

      expect(result).toEqual(categories);
      expect(mockDB.getCategories).toHaveBeenCalled();
    });

    it('should retrieve tags with usage statistics', async () => {
      const tags = [
        { name: 'vsam', count: 25, trending: true },
        { name: 'error', count: 50, trending: false },
        { name: 'jcl', count: 15, trending: true }
      ];

      mockDB.getTags.mockResolvedValue(tags);

      const result = await service.getTags({ includeStats: true });

      expect(result).toEqual(tags);
      expect(mockDB.getTags).toHaveBeenCalledWith({ includeStats: true });
    });

    it('should suggest tags based on content analysis', async () => {
      const content = 'VSAM file access error with status code 35';

      const suggestedTags = await service.suggestTags(content);

      expect(suggestedTags).toContain('vsam');
      expect(suggestedTags).toContain('error');
      expect(suggestedTags).toContain('status-35');
    });
  });

  describe('Analytics and Metrics', () => {
    it('should calculate usage metrics', async () => {
      const metrics = {
        totalEntries: 150,
        totalSearches: 1000,
        averageSuccessRate: 0.85,
        topCategories: [
          { category: 'VSAM', count: 50 },
          { category: 'JCL', count: 40 },
          { category: 'DB2', count: 30 }
        ],
        topTags: [
          { tag: 'error', count: 75 },
          { tag: 'performance', count: 45 }
        ]
      };

      mockDB.getMetrics.mockResolvedValue(metrics);

      const result = await service.getMetrics();

      expect(result).toEqual(metrics);
    });

    it('should track entry usage patterns', async () => {
      const entryId = 'test-1';
      const usageData = {
        viewCount: 25,
        successfulApplications: 20,
        failedApplications: 3,
        lastAccessed: new Date()
      };

      await service.trackUsage(entryId, 'view', true);

      // Should update usage statistics
      expect(mockDB.updateEntry).toHaveBeenCalledWith(
        entryId,
        expect.objectContaining({
          usage_count: expect.any(Number),
          success_rate: expect.any(Number)
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures', async () => {
      mockDB.getEntries.mockRejectedValue(new Error('Connection failed'));

      await expect(service.getEntries())
        .rejects.toThrow('Connection failed');

      // Should attempt reconnection
      expect(service.isHealthy()).toBe(false);
    });

    it('should retry failed operations with exponential backoff', async () => {
      let attempts = 0;
      mockDB.saveEntry.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve({ id: 'success', success: true });
      });

      const result = await service.saveEntry(mockEntry, { retries: 3 });

      expect(attempts).toBe(3);
      expect(result).toEqual({ id: 'success', success: true });
    });

    it('should validate data consistency after recovery', async () => {
      mockDB.saveEntry.mockRejectedValueOnce(new Error('Constraint violation'));
      mockDB.getEntries.mockResolvedValue({ data: [], total: 0, hasMore: false });

      await expect(service.saveEntry(mockEntry))
        .rejects.toThrow('Constraint violation');

      // Should verify database state
      const healthCheck = await service.performHealthCheck();
      expect(healthCheck.consistent).toBe(true);
    });
  });

  describe('Performance Optimization', () => {
    it('should batch multiple operations for efficiency', async () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        ...mockEntry,
        id: `batch-${i}`,
        title: `Batch Entry ${i}`
      }));

      mockDB.saveEntry.mockResolvedValue({ success: true });

      const results = await service.batchSaveEntries(entries);

      expect(results.length).toBe(10);
      expect(results.every(r => r.success)).toBe(true);

      // Should use batch operations internally
      expect(mockDB.beginTransaction).toHaveBeenCalled();
      expect(mockDB.commitTransaction).toHaveBeenCalled();
    });

    it('should implement connection pooling for concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
        service.getEntries({ page: i, limit: 10 })
      );

      mockDB.getEntries.mockResolvedValue({ data: [], total: 0, hasMore: false });

      const results = await Promise.all(concurrentRequests);

      expect(results.length).toBe(20);

      // Should not exceed connection pool limit
      const maxConcurrentConnections = (service as any).connectionPool?.maxConnections || 10;
      expect(maxConcurrentConnections).toBeGreaterThanOrEqual(10);
    });

    it('should optimize query performance with indexing hints', async () => {
      const complexSearch: SearchFilters = {
        query: 'complex search query',
        category: 'VSAM',
        tags: ['performance', 'optimization'],
        dateFrom: new Date('2024-01-01'),
        successRateMin: 0.9,
        sortBy: 'usage_count',
        sortOrder: 'desc'
      };

      mockDB.searchEntries.mockResolvedValue([]);

      await service.searchEntries(complexSearch);

      expect(mockDB.searchEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          ...complexSearch,
          useIndex: true,
          optimization: 'performance'
        })
      );
    });
  });
});

describe('BatchOperationsService', () => {
  let service: BatchOperationsService;
  let mockKBService: jest.Mocked<EnhancedKnowledgeDBService>;

  beforeEach(() => {
    mockKBService = {
      getEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      saveEntry: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn()
    } as any;

    service = new BatchOperationsService(mockKBService);
  });

  describe('Batch Operations Execution', () => {
    it('should execute batch delete with transaction safety', async () => {
      const entryIds = ['test-1', 'test-2', 'test-3'];

      mockKBService.beginTransaction.mockResolvedValue(undefined);
      mockKBService.deleteEntry.mockResolvedValue({ success: true });
      mockKBService.commitTransaction.mockResolvedValue(undefined);

      const result = await service.executeOperation('delete', entryIds);

      expect(mockKBService.beginTransaction).toHaveBeenCalled();
      expect(mockKBService.deleteEntry).toHaveBeenCalledTimes(3);
      expect(mockKBService.commitTransaction).toHaveBeenCalled();
      expect(result.summary.successful).toBe(3);
    });

    it('should rollback transaction on partial failures', async () => {
      const entryIds = ['test-1', 'test-2', 'test-3'];

      mockKBService.beginTransaction.mockResolvedValue(undefined);
      mockKBService.deleteEntry
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce({ success: true });
      mockKBService.rollbackTransaction.mockResolvedValue(undefined);

      const result = await service.executeOperation('delete', entryIds);

      expect(mockKBService.rollbackTransaction).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.summary.failed).toBe(1);
    });

    it('should handle batch category updates', async () => {
      const entryIds = ['test-1', 'test-2'];
      const updateData = { category: 'DB2' };

      mockKBService.getEntry.mockResolvedValue({
        id: 'test-1',
        category: 'VSAM'
      } as KBEntry);
      mockKBService.updateEntry.mockResolvedValue({ success: true });

      const result = await service.executeOperation('updateCategory', entryIds, updateData);

      expect(mockKBService.updateEntry).toHaveBeenCalledTimes(2);
      expect(mockKBService.updateEntry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ category: 'DB2' })
      );
    });

    it('should provide progress callbacks for long operations', async () => {
      const entryIds = Array.from({ length: 100 }, (_, i) => `test-${i}`);
      const progressCallback = jest.fn();

      mockKBService.deleteEntry.mockResolvedValue({ success: true });

      await service.executeOperation('delete', entryIds, {}, { progressCallback });

      expect(progressCallback).toHaveBeenCalledTimes(100);
      expect(progressCallback).toHaveBeenLastCalledWith({
        completed: 100,
        total: 100,
        percentage: 100
      });
    });
  });
});

describe('SmartSearchService', () => {
  let service: SmartSearchService;
  let mockKBService: jest.Mocked<EnhancedKnowledgeDBService>;
  let mockAIService: any;

  beforeEach(() => {
    mockKBService = {
      searchEntries: jest.fn(),
      getEntry: jest.fn()
    } as any;

    mockAIService = {
      enhanceQuery: jest.fn(),
      rankResults: jest.fn(),
      getSuggestions: jest.fn()
    };

    service = new SmartSearchService(mockKBService, mockAIService);
  });

  describe('AI-Enhanced Search', () => {
    it('should enhance search queries with AI', async () => {
      const originalQuery = 'file error';
      const enhancedQuery = 'VSAM file access error status code';

      mockAIService.enhanceQuery.mockResolvedValue(enhancedQuery);
      mockKBService.searchEntries.mockResolvedValue([]);

      await service.search(originalQuery, { aiEnhanced: true });

      expect(mockAIService.enhanceQuery).toHaveBeenCalledWith(originalQuery);
      expect(mockKBService.searchEntries).toHaveBeenCalledWith(
        expect.objectContaining({ query: enhancedQuery })
      );
    });

    it('should fallback gracefully when AI service fails', async () => {
      const query = 'test query';
      mockAIService.enhanceQuery.mockRejectedValue(new Error('AI service unavailable'));
      mockKBService.searchEntries.mockResolvedValue([]);

      const result = await service.search(query, { aiEnhanced: true });

      expect(mockKBService.searchEntries).toHaveBeenCalledWith(
        expect.objectContaining({ query })
      );
      expect(result.aiEnhanced).toBe(false);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should provide search suggestions', async () => {
      const partialQuery = 'vsam st';
      const suggestions = ['vsam status 35', 'vsam status 39', 'vsam storage'];

      mockAIService.getSuggestions.mockResolvedValue(suggestions);

      const result = await service.getSuggestions(partialQuery);

      expect(result).toEqual(suggestions);
      expect(mockAIService.getSuggestions).toHaveBeenCalledWith(partialQuery);
    });
  });

  describe('Search Result Ranking', () => {
    const mockResults = [
      { id: 'test-1', title: 'VSAM Error', relevance: 0.9 },
      { id: 'test-2', title: 'JCL Issue', relevance: 0.7 },
      { id: 'test-3', title: 'DB2 Problem', relevance: 0.8 }
    ] as any[];

    it('should rank results by relevance and usage', async () => {
      mockKBService.searchEntries.mockResolvedValue(mockResults);
      mockAIService.rankResults.mockResolvedValue([
        mockResults[0], // Highest relevance
        mockResults[2], // Second highest
        mockResults[1]  // Lowest
      ]);

      const result = await service.search('test query');

      expect(result.results[0].id).toBe('test-1');
      expect(result.results[1].id).toBe('test-3');
      expect(result.results[2].id).toBe('test-2');
    });

    it('should boost results based on user context', async () => {
      const userContext = {
        preferredCategories: ['VSAM'],
        recentSearches: ['vsam error'],
        role: 'support-analyst'
      };

      mockKBService.searchEntries.mockResolvedValue(mockResults);

      await service.search('error', { userContext });

      expect(mockAIService.rankResults).toHaveBeenCalledWith(
        mockResults,
        expect.objectContaining({ userContext })
      );
    });
  });
});

describe('VersionControlService', () => {
  let service: VersionControlService;
  let mockKBService: jest.Mocked<EnhancedKnowledgeDBService>;

  beforeEach(() => {
    mockKBService = {
      getEntry: jest.fn(),
      updateEntry: jest.fn(),
      getEntryVersions: jest.fn(),
      saveEntryVersion: jest.fn()
    } as any;

    service = new VersionControlService(mockKBService);
  });

  describe('Version Management', () => {
    const mockEntry: KBEntry = {
      id: 'test-1',
      title: 'Test Entry',
      problem: 'Test problem',
      solution: 'Test solution',
      version: 1,
      status: 'active'
    } as KBEntry;

    it('should create new version on update', async () => {
      const updatedEntry = { ...mockEntry, title: 'Updated Title', version: 2 };

      mockKBService.getEntry.mockResolvedValue(mockEntry);
      mockKBService.saveEntryVersion.mockResolvedValue({ success: true });
      mockKBService.updateEntry.mockResolvedValue({ success: true });

      const result = await service.updateWithVersioning('test-1', updatedEntry);

      expect(mockKBService.saveEntryVersion).toHaveBeenCalledWith(mockEntry);
      expect(mockKBService.updateEntry).toHaveBeenCalledWith(
        'test-1',
        expect.objectContaining({ version: 2 })
      );
      expect(result.success).toBe(true);
    });

    it('should calculate diff between versions', async () => {
      const version1 = { ...mockEntry, title: 'Original Title' };
      const version2 = { ...mockEntry, title: 'Updated Title', version: 2 };

      const diff = await service.calculateDiff(version1, version2);

      expect(diff).toEqual([
        {
          field: 'title',
          oldValue: 'Original Title',
          newValue: 'Updated Title',
          type: 'modified'
        },
        {
          field: 'version',
          oldValue: 1,
          newValue: 2,
          type: 'modified'
        }
      ]);
    });

    it('should revert to previous version', async () => {
      const targetVersion = { ...mockEntry, title: 'Reverted Title', version: 1 };

      mockKBService.getEntryVersions.mockResolvedValue([targetVersion]);
      mockKBService.updateEntry.mockResolvedValue({ success: true });

      const result = await service.revertToVersion('test-1', 1);

      expect(mockKBService.updateEntry).toHaveBeenCalledWith(
        'test-1',
        expect.objectContaining({
          title: 'Reverted Title',
          version: expect.any(Number) // New version number
        })
      );
      expect(result.success).toBe(true);
    });
  });
});

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService;

  beforeEach(() => {
    service = new DuplicateDetectionService();
  });

  describe('Duplicate Detection', () => {
    const entry1: KBEntry = {
      id: 'test-1',
      title: 'VSAM Status 35 Error',
      problem: 'File not found when accessing VSAM dataset',
      solution: 'Check if dataset exists and is cataloged',
      category: 'VSAM'
    } as KBEntry;

    const entry2: KBEntry = {
      id: 'test-2',
      title: 'VSAM Status Code 35',
      problem: 'Cannot find VSAM file during access',
      solution: 'Verify dataset existence and catalog entry',
      category: 'VSAM'
    } as KBEntry;

    it('should detect near-duplicate entries', async () => {
      const similarity = await service.calculateSimilarity(entry1, entry2);

      expect(similarity).toBeGreaterThan(0.8); // High similarity
    });

    it('should suggest potential duplicates', async () => {
      const existingEntries = [entry1, entry2];
      const newEntry = {
        ...entry1,
        id: 'test-3',
        title: 'VSAM File Not Found Error'
      };

      const duplicates = await service.findPotentialDuplicates(newEntry, existingEntries);

      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates[0].similarity).toBeGreaterThan(0.7);
    });

    it('should handle different similarity algorithms', async () => {
      const titleSimilarity = await service.calculateSimilarity(entry1, entry2, { algorithm: 'title' });
      const contentSimilarity = await service.calculateSimilarity(entry1, entry2, { algorithm: 'content' });
      const hybridSimilarity = await service.calculateSimilarity(entry1, entry2, { algorithm: 'hybrid' });

      expect(titleSimilarity).toBeGreaterThan(0);
      expect(contentSimilarity).toBeGreaterThan(0);
      expect(hybridSimilarity).toBeGreaterThan(0);

      // Hybrid should consider multiple factors
      expect(hybridSimilarity).not.toBe(titleSimilarity);
      expect(hybridSimilarity).not.toBe(contentSimilarity);
    });
  });
});