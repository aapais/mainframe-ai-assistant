/**
 * KB Listing Service - Advanced Knowledge Base Listing and Filtering
 * Provides comprehensive listing, filtering, sorting, and pagination capabilities
 * with optimized database queries and intelligent caching strategies
 */

import { Database } from 'better-sqlite3';
import { DatabaseService } from './DatabaseService';
import { KBEntry, SearchResult } from '../../types';

// =========================
// CORE INTERFACES
// =========================

export interface ListingOptions {
  // Pagination
  page?: number;
  pageSize?: number;
  offset?: number;

  // Sorting
  sortBy?: SortField;
  sortDirection?: SortDirection;
  multiSort?: SortField[];

  // Filtering
  filters?: FilterCriteria[];
  quickFilters?: QuickFilterType[];

  // Search
  searchQuery?: string;
  searchFields?: SearchField[];

  // Display
  includeArchived?: boolean;
  includeMetadata?: boolean;
  includeStats?: boolean;
}

export interface ListingResponse<T = KBEntry> {
  items: T[];
  pagination: PaginationInfo;
  sorting: SortingInfo;
  filtering: FilteringInfo;
  aggregations: AggregationData;
  metadata: {
    totalTime: number;
    cacheHit: boolean;
    queryComplexity: number;
    recommendations?: string[];
  };
}

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

export interface SortingInfo {
  sortBy: SortField;
  sortDirection: SortDirection;
  multiSort?: SortField[];
  availableSorts: SortOption[];
}

export interface FilteringInfo {
  activeFilters: ActiveFilter[];
  availableFilters: FilterOption[];
  quickFilters: QuickFilterInfo[];
  filterCounts: Record<string, number>;
}

export interface AggregationData {
  categoryStats: CategoryAggregation[];
  tagCloud: TagAggregation[];
  severityDistribution: SeverityAggregation[];
  usageStats: UsageAggregation;
  timelineStats: TimelineAggregation[];
}

// =========================
// SUPPORTING TYPES
// =========================

export type SortField =
  | 'title'
  | 'category'
  | 'created_at'
  | 'updated_at'
  | 'usage_count'
  | 'success_rate'
  | 'rating'
  | 'last_used'
  | 'relevance';

export type SortDirection = 'asc' | 'desc';

export type SearchField = 'title' | 'problem' | 'solution' | 'tags' | 'category' | 'all';

export type QuickFilterType =
  | 'recent'
  | 'popular'
  | 'highly_rated'
  | 'frequently_used'
  | 'needs_review'
  | 'my_entries';

export interface FilterCriteria {
  field: string;
  operator: FilterOperator;
  value: any;
  valueType?: 'string' | 'number' | 'date' | 'boolean' | 'array';
}

export type FilterOperator =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in' | 'between' | 'is_null' | 'is_not_null'
  | 'regex' | 'fuzzy_match';

export interface ActiveFilter extends FilterCriteria {
  id: string;
  label: string;
  removable: boolean;
}

export interface FilterOption {
  field: string;
  label: string;
  type: 'select' | 'multiselect' | 'range' | 'date' | 'text' | 'number';
  options?: { value: any; label: string; count?: number }[];
  min?: number;
  max?: number;
}

export interface SortOption {
  field: SortField;
  label: string;
  defaultDirection?: SortDirection;
  description?: string;
}

export interface QuickFilterInfo {
  type: QuickFilterType;
  label: string;
  count: number;
  active: boolean;
}

export interface CategoryAggregation {
  category: string;
  count: number;
  percentage: number;
  avgRating: number;
  avgUsage: number;
}

export interface TagAggregation {
  tag: string;
  count: number;
  popularity: number;
  trendDirection: 'up' | 'down' | 'stable';
}

export interface SeverityAggregation {
  severity: string;
  count: number;
  percentage: number;
}

export interface UsageAggregation {
  totalViews: number;
  uniqueUsers: number;
  avgSessionTime: number;
  bounceRate: number;
  conversionRate: number;
}

export interface TimelineAggregation {
  period: string;
  createdCount: number;
  updatedCount: number;
  viewCount: number;
  successRate: number;
}

// =========================
// SAVED SEARCHES
// =========================

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: ListingOptions;
  userId?: string;
  isPublic: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsed?: Date;
  shortcut?: string;
}

export interface SavedSearchCreate {
  name: string;
  description?: string;
  query: ListingOptions;
  isPublic?: boolean;
  tags?: string[];
  shortcut?: string;
}

// =========================
// MAIN SERVICE CLASS
// =========================

export class KBListingService {
  private db: Database;
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private queryBuilder: QueryBuilder;
  private indexOptimizer: IndexOptimizer;

  constructor(private databaseService: DatabaseService) {
    this.db = databaseService.getDatabase()?.['db'];
    this.queryBuilder = new QueryBuilder(this.db);
    this.indexOptimizer = new IndexOptimizer(this.db);
    this.initializeOptimizations();
  }

  // =========================
  // PUBLIC API METHODS
  // =========================

  /**
   * Get paginated, filtered, and sorted KB entries with comprehensive metadata
   */
  async getEntries(options: ListingOptions = {}): Promise<ListingResponse> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey('entries', options);

    // Check cache first
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      cachedResult.metadata.cacheHit = true;
      cachedResult.metadata.totalTime = performance.now() - startTime;
      return cachedResult;
    }

    // Normalize options with defaults
    const normalizedOptions = this.normalizeOptions(options);

    // Build optimized query
    const query = this.queryBuilder.buildListingQuery(normalizedOptions);

    // Execute query with performance monitoring
    const results = this.executeQuery(query);

    // Build response with all metadata
    const response: ListingResponse = {
      items: results.items,
      pagination: this.buildPaginationInfo(results.count, normalizedOptions),
      sorting: this.buildSortingInfo(normalizedOptions),
      filtering: await this.buildFilteringInfo(normalizedOptions),
      aggregations: await this.buildAggregations(normalizedOptions),
      metadata: {
        totalTime: performance.now() - startTime,
        cacheHit: false,
        queryComplexity: this.calculateQueryComplexity(normalizedOptions),
        recommendations: this.generateOptimizationRecommendations(normalizedOptions)
      }
    };

    // Cache result
    this.cacheResult(cacheKey, response);

    return response;
  }

  /**
   * Get available filter options based on current data
   */
  async getFilterOptions(options: Partial<ListingOptions> = {}): Promise<FilterOption[]> {
    const cacheKey = this.generateCacheKey('filter-options', options);
    const cached = this.getCachedResult(cacheKey);

    if (cached) return cached;

    const filterOptions: FilterOption[] = [
      // Category filter
      {
        field: 'category',
        label: 'Category',
        type: 'multiselect',
        options: await this.getCategoryOptions()
      },

      // Severity filter
      {
        field: 'severity',
        label: 'Severity',
        type: 'multiselect',
        options: await this.getSeverityOptions()
      },

      // Tags filter
      {
        field: 'tags',
        label: 'Tags',
        type: 'multiselect',
        options: await this.getTagOptions()
      },

      // Date range filters
      {
        field: 'created_at',
        label: 'Created Date',
        type: 'date'
      },

      {
        field: 'updated_at',
        label: 'Last Updated',
        type: 'date'
      },

      {
        field: 'last_used',
        label: 'Last Used',
        type: 'date'
      },

      // Numeric range filters
      {
        field: 'usage_count',
        label: 'Usage Count',
        type: 'range',
        min: 0,
        max: await this.getMaxUsageCount()
      },

      {
        field: 'success_rate',
        label: 'Success Rate',
        type: 'range',
        min: 0,
        max: 100
      },

      // Text filters
      {
        field: 'created_by',
        label: 'Created By',
        type: 'select',
        options: await this.getCreatorOptions()
      }
    ];

    this.cacheResult(cacheKey, filterOptions);
    return filterOptions;
  }

  /**
   * Get quick filter counts and information
   */
  async getQuickFilters(): Promise<QuickFilterInfo[]> {
    const cacheKey = 'quick-filters';
    const cached = this.getCachedResult(cacheKey);

    if (cached) return cached;

    const quickFilters: QuickFilterInfo[] = [
      {
        type: 'recent',
        label: 'Recently Added',
        count: await this.getQuickFilterCount('recent'),
        active: false
      },
      {
        type: 'popular',
        label: 'Most Popular',
        count: await this.getQuickFilterCount('popular'),
        active: false
      },
      {
        type: 'highly_rated',
        label: 'Highly Rated',
        count: await this.getQuickFilterCount('highly_rated'),
        active: false
      },
      {
        type: 'frequently_used',
        label: 'Frequently Used',
        count: await this.getQuickFilterCount('frequently_used'),
        active: false
      },
      {
        type: 'needs_review',
        label: 'Needs Review',
        count: await this.getQuickFilterCount('needs_review'),
        active: false
      }
    ];

    this.cacheResult(cacheKey, quickFilters, 60000); // Cache for 1 minute
    return quickFilters;
  }

  /**
   * Export entries to various formats
   */
  async exportEntries(
    options: ListingOptions,
    format: 'csv' | 'json' | 'xlsx' = 'csv',
    config?: ExportConfig
  ): Promise<ExportResult> {
    const startTime = performance.now();

    // Get all entries (no pagination for export)
    const exportOptions = { ...options, pageSize: 10000, page: 1 };
    const response = await this.getEntries(exportOptions);

    const exporter = new DataExporter();
    const result = await exporter.export(response.items, format, config);

    // Log export activity
    this.logExportActivity(format, response.items.length, performance.now() - startTime);

    return result;
  }

  // =========================
  // SAVED SEARCHES METHODS
  // =========================

  /**
   * Save a search configuration for reuse
   */
  async saveSearch(data: SavedSearchCreate, userId?: string): Promise<string> {
    const id = this.generateId();
    const now = new Date();

    const savedSearch: SavedSearch = {
      id,
      ...data,
      userId: userId || null,
      isPublic: data.isPublic || false,
      tags: data.tags || [],
      createdAt: now,
      updatedAt: now,
      usageCount: 0
    };

    this.db.prepare(`
      INSERT INTO saved_searches (
        id, name, description, query_json, user_id, is_public,
        tags_json, created_at, updated_at, usage_count, shortcut
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, savedSearch.name, savedSearch.description,
      JSON.stringify(savedSearch.query), savedSearch.userId, savedSearch.isPublic,
      JSON.stringify(savedSearch.tags), savedSearch.createdAt.toISOString(),
      savedSearch.updatedAt.toISOString(), savedSearch.usageCount, savedSearch.shortcut
    );

    this.invalidateCache('saved-searches');
    return id;
  }

  /**
   * Get saved searches for a user
   */
  async getSavedSearches(userId?: string, includePublic: boolean = true): Promise<SavedSearch[]> {
    const cacheKey = `saved-searches:${userId || 'public'}:${includePublic}`;
    const cached = this.getCachedResult(cacheKey);

    if (cached) return cached;

    let whereClause = '';
    const params: any[] = [];

    if (userId) {
      if (includePublic) {
        whereClause = 'WHERE user_id = ? OR is_public = 1';
        params.push(userId);
      } else {
        whereClause = 'WHERE user_id = ?';
        params.push(userId);
      }
    } else {
      whereClause = 'WHERE is_public = 1';
    }

    const rows = this.db.prepare(`
      SELECT * FROM saved_searches
      ${whereClause}
      ORDER BY usage_count DESC, updated_at DESC
    `).all(...params);

    const savedSearches = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      query: JSON.parse(row.query_json),
      userId: row.user_id,
      isPublic: row.is_public,
      tags: JSON.parse(row.tags_json || '[]'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      usageCount: row.usage_count,
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      shortcut: row.shortcut
    }));

    this.cacheResult(cacheKey, savedSearches);
    return savedSearches;
  }

  /**
   * Execute a saved search
   */
  async executeSavedSearch(searchId: string, overrides?: Partial<ListingOptions>): Promise<ListingResponse> {
    const savedSearch = await this.getSavedSearchById(searchId);
    if (!savedSearch) {
      throw new Error(`Saved search ${searchId} not found`);
    }

    // Update usage statistics
    this.db.prepare(`
      UPDATE saved_searches
      SET usage_count = usage_count + 1, last_used = ?
      WHERE id = ?
    `).run(new Date().toISOString(), searchId);

    // Execute search with optional overrides
    const options = overrides ? { ...savedSearch.query, ...overrides } : savedSearch.query;
    return this.getEntries(options);
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(searchId: string, userId?: string): Promise<boolean> {
    let whereClause = 'id = ?';
    const params = [searchId];

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    }

    const result = this.db.prepare(`
      DELETE FROM saved_searches WHERE ${whereClause}
    `).run(...params);

    if (result.changes > 0) {
      this.invalidateCache('saved-searches');
      return true;
    }

    return false;
  }

  // =========================
  // PRIVATE HELPER METHODS
  // =========================

  private initializeOptimizations(): void {
    // Create essential indexes if they don't exist
    this.indexOptimizer.ensureListingIndexes();

    // Setup query performance monitoring
    this.setupPerformanceMonitoring();

    // Initialize cache cleanup
    this.setupCacheCleanup();
  }

  private normalizeOptions(options: ListingOptions): Required<ListingOptions> {
    return {
      page: options.page || 1,
      pageSize: Math.min(options.pageSize || 20, 100), // Limit max page size
      offset: options.offset || 0,
      sortBy: options.sortBy || 'updated_at',
      sortDirection: options.sortDirection || 'desc',
      multiSort: options.multiSort || [],
      filters: options.filters || [],
      quickFilters: options.quickFilters || [],
      searchQuery: options.searchQuery || '',
      searchFields: options.searchFields || ['all'],
      includeArchived: options.includeArchived || false,
      includeMetadata: options.includeMetadata || true,
      includeStats: options.includeStats || true
    };
  }

  private generateCacheKey(prefix: string, options: any): string {
    const normalized = JSON.stringify(options, Object.keys(options).sort());
    return `${prefix}:${this.hashString(normalized)}`;
  }

  private getCachedResult(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private cacheResult(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.cacheTimeout
    });
  }

  private invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const [key] of this.cache) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  private async buildPaginationInfo(totalItems: number, options: Required<ListingOptions>): Promise<PaginationInfo> {
    const totalPages = Math.ceil(totalItems / options.pageSize);

    return {
      currentPage: options.page,
      pageSize: options.pageSize,
      totalItems,
      totalPages,
      hasNext: options.page < totalPages,
      hasPrevious: options.page > 1,
      nextCursor: options.page < totalPages ?
        Buffer.from(`${options.page + 1}`).toString('base64') : undefined,
      previousCursor: options.page > 1 ?
        Buffer.from(`${options.page - 1}`).toString('base64') : undefined
    };
  }

  private buildSortingInfo(options: Required<ListingOptions>): SortingInfo {
    const availableSorts: SortOption[] = [
      { field: 'title', label: 'Title', defaultDirection: 'asc' },
      { field: 'category', label: 'Category', defaultDirection: 'asc' },
      { field: 'created_at', label: 'Created Date', defaultDirection: 'desc' },
      { field: 'updated_at', label: 'Last Updated', defaultDirection: 'desc' },
      { field: 'usage_count', label: 'Usage Count', defaultDirection: 'desc' },
      { field: 'success_rate', label: 'Success Rate', defaultDirection: 'desc' },
      { field: 'last_used', label: 'Last Used', defaultDirection: 'desc' }
    ];

    return {
      sortBy: options.sortBy,
      sortDirection: options.sortDirection,
      multiSort: options.multiSort,
      availableSorts
    };
  }

  private async buildFilteringInfo(options: Required<ListingOptions>): Promise<FilteringInfo> {
    const activeFilters: ActiveFilter[] = options.filters.map((filter, index) => ({
      ...filter,
      id: `filter-${index}`,
      label: this.getFilterLabel(filter),
      removable: true
    }));

    const availableFilters = await this.getFilterOptions(options);
    const quickFilters = await this.getQuickFilters();
    const filterCounts = await this.getFilterCounts(options);

    return {
      activeFilters,
      availableFilters,
      quickFilters: quickFilters.map(qf => ({
        ...qf,
        active: options.quickFilters.includes(qf.type)
      })),
      filterCounts
    };
  }

  private async buildAggregations(options: Required<ListingOptions>): Promise<AggregationData> {
    // Execute aggregation queries in parallel for performance
    const [
      categoryStats,
      tagCloud,
      severityDistribution,
      usageStats,
      timelineStats
    ] = await Promise.all([
      this.getCategoryAggregation(options),
      this.getTagAggregation(options),
      this.getSeverityAggregation(options),
      this.getUsageAggregation(options),
      this.getTimelineAggregation(options)
    ]);

    return {
      categoryStats,
      tagCloud,
      severityDistribution,
      usageStats,
      timelineStats
    };
  }

  // Additional helper methods would continue here...
  // (Implementation of specific aggregation methods, query builders, etc.)

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private setupPerformanceMonitoring(): void {
    // Implementation for query performance monitoring
  }

  private setupCacheCleanup(): void {
    // Setup automatic cache cleanup
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  // Placeholder implementations for complex methods
  private executeQuery(query: any): { items: KBEntry[]; count: number } {
    // Implementation would execute the built query
    return { items: [], count: 0 };
  }

  private calculateQueryComplexity(options: Required<ListingOptions>): number {
    // Implementation would analyze query complexity
    return 1;
  }

  private generateOptimizationRecommendations(options: Required<ListingOptions>): string[] {
    // Implementation would generate performance recommendations
    return [];
  }

  private getFilterLabel(filter: FilterCriteria): string {
    // Implementation would generate human-readable filter labels
    return `${filter.field} ${filter.operator} ${filter.value}`;
  }

  // Placeholder methods for aggregations
  private async getCategoryOptions(): Promise<{ value: any; label: string; count?: number }[]> { return []; }
  private async getSeverityOptions(): Promise<{ value: any; label: string; count?: number }[]> { return []; }
  private async getTagOptions(): Promise<{ value: any; label: string; count?: number }[]> { return []; }
  private async getMaxUsageCount(): Promise<number> { return 0; }
  private async getCreatorOptions(): Promise<{ value: any; label: string; count?: number }[]> { return []; }
  private async getQuickFilterCount(type: QuickFilterType): Promise<number> { return 0; }
  private async getSavedSearchById(id: string): Promise<SavedSearch | null> { return null; }
  private async getFilterCounts(options: Required<ListingOptions>): Promise<Record<string, number>> { return {}; }
  private async getCategoryAggregation(options: Required<ListingOptions>): Promise<CategoryAggregation[]> { return []; }
  private async getTagAggregation(options: Required<ListingOptions>): Promise<TagAggregation[]> { return []; }
  private async getSeverityAggregation(options: Required<ListingOptions>): Promise<SeverityAggregation[]> { return []; }
  private async getUsageAggregation(options: Required<ListingOptions>): Promise<UsageAggregation> {
    return { totalViews: 0, uniqueUsers: 0, avgSessionTime: 0, bounceRate: 0, conversionRate: 0 };
  }
  private async getTimelineAggregation(options: Required<ListingOptions>): Promise<TimelineAggregation[]> { return []; }
  private logExportActivity(format: string, count: number, duration: number): void {}
}

// =========================
// SUPPORTING CLASSES
// =========================

class QueryBuilder {
  constructor(private db: Database) {}

  buildListingQuery(options: Required<ListingOptions>): any {
    // Implementation would build optimized SQL queries
    return {};
  }
}

class IndexOptimizer {
  constructor(private db: Database) {}

  ensureListingIndexes(): void {
    // Implementation would ensure optimal indexes exist
  }
}

class DataExporter {
  async export(items: any[], format: string, config?: any): Promise<ExportResult> {
    // Implementation would handle data export
    return { success: true, filePath: '', size: 0, duration: 0 };
  }
}

export interface ExportConfig {
  includeMetadata?: boolean;
  dateFormat?: string;
  delimiter?: string;
  fields?: string[];
}

export interface ExportResult {
  success: boolean;
  filePath: string;
  size: number;
  duration: number;
  error?: string;
}