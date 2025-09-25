/**
 * Intelligent Cache Invalidation Manager
 *
 * Implements sophisticated cache invalidation strategies to maintain
 * data consistency while maximizing cache effectiveness:
 *
 * - Event-driven invalidation on data changes
 * - Tag-based selective invalidation
 * - Smart TTL management with adaptive expiry
 * - Cascade invalidation for related data
 * - Dependency tracking for complex invalidation chains
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MultiLayerCacheManager } from './MultiLayerCacheManager';

export interface InvalidationRule {
  id: string;
  name: string;
  trigger: 'data_change' | 'time_based' | 'manual' | 'dependency' | 'pattern_match';
  pattern?: string;
  tags?: string[];
  dependencies?: string[];
  cascade: boolean;
  priority: number;
  enabled: boolean;
  conditions?: InvalidationCondition[];
}

export interface InvalidationCondition {
  type: 'table_change' | 'time_elapsed' | 'access_count' | 'data_size' | 'custom';
  target: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches';
  value: any;
}

export interface InvalidationEvent {
  id: string;
  timestamp: Date;
  trigger: string;
  affectedKeys: string[];
  affectedTags: string[];
  cascadeLevel: number;
  success: boolean;
  error?: string;
}

export interface InvalidationStats {
  totalInvalidations: number;
  successfulInvalidations: number;
  cascadeInvalidations: number;
  avgInvalidationTime: number;
  topTriggers: Array<{
    trigger: string;
    count: number;
    avgKeysAffected: number;
  }>;
  effectiveness: number; // Ratio of cache hits prevented vs. useful cache entries invalidated
}

export class CacheInvalidationManager extends EventEmitter {
  private db: Database.Database;
  private cacheManager: MultiLayerCacheManager;

  private rules: Map<string, InvalidationRule> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();
  private events: InvalidationEvent[] = [];

  private stats: InvalidationStats = {
    totalInvalidations: 0,
    successfulInvalidations: 0,
    cascadeInvalidations: 0,
    avgInvalidationTime: 0,
    topTriggers: [],
    effectiveness: 0,
  };

  private config = {
    maxEventsHistory: 1000,
    enableSmartTTL: true,
    enableCascadeInvalidation: true,
    maxCascadeDepth: 5,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    adaptiveTTLMultiplier: 1.5,
    dependencyTrackingEnabled: true,
  };

  constructor(database: Database.Database, cacheManager: MultiLayerCacheManager) {
    super();

    this.db = database;
    this.cacheManager = cacheManager;

    this.initializeInvalidationTables();
    this.setupDefaultRules();
    this.setupDatabaseTriggers();
    this.startMaintenanceProcesses();

    console.log('🗑️ Cache invalidation manager initialized');
  }

  /**
   * Register a new invalidation rule
   */
  async registerRule(rule: InvalidationRule): Promise<void> {
    this.rules.set(rule.id, rule);

    // Store rule in database for persistence
    await this.storeRule(rule);

    // Setup dependencies if specified
    if (rule.dependencies && this.config.dependencyTrackingEnabled) {
      for (const dependency of rule.dependencies) {
        if (!this.dependencies.has(dependency)) {
          this.dependencies.set(dependency, new Set());
        }
        this.dependencies.get(dependency)!.add(rule.id);
      }
    }

    console.log(`📋 Invalidation rule registered: ${rule.name}`);
    this.emit('rule-registered', rule);
  }

  /**
   * Trigger invalidation based on data changes
   */
  async onDataChange(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    affectedIds?: string[],
    changes?: Record<string, any>
  ): Promise<InvalidationEvent[]> {
    const events: InvalidationEvent[] = [];
    const triggeredRules = this.findTriggeredRules('data_change', {
      table,
      operation,
      affectedIds,
      changes,
    });

    for (const rule of triggeredRules) {
      const event = await this.executeRule(rule, {
        table,
        operation,
        affectedIds,
        changes,
        trigger: 'data_change',
      });

      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Manual invalidation with pattern or tags
   */
  async invalidate(
    pattern?: string,
    tags?: string[],
    cascade: boolean = true,
    reason?: string
  ): Promise<InvalidationEvent> {
    const eventId = this.generateEventId();
    const startTime = Date.now();

    try {
      let affectedKeys: string[] = [];
      let cascadeLevel = 0;

      // Primary invalidation
      const primaryCount = await this.cacheManager.invalidate(pattern, tags, cascade);
      affectedKeys.push(...this.generateAffectedKeysFromPattern(pattern, tags));

      // Cascade invalidation if enabled
      if (cascade && this.config.enableCascadeInvalidation) {
        const cascadeResults = await this.executeCascadeInvalidation(pattern, tags, 1);
        cascadeLevel = cascadeResults.maxDepth;
        affectedKeys.push(...cascadeResults.keys);
      }

      const event: InvalidationEvent = {
        id: eventId,
        timestamp: new Date(),
        trigger: reason || 'manual',
        affectedKeys,
        affectedTags: tags || [],
        cascadeLevel,
        success: true,
      };

      this.recordEvent(event);
      this.updateStats(event, Date.now() - startTime);

      console.log(
        `🗑️ Manual invalidation: ${affectedKeys.length} keys, cascade depth ${cascadeLevel}`
      );
      this.emit('invalidation-completed', event);

      return event;
    } catch (error) {
      const event: InvalidationEvent = {
        id: eventId,
        timestamp: new Date(),
        trigger: reason || 'manual',
        affectedKeys: [],
        affectedTags: tags || [],
        cascadeLevel: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      this.recordEvent(event);
      console.error('❌ Invalidation failed:', error);

      return event;
    }
  }

  /**
   * Smart TTL adjustment based on usage patterns
   */
  async adjustTTL(
    cacheKey: string,
    accessPattern: {
      accessCount: number;
      lastAccessed: Date;
      computationTime: number;
      hitRate: number;
    }
  ): Promise<number> {
    if (!this.config.enableSmartTTL) {
      return this.config.defaultTTL;
    }

    let adjustedTTL = this.config.defaultTTL;

    // Increase TTL for frequently accessed items
    if (accessPattern.accessCount > 10) {
      adjustedTTL *= this.config.adaptiveTTLMultiplier;
    }

    // Increase TTL for expensive computations
    if (accessPattern.computationTime > 100) {
      adjustedTTL *= this.config.adaptiveTTLMultiplier;
    }

    // Decrease TTL for items with low hit rates
    if (accessPattern.hitRate < 0.5) {
      adjustedTTL *= 0.5;
    }

    // Consider recency
    const hoursSinceAccess = (Date.now() - accessPattern.lastAccessed.getTime()) / (60 * 60 * 1000);
    if (hoursSinceAccess > 24) {
      adjustedTTL *= 0.5; // Reduce TTL for stale items
    }

    return Math.max(adjustedTTL, 60000); // Minimum 1 minute TTL
  }

  /**
   * Get invalidation statistics
   */
  getStats(): InvalidationStats {
    return { ...this.stats };
  }

  /**
   * Get recent invalidation events
   */
  getRecentEvents(limit: number = 50): InvalidationEvent[] {
    return this.events.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get effectiveness recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.stats.effectiveness < 0.7) {
      recommendations.push('Invalidation effectiveness is low - review rule conditions');
    }

    if (this.stats.cascadeInvalidations / Math.max(this.stats.totalInvalidations, 1) > 0.5) {
      recommendations.push('High cascade ratio - consider optimizing dependency chains');
    }

    const topTrigger = this.stats.topTriggers[0];
    if (topTrigger && topTrigger.avgKeysAffected > 100) {
      recommendations.push(
        `Trigger "${topTrigger.trigger}" invalidates too many keys - consider refinement`
      );
    }

    return recommendations;
  }

  // Private implementation methods

  private findTriggeredRules(trigger: string, context: Record<string, any>): InvalidationRule[] {
    const triggeredRules: InvalidationRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.trigger !== trigger) continue;

      if (this.evaluateRuleConditions(rule, context)) {
        triggeredRules.push(rule);
      }
    }

    // Sort by priority (higher priority first)
    return triggeredRules.sort((a, b) => b.priority - a.priority);
  }

  private evaluateRuleConditions(rule: InvalidationRule, context: Record<string, any>): boolean {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true; // No conditions means always trigger
    }

    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false; // All conditions must be true
      }
    }

    return true;
  }

  private evaluateCondition(
    condition: InvalidationCondition,
    context: Record<string, any>
  ): boolean {
    const targetValue = context[condition.target];

    switch (condition.operator) {
      case 'eq':
        return targetValue === condition.value;
      case 'gt':
        return targetValue > condition.value;
      case 'lt':
        return targetValue < condition.value;
      case 'gte':
        return targetValue >= condition.value;
      case 'lte':
        return targetValue <= condition.value;
      case 'contains':
        return String(targetValue).includes(String(condition.value));
      case 'matches':
        return new RegExp(condition.value).test(String(targetValue));
      default:
        return false;
    }
  }

  private async executeRule(
    rule: InvalidationRule,
    context: Record<string, any>
  ): Promise<InvalidationEvent | null> {
    const eventId = this.generateEventId();
    const startTime = Date.now();

    try {
      let affectedKeys: string[] = [];
      let cascadeLevel = 0;

      // Execute primary invalidation
      const primaryCount = await this.cacheManager.invalidate(rule.pattern, rule.tags, false);
      affectedKeys.push(...this.generateAffectedKeysFromPattern(rule.pattern, rule.tags));

      // Execute cascade if enabled
      if (rule.cascade && this.config.enableCascadeInvalidation) {
        const cascadeResults = await this.executeCascadeInvalidation(rule.pattern, rule.tags, 1);
        cascadeLevel = cascadeResults.maxDepth;
        affectedKeys.push(...cascadeResults.keys);
      }

      const event: InvalidationEvent = {
        id: eventId,
        timestamp: new Date(),
        trigger: `rule:${rule.name}`,
        affectedKeys,
        affectedTags: rule.tags || [],
        cascadeLevel,
        success: true,
      };

      this.recordEvent(event);
      this.updateStats(event, Date.now() - startTime);

      console.log(`🗑️ Rule executed: ${rule.name} - ${affectedKeys.length} keys invalidated`);
      this.emit('rule-executed', { rule, event });

      return event;
    } catch (error) {
      const event: InvalidationEvent = {
        id: eventId,
        timestamp: new Date(),
        trigger: `rule:${rule.name}`,
        affectedKeys: [],
        affectedTags: rule.tags || [],
        cascadeLevel: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      this.recordEvent(event);
      console.error(`❌ Rule execution failed: ${rule.name}`, error);

      return event;
    }
  }

  private async executeCascadeInvalidation(
    pattern?: string,
    tags?: string[],
    depth: number = 1
  ): Promise<{ keys: string[]; maxDepth: number }> {
    if (depth > this.config.maxCascadeDepth) {
      return { keys: [], maxDepth: depth - 1 };
    }

    const cascadeKeys: string[] = [];
    let maxDepth = depth;

    // Find dependent rules
    const dependentRules = this.findDependentRules(pattern, tags);

    for (const rule of dependentRules) {
      // Execute dependent rule
      const dependentCount = await this.cacheManager.invalidate(rule.pattern, rule.tags, false);
      cascadeKeys.push(...this.generateAffectedKeysFromPattern(rule.pattern, rule.tags));

      // Recurse if the dependent rule also has cascade enabled
      if (rule.cascade) {
        const nestedResults = await this.executeCascadeInvalidation(
          rule.pattern,
          rule.tags,
          depth + 1
        );
        cascadeKeys.push(...nestedResults.keys);
        maxDepth = Math.max(maxDepth, nestedResults.maxDepth);
      }
    }

    return { keys: cascadeKeys, maxDepth };
  }

  private findDependentRules(pattern?: string, tags?: string[]): InvalidationRule[] {
    const dependentRules: InvalidationRule[] = [];

    // Find rules that depend on the given pattern or tags
    for (const [ruleId, dependencies] of this.dependencies) {
      const rule = this.rules.get(ruleId);
      if (!rule || !rule.enabled) continue;

      // Check if any dependencies match
      if (pattern && dependencies.has(pattern)) {
        dependentRules.push(rule);
        continue;
      }

      if (tags) {
        for (const tag of tags) {
          if (dependencies.has(tag)) {
            dependentRules.push(rule);
            break;
          }
        }
      }
    }

    return dependentRules;
  }

  private setupDefaultRules(): void {
    const defaultRules: InvalidationRule[] = [
      {
        id: 'kb-entry-updated',
        name: 'Knowledge Base Entry Updated',
        trigger: 'data_change',
        pattern: 'search:*',
        tags: ['kb-entries', 'search-results'],
        cascade: true,
        priority: 10,
        enabled: true,
        conditions: [
          {
            type: 'table_change',
            target: 'table',
            operator: 'eq',
            value: 'kb_entries',
          },
        ],
      },
      {
        id: 'user-pattern-changed',
        name: 'User Pattern Changed',
        trigger: 'data_change',
        pattern: 'user:*',
        tags: ['user-patterns', 'personalized'],
        cascade: false,
        priority: 8,
        enabled: true,
        conditions: [
          {
            type: 'table_change',
            target: 'operation',
            operator: 'eq',
            value: 'UPDATE',
          },
        ],
      },
      {
        id: 'category-stats-stale',
        name: 'Category Statistics Stale',
        trigger: 'time_based',
        pattern: 'stats:category:*',
        tags: ['statistics', 'category'],
        cascade: false,
        priority: 5,
        enabled: true,
        conditions: [
          {
            type: 'time_elapsed',
            target: 'hours',
            operator: 'gte',
            value: 24,
          },
        ],
      },
      {
        id: 'search-index-rebuilt',
        name: 'Search Index Rebuilt',
        trigger: 'manual',
        pattern: '*',
        tags: ['search', 'index'],
        cascade: true,
        priority: 15,
        enabled: true,
      },
    ];

    defaultRules.forEach(rule => {
      this.registerRule(rule).catch(error => {
        console.error(`Failed to register default rule ${rule.id}:`, error);
      });
    });
  }

  private setupDatabaseTriggers(): void {
    try {
      // Create triggers for automatic invalidation on data changes
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS kb_entries_invalidate_cache
        AFTER UPDATE OF title, problem, solution, category ON kb_entries
        BEGIN
          INSERT INTO cache_invalidation_events (
            trigger_type, table_name, operation, affected_id, timestamp
          ) VALUES (
            'data_change', 'kb_entries', 'UPDATE', NEW.id, datetime('now')
          );
        END;
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS kb_entries_insert_invalidate_cache
        AFTER INSERT ON kb_entries
        BEGIN
          INSERT INTO cache_invalidation_events (
            trigger_type, table_name, operation, affected_id, timestamp
          ) VALUES (
            'data_change', 'kb_entries', 'INSERT', NEW.id, datetime('now')
          );
        END;
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS kb_entries_delete_invalidate_cache
        AFTER DELETE ON kb_entries
        BEGIN
          INSERT INTO cache_invalidation_events (
            trigger_type, table_name, operation, affected_id, timestamp
          ) VALUES (
            'data_change', 'kb_entries', 'DELETE', OLD.id, datetime('now')
          );
        END;
      `);

      console.log('✅ Database triggers for cache invalidation set up');
    } catch (error) {
      console.error('❌ Failed to set up database triggers:', error);
    }
  }

  private generateAffectedKeysFromPattern(pattern?: string, tags?: string[]): string[] {
    // This is a simplified implementation
    // In practice, you'd need to track actual cache keys that match the pattern
    const keys: string[] = [];

    if (pattern) {
      keys.push(`pattern:${pattern}`);
    }

    if (tags) {
      keys.push(...tags.map(tag => `tag:${tag}`));
    }

    return keys;
  }

  private recordEvent(event: InvalidationEvent): void {
    this.events.push(event);

    // Keep only recent events in memory
    if (this.events.length > this.config.maxEventsHistory) {
      this.events.shift();
    }

    // Store event in database
    this.storeEvent(event).catch(error => {
      console.error('Failed to store invalidation event:', error);
    });
  }

  private updateStats(event: InvalidationEvent, duration: number): void {
    this.stats.totalInvalidations++;

    if (event.success) {
      this.stats.successfulInvalidations++;
    }

    if (event.cascadeLevel > 0) {
      this.stats.cascadeInvalidations++;
    }

    // Update average invalidation time
    this.stats.avgInvalidationTime =
      (this.stats.avgInvalidationTime * (this.stats.totalInvalidations - 1) + duration) /
      this.stats.totalInvalidations;

    // Update top triggers
    this.updateTopTriggers(event);
  }

  private updateTopTriggers(event: InvalidationEvent): void {
    const triggerStats = this.stats.topTriggers.find(t => t.trigger === event.trigger);

    if (triggerStats) {
      triggerStats.count++;
      triggerStats.avgKeysAffected =
        (triggerStats.avgKeysAffected * (triggerStats.count - 1) + event.affectedKeys.length) /
        triggerStats.count;
    } else {
      this.stats.topTriggers.push({
        trigger: event.trigger,
        count: 1,
        avgKeysAffected: event.affectedKeys.length,
      });
    }

    // Sort by count and keep only top 10
    this.stats.topTriggers.sort((a, b) => b.count - a.count);
    this.stats.topTriggers = this.stats.topTriggers.slice(0, 10);
  }

  private generateEventId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async storeRule(rule: InvalidationRule): Promise<void> {
    try {
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO invalidation_rules (
          id, name, trigger_type, pattern, tags, dependencies, cascade,
          priority, enabled, conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          rule.id,
          rule.name,
          rule.trigger,
          rule.pattern || null,
          rule.tags ? JSON.stringify(rule.tags) : null,
          rule.dependencies ? JSON.stringify(rule.dependencies) : null,
          rule.cascade ? 1 : 0,
          rule.priority,
          rule.enabled ? 1 : 0,
          rule.conditions ? JSON.stringify(rule.conditions) : null
        );
    } catch (error) {
      console.error('Failed to store invalidation rule:', error);
    }
  }

  private async storeEvent(event: InvalidationEvent): Promise<void> {
    try {
      this.db
        .prepare(
          `
        INSERT INTO cache_invalidation_events (
          event_id, timestamp, trigger_type, affected_keys, affected_tags,
          cascade_level, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          event.id,
          event.timestamp.toISOString(),
          event.trigger,
          JSON.stringify(event.affectedKeys),
          JSON.stringify(event.affectedTags),
          event.cascadeLevel,
          event.success ? 1 : 0,
          event.error || null
        );
    } catch (error) {
      console.error('Failed to store invalidation event:', error);
    }
  }

  private initializeInvalidationTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS invalidation_rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          pattern TEXT,
          tags TEXT,
          dependencies TEXT,
          cascade INTEGER DEFAULT 0,
          priority INTEGER DEFAULT 5,
          enabled INTEGER DEFAULT 1,
          conditions TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cache_invalidation_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT,
          timestamp TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          table_name TEXT,
          operation TEXT,
          affected_id TEXT,
          affected_keys TEXT,
          affected_tags TEXT,
          cascade_level INTEGER DEFAULT 0,
          success INTEGER DEFAULT 1,
          error_message TEXT
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_invalidation_events_timestamp
        ON cache_invalidation_events(timestamp DESC)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_invalidation_events_trigger
        ON cache_invalidation_events(trigger_type)
      `);

      console.log('✅ Cache invalidation tables initialized');
    } catch (error) {
      console.error('❌ Failed to initialize invalidation tables:', error);
    }
  }

  private startMaintenanceProcesses(): void {
    // Check for database trigger events every 30 seconds
    setInterval(() => {
      this.processPendingEvents();
    }, 30 * 1000);

    // Calculate effectiveness metrics every 5 minutes
    setInterval(
      () => {
        this.calculateEffectiveness();
      },
      5 * 60 * 1000
    );

    // Clean up old events every hour
    setInterval(
      () => {
        this.cleanupOldEvents();
      },
      60 * 60 * 1000
    );
  }

  private async processPendingEvents(): Promise<void> {
    try {
      const pendingEvents = this.db
        .prepare(
          `
        SELECT * FROM cache_invalidation_events
        WHERE success IS NULL
        ORDER BY timestamp ASC
        LIMIT 50
      `
        )
        .all();

      for (const event of pendingEvents as any[]) {
        await this.onDataChange(
          event.table_name,
          event.operation,
          event.affected_id ? [event.affected_id] : undefined
        );

        // Mark as processed
        this.db
          .prepare(
            `
          UPDATE cache_invalidation_events
          SET success = 1
          WHERE id = ?
        `
          )
          .run(event.id);
      }
    } catch (error) {
      console.error('Error processing pending invalidation events:', error);
    }
  }

  private calculateEffectiveness(): void {
    // Calculate effectiveness based on prevented stale reads vs useful cache invalidations
    const recentEvents = this.events.filter(
      e => e.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    const totalInvalidations = recentEvents.length;
    const successfulInvalidations = recentEvents.filter(e => e.success).length;

    this.stats.effectiveness =
      totalInvalidations > 0 ? successfulInvalidations / totalInvalidations : 1;
  }

  private cleanupOldEvents(): void {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    try {
      const result = this.db
        .prepare(
          `
        DELETE FROM cache_invalidation_events
        WHERE timestamp < ?
      `
        )
        .run(cutoffTime.toISOString());

      if (result.changes && result.changes > 0) {
        console.log(`🧹 Cleaned up ${result.changes} old invalidation events`);
      }
    } catch (error) {
      console.error('Error cleaning up old invalidation events:', error);
    }
  }
}
