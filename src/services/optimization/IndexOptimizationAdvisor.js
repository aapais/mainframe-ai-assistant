"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexOptimizationAdvisor = void 0;
const events_1 = require("events");
class IndexOptimizationAdvisor extends events_1.EventEmitter {
    queryHistory = [];
    indexStats = new Map();
    tableStats = new Map();
    suggestions = new Map();
    optimizationRules = new Map();
    constructor() {
        super();
        this.initializeOptimizationRules();
    }
    async initialize() {
        console.log('Initializing IndexOptimizationAdvisor...');
        await this.loadDatabaseStatistics();
        await this.analyzeExistingIndexes();
        console.log('IndexOptimizationAdvisor initialized');
    }
    recordQuery(query) {
        this.queryHistory.push({
            ...query,
            timestamp: Date.now()
        });
        if (this.queryHistory.length > 50000) {
            this.queryHistory = this.queryHistory.slice(-50000);
        }
        this.updateTableStatistics(query);
        this.analyzeQueryForOptimization(query);
        this.emit('query-recorded', query);
    }
    async analyzeIndexes() {
        const analysis = {
            indexUtilization: this.calculateIndexUtilization(),
            missingIndexes: await this.identifyMissingIndexes(),
            unusedIndexes: this.identifyUnusedIndexes(),
            duplicateIndexes: this.identifyDuplicateIndexes(),
            fragmentedIndexes: this.identifyFragmentedIndexes(),
            oversizedIndexes: this.identifyOversizedIndexes()
        };
        this.emit('indexes-analyzed', analysis);
        return [this.createIndexAnalysisMetric(analysis)];
    }
    async getOptimizationRecommendations(metrics) {
        const recommendations = [];
        for (const [ruleName, rule] of this.optimizationRules) {
            try {
                const ruleRecommendations = rule({
                    queryHistory: this.queryHistory,
                    indexStats: this.indexStats,
                    tableStats: this.tableStats
                });
                recommendations.push(...ruleRecommendations);
            }
            catch (error) {
                console.error(`Error applying optimization rule ${ruleName}:`, error);
            }
        }
        const uniqueRecommendations = this.deduplicateRecommendations(recommendations);
        return this.prioritizeRecommendations(uniqueRecommendations);
    }
    async applyOptimization(recommendation) {
        try {
            console.log(`Applying index optimization: ${recommendation.title}`);
            const success = await this.simulateIndexCreation(recommendation);
            if (success) {
                this.recordAppliedOptimization(recommendation);
                this.emit('optimization-applied', {
                    recommendation,
                    timestamp: Date.now()
                });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Error applying index optimization:', error);
            return false;
        }
    }
    initializeOptimizationRules() {
        this.optimizationRules.set('missing_where_indexes', (data) => {
            const recommendations = [];
            const frequentFilters = this.analyzeFilterPatterns(data.queryHistory);
            for (const [table, columns] of frequentFilters) {
                if (!this.hasIndexForColumns(table, columns)) {
                    recommendations.push({
                        id: `missing-where-${table}-${Date.now()}`,
                        timestamp: Date.now(),
                        table,
                        suggestedIndex: {
                            name: `idx_${table}_${columns.join('_')}`,
                            columns,
                            type: 'btree',
                            unique: false
                        },
                        reason: `Frequent WHERE clauses on columns: ${columns.join(', ')}`,
                        impact: this.calculateFilterImpact(data.queryHistory, table, columns),
                        effort: 'low',
                        estimatedImprovement: 60,
                        affectedQueries: this.findQueriesUsingColumns(data.queryHistory, table, columns),
                        cost: {
                            diskSpace: this.estimateIndexSize(table, columns),
                            maintenanceOverhead: 3,
                            creationTime: 5
                        },
                        benefits: {
                            querySpeedup: 3.5,
                            concurrencyImprovement: true,
                            lockReduction: true
                        }
                    });
                }
            }
            return recommendations;
        });
        this.optimizationRules.set('missing_orderby_indexes', (data) => {
            const recommendations = [];
            const orderByPatterns = this.analyzeOrderByPatterns(data.queryHistory);
            for (const [table, columns] of orderByPatterns) {
                if (!this.hasIndexForColumns(table, columns)) {
                    recommendations.push({
                        id: `missing-orderby-${table}-${Date.now()}`,
                        timestamp: Date.now(),
                        table,
                        suggestedIndex: {
                            name: `idx_${table}_sort_${columns.join('_')}`,
                            columns,
                            type: 'btree',
                            unique: false
                        },
                        reason: `Frequent ORDER BY operations on columns: ${columns.join(', ')}`,
                        impact: 'medium',
                        effort: 'low',
                        estimatedImprovement: 40,
                        affectedQueries: this.findQueriesWithOrderBy(data.queryHistory, table, columns),
                        cost: {
                            diskSpace: this.estimateIndexSize(table, columns),
                            maintenanceOverhead: 2,
                            creationTime: 3
                        },
                        benefits: {
                            querySpeedup: 2.8,
                            concurrencyImprovement: false,
                            lockReduction: false
                        }
                    });
                }
            }
            return recommendations;
        });
        this.optimizationRules.set('composite_indexes', (data) => {
            const recommendations = [];
            const multiColumnPatterns = this.analyzeMultiColumnPatterns(data.queryHistory);
            for (const pattern of multiColumnPatterns) {
                if (!this.hasCompositeIndex(pattern.table, pattern.columns)) {
                    recommendations.push({
                        id: `composite-${pattern.table}-${Date.now()}`,
                        timestamp: Date.now(),
                        table: pattern.table,
                        suggestedIndex: {
                            name: `idx_${pattern.table}_composite_${pattern.columns.join('_')}`,
                            columns: pattern.columns,
                            type: 'composite',
                            unique: false
                        },
                        reason: `Multi-column queries benefit from composite index: ${pattern.columns.join(', ')}`,
                        impact: 'high',
                        effort: 'medium',
                        estimatedImprovement: 75,
                        affectedQueries: pattern.queries,
                        cost: {
                            diskSpace: this.estimateIndexSize(pattern.table, pattern.columns),
                            maintenanceOverhead: 4,
                            creationTime: 8
                        },
                        benefits: {
                            querySpeedup: 4.2,
                            concurrencyImprovement: true,
                            lockReduction: true
                        }
                    });
                }
            }
            return recommendations;
        });
        this.optimizationRules.set('partial_indexes', (data) => {
            const recommendations = [];
            const partialIndexOpportunities = this.analyzePartialIndexOpportunities(data.queryHistory);
            for (const opportunity of partialIndexOpportunities) {
                recommendations.push({
                    id: `partial-${opportunity.table}-${Date.now()}`,
                    timestamp: Date.now(),
                    table: opportunity.table,
                    suggestedIndex: {
                        name: `idx_${opportunity.table}_partial_${opportunity.columns.join('_')}`,
                        columns: opportunity.columns,
                        type: 'partial',
                        unique: false,
                        partial: opportunity.condition
                    },
                    reason: `Partial index for common filter: ${opportunity.condition}`,
                    impact: 'medium',
                    effort: 'medium',
                    estimatedImprovement: 50,
                    affectedQueries: opportunity.queries,
                    cost: {
                        diskSpace: this.estimateIndexSize(opportunity.table, opportunity.columns) * 0.3,
                        maintenanceOverhead: 2,
                        creationTime: 4
                    },
                    benefits: {
                        querySpeedup: 3.0,
                        concurrencyImprovement: true,
                        lockReduction: false
                    }
                });
            }
            return recommendations;
        });
        this.optimizationRules.set('remove_unused_indexes', (data) => {
            const recommendations = [];
            const unusedIndexes = this.identifyUnusedIndexes();
            for (const indexName of unusedIndexes) {
                const indexStat = data.indexStats.get(indexName);
                if (indexStat) {
                    recommendations.push({
                        id: `remove-unused-${indexName}-${Date.now()}`,
                        timestamp: Date.now(),
                        table: indexStat.table,
                        suggestedIndex: {
                            name: indexName,
                            columns: indexStat.columns,
                            type: 'btree',
                            unique: false
                        },
                        reason: `Index is unused and consuming resources`,
                        impact: 'low',
                        effort: 'low',
                        estimatedImprovement: 10,
                        affectedQueries: [],
                        cost: {
                            diskSpace: -indexStat.size / (1024 * 1024),
                            maintenanceOverhead: -2,
                            creationTime: 1
                        },
                        benefits: {
                            querySpeedup: 1.0,
                            concurrencyImprovement: false,
                            lockReduction: true
                        }
                    });
                }
            }
            return recommendations;
        });
    }
    analyzeFilterPatterns(queries) {
        const patterns = new Map();
        queries.forEach(query => {
            query.tablesAccessed.forEach(table => {
                if (!patterns.has(table)) {
                    patterns.set(table, new Map());
                }
                const tablePatterns = patterns.get(table);
                query.filterConditions.forEach(condition => {
                    const columns = this.extractColumnsFromCondition(condition);
                    columns.forEach(column => {
                        tablePatterns.set(column, (tablePatterns.get(column) || 0) + 1);
                    });
                });
            });
        });
        const result = new Map();
        for (const [table, columnCounts] of patterns) {
            const frequentColumns = Array.from(columnCounts.entries())
                .filter(([, count]) => count >= 5)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([column]) => column);
            if (frequentColumns.length > 0) {
                result.set(table, frequentColumns);
            }
        }
        return result;
    }
    analyzeOrderByPatterns(queries) {
        const patterns = new Map();
        queries.forEach(query => {
            query.tablesAccessed.forEach(table => {
                if (query.orderByColumns.length > 0) {
                    if (!patterns.has(table)) {
                        patterns.set(table, new Map());
                    }
                    const tablePatterns = patterns.get(table);
                    const orderByKey = query.orderByColumns.join(',');
                    tablePatterns.set(orderByKey, (tablePatterns.get(orderByKey) || 0) + 1);
                }
            });
        });
        const result = new Map();
        for (const [table, columnCounts] of patterns) {
            const frequentPattern = Array.from(columnCounts.entries())
                .filter(([, count]) => count >= 3)
                .sort((a, b) => b[1] - a[1])[0];
            if (frequentPattern) {
                result.set(table, frequentPattern[0].split(','));
            }
        }
        return result;
    }
    analyzeMultiColumnPatterns(queries) {
        const patterns = [];
        const multiColumnQueries = queries.filter(q => q.filterConditions.length >= 2);
        const tablePatterns = new Map();
        multiColumnQueries.forEach(query => {
            query.tablesAccessed.forEach(table => {
                if (!tablePatterns.has(table)) {
                    tablePatterns.set(table, new Map());
                }
                const tableData = tablePatterns.get(table);
                const columns = query.filterConditions
                    .flatMap(condition => this.extractColumnsFromCondition(condition))
                    .sort()
                    .join(',');
                if (!tableData.has(columns)) {
                    tableData.set(columns, { count: 0, queries: [] });
                }
                const data = tableData.get(columns);
                data.count++;
                data.queries.push(query.query);
            });
        });
        for (const [table, columnPatterns] of tablePatterns) {
            for (const [columns, data] of columnPatterns) {
                if (data.count >= 3 && columns.includes(',')) {
                    patterns.push({
                        table,
                        columns: columns.split(','),
                        count: data.count,
                        queries: data.queries
                    });
                }
            }
        }
        return patterns.sort((a, b) => b.count - a.count);
    }
    analyzePartialIndexOpportunities(queries) {
        const opportunities = [];
        const conditionPatterns = new Map();
        queries.forEach(query => {
            query.filterConditions.forEach(condition => {
                if (this.isPartialIndexCandidate(condition)) {
                    const key = `${query.tablesAccessed[0]}:${condition}`;
                    if (!conditionPatterns.has(key)) {
                        conditionPatterns.set(key, { count: 0, queries: [] });
                    }
                    const data = conditionPatterns.get(key);
                    data.count++;
                    data.queries.push(query.query);
                }
            });
        });
        for (const [key, data] of conditionPatterns) {
            if (data.count >= 5) {
                const [table, condition] = key.split(':');
                const columns = this.extractColumnsFromCondition(condition);
                opportunities.push({
                    table,
                    columns,
                    condition,
                    count: data.count,
                    queries: data.queries
                });
            }
        }
        return opportunities.sort((a, b) => b.count - a.count);
    }
    isPartialIndexCandidate(condition) {
        const partialIndexPatterns = [
            /status\s*=\s*['"]active['"]$/i,
            /deleted\s*=\s*false$/i,
            /published\s*=\s*true$/i,
            /type\s*=\s*['"][^'"]+['"]$/i
        ];
        return partialIndexPatterns.some(pattern => pattern.test(condition));
    }
    extractColumnsFromCondition(condition) {
        const matches = condition.match(/(\w+)\s*[=<>!]/g);
        return matches ? matches.map(match => match.split(/\s*[=<>!]/)[0]) : [];
    }
    hasIndexForColumns(table, columns) {
        for (const [, indexStat] of this.indexStats) {
            if (indexStat.table === table) {
                const hasAllColumns = columns.every(col => indexStat.columns.includes(col));
                if (hasAllColumns)
                    return true;
            }
        }
        return false;
    }
    hasCompositeIndex(table, columns) {
        for (const [, indexStat] of this.indexStats) {
            if (indexStat.table === table && indexStat.columns.length > 1) {
                const indexColumnsStr = indexStat.columns.join(',');
                const requiredColumnsStr = columns.join(',');
                if (indexColumnsStr === requiredColumnsStr ||
                    indexColumnsStr.startsWith(requiredColumnsStr)) {
                    return true;
                }
            }
        }
        return false;
    }
    calculateFilterImpact(queries, table, columns) {
        const affectedQueries = this.findQueriesUsingColumns(queries, table, columns);
        const avgExecutionTime = affectedQueries.reduce((sum, q) => sum + (queries.find(query => query.query === q)?.executionTime || 0), 0) / affectedQueries.length;
        if (affectedQueries.length >= 20 && avgExecutionTime > 1000)
            return 'critical';
        if (affectedQueries.length >= 10 && avgExecutionTime > 500)
            return 'high';
        if (affectedQueries.length >= 5)
            return 'medium';
        return 'low';
    }
    findQueriesUsingColumns(queries, table, columns) {
        return queries
            .filter(query => query.tablesAccessed.includes(table) &&
            query.filterConditions.some(condition => columns.some(col => condition.includes(col))))
            .map(query => query.query);
    }
    findQueriesWithOrderBy(queries, table, columns) {
        return queries
            .filter(query => query.tablesAccessed.includes(table) &&
            columns.every(col => query.orderByColumns.includes(col)))
            .map(query => query.query);
    }
    estimateIndexSize(table, columns) {
        const tableStats = this.tableStats.get(table);
        if (!tableStats)
            return 10;
        const avgColumnSize = 50;
        const indexOverhead = 1.2;
        return (tableStats.rowCount * columns.length * avgColumnSize * indexOverhead) / (1024 * 1024);
    }
    identifyUnusedIndexes() {
        const unused = [];
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        for (const [indexName, stats] of this.indexStats) {
            if (stats.lastUsed < thirtyDaysAgo &&
                stats.usage.scans === 0 &&
                stats.usage.seeks === 0) {
                unused.push(indexName);
            }
        }
        return unused;
    }
    identifyDuplicateIndexes() {
        const duplicates = [];
        const indexSignatures = new Map();
        for (const [indexName, stats] of this.indexStats) {
            const signature = `${stats.table}:${stats.columns.sort().join(',')}`;
            if (!indexSignatures.has(signature)) {
                indexSignatures.set(signature, []);
            }
            indexSignatures.get(signature).push(indexName);
        }
        for (const [, indexes] of indexSignatures) {
            if (indexes.length > 1) {
                duplicates.push(indexes);
            }
        }
        return duplicates;
    }
    identifyFragmentedIndexes() {
        const fragmented = [];
        for (const [indexName, stats] of this.indexStats) {
            if (stats.fragmentationLevel > 30) {
                fragmented.push(indexName);
            }
        }
        return fragmented;
    }
    identifyOversizedIndexes() {
        const oversized = [];
        const maxReasonableSize = 100 * 1024 * 1024;
        for (const [indexName, stats] of this.indexStats) {
            if (stats.size > maxReasonableSize && stats.efficiency < 50) {
                oversized.push(indexName);
            }
        }
        return oversized;
    }
    calculateIndexUtilization() {
        const utilization = new Map();
        for (const [indexName, stats] of this.indexStats) {
            const totalOperations = stats.usage.scans + stats.usage.seeks + stats.usage.lookups;
            const efficiency = stats.efficiency;
            const score = Math.min(100, (totalOperations / 100) * (efficiency / 100) * 100);
            utilization.set(indexName, score);
        }
        return utilization;
    }
    async identifyMissingIndexes() {
        const missing = [];
        const slowQueries = this.queryHistory.filter(q => q.executionTime > 1000);
        for (const query of slowQueries) {
            if (query.rowsExamined > query.rowsReturned * 10) {
                const suggestion = `Index needed for ${query.tablesAccessed.join(', ')} on ${query.filterConditions.join(', ')}`;
                missing.push(suggestion);
            }
        }
        return [...new Set(missing)];
    }
    updateTableStatistics(query) {
        query.tablesAccessed.forEach(table => {
            if (!this.tableStats.has(table)) {
                this.tableStats.set(table, {
                    name: table,
                    rowCount: 0,
                    dataSize: 0,
                    indexSize: 0,
                    avgRowSize: 0,
                    hotColumns: [],
                    slowQueries: [],
                    indexUtilization: new Map()
                });
            }
            const stats = this.tableStats.get(table);
            if (query.executionTime > 1000) {
                stats.slowQueries.push(query);
                if (stats.slowQueries.length > 100) {
                    stats.slowQueries = stats.slowQueries.slice(-100);
                }
            }
            query.filterConditions.forEach(condition => {
                const columns = this.extractColumnsFromCondition(condition);
                columns.forEach(column => {
                    if (!stats.hotColumns.includes(column)) {
                        stats.hotColumns.push(column);
                    }
                });
            });
        });
    }
    analyzeQueryForOptimization(query) {
        if (query.executionTime > 3000 && query.rowsExamined > query.rowsReturned * 50) {
            this.emit('immediate-optimization-needed', {
                query: query.query,
                table: query.tablesAccessed[0],
                executionTime: query.executionTime,
                inefficiency: query.rowsExamined / query.rowsReturned,
                suggestion: 'Consider adding index for filter conditions'
            });
        }
    }
    deduplicateRecommendations(recommendations) {
        const seen = new Set();
        const unique = [];
        for (const rec of recommendations) {
            const key = `${rec.table}:${rec.suggestedIndex.columns.join(',')}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(rec);
            }
        }
        return unique;
    }
    prioritizeRecommendations(recommendations) {
        return recommendations.sort((a, b) => {
            const impactScore = { critical: 4, high: 3, medium: 2, low: 1 };
            const effortScore = { low: 3, medium: 2, high: 1 };
            const scoreA = impactScore[a.impact] + (a.estimatedImprovement / 10) + effortScore[a.effort];
            const scoreB = impactScore[b.impact] + (b.estimatedImprovement / 10) + effortScore[b.effort];
            return scoreB - scoreA;
        });
    }
    async simulateIndexCreation(recommendation) {
        const successRate = 0.9;
        return Math.random() < successRate;
    }
    recordAppliedOptimization(recommendation) {
        if (recommendation.suggestedIndex) {
            const newIndex = {
                name: recommendation.suggestedIndex.name,
                table: recommendation.table,
                columns: recommendation.suggestedIndex.columns,
                size: recommendation.cost.diskSpace * 1024 * 1024,
                usage: { scans: 0, seeks: 0, lookups: 0, updates: 0 },
                efficiency: 100,
                lastUsed: Date.now(),
                fragmentationLevel: 0
            };
            this.indexStats.set(newIndex.name, newIndex);
        }
    }
    createIndexAnalysisMetric(analysis) {
        return {
            timestamp: Date.now(),
            category: 'database',
            metric: 'index_optimization',
            value: analysis.indexUtilization.size,
            unit: 'indexes',
            trend: 'stable',
            severity: analysis.missingIndexes.length > 5 ? 'high' : 'medium'
        };
    }
    async loadDatabaseStatistics() {
        const sampleTables = ['users', 'posts', 'comments', 'categories'];
        sampleTables.forEach(table => {
            this.tableStats.set(table, {
                name: table,
                rowCount: Math.floor(Math.random() * 100000) + 1000,
                dataSize: Math.floor(Math.random() * 100000000),
                indexSize: Math.floor(Math.random() * 10000000),
                avgRowSize: Math.floor(Math.random() * 500) + 100,
                hotColumns: [],
                slowQueries: [],
                indexUtilization: new Map()
            });
        });
    }
    async analyzeExistingIndexes() {
        const sampleIndexes = [
            { name: 'idx_users_email', table: 'users', columns: ['email'] },
            { name: 'idx_posts_user_id', table: 'posts', columns: ['user_id'] },
            { name: 'idx_comments_post_id', table: 'comments', columns: ['post_id'] }
        ];
        sampleIndexes.forEach(index => {
            this.indexStats.set(index.name, {
                ...index,
                size: Math.floor(Math.random() * 10000000),
                usage: {
                    scans: Math.floor(Math.random() * 1000),
                    seeks: Math.floor(Math.random() * 5000),
                    lookups: Math.floor(Math.random() * 2000),
                    updates: Math.floor(Math.random() * 500)
                },
                efficiency: Math.floor(Math.random() * 40) + 60,
                lastUsed: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
                fragmentationLevel: Math.floor(Math.random() * 50)
            });
        });
    }
    async destroy() {
        this.queryHistory.length = 0;
        this.indexStats.clear();
        this.tableStats.clear();
        this.suggestions.clear();
        this.optimizationRules.clear();
        console.log('IndexOptimizationAdvisor destroyed');
    }
}
exports.IndexOptimizationAdvisor = IndexOptimizationAdvisor;
exports.default = IndexOptimizationAdvisor;
//# sourceMappingURL=IndexOptimizationAdvisor.js.map