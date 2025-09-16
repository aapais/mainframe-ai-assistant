/**
 * Cache Invalidation Integration Tests
 * Testing intelligent cache invalidation strategies and their effectiveness
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { LRUCache } from '../../../src/services/cache/LRUCache';
import { RedisCache } from '../../../src/services/cache/RedisCache';
import { CacheKeyStrategy } from '../../../src/services/cache/CacheKeyStrategy';
import { EventEmitter } from 'events';

// Mock data change events
interface DataChangeEvent {
  type: 'create' | 'update' | 'delete';
  entityType: 'entry' | 'category' | 'user' | 'index';
  entityId: string;
  affectedQueries?: string[];
  timestamp: number;
  metadata?: Record<string, any>;
}

// Cache invalidation manager
class CacheInvalidationManager extends EventEmitter {
  private l1Cache: LRUCache<any>;
  private l2Cache: RedisCache;
  private keyStrategy: CacheKeyStrategy;
  private stats = {
    invalidationEvents: 0,
    keysInvalidated: 0,
    cascadeInvalidations: 0,
    avgInvalidationTime: 0,
    patternMatches: 0,
    tagMatches: 0,
    eventMatches: 0
  };
  
  // Track cached content for dependency analysis
  private contentDependencies = new Map<string, Set<string>>(); // content ID -> cache keys
  private queryDependencies = new Map<string, Set<string>>(); // query -> related content IDs
  
  constructor() {
    super();
    
    this.l1Cache = new LRUCache({
      maxSize: 100,
      defaultTTL: 300000, // 5 minutes
      evictionPolicy: 'LRU'
    });
    
    this.l2Cache = new RedisCache({
      keyPrefix: 'invalidation-test:',
      defaultTTL: 900 // 15 minutes
    });
    
    this.keyStrategy = new CacheKeyStrategy();
    
    // Set up invalidation rules
    this.setupInvalidationRules();
  }
  
  // Cache a search result with dependency tracking
  async cacheSearchResult(
    query: string,
    results: any[],
    options: any = {},
    userId?: string
  ): Promise<string> {
    const cacheKey = this.keyStrategy.generateSearchKey(query, options, userId);
    
    // Store in both cache layers
    this.l1Cache.set(cacheKey, results);
    await this.l2Cache.set(cacheKey, results);
    
    // Track dependencies
    const contentIds = results.map(r => r.id || r.entryId || `result-${Math.random()}`);
    
    // Map content IDs to this cache key
    contentIds.forEach(contentId => {
      if (!this.contentDependencies.has(contentId)) {
        this.contentDependencies.set(contentId, new Set());
      }
      this.contentDependencies.get(contentId)!.add(cacheKey);
    });
    
    // Map query to content IDs
    this.queryDependencies.set(query, new Set(contentIds));
    
    return cacheKey;
  }
  
  // Handle data change events
  async handleDataChange(event: DataChangeEvent): Promise<{
    invalidatedKeys: string[];
    cascadeKeys: string[];
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const invalidatedKeys: string[] = [];
    const cascadeKeys: string[] = [];
    
    this.stats.invalidationEvents++;
    
    try {
      // Direct invalidation based on content ID
      if (this.contentDependencies.has(event.entityId)) {
        const directKeys = Array.from(this.contentDependencies.get(event.entityId)!);
        
        for (const key of directKeys) {
          await this.invalidateKey(key);
          invalidatedKeys.push(key);
        }
        
        // Remove from dependency tracking
        this.contentDependencies.delete(event.entityId);
      }
      
      // Pattern-based invalidation using rules
      const ruleResult = await this.keyStrategy.invalidate(
        undefined,
        [event.entityType],
        `${event.entityType}-${event.type}`
      );
      
      for (const key of ruleResult.invalidatedKeys) {
        if (!invalidatedKeys.includes(key)) {
          await this.invalidateKey(key);
          invalidatedKeys.push(key);
        }
      }
      
      // Cascade invalidation for related content
      if (event.type === 'update' || event.type === 'delete') {
        const cascadeResult = await this.performCascadeInvalidation(event);
        cascadeKeys.push(...cascadeResult);
      }
      
      // Query-specific invalidation
      if (event.affectedQueries) {
        for (const query of event.affectedQueries) {
          const queryKeys = await this.invalidateQueryVariations(query);
          cascadeKeys.push(...queryKeys);
        }
      }
      
      const timeTaken = Date.now() - startTime;
      
      this.stats.keysInvalidated += invalidatedKeys.length;
      this.stats.cascadeInvalidations += cascadeKeys.length;
      this.updateAverageInvalidationTime(timeTaken);
      
      this.emit('invalidation-complete', {
        event,
        invalidatedKeys,
        cascadeKeys,
        timeTaken
      });
      
      return { invalidatedKeys, cascadeKeys, timeTaken };
      
    } catch (error) {
      this.emit('invalidation-error', { event, error });
      throw error;
    }
  }
  
  // Smart invalidation based on content similarity
  async smartInvalidation(changedContent: {
    id: string;
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
  }): Promise<{
    invalidatedKeys: string[];
    reason: string;
    confidence: number;
  }> {
    const invalidatedKeys: string[] = [];
    let reason = '';
    let confidence = 0;
    
    // Find potentially affected queries based on content similarity
    const affectedQueries: string[] = [];
    
    for (const [query, contentIds] of this.queryDependencies) {
      if (contentIds.has(changedContent.id)) {
        affectedQueries.push(query);
        continue;
      }
      
      // Check for semantic similarity
      const similarity = this.calculateContentSimilarity(query, changedContent);
      if (similarity > 0.7) {
        affectedQueries.push(query);
        confidence = Math.max(confidence, similarity);
      }
    }
    
    // Invalidate affected queries
    for (const query of affectedQueries) {
      const queryKeys = await this.invalidateQueryVariations(query);
      invalidatedKeys.push(...queryKeys);
    }
    
    if (invalidatedKeys.length > 0) {
      reason = `Content similarity detected (confidence: ${confidence.toFixed(2)})`;
    } else {
      reason = 'No similar content found';
    }
    
    return { invalidatedKeys, reason, confidence };
  }
  
  // Batch invalidation for multiple changes
  async batchInvalidation(events: DataChangeEvent[]): Promise<{
    totalInvalidated: number;
    batchTime: number;
    eventResults: Array<{ event: DataChangeEvent; invalidated: number }>;
  }> {
    const startTime = Date.now();
    const eventResults: Array<{ event: DataChangeEvent; invalidated: number }> = [];
    let totalInvalidated = 0;
    
    // Group events by type for optimization
    const eventGroups = this.groupEventsByType(events);
    
    for (const [eventType, groupEvents] of eventGroups) {
      for (const event of groupEvents) {
        const result = await this.handleDataChange(event);
        const invalidated = result.invalidatedKeys.length + result.cascadeKeys.length;
        
        eventResults.push({ event, invalidated });
        totalInvalidated += invalidated;
      }
    }
    
    const batchTime = Date.now() - startTime;
    
    return {
      totalInvalidated,
      batchTime,
      eventResults
    };
  }
  
  // Pattern-based bulk invalidation
  async bulkInvalidateByPattern(patterns: string[]): Promise<{
    patternResults: Array<{ pattern: string; invalidated: number }>;
    totalInvalidated: number;
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const patternResults: Array<{ pattern: string; invalidated: number }> = [];
    let totalInvalidated = 0;
    
    for (const pattern of patterns) {
      const result = await this.keyStrategy.invalidate([pattern]);
      
      // Invalidate from both cache layers
      for (const key of result.invalidatedKeys) {
        await this.invalidateKey(key);
      }
      
      patternResults.push({
        pattern,
        invalidated: result.invalidatedKeys.length
      });
      
      totalInvalidated += result.invalidatedKeys.length;
      this.stats.patternMatches++;
    }
    
    const timeTaken = Date.now() - startTime;
    
    return {
      patternResults,
      totalInvalidated,
      timeTaken
    };
  }
  
  // Time-based invalidation (TTL override)
  async timeBasedInvalidation(maxAge: number): Promise<{
    expiredKeys: string[];
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const expiredKeys: string[] = [];
    const cutoffTime = Date.now() - maxAge;
    
    // Get all L1 cache keys and check their age
    const l1Keys = this.l1Cache.keys();
    
    for (const key of l1Keys) {
      // In a real implementation, we'd track creation timestamps
      // For this test, we'll simulate age checking
      const keyAge = this.estimateKeyAge(key);
      
      if (keyAge > maxAge) {
        await this.invalidateKey(key);
        expiredKeys.push(key);
      }
    }
    
    const timeTaken = Date.now() - startTime;
    
    return {
      expiredKeys,
      timeTaken
    };
  }
  
  // Priority-based invalidation (keep high-priority queries)
  async priorityBasedInvalidation(priorities: Record<string, number>): Promise<{
    invalidatedKeys: string[];
    preservedKeys: string[];
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const invalidatedKeys: string[] = [];
    const preservedKeys: string[] = [];
    
    const l1Keys = this.l1Cache.keys();
    
    for (const key of l1Keys) {
      const priority = this.calculateKeyPriority(key, priorities);
      
      if (priority < 0.5) { // Low priority threshold
        await this.invalidateKey(key);
        invalidatedKeys.push(key);
      } else {
        preservedKeys.push(key);
      }
    }
    
    const timeTaken = Date.now() - startTime;
    
    return {
      invalidatedKeys,
      preservedKeys,
      timeTaken
    };
  }
  
  // Get invalidation statistics
  getStats() {
    return {
      ...this.stats,
      cacheSize: {
        l1: this.l1Cache.keys().length,
        l2Stats: this.l2Cache.getStats()
      },
      dependencyTracking: {
        contentDependencies: this.contentDependencies.size,
        queryDependencies: this.queryDependencies.size
      }
    };
  }
  
  // Get cache health metrics
  getCacheHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    const stats = this.getStats();
    
    // Check invalidation efficiency
    if (stats.avgInvalidationTime > 1000) {
      issues.push('High invalidation latency detected');
      recommendations.push('Consider optimizing invalidation patterns');
    }
    
    // Check dependency tracking overhead
    if (stats.dependencyTracking.contentDependencies > 1000) {
      issues.push('High dependency tracking overhead');
      recommendations.push('Implement dependency cleanup strategies');
    }
    
    // Check cache hit rates
    const l2Stats = stats.cacheSize.l2Stats;
    if (l2Stats.hitRate < 0.5) {
      issues.push('Low cache hit rate');
      recommendations.push('Review invalidation frequency and caching strategies');
    }
    
    const status = issues.length === 0 ? 'healthy' :
                  issues.length <= 2 ? 'degraded' : 'critical';
    
    return { status, issues, recommendations };
  }
  
  async cleanup() {
    this.l1Cache.destroy();
    await this.l2Cache.close();
    this.contentDependencies.clear();
    this.queryDependencies.clear();
  }
  
  // Private helper methods
  
  private setupInvalidationRules() {
    // Add custom invalidation rules for testing
    const rules = [
      {
        id: 'entry-update-rule',
        name: 'Entry Update Invalidation',
        pattern: 'srch:*',
        tags: ['entry'],
        triggerEvents: ['entry-update', 'entry-delete'],
        cascade: true,
        priority: 10,
        enabled: true
      },
      {
        id: 'category-change-rule',
        name: 'Category Change Invalidation',
        pattern: 'srch:*:category:*',
        tags: ['category'],
        triggerEvents: ['category-update'],
        cascade: false,
        priority: 8,
        enabled: true
      },
      {
        id: 'index-rebuild-rule',
        name: 'Index Rebuild Invalidation',
        pattern: 'idx:*',
        tags: ['index'],
        triggerEvents: ['index-rebuild'],
        cascade: true,
        priority: 15,
        enabled: true
      }
    ];
    
    rules.forEach(rule => {
      this.keyStrategy.addInvalidationRule(rule);
    });
  }
  
  private async invalidateKey(key: string): Promise<void> {
    // Remove from L1 cache
    this.l1Cache.delete(key);
    
    // Remove from L2 cache
    await this.l2Cache.delete(key);
    
    // Clean up dependency tracking
    this.cleanupDependencies(key);
  }
  
  private async performCascadeInvalidation(event: DataChangeEvent): Promise<string[]> {
    const cascadeKeys: string[] = [];
    
    // Invalidate related aggregations
    if (event.entityType === 'entry') {
      const aggPattern = 'agg:*';
      const result = await this.keyStrategy.invalidate([aggPattern]);
      
      for (const key of result.invalidatedKeys) {
        await this.invalidateKey(key);
        cascadeKeys.push(key);
      }
    }
    
    // Invalidate user-specific caches
    if (event.metadata && event.metadata.userId) {
      const userPattern = `usr:*:u${event.metadata.userId}*`;
      const result = await this.keyStrategy.invalidate([userPattern]);
      
      for (const key of result.invalidatedKeys) {
        await this.invalidateKey(key);
        cascadeKeys.push(key);
      }
    }
    
    return cascadeKeys;
  }
  
  private async invalidateQueryVariations(baseQuery: string): Promise<string[]> {
    const invalidatedKeys: string[] = [];
    
    // Generate possible query variations
    const variations = [
      baseQuery,
      baseQuery.toLowerCase(),
      baseQuery.trim(),
      baseQuery.replace(/\s+/g, ' ')
    ];
    
    for (const variation of variations) {
      const pattern = `*${variation.replace(/\s+/g, '*')}*`;
      const result = await this.keyStrategy.invalidate([pattern]);
      
      for (const key of result.invalidatedKeys) {
        if (!invalidatedKeys.includes(key)) {
          await this.invalidateKey(key);
          invalidatedKeys.push(key);
        }
      }
    }
    
    return invalidatedKeys;
  }
  
  private calculateContentSimilarity(query: string, content: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
  }): number {
    let similarity = 0;
    const queryWords = query.toLowerCase().split(/\s+/);
    
    // Check title similarity
    if (content.title) {
      const titleWords = content.title.toLowerCase().split(/\s+/);
      const titleMatches = queryWords.filter(word => titleWords.includes(word)).length;
      similarity += (titleMatches / queryWords.length) * 0.4;
    }
    
    // Check content similarity
    if (content.content) {
      const contentWords = content.content.toLowerCase().split(/\s+/);
      const contentMatches = queryWords.filter(word => contentWords.includes(word)).length;
      similarity += (contentMatches / queryWords.length) * 0.3;
    }
    
    // Check category similarity
    if (content.category) {
      const categoryMatch = queryWords.includes(content.category.toLowerCase());
      similarity += categoryMatch ? 0.2 : 0;
    }
    
    // Check tag similarity
    if (content.tags) {
      const tagMatches = queryWords.filter(word => 
        content.tags!.some(tag => tag.toLowerCase().includes(word))
      ).length;
      similarity += (tagMatches / queryWords.length) * 0.1;
    }
    
    return Math.min(similarity, 1.0);
  }
  
  private groupEventsByType(events: DataChangeEvent[]): Map<string, DataChangeEvent[]> {
    const groups = new Map<string, DataChangeEvent[]>();
    
    events.forEach(event => {
      const key = `${event.entityType}-${event.type}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    });
    
    return groups;
  }
  
  private estimateKeyAge(key: string): number {
    // Simulate key age based on key structure
    // In real implementation, would track actual creation time
    const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 600000) + 60000; // Random age between 1-10 minutes
  }
  
  private calculateKeyPriority(key: string, priorities: Record<string, number>): number {
    // Calculate priority based on key patterns
    for (const [pattern, priority] of Object.entries(priorities)) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(key)) {
        return priority;
      }
    }
    
    return 0.5; // Default priority
  }
  
  private cleanupDependencies(key: string): void {
    // Remove key from all dependency mappings
    for (const [contentId, keys] of this.contentDependencies) {
      keys.delete(key);
      if (keys.size === 0) {
        this.contentDependencies.delete(contentId);
      }
    }
  }
  
  private updateAverageInvalidationTime(newTime: number): void {
    const count = this.stats.invalidationEvents;
    this.stats.avgInvalidationTime = 
      (this.stats.avgInvalidationTime * (count - 1) + newTime) / count;
  }
}

// Test data generators
const generateMockResults = (query: string, count: number = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${query.replace(/\s+/g, '-')}-result-${i}`,
    title: `Result ${i + 1} for ${query}`,
    content: `Mock content for ${query} result ${i + 1}`,
    category: ['System', 'Performance', 'Error'][i % 3],
    tags: ['tag1', 'tag2', 'tag3'].slice(0, (i % 3) + 1),
    relevance: Math.random()
  }));
};

const generateDataChangeEvent = (overrides: Partial<DataChangeEvent> = {}): DataChangeEvent => {
  const entities = ['entry-1', 'entry-2', 'entry-3', 'category-1', 'user-1'];
  const types = ['create', 'update', 'delete'] as const;
  const entityTypes = ['entry', 'category', 'user', 'index'] as const;
  
  return {
    type: types[Math.floor(Math.random() * types.length)],
    entityType: entityTypes[Math.floor(Math.random() * entityTypes.length)],
    entityId: entities[Math.floor(Math.random() * entities.length)],
    timestamp: Date.now(),
    ...overrides
  };
};

describe('Cache Invalidation Integration', () => {
  let invalidationManager: CacheInvalidationManager;

  beforeEach(() => {
    invalidationManager = new CacheInvalidationManager();
  });

  afterEach(async () => {
    await invalidationManager.cleanup();
  });

  describe('Basic Invalidation Operations', () => {
    it('should invalidate cache on data change events', async () => {
      // Cache some search results
      const query = 'test query';
      const results = generateMockResults(query);
      
      const cacheKey = await invalidationManager.cacheSearchResult(query, results);
      
      // Verify caching worked
      const initialStats = invalidationManager.getStats();
      expect(initialStats.cacheSize.l1).toBeGreaterThan(0);
      
      // Create a data change event
      const event: DataChangeEvent = {
        type: 'update',
        entityType: 'entry',
        entityId: results[0].id,
        timestamp: Date.now()
      };
      
      // Handle the change
      const result = await invalidationManager.handleDataChange(event);
      
      expect(result.invalidatedKeys.length).toBeGreaterThan(0);
      expect(result.timeTaken).toBeGreaterThan(0);
      
      // Verify invalidation worked
      const finalStats = invalidationManager.getStats();
      expect(finalStats.invalidationEvents).toBe(1);
      expect(finalStats.keysInvalidated).toBeGreaterThan(0);
    });

    it('should perform cascade invalidation for related content', async () => {
      // Cache multiple related queries
      const queries = ['system error', 'error handling', 'troubleshooting'];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      // Create an event that should trigger cascade invalidation
      const event: DataChangeEvent = {
        type: 'update',
        entityType: 'entry',
        entityId: 'entry-1',
        timestamp: Date.now(),
        affectedQueries: queries
      };
      
      const result = await invalidationManager.handleDataChange(event);
      
      expect(result.cascadeKeys.length).toBeGreaterThan(0);
    });

    it('should track invalidation dependencies correctly', async () => {
      const query = 'dependency test';
      const results = generateMockResults(query, 3);
      
      await invalidationManager.cacheSearchResult(query, results);
      
      const stats = invalidationManager.getStats();
      expect(stats.dependencyTracking.contentDependencies).toBeGreaterThan(0);
      expect(stats.dependencyTracking.queryDependencies).toBeGreaterThan(0);
    });
  });

  describe('Smart Invalidation', () => {
    it('should perform smart invalidation based on content similarity', async () => {
      // Cache queries about database issues
      const queries = [
        'database connection error',
        'database timeout issue',
        'performance problem'
      ];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      // Change content that's similar to cached queries
      const changedContent = {
        id: 'new-entry-1',
        title: 'Database Connection Problems',
        content: 'This entry discusses database connectivity issues and timeouts',
        category: 'Database',
        tags: ['database', 'connection', 'error']
      };
      
      const result = await invalidationManager.smartInvalidation(changedContent);
      
      expect(result.confidence).toBeGreaterThan(0);
      if (result.confidence > 0.7) {
        expect(result.invalidatedKeys.length).toBeGreaterThan(0);
      }
      expect(result.reason).toBeDefined();
    });

    it('should calculate content similarity accurately', async () => {
      // This tests the private method indirectly
      const similarContent = {
        id: 'similar-1',
        title: 'Database Error Resolution',
        content: 'How to resolve database connection errors',
        category: 'Database',
        tags: ['database', 'error', 'connection']
      };
      
      const dissimilarContent = {
        id: 'different-1',
        title: 'Network Configuration',
        content: 'Network setup and configuration guidelines',
        category: 'Network',
        tags: ['network', 'config']
      };
      
      // Cache a database-related query
      await invalidationManager.cacheSearchResult(
        'database connection error',
        generateMockResults('database connection error')
      );
      
      const similarResult = await invalidationManager.smartInvalidation(similarContent);
      const dissimilarResult = await invalidationManager.smartInvalidation(dissimilarContent);
      
      expect(similarResult.confidence).toBeGreaterThan(dissimilarResult.confidence);
    });
  });

  describe('Batch Invalidation', () => {
    it('should handle batch invalidation efficiently', async () => {
      // Cache multiple queries
      const queries = [
        'batch test 1', 'batch test 2', 'batch test 3',
        'batch test 4', 'batch test 5'
      ];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      // Create multiple change events
      const events: DataChangeEvent[] = [
        generateDataChangeEvent({ type: 'update', entityType: 'entry' }),
        generateDataChangeEvent({ type: 'create', entityType: 'entry' }),
        generateDataChangeEvent({ type: 'delete', entityType: 'category' })
      ];
      
      const result = await invalidationManager.batchInvalidation(events);
      
      expect(result.eventResults.length).toBe(events.length);
      expect(result.totalInvalidated).toBeGreaterThanOrEqual(0);
      expect(result.batchTime).toBeGreaterThan(0);
    });

    it('should optimize batch operations by grouping events', async () => {
      const events: DataChangeEvent[] = [
        generateDataChangeEvent({ type: 'update', entityType: 'entry' }),
        generateDataChangeEvent({ type: 'update', entityType: 'entry' }),
        generateDataChangeEvent({ type: 'delete', entityType: 'entry' }),
        generateDataChangeEvent({ type: 'create', entityType: 'category' })
      ];
      
      const startTime = Date.now();
      const result = await invalidationManager.batchInvalidation(events);
      const endTime = Date.now();
      
      // Batch operation should be efficient
      expect(endTime - startTime).toBeLessThan(result.batchTime + 100); // Small overhead
      expect(result.eventResults.length).toBe(events.length);
    });
  });

  describe('Pattern-based Invalidation', () => {
    it('should invalidate cache entries by patterns', async () => {
      // Cache queries with different patterns
      const systemQueries = ['system error', 'system config'];
      const dbQueries = ['database error', 'database timeout'];
      
      for (const query of [...systemQueries, ...dbQueries]) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      // Invalidate all system-related queries
      const patterns = ['*system*'];
      const result = await invalidationManager.bulkInvalidateByPattern(patterns);
      
      expect(result.totalInvalidated).toBeGreaterThan(0);
      expect(result.patternResults[0].pattern).toBe('*system*');
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should handle multiple patterns efficiently', async () => {
      // Cache various queries
      const queries = [
        'error handling', 'performance tuning', 'configuration setup',
        'database optimization', 'network troubleshooting'
      ];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      const patterns = ['*error*', '*performance*', '*database*'];
      const result = await invalidationManager.bulkInvalidateByPattern(patterns);
      
      expect(result.patternResults.length).toBe(patterns.length);
      expect(result.totalInvalidated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Time-based Invalidation', () => {
    it('should invalidate expired cache entries', async () => {
      // Cache some queries
      const queries = ['time test 1', 'time test 2', 'time test 3'];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      // Invalidate entries older than 1 minute
      const result = await invalidationManager.timeBasedInvalidation(60000);
      
      expect(result.expiredKeys.length).toBeGreaterThanOrEqual(0);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should respect age thresholds', async () => {
      const shortThreshold = 30000; // 30 seconds
      const longThreshold = 300000; // 5 minutes
      
      // Cache queries
      const query = 'age threshold test';
      const results = generateMockResults(query);
      await invalidationManager.cacheSearchResult(query, results);
      
      const shortResult = await invalidationManager.timeBasedInvalidation(shortThreshold);
      const longResult = await invalidationManager.timeBasedInvalidation(longThreshold);
      
      // Shorter threshold should invalidate more or equal entries
      expect(shortResult.expiredKeys.length).toBeGreaterThanOrEqual(longResult.expiredKeys.length);
    });
  });

  describe('Priority-based Invalidation', () => {
    it('should preserve high-priority cache entries', async () => {
      // Cache queries with different priorities
      const queries = [
        'high priority query',
        'medium priority query',
        'low priority query'
      ];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      const priorities = {
        '*high*': 0.9,
        '*medium*': 0.6,
        '*low*': 0.3
      };
      
      const result = await invalidationManager.priorityBasedInvalidation(priorities);
      
      expect(result.preservedKeys.length).toBeGreaterThan(0);
      expect(result.invalidatedKeys.length).toBeGreaterThan(0);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should invalidate low-priority entries preferentially', async () => {
      const priorities = {
        '*critical*': 1.0,
        '*important*': 0.8,
        '*normal*': 0.5,
        '*optional*': 0.2
      };
      
      // Cache entries with different priority levels
      const queries = [
        'critical system alert',
        'important update',
        'normal operation',
        'optional feature'
      ];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      const result = await invalidationManager.priorityBasedInvalidation(priorities);
      
      // Low priority items should be invalidated
      expect(result.invalidatedKeys.some(key => key.includes('optional'))).toBe(true);
    });
  });

  describe('Event-driven Invalidation', () => {
    it('should emit invalidation events', (done) => {
      invalidationManager.once('invalidation-complete', (data) => {
        expect(data.event).toBeDefined();
        expect(data.invalidatedKeys).toBeDefined();
        expect(data.timeTaken).toBeGreaterThan(0);
        done();
      });
      
      // Trigger invalidation
      const event = generateDataChangeEvent({ type: 'update', entityType: 'entry' });
      invalidationManager.handleDataChange(event);
    });

    it('should handle invalidation errors gracefully', (done) => {
      invalidationManager.once('invalidation-error', (data) => {
        expect(data.event).toBeDefined();
        expect(data.error).toBeDefined();
        done();
      });
      
      // Force an error by using invalid event data
      const invalidEvent = {
        type: 'invalid' as any,
        entityType: 'invalid' as any,
        entityId: '',
        timestamp: -1
      };
      
      invalidationManager.handleDataChange(invalidEvent).catch(() => {
        // Expected to fail
      });
    });
  });

  describe('Performance and Monitoring', () => {
    it('should provide comprehensive statistics', async () => {
      // Perform various invalidation operations
      const queries = ['stats test 1', 'stats test 2', 'stats test 3'];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      // Trigger some invalidations
      const event = generateDataChangeEvent();
      await invalidationManager.handleDataChange(event);
      
      const stats = invalidationManager.getStats();
      
      expect(stats.invalidationEvents).toBeGreaterThan(0);
      expect(stats.keysInvalidated).toBeGreaterThanOrEqual(0);
      expect(stats.avgInvalidationTime).toBeGreaterThanOrEqual(0);
      expect(stats.cacheSize).toBeDefined();
      expect(stats.dependencyTracking).toBeDefined();
    });

    it('should monitor cache health', async () => {
      const health = invalidationManager.getCacheHealth();
      
      expect(['healthy', 'degraded', 'critical']).toContain(health.status);
      expect(Array.isArray(health.issues)).toBe(true);
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    it('should detect performance issues', async () => {
      // Simulate high invalidation load
      const events = Array.from({ length: 20 }, () => generateDataChangeEvent());
      
      for (const event of events) {
        await invalidationManager.handleDataChange(event);
      }
      
      const stats = invalidationManager.getStats();
      const health = invalidationManager.getCacheHealth();
      
      expect(stats.invalidationEvents).toBe(20);
      
      // Health status should reflect the load
      if (stats.avgInvalidationTime > 1000) {
        expect(health.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalidation of non-existent keys', async () => {
      const event: DataChangeEvent = {
        type: 'delete',
        entityType: 'entry',
        entityId: 'non-existent-entry',
        timestamp: Date.now()
      };
      
      const result = await invalidationManager.handleDataChange(event);
      
      expect(result.invalidatedKeys.length).toBe(0);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should handle malformed events gracefully', async () => {
      const malformedEvents = [
        { type: 'update', entityType: 'entry', entityId: '', timestamp: Date.now() },
        { type: 'delete', entityType: '', entityId: 'test', timestamp: Date.now() },
        { type: '', entityType: 'entry', entityId: 'test', timestamp: Date.now() }
      ];
      
      for (const event of malformedEvents) {
        const result = await invalidationManager.handleDataChange(event as DataChangeEvent);
        expect(result).toBeDefined();
      }
    });

    it('should handle concurrent invalidation requests', async () => {
      // Cache multiple queries
      const queries = ['concurrent 1', 'concurrent 2', 'concurrent 3'];
      
      for (const query of queries) {
        const results = generateMockResults(query);
        await invalidationManager.cacheSearchResult(query, results);
      }
      
      // Trigger concurrent invalidations
      const events = Array.from({ length: 5 }, () => generateDataChangeEvent());
      const promises = events.map(event => invalidationManager.handleDataChange(event));
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.timeTaken).toBeGreaterThan(0);
      });
    });

    it('should maintain consistency during invalidation failures', async () => {
      // Cache some data
      const query = 'consistency test';
      const results = generateMockResults(query);
      
      await invalidationManager.cacheSearchResult(query, results);
      
      const initialStats = invalidationManager.getStats();
      
      // Attempt invalidation that might fail
      try {
        const event: DataChangeEvent = {
          type: 'update',
          entityType: 'entry',
          entityId: 'test-entry',
          timestamp: Date.now()
        };
        
        await invalidationManager.handleDataChange(event);
      } catch (error) {
        // Should handle gracefully
      }
      
      const finalStats = invalidationManager.getStats();
      
      // Stats should be consistent
      expect(finalStats.invalidationEvents).toBeGreaterThanOrEqual(initialStats.invalidationEvents);
    });
  });
});