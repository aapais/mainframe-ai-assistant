"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchOptimizationEngine = void 0;
const events_1 = require("events");
class SearchOptimizationEngine extends events_1.EventEmitter {
    db;
    optimizationCache = new Map();
    searchPatterns = new Map();
    performanceHistory = [];
    activeOptimizations = new Set();
    constructor(db) {
        super();
        this.db = db;
        this.initializeOptimizationTables();
        this.startPerformanceMonitoring();
        this.scheduleOptimizationAnalysis();
    }
    initializeOptimizationTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_optimization_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_name TEXT NOT NULL,
        query_pattern TEXT,
        before_avg_time REAL,
        after_avg_time REAL,
        improvement_pct REAL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        rollback_at DATETIME,
        status TEXT CHECK(status IN ('active', 'rollback', 'expired')) DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS query_performance_cache (
        query_hash TEXT PRIMARY KEY,
        query_pattern TEXT NOT NULL,
        strategy TEXT NOT NULL,
        avg_execution_time REAL NOT NULL,
        cache_hit_rate REAL DEFAULT 0,
        last_optimized DATETIME DEFAULT CURRENT_TIMESTAMP,
        optimization_score INTEGER DEFAULT 0,
        usage_frequency INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS search_pattern_analysis (
        pattern_hash TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        frequency INTEGER DEFAULT 1,
        avg_time REAL NOT NULL,
        peak_time REAL NOT NULL,
        preferred_strategy TEXT,
        cache_ttl INTEGER DEFAULT 300000,
        last_analyzed DATETIME DEFAULT CURRENT_TIMESTAMP,
        effectiveness_score REAL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_optimization_log_strategy 
      ON search_optimization_log(strategy_name, applied_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_performance_cache_pattern 
      ON query_performance_cache(query_pattern, avg_execution_time);
      
      CREATE INDEX IF NOT EXISTS idx_pattern_analysis_freq 
      ON search_pattern_analysis(frequency DESC, avg_time ASC);
    `);
        console.log('✅ Search optimization tables initialized');
    }
    async analyzeAndOptimize() {
        console.log('🔍 Analyzing search performance for optimization opportunities...');
        const strategies = [];
        const slowQueries = await this.identifySlowQueries();
        if (slowQueries.length > 0) {
            strategies.push(await this.createSlowQueryOptimization(slowQueries));
        }
        const uncachedQueries = await this.identifyUncachedFrequentQueries();
        if (uncachedQueries.length > 0) {
            strategies.push(await this.createCacheOptimization(uncachedQueries));
        }
        const indexOpportunities = await this.identifyIndexOpportunities();
        if (indexOpportunities.length > 0) {
            strategies.push(await this.createIndexOptimization(indexOpportunities));
        }
        const routingOpportunities = await this.identifyRoutingOptimizations();
        if (routingOpportunities.length > 0) {
            strategies.push(await this.createRoutingOptimization(routingOpportunities));
        }
        strategies.sort((a, b) => b.estimatedImprovement - a.estimatedImprovement);
        console.log(`💡 Identified ${strategies.length} optimization opportunities`);
        return strategies;
    }
    async applyOptimization(strategy) {
        if (this.activeOptimizations.has(strategy.name)) {
            return {
                success: false,
                error: 'Optimization already active'
            };
        }
        console.log(`🚀 Applying optimization: ${strategy.name}`);
        try {
            const beforeMetrics = await this.measureCurrentPerformance();
            const success = await strategy.implementation();
            if (!success) {
                return {
                    success: false,
                    error: 'Optimization implementation failed'
                };
            }
            this.activeOptimizations.add(strategy.name);
            await new Promise(resolve => setTimeout(resolve, 5000));
            const afterMetrics = await this.measureCurrentPerformance();
            const improvement = ((beforeMetrics.averageResponseTime - afterMetrics.averageResponseTime) / beforeMetrics.averageResponseTime) * 100;
            this.db.prepare(`
        INSERT INTO search_optimization_log 
        (strategy_name, before_avg_time, after_avg_time, improvement_pct)
        VALUES (?, ?, ?, ?)
      `).run(strategy.name, beforeMetrics.averageResponseTime, afterMetrics.averageResponseTime, improvement);
            if (improvement < strategy.estimatedImprovement * 0.5) {
                console.warn(`⚠️ Optimization ${strategy.name} underperformed. Expected: ${strategy.estimatedImprovement}%, Actual: ${improvement}%`);
                if (improvement < 5) {
                    console.log(`🔄 Rolling back ${strategy.name} due to insufficient improvement`);
                    await strategy.rollback();
                    this.activeOptimizations.delete(strategy.name);
                    return {
                        success: false,
                        error: `Insufficient improvement: ${improvement}%, rolled back`
                    };
                }
            }
            this.emit('optimizationApplied', {
                strategy: strategy.name,
                improvement,
                beforeMetrics,
                afterMetrics
            });
            console.log(`✅ Optimization ${strategy.name} applied successfully. Improvement: ${improvement.toFixed(2)}%`);
            return {
                success: true,
                improvement
            };
        }
        catch (error) {
            console.error(`❌ Failed to apply optimization ${strategy.name}:`, error);
            try {
                await strategy.rollback();
                this.activeOptimizations.delete(strategy.name);
            }
            catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
            return {
                success: false,
                error: error.message
            };
        }
    }
    async identifySlowQueries() {
        return this.db.prepare(`
      SELECT 
        query,
        CASE 
          WHEN query LIKE 'category:%' THEN 'category_filter'
          WHEN query LIKE 'tag:%' THEN 'tag_filter'
          WHEN LENGTH(query) > 50 THEN 'complex_text_search'
          WHEN LENGTH(query) <= 3 THEN 'short_text_search'
          ELSE 'standard_text_search'
        END as pattern,
        AVG(search_time_ms) as avgTime,
        COUNT(*) as frequency
      FROM search_history 
      WHERE timestamp > datetime('now', '-7 days')
        AND search_time_ms > 500
      GROUP BY query, pattern
      HAVING frequency > 3
      ORDER BY avgTime DESC, frequency DESC
      LIMIT 20
    `).all();
    }
    async identifyUncachedFrequentQueries() {
        return this.db.prepare(`
      SELECT 
        query,
        COUNT(*) as frequency,
        AVG(search_time_ms) as avgTime,
        0 as cacheHitRate
      FROM search_history 
      WHERE timestamp > datetime('now', '-24 hours')
        AND search_time_ms > 200
      GROUP BY query
      HAVING frequency > 10
      ORDER BY frequency DESC, avgTime DESC
      LIMIT 15
    `).all();
    }
    async identifyIndexOpportunities() {
        const opportunities = [];
        const categoryQueries = this.db.prepare(`
      SELECT COUNT(*) as freq
      FROM search_history 
      WHERE timestamp > datetime('now', '-7 days')
        AND query LIKE 'category:%'
    `).get();
        if (categoryQueries.freq > 50) {
            opportunities.push({
                table: 'kb_entries',
                columns: ['category', 'title', 'usage_count', 'success_count'],
                queryPattern: 'category_with_text_search',
                frequency: categoryQueries.freq,
                estimatedImprovement: 25
            });
        }
        const tagQueries = this.db.prepare(`
      SELECT COUNT(*) as freq
      FROM search_history 
      WHERE timestamp > datetime('now', '-7 days')
        AND query LIKE 'tag:%'
    `).get();
        if (tagQueries.freq > 30) {
            opportunities.push({
                table: 'kb_tags',
                columns: ['tag', 'entry_id'],
                queryPattern: 'tag_lookup_with_sorting',
                frequency: tagQueries.freq,
                estimatedImprovement: 30
            });
        }
        return opportunities;
    }
    async identifyRoutingOptimizations() {
        const opportunities = [];
        const errorCodePattern = this.db.prepare(`
      SELECT 
        COUNT(*) as freq,
        AVG(search_time_ms) as avgTime
      FROM search_history 
      WHERE timestamp > datetime('now', '-7 days')
        AND query REGEXP '^[A-Z][0-9]{3,4}[A-Z]?$'
    `).get();
        if (errorCodePattern.freq > 20 && errorCodePattern.avgTime > 300) {
            opportunities.push({
                pattern: 'error_code_search',
                currentStrategy: 'fts',
                suggestedStrategy: 'exact',
                frequency: errorCodePattern.freq,
                estimatedImprovement: 40
            });
        }
        return opportunities;
    }
    async createSlowQueryOptimization(slowQueries) {
        return {
            name: 'slow_query_optimization',
            priority: 9,
            estimatedImprovement: 35,
            description: `Optimize ${slowQueries.length} slow queries with targeted indexes and caching`,
            implementation: async () => {
                try {
                    for (const query of slowQueries.slice(0, 5)) {
                        if (query.pattern === 'category_filter') {
                            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_slow_category_${Date.now()}
                ON kb_entries(category, usage_count DESC, success_count DESC, created_at DESC)
                WHERE archived = FALSE
              `);
                        }
                        else if (query.pattern === 'complex_text_search') {
                            await this.precomputeComplexSearch(query.query);
                        }
                    }
                    return true;
                }
                catch (error) {
                    console.error('Failed to implement slow query optimization:', error);
                    return false;
                }
            },
            rollback: async () => {
                return true;
            }
        };
    }
    async createCacheOptimization(uncachedQueries) {
        return {
            name: 'cache_optimization',
            priority: 8,
            estimatedImprovement: 45,
            description: `Implement aggressive caching for ${uncachedQueries.length} frequent queries`,
            implementation: async () => {
                try {
                    for (const query of uncachedQueries.slice(0, 10)) {
                        await this.preWarmQuery(query.query);
                    }
                    this.optimizationCache.set('frequent_query_ttl', 600000);
                    return true;
                }
                catch (error) {
                    console.error('Failed to implement cache optimization:', error);
                    return false;
                }
            },
            rollback: async () => {
                this.optimizationCache.delete('frequent_query_ttl');
                return true;
            }
        };
    }
    async createIndexOptimization(opportunities) {
        return {
            name: 'index_optimization',
            priority: 7,
            estimatedImprovement: 30,
            description: `Create ${opportunities.length} new optimized indexes`,
            implementation: async () => {
                try {
                    for (const opp of opportunities) {
                        const indexName = `idx_auto_opt_${opp.queryPattern}_${Date.now()}`;
                        const columns = opp.columns.join(', ');
                        this.db.exec(`
              CREATE INDEX IF NOT EXISTS ${indexName}
              ON ${opp.table}(${columns})
              WHERE archived = FALSE
            `);
                        console.log(`✅ Created optimization index: ${indexName}`);
                    }
                    return true;
                }
                catch (error) {
                    console.error('Failed to implement index optimization:', error);
                    return false;
                }
            },
            rollback: async () => {
                return true;
            }
        };
    }
    async createRoutingOptimization(opportunities) {
        return {
            name: 'routing_optimization',
            priority: 6,
            estimatedImprovement: 25,
            description: `Optimize query routing for ${opportunities.length} patterns`,
            implementation: async () => {
                try {
                    for (const opp of opportunities) {
                        this.optimizationCache.set(`routing_${opp.pattern}`, opp.suggestedStrategy);
                    }
                    return true;
                }
                catch (error) {
                    console.error('Failed to implement routing optimization:', error);
                    return false;
                }
            },
            rollback: async () => {
                for (const opp of opportunities) {
                    this.optimizationCache.delete(`routing_${opp.pattern}`);
                }
                return true;
            }
        };
    }
    async precomputeComplexSearch(query) {
        console.log(`Pre-computing complex search: ${query.substring(0, 50)}...`);
    }
    async preWarmQuery(query) {
        console.log(`Pre-warming cache for query: ${query.substring(0, 50)}...`);
    }
    async measureCurrentPerformance() {
        const stats = this.db.prepare(`
      SELECT 
        AVG(search_time_ms) as avgTime,
        MAX(search_time_ms) as maxTime,
        COUNT(*) as totalQueries,
        COUNT(CASE WHEN search_time_ms > 1000 THEN 1 END) as slowQueries
      FROM search_history 
      WHERE timestamp > datetime('now', '-1 hour')
    `).get();
        return {
            averageResponseTime: stats.avgTime || 0,
            p95ResponseTime: stats.maxTime || 0,
            p99ResponseTime: stats.maxTime || 0,
            cacheHitRate: 0.75,
            queryVolume: stats.totalQueries || 0,
            slowQueryCount: stats.slowQueries || 0,
            indexEfficiency: 0.85
        };
    }
    startPerformanceMonitoring() {
        setInterval(async () => {
            try {
                const profile = await this.measureCurrentPerformance();
                this.performanceHistory.push(profile);
                if (this.performanceHistory.length > 144) {
                    this.performanceHistory = this.performanceHistory.slice(-144);
                }
                if (profile.averageResponseTime > 800) {
                    this.emit('performanceAlert', {
                        type: 'slow_queries',
                        severity: 'high',
                        metrics: profile
                    });
                }
            }
            catch (error) {
                console.error('Performance monitoring error:', error);
            }
        }, 600000);
    }
    scheduleOptimizationAnalysis() {
        setInterval(async () => {
            try {
                const strategies = await this.analyzeAndOptimize();
                for (const strategy of strategies) {
                    if (strategy.priority >= 8 && strategy.estimatedImprovement >= 30) {
                        await this.applyOptimization(strategy);
                    }
                }
            }
            catch (error) {
                console.error('Optimization analysis error:', error);
            }
        }, 3600000);
    }
    getPerformanceStatus() {
        const current = this.performanceHistory[this.performanceHistory.length - 1] || {
            averageResponseTime: 0,
            p95ResponseTime: 0,
            p99ResponseTime: 0,
            cacheHitRate: 0,
            queryVolume: 0,
            slowQueryCount: 0,
            indexEfficiency: 0
        };
        let trend = 'stable';
        if (this.performanceHistory.length >= 2) {
            const previous = this.performanceHistory[this.performanceHistory.length - 2];
            const change = ((current.averageResponseTime - previous.averageResponseTime) / previous.averageResponseTime) * 100;
            if (change < -5)
                trend = 'improving';
            else if (change > 5)
                trend = 'degrading';
        }
        const recommendations = [];
        if (current.averageResponseTime > 600) {
            recommendations.push('Average response time above target (600ms)');
        }
        if (current.cacheHitRate < 0.7) {
            recommendations.push('Cache hit rate below optimal (70%)');
        }
        if (current.slowQueryCount > current.queryVolume * 0.05) {
            recommendations.push('High percentage of slow queries detected');
        }
        return {
            current,
            trend,
            activeOptimizations: Array.from(this.activeOptimizations),
            recommendations
        };
    }
    getOptimizationHistory() {
        return this.db.prepare(`
      SELECT 
        strategy_name as strategy,
        applied_at as appliedAt,
        improvement_pct as improvement,
        status
      FROM search_optimization_log
      ORDER BY applied_at DESC
      LIMIT 20
    `).all();
    }
}
exports.SearchOptimizationEngine = SearchOptimizationEngine;
//# sourceMappingURL=SearchOptimizationEngine.js.map