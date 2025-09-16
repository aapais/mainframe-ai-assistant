import { EventEmitter } from 'events';
import { CacheOrchestrator } from './CacheOrchestrator';
export interface InvalidationRule {
    id: string;
    name: string;
    enabled: boolean;
    pattern: string | RegExp;
    tags: string[];
    conditions?: {
        timeWindow?: number;
        maxAge?: number;
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
    ruleStats: Map<string, {
        triggered: number;
        lastTriggered: number;
        avgDuration: number;
    }>;
}
export declare class CacheInvalidationService extends EventEmitter {
    private cacheOrchestrator;
    private rules;
    private scheduledTasks;
    private metrics;
    private dependencyGraph;
    constructor(cacheOrchestrator: CacheOrchestrator);
    registerRule(rule: InvalidationRule): void;
    invalidateByPattern(pattern: string | RegExp, trigger?: string): Promise<InvalidationEvent>;
    invalidateByDependency(dependency: string): Promise<InvalidationEvent>;
    scheduleInvalidation(schedule: {
        pattern: string | RegExp;
        interval: number;
        tags: string[];
        name: string;
    }): void;
    invalidateExpired(): Promise<InvalidationEvent>;
    onDataChange(entity: string, operation: 'create' | 'update' | 'delete', data?: any): void;
    addDependency(parent: string, dependent: string): void;
    removeDependency(parent: string, dependent: string): void;
    getMetrics(): InvalidationMetrics;
    clearScheduledTasks(): void;
    private setupDefaultRules;
    private patternMatches;
    private updateRuleStats;
    private recordEvent;
}
//# sourceMappingURL=CacheInvalidationService.d.ts.map