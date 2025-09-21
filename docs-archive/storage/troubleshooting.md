# Storage Service Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting procedures for the Storage Service, covering common issues, diagnostic tools, and resolution strategies across all MVP phases.

## Table of Contents

1. [Quick Diagnostic Tools](#quick-diagnostic-tools)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Performance Issues](#performance-issues)
4. [Plugin Issues](#plugin-issues)
5. [Database Issues](#database-issues)
6. [Migration Issues](#migration-issues)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Emergency Procedures](#emergency-procedures)

## Quick Diagnostic Tools

### System Health Check

```typescript
// Quick health check script
class StorageHealthCheck {
  constructor(private storage: StorageService) {}

  async runFullDiagnostics(): Promise<DiagnosticReport> {
    console.log('🔍 Running comprehensive health check...');

    const report: DiagnosticReport = {
      timestamp: new Date(),
      overallHealth: 'unknown',
      components: {},
      recommendations: [],
      criticalIssues: [],
      warnings: []
    };

    try {
      // Basic connectivity
      report.components.database = await this.checkDatabaseHealth();
      report.components.plugins = await this.checkPluginHealth();
      report.components.performance = await this.checkPerformanceHealth();
      report.components.storage = await this.checkStorageHealth();
      report.components.configuration = await this.checkConfigurationHealth();

      // Determine overall health
      report.overallHealth = this.calculateOverallHealth(report.components);

      // Generate recommendations
      report.recommendations = this.generateRecommendations(report.components);

      console.log(`✅ Health check completed - Overall status: ${report.overallHealth}`);

    } catch (error) {
      report.overallHealth = 'critical';
      report.criticalIssues.push(`Health check failed: ${error.message}`);
      console.error('❌ Health check failed:', error.message);
    }

    return report;
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const health: ComponentHealth = {
      status: 'healthy',
      details: {},
      issues: []
    };

    try {
      // Test basic connectivity
      const startTime = Date.now();
      await this.storage.executeSQL('SELECT 1');
      const responseTime = Date.now() - startTime;

      health.details.responseTime = responseTime;
      health.details.connected = true;

      if (responseTime > 1000) {
        health.status = 'degraded';
        health.issues.push('Database response time over 1 second');
      }

      // Check database size and growth
      const stats = await this.storage.getStats();
      health.details.entryCount = stats.totalEntries;
      health.details.diskUsage = stats.diskUsage;

      if (stats.diskUsage > 10000000000) { // > 10GB
        health.status = 'warning';
        health.issues.push('Database size is very large - consider archiving old data');
      }

      // Check for corruption
      const integrityCheck = await this.storage.executeSQL('PRAGMA integrity_check');
      if (integrityCheck[0]?.integrity_check !== 'ok') {
        health.status = 'critical';
        health.issues.push('Database integrity check failed');
      }

    } catch (error) {
      health.status = 'critical';
      health.issues.push(`Database connection failed: ${error.message}`);
    }

    return health;
  }

  private async checkPluginHealth(): Promise<ComponentHealth> {
    const health: ComponentHealth = {
      status: 'healthy',
      details: {},
      issues: []
    };

    try {
      const plugins = this.storage.getRegisteredPlugins();
      health.details.totalPlugins = plugins.length;
      health.details.activePlugins = 0;
      health.details.erroredPlugins = 0;

      for (const pluginName of plugins) {
        const plugin = this.storage.getPlugin(pluginName);
        if (plugin) {
          const pluginHealth = await plugin.healthCheck();
          
          if (pluginHealth.healthy) {
            health.details.activePlugins++;
          } else {
            health.details.erroredPlugins++;
            health.issues.push(`Plugin ${pluginName} is unhealthy: ${JSON.stringify(pluginHealth.details)}`);
          }
        }
      }

      if (health.details.erroredPlugins > 0) {
        health.status = health.details.erroredPlugins === plugins.length ? 'critical' : 'degraded';
      }

    } catch (error) {
      health.status = 'critical';
      health.issues.push(`Plugin health check failed: ${error.message}`);
    }

    return health;
  }

  private async checkPerformanceHealth(): Promise<ComponentHealth> {
    const health: ComponentHealth = {
      status: 'healthy',
      details: {},
      issues: []
    };

    try {
      const stats = await this.storage.getStats();
      health.details.averageSearchTime = stats.performance.avgSearchTime;
      health.details.cacheHitRate = stats.performance.cacheHitRate;

      // Performance thresholds
      if (stats.performance.avgSearchTime > 2000) {
        health.status = 'critical';
        health.issues.push(`Average search time too high: ${stats.performance.avgSearchTime}ms`);
      } else if (stats.performance.avgSearchTime > 1000) {
        health.status = 'degraded';
        health.issues.push(`Average search time elevated: ${stats.performance.avgSearchTime}ms`);
      }

      if (stats.performance.cacheHitRate < 50) {
        health.status = 'warning';
        health.issues.push(`Low cache hit rate: ${stats.performance.cacheHitRate}%`);
      }

      // Memory usage check
      const memUsage = process.memoryUsage();
      health.details.memoryUsage = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      };

      if (memUsage.heapUsed > memUsage.heapTotal * 0.9) {
        health.status = 'critical';
        health.issues.push('Memory usage is critically high');
      }

    } catch (error) {
      health.status = 'critical';
      health.issues.push(`Performance check failed: ${error.message}`);
    }

    return health;
  }

  private async checkStorageHealth(): Promise<ComponentHealth> {
    const health: ComponentHealth = {
      status: 'healthy',
      details: {},
      issues: []
    };

    try {
      // Check disk space
      const stats = await this.storage.getStats();
      const diskUsage = stats.diskUsage;
      
      // Estimate available space (simplified)
      const availableSpace = await this.getAvailableDiskSpace();
      health.details.diskUsage = diskUsage;
      health.details.availableSpace = availableSpace;

      if (availableSpace < diskUsage * 2) {
        health.status = 'warning';
        health.issues.push('Low disk space - less than 2x database size available');
      }

      if (availableSpace < 1000000000) { // < 1GB
        health.status = 'critical';
        health.issues.push('Critically low disk space');
      }

      // Check backup status
      const lastBackup = this.storage.getConfig('last-backup-date');
      if (lastBackup) {
        const backupDate = new Date(lastBackup);
        const daysSinceBackup = (Date.now() - backupDate.getTime()) / (1000 * 60 * 60 * 24);
        
        health.details.daysSinceLastBackup = daysSinceBackup;
        
        if (daysSinceBackup > 7) {
          health.status = 'warning';
          health.issues.push(`No backup in ${Math.floor(daysSinceBackup)} days`);
        }
      } else {
        health.issues.push('No backup history found');
      }

    } catch (error) {
      health.status = 'critical';
      health.issues.push(`Storage check failed: ${error.message}`);
    }

    return health;
  }

  private async checkConfigurationHealth(): Promise<ComponentHealth> {
    const health: ComponentHealth = {
      status: 'healthy',
      details: {},
      issues: []
    };

    try {
      const config = this.storage.getConfig();
      
      // Check for required configuration
      const requiredConfigs = ['adapter', 'mvp-version'];
      for (const required of requiredConfigs) {
        if (!config[required]) {
          health.issues.push(`Missing required configuration: ${required}`);
          health.status = 'degraded';
        }
      }

      // Check plugin configuration consistency
      const enabledPlugins = this.storage.getRegisteredPlugins();
      const configuredPlugins = config.plugins || {};
      
      for (const plugin of enabledPlugins) {
        if (!configuredPlugins[plugin]) {
          health.issues.push(`Plugin ${plugin} is enabled but not configured`);
        }
      }

      health.details.configurationKeys = Object.keys(config).length;
      health.details.enabledPlugins = enabledPlugins.length;

    } catch (error) {
      health.status = 'critical';
      health.issues.push(`Configuration check failed: ${error.message}`);
    }

    return health;
  }

  private calculateOverallHealth(components: { [key: string]: ComponentHealth }): 'healthy' | 'warning' | 'degraded' | 'critical' {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('degraded')) return 'degraded';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  private generateRecommendations(components: { [key: string]: ComponentHealth }): string[] {
    const recommendations = [];

    if (components.database?.status === 'critical') {
      recommendations.push('Database issues detected - check connectivity and integrity');
    }

    if (components.performance?.status !== 'healthy') {
      recommendations.push('Performance issues detected - consider optimizing queries and indexes');
    }

    if (components.plugins?.details?.erroredPlugins > 0) {
      recommendations.push('Plugin issues detected - review plugin configurations and dependencies');
    }

    if (components.storage?.details?.daysSinceLastBackup > 7) {
      recommendations.push('Create backup immediately - backup is overdue');
    }

    return recommendations;
  }

  private async getAvailableDiskSpace(): Promise<number> {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      // This is a simplified implementation
      // In a real scenario, use proper disk space checking
      return 10000000000; // 10GB placeholder
    } catch (error) {
      return 0;
    }
  }
}

interface DiagnosticReport {
  timestamp: Date;
  overallHealth: 'healthy' | 'warning' | 'degraded' | 'critical' | 'unknown';
  components: { [key: string]: ComponentHealth };
  recommendations: string[];
  criticalIssues: string[];
  warnings: string[];
}

interface ComponentHealth {
  status: 'healthy' | 'warning' | 'degraded' | 'critical';
  details: { [key: string]: any };
  issues: string[];
}
```

### Quick Diagnostic Commands

```bash
# Quick health check script
echo "🔍 Storage Service Quick Diagnostics"
echo "=================================="

# Check if service is running
if pgrep -f "storage-service" > /dev/null; then
    echo "✅ Storage service is running"
else
    echo "❌ Storage service is not running"
    exit 1
fi

# Check database file
if [ -f "./data/knowledge.db" ]; then
    echo "✅ Database file exists"
    echo "   Size: $(du -h ./data/knowledge.db | cut -f1)"
else
    echo "❌ Database file not found"
fi

# Check recent logs
if [ -f "./logs/storage.log" ]; then
    echo "📝 Recent log entries:"
    tail -5 ./logs/storage.log
else
    echo "⚠️  Log file not found"
fi

# Check disk space
echo "💾 Disk space:"
df -h . | tail -1

echo "=================================="
echo "Run 'npm run storage:diagnose' for detailed diagnostics"
```

## Common Issues & Solutions

### Issue 1: "Database is locked" Error

**Symptoms:**
- SQLite database locked errors
- Operations hanging or timing out
- Multiple processes accessing database

**Diagnostic Steps:**
```typescript
async function diagnoseDatabaseLock(): Promise<void> {
  console.log('🔍 Diagnosing database lock issue...');

  // Check for other processes
  const lockFile = './data/knowledge.db-wal';
  if (require('fs').existsSync(lockFile)) {
    console.log('⚠️  WAL file exists - possible concurrent access');
  }

  // Check connection count
  try {
    const connections = await storage.executeSQL('PRAGMA database_list');
    console.log(`Active connections: ${connections.length}`);
  } catch (error) {
    console.log('❌ Cannot check connections:', error.message);
  }

  // Check for long-running transactions
  try {
    const transactions = await storage.executeSQL('SELECT * FROM sqlite_master LIMIT 1');
    console.log('✅ Database is accessible');
  } catch (error) {
    console.log('❌ Database access failed:', error.message);
  }
}
```

**Solutions:**
```typescript
class DatabaseLockResolver {
  async resolveLock(): Promise<void> {
    console.log('🔧 Resolving database lock...');

    // Solution 1: Close all connections properly
    await this.closeAllConnections();

    // Solution 2: Enable WAL mode for better concurrency
    await this.enableWALMode();

    // Solution 3: Set timeout for operations
    await this.configureTimeouts();

    // Solution 4: Check for zombie processes
    await this.checkForZombieProcesses();
  }

  private async closeAllConnections(): Promise<void> {
    try {
      await storage.close();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
      // Reinitialize
      await storage.initialize();
      console.log('✅ Connections reset');
    } catch (error) {
      console.error('❌ Failed to reset connections:', error.message);
    }
  }

  private async enableWALMode(): Promise<void> {
    try {
      await storage.executeSQL('PRAGMA journal_mode=WAL');
      console.log('✅ WAL mode enabled');
    } catch (error) {
      console.error('❌ Failed to enable WAL mode:', error.message);
    }
  }

  private async configureTimeouts(): Promise<void> {
    try {
      await storage.executeSQL('PRAGMA busy_timeout=30000'); // 30 seconds
      console.log('✅ Timeout configured');
    } catch (error) {
      console.error('❌ Failed to configure timeout:', error.message);
    }
  }

  private async checkForZombieProcesses(): Promise<void> {
    // Implementation would check for zombie processes
    console.log('🔍 Checking for zombie processes...');
  }
}
```

### Issue 2: Search Performance Degradation

**Symptoms:**
- Search taking >2 seconds
- High CPU usage during searches
- Memory leaks

**Diagnostic Steps:**
```typescript
class SearchPerformanceDiagnostic {
  async diagnoseSearchPerformance(): Promise<PerformanceDiagnostic> {
    console.log('🔍 Diagnosing search performance...');

    const diagnostic: PerformanceDiagnostic = {
      issues: [],
      recommendations: []
    };

    // Test search performance
    const testQueries = ['VSAM', 'S0C7', 'JCL error', 'database issue'];
    
    for (const query of testQueries) {
      const startTime = Date.now();
      try {
        const results = await storage.searchEntries(query);
        const duration = Date.now() - startTime;
        
        console.log(`Query "${query}": ${duration}ms (${results.length} results)`);
        
        if (duration > 2000) {
          diagnostic.issues.push(`Slow query: "${query}" took ${duration}ms`);
        }
      } catch (error) {
        diagnostic.issues.push(`Query failed: "${query}" - ${error.message}`);
      }
    }

    // Check indexes
    const indexes = await this.checkIndexes();
    if (indexes.missing.length > 0) {
      diagnostic.issues.push(`Missing indexes: ${indexes.missing.join(', ')}`);
      diagnostic.recommendations.push('Create missing indexes for better performance');
    }

    // Check cache performance
    const cacheStats = storage.getCacheStats();
    if (cacheStats.hitRate < 50) {
      diagnostic.issues.push(`Low cache hit rate: ${cacheStats.hitRate}%`);
      diagnostic.recommendations.push('Review cache configuration and size');
    }

    // Check database statistics
    const stats = await storage.getStats();
    if (stats.totalEntries > 10000) {
      diagnostic.recommendations.push('Consider archiving old entries for better performance');
    }

    return diagnostic;
  }

  private async checkIndexes(): Promise<{ existing: string[], missing: string[] }> {
    const existing = await storage.executeSQL(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `);

    const requiredIndexes = [
      'idx_kb_entries_category',
      'idx_kb_entries_created_at',
      'idx_kb_tags_tag',
      'idx_search_history_timestamp'
    ];

    const existingNames = existing.map(i => i.name);
    const missing = requiredIndexes.filter(idx => !existingNames.includes(idx));

    return { existing: existingNames, missing };
  }
}
```

**Solutions:**
```typescript
class SearchPerformanceOptimizer {
  async optimizeSearchPerformance(): Promise<void> {
    console.log('⚡ Optimizing search performance...');

    // Create missing indexes
    await this.createOptimalIndexes();

    // Optimize query cache
    await this.optimizeQueryCache();

    // Update database statistics
    await this.updateStatistics();

    // Clean up fragmentation
    await this.defragmentDatabase();

    console.log('✅ Search performance optimization completed');
  }

  private async createOptimalIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON kb_entries(category)',
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_title_fts ON kb_entries(title)',
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_usage ON kb_entries(usage_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_kb_tags_entry_tag ON kb_tags(entry_id, tag)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query)',
      'CREATE INDEX IF NOT EXISTS idx_usage_metrics_entry ON usage_metrics(entry_id, timestamp DESC)'
    ];

    for (const index of indexes) {
      try {
        await storage.executeSQL(index);
        console.log('✅ Created index');
      } catch (error) {
        console.warn('⚠️  Index creation failed:', error.message);
      }
    }
  }

  private async optimizeQueryCache(): Promise<void> {
    try {
      // Clear cache to free memory
      await storage.invalidateCache();
      
      // Increase cache size if memory allows
      await storage.updateConfig({
        cacheSize: 500,
        cacheTTL: 600000 // 10 minutes
      });

      console.log('✅ Query cache optimized');
    } catch (error) {
      console.error('❌ Cache optimization failed:', error.message);
    }
  }

  private async updateStatistics(): Promise<void> {
    try {
      await storage.executeSQL('ANALYZE');
      console.log('✅ Database statistics updated');
    } catch (error) {
      console.error('❌ Statistics update failed:', error.message);
    }
  }

  private async defragmentDatabase(): Promise<void> {
    try {
      await storage.executeSQL('VACUUM');
      console.log('✅ Database defragmented');
    } catch (error) {
      console.error('❌ Defragmentation failed:', error.message);
    }
  }
}
```

### Issue 3: Plugin Initialization Failures

**Symptoms:**
- Plugins failing to start
- Missing dependencies
- Configuration errors

**Diagnostic Steps:**
```typescript
class PluginDiagnostic {
  async diagnosePlugin(pluginName: string): Promise<PluginDiagnostic> {
    console.log(`🔍 Diagnosing plugin: ${pluginName}`);

    const diagnostic: PluginDiagnostic = {
      pluginName,
      status: 'unknown',
      issues: [],
      dependencies: [],
      recommendations: []
    };

    try {
      const plugin = storage.getPlugin(pluginName);
      
      if (!plugin) {
        diagnostic.status = 'not-found';
        diagnostic.issues.push('Plugin not registered');
        diagnostic.recommendations.push('Register plugin before use');
        return diagnostic;
      }

      // Check plugin status
      diagnostic.status = plugin.getStatus();
      
      // Check dependencies
      const dependencies = plugin.getDependencies();
      for (const dep of dependencies) {
        const satisfied = await this.checkDependency(dep);
        diagnostic.dependencies.push({
          name: dep,
          satisfied,
          required: true
        });

        if (!satisfied) {
          diagnostic.issues.push(`Dependency not satisfied: ${dep}`);
        }
      }

      // Check configuration
      const config = plugin.getConfig();
      if (!config || Object.keys(config).length === 0) {
        diagnostic.issues.push('No configuration found');
        diagnostic.recommendations.push('Provide plugin configuration');
      }

      // Check health
      const health = await plugin.healthCheck();
      if (!health.healthy) {
        diagnostic.issues.push(`Health check failed: ${JSON.stringify(health.details)}`);
      }

      // Check metrics
      const metrics = plugin.getMetrics();
      if (metrics.error_rate > 0.1) {
        diagnostic.issues.push(`High error rate: ${(metrics.error_rate * 100).toFixed(1)}%`);
      }

    } catch (error) {
      diagnostic.status = 'error';
      diagnostic.issues.push(`Diagnostic failed: ${error.message}`);
    }

    return diagnostic;
  }

  private async checkDependency(dependency: string): Promise<boolean> {
    switch (dependency) {
      case 'full-text-search':
        try {
          await storage.executeSQL("SELECT * FROM kb_fts LIMIT 1");
          return true;
        } catch {
          return false;
        }
      
      case 'transactions':
        try {
          await storage.withTransaction(async () => {
            // Test transaction
          });
          return true;
        } catch {
          return false;
        }
      
      default:
        return true; // Assume satisfied for unknown dependencies
    }
  }
}
```

**Solutions:**
```typescript
class PluginResolver {
  async resolvePluginIssues(pluginName: string): Promise<void> {
    console.log(`🔧 Resolving issues for plugin: ${pluginName}`);

    const diagnostic = await new PluginDiagnostic().diagnosePlugin(pluginName);

    // Fix missing dependencies
    for (const dep of diagnostic.dependencies) {
      if (!dep.satisfied) {
        await this.resolveDependency(dep.name);
      }
    }

    // Fix configuration issues
    if (diagnostic.issues.some(i => i.includes('configuration'))) {
      await this.fixPluginConfiguration(pluginName);
    }

    // Restart plugin if needed
    if (diagnostic.status === 'error') {
      await this.restartPlugin(pluginName);
    }

    console.log(`✅ Plugin ${pluginName} issues resolved`);
  }

  private async resolveDependency(dependency: string): Promise<void> {
    switch (dependency) {
      case 'full-text-search':
        await storage.executeSQL(`
          CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
            id UNINDEXED,
            title,
            problem,
            solution,
            tags,
            content=kb_entries
          )
        `);
        break;
      
      case 'transactions':
        // Ensure WAL mode is enabled for better transaction support
        await storage.executeSQL('PRAGMA journal_mode=WAL');
        break;
      
      default:
        console.warn(`Unknown dependency: ${dependency}`);
    }
  }

  private async fixPluginConfiguration(pluginName: string): Promise<void> {
    const defaultConfigs = {
      analytics: {
        enabled: true,
        trackSearchPatterns: true,
        aggregationInterval: 3600000
      },
      patternDetection: {
        enabled: true,
        detectionInterval: 300000,
        minimumOccurrences: 3
      },
      codeAnalysis: {
        enabled: true,
        supportedLanguages: ['COBOL'],
        enableSyntaxAnalysis: true
      }
    };

    const config = defaultConfigs[pluginName];
    if (config) {
      await storage.updatePluginConfig(pluginName, config);
      console.log(`✅ Applied default configuration for ${pluginName}`);
    }
  }

  private async restartPlugin(pluginName: string): Promise<void> {
    try {
      const plugin = storage.getPlugin(pluginName);
      if (plugin) {
        await plugin.shutdown();
        await plugin.initialize();
        console.log(`✅ Plugin ${pluginName} restarted`);
      }
    } catch (error) {
      console.error(`❌ Failed to restart plugin ${pluginName}:`, error.message);
    }
  }
}
```

## Performance Issues

### Memory Leaks

**Detection:**
```typescript
class MemoryLeakDetector {
  private memoryBaseline: number = 0;
  private measurements: number[] = [];

  startMonitoring(): void {
    this.memoryBaseline = process.memoryUsage().heapUsed;
    
    setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed;
      this.measurements.push(currentMemory);
      
      // Keep only last 100 measurements
      if (this.measurements.length > 100) {
        this.measurements.shift();
      }
      
      // Check for consistent growth
      if (this.measurements.length >= 10) {
        const trend = this.calculateTrend();
        if (trend > 1000000) { // Growing by >1MB consistently
          console.warn('⚠️  Potential memory leak detected');
          this.analyzeMemoryUsage();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private calculateTrend(): number {
    const recent = this.measurements.slice(-10);
    const older = this.measurements.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    return recentAvg - olderAvg;
  }

  private analyzeMemoryUsage(): void {
    console.log('🔍 Analyzing memory usage...');
    
    const memUsage = process.memoryUsage();
    console.log(`Heap used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
    
    // Check cache size
    const cacheStats = storage.getCacheStats();
    console.log(`Cache entries: ${cacheStats.entryCount}`);
    console.log(`Cache memory: ${(cacheStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
    
    // Recommendations
    if (cacheStats.memoryUsage > 100 * 1024 * 1024) { // >100MB
      console.log('💡 Recommendation: Clear cache to free memory');
      storage.invalidateCache();
    }
    
    if (memUsage.heapUsed > 500 * 1024 * 1024) { // >500MB
      console.log('💡 Recommendation: Restart service to clear memory');
    }
  }
}
```

### Query Performance Issues

**Slow Query Analyzer:**
```typescript
class SlowQueryAnalyzer {
  private slowQueries: SlowQuery[] = [];

  startMonitoring(): void {
    // Monkey patch executeSQL to monitor queries
    const originalExecuteSQL = storage.executeSQL.bind(storage);
    
    storage.executeSQL = async (sql: string, params?: any[]) => {
      const startTime = Date.now();
      
      try {
        const result = await originalExecuteSQL(sql, params);
        const duration = Date.now() - startTime;
        
        if (duration > 1000) { // Slow query threshold
          this.recordSlowQuery(sql, params, duration);
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.recordSlowQuery(sql, params, duration, error.message);
        throw error;
      }
    };
  }

  private recordSlowQuery(sql: string, params: any[], duration: number, error?: string): void {
    const slowQuery: SlowQuery = {
      sql,
      params,
      duration,
      timestamp: new Date(),
      error
    };

    this.slowQueries.push(slowQuery);
    
    // Keep only last 50 slow queries
    if (this.slowQueries.length > 50) {
      this.slowQueries.shift();
    }

    console.warn(`🐌 Slow query detected: ${duration}ms - ${sql.substring(0, 100)}...`);
    
    // Provide optimization suggestions
    this.suggestOptimizations(slowQuery);
  }

  private suggestOptimizations(query: SlowQuery): void {
    const sql = query.sql.toLowerCase();
    
    if (sql.includes('select') && !sql.includes('limit')) {
      console.log('💡 Suggestion: Add LIMIT clause to constrain result set');
    }
    
    if (sql.includes('like') && sql.includes('%')) {
      console.log('💡 Suggestion: Consider using full-text search instead of LIKE');
    }
    
    if (sql.includes('order by') && !sql.includes('index')) {
      console.log('💡 Suggestion: Create index on ORDER BY columns');
    }
    
    if (sql.includes('join') && !sql.includes('index')) {
      console.log('💡 Suggestion: Ensure JOIN columns are indexed');
    }
  }

  getSlowQueryReport(): SlowQueryReport {
    return {
      totalSlowQueries: this.slowQueries.length,
      averageDuration: this.slowQueries.reduce((sum, q) => sum + q.duration, 0) / this.slowQueries.length,
      slowestQuery: this.slowQueries.reduce((slowest, current) => 
        current.duration > slowest.duration ? current : slowest
      ),
      commonPatterns: this.identifyCommonPatterns()
    };
  }

  private identifyCommonPatterns(): string[] {
    const patterns = new Map<string, number>();
    
    this.slowQueries.forEach(query => {
      const pattern = this.extractPattern(query.sql);
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });
    
    return Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => `${pattern} (${count} times)`);
  }

  private extractPattern(sql: string): string {
    return sql
      .toLowerCase()
      .replace(/\b\d+\b/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

interface SlowQuery {
  sql: string;
  params: any[];
  duration: number;
  timestamp: Date;
  error?: string;
}

interface SlowQueryReport {
  totalSlowQueries: number;
  averageDuration: number;
  slowestQuery: SlowQuery;
  commonPatterns: string[];
}
```

## Plugin Issues

### Plugin Crash Recovery

```typescript
class PluginCrashRecovery {
  private crashCount = new Map<string, number>();
  private maxCrashes = 3;
  private crashTimeWindow = 300000; // 5 minutes

  setupCrashRecovery(): void {
    // Monitor plugin crashes
    storage.on('plugin-error', (error) => {
      this.handlePluginCrash(error.plugin, error.error);
    });

    // Periodic health check
    setInterval(() => {
      this.checkAllPluginHealth();
    }, 60000); // Every minute
  }

  private async handlePluginCrash(pluginName: string, error: string): Promise<void> {
    console.error(`💥 Plugin crash detected: ${pluginName} - ${error}`);

    const crashes = this.crashCount.get(pluginName) || 0;
    this.crashCount.set(pluginName, crashes + 1);

    if (crashes < this.maxCrashes) {
      console.log(`🔄 Attempting to restart plugin: ${pluginName} (attempt ${crashes + 1})`);
      
      try {
        await this.restartPlugin(pluginName);
        console.log(`✅ Plugin ${pluginName} restarted successfully`);
      } catch (restartError) {
        console.error(`❌ Failed to restart plugin ${pluginName}:`, restartError.message);
        
        if (crashes + 1 >= this.maxCrashes) {
          console.error(`🚨 Plugin ${pluginName} has crashed ${this.maxCrashes} times - disabling`);
          await this.disablePlugin(pluginName);
        }
      }
    }
    
    // Reset crash count after time window
    setTimeout(() => {
      this.crashCount.set(pluginName, 0);
    }, this.crashTimeWindow);
  }

  private async restartPlugin(pluginName: string): Promise<void> {
    const plugin = storage.getPlugin(pluginName);
    if (plugin) {
      // Stop plugin
      if (plugin.isActive()) {
        await plugin.shutdown();
      }
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Restart plugin
      await plugin.initialize();
    }
  }

  private async disablePlugin(pluginName: string): Promise<void> {
    try {
      await storage.disablePlugin(pluginName);
      
      // Log to system
      await storage.setConfig(`plugin-${pluginName}-disabled-reason`, 'Too many crashes');
      await storage.setConfig(`plugin-${pluginName}-disabled-at`, new Date().toISOString());
      
      console.log(`⚠️  Plugin ${pluginName} has been disabled due to repeated crashes`);
    } catch (error) {
      console.error(`Failed to disable plugin ${pluginName}:`, error.message);
    }
  }

  private async checkAllPluginHealth(): Promise<void> {
    const plugins = storage.getRegisteredPlugins();
    
    for (const pluginName of plugins) {
      try {
        const plugin = storage.getPlugin(pluginName);
        if (plugin) {
          const health = await plugin.healthCheck();
          
          if (!health.healthy) {
            console.warn(`⚠️  Plugin ${pluginName} health check failed:`, health.details);
            
            // Attempt to restart unhealthy plugin
            if (plugin.isActive()) {
              await this.restartPlugin(pluginName);
            }
          }
        }
      } catch (error) {
        console.error(`Health check failed for plugin ${pluginName}:`, error.message);
      }
    }
  }
}
```

## Database Issues

### Database Corruption Recovery

```typescript
class DatabaseCorruptionRecovery {
  async checkAndRepairCorruption(): Promise<RepairResult> {
    console.log('🔍 Checking database integrity...');

    const result: RepairResult = {
      corruptionDetected: false,
      repairAttempted: false,
      repairSuccessful: false,
      backupCreated: false,
      issues: []
    };

    try {
      // Check integrity
      const integrityCheck = await storage.executeSQL('PRAGMA integrity_check');
      
      if (integrityCheck[0]?.integrity_check !== 'ok') {
        result.corruptionDetected = true;
        result.issues = integrityCheck.map(row => row.integrity_check);
        
        console.error('❌ Database corruption detected:', result.issues);
        
        // Create backup before repair
        await this.createEmergencyBackup();
        result.backupCreated = true;
        
        // Attempt repair
        result.repairAttempted = true;
        result.repairSuccessful = await this.attemptRepair();
        
      } else {
        console.log('✅ Database integrity check passed');
      }

      // Additional checks
      await this.performAdditionalChecks(result);

    } catch (error) {
      result.issues.push(`Integrity check failed: ${error.message}`);
      console.error('❌ Integrity check failed:', error.message);
    }

    return result;
  }

  private async createEmergencyBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./data/emergency-backup-${timestamp}.db`;
    
    try {
      await storage.executeSQL(`VACUUM INTO '${backupPath}'`);
      console.log(`✅ Emergency backup created: ${backupPath}`);
    } catch (error) {
      console.error('❌ Failed to create emergency backup:', error.message);
      
      // Try alternative backup method
      try {
        const fs = require('fs');
        fs.copyFileSync('./data/knowledge.db', backupPath);
        console.log(`✅ Alternative backup created: ${backupPath}`);
      } catch (copyError) {
        console.error('❌ Alternative backup also failed:', copyError.message);
        throw copyError;
      }
    }
  }

  private async attemptRepair(): Promise<boolean> {
    console.log('🔧 Attempting database repair...');

    try {
      // Method 1: VACUUM to rebuild database
      await storage.executeSQL('VACUUM');
      console.log('✅ VACUUM completed');

      // Method 2: REINDEX to rebuild indexes
      await storage.executeSQL('REINDEX');
      console.log('✅ REINDEX completed');

      // Method 3: Check integrity again
      const integrityCheck = await storage.executeSQL('PRAGMA integrity_check');
      
      if (integrityCheck[0]?.integrity_check === 'ok') {
        console.log('✅ Database repair successful');
        return true;
      } else {
        console.error('❌ Database repair failed - corruption still present');
        return false;
      }

    } catch (error) {
      console.error('❌ Database repair failed:', error.message);
      return false;
    }
  }

  private async performAdditionalChecks(result: RepairResult): Promise<void> {
    // Check foreign key constraints
    try {
      const fkCheck = await storage.executeSQL('PRAGMA foreign_key_check');
      if (fkCheck.length > 0) {
        result.issues.push(`Foreign key violations: ${fkCheck.length}`);
      }
    } catch (error) {
      result.issues.push(`Foreign key check failed: ${error.message}`);
    }

    // Check for orphaned records
    try {
      const orphanedTags = await storage.executeSQL(`
        SELECT COUNT(*) as count
        FROM kb_tags t
        LEFT JOIN kb_entries e ON t.entry_id = e.id
        WHERE e.id IS NULL
      `);

      if (orphanedTags[0].count > 0) {
        result.issues.push(`Orphaned tag records: ${orphanedTags[0].count}`);
      }
    } catch (error) {
      result.issues.push(`Orphaned record check failed: ${error.message}`);
    }

    // Check table schemas
    try {
      await this.validateTableSchemas();
    } catch (error) {
      result.issues.push(`Schema validation failed: ${error.message}`);
    }
  }

  private async validateTableSchemas(): Promise<void> {
    const expectedTables = [
      'kb_entries',
      'kb_tags',
      'search_history',
      'usage_metrics',
      'system_config'
    ];

    for (const table of expectedTables) {
      try {
        await storage.executeSQL(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
      } catch (error) {
        throw new Error(`Table ${table} is missing or corrupted: ${error.message}`);
      }
    }
  }

  async recoverFromBackup(backupPath: string): Promise<void> {
    console.log(`🔄 Recovering from backup: ${backupPath}`);

    try {
      // Close current database
      await storage.close();

      // Replace database file
      const fs = require('fs');
      fs.copyFileSync(backupPath, './data/knowledge.db');

      // Reinitialize
      await storage.initialize();

      // Verify recovery
      const integrityCheck = await storage.executeSQL('PRAGMA integrity_check');
      if (integrityCheck[0]?.integrity_check === 'ok') {
        console.log('✅ Database recovery successful');
      } else {
        throw new Error('Backup file is also corrupted');
      }

    } catch (error) {
      console.error('❌ Database recovery failed:', error.message);
      throw error;
    }
  }
}

interface RepairResult {
  corruptionDetected: boolean;
  repairAttempted: boolean;
  repairSuccessful: boolean;
  backupCreated: boolean;
  issues: string[];
}
```

## Emergency Procedures

### Emergency Recovery Procedures

```typescript
class EmergencyRecovery {
  async executeEmergencyRecovery(): Promise<void> {
    console.log('🚨 EXECUTING EMERGENCY RECOVERY PROCEDURES');
    console.log('==========================================');

    try {
      // Step 1: Stop all operations
      console.log('🛑 Step 1: Stopping all operations...');
      await this.stopAllOperations();

      // Step 2: Create emergency backup
      console.log('💾 Step 2: Creating emergency backup...');
      await this.createEmergencyBackup();

      // Step 3: Check system resources
      console.log('📊 Step 3: Checking system resources...');
      await this.checkSystemResources();

      // Step 4: Identify critical issues
      console.log('🔍 Step 4: Identifying critical issues...');
      const issues = await this.identifyCriticalIssues();

      // Step 5: Apply emergency fixes
      console.log('🔧 Step 5: Applying emergency fixes...');
      await this.applyEmergencyFixes(issues);

      // Step 6: Restart system
      console.log('🔄 Step 6: Restarting system...');
      await this.restartSystem();

      // Step 7: Verify recovery
      console.log('✅ Step 7: Verifying recovery...');
      await this.verifyRecovery();

      console.log('🎉 EMERGENCY RECOVERY COMPLETED SUCCESSFULLY');

    } catch (error) {
      console.error('💥 EMERGENCY RECOVERY FAILED:', error.message);
      await this.escalateToManualIntervention();
    }
  }

  private async stopAllOperations(): Promise<void> {
    // Disable all plugins
    const plugins = storage.getRegisteredPlugins();
    for (const plugin of plugins) {
      try {
        await storage.disablePlugin(plugin);
      } catch (error) {
        console.warn(`Failed to disable plugin ${plugin}:`, error.message);
      }
    }

    // Clear all caches
    try {
      await storage.invalidateCache();
    } catch (error) {
      console.warn('Failed to clear cache:', error.message);
    }

    // Close database connections
    try {
      await storage.close();
    } catch (error) {
      console.warn('Failed to close database:', error.message);
    }
  }

  private async createEmergencyBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./data/emergency-recovery-${timestamp}.db`;

    try {
      const fs = require('fs');
      fs.copyFileSync('./data/knowledge.db', backupPath);
      console.log(`✅ Emergency backup created: ${backupPath}`);
    } catch (error) {
      console.error('❌ Emergency backup failed:', error.message);
      throw error;
    }
  }

  private async checkSystemResources(): Promise<void> {
    const memUsage = process.memoryUsage();
    console.log(`Memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    if (memUsage.heapUsed > 1000 * 1024 * 1024) { // > 1GB
      console.warn('⚠️  High memory usage detected');
    }

    // Check disk space
    try {
      const fs = require('fs');
      const stats = fs.statSync('./data');
      console.log(`Data directory accessible: ${stats.isDirectory()}`);
    } catch (error) {
      console.error('❌ Data directory access failed:', error.message);
      throw error;
    }
  }

  private async identifyCriticalIssues(): Promise<string[]> {
    const issues = [];

    // Check database accessibility
    try {
      await storage.initialize();
      await storage.executeSQL('SELECT 1');
    } catch (error) {
      issues.push(`database-inaccessible: ${error.message}`);
    }

    // Check file system
    try {
      const fs = require('fs');
      if (!fs.existsSync('./data/knowledge.db')) {
        issues.push('database-file-missing');
      }
    } catch (error) {
      issues.push(`filesystem-error: ${error.message}`);
    }

    // Check configuration
    try {
      const config = storage.getConfig();
      if (!config || Object.keys(config).length === 0) {
        issues.push('configuration-missing');
      }
    } catch (error) {
      issues.push(`configuration-error: ${error.message}`);
    }

    return issues;
  }

  private async applyEmergencyFixes(issues: string[]): Promise<void> {
    for (const issue of issues) {
      try {
        await this.applyFix(issue);
      } catch (error) {
        console.error(`Failed to fix ${issue}:`, error.message);
      }
    }
  }

  private async applyFix(issue: string): Promise<void> {
    if (issue.startsWith('database-inaccessible')) {
      await this.fixDatabaseAccess();
    } else if (issue === 'database-file-missing') {
      await this.restoreFromBackup();
    } else if (issue === 'configuration-missing') {
      await this.restoreDefaultConfiguration();
    } else if (issue.startsWith('filesystem-error')) {
      await this.fixFilesystemIssues();
    }
  }

  private async fixDatabaseAccess(): Promise<void> {
    // Try to unlock database
    try {
      await storage.executeSQL('PRAGMA journal_mode=WAL');
      await storage.executeSQL('PRAGMA busy_timeout=30000');
      console.log('✅ Database access restored');
    } catch (error) {
      console.error('❌ Database access fix failed:', error.message);
      throw error;
    }
  }

  private async restoreFromBackup(): Promise<void> {
    // Find most recent backup
    const fs = require('fs');
    const backups = fs.readdirSync('./data')
      .filter(file => file.includes('backup'))
      .sort()
      .reverse();

    if (backups.length > 0) {
      const latestBackup = `./data/${backups[0]}`;
      fs.copyFileSync(latestBackup, './data/knowledge.db');
      console.log(`✅ Restored from backup: ${latestBackup}`);
    } else {
      throw new Error('No backup files found');
    }
  }

  private async restoreDefaultConfiguration(): Promise<void> {
    const defaultConfig = {
      'mvp-version': '1',
      'adapter': 'sqlite',
      'initialized': 'true'
    };

    for (const [key, value] of Object.entries(defaultConfig)) {
      await storage.setConfig(key, value);
    }

    console.log('✅ Default configuration restored');
  }

  private async fixFilesystemIssues(): Promise<void> {
    const fs = require('fs');
    
    // Ensure data directory exists
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }

    // Ensure logs directory exists
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs', { recursive: true });
    }

    console.log('✅ Filesystem issues fixed');
  }

  private async restartSystem(): Promise<void> {
    // Reinitialize storage
    await storage.initialize();

    // Re-enable essential plugins
    const essentialPlugins = ['analytics']; // Only essential plugins
    for (const plugin of essentialPlugins) {
      try {
        await storage.enablePlugin(plugin);
      } catch (error) {
        console.warn(`Failed to enable plugin ${plugin}:`, error.message);
      }
    }

    console.log('✅ System restarted');
  }

  private async verifyRecovery(): Promise<void> {
    // Test basic operations
    try {
      const stats = await storage.getStats();
      console.log(`✅ Database accessible - ${stats.totalEntries} entries`);
    } catch (error) {
      throw new Error(`Recovery verification failed: ${error.message}`);
    }

    // Test search functionality
    try {
      const results = await storage.searchEntries('test');
      console.log(`✅ Search functionality working - ${results.length} results`);
    } catch (error) {
      console.warn('⚠️  Search functionality impaired:', error.message);
    }

    console.log('✅ Recovery verification completed');
  }

  private async escalateToManualIntervention(): Promise<void> {
    console.log('🚨 ESCALATING TO MANUAL INTERVENTION');
    console.log('===================================');
    console.log('Automated recovery has failed.');
    console.log('Manual intervention required:');
    console.log('1. Check system logs');
    console.log('2. Verify database file integrity');
    console.log('3. Check available disk space');
    console.log('4. Review configuration files');
    console.log('5. Consider restoring from external backup');
    console.log('6. Contact system administrator');
  }
}
```

This comprehensive troubleshooting guide provides systematic approaches to diagnosing and resolving issues across all components of the Storage Service. The diagnostic tools, automated recovery procedures, and emergency protocols ensure that problems can be quickly identified and resolved with minimal downtime.

## Next Steps

1. **Implement monitoring tools** for proactive issue detection
2. **Set up automated alerts** for critical issues
3. **Create runbooks** for common scenarios
4. **Train team members** on troubleshooting procedures
5. **Regular health checks** to prevent issues before they occur