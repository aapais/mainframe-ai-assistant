export declare class SearchIntegration {
    private searchEngine;
    private cacheManager;
    private warmingEngine;
    private monitor;
    private knowledgeDB;
    private geminiService?;
    private isInitialized;
    constructor(config?: {
        geminiApiKey?: string;
        cacheEnabled?: boolean;
        monitoringEnabled?: boolean;
        performanceTargets?: {
            maxResponseTime?: number;
            minCacheHitRate?: number;
            maxErrorRate?: number;
        };
    });
    initialize(): Promise<void>;
    search(query: string, options?: {
        limit?: number;
        fuzzy?: boolean;
        semantic?: boolean;
        filters?: {
            category?: string;
            tags?: string[];
            dateRange?: {
                start: Date;
                end: Date;
            };
        };
        sortBy?: 'relevance' | 'date' | 'popularity';
    }): Promise<{
        results: any[];
        metrics: {
            responseTime: number;
            totalResults: number;
            cacheHit: boolean;
            searchType: string;
        };
    }>;
    private performSemanticSearch;
    private applyFilters;
    private sortResults;
    private mergeSearchResults;
    private generateCacheKey;
    getSuggestions(prefix: string, limit?: number): Promise<string[]>;
    getAnalytics(): Promise<any>;
    warmCache(): Promise<void>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }>;
    shutdown(): Promise<void>;
}
export declare const searchService: SearchIntegration;
//# sourceMappingURL=SearchIntegration.d.ts.map