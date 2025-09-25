/**
 * Search Filter Engine - Advanced Filtering and Faceting
 *
 * Features:
 * - Dynamic filter generation from search results
 * - Multi-level hierarchical filtering
 * - Real-time filter value updates
 * - Smart filter suggestions
 * - Performance-optimized filter queries
 */

import Database from 'better-sqlite3';
import { SearchFilter, SearchFacet, FTS5SearchOptions } from '../../../types/services';

export interface FilterConfig {
  enableDynamicFilters: boolean;
  maxFilterValues: number;
  cacheTimeout: number;
  hierarchicalFilters: string[];
  customFilters: CustomFilter[];
}

export interface CustomFilter {
  name: string;
  type: 'range' | 'list' | 'boolean' | 'date';
  source: 'field' | 'computed' | 'external';
  options?: {
    min?: number;
    max?: number;
    values?: string[];
    defaultValue?: any;
  };
}

export interface FilterState {
  activeFilters: Map<string, any>;
  availableFilters: SearchFacet[];
  filterHistory: Array<{
    timestamp: Date;
    filters: Map<string, any>;
    resultCount: number;
  }>;
}

export interface FilterAnalytics {
  mostUsedFilters: Array<{ filter: string; usage: number }>;
  filterEffectiveness: Array<{ filter: string; avgReduction: number }>;
  filterCombinations: Array<{ combination: string[]; frequency: number }>;
}

/**
 * Advanced Search Filter Engine
 * Provides dynamic filtering and faceting capabilities
 */
export class SearchFilterEngine {
  private db: Database.Database;
  private config: FilterConfig;
  private filterCache = new Map<string, { facets: SearchFacet[]; timestamp: number }>();
  private filterUsageStats = new Map<string, number>();
  private filterState: FilterState;

  // Prepared statements
  private statements: {
    getFacetCounts: Database.Statement;
    getDateRanges: Database.Statement;
    getNumericRanges: Database.Statement;
    getFilteredCount: Database.Statement;
    getHierarchicalCounts: Database.Statement;
  };

  constructor(db: Database.Database, config: Partial<FilterConfig> = {}) {
    this.db = db;
    this.config = {
      enableDynamicFilters: true,
      maxFilterValues: 20,
      cacheTimeout: 300000, // 5 minutes
      hierarchicalFilters: ['category', 'tags'],
      customFilters: [],
      ...config,
    };

    this.filterState = {
      activeFilters: new Map(),
      availableFilters: [],
      filterHistory: [],
    };

    this.prepareStatements();
    this.setupCacheCleanup();
  }

  /**
   * Generate facets for search results
   */
  async generateFacets(
    query: string,
    options: FTS5SearchOptions,
    resultCount?: number
  ): Promise<SearchFacet[]> {
    try {
      const cacheKey = this.generateFacetCacheKey(query, options);

      // Check cache first
      const cached = this.getFacetsFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const facets: SearchFacet[] = [];

      // Generate standard facets
      await Promise.all([
        this.generateCategoryFacet(query, options).then(f => f && facets.push(f)),
        this.generateTagsFacet(query, options).then(f => f && facets.push(f)),
        this.generateDateFacet(query, options).then(f => f && facets.push(f)),
        this.generateUsageFacet(query, options).then(f => f && facets.push(f)),
      ]);

      // Generate custom facets
      for (const customFilter of this.config.customFilters) {
        const facet = await this.generateCustomFacet(customFilter, query, options);
        if (facet) {
          facets.push(facet);
        }
      }

      // Cache the results
      this.setFacetsInCache(cacheKey, facets);

      return facets;
    } catch (error) {
      console.error('Error generating facets:', error);
      return [];
    }
  }

  /**
   * Apply filters to search query
   */
  applyFilters(
    baseQuery: string,
    filters: Map<string, any>,
    options: FTS5SearchOptions
  ): {
    modifiedQuery: string;
    additionalWhereClause: string;
    parameters: any[];
  } {
    let modifiedQuery = baseQuery;
    const whereClauses: string[] = [];
    const parameters: any[] = [];

    filters.forEach((value, filterName) => {
      const filterClause = this.buildFilterClause(filterName, value, parameters);
      if (filterClause) {
        if (filterName === 'category' || filterName === 'tags') {
          // Add to FTS query for text-based filters
          modifiedQuery = this.addToFTSQuery(modifiedQuery, filterName, value);
        } else {
          // Add to WHERE clause for structured filters
          whereClauses.push(filterClause);
        }
      }
    });

    // Record filter usage
    this.recordFilterUsage(filters);

    return {
      modifiedQuery,
      additionalWhereClause: whereClauses.length > 0 ? whereClauses.join(' AND ') : '',
      parameters,
    };
  }

  /**
   * Get smart filter suggestions based on current results
   */
  async getFilterSuggestions(
    query: string,
    currentFilters: Map<string, any>,
    resultCount: number
  ): Promise<
    Array<{
      filter: string;
      suggestedValue: any;
      expectedReduction: number;
      reason: string;
    }>
  > {
    const suggestions = [];

    try {
      // If too many results, suggest narrowing filters
      if (resultCount > 100) {
        const narrowingSuggestions = await this.generateNarrowingSuggestions(query, currentFilters);
        suggestions.push(...narrowingSuggestions);
      }

      // If too few results, suggest broadening filters
      if (resultCount < 5 && currentFilters.size > 0) {
        const broadeningsuggestions = await this.generateBroadeninSuggestions(currentFilters);
        suggestions.push(...broadeningsuggestions);
      }

      // Suggest popular filter combinations
      const popularSuggestions = await this.generatePopularFilterSuggestions(query, currentFilters);
      suggestions.push(...popularSuggestions);

      return suggestions.slice(0, 5); // Limit to top 5 suggestions
    } catch (error) {
      console.error('Error generating filter suggestions:', error);
      return [];
    }
  }

  /**
   * Update filter state
   */
  updateFilterState(filters: Map<string, any>, resultCount: number): void {
    // Update active filters
    this.filterState.activeFilters = new Map(filters);

    // Add to history
    this.filterState.filterHistory.push({
      timestamp: new Date(),
      filters: new Map(filters),
      resultCount,
    });

    // Keep only recent history (last 50 filter states)
    if (this.filterState.filterHistory.length > 50) {
      this.filterState.filterHistory = this.filterState.filterHistory.slice(-50);
    }
  }

  /**
   * Get filter analytics
   */
  getFilterAnalytics(): FilterAnalytics {
    const mostUsedFilters = Array.from(this.filterUsageStats.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([filter, usage]) => ({ filter, usage }));

    const filterEffectiveness = this.calculateFilterEffectiveness();
    const filterCombinations = this.analyzeFilterCombinations();

    return {
      mostUsedFilters,
      filterEffectiveness,
      filterCombinations,
    };
  }

  /**
   * Reset filter state
   */
  resetFilters(): void {
    this.filterState.activeFilters.clear();
    this.filterState.availableFilters = [];
  }

  /**
   * Get current filter state
   */
  getFilterState(): FilterState {
    return { ...this.filterState };
  }

  // Private Methods

  private prepareStatements(): void {
    this.statements = {
      getFacetCounts: this.db.prepare(`
        SELECT
          e.category,
          COUNT(*) as count
        FROM kb_fts f
        INNER JOIN kb_entries e ON f.id = e.id
        WHERE kb_fts MATCH ?
        GROUP BY e.category
        ORDER BY count DESC
        LIMIT ?
      `),

      getDateRanges: this.db.prepare(`
        SELECT
          MIN(created_at) as min_date,
          MAX(created_at) as max_date,
          COUNT(*) as total_count
        FROM kb_fts f
        INNER JOIN kb_entries e ON f.id = e.id
        WHERE kb_fts MATCH ?
      `),

      getNumericRanges: this.db.prepare(`
        SELECT
          MIN(usage_count) as min_usage,
          MAX(usage_count) as max_usage,
          AVG(usage_count) as avg_usage
        FROM kb_fts f
        INNER JOIN kb_entries e ON f.id = e.id
        WHERE kb_fts MATCH ?
      `),

      getFilteredCount: this.db.prepare(`
        SELECT COUNT(*) as count
        FROM kb_fts f
        INNER JOIN kb_entries e ON f.id = e.id
        WHERE kb_fts MATCH ? AND e.category = ?
      `),

      getHierarchicalCounts: this.db.prepare(`
        SELECT
          t.tag,
          COUNT(*) as count
        FROM kb_fts f
        INNER JOIN kb_entries e ON f.id = e.id
        INNER JOIN kb_tags t ON e.id = t.entry_id
        WHERE kb_fts MATCH ?
        GROUP BY t.tag
        ORDER BY count DESC
        LIMIT ?
      `),
    };
  }

  private async generateCategoryFacet(
    query: string,
    options: FTS5SearchOptions
  ): Promise<SearchFacet | null> {
    try {
      const results = this.statements.getFacetCounts.all(
        query,
        this.config.maxFilterValues
      ) as Array<{ category: string; count: number }>;

      if (results.length === 0) return null;

      return {
        field: 'category',
        values: results.map(r => ({
          value: r.category,
          count: r.count,
          selected: options.category === r.category,
        })),
      };
    } catch (error) {
      console.error('Error generating category facet:', error);
      return null;
    }
  }

  private async generateTagsFacet(
    query: string,
    options: FTS5SearchOptions
  ): Promise<SearchFacet | null> {
    try {
      const results = this.statements.getHierarchicalCounts.all(
        query,
        this.config.maxFilterValues
      ) as Array<{ tag: string; count: number }>;

      if (results.length === 0) return null;

      return {
        field: 'tags',
        values: results.map(r => ({
          value: r.tag,
          count: r.count,
          selected: options.tags?.includes(r.tag) || false,
        })),
      };
    } catch (error) {
      console.error('Error generating tags facet:', error);
      return null;
    }
  }

  private async generateDateFacet(
    query: string,
    options: FTS5SearchOptions
  ): Promise<SearchFacet | null> {
    try {
      const dateRange = this.statements.getDateRanges.get(query) as
        | {
            min_date: string;
            max_date: string;
            total_count: number;
          }
        | undefined;

      if (!dateRange || dateRange.total_count === 0) return null;

      // Generate date range buckets
      const minDate = new Date(dateRange.min_date);
      const maxDate = new Date(dateRange.max_date);
      const daysDiff = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

      const buckets = this.generateDateBuckets(minDate, maxDate, daysDiff);

      return {
        field: 'created_date',
        values: buckets.map(bucket => ({
          value: bucket.label,
          count: bucket.count,
          selected: false, // Would need to check against date_range filter
        })),
      };
    } catch (error) {
      console.error('Error generating date facet:', error);
      return null;
    }
  }

  private async generateUsageFacet(
    query: string,
    options: FTS5SearchOptions
  ): Promise<SearchFacet | null> {
    try {
      const usageRange = this.statements.getNumericRanges.get(query) as
        | {
            min_usage: number;
            max_usage: number;
            avg_usage: number;
          }
        | undefined;

      if (!usageRange) return null;

      // Generate usage buckets
      const buckets = [
        { label: 'Unused (0)', min: 0, max: 0 },
        { label: 'Low usage (1-5)', min: 1, max: 5 },
        { label: 'Medium usage (6-20)', min: 6, max: 20 },
        { label: 'High usage (21-50)', min: 21, max: 50 },
        { label: 'Very high usage (50+)', min: 51, max: Number.MAX_SAFE_INTEGER },
      ];

      // Get counts for each bucket (simplified - would need separate queries)
      const values = buckets.map(bucket => ({
        value: bucket.label,
        count: 0, // Would be calculated with actual queries
        selected: false,
      }));

      return {
        field: 'usage_level',
        values,
      };
    } catch (error) {
      console.error('Error generating usage facet:', error);
      return null;
    }
  }

  private async generateCustomFacet(
    customFilter: CustomFilter,
    query: string,
    options: FTS5SearchOptions
  ): Promise<SearchFacet | null> {
    // Implementation would depend on the custom filter configuration
    // This is a placeholder for extensible custom filters
    return null;
  }

  private buildFilterClause(filterName: string, value: any, parameters: any[]): string | null {
    switch (filterName) {
      case 'category':
        parameters.push(value);
        return 'e.category = ?';

      case 'tags':
        if (Array.isArray(value)) {
          const placeholders = value.map(() => '?').join(',');
          parameters.push(...value);
          return `e.id IN (
            SELECT entry_id FROM kb_tags
            WHERE tag IN (${placeholders})
          )`;
        }
        parameters.push(value);
        return `e.id IN (
          SELECT entry_id FROM kb_tags
          WHERE tag = ?
        )`;

      case 'date_range':
        if (value.from) {
          parameters.push(value.from.toISOString());
          if (value.to) {
            parameters.push(value.to.toISOString());
            return 'e.created_at BETWEEN ? AND ?';
          }
          return 'e.created_at >= ?';
        }
        if (value.to) {
          parameters.push(value.to.toISOString());
          return 'e.created_at <= ?';
        }
        return null;

      case 'usage_range':
        if (value.min !== undefined && value.max !== undefined) {
          parameters.push(value.min, value.max);
          return 'e.usage_count BETWEEN ? AND ?';
        }
        if (value.min !== undefined) {
          parameters.push(value.min);
          return 'e.usage_count >= ?';
        }
        if (value.max !== undefined) {
          parameters.push(value.max);
          return 'e.usage_count <= ?';
        }
        return null;

      default:
        return null;
    }
  }

  private addToFTSQuery(baseQuery: string, filterName: string, value: any): string {
    if (filterName === 'category') {
      return `${baseQuery} AND category:${value}`;
    }
    if (filterName === 'tags') {
      if (Array.isArray(value)) {
        const tagQuery = value.map(tag => `tags:${tag}`).join(' OR ');
        return `${baseQuery} AND (${tagQuery})`;
      }
      return `${baseQuery} AND tags:${value}`;
    }
    return baseQuery;
  }

  private generateDateBuckets(
    minDate: Date,
    maxDate: Date,
    daysDiff: number
  ): Array<{ label: string; count: number }> {
    if (daysDiff <= 30) {
      return [
        { label: 'Last 7 days', count: 0 },
        { label: 'Last 30 days', count: 0 },
        { label: 'Older', count: 0 },
      ];
    } else if (daysDiff <= 365) {
      return [
        { label: 'Last month', count: 0 },
        { label: 'Last 3 months', count: 0 },
        { label: 'Last 6 months', count: 0 },
        { label: 'This year', count: 0 },
        { label: 'Older', count: 0 },
      ];
    } else {
      return [
        { label: 'Last year', count: 0 },
        { label: 'Last 2 years', count: 0 },
        { label: 'Older', count: 0 },
      ];
    }
  }

  private async generateNarrowingSuggestions(
    query: string,
    currentFilters: Map<string, any>
  ): Promise<
    Array<{
      filter: string;
      suggestedValue: any;
      expectedReduction: number;
      reason: string;
    }>
  > {
    const suggestions = [];

    // Suggest category filter if not already applied
    if (!currentFilters.has('category')) {
      const categoryResults = this.statements.getFacetCounts.all(query, 3) as Array<{
        category: string;
        count: number;
      }>;

      if (categoryResults.length > 0) {
        const topCategory = categoryResults[0];
        suggestions.push({
          filter: 'category',
          suggestedValue: topCategory.category,
          expectedReduction: 0.7, // Estimated
          reason: `Most results are in ${topCategory.category} category`,
        });
      }
    }

    // Suggest popular tags if not already applied
    if (!currentFilters.has('tags')) {
      const tagResults = this.statements.getHierarchicalCounts.all(query, 3) as Array<{
        tag: string;
        count: number;
      }>;

      if (tagResults.length > 0) {
        const topTag = tagResults[0];
        suggestions.push({
          filter: 'tags',
          suggestedValue: topTag.tag,
          expectedReduction: 0.5, // Estimated
          reason: `Many results are tagged with "${topTag.tag}"`,
        });
      }
    }

    return suggestions;
  }

  private async generateBroadeninSuggestions(currentFilters: Map<string, any>): Promise<
    Array<{
      filter: string;
      suggestedValue: any;
      expectedReduction: number;
      reason: string;
    }>
  > {
    const suggestions = [];

    // Suggest removing restrictive filters
    currentFilters.forEach((value, filterName) => {
      suggestions.push({
        filter: filterName,
        suggestedValue: null, // null means remove the filter
        expectedReduction: -0.5, // Negative means increase results
        reason: `Remove ${filterName} filter to see more results`,
      });
    });

    return suggestions;
  }

  private async generatePopularFilterSuggestions(
    query: string,
    currentFilters: Map<string, any>
  ): Promise<
    Array<{
      filter: string;
      suggestedValue: any;
      expectedReduction: number;
      reason: string;
    }>
  > {
    // This would analyze historical filter usage patterns
    // For now, return empty array
    return [];
  }

  private generateFacetCacheKey(query: string, options: FTS5SearchOptions): string {
    const keyData = {
      query,
      category: options.category,
      tags: options.tags,
    };
    return `facets:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  private getFacetsFromCache(key: string): SearchFacet[] | null {
    const cached = this.filterCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.config.cacheTimeout) {
      this.filterCache.delete(key);
      return null;
    }

    return cached.facets;
  }

  private setFacetsInCache(key: string, facets: SearchFacet[]): void {
    // Limit cache size
    if (this.filterCache.size >= 100) {
      const oldestKey = this.filterCache.keys().next().value;
      this.filterCache.delete(oldestKey);
    }

    this.filterCache.set(key, {
      facets,
      timestamp: Date.now(),
    });
  }

  private recordFilterUsage(filters: Map<string, any>): void {
    filters.forEach((value, filterName) => {
      const currentCount = this.filterUsageStats.get(filterName) || 0;
      this.filterUsageStats.set(filterName, currentCount + 1);
    });
  }

  private calculateFilterEffectiveness(): Array<{ filter: string; avgReduction: number }> {
    // Analyze filter history to calculate how much each filter reduces results
    const effectiveness = new Map<string, number[]>();

    this.filterState.filterHistory.forEach(state => {
      state.filters.forEach((value, filterName) => {
        if (!effectiveness.has(filterName)) {
          effectiveness.set(filterName, []);
        }
        // This would need more sophisticated analysis
        effectiveness.get(filterName)!.push(0.5); // Placeholder
      });
    });

    return Array.from(effectiveness.entries()).map(([filter, reductions]) => ({
      filter,
      avgReduction: reductions.reduce((a, b) => a + b, 0) / reductions.length,
    }));
  }

  private analyzeFilterCombinations(): Array<{ combination: string[]; frequency: number }> {
    const combinations = new Map<string, number>();

    this.filterState.filterHistory.forEach(state => {
      if (state.filters.size > 1) {
        const combo = Array.from(state.filters.keys()).sort().join(',');
        combinations.set(combo, (combinations.get(combo) || 0) + 1);
      }
    });

    return Array.from(combinations.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([combo, frequency]) => ({
        combination: combo.split(','),
        frequency,
      }));
  }

  private setupCacheCleanup(): void {
    // Clean expired cache entries every 10 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.filterCache) {
        if (now - cached.timestamp > this.config.cacheTimeout) {
          this.filterCache.delete(key);
        }
      }
    }, 600000);
  }
}
