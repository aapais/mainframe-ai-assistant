import { EnhancedTagService, Tag, TagSuggestion, TagMergeOperation } from '../../../src/services/EnhancedTagService';

// Mock the KnowledgeBaseService
jest.mock('../../../src/services/KnowledgeBaseService');

describe('EnhancedTagService', () => {
  let service: EnhancedTagService;
  let mockKnowledgeBaseService: any;

  beforeEach(() => {
    mockKnowledgeBaseService = {
      findEntriesByTag: jest.fn(),
      updateEntry: jest.fn(),
      getAllTags: jest.fn(),
      getTagFrequency: jest.fn(),
    };
    service = new EnhancedTagService(mockKnowledgeBaseService);
  });

  afterEach(() => {
    service.removeAllListeners();
    jest.clearAllMocks();
  });

  describe('getSuggestions', () => {
    beforeEach(() => {
      // Mock frequently used tags
      mockKnowledgeBaseService.getAllTags.mockResolvedValue([
        'vsam', 'jcl', 'cobol', 'db2', 'mainframe',
        'batch', 'cics', 'ims', 'dataset', 'abend',
        'storage', 'performance', 'debugging', 'error-handling'
      ]);

      mockKnowledgeBaseService.getTagFrequency.mockImplementation((tag: string) => {
        const frequencies = {
          'vsam': 45,
          'jcl': 38,
          'cobol': 32,
          'db2': 28,
          'mainframe': 25,
          'batch': 22,
          'cics': 18,
          'ims': 15,
          'dataset': 12,
          'abend': 10,
          'storage': 8,
          'performance': 6,
          'debugging': 4,
          'error-handling': 2
        };
        return Promise.resolve(frequencies[tag] || 0);
      });
    });

    it('should return frequency-based suggestions for partial matches', async () => {
      const suggestions = await service.getSuggestions('v', {
        limit: 5,
        includeFrequency: true,
      });

      expect(suggestions).toEqual([
        expect.objectContaining({
          tag: 'vsam',
          frequency: 45,
          source: 'frequency',
        }),
      ]);
    });

    it('should return fuzzy match suggestions', async () => {
      const suggestions = await service.getSuggestions('jcll', {
        limit: 5,
        includeFuzzy: true,
      });

      const jclSuggestion = suggestions.find(s => s.tag === 'jcl');
      expect(jclSuggestion).toBeDefined();
      expect(jclSuggestion?.source).toBe('fuzzy');
    });

    it('should return context-aware suggestions', async () => {
      const suggestions = await service.getSuggestions('data', {
        limit: 5,
        context: {
          category: 'VSAM',
          existingTags: ['file'],
        },
      });

      expect(suggestions.some(s => s.tag === 'dataset')).toBe(true);
    });

    it('should exclude already used tags', async () => {
      const suggestions = await service.getSuggestions('', {
        limit: 10,
        context: {
          existingTags: ['vsam', 'jcl'],
        },
      });

      expect(suggestions.every(s => !['vsam', 'jcl'].includes(s.tag))).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const suggestions = await service.getSuggestions('', {
        limit: 3,
      });

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('mergeTags', () => {
    it('should merge tags successfully', async () => {
      const mergeOperation: TagMergeOperation = {
        source_tags: ['old-tag1', 'old-tag2'],
        target_tag: 'new-merged-tag',
        update_entries: true,
      };

      // Mock entries with source tags
      mockKnowledgeBaseService.findEntriesByTag
        .mockResolvedValueOnce([
          { id: '1', tags: ['old-tag1', 'other-tag'] },
          { id: '2', tags: ['old-tag1', 'another-tag'] }
        ])
        .mockResolvedValueOnce([
          { id: '3', tags: ['old-tag2', 'some-tag'] }
        ]);

      const result = await service.mergeTags(mergeOperation);

      expect(result.affected_entries).toBe(3);
      expect(result.source_tags).toEqual(['old-tag1', 'old-tag2']);
      expect(result.target_tag).toBe('new-merged-tag');

      // Verify entries were updated
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledTimes(3);
    });

    it('should handle merge conflicts', async () => {
      const mergeOperation: TagMergeOperation = {
        source_tags: ['tag1'],
        target_tag: 'existing-tag',
        update_entries: true,
        resolve_conflicts: 'merge', // Keep both tags
      };

      mockKnowledgeBaseService.findEntriesByTag.mockResolvedValue([
        { id: '1', tags: ['tag1', 'existing-tag', 'other-tag'] }
      ]);

      const result = await service.mergeTags(mergeOperation);

      expect(result.conflicts_resolved).toBe(1);
      // Should not duplicate existing-tag
      expect(mockKnowledgeBaseService.updateEntry).toHaveBeenCalledWith('1', {
        tags: ['existing-tag', 'other-tag'] // tag1 replaced, no duplicate existing-tag
      });
    });

    it('should validate merge operation', async () => {
      await expect(service.mergeTags({
        source_tags: [],
        target_tag: 'new-tag',
        update_entries: true,
      })).rejects.toThrow('Source tags cannot be empty');

      await expect(service.mergeTags({
        source_tags: ['tag1'],
        target_tag: '', // Empty target
        update_entries: true,
      })).rejects.toThrow('Target tag cannot be empty');

      await expect(service.mergeTags({
        source_tags: ['tag1'],
        target_tag: 'tag1', // Same as source
        update_entries: true,
      })).rejects.toThrow('Target tag cannot be one of the source tags');
    });
  });

  describe('getTrendingTags', () => {
    beforeEach(() => {
      // Mock tag usage with timestamps
      const mockTagUsage = [
        { tag: 'performance', count: 15, period: 'last_week' },
        { tag: 'debugging', count: 12, period: 'last_week' },
        { tag: 'optimization', count: 8, period: 'last_week' },
        { tag: 'monitoring', count: 6, period: 'last_week' },
        { tag: 'troubleshooting', count: 4, period: 'last_week' },
      ];

      jest.spyOn(service as any, 'getTagUsageStats').mockResolvedValue(mockTagUsage);
    });

    it('should return trending tags based on recent usage', async () => {
      const trendingTags = await service.getTrendingTags(3);

      expect(trendingTags).toHaveLength(3);
      expect(trendingTags[0].tag).toBe('performance');
      expect(trendingTags[0].count).toBe(15);
      expect(trendingTags[1].tag).toBe('debugging');
    });

    it('should calculate trend scores correctly', async () => {
      const trendingTags = await service.getTrendingTags(5);

      // Verify descending order by trend score
      for (let i = 1; i < trendingTags.length; i++) {
        expect(trendingTags[i-1].trendScore).toBeGreaterThanOrEqual(trendingTags[i].trendScore);
      }
    });
  });

  describe('getTagAnalytics', () => {
    beforeEach(() => {
      mockKnowledgeBaseService.getAllTags.mockResolvedValue([
        'vsam', 'jcl', 'cobol', 'db2', 'performance', 'debugging'
      ]);

      mockKnowledgeBaseService.getTagFrequency.mockImplementation((tag: string) => {
        const frequencies = {
          'vsam': 45,
          'jcl': 38,
          'cobol': 32,
          'db2': 28,
          'performance': 15,
          'debugging': 8,
        };
        return Promise.resolve(frequencies[tag] || 0);
      });
    });

    it('should return comprehensive tag analytics', async () => {
      const analytics = await service.getTagAnalytics();

      expect(analytics.total_tags).toBe(6);
      expect(analytics.total_usage).toBe(166); // Sum of all frequencies
      expect(analytics.average_usage).toBeCloseTo(27.67, 1);

      expect(analytics.top_tags).toHaveLength(5);
      expect(analytics.top_tags[0]).toEqual({
        tag: 'vsam',
        frequency: 45,
        percentage: expect.any(Number),
      });

      expect(analytics.usage_distribution.high).toBe(4); // vsam, jcl, cobol, db2 (>20)
      expect(analytics.usage_distribution.medium).toBe(1); // performance (5-20)
      expect(analytics.usage_distribution.low).toBe(1); // debugging (<5)
    });

    it('should identify underused tags', async () => {
      const analytics = await service.getTagAnalytics();

      expect(analytics.recommendations.underused_tags).toContain('debugging');
    });
  });

  describe('getTagRelationships', () => {
    beforeEach(() => {
      // Mock KB entries with various tag combinations
      mockKnowledgeBaseService.findEntriesByTag.mockImplementation((tag: string) => {
        const mockEntries = {
          'vsam': [
            { id: '1', tags: ['vsam', 'dataset', 'storage'] },
            { id: '2', tags: ['vsam', 'performance', 'optimization'] },
            { id: '3', tags: ['vsam', 'troubleshooting', 'error'] },
          ],
          'performance': [
            { id: '2', tags: ['vsam', 'performance', 'optimization'] },
            { id: '4', tags: ['jcl', 'performance', 'batch'] },
            { id: '5', tags: ['db2', 'performance', 'sql'] },
          ],
        };
        return Promise.resolve(mockEntries[tag] || []);
      });
    });

    it('should find related tags based on co-occurrence', async () => {
      const relationships = await service.getTagRelationships('vsam', 5);

      expect(relationships.related_tags).toContainEqual(
        expect.objectContaining({
          tag: 'dataset',
          strength: expect.any(Number),
          co_occurrence_count: 1,
        })
      );

      expect(relationships.related_tags).toContainEqual(
        expect.objectContaining({
          tag: 'performance',
          strength: expect.any(Number),
          co_occurrence_count: 1,
        })
      );
    });

    it('should calculate relationship strength correctly', async () => {
      const relationships = await service.getTagRelationships('performance', 3);

      // Tags that appear together more frequently should have higher strength
      const relatedTags = relationships.related_tags;
      expect(relatedTags.length).toBeGreaterThan(0);

      // Verify strength is between 0 and 1
      relatedTags.forEach(tag => {
        expect(tag.strength).toBeGreaterThanOrEqual(0);
        expect(tag.strength).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('cleanupTags', () => {
    beforeEach(() => {
      mockKnowledgeBaseService.getAllTags.mockResolvedValue([
        'vsam', 'VSAM', 'vsam-file', // Case variations
        'jcl', 'JCL',
        'db-2', 'db2', 'DB2',
        'unused-tag', // No entries
      ]);

      mockKnowledgeBaseService.getTagFrequency.mockImplementation((tag: string) => {
        const frequencies = {
          'vsam': 25,
          'VSAM': 5,
          'vsam-file': 3,
          'jcl': 20,
          'JCL': 2,
          'db-2': 1,
          'db2': 15,
          'DB2': 8,
          'unused-tag': 0,
        };
        return Promise.resolve(frequencies[tag] || 0);
      });
    });

    it('should identify cleanup opportunities', async () => {
      const suggestions = await service.getCleanupSuggestions();

      // Should suggest merging case variations
      expect(suggestions.case_variations).toContainEqual(
        expect.objectContaining({
          canonical: 'vsam',
          variations: expect.arrayContaining(['VSAM']),
        })
      );

      expect(suggestions.similar_tags).toContainEqual(
        expect.objectContaining({
          primary: 'db2',
          similar: expect.arrayContaining(['DB2', 'db-2']),
        })
      );

      expect(suggestions.unused_tags).toContain('unused-tag');
    });

    it('should execute cleanup operations', async () => {
      const cleanupPlan = {
        merge_case_variations: true,
        merge_similar_tags: true,
        remove_unused_tags: true,
        minimum_usage_threshold: 2,
      };

      const result = await service.cleanupTags(cleanupPlan);

      expect(result.merged_tags).toBeGreaterThan(0);
      expect(result.removed_tags).toBeGreaterThan(0);
      expect(result.affected_entries).toBeGreaterThan(0);
    });
  });

  describe('searchTags', () => {
    beforeEach(() => {
      mockKnowledgeBaseService.getAllTags.mockResolvedValue([
        'vsam-management',
        'jcl-processing',
        'cobol-debugging',
        'database-operations',
        'performance-optimization',
        'error-handling',
        'batch-processing',
        'system-monitoring',
      ]);
    });

    it('should search tags by exact match', async () => {
      const results = await service.searchTags({
        query: 'vsam',
        matchType: 'exact',
        limit: 5,
      });

      expect(results.every(r => r.tag.toLowerCase().includes('vsam'))).toBe(true);
    });

    it('should search tags with fuzzy matching', async () => {
      const results = await service.searchTags({
        query: 'databse', // Typo
        matchType: 'fuzzy',
        limit: 5,
      });

      expect(results.some(r => r.tag.includes('database'))).toBe(true);
    });

    it('should return results sorted by relevance', async () => {
      const results = await service.searchTags({
        query: 'processing',
        limit: 5,
      });

      // Results should be sorted by relevance score
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('event emission', () => {
    it('should emit tag_merged event when tags are merged', async () => {
      const eventListener = jest.fn();
      service.on('tag_merged', eventListener);

      mockKnowledgeBaseService.findEntriesByTag.mockResolvedValue([
        { id: '1', tags: ['old-tag'] }
      ]);

      const mergeOperation: TagMergeOperation = {
        source_tags: ['old-tag'],
        target_tag: 'new-tag',
        update_entries: true,
      };

      await service.mergeTags(mergeOperation);

      expect(eventListener).toHaveBeenCalledWith({
        type: 'tag_merged',
        operation: mergeOperation,
        result: expect.objectContaining({
          affected_entries: 1,
        }),
        timestamp: expect.any(Date),
      });
    });

    it('should emit tags_cleaned event during cleanup', async () => {
      const eventListener = jest.fn();
      service.on('tags_cleaned', eventListener);

      mockKnowledgeBaseService.getAllTags.mockResolvedValue(['unused-tag']);
      mockKnowledgeBaseService.getTagFrequency.mockResolvedValue(0);

      const cleanupPlan = {
        remove_unused_tags: true,
        minimum_usage_threshold: 1,
      };

      await service.cleanupTags(cleanupPlan);

      expect(eventListener).toHaveBeenCalledWith({
        type: 'tags_cleaned',
        plan: cleanupPlan,
        result: expect.any(Object),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('validation and error handling', () => {
    it('should validate tag format', () => {
      expect(() => (service as any).validateTag('')).toThrow('Tag cannot be empty');
      expect(() => (service as any).validateTag('a')).toThrow('Tag must be at least 2 characters long');
      expect(() => (service as any).validateTag('a'.repeat(51))).toThrow('Tag cannot exceed 50 characters');
      expect(() => (service as any).validateTag('invalid tag!')).toThrow('Tag contains invalid characters');
    });

    it('should handle API errors gracefully', async () => {
      mockKnowledgeBaseService.getAllTags.mockRejectedValue(new Error('Database error'));

      const suggestions = await service.getSuggestions('test');
      expect(suggestions).toEqual([]); // Should return empty array instead of throwing
    });

    it('should validate merge operations properly', async () => {
      const invalidOperation: TagMergeOperation = {
        source_tags: ['tag1', 'tag2'],
        target_tag: 'tag1', // Target is one of the sources
        update_entries: true,
      };

      await expect(service.mergeTags(invalidOperation))
        .rejects.toThrow('Target tag cannot be one of the source tags');
    });
  });
});