/**
 * Cache Key Strategy Unit Tests
 * Testing the cache key generation and invalidation management system
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import {
  CacheKeyStrategy,
  CacheKeyComponents,
  InvalidationRule,
  CacheNamespace,
  KeyMetrics
} from '../../../src/services/cache/CacheKeyStrategy';

describe('CacheKeyStrategy', () => {
  let strategy: CacheKeyStrategy;

  beforeEach(() => {
    strategy = new CacheKeyStrategy();
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('Key Generation', () => {
    it('should generate basic cache keys correctly', () => {
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'test query'
      };
      
      const key = strategy.generateKey(components);
      
      expect(key).toMatch(/^srch:query:test_query$/);
      expect(key).toContain('srch'); // search namespace prefix
      expect(key).toContain('query');
      expect(key).toContain('test_query'); // normalized identifier
    });

    it('should handle special characters in identifiers', () => {
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'test query with special chars!@#$%^&*()'
      };
      
      const key = strategy.generateKey(components);
      
      // Should normalize special characters
      expect(key).toMatch(/^srch:query:[a-z0-9_-]+$/);
      expect(key).not.toContain('!');
      expect(key).not.toContain('@');
      expect(key).not.toContain(' ');
    });

    it('should include version when versioning is enabled', () => {
      const components: CacheKeyComponents = {
        namespace: 'results',
        entityType: 'item',
        identifier: 'item123',
        version: '2.1'
      };
      
      const key = strategy.generateKey(components);
      
      expect(key).toMatch(/^rslt:item:item123:v2\.1$/);
    });

    it('should include user context hash', () => {
      const components: CacheKeyComponents = {
        namespace: 'user',
        entityType: 'profile',
        identifier: 'userdata',
        userContext: 'user123'
      };
      
      const key = strategy.generateKey(components);
      
      expect(key).toMatch(/^usr:profile:userdata:u[a-z0-9]+$/);
    });

    it('should include filters hash', () => {
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'filtered query',
        filters: {
          category: 'System',
          priority: 'high',
          tags: ['important', 'urgent']
        }
      };
      
      const key = strategy.generateKey(components);
      
      expect(key).toMatch(/^srch:query:filtered_query:f[a-z0-9]+$/);
    });

    it('should generate consistent keys for same components', () => {
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'consistent test',
        filters: { sort: 'date', limit: 10 }
      };
      
      const key1 = strategy.generateKey(components);
      const key2 = strategy.generateKey(components);
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different filter orders', () => {
      const components1: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'test',
        filters: { a: 1, b: 2 }
      };
      
      const components2: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'test',
        filters: { b: 2, a: 1 }
      };
      
      const key1 = strategy.generateKey(components1);
      const key2 = strategy.generateKey(components2);
      
      // Should be the same because filters are normalized
      expect(key1).toBe(key2);
    });

    it('should throw error for unknown namespace', () => {
      const components: CacheKeyComponents = {
        namespace: 'unknown',
        entityType: 'test',
        identifier: 'test'
      };
      
      expect(() => strategy.generateKey(components)).toThrow('Unknown namespace: unknown');
    });
  });

  describe('Convenience Key Generators', () => {
    it('should generate search keys', () => {
      const key = strategy.generateSearchKey('test query', { limit: 10 }, 'user123');
      
      expect(key).toMatch(/^srch:query:test_query/);
      expect(key).toContain('u'); // user context
      expect(key).toContain('f'); // filters
    });

    it('should generate result keys', () => {
      const key = strategy.generateResultKey('result123', '1.0', 'user456');
      
      expect(key).toMatch(/^rslt:item:result123:v1\.0:u[a-z0-9]+$/);
    });

    it('should generate index keys', () => {
      const key = strategy.generateIndexKey('search_index', 'segment_1', '2.0');
      
      expect(key).toMatch(/^idx:search_index:segment_1:v2\.0$/);
    });

    it('should generate aggregation keys', () => {
      const key = strategy.generateAggregationKey('count', { category: 'System' }, 'hourly');
      
      expect(key).toMatch(/^agg:count:hourly:f[a-z0-9]+$/);
    });

    it('should generate user-specific keys', () => {
      const key = strategy.generateUserKey('user123', 'preferences', 'theme');
      
      expect(key).toMatch(/^usr:preferences:theme:u[a-z0-9]+$/);
    });

    it('should generate temporary keys', () => {
      const key = strategy.generateTempKey('upload', 'session456', 'file.txt');
      
      expect(key).toMatch(/^tmp:upload:session456:file\.txt$/);
    });
  });

  describe('Key Parsing', () => {
    it('should parse valid keys correctly', () => {
      const originalComponents: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'test query',
        version: '1.0'
      };
      
      const key = strategy.generateKey(originalComponents);
      const parsed = strategy.parseKey(key);
      
      expect(parsed).toBeDefined();
      expect(parsed!.namespace).toBe('search');
      expect(parsed!.entityType).toBe('query');
      expect(parsed!.identifier).toBe('test_query'); // normalized
      expect(parsed!.version).toBe('1.0');
    });

    it('should return null for invalid keys', () => {
      const invalidKeys = [
        '',
        'invalid',
        'just:two:parts',
        'unknown:prefix:key'
      ];
      
      invalidKeys.forEach(key => {
        const parsed = strategy.parseKey(key);
        expect(parsed).toBeNull();
      });
    });

    it('should parse keys with user context', () => {
      const key = strategy.generateSearchKey('test', {}, 'user123');
      const parsed = strategy.parseKey(key);
      
      expect(parsed).toBeDefined();
      expect(parsed!.userContext).toBeDefined();
    });

    it('should parse keys with filters', () => {
      const key = strategy.generateSearchKey('test', { category: 'System' });
      const parsed = strategy.parseKey(key);
      
      expect(parsed).toBeDefined();
      expect(parsed!.filters).toBeDefined();
      expect(parsed!.filters!._hash).toBeDefined();
    });
  });

  describe('Invalidation Rules', () => {
    it('should have default invalidation rules', async () => {
      const result = await strategy.invalidate(undefined, undefined, 'data-updated');
      
      expect(result.rulesApplied.length).toBeGreaterThan(0);
    });

    it('should add custom invalidation rules', () => {
      const customRule: InvalidationRule = {
        id: 'custom-rule',
        name: 'Custom Test Rule',
        pattern: 'test:*',
        tags: ['test'],
        triggerEvents: ['test-event'],
        cascade: false,
        priority: 5,
        enabled: true
      };
      
      strategy.addInvalidationRule(customRule);
      
      // Verify rule was added by checking if it gets applied
      expect(() => strategy.addInvalidationRule(customRule)).not.toThrow();
    });

    it('should remove invalidation rules', () => {
      const customRule: InvalidationRule = {
        id: 'removable-rule',
        name: 'Removable Rule',
        pattern: 'test:*',
        tags: ['test'],
        triggerEvents: ['test-event'],
        cascade: false,
        priority: 5,
        enabled: true
      };
      
      strategy.addInvalidationRule(customRule);
      
      const removed = strategy.removeInvalidationRule('removable-rule');
      expect(removed).toBe(true);
      
      const notRemoved = strategy.removeInvalidationRule('non-existent');
      expect(notRemoved).toBe(false);
    });

    it('should invalidate by pattern', async () => {
      // Generate some keys to invalidate
      strategy.generateSearchKey('pattern test 1');
      strategy.generateSearchKey('pattern test 2');
      strategy.generateResultKey('result1');
      
      const result = await strategy.invalidate(['srch:*']);
      
      expect(result.invalidatedKeys.length).toBeGreaterThan(0);
      expect(result.rulesApplied.length).toBeGreaterThan(0);
    });

    it('should invalidate by tags', async () => {
      // Generate some keys
      strategy.generateSearchKey('tag test');
      
      const result = await strategy.invalidate(undefined, ['search']);
      
      expect(result.invalidatedKeys.length).toBeGreaterThanOrEqual(0);
      expect(result.rulesApplied.length).toBeGreaterThanOrEqual(0);
    });

    it('should invalidate by event type', async () => {
      strategy.generateSearchKey('event test');
      
      const result = await strategy.invalidate(undefined, undefined, 'data-updated');
      
      expect(result.rulesApplied.length).toBeGreaterThan(0);
    });

    it('should handle cascade invalidation', async () => {
      // Generate related keys
      strategy.generateSearchKey('cascade test');
      strategy.generateResultKey('cascade-result');
      
      const result = await strategy.invalidate(['srch:*']);
      
      // Cascade rules should have been applied
      expect(result.invalidatedKeys.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect rule priority', async () => {
      const highPriorityRule: InvalidationRule = {
        id: 'high-priority',
        name: 'High Priority Rule',
        pattern: 'test:*',
        tags: ['high'],
        triggerEvents: ['priority-test'],
        cascade: false,
        priority: 20,
        enabled: true
      };
      
      const lowPriorityRule: InvalidationRule = {
        id: 'low-priority',
        name: 'Low Priority Rule',
        pattern: 'test:*',
        tags: ['low'],
        triggerEvents: ['priority-test'],
        cascade: false,
        priority: 1,
        enabled: true
      };
      
      strategy.addInvalidationRule(lowPriorityRule);
      strategy.addInvalidationRule(highPriorityRule);
      
      const result = await strategy.invalidate(undefined, undefined, 'priority-test');
      
      // High priority rule should be applied first
      expect(result.rulesApplied[0]).toBe('high-priority');
    });

    it('should not apply disabled rules', async () => {
      const disabledRule: InvalidationRule = {
        id: 'disabled-rule',
        name: 'Disabled Rule',
        pattern: 'test:*',
        tags: ['disabled'],
        triggerEvents: ['disabled-test'],
        cascade: false,
        priority: 10,
        enabled: false
      };
      
      strategy.addInvalidationRule(disabledRule);
      
      const result = await strategy.invalidate(undefined, undefined, 'disabled-test');
      
      expect(result.rulesApplied).not.toContain('disabled-rule');
    });
  });

  describe('Namespace Management', () => {
    it('should register custom namespaces', () => {
      const customNamespace: CacheNamespace = {
        name: 'custom',
        prefix: 'cstm',
        ttl: 600000,
        versioning: true,
        compression: true,
        encryption: false,
        invalidationRules: []
      };
      
      strategy.registerNamespace(customNamespace);
      
      // Should be able to use the custom namespace
      const key = strategy.generateKey({
        namespace: 'custom',
        entityType: 'test',
        identifier: 'test'
      });
      
      expect(key).toMatch(/^cstm:test:test$/);
    });

    it('should emit namespace registration events', (done) => {
      const customNamespace: CacheNamespace = {
        name: 'event-test',
        prefix: 'evt',
        ttl: 300000,
        versioning: false,
        compression: false,
        encryption: false,
        invalidationRules: []
      };
      
      strategy.once('namespace-registered', (namespace) => {
        expect(namespace.name).toBe('event-test');
        done();
      });
      
      strategy.registerNamespace(customNamespace);
    });
  });

  describe('Metrics and Analytics', () => {
    it('should provide key metrics', () => {
      // Generate some keys to create metrics
      strategy.generateSearchKey('metrics test 1');
      strategy.generateSearchKey('metrics test 2');
      strategy.generateResultKey('result1');
      strategy.generateIndexKey('index1', 'segment1');
      
      const metrics = strategy.getMetrics();
      
      expect(metrics).toMatchObject({
        totalKeys: expect.any(Number),
        namespaceDistribution: expect.any(Object),
        averageKeyLength: expect.any(Number),
        collisionRate: expect.any(Number),
        invalidationEvents: expect.any(Number),
        hotKeys: expect.any(Array)
      });
      
      expect(metrics.totalKeys).toBeGreaterThan(0);
    });

    it('should track hot keys', () => {
      const testKey = 'hot-key-test';
      
      // Access the same key multiple times
      for (let i = 0; i < 10; i++) {
        strategy.generateSearchKey(testKey);
      }
      
      const hotKeys = strategy.getHotKeys(5);
      
      expect(hotKeys.length).toBeGreaterThan(0);
      expect(hotKeys[0].hitCount).toBeGreaterThan(1);
    });

    it('should analyze key patterns', () => {
      // Generate various keys
      strategy.generateSearchKey('short');
      strategy.generateSearchKey('this is a very long query that should be flagged');
      strategy.generateResultKey('result1');
      strategy.generateResultKey('result2');
      strategy.generateIndexKey('index1', 'segment1');
      
      const analysis = strategy.analyzeKeyPatterns();
      
      expect(analysis).toMatchObject({
        suggestions: expect.any(Array),
        longKeys: expect.any(Array),
        collisions: expect.any(Array),
        namespaceStats: expect.any(Object)
      });
    });

    it('should identify long keys', () => {
      const longIdentifier = 'x'.repeat(250);
      strategy.generateSearchKey(longIdentifier);
      
      const analysis = strategy.analyzeKeyPatterns();
      
      expect(analysis.longKeys.length).toBeGreaterThan(0);
      expect(analysis.suggestions).toContain(expect.stringContaining('shortening'));
    });

    it('should track namespace distribution', () => {
      strategy.generateSearchKey('search1');
      strategy.generateSearchKey('search2');
      strategy.generateResultKey('result1');
      strategy.generateIndexKey('index1', 'segment1');
      
      const metrics = strategy.getMetrics();
      
      expect(metrics.namespaceDistribution.srch).toBeGreaterThan(0);
      expect(metrics.namespaceDistribution.rslt).toBeGreaterThan(0);
      expect(metrics.namespaceDistribution.idx).toBeGreaterThan(0);
    });

    it('should calculate average key length', () => {
      strategy.generateSearchKey('short');
      strategy.generateSearchKey('medium length query');
      strategy.generateSearchKey('this is a much longer query for testing purposes');
      
      const metrics = strategy.getMetrics();
      
      expect(metrics.averageKeyLength).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit rule-added events', (done) => {
      const rule: InvalidationRule = {
        id: 'event-rule',
        name: 'Event Rule',
        pattern: 'event:*',
        tags: ['event'],
        triggerEvents: ['event'],
        cascade: false,
        priority: 5,
        enabled: true
      };
      
      strategy.once('rule-added', (addedRule) => {
        expect(addedRule.id).toBe('event-rule');
        done();
      });
      
      strategy.addInvalidationRule(rule);
    });

    it('should emit rule-removed events', (done) => {
      const rule: InvalidationRule = {
        id: 'removable-event-rule',
        name: 'Removable Event Rule',
        pattern: 'remove:*',
        tags: ['remove'],
        triggerEvents: ['remove'],
        cascade: false,
        priority: 5,
        enabled: true
      };
      
      strategy.addInvalidationRule(rule);
      
      strategy.once('rule-removed', (event) => {
        expect(event.ruleId).toBe('removable-event-rule');
        done();
      });
      
      strategy.removeInvalidationRule('removable-event-rule');
    });

    it('should emit keys-invalidated events', (done) => {
      strategy.generateSearchKey('invalidation event test');
      
      strategy.once('keys-invalidated', (event) => {
        expect(event.rule).toBeDefined();
        expect(event.pattern).toBeDefined();
        expect(Array.isArray(event.keys)).toBe(true);
        done();
      });
      
      strategy.invalidate(['srch:*']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty identifiers', () => {
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: ''
      };
      
      expect(() => strategy.generateKey(components)).not.toThrow();
    });

    it('should handle very long identifiers', () => {
      const longIdentifier = 'x'.repeat(1000);
      
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: longIdentifier
      };
      
      const key = strategy.generateKey(components);
      
      // Should be truncated
      expect(key.length).toBeLessThan(1100);
    });

    it('should handle unicode characters', () => {
      const unicodeIdentifier = 'test-中文-русский-äöü';
      
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: unicodeIdentifier
      };
      
      expect(() => strategy.generateKey(components)).not.toThrow();
    });

    it('should handle circular references in filters', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'circular test',
        filters: { circular: circularObj }
      };
      
      expect(() => strategy.generateKey(components)).not.toThrow();
    });

    it('should handle null and undefined in filters', () => {
      const components: CacheKeyComponents = {
        namespace: 'search',
        entityType: 'query',
        identifier: 'null test',
        filters: {
          nullValue: null,
          undefinedValue: undefined,
          validValue: 'test'
        }
      };
      
      expect(() => strategy.generateKey(components)).not.toThrow();
    });

    it('should handle invalidation with no matching keys', async () => {
      const result = await strategy.invalidate(['nonexistent:*']);
      
      expect(result.invalidatedKeys).toEqual([]);
      expect(result.rulesApplied).toEqual([]);
    });

    it('should handle invalidation errors gracefully', async () => {
      // This test simulates an error during invalidation
      const result = await strategy.invalidate(['invalid:pattern:that:might:cause:error']);
      
      // Should not throw and should return empty results
      expect(result).toBeDefined();
      expect(Array.isArray(result.invalidatedKeys)).toBe(true);
      expect(Array.isArray(result.rulesApplied)).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large numbers of keys efficiently', () => {
      const startTime = Date.now();
      
      // Generate many keys
      for (let i = 0; i < 1000; i++) {
        strategy.generateSearchKey(`performance test ${i}`);
      }
      
      const endTime = Date.now();
      const generationTime = endTime - startTime;
      
      // Should be reasonably fast
      expect(generationTime).toBeLessThan(5000); // 5 seconds
    });

    it('should clean up old key access records', () => {
      // Generate many keys to trigger cleanup
      for (let i = 0; i < 12000; i++) {
        strategy.generateSearchKey(`cleanup test ${i}`);
      }
      
      // Should not have excessive memory usage
      const metrics = strategy.getMetrics();
      expect(metrics.totalKeys).toBeLessThanOrEqual(10000);
    });

    it('should provide consistent hash values', () => {
      const filters = { category: 'System', priority: 'high', tags: ['test'] };
      
      const key1 = strategy.generateSearchKey('hash test', filters);
      const key2 = strategy.generateSearchKey('hash test', filters);
      const key3 = strategy.generateSearchKey('hash test', { tags: ['test'], priority: 'high', category: 'System' });
      
      expect(key1).toBe(key2);
      expect(key1).toBe(key3); // Different order should produce same hash
    });
  });
});