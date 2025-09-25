'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CacheInvalidationService = void 0;
const events_1 = require('events');
class CacheInvalidationService extends events_1.EventEmitter {
  cacheOrchestrator;
  rules = new Map();
  scheduledTasks = new Map();
  metrics;
  dependencyGraph = new Map();
  constructor(cacheOrchestrator) {
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
  registerRule(rule) {
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
  async invalidateByPattern(pattern, trigger = 'manual') {
    const startTime = Date.now();
    const affectedKeys = [];
    const affectedTags = [];
    try {
      const matchingRules = Array.from(this.rules.values())
        .filter(rule => rule.enabled && this.patternMatches(pattern, rule.pattern))
        .sort((a, b) => b.priority - a.priority);
      for (const rule of matchingRules) {
        const ruleStartTime = Date.now();
        for (const tag of rule.tags) {
          const invalidated = await this.cacheOrchestrator.invalidateByTag(tag);
          if (invalidated > 0) {
            affectedTags.push(tag);
          }
        }
        this.updateRuleStats(rule.id, Date.now() - ruleStartTime);
        this.metrics.rulesTriggered++;
      }
      const duration = Date.now() - startTime;
      const event = {
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
  async invalidateByDependency(dependency) {
    const startTime = Date.now();
    const dependents = this.dependencyGraph.get(dependency) || new Set();
    const affectedTags = [];
    for (const dependent of dependents) {
      const invalidated = await this.cacheOrchestrator.invalidateByTag(dependent);
      if (invalidated > 0) {
        affectedTags.push(dependent);
      }
    }
    const selfInvalidated = await this.cacheOrchestrator.invalidateByTag(dependency);
    if (selfInvalidated > 0) {
      affectedTags.push(dependency);
    }
    const duration = Date.now() - startTime;
    const event = {
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
  scheduleInvalidation(schedule) {
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
  async invalidateExpired() {
    const startTime = Date.now();
    const expiredTags = ['expired', 'stale'];
    const affectedTags = [];
    for (const tag of expiredTags) {
      const invalidated = await this.cacheOrchestrator.invalidateByTag(tag);
      if (invalidated > 0) {
        affectedTags.push(tag);
      }
    }
    const duration = Date.now() - startTime;
    const event = {
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
  onDataChange(entity, operation, data) {
    const eventKey = `${entity}:${operation}`;
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
  addDependency(parent, dependent) {
    if (!this.dependencyGraph.has(parent)) {
      this.dependencyGraph.set(parent, new Set());
    }
    this.dependencyGraph.get(parent).add(dependent);
  }
  removeDependency(parent, dependent) {
    const dependents = this.dependencyGraph.get(parent);
    if (dependents) {
      dependents.delete(dependent);
      if (dependents.size === 0) {
        this.dependencyGraph.delete(parent);
      }
    }
  }
  getMetrics() {
    return {
      ...this.metrics,
      ruleStats: new Map(this.metrics.ruleStats),
    };
  }
  clearScheduledTasks() {
    for (const [name, task] of this.scheduledTasks) {
      clearInterval(task);
      console.log(`Cleared scheduled invalidation: ${name}`);
    }
    this.scheduledTasks.clear();
  }
  setupDefaultRules() {
    this.registerRule({
      id: 'search-invalidation',
      name: 'Search Results Invalidation',
      enabled: true,
      pattern: /^search:/,
      tags: ['search', 'query'],
      priority: 8,
      conditions: {
        maxAge: 3600,
      },
    });
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
    this.registerRule({
      id: 'user-invalidation',
      name: 'User Data Invalidation',
      enabled: true,
      pattern: /^user:/,
      tags: ['user', 'auth', 'preferences'],
      priority: 7,
      conditions: {
        timeWindow: 300000,
      },
    });
    this.registerRule({
      id: 'db-invalidation',
      name: 'Database Query Invalidation',
      enabled: true,
      pattern: /^query:db:/,
      tags: ['database', 'query', 'data-change'],
      priority: 10,
      conditions: {
        maxAge: 1800,
      },
    });
    this.scheduleInvalidation({
      name: 'ttl-cleanup',
      pattern: /expired|stale/,
      interval: 300000,
      tags: ['expired', 'stale'],
    });
  }
  patternMatches(pattern1, pattern2) {
    if (typeof pattern1 === 'string' && typeof pattern2 === 'string') {
      return pattern1.includes(pattern2) || pattern2.includes(pattern1);
    }
    if (pattern1 instanceof RegExp && typeof pattern2 === 'string') {
      return pattern1.test(pattern2);
    }
    if (pattern2 instanceof RegExp && typeof pattern1 === 'string') {
      return pattern2.test(pattern1);
    }
    if (pattern1 instanceof RegExp && pattern2 instanceof RegExp) {
      return pattern1.source === pattern2.source;
    }
    return false;
  }
  updateRuleStats(ruleId, duration) {
    const stats = this.metrics.ruleStats.get(ruleId);
    if (stats) {
      stats.triggered++;
      stats.lastTriggered = Date.now();
      stats.avgDuration = (stats.avgDuration * (stats.triggered - 1) + duration) / stats.triggered;
    }
  }
  recordEvent(event) {
    this.metrics.totalInvalidations++;
    this.metrics.lastInvalidation = event.timestamp;
    const total =
      this.metrics.avgInvalidationTime * (this.metrics.totalInvalidations - 1) + event.duration;
    this.metrics.avgInvalidationTime = total / this.metrics.totalInvalidations;
    this.metrics.recentEvents.push(event);
    if (this.metrics.recentEvents.length > 100) {
      this.metrics.recentEvents.shift();
    }
    console.log(
      `Cache invalidation: ${event.trigger} (${event.duration}ms, ${event.affected.count} items)`
    );
  }
}
exports.CacheInvalidationService = CacheInvalidationService;
//# sourceMappingURL=CacheInvalidationService.js.map
