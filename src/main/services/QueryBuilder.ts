/**
 * Advanced SQL Query Builder for KB Listing
 * Optimized for complex filtering, sorting, and pagination with performance focus
 */

import { Database } from 'better-sqlite3';
import { ListingOptions, FilterCriteria, FilterOperator, SortField } from './KBListingService';

export class QueryBuilder {
  private db: Database;
  private baseQuery: string;
  private joins: string[] = [];
  private whereConditions: string[] = [];
  private havingConditions: string[] = [];
  private orderBy: string[] = [];
  private groupBy: string[] = [];
  private parameters: any[] = [];

  constructor(db: Database) {
    this.db = db;
    this.reset();
  }

  /**
   * Build optimized listing query with all features
   */
  buildListingQuery(options: Required<ListingOptions>) {
    this.reset();

    // Base query with essential joins
    this.setupBaseQuery();

    // Apply filters
    this.applyFilters(options.filters);
    this.applyQuickFilters(options.quickFilters);
    this.applySearchQuery(options.searchQuery, options.searchFields);

    // Apply sorting
    this.applySorting(options.sortBy, options.sortDirection, options.multiSort);

    // Handle archived entries
    if (!options.includeArchived) {
      this.whereConditions.push('e.archived = FALSE');
    }

    // Build final queries
    const countQuery = this.buildCountQuery();
    const dataQuery = this.buildDataQuery(options.page, options.pageSize);

    return {
      countQuery,
      dataQuery,
      parameters: this.parameters,
    };
  }

  /**
   * Build aggregation query for categories
   */
  buildCategoryAggregationQuery(filters?: FilterCriteria[]): string {
    this.reset();
    this.setupBaseQuery();

    if (filters) {
      this.applyFilters(filters);
    }

    return `
      SELECT
        e.category,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM kb_entries WHERE archived = FALSE), 2) as percentage,
        COALESCE(AVG(CAST(e.success_count AS REAL) / NULLIF(e.success_count + e.failure_count, 0)) * 100, 0) as avg_rating,
        COALESCE(AVG(e.usage_count), 0) as avg_usage
      FROM kb_entries e
      ${this.joins.join('\n')}
      WHERE ${this.whereConditions.length > 0 ? this.whereConditions.join(' AND ') : '1=1'}
      GROUP BY e.category
      ORDER BY count DESC
    `;
  }

  /**
   * Build tag cloud aggregation query
   */
  buildTagAggregationQuery(filters?: FilterCriteria[]): string {
    this.reset();
    this.setupBaseQuery();
    this.joins.push('LEFT JOIN kb_tags t ON e.id = t.entry_id');

    if (filters) {
      this.applyFilters(filters);
    }

    return `
      WITH tag_stats AS (
        SELECT
          t.tag,
          COUNT(*) as count,
          COUNT(*) * 100.0 / (SELECT COUNT(DISTINCT entry_id) FROM kb_tags) as popularity
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        ${this.whereConditions.length > 0 ? 'WHERE ' + this.whereConditions.join(' AND ') : ''}
        GROUP BY t.tag
        HAVING t.tag IS NOT NULL
      ),
      tag_trends AS (
        SELECT
          t.tag,
          COUNT(CASE WHEN e.created_at > datetime('now', '-30 days') THEN 1 END) as recent_count,
          COUNT(CASE WHEN e.created_at <= datetime('now', '-30 days') THEN 1 END) as older_count
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE t.tag IS NOT NULL
        GROUP BY t.tag
      )
      SELECT
        ts.tag,
        ts.count,
        ts.popularity,
        CASE
          WHEN tt.recent_count > tt.older_count THEN 'up'
          WHEN tt.recent_count < tt.older_count THEN 'down'
          ELSE 'stable'
        END as trend_direction
      FROM tag_stats ts
      LEFT JOIN tag_trends tt ON ts.tag = tt.tag
      ORDER BY ts.popularity DESC
      LIMIT 50
    `;
  }

  /**
   * Build timeline aggregation query
   */
  buildTimelineAggregationQuery(period: 'day' | 'week' | 'month' = 'week'): string {
    const dateFormat = {
      day: '%Y-%m-%d',
      week: '%Y-W%W',
      month: '%Y-%m',
    }[period];

    return `
      WITH timeline_base AS (
        SELECT
          strftime('${dateFormat}', e.created_at) as period,
          COUNT(CASE WHEN e.created_at IS NOT NULL THEN 1 END) as created_count,
          COUNT(CASE WHEN e.updated_at > e.created_at THEN 1 END) as updated_count
        FROM kb_entries e
        WHERE e.created_at >= datetime('now', '-90 days')
        GROUP BY strftime('${dateFormat}', e.created_at)
      ),
      usage_stats AS (
        SELECT
          strftime('${dateFormat}', um.timestamp) as period,
          COUNT(*) as view_count,
          AVG(CASE WHEN um.action = 'rate_success' THEN 1.0 ELSE 0.0 END) as success_rate
        FROM usage_metrics um
        WHERE um.timestamp >= datetime('now', '-90 days')
        GROUP BY strftime('${dateFormat}', um.timestamp)
      )
      SELECT
        COALESCE(tb.period, us.period) as period,
        COALESCE(tb.created_count, 0) as created_count,
        COALESCE(tb.updated_count, 0) as updated_count,
        COALESCE(us.view_count, 0) as view_count,
        COALESCE(us.success_rate * 100, 0) as success_rate
      FROM timeline_base tb
      FULL OUTER JOIN usage_stats us ON tb.period = us.period
      ORDER BY period DESC
      LIMIT 12
    `;
  }

  // =========================
  // PRIVATE METHODS
  // =========================

  private reset(): void {
    this.baseQuery = '';
    this.joins = [];
    this.whereConditions = [];
    this.havingConditions = [];
    this.orderBy = [];
    this.groupBy = [];
    this.parameters = [];
  }

  private setupBaseQuery(): void {
    this.baseQuery = `
      SELECT DISTINCT
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        COALESCE(
          CASE WHEN (e.success_count + e.failure_count) > 0
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
               ELSE 0 END, 0
        ) as success_rate,
        COALESCE(e.usage_count, 0) as usage_count
      FROM kb_entries e
    `;

    // Always include tags join for completeness
    this.joins.push('LEFT JOIN kb_tags t ON e.id = t.entry_id');
    this.groupBy.push('e.id');
  }

  private applyFilters(filters: FilterCriteria[]): void {
    filters.forEach(filter => {
      const condition = this.buildFilterCondition(filter);
      if (condition) {
        this.whereConditions.push(condition);
      }
    });
  }

  private buildFilterCondition(filter: FilterCriteria): string | null {
    const { field, operator, value, valueType } = filter;

    // Handle null/undefined values
    if (value === null || value === undefined) {
      return operator === 'is_null'
        ? `${field} IS NULL`
        : operator === 'is_not_null'
          ? `${field} IS NOT NULL`
          : null;
    }

    switch (operator) {
      case 'eq':
        this.parameters.push(value);
        return `${this.getFieldPath(field)} = ?`;

      case 'ne':
        this.parameters.push(value);
        return `${this.getFieldPath(field)} != ?`;

      case 'gt':
        this.parameters.push(value);
        return `${this.getFieldPath(field)} > ?`;

      case 'gte':
        this.parameters.push(value);
        return `${this.getFieldPath(field)} >= ?`;

      case 'lt':
        this.parameters.push(value);
        return `${this.getFieldPath(field)} < ?`;

      case 'lte':
        this.parameters.push(value);
        return `${this.getFieldPath(field)} <= ?`;

      case 'contains':
        this.parameters.push(`%${value}%`);
        return `${this.getFieldPath(field)} LIKE ?`;

      case 'not_contains':
        this.parameters.push(`%${value}%`);
        return `${this.getFieldPath(field)} NOT LIKE ?`;

      case 'starts_with':
        this.parameters.push(`${value}%`);
        return `${this.getFieldPath(field)} LIKE ?`;

      case 'ends_with':
        this.parameters.push(`%${value}`);
        return `${this.getFieldPath(field)} LIKE ?`;

      case 'in':
        if (!Array.isArray(value) || value.length === 0) return null;
        const placeholders = value.map(() => '?').join(', ');
        this.parameters.push(...value);
        return `${this.getFieldPath(field)} IN (${placeholders})`;

      case 'not_in':
        if (!Array.isArray(value) || value.length === 0) return null;
        const notPlaceholders = value.map(() => '?').join(', ');
        this.parameters.push(...value);
        return `${this.getFieldPath(field)} NOT IN (${notPlaceholders})`;

      case 'between':
        if (!Array.isArray(value) || value.length !== 2) return null;
        this.parameters.push(value[0], value[1]);
        return `${this.getFieldPath(field)} BETWEEN ? AND ?`;

      case 'regex':
        this.parameters.push(value);
        return `${this.getFieldPath(field)} REGEXP ?`;

      case 'fuzzy_match':
        // Implement fuzzy matching using LIKE with wildcards
        const fuzzyValue = value.toString().split('').join('%');
        this.parameters.push(`%${fuzzyValue}%`);
        return `${this.getFieldPath(field)} LIKE ?`;

      default:
        console.warn(`Unknown filter operator: ${operator}`);
        return null;
    }
  }

  private getFieldPath(field: string): string {
    // Map field names to actual database columns/expressions
    const fieldMappings: Record<string, string> = {
      tags: 't.tag',
      success_rate: `CASE WHEN (e.success_count + e.failure_count) > 0
                            THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
                            ELSE 0 END`,
      created_by: 'e.created_by',
      category: 'e.category',
      severity: 'e.severity',
      title: 'e.title',
      problem: 'e.problem',
      solution: 'e.solution',
      created_at: 'e.created_at',
      updated_at: 'e.updated_at',
      last_used: 'e.last_used',
      usage_count: 'e.usage_count',
    };

    return fieldMappings[field] || `e.${field}`;
  }

  private applyQuickFilters(quickFilters: string[]): void {
    quickFilters.forEach(filter => {
      switch (filter) {
        case 'recent':
          this.whereConditions.push("e.created_at >= datetime('now', '-7 days')");
          break;

        case 'popular':
          this.whereConditions.push('e.usage_count >= 10');
          break;

        case 'highly_rated':
          this.whereConditions.push(`
            CASE WHEN (e.success_count + e.failure_count) > 0
                 THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
                 ELSE 0 END >= 0.8
          `);
          break;

        case 'frequently_used':
          this.whereConditions.push("e.last_used >= datetime('now', '-30 days')");
          break;

        case 'needs_review':
          this.whereConditions.push(`
            (e.success_count + e.failure_count) > 5 AND
            CASE WHEN (e.success_count + e.failure_count) > 0
                 THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
                 ELSE 0 END < 0.6
          `);
          break;
      }
    });
  }

  private applySearchQuery(query: string, fields: string[]): void {
    if (!query.trim()) return;

    const searchConditions: string[] = [];

    if (fields.includes('all') || fields.includes('title')) {
      this.parameters.push(`%${query}%`);
      searchConditions.push('e.title LIKE ?');
    }

    if (fields.includes('all') || fields.includes('problem')) {
      this.parameters.push(`%${query}%`);
      searchConditions.push('e.problem LIKE ?');
    }

    if (fields.includes('all') || fields.includes('solution')) {
      this.parameters.push(`%${query}%`);
      searchConditions.push('e.solution LIKE ?');
    }

    if (fields.includes('all') || fields.includes('category')) {
      this.parameters.push(`%${query}%`);
      searchConditions.push('e.category LIKE ?');
    }

    if (fields.includes('all') || fields.includes('tags')) {
      this.parameters.push(`%${query}%`);
      searchConditions.push('t.tag LIKE ?');
    }

    if (searchConditions.length > 0) {
      this.whereConditions.push(`(${searchConditions.join(' OR ')})`);
    }
  }

  private applySorting(
    sortBy: SortField,
    direction: 'asc' | 'desc',
    multiSort?: SortField[]
  ): void {
    // Handle multi-sort first
    if (multiSort && multiSort.length > 0) {
      multiSort.forEach(field => {
        this.orderBy.push(`${this.getSortField(field)} ${direction}`);
      });
    } else {
      // Single sort
      this.orderBy.push(`${this.getSortField(sortBy)} ${direction.toUpperCase()}`);
    }

    // Always add a stable sort for consistent pagination
    if (!this.orderBy.some(o => o.includes('e.id'))) {
      this.orderBy.push('e.id ASC');
    }
  }

  private getSortField(field: SortField): string {
    const sortMappings: Record<SortField, string> = {
      title: 'e.title',
      category: 'e.category',
      created_at: 'e.created_at',
      updated_at: 'e.updated_at',
      usage_count: 'e.usage_count',
      success_rate: `CASE WHEN (e.success_count + e.failure_count) > 0
                            THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
                            ELSE 0 END`,
      rating: `CASE WHEN (e.success_count + e.failure_count) > 0
                      THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
                      ELSE 0 END`,
      last_used: 'COALESCE(e.last_used, e.created_at)',
      relevance: 'e.usage_count', // Default relevance to usage count
    };

    return sortMappings[field] || `e.${field}`;
  }

  private buildCountQuery(): string {
    const whereClause =
      this.whereConditions.length > 0 ? 'WHERE ' + this.whereConditions.join(' AND ') : '';

    return `
      SELECT COUNT(DISTINCT e.id) as total
      FROM kb_entries e
      ${this.joins.join('\n')}
      ${whereClause}
    `;
  }

  private buildDataQuery(page: number, pageSize: number): string {
    const whereClause =
      this.whereConditions.length > 0 ? 'WHERE ' + this.whereConditions.join(' AND ') : '';

    const groupByClause = this.groupBy.length > 0 ? 'GROUP BY ' + this.groupBy.join(', ') : '';

    const orderByClause = this.orderBy.length > 0 ? 'ORDER BY ' + this.orderBy.join(', ') : '';

    const havingClause =
      this.havingConditions.length > 0 ? 'HAVING ' + this.havingConditions.join(' AND ') : '';

    const offset = (page - 1) * pageSize;

    return `
      ${this.baseQuery}
      ${this.joins.join('\n')}
      ${whereClause}
      ${groupByClause}
      ${havingClause}
      ${orderByClause}
      LIMIT ${pageSize} OFFSET ${offset}
    `;
  }
}

/**
 * Index Strategy for optimal KB listing performance
 */
export class IndexOptimizer {
  constructor(private db: Database) {}

  ensureListingIndexes(): void {
    const indexes = [
      // Core performance indexes
      {
        name: 'idx_kb_entries_listing_primary',
        table: 'kb_entries',
        columns: ['archived', 'category', 'created_at'],
        unique: false,
      },

      // Sorting optimization indexes
      {
        name: 'idx_kb_entries_usage_stats',
        table: 'kb_entries',
        columns: ['usage_count', 'success_count', 'failure_count'],
        unique: false,
      },

      {
        name: 'idx_kb_entries_timestamps',
        table: 'kb_entries',
        columns: ['updated_at', 'created_at', 'last_used'],
        unique: false,
      },

      // Search optimization indexes
      {
        name: 'idx_kb_entries_search',
        table: 'kb_entries',
        columns: ['category', 'severity', 'archived'],
        unique: false,
      },

      // Tag filtering optimization
      {
        name: 'idx_kb_tags_lookup',
        table: 'kb_tags',
        columns: ['tag', 'entry_id'],
        unique: false,
      },

      // Foreign key optimization
      {
        name: 'idx_kb_tags_entry_ref',
        table: 'kb_tags',
        columns: ['entry_id'],
        unique: false,
      },

      // Usage metrics optimization
      {
        name: 'idx_usage_metrics_analysis',
        table: 'usage_metrics',
        columns: ['entry_id', 'timestamp', 'action'],
        unique: false,
      },

      // Saved searches optimization
      {
        name: 'idx_saved_searches_user',
        table: 'saved_searches',
        columns: ['user_id', 'is_public', 'usage_count'],
        unique: false,
      },
    ];

    indexes.forEach(index => {
      this.createIndexIfNotExists(index);
    });

    // Analyze tables after creating indexes
    this.analyzeTablesForOptimization();
  }

  private createIndexIfNotExists(index: any): void {
    try {
      const indexExists = this.db
        .prepare(
          `
        SELECT name FROM sqlite_master
        WHERE type='index' AND name=?
      `
        )
        .get(index.name);

      if (!indexExists) {
        const uniqueClause = index.unique ? 'UNIQUE' : '';
        const sql = `
          CREATE ${uniqueClause} INDEX ${index.name}
          ON ${index.table} (${index.columns.join(', ')})
        `;

        console.log(`Creating index: ${index.name}`);
        this.db.exec(sql);
      }
    } catch (error) {
      console.warn(`Failed to create index ${index.name}:`, error.message);
    }
  }

  private analyzeTablesForOptimization(): void {
    const tables = ['kb_entries', 'kb_tags', 'usage_metrics', 'saved_searches'];

    tables.forEach(table => {
      try {
        this.db.exec(`ANALYZE ${table}`);
      } catch (error) {
        console.warn(`Failed to analyze table ${table}:`, error.message);
      }
    });
  }
}
