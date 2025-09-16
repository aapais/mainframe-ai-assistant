import { CacheOrchestrator } from './CacheOrchestrator';
import { QueryCache } from './QueryCache';
export interface WarmingEntry {
    key: string;
    fetcher: () => Promise<any>;
    priority: number;
    ttl?: number;
    tags?: string[];
    schedule?: {
        interval?: number;
        cron?: string;
        onStartup?: boolean;
    };
    dependencies?: string[];
}
export interface WarmingStrategy {
    name: string;
    enabled: boolean;
    batchSize: number;
    concurrency: number;
    retryAttempts: number;
    retryDelay: number;
    entries: WarmingEntry[];
}
export interface WarmingMetrics {
    totalWarmed: number;
    successfulWarms: number;
    failedWarms: number;
    avgWarmingTime: number;
    lastWarmingTime: number;
    nextScheduledWarming: number;
    strategiesExecuted: string[];
}
export declare class CacheWarmingService {
    private cacheOrchestrator;
    private queryCache;
    private strategies;
    private scheduledTasks;
    private metrics;
    private isWarming;
    constructor(cacheOrchestrator: CacheOrchestrator, queryCache: QueryCache);
    registerStrategy(strategy: WarmingStrategy): void;
    registerPopularSearches(): void;
    registerKnowledgeBaseWarming(): void;
    registerUserPreferencesWarming(): void;
    warmAll(): Promise<void>;
    warmOnStartup(): Promise<void>;
    warmEntries(entries: WarmingEntry[], options?: {
        batchSize?: number;
        concurrency?: number;
    }): Promise<void>;
    getMetrics(): WarmingMetrics;
    stopScheduledWarming(): void;
    private executeStrategy;
    private warmEntry;
    private executeWithRetry;
    private scheduleStrategy;
    private getMaxPriority;
    private chunkArray;
    private updateAverageWarmingTime;
    private sleep;
    private fetchPopularSearch;
    private fetchKbCategories;
    private fetchRecentEntries;
    private fetchPopularTags;
    private fetchDefaultSettings;
    private fetchAvailableThemes;
}
//# sourceMappingURL=CacheWarmingService.d.ts.map