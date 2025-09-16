"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchService = exports.SearchIntegration = void 0;
const AdvancedSearchEngine_1 = require("./search/AdvancedSearchEngine");
const MultiLayerCacheManager_1 = require("../caching/MultiLayerCacheManager");
const CacheWarmingEngine_1 = require("../caching/CacheWarmingEngine");
const MonitoringOrchestrator_1 = require("../monitoring/MonitoringOrchestrator");
const KnowledgeDB_1 = require("../database/KnowledgeDB");
const GeminiService_1 = require("./GeminiService");
class SearchIntegration {
    searchEngine;
    cacheManager;
    warmingEngine;
    monitor;
    knowledgeDB;
    geminiService;
    isInitialized = false;
    constructor(config) {
        this.knowledgeDB = new KnowledgeDB_1.KnowledgeDB();
        if (config?.geminiApiKey) {
            this.geminiService = new GeminiService_1.GeminiService({
                apiKey: config.geminiApiKey,
                model: 'gemini-pro',
                temperature: 0.3
            });
        }
        this.searchEngine = new AdvancedSearchEngine_1.AdvancedSearchEngine({
            rankingAlgorithm: 'bm25',
            cacheEnabled: config?.cacheEnabled !== false,
            fuzzyMatchingEnabled: true,
            semanticSearchEnabled: !!this.geminiService,
            performance: {
                searchTimeout: config?.performanceTargets?.maxResponseTime || 800,
                maxConcurrentSearches: 10,
                circuitBreakerThreshold: 0.5
            }
        });
        this.cacheManager = new MultiLayerCacheManager_1.MultiLayerCacheManager({
            l1Config: {
                maxSize: 1000,
                ttl: 300000,
                algorithm: 'lru'
            },
            l2Config: {
                maxSize: 10000,
                ttl: 3600000,
                persistent: true
            },
            l3Config: {
                enabled: true,
                path: './cache/search',
                maxSize: 100000
            }
        });
        this.warmingEngine = new CacheWarmingEngine_1.CacheWarmingEngine(this.cacheManager, {
            predictive: true,
            preemptive: true,
            scheduled: true
        });
        this.monitor = new MonitoringOrchestrator_1.MonitoringOrchestrator({
            enabledComponents: config?.monitoringEnabled !== false ? [
                'performance',
                'dashboard',
                'alerting',
                'logging',
                'profiling'
            ] : [],
            performanceTargets: {
                responseTime: config?.performanceTargets?.maxResponseTime || 1000,
                cacheHitRate: config?.performanceTargets?.minCacheHitRate || 0.8,
                errorRate: config?.performanceTargets?.maxErrorRate || 0.01
            }
        });
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            const entries = await this.knowledgeDB.getAllEntries();
            await this.searchEngine.initialize(entries);
            await this.warmingEngine.initialize();
            const popularQueries = await this.knowledgeDB.getPopularQueries(20);
            for (const query of popularQueries) {
                await this.warmingEngine.warmQuery(query.query_text);
            }
            await this.monitor.start();
            this.isInitialized = true;
            console.log('✅ Search Integration initialized successfully');
            console.log(`  - ${entries.length} KB entries indexed`);
            console.log(`  - Cache warming completed for ${popularQueries.length} queries`);
            console.log('  - Monitoring active');
            console.log('  - <1s response time guarantee enabled');
        }
        catch (error) {
            console.error('❌ Failed to initialize Search Integration:', error);
            throw error;
        }
    }
    async search(query, options) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const startTime = performance.now();
        const searchId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        try {
            this.monitor.recordSearchStart(searchId);
            const cacheKey = this.generateCacheKey(query, options);
            const cachedResult = await this.cacheManager.get(cacheKey);
            if (cachedResult) {
                const responseTime = performance.now() - startTime;
                this.monitor.recordSearchComplete(searchId, {
                    responseTime,
                    resultCount: cachedResult.results.length,
                    cacheHit: true,
                    searchType: 'cached'
                });
                return {
                    results: cachedResult.results,
                    metrics: {
                        responseTime,
                        totalResults: cachedResult.results.length,
                        cacheHit: true,
                        searchType: 'cached'
                    }
                };
            }
            let results;
            let searchType = 'standard';
            if (options?.semantic && this.geminiService) {
                searchType = 'semantic';
                results = await this.performSemanticSearch(query, options);
            }
            else if (options?.fuzzy) {
                searchType = 'fuzzy';
                results = await this.searchEngine.search(query, {
                    ...options,
                    fuzzyThreshold: 0.7
                });
            }
            else {
                results = await this.searchEngine.search(query, options);
            }
            if (options?.filters) {
                results = this.applyFilters(results, options.filters);
            }
            if (options?.sortBy) {
                results = this.sortResults(results, options.sortBy);
            }
            const limitedResults = results.slice(0, options?.limit || 20);
            await this.cacheManager.set(cacheKey, {
                results: limitedResults,
                timestamp: Date.now()
            }, 300000);
            const responseTime = performance.now() - startTime;
            this.monitor.recordSearchComplete(searchId, {
                responseTime,
                resultCount: limitedResults.length,
                cacheHit: false,
                searchType
            });
            if (responseTime > 1000) {
                console.warn(`⚠️ Search exceeded 1s target: ${responseTime.toFixed(0)}ms`);
                this.monitor.triggerAlert('slow_search', {
                    query,
                    responseTime,
                    searchType
                });
            }
            return {
                results: limitedResults,
                metrics: {
                    responseTime,
                    totalResults: results.length,
                    cacheHit: false,
                    searchType
                }
            };
        }
        catch (error) {
            const responseTime = performance.now() - startTime;
            this.monitor.recordSearchError(searchId, error);
            console.error('Search error, falling back to basic search:', error);
            const fallbackResults = await this.knowledgeDB.search(query, options?.limit || 20);
            return {
                results: fallbackResults,
                metrics: {
                    responseTime,
                    totalResults: fallbackResults.length,
                    cacheHit: false,
                    searchType: 'fallback'
                }
            };
        }
    }
    async performSemanticSearch(query, options) {
        if (!this.geminiService) {
            throw new Error('Gemini service not initialized');
        }
        const allEntries = await this.knowledgeDB.getAllEntries();
        const semanticResults = await this.geminiService.findSimilar(query, allEntries);
        const standardResults = await this.searchEngine.search(query, options);
        const mergedResults = this.mergeSearchResults(semanticResults, standardResults);
        return mergedResults;
    }
    applyFilters(results, filters) {
        return results.filter(result => {
            if (filters.category && result.category !== filters.category) {
                return false;
            }
            if (filters.tags && filters.tags.length > 0) {
                const resultTags = result.tags || [];
                if (!filters.tags.some((tag) => resultTags.includes(tag))) {
                    return false;
                }
            }
            if (filters.dateRange) {
                const resultDate = new Date(result.updated_at || result.created_at);
                if (resultDate < filters.dateRange.start || resultDate > filters.dateRange.end) {
                    return false;
                }
            }
            return true;
        });
    }
    sortResults(results, sortBy) {
        const sorted = [...results];
        switch (sortBy) {
            case 'date':
                return sorted.sort((a, b) => {
                    const dateA = new Date(a.updated_at || a.created_at).getTime();
                    const dateB = new Date(b.updated_at || b.created_at).getTime();
                    return dateB - dateA;
                });
            case 'popularity':
                return sorted.sort((a, b) => {
                    const popA = (a.usage_count || 0) * (a.success_rate || 0);
                    const popB = (b.usage_count || 0) * (b.success_rate || 0);
                    return popB - popA;
                });
            case 'relevance':
            default:
                return sorted;
        }
    }
    mergeSearchResults(semantic, standard) {
        const merged = new Map();
        semantic.forEach(result => {
            merged.set(result.id, {
                ...result,
                score: (result.score || 0) * 1.2
            });
        });
        standard.forEach(result => {
            if (!merged.has(result.id)) {
                merged.set(result.id, result);
            }
            else {
                const existing = merged.get(result.id);
                merged.set(result.id, {
                    ...existing,
                    score: (existing.score + result.score) / 2
                });
            }
        });
        return Array.from(merged.values()).sort((a, b) => b.score - a.score);
    }
    generateCacheKey(query, options) {
        const normalized = query.toLowerCase().trim();
        const optionsStr = options ? JSON.stringify(options) : '';
        return `search:${normalized}:${optionsStr}`;
    }
    async getSuggestions(prefix, limit = 10) {
        const cacheKey = `suggest:${prefix.toLowerCase()}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached)
            return cached;
        const suggestions = await this.searchEngine.getSuggestions(prefix);
        await this.cacheManager.set(cacheKey, suggestions.slice(0, limit), 60000);
        return suggestions.slice(0, limit);
    }
    async getAnalytics() {
        return {
            performance: await this.monitor.getPerformanceMetrics(),
            cache: await this.cacheManager.getStatistics(),
            popular: await this.knowledgeDB.getPopularQueries(10),
            metrics: await this.monitor.getBusinessMetrics()
        };
    }
    async warmCache() {
        await this.warmingEngine.warmCache();
    }
    async healthCheck() {
        const checks = await Promise.all([
            this.searchEngine.healthCheck(),
            this.cacheManager.healthCheck(),
            this.monitor.healthCheck()
        ]);
        const allHealthy = checks.every(c => c.status === 'healthy');
        const anyUnhealthy = checks.some(c => c.status === 'unhealthy');
        return {
            status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
            details: {
                searchEngine: checks[0],
                cache: checks[1],
                monitoring: checks[2]
            }
        };
    }
    async shutdown() {
        await this.monitor.stop();
        await this.warmingEngine.stop();
        await this.cacheManager.flush();
        await this.knowledgeDB.close();
        this.isInitialized = false;
        console.log('Search Integration shut down gracefully');
    }
}
exports.SearchIntegration = SearchIntegration;
exports.searchService = new SearchIntegration({
    geminiApiKey: process.env.GEMINI_API_KEY,
    cacheEnabled: true,
    monitoringEnabled: true,
    performanceTargets: {
        maxResponseTime: 1000,
        minCacheHitRate: 0.8,
        maxErrorRate: 0.01
    }
});
//# sourceMappingURL=SearchIntegration.js.map