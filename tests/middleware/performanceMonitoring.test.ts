/**
 * Performance Monitoring Middleware Tests
 * Tests for real-time performance tracking and alerting
 */

import { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import {
  PerformanceMonitoringMiddleware,
  createPerformanceMiddleware,
  PerformanceAlert,
  PerformanceMetrics
} from '../../src/middleware/performanceMonitoring';

// Mock Express objects
const createMockRequest = (overrides: Partial<Request> = {}): Request => ({
  method: 'GET',
  originalUrl: '/api/test',
  url: '/api/test',
  headers: {},
  get: jest.fn(),
  ...overrides
} as any);

const createMockResponse = (overrides: Partial<Response> = {}): Response => {
  const res = {
    statusCode: 200,
    setHeader: jest.fn(),
    get: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    ...overrides
  } as any;

  // Mock the on method to call finish event immediately for testing
  res.on.mockImplementation((event: string, callback: Function) => {
    if (event === 'finish') {
      setTimeout(callback, 0);
    }
  });

  return res;
};

const createMockNext = (): NextFunction => jest.fn();

describe('PerformanceMonitoringMiddleware', () => {
  let monitor: PerformanceMonitoringMiddleware;

  beforeEach(() => {
    monitor = new PerformanceMonitoringMiddleware({
      enableDetailedLogging: false, // Disable for cleaner test output
      samplingRate: 1.0,
      batchSize: 5,
      flushIntervalMs: 100
    });
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('Basic Middleware Functionality', () => {
    test('should create middleware function', () => {
      const middleware = monitor.middleware();
      expect(typeof middleware).toBe('function');
    });

    test('should add request ID header', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = monitor.middleware();
      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
      expect(next).toHaveBeenCalled();
    });

    test('should track request metrics on response finish', (done) => {
      const req = createMockRequest({ method: 'POST', originalUrl: '/api/users' });
      const res = createMockResponse({ statusCode: 201 });
      const next = createMockNext();

      const metricsSpy = jest.fn();
      monitor.on('metrics-batch', metricsSpy);

      const middleware = monitor.middleware();
      middleware(req, res, next);

      // Trigger the finish event
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')?.[1];
      expect(finishCallback).toBeDefined();

      setTimeout(() => {
        expect(metricsSpy).toHaveBeenCalled();
        const metrics = metricsSpy.mock.calls[0][0];
        expect(metrics[0]).toMatchObject({
          method: 'POST',
          url: '/api/users',
          statusCode: 201,
          responseTime: expect.any(Number)
        });
        done();
      }, 50);
    });

    test('should respect sampling rate', () => {
      monitor = new PerformanceMonitoringMiddleware({ samplingRate: 0.0 });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = monitor.middleware();
      middleware(req, res, next);

      // Should still call next but not set up monitoring
      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('URL Sanitization', () => {
    test('should sanitize URLs with IDs', (done) => {
      const req = createMockRequest({ originalUrl: '/api/users/123/posts/456' });
      const res = createMockResponse();
      const next = createMockNext();

      const metricsSpy = jest.fn();
      monitor.on('metrics-batch', metricsSpy);

      const middleware = monitor.middleware();
      middleware(req, res, next);

      setTimeout(() => {
        const metrics = metricsSpy.mock.calls[0][0];
        expect(metrics[0].url).toBe('/api/users/:id/posts/:id');
        done();
      }, 50);
    });

    test('should remove query parameters', (done) => {
      const req = createMockRequest({ originalUrl: '/api/search?q=test&limit=10' });
      const res = createMockResponse();
      const next = createMockNext();

      const metricsSpy = jest.fn();
      monitor.on('metrics-batch', metricsSpy);

      const middleware = monitor.middleware();
      middleware(req, res, next);

      setTimeout(() => {
        const metrics = metricsSpy.mock.calls[0][0];
        expect(metrics[0].url).toBe('/api/search');
        done();
      }, 50);
    });
  });

  describe('Cache Performance Tracking', () => {
    test('should detect cache hits from response body', (done) => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const metricsSpy = jest.fn();
      monitor.on('metrics-batch', metricsSpy);

      const middleware = monitor.middleware();
      middleware(req, res, next);

      // Simulate cached response
      res.json({ data: 'test', cached: true });

      setTimeout(() => {
        const metrics = metricsSpy.mock.calls[0][0];
        expect(metrics[0].cacheHit).toBe(true);
        done();
      }, 50);
    });

    test('should record cache operation metrics', () => {
      const operationSpy = jest.fn();
      monitor.on('cache-operation', operationSpy);

      monitor.recordCacheOperation('get', 'test-key', true, 15, 1024);

      expect(operationSpy).toHaveBeenCalledWith({
        operation: 'get',
        key: 'test-key',
        hit: true,
        latency: 15,
        size: 1024,
        timestamp: expect.any(Number)
      });
    });

    test('should alert on slow cache operations', () => {
      const alertSpy = jest.fn();
      monitor.on('performance-alert', alertSpy);

      monitor.recordCacheOperation('set', 'slow-key', false, 1000); // 1 second

      expect(alertSpy).toHaveBeenCalledWith({
        type: 'high_latency',
        severity: 'warning',
        message: expect.stringContaining('Cache set operation took 1000ms'),
        value: 1000,
        threshold: expect.any(Number),
        timestamp: expect.any(Number),
        metadata: { operation: 'set', key: 'slow-key' }
      });
    });
  });

  describe('Memory Monitoring', () => {
    test('should record memory usage', () => {
      const memoryUsage = {
        rss: 100000000,
        heapTotal: 80000000,
        heapUsed: 60000000,
        external: 5000000,
        arrayBuffers: 1000000
      };

      const memoryUsageSpy = jest.fn();
      monitor.on('memory-usage', memoryUsageSpy);

      monitor.recordMemoryUsage(memoryUsage);

      expect(memoryUsageSpy).toHaveBeenCalledWith({
        usage: memoryUsage,
        timestamp: expect.any(Number)
      });
    });

    test('should alert on high memory usage', () => {
      const alertSpy = jest.fn();
      monitor.on('performance-alert', alertSpy);

      const highMemoryUsage = {
        rss: 1000000000,
        heapTotal: 800000000,
        heapUsed: 700000000, // 87.5% usage
        external: 50000000,
        arrayBuffers: 10000000
      };

      monitor.recordMemoryUsage(highMemoryUsage);

      expect(alertSpy).toHaveBeenCalledWith({
        type: 'memory_pressure',
        severity: 'warning',
        message: expect.stringContaining('High memory usage: 87.5%'),
        value: 0.875,
        threshold: 0.8,
        timestamp: expect.any(Number),
        metadata: { memoryUsage: highMemoryUsage }
      });
    });

    test('should emit critical alert for very high memory usage', () => {
      const alertSpy = jest.fn();
      monitor.on('performance-alert', alertSpy);

      const criticalMemoryUsage = {
        rss: 1000000000,
        heapTotal: 800000000,
        heapUsed: 780000000, // 97.5% usage
        external: 20000000,
        arrayBuffers: 5000000
      };

      monitor.recordMemoryUsage(criticalMemoryUsage);

      expect(alertSpy).toHaveBeenCalledWith({
        type: 'memory_pressure',
        severity: 'critical',
        message: expect.stringContaining('High memory usage: 97.5%'),
        value: 0.975,
        threshold: 0.8,
        timestamp: expect.any(Number),
        metadata: { memoryUsage: criticalMemoryUsage }
      });
    });
  });

  describe('Performance Statistics', () => {
    beforeEach(() => {
      // Add some mock metrics
      const mockMetrics: PerformanceMetrics[] = [
        {
          requestId: 'req1',
          method: 'GET',
          url: '/api/users',
          statusCode: 200,
          responseTime: 150,
          cacheHit: true,
          memoryUsage: 50000000,
          cpuUsage: 0.1,
          timestamp: Date.now() - 1000
        },
        {
          requestId: 'req2',
          method: 'POST',
          url: '/api/users',
          statusCode: 201,
          responseTime: 300,
          cacheHit: false,
          memoryUsage: 55000000,
          cpuUsage: 0.2,
          timestamp: Date.now() - 500
        },
        {
          requestId: 'req3',
          method: 'GET',
          url: '/api/users/:id',
          statusCode: 404,
          responseTime: 100,
          cacheHit: false,
          memoryUsage: 52000000,
          cpuUsage: 0.05,
          timestamp: Date.now() - 200
        }
      ];

      // Inject mock metrics
      (monitor as any).metrics = mockMetrics;
    });

    test('should calculate comprehensive statistics', () => {
      const stats = monitor.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.averageResponseTime).toBeCloseTo(183.33, 1);
      expect(stats.errorRate).toBeCloseTo(0.33, 2);
      expect(stats.cacheHitRate).toBeCloseTo(0.33, 2);
      expect(stats.throughput).toBeGreaterThan(0);
      expect(stats.slowestEndpoints).toBeInstanceOf(Array);
      expect(stats.topErrors).toBeInstanceOf(Array);
    });

    test('should calculate percentiles correctly', () => {
      // Add more data for better percentile calculation
      const additionalMetrics = Array.from({ length: 100 }, (_, i) => ({
        requestId: `req-${i}`,
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        responseTime: i * 10, // 0ms to 990ms
        cacheHit: i % 2 === 0,
        memoryUsage: 50000000,
        cpuUsage: 0.1,
        timestamp: Date.now() - (100 - i) * 1000
      }));

      (monitor as any).metrics = additionalMetrics;

      const stats = monitor.getStats();

      expect(stats.p95ResponseTime).toBeCloseTo(940, 0);
      expect(stats.p99ResponseTime).toBeCloseTo(980, 0);
    });

    test('should return empty stats for no data', () => {
      (monitor as any).metrics = [];

      const stats = monitor.getStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.slowestEndpoints).toEqual([]);
    });
  });

  describe('Real-time Metrics', () => {
    test('should provide real-time metrics', () => {
      const realTimeMetrics = monitor.getRealTimeMetrics();

      expect(realTimeMetrics).toHaveProperty('requestsPerSecond');
      expect(realTimeMetrics).toHaveProperty('averageResponseTime');
      expect(realTimeMetrics).toHaveProperty('errorRate');
      expect(realTimeMetrics).toHaveProperty('cacheHitRate');
      expect(realTimeMetrics).toHaveProperty('memoryUsage');
      expect(realTimeMetrics).toHaveProperty('cpuUsage');
      expect(realTimeMetrics).toHaveProperty('activeAlerts');
    });

    test('should return zero metrics when no recent data', () => {
      const realTimeMetrics = monitor.getRealTimeMetrics();

      expect(realTimeMetrics.requestsPerSecond).toBe(0);
      expect(realTimeMetrics.averageResponseTime).toBe(0);
      expect(realTimeMetrics.errorRate).toBe(0);
    });
  });

  describe('Alert System', () => {
    test('should track alert history', () => {
      const alert: PerformanceAlert = {
        type: 'high_latency',
        severity: 'warning',
        message: 'Test alert',
        value: 1500,
        threshold: 1000,
        timestamp: Date.now()
      };

      (monitor as any).emitAlert(alert);

      const alerts = monitor.getAlerts();
      expect(alerts).toContainEqual(alert);
    });

    test('should limit alert history size', () => {
      // Add many alerts
      for (let i = 0; i < 1100; i++) {
        (monitor as any).emitAlert({
          type: 'high_latency',
          severity: 'warning',
          message: `Alert ${i}`,
          value: 1000,
          threshold: 500,
          timestamp: Date.now() - i * 1000
        });
      }

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(500);
    });

    test('should filter alerts by time window', () => {
      const now = Date.now();
      const oldAlert = {
        type: 'high_latency' as const,
        severity: 'warning' as const,
        message: 'Old alert',
        value: 1000,
        threshold: 500,
        timestamp: now - 7200000 // 2 hours ago
      };

      const recentAlert = {
        type: 'high_latency' as const,
        severity: 'warning' as const,
        message: 'Recent alert',
        value: 1000,
        threshold: 500,
        timestamp: now - 1800000 // 30 minutes ago
      };

      (monitor as any).emitAlert(oldAlert);
      (monitor as any).emitAlert(recentAlert);

      const recentAlerts = monitor.getAlerts(3600000); // Last hour
      expect(recentAlerts).toHaveLength(1);
      expect(recentAlerts[0].message).toBe('Recent alert');
    });
  });

  describe('Export Functionality', () => {
    test('should export metrics as JSON', () => {
      const jsonExport = monitor.exportMetrics('json');
      const data = JSON.parse(jsonExport);

      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('stats');
      expect(data).toHaveProperty('alerts');
      expect(data).toHaveProperty('realtime');
    });

    test('should export metrics as Prometheus format', () => {
      const prometheusExport = monitor.exportMetrics('prometheus');

      expect(prometheusExport).toContain('# HELP');
      expect(prometheusExport).toContain('# TYPE');
      expect(prometheusExport).toContain('http_requests_total');
      expect(prometheusExport).toContain('cache_hit_rate');
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('should cleanup old metrics', () => {
      const oldMetric: PerformanceMetrics = {
        requestId: 'old-req',
        method: 'GET',
        url: '/api/old',
        statusCode: 200,
        responseTime: 100,
        cacheHit: false,
        memoryUsage: 50000000,
        cpuUsage: 0.1,
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };

      const recentMetric: PerformanceMetrics = {
        requestId: 'recent-req',
        method: 'GET',
        url: '/api/recent',
        statusCode: 200,
        responseTime: 150,
        cacheHit: true,
        memoryUsage: 52000000,
        cpuUsage: 0.15,
        timestamp: Date.now() - (1 * 60 * 60 * 1000) // 1 hour ago
      };

      (monitor as any).metrics = [oldMetric, recentMetric];

      monitor.cleanup();

      const remainingMetrics = (monitor as any).metrics;
      expect(remainingMetrics).toHaveLength(1);
      expect(remainingMetrics[0].requestId).toBe('recent-req');
    });

    test('should emit cleanup event', () => {
      const cleanupSpy = jest.fn();
      monitor.on('cleanup-completed', cleanupSpy);

      monitor.cleanup();

      expect(cleanupSpy).toHaveBeenCalledWith({
        metricsRetained: expect.any(Number),
        alertsRetained: expect.any(Number)
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle middleware errors gracefully', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // Simulate error in response.on
      res.on.mockImplementation(() => {
        throw new Error('Event handler error');
      });

      const middleware = monitor.middleware();

      expect(() => {
        middleware(req, res, next);
      }).not.toThrow();

      expect(next).toHaveBeenCalled();
    });

    test('should handle invalid memory usage data', () => {
      const invalidMemoryUsage = {
        rss: NaN,
        heapTotal: 0,
        heapUsed: -1,
        external: undefined,
        arrayBuffers: null
      } as any;

      expect(() => {
        monitor.recordMemoryUsage(invalidMemoryUsage);
      }).not.toThrow();
    });
  });

  describe('Configuration', () => {
    test('should apply custom configuration', () => {
      const customMonitor = new PerformanceMonitoringMiddleware({
        enableDetailedLogging: true,
        alertThresholds: {
          highLatency: 5000,
          highErrorRate: 0.1,
          cacheMissRate: 0.5,
          memoryUsage: 0.9,
          cpuUsage: 0.95
        },
        samplingRate: 0.5,
        batchSize: 200
      });

      expect(customMonitor).toBeDefined();
      customMonitor.destroy();
    });

    test('should use default configuration when none provided', () => {
      const defaultMonitor = new PerformanceMonitoringMiddleware();
      expect(defaultMonitor).toBeDefined();
      defaultMonitor.destroy();
    });
  });
});

describe('createPerformanceMiddleware Factory', () => {
  test('should create middleware with monitor instance', () => {
    const result = createPerformanceMiddleware({
      enableDetailedLogging: false,
      batchSize: 10
    });

    expect(result).toHaveProperty('middleware');
    expect(result).toHaveProperty('monitor');
    expect(result).toHaveProperty('getStats');
    expect(result).toHaveProperty('getAlerts');
    expect(result).toHaveProperty('getRealTimeMetrics');
    expect(result).toHaveProperty('exportMetrics');

    expect(typeof result.middleware).toBe('function');
    expect(typeof result.getStats).toBe('function');

    result.monitor.destroy();
  });

  test('should provide working utility functions', () => {
    const result = createPerformanceMiddleware();

    const stats = result.getStats();
    const alerts = result.getAlerts();
    const realtime = result.getRealTimeMetrics();
    const exported = result.exportMetrics();

    expect(stats).toBeDefined();
    expect(alerts).toBeInstanceOf(Array);
    expect(realtime).toBeDefined();
    expect(typeof exported).toBe('string');

    result.monitor.destroy();
  });
});

describe('Integration Tests', () => {
  test('should work with simulated Express app flow', (done) => {
    const monitor = new PerformanceMonitoringMiddleware({
      enableDetailedLogging: false,
      batchSize: 1
    });

    const metricsSpy = jest.fn();
    monitor.on('metrics-batch', metricsSpy);

    const middleware = monitor.middleware();

    // Simulate multiple requests
    const requests = [
      { method: 'GET', url: '/api/users', status: 200 },
      { method: 'POST', url: '/api/users', status: 201 },
      { method: 'GET', url: '/api/users/123', status: 404 },
      { method: 'PUT', url: '/api/users/123', status: 200 }
    ];

    let completedRequests = 0;

    requests.forEach((reqData, index) => {
      const req = createMockRequest({
        method: reqData.method,
        originalUrl: reqData.url
      });
      const res = createMockResponse({ statusCode: reqData.status });
      const next = createMockNext();

      middleware(req, res, next);

      // Trigger finish event
      setTimeout(() => {
        const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')?.[1];
        if (finishCallback) {
          finishCallback();
        }

        completedRequests++;
        if (completedRequests === requests.length) {
          // All requests completed, check metrics
          setTimeout(() => {
            expect(metricsSpy).toHaveBeenCalledTimes(requests.length);

            const stats = monitor.getStats();
            expect(stats.totalRequests).toBe(requests.length);
            expect(stats.errorRate).toBe(0.25); // 1 out of 4 requests failed

            monitor.destroy();
            done();
          }, 50);
        }
      }, index * 10);
    });
  });
});