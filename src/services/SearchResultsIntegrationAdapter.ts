/**
 * SearchResults Integration Adapter
 *
 * Provides a unified interface for SearchResults component to interact with:
 * - SearchService for real-time search
 * - Redux/Zustand state management
 * - Caching layers
 * - Monitoring and analytics
 * - WebSocket for real-time updates
 * - Export functionality
 *
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { SearchService } from './SearchService';
import { useReactiveStore } from '../renderer/stores/reactive-state';
import { useSearch } from '../renderer/contexts/SearchContext';
import type {
  SearchResult,
  SearchOptions,
  KBEntry,
  SearchMetadata,
  ExportFormat,
} from '../types/services';

// Enhanced interfaces for integration
export interface SearchResultsIntegration {
  // Core search functionality
  performSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Real-time capabilities
  subscribeToUpdates(callback: (results: SearchResult[]) => void): () => void;

  // State management
  getSearchState(): SearchIntegrationState;
  updateSearchState(state: Partial<SearchIntegrationState>): void;

  // Caching
  getCachedResults(query: string, options?: SearchOptions): SearchResult[] | null;
  setCachedResults(query: string, results: SearchResult[], options?: SearchOptions): void;
  clearCache(): void;

  // Analytics and monitoring
  trackSearchEvent(event: SearchAnalyticsEvent): void;
  getSearchMetrics(): SearchMetrics;

  // Export functionality
  exportResults(results: SearchResult[], format: ExportFormat): Promise<Blob | string>;

  // Pagination and infinite scroll
  loadMoreResults(query: string, offset: number, limit: number): Promise<SearchResult[]>;

  // WebSocket integration
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
  popularQueries: Array<{ query: string; count: number }>;
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

/**
 * Main integration adapter implementation
 */
export class SearchResultsIntegrationAdapter
  extends EventEmitter
  implements SearchResultsIntegration
{
  private searchService: SearchService;
  private cache: Map<string, CacheEntry> = new Map();
  private websocket: WebSocket | null = null;
  private metrics: SearchMetrics;
  private state: SearchIntegrationState;
  private realtimeEnabled = false;

  constructor(searchService: SearchService, websocketUrl?: string) {
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
      lastSearchTime: 0,
    };

    this.metrics = {
      totalSearches: 0,
      averageResponseTime: 0,
      successRate: 0,
      cacheHitRate: 0,
      popularQueries: [],
      errorRate: 0,
    };

    if (websocketUrl) {
      this.initializeWebSocket(websocketUrl);
    }

    // Setup periodic cache cleanup
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Perform search with full integration support
   */
  async performSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = performance.now();

    try {
      this.updateSearchState({
        query,
        loading: true,
        error: null,
        lastSearchTime: Date.now(),
      });

      // Check cache first
      const cached = this.getCachedResults(query, options);
      if (cached && !options.force) {
        this.updateSearchState({
          results: cached,
          loading: false,
          totalResults: cached.length,
        });

        this.updateMetrics('cache_hit', performance.now() - startTime);
        return cached;
      }

      // Get entries from reactive store
      const entries = Array.from(useReactiveStore.getState().entries.values());

      // Perform search using SearchService
      const results = await this.searchService.search(query, entries, options);

      // Cache results
      this.setCachedResults(query, results, options);

      // Update state
      this.updateSearchState({
        results,
        loading: false,
        totalResults: results.length,
        hasMore: results.length >= (options.limit || 50),
      });

      // Track analytics
      this.trackSearchEvent({
        type: 'search',
        query,
        metadata: {
          resultCount: results.length,
          responseTime: performance.now() - startTime,
          cacheUsed: false,
        },
        timestamp: Date.now(),
      });

      // Emit real-time update if enabled
      if (this.realtimeEnabled) {
        this.emit('searchResults', results);
      }

      this.updateMetrics('search_success', performance.now() - startTime);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';

      this.updateSearchState({
        loading: false,
        error: errorMessage,
      });

      this.trackSearchEvent({
        type: 'search',
        query,
        metadata: {
          error: errorMessage,
          responseTime: performance.now() - startTime,
        },
        timestamp: Date.now(),
      });

      this.updateMetrics('search_error', performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Subscribe to real-time search updates
   */
  subscribeToUpdates(callback: (results: SearchResult[]) => void): () => void {
    const listener = (results: SearchResult[]) => callback(results);
    this.on('searchResults', listener);

    return () => {
      this.off('searchResults', listener);
    };
  }

  /**
   * Get current search integration state
   */
  getSearchState(): SearchIntegrationState {
    return { ...this.state };
  }

  /**
   * Update search integration state
   */
  updateSearchState(updates: Partial<SearchIntegrationState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('stateChange', this.state);
  }

  /**
   * Get cached search results
   */
  getCachedResults(query: string, options: SearchOptions = {}): SearchResult[] | null {
    const cacheKey = this.generateCacheKey(query, options);
    const entry = this.cache.get(cacheKey);

    if (!entry) return null;

    // Check if entry is still valid
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.results;
  }

  /**
   * Cache search results
   */
  setCachedResults(query: string, results: SearchResult[], options: SearchOptions = {}): void {
    const cacheKey = this.generateCacheKey(query, options);
    const entry: CacheEntry = {
      results,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000, // 5 minutes
      metadata: {
        query,
        resultCount: results.length,
        options,
      },
    };

    // Prevent cache from growing too large
    if (this.cache.size >= 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(cacheKey, entry);
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Track search analytics events
   */
  trackSearchEvent(event: SearchAnalyticsEvent): void {
    // Update metrics
    if (event.type === 'search') {
      this.metrics.totalSearches++;

      if (event.metadata?.error) {
        this.updateErrorRate();
      } else {
        this.updateSuccessRate();
      }

      if (event.metadata?.responseTime) {
        this.updateAverageResponseTime(event.metadata.responseTime);
      }

      if (event.query) {
        this.updatePopularQueries(event.query);
      }
    }

    // Send analytics to monitoring service
    this.sendAnalyticsEvent(event);

    // Store in local analytics if needed
    this.storeAnalyticsEvent(event);
  }

  /**
   * Get current search metrics
   */
  getSearchMetrics(): SearchMetrics {
    return { ...this.metrics };
  }

  /**
   * Export search results in various formats
   */
  async exportResults(results: SearchResult[], format: ExportFormat): Promise<Blob | string> {
    this.trackSearchEvent({
      type: 'export',
      metadata: {
        format,
        resultCount: results.length,
      },
      timestamp: Date.now(),
    });

    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(results, null, 2)], {
          type: 'application/json',
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

  /**
   * Load more results for pagination/infinite scroll
   */
  async loadMoreResults(query: string, offset: number, limit: number): Promise<SearchResult[]> {
    const options: SearchOptions = {
      offset,
      limit,
      // Preserve current filters and sort settings
      category: this.state.filters.category,
      tags: this.state.filters.tags,
      sortBy: this.state.sortBy,
      sortOrder: this.state.sortOrder,
    };

    // Get entries from reactive store
    const entries = Array.from(useReactiveStore.getState().entries.values());

    // Perform paginated search
    const results = await this.searchService.search(query, entries, options);

    // Update state with new results (append for infinite scroll)
    const currentResults = this.state.results;
    const allResults = [...currentResults, ...results];

    this.updateSearchState({
      results: allResults,
      currentPage: Math.floor(offset / limit) + 1,
      hasMore: results.length === limit,
      totalResults: allResults.length,
    });

    return results;
  }

  /**
   * Enable/disable real-time updates via WebSocket
   */
  enableRealTimeUpdates(enabled: boolean): void {
    this.realtimeEnabled = enabled;

    if (enabled && !this.websocket) {
      // Initialize WebSocket connection if not already established
      this.initializeWebSocket();
    } else if (!enabled && this.websocket) {
      // Optionally close WebSocket connection
      // this.websocket.close();
    }
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private initializeWebSocket(url?: string): void {
    try {
      const wsUrl = url || `ws://localhost:${process.env.WEBSOCKET_PORT || 3001}/search`;
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('Search WebSocket connected');
        this.emit('websocketConnected');
      };

      this.websocket.onmessage = event => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.warn('Invalid WebSocket message:', event.data);
        }
      };

      this.websocket.onerror = error => {
        console.error('Search WebSocket error:', error);
        this.emit('websocketError', error);
      };

      this.websocket.onclose = () => {
        console.log('Search WebSocket disconnected');
        this.emit('websocketDisconnected');

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (this.realtimeEnabled) {
            this.initializeWebSocket(url);
          }
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'search_update':
        // Invalidate cache for affected queries
        this.invalidateCacheForQuery(message.payload.query);
        break;

      case 'result_change':
        // Update specific result in current results
        this.updateResultInState(message.payload.result);
        break;

      case 'new_entry':
        // Invalidate all cache to ensure new entry appears in future searches
        this.clearCache();
        break;

      case 'delete_entry':
        // Remove entry from current results and invalidate cache
        this.removeResultFromState(message.payload.entryId);
        this.clearCache();
        break;
    }
  }

  /**
   * Generate cache key from query and options
   */
  private generateCacheKey(query: string, options: SearchOptions): string {
    const key = {
      query: query.toLowerCase().trim(),
      category: options.category,
      tags: options.tags?.sort(),
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      limit: options.limit,
      offset: options.offset,
    };

    return btoa(JSON.stringify(key)).replace(/[+/=]/g, '');
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

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

  /**
   * Update metrics for different operations
   */
  private updateMetrics(operation: string, duration: number): void {
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

  /**
   * Update success rate metric
   */
  private updateSuccessRate(): void {
    // Simple running average calculation
    const totalOps = this.metrics.totalSearches;
    const currentSuccessful = Math.floor(this.metrics.successRate * totalOps);
    this.metrics.successRate = (currentSuccessful + 1) / totalOps;
  }

  /**
   * Update error rate metric
   */
  private updateErrorRate(): void {
    const totalOps = this.metrics.totalSearches;
    const currentErrors = Math.floor(this.metrics.errorRate * totalOps);
    this.metrics.errorRate = (currentErrors + 1) / totalOps;
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(newTime: number): void {
    const currentAvg = this.metrics.averageResponseTime;
    const totalSearches = this.metrics.totalSearches;

    this.metrics.averageResponseTime = (currentAvg * (totalSearches - 1) + newTime) / totalSearches;
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(hit: boolean): void {
    // This would need more sophisticated tracking in a real implementation
    if (hit) {
      this.metrics.cacheHitRate = Math.min(1, this.metrics.cacheHitRate + 0.01);
    }
  }

  /**
   * Update popular queries
   */
  private updatePopularQueries(query: string): void {
    const existing = this.metrics.popularQueries.find(pq => pq.query === query);

    if (existing) {
      existing.count++;
    } else {
      this.metrics.popularQueries.push({ query, count: 1 });
    }

    // Keep only top 10 popular queries
    this.metrics.popularQueries = this.metrics.popularQueries
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Export methods for different formats
   */
  private exportToCSV(results: SearchResult[]): Blob {
    const headers = ['ID', 'Title', 'Category', 'Problem', 'Solution', 'Tags', 'Score', 'Created'];
    const rows = results.map(result => [
      result.entry.id,
      `"${result.entry.title.replace(/"/g, '""')}"`,
      result.entry.category,
      `"${result.entry.problem.replace(/"/g, '""')}"`,
      `"${result.entry.solution.replace(/"/g, '""')}"`,
      `"${result.entry.tags.join(', ')}"`,
      result.score.toString(),
      result.entry.created_at,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    return new Blob([csv], { type: 'text/csv' });
  }

  private async exportToExcel(results: SearchResult[]): Promise<Blob> {
    // This would require a library like xlsx or similar
    // For now, return CSV format
    return this.exportToCSV(results);
  }

  private async exportToPDF(results: SearchResult[]): Promise<Blob> {
    // This would require a PDF library like jsPDF
    // For now, return text format
    const text = results
      .map(
        result =>
          `Title: ${result.entry.title}\n` +
          `Category: ${result.entry.category}\n` +
          `Problem: ${result.entry.problem}\n` +
          `Solution: ${result.entry.solution}\n` +
          `Score: ${result.score}\n\n`
      )
      .join('---\n\n');

    return new Blob([text], { type: 'text/plain' });
  }

  private exportToMarkdown(results: SearchResult[]): Blob {
    const markdown = results
      .map(
        result =>
          `# ${result.entry.title}\n\n` +
          `**Category:** ${result.entry.category}  \n` +
          `**Score:** ${result.score}  \n` +
          `**Tags:** ${result.entry.tags.join(', ')}  \n\n` +
          `## Problem\n\n${result.entry.problem}\n\n` +
          `## Solution\n\n${result.entry.solution}\n\n`
      )
      .join('---\n\n');

    return new Blob([markdown], { type: 'text/markdown' });
  }

  /**
   * Analytics and monitoring helpers
   */
  private sendAnalyticsEvent(event: SearchAnalyticsEvent): void {
    // Send to external analytics service
    if (window.electronAPI?.sendAnalytics) {
      window.electronAPI.sendAnalytics(event).catch(console.error);
    }
  }

  private storeAnalyticsEvent(event: SearchAnalyticsEvent): void {
    // Store locally for offline analytics
    const key = 'search_analytics_events';
    try {
      const stored = localStorage.getItem(key);
      const events = stored ? JSON.parse(stored) : [];
      events.push(event);

      // Keep only last 1000 events
      if (events.length > 1000) {
        events.splice(0, events.length - 1000);
      }

      localStorage.setItem(key, JSON.stringify(events));
    } catch (error) {
      console.warn('Failed to store analytics event:', error);
    }
  }

  /**
   * WebSocket message handlers
   */
  private invalidateCacheForQuery(query: string): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.metadata.query === query) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private updateResultInState(updatedResult: SearchResult): void {
    const results = this.state.results.map(result =>
      result.entry.id === updatedResult.entry.id ? updatedResult : result
    );

    this.updateSearchState({ results });
  }

  private removeResultFromState(entryId: string): void {
    const results = this.state.results.filter(result => result.entry.id !== entryId);
    this.updateSearchState({
      results,
      totalResults: results.length,
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.websocket) {
      this.websocket.close();
    }

    this.clearCache();
    this.removeAllListeners();
  }
}

/**
 * Hook for React components to use the SearchResults integration
 */
export function useSearchResultsIntegration(websocketUrl?: string): SearchResultsIntegration {
  const [adapter] = React.useState(() => {
    const searchService = new SearchService();
    return new SearchResultsIntegrationAdapter(searchService, websocketUrl);
  });

  React.useEffect(() => {
    return () => adapter.destroy();
  }, [adapter]);

  return adapter;
}

export default SearchResultsIntegrationAdapter;
