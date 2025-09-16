/**
 * Cache Key Strategy and Invalidation Policies
 * Centralized key generation and cache invalidation management
 */

import { EventEmitter } from 'events';

export interface CacheKeyComponents {
  namespace: string;
  entityType: string;
  identifier: string;
  version?: string;
  userContext?: string;
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface InvalidationRule {
  id: string;
  name: string;
  pattern: string;
  tags: string[];
  triggerEvents: string[];
  cascade: boolean;
  priority: number;
  enabled: boolean;
}

export interface CacheNamespace {
  name: string;
  prefix: string;
  ttl: number;
  versioning: boolean;
  compression: boolean;
  encryption: boolean;
  invalidationRules: InvalidationRule[];
}

export interface KeyMetrics {
  totalKeys: number;
  namespaceDistribution: Record<string, number>;
  averageKeyLength: number;
  collisionRate: number;
  invalidationEvents: number;
  hotKeys: Array<{ key: string; hitCount: number; lastAccessed: number }>;
}

/**
 * Advanced Cache Key Strategy Manager
 *
 * Features:
 * - Hierarchical key structure
 * - Namespace management
 * - Version-aware keys
 * - Context-sensitive keys
 * - Intelligent invalidation
 * - Tag-based grouping
 * - Pattern-based invalidation
 * - Collision detection
 * - Hot key identification
 * - Metrics and monitoring
 */
export class CacheKeyStrategy extends EventEmitter {
  private namespaces = new Map<string, CacheNamespace>();
  private invalidationRules = new Map<string, InvalidationRule>();
  private keyMetrics: KeyMetrics;
  private keyAccessLog = new Map<string, { hitCount: number; lastAccessed: number }>();

  constructor() {
    super();

    this.keyMetrics = {
      totalKeys: 0,
      namespaceDistribution: {},
      averageKeyLength: 0,
      collisionRate: 0,
      invalidationEvents: 0,
      hotKeys: []
    };

    this.initializeDefaultNamespaces();
    this.initializeDefaultInvalidationRules();
  }

  /**
   * Generate cache key from components
   */
  generateKey(components: CacheKeyComponents): string {
    const namespace = this.namespaces.get(components.namespace);
    if (!namespace) {
      throw new Error(`Unknown namespace: ${components.namespace}`);
    }

    const parts: string[] = [namespace.prefix];

    // Add entity type
    parts.push(components.entityType);

    // Add identifier (normalized)
    parts.push(this.normalizeIdentifier(components.identifier));

    // Add version if namespace supports versioning
    if (namespace.versioning && components.version) {
      parts.push(`v${components.version}`);
    }

    // Add user context if provided
    if (components.userContext) {
      parts.push(`u${this.hashUserContext(components.userContext)}`);
    }

    // Add filters hash if provided
    if (components.filters && Object.keys(components.filters).length > 0) {
      parts.push(`f${this.hashFilters(components.filters)}`);
    }

    const key = parts.join(':');
    this.trackKeyUsage(key);

    return key;
  }

  /**
   * Generate search query cache key
   */
  generateSearchKey(
    query: string,
    options: Record<string, any> = {},
    userContext?: string
  ): string {
    return this.generateKey({
      namespace: 'search',
      entityType: 'query',
      identifier: query,
      userContext,
      filters: options
    });
  }

  /**
   * Generate result cache key
   */
  generateResultKey(
    resultId: string,
    version?: string,
    userContext?: string
  ): string {
    return this.generateKey({
      namespace: 'results',
      entityType: 'item',
      identifier: resultId,
      version,
      userContext
    });
  }

  /**
   * Generate index cache key
   */
  generateIndexKey(
    indexName: string,
    segment: string,
    version?: string
  ): string {
    return this.generateKey({
      namespace: 'index',
      entityType: indexName,
      identifier: segment,
      version
    });
  }

  /**
   * Generate aggregation cache key
   */
  generateAggregationKey(
    aggregationType: string,
    parameters: Record<string, any>,
    timeWindow?: string
  ): string {
    return this.generateKey({
      namespace: 'aggregation',
      entityType: aggregationType,
      identifier: timeWindow || 'global',
      filters: parameters
    });
  }

  /**
   * Generate user-specific cache key
   */
  generateUserKey(
    userId: string,
    dataType: string,
    identifier: string
  ): string {
    return this.generateKey({
      namespace: 'user',
      entityType: dataType,
      identifier,
      userContext: userId
    });
  }

  /**
   * Generate temporary cache key
   */
  generateTempKey(
    operation: string,
    sessionId: string,
    identifier: string
  ): string {
    return this.generateKey({
      namespace: 'temp',
      entityType: operation,
      identifier: `${sessionId}:${identifier}`
    });
  }

  /**
   * Parse cache key back to components
   */
  parseKey(key: string): Partial<CacheKeyComponents> | null {
    const parts = key.split(':');
    if (parts.length < 3) return null;

    const namespacePrefix = parts[0];
    const namespace = Array.from(this.namespaces.values())
      .find(ns => ns.prefix === namespacePrefix);

    if (!namespace) return null;

    const components: Partial<CacheKeyComponents> = {
      namespace: namespace.name,
      entityType: parts[1],
      identifier: parts[2]
    };

    // Parse additional components
    for (let i = 3; i < parts.length; i++) {
      const part = parts[i];

      if (part.startsWith('v')) {
        components.version = part.substring(1);
      } else if (part.startsWith('u')) {
        components.userContext = part.substring(1);
      } else if (part.startsWith('f')) {
        // Filters are hashed, cannot be directly parsed
        components.filters = { _hash: part.substring(1) };
      }
    }

    return components;
  }

  /**
   * Invalidate cache entries based on patterns and tags
   */
  async invalidate(
    patterns?: string[],
    tags?: string[],
    eventType?: string
  ): Promise<{ invalidatedKeys: string[]; rulesApplied: string[] }> {
    const invalidatedKeys: string[] = [];
    const rulesApplied: string[] = [];

    try {
      // Find applicable invalidation rules
      const applicableRules = this.findApplicableRules(patterns, tags, eventType);

      for (const rule of applicableRules) {
        if (!rule.enabled) continue;

        // Apply rule pattern
        const keysToInvalidate = await this.findKeysMatchingPattern(rule.pattern);

        invalidatedKeys.push(...keysToInvalidate);
        rulesApplied.push(rule.id);

        // Emit invalidation event
        this.emit('keys-invalidated', {
          rule: rule.id,
          pattern: rule.pattern,
          keys: keysToInvalidate
        });

        // Handle cascade invalidation
        if (rule.cascade) {
          const cascadeKeys = await this.getCascadeKeys(keysToInvalidate);
          invalidatedKeys.push(...cascadeKeys);
        }
      }

      this.keyMetrics.invalidationEvents++;

      console.log(`Cache invalidation: ${invalidatedKeys.length} keys invalidated using ${rulesApplied.length} rules`);

      return {
        invalidatedKeys: [...new Set(invalidatedKeys)], // Remove duplicates
        rulesApplied
      };

    } catch (error) {
      console.error('Cache invalidation error:', error);
      return { invalidatedKeys: [], rulesApplied: [] };
    }
  }

  /**
   * Add custom invalidation rule
   */
  addInvalidationRule(rule: InvalidationRule): void {
    this.invalidationRules.set(rule.id, rule);

    // Add to namespace if specified
    if (rule.pattern.includes(':')) {
      const prefix = rule.pattern.split(':')[0];
      const namespace = Array.from(this.namespaces.values())
        .find(ns => ns.prefix === prefix);

      if (namespace) {
        namespace.invalidationRules.push(rule);
      }
    }

    this.emit('rule-added', rule);
  }

  /**
   * Remove invalidation rule
   */
  removeInvalidationRule(ruleId: string): boolean {
    const rule = this.invalidationRules.get(ruleId);
    if (!rule) return false;

    this.invalidationRules.delete(ruleId);

    // Remove from namespaces
    for (const namespace of this.namespaces.values()) {
      namespace.invalidationRules = namespace.invalidationRules
        .filter(r => r.id !== ruleId);
    }

    this.emit('rule-removed', { ruleId });
    return true;
  }

  /**
   * Register custom namespace
   */
  registerNamespace(namespace: CacheNamespace): void {
    this.namespaces.set(namespace.name, namespace);
    this.emit('namespace-registered', namespace);
  }

  /**
   * Get key metrics and analytics
   */
  getMetrics(): KeyMetrics {
    this.updateMetrics();
    return { ...this.keyMetrics };
  }

  /**
   * Get hot keys (frequently accessed)
   */
  getHotKeys(limit: number = 20): Array<{ key: string; hitCount: number; lastAccessed: number }> {
    return Array.from(this.keyAccessLog.entries())
      .map(([key, stats]) => ({ key, ...stats }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);
  }

  /**
   * Analyze key patterns and suggest optimizations
   */
  analyzeKeyPatterns(): {
    suggestions: string[];
    longKeys: string[];
    collisions: Array<{ pattern: string; count: number }>;
    namespaceStats: Record<string, { count: number; averageLength: number }>;
  } {
    const suggestions: string[] = [];
    const longKeys: string[] = [];
    const collisionMap = new Map<string, number>();
    const namespaceStats: Record<string, { count: number; averageLength: number }> = {};

    // Analyze key lengths
    const keyLengths: number[] = [];
    for (const [key, stats] of this.keyAccessLog) {
      keyLengths.push(key.length);

      if (key.length > 200) {
        longKeys.push(key);
      }

      // Check for potential collisions (similar keys)
      const pattern = this.extractKeyPattern(key);
      collisionMap.set(pattern, (collisionMap.get(pattern) || 0) + 1);

      // Namespace analysis
      const namespace = key.split(':')[0];
      if (!namespaceStats[namespace]) {
        namespaceStats[namespace] = { count: 0, averageLength: 0 };
      }
      namespaceStats[namespace].count++;
      namespaceStats[namespace].averageLength += key.length;
    }

    // Finalize namespace stats
    for (const stats of Object.values(namespaceStats)) {
      stats.averageLength = stats.averageLength / stats.count;
    }

    // Generate suggestions
    if (longKeys.length > 0) {
      suggestions.push(`Consider shortening ${longKeys.length} keys longer than 200 characters`);
    }

    const avgLength = keyLengths.reduce((sum, len) => sum + len, 0) / keyLengths.length;
    if (avgLength > 100) {
      suggestions.push('Average key length is high, consider using shorter identifiers');
    }

    const collisions = Array.from(collisionMap.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .filter(item => item.count > 10)
      .sort((a, b) => b.count - a.count);

    if (collisions.length > 0) {
      suggestions.push(`Found ${collisions.length} key patterns with high collision potential`);
    }

    return {
      suggestions,
      longKeys,
      collisions,
      namespaceStats
    };
  }

  // Private Implementation

  private initializeDefaultNamespaces(): void {
    const defaultNamespaces: CacheNamespace[] = [
      {
        name: 'search',
        prefix: 'srch',
        ttl: 300000, // 5 minutes
        versioning: false,
        compression: true,
        encryption: false,
        invalidationRules: []
      },
      {
        name: 'results',
        prefix: 'rslt',
        ttl: 600000, // 10 minutes
        versioning: true,
        compression: true,
        encryption: false,
        invalidationRules: []
      },
      {
        name: 'index',
        prefix: 'idx',
        ttl: 3600000, // 1 hour
        versioning: true,
        compression: true,
        encryption: false,
        invalidationRules: []
      },
      {
        name: 'aggregation',
        prefix: 'agg',
        ttl: 1800000, // 30 minutes
        versioning: false,
        compression: true,
        encryption: false,
        invalidationRules: []
      },
      {
        name: 'user',
        prefix: 'usr',
        ttl: 1800000, // 30 minutes
        versioning: false,
        compression: true,
        encryption: true,
        invalidationRules: []
      },
      {
        name: 'temp',
        prefix: 'tmp',
        ttl: 300000, // 5 minutes
        versioning: false,
        compression: false,
        encryption: false,
        invalidationRules: []
      }
    ];

    defaultNamespaces.forEach(namespace => {
      this.namespaces.set(namespace.name, namespace);
    });
  }

  private initializeDefaultInvalidationRules(): void {
    const defaultRules: InvalidationRule[] = [
      {
        id: 'search-results-update',
        name: 'Invalidate search results on data update',
        pattern: 'srch:*',
        tags: ['search', 'results'],
        triggerEvents: ['data-updated', 'index-rebuilt'],
        cascade: true,
        priority: 10,
        enabled: true
      },
      {
        id: 'user-data-change',
        name: 'Invalidate user-specific cache on user data change',
        pattern: 'usr:*',
        tags: ['user'],
        triggerEvents: ['user-updated', 'user-deleted'],
        cascade: false,
        priority: 5,
        enabled: true
      },
      {
        id: 'index-rebuild',
        name: 'Invalidate index cache on rebuild',
        pattern: 'idx:*',
        tags: ['index'],
        triggerEvents: ['index-rebuilt', 'schema-changed'],
        cascade: true,
        priority: 15,
        enabled: true
      },
      {
        id: 'temp-cleanup',
        name: 'Clean up temporary cache entries',
        pattern: 'tmp:*',
        tags: ['temporary'],
        triggerEvents: ['session-ended', 'cleanup'],
        cascade: false,
        priority: 1,
        enabled: true
      },
      {
        id: 'aggregation-refresh',
        name: 'Refresh aggregation cache periodically',
        pattern: 'agg:*',
        tags: ['aggregation'],
        triggerEvents: ['data-updated', 'time-window-expired'],
        cascade: false,
        priority: 8,
        enabled: true
      }
    ];

    defaultRules.forEach(rule => {
      this.invalidationRules.set(rule.id, rule);
    });
  }

  private normalizeIdentifier(identifier: string): string {
    return identifier
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 50); // Limit length
  }

  private hashUserContext(userContext: string): string {
    // Simple hash function (in production, use proper hashing)
    let hash = 0;
    for (let i = 0; i < userContext.length; i++) {
      const char = userContext.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private hashFilters(filters: Record<string, any>): string {
    const normalized = Object.keys(filters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {} as Record<string, any>);

    const serialized = JSON.stringify(normalized);

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private trackKeyUsage(key: string): void {
    const current = this.keyAccessLog.get(key) || { hitCount: 0, lastAccessed: 0 };
    current.hitCount++;
    current.lastAccessed = Date.now();
    this.keyAccessLog.set(key, current);

    this.keyMetrics.totalKeys = this.keyAccessLog.size;

    // Cleanup old entries periodically
    if (this.keyAccessLog.size > 10000) {
      this.cleanupOldKeys();
    }
  }

  private findApplicableRules(
    patterns?: string[],
    tags?: string[],
    eventType?: string
  ): InvalidationRule[] {
    const rules: InvalidationRule[] = [];

    for (const rule of this.invalidationRules.values()) {
      if (!rule.enabled) continue;

      let applicable = false;

      // Check event type
      if (eventType && rule.triggerEvents.includes(eventType)) {
        applicable = true;
      }

      // Check patterns
      if (patterns && patterns.some(pattern => this.matchesPattern(rule.pattern, pattern))) {
        applicable = true;
      }

      // Check tags
      if (tags && tags.some(tag => rule.tags.includes(tag))) {
        applicable = true;
      }

      if (applicable) {
        rules.push(rule);
      }
    }

    // Sort by priority
    return rules.sort((a, b) => b.priority - a.priority);
  }

  private async findKeysMatchingPattern(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const matchingKeys: string[] = [];

    for (const key of this.keyAccessLog.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }

    return matchingKeys;
  }

  private async getCascadeKeys(baseKeys: string[]): Promise<string[]> {
    const cascadeKeys: string[] = [];

    for (const key of baseKeys) {
      const components = this.parseKey(key);
      if (!components) continue;

      // Generate related keys that should be invalidated
      if (components.entityType === 'query') {
        // Invalidate related result keys
        const resultPattern = `rslt:*:${components.identifier}*`;
        const relatedKeys = await this.findKeysMatchingPattern(resultPattern);
        cascadeKeys.push(...relatedKeys);
      }

      if (components.entityType === 'item') {
        // Invalidate related aggregation keys
        const aggPattern = `agg:*`;
        const relatedKeys = await this.findKeysMatchingPattern(aggPattern);
        cascadeKeys.push(...relatedKeys);
      }
    }

    return cascadeKeys;
  }

  private matchesPattern(rulePattern: string, testPattern: string): boolean {
    const ruleRegex = new RegExp(rulePattern.replace(/\*/g, '.*'));
    return ruleRegex.test(testPattern);
  }

  private updateMetrics(): void {
    // Update namespace distribution
    this.keyMetrics.namespaceDistribution = {};
    let totalLength = 0;

    for (const key of this.keyAccessLog.keys()) {
      const namespace = key.split(':')[0];
      this.keyMetrics.namespaceDistribution[namespace] =
        (this.keyMetrics.namespaceDistribution[namespace] || 0) + 1;
      totalLength += key.length;
    }

    this.keyMetrics.averageKeyLength = this.keyAccessLog.size > 0
      ? totalLength / this.keyAccessLog.size
      : 0;

    // Update hot keys
    this.keyMetrics.hotKeys = this.getHotKeys(10);
  }

  private extractKeyPattern(key: string): string {
    // Extract pattern by replacing variable parts with wildcards
    return key
      .replace(/:[a-f0-9]{8,}/g, ':*') // Replace long hex strings
      .replace(/:\d+/g, ':*') // Replace numbers
      .replace(/:u[a-z0-9]+/g, ':u*') // Replace user contexts
      .replace(/:f[a-z0-9]+/g, ':f*'); // Replace filter hashes
  }

  private cleanupOldKeys(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    const keysToDelete: string[] = [];

    for (const [key, stats] of this.keyAccessLog) {
      if (stats.lastAccessed < cutoff) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.keyAccessLog.delete(key);
    });

    console.log(`Cleaned up ${keysToDelete.length} old key access records`);
  }
}

export default CacheKeyStrategy;