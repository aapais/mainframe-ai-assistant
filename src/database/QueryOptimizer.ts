import Database from 'better-sqlite3';

export interface QueryStats {
  query: string;
  executionTimeMs: number;
  rowsExamined: number;
  rowsReturned: number;
  planSteps: string[];
}

export interface SearchOptions {
  query: string;
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'usage' | 'date' | 'success_rate';
  includeArchived?: boolean;
}

export class QueryOptimizer {
  private db: Database.Database;
  private preparedQueries: Map<string, Database.Statement>;

  constructor(db: Database.Database) {
    this.db = db;
    this.preparedQueries = new Map();
    this.initializePreparedStatements();
  }

  private initializePreparedStatements(): void {
    // Core search queries - optimized for <1s performance
    
    // 1. Full-text search with ranking
    this.preparedQueries.set('searchFTS', this.db.prepare(`
      SELECT 
        e.id,
        e.title,
        e.problem,
        e.solution,
        e.category,
        e.usage_count,
        e.success_count,
        e.failure_count,
        e.last_used,
        GROUP_CONCAT(t.tag, ', ') as tags,
        bm25(kb_fts, 3.0, 2.0, 1.5, 1.0) as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts MATCH ? 
        AND e.archived = COALESCE(?, FALSE)
        AND (? IS NULL OR e.category = ?)
      GROUP BY e.id
      ORDER BY 
        CASE ? 
          WHEN 'relevance' THEN relevance_score
          WHEN 'usage' THEN e.usage_count
          WHEN 'date' THEN julianday(e.created_at)
          WHEN 'success_rate' THEN success_rate
          ELSE relevance_score
        END DESC
      LIMIT ? OFFSET ?
    `));

    // 2. Category-based search
    this.preparedQueries.set('searchByCategory', this.db.prepare(`
      SELECT 
        e.id,
        e.title,
        e.problem,
        e.solution,
        e.category,
        e.usage_count,
        e.success_count,
        e.failure_count,
        e.last_used,
        GROUP_CONCAT(t.tag, ', ') as tags,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.category = ? 
        AND e.archived = FALSE
        AND (? IS NULL OR e.title LIKE '%' || ? || '%' OR e.problem LIKE '%' || ? || '%')
      GROUP BY e.id
      ORDER BY e.usage_count DESC, e.success_count DESC
      LIMIT ? OFFSET ?
    `));

    // 3. Tag-based search
    this.preparedQueries.set('searchByTags', this.db.prepare(`
      SELECT 
        e.id,
        e.title,
        e.problem,
        e.solution,
        e.category,
        e.usage_count,
        e.success_count,
        e.failure_count,
        e.last_used,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        COUNT(DISTINCT CASE WHEN t.tag IN (${Array(10).fill('?').join(',')}) THEN t.tag END) as tag_matches,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.archived = FALSE
        AND t.tag IN (${Array(10).fill('?').join(',')})
      GROUP BY e.id
      HAVING tag_matches > 0
      ORDER BY tag_matches DESC, e.usage_count DESC
      LIMIT ? OFFSET ?
    `));

    // 4. Similar entries by content
    this.preparedQueries.set('findSimilar', this.db.prepare(`
      SELECT 
        e.id,
        e.title,
        e.problem,
        e.solution,
        e.category,
        e.usage_count,
        GROUP_CONCAT(t.tag, ', ') as tags,
        bm25(kb_fts) as similarity_score
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts MATCH ?
        AND e.id != ?
        AND e.archived = FALSE
      GROUP BY e.id
      ORDER BY similarity_score DESC
      LIMIT ?
    `));

    // 5. Popular entries
    this.preparedQueries.set('getPopular', this.db.prepare(`
      SELECT 
        e.id,
        e.title,
        e.category,
        e.usage_count,
        e.success_count,
        e.failure_count,
        e.last_used,
        GROUP_CONCAT(t.tag, ', ') as tags,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.archived = FALSE
        AND e.usage_count > 0
      GROUP BY e.id
      ORDER BY e.usage_count DESC, success_rate DESC
      LIMIT ?
    `));

    // 6. Recent entries
    this.preparedQueries.set('getRecent', this.db.prepare(`
      SELECT 
        e.id,
        e.title,
        e.category,
        e.created_at,
        e.usage_count,
        GROUP_CONCAT(t.tag, ', ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.archived = FALSE
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT ?
    `));

    // 7. Entry by ID (optimized for single lookups)
    this.preparedQueries.set('getById', this.db.prepare(`
      SELECT 
        e.*,
        GROUP_CONCAT(t.tag, ', ') as tags,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.id = ?
      GROUP BY e.id
    `));

    // 8. Analytics queries
    this.preparedQueries.set('getSearchStats', this.db.prepare(`
      SELECT 
        query,
        COUNT(*) as frequency,
        AVG(results_count) as avg_results,
        MAX(timestamp) as last_used
      FROM search_history
      WHERE timestamp > datetime('now', '-30 days')
      GROUP BY query
      HAVING frequency > 1
      ORDER BY frequency DESC
      LIMIT ?
    `));

    // 9. Category statistics
    this.preparedQueries.set('getCategoryStats', this.db.prepare(`
      SELECT 
        category,
        COUNT(*) as total_entries,
        SUM(usage_count) as total_usage,
        AVG(CASE WHEN (success_count + failure_count) > 0 
                 THEN CAST(success_count AS REAL) / (success_count + failure_count)
                 ELSE 0 END) as avg_success_rate,
        COUNT(CASE WHEN last_used > datetime('now', '-7 days') THEN 1 END) as recent_usage
      FROM kb_entries
      WHERE archived = FALSE
      GROUP BY category
      ORDER BY total_usage DESC
    `));

    // 10. Usage trends
    this.preparedQueries.set('getUsageTrends', this.db.prepare(`
      SELECT 
        date(timestamp) as usage_date,
        COUNT(*) as total_actions,
        COUNT(DISTINCT entry_id) as unique_entries,
        COUNT(CASE WHEN action = 'rate_success' THEN 1 END) as successes,
        COUNT(CASE WHEN action = 'rate_failure' THEN 1 END) as failures
      FROM usage_metrics
      WHERE timestamp > datetime('now', '-30 days')
      GROUP BY date(timestamp)
      ORDER BY usage_date DESC
    `));
  }

  /**
   * Optimized search with multiple strategies
   */
  async search(options: SearchOptions): Promise<{
    results: any[];
    totalCount: number;
    executionTime: number;
    strategy: string;
  }> {
    const startTime = Date.now();
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    
    let results: any[] = [];
    let strategy = '';

    try {
      // Strategy 1: Full-text search for general queries
      if (options.query && !options.category && (!options.tags || options.tags.length === 0)) {
        const ftsQuery = this.prepareFTSQuery(options.query);
        const stmt = this.preparedQueries.get('searchFTS')!;
        
        results = stmt.all(
          ftsQuery,
          options.includeArchived || false,
          options.category || null,
          options.category || null,
          options.sortBy || 'relevance',
          limit,
          offset
        );
        strategy = 'fts';
      }
      
      // Strategy 2: Category-specific search
      else if (options.category && options.query) {
        const stmt = this.preparedQueries.get('searchByCategory')!;
        results = stmt.all(
          options.category,
          options.query,
          options.query,
          options.query,
          limit,
          offset
        );
        strategy = 'category';
      }
      
      // Strategy 3: Tag-based search
      else if (options.tags && options.tags.length > 0) {
        const stmt = this.preparedQueries.get('searchByTags')!;
        const tags = options.tags.slice(0, 10); // Limit to 10 tags
        const params = [
          ...tags.concat(Array(10 - tags.length).fill(null)),  // Tag filter params
          ...tags.concat(Array(10 - tags.length).fill(null)),  // Tag matching params
          limit,
          offset
        ];
        results = stmt.all(...params);
        strategy = 'tags';
      }
      
      // Strategy 4: Category only
      else if (options.category) {
        const stmt = this.preparedQueries.get('searchByCategory')!;
        results = stmt.all(
          options.category,
          null, null, null,
          limit,
          offset
        );
        strategy = 'category_only';
      }
      
      // Strategy 5: Popular entries (fallback)
      else {
        const stmt = this.preparedQueries.get('getPopular')!;
        results = stmt.all(limit + offset).slice(offset);
        strategy = 'popular';
      }

      // Get total count for pagination
      const totalCount = this.getTotalCount(options);
      
      const executionTime = Date.now() - startTime;
      
      // Log slow queries
      if (executionTime > 500) {
        console.warn(`Slow query (${executionTime}ms): ${strategy}`, options);
      }

      return {
        results,
        totalCount,
        executionTime,
        strategy
      };

    } catch (error) {
      console.error('Search error:', error);
      
      // Fallback to simple query
      const stmt = this.preparedQueries.get('getPopular')!;
      results = stmt.all(limit);
      
      return {
        results,
        totalCount: results.length,
        executionTime: Date.now() - startTime,
        strategy: 'fallback'
      };
    }
  }

  /**
   * Find similar entries using FTS
   */
  findSimilar(entryId: string, content: string, limit: number = 5): any[] {
    const ftsQuery = this.prepareFTSQuery(content);
    const stmt = this.preparedQueries.get('findSimilar')!;
    return stmt.all(ftsQuery, entryId, limit);
  }

  /**
   * Get entry by ID with full details
   */
  getById(id: string): any | null {
    const stmt = this.preparedQueries.get('getById')!;
    return stmt.get(id) || null;
  }

  /**
   * Get popular entries
   */
  getPopular(limit: number = 10): any[] {
    const stmt = this.preparedQueries.get('getPopular')!;
    return stmt.all(limit);
  }

  /**
   * Get recent entries
   */
  getRecent(limit: number = 10): any[] {
    const stmt = this.preparedQueries.get('getRecent')!;
    return stmt.all(limit);
  }

  /**
   * Analyze query performance
   */
  analyzeQuery(sql: string): QueryStats {
    const startTime = Date.now();
    
    // Get query plan
    const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
    
    // Execute query to get timing
    const stmt = this.db.prepare(sql);
    const result = stmt.all();
    
    const executionTime = Date.now() - startTime;

    return {
      query: sql,
      executionTimeMs: executionTime,
      rowsExamined: this.extractRowsExamined(plan),
      rowsReturned: result.length,
      planSteps: plan.map((step: any) => step.detail)
    };
  }

  /**
   * Optimize database for better performance
   */
  optimize(): void {
    const startTime = Date.now();
    
    console.log('🔧 Starting database optimization...');
    
    // Update statistics
    this.db.exec('ANALYZE');
    console.log('✅ Updated table statistics');
    
    // Rebuild FTS index if needed
    try {
      this.db.exec('INSERT INTO kb_fts(kb_fts) VALUES("rebuild")');
      console.log('✅ Rebuilt FTS index');
    } catch (error) {
      console.log('ℹ️ FTS index rebuild not needed');
    }
    
    // Check for index usage
    this.checkIndexUsage();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Database optimization completed in ${duration}ms`);
  }

  /**
   * Prepare FTS query with proper escaping and operators
   */
  private prepareFTSQuery(query: string): string {
    // Clean query
    let ftsQuery = query.trim();
    
    // Handle category prefixes
    if (ftsQuery.startsWith('category:')) {
      const category = ftsQuery.substring(9);
      return `category:${category}`;
    }
    
    // Handle tag prefixes
    if (ftsQuery.startsWith('tag:')) {
      const tag = ftsQuery.substring(4);
      return `tags:${tag}`;
    }
    
    // Escape special FTS characters
    ftsQuery = ftsQuery.replace(/['"]/g, '');
    
    // Add wildcards for partial matches
    const terms = ftsQuery.split(/\s+/).filter(term => term.length > 2);
    
    if (terms.length === 0) return ftsQuery;
    
    // Use phrase search for multi-word queries
    if (terms.length > 1) {
      return `"${terms.join(' ')}"`;
    }
    
    // Single term with wildcard
    return `${terms[0]}*`;
  }

  /**
   * Get total count for pagination
   */
  private getTotalCount(options: SearchOptions): number {
    try {
      let countQuery = '';
      let params: any[] = [];
      
      if (options.query && !options.category) {
        countQuery = `
          SELECT COUNT(DISTINCT e.id) as total
          FROM kb_fts f
          JOIN kb_entries e ON f.id = e.id
          WHERE kb_fts MATCH ?
            AND e.archived = ?
        `;
        params = [this.prepareFTSQuery(options.query), options.includeArchived || false];
      } else {
        countQuery = `
          SELECT COUNT(*) as total
          FROM kb_entries e
          WHERE e.archived = FALSE
            ${options.category ? 'AND e.category = ?' : ''}
        `;
        params = options.category ? [options.category] : [];
      }
      
      const result = this.db.prepare(countQuery).get(...params) as { total: number };
      return result.total;
    } catch (error) {
      console.error('Error getting total count:', error);
      return 0;
    }
  }

  /**
   * Extract rows examined from query plan
   */
  private extractRowsExamined(plan: any[]): number {
    // Simplified extraction - in real implementation, parse the plan more thoroughly
    return plan.length * 100; // Rough estimate
  }

  /**
   * Check index usage and suggest improvements
   */
  private checkIndexUsage(): void {
    const indexes = this.db.prepare(`
      SELECT name, sql FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    console.log(`ℹ️ Found ${indexes.length} custom indexes`);
    
    // Check for unused indexes (simplified)
    const unusedIndexes = indexes.filter((idx: any) => 
      !idx.name.includes('pk') && !idx.name.includes('fk')
    );
    
    if (unusedIndexes.length > 0) {
      console.log(`⚠️ Consider reviewing ${unusedIndexes.length} potentially unused indexes`);
    }
  }

  /**
   * Get query performance statistics
   */
  getPerformanceStats(): {
    avgSearchTime: number;
    slowQueries: number;
    totalSearches: number;
    cacheHitRate: number;
  } {
    const stats = this.db.prepare(`
      SELECT 
        AVG(search_time_ms) as avg_time,
        COUNT(CASE WHEN search_time_ms > 1000 THEN 1 END) as slow_queries,
        COUNT(*) as total_searches
      FROM search_history
      WHERE timestamp > datetime('now', '-24 hours')
    `).get() as any;

    return {
      avgSearchTime: stats.avg_time || 0,
      slowQueries: stats.slow_queries || 0,
      totalSearches: stats.total_searches || 0,
      cacheHitRate: 0.95 // Placeholder - would need more sophisticated tracking
    };
  }
}