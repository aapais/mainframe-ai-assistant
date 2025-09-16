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
    hotKeys: Array<{
        key: string;
        hitCount: number;
        lastAccessed: number;
    }>;
}
export declare class CacheKeyStrategy extends EventEmitter {
    private namespaces;
    private invalidationRules;
    private keyMetrics;
    private keyAccessLog;
    constructor();
    generateKey(components: CacheKeyComponents): string;
    generateSearchKey(query: string, options?: Record<string, any>, userContext?: string): string;
    generateResultKey(resultId: string, version?: string, userContext?: string): string;
    generateIndexKey(indexName: string, segment: string, version?: string): string;
    generateAggregationKey(aggregationType: string, parameters: Record<string, any>, timeWindow?: string): string;
    generateUserKey(userId: string, dataType: string, identifier: string): string;
    generateTempKey(operation: string, sessionId: string, identifier: string): string;
    parseKey(key: string): Partial<CacheKeyComponents> | null;
    invalidate(patterns?: string[], tags?: string[], eventType?: string): Promise<{
        invalidatedKeys: string[];
        rulesApplied: string[];
    }>;
    addInvalidationRule(rule: InvalidationRule): void;
    removeInvalidationRule(ruleId: string): boolean;
    registerNamespace(namespace: CacheNamespace): void;
    getMetrics(): KeyMetrics;
    getHotKeys(limit?: number): Array<{
        key: string;
        hitCount: number;
        lastAccessed: number;
    }>;
    analyzeKeyPatterns(): {
        suggestions: string[];
        longKeys: string[];
        collisions: Array<{
            pattern: string;
            count: number;
        }>;
        namespaceStats: Record<string, {
            count: number;
            averageLength: number;
        }>;
    };
    private initializeDefaultNamespaces;
    private initializeDefaultInvalidationRules;
    private normalizeIdentifier;
    private hashUserContext;
    private hashFilters;
    private trackKeyUsage;
    private findApplicableRules;
    private findKeysMatchingPattern;
    private getCascadeKeys;
    private matchesPattern;
    private updateMetrics;
    private extractKeyPattern;
    private cleanupOldKeys;
}
export default CacheKeyStrategy;
//# sourceMappingURL=CacheKeyStrategy.d.ts.map