'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PerformanceProfiler = void 0;
const perf_hooks_1 = require('perf_hooks');
class PerformanceProfiler {
  db;
  logger;
  config;
  activeSessions = new Map();
  performanceObserver;
  memoryMonitor;
  cpuBaseline = { user: 0, system: 0 };
  constructor(database, logger, config = {}) {
    this.db = database;
    this.logger = logger;
    this.config = {
      enableQueryProfiling: true,
      enableMemoryProfiling: true,
      enableCPUProfiling: true,
      sampleInterval: 1000,
      maxSessions: 10,
      autoAnalysis: true,
      ...config,
    };
    this.initializeProfilingTables();
    this.setupPerformanceObserver();
    this.startMemoryMonitoring();
    this.initializeCPUBaseline();
    console.log('📊 Performance profiler initialized');
  }
  startSession(name) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      name,
      startTime: perf_hooks_1.performance.now(),
      queries: [],
      memorySnapshots: [],
      cpuProfile: {
        totalTime: 0,
        userTime: 0,
        systemTime: 0,
        hotFunctions: [],
        utilizationPattern: [],
      },
      bottlenecks: [],
      recommendations: [],
      metrics: {
        totalQueries: 0,
        averageQueryTime: 0,
        slowestQuery: 0,
        fastestQuery: Infinity,
        memoryEfficiency: 0,
        cpuEfficiency: 0,
        cacheEfficiency: 0,
        performanceScore: 0,
        grade: 'F',
      },
    };
    this.activeSessions.set(sessionId, session);
    if (this.activeSessions.size > this.config.maxSessions) {
      this.cleanupOldSessions();
    }
    console.log(`🚀 Started profiling session: ${name} (${sessionId})`);
    return sessionId;
  }
  endSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Profiling session ${sessionId} not found`);
      return null;
    }
    session.endTime = perf_hooks_1.performance.now();
    session.duration = session.endTime - session.startTime;
    if (this.config.autoAnalysis) {
      this.analyzeSession(session);
    }
    this.storeSession(session);
    this.activeSessions.delete(sessionId);
    console.log(`✅ Ended profiling session: ${session.name} (${session.duration.toFixed(2)}ms)`);
    return session;
  }
  profileQuery(sessionId, query, strategy, executionFn) {
    return new Promise(async (resolve, reject) => {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        reject(new Error(`Session ${sessionId} not found`));
        return;
      }
      const queryId = this.generateQueryId();
      const startTime = perf_hooks_1.performance.now();
      const startMemory = process.memoryUsage();
      const startCPU = process.cpuUsage();
      const profile = {
        id: queryId,
        query,
        normalizedQuery: this.normalizeQuery(query),
        strategy,
        totalTime: 0,
        parseTime: 0,
        executionTime: 0,
        resultProcessingTime: 0,
        indexesUsed: [],
        rowsExamined: 0,
        rowsReturned: 0,
        memoryUsed: 0,
        cpuTime: 0,
        optimizationLevel: 'optimal',
        suggestions: [],
      };
      try {
        perf_hooks_1.performance.mark(`query-start-${queryId}`);
        const result = await executionFn();
        perf_hooks_1.performance.mark(`query-end-${queryId}`);
        perf_hooks_1.performance.measure(
          `query-duration-${queryId}`,
          `query-start-${queryId}`,
          `query-end-${queryId}`
        );
        const endTime = perf_hooks_1.performance.now();
        const endMemory = process.memoryUsage();
        const endCPU = process.cpuUsage(startCPU);
        profile.totalTime = endTime - startTime;
        profile.executionTime = profile.totalTime;
        profile.memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
        profile.cpuTime = (endCPU.user + endCPU.system) / 1000;
        if (this.config.enableQueryProfiling) {
          this.analyzeQueryPlan(profile);
        }
        this.analyzeQueryPerformance(profile);
        session.queries.push(profile);
        resolve({ result, profile });
      } catch (error) {
        reject(error);
      }
    });
  }
  takeMemorySnapshot(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !this.config.enableMemoryProfiling) {
      return null;
    }
    const memUsage = process.memoryUsage();
    const snapshot = {
      timestamp: perf_hooks_1.performance.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      cacheMemory: this.getCacheMemoryUsage(),
      gcEvents: this.getGCEventCount(),
      memoryPressure: this.calculateMemoryPressure(memUsage),
    };
    session.memorySnapshots.push(snapshot);
    return snapshot;
  }
  getSessionAnalysis(sessionId) {
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession) {
      return activeSession;
    }
    return this.loadSession(sessionId);
  }
  getRecommendations(sessionId) {
    const session = this.getSessionAnalysis(sessionId);
    if (!session) return [];
    const recommendations = [];
    const slowQueries = session.queries.filter(q => q.totalTime > 1000);
    if (slowQueries.length > 0) {
      recommendations.push(
        `${slowQueries.length} queries exceed 1s response time - optimize these queries`
      );
    }
    const unoptimizedQueries = session.queries.filter(
      q => q.optimizationLevel === 'poor' || q.optimizationLevel === 'critical'
    );
    if (unoptimizedQueries.length > 0) {
      recommendations.push(
        `${unoptimizedQueries.length} queries need optimization - review indexes and query structure`
      );
    }
    const memorySnapshots = session.memorySnapshots;
    if (memorySnapshots.length > 0) {
      const maxMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));
      const avgMemory =
        memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / memorySnapshots.length;
      if (maxMemory > 512 * 1024 * 1024) {
        recommendations.push('High memory usage detected - consider optimizing cache sizes');
      }
      if (avgMemory / maxMemory < 0.6) {
        recommendations.push('Memory usage is inconsistent - review allocation patterns');
      }
    }
    if (session.cpuProfile.totalTime > session.duration * 0.8) {
      recommendations.push('High CPU utilization - profile hot functions for optimization');
    }
    return recommendations;
  }
  generateReport(sessionId) {
    const session = this.getSessionAnalysis(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return {
      session: {
        id: session.id,
        name: session.name,
        duration: session.duration,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : null,
      },
      summary: session.metrics,
      queries: {
        total: session.queries.length,
        slowest: session.queries.reduce(
          (max, q) => (q.totalTime > max.totalTime ? q : max),
          session.queries[0]
        ),
        fastest: session.queries.reduce(
          (min, q) => (q.totalTime < min.totalTime ? q : min),
          session.queries[0]
        ),
        byStrategy: this.groupQueriesByStrategy(session.queries),
        optimization: this.analyzeQueryOptimization(session.queries),
      },
      memory: {
        peak:
          session.memorySnapshots.length > 0
            ? Math.max(...session.memorySnapshots.map(s => s.heapUsed))
            : 0,
        average:
          session.memorySnapshots.length > 0
            ? session.memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) /
              session.memorySnapshots.length
            : 0,
        pressure: this.analyzeMemoryPressure(session.memorySnapshots),
        efficiency: session.metrics.memoryEfficiency,
      },
      cpu: {
        totalTime: session.cpuProfile.totalTime,
        utilization: session.cpuProfile.totalTime / (session.duration || 1),
        hotFunctions: session.cpuProfile.hotFunctions.slice(0, 10),
        efficiency: session.metrics.cpuEfficiency,
      },
      bottlenecks: session.bottlenecks,
      recommendations: session.recommendations,
      grade: session.metrics.grade,
      score: session.metrics.performanceScore,
    };
  }
  analyzeSession(session) {
    session.metrics.totalQueries = session.queries.length;
    if (session.queries.length > 0) {
      const totalTime = session.queries.reduce((sum, q) => sum + q.totalTime, 0);
      session.metrics.averageQueryTime = totalTime / session.queries.length;
      session.metrics.slowestQuery = Math.max(...session.queries.map(q => q.totalTime));
      session.metrics.fastestQuery = Math.min(...session.queries.map(q => q.totalTime));
    }
    session.metrics.memoryEfficiency = this.calculateMemoryEfficiency(session);
    session.metrics.cpuEfficiency = this.calculateCPUEfficiency(session);
    session.metrics.cacheEfficiency = this.calculateCacheEfficiency(session);
    session.metrics.performanceScore = this.calculatePerformanceScore(session);
    session.metrics.grade = this.calculateGrade(session.metrics.performanceScore);
    session.bottlenecks = this.identifyBottlenecks(session);
    session.recommendations = this.generateSessionRecommendations(session);
  }
  analyzeQueryPlan(profile) {
    if (profile.query.toLowerCase().includes('select * from')) {
      profile.suggestions.push('Avoid SELECT * - specify only needed columns');
      profile.optimizationLevel = 'poor';
    }
    if (profile.query.toLowerCase().includes('like %')) {
      profile.suggestions.push('Leading wildcard LIKE operations cannot use indexes efficiently');
      profile.optimizationLevel = 'poor';
    }
    if (profile.totalTime > 1000) {
      profile.suggestions.push('Query execution time exceeds 1s - consider adding indexes');
      profile.optimizationLevel = 'critical';
    }
  }
  analyzeQueryPerformance(profile) {
    if (profile.totalTime < 50) {
      profile.optimizationLevel = 'optimal';
    } else if (profile.totalTime < 200) {
      profile.optimizationLevel = 'good';
    } else if (profile.totalTime < 1000) {
      profile.optimizationLevel = 'poor';
    } else {
      profile.optimizationLevel = 'critical';
    }
    if (profile.memoryUsed > 10 * 1024 * 1024) {
      profile.suggestions.push('High memory usage - consider result set optimization');
    }
    if (profile.cpuTime > profile.totalTime * 0.8) {
      profile.suggestions.push('CPU-intensive query - review algorithmic complexity');
    }
  }
  identifyBottlenecks(session) {
    const bottlenecks = [];
    const slowQueries = session.queries.filter(q => q.totalTime > 1000);
    if (slowQueries.length > 0) {
      bottlenecks.push({
        type: 'query',
        severity: slowQueries.length > session.queries.length * 0.5 ? 'critical' : 'high',
        description: `${slowQueries.length} slow queries detected`,
        impact: 'Affects overall response time and user experience',
        recommendations: [
          'Optimize slow queries',
          'Add appropriate indexes',
          'Consider query restructuring',
        ],
        evidence: {
          metric: 'slow_query_count',
          value: slowQueries.length,
          threshold: 0,
        },
      });
    }
    if (session.memorySnapshots.length > 0) {
      const maxMemory = Math.max(...session.memorySnapshots.map(s => s.heapUsed));
      const threshold = 256 * 1024 * 1024;
      if (maxMemory > threshold) {
        bottlenecks.push({
          type: 'memory',
          severity: maxMemory > threshold * 2 ? 'critical' : 'medium',
          description: 'High memory usage detected',
          impact: 'May cause system instability and performance degradation',
          recommendations: [
            'Optimize cache sizes',
            'Review memory allocation patterns',
            'Implement memory pooling',
          ],
          evidence: {
            metric: 'max_memory_usage',
            value: maxMemory,
            threshold,
          },
        });
      }
    }
    return bottlenecks;
  }
  calculateMemoryEfficiency(session) {
    if (session.memorySnapshots.length === 0) return 1;
    const snapshots = session.memorySnapshots;
    const maxMemory = Math.max(...snapshots.map(s => s.heapUsed));
    const avgMemory = snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length;
    return Math.max(0, 1 - (maxMemory - avgMemory) / maxMemory);
  }
  calculateCPUEfficiency(session) {
    if (!session.duration) return 1;
    const cpuUtilization = session.cpuProfile.totalTime / session.duration;
    if (cpuUtilization <= 0.8) {
      return cpuUtilization / 0.8;
    } else {
      return Math.max(0, 2 - cpuUtilization / 0.8);
    }
  }
  calculateCacheEfficiency(session) {
    return 0.8;
  }
  calculatePerformanceScore(session) {
    const metrics = session.metrics;
    const responseTimeScore = Math.max(0, 100 - metrics.averageQueryTime / 10);
    const memoryScore = metrics.memoryEfficiency * 100;
    const cpuScore = metrics.cpuEfficiency * 100;
    const cacheScore = metrics.cacheEfficiency * 100;
    const weights = { response: 0.4, memory: 0.2, cpu: 0.2, cache: 0.2 };
    return Math.round(
      responseTimeScore * weights.response +
        memoryScore * weights.memory +
        cpuScore * weights.cpu +
        cacheScore * weights.cache
    );
  }
  calculateGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
  generateSessionRecommendations(session) {
    const recommendations = [];
    session.bottlenecks.forEach(bottleneck => {
      recommendations.push(...bottleneck.recommendations);
    });
    session.queries.forEach(query => {
      recommendations.push(...query.suggestions);
    });
    return [...new Set(recommendations)];
  }
  groupQueriesByStrategy(queries) {
    const groups = queries.reduce((acc, query) => {
      if (!acc[query.strategy]) {
        acc[query.strategy] = [];
      }
      acc[query.strategy].push(query);
      return acc;
    }, {});
    const result = {};
    Object.entries(groups).forEach(([strategy, strategyQueries]) => {
      result[strategy] = {
        count: strategyQueries.length,
        avgTime: strategyQueries.reduce((sum, q) => sum + q.totalTime, 0) / strategyQueries.length,
        slowest: Math.max(...strategyQueries.map(q => q.totalTime)),
        fastest: Math.min(...strategyQueries.map(q => q.totalTime)),
      };
    });
    return result;
  }
  analyzeQueryOptimization(queries) {
    const optimization = {
      optimal: queries.filter(q => q.optimizationLevel === 'optimal').length,
      good: queries.filter(q => q.optimizationLevel === 'good').length,
      poor: queries.filter(q => q.optimizationLevel === 'poor').length,
      critical: queries.filter(q => q.optimizationLevel === 'critical').length,
    };
    return {
      ...optimization,
      total: queries.length,
      needsAttention: optimization.poor + optimization.critical,
    };
  }
  analyzeMemoryPressure(snapshots) {
    if (snapshots.length === 0) return { level: 'unknown', events: 0 };
    const maxPressure = Math.max(
      ...snapshots.map(s =>
        s.memoryPressure === 'high' ? 2 : s.memoryPressure === 'medium' ? 1 : 0
      )
    );
    const gcEvents = snapshots.reduce((sum, s) => sum + s.gcEvents, 0);
    return {
      level: maxPressure === 2 ? 'high' : maxPressure === 1 ? 'medium' : 'low',
      events: gcEvents,
      peak: Math.max(...snapshots.map(s => s.heapUsed)),
    };
  }
  normalizeQuery(query) {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }
  getCacheMemoryUsage() {
    return {
      hot: 10 * 1024 * 1024,
      warm: 20 * 1024 * 1024,
      cold: 5 * 1024 * 1024,
      total: 35 * 1024 * 1024,
    };
  }
  getGCEventCount() {
    return 0;
  }
  calculateMemoryPressure(memUsage) {
    const utilization = memUsage.heapUsed / memUsage.heapTotal;
    if (utilization > 0.9) return 'high';
    if (utilization > 0.7) return 'medium';
    return 'low';
  }
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
  cleanupOldSessions() {
    const sessions = Array.from(this.activeSessions.entries());
    sessions.sort(([, a], [, b]) => a.startTime - b.startTime);
    const toRemove = sessions.slice(0, sessions.length - this.config.maxSessions + 1);
    toRemove.forEach(([id]) => {
      this.activeSessions.delete(id);
    });
  }
  setupPerformanceObserver() {
    this.performanceObserver = new perf_hooks_1.PerformanceObserver(list => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.name.startsWith('query-duration-')) {
        }
      });
    });
    this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
  }
  startMemoryMonitoring() {
    if (!this.config.enableMemoryProfiling) return;
    this.memoryMonitor = setInterval(() => {
      for (const sessionId of this.activeSessions.keys()) {
        this.takeMemorySnapshot(sessionId);
      }
    }, this.config.sampleInterval);
  }
  initializeCPUBaseline() {
    this.cpuBaseline = process.cpuUsage();
  }
  storeSession(session) {
    try {
      this.db
        .prepare(
          `
        INSERT INTO profiling_sessions (
          id, name, start_time, end_time, duration, queries,
          memory_snapshots, cpu_profile, bottlenecks, recommendations,
          metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          session.id,
          session.name,
          session.startTime,
          session.endTime || null,
          session.duration || null,
          JSON.stringify(session.queries),
          JSON.stringify(session.memorySnapshots),
          JSON.stringify(session.cpuProfile),
          JSON.stringify(session.bottlenecks),
          JSON.stringify(session.recommendations),
          JSON.stringify(session.metrics)
        );
    } catch (error) {
      console.error('Failed to store profiling session:', error);
    }
  }
  loadSession(sessionId) {
    try {
      const row = this.db
        .prepare(
          `
        SELECT * FROM profiling_sessions WHERE id = ?
      `
        )
        .get(sessionId);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        queries: JSON.parse(row.queries),
        memorySnapshots: JSON.parse(row.memory_snapshots),
        cpuProfile: JSON.parse(row.cpu_profile),
        bottlenecks: JSON.parse(row.bottlenecks),
        recommendations: JSON.parse(row.recommendations),
        metrics: JSON.parse(row.metrics),
      };
    } catch (error) {
      console.error('Failed to load profiling session:', error);
      return null;
    }
  }
  initializeProfilingTables() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS profiling_sessions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          start_time REAL NOT NULL,
          end_time REAL,
          duration REAL,
          queries TEXT,
          memory_snapshots TEXT,
          cpu_profile TEXT,
          bottlenecks TEXT,
          recommendations TEXT,
          metrics TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_profiling_start_time ON profiling_sessions(start_time DESC);
        CREATE INDEX IF NOT EXISTS idx_profiling_name ON profiling_sessions(name);
      `);
      console.log('✅ Profiling tables initialized');
    } catch (error) {
      console.error('❌ Failed to initialize profiling tables:', error);
    }
  }
}
exports.PerformanceProfiler = PerformanceProfiler;
//# sourceMappingURL=PerformanceProfiler.js.map
