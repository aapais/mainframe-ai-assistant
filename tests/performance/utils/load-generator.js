/**
 * Load Generator Utility
 * Simulates realistic load patterns for performance testing
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');
const EventEmitter = require('events');
const path = require('path');

class LoadGenerator extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.activeTests = new Map();
    this.results = [];
  }

  async generateLoad(options) {
    const {
      userCount = 100,
      rampUpTime = 30000, // 30 seconds
      duration = 60000,   // 1 minute
      targetRPS = 50,
      scenario = 'search'
    } = options;

    const testId = `load-test-${Date.now()}`;
    const testConfig = {
      testId,
      userCount,
      rampUpTime,
      duration,
      targetRPS,
      scenario,
      startTime: performance.now()
    };

    this.activeTests.set(testId, testConfig);
    this.emit('testStarted', testConfig);

    try {
      const result = await this.executeLoadTest(testConfig);
      this.results.push(result);
      this.emit('testCompleted', result);
      return result;
    } catch (error) {
      this.emit('testError', { testId, error });
      throw error;
    } finally {
      this.activeTests.delete(testId);
    }
  }

  async executeLoadTest(config) {
    const { userCount, rampUpTime, duration, scenario } = config;
    
    // Calculate ramp-up schedule
    const rampUpSchedule = this.calculateRampUpSchedule(userCount, rampUpTime);
    
    const workers = [];
    const results = {
      testId: config.testId,
      config,
      userResults: [],
      aggregatedStats: null,
      errors: []
    };

    try {
      // Start workers according to ramp-up schedule
      for (const { delay, userId } of rampUpSchedule) {
        setTimeout(async () => {
          try {
            const worker = await this.createWorker({
              userId,
              scenario,
              duration: duration - delay, // Adjusted duration
              startDelay: delay
            });
            
            workers.push(worker);
            
            worker.on('message', (message) => {
              if (message.type === 'result') {
                results.userResults.push(message.data);
                this.emit('userCompleted', message.data);
              } else if (message.type === 'error') {
                results.errors.push(message.data);
                this.emit('userError', message.data);
              }
            });
            
          } catch (error) {
            results.errors.push({ userId, error: error.message });
          }
        }, delay);
      }

      // Wait for all workers to complete
      await new Promise(resolve => {
        const checkCompletion = () => {
          if (results.userResults.length + results.errors.length >= userCount) {
            resolve();
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        
        // Also resolve after maximum expected time
        setTimeout(resolve, duration + rampUpTime + 10000);
        checkCompletion();
      });

      // Calculate aggregated statistics
      results.aggregatedStats = this.calculateAggregatedStats(results.userResults);
      
      return results;
      
    } finally {
      // Cleanup workers
      workers.forEach(worker => {
        try {
          worker.terminate();
        } catch (e) {
          // Worker already terminated
        }
      });
    }
  }

  calculateRampUpSchedule(userCount, rampUpTime) {
    const schedule = [];
    const interval = rampUpTime / userCount;
    
    for (let i = 0; i < userCount; i++) {
      schedule.push({
        userId: i,
        delay: Math.floor(i * interval)
      });
    }
    
    return schedule;
  }

  async createWorker(config) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'load-worker.js'), {
        workerData: config
      });
      
      worker.on('online', () => resolve(worker));
      worker.on('error', reject);
    });
  }

  calculateAggregatedStats(userResults) {
    if (userResults.length === 0) {
      return {
        totalUsers: 0,
        totalRequests: 0,
        totalErrors: 0,
        errorRate: 0,
        averageResponseTime: 0,
        throughput: 0
      };
    }

    const allResponseTimes = [];
    let totalRequests = 0;
    let totalErrors = 0;
    let totalDuration = 0;

    userResults.forEach(result => {
      totalRequests += result.completedRequests;
      totalErrors += result.errors;
      totalDuration = Math.max(totalDuration, result.duration);
      allResponseTimes.push(...result.responseTimes);
    });

    allResponseTimes.sort((a, b) => a - b);

    return {
      totalUsers: userResults.length,
      totalRequests,
      totalErrors,
      errorRate: (totalErrors / totalRequests) * 100,
      averageResponseTime: allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length,
      p50: this.calculatePercentile(allResponseTimes, 50),
      p90: this.calculatePercentile(allResponseTimes, 90),
      p95: this.calculatePercentile(allResponseTimes, 95),
      p99: this.calculatePercentile(allResponseTimes, 99),
      minResponseTime: Math.min(...allResponseTimes),
      maxResponseTime: Math.max(...allResponseTimes),
      throughput: totalRequests / (totalDuration / 1000), // requests per second
      duration: totalDuration
    };
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[index] || 0;
  }

  async generateStressTest(options) {
    const {
      startUsers = 10,
      maxUsers = 500,
      stepSize = 50,
      stepDuration = 60000,
      scenario = 'search'
    } = options;

    const stressResults = [];
    
    for (let users = startUsers; users <= maxUsers; users += stepSize) {
      this.emit('stressStepStarted', { users, step: (users - startUsers) / stepSize + 1 });
      
      try {
        const result = await this.generateLoad({
          userCount: users,
          duration: stepDuration,
          rampUpTime: Math.min(stepDuration / 4, 10000), // 25% of duration or 10s max
          scenario
        });
        
        const stepResult = {
          userCount: users,
          success: result.aggregatedStats.errorRate < 5, // Less than 5% error rate
          errorRate: result.aggregatedStats.errorRate,
          averageResponseTime: result.aggregatedStats.averageResponseTime,
          p95ResponseTime: result.aggregatedStats.p95,
          throughput: result.aggregatedStats.throughput
        };
        
        stressResults.push(stepResult);
        this.emit('stressStepCompleted', stepResult);
        
        // Stop if error rate is too high or response times are too slow
        if (stepResult.errorRate > 10 || stepResult.p95ResponseTime > 5000) {
          this.emit('stressTestStopped', { reason: 'performance_degradation', at: users });
          break;
        }
        
      } catch (error) {
        this.emit('stressStepError', { users, error });
        break;
      }
      
      // Brief pause between steps
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    return {
      steps: stressResults,
      maxSupportedUsers: stressResults
        .filter(step => step.success)
        .map(step => step.userCount)
        .pop() || startUsers
    };
  }

  getActiveTests() {
    return Array.from(this.activeTests.values());
  }

  getResults() {
    return this.results;
  }

  cleanup() {
    // Terminate any remaining workers
    this.workers.forEach(worker => {
      try {
        worker.terminate();
      } catch (e) {
        // Worker already terminated
      }
    });
    this.workers = [];
  }
}

module.exports = LoadGenerator;
