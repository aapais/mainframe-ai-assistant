/**
 * Performance Profiler for Search Operations
 * 
 * Deep performance analysis including query profiling,
 * memory usage analysis, CPU profiling, and database
 * query optimization insights.
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import Database from 'better-sqlite3';
import { SearchLogger } from './SearchLogger';

export interface ProfileSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  
  // Profiling data
  queries: QueryProfile[];
  memorySnapshots: MemorySnapshot[];
  cpuProfile: CPUProfile;
  
  // Analysis results
  bottlenecks: Bottleneck[];
  recommendations: string[];
  metrics: SessionMetrics;
}

export interface QueryProfile {
  id: string;
  query: string;
  normalizedQuery: string;
  strategy: string;
  
  // Timing breakdown
  totalTime: number;
  parseTime: number;
  executionTime: number;
  resultProcessingTime: number;
  
  // Database analysis
  explainPlan?: string;
  indexesUsed: string[];
  rowsExamined: number;
  rowsReturned: number;
  
  // Memory and CPU
  memoryUsed: number;
  cpuTime: number;
  
  // Optimization insights
  optimizationLevel: 'optimal' | 'good' | 'poor' | 'critical';
  suggestions: string[];
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  
  // Cache memory breakdown
  cacheMemory: {
    hot: number;
    warm: number;
    cold: number;
    total: number;
  };
  
  // Memory pressure indicators
  gcEvents: number;
  memoryPressure: 'low' | 'medium' | 'high';
}

export interface CPUProfile {
  totalTime: number;
  userTime: number;
  systemTime: number;
  
  // Function-level profiling
  hotFunctions: Array<{
    name: string;
    inclusiveTime: number;
    exclusiveTime: number;
    callCount: number;
    averageTime: number;
  }>;
  
  // CPU usage patterns
  utilizationPattern: Array<{
    timestamp: number;
    usage: number;
  }>;
}

export interface Bottleneck {
  type: 'query' | 'memory' | 'cpu' | 'io' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  recommendations: string[];
  
  // Supporting data
  evidence: {
    metric: string;
    value: number;
    threshold: number;
  };
}

export interface SessionMetrics {
  totalQueries: number;
  averageQueryTime: number;
  slowestQuery: number;
  fastestQuery: number;
  
  memoryEfficiency: number;
  cpuEfficiency: number;
  cacheEfficiency: number;
  
  performanceScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ProfilingConfig {
  enableQueryProfiling: boolean;
  enableMemoryProfiling: boolean;
  enableCPUProfiling: boolean;
  sampleInterval: number; // milliseconds
  maxSessions: number;
  autoAnalysis: boolean;
}

export class PerformanceProfiler {
  private db: Database.Database;
  private logger: SearchLogger;
  private config: ProfilingConfig;
  
  private activeSessions: Map<string, ProfileSession> = new Map();
  private performanceObserver?: PerformanceObserver;
  private memoryMonitor?: NodeJS.Timeout;
  private cpuBaseline: { user: number; system: number } = { user: 0, system: 0 };
  
  constructor(
    database: Database.Database,
    logger: SearchLogger,
    config: Partial<ProfilingConfig> = {}
  ) {
    this.db = database;
    this.logger = logger;
    this.config = {
      enableQueryProfiling: true,
      enableMemoryProfiling: true,
      enableCPUProfiling: true,
      sampleInterval: 1000, // 1 second
      maxSessions: 10,
      autoAnalysis: true,
      ...config
    };
    
    this.initializeProfilingTables();
    this.setupPerformanceObserver();
    this.startMemoryMonitoring();
    this.initializeCPUBaseline();
    
    console.log('📊 Performance profiler initialized');
  }

  /**
   * Start a new profiling session
   */
  startSession(name: string): string {
    const sessionId = this.generateSessionId();
    
    const session: ProfileSession = {
      id: sessionId,
      name,
      startTime: performance.now(),
      queries: [],
      memorySnapshots: [],
      cpuProfile: {
        totalTime: 0,
        userTime: 0,
        systemTime: 0,
        hotFunctions: [],
        utilizationPattern: []
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
        grade: 'F'
      }
    };
    
    this.activeSessions.set(sessionId, session);
    
    // Cleanup old sessions
    if (this.activeSessions.size > this.config.maxSessions) {
      this.cleanupOldSessions();
    }
    
    console.log(`🚀 Started profiling session: ${name} (${sessionId})`);
    return sessionId;
  }

  /**
   * End a profiling session and generate analysis
   */
  endSession(sessionId: string): ProfileSession | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Profiling session ${sessionId} not found`);
      return null;
    }
    
    session.endTime = performance.now();
    session.duration = session.endTime - session.startTime;
    
    // Perform analysis
    if (this.config.autoAnalysis) {
      this.analyzeSession(session);
    }
    
    // Store session
    this.storeSession(session);
    this.activeSessions.delete(sessionId);
    
    console.log(`✅ Ended profiling session: ${session.name} (${session.duration.toFixed(2)}ms)`);
    return session;
  }

  /**
   * Profile a query execution
   */
  profileQuery(
    sessionId: string,
    query: string,
    strategy: string,
    executionFn: () => Promise<any>
  ): Promise<{ result: any; profile: QueryProfile }> {
    return new Promise(async (resolve, reject) => {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        reject(new Error(`Session ${sessionId} not found`));
        return;
      }
      
      const queryId = this.generateQueryId();
      const startTime = performance.now();
      const startMemory = process.memoryUsage();
      const startCPU = process.cpuUsage();
      
      // Create query profile
      const profile: QueryProfile = {
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
        suggestions: []
      };
      
      try {
        // Mark query start
        performance.mark(`query-start-${queryId}`);
        
        // Execute query
        const result = await executionFn();
        
        // Mark query end
        performance.mark(`query-end-${queryId}`);
        performance.measure(`query-duration-${queryId}`, `query-start-${queryId}`, `query-end-${queryId}`);
        
        // Calculate timing
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const endCPU = process.cpuUsage(startCPU);
        
        profile.totalTime = endTime - startTime;
        profile.executionTime = profile.totalTime; // Simplified for now
        profile.memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
        profile.cpuTime = (endCPU.user + endCPU.system) / 1000; // Convert to ms
        
        // Get database query plan if available
        if (this.config.enableQueryProfiling) {
          this.analyzeQueryPlan(profile);
        }
        
        // Analyze performance
        this.analyzeQueryPerformance(profile);
        
        // Add to session
        session.queries.push(profile);
        
        resolve({ result, profile });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(sessionId: string): MemorySnapshot | null {
    const session = this.activeSessions.get(sessionId);
    if (!session || !this.config.enableMemoryProfiling) {
      return null;
    }
    
    const memUsage = process.memoryUsage();
    
    const snapshot: MemorySnapshot = {
      timestamp: performance.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      cacheMemory: this.getCacheMemoryUsage(),
      gcEvents: this.getGCEventCount(),
      memoryPressure: this.calculateMemoryPressure(memUsage)
    };
    
    session.memorySnapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get analysis for a completed session
   */
  getSessionAnalysis(sessionId: string): ProfileSession | null {
    // Try active sessions first
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession) {
      return activeSession;
    }
    
    // Load from database
    return this.loadSession(sessionId);
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(sessionId: string): string[] {
    const session = this.getSessionAnalysis(sessionId);
    if (!session) return [];
    
    const recommendations: string[] = [];
    
    // Query-based recommendations
    const slowQueries = session.queries.filter(q => q.totalTime > 1000);
    if (slowQueries.length > 0) {
      recommendations.push(`${slowQueries.length} queries exceed 1s response time - optimize these queries`);
    }
    
    const unoptimizedQueries = session.queries.filter(q => q.optimizationLevel === 'poor' || q.optimizationLevel === 'critical');
    if (unoptimizedQueries.length > 0) {
      recommendations.push(`${unoptimizedQueries.length} queries need optimization - review indexes and query structure`);
    }
    
    // Memory-based recommendations
    const memorySnapshots = session.memorySnapshots;
    if (memorySnapshots.length > 0) {
      const maxMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));
      const avgMemory = memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / memorySnapshots.length;
      
      if (maxMemory > 512 * 1024 * 1024) { // 512MB
        recommendations.push('High memory usage detected - consider optimizing cache sizes');
      }
      
      if (avgMemory / maxMemory < 0.6) {
        recommendations.push('Memory usage is inconsistent - review allocation patterns');
      }
    }
    
    // CPU-based recommendations
    if (session.cpuProfile.totalTime > session.duration! * 0.8) {
      recommendations.push('High CPU utilization - profile hot functions for optimization');
    }
    
    return recommendations;
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(sessionId: string): any {
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
        endTime: session.endTime ? new Date(session.endTime) : null
      },
      
      summary: session.metrics,
      
      queries: {
        total: session.queries.length,
        slowest: session.queries.reduce((max, q) => q.totalTime > max.totalTime ? q : max, session.queries[0]),
        fastest: session.queries.reduce((min, q) => q.totalTime < min.totalTime ? q : min, session.queries[0]),
        byStrategy: this.groupQueriesByStrategy(session.queries),
        optimization: this.analyzeQueryOptimization(session.queries)
      },
      
      memory: {
        peak: session.memorySnapshots.length > 0 ? Math.max(...session.memorySnapshots.map(s => s.heapUsed)) : 0,
        average: session.memorySnapshots.length > 0 ? 
          session.memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / session.memorySnapshots.length : 0,
        pressure: this.analyzeMemoryPressure(session.memorySnapshots),
        efficiency: session.metrics.memoryEfficiency
      },
      
      cpu: {
        totalTime: session.cpuProfile.totalTime,
        utilization: session.cpuProfile.totalTime / (session.duration || 1),
        hotFunctions: session.cpuProfile.hotFunctions.slice(0, 10),
        efficiency: session.metrics.cpuEfficiency
      },
      
      bottlenecks: session.bottlenecks,
      recommendations: session.recommendations,
      
      grade: session.metrics.grade,
      score: session.metrics.performanceScore
    };
  }

  // Private implementation methods

  private analyzeSession(session: ProfileSession): void {
    // Calculate metrics
    session.metrics.totalQueries = session.queries.length;
    
    if (session.queries.length > 0) {
      const totalTime = session.queries.reduce((sum, q) => sum + q.totalTime, 0);
      session.metrics.averageQueryTime = totalTime / session.queries.length;
      session.metrics.slowestQuery = Math.max(...session.queries.map(q => q.totalTime));
      session.metrics.fastestQuery = Math.min(...session.queries.map(q => q.totalTime));
    }
    
    // Calculate efficiency scores
    session.metrics.memoryEfficiency = this.calculateMemoryEfficiency(session);
    session.metrics.cpuEfficiency = this.calculateCPUEfficiency(session);
    session.metrics.cacheEfficiency = this.calculateCacheEfficiency(session);
    
    // Calculate overall performance score
    session.metrics.performanceScore = this.calculatePerformanceScore(session);
    session.metrics.grade = this.calculateGrade(session.metrics.performanceScore);
    
    // Identify bottlenecks
    session.bottlenecks = this.identifyBottlenecks(session);
    
    // Generate recommendations
    session.recommendations = this.generateSessionRecommendations(session);
  }

  private analyzeQueryPlan(profile: QueryProfile): void {
    // In a real implementation, this would analyze SQLite query plans
    // For now, we'll provide basic heuristics
    
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

  private analyzeQueryPerformance(profile: QueryProfile): void {
    // Determine optimization level based on performance characteristics
    if (profile.totalTime < 50) {
      profile.optimizationLevel = 'optimal';
    } else if (profile.totalTime < 200) {
      profile.optimizationLevel = 'good';
    } else if (profile.totalTime < 1000) {
      profile.optimizationLevel = 'poor';
    } else {
      profile.optimizationLevel = 'critical';
    }
    
    // Memory analysis
    if (profile.memoryUsed > 10 * 1024 * 1024) { // 10MB
      profile.suggestions.push('High memory usage - consider result set optimization');
    }
    
    // CPU analysis
    if (profile.cpuTime > profile.totalTime * 0.8) {
      profile.suggestions.push('CPU-intensive query - review algorithmic complexity');
    }
  }

  private identifyBottlenecks(session: ProfileSession): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Query bottlenecks
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
          'Consider query restructuring'
        ],
        evidence: {
          metric: 'slow_query_count',
          value: slowQueries.length,
          threshold: 0
        }
      });
    }
    
    // Memory bottlenecks
    if (session.memorySnapshots.length > 0) {
      const maxMemory = Math.max(...session.memorySnapshots.map(s => s.heapUsed));
      const threshold = 256 * 1024 * 1024; // 256MB
      
      if (maxMemory > threshold) {
        bottlenecks.push({
          type: 'memory',
          severity: maxMemory > threshold * 2 ? 'critical' : 'medium',
          description: 'High memory usage detected',
          impact: 'May cause system instability and performance degradation',
          recommendations: [
            'Optimize cache sizes',
            'Review memory allocation patterns',
            'Implement memory pooling'
          ],
          evidence: {
            metric: 'max_memory_usage',
            value: maxMemory,
            threshold
          }
        });
      }
    }
    
    return bottlenecks;
  }

  private calculateMemoryEfficiency(session: ProfileSession): number {
    if (session.memorySnapshots.length === 0) return 1;
    
    const snapshots = session.memorySnapshots;
    const maxMemory = Math.max(...snapshots.map(s => s.heapUsed));
    const avgMemory = snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length;
    
    // Efficiency based on memory utilization consistency
    return Math.max(0, 1 - (maxMemory - avgMemory) / maxMemory);
  }

  private calculateCPUEfficiency(session: ProfileSession): number {
    if (!session.duration) return 1;
    
    const cpuUtilization = session.cpuProfile.totalTime / session.duration;
    
    // Optimal CPU utilization is around 60-80%
    if (cpuUtilization <= 0.8) {
      return cpuUtilization / 0.8;
    } else {
      return Math.max(0, 2 - cpuUtilization / 0.8);
    }
  }

  private calculateCacheEfficiency(session: ProfileSession): number {
    // Simplified cache efficiency calculation
    // In practice, this would use actual cache hit rates
    return 0.8; // Placeholder
  }

  private calculatePerformanceScore(session: ProfileSession): number {
    const metrics = session.metrics;
    
    // Weighted score calculation
    const responseTimeScore = Math.max(0, 100 - (metrics.averageQueryTime / 10)); // Penalty for slow queries
    const memoryScore = metrics.memoryEfficiency * 100;
    const cpuScore = metrics.cpuEfficiency * 100;
    const cacheScore = metrics.cacheEfficiency * 100;
    
    // Weighted average
    const weights = { response: 0.4, memory: 0.2, cpu: 0.2, cache: 0.2 };
    
    return Math.round(
      responseTimeScore * weights.response +
      memoryScore * weights.memory +
      cpuScore * weights.cpu +
      cacheScore * weights.cache
    );
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateSessionRecommendations(session: ProfileSession): string[] {
    const recommendations: string[] = [];
    
    // Add bottleneck recommendations
    session.bottlenecks.forEach(bottleneck => {
      recommendations.push(...bottleneck.recommendations);
    });
    
    // Add query-specific recommendations
    session.queries.forEach(query => {
      recommendations.push(...query.suggestions);
    });
    
    // Remove duplicates and return
    return [...new Set(recommendations)];
  }

  private groupQueriesByStrategy(queries: QueryProfile[]): Record<string, any> {
    const groups = queries.reduce((acc, query) => {
      if (!acc[query.strategy]) {
        acc[query.strategy] = [];
      }
      acc[query.strategy].push(query);
      return acc;
    }, {} as Record<string, QueryProfile[]>);
    
    const result: Record<string, any> = {};
    Object.entries(groups).forEach(([strategy, strategyQueries]) => {
      result[strategy] = {
        count: strategyQueries.length,
        avgTime: strategyQueries.reduce((sum, q) => sum + q.totalTime, 0) / strategyQueries.length,
        slowest: Math.max(...strategyQueries.map(q => q.totalTime)),
        fastest: Math.min(...strategyQueries.map(q => q.totalTime))
      };
    });
    
    return result;
  }

  private analyzeQueryOptimization(queries: QueryProfile[]): any {
    const optimization = {
      optimal: queries.filter(q => q.optimizationLevel === 'optimal').length,
      good: queries.filter(q => q.optimizationLevel === 'good').length,
      poor: queries.filter(q => q.optimizationLevel === 'poor').length,
      critical: queries.filter(q => q.optimizationLevel === 'critical').length
    };
    
    return {
      ...optimization,
      total: queries.length,
      needsAttention: optimization.poor + optimization.critical
    };
  }

  private analyzeMemoryPressure(snapshots: MemorySnapshot[]): any {
    if (snapshots.length === 0) return { level: 'unknown', events: 0 };
    
    const maxPressure = Math.max(...snapshots.map(s => s.memoryPressure === 'high' ? 2 : s.memoryPressure === 'medium' ? 1 : 0));
    const gcEvents = snapshots.reduce((sum, s) => sum + s.gcEvents, 0);
    
    return {
      level: maxPressure === 2 ? 'high' : maxPressure === 1 ? 'medium' : 'low',
      events: gcEvents,
      peak: Math.max(...snapshots.map(s => s.heapUsed))
    };
  }

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private getCacheMemoryUsage(): any {
    // Placeholder - would integrate with actual cache implementation
    return {
      hot: 10 * 1024 * 1024,
      warm: 20 * 1024 * 1024,
      cold: 5 * 1024 * 1024,
      total: 35 * 1024 * 1024
    };
  }

  private getGCEventCount(): number {
    // Placeholder - would track actual GC events
    return 0;
  }

  private calculateMemoryPressure(memUsage: NodeJS.MemoryUsage): 'low' | 'medium' | 'high' {
    const utilization = memUsage.heapUsed / memUsage.heapTotal;
    
    if (utilization > 0.9) return 'high';
    if (utilization > 0.7) return 'medium';
    return 'low';
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private cleanupOldSessions(): void {
    const sessions = Array.from(this.activeSessions.entries());
    sessions.sort(([,a], [,b]) => a.startTime - b.startTime);
    
    // Remove oldest sessions
    const toRemove = sessions.slice(0, sessions.length - this.config.maxSessions + 1);
    toRemove.forEach(([id]) => {
      this.activeSessions.delete(id);
    });
  }

  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      // Process performance entries
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.name.startsWith('query-duration-')) {
          // Handle query timing data
        }
      });
    });
    
    this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
  }

  private startMemoryMonitoring(): void {
    if (!this.config.enableMemoryProfiling) return;
    
    this.memoryMonitor = setInterval(() => {
      // Take memory snapshots for all active sessions
      for (const sessionId of this.activeSessions.keys()) {
        this.takeMemorySnapshot(sessionId);
      }
    }, this.config.sampleInterval);
  }

  private initializeCPUBaseline(): void {
    this.cpuBaseline = process.cpuUsage();
  }

  private storeSession(session: ProfileSession): void {
    try {
      this.db.prepare(`
        INSERT INTO profiling_sessions (
          id, name, start_time, end_time, duration, queries,
          memory_snapshots, cpu_profile, bottlenecks, recommendations,
          metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
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

  private loadSession(sessionId: string): ProfileSession | null {
    try {
      const row = this.db.prepare(`
        SELECT * FROM profiling_sessions WHERE id = ?
      `).get(sessionId) as any;
      
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
        metrics: JSON.parse(row.metrics)
      };
    } catch (error) {
      console.error('Failed to load profiling session:', error);
      return null;
    }
  }

  private initializeProfilingTables(): void {
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