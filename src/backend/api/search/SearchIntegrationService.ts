/**
 * Search Integration Service - Backend Integration Layer
 * Integrates FTS5 search with existing knowledge base services and architecture
 */

import { EventEmitter } from 'events';
import { FTS5SearchService } from '../../../services/FTS5SearchService';
import { KnowledgeBaseService } from '../../../services/KnowledgeBaseService';
import { SearchResultsIntegrationAdapter } from '../../../services/SearchResultsIntegrationAdapter';
import {
  KBEntry,
  SearchResult,
  SearchServiceConfig,
  FTS5SearchOptions,
  PaginatedSearchResponse
} from '../../../types/services';

export interface IntegrationConfig {
  syncInterval: number; // milliseconds
  batchSize: number;
  autoRebuildThreshold: number; // number of changes before auto-rebuild
  enableRealTimeSync: boolean;
  enableSearchAnalytics: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export interface SyncStatus {
  lastSync: Date;
  totalEntries: number;
  pendingChanges: number;
  indexHealth: 'healthy' | 'degraded' | 'rebuilding' | 'error';
  syncInProgress: boolean;
}

/**
 * Search Integration Service
 * Provides seamless integration between FTS5 search and existing KB services
 */
export class SearchIntegrationService extends EventEmitter {
  private ftsSearchService: FTS5SearchService;
  private knowledgeBaseService: KnowledgeBaseService;
  private integrationAdapter: SearchResultsIntegrationAdapter;
  private config: IntegrationConfig;
  private syncStatus: SyncStatus;
  private syncInterval?: ReturnType<typeof setTimeout>;
  private changeQueue: Array<{ action: 'create' | 'update' | 'delete'; entryId: string; timestamp: Date }> = [];

  constructor(
    searchConfig: SearchServiceConfig,
    knowledgeBaseService: KnowledgeBaseService,
    integrationConfig: Partial<IntegrationConfig> = {}
  ) {
    super();

    this.ftsSearchService = new FTS5SearchService(searchConfig);
    this.knowledgeBaseService = knowledgeBaseService;
    this.integrationAdapter = new SearchResultsIntegrationAdapter();

    this.config = {
      syncInterval: 30000, // 30 seconds
      batchSize: 100,
      autoRebuildThreshold: 1000,
      enableRealTimeSync: true,
      enableSearchAnalytics: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...integrationConfig
    };

    this.syncStatus = {
      lastSync: new Date(0),
      totalEntries: 0,
      pendingChanges: 0,
      indexHealth: 'healthy',
      syncInProgress: false
    };

    this.setupEventHandlers();
    this.startSyncScheduler();
  }

  /**
   * Initialize the integration service
   */
  async initialize(): Promise<void> {
    try {
      this.emit('integration:initializing');

      // Initialize FTS search service
      await this.initializeSearchService();

      // Perform initial sync
      await this.performFullSync();

      this.emit('integration:initialized');
      console.log('✅ Search Integration Service initialized successfully');

    } catch (error) {
      this.emit('integration:error', error);
      throw new Error(`Search integration initialization failed: ${error.message}`);
    }
  }

  /**
   * Enhanced search method with KB integration
   */
  async search(
    query: string,
    options: FTS5SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    pagination: any;
    facets: any[];
    metadata: any;
    integration: {
      fts_results: number;
      kb_enriched: number;
      cache_status: string;
      processing_time: number;
    };
  }> {
    const startTime = Date.now();

    try {
      // Execute FTS5 search
      const ftsResults = await this.ftsSearchService.search(query, options);

      // Enrich results with KB data
      const enrichedResults = await this.enrichSearchResults(ftsResults.results);

      // Convert to standard SearchResult format
      const standardResults = await this.integrationAdapter.adaptSearchResults(
        enrichedResults,
        {
          query,
          pagination: ftsResults.pagination,
          facets: ftsResults.facets
        }
      );

      // Record search analytics if enabled
      if (this.config.enableSearchAnalytics) {
        await this.recordSearchAnalytics(query, options, standardResults.results);
      }

      const processingTime = Date.now() - startTime;

      return {
        results: standardResults.results,
        pagination: ftsResults.pagination,
        facets: ftsResults.facets,
        metadata: ftsResults.query_info,
        integration: {
          fts_results: ftsResults.results.length,
          kb_enriched: enrichedResults.length,
          cache_status: 'active',
          processing_time: processingTime
        }
      };

    } catch (error) {
      this.emit('search:error', { query, options, error: error.message });
      throw new Error(`Integrated search failed: ${error.message}`);
    }
  }

  /**
   * Get search suggestions with KB integration
   */
  async getSuggestions(
    partialQuery: string,
    limit: number = 10
  ): Promise<Array<{
    text: string;
    type: 'query' | 'title' | 'category' | 'tag';
    frequency: number;
    source: 'fts' | 'kb' | 'history';
  }>> {
    try {
      // Get FTS suggestions
      const ftsSuggestions = await this.ftsSearchService.getSuggestions(partialQuery, limit);

      // Get KB suggestions (from actual entries)
      const kbSuggestions = await this.getKBSuggestions(partialQuery, limit);

      // Merge and rank suggestions
      const allSuggestions = [
        ...ftsSuggestions.map(text => ({
          text,
          type: 'query' as const,
          frequency: 1,
          source: 'fts' as const
        })),
        ...kbSuggestions
      ];

      // Remove duplicates and sort by relevance
      const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);

      return uniqueSuggestions
        .sort((a, b) => this.calculateSuggestionScore(b, partialQuery) - this.calculateSuggestionScore(a, partialQuery))
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting integrated suggestions:', error);
      return [];
    }
  }

  /**
   * Get comprehensive search analytics
   */
  getSearchAnalytics(): {
    fts_stats: any;
    integration_stats: SyncStatus;
    performance_metrics: any;
  } {
    const ftsStats = this.ftsSearchService.getSearchStats();

    return {
      fts_stats: ftsStats,
      integration_stats: this.syncStatus,
      performance_metrics: {
        sync_interval: this.config.syncInterval,
        batch_size: this.config.batchSize,
        pending_changes: this.changeQueue.length,
        real_time_sync: this.config.enableRealTimeSync
      }
    };
  }

  /**
   * Manually trigger sync with KB
   */
  async syncWithKnowledgeBase(): Promise<SyncStatus> {
    if (this.syncStatus.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    try {
      await this.performFullSync();
      return this.syncStatus;
    } catch (error) {
      this.emit('sync:error', error);
      throw error;
    }
  }

  /**
   * Rebuild search index
   */
  async rebuildSearchIndex(): Promise<void> {
    try {
      this.syncStatus.indexHealth = 'rebuilding';
      this.emit('index:rebuild_start');

      await this.ftsSearchService.rebuildIndex();
      await this.performFullSync();

      this.syncStatus.indexHealth = 'healthy';
      this.emit('index:rebuild_complete');

    } catch (error) {
      this.syncStatus.indexHealth = 'error';
      this.emit('index:rebuild_error', error);
      throw error;
    }
  }

  /**
   * Close the integration service
   */
  async close(): Promise<void> {
    try {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }

      await this.ftsSearchService.close();
      this.removeAllListeners();

      console.log('Search Integration Service closed successfully');
    } catch (error) {
      console.error('Error closing Search Integration Service:', error);
    }
  }

  // Private Methods

  private async initializeSearchService(): Promise<void> {
    // The FTS5SearchService is already initialized in constructor
    // This method can be used for additional setup if needed
  }

  private setupEventHandlers(): void {
    // Listen to KB service events for real-time sync
    if (this.config.enableRealTimeSync) {
      this.knowledgeBaseService.on('entry:created', (entry: KBEntry) => {
        this.queueChange('create', entry.id);
      });

      this.knowledgeBaseService.on('entry:updated', (entry: KBEntry) => {
        this.queueChange('update', entry.id);
      });

      this.knowledgeBaseService.on('entry:deleted', (entryId: string) => {
        this.queueChange('delete', entryId);
      });
    }

    // Listen to FTS service events
    this.ftsSearchService.on('search:completed', (data) => {
      this.emit('integration:search_completed', data);
    });

    this.ftsSearchService.on('search:error', (data) => {
      this.emit('integration:search_error', data);
    });
  }

  private startSyncScheduler(): void {
    if (this.config.syncInterval > 0) {
      this.syncInterval = setInterval(async () => {
        try {
          await this.processPendingChanges();
        } catch (error) {
          console.error('Scheduled sync error:', error);
        }
      }, this.config.syncInterval);
    }
  }

  private queueChange(action: 'create' | 'update' | 'delete', entryId: string): void {
    this.changeQueue.push({
      action,
      entryId,
      timestamp: new Date()
    });

    this.syncStatus.pendingChanges = this.changeQueue.length;

    // Auto-rebuild if threshold exceeded
    if (this.changeQueue.length >= this.config.autoRebuildThreshold) {
      this.rebuildSearchIndex().catch(error => {
        console.error('Auto-rebuild failed:', error);
      });
    }
  }

  private async processPendingChanges(): Promise<void> {
    if (this.changeQueue.length === 0 || this.syncStatus.syncInProgress) {
      return;
    }

    this.syncStatus.syncInProgress = true;

    try {
      const changes = this.changeQueue.splice(0, this.config.batchSize);

      for (const change of changes) {
        await this.processChange(change);
      }

      this.syncStatus.lastSync = new Date();
      this.syncStatus.pendingChanges = this.changeQueue.length;

      this.emit('sync:batch_completed', {
        processed: changes.length,
        remaining: this.changeQueue.length
      });

    } catch (error) {
      // Re-queue failed changes
      this.changeQueue.unshift(...this.changeQueue.splice(-this.config.batchSize));
      throw error;
    } finally {
      this.syncStatus.syncInProgress = false;
    }
  }

  private async processChange(change: { action: string; entryId: string; timestamp: Date }): Promise<void> {
    try {
      switch (change.action) {
        case 'create':
        case 'update':
          const entry = await this.knowledgeBaseService.read(change.entryId);
          if (entry) {
            await this.updateSearchIndex(entry);
          }
          break;

        case 'delete':
          await this.removeFromSearchIndex(change.entryId);
          break;
      }
    } catch (error) {
      console.error(`Failed to process change ${change.action} for entry ${change.entryId}:`, error);
      throw error;
    }
  }

  private async performFullSync(): Promise<void> {
    this.syncStatus.syncInProgress = true;

    try {
      // Get all entries from KB
      const allEntries = await this.knowledgeBaseService.list({ limit: 10000 });

      // Update sync status
      this.syncStatus.totalEntries = allEntries.total;
      this.syncStatus.lastSync = new Date();
      this.syncStatus.pendingChanges = 0;
      this.changeQueue.length = 0;

      this.emit('sync:full_completed', {
        total_entries: allEntries.total,
        sync_time: new Date()
      });

    } catch (error) {
      this.syncStatus.indexHealth = 'error';
      throw error;
    } finally {
      this.syncStatus.syncInProgress = false;
    }
  }

  private async updateSearchIndex(entry: KBEntry): Promise<void> {
    // This would typically update the FTS5 index directly
    // For now, we rely on the database triggers
    console.log(`Updating search index for entry: ${entry.id}`);
  }

  private async removeFromSearchIndex(entryId: string): Promise<void> {
    // This would typically remove from the FTS5 index directly
    // For now, we rely on the database triggers
    console.log(`Removing from search index: ${entryId}`);
  }

  private async enrichSearchResults(ftsResults: any[]): Promise<any[]> {
    // Enrich FTS results with additional KB data
    const enrichedResults = [];

    for (const result of ftsResults) {
      try {
        const kbEntry = await this.knowledgeBaseService.read(result.entry.id);
        if (kbEntry) {
          enrichedResults.push({
            ...result,
            entry: {
              ...result.entry,
              // Add any additional KB data
              latest_version: kbEntry.version,
              full_metadata: kbEntry
            }
          });
        } else {
          enrichedResults.push(result);
        }
      } catch (error) {
        // If KB lookup fails, use FTS result as-is
        enrichedResults.push(result);
      }
    }

    return enrichedResults;
  }

  private async getKBSuggestions(
    partialQuery: string,
    limit: number
  ): Promise<Array<{
    text: string;
    type: 'title' | 'category' | 'tag';
    frequency: number;
    source: 'kb';
  }>> {
    try {
      // Get suggestions from KB entries
      const entries = await this.knowledgeBaseService.list({ limit: 100 });
      const suggestions = [];

      entries.data.forEach(entry => {
        // Check title
        if (entry.title.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.push({
            text: entry.title,
            type: 'title' as const,
            frequency: entry.usage_count || 1,
            source: 'kb' as const
          });
        }

        // Check category
        if (entry.category.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.push({
            text: entry.category,
            type: 'category' as const,
            frequency: 1,
            source: 'kb' as const
          });
        }

        // Check tags
        entry.tags.forEach(tag => {
          if (tag.toLowerCase().includes(partialQuery.toLowerCase())) {
            suggestions.push({
              text: tag,
              type: 'tag' as const,
              frequency: 1,
              source: 'kb' as const
            });
          }
        });
      });

      return suggestions.slice(0, limit);

    } catch (error) {
      console.error('Error getting KB suggestions:', error);
      return [];
    }
  }

  private deduplicateSuggestions(suggestions: any[]): any[] {
    const seen = new Set();
    return suggestions.filter(suggestion => {
      const key = suggestion.text.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private calculateSuggestionScore(suggestion: any, query: string): number {
    let score = suggestion.frequency || 1;

    // Prefix match bonus
    if (suggestion.text.toLowerCase().startsWith(query.toLowerCase())) {
      score += 20;
    }

    // Type bonuses
    switch (suggestion.type) {
      case 'query':
        score += 15;
        break;
      case 'title':
        score += 10;
        break;
      case 'category':
        score += 8;
        break;
      case 'tag':
        score += 5;
        break;
    }

    // Source bonuses
    if (suggestion.source === 'kb') {
      score += 5;
    }

    return score;
  }

  private async recordSearchAnalytics(
    query: string,
    options: FTS5SearchOptions,
    results: SearchResult[]
  ): Promise<void> {
    try {
      // Record search in KB service if it has analytics capability
      if (typeof this.knowledgeBaseService.recordUsage === 'function') {
        // Record the search event
        // This is a simplified implementation
        console.log(`Recording search analytics: ${query} (${results.length} results)`);
      }
    } catch (error) {
      console.error('Error recording search analytics:', error);
    }
  }
}