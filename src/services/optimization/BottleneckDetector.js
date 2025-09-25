'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BottleneckDetector = void 0;
const events_1 = require('events');
class BottleneckDetector extends events_1.EventEmitter {
  metrics = [];
  bottlenecks = new Map();
  componentHealth = new Map();
  detectionRules = new Map();
  thresholds = new Map();
  analysisHistory = new Map();
  constructor() {
    super();
    this.initializeDetectionRules();
    this.initializeThresholds();
  }
  async initialize() {
    console.log('Initializing BottleneckDetector...');
    this.initializeComponentHealth();
    this.startContinuousMonitoring();
    console.log('BottleneckDetector initialized');
  }
  recordMetric(metric) {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
    });
    if (this.metrics.length > 100000) {
      this.metrics = this.metrics.slice(-100000);
    }
    this.updateComponentHealth(metric);
    this.checkImediateBottleneck(metric);
    this.emit('metric-recorded', metric);
  }
  async detectBottlenecks() {
    const recentMetrics = this.getRecentMetrics(15 * 60 * 1000);
    if (recentMetrics.length === 0) {
      return [];
    }
    const detectedBottlenecks = [];
    for (const [ruleName, rule] of this.detectionRules) {
      try {
        const ruleBottlenecks = rule(recentMetrics);
        detectedBottlenecks.push(...ruleBottlenecks);
      } catch (error) {
        console.error(`Error running detection rule ${ruleName}:`, error);
      }
    }
    detectedBottlenecks.forEach(bottleneck => {
      this.bottlenecks.set(bottleneck.id, bottleneck);
    });
    const criticalBottlenecks = detectedBottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      this.emit('critical-bottlenecks-detected', criticalBottlenecks);
    }
    this.emit('bottlenecks-detected', detectedBottlenecks);
    return [this.createBottleneckAnalysisMetric(detectedBottlenecks)];
  }
  async getOptimizationRecommendations(metrics) {
    const recommendations = [];
    const activeBottlenecks = Array.from(this.bottlenecks.values()).filter(b =>
      this.isRecentBottleneck(b)
    );
    for (const bottleneck of activeBottlenecks) {
      const suggestion = await this.generateOptimizationSuggestion(bottleneck);
      if (suggestion) {
        recommendations.push(suggestion);
      }
    }
    return this.prioritizeRecommendations(recommendations);
  }
  async applyOptimization(recommendation) {
    try {
      console.log(`Applying bottleneck optimization: ${recommendation.title}`);
      const success = await this.simulateOptimizationApplication(recommendation);
      if (success) {
        this.emit('bottleneck-optimization-applied', {
          recommendation,
          timestamp: Date.now(),
        });
        const bottleneck = this.bottlenecks.get(recommendation.bottleneckId);
        if (bottleneck) {
          bottleneck.trend.direction = 'improving';
          this.emit('bottleneck-resolved', bottleneck);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error applying bottleneck optimization:', error);
      return false;
    }
  }
  initializeDetectionRules() {
    this.detectionRules.set('cpu_bottleneck', metrics => {
      const bottlenecks = [];
      const cpuMetrics = metrics.filter(m => m.component === 'cpu');
      const recentCpuUsage = cpuMetrics.filter(m => m.metric === 'usage_percent').slice(-10);
      if (recentCpuUsage.length >= 5) {
        const avgCpuUsage =
          recentCpuUsage.reduce((sum, m) => sum + m.value, 0) / recentCpuUsage.length;
        if (avgCpuUsage > 90) {
          bottlenecks.push({
            id: `cpu-bottleneck-${Date.now()}`,
            timestamp: Date.now(),
            component: 'cpu',
            type: 'cpu',
            severity: avgCpuUsage > 95 ? 'critical' : 'high',
            description: `High CPU usage detected: ${avgCpuUsage.toFixed(1)}% average`,
            metrics: recentCpuUsage,
            impactAnalysis: {
              affectedComponents: ['search', 'database', 'api'],
              performanceDegradation: Math.min(50, (avgCpuUsage - 80) * 2),
              userExperienceImpact: avgCpuUsage > 95 ? 'severe' : 'significant',
              businessImpact: avgCpuUsage > 95 ? 'critical' : 'high',
            },
            rootCause: {
              primary: 'CPU resource exhaustion',
              contributing: [
                'High concurrent requests',
                'Inefficient algorithms',
                'Memory pressure',
              ],
              confidence: 85,
            },
            trend: {
              direction: this.analyzeTrend(recentCpuUsage),
              velocity: this.calculateVelocity(recentCpuUsage),
              prediction:
                avgCpuUsage > 95
                  ? 'System may become unresponsive'
                  : 'Performance will continue to degrade',
            },
          });
        }
      }
      return bottlenecks;
    });
    this.detectionRules.set('memory_bottleneck', metrics => {
      const bottlenecks = [];
      const memoryMetrics = metrics.filter(m => m.component === 'memory');
      const recentMemoryUsage = memoryMetrics.filter(m => m.metric === 'usage_percent').slice(-10);
      if (recentMemoryUsage.length >= 5) {
        const avgMemoryUsage =
          recentMemoryUsage.reduce((sum, m) => sum + m.value, 0) / recentMemoryUsage.length;
        if (avgMemoryUsage > 85) {
          bottlenecks.push({
            id: `memory-bottleneck-${Date.now()}`,
            timestamp: Date.now(),
            component: 'memory',
            type: 'memory',
            severity: avgMemoryUsage > 95 ? 'critical' : avgMemoryUsage > 90 ? 'high' : 'medium',
            description: `High memory usage detected: ${avgMemoryUsage.toFixed(1)}% average`,
            metrics: recentMemoryUsage,
            impactAnalysis: {
              affectedComponents: ['cache', 'search', 'database'],
              performanceDegradation: Math.min(60, (avgMemoryUsage - 70) * 2),
              userExperienceImpact:
                avgMemoryUsage > 95 ? 'severe' : avgMemoryUsage > 90 ? 'significant' : 'moderate',
              businessImpact: avgMemoryUsage > 95 ? 'critical' : 'medium',
            },
            rootCause: {
              primary: 'Memory resource exhaustion',
              contributing: ['Memory leaks', 'Large cache objects', 'Inefficient data structures'],
              confidence: 80,
            },
            trend: {
              direction: this.analyzeTrend(recentMemoryUsage),
              velocity: this.calculateVelocity(recentMemoryUsage),
              prediction:
                avgMemoryUsage > 95 ? 'Out of memory errors imminent' : 'GC pressure will increase',
            },
          });
        }
      }
      return bottlenecks;
    });
    this.detectionRules.set('database_bottleneck', metrics => {
      const bottlenecks = [];
      const dbMetrics = metrics.filter(m => m.component === 'database');
      const queryTimes = dbMetrics.filter(m => m.metric === 'query_response_time').slice(-20);
      if (queryTimes.length >= 10) {
        const avgQueryTime = queryTimes.reduce((sum, m) => sum + m.value, 0) / queryTimes.length;
        if (avgQueryTime > 1000) {
          bottlenecks.push({
            id: `db-query-bottleneck-${Date.now()}`,
            timestamp: Date.now(),
            component: 'database',
            type: 'database',
            severity: avgQueryTime > 5000 ? 'critical' : avgQueryTime > 3000 ? 'high' : 'medium',
            description: `Slow database queries detected: ${avgQueryTime.toFixed(0)}ms average`,
            metrics: queryTimes,
            impactAnalysis: {
              affectedComponents: ['search', 'api', 'ui'],
              performanceDegradation: Math.min(80, avgQueryTime / 50),
              userExperienceImpact:
                avgQueryTime > 5000 ? 'severe' : avgQueryTime > 3000 ? 'significant' : 'moderate',
              businessImpact: avgQueryTime > 5000 ? 'critical' : 'medium',
            },
            rootCause: {
              primary: 'Database performance issues',
              contributing: [
                'Missing indexes',
                'Lock contention',
                'Large result sets',
                'Poor query optimization',
              ],
              confidence: 90,
            },
            trend: {
              direction: this.analyzeTrend(queryTimes),
              velocity: this.calculateVelocity(queryTimes),
              prediction:
                avgQueryTime > 5000
                  ? 'Database may become unresponsive'
                  : 'Query performance will degrade further',
            },
          });
        }
      }
      const connectionMetrics = dbMetrics.filter(m => m.metric === 'active_connections').slice(-10);
      if (connectionMetrics.length >= 5) {
        const avgConnections =
          connectionMetrics.reduce((sum, m) => sum + m.value, 0) / connectionMetrics.length;
        const maxConnections = 100;
        if (avgConnections > maxConnections * 0.9) {
          bottlenecks.push({
            id: `db-connection-bottleneck-${Date.now()}`,
            timestamp: Date.now(),
            component: 'database',
            type: 'database',
            severity: avgConnections > maxConnections * 0.95 ? 'critical' : 'high',
            description: `Database connection pool exhaustion: ${avgConnections.toFixed(0)}/${maxConnections} connections`,
            metrics: connectionMetrics,
            impactAnalysis: {
              affectedComponents: ['api', 'background-jobs'],
              performanceDegradation: (avgConnections / maxConnections - 0.5) * 100,
              userExperienceImpact:
                avgConnections > maxConnections * 0.95 ? 'severe' : 'significant',
              businessImpact: 'high',
            },
            rootCause: {
              primary: 'Connection pool exhaustion',
              contributing: ['Long-running queries', 'Connection leaks', 'High concurrent load'],
              confidence: 95,
            },
            trend: {
              direction: this.analyzeTrend(connectionMetrics),
              velocity: this.calculateVelocity(connectionMetrics),
              prediction: 'New connections will be rejected',
            },
          });
        }
      }
      return bottlenecks;
    });
    this.detectionRules.set('search_bottleneck', metrics => {
      const bottlenecks = [];
      const searchMetrics = metrics.filter(m => m.component === 'search');
      const searchTimes = searchMetrics.filter(m => m.metric === 'search_response_time').slice(-15);
      if (searchTimes.length >= 8) {
        const avgSearchTime = searchTimes.reduce((sum, m) => sum + m.value, 0) / searchTimes.length;
        if (avgSearchTime > 2000) {
          bottlenecks.push({
            id: `search-bottleneck-${Date.now()}`,
            timestamp: Date.now(),
            component: 'search',
            type: 'search',
            severity: avgSearchTime > 5000 ? 'critical' : avgSearchTime > 3000 ? 'high' : 'medium',
            description: `Slow search performance detected: ${avgSearchTime.toFixed(0)}ms average`,
            metrics: searchTimes,
            impactAnalysis: {
              affectedComponents: ['ui', 'api'],
              performanceDegradation: Math.min(70, avgSearchTime / 100),
              userExperienceImpact:
                avgSearchTime > 5000 ? 'severe' : avgSearchTime > 3000 ? 'significant' : 'moderate',
              businessImpact: avgSearchTime > 5000 ? 'high' : 'medium',
            },
            rootCause: {
              primary: 'Search algorithm inefficiency',
              contributing: [
                'Large index size',
                'Complex queries',
                'Insufficient caching',
                'Poor algorithm tuning',
              ],
              confidence: 85,
            },
            trend: {
              direction: this.analyzeTrend(searchTimes),
              velocity: this.calculateVelocity(searchTimes),
              prediction: 'Search will become unusably slow',
            },
          });
        }
      }
      return bottlenecks;
    });
    this.detectionRules.set('cache_bottleneck', metrics => {
      const bottlenecks = [];
      const cacheMetrics = metrics.filter(m => m.component === 'cache');
      const hitRatioMetrics = cacheMetrics.filter(m => m.metric === 'hit_ratio').slice(-10);
      if (hitRatioMetrics.length >= 5) {
        const avgHitRatio =
          hitRatioMetrics.reduce((sum, m) => sum + m.value, 0) / hitRatioMetrics.length;
        if (avgHitRatio < 0.7) {
          bottlenecks.push({
            id: `cache-bottleneck-${Date.now()}`,
            timestamp: Date.now(),
            component: 'cache',
            type: 'cache',
            severity: avgHitRatio < 0.5 ? 'high' : 'medium',
            description: `Low cache hit ratio detected: ${(avgHitRatio * 100).toFixed(1)}%`,
            metrics: hitRatioMetrics,
            impactAnalysis: {
              affectedComponents: ['database', 'api', 'search'],
              performanceDegradation: (0.9 - avgHitRatio) * 100,
              userExperienceImpact: avgHitRatio < 0.5 ? 'significant' : 'moderate',
              businessImpact: 'medium',
            },
            rootCause: {
              primary: 'Cache inefficiency',
              contributing: [
                'Poor cache strategy',
                'Short TTL values',
                'High cache eviction',
                'Inadequate cache size',
              ],
              confidence: 80,
            },
            trend: {
              direction: this.analyzeTrend(hitRatioMetrics),
              velocity: this.calculateVelocity(hitRatioMetrics),
              prediction: 'Cache will become less effective',
            },
          });
        }
      }
      return bottlenecks;
    });
    this.detectionRules.set('network_bottleneck', metrics => {
      const bottlenecks = [];
      const networkMetrics = metrics.filter(m => m.component === 'network');
      const latencyMetrics = networkMetrics.filter(m => m.metric === 'latency').slice(-10);
      if (latencyMetrics.length >= 5) {
        const avgLatency =
          latencyMetrics.reduce((sum, m) => sum + m.value, 0) / latencyMetrics.length;
        if (avgLatency > 500) {
          bottlenecks.push({
            id: `network-bottleneck-${Date.now()}`,
            timestamp: Date.now(),
            component: 'network',
            type: 'network',
            severity: avgLatency > 1000 ? 'high' : 'medium',
            description: `High network latency detected: ${avgLatency.toFixed(0)}ms average`,
            metrics: latencyMetrics,
            impactAnalysis: {
              affectedComponents: ['api', 'database', 'cache'],
              performanceDegradation: Math.min(50, avgLatency / 20),
              userExperienceImpact: avgLatency > 1000 ? 'significant' : 'moderate',
              businessImpact: 'medium',
            },
            rootCause: {
              primary: 'Network performance issues',
              contributing: [
                'Bandwidth limitations',
                'Network congestion',
                'Geographic distance',
                'Poor routing',
              ],
              confidence: 75,
            },
            trend: {
              direction: this.analyzeTrend(latencyMetrics),
              velocity: this.calculateVelocity(latencyMetrics),
              prediction: 'Network performance will continue to degrade',
            },
          });
        }
      }
      return bottlenecks;
    });
  }
  initializeThresholds() {
    this.thresholds.set('cpu', {
      usage_percent: { warning: 70, critical: 90 },
      load_average: { warning: 2.0, critical: 4.0 },
    });
    this.thresholds.set('memory', {
      usage_percent: { warning: 80, critical: 95 },
      available_mb: { warning: 1000, critical: 500 },
    });
    this.thresholds.set('database', {
      query_response_time: { warning: 1000, critical: 3000 },
      active_connections: { warning: 80, critical: 95 },
      lock_wait_time: { warning: 100, critical: 500 },
    });
    this.thresholds.set('search', {
      search_response_time: { warning: 1000, critical: 3000 },
      index_size: { warning: 1000000, critical: 5000000 },
    });
    this.thresholds.set('cache', {
      hit_ratio: { warning: 0.8, critical: 0.6 },
      memory_usage: { warning: 0.8, critical: 0.95 },
    });
    this.thresholds.set('network', {
      latency: { warning: 200, critical: 500 },
      packet_loss: { warning: 0.01, critical: 0.05 },
    });
  }
  initializeComponentHealth() {
    const components = ['cpu', 'memory', 'database', 'search', 'cache', 'network', 'api'];
    components.forEach(component => {
      this.componentHealth.set(component, {
        component,
        status: 'unknown',
        score: 100,
        lastCheck: Date.now(),
        metrics: [],
        trends: {
          shortTerm: 'stable',
          longTerm: 'stable',
        },
        alerts: {
          warning: 0,
          critical: 0,
        },
      });
    });
  }
  updateComponentHealth(metric) {
    const health = this.componentHealth.get(metric.component);
    if (!health) return;
    health.metrics.push(metric);
    if (health.metrics.length > 100) {
      health.metrics = health.metrics.slice(-100);
    }
    health.lastCheck = Date.now();
    this.calculateHealthScore(health);
    this.updateHealthStatus(health);
    this.updateHealthTrends(health);
  }
  calculateHealthScore(health) {
    const recentMetrics = health.metrics.slice(-10);
    if (recentMetrics.length === 0) return;
    let totalScore = 0;
    let scoreCount = 0;
    recentMetrics.forEach(metric => {
      const threshold = this.thresholds.get(health.component)?.[metric.metric];
      if (threshold) {
        let score = 100;
        if (metric.value >= threshold.critical) {
          score = 0;
        } else if (metric.value >= threshold.warning) {
          score = 50;
        } else {
          const range = threshold.warning * 0.8;
          score = Math.min(100, 50 + ((threshold.warning - metric.value) / range) * 50);
        }
        totalScore += score;
        scoreCount++;
      }
    });
    if (scoreCount > 0) {
      health.score = Math.round(totalScore / scoreCount);
    }
  }
  updateHealthStatus(health) {
    if (health.score >= 80) {
      health.status = 'healthy';
    } else if (health.score >= 60) {
      health.status = 'warning';
    } else {
      health.status = 'critical';
    }
  }
  updateHealthTrends(health) {
    if (health.metrics.length < 10) return;
    const recentMetrics = health.metrics.slice(-5);
    const olderMetrics = health.metrics.slice(-10, -5);
    const recentAvg = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
    const olderAvg = olderMetrics.reduce((sum, m) => sum + m.value, 0) / olderMetrics.length;
    const isHigherWorse = ['usage_percent', 'response_time', 'latency'].some(bad =>
      recentMetrics.some(m => m.metric.includes(bad))
    );
    let trend = 'stable';
    const changeThreshold = 0.1;
    if (isHigherWorse) {
      if (recentAvg > olderAvg * (1 + changeThreshold)) {
        trend = 'degrading';
      } else if (recentAvg < olderAvg * (1 - changeThreshold)) {
        trend = 'improving';
      }
    } else {
      if (recentAvg > olderAvg * (1 + changeThreshold)) {
        trend = 'improving';
      } else if (recentAvg < olderAvg * (1 - changeThreshold)) {
        trend = 'degrading';
      }
    }
    health.trends.shortTerm = trend;
  }
  checkImediateBottleneck(metric) {
    const threshold = this.thresholds.get(metric.component)?.[metric.metric];
    if (!threshold) return;
    if (metric.value >= threshold.critical) {
      this.emit('immediate-bottleneck', {
        component: metric.component,
        metric: metric.metric,
        value: metric.value,
        threshold: threshold.critical,
        severity: 'critical',
      });
    } else if (metric.value >= threshold.warning) {
      this.emit('performance-warning', {
        component: metric.component,
        metric: metric.metric,
        value: metric.value,
        threshold: threshold.warning,
        severity: 'warning',
      });
    }
  }
  async generateOptimizationSuggestion(bottleneck) {
    const suggestions = {
      cpu: {
        title: 'CPU Optimization',
        description: 'Optimize CPU usage through algorithm improvements and load balancing',
        steps: [
          'Identify CPU-intensive operations',
          'Optimize algorithms and data structures',
          'Implement horizontal scaling',
          'Add caching for expensive operations',
          'Consider asynchronous processing',
        ],
        estimatedEffort: 'high',
        estimatedTime: '2-4 weeks',
        performanceImprovement: 30,
      },
      memory: {
        title: 'Memory Optimization',
        description: 'Reduce memory usage and improve garbage collection',
        steps: [
          'Identify memory leaks',
          'Optimize data structures',
          'Implement memory pooling',
          'Tune garbage collection',
          'Add memory monitoring',
        ],
        estimatedEffort: 'medium',
        estimatedTime: '1-2 weeks',
        performanceImprovement: 25,
      },
      database: {
        title: 'Database Optimization',
        description: 'Improve database performance through indexing and query optimization',
        steps: [
          'Analyze slow queries',
          'Add missing indexes',
          'Optimize query patterns',
          'Implement connection pooling',
          'Consider read replicas',
        ],
        estimatedEffort: 'medium',
        estimatedTime: '1-3 weeks',
        performanceImprovement: 40,
      },
      search: {
        title: 'Search Optimization',
        description: 'Optimize search algorithms and indexing strategy',
        steps: [
          'Tune search algorithms',
          'Optimize index structure',
          'Implement result caching',
          'Add search result pagination',
          'Consider search clustering',
        ],
        estimatedEffort: 'medium',
        estimatedTime: '1-2 weeks',
        performanceImprovement: 35,
      },
      cache: {
        title: 'Cache Strategy Optimization',
        description: 'Improve caching efficiency and hit rates',
        steps: [
          'Analyze cache patterns',
          'Optimize cache strategy',
          'Tune TTL values',
          'Implement cache warming',
          'Add cache monitoring',
        ],
        estimatedEffort: 'low',
        estimatedTime: '3-7 days',
        performanceImprovement: 20,
      },
      network: {
        title: 'Network Optimization',
        description: 'Reduce network latency and improve throughput',
        steps: [
          'Analyze network topology',
          'Implement CDN',
          'Optimize data transfer',
          'Add connection pooling',
          'Consider geographic distribution',
        ],
        estimatedEffort: 'high',
        estimatedTime: '2-6 weeks',
        performanceImprovement: 25,
      },
    };
    const suggestion = suggestions[bottleneck.type];
    if (!suggestion) return null;
    return {
      id: `suggestion-${bottleneck.id}-${Date.now()}`,
      bottleneckId: bottleneck.id,
      timestamp: Date.now(),
      category: bottleneck.severity === 'critical' ? 'immediate' : 'short-term',
      title: suggestion.title,
      description: suggestion.description,
      implementation: {
        steps: suggestion.steps,
        estimatedEffort: suggestion.estimatedEffort,
        estimatedTime: suggestion.estimatedTime,
        prerequisites: [],
        risks: [
          'Temporary performance impact during optimization',
          'Potential regression if not tested properly',
        ],
      },
      expectedResults: {
        performanceImprovement: suggestion.performanceImprovement,
        timeline: suggestion.estimatedTime,
        measurableOutcomes: [
          `${suggestion.performanceImprovement}% improvement in ${bottleneck.type} performance`,
          'Reduced user response times',
          'Improved system stability',
        ],
      },
      priority: this.calculateSuggestionPriority(bottleneck),
      cost:
        suggestion.estimatedEffort === 'high'
          ? 'high'
          : suggestion.estimatedEffort === 'medium'
            ? 'medium'
            : 'low',
    };
  }
  calculateSuggestionPriority(bottleneck) {
    let priority = 5;
    const severityBonus = { critical: 5, high: 3, medium: 1, low: 0 };
    priority += severityBonus[bottleneck.severity];
    const businessImpactBonus = { critical: 3, high: 2, medium: 1, low: 0 };
    priority += businessImpactBonus[bottleneck.impactAnalysis.businessImpact];
    if (bottleneck.trend.direction === 'degrading') {
      priority += 2;
    }
    return Math.min(10, priority);
  }
  getRecentMetrics(timeWindowMs) {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }
  analyzeTrend(metrics) {
    if (metrics.length < 3) return 'stable';
    const recent = metrics.slice(-3);
    const older = metrics.slice(-6, -3);
    if (older.length === 0) return 'stable';
    const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;
    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (Math.abs(changePercent) < 5) return 'stable';
    return changePercent > 0 ? 'degrading' : 'improving';
  }
  calculateVelocity(metrics) {
    if (metrics.length < 2) return 0;
    const values = metrics.map(m => m.value);
    const timeSpan = metrics[metrics.length - 1].timestamp - metrics[0].timestamp;
    if (timeSpan === 0) return 0;
    const totalChange = values[values.length - 1] - values[0];
    return (totalChange / timeSpan) * 1000;
  }
  isRecentBottleneck(bottleneck) {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return bottleneck.timestamp >= fiveMinutesAgo;
  }
  prioritizeRecommendations(recommendations) {
    return recommendations.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.expectedResults.performanceImprovement - a.expectedResults.performanceImprovement;
    });
  }
  async simulateOptimizationApplication(recommendation) {
    const successRate = 0.85;
    return Math.random() < successRate;
  }
  createBottleneckAnalysisMetric(bottlenecks) {
    const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length;
    const highCount = bottlenecks.filter(b => b.severity === 'high').length;
    return {
      timestamp: Date.now(),
      category: 'performance',
      metric: 'bottleneck_analysis',
      value: bottlenecks.length,
      unit: 'bottlenecks',
      trend: criticalCount > 0 ? 'degrading' : highCount > 2 ? 'degrading' : 'stable',
      severity: criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'low',
    };
  }
  startContinuousMonitoring() {
    setInterval(
      () => {
        const unhealthyComponents = Array.from(this.componentHealth.values()).filter(
          health => health.status === 'critical' || health.status === 'warning'
        );
        if (unhealthyComponents.length > 0) {
          this.emit('component-health-alert', unhealthyComponents);
        }
      },
      5 * 60 * 1000
    );
    setInterval(() => {
      this.emit('bottleneck-detected', {
        type: 'continuous-monitoring',
        timestamp: Date.now(),
        componentHealth: Array.from(this.componentHealth.values()),
        activeBottlenecks: Array.from(this.bottlenecks.values()).filter(b =>
          this.isRecentBottleneck(b)
        ),
      });
    }, 60000);
  }
  getComponentHealth() {
    return Array.from(this.componentHealth.values());
  }
  getActiveBottlenecks() {
    return Array.from(this.bottlenecks.values()).filter(b => this.isRecentBottleneck(b));
  }
  async destroy() {
    this.metrics.length = 0;
    this.bottlenecks.clear();
    this.componentHealth.clear();
    this.detectionRules.clear();
    this.thresholds.clear();
    this.analysisHistory.clear();
    console.log('BottleneckDetector destroyed');
  }
}
exports.BottleneckDetector = BottleneckDetector;
exports.default = BottleneckDetector;
//# sourceMappingURL=BottleneckDetector.js.map
