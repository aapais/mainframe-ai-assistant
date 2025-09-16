/**
 * Database Profiler Utility
 * Monitors database query performance
 */

const { performance } = require('perf_hooks');
const EventEmitter = require('events');

class DatabaseProfiler extends EventEmitter {
  constructor() {
    super();
    this.reset();
    this.mockDatabase = new MockDatabase();
  }

  reset() {
    this.queryMetrics = [];
    this.connectionMetrics = [];
    this.slowQueries = [];
    this.errorQueries = [];
    this.startTime = performance.now();
  }

  async executeQuery(sql, params = [], options = {}) {
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    const queryInfo = {
      queryId,
      sql: sql.trim(),
      params,
      startTime,
      options
    };

    this.emit('queryStart', queryInfo);

    try {
      // Execute query through mock database
      const result = await this.mockDatabase.execute(sql, params, options);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const metrics = {
        ...queryInfo,
        endTime,
        duration,
        success: true,
        result,
        rowsAffected: result.rowsAffected || 0,
        rowsReturned: result.rows ? result.rows.length : 0
      };

      this.recordQueryMetrics(metrics);
      this.emit('queryComplete', metrics);

      return result;

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const errorMetrics = {
        ...queryInfo,
        endTime,
        duration,
        success: false,
        error: error.message,
        errorCode: error.code || 'UNKNOWN'
      };

      this.recordQueryMetrics(errorMetrics);
      this.errorQueries.push(errorMetrics);
      this.emit('queryError', errorMetrics);

      throw error;
    }
  }

  recordQueryMetrics(metrics) {
    this.queryMetrics.push(metrics);

    // Track slow queries (>100ms)
    if (metrics.duration > 100) {
      this.slowQueries.push(metrics);
    }

    // Emit performance alerts
    if (metrics.duration > 500) {
      this.emit('slowQuery', metrics);
    }

    if (metrics.duration > 1000) {
      this.emit('criticalSlowQuery', metrics);
    }
  }

  async profileQueryPerformance(queries, iterations = 100) {
    const profileResults = [];

    for (const queryConfig of queries) {
      const { name, sql, params = [] } = queryConfig;
      const queryResults = [];

      for (let i = 0; i < iterations; i++) {
        try {
          const startTime = performance.now();
          await this.executeQuery(sql, params.map(p => 
            typeof p === 'function' ? p(i) : p
          ));
          const endTime = performance.now();
          
          queryResults.push(endTime - startTime);
        } catch (error) {
          // Record error but continue profiling
          queryResults.push(null);
        }
      }

      const validResults = queryResults.filter(r => r !== null);
      const stats = this.calculateQueryStats(validResults);

      profileResults.push({
        name,
        sql,
        iterations,
        successRate: (validResults.length / iterations) * 100,
        stats,
        passed: stats.p95 < 100 // Requirement: <100ms
      });
    }

    return profileResults;
  }

  calculateQueryStats(times) {
    if (times.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        average: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
      count: times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      average: sum / times.length,
      p50: this.calculatePercentile(sorted, 50),
      p90: this.calculatePercentile(sorted, 90),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99)
    };
  }

  calculatePercentile(sortedValues, percentile) {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[index] || 0;
  }

  async profileConcurrentQueries(queryConfig, concurrency = 10, queriesPerConnection = 20) {
    const { sql, params = [] } = queryConfig;
    const startTime = performance.now();

    const connectionPromises = Array.from({ length: concurrency }, async (_, connId) => {
      const connectionResults = [];
      
      for (let i = 0; i < queriesPerConnection; i++) {
        try {
          const queryStart = performance.now();
          await this.executeQuery(sql, params.map(p => 
            typeof p === 'function' ? p(connId, i) : p
          ));
          const queryEnd = performance.now();
          
          connectionResults.push({
            connectionId: connId,
            queryIndex: i,
            duration: queryEnd - queryStart,
            success: true
          });
        } catch (error) {
          connectionResults.push({
            connectionId: connId,
            queryIndex: i,
            duration: null,
            success: false,
            error: error.message
          });
        }
      }
      
      return connectionResults;
    });

    const allResults = await Promise.all(connectionPromises);
    const flatResults = allResults.flat();
    const endTime = performance.now();

    const successfulQueries = flatResults.filter(r => r.success);
    const queryTimes = successfulQueries.map(r => r.duration);
    const stats = this.calculateQueryStats(queryTimes);

    return {
      concurrency,
      queriesPerConnection,
      totalQueries: flatResults.length,
      successfulQueries: successfulQueries.length,
      failedQueries: flatResults.length - successfulQueries.length,
      successRate: (successfulQueries.length / flatResults.length) * 100,
      totalDuration: endTime - startTime,
      throughput: successfulQueries.length / ((endTime - startTime) / 1000),
      stats,
      passed: stats.p95 < 100 && successfulQueries.length / flatResults.length > 0.95
    };
  }

  analyzeQueryPatterns() {
    const patterns = {
      queryTypes: this.categorizeQueries(),
      slowQueryAnalysis: this.analyzeSlowQueries(),
      errorAnalysis: this.analyzeQueryErrors(),
      temporalPatterns: this.analyzeTemporalPatterns(),
      performanceTrends: this.analyzePerformanceTrends()
    };

    return patterns;
  }

  categorizeQueries() {
    const categories = {
      SELECT: [],
      INSERT: [],
      UPDATE: [],
      DELETE: [],
      OTHER: []
    };

    this.queryMetrics.forEach(metric => {
      const sqlUpper = metric.sql.toUpperCase().trim();
      
      if (sqlUpper.startsWith('SELECT')) {
        categories.SELECT.push(metric);
      } else if (sqlUpper.startsWith('INSERT')) {
        categories.INSERT.push(metric);
      } else if (sqlUpper.startsWith('UPDATE')) {
        categories.UPDATE.push(metric);
      } else if (sqlUpper.startsWith('DELETE')) {
        categories.DELETE.push(metric);
      } else {
        categories.OTHER.push(metric);
      }
    });

    // Calculate stats for each category
    const categoryStats = {};
    for (const [type, queries] of Object.entries(categories)) {
      const durations = queries.filter(q => q.success).map(q => q.duration);
      categoryStats[type] = {
        count: queries.length,
        stats: this.calculateQueryStats(durations),
        errorRate: (queries.filter(q => !q.success).length / queries.length) * 100
      };
    }

    return categoryStats;
  }

  analyzeSlowQueries() {
    if (this.slowQueries.length === 0) {
      return { count: 0, patterns: [] };
    }

    // Group slow queries by similar patterns
    const patterns = new Map();
    
    this.slowQueries.forEach(query => {
      // Normalize SQL for pattern matching
      const normalized = this.normalizeSql(query.sql);
      
      if (!patterns.has(normalized)) {
        patterns.set(normalized, {
          normalizedSql: normalized,
          occurrences: [],
          avgDuration: 0,
          maxDuration: 0
        });
      }
      
      const pattern = patterns.get(normalized);
      pattern.occurrences.push(query);
      pattern.maxDuration = Math.max(pattern.maxDuration, query.duration);
    });

    // Calculate average durations
    patterns.forEach(pattern => {
      const durations = pattern.occurrences.map(q => q.duration);
      pattern.avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    });

    return {
      count: this.slowQueries.length,
      patterns: Array.from(patterns.values())
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 10) // Top 10 patterns
    };
  }

  normalizeSql(sql) {
    return sql
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\d+/g, '?') // Replace numbers with placeholders
      .replace(/'[^']*'/g, '?') // Replace string literals
      .replace(/"[^"]*"/g, '?') // Replace quoted identifiers
      .toLowerCase()
      .trim();
  }

  analyzeQueryErrors() {
    if (this.errorQueries.length === 0) {
      return { count: 0, errorTypes: {} };
    }

    const errorTypes = {};
    
    this.errorQueries.forEach(error => {
      const errorCode = error.errorCode || 'UNKNOWN';
      
      if (!errorTypes[errorCode]) {
        errorTypes[errorCode] = {
          count: 0,
          examples: [],
          avgDuration: 0
        };
      }
      
      errorTypes[errorCode].count++;
      errorTypes[errorCode].examples.push({
        sql: error.sql,
        error: error.error,
        duration: error.duration
      });
    });

    // Calculate average durations for each error type
    Object.values(errorTypes).forEach(errorType => {
      const durations = errorType.examples.map(e => e.duration);
      errorType.avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      
      // Keep only a few examples
      errorType.examples = errorType.examples.slice(0, 3);
    });

    return {
      count: this.errorQueries.length,
      errorRate: (this.errorQueries.length / this.queryMetrics.length) * 100,
      errorTypes
    };
  }

  analyzeTemporalPatterns() {
    if (this.queryMetrics.length === 0) {
      return { patterns: [], analysis: 'insufficient_data' };
    }

    const timeWindows = [1000, 5000, 10000, 30000]; // ms
    const temporalAnalysis = {};

    timeWindows.forEach(window => {
      const windowData = this.getMetricsInTimeWindow(window);
      
      if (windowData.length > 1) {
        const durations = windowData.map(m => m.duration);
        temporalAnalysis[`${window}ms`] = {
          queryCount: windowData.length,
          stats: this.calculateQueryStats(durations),
          throughput: windowData.length / (window / 1000)
        };
      }
    });

    return temporalAnalysis;
  }

  getMetricsInTimeWindow(windowMs) {
    const now = performance.now();
    const cutoff = now - windowMs;
    
    return this.queryMetrics.filter(metric => 
      metric.startTime >= cutoff && metric.success
    );
  }

  analyzePerformanceTrends() {
    if (this.queryMetrics.length < 10) {
      return { trend: 'insufficient_data' };
    }

    // Group queries into time buckets
    const bucketSize = 5000; // 5 second buckets
    const buckets = new Map();
    
    this.queryMetrics.forEach(metric => {
      if (!metric.success) return;
      
      const bucketKey = Math.floor(metric.startTime / bucketSize);
      
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      
      buckets.get(bucketKey).push(metric.duration);
    });

    // Calculate average duration per bucket
    const bucketAverages = Array.from(buckets.entries())
      .map(([bucketKey, durations]) => ({
        timestamp: bucketKey * bucketSize,
        avgDuration: durations.reduce((a, b) => a + b) / durations.length,
        queryCount: durations.length
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (bucketAverages.length < 3) {
      return { trend: 'insufficient_data', buckets: bucketAverages };
    }

    // Calculate trend
    const durations = bucketAverages.map(b => b.avgDuration);
    const trend = this.calculateTrend(durations);

    return {
      trend: trend.direction,
      confidence: trend.confidence,
      buckets: bucketAverages,
      slope: trend.slope
    };
  }

  calculateTrend(values) {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate R-squared
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + (sumY - slope * sumX) / n;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    
    return {
      direction: slope > 1 ? 'increasing' : slope < -1 ? 'decreasing' : 'stable',
      slope,
      confidence: Math.max(0, Math.min(1, rSquared))
    };
  }

  generateDatabaseReport() {
    const patterns = this.analyzeQueryPatterns();
    const overallStats = this.calculateQueryStats(
      this.queryMetrics.filter(m => m.success).map(m => m.duration)
    );

    return {
      timestamp: new Date().toISOString(),
      testDuration: performance.now() - this.startTime,
      
      summary: {
        totalQueries: this.queryMetrics.length,
        successfulQueries: this.queryMetrics.filter(m => m.success).length,
        failedQueries: this.errorQueries.length,
        slowQueries: this.slowQueries.length,
        errorRate: (this.errorQueries.length / this.queryMetrics.length) * 100,
        slowQueryRate: (this.slowQueries.length / this.queryMetrics.length) * 100,
        passed: overallStats.p95 < 100 && this.errorQueries.length === 0
      },
      
      performance: overallStats,
      patterns,
      
      validation: {
        p95Under100ms: overallStats.p95 < 100,
        noErrors: this.errorQueries.length === 0,
        acceptableSlowQueryRate: (this.slowQueries.length / this.queryMetrics.length) < 0.05
      }
    };
  }
}

// Mock Database for testing
class MockDatabase {
  constructor() {
    this.connectionPool = new Array(10).fill(null).map((_, i) => ({ id: i, busy: false }));
    this.queryCache = new Map();
  }

  async execute(sql, params = [], options = {}) {
    // Simulate connection acquisition
    const connection = await this.acquireConnection();
    
    try {
      // Simulate variable query execution time based on query type
      const executionTime = this.calculateExecutionTime(sql, params);
      await new Promise(resolve => setTimeout(resolve, executionTime));
      
      // Simulate occasional errors (1% chance)
      if (Math.random() < 0.01) {
        throw new Error('Simulated database error');
      }
      
      // Generate mock result
      const result = this.generateMockResult(sql, params);
      
      return result;
      
    } finally {
      this.releaseConnection(connection);
    }
  }

  async acquireConnection() {
    // Simulate connection pool
    const connection = this.connectionPool.find(conn => !conn.busy);
    
    if (!connection) {
      // Wait for connection to become available
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50));
      return this.acquireConnection();
    }
    
    connection.busy = true;
    return connection;
  }

  releaseConnection(connection) {
    connection.busy = false;
  }

  calculateExecutionTime(sql, params) {
    const sqlUpper = sql.toUpperCase().trim();
    
    let baseTime = 20; // Base execution time
    
    // Different query types have different performance characteristics
    if (sqlUpper.startsWith('SELECT')) {
      baseTime += 10 + Math.random() * 40; // 30-70ms
      
      // Complex SELECT operations take longer
      if (sql.includes('JOIN')) baseTime += 20;
      if (sql.includes('GROUP BY')) baseTime += 15;
      if (sql.includes('ORDER BY')) baseTime += 10;
      if (sql.includes('LIKE')) baseTime += 25;
      
    } else if (sqlUpper.startsWith('INSERT')) {
      baseTime += 5 + Math.random() * 20; // 25-45ms
      
    } else if (sqlUpper.startsWith('UPDATE')) {
      baseTime += 10 + Math.random() * 30; // 30-60ms
      
    } else if (sqlUpper.startsWith('DELETE')) {
      baseTime += 15 + Math.random() * 25; // 35-60ms
    }
    
    // Add parameter complexity
    baseTime += params.length * 2;
    
    // Add occasional slow queries (5% chance of 3x slower)
    if (Math.random() < 0.05) {
      baseTime *= 3;
    }
    
    return baseTime;
  }

  generateMockResult(sql, params) {
    const sqlUpper = sql.toUpperCase().trim();
    
    if (sqlUpper.startsWith('SELECT')) {
      const rowCount = Math.floor(Math.random() * 100) + 1;
      return {
        rows: Array.from({ length: rowCount }, (_, i) => ({
          id: i + 1,
          term: `term_${i}`,
          doc_id: Math.floor(Math.random() * 1000),
          score: Math.random(),
          content: `Mock content ${i}`
        })),
        rowCount
      };
    } else {
      return {
        rowsAffected: Math.floor(Math.random() * 10) + 1,
        insertId: Math.floor(Math.random() * 10000)
      };
    }
  }
}

module.exports = DatabaseProfiler;
