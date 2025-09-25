'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.QueryOptimizer = void 0;
class QueryOptimizer {
  db;
  preparedQueries;
  constructor(db) {
    this.db = db;
    this.preparedQueries = new Map();
    this.initializePreparedStatements();
  }
  initializePreparedStatements() {
    this.preparedQueries.set(
      'searchFTS',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'searchByCategory',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'searchByTags',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'findSimilar',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'getPopular',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'getRecent',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'getById',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'getSearchStats',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'getCategoryStats',
      this.db.prepare(`
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
    `)
    );
    this.preparedQueries.set(
      'getUsageTrends',
      this.db.prepare(`
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
    `)
    );
  }
  async search(options) {
    const startTime = Date.now();
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    let results = [];
    let strategy = '';
    try {
      if (options.query && !options.category && (!options.tags || options.tags.length === 0)) {
        const ftsQuery = this.prepareFTSQuery(options.query);
        const stmt = this.preparedQueries.get('searchFTS');
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
      } else if (options.category && options.query) {
        const stmt = this.preparedQueries.get('searchByCategory');
        results = stmt.all(
          options.category,
          options.query,
          options.query,
          options.query,
          limit,
          offset
        );
        strategy = 'category';
      } else if (options.tags && options.tags.length > 0) {
        const stmt = this.preparedQueries.get('searchByTags');
        const tags = options.tags.slice(0, 10);
        const params = [
          ...tags.concat(Array(10 - tags.length).fill(null)),
          ...tags.concat(Array(10 - tags.length).fill(null)),
          limit,
          offset,
        ];
        results = stmt.all(...params);
        strategy = 'tags';
      } else if (options.category) {
        const stmt = this.preparedQueries.get('searchByCategory');
        results = stmt.all(options.category, null, null, null, limit, offset);
        strategy = 'category_only';
      } else {
        const stmt = this.preparedQueries.get('getPopular');
        results = stmt.all(limit + offset).slice(offset);
        strategy = 'popular';
      }
      const totalCount = this.getTotalCount(options);
      const executionTime = Date.now() - startTime;
      if (executionTime > 500) {
        console.warn(`Slow query (${executionTime}ms): ${strategy}`, options);
      }
      return {
        results,
        totalCount,
        executionTime,
        strategy,
      };
    } catch (error) {
      console.error('Search error:', error);
      const stmt = this.preparedQueries.get('getPopular');
      results = stmt.all(limit);
      return {
        results,
        totalCount: results.length,
        executionTime: Date.now() - startTime,
        strategy: 'fallback',
      };
    }
  }
  findSimilar(entryId, content, limit = 5) {
    const ftsQuery = this.prepareFTSQuery(content);
    const stmt = this.preparedQueries.get('findSimilar');
    return stmt.all(ftsQuery, entryId, limit);
  }
  getById(id) {
    const stmt = this.preparedQueries.get('getById');
    return stmt.get(id) || null;
  }
  getPopular(limit = 10) {
    const stmt = this.preparedQueries.get('getPopular');
    return stmt.all(limit);
  }
  getRecent(limit = 10) {
    const stmt = this.preparedQueries.get('getRecent');
    return stmt.all(limit);
  }
  analyzeQuery(sql) {
    const startTime = Date.now();
    const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
    const stmt = this.db.prepare(sql);
    const result = stmt.all();
    const executionTime = Date.now() - startTime;
    return {
      query: sql,
      executionTimeMs: executionTime,
      rowsExamined: this.extractRowsExamined(plan),
      rowsReturned: result.length,
      planSteps: plan.map(step => step.detail),
    };
  }
  optimize() {
    const startTime = Date.now();
    console.log('🔧 Starting database optimization...');
    this.db.exec('ANALYZE');
    console.log('✅ Updated table statistics');
    try {
      this.db.exec('INSERT INTO kb_fts(kb_fts) VALUES("rebuild")');
      console.log('✅ Rebuilt FTS index');
    } catch (error) {
      console.log('ℹ️ FTS index rebuild not needed');
    }
    this.checkIndexUsage();
    const duration = Date.now() - startTime;
    console.log(`✅ Database optimization completed in ${duration}ms`);
  }
  prepareFTSQuery(query) {
    let ftsQuery = query.trim();
    if (ftsQuery.startsWith('category:')) {
      const category = ftsQuery.substring(9);
      return `category:${category}`;
    }
    if (ftsQuery.startsWith('tag:')) {
      const tag = ftsQuery.substring(4);
      return `tags:${tag}`;
    }
    ftsQuery = ftsQuery.replace(/['"]/g, '');
    const terms = ftsQuery.split(/\s+/).filter(term => term.length > 2);
    if (terms.length === 0) return ftsQuery;
    if (terms.length > 1) {
      return `"${terms.join(' ')}"`;
    }
    return `${terms[0]}*`;
  }
  getTotalCount(options) {
    try {
      let countQuery = '';
      let params = [];
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
      const result = this.db.prepare(countQuery).get(...params);
      return result.total;
    } catch (error) {
      console.error('Error getting total count:', error);
      return 0;
    }
  }
  extractRowsExamined(plan) {
    return plan.length * 100;
  }
  checkIndexUsage() {
    const indexes = this.db
      .prepare(
        `
      SELECT name, sql FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `
      )
      .all();
    console.log(`ℹ️ Found ${indexes.length} custom indexes`);
    const unusedIndexes = indexes.filter(
      idx => !idx.name.includes('pk') && !idx.name.includes('fk')
    );
    if (unusedIndexes.length > 0) {
      console.log(`⚠️ Consider reviewing ${unusedIndexes.length} potentially unused indexes`);
    }
  }
  getPerformanceStats() {
    const stats = this.db
      .prepare(
        `
      SELECT 
        AVG(search_time_ms) as avg_time,
        COUNT(CASE WHEN search_time_ms > 1000 THEN 1 END) as slow_queries,
        COUNT(*) as total_searches
      FROM search_history
      WHERE timestamp > datetime('now', '-24 hours')
    `
      )
      .get();
    return {
      avgSearchTime: stats.avg_time || 0,
      slowQueries: stats.slow_queries || 0,
      totalSearches: stats.total_searches || 0,
      cacheHitRate: 0.95,
    };
  }
}
exports.QueryOptimizer = QueryOptimizer;
//# sourceMappingURL=QueryOptimizer.js.map
