/**
 * Test Metrics Utility
 * Collects and manages performance test metrics
 */

class TestMetrics {
  constructor() {
    this.runs = new Map();
    this.entries = [];
    this.startTime = null;
    this.currentRun = null;
  }

  /**
   * Start a new test run
   */
  startRun(runId) {
    this.currentRun = runId;
    this.startTime = Date.now();
    this.runs.set(runId, {
      id: runId,
      startTime: this.startTime,
      entries: [],
      metrics: {
        duration: 0,
        memoryUsage: [],
        cpuUsage: [],
        customMetrics: new Map()
      }
    });
  }

  /**
   * Record a performance entry
   */
  recordEntry(entry) {
    this.entries.push({
      ...entry,
      timestamp: Date.now(),
      runId: this.currentRun
    });
    
    if (this.currentRun && this.runs.has(this.currentRun)) {
      this.runs.get(this.currentRun).entries.push(entry);
    }
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name, value, metadata = {}) {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
      runId: this.currentRun
    };
    
    if (this.currentRun && this.runs.has(this.currentRun)) {
      const run = this.runs.get(this.currentRun);
      if (!run.metrics.customMetrics.has(name)) {
        run.metrics.customMetrics.set(name, []);
      }
      run.metrics.customMetrics.get(name).push(metric);
    }
    
    return metric;
  }

  /**
   * Get metrics for specific run
   */
  getRunMetrics(runId) {
    return this.runs.get(runId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    return {
      runs: Array.from(this.runs.values()),
      entries: this.entries,
      summary: this.generateSummary()
    };
  }

  /**
   * Generate metrics summary
   */
  generateSummary() {
    const totalRuns = this.runs.size;
    const totalEntries = this.entries.length;
    
    if (totalRuns === 0) {
      return {
        totalRuns: 0,
        totalEntries: 0,
        averageDuration: 0,
        totalDuration: 0
      };
    }
    
    const durations = Array.from(this.runs.values())
      .map(run => run.metrics.duration)
      .filter(d => d > 0);
    
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = durations.length > 0 ? totalDuration / durations.length : 0;
    
    return {
      totalRuns,
      totalEntries,
      averageDuration,
      totalDuration,
      successfulRuns: durations.length,
      failedRuns: totalRuns - durations.length
    };
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.runs.clear();
    this.entries = [];
    this.startTime = null;
    this.currentRun = null;
  }

  /**
   * Export metrics to JSON
   */
  exportToJson() {
    return JSON.stringify(this.getAllMetrics(), null, 2);
  }
}

module.exports = TestMetrics;