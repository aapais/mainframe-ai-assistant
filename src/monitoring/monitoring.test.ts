/**
 * Comprehensive Monitoring System Tests
 * Tests all monitoring components and integration
 */

import { 
  MonitoredSearchService, 
  SearchPerformanceMonitor,
  MonitoringOrchestrator,
  AlertingEngine,
  SearchLogger,
  PerformanceProfiler,
  DEV_MONITORING_CONFIG 
} from './index';

describe('Search Performance Monitoring', () => {
  let performanceMonitor: SearchPerformanceMonitor;

  beforeEach(async () => {
    performanceMonitor = new SearchPerformanceMonitor(':memory:');
    await performanceMonitor.initialize();
  });

  afterEach(() => {
    performanceMonitor.close();
  });

  test('should record and retrieve search metrics', async () => {
    // Record some searches
    performanceMonitor.recordSearch('test query', 250, 5, true, 'fuzzy', ['index1']);
    performanceMonitor.recordSearch('another query', 800, 3, false, 'exact', ['index2']);
    performanceMonitor.recordSearch('slow query', 1500, 1, false, 'fallback', []);

    const metrics = await performanceMonitor.getCurrentMetrics();
    
    expect(metrics.totalQueries).toBe(3);
    expect(metrics.avgResponseTime).toBeGreaterThan(0);
    expect(metrics.slaViolations).toBe(1); // The 1500ms query
    expect(metrics.cacheHitRate).toBe(33.33); // 1 out of 3 cache hits
  });

  test('should detect SLA violations', () => {
    const violations: any[] = [];
    performanceMonitor.on('sla_violation', (violation) => {
      violations.push(violation);
    });

    // Record a query that violates SLA
    performanceMonitor.recordSearch('slow query', 1200, 1, false, 'slow');

    expect(violations).toHaveLength(1);
    expect(violations[0].metric).toBe('response_time');
    expect(violations[0].value).toBe(1200);
  });

  test('should calculate percentiles correctly', async () => {
    // Record queries with known response times
    const responseTimes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    responseTimes.forEach((time, index) => {
      performanceMonitor.recordSearch(`query${index}`, time, 1, false, 'test');
    });

    const metrics = await performanceMonitor.getCurrentMetrics();
    
    expect(metrics.p50ResponseTime).toBe(500); // Median
    expect(metrics.p95ResponseTime).toBe(950); // 95th percentile
    expect(metrics.p99ResponseTime).toBe(990); // 99th percentile
  });
});

describe('Alerting Engine', () => {
  let alertingEngine: AlertingEngine;

  beforeEach(() => {
    alertingEngine = new AlertingEngine();
  });

  test('should trigger alerts when rules are violated', () => {
    const triggeredAlerts: any[] = [];
    alertingEngine.on('alert_triggered', (alert) => {
      triggeredAlerts.push(alert);
    });

    // Add a rule
    alertingEngine.addRule({
      id: 'test_rule',
      metric: 'response_time',
      operator: '>',
      threshold: 1000,
      severity: 'warning',
      channels: ['console'],
      description: 'Test rule'
    });

    // Test the rule
    alertingEngine.checkRules({ response_time: 1200 });

    expect(triggeredAlerts).toHaveLength(1);
    expect(triggeredAlerts[0].rule.id).toBe('test_rule');
    expect(triggeredAlerts[0].value).toBe(1200);
  });

  test('should handle different operators', () => {
    const triggeredAlerts: any[] = [];
    alertingEngine.on('alert_triggered', (alert) => {
      triggeredAlerts.push(alert);
    });

    // Add rules with different operators
    alertingEngine.addRule({
      id: 'greater_than',
      metric: 'value',
      operator: '>',
      threshold: 100,
      severity: 'info',
      channels: ['console']
    });

    alertingEngine.addRule({
      id: 'less_than',
      metric: 'cache_rate',
      operator: '<',
      threshold: 80,
      severity: 'warning',
      channels: ['console']
    });

    // Test the rules
    alertingEngine.checkRules({ value: 150, cache_rate: 70 });

    expect(triggeredAlerts).toHaveLength(2);
  });
});

describe('Performance Profiler', () => {
  let profiler: PerformanceProfiler;

  beforeEach(async () => {
    profiler = new PerformanceProfiler(':memory:');
    await profiler.initialize();
  });

  afterEach(() => {
    profiler.close();
  });

  test('should manage profiling sessions', async () => {
    expect(profiler.isSessionActive()).toBe(false);

    const sessionId = await profiler.startSession('test_session');
    expect(profiler.isSessionActive()).toBe(true);

    // Record some queries
    profiler.recordQuery('query1', 100, 'exact', ['index1']);
    profiler.recordQuery('query2', 200, 'fuzzy', ['index2']);

    const session = await profiler.stopSession();
    expect(profiler.isSessionActive()).toBe(false);
    expect(session).toBeTruthy();
    expect(session!.queries).toHaveLength(2);
  });

  test('should detect bottlenecks', async () => {
    const bottlenecks: any[] = [];
    profiler.on('bottleneck_detected', (bottleneck) => {
      bottlenecks.push(bottleneck);
    });

    await profiler.startSession('bottleneck_test');

    // Record a slow query that should trigger bottleneck detection
    profiler.recordQuery('slow_query', 2000, 'slow_strategy', []);

    await profiler.stopSession();

    expect(bottlenecks.length).toBeGreaterThan(0);
  });
});

describe('Search Logger', () => {
  let logger: SearchLogger;

  beforeEach(() => {
    logger = new SearchLogger();
  });

  test('should log search operations', () => {
    const logs: any[] = [];
    logger.addDestination('memory', (entry) => logs.push(entry));

    logger.logSearch({
      traceId: 'test_trace',
      query: 'test query',
      duration: 250,
      resultCount: 5,
      cacheHit: true,
      strategy: 'fuzzy'
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].operation).toBe('search');
    expect(logs[0].query).toBe('test query');
    expect(logs[0].duration).toBe(250);
  });

  test('should filter logs by level', () => {
    const logs: any[] = [];
    logger.setLevel('warn');
    logger.addDestination('memory', (entry) => logs.push(entry));

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');

    expect(logs).toHaveLength(2); // Only warn and error should be logged
    expect(logs[0].level).toBe('warn');
    expect(logs[1].level).toBe('error');
  });
});

describe('Monitoring Orchestrator', () => {
  let orchestrator: MonitoringOrchestrator;

  beforeEach(() => {
    orchestrator = new MonitoringOrchestrator({
      ...DEV_MONITORING_CONFIG,
      database: { path: ':memory:' }
    });
  });

  afterEach(async () => {
    await orchestrator.stop();
  });

  test('should start and stop successfully', async () => {
    const events: string[] = [];
    orchestrator.on('started', () => events.push('started'));
    orchestrator.on('stopped', () => events.push('stopped'));

    await orchestrator.start();
    expect(events).toContain('started');

    await orchestrator.stop();
    expect(events).toContain('stopped');
  });

  test('should record search operations', async () => {
    await orchestrator.start();

    orchestrator.recordSearch('test query', 250, 5, true, 'fuzzy');
    
    const metrics = await orchestrator.getCurrentMetrics();
    expect(metrics.totalQueries).toBe(1);
    expect(metrics.avgResponseTime).toBe(250);
  });
});

describe('Monitored Search Service Integration', () => {
  let searchService: MonitoredSearchService;

  beforeEach(async () => {
    const config = {
      ...DEV_MONITORING_CONFIG,
      database: { path: ':memory:' }
    };
    searchService = new MonitoredSearchService(':memory:', config);
    await searchService.initialize();
  });

  afterEach(async () => {
    await searchService.shutdown();
  });

  test('should perform monitored searches', async () => {
    const result = await searchService.search('test query');
    expect(Array.isArray(result)).toBe(true);

    const metrics = await searchService.getMetrics();
    expect(metrics.totalQueries).toBeGreaterThan(0);
  });

  test('should handle profiling sessions', async () => {
    const sessionId = await searchService.startProfiling('test');
    expect(typeof sessionId).toBe('string');

    // Perform some searches during profiling
    await searchService.search('query1');
    await searchService.search('query2');

    const session = await searchService.stopProfiling();
    expect(session).toBeTruthy();
    expect(session.queries.length).toBeGreaterThan(0);
  });

  test('should generate dashboard data', async () => {
    // Perform some operations to generate data
    await searchService.search('test');
    await searchService.autoComplete('te');

    const dashboard = await searchService.getDashboard();
    expect(dashboard).toBeTruthy();
    expect(dashboard.widgets).toBeDefined();
  });

  test('should generate performance reports', async () => {
    // Perform some operations
    await searchService.search('test1');
    await searchService.search('test2');

    const report = await searchService.generateReport(1);
    expect(report).toBeTruthy();
    expect(report.performance).toBeDefined();
    expect(report.recommendations).toBeDefined();
  });
});

describe('Performance Benchmarks', () => {
  let searchService: MonitoredSearchService;

  beforeEach(async () => {
    const config = {
      ...DEV_MONITORING_CONFIG,
      database: { path: ':memory:' }
    };
    searchService = new MonitoredSearchService(':memory:', config);
    await searchService.initialize();
  });

  afterEach(async () => {
    await searchService.shutdown();
  });

  test('should run benchmarks successfully', async () => {
    const results = await searchService.runBenchmarks();
    
    expect(results).toBeTruthy();
    expect(results.queries).toBeDefined();
    expect(results.results).toBeDefined();
    expect(results.metrics).toBeDefined();
    expect(results.profilingData).toBeTruthy();
  });

  test('should meet SLA requirements during benchmarks', async () => {
    const results = await searchService.runBenchmarks();
    const metrics = results.metrics;
    
    // Check SLA compliance
    expect(metrics.slaCompliance).toBeGreaterThan(90); // Should be > 90%
    expect(metrics.avgResponseTime).toBeLessThan(1000); // Should be < 1000ms on average
  });
}, 30000); // Increase timeout for benchmark tests