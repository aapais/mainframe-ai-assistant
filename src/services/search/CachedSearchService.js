"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachedSearchService = void 0;
const tslib_1 = require("tslib");
const services_1 = require("../../types/services");
const AdvancedSearchEngine_1 = tslib_1.__importDefault(require("./AdvancedSearchEngine"));
const CacheService_1 = require("../CacheService");
const SearchCache_1 = require("./SearchCache");
const CacheSystemIntegration_1 = require("../../caching/CacheSystemIntegration");
class CachedSearchService {
    searchEngine;
    cacheSystem;
    searchCache;
    cacheService;
    config;
    metrics;
    analytics;
    isInitialized = false;
    queryQueue = new Map();
    warmingInProgress = false;
    metricsInterval;
    queryHistory = [];
    constructor(config) {
        this.config = this.mergeConfig(config);
        this.initializeMetrics();
        this.initializeAnalytics();
    }
    async initialize(entries) {
        const startTime = Date.now();
        try {
            console.log('🚀 Initializing cached search service...');
            this.searchEngine = new AdvancedSearchEngine_1.default(this.config);
            await this.searchEngine.initialize(entries);
            await this.initializeCacheSystem();
            if (this.config.cache.monitoring.enabled) {
                this.setupMetricsCollection();
            }
            if (this.config.cache.warming.enabled) {
                await this.performInitialWarming(entries);
            }
            this.isInitialized = true;
            const initTime = Date.now() - startTime;
            console.log(`✅ Cached search service initialized in ${initTime}ms`);
        }
        catch (error) {
            throw new services_1.ServiceError(`Failed to initialize cached search service: ${error.message}`, 'CACHED_SEARCH_INIT_ERROR', 500, { originalError: error });
        }
    }
    async search(query, options = {}, context = {}) {
        this.validateInitialization();
        const startTime = Date.now();
        const normalizedQuery = this.normalizeQuery(query);
        const cacheKey = this.generateCacheKey(normalizedQuery, options, context);
        try {
            if (this.queryQueue.has(cacheKey)) {
                return await this.queryQueue.get(cacheKey);
            }
            const searchPromise = this.executeSearch(normalizedQuery, options, context, cacheKey);
            this.queryQueue.set(cacheKey, searchPromise);
            const result = await searchPromise;
            this.recordQueryMetrics(query, startTime, result, context);
            return result;
        }
        catch (error) {
            this.recordErrorMetrics(query, startTime, error);
            throw error;
        }
        finally {
            this.queryQueue.delete(cacheKey);
        }
    }
    async batchSearch(queries) {
        this.validateInitialization();
        const batchSize = this.config.optimization.batchSize;
        const results = [];
        for (let i = 0; i < queries.length; i += batchSize) {
            const batch = queries.slice(i, i + batchSize);
            const batchPromises = batch.map(({ query, options, context }) => this.search(query, options, context));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        return results;
    }
    async suggest(prefix, limit = 10, context) {
        this.validateInitialization();
        const cacheKey = `suggestions:${prefix}:${limit}`;
        try {
            const cached = await this.cacheSystem.get(cacheKey, () => this.searchEngine.suggest(prefix, limit), {
                ttl: 5 * 60 * 1000,
                priority: 'normal',
                tags: ['suggestions', 'autocomplete'],
                category: 'suggestions'
            });
            return cached;
        }
        catch (error) {
            console.warn('Suggestion cache failed, falling back to direct call:', error);
            return await this.searchEngine.suggest(prefix, limit);
        }
    }
    async correct(query, context) {
        this.validateInitialization();
        const cacheKey = `corrections:${query}`;
        try {
            const cached = await this.cacheSystem.get(cacheKey, () => this.searchEngine.correct(query), {
                ttl: 30 * 60 * 1000,
                priority: 'low',
                tags: ['corrections', 'spellcheck'],
                category: 'corrections'
            });
            return cached;
        }
        catch (error) {
            console.warn('Correction cache failed, falling back to direct call:', error);
            return await this.searchEngine.correct(query);
        }
    }
    async warmCache(strategy = 'all') {
        this.validateInitialization();
        if (this.warmingInProgress) {
            console.log('Cache warming already in progress, skipping');
            return { warmed: 0, timeSaved: 0 };
        }
        this.warmingInProgress = true;
        try {
            console.log(`🔥 Starting cache warming with strategy: ${strategy}`);
            let totalWarmed = 0;
            let totalTimeSaved = 0;
            if (strategy === 'popular' || strategy === 'all') {
                const { warmed, timeSaved } = await this.warmPopularQueries();
                totalWarmed += warmed;
                totalTimeSaved += timeSaved;
            }
            if (strategy === 'recent' || strategy === 'all') {
                const { warmed, timeSaved } = await this.warmRecentQueries();
                totalWarmed += warmed;
                totalTimeSaved += timeSaved;
            }
            if (strategy === 'predictive' || strategy === 'all') {
                const { warmed, timeSaved } = await this.warmPredictiveQueries();
                totalWarmed += warmed;
                totalTimeSaved += timeSaved;
            }
            this.metrics.operations.warmingOperations++;
            console.log(`✅ Cache warming completed: ${totalWarmed} entries, ${totalTimeSaved}ms saved`);
            return { warmed: totalWarmed, timeSaved: totalTimeSaved };
        }
        finally {
            this.warmingInProgress = false;
        }
    }
    async invalidateCache(pattern, tags, reason) {
        this.validateInitialization();
        try {
            console.log(`🗑️ Invalidating cache: pattern=${pattern}, tags=${tags?.join(',')}, reason=${reason}`);
            let invalidated = 0;
            let cascaded = 0;
            if (pattern) {
                invalidated += await this.cacheSystem.invalidateCache(pattern, tags, reason);
            }
            if (tags && this.config.cache.invalidation.smartCascade) {
                const relatedTags = this.getRelatedTags(tags);
                for (const relatedTag of relatedTags) {
                    cascaded += await this.cacheSystem.invalidateCache(undefined, [relatedTag], 'cascade');
                }
            }
            if (invalidated > 10) {
                setTimeout(() => {
                    this.warmCache('popular').catch(error => {
                        console.error('Post-invalidation warming failed:', error);
                    });
                }, 2000);
            }
            console.log(`✅ Cache invalidation completed: ${invalidated} direct, ${cascaded} cascaded`);
            return { invalidated, cascaded };
        }
        catch (error) {
            console.error('Cache invalidation failed:', error);
            throw new services_1.ServiceError(`Cache invalidation failed: ${error.message}`, 'CACHE_INVALIDATION_ERROR', 500, { pattern, tags, reason, originalError: error });
        }
    }
    async addDocument(entry) {
        this.validateInitialization();
        try {
            await this.searchEngine.addDocument(entry);
            await this.invalidateRelatedCache(entry);
            console.log(`📄 Document added and cache updated: ${entry.id}`);
        }
        catch (error) {
            throw new services_1.ServiceError(`Failed to add document: ${error.message}`, 'DOCUMENT_ADD_ERROR', 500, { entryId: entry.id, originalError: error });
        }
    }
    async removeDocument(docId) {
        this.validateInitialization();
        try {
            const removed = await this.searchEngine.removeDocument(docId);
            if (removed) {
                await this.cacheSystem.invalidateCache(`*${docId}*`, undefined, 'document-removed');
                console.log(`🗑️ Document removed and cache updated: ${docId}`);
            }
            return removed;
        }
        catch (error) {
            throw new services_1.ServiceError(`Failed to remove document: ${error.message}`, 'DOCUMENT_REMOVE_ERROR', 500, { docId, originalError: error });
        }
    }
    getMetrics() {
        this.updateMetrics();
        return { ...this.metrics };
    }
    getAnalytics() {
        this.updateAnalytics();
        return { ...this.analytics };
    }
    getHealthStatus() {
        const issues = [];
        const recommendations = [];
        if (this.metrics.hitRates.overall < this.config.cache.monitoring.alertThresholds.hitRate) {
            issues.push(`Low cache hit rate: ${(this.metrics.hitRates.overall * 100).toFixed(1)}%`);
            recommendations.push('Consider cache warming or increasing TTL values');
        }
        if (this.metrics.performance.avgResponseTime > this.config.cache.monitoring.alertThresholds.responseTime) {
            issues.push(`High response time: ${this.metrics.performance.avgResponseTime}ms`);
            recommendations.push('Check query optimization and cache performance');
        }
        const errorRate = this.metrics.operations.errors / Math.max(this.metrics.operations.totalQueries, 1);
        if (errorRate > this.config.cache.monitoring.alertThresholds.errorRate) {
            issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
            recommendations.push('Investigate error patterns and system stability');
        }
        if (this.metrics.storage.memoryPressure > 0.9) {
            issues.push('High memory pressure');
            recommendations.push('Consider increasing cache size or optimizing eviction policies');
        }
        const status = issues.length === 0 ? 'healthy' :
            issues.length <= 2 ? 'degraded' : 'critical';
        return {
            status,
            issues,
            recommendations,
            uptime: Date.now() - this.metrics.startTime || 0
        };
    }
    async optimizeConfiguration() {
        this.validateInitialization();
        const changes = [];
        const analytics = this.getAnalytics();
        const avgQueryFrequency = analytics.popularQueries.reduce((sum, q) => sum + q.count, 0) / analytics.popularQueries.length;
        if (avgQueryFrequency > 10) {
            changes.push('Increase TTL for L1 cache from 1min to 5min');
            changes.push('Increase TTL for popular queries from 10min to 30min');
        }
        if (this.metrics.hitRates.l1 < 0.8) {
            changes.push('Increase L1 cache size by 50%');
        }
        if (this.metrics.hitRates.l2 < 0.6) {
            changes.push('Increase L2 cache size by 25%');
        }
        if (this.metrics.performance.avgResponseTime > 500) {
            changes.push('Enable aggressive cache warming');
            changes.push('Increase cache warming frequency');
        }
        const expectedImprovement = changes.length > 0 ?
            'Expected 15-30% improvement in response time and 10-20% improvement in hit rate' :
            'System is already optimally configured';
        return { changes, expectedImprovement };
    }
    async shutdown() {
        if (!this.isInitialized)
            return;
        console.log('🔄 Shutting down cached search service...');
        try {
            if (this.metricsInterval) {
                clearInterval(this.metricsInterval);
            }
            await this.warmCache('popular');
            await this.cacheSystem.shutdown();
            await this.searchEngine.shutdown();
            this.isInitialized = false;
            console.log('✅ Cached search service shutdown completed');
        }
        catch (error) {
            console.error('❌ Error during shutdown:', error);
        }
    }
    mergeConfig(config) {
        return {
            maxResults: 100,
            defaultTimeout: 1000,
            cacheEnabled: true,
            fuzzyEnabled: true,
            rankingAlgorithm: 'bm25',
            performance: {
                indexingBatchSize: 1000,
                searchTimeout: 800,
                maxConcurrentSearches: 20,
                memoryThreshold: 512 * 1024 * 1024,
                optimizationLevel: 'balanced'
            },
            features: {
                semanticSearch: true,
                autoComplete: true,
                spellCorrection: true,
                queryExpansion: false,
                resultClustering: false,
                personalizedRanking: true
            },
            cache: {
                enabled: true,
                layers: {
                    l1: { size: 1000, ttl: 60 * 1000 },
                    l2: { size: 5000, ttl: 10 * 60 * 1000 },
                    l3: { size: 20000, ttl: 60 * 60 * 1000 }
                },
                warming: {
                    enabled: true,
                    strategies: ['popular', 'recent'],
                    schedule: '0 */15 * * * *'
                },
                invalidation: {
                    enabled: true,
                    smartCascade: true,
                    maxBatchSize: 1000
                },
                monitoring: {
                    enabled: true,
                    metricsInterval: 30000,
                    alertThresholds: {
                        hitRate: 0.7,
                        responseTime: 1000,
                        errorRate: 0.05
                    }
                }
            },
            optimization: {
                batchSize: 50,
                maxConcurrentQueries: 10,
                queryNormalization: true,
                resultDeduplication: true,
                asyncProcessing: true
            },
            ...config
        };
    }
    initializeMetrics() {
        this.metrics = {
            hitRates: { overall: 0, l1: 0, l2: 0, l3: 0 },
            performance: {
                avgResponseTime: 0,
                cacheResponseTime: 0,
                computeResponseTime: 0,
                throughput: 0
            },
            storage: {
                totalSize: 0,
                utilizationPercent: 0,
                evictions: 0,
                memoryPressure: 0
            },
            operations: {
                totalQueries: 0,
                cacheHits: 0,
                cacheMisses: 0,
                errors: 0,
                warmingOperations: 0
            }
        };
        this.metrics.startTime = Date.now();
    }
    initializeAnalytics() {
        this.analytics = {
            popularQueries: [],
            performancePatterns: {
                timeOfDay: {},
                queryLength: {},
                resultSize: {}
            },
            userBehavior: {
                queryPatterns: [],
                sessionDuration: 0,
                repeatQueries: 0
            },
            recommendations: {
                cacheOptimizations: [],
                performanceImprovements: [],
                capacityPlanning: []
            }
        };
    }
    async initializeCacheSystem() {
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');
        this.cacheSystem = new CacheSystemIntegration_1.CacheSystemIntegration(db, {
            mvpLevel: 3,
            enableDistributedCache: false,
            enablePredictiveWarming: true,
            enableSmartInvalidation: true,
            enablePerformanceMonitoring: true
        });
        await this.cacheSystem.initialize();
        this.searchCache = new SearchCache_1.SearchCache({
            maxSize: 100 * 1024 * 1024,
            defaultTTL: this.config.cache.layers.l2.ttl,
            layers: [
                {
                    name: 'l1',
                    maxSize: this.config.cache.layers.l1.size,
                    ttl: this.config.cache.layers.l1.ttl,
                    strategy: 'lfu',
                    enabled: true
                },
                {
                    name: 'l2',
                    maxSize: this.config.cache.layers.l2.size,
                    ttl: this.config.cache.layers.l2.ttl,
                    strategy: 'lru',
                    enabled: true
                }
            ]
        });
        this.cacheService = new CacheService_1.CacheService({
            maxSize: this.config.cache.layers.l3.size,
            defaultTTL: this.config.cache.layers.l3.ttl,
            checkPeriod: 60000
        });
    }
    validateInitialization() {
        if (!this.isInitialized) {
            throw new services_1.ServiceError('Cached search service not initialized', 'SERVICE_NOT_INITIALIZED', 500);
        }
    }
    normalizeQuery(query) {
        if (!this.config.optimization.queryNormalization) {
            return query;
        }
        return query
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '');
    }
    generateCacheKey(query, options, context) {
        const keyParts = [
            'search',
            query,
            options.limit || 'default',
            options.category || 'all',
            options.sortBy || 'relevance',
            options.useAI ? 'ai' : 'standard',
            context.userId || 'anonymous'
        ];
        return keyParts.join(':');
    }
    async executeSearch(query, options, context, cacheKey) {
        try {
            const cached = await this.cacheSystem.get(cacheKey, () => this.searchEngine.search(query, options, context), {
                ttl: this.getTTLForQuery(query),
                priority: this.getPriorityForQuery(query, options),
                tags: this.getTagsForQuery(query, options),
                userContext: context.userId,
                category: 'search'
            });
            return cached;
        }
        catch (error) {
            console.warn('Cache failed, falling back to direct search:', error);
            return await this.searchEngine.search(query, options, context);
        }
    }
    getTTLForQuery(query) {
        const words = query.split(' ');
        if (words.length === 1 && words[0].length < 4) {
            return this.config.cache.layers.l1.ttl;
        }
        if (words.length > 5) {
            return this.config.cache.layers.l3.ttl;
        }
        return this.config.cache.layers.l2.ttl;
    }
    getPriorityForQuery(query, options) {
        if (options.useAI)
            return 'high';
        if (query.length < 3)
            return 'low';
        if (options.category && options.category !== 'Other')
            return 'normal';
        return 'normal';
    }
    getTagsForQuery(query, options) {
        const tags = ['search'];
        if (options.category)
            tags.push(`category:${options.category}`);
        if (options.useAI)
            tags.push('ai-enhanced');
        if (query.length < 5)
            tags.push('short-query');
        if (query.length > 20)
            tags.push('long-query');
        return tags;
    }
    recordQueryMetrics(query, startTime, result, context) {
        const responseTime = Date.now() - startTime;
        const cacheHit = result.metrics.cacheHit;
        this.metrics.operations.totalQueries++;
        if (cacheHit) {
            this.metrics.operations.cacheHits++;
        }
        else {
            this.metrics.operations.cacheMisses++;
        }
        this.metrics.hitRates.overall =
            this.metrics.operations.cacheHits / this.metrics.operations.totalQueries;
        const totalResponseTime = this.metrics.performance.avgResponseTime * (this.metrics.operations.totalQueries - 1);
        this.metrics.performance.avgResponseTime =
            (totalResponseTime + responseTime) / this.metrics.operations.totalQueries;
        if (cacheHit) {
            this.metrics.performance.cacheResponseTime =
                (this.metrics.performance.cacheResponseTime + responseTime) / 2;
        }
        else {
            this.metrics.performance.computeResponseTime =
                (this.metrics.performance.computeResponseTime + responseTime) / 2;
        }
        this.queryHistory.push({
            query,
            timestamp: Date.now(),
            responseTime,
            cacheHit,
            resultCount: result.results.length,
            userId: context.userId
        });
        if (this.queryHistory.length > 1000) {
            this.queryHistory = this.queryHistory.slice(-1000);
        }
    }
    recordErrorMetrics(query, startTime, error) {
        this.metrics.operations.totalQueries++;
        this.metrics.operations.errors++;
        console.error(`Search error for query "${query}":`, error);
    }
    setupMetricsCollection() {
        this.metricsInterval = setInterval(() => {
            this.updateMetrics();
            this.updateAnalytics();
            const health = this.getHealthStatus();
            if (health.status === 'critical') {
                console.warn('🚨 Cache system health critical:', health.issues);
            }
        }, this.config.cache.monitoring.metricsInterval);
    }
    updateMetrics() {
        const cacheStats = this.cacheSystem.getSystemStats();
        this.metrics.hitRates.l1 = cacheStats.layers.hot.hitRate;
        this.metrics.hitRates.l2 = cacheStats.layers.warm.hitRate;
        this.metrics.hitRates.l3 = cacheStats.layers.persistent.hitRate;
        this.metrics.performance.throughput =
            this.metrics.operations.totalQueries /
                Math.max(1, (Date.now() - this.metrics.startTime) / 1000 / 60);
        const searchCacheStats = this.searchCache.getStats();
        this.metrics.storage.totalSize = searchCacheStats.memoryUsage;
        this.metrics.storage.evictions = searchCacheStats.evictions;
        this.metrics.storage.utilizationPercent = searchCacheStats.memoryUsage / (100 * 1024 * 1024);
    }
    updateAnalytics() {
        const queryFrequency = new Map();
        for (const query of this.queryHistory) {
            const current = queryFrequency.get(query.query) || { count: 0, totalTime: 0 };
            queryFrequency.set(query.query, {
                count: current.count + 1,
                totalTime: current.totalTime + query.responseTime
            });
        }
        this.analytics.popularQueries = Array.from(queryFrequency.entries())
            .map(([query, stats]) => ({
            query,
            count: stats.count,
            avgTime: stats.totalTime / stats.count
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
        this.updatePerformancePatterns();
        this.updateRecommendations();
    }
    updatePerformancePatterns() {
        const timeOfDay = {};
        const queryLength = {};
        const resultSize = {};
        for (const query of this.queryHistory) {
            const hour = new Date(query.timestamp).getHours();
            const hourKey = `${hour}:00`;
            timeOfDay[hourKey] = (timeOfDay[hourKey] || 0) + 1;
            const lengthBucket = query.query.length < 10 ? 'short' :
                query.query.length < 30 ? 'medium' : 'long';
            queryLength[lengthBucket] = (queryLength[lengthBucket] || 0) + 1;
            const sizeBucket = query.resultCount < 5 ? 'few' :
                query.resultCount < 20 ? 'moderate' : 'many';
            resultSize[sizeBucket] = (resultSize[sizeBucket] || 0) + 1;
        }
        this.analytics.performancePatterns = { timeOfDay, queryLength, resultSize };
    }
    updateRecommendations() {
        const recommendations = {
            cacheOptimizations: [],
            performanceImprovements: [],
            capacityPlanning: []
        };
        if (this.metrics.hitRates.overall < 0.8) {
            recommendations.cacheOptimizations.push('Increase cache TTL for popular queries');
            recommendations.cacheOptimizations.push('Enable more aggressive cache warming');
        }
        if (this.metrics.hitRates.l1 < 0.7) {
            recommendations.cacheOptimizations.push('Increase L1 cache size');
        }
        if (this.metrics.performance.avgResponseTime > 500) {
            recommendations.performanceImprovements.push('Optimize query processing pipeline');
            recommendations.performanceImprovements.push('Consider query result pre-computation');
        }
        if (this.metrics.performance.throughput < 100) {
            recommendations.performanceImprovements.push('Increase concurrent query limit');
            recommendations.performanceImprovements.push('Optimize database connection pooling');
        }
        if (this.metrics.storage.utilizationPercent > 0.8) {
            recommendations.capacityPlanning.push('Plan for cache storage expansion');
            recommendations.capacityPlanning.push('Review cache eviction policies');
        }
        this.analytics.recommendations = recommendations;
    }
    async performInitialWarming(entries) {
        console.log('🔥 Performing initial cache warming...');
        try {
            const commonTerms = this.extractCommonTerms(entries);
            for (const term of commonTerms.slice(0, 20)) {
                try {
                    await this.search(term, { limit: 10 }, {});
                }
                catch (error) {
                    console.warn(`Initial warming failed for term "${term}":`, error);
                }
            }
            console.log(`✅ Initial warming completed for ${commonTerms.length} terms`);
        }
        catch (error) {
            console.warn('Initial cache warming failed:', error);
        }
    }
    extractCommonTerms(entries) {
        const termFrequency = new Map();
        for (const entry of entries) {
            const text = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
            const words = text.match(/\b\w{3,}\b/g) || [];
            for (const word of words) {
                termFrequency.set(word, (termFrequency.get(word) || 0) + 1);
            }
        }
        return Array.from(termFrequency.entries())
            .filter(([_, count]) => count >= 3)
            .sort((a, b) => b[1] - a[1])
            .map(([term]) => term)
            .slice(0, 50);
    }
    async warmPopularQueries() {
        const popularQueries = this.analytics.popularQueries.slice(0, 10);
        let warmed = 0;
        let timeSaved = 0;
        for (const { query, avgTime } of popularQueries) {
            try {
                const startTime = Date.now();
                await this.search(query, { limit: 20 }, {});
                const warmTime = Date.now() - startTime;
                warmed++;
                timeSaved += Math.max(0, avgTime - warmTime);
            }
            catch (error) {
                console.warn(`Failed to warm popular query "${query}":`, error);
            }
        }
        return { warmed, timeSaved };
    }
    async warmRecentQueries() {
        const recentQueries = this.queryHistory
            .slice(-20)
            .map(q => q.query)
            .filter((query, index, array) => array.indexOf(query) === index);
        let warmed = 0;
        let timeSaved = 0;
        for (const query of recentQueries) {
            try {
                const startTime = Date.now();
                await this.search(query, { limit: 10 }, {});
                const warmTime = Date.now() - startTime;
                warmed++;
                timeSaved += Math.max(0, 200 - warmTime);
            }
            catch (error) {
                console.warn(`Failed to warm recent query "${query}":`, error);
            }
        }
        return { warmed, timeSaved };
    }
    async warmPredictiveQueries() {
        const queryPatterns = this.extractQueryPatterns();
        let warmed = 0;
        let timeSaved = 0;
        for (const pattern of queryPatterns.slice(0, 5)) {
            try {
                const startTime = Date.now();
                await this.search(pattern, { limit: 15 }, {});
                const warmTime = Date.now() - startTime;
                warmed++;
                timeSaved += Math.max(0, 300 - warmTime);
            }
            catch (error) {
                console.warn(`Failed to warm predictive query "${pattern}":`, error);
            }
        }
        return { warmed, timeSaved };
    }
    extractQueryPatterns() {
        const patterns = new Set();
        for (const query of this.queryHistory.map(q => q.query)) {
            const words = query.split(' ');
            if (words.length > 1) {
                patterns.add(words.slice(0, -1).join(' '));
            }
            for (const word of words) {
                if (word.length > 3) {
                    patterns.add(word);
                }
            }
        }
        return Array.from(patterns).slice(0, 20);
    }
    getRelatedTags(tags) {
        const relatedTags = [];
        for (const tag of tags) {
            if (tag.startsWith('category:')) {
                relatedTags.push('search');
            }
            if (tag === 'ai-enhanced') {
                relatedTags.push('suggestions', 'corrections');
            }
        }
        return relatedTags;
    }
    async invalidateRelatedCache(entry) {
        const tags = [
            `category:${entry.category}`,
            ...entry.tags.map(tag => `tag:${tag}`)
        ];
        await this.invalidateCache(undefined, tags, 'document-updated');
        const words = `${entry.title} ${entry.problem}`.toLowerCase().match(/\b\w{3,}\b/g) || [];
        for (const word of words.slice(0, 10)) {
            await this.cacheSystem.invalidateCache(`*${word}*`, undefined, 'content-related');
        }
    }
}
exports.CachedSearchService = CachedSearchService;
exports.default = CachedSearchService;
//# sourceMappingURL=CachedSearchService.js.map