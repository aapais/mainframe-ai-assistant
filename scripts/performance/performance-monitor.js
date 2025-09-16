/**
 * Performance Monitoring System
 * Continuous performance metrics collection and alerting
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      monitoringInterval: config.monitoringInterval || 30000, // 30 seconds
      alertThresholds: {
        responseTime: config.alertThresholds?.responseTime || 2000, // 2 seconds
        errorRate: config.alertThresholds?.errorRate || 5, // 5%
        throughput: config.alertThresholds?.throughput || 10, // 10 RPS minimum
        availability: config.alertThresholds?.availability || 95 // 95%
      },
      retentionPeriod: config.retentionPeriod || 86400000, // 24 hours
      metricsFile: config.metricsFile || './performance-metrics.json',
      alertsFile: config.alertsFile || './performance-alerts.json',
      enableRealTimeLogging: config.enableRealTimeLogging !== false,
      endpoints: config.endpoints || [
        { name: 'search', path: '/api/search', params: { q: 'monitor' }, weight: 3 },
        { name: 'entries', path: '/api/entries', params: { limit: 10 }, weight: 2 },
        { name: 'health', path: '/api/health', params: {}, weight: 1 }
      ],
      ...config
    };

    this.metrics = {
      responseTime: [],
      throughput: [],
      errorRate: [],
      availability: [],
      alerts: []
    };

    this.isMonitoring = false;
    this.monitoringTimer = null;
    this.performanceObserver = null;

    this.setupPerformanceObserver();
  }

  /**
   * Setup performance observer for detailed metrics
   */
  setupPerformanceObserver() {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.name.startsWith('monitor-')) {
          this.emit('performanceEntry', entry);
        }
      });
    });

    this.performanceObserver.observe({ entryTypes: ['measure'] });
  }

  /**
   * Start continuous performance monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️  Monitoring already active');
      return;
    }

    console.log('🚀 Starting Performance Monitoring');
    console.log(`Monitoring interval: ${this.config.monitoringInterval}ms`);
    console.log(`Alert thresholds: Response Time: ${this.config.alertThresholds.responseTime}ms, Error Rate: ${this.config.alertThresholds.errorRate}%`);

    this.isMonitoring = true;

    // Load existing metrics
    await this.loadMetrics();

    // Start monitoring loop
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics().catch(error => {
        console.error('❌ Monitoring error:', error.message);
        this.emit('monitoringError', error);
      });
    }, this.config.monitoringInterval);

    // Initial metrics collection
    await this.collectMetrics();

    console.log('✅ Performance monitoring started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('⚠️  Monitoring not active');
      return;
    }

    console.log('🛑 Stopping Performance Monitoring');

    this.isMonitoring = false;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    // Save final metrics
    await this.saveMetrics();

    console.log('✅ Performance monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Collect current performance metrics
   */
  async collectMetrics() {
    const timestamp = Date.now();
    const metricsSnapshot = {
      timestamp: timestamp,
      responseTime: {},
      throughput: 0,
      errorRate: 0,
      availability: 0,
      systemMetrics: this.getSystemMetrics()
    };

    try {
      // Test each endpoint
      const endpointResults = await this.testAllEndpoints();

      // Calculate aggregate metrics
      metricsSnapshot.responseTime = this.calculateResponseTimeMetrics(endpointResults);
      metricsSnapshot.errorRate = this.calculateErrorRate(endpointResults);
      metricsSnapshot.availability = this.calculateAvailability(endpointResults);
      metricsSnapshot.throughput = await this.measureThroughput();

      // Store metrics
      this.storeMetrics(metricsSnapshot);

      // Check for alerts
      await this.checkAlerts(metricsSnapshot);

      // Log if enabled
      if (this.config.enableRealTimeLogging) {
        this.logMetrics(metricsSnapshot);
      }

      // Emit metrics event
      this.emit('metricsCollected', metricsSnapshot);

    } catch (error) {
      console.error('❌ Failed to collect metrics:', error.message);
      this.emit('metricsError', error);
    }
  }

  /**
   * Test all configured endpoints
   */
  async testAllEndpoints() {
    const results = [];

    for (const endpoint of this.config.endpoints) {
      const result = await this.testEndpoint(endpoint);
      results.push(result);
    }

    return results;
  }

  /**
   * Test single endpoint
   */
  async testEndpoint(endpoint) {
    performance.mark(`monitor-${endpoint.name}-start`);

    try {
      const startTime = performance.now();
      const response = await axios.get(`${this.config.baseUrl}${endpoint.path}`, {
        params: endpoint.params,
        timeout: 10000
      });
      const endTime = performance.now();

      performance.mark(`monitor-${endpoint.name}-end`);
      performance.measure(`monitor-${endpoint.name}`, `monitor-${endpoint.name}-start`, `monitor-${endpoint.name}-end`);

      return {
        endpoint: endpoint.name,
        path: endpoint.path,
        responseTime: endTime - startTime,
        status: response.status,
        success: true,
        contentLength: response.headers['content-length'] || 0,
        timestamp: Date.now()
      };

    } catch (error) {
      performance.mark(`monitor-${endpoint.name}-end`);
      performance.measure(`monitor-${endpoint.name}`, `monitor-${endpoint.name}-start`, `monitor-${endpoint.name}-end`);

      return {
        endpoint: endpoint.name,
        path: endpoint.path,
        responseTime: performance.now() - performance.now(), // Will be 0 or small
        status: error.response?.status || 0,
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Calculate response time metrics from endpoint results
   */
  calculateResponseTimeMetrics(endpointResults) {
    const successfulResults = endpointResults.filter(r => r.success);

    if (successfulResults.length === 0) {
      return { mean: 0, max: 0, min: 0 };
    }

    const responseTimes = successfulResults.map(r => r.responseTime);
    const sorted = responseTimes.sort((a, b) => a - b);

    return {
      mean: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      count: successfulResults.length
    };
  }

  /**
   * Calculate error rate from endpoint results
   */
  calculateErrorRate(endpointResults) {
    if (endpointResults.length === 0) return 100;

    const errors = endpointResults.filter(r => !r.success).length;
    return (errors / endpointResults.length) * 100;
  }

  /**
   * Calculate availability from endpoint results
   */
  calculateAvailability(endpointResults) {
    if (endpointResults.length === 0) return 0;

    const successful = endpointResults.filter(r => r.success).length;
    return (successful / endpointResults.length) * 100;
  }

  /**
   * Measure current throughput
   */
  async measureThroughput() {
    const concurrency = 5;
    const duration = 10000; // 10 seconds
    const startTime = Date.now();
    let requestCount = 0;

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.throughputWorker(duration, () => requestCount++));
    }

    await Promise.all(workers);

    const actualDuration = Date.now() - startTime;
    return (requestCount / actualDuration) * 1000; // RPS
  }

  /**
   * Throughput measurement worker
   */
  async throughputWorker(duration, counter) {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      try {
        await axios.get(`${this.config.baseUrl}/api/health`, {
          timeout: 5000
        });
        counter();
      } catch (error) {
        // Count failed requests too for throughput
        counter();
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Store metrics in memory
   */
  storeMetrics(metricsSnapshot) {
    // Add to respective metric arrays
    this.metrics.responseTime.push({
      timestamp: metricsSnapshot.timestamp,
      ...metricsSnapshot.responseTime
    });

    this.metrics.throughput.push({
      timestamp: metricsSnapshot.timestamp,
      value: metricsSnapshot.throughput
    });

    this.metrics.errorRate.push({
      timestamp: metricsSnapshot.timestamp,
      value: metricsSnapshot.errorRate
    });

    this.metrics.availability.push({
      timestamp: metricsSnapshot.timestamp,
      value: metricsSnapshot.availability
    });

    // Clean old metrics beyond retention period
    this.cleanOldMetrics();
  }

  /**
   * Clean metrics older than retention period
   */
  cleanOldMetrics() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    ['responseTime', 'throughput', 'errorRate', 'availability'].forEach(metricType => {
      this.metrics[metricType] = this.metrics[metricType].filter(
        metric => metric.timestamp > cutoffTime
      );
    });

    // Clean old alerts
    this.metrics.alerts = this.metrics.alerts.filter(
      alert => alert.timestamp > cutoffTime
    );
  }

  /**
   * Check for performance alerts
   */
  async checkAlerts(metricsSnapshot) {
    const alerts = [];

    // Response time alert
    if (metricsSnapshot.responseTime.mean > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'responseTime',
        severity: 'warning',
        message: `High response time: ${metricsSnapshot.responseTime.mean.toFixed(2)}ms (threshold: ${this.config.alertThresholds.responseTime}ms)`,
        value: metricsSnapshot.responseTime.mean,
        threshold: this.config.alertThresholds.responseTime,
        timestamp: Date.now()
      });
    }

    // Error rate alert
    if (metricsSnapshot.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'errorRate',
        severity: 'error',
        message: `High error rate: ${metricsSnapshot.errorRate.toFixed(1)}% (threshold: ${this.config.alertThresholds.errorRate}%)`,
        value: metricsSnapshot.errorRate,
        threshold: this.config.alertThresholds.errorRate,
        timestamp: Date.now()
      });
    }

    // Throughput alert
    if (metricsSnapshot.throughput < this.config.alertThresholds.throughput) {
      alerts.push({
        type: 'throughput',
        severity: 'warning',
        message: `Low throughput: ${metricsSnapshot.throughput.toFixed(2)} RPS (threshold: ${this.config.alertThresholds.throughput} RPS)`,
        value: metricsSnapshot.throughput,
        threshold: this.config.alertThresholds.throughput,
        timestamp: Date.now()
      });
    }

    // Availability alert
    if (metricsSnapshot.availability < this.config.alertThresholds.availability) {
      alerts.push({
        type: 'availability',
        severity: 'critical',
        message: `Low availability: ${metricsSnapshot.availability.toFixed(1)}% (threshold: ${this.config.alertThresholds.availability}%)`,
        value: metricsSnapshot.availability,
        threshold: this.config.alertThresholds.availability,
        timestamp: Date.now()
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Process performance alert
   */
  async processAlert(alert) {
    // Add to alerts metrics
    this.metrics.alerts.push(alert);

    // Log alert
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // Emit alert event
    this.emit('alert', alert);

    // Save alert to file
    await this.saveAlert(alert);
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        rss: usage.rss,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  /**
   * Log current metrics
   */
  logMetrics(metrics) {
    const timestamp = new Date(metrics.timestamp).toISOString();
    console.log(`📊 [${timestamp}] RT: ${metrics.responseTime.mean?.toFixed(2) || 0}ms | ` +
      `TP: ${metrics.throughput.toFixed(1)} RPS | ` +
      `ER: ${metrics.errorRate.toFixed(1)}% | ` +
      `AV: ${metrics.availability.toFixed(1)}%`);
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary() {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour

    const recentResponseTime = this.metrics.responseTime.filter(m => m.timestamp > oneHourAgo);
    const recentThroughput = this.metrics.throughput.filter(m => m.timestamp > oneHourAgo);
    const recentErrorRate = this.metrics.errorRate.filter(m => m.timestamp > oneHourAgo);
    const recentAvailability = this.metrics.availability.filter(m => m.timestamp > oneHourAgo);
    const recentAlerts = this.metrics.alerts.filter(a => a.timestamp > oneHourAgo);

    return {
      period: 'last 1 hour',
      responseTime: {
        current: recentResponseTime.length > 0 ? recentResponseTime[recentResponseTime.length - 1].mean : 0,
        average: recentResponseTime.length > 0
          ? recentResponseTime.reduce((sum, m) => sum + m.mean, 0) / recentResponseTime.length
          : 0,
        samples: recentResponseTime.length
      },
      throughput: {
        current: recentThroughput.length > 0 ? recentThroughput[recentThroughput.length - 1].value : 0,
        average: recentThroughput.length > 0
          ? recentThroughput.reduce((sum, m) => sum + m.value, 0) / recentThroughput.length
          : 0,
        samples: recentThroughput.length
      },
      errorRate: {
        current: recentErrorRate.length > 0 ? recentErrorRate[recentErrorRate.length - 1].value : 0,
        average: recentErrorRate.length > 0
          ? recentErrorRate.reduce((sum, m) => sum + m.value, 0) / recentErrorRate.length
          : 0,
        samples: recentErrorRate.length
      },
      availability: {
        current: recentAvailability.length > 0 ? recentAvailability[recentAvailability.length - 1].value : 0,
        average: recentAvailability.length > 0
          ? recentAvailability.reduce((sum, m) => sum + m.value, 0) / recentAvailability.length
          : 0,
        samples: recentAvailability.length
      },
      alerts: {
        total: recentAlerts.length,
        critical: recentAlerts.filter(a => a.severity === 'critical').length,
        errors: recentAlerts.filter(a => a.severity === 'error').length,
        warnings: recentAlerts.filter(a => a.severity === 'warning').length
      },
      isMonitoring: this.isMonitoring,
      timestamp: now
    };
  }

  /**
   * Load metrics from file
   */
  async loadMetrics() {
    try {
      const metricsContent = await fs.readFile(this.config.metricsFile, 'utf8');
      const savedMetrics = JSON.parse(metricsContent);

      // Merge saved metrics
      Object.keys(savedMetrics).forEach(key => {
        if (this.metrics[key] && Array.isArray(savedMetrics[key])) {
          this.metrics[key] = savedMetrics[key];
        }
      });

      console.log(`📊 Loaded ${this.getTotalMetricsCount()} saved metrics`);

    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('⚠️  Failed to load metrics:', error.message);
      }
    }
  }

  /**
   * Save metrics to file
   */
  async saveMetrics() {
    try {
      await fs.writeFile(
        this.config.metricsFile,
        JSON.stringify(this.metrics, null, 2)
      );

      console.log(`💾 Saved ${this.getTotalMetricsCount()} metrics to ${this.config.metricsFile}`);

    } catch (error) {
      console.error('❌ Failed to save metrics:', error.message);
    }
  }

  /**
   * Save alert to file
   */
  async saveAlert(alert) {
    try {
      let alerts = [];

      try {
        const alertsContent = await fs.readFile(this.config.alertsFile, 'utf8');
        alerts = JSON.parse(alertsContent);
      } catch (error) {
        // File doesn't exist, start with empty array
      }

      alerts.push(alert);

      // Keep only recent alerts
      const cutoffTime = Date.now() - this.config.retentionPeriod;
      alerts = alerts.filter(a => a.timestamp > cutoffTime);

      await fs.writeFile(
        this.config.alertsFile,
        JSON.stringify(alerts, null, 2)
      );

    } catch (error) {
      console.error('❌ Failed to save alert:', error.message);
    }
  }

  /**
   * Get total metrics count
   */
  getTotalMetricsCount() {
    return Object.values(this.metrics).reduce((sum, metrics) => {
      return sum + (Array.isArray(metrics) ? metrics.length : 0);
    }, 0);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.stopMonitoring();

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    this.removeAllListeners();
  }
}

module.exports = PerformanceMonitor;