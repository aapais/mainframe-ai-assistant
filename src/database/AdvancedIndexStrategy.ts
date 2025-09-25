/**
 * Advanced Database Indexing Strategy for Sub-1s Search Performance
 *
 * This module implements sophisticated indexing strategies to ensure
 * all search operations complete in under 1 second, even with large datasets.
 */

import Database from 'better-sqlite3';

export interface IndexMetrics {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
  size: number;
  usage: number;
  effectiveness: number;
  recommendations: string[];
}

export interface CoveringIndexConfig {
  name: string;
  table: string;
  keyColumns: string[];
  includedColumns: string[];
  whereClause?: string;
  rationale: string;
}

export class AdvancedIndexStrategy {
  private db: Database.Database;
  private indexUsageStats: Map<string, number> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeAdvancedIndexes();
    this.setupUsageTracking();
  }

  /**
   * Initialize advanced covering indexes for zero-lookup queries
   * Optimized for 1000+ KB entries with sub-1s search performance
   */
  private initializeAdvancedIndexes(): void {
    console.log('🚀 Implementing advanced indexing strategy for 1000+ entries...');

    const coveringIndexes: CoveringIndexConfig[] = [
      {
        name: 'idx_search_covering_primary',
        table: 'kb_entries',
        keyColumns: ['category', 'usage_count'],
        includedColumns: [
          'id',
          'title',
          'problem',
          'solution',
          'success_count',
          'failure_count',
          'last_used',
        ],
        whereClause: 'archived = FALSE',
        rationale:
          'Primary search covering index - eliminates table lookups for category+popularity queries',
      },
      {
        name: 'idx_search_covering_success',
        table: 'kb_entries',
        keyColumns: ['success_count', 'failure_count'],
        includedColumns: ['id', 'title', 'category', 'usage_count', 'last_used'],
        whereClause: 'archived = FALSE AND (success_count + failure_count) > 0',
        rationale: 'Success rate covering index - fast access to most effective entries',
      },
      {
        name: 'idx_search_covering_recent',
        table: 'kb_entries',
        keyColumns: ['last_used', 'created_at'],
        includedColumns: ['id', 'title', 'category', 'usage_count', 'success_count'],
        whereClause: 'archived = FALSE',
        rationale: 'Temporal covering index - fast access to recent and new entries',
      },
      {
        name: 'idx_search_covering_hybrid',
        table: 'kb_entries',
        keyColumns: ['category', 'severity', 'usage_count', 'success_count'],
        includedColumns: ['id', 'title', 'problem', 'solution', 'created_at', 'last_used'],
        whereClause: 'archived = FALSE',
        rationale: 'Hybrid search covering index - optimized for complex multi-criteria searches',
      },
      {
        name: 'idx_tags_covering_fast',
        table: 'kb_tags',
        keyColumns: ['tag', 'entry_id'],
        includedColumns: ['created_at'],
        rationale: 'Tag lookup covering index - eliminates joins for tag-based searches',
      },
      {
        name: 'idx_tags_popularity_covering',
        table: 'kb_tags',
        keyColumns: ['tag', 'entry_id'],
        includedColumns: [],
        rationale: 'Tag popularity covering index - faster tag-based result ranking',
      },
      {
        name: 'idx_usage_analytics_covering',
        table: 'usage_metrics',
        keyColumns: ['timestamp', 'action'],
        includedColumns: ['entry_id', 'user_id', 'session_id'],
        whereClause: 'timestamp > datetime("now", "-30 days")',
        rationale: 'Analytics covering index - fast analytics without table scans',
      },
      {
        name: 'idx_search_frequency_covering',
        table: 'search_history',
        keyColumns: ['query', 'timestamp'],
        includedColumns: ['results_count', 'search_time_ms', 'user_id'],
        whereClause: 'timestamp > datetime("now", "-7 days")',
        rationale: 'Search frequency covering index - optimize popular query routing',
      },
    ];

    // Create covering indexes
    coveringIndexes.forEach(config => {
      this.createCoveringIndex(config);
    });

    // Create specialized composite indexes for common query patterns
    this.createCompositeIndexes();

    // Create expression indexes for computed columns
    this.createExpressionIndexes();

    console.log('✅ Advanced indexing strategy implemented');
  }

  /**
   * Create covering index with all necessary columns
   */
  private createCoveringIndex(config: CoveringIndexConfig): void {
    try {
      // SQLite doesn't have INCLUDE syntax, so we add all columns to the index
      const allColumns = [...config.keyColumns, ...config.includedColumns];
      const whereClause = config.whereClause ? `WHERE ${config.whereClause}` : '';

      const sql = `
        CREATE INDEX IF NOT EXISTS ${config.name}
        ON ${config.table}(${allColumns.join(', ')})
        ${whereClause}
      `;

      this.db.exec(sql);
      console.log(`✅ Created covering index: ${config.name} - ${config.rationale}`);
    } catch (error) {
      console.error(`❌ Failed to create covering index ${config.name}:`, error);
    }
  }

  /**
   * Create composite indexes for multi-column queries
   * Enhanced for large datasets with sophisticated optimization patterns
   */
  private createCompositeIndexes(): void {
    const compositeIndexes = [
      {
        name: 'idx_category_severity_usage',
        sql: `CREATE INDEX IF NOT EXISTS idx_category_severity_usage 
              ON kb_entries(category, severity, usage_count DESC, success_count DESC) 
              WHERE archived = FALSE`,
      },
      {
        name: 'idx_search_popularity',
        sql: `CREATE INDEX IF NOT EXISTS idx_search_popularity 
              ON kb_entries(
                CASE WHEN (success_count + failure_count) > 0 
                THEN CAST(success_count AS REAL) / (success_count + failure_count) 
                ELSE 0 END DESC,
                usage_count DESC
              ) WHERE archived = FALSE`,
      },
      {
        name: 'idx_temporal_clustering',
        sql: `CREATE INDEX IF NOT EXISTS idx_temporal_clustering 
              ON usage_metrics(date(timestamp), action, entry_id)
              WHERE timestamp > datetime('now', '-7 days')`,
      },
      {
        name: 'idx_tag_frequency',
        sql: `CREATE INDEX IF NOT EXISTS idx_tag_frequency 
              ON kb_tags(tag COLLATE NOCASE, entry_id)
              WHERE length(tag) >= 3`,
      },
      {
        name: 'idx_search_pattern_optimization',
        sql: `CREATE INDEX IF NOT EXISTS idx_search_pattern_optimization
              ON kb_entries(
                category,
                CASE WHEN usage_count > 50 THEN 1 ELSE 0 END,
                success_count DESC,
                created_at DESC
              ) WHERE archived = FALSE`,
      },
      {
        name: 'idx_multi_criteria_search',
        sql: `CREATE INDEX IF NOT EXISTS idx_multi_criteria_search
              ON kb_entries(category, severity, usage_count DESC, last_used DESC)
              WHERE archived = FALSE AND usage_count > 0`,
      },
      {
        name: 'idx_tag_entry_join_optimized',
        sql: `CREATE INDEX IF NOT EXISTS idx_tag_entry_join_optimized
              ON kb_tags(entry_id, tag, created_at DESC)`,
      },
      {
        name: 'idx_search_analytics_fast',
        sql: `CREATE INDEX IF NOT EXISTS idx_search_analytics_fast
              ON search_history(
                date(timestamp),
                query_type,
                results_count,
                search_time_ms
              ) WHERE timestamp > datetime('now', '-30 days')`,
      },
      {
        name: 'idx_usage_trending',
        sql: `CREATE INDEX IF NOT EXISTS idx_usage_trending
              ON usage_metrics(
                entry_id,
                action,
                date(timestamp)
              ) WHERE timestamp > datetime('now', '-14 days')
                AND action IN ('view', 'rate_success', 'rate_failure')`,
      },
      {
        name: 'idx_performance_monitoring',
        sql: `CREATE INDEX IF NOT EXISTS idx_performance_monitoring
              ON search_history(search_time_ms DESC, query, timestamp DESC)
              WHERE search_time_ms > 100`,
      },
    ];

    compositeIndexes.forEach(({ name, sql }) => {
      try {
        this.db.exec(sql);
        console.log(`✅ Created composite index: ${name}`);
      } catch (error) {
        console.error(`❌ Failed to create composite index ${name}:`, error);
      }
    });
  }

  /**
   * Create expression indexes for computed values
   */
  private createExpressionIndexes(): void {
    const expressionIndexes = [
      {
        name: 'idx_success_rate_computed',
        sql: `CREATE INDEX IF NOT EXISTS idx_success_rate_computed 
              ON kb_entries(
                (CASE WHEN (success_count + failure_count) > 0 
                 THEN CAST(success_count AS REAL) / (success_count + failure_count) 
                 ELSE 0.0 END) DESC,
                usage_count DESC
              ) WHERE archived = FALSE AND (success_count + failure_count) > 0`,
      },
      {
        name: 'idx_content_length',
        sql: `CREATE INDEX IF NOT EXISTS idx_content_length 
              ON kb_entries(length(problem) + length(solution), category)
              WHERE archived = FALSE`,
      },
      {
        name: 'idx_recency_score',
        sql: `CREATE INDEX IF NOT EXISTS idx_recency_score 
              ON kb_entries(
                julianday('now') - julianday(COALESCE(last_used, created_at)) DESC,
                usage_count DESC
              ) WHERE archived = FALSE`,
      },
    ];

    expressionIndexes.forEach(({ name, sql }) => {
      try {
        this.db.exec(sql);
        console.log(`✅ Created expression index: ${name}`);
      } catch (error) {
        console.error(`❌ Failed to create expression index ${name}:`, error);
      }
    });
  }

  /**
   * Setup index usage tracking
   */
  private setupUsageTracking(): void {
    // Monitor query plans to track index usage
    const originalPrepare = this.db.prepare.bind(this.db);

    this.db.prepare = (sql: string, ...args: any[]) => {
      const stmt = originalPrepare(sql, ...args);

      // Track when statement is executed
      const originalRun = stmt.run.bind(stmt);
      const originalGet = stmt.get.bind(stmt);
      const originalAll = stmt.all.bind(stmt);

      stmt.run = (...params: any[]) => {
        this.trackIndexUsage(sql);
        return originalRun(...params);
      };

      stmt.get = (...params: any[]) => {
        this.trackIndexUsage(sql);
        return originalGet(...params);
      };

      stmt.all = (...params: any[]) => {
        this.trackIndexUsage(sql);
        return originalAll(...params);
      };

      return stmt;
    };
  }

  /**
   * Track index usage for optimization
   */
  private trackIndexUsage(sql: string): void {
    try {
      const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();

      plan.forEach((step: any) => {
        if (step.detail && step.detail.includes('USING INDEX')) {
          const indexMatch = step.detail.match(/USING INDEX (\w+)/);
          if (indexMatch) {
            const indexName = indexMatch[1];
            this.indexUsageStats.set(indexName, (this.indexUsageStats.get(indexName) || 0) + 1);
          }
        }
      });
    } catch (error) {
      // Non-critical error
    }
  }

  /**
   * Analyze index effectiveness and provide recommendations
   */
  analyzeIndexEffectiveness(): IndexMetrics[] {
    const indexes = this.db
      .prepare(
        `
      SELECT 
        name,
        tbl_name as table_name,
        sql
      FROM sqlite_master 
      WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
        AND sql IS NOT NULL
    `
      )
      .all() as Array<{ name: string; table_name: string; sql: string }>;

    return indexes.map(index => {
      const usage = this.indexUsageStats.get(index.name) || 0;
      const size = this.estimateIndexSize(index.name);
      const effectiveness = this.calculateIndexEffectiveness(index.name);
      const recommendations = this.getIndexRecommendations(index, usage, effectiveness);

      return {
        name: index.name,
        table: index.table_name,
        columns: this.extractColumnsFromSQL(index.sql),
        unique: index.sql.toLowerCase().includes('unique'),
        partial: index.sql.toLowerCase().includes('where'),
        size,
        usage,
        effectiveness,
        recommendations,
      };
    });
  }

  /**
   * Optimize indexes based on query patterns
   */
  optimizeForQueryPatterns(): {
    created: string[];
    dropped: string[];
    recommendations: string[];
  } {
    const created: string[] = [];
    const dropped: string[] = [];
    const recommendations: string[] = [];

    // Analyze search history to identify patterns
    const searchPatterns = this.analyzeSearchPatterns();

    // Create missing indexes for common patterns
    searchPatterns.missingIndexes.forEach(pattern => {
      const indexName = `idx_auto_${pattern.type}_${Date.now()}`;
      try {
        this.db.exec(pattern.sql);
        created.push(indexName);
        console.log(`✅ Auto-created index for pattern: ${pattern.description}`);
      } catch (error) {
        recommendations.push(`Consider creating index: ${pattern.description}`);
      }
    });

    // Identify unused indexes
    const unusedIndexes = this.identifyUnusedIndexes();
    unusedIndexes.forEach(indexName => {
      recommendations.push(`Consider dropping unused index: ${indexName}`);
    });

    // Performance recommendations
    recommendations.push(...this.getPerformanceRecommendations());

    return { created, dropped, recommendations };
  }

  /**
   * Create adaptive indexes based on query frequency
   */
  createAdaptiveIndexes(): void {
    const startTime = Date.now();
    console.log('🔄 Creating adaptive indexes based on usage patterns...');

    // Analyze last 30 days of search history
    const queryPatterns = this.db
      .prepare(
        `
      SELECT 
        query,
        query_type,
        COUNT(*) as frequency,
        AVG(search_time_ms) as avg_time,
        COUNT(CASE WHEN search_time_ms > 1000 THEN 1 END) as slow_queries
      FROM search_history 
      WHERE timestamp > datetime('now', '-30 days')
      GROUP BY query, query_type
      HAVING frequency > 5 OR slow_queries > 0
      ORDER BY frequency DESC, avg_time DESC
    `
      )
      .all();

    // Create indexes for slow or frequent queries
    queryPatterns.forEach((pattern: any, index: number) => {
      if (pattern.avg_time > 500 || pattern.frequency > 20) {
        this.createPatternSpecificIndex(pattern, index);
      }
    });

    console.log(`✅ Adaptive indexing completed in ${Date.now() - startTime}ms`);
  }

  /**
   * Create index specific to query pattern
   */
  private createPatternSpecificIndex(pattern: any, index: number): void {
    const indexName = `idx_adaptive_${index}_${Date.now()}`;

    try {
      if (pattern.query_type === 'category') {
        // Category-specific optimization
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON kb_entries(category, usage_count DESC, success_count DESC)
          WHERE archived = FALSE
        `);
      } else if (pattern.query.includes('tag:')) {
        // Tag-specific optimization
        const tag = pattern.query.replace('tag:', '').trim();
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON kb_tags(tag, entry_id)
          WHERE tag = '${tag}'
        `);
      } else {
        // General text search optimization
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON kb_entries(title, category, usage_count DESC)
          WHERE archived = FALSE AND title LIKE '%${pattern.query.substring(0, 10)}%'
        `);
      }

      console.log(`✅ Created adaptive index: ${indexName} for pattern: ${pattern.query}`);
    } catch (error) {
      console.error(`❌ Failed to create adaptive index for pattern ${pattern.query}:`, error);
    }
  }

  /**
   * Analyze search patterns to identify optimization opportunities
   */
  private analyzeSearchPatterns(): {
    missingIndexes: Array<{
      type: string;
      description: string;
      sql: string;
    }>;
  } {
    const missingIndexes: Array<{
      type: string;
      description: string;
      sql: string;
    }> = [];

    // Check for missing category+text combination indexes
    const categoryQueries = this.db
      .prepare(
        `
      SELECT DISTINCT query
      FROM search_history
      WHERE query LIKE 'category:%'
        AND timestamp > datetime('now', '-7 days')
    `
      )
      .all();

    if (categoryQueries.length > 0) {
      missingIndexes.push({
        type: 'category_text',
        description: 'Category-specific text search index',
        sql: `CREATE INDEX idx_category_text_search 
              ON kb_entries(category, title, problem) 
              WHERE archived = FALSE`,
      });
    }

    return { missingIndexes };
  }

  /**
   * Identify indexes that are rarely or never used
   */
  private identifyUnusedIndexes(): string[] {
    const allIndexes = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `
      )
      .all() as Array<{ name: string }>;

    return allIndexes
      .filter(index => (this.indexUsageStats.get(index.name) || 0) < 5)
      .map(index => index.name);
  }

  /**
   * Get performance optimization recommendations
   */
  private getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check table statistics freshness
    const analyzeAge = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name = 'sqlite_stat1'
    `
      )
      .get();

    if (!analyzeAge) {
      recommendations.push('Run ANALYZE to update query planner statistics');
    }

    // Check FTS index health
    try {
      const ftsCount = this.db.prepare('SELECT count(*) as count FROM kb_fts').get() as {
        count: number;
      };
      const entriesCount = this.db.prepare('SELECT count(*) as count FROM kb_entries').get() as {
        count: number;
      };

      if (Math.abs(ftsCount.count - entriesCount.count) > 5) {
        recommendations.push('FTS index is out of sync - consider rebuilding');
      }
    } catch (error) {
      recommendations.push('FTS index health check failed');
    }

    return recommendations;
  }

  /**
   * Estimate index size (simplified)
   */
  private estimateIndexSize(indexName: string): number {
    try {
      // This is a simplified estimation
      // In practice, you'd analyze the index pages
      return 1024; // Placeholder
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate index effectiveness score
   */
  private calculateIndexEffectiveness(indexName: string): number {
    const usage = this.indexUsageStats.get(indexName) || 0;
    const baseScore = Math.min(usage / 100, 1.0); // Max score at 100 uses

    // Boost score for critical indexes
    if (indexName.includes('fts') || indexName.includes('covering')) {
      return Math.min(baseScore * 1.5, 1.0);
    }

    return baseScore;
  }

  /**
   * Get recommendations for specific index
   */
  private getIndexRecommendations(
    index: { name: string; sql: string },
    usage: number,
    effectiveness: number
  ): string[] {
    const recommendations: string[] = [];

    if (usage === 0) {
      recommendations.push('Index is never used - consider dropping');
    } else if (usage < 10) {
      recommendations.push('Low usage - monitor for removal');
    }

    if (effectiveness < 0.3) {
      recommendations.push('Low effectiveness - consider redesigning');
    }

    if (index.sql.length > 500) {
      recommendations.push('Complex index - consider splitting');
    }

    return recommendations;
  }

  /**
   * Extract column names from CREATE INDEX SQL
   */
  private extractColumnsFromSQL(sql: string): string[] {
    const match = sql.match(/\((.*?)\)/);
    if (match) {
      return match[1].split(',').map(col => col.trim().split(' ')[0]);
    }
    return [];
  }

  /**
   * Generate index maintenance report
   */
  generateMaintenanceReport(): {
    summary: {
      totalIndexes: number;
      usedIndexes: number;
      effectiveness: number;
      recommendations: number;
    };
    details: IndexMetrics[];
    actions: string[];
  } {
    const metrics = this.analyzeIndexEffectiveness();
    const usedIndexes = metrics.filter(m => m.usage > 0).length;
    const avgEffectiveness = metrics.reduce((sum, m) => sum + m.effectiveness, 0) / metrics.length;
    const totalRecommendations = metrics.reduce((sum, m) => sum + m.recommendations.length, 0);

    const actions: string[] = [];

    // Generate action items
    if (avgEffectiveness < 0.5) {
      actions.push('Overall index effectiveness is low - review index strategy');
    }

    if (usedIndexes / metrics.length < 0.7) {
      actions.push('Many unused indexes detected - cleanup recommended');
    }

    return {
      summary: {
        totalIndexes: metrics.length,
        usedIndexes,
        effectiveness: Math.round(avgEffectiveness * 100),
        recommendations: totalRecommendations,
      },
      details: metrics,
      actions,
    };
  }
}
