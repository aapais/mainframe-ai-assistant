"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheKeyStrategy = void 0;
const events_1 = require("events");
class CacheKeyStrategy extends events_1.EventEmitter {
    namespaces = new Map();
    invalidationRules = new Map();
    keyMetrics;
    keyAccessLog = new Map();
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
    generateKey(components) {
        const namespace = this.namespaces.get(components.namespace);
        if (!namespace) {
            throw new Error(`Unknown namespace: ${components.namespace}`);
        }
        const parts = [namespace.prefix];
        parts.push(components.entityType);
        parts.push(this.normalizeIdentifier(components.identifier));
        if (namespace.versioning && components.version) {
            parts.push(`v${components.version}`);
        }
        if (components.userContext) {
            parts.push(`u${this.hashUserContext(components.userContext)}`);
        }
        if (components.filters && Object.keys(components.filters).length > 0) {
            parts.push(`f${this.hashFilters(components.filters)}`);
        }
        const key = parts.join(':');
        this.trackKeyUsage(key);
        return key;
    }
    generateSearchKey(query, options = {}, userContext) {
        return this.generateKey({
            namespace: 'search',
            entityType: 'query',
            identifier: query,
            userContext,
            filters: options
        });
    }
    generateResultKey(resultId, version, userContext) {
        return this.generateKey({
            namespace: 'results',
            entityType: 'item',
            identifier: resultId,
            version,
            userContext
        });
    }
    generateIndexKey(indexName, segment, version) {
        return this.generateKey({
            namespace: 'index',
            entityType: indexName,
            identifier: segment,
            version
        });
    }
    generateAggregationKey(aggregationType, parameters, timeWindow) {
        return this.generateKey({
            namespace: 'aggregation',
            entityType: aggregationType,
            identifier: timeWindow || 'global',
            filters: parameters
        });
    }
    generateUserKey(userId, dataType, identifier) {
        return this.generateKey({
            namespace: 'user',
            entityType: dataType,
            identifier,
            userContext: userId
        });
    }
    generateTempKey(operation, sessionId, identifier) {
        return this.generateKey({
            namespace: 'temp',
            entityType: operation,
            identifier: `${sessionId}:${identifier}`
        });
    }
    parseKey(key) {
        const parts = key.split(':');
        if (parts.length < 3)
            return null;
        const namespacePrefix = parts[0];
        const namespace = Array.from(this.namespaces.values())
            .find(ns => ns.prefix === namespacePrefix);
        if (!namespace)
            return null;
        const components = {
            namespace: namespace.name,
            entityType: parts[1],
            identifier: parts[2]
        };
        for (let i = 3; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('v')) {
                components.version = part.substring(1);
            }
            else if (part.startsWith('u')) {
                components.userContext = part.substring(1);
            }
            else if (part.startsWith('f')) {
                components.filters = { _hash: part.substring(1) };
            }
        }
        return components;
    }
    async invalidate(patterns, tags, eventType) {
        const invalidatedKeys = [];
        const rulesApplied = [];
        try {
            const applicableRules = this.findApplicableRules(patterns, tags, eventType);
            for (const rule of applicableRules) {
                if (!rule.enabled)
                    continue;
                const keysToInvalidate = await this.findKeysMatchingPattern(rule.pattern);
                invalidatedKeys.push(...keysToInvalidate);
                rulesApplied.push(rule.id);
                this.emit('keys-invalidated', {
                    rule: rule.id,
                    pattern: rule.pattern,
                    keys: keysToInvalidate
                });
                if (rule.cascade) {
                    const cascadeKeys = await this.getCascadeKeys(keysToInvalidate);
                    invalidatedKeys.push(...cascadeKeys);
                }
            }
            this.keyMetrics.invalidationEvents++;
            console.log(`Cache invalidation: ${invalidatedKeys.length} keys invalidated using ${rulesApplied.length} rules`);
            return {
                invalidatedKeys: [...new Set(invalidatedKeys)],
                rulesApplied
            };
        }
        catch (error) {
            console.error('Cache invalidation error:', error);
            return { invalidatedKeys: [], rulesApplied: [] };
        }
    }
    addInvalidationRule(rule) {
        this.invalidationRules.set(rule.id, rule);
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
    removeInvalidationRule(ruleId) {
        const rule = this.invalidationRules.get(ruleId);
        if (!rule)
            return false;
        this.invalidationRules.delete(ruleId);
        for (const namespace of this.namespaces.values()) {
            namespace.invalidationRules = namespace.invalidationRules
                .filter(r => r.id !== ruleId);
        }
        this.emit('rule-removed', { ruleId });
        return true;
    }
    registerNamespace(namespace) {
        this.namespaces.set(namespace.name, namespace);
        this.emit('namespace-registered', namespace);
    }
    getMetrics() {
        this.updateMetrics();
        return { ...this.keyMetrics };
    }
    getHotKeys(limit = 20) {
        return Array.from(this.keyAccessLog.entries())
            .map(([key, stats]) => ({ key, ...stats }))
            .sort((a, b) => b.hitCount - a.hitCount)
            .slice(0, limit);
    }
    analyzeKeyPatterns() {
        const suggestions = [];
        const longKeys = [];
        const collisionMap = new Map();
        const namespaceStats = {};
        const keyLengths = [];
        for (const [key, stats] of this.keyAccessLog) {
            keyLengths.push(key.length);
            if (key.length > 200) {
                longKeys.push(key);
            }
            const pattern = this.extractKeyPattern(key);
            collisionMap.set(pattern, (collisionMap.get(pattern) || 0) + 1);
            const namespace = key.split(':')[0];
            if (!namespaceStats[namespace]) {
                namespaceStats[namespace] = { count: 0, averageLength: 0 };
            }
            namespaceStats[namespace].count++;
            namespaceStats[namespace].averageLength += key.length;
        }
        for (const stats of Object.values(namespaceStats)) {
            stats.averageLength = stats.averageLength / stats.count;
        }
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
    initializeDefaultNamespaces() {
        const defaultNamespaces = [
            {
                name: 'search',
                prefix: 'srch',
                ttl: 300000,
                versioning: false,
                compression: true,
                encryption: false,
                invalidationRules: []
            },
            {
                name: 'results',
                prefix: 'rslt',
                ttl: 600000,
                versioning: true,
                compression: true,
                encryption: false,
                invalidationRules: []
            },
            {
                name: 'index',
                prefix: 'idx',
                ttl: 3600000,
                versioning: true,
                compression: true,
                encryption: false,
                invalidationRules: []
            },
            {
                name: 'aggregation',
                prefix: 'agg',
                ttl: 1800000,
                versioning: false,
                compression: true,
                encryption: false,
                invalidationRules: []
            },
            {
                name: 'user',
                prefix: 'usr',
                ttl: 1800000,
                versioning: false,
                compression: true,
                encryption: true,
                invalidationRules: []
            },
            {
                name: 'temp',
                prefix: 'tmp',
                ttl: 300000,
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
    initializeDefaultInvalidationRules() {
        const defaultRules = [
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
    normalizeIdentifier(identifier) {
        return identifier
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 50);
    }
    hashUserContext(userContext) {
        let hash = 0;
        for (let i = 0; i < userContext.length; i++) {
            const char = userContext.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    hashFilters(filters) {
        const normalized = Object.keys(filters)
            .sort()
            .reduce((acc, key) => {
            acc[key] = filters[key];
            return acc;
        }, {});
        const serialized = JSON.stringify(normalized);
        let hash = 0;
        for (let i = 0; i < serialized.length; i++) {
            const char = serialized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    trackKeyUsage(key) {
        const current = this.keyAccessLog.get(key) || { hitCount: 0, lastAccessed: 0 };
        current.hitCount++;
        current.lastAccessed = Date.now();
        this.keyAccessLog.set(key, current);
        this.keyMetrics.totalKeys = this.keyAccessLog.size;
        if (this.keyAccessLog.size > 10000) {
            this.cleanupOldKeys();
        }
    }
    findApplicableRules(patterns, tags, eventType) {
        const rules = [];
        for (const rule of this.invalidationRules.values()) {
            if (!rule.enabled)
                continue;
            let applicable = false;
            if (eventType && rule.triggerEvents.includes(eventType)) {
                applicable = true;
            }
            if (patterns && patterns.some(pattern => this.matchesPattern(rule.pattern, pattern))) {
                applicable = true;
            }
            if (tags && tags.some(tag => rule.tags.includes(tag))) {
                applicable = true;
            }
            if (applicable) {
                rules.push(rule);
            }
        }
        return rules.sort((a, b) => b.priority - a.priority);
    }
    async findKeysMatchingPattern(pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const matchingKeys = [];
        for (const key of this.keyAccessLog.keys()) {
            if (regex.test(key)) {
                matchingKeys.push(key);
            }
        }
        return matchingKeys;
    }
    async getCascadeKeys(baseKeys) {
        const cascadeKeys = [];
        for (const key of baseKeys) {
            const components = this.parseKey(key);
            if (!components)
                continue;
            if (components.entityType === 'query') {
                const resultPattern = `rslt:*:${components.identifier}*`;
                const relatedKeys = await this.findKeysMatchingPattern(resultPattern);
                cascadeKeys.push(...relatedKeys);
            }
            if (components.entityType === 'item') {
                const aggPattern = `agg:*`;
                const relatedKeys = await this.findKeysMatchingPattern(aggPattern);
                cascadeKeys.push(...relatedKeys);
            }
        }
        return cascadeKeys;
    }
    matchesPattern(rulePattern, testPattern) {
        const ruleRegex = new RegExp(rulePattern.replace(/\*/g, '.*'));
        return ruleRegex.test(testPattern);
    }
    updateMetrics() {
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
        this.keyMetrics.hotKeys = this.getHotKeys(10);
    }
    extractKeyPattern(key) {
        return key
            .replace(/:[a-f0-9]{8,}/g, ':*')
            .replace(/:\d+/g, ':*')
            .replace(/:u[a-z0-9]+/g, ':u*')
            .replace(/:f[a-z0-9]+/g, ':f*');
    }
    cleanupOldKeys() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        const keysToDelete = [];
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
exports.CacheKeyStrategy = CacheKeyStrategy;
exports.default = CacheKeyStrategy;
//# sourceMappingURL=CacheKeyStrategy.js.map