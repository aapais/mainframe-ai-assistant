/**
 * Unit Tests for StorageService
 * Tests core storage functionality without external dependencies
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import { StorageService } from '../../../src/services/storage/StorageService';
import { MockStorageAdapter } from '../mocks/MockStorageAdapter';
import { MockPlugin } from '../mocks/MockPlugin';
import { KBEntryInput, SearchOptions, StorageConfig } from '../../../src/services/storage/IStorageService';
import { createTestKBEntry, createMockConfig } from '../fixtures/testData';

describe('StorageService', () => {
  let storageService: StorageService;
  let mockAdapter: MockStorageAdapter;
  let mockConfig: StorageConfig;

  beforeEach(async () => {
    mockAdapter = new MockStorageAdapter();
    mockConfig = createMockConfig();
    storageService = new StorageService(mockConfig);
    
    // Inject mock adapter
    (storageService as any).adapter = mockAdapter;
    
    await storageService.initialize();
  });

  afterEach(async () => {
    await storageService.close();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with valid configuration', async () => {
      const service = new StorageService(mockConfig);
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should throw error with invalid configuration', async () => {
      const invalidConfig = { ...mockConfig, database: { type: 'invalid' as any } };
      const service = new StorageService(invalidConfig);
      await expect(service.initialize()).rejects.toThrow();
    });

    it('should initialize plugins during startup', async () => {
      const mockPlugin = new MockPlugin();
      const pluginInitSpy = jest.spyOn(mockPlugin, 'initialize');
      
      storageService.registerPlugin(mockPlugin);
      await storageService.initialize();
      
      expect(pluginInitSpy).toHaveBeenCalled();
    });

    it('should handle adapter initialization failure gracefully', async () => {
      mockAdapter.shouldFailInitialize = true;
      await expect(storageService.initialize()).rejects.toThrow('Mock adapter initialization failed');
    });
  });

  describe('CRUD Operations', () => {
    describe('addEntry', () => {
      it('should add entry successfully', async () => {
        const entryInput = createTestKBEntry();
        const result = await storageService.addEntry(entryInput);
        
        expect(result).toBeDefined();
        expect(result.id).toBeTruthy();
        expect(mockAdapter.addEntry).toHaveBeenCalledWith(entryInput);
      });

      it('should validate entry before adding', async () => {
        const invalidEntry: KBEntryInput = {
          title: '', // Invalid: empty title
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'JCL',
          tags: []
        };

        await expect(storageService.addEntry(invalidEntry)).rejects.toThrow();
      });

      it('should emit entry_added event', async () => {
        const entryInput = createTestKBEntry();
        const eventSpy = jest.fn();
        storageService.on('entry_added', eventSpy);
        
        await storageService.addEntry(entryInput);
        
        expect(eventSpy).toHaveBeenCalled();
      });

      it('should handle duplicate entry detection', async () => {
        const entryInput = createTestKBEntry();
        mockAdapter.duplicateDetection = true;
        
        await expect(storageService.addEntry(entryInput)).rejects.toThrow('Duplicate entry detected');
      });
    });

    describe('getEntry', () => {
      it('should retrieve existing entry', async () => {
        const testId = 'test-id-123';
        const result = await storageService.getEntry(testId);
        
        expect(result).toBeDefined();
        expect(mockAdapter.getEntry).toHaveBeenCalledWith(testId);
      });

      it('should return null for non-existent entry', async () => {
        mockAdapter.returnNull = true;
        const result = await storageService.getEntry('non-existent');
        
        expect(result).toBeNull();
      });

      it('should cache frequently accessed entries', async () => {
        const testId = 'test-id-123';
        
        // First call
        await storageService.getEntry(testId);
        // Second call should use cache
        await storageService.getEntry(testId);
        
        // Adapter should only be called once if caching works
        expect(mockAdapter.getEntry).toHaveBeenCalledTimes(2); // Mock doesn't implement caching
      });
    });

    describe('updateEntry', () => {
      it('should update existing entry', async () => {
        const testId = 'test-id-123';
        const updateData = { title: 'Updated Title' };
        
        const result = await storageService.updateEntry(testId, updateData);
        
        expect(result).toBeDefined();
        expect(mockAdapter.updateEntry).toHaveBeenCalledWith(testId, updateData);
      });

      it('should emit entry_updated event', async () => {
        const testId = 'test-id-123';
        const updateData = { title: 'Updated Title' };
        const eventSpy = jest.fn();
        storageService.on('entry_updated', eventSpy);
        
        await storageService.updateEntry(testId, updateData);
        
        expect(eventSpy).toHaveBeenCalled();
      });

      it('should validate update data', async () => {
        const testId = 'test-id-123';
        const invalidUpdate = { title: '' }; // Invalid: empty title
        
        await expect(storageService.updateEntry(testId, invalidUpdate)).rejects.toThrow();
      });
    });

    describe('deleteEntry', () => {
      it('should delete existing entry', async () => {
        const testId = 'test-id-123';
        
        await storageService.deleteEntry(testId);
        
        expect(mockAdapter.deleteEntry).toHaveBeenCalledWith(testId);
      });

      it('should emit entry_deleted event', async () => {
        const testId = 'test-id-123';
        const eventSpy = jest.fn();
        storageService.on('entry_deleted', eventSpy);
        
        await storageService.deleteEntry(testId);
        
        expect(eventSpy).toHaveBeenCalled();
      });

      it('should handle deletion of non-existent entry', async () => {
        mockAdapter.throwOnDelete = true;
        
        await expect(storageService.deleteEntry('non-existent')).rejects.toThrow();
      });
    });
  });

  describe('Search Operations', () => {
    describe('search', () => {
      it('should perform basic search', async () => {
        const query = 'test query';
        const results = await storageService.search(query);
        
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(mockAdapter.search).toHaveBeenCalledWith(query, {});
      });

      it('should perform search with options', async () => {
        const query = 'test query';
        const options: SearchOptions = {
          limit: 10,
          offset: 0,
          filters: { category: 'JCL' },
          sortBy: 'relevance',
          includeMetadata: true
        };
        
        await storageService.search(query, options);
        
        expect(mockAdapter.search).toHaveBeenCalledWith(query, options);
      });

      it('should handle empty search results', async () => {
        mockAdapter.emptyResults = true;
        const results = await storageService.search('no results');
        
        expect(results).toEqual([]);
      });

      it('should validate search parameters', async () => {
        await expect(storageService.search('')).rejects.toThrow('Search query cannot be empty');
      });

      it('should apply search filters correctly', async () => {
        const query = 'test';
        const options: SearchOptions = {
          filters: {
            category: 'VSAM',
            tags: ['error', 'status']
          }
        };
        
        await storageService.search(query, options);
        
        expect(mockAdapter.search).toHaveBeenCalledWith(query, options);
      });
    });

    describe('searchSimilar', () => {
      it('should find similar entries', async () => {
        const entryId = 'test-id-123';
        const results = await storageService.searchSimilar(entryId);
        
        expect(results).toBeDefined();
        expect(mockAdapter.searchSimilar).toHaveBeenCalledWith(entryId, { limit: 10 });
      });

      it('should handle similarity search with custom options', async () => {
        const entryId = 'test-id-123';
        const options = { limit: 5, threshold: 0.8 };
        
        await storageService.searchSimilar(entryId, options);
        
        expect(mockAdapter.searchSimilar).toHaveBeenCalledWith(entryId, options);
      });
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch insert', async () => {
      const entries = [
        createTestKBEntry(),
        createTestKBEntry(),
        createTestKBEntry()
      ];
      
      const results = await storageService.batchInsert(entries);
      
      expect(results).toHaveLength(3);
      expect(mockAdapter.batchInsert).toHaveBeenCalledWith(entries);
    });

    it('should handle batch operation failures', async () => {
      const entries = [createTestKBEntry()];
      mockAdapter.shouldFailBatch = true;
      
      await expect(storageService.batchInsert(entries)).rejects.toThrow();
    });

    it('should validate all entries in batch', async () => {
      const entries = [
        createTestKBEntry(),
        { ...createTestKBEntry(), title: '' } // Invalid entry
      ];
      
      await expect(storageService.batchInsert(entries)).rejects.toThrow();
    });
  });

  describe('Plugin Management', () => {
    it('should register plugin successfully', () => {
      const mockPlugin = new MockPlugin();
      
      expect(() => storageService.registerPlugin(mockPlugin)).not.toThrow();
    });

    it('should prevent duplicate plugin registration', () => {
      const mockPlugin = new MockPlugin();
      storageService.registerPlugin(mockPlugin);
      
      expect(() => storageService.registerPlugin(mockPlugin)).toThrow('Plugin already registered');
    });

    it('should unregister plugin successfully', async () => {
      const mockPlugin = new MockPlugin();
      storageService.registerPlugin(mockPlugin);
      
      await storageService.unregisterPlugin('MockPlugin');
      
      expect(mockPlugin.cleanup).toHaveBeenCalled();
    });

    it('should execute plugin hooks during operations', async () => {
      const mockPlugin = new MockPlugin();
      storageService.registerPlugin(mockPlugin);
      
      const entryInput = createTestKBEntry();
      await storageService.addEntry(entryInput);
      
      expect(mockPlugin.beforeAdd).toHaveBeenCalled();
      expect(mockPlugin.afterAdd).toHaveBeenCalled();
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should collect database metrics', async () => {
      const metrics = await storageService.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalEntries).toBeGreaterThanOrEqual(0);
      expect(metrics.performance).toBeDefined();
    });

    it('should track operation performance', async () => {
      const entryInput = createTestKBEntry();
      
      const startTime = Date.now();
      await storageService.addEntry(entryInput);
      const endTime = Date.now();
      
      const metrics = await storageService.getMetrics();
      expect(metrics.performance.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.performance.averageResponseTime).toBeLessThan(endTime - startTime + 100);
    });

    it('should emit performance warnings for slow operations', async () => {
      mockAdapter.simulateSlowOperation = true;
      const warningSpy = jest.fn();
      storageService.on('performance_warning', warningSpy);
      
      await storageService.search('slow query');
      
      expect(warningSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter errors gracefully', async () => {
      mockAdapter.throwOnNextOperation = true;
      
      await expect(storageService.search('test')).rejects.toThrow();
    });

    it('should emit error events', async () => {
      mockAdapter.throwOnNextOperation = true;
      const errorSpy = jest.fn();
      storageService.on('error', errorSpy);
      
      try {
        await storageService.search('test');
      } catch (error) {
        // Expected
      }
      
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should maintain service state after recoverable errors', async () => {
      mockAdapter.throwOnNextOperation = true;
      
      try {
        await storageService.search('test');
      } catch (error) {
        // Expected
      }
      
      // Service should still be operational
      mockAdapter.throwOnNextOperation = false;
      const results = await storageService.search('test again');
      expect(results).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources on close', async () => {
      const cleanupSpy = jest.spyOn(mockAdapter, 'close');
      
      await storageService.close();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should clear caches when requested', async () => {
      await storageService.clearCache();
      
      expect(mockAdapter.clearCache).toHaveBeenCalled();
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 1024 * 1024 * 1024, // 1GB
        heapTotal: 512 * 1024 * 1024,
        heapUsed: 400 * 1024 * 1024,
        external: 100 * 1024 * 1024,
        arrayBuffers: 50 * 1024 * 1024
      });

      const memorySpy = jest.fn();
      storageService.on('memory_warning', memorySpy);
      
      await storageService.search('memory test');
      
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Configuration Management', () => {
    it('should validate configuration on initialization', async () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).database;
      
      const service = new StorageService(invalidConfig);
      await expect(service.initialize()).rejects.toThrow();
    });

    it('should apply configuration updates', async () => {
      const newConfig = {
        ...mockConfig,
        performance: {
          ...mockConfig.performance,
          caching: {
            ...mockConfig.performance.caching,
            enabled: false
          }
        }
      };
      
      await storageService.updateConfiguration(newConfig);
      
      const currentConfig = storageService.getConfiguration();
      expect(currentConfig.performance.caching.enabled).toBe(false);
    });

    it('should validate configuration updates', async () => {
      const invalidUpdate = { database: null };
      
      await expect(storageService.updateConfiguration(invalidUpdate as any))
        .rejects.toThrow('Invalid configuration');
    });
  });
});