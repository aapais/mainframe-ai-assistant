import { EventEmitter } from 'events';
import { SearchService } from './SearchService';
import type { SearchResult, SearchOptions, SearchMetadata, ExportFormat } from '../types/services';
export interface SearchResultsIntegration {
    performSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    subscribeToUpdates(callback: (results: SearchResult[]) => void): () => void;
    getSearchState(): SearchIntegrationState;
    updateSearchState(state: Partial<SearchIntegrationState>): void;
    getCachedResults(query: string, options?: SearchOptions): SearchResult[] | null;
    setCachedResults(query: string, results: SearchResult[], options?: SearchOptions): void;
    clearCache(): void;
    trackSearchEvent(event: SearchAnalyticsEvent): void;
    getSearchMetrics(): SearchMetrics;
    exportResults(results: SearchResult[], format: ExportFormat): Promise<Blob | string>;
    loadMoreResults(query: string, offset: number, limit: number): Promise<SearchResult[]>;
    enableRealTimeUpdates(enabled: boolean): void;
}
export interface SearchIntegrationState {
    query: string;
    results: SearchResult[];
    loading: boolean;
    error: string | null;
    totalResults: number;
    currentPage: number;
    hasMore: boolean;
    filters: Record<string, any>;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    selectedResults: string[];
    lastSearchTime: number;
}
export interface SearchAnalyticsEvent {
    type: 'search' | 'select' | 'export' | 'filter' | 'sort';
    query?: string;
    resultId?: string;
    metadata?: Record<string, any>;
    timestamp: number;
}
export interface SearchMetrics {
    totalSearches: number;
    averageResponseTime: number;
    successRate: number;
    cacheHitRate: number;
    popularQueries: Array<{
        query: string;
        count: number;
    }>;
    errorRate: number;
}
export interface CacheEntry {
    results: SearchResult[];
    timestamp: number;
    ttl: number;
    metadata: SearchMetadata;
}
export interface WebSocketMessage {
    type: 'search_update' | 'result_change' | 'new_entry' | 'delete_entry';
    payload: any;
    timestamp: number;
}
export declare class SearchResultsIntegrationAdapter extends EventEmitter implements SearchResultsIntegration {
    private searchService;
    private cache;
    private websocket;
    private metrics;
    private state;
    private realtimeEnabled;
    constructor(searchService: SearchService, websocketUrl?: string);
    performSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    subscribeToUpdates(callback: (results: SearchResult[]) => void): () => void;
    getSearchState(): SearchIntegrationState;
    updateSearchState(updates: Partial<SearchIntegrationState>): void;
    getCachedResults(query: string, options?: SearchOptions): SearchResult[] | null;
    setCachedResults(query: string, results: SearchResult[], options?: SearchOptions): void;
    clearCache(): void;
    trackSearchEvent(event: SearchAnalyticsEvent): void;
    getSearchMetrics(): SearchMetrics;
    exportResults(results: SearchResult[], format: ExportFormat): Promise<Blob | string>;
    loadMoreResults(query: string, offset: number, limit: number): Promise<SearchResult[]>;
    enableRealTimeUpdates(enabled: boolean): void;
    private initializeWebSocket;
    private handleWebSocketMessage;
    private generateCacheKey;
    private cleanupCache;
    private updateMetrics;
    private updateSuccessRate;
    private updateErrorRate;
    private updateAverageResponseTime;
    private updateCacheHitRate;
    private updatePopularQueries;
    private exportToCSV;
    private exportToExcel;
    private exportToPDF;
    private exportToMarkdown;
    private sendAnalyticsEvent;
    private storeAnalyticsEvent;
    private invalidateCacheForQuery;
    private updateResultInState;
    private removeResultFromState;
    destroy(): void;
}
export declare function useSearchResultsIntegration(websocketUrl?: string): SearchResultsIntegration;
export default SearchResultsIntegrationAdapter;
//# sourceMappingURL=SearchResultsIntegrationAdapter.d.ts.map