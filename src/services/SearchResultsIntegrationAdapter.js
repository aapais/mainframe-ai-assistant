"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchResultsIntegrationAdapter = void 0;
exports.useSearchResultsIntegration = useSearchResultsIntegration;
const events_1 = require("events");
const SearchService_1 = require("./SearchService");
const reactive_state_1 = require("../renderer/stores/reactive-state");
class SearchResultsIntegrationAdapter extends events_1.EventEmitter {
    searchService;
    cache = new Map();
    websocket = null;
    metrics;
    state;
    realtimeEnabled = false;
    constructor(searchService, websocketUrl) {
        super();
        this.searchService = searchService;
        this.state = {
            query: '',
            results: [],
            loading: false,
            error: null,
            totalResults: 0,
            currentPage: 1,
            hasMore: false,
            filters: {},
            sortBy: 'relevance',
            sortOrder: 'desc',
            selectedResults: [],
            lastSearchTime: 0
        };
        this.metrics = {
            totalSearches: 0,
            averageResponseTime: 0,
            successRate: 0,
            cacheHitRate: 0,
            popularQueries: [],
            errorRate: 0
        };
        if (websocketUrl) {
            this.initializeWebSocket(websocketUrl);
        }
        setInterval(() => this.cleanupCache(), 5 * 60 * 1000);
    }
    async performSearch(query, options = {}) {
        const startTime = performance.now();
        try {
            this.updateSearchState({
                query,
                loading: true,
                error: null,
                lastSearchTime: Date.now()
            });
            const cached = this.getCachedResults(query, options);
            if (cached && !options.force) {
                this.updateSearchState({
                    results: cached,
                    loading: false,
                    totalResults: cached.length
                });
                this.updateMetrics('cache_hit', performance.now() - startTime);
                return cached;
            }
            const entries = Array.from(reactive_state_1.useReactiveStore.getState().entries.values());
            const results = await this.searchService.search(query, entries, options);
            this.setCachedResults(query, results, options);
            this.updateSearchState({
                results,
                loading: false,
                totalResults: results.length,
                hasMore: results.length >= (options.limit || 50)
            });
            this.trackSearchEvent({
                type: 'search',
                query,
                metadata: {
                    resultCount: results.length,
                    responseTime: performance.now() - startTime,
                    cacheUsed: false
                },
                timestamp: Date.now()
            });
            if (this.realtimeEnabled) {
                this.emit('searchResults', results);
            }
            this.updateMetrics('search_success', performance.now() - startTime);
            return results;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Search failed';
            this.updateSearchState({
                loading: false,
                error: errorMessage
            });
            this.trackSearchEvent({
                type: 'search',
                query,
                metadata: {
                    error: errorMessage,
                    responseTime: performance.now() - startTime
                },
                timestamp: Date.now()
            });
            this.updateMetrics('search_error', performance.now() - startTime);
            throw error;
        }
    }
    subscribeToUpdates(callback) {
        const listener = (results) => callback(results);
        this.on('searchResults', listener);
        return () => {
            this.off('searchResults', listener);
        };
    }
    getSearchState() {
        return { ...this.state };
    }
    updateSearchState(updates) {
        this.state = { ...this.state, ...updates };
        this.emit('stateChange', this.state);
    }
    getCachedResults(query, options = {}) {
        const cacheKey = this.generateCacheKey(query, options);
        const entry = this.cache.get(cacheKey);
        if (!entry)
            return null;
        if (Date.now() > entry.timestamp + entry.ttl) {
            this.cache.delete(cacheKey);
            return null;
        }
        return entry.results;
    }
    setCachedResults(query, results, options = {}) {
        const cacheKey = this.generateCacheKey(query, options);
        const entry = {
            results,
            timestamp: Date.now(),
            ttl: 5 * 60 * 1000,
            metadata: {
                query,
                resultCount: results.length,
                options
            }
        };
        if (this.cache.size >= 100) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(cacheKey, entry);
    }
    clearCache() {
        this.cache.clear();
        this.emit('cacheCleared');
    }
    trackSearchEvent(event) {
        if (event.type === 'search') {
            this.metrics.totalSearches++;
            if (event.metadata?.error) {
                this.updateErrorRate();
            }
            else {
                this.updateSuccessRate();
            }
            if (event.metadata?.responseTime) {
                this.updateAverageResponseTime(event.metadata.responseTime);
            }
            if (event.query) {
                this.updatePopularQueries(event.query);
            }
        }
        this.sendAnalyticsEvent(event);
        this.storeAnalyticsEvent(event);
    }
    getSearchMetrics() {
        return { ...this.metrics };
    }
    async exportResults(results, format) {
        this.trackSearchEvent({
            type: 'export',
            metadata: {
                format,
                resultCount: results.length
            },
            timestamp: Date.now()
        });
        switch (format) {
            case 'json':
                return new Blob([JSON.stringify(results, null, 2)], {
                    type: 'application/json'
                });
            case 'csv':
                return this.exportToCSV(results);
            case 'excel':
                return this.exportToExcel(results);
            case 'pdf':
                return this.exportToPDF(results);
            case 'markdown':
                return this.exportToMarkdown(results);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    async loadMoreResults(query, offset, limit) {
        const options = {
            offset,
            limit,
            category: this.state.filters.category,
            tags: this.state.filters.tags,
            sortBy: this.state.sortBy,
            sortOrder: this.state.sortOrder
        };
        const entries = Array.from(reactive_state_1.useReactiveStore.getState().entries.values());
        const results = await this.searchService.search(query, entries, options);
        const currentResults = this.state.results;
        const allResults = [...currentResults, ...results];
        this.updateSearchState({
            results: allResults,
            currentPage: Math.floor(offset / limit) + 1,
            hasMore: results.length === limit,
            totalResults: allResults.length
        });
        return results;
    }
    enableRealTimeUpdates(enabled) {
        this.realtimeEnabled = enabled;
        if (enabled && !this.websocket) {
            this.initializeWebSocket();
        }
        else if (!enabled && this.websocket) {
        }
    }
    initializeWebSocket(url) {
        try {
            const wsUrl = url || `ws://localhost:${process.env.WEBSOCKET_PORT || 3001}/search`;
            this.websocket = new WebSocket(wsUrl);
            this.websocket.onopen = () => {
                console.log('Search WebSocket connected');
                this.emit('websocketConnected');
            };
            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                }
                catch (error) {
                    console.warn('Invalid WebSocket message:', event.data);
                }
            };
            this.websocket.onerror = (error) => {
                console.error('Search WebSocket error:', error);
                this.emit('websocketError', error);
            };
            this.websocket.onclose = () => {
                console.log('Search WebSocket disconnected');
                this.emit('websocketDisconnected');
                setTimeout(() => {
                    if (this.realtimeEnabled) {
                        this.initializeWebSocket(url);
                    }
                }, 5000);
            };
        }
        catch (error) {
            console.error('Failed to initialize WebSocket:', error);
        }
    }
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'search_update':
                this.invalidateCacheForQuery(message.payload.query);
                break;
            case 'result_change':
                this.updateResultInState(message.payload.result);
                break;
            case 'new_entry':
                this.clearCache();
                break;
            case 'delete_entry':
                this.removeResultFromState(message.payload.entryId);
                this.clearCache();
                break;
        }
    }
    generateCacheKey(query, options) {
        const key = {
            query: query.toLowerCase().trim(),
            category: options.category,
            tags: options.tags?.sort(),
            sortBy: options.sortBy,
            sortOrder: options.sortOrder,
            limit: options.limit,
            offset: options.offset
        };
        return btoa(JSON.stringify(key)).replace(/[+/=]/g, '');
    }
    cleanupCache() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, entry] of this.cache) {
            if (now > entry.timestamp + entry.ttl) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        if (keysToDelete.length > 0) {
            console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
        }
    }
    updateMetrics(operation, duration) {
        switch (operation) {
            case 'search_success':
                this.updateSuccessRate();
                this.updateAverageResponseTime(duration);
                break;
            case 'search_error':
                this.updateErrorRate();
                break;
            case 'cache_hit':
                this.updateCacheHitRate(true);
                break;
            case 'cache_miss':
                this.updateCacheHitRate(false);
                break;
        }
    }
    updateSuccessRate() {
        const totalOps = this.metrics.totalSearches;
        const currentSuccessful = Math.floor(this.metrics.successRate * totalOps);
        this.metrics.successRate = (currentSuccessful + 1) / totalOps;
    }
    updateErrorRate() {
        const totalOps = this.metrics.totalSearches;
        const currentErrors = Math.floor(this.metrics.errorRate * totalOps);
        this.metrics.errorRate = (currentErrors + 1) / totalOps;
    }
    updateAverageResponseTime(newTime) {
        const currentAvg = this.metrics.averageResponseTime;
        const totalSearches = this.metrics.totalSearches;
        this.metrics.averageResponseTime =
            (currentAvg * (totalSearches - 1) + newTime) / totalSearches;
    }
    updateCacheHitRate(hit) {
        if (hit) {
            this.metrics.cacheHitRate = Math.min(1, this.metrics.cacheHitRate + 0.01);
        }
    }
    updatePopularQueries(query) {
        const existing = this.metrics.popularQueries.find(pq => pq.query === query);
        if (existing) {
            existing.count++;
        }
        else {
            this.metrics.popularQueries.push({ query, count: 1 });
        }
        this.metrics.popularQueries = this.metrics.popularQueries
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }
    exportToCSV(results) {
        const headers = ['ID', 'Title', 'Category', 'Problem', 'Solution', 'Tags', 'Score', 'Created'];
        const rows = results.map(result => [
            result.entry.id,
            `"${result.entry.title.replace(/"/g, '""')}"`,
            result.entry.category,
            `"${result.entry.problem.replace(/"/g, '""')}"`,
            `"${result.entry.solution.replace(/"/g, '""')}"`,
            `"${result.entry.tags.join(', ')}"`,
            result.score.toString(),
            result.entry.created_at
        ]);
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        return new Blob([csv], { type: 'text/csv' });
    }
    async exportToExcel(results) {
        return this.exportToCSV(results);
    }
    async exportToPDF(results) {
        const text = results.map(result => `Title: ${result.entry.title}\n` +
            `Category: ${result.entry.category}\n` +
            `Problem: ${result.entry.problem}\n` +
            `Solution: ${result.entry.solution}\n` +
            `Score: ${result.score}\n\n`).join('---\n\n');
        return new Blob([text], { type: 'text/plain' });
    }
    exportToMarkdown(results) {
        const markdown = results.map(result => `# ${result.entry.title}\n\n` +
            `**Category:** ${result.entry.category}  \n` +
            `**Score:** ${result.score}  \n` +
            `**Tags:** ${result.entry.tags.join(', ')}  \n\n` +
            `## Problem\n\n${result.entry.problem}\n\n` +
            `## Solution\n\n${result.entry.solution}\n\n`).join('---\n\n');
        return new Blob([markdown], { type: 'text/markdown' });
    }
    sendAnalyticsEvent(event) {
        if (window.electronAPI?.sendAnalytics) {
            window.electronAPI.sendAnalytics(event).catch(console.error);
        }
    }
    storeAnalyticsEvent(event) {
        const key = 'search_analytics_events';
        try {
            const stored = localStorage.getItem(key);
            const events = stored ? JSON.parse(stored) : [];
            events.push(event);
            if (events.length > 1000) {
                events.splice(0, events.length - 1000);
            }
            localStorage.setItem(key, JSON.stringify(events));
        }
        catch (error) {
            console.warn('Failed to store analytics event:', error);
        }
    }
    invalidateCacheForQuery(query) {
        const keysToDelete = [];
        for (const [key, entry] of this.cache) {
            if (entry.metadata.query === query) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }
    updateResultInState(updatedResult) {
        const results = this.state.results.map(result => result.entry.id === updatedResult.entry.id ? updatedResult : result);
        this.updateSearchState({ results });
    }
    removeResultFromState(entryId) {
        const results = this.state.results.filter(result => result.entry.id !== entryId);
        this.updateSearchState({
            results,
            totalResults: results.length
        });
    }
    destroy() {
        if (this.websocket) {
            this.websocket.close();
        }
        this.clearCache();
        this.removeAllListeners();
    }
}
exports.SearchResultsIntegrationAdapter = SearchResultsIntegrationAdapter;
function useSearchResultsIntegration(websocketUrl) {
    const [adapter] = React.useState(() => {
        const searchService = new SearchService_1.SearchService();
        return new SearchResultsIntegrationAdapter(searchService, websocketUrl);
    });
    React.useEffect(() => {
        return () => adapter.destroy();
    }, [adapter]);
    return adapter;
}
exports.default = SearchResultsIntegrationAdapter;
//# sourceMappingURL=SearchResultsIntegrationAdapter.js.map