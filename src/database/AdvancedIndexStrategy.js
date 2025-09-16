"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedIndexStrategy = void 0;
class AdvancedIndexStrategy {
    db;
    indexUsageStats = new Map();
    constructor(db) {
        this.db = db;
        this.initializeAdvancedIndexes();
        this.setupUsageTracking();
    }
    initializeAdvancedIndexes() {
        console.log('🚀 Implementing advanced indexing strategy for 1000+ entries...');
        const coveringIndexes = [
            {
                name: 'idx_search_covering_primary',
                table: 'kb_entries',
                keyColumns: ['category', 'usage_count'],
                includedColumns: ['id', 'title', 'problem', 'solution', 'success_count', 'failure_count', 'last_used'],
                whereClause: 'archived = FALSE',
                rationale: 'Primary search covering index - eliminates table lookups for category+popularity queries'
            },
            {
                name: 'idx_search_covering_success',
                table: 'kb_entries',
                keyColumns: ['success_count', 'failure_count'],
                includedColumns: ['id', 'title', 'category', 'usage_count', 'last_used'],
                whereClause: 'archived = FALSE AND (success_count + failure_count) > 0',
                rationale: 'Success rate covering index - fast access to most effective entries'
            },
            {
                name: 'idx_search_covering_recent',
                table: 'kb_entries',
                keyColumns: ['last_used', 'created_at'],
                includedColumns: ['id', 'title', 'category', 'usage_count', 'success_count'],
                whereClause: 'archived = FALSE',
                rationale: 'Temporal covering index - fast access to recent and new entries'
            },
            {
                name: 'idx_search_covering_hybrid',
                table: 'kb_entries',
                keyColumns: ['category', 'severity', 'usage_count', 'success_count'],
                includedColumns: ['id', 'title', 'problem', 'solution', 'created_at', 'last_used'],
                whereClause: 'archived = FALSE',
                rationale: 'Hybrid search covering index - optimized for complex multi-criteria searches'
            },
            {
                name: 'idx_tags_covering_fast',
                table: 'kb_tags',
                keyColumns: ['tag', 'entry_id'],
                includedColumns: ['created_at'],
                rationale: 'Tag lookup covering index - eliminates joins for tag-based searches'
            },
            {
                name: 'idx_tags_popularity_covering',
                table: 'kb_tags',
                keyColumns: ['tag', 'entry_id'],
                includedColumns: [],
                rationale: 'Tag popularity covering index - faster tag-based result ranking'
            },
            {
                name: 'idx_usage_analytics_covering',
                table: 'usage_metrics',
                keyColumns: ['timestamp', 'action'],
                includedColumns: ['entry_id', 'user_id', 'session_id'],
                whereClause: 'timestamp > datetime("now", "-30 days")',
                rationale: 'Analytics covering index - fast analytics without table scans'
            },
            {
                name: 'idx_search_frequency_covering',
                table: 'search_history',
                keyColumns: ['query', 'timestamp'],
                includedColumns: ['results_count', 'search_time_ms', 'user_id'],
                whereClause: 'timestamp > datetime("now", "-7 days")',
                rationale: 'Search frequency covering index - optimize popular query routing'
            }
        ];
        coveringIndexes.forEach(config => {
            this.createCoveringIndex(config);
        });
        this.createCompositeIndexes();
        this.createExpressionIndexes();
        console.log('✅ Advanced indexing strategy implemented');
    }
    createCoveringIndex(config) {
        try {
            const allColumns = [...config.keyColumns, ...config.includedColumns];
            const whereClause = config.whereClause ? `WHERE ${config.whereClause}` : '';
            const sql = `
        CREATE INDEX IF NOT EXISTS ${config.name}
        ON ${config.table}(${allColumns.join(', ')})
        ${whereClause}
      `;
            this.db.exec(sql);
            console.log(`✅ Created covering index: ${config.name} - ${config.rationale}`);
        }
        catch (error) {
            console.error(`❌ Failed to create covering index ${config.name}:`, error);
        }
    }
    createCompositeIndexes() {
        const compositeIndexes = [
            {
                name: 'idx_category_severity_usage',
                sql: `CREATE INDEX IF NOT EXISTS idx_category_severity_usage 
              ON kb_entries(category, severity, usage_count DESC, success_count DESC) 
              WHERE archived = FALSE`
            },
            {
                name: 'idx_search_popularity',
                sql: `CREATE INDEX IF NOT EXISTS idx_search_popularity 
              ON kb_entries(
                CASE WHEN (success_count + failure_count) > 0 
                THEN CAST(success_count AS REAL) / (success_count + failure_count) 
                ELSE 0 END DESC,
                usage_count DESC
              ) WHERE archived = FALSE`
            },
            {
                name: 'idx_temporal_clustering',
                sql: `CREATE INDEX IF NOT EXISTS idx_temporal_clustering 
              ON usage_metrics(date(timestamp), action, entry_id)
              WHERE timestamp > datetime('now', '-7 days')`
            },
            {
                name: 'idx_tag_frequency',
                sql: `CREATE INDEX IF NOT EXISTS idx_tag_frequency 
              ON kb_tags(tag COLLATE NOCASE, entry_id)
              WHERE length(tag) >= 3`
            },
            {
                name: 'idx_search_pattern_optimization',
                sql: `CREATE INDEX IF NOT EXISTS idx_search_pattern_optimization
              ON kb_entries(
                category,
                CASE WHEN usage_count > 50 THEN 1 ELSE 0 END,
                success_count DESC,
                created_at DESC
              ) WHERE archived = FALSE`
            },
            {
                name: 'idx_multi_criteria_search',
                sql: `CREATE INDEX IF NOT EXISTS idx_multi_criteria_search
              ON kb_entries(category, severity, usage_count DESC, last_used DESC)
              WHERE archived = FALSE AND usage_count > 0`
            },
            {
                name: 'idx_tag_entry_join_optimized',
                sql: `CREATE INDEX IF NOT EXISTS idx_tag_entry_join_optimized
              ON kb_tags(entry_id, tag, created_at DESC)`
            },
            {
                name: 'idx_search_analytics_fast',
                sql: `CREATE INDEX IF NOT EXISTS idx_search_analytics_fast
              ON search_history(
                date(timestamp),
                query_type,
                results_count,
                search_time_ms
              ) WHERE timestamp > datetime('now', '-30 days')`
            },
            {
                name: 'idx_usage_trending',
                sql: `CREATE INDEX IF NOT EXISTS idx_usage_trending
              ON usage_metrics(
                entry_id,
                action,
                date(timestamp)
              ) WHERE timestamp > datetime('now', '-14 days')
                AND action IN ('view', 'rate_success', 'rate_failure')`
            },
            {
                name: 'idx_performance_monitoring',
                sql: `CREATE INDEX IF NOT EXISTS idx_performance_monitoring
              ON search_history(search_time_ms DESC, query, timestamp DESC)
              WHERE search_time_ms > 100`
            }
        ];
        compositeIndexes.forEach(({ name, sql }) => {
            try {
                this.db.exec(sql);
                console.log(`✅ Created composite index: ${name}`);
            }
            catch (error) {
                console.error(`❌ Failed to create composite index ${name}:`, error);
            }
        });
    }
    createExpressionIndexes() {
        const expressionIndexes = [
            {
                name: 'idx_success_rate_computed',
                sql: `CREATE INDEX IF NOT EXISTS idx_success_rate_computed 
              ON kb_entries(
                (CASE WHEN (success_count + failure_count) > 0 
                 THEN CAST(success_count AS REAL) / (success_count + failure_count) 
                 ELSE 0.0 END) DESC,
                usage_count DESC
              ) WHERE archived = FALSE AND (success_count + failure_count) > 0`
            },
            {
                name: 'idx_content_length',
                sql: `CREATE INDEX IF NOT EXISTS idx_content_length 
              ON kb_entries(length(problem) + length(solution), category)
              WHERE archived = FALSE`
            },
            {
                name: 'idx_recency_score',
                sql: `CREATE INDEX IF NOT EXISTS idx_recency_score 
              ON kb_entries(
                julianday('now') - julianday(COALESCE(last_used, created_at)) DESC,
                usage_count DESC
              ) WHERE archived = FALSE`
            }
        ];
        expressionIndexes.forEach(({ name, sql }) => {
            try {
                this.db.exec(sql);
                console.log(`✅ Created expression index: ${name}`);
            }
            catch (error) {
                console.error(`❌ Failed to create expression index ${name}:`, error);
            }
        });
    }
    setupUsageTracking() {
        const originalPrepare = this.db.prepare.bind(this.db);
        this.db.prepare = (sql, ...args) => {
            const stmt = originalPrepare(sql, ...args);
            const originalRun = stmt.run.bind(stmt);
            const originalGet = stmt.get.bind(stmt);
            const originalAll = stmt.all.bind(stmt);
            stmt.run = (...params) => {
                this.trackIndexUsage(sql);
                return originalRun(...params);
            };
            stmt.get = (...params) => {
                this.trackIndexUsage(sql);
                return originalGet(...params);
            };
            stmt.all = (...params) => {
                this.trackIndexUsage(sql);
                return originalAll(...params);
            };
            return stmt;
        };
    }
    trackIndexUsage(sql) {
        try {
            const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
            plan.forEach((step) => {
                if (step.detail && step.detail.includes('USING INDEX')) {
                    const indexMatch = step.detail.match(/USING INDEX (\w+)/);
                    if (indexMatch) {
                        const indexName = indexMatch[1];
                        this.indexUsageStats.set(indexName, (this.indexUsageStats.get(indexName) || 0) + 1);
                    }
                }
            });
        }
        catch (error) {
        }
    }
    analyzeIndexEffectiveness() {
        const indexes = this.db.prepare(`
      SELECT 
        name,
        tbl_name as table_name,
        sql
      FROM sqlite_master 
      WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
        AND sql IS NOT NULL
    `).all();
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
                recommendations
            };
        });
    }
    optimizeForQueryPatterns() {
        const created = [];
        const dropped = [];
        const recommendations = [];
        const searchPatterns = this.analyzeSearchPatterns();
        searchPatterns.missingIndexes.forEach(pattern => {
            const indexName = `idx_auto_${pattern.type}_${Date.now()}`;
            try {
                this.db.exec(pattern.sql);
                created.push(indexName);
                console.log(`✅ Auto-created index for pattern: ${pattern.description}`);
            }
            catch (error) {
                recommendations.push(`Consider creating index: ${pattern.description}`);
            }
        });
        const unusedIndexes = this.identifyUnusedIndexes();
        unusedIndexes.forEach(indexName => {
            recommendations.push(`Consider dropping unused index: ${indexName}`);
        });
        recommendations.push(...this.getPerformanceRecommendations());
        return { created, dropped, recommendations };
    }
    createAdaptiveIndexes() {
        const startTime = Date.now();
        console.log('🔄 Creating adaptive indexes based on usage patterns...');
        const queryPatterns = this.db.prepare(`
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
    `).all();
        queryPatterns.forEach((pattern, index) => {
            if (pattern.avg_time > 500 || pattern.frequency > 20) {
                this.createPatternSpecificIndex(pattern, index);
            }
        });
        console.log(`✅ Adaptive indexing completed in ${Date.now() - startTime}ms`);
    }
    createPatternSpecificIndex(pattern, index) {
        const indexName = `idx_adaptive_${index}_${Date.now()}`;
        try {
            if (pattern.query_type === 'category') {
                this.db.exec(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON kb_entries(category, usage_count DESC, success_count DESC)
          WHERE archived = FALSE
        `);
            }
            else if (pattern.query.includes('tag:')) {
                const tag = pattern.query.replace('tag:', '').trim();
                this.db.exec(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON kb_tags(tag, entry_id)
          WHERE tag = '${tag}'
        `);
            }
            else {
                this.db.exec(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON kb_entries(title, category, usage_count DESC)
          WHERE archived = FALSE AND title LIKE '%${pattern.query.substring(0, 10)}%'
        `);
            }
            console.log(`✅ Created adaptive index: ${indexName} for pattern: ${pattern.query}`);
        }
        catch (error) {
            console.error(`❌ Failed to create adaptive index for pattern ${pattern.query}:`, error);
        }
    }
    analyzeSearchPatterns() {
        const missingIndexes = [];
        const categoryQueries = this.db.prepare(`
      SELECT DISTINCT query
      FROM search_history
      WHERE query LIKE 'category:%'
        AND timestamp > datetime('now', '-7 days')
    `).all();
        if (categoryQueries.length > 0) {
            missingIndexes.push({
                type: 'category_text',
                description: 'Category-specific text search index',
                sql: `CREATE INDEX idx_category_text_search 
              ON kb_entries(category, title, problem) 
              WHERE archived = FALSE`
            });
        }
        return { missingIndexes };
    }
    identifyUnusedIndexes() {
        const allIndexes = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `).all();
        return allIndexes
            .filter(index => (this.indexUsageStats.get(index.name) || 0) < 5)
            .map(index => index.name);
    }
    getPerformanceRecommendations() {
        const recommendations = [];
        const analyzeAge = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name = 'sqlite_stat1'
    `).get();
        if (!analyzeAge) {
            recommendations.push('Run ANALYZE to update query planner statistics');
        }
        try {
            const ftsCount = this.db.prepare('SELECT count(*) as count FROM kb_fts').get();
            const entriesCount = this.db.prepare('SELECT count(*) as count FROM kb_entries').get();
            if (Math.abs(ftsCount.count - entriesCount.count) > 5) {
                recommendations.push('FTS index is out of sync - consider rebuilding');
            }
        }
        catch (error) {
            recommendations.push('FTS index health check failed');
        }
        return recommendations;
    }
    estimateIndexSize(indexName) {
        try {
            return 1024;
        }
        catch (error) {
            return 0;
        }
    }
    calculateIndexEffectiveness(indexName) {
        const usage = this.indexUsageStats.get(indexName) || 0;
        const baseScore = Math.min(usage / 100, 1.0);
        if (indexName.includes('fts') || indexName.includes('covering')) {
            return Math.min(baseScore * 1.5, 1.0);
        }
        return baseScore;
    }
    getIndexRecommendations(index, usage, effectiveness) {
        const recommendations = [];
        if (usage === 0) {
            recommendations.push('Index is never used - consider dropping');
        }
        else if (usage < 10) {
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
    extractColumnsFromSQL(sql) {
        const match = sql.match(/\((.*?)\)/);
        if (match) {
            return match[1].split(',').map(col => col.trim().split(' ')[0]);
        }
        return [];
    }
    generateMaintenanceReport() {
        const metrics = this.analyzeIndexEffectiveness();
        const usedIndexes = metrics.filter(m => m.usage > 0).length;
        const avgEffectiveness = metrics.reduce((sum, m) => sum + m.effectiveness, 0) / metrics.length;
        const totalRecommendations = metrics.reduce((sum, m) => sum + m.recommendations.length, 0);
        const actions = [];
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
                recommendations: totalRecommendations
            },
            details: metrics,
            actions
        };
    }
}
exports.AdvancedIndexStrategy = AdvancedIndexStrategy;
//# sourceMappingURL=AdvancedIndexStrategy.js.map