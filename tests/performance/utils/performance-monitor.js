/**
 * Performance Monitor Utility
 * Comprehensive performance tracking and analysis
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      responseTime: [],
      throughput: [],
      errors: [],
      memory: [],
      cpu: []
    };
    this.observers = [];
    this.startTime = null;
  }

  async initialize() {
    this.startTime = performance.now();
    this.setupPerformanceObservers();
    this.startResourceMonitoring();
  }

  setupPerformanceObservers() {
    // HTTP timing observer
    const httpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          this.recordMetric('responseTime', {
            name: entry.name,
            duration: entry.duration,
            timestamp: entry.startTime
          });
        }
      }
    });
    
    httpObserver.observe({ entryTypes: ['measure'] });
    this.observers.push(httpObserver);

    // Memory observer
    const memoryObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'gc') {
          this.recordMetric('memory', {
            type: entry.detail?.type || 'unknown',
            duration: entry.duration,
            timestamp: entry.startTime
          });
        }
      }
    });
    
    try {
      memoryObserver.observe({ entryTypes: ['gc'] });
      this.observers.push(memoryObserver);
    } catch (e) {
      // GC observations not available in all environments
    }
  }

  startResourceMonitoring() {
    // Monitor system resources every second
    this.resourceInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.recordMetric('memory', {
        heap: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        timestamp: performance.now()
      });
      
      this.recordMetric('cpu', {
        user: cpuUsage.user,
        system: cpuUsage.system,
        timestamp: performance.now()
      });
    }, 1000);
  }

  recordMetric(type, data) {
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }
    
    this.metrics[type].push({
      ...data,
      relativeTime: performance.now() - this.startTime
    });
    
    this.emit('metric', { type, data });
  }

  measureAsync(name, asyncFn) {
    return async (...args) => {
      const start = `${name}-start-${Date.now()}`;
      const end = `${name}-end-${Date.now()}`;
      
      performance.mark(start);
      
      try {
        const result = await asyncFn(...args);
        performance.mark(end);
        performance.measure(name, start, end);
        return result;
      } catch (error) {
        performance.mark(end);
        performance.measure(`${name}-error`, start, end);
        this.recordMetric('errors', {
          name,
          error: error.message,
          timestamp: performance.now()
        });
        throw error;
      }
    };
  }

  measureSync(name, syncFn) {
    return (...args) => {
      const start = `${name}-start-${Date.now()}`;
      const end = `${name}-end-${Date.now()}`;
      
      performance.mark(start);
      
      try {
        const result = syncFn(...args);
        performance.mark(end);
        performance.measure(name, start, end);
        return result;
      } catch (error) {
        performance.mark(end);
        performance.measure(`${name}-error`, start, end);
        this.recordMetric('errors', {
          name,
          error: error.message,
          timestamp: performance.now()
        });
        throw error;
      }
    };
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index] || 0;
  }

  getResponseTimeStats() {
    const responseTimes = this.metrics.responseTime.map(m => m.duration);
    
    if (responseTimes.length === 0) {
      return { count: 0 };
    }
    
    return {
      count: responseTimes.length,
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
      average: responseTimes.reduce((a, b) => a + b) / responseTimes.length,
      p50: this.calculatePercentile(responseTimes, 50),
      p90: this.calculatePercentile(responseTimes, 90),
      p95: this.calculatePercentile(responseTimes, 95),
      p99: this.calculatePercentile(responseTimes, 99)
    };
  }

  getThroughputStats(timeWindowMs = 60000) {
    const now = performance.now();
    const cutoff = now - timeWindowMs;
    
    const recentRequests = this.metrics.responseTime
      .filter(m => m.relativeTime >= cutoff);
    
    const requestsPerSecond = (recentRequests.length / timeWindowMs) * 1000;
    
    return {
      requestsPerSecond,
      totalRequests: recentRequests.length,
      timeWindow: timeWindowMs
    };
  }

  getMemoryStats() {
    const memoryMetrics = this.metrics.memory
      .filter(m => m.heap !== undefined)
      .slice(-100); // Last 100 samples
    
    if (memoryMetrics.length === 0) {
      return { count: 0 };
    }
    
    const heapValues = memoryMetrics.map(m => m.heap);
    const rssValues = memoryMetrics.map(m => m.rss);
    
    return {
      heap: {
        current: heapValues[heapValues.length - 1],
        min: Math.min(...heapValues),
        max: Math.max(...heapValues),
        average: heapValues.reduce((a, b) => a + b) / heapValues.length
      },
      rss: {
        current: rssValues[rssValues.length - 1],
        min: Math.min(...rssValues),
        max: Math.max(...rssValues),
        average: rssValues.reduce((a, b) => a + b) / rssValues.length
      },
      samples: memoryMetrics.length
    };
  }

  getErrorStats() {
    const errors = this.metrics.errors;
    const errorsByName = {};
    
    errors.forEach(error => {
      if (!errorsByName[error.name]) {
        errorsByName[error.name] = 0;
      }
      errorsByName[error.name]++;
    });
    
    return {
      totalErrors: errors.length,
      errorsByName,
      errorRate: errors.length / (this.metrics.responseTime.length || 1)
    };
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      duration: performance.now() - this.startTime,
      responseTime: this.getResponseTimeStats(),
      throughput: this.getThroughputStats(),
      memory: this.getMemoryStats(),
      errors: this.getErrorStats(),
      rawMetrics: {
        responseTimeCount: this.metrics.responseTime.length,
        memoryCount: this.metrics.memory.length,
        errorCount: this.metrics.errors.length
      }
    };
  }

  reset() {
    this.metrics = {
      responseTime: [],
      throughput: [],
      errors: [],
      memory: [],
      cpu: []
    };
    this.startTime = performance.now();
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    if (this.resourceInterval) {
      clearInterval(this.resourceInterval);
      this.resourceInterval = null;
    }
  }
}

module.exports = PerformanceMonitor;
