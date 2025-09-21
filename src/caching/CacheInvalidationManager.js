"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheInvalidationManager = void 0;
const events_1 = require("events");
class CacheInvalidationManager extends events_1.EventEmitter {
    db;
    cacheManager;
    rules = new Map();
    dependencies = new Map();
    events = [];
    stats = {
        totalInvalidations: 0,
        successfulInvalidations: 0,
        cascadeInvalidations: 0,
        avgInvalidationTime: 0,
        topTriggers: [],
        effectiveness: 0
    };
    config = {
        maxEventsHistory: 1000,
        enableSmartTTL: true,
        enableCascadeInvalidation: true,
        maxCascadeDepth: 5,
        defaultTTL: 5 * 60 * 1000,
        adaptiveTTLMultiplier: 1.5,
        dependencyTrackingEnabled: true
    };
    constructor(database, cacheManager) {
        super();
        this.db = database;
        this.cacheManager = cacheManager;
        this.initializeInvalidationTables();
        this.setupDefaultRules();
        this.setupDatabaseTriggers();
        this.startMaintenanceProcesses();
        console.log('🗑️ Cache invalidation manager initialized');
    }
    async registerRule(rule) {
        this.rules.set(rule.id, rule);
        await this.storeRule(rule);
        if (rule.dependencies && this.config.dependencyTrackingEnabled) {
            for (const dependency of rule.dependencies) {
                if (!this.dependencies.has(dependency)) {
                    this.dependencies.set(dependency, new Set());
                }
                this.dependencies.get(dependency).add(rule.id);
            }
        }
        console.log(`📋 Invalidation rule registered: ${rule.name}`);
        this.emit('rule-registered', rule);
    }
    async onDataChange(table, operation, affectedIds, changes) {
        const events = [];
        const triggeredRules = this.findTriggeredRules('data_change', { table, operation, affectedIds, changes });
        for (const rule of triggeredRules) {
            const event = await this.executeRule(rule, {
                table,
                operation,
                affectedIds,
                changes,
                trigger: 'data_change'
            });
            if (event) {
                events.push(event);
            }
        }
        return events;
    }
    async invalidate(pattern, tags, cascade = true, reason) {
        const eventId = this.generateEventId();
        const startTime = Date.now();
        try {
            const affectedKeys = [];
            let cascadeLevel = 0;
            const primaryCount = await this.cacheManager.invalidate(pattern, tags, cascade);
            affectedKeys.push(...this.generateAffectedKeysFromPattern(pattern, tags));
            if (cascade && this.config.enableCascadeInvalidation) {
                const cascadeResults = await this.executeCascadeInvalidation(pattern, tags, 1);
                cascadeLevel = cascadeResults.maxDepth;
                affectedKeys.push(...cascadeResults.keys);
            }
            const event = {
                id: eventId,
                timestamp: new Date(),
                trigger: reason || 'manual',
                affectedKeys,
                affectedTags: tags || [],
                cascadeLevel,
                success: true
            };
            this.recordEvent(event);
            this.updateStats(event, Date.now() - startTime);
            console.log(`🗑️ Manual invalidation: ${affectedKeys.length} keys, cascade depth ${cascadeLevel}`);
            this.emit('invalidation-completed', event);
            return event;
        }
        catch (error) {
            const event = {
                id: eventId,
                timestamp: new Date(),
                trigger: reason || 'manual',
                affectedKeys: [],
                affectedTags: tags || [],
                cascadeLevel: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
            this.recordEvent(event);
            console.error('❌ Invalidation failed:', error);
            return event;
        }
    }
    async adjustTTL(cacheKey, accessPattern) {
        if (!this.config.enableSmartTTL) {
            return this.config.defaultTTL;
        }
        let adjustedTTL = this.config.defaultTTL;
        if (accessPattern.accessCount > 10) {
            adjustedTTL *= this.config.adaptiveTTLMultiplier;
        }
        if (accessPattern.computationTime > 100) {
            adjustedTTL *= this.config.adaptiveTTLMultiplier;
        }
        if (accessPattern.hitRate < 0.5) {
            adjustedTTL *= 0.5;
        }
        const hoursSinceAccess = (Date.now() - accessPattern.lastAccessed.getTime()) / (60 * 60 * 1000);
        if (hoursSinceAccess > 24) {
            adjustedTTL *= 0.5;
        }
        return Math.max(adjustedTTL, 60000);
    }
    getStats() {
        return { ...this.stats };
    }
    getRecentEvents(limit = 50) {
        return this.events
            .slice(-limit)
            .reverse();
    }
    getRecommendations() {
        const recommendations = [];
        if (this.stats.effectiveness < 0.7) {
            recommendations.push('Invalidation effectiveness is low - review rule conditions');
        }
        if (this.stats.cascadeInvalidations / Math.max(this.stats.totalInvalidations, 1) > 0.5) {
            recommendations.push('High cascade ratio - consider optimizing dependency chains');
        }
        const topTrigger = this.stats.topTriggers[0];
        if (topTrigger && topTrigger.avgKeysAffected > 100) {
            recommendations.push(`Trigger "${topTrigger.trigger}" invalidates too many keys - consider refinement`);
        }
        return recommendations;
    }
    findTriggeredRules(trigger, context) {
        const triggeredRules = [];
        for (const rule of this.rules.values()) {
            if (!rule.enabled || rule.trigger !== trigger)
                continue;
            if (this.evaluateRuleConditions(rule, context)) {
                triggeredRules.push(rule);
            }
        }
        return triggeredRules.sort((a, b) => b.priority - a.priority);
    }
    evaluateRuleConditions(rule, context) {
        if (!rule.conditions || rule.conditions.length === 0) {
            return true;
        }
        for (const condition of rule.conditions) {
            if (!this.evaluateCondition(condition, context)) {
                return false;
            }
        }
        return true;
    }
    evaluateCondition(condition, context) {
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
    async executeRule(rule, context) {
        const eventId = this.generateEventId();
        const startTime = Date.now();
        try {
            const affectedKeys = [];
            let cascadeLevel = 0;
            const primaryCount = await this.cacheManager.invalidate(rule.pattern, rule.tags, false);
            affectedKeys.push(...this.generateAffectedKeysFromPattern(rule.pattern, rule.tags));
            if (rule.cascade && this.config.enableCascadeInvalidation) {
                const cascadeResults = await this.executeCascadeInvalidation(rule.pattern, rule.tags, 1);
                cascadeLevel = cascadeResults.maxDepth;
                affectedKeys.push(...cascadeResults.keys);
            }
            const event = {
                id: eventId,
                timestamp: new Date(),
                trigger: `rule:${rule.name}`,
                affectedKeys,
                affectedTags: rule.tags || [],
                cascadeLevel,
                success: true
            };
            this.recordEvent(event);
            this.updateStats(event, Date.now() - startTime);
            console.log(`🗑️ Rule executed: ${rule.name} - ${affectedKeys.length} keys invalidated`);
            this.emit('rule-executed', { rule, event });
            return event;
        }
        catch (error) {
            const event = {
                id: eventId,
                timestamp: new Date(),
                trigger: `rule:${rule.name}`,
                affectedKeys: [],
                affectedTags: rule.tags || [],
                cascadeLevel: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
            this.recordEvent(event);
            console.error(`❌ Rule execution failed: ${rule.name}`, error);
            return event;
        }
    }
    async executeCascadeInvalidation(pattern, tags, depth = 1) {
        if (depth > this.config.maxCascadeDepth) {
            return { keys: [], maxDepth: depth - 1 };
        }
        const cascadeKeys = [];
        let maxDepth = depth;
        const dependentRules = this.findDependentRules(pattern, tags);
        for (const rule of dependentRules) {
            const dependentCount = await this.cacheManager.invalidate(rule.pattern, rule.tags, false);
            cascadeKeys.push(...this.generateAffectedKeysFromPattern(rule.pattern, rule.tags));
            if (rule.cascade) {
                const nestedResults = await this.executeCascadeInvalidation(rule.pattern, rule.tags, depth + 1);
                cascadeKeys.push(...nestedResults.keys);
                maxDepth = Math.max(maxDepth, nestedResults.maxDepth);
            }
        }
        return { keys: cascadeKeys, maxDepth };
    }
    findDependentRules(pattern, tags) {
        const dependentRules = [];
        for (const [ruleId, dependencies] of this.dependencies) {
            const rule = this.rules.get(ruleId);
            if (!rule || !rule.enabled)
                continue;
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
    setupDefaultRules() {
        const defaultRules = [
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
                        value: 'kb_entries'
                    }
                ]
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
                        value: 'UPDATE'
                    }
                ]
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
                        value: 24
                    }
                ]
            },
            {
                id: 'search-index-rebuilt',
                name: 'Search Index Rebuilt',
                trigger: 'manual',
                pattern: '*',
                tags: ['search', 'index'],
                cascade: true,
                priority: 15,
                enabled: true
            }
        ];
        defaultRules.forEach(rule => {
            this.registerRule(rule).catch(error => {
                console.error(`Failed to register default rule ${rule.id}:`, error);
            });
        });
    }
    setupDatabaseTriggers() {
        try {
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
        }
        catch (error) {
            console.error('❌ Failed to set up database triggers:', error);
        }
    }
    generateAffectedKeysFromPattern(pattern, tags) {
        const keys = [];
        if (pattern) {
            keys.push(`pattern:${pattern}`);
        }
        if (tags) {
            keys.push(...tags.map(tag => `tag:${tag}`));
        }
        return keys;
    }
    recordEvent(event) {
        this.events.push(event);
        if (this.events.length > this.config.maxEventsHistory) {
            this.events.shift();
        }
        this.storeEvent(event).catch(error => {
            console.error('Failed to store invalidation event:', error);
        });
    }
    updateStats(event, duration) {
        this.stats.totalInvalidations++;
        if (event.success) {
            this.stats.successfulInvalidations++;
        }
        if (event.cascadeLevel > 0) {
            this.stats.cascadeInvalidations++;
        }
        this.stats.avgInvalidationTime =
            (this.stats.avgInvalidationTime * (this.stats.totalInvalidations - 1) + duration)
                / this.stats.totalInvalidations;
        this.updateTopTriggers(event);
    }
    updateTopTriggers(event) {
        const triggerStats = this.stats.topTriggers.find(t => t.trigger === event.trigger);
        if (triggerStats) {
            triggerStats.count++;
            triggerStats.avgKeysAffected =
                (triggerStats.avgKeysAffected * (triggerStats.count - 1) + event.affectedKeys.length)
                    / triggerStats.count;
        }
        else {
            this.stats.topTriggers.push({
                trigger: event.trigger,
                count: 1,
                avgKeysAffected: event.affectedKeys.length
            });
        }
        this.stats.topTriggers.sort((a, b) => b.count - a.count);
        this.stats.topTriggers = this.stats.topTriggers.slice(0, 10);
    }
    generateEventId() {
        return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async storeRule(rule) {
        try {
            this.db.prepare(`
        INSERT OR REPLACE INTO invalidation_rules (
          id, name, trigger_type, pattern, tags, dependencies, cascade,
          priority, enabled, conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(rule.id, rule.name, rule.trigger, rule.pattern || null, rule.tags ? JSON.stringify(rule.tags) : null, rule.dependencies ? JSON.stringify(rule.dependencies) : null, rule.cascade ? 1 : 0, rule.priority, rule.enabled ? 1 : 0, rule.conditions ? JSON.stringify(rule.conditions) : null);
        }
        catch (error) {
            console.error('Failed to store invalidation rule:', error);
        }
    }
    async storeEvent(event) {
        try {
            this.db.prepare(`
        INSERT INTO cache_invalidation_events (
          event_id, timestamp, trigger_type, affected_keys, affected_tags,
          cascade_level, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(event.id, event.timestamp.toISOString(), event.trigger, JSON.stringify(event.affectedKeys), JSON.stringify(event.affectedTags), event.cascadeLevel, event.success ? 1 : 0, event.error || null);
        }
        catch (error) {
            console.error('Failed to store invalidation event:', error);
        }
    }
    initializeInvalidationTables() {
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
        }
        catch (error) {
            console.error('❌ Failed to initialize invalidation tables:', error);
        }
    }
    startMaintenanceProcesses() {
        setInterval(() => {
            this.processPendingEvents();
        }, 30 * 1000);
        setInterval(() => {
            this.calculateEffectiveness();
        }, 5 * 60 * 1000);
        setInterval(() => {
            this.cleanupOldEvents();
        }, 60 * 60 * 1000);
    }
    async processPendingEvents() {
        try {
            const pendingEvents = this.db.prepare(`
        SELECT * FROM cache_invalidation_events
        WHERE success IS NULL
        ORDER BY timestamp ASC
        LIMIT 50
      `).all();
            for (const event of pendingEvents) {
                await this.onDataChange(event.table_name, event.operation, event.affected_id ? [event.affected_id] : undefined);
                this.db.prepare(`
          UPDATE cache_invalidation_events
          SET success = 1
          WHERE id = ?
        `).run(event.id);
            }
        }
        catch (error) {
            console.error('Error processing pending invalidation events:', error);
        }
    }
    calculateEffectiveness() {
        const recentEvents = this.events.filter(e => e.timestamp.getTime() > Date.now() - (24 * 60 * 60 * 1000));
        const totalInvalidations = recentEvents.length;
        const successfulInvalidations = recentEvents.filter(e => e.success).length;
        this.stats.effectiveness = totalInvalidations > 0
            ? successfulInvalidations / totalInvalidations
            : 1;
    }
    cleanupOldEvents() {
        const cutoffTime = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        try {
            const result = this.db.prepare(`
        DELETE FROM cache_invalidation_events
        WHERE timestamp < ?
      `).run(cutoffTime.toISOString());
            if (result.changes && result.changes > 0) {
                console.log(`🧹 Cleaned up ${result.changes} old invalidation events`);
            }
        }
        catch (error) {
            console.error('Error cleaning up old invalidation events:', error);
        }
    }
}
exports.CacheInvalidationManager = CacheInvalidationManager;
//# sourceMappingURL=CacheInvalidationManager.js.map