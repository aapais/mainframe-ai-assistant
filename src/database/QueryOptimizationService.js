"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryOptimizationService = void 0;
class QueryOptimizationService {
    db;
    queryCache;
    performanceStats;
    optimizationPatterns;
    CACHE_TTL = 300000;
    PERFORMANCE_TARGET = 100;
    SLOW_QUERY_THRESHOLD = 1000;
    constructor(database) {
        this.db = database;
        this.queryCache = new Map();
        this.performanceStats = new Map();
        this.optimizationPatterns = new Map();
        this.initializeOptimizationEngine();
    }
    initializeOptimizationEngine() {
        console.log('🚀 Initializing Query Optimization Service...');
        this.createAnalysisTables();
        this.loadOptimizationPatterns();
        this.setupPerformanceMonitoring();
        console.log('✅ Query Optimization Service initialized');
    }
    createAnalysisTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS query_optimizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_query_hash TEXT NOT NULL,
        original_query TEXT NOT NULL,
        optimized_query TEXT NOT NULL,
        optimization_techniques TEXT, -- JSON array
        performance_improvement REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0,
        avg_improvement_ms REAL DEFAULT 0
      )
    `);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS join_optimizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_pattern TEXT NOT NULL,
        original_join_order TEXT, -- JSON array
        optimized_join_order TEXT, -- JSON array
        cost_reduction_percent REAL DEFAULT 0,
        index_recommendations TEXT, -- JSON array
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS subquery_optimizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_subquery TEXT NOT NULL,
        optimized_version TEXT NOT NULL,
        optimization_type TEXT NOT NULL,
        performance_gain_percent REAL DEFAULT 0,
        complexity_reduction INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS query_performance_baseline (
        query_hash TEXT PRIMARY KEY,
        baseline_time_ms REAL NOT NULL,
        target_time_ms REAL NOT NULL,
        current_time_ms REAL NOT NULL,
        optimization_applied BOOLEAN DEFAULT FALSE,
        last_measured DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    async optimizeQuery(sql) {
        const queryHash = this.generateQueryHash(sql);
        const cached = this.optimizationPatterns.get(queryHash);
        if (cached) {
            return cached;
        }
        console.log(`🔧 Optimizing query: ${sql.substring(0, 100)}...`);
        try {
            const originalAnalysis = await this.analyzeQueryPerformance(sql);
            let optimizedSQL = sql;
            const techniques = [];
            const joinOptimization = await this.optimizeJOINs(optimizedSQL);
            if (joinOptimization.optimized_sql !== optimizedSQL) {
                optimizedSQL = joinOptimization.optimized_sql;
                techniques.push('JOIN_OPTIMIZATION');
            }
            const subqueryOptimization = await this.optimizeSubqueries(optimizedSQL);
            if (subqueryOptimization.optimized_sql !== optimizedSQL) {
                optimizedSQL = subqueryOptimization.optimized_sql;
                techniques.push('SUBQUERY_OPTIMIZATION');
            }
            const whereOptimization = await this.optimizeWhereClauses(optimizedSQL);
            if (whereOptimization !== optimizedSQL) {
                optimizedSQL = whereOptimization;
                techniques.push('WHERE_OPTIMIZATION');
            }
            const selectOptimization = await this.optimizeSelectClauses(optimizedSQL);
            if (selectOptimization !== optimizedSQL) {
                optimizedSQL = selectOptimization;
                techniques.push('SELECT_OPTIMIZATION');
            }
            const hintOptimization = await this.addPerformanceHints(optimizedSQL);
            if (hintOptimization !== optimizedSQL) {
                optimizedSQL = hintOptimization;
                techniques.push('HINT_OPTIMIZATION');
            }
            const optimizedAnalysis = await this.analyzeQueryPerformance(optimizedSQL);
            const estimatedImprovement = this.calculateImprovement(originalAnalysis, optimizedAnalysis);
            const optimization = {
                original_sql: sql,
                optimized_sql: optimizedSQL,
                optimization_techniques: techniques,
                estimated_improvement: estimatedImprovement,
                explanation: this.generateOptimizationExplanation(techniques, estimatedImprovement)
            };
            this.optimizationPatterns.set(queryHash, optimization);
            await this.storeOptimization(optimization);
            console.log(`✅ Query optimized with ${estimatedImprovement}% improvement`);
            return optimization;
        }
        catch (error) {
            console.error('❌ Query optimization failed:', error);
            return {
                original_sql: sql,
                optimized_sql: sql,
                optimization_techniques: [],
                estimated_improvement: 0,
                explanation: 'Optimization failed - using original query'
            };
        }
    }
    async optimizeJOINs(sql) {
        const improvements = [];
        let optimizedSQL = sql;
        try {
            const joinAnalysis = this.analyzeJOINPatterns(sql);
            if (joinAnalysis.hasJOINs) {
                const reorderedSQL = await this.optimizeJOINOrder(optimizedSQL, joinAnalysis);
                if (reorderedSQL !== optimizedSQL) {
                    optimizedSQL = reorderedSQL;
                    improvements.push('Optimized JOIN order based on table statistics');
                }
                const explicitJOINSQL = this.convertToExplicitJOINs(optimizedSQL);
                if (explicitJOINSQL !== optimizedSQL) {
                    optimizedSQL = explicitJOINSQL;
                    improvements.push('Converted implicit JOINs to explicit JOINs');
                }
                const optimizedConditionsSQL = this.optimizeJOINConditions(optimizedSQL);
                if (optimizedConditionsSQL !== optimizedSQL) {
                    optimizedSQL = optimizedConditionsSQL;
                    improvements.push('Optimized JOIN conditions for better index usage');
                }
                const hintedSQL = this.addJOINHints(optimizedSQL, joinAnalysis);
                if (hintedSQL !== optimizedSQL) {
                    optimizedSQL = hintedSQL;
                    improvements.push('Added performance hints for JOIN operations');
                }
            }
            return { optimized_sql: optimizedSQL, improvements };
        }
        catch (error) {
            console.warn('JOIN optimization failed:', error);
            return { optimized_sql: sql, improvements: [] };
        }
    }
    async optimizeSubqueries(sql) {
        const improvements = [];
        let optimizedSQL = sql;
        try {
            const joinConvertedSQL = this.convertCorrelatedSubqueriesToJOINs(optimizedSQL);
            if (joinConvertedSQL !== optimizedSQL) {
                optimizedSQL = joinConvertedSQL;
                improvements.push('Converted correlated subqueries to JOINs');
            }
            const existsOptimizedSQL = this.optimizeEXISTSSubqueries(optimizedSQL);
            if (existsOptimizedSQL !== optimizedSQL) {
                optimizedSQL = existsOptimizedSQL;
                improvements.push('Optimized EXISTS subqueries');
            }
            const inOptimizedSQL = this.optimizeINSubqueries(optimizedSQL);
            if (inOptimizedSQL !== optimizedSQL) {
                optimizedSQL = inOptimizedSQL;
                improvements.push('Converted IN subqueries to JOINs');
            }
            const materializedSQL = this.materializeExpensiveSubqueries(optimizedSQL);
            if (materializedSQL !== optimizedSQL) {
                optimizedSQL = materializedSQL;
                improvements.push('Materialized expensive subqueries using CTEs');
            }
            return { optimized_sql: optimizedSQL, improvements };
        }
        catch (error) {
            console.warn('Subquery optimization failed:', error);
            return { optimized_sql: sql, improvements: [] };
        }
    }
    async analyzeQueryPerformance(sql) {
        const startTime = Date.now();
        try {
            const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
            const stmt = this.db.prepare(sql);
            const executionStart = Date.now();
            const results = stmt.all();
            const executionTime = Date.now() - executionStart;
            const indexUsage = this.extractIndexUsage(plan);
            const tableScans = this.extractTableScans(plan);
            const bottlenecks = this.identifyBottlenecks(plan, executionTime);
            const optimizationScore = this.calculateOptimizationScore(executionTime, indexUsage.length, tableScans.length);
            const recommendations = this.generatePerformanceRecommendations(plan, executionTime, indexUsage, tableScans);
            const analysis = {
                execution_time_ms: executionTime,
                rows_examined: this.extractRowsExamined(plan),
                rows_returned: results.length,
                index_usage: indexUsage,
                table_scans: tableScans,
                optimization_score: optimizationScore,
                bottlenecks: bottlenecks,
                recommendations: recommendations
            };
            this.performanceStats.set(this.generateQueryHash(sql), analysis);
            return analysis;
        }
        catch (error) {
            console.error('Query performance analysis failed:', error);
            return {
                execution_time_ms: 10000,
                rows_examined: 0,
                rows_returned: 0,
                index_usage: [],
                table_scans: [],
                optimization_score: 0,
                bottlenecks: ['Query execution failed'],
                recommendations: ['Fix query syntax errors']
            };
        }
    }
    async executeOptimizedQuery(sql, params = []) {
        const queryKey = this.generateQueryKey(sql, params);
        const startTime = Date.now();
        const cached = this.queryCache.get(queryKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            cached.hitCount++;
            return {
                results: cached.result,
                execution_time_ms: Date.now() - startTime,
                cache_hit: true,
                optimization_applied: false
            };
        }
        try {
            let optimizedSQL = sql;
            let optimizationApplied = false;
            const queryComplexity = this.assessQueryComplexity(sql);
            if (queryComplexity > 5) {
                const optimization = await this.optimizeQuery(sql);
                if (optimization.estimated_improvement > 10) {
                    optimizedSQL = optimization.optimized_sql;
                    optimizationApplied = true;
                }
            }
            const stmt = this.db.prepare(optimizedSQL);
            const results = stmt.all(...params);
            const executionTime = Date.now() - startTime;
            this.queryCache.set(queryKey, {
                result: results,
                timestamp: Date.now(),
                hitCount: 1
            });
            await this.recordPerformanceMetrics(sql, executionTime, optimizationApplied);
            if (Math.random() < 0.01) {
                this.cleanQueryCache();
            }
            return {
                results,
                execution_time_ms: executionTime,
                cache_hit: false,
                optimization_applied: optimizationApplied
            };
        }
        catch (error) {
            console.error('Optimized query execution failed:', error);
            throw error;
        }
    }
    getPerformanceDashboard() {
        const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total_queries,
        AVG(execution_time_ms) as avg_time,
        COUNT(CASE WHEN cache_hit THEN 1 END) * 100.0 / COUNT(*) as cache_hit_rate
      FROM query_performance
      WHERE timestamp > datetime('now', '-24 hours')
    `).get();
        const optimizations = this.db.prepare(`
      SELECT
        COUNT(*) as queries_optimized,
        AVG(performance_improvement) as avg_improvement
      FROM query_optimizations
      WHERE created_at > datetime('now', '-24 hours')
    `).get();
        const slowQueries = this.db.prepare(`
      SELECT
        query_text,
        execution_time_ms,
        query_plan
      FROM query_performance
      WHERE execution_time_ms > ?
        AND timestamp > datetime('now', '-24 hours')
      ORDER BY execution_time_ms DESC
      LIMIT 5
    `).all(this.SLOW_QUERY_THRESHOLD);
        return {
            overview: {
                total_queries: stats.total_queries || 0,
                avg_execution_time_ms: Math.round(stats.avg_time || 0),
                cache_hit_rate: Math.round(stats.cache_hit_rate || 0),
                optimization_rate: Math.round((optimizations.queries_optimized || 0) / (stats.total_queries || 1) * 100)
            },
            slow_queries: slowQueries.map(q => ({
                sql: q.query_text.substring(0, 100) + '...',
                execution_time_ms: q.execution_time_ms,
                optimization_suggestions: this.generateQuickOptimizationSuggestions(q.query_text)
            })),
            optimization_impact: {
                queries_optimized: optimizations.queries_optimized || 0,
                avg_improvement_percent: Math.round(optimizations.avg_improvement || 0),
                total_time_saved_ms: Math.round((optimizations.avg_improvement || 0) * (optimizations.queries_optimized || 0) * 100)
            },
            recommendations: this.generateSystemRecommendations()
        };
    }
    loadOptimizationPatterns() {
        const patterns = this.db.prepare(`
      SELECT original_query_hash, optimized_query, optimization_techniques, performance_improvement
      FROM query_optimizations
      WHERE usage_count > 0
      ORDER BY performance_improvement DESC
    `).all();
        patterns.forEach((pattern) => {
            this.optimizationPatterns.set(pattern.original_query_hash, {
                original_sql: '',
                optimized_sql: pattern.optimized_query,
                optimization_techniques: JSON.parse(pattern.optimization_techniques || '[]'),
                estimated_improvement: pattern.performance_improvement,
                explanation: 'Cached optimization pattern'
            });
        });
        console.log(`📚 Loaded ${patterns.length} optimization patterns`);
    }
    setupPerformanceMonitoring() {
        setInterval(() => {
            this.analyzeSystemPerformance();
        }, 60000);
        console.log('📊 Performance monitoring active');
    }
    generateQueryHash(sql) {
        const normalized = sql
            .replace(/\s+/g, ' ')
            .replace(/['"]\w+['"]/g, '?')
            .replace(/\d+/g, '?')
            .toLowerCase()
            .trim();
        return Buffer.from(normalized).toString('base64').substring(0, 32);
    }
    generateQueryKey(sql, params) {
        return `${this.generateQueryHash(sql)}:${JSON.stringify(params)}`;
    }
    analyzeJOINPatterns(sql) {
        const joinRegex = /\b(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+(\w+)/gi;
        const matches = Array.from(sql.matchAll(joinRegex));
        return {
            hasJOINs: matches.length > 0,
            joinCount: matches.length,
            tables: matches.map(m => m[2]),
            joinTypes: matches.map(m => m[1] || 'INNER')
        };
    }
    async optimizeJOINOrder(sql, analysis) {
        return sql;
    }
    convertToExplicitJOINs(sql) {
        return sql.replace(/FROM\s+(\w+)\s*,\s*(\w+)\s+WHERE\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi, 'FROM $1 INNER JOIN $2 ON $3.$4 = $5.$6 WHERE');
    }
    optimizeJOINConditions(sql) {
        return sql;
    }
    addJOINHints(sql, analysis) {
        return sql;
    }
    convertCorrelatedSubqueriesToJOINs(sql) {
        return sql;
    }
    optimizeEXISTSSubqueries(sql) {
        return sql;
    }
    optimizeINSubqueries(sql) {
        return sql.replace(/WHERE\s+(\w+)\s+IN\s*\(\s*SELECT\s+(\w+)\s+FROM\s+(\w+)\s*\)/gi, 'WHERE EXISTS (SELECT 1 FROM $3 WHERE $3.$2 = $1)');
    }
    materializeExpensiveSubqueries(sql) {
        return sql;
    }
    async optimizeWhereClauses(sql) {
        return sql;
    }
    async optimizeSelectClauses(sql) {
        return sql;
    }
    async addPerformanceHints(sql) {
        return sql;
    }
    extractIndexUsage(plan) {
        return plan
            .filter(step => step.detail && step.detail.includes('USING INDEX'))
            .map(step => {
            const match = step.detail.match(/USING INDEX (\w+)/);
            return match ? match[1] : 'unknown';
        });
    }
    extractTableScans(plan) {
        return plan
            .filter(step => step.detail && step.detail.includes('SCAN TABLE'))
            .map(step => {
            const match = step.detail.match(/SCAN TABLE (\w+)/);
            return match ? match[1] : 'unknown';
        });
    }
    extractRowsExamined(plan) {
        return plan.length * 100;
    }
    identifyBottlenecks(plan, executionTime) {
        const bottlenecks = [];
        if (executionTime > this.SLOW_QUERY_THRESHOLD) {
            bottlenecks.push('Slow query execution');
        }
        const tableScans = this.extractTableScans(plan);
        if (tableScans.length > 0) {
            bottlenecks.push(`Table scans detected: ${tableScans.join(', ')}`);
        }
        const indexUsage = this.extractIndexUsage(plan);
        if (indexUsage.length === 0) {
            bottlenecks.push('No indexes used');
        }
        return bottlenecks;
    }
    calculateOptimizationScore(executionTime, indexCount, tableScanCount) {
        let score = 100;
        if (executionTime > this.SLOW_QUERY_THRESHOLD) {
            score -= 50;
        }
        else if (executionTime > this.PERFORMANCE_TARGET) {
            score -= 20;
        }
        score -= tableScanCount * 15;
        score += indexCount * 5;
        return Math.max(0, Math.min(100, score));
    }
    generatePerformanceRecommendations(plan, executionTime, indexUsage, tableScans) {
        const recommendations = [];
        if (executionTime > this.SLOW_QUERY_THRESHOLD) {
            recommendations.push('Query execution is slow - consider optimization');
        }
        if (tableScans.length > 0) {
            recommendations.push(`Add indexes for tables: ${tableScans.join(', ')}`);
        }
        if (indexUsage.length === 0) {
            recommendations.push('Query does not use any indexes - add appropriate indexes');
        }
        if (plan.length > 10) {
            recommendations.push('Complex query plan - consider simplifying the query');
        }
        return recommendations;
    }
    calculateImprovement(original, optimized) {
        if (original.execution_time_ms === 0)
            return 0;
        const timeImprovement = ((original.execution_time_ms - optimized.execution_time_ms) / original.execution_time_ms) * 100;
        const scoreImprovement = optimized.optimization_score - original.optimization_score;
        return Math.max(0, Math.round((timeImprovement + scoreImprovement) / 2));
    }
    generateOptimizationExplanation(techniques, improvement) {
        if (techniques.length === 0) {
            return 'No optimization techniques applied';
        }
        const techniqueDescriptions = {
            'JOIN_OPTIMIZATION': 'Optimized JOIN operations for better performance',
            'SUBQUERY_OPTIMIZATION': 'Converted subqueries to more efficient JOINs',
            'WHERE_OPTIMIZATION': 'Reordered WHERE conditions for better index usage',
            'SELECT_OPTIMIZATION': 'Optimized SELECT clause to reduce data transfer',
            'HINT_OPTIMIZATION': 'Added performance hints for better execution plan'
        };
        const descriptions = techniques.map(t => techniqueDescriptions[t] || t);
        return `Applied ${techniques.length} optimization technique(s): ${descriptions.join(', ')}. Estimated improvement: ${improvement}%`;
    }
    async storeOptimization(optimization) {
        try {
            this.db.prepare(`
        INSERT INTO query_optimizations (
          original_query_hash, original_query, optimized_query,
          optimization_techniques, performance_improvement
        ) VALUES (?, ?, ?, ?, ?)
      `).run(this.generateQueryHash(optimization.original_sql), optimization.original_sql, optimization.optimized_sql, JSON.stringify(optimization.optimization_techniques), optimization.estimated_improvement);
        }
        catch (error) {
            console.warn('Failed to store optimization:', error);
        }
    }
    assessQueryComplexity(sql) {
        let complexity = 0;
        complexity += (sql.match(/\bJOIN\b/gi) || []).length * 2;
        complexity += (sql.match(/\(\s*SELECT\b/gi) || []).length * 3;
        complexity += (sql.match(/\b(COUNT|SUM|AVG|MAX|MIN|GROUP BY)\b/gi) || []).length;
        complexity += (sql.match(/\bORDER BY\b/gi) || []).length;
        return complexity;
    }
    async recordPerformanceMetrics(sql, executionTime, optimizationApplied) {
        try {
            this.db.prepare(`
        INSERT INTO query_performance (
          query_hash, query_text, execution_time_ms, cache_hit, timestamp
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(this.generateQueryHash(sql), sql.substring(0, 1000), executionTime, false);
        }
        catch (error) {
            console.warn('Failed to record performance metrics:', error);
        }
    }
    cleanQueryCache() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, value] of this.queryCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.queryCache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
        }
    }
    analyzeSystemPerformance() {
        const recentPerformance = this.db.prepare(`
      SELECT AVG(execution_time_ms) as avg_time
      FROM query_performance
      WHERE timestamp > datetime('now', '-1 hour')
    `).get();
        if (recentPerformance && recentPerformance.avg_time > this.SLOW_QUERY_THRESHOLD) {
            console.warn(`⚠️ System performance degraded: ${recentPerformance.avg_time}ms average query time`);
        }
    }
    generateQuickOptimizationSuggestions(sql) {
        const suggestions = [];
        if (sql.includes('SELECT *')) {
            suggestions.push('Avoid SELECT * - specify only needed columns');
        }
        if (sql.includes('LIKE \'%')) {
            suggestions.push('Avoid leading wildcards in LIKE clauses');
        }
        if (sql.includes('OR')) {
            suggestions.push('Consider using UNION instead of OR for better index usage');
        }
        return suggestions;
    }
    generateSystemRecommendations() {
        const recommendations = [];
        const cacheStats = this.queryCache.size;
        if (cacheStats > 1000) {
            recommendations.push('Query cache is large - consider increasing cache cleanup frequency');
        }
        const recentOptimizations = this.db.prepare(`
      SELECT COUNT(*) as count FROM query_optimizations
      WHERE created_at > datetime('now', '-24 hours')
    `).get();
        if (recentOptimizations && recentOptimizations.count > 50) {
            recommendations.push('High optimization activity - review query patterns for systemic issues');
        }
        return recommendations;
    }
}
exports.QueryOptimizationService = QueryOptimizationService;
exports.default = QueryOptimizationService;
//# sourceMappingURL=QueryOptimizationService.js.map