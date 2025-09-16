/**
 * Baseline Comparator
 * Manages performance baselines and comparison logic
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

class BaselineComparator {
  constructor(config = {}) {
    this.config = {
      baselineDir: config.baselineDir || './baselines',
      retentionDays: config.retentionDays || 30,
      minSampleSize: config.minSampleSize || 5,
      confidenceLevel: config.confidenceLevel || 0.95,
      ...config
    };
    
    this.baselines = new Map();
    this.baselineMetadata = new Map();
  }

  /**
   * Load all existing baselines
   */
  async loadBaselines() {
    try {
      await fs.mkdir(this.config.baselineDir, { recursive: true });
      
      const files = await fs.readdir(this.config.baselineDir);
      const baselineFiles = files.filter(file => file.endsWith('.baseline.json'));
      
      for (const file of baselineFiles) {
        await this.loadSingleBaseline(file);
      }
      
      console.log(`Loaded ${this.baselines.size} performance baselines`);
    } catch (error) {
      console.warn('Failed to load baselines:', error.message);
    }
  }

  /**
   * Load single baseline file
   */
  async loadSingleBaseline(filename) {
    try {
      const filePath = path.join(this.config.baselineDir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      const baseline = JSON.parse(content);
      
      // Validate baseline structure
      if (this.validateBaseline(baseline)) {
        const key = this.getBaselineKey(baseline.environment, baseline.testSuite);
        this.baselines.set(key, baseline);
        this.baselineMetadata.set(key, {
          filename,
          lastModified: (await fs.stat(filePath)).mtime,
          checksum: this.calculateChecksum(content)
        });
      }
    } catch (error) {
      console.warn(`Failed to load baseline ${filename}:`, error.message);
    }
  }

  /**
   * Get baseline for specific environment and test suite
   */
  async getBaseline(environment, testSuite) {
    const key = this.getBaselineKey(environment, testSuite);
    const baseline = this.baselines.get(key);
    
    if (!baseline) {
      return null;
    }
    
    // Check if baseline is still valid (not too old)
    const age = Date.now() - new Date(baseline.lastUpdated).getTime();
    const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;
    
    if (age > maxAge) {
      console.warn(`Baseline for ${environment}/${testSuite} is older than ${this.config.retentionDays} days`);
      return null;
    }
    
    return baseline;
  }

  /**
   * Update baselines with new test results
   */
  async updateBaselines(results) {
    const updates = [];
    
    for (const [environment, envResults] of results) {
      for (const [suiteName, suiteResult] of envResults) {
        if (suiteResult.error || !suiteResult.statistics) {
          continue;
        }
        
        const baseline = await this.updateSingleBaseline(
          environment,
          suiteName,
          suiteResult
        );
        
        if (baseline) {
          updates.push({ environment, suiteName, baseline });
        }
      }
    }
    
    // Save all updated baselines
    await Promise.all(updates.map(update => this.saveBaseline(update.baseline)));
    
    return updates;
  }

  /**
   * Update single baseline with new data
   */
  async updateSingleBaseline(environment, testSuite, newResult) {
    const key = this.getBaselineKey(environment, testSuite);
    const existingBaseline = this.baselines.get(key);
    
    let baseline;
    
    if (existingBaseline) {
      // Update existing baseline with rolling average
      baseline = await this.mergeWithExistingBaseline(existingBaseline, newResult);
    } else {
      // Create new baseline
      baseline = this.createNewBaseline(environment, testSuite, newResult);
    }
    
    this.baselines.set(key, baseline);
    return baseline;
  }

  /**
   * Merge new result with existing baseline using statistical methods
   */
  async mergeWithExistingBaseline(existing, newResult) {
    const newStats = newResult.statistics;
    const existingStats = existing.statistics;
    
    // Update sample size
    const newSampleSize = existing.sampleSize + newResult.measurements.length;
    const oldWeight = existing.sampleSize / newSampleSize;
    const newWeight = newResult.measurements.length / newSampleSize;
    
    // Calculate weighted averages
    const mergedStats = {
      duration: {
        mean: this.weightedAverage(existingStats.duration.mean, newStats.duration.mean, oldWeight, newWeight),
        median: this.weightedAverage(existingStats.duration.median, newStats.duration.median, oldWeight, newWeight),
        min: Math.min(existingStats.duration.min, newStats.duration.min),
        max: Math.max(existingStats.duration.max, newStats.duration.max),
        stdDev: this.mergeStandardDeviations(
          existingStats.duration.stdDev,
          newStats.duration.stdDev,
          existing.sampleSize,
          newResult.measurements.length
        ),
        p95: this.weightedAverage(existingStats.duration.p95, newStats.duration.p95, oldWeight, newWeight),
        p99: this.weightedAverage(existingStats.duration.p99, newStats.duration.p99, oldWeight, newWeight)
      },
      memory: {
        heap: {
          mean: this.weightedAverage(existingStats.memory.heap.mean, newStats.memory.heap.mean, oldWeight, newWeight),
          median: this.weightedAverage(existingStats.memory.heap.median, newStats.memory.heap.median, oldWeight, newWeight),
          min: Math.min(existingStats.memory.heap.min, newStats.memory.heap.min),
          max: Math.max(existingStats.memory.heap.max, newStats.memory.heap.max)
        }
      },
      successRate: this.weightedAverage(existingStats.successRate, newStats.successRate, oldWeight, newWeight),
      errorRate: this.weightedAverage(existingStats.errorRate, newStats.errorRate, oldWeight, newWeight)
    };
    
    return {
      ...existing,
      statistics: mergedStats,
      sampleSize: newSampleSize,
      lastUpdated: new Date().toISOString(),
      updateHistory: [
        ...existing.updateHistory.slice(-9), // Keep last 10 updates
        {
          timestamp: new Date().toISOString(),
          newSamples: newResult.measurements.length,
          totalSamples: newSampleSize
        }
      ]
    };
  }

  /**
   * Create new baseline from first result
   */
  createNewBaseline(environment, testSuite, result) {
    return {
      environment,
      testSuite,
      statistics: result.statistics,
      sampleSize: result.measurements.length,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
      updateHistory: [{
        timestamp: new Date().toISOString(),
        newSamples: result.measurements.length,
        totalSamples: result.measurements.length
      }],
      metadata: {
        ...result.metadata,
        baselineCreationReason: 'first_run'
      }
    };
  }

  /**
   * Save baseline to file
   */
  async saveBaseline(baseline) {
    const filename = `${baseline.environment}-${baseline.testSuite}.baseline.json`;
    const filePath = path.join(this.config.baselineDir, filename);
    
    const content = JSON.stringify(baseline, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
    
    // Update metadata
    const key = this.getBaselineKey(baseline.environment, baseline.testSuite);
    this.baselineMetadata.set(key, {
      filename,
      lastModified: new Date(),
      checksum: this.calculateChecksum(content)
    });
  }

  /**
   * Compare current result with baseline
   */
  compareWithBaseline(baseline, currentResult) {
    if (!baseline || !currentResult.statistics) {
      return {
        hasBaseline: false,
        comparison: null
      };
    }
    
    const baseStats = baseline.statistics;
    const currentStats = currentResult.statistics;
    
    const comparison = {
      duration: {
        meanChange: this.calculatePercentageChange(baseStats.duration.mean, currentStats.duration.mean),
        medianChange: this.calculatePercentageChange(baseStats.duration.median, currentStats.duration.median),
        p95Change: this.calculatePercentageChange(baseStats.duration.p95, currentStats.duration.p95),
        p99Change: this.calculatePercentageChange(baseStats.duration.p99, currentStats.duration.p99),
        variabilityChange: this.calculatePercentageChange(baseStats.duration.stdDev, currentStats.duration.stdDev)
      },
      memory: {
        heapChange: this.calculatePercentageChange(baseStats.memory.heap.mean, currentStats.memory.heap.mean)
      },
      reliability: {
        successRateChange: this.calculatePercentageChange(baseStats.successRate, currentStats.successRate),
        errorRateChange: this.calculatePercentageChange(baseStats.errorRate, currentStats.errorRate)
      },
      confidence: this.calculateConfidenceLevel(baseline, currentResult)
    };
    
    return {
      hasBaseline: true,
      baseline,
      comparison
    };
  }

  /**
   * Calculate statistical confidence level
   */
  calculateConfidenceLevel(baseline, currentResult) {
    const minSamples = Math.min(baseline.sampleSize, currentResult.measurements.length);
    
    if (minSamples < this.config.minSampleSize) {
      return {
        level: 'low',
        reason: `Sample size too small (${minSamples} < ${this.config.minSampleSize})`,
        score: minSamples / this.config.minSampleSize
      };
    }
    
    // Simple confidence calculation based on sample size and variability
    const baseVariability = baseline.statistics.duration.stdDev / baseline.statistics.duration.mean;
    const currentVariability = currentResult.statistics.duration.stdDev / currentResult.statistics.duration.mean;
    const avgVariability = (baseVariability + currentVariability) / 2;
    
    let confidenceScore = Math.min(1.0, minSamples / (this.config.minSampleSize * 2));
    confidenceScore *= Math.max(0.5, 1 - avgVariability); // Penalize high variability
    
    return {
      level: confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.6 ? 'medium' : 'low',
      score: confidenceScore,
      sampleSize: minSamples,
      variability: avgVariability
    };
  }

  /**
   * Validate baseline structure
   */
  validateBaseline(baseline) {
    const required = ['environment', 'testSuite', 'statistics', 'sampleSize', 'created', 'lastUpdated'];
    return required.every(field => baseline.hasOwnProperty(field));
  }

  /**
   * Utility methods
   */
  getBaselineKey(environment, testSuite) {
    return `${environment}:${testSuite}`;
  }

  calculatePercentageChange(baseline, current) {
    if (baseline === 0) return current === 0 ? 0 : Infinity;
    return ((current - baseline) / baseline) * 100;
  }

  weightedAverage(val1, val2, weight1, weight2) {
    return (val1 * weight1) + (val2 * weight2);
  }

  mergeStandardDeviations(stdDev1, stdDev2, n1, n2) {
    // Simplified merge of standard deviations
    const totalN = n1 + n2;
    const weight1 = n1 / totalN;
    const weight2 = n2 / totalN;
    return Math.sqrt((weight1 * stdDev1 * stdDev1) + (weight2 * stdDev2 * stdDev2));
  }

  calculateChecksum(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Get baseline statistics
   */
  getBaselineStats() {
    return {
      totalBaselines: this.baselines.size,
      baselinesByEnvironment: this.groupBaselinesByEnvironment(),
      averageAge: this.calculateAverageBaselineAge(),
      oldBaselines: this.getOldBaselines()
    };
  }

  groupBaselinesByEnvironment() {
    const groups = {};
    for (const [key, baseline] of this.baselines) {
      const env = baseline.environment;
      groups[env] = (groups[env] || 0) + 1;
    }
    return groups;
  }

  calculateAverageBaselineAge() {
    if (this.baselines.size === 0) return 0;
    
    const now = Date.now();
    const totalAge = Array.from(this.baselines.values())
      .reduce((sum, baseline) => {
        return sum + (now - new Date(baseline.lastUpdated).getTime());
      }, 0);
    
    return totalAge / this.baselines.size;
  }

  getOldBaselines() {
    const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    return Array.from(this.baselines.values())
      .filter(baseline => {
        const age = now - new Date(baseline.lastUpdated).getTime();
        return age > maxAge;
      })
      .map(baseline => ({
        environment: baseline.environment,
        testSuite: baseline.testSuite,
        age: now - new Date(baseline.lastUpdated).getTime()
      }));
  }

  /**
   * Cleanup old baselines
   */
  async cleanupOldBaselines() {
    const oldBaselines = this.getOldBaselines();
    
    for (const old of oldBaselines) {
      const key = this.getBaselineKey(old.environment, old.testSuite);
      const metadata = this.baselineMetadata.get(key);
      
      if (metadata) {
        const filePath = path.join(this.config.baselineDir, metadata.filename);
        try {
          await fs.unlink(filePath);
          this.baselines.delete(key);
          this.baselineMetadata.delete(key);
          console.log(`Cleaned up old baseline: ${metadata.filename}`);
        } catch (error) {
          console.warn(`Failed to cleanup baseline ${metadata.filename}:`, error.message);
        }
      }
    }
    
    return oldBaselines.length;
  }
}

module.exports = BaselineComparator;