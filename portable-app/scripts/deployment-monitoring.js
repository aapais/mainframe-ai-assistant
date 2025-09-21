#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Deployment Monitoring and Metrics System
 * Comprehensive monitoring for deployment processes and package integrity
 */
class DeploymentMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      metricsRetention: options.metricsRetention || 30 * 24 * 60 * 60 * 1000, // 30 days
      alertThresholds: {
        errorRate: options.errorRate || 5, // 5%
        performanceDegradation: options.performanceDegradation || 20, // 20%
        ...options.alertThresholds
      },
      monitoringInterval: options.monitoringInterval || 60000, // 1 minute
      reportingInterval: options.reportingInterval || 3600000, // 1 hour
      ...options
    };

    this.metrics = new Map();
    this.deployments = new Map();
    this.alerts = [];
    this.healthStatus = 'healthy';

    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring system
   */
  initializeMonitoring() {
    console.log('🚀 Initializing deployment monitoring system...');

    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.options.monitoringInterval);

    // Start periodic reporting
    this.reportingInterval = setInterval(() => {
      this.generatePeriodicReport();
    }, this.options.reportingInterval);

    // Setup metric cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 24 * 60 * 60 * 1000); // Daily cleanup

    console.log('✅ Deployment monitoring system initialized');
  }

  /**
   * Track deployment start
   */
  async trackDeploymentStart(deploymentConfig) {
    const deploymentId = this.generateDeploymentId();
    const deployment = {
      id: deploymentId,
      config: deploymentConfig,
      startTime: Date.now(),
      phase: 'starting',
      status: 'in-progress',
      metrics: {
        downloadTime: null,
        installTime: null,
        verificationTime: null,
        totalTime: null,
        errors: [],
        warnings: []
      },
      resources: {
        memoryUsage: [],
        cpuUsage: [],
        diskUsage: [],
        networkUsage: []
      }
    };

    this.deployments.set(deploymentId, deployment);
    this.emit('deployment-started', deployment);

    console.log(`📦 Tracking deployment: ${deploymentId}`);
    return deploymentId;
  }

  /**
   * Update deployment phase
   */
  async updateDeploymentPhase(deploymentId, phase, data = {}) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      console.warn(`Deployment ${deploymentId} not found`);
      return;
    }

    const previousPhase = deployment.phase;
    deployment.phase = phase;
    deployment.lastUpdate = Date.now();

    // Record phase transition time
    const phaseStartTime = deployment[`${previousPhase}StartTime`] || deployment.startTime;
    const phaseDuration = Date.now() - phaseStartTime;
    deployment.metrics[`${previousPhase}Time`] = phaseDuration;

    deployment[`${phase}StartTime`] = Date.now();

    // Add any additional data
    Object.assign(deployment, data);

    this.emit('deployment-phase-changed', {
      deploymentId,
      previousPhase,
      currentPhase: phase,
      duration: phaseDuration
    });

    console.log(`📊 Deployment ${deploymentId}: ${previousPhase} → ${phase} (${phaseDuration}ms)`);
  }

  /**
   * Record deployment completion
   */
  async recordDeploymentCompletion(deploymentId, result) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      console.warn(`Deployment ${deploymentId} not found`);
      return;
    }

    deployment.endTime = Date.now();
    deployment.totalTime = deployment.endTime - deployment.startTime;
    deployment.status = result.success ? 'completed' : 'failed';
    deployment.result = result;

    // Record final metrics
    this.recordDeploymentMetrics(deployment);

    this.emit('deployment-completed', {
      deploymentId,
      success: result.success,
      duration: deployment.totalTime,
      deployment
    });

    console.log(`✅ Deployment ${deploymentId} completed: ${deployment.status} (${deployment.totalTime}ms)`);

    // Generate completion report
    const report = await this.generateDeploymentReport(deploymentId);
    return report;
  }

  /**
   * Record deployment error
   */
  async recordDeploymentError(deploymentId, error) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      console.warn(`Deployment ${deploymentId} not found`);
      return;
    }

    deployment.metrics.errors.push({
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
      phase: deployment.phase
    });

    this.emit('deployment-error', {
      deploymentId,
      error,
      phase: deployment.phase
    });

    console.error(`❌ Deployment ${deploymentId} error in ${deployment.phase}: ${error.message}`);

    // Check if error rate threshold is exceeded
    await this.checkErrorRateThreshold();
  }

  /**
   * Monitor resource usage during deployment
   */
  async monitorResourceUsage(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment || deployment.status !== 'in-progress') {
      return;
    }

    const resourceSnapshot = await this.captureResourceSnapshot();
    deployment.resources.memoryUsage.push(resourceSnapshot.memory);
    deployment.resources.cpuUsage.push(resourceSnapshot.cpu);
    deployment.resources.diskUsage.push(resourceSnapshot.disk);
    deployment.resources.networkUsage.push(resourceSnapshot.network);

    // Check for resource alerts
    await this.checkResourceAlerts(deploymentId, resourceSnapshot);
  }

  /**
   * Capture current resource usage snapshot
   */
  async captureResourceSnapshot() {
    const timestamp = Date.now();

    return {
      timestamp,
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: require('os').loadavg()
      },
      disk: await this.getDiskUsage(),
      network: await this.getNetworkUsage()
    };
  }

  /**
   * Generate deployment report
   */
  async generateDeploymentReport(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const report = {
      deploymentId,
      summary: {
        status: deployment.status,
        startTime: new Date(deployment.startTime).toISOString(),
        endTime: deployment.endTime ? new Date(deployment.endTime).toISOString() : null,
        totalDuration: deployment.totalTime,
        currentPhase: deployment.phase
      },
      performance: {
        downloadTime: deployment.metrics.downloadTime,
        installTime: deployment.metrics.installTime,
        verificationTime: deployment.metrics.verificationTime,
        totalTime: deployment.metrics.totalTime
      },
      quality: {
        errorCount: deployment.metrics.errors.length,
        warningCount: deployment.metrics.warnings.length,
        errors: deployment.metrics.errors,
        warnings: deployment.metrics.warnings
      },
      resources: this.analyzeResourceUsage(deployment.resources),
      recommendations: await this.generateRecommendations(deployment)
    };

    return report;
  }

  /**
   * Generate system health report
   */
  async generateHealthReport() {
    const report = {
      timestamp: new Date().toISOString(),
      systemHealth: this.healthStatus,
      deploymentStats: await this.getDeploymentStatistics(),
      performance: await this.getPerformanceMetrics(),
      alerts: this.getActiveAlerts(),
      trends: await this.getPerformanceTrends(),
      recommendations: await this.getSystemRecommendations()
    };

    return report;
  }

  /**
   * Get deployment statistics
   */
  async getDeploymentStatistics() {
    const allDeployments = Array.from(this.deployments.values());
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recentDeployments = allDeployments.filter(d => d.startTime > last24Hours);

    const stats = {
      total: allDeployments.length,
      recent: recentDeployments.length,
      successful: recentDeployments.filter(d => d.status === 'completed').length,
      failed: recentDeployments.filter(d => d.status === 'failed').length,
      inProgress: recentDeployments.filter(d => d.status === 'in-progress').length,
      averageDuration: this.calculateAverageDuration(recentDeployments),
      successRate: recentDeployments.length > 0 ?
        (recentDeployments.filter(d => d.status === 'completed').length / recentDeployments.length) * 100 : 0
    };

    return stats;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    const allDeployments = Array.from(this.deployments.values());
    const completedDeployments = allDeployments.filter(d => d.status === 'completed');

    if (completedDeployments.length === 0) {
      return {
        averageDownloadTime: 0,
        averageInstallTime: 0,
        averageVerificationTime: 0,
        averageTotalTime: 0,
        performanceTrend: 'stable'
      };
    }

    const metrics = {
      averageDownloadTime: this.calculateAverage(completedDeployments, 'downloadTime'),
      averageInstallTime: this.calculateAverage(completedDeployments, 'installTime'),
      averageVerificationTime: this.calculateAverage(completedDeployments, 'verificationTime'),
      averageTotalTime: this.calculateAverage(completedDeployments, 'totalTime'),
      performanceTrend: await this.calculatePerformanceTrend(completedDeployments)
    };

    return metrics;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    const activeAlerts = this.alerts.filter(alert =>
      alert.status === 'active' &&
      Date.now() - alert.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    return activeAlerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: new Date(alert.timestamp).toISOString(),
      acknowledged: alert.acknowledged
    }));
  }

  /**
   * Performance health check
   */
  async performHealthCheck() {
    const stats = await this.getDeploymentStatistics();
    const performance = await this.getPerformanceMetrics();

    // Check error rate
    if (stats.successRate < (100 - this.options.alertThresholds.errorRate)) {
      await this.createAlert('error-rate', 'high',
        `Deployment success rate (${stats.successRate.toFixed(1)}%) below threshold`);
    }

    // Check performance degradation
    const baseline = await this.getPerformanceBaseline();
    if (baseline && performance.averageTotalTime > baseline.averageTotalTime * (1 + this.options.alertThresholds.performanceDegradation / 100)) {
      await this.createAlert('performance-degradation', 'medium',
        `Deployment performance degraded by ${((performance.averageTotalTime / baseline.averageTotalTime - 1) * 100).toFixed(1)}%`);
    }

    // Update overall health status
    this.updateHealthStatus();
  }

  /**
   * Create alert
   */
  async createAlert(type, severity, message) {
    const alert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      timestamp: Date.now(),
      status: 'active',
      acknowledged: false
    };

    this.alerts.push(alert);
    this.emit('alert-created', alert);

    console.warn(`🚨 Alert [${severity.toUpperCase()}]: ${message}`);

    return alert.id;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      this.emit('alert-acknowledged', alert);
      console.log(`✅ Alert ${alertId} acknowledged`);
    }
  }

  /**
   * Update health status
   */
  updateHealthStatus() {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
    const highAlerts = activeAlerts.filter(a => a.severity === 'high').length;
    const mediumAlerts = activeAlerts.filter(a => a.severity === 'medium').length;

    let newStatus;
    if (criticalAlerts > 0) {
      newStatus = 'critical';
    } else if (highAlerts > 2) {
      newStatus = 'degraded';
    } else if (highAlerts > 0 || mediumAlerts > 3) {
      newStatus = 'warning';
    } else {
      newStatus = 'healthy';
    }

    if (newStatus !== this.healthStatus) {
      const previousStatus = this.healthStatus;
      this.healthStatus = newStatus;
      this.emit('health-status-changed', {
        previousStatus,
        currentStatus: newStatus,
        activeAlerts: activeAlerts.length
      });
      console.log(`🏥 Health status: ${previousStatus} → ${newStatus}`);
    }
  }

  /**
   * Export metrics for external monitoring
   */
  async exportMetrics(format = 'json') {
    const metrics = {
      timestamp: new Date().toISOString(),
      deployments: await this.getDeploymentStatistics(),
      performance: await this.getPerformanceMetrics(),
      health: {
        status: this.healthStatus,
        alerts: this.getActiveAlerts().length
      },
      system: await this.captureResourceSnapshot()
    };

    switch (format) {
      case 'prometheus':
        return this.formatPrometheusMetrics(metrics);
      case 'json':
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }

  /**
   * Start monitoring deployment
   */
  async startMonitoring(deploymentId) {
    const monitoringInterval = setInterval(async () => {
      await this.monitorResourceUsage(deploymentId);
    }, 5000); // Monitor every 5 seconds

    // Store interval for cleanup
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      deployment.monitoringInterval = monitoringInterval;
    }

    return monitoringInterval;
  }

  /**
   * Stop monitoring deployment
   */
  async stopMonitoring(deploymentId) {
    const deployment = this.deployments.get(deploymentId);
    if (deployment && deployment.monitoringInterval) {
      clearInterval(deployment.monitoringInterval);
      delete deployment.monitoringInterval;
      console.log(`🛑 Stopped monitoring deployment: ${deploymentId}`);
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    console.log('🔄 Shutting down deployment monitoring...');

    // Clear all intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.reportingInterval) clearInterval(this.reportingInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Stop monitoring all active deployments
    for (const [deploymentId] of this.deployments) {
      await this.stopMonitoring(deploymentId);
    }

    // Generate final report
    const finalReport = await this.generateHealthReport();

    console.log('✅ Deployment monitoring shutdown complete');
    return finalReport;
  }

  // Helper methods
  generateDeploymentId() {
    return `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAlertId() {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  recordDeploymentMetrics(deployment) {
    const metricKey = `deployment-${Date.now()}`;
    this.metrics.set(metricKey, {
      timestamp: Date.now(),
      deploymentId: deployment.id,
      duration: deployment.totalTime,
      success: deployment.status === 'completed',
      phase: deployment.phase,
      errors: deployment.metrics.errors.length,
      warnings: deployment.metrics.warnings.length
    });
  }

  calculateAverageDuration(deployments) {
    const completed = deployments.filter(d => d.totalTime);
    if (completed.length === 0) return 0;

    const total = completed.reduce((sum, d) => sum + d.totalTime, 0);
    return Math.round(total / completed.length);
  }

  calculateAverage(deployments, metric) {
    const values = deployments
      .map(d => d.metrics[metric])
      .filter(v => v !== null && v !== undefined);

    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  }

  async calculatePerformanceTrend(deployments) {
    // Simple trend calculation based on last 10 vs previous 10 deployments
    if (deployments.length < 20) return 'insufficient-data';

    const recent = deployments.slice(-10);
    const previous = deployments.slice(-20, -10);

    const recentAvg = this.calculateAverage(recent, 'totalTime');
    const previousAvg = this.calculateAverage(previous, 'totalTime');

    const change = (recentAvg - previousAvg) / previousAvg;

    if (change > 0.1) return 'declining';
    if (change < -0.1) return 'improving';
    return 'stable';
  }

  async getDiskUsage() {
    // Mock disk usage - in production, use actual system calls
    return {
      used: Math.random() * 1000000000, // Random bytes
      total: 1000000000,
      available: Math.random() * 500000000
    };
  }

  async getNetworkUsage() {
    // Mock network usage - in production, use actual system calls
    return {
      bytesReceived: Math.random() * 1000000,
      bytesSent: Math.random() * 1000000,
      packetsReceived: Math.random() * 1000,
      packetsSent: Math.random() * 1000
    };
  }

  analyzeResourceUsage(resources) {
    const analysis = {
      memory: {
        peak: Math.max(...resources.memoryUsage.map(m => m.used)),
        average: resources.memoryUsage.reduce((sum, m) => sum + m.used, 0) / resources.memoryUsage.length
      },
      cpu: {
        peak: Math.max(...resources.cpuUsage.map(c => c.loadAverage[0])),
        average: resources.cpuUsage.reduce((sum, c) => sum + c.loadAverage[0], 0) / resources.cpuUsage.length
      }
    };

    return analysis;
  }

  async generateRecommendations(deployment) {
    const recommendations = [];

    if (deployment.metrics.errors.length > 0) {
      recommendations.push('Review and address deployment errors before next release');
    }

    if (deployment.totalTime > 300000) { // 5 minutes
      recommendations.push('Consider optimizing deployment process to reduce installation time');
    }

    const resourceAnalysis = this.analyzeResourceUsage(deployment.resources);
    if (resourceAnalysis.memory.peak > 500000000) { // 500MB
      recommendations.push('Monitor memory usage during deployment - peak usage was high');
    }

    return recommendations;
  }

  async getPerformanceBaseline() {
    // Return cached baseline or calculate from historical data
    const allDeployments = Array.from(this.deployments.values());
    const historicalDeployments = allDeployments.filter(d =>
      d.status === 'completed' &&
      Date.now() - d.endTime > 7 * 24 * 60 * 60 * 1000 // Older than 7 days
    );

    if (historicalDeployments.length < 10) return null;

    return {
      averageTotalTime: this.calculateAverage(historicalDeployments, 'totalTime'),
      averageDownloadTime: this.calculateAverage(historicalDeployments, 'downloadTime'),
      averageInstallTime: this.calculateAverage(historicalDeployments, 'installTime')
    };
  }

  async checkResourceAlerts(deploymentId, resourceSnapshot) {
    // Check memory usage
    if (resourceSnapshot.memory.used > 1000000000) { // 1GB
      await this.createAlert('high-memory-usage', 'medium',
        `High memory usage during deployment ${deploymentId}: ${Math.round(resourceSnapshot.memory.used / 1024 / 1024)}MB`);
    }

    // Check CPU usage
    if (resourceSnapshot.cpu.loadAverage[0] > 0.8) {
      await this.createAlert('high-cpu-usage', 'medium',
        `High CPU load during deployment ${deploymentId}: ${resourceSnapshot.cpu.loadAverage[0].toFixed(2)}`);
    }
  }

  async checkErrorRateThreshold() {
    const stats = await this.getDeploymentStatistics();
    if (stats.recent > 0 && stats.successRate < (100 - this.options.alertThresholds.errorRate)) {
      await this.createAlert('error-rate-threshold', 'high',
        `Deployment error rate (${(100 - stats.successRate).toFixed(1)}%) exceeds threshold (${this.options.alertThresholds.errorRate}%)`);
    }
  }

  generatePeriodicReport() {
    this.generateHealthReport().then(report => {
      this.emit('periodic-report', report);
      console.log(`📈 Periodic health report generated - Status: ${report.systemHealth}`);
    }).catch(error => {
      console.error('Failed to generate periodic report:', error);
    });
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - this.options.metricsRetention;
    let cleanedCount = 0;

    for (const [key, metric] of this.metrics) {
      if (metric.timestamp < cutoff) {
        this.metrics.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old metrics`);
    }
  }

  formatPrometheusMetrics(metrics) {
    return `
# HELP deployment_total Total number of deployments
# TYPE deployment_total counter
deployment_total ${metrics.deployments.total}

# HELP deployment_success_rate Deployment success rate percentage
# TYPE deployment_success_rate gauge
deployment_success_rate ${metrics.deployments.successRate}

# HELP deployment_duration_seconds Average deployment duration in seconds
# TYPE deployment_duration_seconds gauge
deployment_duration_seconds ${metrics.performance.averageTotalTime / 1000}

# HELP system_health_status System health status (0=critical, 1=degraded, 2=warning, 3=healthy)
# TYPE system_health_status gauge
system_health_status ${this.healthStatusToNumber(metrics.health.status)}
    `.trim();
  }

  healthStatusToNumber(status) {
    const statusMap = {
      'critical': 0,
      'degraded': 1,
      'warning': 2,
      'healthy': 3
    };
    return statusMap[status] || 0;
  }

  async getPerformanceTrends() {
    const allDeployments = Array.from(this.deployments.values());
    const completedDeployments = allDeployments.filter(d => d.status === 'completed');

    return {
      deploymentFrequency: await this.calculateDeploymentFrequency(completedDeployments),
      performanceTrend: await this.calculatePerformanceTrend(completedDeployments),
      errorTrend: await this.calculateErrorTrend(completedDeployments)
    };
  }

  async calculateDeploymentFrequency(deployments) {
    const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentDeployments = deployments.filter(d => d.startTime > last30Days);
    return {
      deploymentsPerDay: recentDeployments.length / 30,
      totalLastMonth: recentDeployments.length
    };
  }

  async calculateErrorTrend(deployments) {
    if (deployments.length < 20) return 'insufficient-data';

    const recent = deployments.slice(-10);
    const previous = deployments.slice(-20, -10);

    const recentErrorRate = recent.filter(d => d.status === 'failed').length / recent.length;
    const previousErrorRate = previous.filter(d => d.status === 'failed').length / previous.length;

    if (recentErrorRate > previousErrorRate * 1.2) return 'increasing';
    if (recentErrorRate < previousErrorRate * 0.8) return 'decreasing';
    return 'stable';
  }

  async getSystemRecommendations() {
    const recommendations = [];
    const stats = await this.getDeploymentStatistics();
    const activeAlerts = this.getActiveAlerts();

    if (stats.successRate < 95) {
      recommendations.push('Investigate deployment failures to improve success rate');
    }

    if (activeAlerts.length > 5) {
      recommendations.push('Review and address active alerts to improve system health');
    }

    if (stats.averageDuration > 300000) {
      recommendations.push('Consider optimizing deployment process to reduce average duration');
    }

    return recommendations;
  }
}

// Export for testing
module.exports = { DeploymentMonitor };

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'start':
      startMonitoringFromCLI(args.slice(1));
      break;
    case 'status':
      getStatusFromCLI(args.slice(1));
      break;
    case 'report':
      generateReportFromCLI(args.slice(1));
      break;
    default:
      console.log(`
Deployment Monitoring System v1.0.0

Usage: node deployment-monitoring.js <command> [options]

Commands:
  start                            Start monitoring system
  status                           Get current system status
  report                           Generate monitoring report

Examples:
  node deployment-monitoring.js start
  node deployment-monitoring.js status
  node deployment-monitoring.js report --format json

Options:
  --format <format>                Report format (json|prometheus)
  --help                          Show this help message
      `);
  }
}

async function startMonitoringFromCLI(args) {
  console.log('🚀 Starting deployment monitoring system...');

  const monitor = new DeploymentMonitor();

  // Setup graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down monitoring system...');
    await monitor.shutdown();
    process.exit(0);
  });

  monitor.on('alert-created', (alert) => {
    console.log(`🚨 Alert: [${alert.severity.toUpperCase()}] ${alert.message}`);
  });

  monitor.on('deployment-completed', (event) => {
    console.log(`✅ Deployment ${event.deploymentId} ${event.success ? 'completed' : 'failed'} in ${event.duration}ms`);
  });

  console.log('✅ Monitoring system started. Press Ctrl+C to stop.');

  // Keep process running
  process.stdin.resume();
}