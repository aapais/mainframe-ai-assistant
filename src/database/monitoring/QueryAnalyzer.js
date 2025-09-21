"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryAnalyzer = void 0;
const events_1 = require("events");
class QueryAnalyzer extends events_1.EventEmitter {
    db;
    config;
    queryHistory = new Map();
    analyzedQueries = new Map();
    indexRecommendations = [];
    tableSchemas = new Map();
    constructor(db, config) {
        super();
        this.db = db;
        this.config = this.buildConfig(config);
        this.initializeAnalyzer();
    }
    buildConfig(config) {
        return {
            enabled: true,
            analysisThreshold: 100,
            captureSlowQueries: true,
            generateRecommendations: true,
            trackQueryPatterns: true,
            maxQueryHistory: 1000,
            autoIndexCreation: false,
            indexCreationThreshold: 20,
            ...config
        };
    }
    initializeAnalyzer() {
        if (!this.config.enabled)
            return;
        this.createAnalyzerTables();
        this.loadTableSchemas();
        this.loadQueryHistory();
    }
    createAnalyzerTables() {
        const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS query_analyses (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        query_hash TEXT NOT NULL,
        query TEXT NOT NULL,
        query_type TEXT NOT NULL,
        execution_plan TEXT NOT NULL, -- JSON
        index_usage TEXT NOT NULL, -- JSON
        performance_metrics TEXT NOT NULL, -- JSON
        optimization_suggestions TEXT, -- JSON
        analysis_timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS slow_query_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_hash TEXT NOT NULL,
        query TEXT NOT NULL,
        duration INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        table_names TEXT, -- JSON array
        index_usage TEXT, -- JSON array
        operation_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS index_recommendations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        table_name TEXT NOT NULL,
        columns TEXT NOT NULL, -- JSON array
        index_type TEXT NOT NULL,
        rationale TEXT NOT NULL,
        estimated_impact INTEGER NOT NULL,
        query_patterns TEXT NOT NULL, -- JSON array
        creation_sql TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'created', 'rejected', 'obsolete')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        implemented_at INTEGER,
        measured_impact INTEGER
      );

      CREATE TABLE IF NOT EXISTS query_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_hash TEXT NOT NULL UNIQUE,
        pattern_template TEXT NOT NULL,
        occurrence_count INTEGER DEFAULT 1,
        total_duration INTEGER DEFAULT 0,
        avg_duration INTEGER DEFAULT 0,
        table_names TEXT, -- JSON array
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        optimization_opportunities TEXT, -- JSON array
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_query_analyses_hash ON query_analyses(query_hash);
      CREATE INDEX IF NOT EXISTS idx_slow_query_hash ON slow_query_log(query_hash);
      CREATE INDEX IF NOT EXISTS idx_slow_query_duration ON slow_query_log(duration DESC);
      CREATE INDEX IF NOT EXISTS idx_index_recommendations_table ON index_recommendations(table_name);
      CREATE INDEX IF NOT EXISTS idx_query_patterns_hash ON query_patterns(pattern_hash);
    `;
        this.db.exec(createTablesSQL);
    }
    loadTableSchemas() {
        try {
            const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `).all();
            tables.forEach((table) => {
                try {
                    const schema = this.db.prepare(`PRAGMA table_info(${table.name})`).all();
                    const indexes = this.db.prepare(`PRAGMA index_list(${table.name})`).all();
                    this.tableSchemas.set(table.name, {
                        name: table.name,
                        columns: schema,
                        indexes
                    });
                }
                catch (error) {
                    console.error(`Failed to load schema for table ${table.name}:`, error);
                }
            });
        }
        catch (error) {
            console.error('Failed to load table schemas:', error);
        }
    }
    loadQueryHistory() {
        try {
            const results = this.db.prepare(`
        SELECT 
          query_hash,
          query,
          COUNT(*) as occurrences,
          SUM(duration) as total_duration,
          AVG(duration) as avg_duration,
          MAX(duration) as max_duration,
          MAX(timestamp) as last_seen
        FROM slow_query_log 
        GROUP BY query_hash
        ORDER BY avg_duration DESC
        LIMIT ?
      `).all(this.config.maxQueryHistory);
            results.forEach((row) => {
                this.queryHistory.set(row.query_hash, {
                    query: row.query,
                    queryHash: row.query_hash,
                    occurrences: row.occurrences,
                    totalDuration: row.total_duration,
                    avgDuration: row.avg_duration,
                    maxDuration: row.max_duration,
                    lastSeen: row.last_seen
                });
            });
        }
        catch (error) {
            console.error('Failed to load query history:', error);
        }
    }
    analyzeQuery(query, duration, metadata) {
        if (!this.config.enabled) {
            throw new Error('Query analyzer is disabled');
        }
        const queryHash = this.hashQuery(query);
        const timestamp = metadata?.timestamp || Date.now();
        if (duration < this.config.analysisThreshold && !this.analyzedQueries.has(queryHash)) {
            return this.createBasicAnalysis(query, queryHash, timestamp);
        }
        if (this.analyzedQueries.has(queryHash)) {
            const existing = this.analyzedQueries.get(queryHash);
            this.updateQueryHistory(queryHash, query, duration, timestamp);
            return existing;
        }
        const analysis = this.performFullAnalysis(query, queryHash, timestamp);
        this.analyzedQueries.set(queryHash, analysis);
        this.storeAnalysis(analysis);
        this.updateQueryHistory(queryHash, query, duration, timestamp);
        if (this.config.generateRecommendations) {
            this.generateOptimizationRecommendations(analysis);
        }
        if (this.config.trackQueryPatterns) {
            this.trackQueryPattern(query, duration, timestamp);
        }
        this.emit('query-analyzed', analysis);
        return analysis;
    }
    createBasicAnalysis(query, queryHash, timestamp) {
        return {
            query,
            queryHash,
            queryType: this.getQueryType(query),
            executionPlan: [],
            indexUsage: {
                indexesUsed: [],
                indexesAvailable: [],
                tablesScanned: [],
                scanType: 'table_scan'
            },
            performance: {
                estimatedCost: 1,
                estimatedRows: 0,
                complexity: 'low'
            },
            optimizationSuggestions: [],
            timestamp
        };
    }
    performFullAnalysis(query, queryHash, timestamp) {
        try {
            const executionPlan = this.getExecutionPlan(query);
            const indexUsage = this.analyzeIndexUsage(executionPlan);
            const performance = this.calculatePerformanceMetrics(executionPlan, query);
            const optimizationSuggestions = this.generateOptimizationSuggestions(query, executionPlan, indexUsage, performance);
            return {
                query,
                queryHash,
                queryType: this.getQueryType(query),
                executionPlan,
                indexUsage,
                performance,
                optimizationSuggestions,
                timestamp
            };
        }
        catch (error) {
            console.error('Failed to perform full query analysis:', error);
            return this.createBasicAnalysis(query, queryHash, timestamp);
        }
    }
    getExecutionPlan(query) {
        try {
            const planStmt = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`);
            const plan = planStmt.all();
            return plan.map((step) => ({
                id: step.id,
                parent: step.parent,
                notused: step.notused,
                detail: step.detail
            }));
        }
        catch (error) {
            console.error('Failed to get execution plan:', error);
            return [];
        }
    }
    analyzeIndexUsage(executionPlan) {
        const indexesUsed = [];
        const tablesScanned = [];
        const indexesAvailable = [];
        let hasScan = false;
        let hasSeek = false;
        executionPlan.forEach(step => {
            const detail = step.detail.toLowerCase();
            const tableMatch = detail.match(/(?:table|scan|using)\s+(\w+)/);
            if (tableMatch) {
                const tableName = tableMatch[1];
                if (!tablesScanned.includes(tableName)) {
                    tablesScanned.push(tableName);
                }
                if (this.tableSchemas.has(tableName)) {
                    const schema = this.tableSchemas.get(tableName);
                    schema.indexes.forEach((index) => {
                        if (!indexesAvailable.includes(index.name)) {
                            indexesAvailable.push(index.name);
                        }
                    });
                }
            }
            const indexMatch = detail.match(/using\s+(?:index\s+)?(\w+)/);
            if (indexMatch) {
                const indexName = indexMatch[1];
                if (!indexesUsed.includes(indexName)) {
                    indexesUsed.push(indexName);
                }
            }
            if (detail.includes('scan')) {
                hasScan = true;
            }
            if (detail.includes('using index') || detail.includes('search')) {
                hasSeek = true;
            }
        });
        let scanType;
        if (hasSeek && hasScan) {
            scanType = 'mixed';
        }
        else if (hasSeek) {
            scanType = 'index_seek';
        }
        else if (indexesUsed.length > 0) {
            scanType = 'index_scan';
        }
        else {
            scanType = 'table_scan';
        }
        return {
            indexesUsed,
            indexesAvailable,
            tablesScanned,
            scanType
        };
    }
    calculatePerformanceMetrics(executionPlan, query) {
        let estimatedCost = 1;
        let estimatedRows = 0;
        let complexity = 'low';
        const queryLower = query.toLowerCase();
        let complexityScore = 0;
        const scanSteps = executionPlan.filter(step => step.detail.toLowerCase().includes('scan table'));
        complexityScore += scanSteps.length * 2;
        if (queryLower.includes('join')) {
            const joinCount = (queryLower.match(/join/g) || []).length;
            complexityScore += joinCount * 3;
        }
        if (queryLower.includes('select') && queryLower.match(/select/g).length > 1) {
            complexityScore += 2;
        }
        if (queryLower.includes('order by'))
            complexityScore += 1;
        if (queryLower.includes('group by'))
            complexityScore += 2;
        if (queryLower.includes('having'))
            complexityScore += 1;
        if (queryLower.includes('over('))
            complexityScore += 2;
        if (complexityScore >= 10) {
            complexity = 'very_high';
            estimatedCost = complexityScore * 100;
        }
        else if (complexityScore >= 6) {
            complexity = 'high';
            estimatedCost = complexityScore * 50;
        }
        else if (complexityScore >= 3) {
            complexity = 'medium';
            estimatedCost = complexityScore * 20;
        }
        else {
            complexity = 'low';
            estimatedCost = complexityScore * 10;
        }
        executionPlan.forEach(step => {
            if (step.detail.includes('scan table')) {
                estimatedRows += 1000;
            }
            else if (step.detail.includes('using index')) {
                estimatedRows += 100;
            }
        });
        return {
            estimatedCost: Math.max(1, estimatedCost),
            estimatedRows,
            complexity
        };
    }
    generateOptimizationSuggestions(query, executionPlan, indexUsage, performance) {
        const suggestions = [];
        if (indexUsage.scanType === 'table_scan' && indexUsage.tablesScanned.length > 0) {
            suggestions.push({
                type: 'index',
                priority: 'high',
                description: 'Table scan detected - consider adding indexes',
                impact: 'Significant performance improvement for queries on this table',
                implementation: `Analyze query WHERE clauses and JOIN conditions to identify optimal index columns`,
                estimatedImprovement: 70
            });
        }
        const queryLower = query.toLowerCase();
        if (queryLower.includes('join') && indexUsage.scanType !== 'index_seek') {
            suggestions.push({
                type: 'index',
                priority: 'high',
                description: 'Inefficient JOIN detected - missing indexes on join columns',
                impact: 'Major performance improvement for JOIN operations',
                implementation: 'Create indexes on columns used in JOIN conditions',
                estimatedImprovement: 80
            });
        }
        const whereMatches = queryLower.match(/where\s+([^;]+)/);
        if (whereMatches && indexUsage.indexesUsed.length === 0) {
            suggestions.push({
                type: 'index',
                priority: 'medium',
                description: 'WHERE clause not using indexes efficiently',
                impact: 'Moderate to significant performance improvement',
                implementation: 'Create indexes on columns used in WHERE conditions',
                estimatedImprovement: 50
            });
        }
        if (queryLower.includes('select *')) {
            suggestions.push({
                type: 'query_rewrite',
                priority: 'medium',
                description: 'SELECT * detected - consider selecting only needed columns',
                impact: 'Reduced memory usage and network traffic',
                implementation: 'Specify only the columns you actually need',
                estimatedImprovement: 20
            });
        }
        if (queryLower.includes('order by') && !queryLower.includes('limit')) {
            suggestions.push({
                type: 'query_rewrite',
                priority: 'low',
                description: 'ORDER BY without LIMIT - consider pagination',
                impact: 'Reduced memory usage for large result sets',
                implementation: 'Add LIMIT clause if not all results are needed',
                estimatedImprovement: 30
            });
        }
        const selectCount = (queryLower.match(/select/g) || []).length;
        if (selectCount > 2) {
            suggestions.push({
                type: 'query_rewrite',
                priority: 'medium',
                description: 'Complex subqueries detected - consider JOIN or WITH clause',
                impact: 'Better query plan and performance',
                implementation: 'Rewrite subqueries as JOINs or use WITH clause for better optimization',
                estimatedImprovement: 40
            });
        }
        return suggestions;
    }
    getQueryType(query) {
        const queryLower = query.toLowerCase().trim();
        if (queryLower.startsWith('select'))
            return 'SELECT';
        if (queryLower.startsWith('insert'))
            return 'INSERT';
        if (queryLower.startsWith('update'))
            return 'UPDATE';
        if (queryLower.startsWith('delete'))
            return 'DELETE';
        if (queryLower.startsWith('create'))
            return 'CREATE';
        if (queryLower.startsWith('drop'))
            return 'DROP';
        return 'OTHER';
    }
    updateQueryHistory(queryHash, query, duration, timestamp) {
        let slowQuery = this.queryHistory.get(queryHash);
        if (slowQuery) {
            slowQuery.occurrences++;
            slowQuery.totalDuration += duration;
            slowQuery.avgDuration = slowQuery.totalDuration / slowQuery.occurrences;
            slowQuery.maxDuration = Math.max(slowQuery.maxDuration, duration);
            slowQuery.lastSeen = timestamp;
        }
        else {
            slowQuery = {
                query,
                queryHash,
                occurrences: 1,
                totalDuration: duration,
                avgDuration: duration,
                maxDuration: duration,
                lastSeen: timestamp
            };
            this.queryHistory.set(queryHash, slowQuery);
        }
        if (duration >= this.config.analysisThreshold && this.config.captureSlowQueries) {
            this.logSlowQuery(query, queryHash, duration, timestamp);
        }
    }
    logSlowQuery(query, queryHash, duration, timestamp) {
        try {
            const tables = this.extractTableNames(query);
            const operationType = this.getQueryType(query);
            this.db.prepare(`
        INSERT INTO slow_query_log (
          query_hash, query, duration, timestamp, table_names, operation_type
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(queryHash, query, duration, timestamp, JSON.stringify(tables), operationType);
        }
        catch (error) {
            console.error('Failed to log slow query:', error);
        }
    }
    storeAnalysis(analysis) {
        try {
            this.db.prepare(`
        INSERT OR REPLACE INTO query_analyses (
          query_hash, query, query_type, execution_plan, index_usage,
          performance_metrics, optimization_suggestions, analysis_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(analysis.queryHash, analysis.query, analysis.queryType, JSON.stringify(analysis.executionPlan), JSON.stringify(analysis.indexUsage), JSON.stringify(analysis.performance), JSON.stringify(analysis.optimizationSuggestions), analysis.timestamp);
        }
        catch (error) {
            console.error('Failed to store query analysis:', error);
        }
    }
    generateOptimizationRecommendations(analysis) {
        const indexRecommendations = this.generateIndexRecommendations(analysis);
        indexRecommendations.forEach(recommendation => {
            this.addIndexRecommendation(recommendation);
        });
    }
    generateIndexRecommendations(analysis) {
        const recommendations = [];
        if (analysis.indexUsage.scanType === 'table_scan') {
            analysis.indexUsage.tablesScanned.forEach(tableName => {
                const whereColumns = this.extractWhereColumns(analysis.query, tableName);
                if (whereColumns.length > 0) {
                    recommendations.push({
                        tableName,
                        columns: whereColumns,
                        indexType: 'btree',
                        rationale: `Table scan detected on ${tableName}. Index on ${whereColumns.join(', ')} would improve query performance.`,
                        estimatedImpact: 70,
                        queryPatterns: [analysis.query],
                        creationSQL: `CREATE INDEX idx_${tableName}_${whereColumns.join('_')} ON ${tableName} (${whereColumns.join(', ')});`,
                        priority: 'high'
                    });
                }
            });
        }
        return recommendations;
    }
    extractTableNames(query) {
        const tables = [];
        const queryLower = query.toLowerCase();
        const fromMatches = queryLower.match(/from\s+(\w+)/g);
        if (fromMatches) {
            fromMatches.forEach(match => {
                const tableName = match.replace('from ', '');
                if (!tables.includes(tableName)) {
                    tables.push(tableName);
                }
            });
        }
        const joinMatches = queryLower.match(/join\s+(\w+)/g);
        if (joinMatches) {
            joinMatches.forEach(match => {
                const tableName = match.replace(/\w+\s+join\s+/, '');
                if (!tables.includes(tableName)) {
                    tables.push(tableName);
                }
            });
        }
        return tables;
    }
    extractWhereColumns(query, tableName) {
        const columns = [];
        const queryLower = query.toLowerCase();
        const whereMatch = queryLower.match(/where\s+(.*?)(?:\s+order\s+by|\s+group\s+by|\s+having|\s+limit|$)/);
        if (!whereMatch)
            return columns;
        const whereClause = whereMatch[1];
        const columnMatches = whereClause.match(/(\w+)\s*[=<>!]/g);
        if (columnMatches) {
            columnMatches.forEach(match => {
                const column = match.replace(/\s*[=<>!].*/, '');
                if (!columns.includes(column) && this.isValidColumn(tableName, column)) {
                    columns.push(column);
                }
            });
        }
        return columns;
    }
    isValidColumn(tableName, columnName) {
        const schema = this.tableSchemas.get(tableName);
        if (!schema)
            return false;
        return schema.columns.some((col) => col.name === columnName);
    }
    trackQueryPattern(query, duration, timestamp) {
        const patternTemplate = this.normalizeQueryForPattern(query);
        const patternHash = this.hashQuery(patternTemplate);
        try {
            const existingPattern = this.db.prepare(`
        SELECT * FROM query_patterns WHERE pattern_hash = ?
      `).get(patternHash);
            if (existingPattern) {
                this.db.prepare(`
          UPDATE query_patterns SET
            occurrence_count = occurrence_count + 1,
            total_duration = total_duration + ?,
            avg_duration = (total_duration + ?) / (occurrence_count + 1),
            last_seen = ?
          WHERE pattern_hash = ?
        `).run(duration, duration, timestamp, patternHash);
            }
            else {
                const tableNames = this.extractTableNames(query);
                this.db.prepare(`
          INSERT INTO query_patterns (
            pattern_hash, pattern_template, occurrence_count, total_duration,
            avg_duration, table_names, first_seen, last_seen
          ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)
        `).run(patternHash, patternTemplate, duration, duration, JSON.stringify(tableNames), timestamp, timestamp);
            }
        }
        catch (error) {
            console.error('Failed to track query pattern:', error);
        }
    }
    normalizeQueryForPattern(query) {
        return query
            .replace(/\d+/g, '?')
            .replace(/'[^']*'/g, '?')
            .replace(/"/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }
    addIndexRecommendation(recommendation) {
        try {
            const existing = this.db.prepare(`
        SELECT id FROM index_recommendations 
        WHERE table_name = ? AND columns = ? AND status = 'pending'
      `).get(recommendation.tableName, JSON.stringify(recommendation.columns));
            if (!existing) {
                this.db.prepare(`
          INSERT INTO index_recommendations (
            table_name, columns, index_type, rationale, estimated_impact,
            query_patterns, creation_sql, priority
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(recommendation.tableName, JSON.stringify(recommendation.columns), recommendation.indexType, recommendation.rationale, recommendation.estimatedImpact, JSON.stringify(recommendation.queryPatterns), recommendation.creationSQL, recommendation.priority);
                this.indexRecommendations.push(recommendation);
                this.emit('index-recommendation', recommendation);
            }
        }
        catch (error) {
            console.error('Failed to add index recommendation:', error);
        }
    }
    hashQuery(query) {
        let hash = 0;
        for (let i = 0; i < query.length; i++) {
            const char = query.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    getSlowQueries(limit = 20) {
        return Array.from(this.queryHistory.values())
            .sort((a, b) => b.avgDuration - a.avgDuration)
            .slice(0, limit);
    }
    getQueryAnalysis(queryHash) {
        return this.analyzedQueries.get(queryHash) || null;
    }
    getIndexRecommendations(priority) {
        try {
            let query = 'SELECT * FROM index_recommendations WHERE status = ?';
            const params = ['pending'];
            if (priority) {
                query += ' AND priority = ?';
                params.push(priority);
            }
            query += ' ORDER BY estimated_impact DESC';
            const results = this.db.prepare(query).all(...params);
            return results.map((row) => ({
                tableName: row.table_name,
                columns: JSON.parse(row.columns),
                indexType: row.index_type,
                rationale: row.rationale,
                estimatedImpact: row.estimated_impact,
                queryPatterns: JSON.parse(row.query_patterns),
                creationSQL: row.creation_sql,
                priority: row.priority
            }));
        }
        catch (error) {
            console.error('Failed to get index recommendations:', error);
            return [];
        }
    }
    getQueryPatterns(limit = 50) {
        try {
            const results = this.db.prepare(`
        SELECT 
          pattern_template, occurrence_count, avg_duration,
          table_names, last_seen
        FROM query_patterns 
        ORDER BY occurrence_count DESC 
        LIMIT ?
      `).all(limit);
            return results.map((row) => ({
                pattern: row.pattern_template,
                occurrences: row.occurrence_count,
                avgDuration: row.avg_duration,
                tableNames: JSON.parse(row.table_names || '[]'),
                lastSeen: row.last_seen
            }));
        }
        catch (error) {
            console.error('Failed to get query patterns:', error);
            return [];
        }
    }
    implementIndexRecommendation(recommendationId, execute = false) {
        try {
            const recommendation = this.db.prepare(`
        SELECT * FROM index_recommendations WHERE id = ?
      `).get(recommendationId);
            if (!recommendation) {
                return { success: false, error: 'Recommendation not found' };
            }
            if (execute && !this.config.autoIndexCreation) {
                return { success: false, error: 'Auto index creation is disabled' };
            }
            if (execute) {
                this.db.exec(recommendation.creation_sql);
                this.db.prepare(`
          UPDATE index_recommendations 
          SET status = 'created', implemented_at = ?
          WHERE id = ?
        `).run(Date.now(), recommendationId);
            }
            return {
                success: true,
                sql: recommendation.creation_sql
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    getAnalyzerStats() {
        try {
            const totalQueries = this.db.prepare('SELECT COUNT(*) as count FROM slow_query_log').get()?.count || 0;
            const analyzedQueries = this.analyzedQueries.size;
            const pendingRecommendations = this.db.prepare('SELECT COUNT(*) as count FROM index_recommendations WHERE status = ?').get('pending')?.count || 0;
            const implementedRecommendations = this.db.prepare('SELECT COUNT(*) as count FROM index_recommendations WHERE status = ?').get('created')?.count || 0;
            return {
                totalQueries,
                slowQueries: this.queryHistory.size,
                analyzedQueries,
                pendingRecommendations,
                implementedRecommendations,
                avgAnalysisTime: 0
            };
        }
        catch (error) {
            console.error('Failed to get analyzer stats:', error);
            return {
                totalQueries: 0,
                slowQueries: 0,
                analyzedQueries: 0,
                pendingRecommendations: 0,
                implementedRecommendations: 0,
                avgAnalysisTime: 0
            };
        }
    }
    destroy() {
        this.removeAllListeners();
        this.queryHistory.clear();
        this.analyzedQueries.clear();
        this.indexRecommendations.length = 0;
        this.tableSchemas.clear();
    }
}
exports.QueryAnalyzer = QueryAnalyzer;
//# sourceMappingURL=QueryAnalyzer.js.map