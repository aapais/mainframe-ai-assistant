import { EventEmitter } from 'events';
import { CacheOrchestrator } from './CacheOrchestrator';

export interface InvalidationRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern: string | RegExp;
  tags: string[];
  conditions?: {
    timeWindow?: number; // ms
    maxAge?: number; // seconds
    dependencies?: string[];
  };
  priority: number;
}

export interface InvalidationEvent {
  type: 'manual' | 'automatic' | 'scheduled' | 'dependency';
  trigger: string;
  timestamp: number;
  affected: {
    keys: string[];
    tags: string[];
    count: number;
  };
  duration: number;
}

export interface InvalidationMetrics {
  totalInvalidations: number;
  rulesTriggered: number;
  avgInvalidationTime: number;
  lastInvalidation: number;
  recentEvents: InvalidationEvent[];
  ruleStats: Map<
    string,
    {
      triggered: number;
      lastTriggered: number;
      avgDuration: number;
    }
  >;
}

export class CacheInvalidationService extends EventEmitter {
  private cacheOrchestrator: CacheOrchestrator;
  private rules: Map<string, InvalidationRule> = new Map();
  private scheduledTasks: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private metrics: InvalidationMetrics;
  private dependencyGraph: Map<string, Set<string>> = new Map();

  constructor(cacheOrchestrator: CacheOrchestrator) {
    super();
    this.cacheOrchestrator = cacheOrchestrator;
    this.metrics = {
      totalInvalidations: 0,
      rulesTriggered: 0,
      avgInvalidationTime: 0,
      lastInvalidation: 0,
      recentEvents: [],
      ruleStats: new Map(),
    };

    this.setupDefaultRules();
  }

  // Register invalidation rule
  registerRule(rule: InvalidationRule): void {
    this.rules.set(rule.id, rule);

    if (!this.metrics.ruleStats.has(rule.id)) {
      this.metrics.ruleStats.set(rule.id, {
        triggered: 0,
        lastTriggered: 0,
        avgDuration: 0,
      });
    }

    console.log(`Registered invalidation rule: ${rule.name}`);
  }

  // Invalidate by pattern
  async invalidateByPattern(
    pattern: string | RegExp,
    trigger: string = 'manual'
  ): Promise<InvalidationEvent> {
    const startTime = Date.now();
    const affectedKeys: string[] = [];
    const affectedTags: string[] = [];

    try {
      // Find matching rules
      const matchingRules = Array.from(this.rules.values())
        .filter(rule => rule.enabled && this.patternMatches(pattern, rule.pattern))
        .sort((a, b) => b.priority - a.priority);

      for (const rule of matchingRules) {
        const ruleStartTime = Date.now();

        // Invalidate by tags
        for (const tag of rule.tags) {
          const invalidated = await this.cacheOrchestrator.invalidateByTag(tag);
          if (invalidated > 0) {
            affectedTags.push(tag);
          }
        }

        // Update rule stats
        this.updateRuleStats(rule.id, Date.now() - ruleStartTime);
        this.metrics.rulesTriggered++;
      }

      const duration = Date.now() - startTime;
      const event: InvalidationEvent = {
        type: trigger === 'manual' ? 'manual' : 'automatic',
        trigger,
        timestamp: startTime,
        affected: {
          keys: affectedKeys,
          tags: affectedTags,
          count: affectedKeys.length + affectedTags.length,
        },
        duration,
      };

      this.recordEvent(event);
      this.emit('invalidation', event);

      return event;
    } catch (error) {
      console.error('Pattern invalidation error:', error);
      throw error;
    }
  }

  // Invalidate by dependency
  async invalidateByDependency(dependency: string): Promise<InvalidationEvent> {
    const startTime = Date.now();
    const dependents = this.dependencyGraph.get(dependency) || new Set();
    const affectedTags: string[] = [];

    for (const dependent of dependents) {
      const invalidated = await this.cacheOrchestrator.invalidateByTag(dependent);
      if (invalidated > 0) {
        affectedTags.push(dependent);
      }
    }

    // Also invalidate the dependency itself
    const selfInvalidated = await this.cacheOrchestrator.invalidateByTag(dependency);
    if (selfInvalidated > 0) {
      affectedTags.push(dependency);
    }

    const duration = Date.now() - startTime;
    const event: InvalidationEvent = {
      type: 'dependency',
      trigger: `dependency:${dependency}`,
      timestamp: startTime,
      affected: {
        keys: [],
        tags: affectedTags,
        count: affectedTags.length,
      },
      duration,
    };

    this.recordEvent(event);
    this.emit('dependency-invalidation', event);

    return event;
  }

  // Scheduled invalidation
  scheduleInvalidation(schedule: {
    pattern: string | RegExp;
    interval: number;
    tags: string[];
    name: string;
  }): void {
    const task = setInterval(async () => {
      try {
        await this.invalidateByPattern(schedule.pattern, `scheduled:${schedule.name}`);
      } catch (error) {
        console.error(`Scheduled invalidation failed for ${schedule.name}:`, error);
      }
    }, schedule.interval);

    this.scheduledTasks.set(schedule.name, task);
    console.log(`Scheduled invalidation: ${schedule.name} every ${schedule.interval}ms`);
  }

  // TTL-based invalidation
  async invalidateExpired(): Promise<InvalidationEvent> {
    const startTime = Date.now();

    // This would typically scan cache entries and check TTL
    // For now, we'll use a simple tag-based approach
    const expiredTags = ['expired', 'stale'];
    const affectedTags: string[] = [];

    for (const tag of expiredTags) {
      const invalidated = await this.cacheOrchestrator.invalidateByTag(tag);
      if (invalidated > 0) {
        affectedTags.push(tag);
      }
    }

    const duration = Date.now() - startTime;
    const event: InvalidationEvent = {
      type: 'automatic',
      trigger: 'ttl-expired',
      timestamp: startTime,
      affected: {
        keys: [],
        tags: affectedTags,
        count: affectedTags.length,
      },
      duration,
    };

    this.recordEvent(event);
    return event;
  }

  // Event-driven invalidation
  onDataChange(entity: string, operation: 'create' | 'update' | 'delete', data?: any): void {
    const eventKey = `${entity}:${operation}`;

    // Find rules that should trigger on this event
    const triggerRules = Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false;
      return rule.tags.some(
        tag => tag.includes(entity) || tag.includes(operation) || tag === 'data-change'
      );
    });

    if (triggerRules.length > 0) {
      setImmediate(async () => {
        for (const rule of triggerRules) {
          try {
            await this.invalidateByPattern(rule.pattern, `event:${eventKey}`);
          } catch (error) {
            console.error(`Event-driven invalidation failed for rule ${rule.id}:`, error);
          }
        }
      });
    }
  }

  // Add dependency relationship
  addDependency(parent: string, dependent: string): void {
    if (!this.dependencyGraph.has(parent)) {
      this.dependencyGraph.set(parent, new Set());
    }
    this.dependencyGraph.get(parent)!.add(dependent);
  }

  // Remove dependency relationship
  removeDependency(parent: string, dependent: string): void {
    const dependents = this.dependencyGraph.get(parent);
    if (dependents) {
      dependents.delete(dependent);
      if (dependents.size === 0) {
        this.dependencyGraph.delete(parent);
      }
    }
  }

  // Get invalidation metrics
  getMetrics(): InvalidationMetrics {
    return {
      ...this.metrics,
      ruleStats: new Map(this.metrics.ruleStats),
    };
  }

  // Clear all scheduled tasks
  clearScheduledTasks(): void {
    for (const [name, task] of this.scheduledTasks) {
      clearInterval(task);
      console.log(`Cleared scheduled invalidation: ${name}`);
    }
    this.scheduledTasks.clear();
  }

  private setupDefaultRules(): void {
    // Search invalidation rule
    this.registerRule({
      id: 'search-invalidation',
      name: 'Search Results Invalidation',
      enabled: true,
      pattern: /^search:/,
      tags: ['search', 'query'],
      priority: 8,
      conditions: {
        maxAge: 3600, // 1 hour
      },
    });

    // Knowledge base invalidation rule
    this.registerRule({
      id: 'kb-invalidation',
      name: 'Knowledge Base Invalidation',
      enabled: true,
      pattern: /^kb:/,
      tags: ['kb', 'knowledge', 'data-change'],
      priority: 9,
      conditions: {
        dependencies: ['kb:entries', 'kb:categories'],
      },
    });

    // User data invalidation rule
    this.registerRule({
      id: 'user-invalidation',
      name: 'User Data Invalidation',
      enabled: true,
      pattern: /^user:/,
      tags: ['user', 'auth', 'preferences'],
      priority: 7,
      conditions: {
        timeWindow: 300000, // 5 minutes
      },
    });

    // Database query invalidation rule
    this.registerRule({
      id: 'db-invalidation',
      name: 'Database Query Invalidation',
      enabled: true,
      pattern: /^query:db:/,
      tags: ['database', 'query', 'data-change'],
      priority: 10,
      conditions: {
        maxAge: 1800, // 30 minutes
      },
    });

    // Set up scheduled TTL cleanup
    this.scheduleInvalidation({
      name: 'ttl-cleanup',
      pattern: /expired|stale/,
      interval: 300000, // 5 minutes
      tags: ['expired', 'stale'],
    });
  }

  private patternMatches(pattern1: string | RegExp, pattern2: string | RegExp): boolean {
    if (typeof pattern1 === 'string' && typeof pattern2 === 'string') {
      return pattern1.includes(pattern2) || pattern2.includes(pattern1);
    }

    if (pattern1 instanceof RegExp && typeof pattern2 === 'string') {
      return pattern1.test(pattern2);
    }

    if (pattern2 instanceof RegExp && typeof pattern1 === 'string') {
      return pattern2.test(pattern1);
    }

    // Both are RegExp - check if they might overlap (simplified)
    if (pattern1 instanceof RegExp && pattern2 instanceof RegExp) {
      return pattern1.source === pattern2.source;
    }

    return false;
  }

  private updateRuleStats(ruleId: string, duration: number): void {
    const stats = this.metrics.ruleStats.get(ruleId);
    if (stats) {
      stats.triggered++;
      stats.lastTriggered = Date.now();
      stats.avgDuration = (stats.avgDuration * (stats.triggered - 1) + duration) / stats.triggered;
    }
  }

  private recordEvent(event: InvalidationEvent): void {
    this.metrics.totalInvalidations++;
    this.metrics.lastInvalidation = event.timestamp;

    // Update average invalidation time
    const total =
      this.metrics.avgInvalidationTime * (this.metrics.totalInvalidations - 1) + event.duration;
    this.metrics.avgInvalidationTime = total / this.metrics.totalInvalidations;

    // Keep only recent events (last 100)
    this.metrics.recentEvents.push(event);
    if (this.metrics.recentEvents.length > 100) {
      this.metrics.recentEvents.shift();
    }

    console.log(
      `Cache invalidation: ${event.trigger} (${event.duration}ms, ${event.affected.count} items)`
    );
  }
}
