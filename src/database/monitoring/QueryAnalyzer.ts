/**
 * Query Analyzer for SQLite Performance Optimization
 *
 * Provides comprehensive query analysis, optimization suggestions,
 * and automatic index recommendations for optimal database performance.
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface QueryPlan {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

export interface QueryAnalysis {
  query: string;
  queryHash: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'OTHER';
  executionPlan: QueryPlan[];
  indexUsage: {
    indexesUsed: string[];
    indexesAvailable: string[];
    tablesScanned: string[];
    scanType: 'table_scan' | 'index_scan' | 'index_seek' | 'mixed';
  };
  performance: {
    estimatedCost: number;
    estimatedRows: number;
    complexity: 'low' | 'medium' | 'high' | 'very_high';
  };
  optimizationSuggestions: OptimizationSuggestion[];
  timestamp: number;
}

export interface OptimizationSuggestion {
  type: 'index' | 'query_rewrite' | 'schema' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number; // percentage
}

export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  indexType: 'btree' | 'unique' | 'partial' | 'expression';
  rationale: string;
  estimatedImpact: number;
  queryPatterns: string[];
  creationSQL: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface SlowQuery {
  query: string;
  queryHash: string;
  occurrences: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  lastSeen: number;
  analysis?: QueryAnalysis;
}

export interface AnalyzerConfig {
  enabled: boolean;
  analysisThreshold: number; // minimum duration in ms to analyze
  captureSlowQueries: boolean;
  generateRecommendations: boolean;
  trackQueryPatterns: boolean;
  maxQueryHistory: number;
  autoIndexCreation: boolean;
  indexCreationThreshold: number; // minimum improvement percentage
}

export class QueryAnalyzer extends EventEmitter {
  private db: Database.Database;
  private config: AnalyzerConfig;
  private queryHistory = new Map<string, SlowQuery>();
  private analyzedQueries = new Map<string, QueryAnalysis>();
  private indexRecommendations: IndexRecommendation[] = [];
  private tableSchemas = new Map<string, any>();

  constructor(db: Database.Database, config?: Partial<AnalyzerConfig>) {
    super();
    this.db = db;
    this.config = this.buildConfig(config);
    this.initializeAnalyzer();
  }

  private buildConfig(config?: Partial<AnalyzerConfig>): AnalyzerConfig {
    return {
      enabled: true,
      analysisThreshold: 100, // 100ms
      captureSlowQueries: true,
      generateRecommendations: true,
      trackQueryPatterns: true,
      maxQueryHistory: 1000,
      autoIndexCreation: false, // Keep false for safety
      indexCreationThreshold: 20, // 20% improvement minimum
      ...config,
    };
  }

  private initializeAnalyzer(): void {
    if (!this.config.enabled) return;

    this.createAnalyzerTables();
    this.loadTableSchemas();
    this.loadQueryHistory();
  }

  private createAnalyzerTables(): void {
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

  private loadTableSchemas(): void {
    try {
      // Get all table information
      const tables = this.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `
        )
        .all();

      tables.forEach((table: any) => {
        try {
          const schema = this.db.prepare(`PRAGMA table_info(${table.name})`).all();
          const indexes = this.db.prepare(`PRAGMA index_list(${table.name})`).all();

          this.tableSchemas.set(table.name, {
            name: table.name,
            columns: schema,
            indexes: indexes,
          });
        } catch (error) {
          console.error(`Failed to load schema for table ${table.name}:`, error);
        }
      });
    } catch (error) {
      console.error('Failed to load table schemas:', error);
    }
  }

  private loadQueryHistory(): void {
    try {
      const results = this.db
        .prepare(
          `
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
      `
        )
        .all(this.config.maxQueryHistory);

      results.forEach((row: any) => {
        this.queryHistory.set(row.query_hash, {
          query: row.query,
          queryHash: row.query_hash,
          occurrences: row.occurrences,
          totalDuration: row.total_duration,
          avgDuration: row.avg_duration,
          maxDuration: row.max_duration,
          lastSeen: row.last_seen,
        });
      });
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  }

  public analyzeQuery(
    query: string,
    duration: number,
    metadata?: {
      timestamp?: number;
      operationType?: string;
      recordsAffected?: number;
    }
  ): QueryAnalysis {
    if (!this.config.enabled) {
      throw new Error('Query analyzer is disabled');
    }

    const queryHash = this.hashQuery(query);
    const timestamp = metadata?.timestamp || Date.now();

    // Check if we should analyze this query
    if (duration < this.config.analysisThreshold && !this.analyzedQueries.has(queryHash)) {
      // For fast queries, just return a basic analysis
      return this.createBasicAnalysis(query, queryHash, timestamp);
    }

    // Check if we already have an analysis for this query
    if (this.analyzedQueries.has(queryHash)) {
      const existing = this.analyzedQueries.get(queryHash)!;
      this.updateQueryHistory(queryHash, query, duration, timestamp);
      return existing;
    }

    // Perform full analysis
    const analysis = this.performFullAnalysis(query, queryHash, timestamp);

    // Store analysis
    this.analyzedQueries.set(queryHash, analysis);
    this.storeAnalysis(analysis);

    // Update query history
    this.updateQueryHistory(queryHash, query, duration, timestamp);

    // Generate recommendations if enabled
    if (this.config.generateRecommendations) {
      this.generateOptimizationRecommendations(analysis);
    }

    // Track query patterns
    if (this.config.trackQueryPatterns) {
      this.trackQueryPattern(query, duration, timestamp);
    }

    this.emit('query-analyzed', analysis);
    return analysis;
  }

  private createBasicAnalysis(query: string, queryHash: string, timestamp: number): QueryAnalysis {
    return {
      query,
      queryHash,
      queryType: this.getQueryType(query),
      executionPlan: [],
      indexUsage: {
        indexesUsed: [],
        indexesAvailable: [],
        tablesScanned: [],
        scanType: 'table_scan',
      },
      performance: {
        estimatedCost: 1,
        estimatedRows: 0,
        complexity: 'low',
      },
      optimizationSuggestions: [],
      timestamp,
    };
  }

  private performFullAnalysis(query: string, queryHash: string, timestamp: number): QueryAnalysis {
    try {
      // Get execution plan
      const executionPlan = this.getExecutionPlan(query);

      // Analyze index usage
      const indexUsage = this.analyzeIndexUsage(executionPlan);

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(executionPlan, query);

      // Generate optimization suggestions
      const optimizationSuggestions = this.generateOptimizationSuggestions(
        query,
        executionPlan,
        indexUsage,
        performance
      );

      return {
        query,
        queryHash,
        queryType: this.getQueryType(query),
        executionPlan,
        indexUsage,
        performance,
        optimizationSuggestions,
        timestamp,
      };
    } catch (error) {
      console.error('Failed to perform full query analysis:', error);
      return this.createBasicAnalysis(query, queryHash, timestamp);
    }
  }

  private getExecutionPlan(query: string): QueryPlan[] {
    try {
      // Use EXPLAIN QUERY PLAN to get execution plan
      const planStmt = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`);
      const plan = planStmt.all();

      return plan.map((step: any) => ({
        id: step.id,
        parent: step.parent,
        notused: step.notused,
        detail: step.detail,
      }));
    } catch (error) {
      console.error('Failed to get execution plan:', error);
      return [];
    }
  }

  private analyzeIndexUsage(executionPlan: QueryPlan[]): {
    indexesUsed: string[];
    indexesAvailable: string[];
    tablesScanned: string[];
    scanType: 'table_scan' | 'index_scan' | 'index_seek' | 'mixed';
  } {
    const indexesUsed: string[] = [];
    const tablesScanned: string[] = [];
    const indexesAvailable: string[] = [];
    let hasScan = false;
    let hasSeek = false;

    executionPlan.forEach(step => {
      const detail = step.detail.toLowerCase();

      // Extract table names
      const tableMatch = detail.match(/(?:table|scan|using)\s+(\w+)/);
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!tablesScanned.includes(tableName)) {
          tablesScanned.push(tableName);
        }

        // Get available indexes for this table
        if (this.tableSchemas.has(tableName)) {
          const schema = this.tableSchemas.get(tableName);
          schema.indexes.forEach((index: any) => {
            if (!indexesAvailable.includes(index.name)) {
              indexesAvailable.push(index.name);
            }
          });
        }
      }

      // Extract index usage
      const indexMatch = detail.match(/using\s+(?:index\s+)?(\w+)/);
      if (indexMatch) {
        const indexName = indexMatch[1];
        if (!indexesUsed.includes(indexName)) {
          indexesUsed.push(indexName);
        }
      }

      // Determine scan type
      if (detail.includes('scan')) {
        hasScan = true;
      }
      if (detail.includes('using index') || detail.includes('search')) {
        hasSeek = true;
      }
    });

    let scanType: 'table_scan' | 'index_scan' | 'index_seek' | 'mixed';
    if (hasSeek && hasScan) {
      scanType = 'mixed';
    } else if (hasSeek) {
      scanType = 'index_seek';
    } else if (indexesUsed.length > 0) {
      scanType = 'index_scan';
    } else {
      scanType = 'table_scan';
    }

    return {
      indexesUsed,
      indexesAvailable,
      tablesScanned,
      scanType,
    };
  }

  private calculatePerformanceMetrics(
    executionPlan: QueryPlan[],
    query: string
  ): {
    estimatedCost: number;
    estimatedRows: number;
    complexity: 'low' | 'medium' | 'high' | 'very_high';
  } {
    let estimatedCost = 1;
    let estimatedRows = 0;
    let complexity: 'low' | 'medium' | 'high' | 'very_high' = 'low';

    // Analyze query complexity based on various factors
    const queryLower = query.toLowerCase();
    let complexityScore = 0;

    // Table scans increase complexity
    const scanSteps = executionPlan.filter(step =>
      step.detail.toLowerCase().includes('scan table')
    );
    complexityScore += scanSteps.length * 2;

    // Joins increase complexity
    if (queryLower.includes('join')) {
      const joinCount = (queryLower.match(/join/g) || []).length;
      complexityScore += joinCount * 3;
    }

    // Subqueries increase complexity
    if (queryLower.includes('select') && queryLower.match(/select/g)!.length > 1) {
      complexityScore += 2;
    }

    // Sorting and grouping
    if (queryLower.includes('order by')) complexityScore += 1;
    if (queryLower.includes('group by')) complexityScore += 2;
    if (queryLower.includes('having')) complexityScore += 1;

    // Window functions
    if (queryLower.includes('over(')) complexityScore += 2;

    // Determine complexity level
    if (complexityScore >= 10) {
      complexity = 'very_high';
      estimatedCost = complexityScore * 100;
    } else if (complexityScore >= 6) {
      complexity = 'high';
      estimatedCost = complexityScore * 50;
    } else if (complexityScore >= 3) {
      complexity = 'medium';
      estimatedCost = complexityScore * 20;
    } else {
      complexity = 'low';
      estimatedCost = complexityScore * 10;
    }

    // Estimate rows based on execution plan details
    executionPlan.forEach(step => {
      if (step.detail.includes('scan table')) {
        estimatedRows += 1000; // Default estimate for table scans
      } else if (step.detail.includes('using index')) {
        estimatedRows += 100; // Index usage typically returns fewer rows
      }
    });

    return {
      estimatedCost: Math.max(1, estimatedCost),
      estimatedRows,
      complexity,
    };
  }

  private generateOptimizationSuggestions(
    query: string,
    executionPlan: QueryPlan[],
    indexUsage: any,
    performance: any
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for missing indexes
    if (indexUsage.scanType === 'table_scan' && indexUsage.tablesScanned.length > 0) {
      suggestions.push({
        type: 'index',
        priority: 'high',
        description: 'Table scan detected - consider adding indexes',
        impact: 'Significant performance improvement for queries on this table',
        implementation: `Analyze query WHERE clauses and JOIN conditions to identify optimal index columns`,
        estimatedImprovement: 70,
      });
    }

    // Check for inefficient JOINs
    const queryLower = query.toLowerCase();
    if (queryLower.includes('join') && indexUsage.scanType !== 'index_seek') {
      suggestions.push({
        type: 'index',
        priority: 'high',
        description: 'Inefficient JOIN detected - missing indexes on join columns',
        impact: 'Major performance improvement for JOIN operations',
        implementation: 'Create indexes on columns used in JOIN conditions',
        estimatedImprovement: 80,
      });
    }

    // Check for missing WHERE clause indexes
    const whereMatches = queryLower.match(/where\s+([^;]+)/);
    if (whereMatches && indexUsage.indexesUsed.length === 0) {
      suggestions.push({
        type: 'index',
        priority: 'medium',
        description: 'WHERE clause not using indexes efficiently',
        impact: 'Moderate to significant performance improvement',
        implementation: 'Create indexes on columns used in WHERE conditions',
        estimatedImprovement: 50,
      });
    }

    // Check for SELECT * usage
    if (queryLower.includes('select *')) {
      suggestions.push({
        type: 'query_rewrite',
        priority: 'medium',
        description: 'SELECT * detected - consider selecting only needed columns',
        impact: 'Reduced memory usage and network traffic',
        implementation: 'Specify only the columns you actually need',
        estimatedImprovement: 20,
      });
    }

    // Check for ORDER BY without LIMIT
    if (queryLower.includes('order by') && !queryLower.includes('limit')) {
      suggestions.push({
        type: 'query_rewrite',
        priority: 'low',
        description: 'ORDER BY without LIMIT - consider pagination',
        impact: 'Reduced memory usage for large result sets',
        implementation: 'Add LIMIT clause if not all results are needed',
        estimatedImprovement: 30,
      });
    }

    // Check for complex subqueries
    const selectCount = (queryLower.match(/select/g) || []).length;
    if (selectCount > 2) {
      suggestions.push({
        type: 'query_rewrite',
        priority: 'medium',
        description: 'Complex subqueries detected - consider JOIN or WITH clause',
        impact: 'Better query plan and performance',
        implementation: 'Rewrite subqueries as JOINs or use WITH clause for better optimization',
        estimatedImprovement: 40,
      });
    }

    return suggestions;
  }

  private getQueryType(
    query: string
  ): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'OTHER' {
    const queryLower = query.toLowerCase().trim();

    if (queryLower.startsWith('select')) return 'SELECT';
    if (queryLower.startsWith('insert')) return 'INSERT';
    if (queryLower.startsWith('update')) return 'UPDATE';
    if (queryLower.startsWith('delete')) return 'DELETE';
    if (queryLower.startsWith('create')) return 'CREATE';
    if (queryLower.startsWith('drop')) return 'DROP';

    return 'OTHER';
  }

  private updateQueryHistory(
    queryHash: string,
    query: string,
    duration: number,
    timestamp: number
  ): void {
    let slowQuery = this.queryHistory.get(queryHash);

    if (slowQuery) {
      slowQuery.occurrences++;
      slowQuery.totalDuration += duration;
      slowQuery.avgDuration = slowQuery.totalDuration / slowQuery.occurrences;
      slowQuery.maxDuration = Math.max(slowQuery.maxDuration, duration);
      slowQuery.lastSeen = timestamp;
    } else {
      slowQuery = {
        query,
        queryHash,
        occurrences: 1,
        totalDuration: duration,
        avgDuration: duration,
        maxDuration: duration,
        lastSeen: timestamp,
      };
      this.queryHistory.set(queryHash, slowQuery);
    }

    // Log to database if it's a slow query
    if (duration >= this.config.analysisThreshold && this.config.captureSlowQueries) {
      this.logSlowQuery(query, queryHash, duration, timestamp);
    }
  }

  private logSlowQuery(
    query: string,
    queryHash: string,
    duration: number,
    timestamp: number
  ): void {
    try {
      const tables = this.extractTableNames(query);
      const operationType = this.getQueryType(query);

      this.db
        .prepare(
          `
        INSERT INTO slow_query_log (
          query_hash, query, duration, timestamp, table_names, operation_type
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(queryHash, query, duration, timestamp, JSON.stringify(tables), operationType);
    } catch (error) {
      console.error('Failed to log slow query:', error);
    }
  }

  private storeAnalysis(analysis: QueryAnalysis): void {
    try {
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO query_analyses (
          query_hash, query, query_type, execution_plan, index_usage,
          performance_metrics, optimization_suggestions, analysis_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          analysis.queryHash,
          analysis.query,
          analysis.queryType,
          JSON.stringify(analysis.executionPlan),
          JSON.stringify(analysis.indexUsage),
          JSON.stringify(analysis.performance),
          JSON.stringify(analysis.optimizationSuggestions),
          analysis.timestamp
        );
    } catch (error) {
      console.error('Failed to store query analysis:', error);
    }
  }

  private generateOptimizationRecommendations(analysis: QueryAnalysis): void {
    // Generate index recommendations based on the analysis
    const indexRecommendations = this.generateIndexRecommendations(analysis);

    indexRecommendations.forEach(recommendation => {
      this.addIndexRecommendation(recommendation);
    });
  }

  private generateIndexRecommendations(analysis: QueryAnalysis): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    if (analysis.indexUsage.scanType === 'table_scan') {
      analysis.indexUsage.tablesScanned.forEach(tableName => {
        // Extract column names from WHERE clause
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
            priority: 'high',
          });
        }
      });
    }

    return recommendations;
  }

  private extractTableNames(query: string): string[] {
    const tables: string[] = [];
    const queryLower = query.toLowerCase();

    // Simple regex to extract table names (would need improvement for complex queries)
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

  private extractWhereColumns(query: string, tableName: string): string[] {
    const columns: string[] = [];
    const queryLower = query.toLowerCase();

    // Extract WHERE clause
    const whereMatch = queryLower.match(
      /where\s+(.*?)(?:\s+order\s+by|\s+group\s+by|\s+having|\s+limit|$)/
    );
    if (!whereMatch) return columns;

    const whereClause = whereMatch[1];

    // Simple column extraction (would need improvement for complex conditions)
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

  private isValidColumn(tableName: string, columnName: string): boolean {
    const schema = this.tableSchemas.get(tableName);
    if (!schema) return false;

    return schema.columns.some((col: any) => col.name === columnName);
  }

  private trackQueryPattern(query: string, duration: number, timestamp: number): void {
    const patternTemplate = this.normalizeQueryForPattern(query);
    const patternHash = this.hashQuery(patternTemplate);

    try {
      // Update or insert query pattern
      const existingPattern = this.db
        .prepare(
          `
        SELECT * FROM query_patterns WHERE pattern_hash = ?
      `
        )
        .get(patternHash);

      if (existingPattern) {
        this.db
          .prepare(
            `
          UPDATE query_patterns SET
            occurrence_count = occurrence_count + 1,
            total_duration = total_duration + ?,
            avg_duration = (total_duration + ?) / (occurrence_count + 1),
            last_seen = ?
          WHERE pattern_hash = ?
        `
          )
          .run(duration, duration, timestamp, patternHash);
      } else {
        const tableNames = this.extractTableNames(query);

        this.db
          .prepare(
            `
          INSERT INTO query_patterns (
            pattern_hash, pattern_template, occurrence_count, total_duration,
            avg_duration, table_names, first_seen, last_seen
          ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)
        `
          )
          .run(
            patternHash,
            patternTemplate,
            duration,
            duration,
            JSON.stringify(tableNames),
            timestamp,
            timestamp
          );
      }
    } catch (error) {
      console.error('Failed to track query pattern:', error);
    }
  }

  private normalizeQueryForPattern(query: string): string {
    return query
      .replace(/\d+/g, '?') // Replace numbers with ?
      .replace(/'[^']*'/g, '?') // Replace string literals with ?
      .replace(/"/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  private addIndexRecommendation(recommendation: IndexRecommendation): void {
    try {
      // Check if similar recommendation already exists
      const existing = this.db
        .prepare(
          `
        SELECT id FROM index_recommendations 
        WHERE table_name = ? AND columns = ? AND status = 'pending'
      `
        )
        .get(recommendation.tableName, JSON.stringify(recommendation.columns));

      if (!existing) {
        this.db
          .prepare(
            `
          INSERT INTO index_recommendations (
            table_name, columns, index_type, rationale, estimated_impact,
            query_patterns, creation_sql, priority
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            recommendation.tableName,
            JSON.stringify(recommendation.columns),
            recommendation.indexType,
            recommendation.rationale,
            recommendation.estimatedImpact,
            JSON.stringify(recommendation.queryPatterns),
            recommendation.creationSQL,
            recommendation.priority
          );

        this.indexRecommendations.push(recommendation);
        this.emit('index-recommendation', recommendation);
      }
    } catch (error) {
      console.error('Failed to add index recommendation:', error);
    }
  }

  private hashQuery(query: string): string {
    // Simple hash function for query identification
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Public API methods

  public getSlowQueries(limit = 20): SlowQuery[] {
    return Array.from(this.queryHistory.values())
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  public getQueryAnalysis(queryHash: string): QueryAnalysis | null {
    return this.analyzedQueries.get(queryHash) || null;
  }

  public getIndexRecommendations(
    priority?: 'low' | 'medium' | 'high' | 'critical'
  ): IndexRecommendation[] {
    try {
      let query = 'SELECT * FROM index_recommendations WHERE status = ?';
      const params: any[] = ['pending'];

      if (priority) {
        query += ' AND priority = ?';
        params.push(priority);
      }

      query += ' ORDER BY estimated_impact DESC';

      const results = this.db.prepare(query).all(...params);

      return results.map((row: any) => ({
        tableName: row.table_name,
        columns: JSON.parse(row.columns),
        indexType: row.index_type,
        rationale: row.rationale,
        estimatedImpact: row.estimated_impact,
        queryPatterns: JSON.parse(row.query_patterns),
        creationSQL: row.creation_sql,
        priority: row.priority,
      }));
    } catch (error) {
      console.error('Failed to get index recommendations:', error);
      return [];
    }
  }

  public getQueryPatterns(limit = 50): Array<{
    pattern: string;
    occurrences: number;
    avgDuration: number;
    tableNames: string[];
    lastSeen: number;
  }> {
    try {
      const results = this.db
        .prepare(
          `
        SELECT 
          pattern_template, occurrence_count, avg_duration,
          table_names, last_seen
        FROM query_patterns 
        ORDER BY occurrence_count DESC 
        LIMIT ?
      `
        )
        .all(limit);

      return results.map((row: any) => ({
        pattern: row.pattern_template,
        occurrences: row.occurrence_count,
        avgDuration: row.avg_duration,
        tableNames: JSON.parse(row.table_names || '[]'),
        lastSeen: row.last_seen,
      }));
    } catch (error) {
      console.error('Failed to get query patterns:', error);
      return [];
    }
  }

  public implementIndexRecommendation(
    recommendationId: string,
    execute = false
  ): {
    success: boolean;
    error?: string;
    sql?: string;
  } {
    try {
      const recommendation = this.db
        .prepare(
          `
        SELECT * FROM index_recommendations WHERE id = ?
      `
        )
        .get(recommendationId);

      if (!recommendation) {
        return { success: false, error: 'Recommendation not found' };
      }

      if (execute && !this.config.autoIndexCreation) {
        return { success: false, error: 'Auto index creation is disabled' };
      }

      if (execute) {
        // Execute the index creation
        this.db.exec(recommendation.creation_sql);

        // Mark as implemented
        this.db
          .prepare(
            `
          UPDATE index_recommendations 
          SET status = 'created', implemented_at = ?
          WHERE id = ?
        `
          )
          .run(Date.now(), recommendationId);
      }

      return {
        success: true,
        sql: recommendation.creation_sql,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public getAnalyzerStats(): {
    totalQueries: number;
    slowQueries: number;
    analyzedQueries: number;
    pendingRecommendations: number;
    implementedRecommendations: number;
    avgAnalysisTime: number;
  } {
    try {
      const totalQueries =
        this.db.prepare('SELECT COUNT(*) as count FROM slow_query_log').get()?.count || 0;
      const analyzedQueries = this.analyzedQueries.size;
      const pendingRecommendations =
        this.db
          .prepare('SELECT COUNT(*) as count FROM index_recommendations WHERE status = ?')
          .get('pending')?.count || 0;
      const implementedRecommendations =
        this.db
          .prepare('SELECT COUNT(*) as count FROM index_recommendations WHERE status = ?')
          .get('created')?.count || 0;

      return {
        totalQueries,
        slowQueries: this.queryHistory.size,
        analyzedQueries,
        pendingRecommendations,
        implementedRecommendations,
        avgAnalysisTime: 0, // Would calculate from timing data
      };
    } catch (error) {
      console.error('Failed to get analyzer stats:', error);
      return {
        totalQueries: 0,
        slowQueries: 0,
        analyzedQueries: 0,
        pendingRecommendations: 0,
        implementedRecommendations: 0,
        avgAnalysisTime: 0,
      };
    }
  }

  public destroy(): void {
    this.removeAllListeners();
    this.queryHistory.clear();
    this.analyzedQueries.clear();
    this.indexRecommendations.length = 0;
    this.tableSchemas.clear();
  }
}
