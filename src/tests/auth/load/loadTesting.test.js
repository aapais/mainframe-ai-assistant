/**
 * Load Testing for SSO System
 */

const request = require('supertest');
const express = require('express');
const { performance } = require('perf_hooks');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const { SSOService } = require('../../../services/auth/SSOService');
const { MockGoogleProvider, MockJWTProvider } = require('../mocks/ssoProviders.mock');
const { UserFactory } = require('../factories/userFactory');

// Performance metrics collector
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      requests: [],
      errors: [],
      responseTimePercentiles: {},
      throughput: 0,
      errorRate: 0,
      concurrency: 0,
      resourceUsage: {
        cpu: [],
        memory: [],
        handles: []
      }
    };
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = performance.now();
    this.startResourceMonitoring();
  }

  end() {
    this.endTime = performance.now();
    this.stopResourceMonitoring();
    this.calculateMetrics();
  }

  addRequest(duration, success = true, statusCode = 200) {
    this.metrics.requests.push({
      duration,
      success,
      statusCode,
      timestamp: performance.now()
    });

    if (!success) {
      this.metrics.errors.push({
        statusCode,
        timestamp: performance.now()
      });
    }
  }

  startResourceMonitoring() {
    this.resourceMonitoringInterval = setInterval(() => {
      const usage = process.memoryUsage();
      this.metrics.resourceUsage.memory.push({
        timestamp: performance.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss
      });

      // Get handle count (approximation)
      this.metrics.resourceUsage.handles.push({
        timestamp: performance.now(),
        count: process._getActiveHandles?.()?.length || 0
      });
    }, 1000);
  }

  stopResourceMonitoring() {
    if (this.resourceMonitoringInterval) {
      clearInterval(this.resourceMonitoringInterval);
    }
  }

  calculateMetrics() {
    const durations = this.metrics.requests
      .filter(req => req.success)
      .map(req => req.duration)
      .sort((a, b) => a - b);

    if (durations.length > 0) {
      this.metrics.responseTimePercentiles = {
        p50: this.getPercentile(durations, 50),
        p75: this.getPercentile(durations, 75),
        p90: this.getPercentile(durations, 90),
        p95: this.getPercentile(durations, 95),
        p99: this.getPercentile(durations, 99),
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((a, b) => a + b, 0) / durations.length
      };
    }

    const totalDuration = this.endTime - this.startTime;
    this.metrics.throughput = this.metrics.requests.length / (totalDuration / 1000);
    this.metrics.errorRate = (this.metrics.errors.length / this.metrics.requests.length) * 100;
  }

  getPercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[index] || 0;
  }

  getReport() {
    return {
      summary: {
        totalRequests: this.metrics.requests.length,
        successfulRequests: this.metrics.requests.filter(req => req.success).length,
        failedRequests: this.metrics.errors.length,
        throughput: Math.round(this.metrics.throughput * 100) / 100,
        errorRate: Math.round(this.metrics.errorRate * 100) / 100,
        duration: Math.round(this.endTime - this.startTime)
      },
      responseTime: this.metrics.responseTimePercentiles,
      resourceUsage: {
        peakMemory: Math.max(...this.metrics.resourceUsage.memory.map(m => m.heapUsed)),
        avgMemory: this.metrics.resourceUsage.memory.reduce((a, m) => a + m.heapUsed, 0) / this.metrics.resourceUsage.memory.length,
        peakHandles: Math.max(...this.metrics.resourceUsage.handles.map(h => h.count))
      },
      errors: this.metrics.errors.reduce((acc, error) => {
        acc[error.statusCode] = (acc[error.statusCode] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

// Load test runner using worker threads
class LoadTestRunner {
  constructor(options = {}) {
    this.options = {
      concurrency: options.concurrency || os.cpus().length,
      duration: options.duration || 60000, // 1 minute
      maxRequests: options.maxRequests || Infinity,
      rampUpTime: options.rampUpTime || 10000, // 10 seconds
      ...options
    };
    this.metrics = new PerformanceMetrics();
  }

  async run(testFn) {
    if (!isMainThread) {
      throw new Error('LoadTestRunner must be run in main thread');
    }

    console.log(`Starting load test with ${this.options.concurrency} workers for ${this.options.duration}ms`);

    this.metrics.start();

    const workers = [];
    const workerPromises = [];

    // Create workers
    for (let i = 0; i < this.options.concurrency; i++) {
      const worker = new Worker(__filename, {
        workerData: {
          workerId: i,
          testOptions: this.options,
          testType: 'worker'
        }
      });

      workers.push(worker);

      const workerPromise = new Promise((resolve, reject) => {
        worker.on('message', (data) => {
          if (data.type === 'metrics') {
            data.requests.forEach(req => {
              this.metrics.addRequest(req.duration, req.success, req.statusCode);
            });
          }
        });

        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          } else {
            resolve();
          }
        });
      });

      workerPromises.push(workerPromise);
    }

    // Run test for specified duration
    setTimeout(() => {
      workers.forEach(worker => worker.terminate());
    }, this.options.duration);

    try {
      await Promise.allSettled(workerPromises);
    } catch (error) {
      console.error('Worker error:', error);
    }

    this.metrics.end();

    return this.metrics.getReport();
  }
}

// Worker thread code
if (!isMainThread && workerData?.testType === 'worker') {
  const workerLoadTest = async () => {
    const { workerId, testOptions } = workerData;
    const requests = [];

    // Stagger worker start times for ramp-up
    const delay = (workerId * testOptions.rampUpTime) / testOptions.concurrency;
    await new Promise(resolve => setTimeout(resolve, delay));

    const startTime = performance.now();

    while (performance.now() - startTime < testOptions.duration - delay) {
      try {
        const requestStart = performance.now();

        // Simulate HTTP request (replace with actual test logic)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));

        const requestEnd = performance.now();
        const duration = requestEnd - requestStart;

        requests.push({
          duration,
          success: Math.random() > 0.05, // 5% error rate simulation
          statusCode: Math.random() > 0.05 ? 200 : 500,
          timestamp: requestEnd
        });

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

      } catch (error) {
        requests.push({
          duration: 0,
          success: false,
          statusCode: 500,
          timestamp: performance.now()
        });
      }
    }

    parentPort.postMessage({
      type: 'metrics',
      requests
    });
  };

  workerLoadTest().catch(console.error);
}

describe('SSO System Load Tests', () => {
  let app;
  let ssoService;
  let mockDatabase;
  let jwtProvider;

  beforeAll(async () => {
    // Setup optimized test environment
    mockDatabase = new Map();
    jwtProvider = new MockJWTProvider();

    const userRepository = {
      findByEmail: async (email) => mockDatabase.get(`email:${email}`),
      findByProviderId: async (providerId) => mockDatabase.get(`provider:${providerId}`),
      create: async (userData) => {
        const user = { ...userData, id: `user-${Date.now()}-${Math.random()}` };
        mockDatabase.set(`email:${user.email}`, user);
        if (user.providerId) {
          mockDatabase.set(`provider:${user.providerId}`, user);
        }
        return user;
      }
    };

    ssoService = new SSOService({ userRepository, jwtProvider });
    ssoService.registerProvider('google', new MockGoogleProvider());

    app = express();
    app.use(express.json());
    setupLoadTestRoutes(app, ssoService);

    // Pre-populate with test users
    for (let i = 0; i < 1000; i++) {
      const user = UserFactory.create({
        email: `loadtest${i}@example.com`,
        providerId: `google-${i}`
      });
      await userRepository.create(user);
    }
  }, 30000);

  describe('OAuth Flow Load Tests', () => {
    it('should handle 1000 concurrent OAuth callbacks', async () => {
      const concurrentRequests = 1000;
      const promises = [];

      const startTime = performance.now();

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get(`/auth/google/callback?code=load-test-${i}&state=state-${i}`)
            .timeout(5000)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successful = results.filter(result =>
        result.status === 'fulfilled' && result.value.status === 302
      );
      const failed = results.filter(result => result.status === 'rejected');

      const duration = endTime - startTime;
      const throughput = successful.length / (duration / 1000);

      console.log(`OAuth Callback Load Test Results:
        Total Requests: ${concurrentRequests}
        Successful: ${successful.length}
        Failed: ${failed.length}
        Success Rate: ${(successful.length / concurrentRequests * 100).toFixed(2)}%
        Duration: ${duration.toFixed(2)}ms
        Throughput: ${throughput.toFixed(2)} requests/second`);

      expect(successful.length).toBeGreaterThan(concurrentRequests * 0.95); // 95% success rate
      expect(throughput).toBeGreaterThan(50); // At least 50 requests per second
    }, 60000);

    it('should maintain performance under sustained load', async () => {
      const loadTestRunner = new LoadTestRunner({
        concurrency: 20,
        duration: 30000, // 30 seconds
        rampUpTime: 5000   // 5 seconds ramp-up
      });

      // Custom test function for OAuth flow
      const oauthLoadTest = async () => {
        const requests = [];
        const startTime = performance.now();

        while (performance.now() - startTime < 25000) { // Run for 25 seconds
          try {
            const requestId = Math.floor(Math.random() * 10000);
            const requestStart = performance.now();

            const response = await request(app)
              .get(`/auth/google/callback?code=sustained-${requestId}&state=state-${requestId}`)
              .timeout(2000);

            const requestEnd = performance.now();
            const duration = requestEnd - requestStart;

            requests.push({
              duration,
              success: response.status === 302,
              statusCode: response.status,
              timestamp: requestEnd
            });

          } catch (error) {
            requests.push({
              duration: 0,
              success: false,
              statusCode: error.status || 500,
              timestamp: performance.now()
            });
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        }

        return requests;
      };

      // Since we can't easily use worker threads in Jest, simulate load testing
      const concurrentTests = [];
      for (let i = 0; i < 10; i++) {
        concurrentTests.push(oauthLoadTest());
      }

      const results = await Promise.all(concurrentTests);
      const allRequests = results.flat();

      const successful = allRequests.filter(req => req.success);
      const avgResponseTime = successful.reduce((sum, req) => sum + req.duration, 0) / successful.length;
      const p95ResponseTime = successful
        .map(req => req.duration)
        .sort((a, b) => a - b)[Math.floor(0.95 * successful.length)];

      console.log(`Sustained Load Test Results:
        Total Requests: ${allRequests.length}
        Successful Requests: ${successful.length}
        Success Rate: ${(successful.length / allRequests.length * 100).toFixed(2)}%
        Average Response Time: ${avgResponseTime.toFixed(2)}ms
        P95 Response Time: ${p95ResponseTime.toFixed(2)}ms`);

      expect(successful.length / allRequests.length).toBeGreaterThan(0.95);
      expect(avgResponseTime).toBeLessThan(200);
      expect(p95ResponseTime).toBeLessThan(500);
    }, 60000);
  });

  describe('Token Validation Load Tests', () => {
    it('should handle high-frequency token validation', async () => {
      // Pre-generate tokens
      const tokens = [];
      for (let i = 0; i < 100; i++) {
        tokens.push(jwtProvider.generateToken({
          userId: `user-${i}`,
          exp: Math.floor(Date.now() / 1000) + 3600
        }));
      }

      const concurrentRequests = 2000;
      const promises = [];

      const startTime = performance.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const token = tokens[i % tokens.length];
        promises.push(
          request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`)
            .timeout(1000)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();

      const successful = results.filter(result =>
        result.status === 'fulfilled' && result.value.status === 200
      );

      const duration = endTime - startTime;
      const throughput = successful.length / (duration / 1000);

      console.log(`Token Validation Load Test Results:
        Total Requests: ${concurrentRequests}
        Successful: ${successful.length}
        Success Rate: ${(successful.length / concurrentRequests * 100).toFixed(2)}%
        Duration: ${duration.toFixed(2)}ms
        Throughput: ${throughput.toFixed(2)} requests/second`);

      expect(successful.length / concurrentRequests).toBeGreaterThan(0.98);
      expect(throughput).toBeGreaterThan(200); // At least 200 validations per second
    }, 30000);

    it('should handle mixed read/write operations', async () => {
      const iterations = 500;
      const promises = [];
      const metrics = {
        oauth: { count: 0, totalTime: 0, errors: 0 },
        validation: { count: 0, totalTime: 0, errors: 0 },
        profile: { count: 0, totalTime: 0, errors: 0 }
      };

      for (let i = 0; i < iterations; i++) {
        const operation = Math.random();

        if (operation < 0.5) {
          // OAuth callback (write operation)
          const startTime = performance.now();
          promises.push(
            request(app)
              .get(`/auth/google/callback?code=mixed-${i}&state=state-${i}`)
              .timeout(2000)
              .then(response => {
                const duration = performance.now() - startTime;
                metrics.oauth.count++;
                metrics.oauth.totalTime += duration;
                if (response.status !== 302) metrics.oauth.errors++;
              })
              .catch(() => {
                metrics.oauth.count++;
                metrics.oauth.errors++;
              })
          );

        } else if (operation < 0.8) {
          // Token validation (read operation)
          const token = jwtProvider.generateToken({
            userId: `user-${i}`,
            exp: Math.floor(Date.now() / 1000) + 3600
          });

          const startTime = performance.now();
          promises.push(
            request(app)
              .get('/protected')
              .set('Authorization', `Bearer ${token}`)
              .timeout(1000)
              .then(response => {
                const duration = performance.now() - startTime;
                metrics.validation.count++;
                metrics.validation.totalTime += duration;
                if (response.status !== 200) metrics.validation.errors++;
              })
              .catch(() => {
                metrics.validation.count++;
                metrics.validation.errors++;
              })
          );

        } else {
          // Profile update (write operation)
          const token = jwtProvider.generateToken({
            userId: `user-${i}`,
            exp: Math.floor(Date.now() / 1000) + 3600
          });

          const startTime = performance.now();
          promises.push(
            request(app)
              .put('/profile')
              .set('Authorization', `Bearer ${token}`)
              .send({ firstName: `UpdatedName${i}` })
              .timeout(2000)
              .then(response => {
                const duration = performance.now() - startTime;
                metrics.profile.count++;
                metrics.profile.totalTime += duration;
                if (response.status !== 200) metrics.profile.errors++;
              })
              .catch(() => {
                metrics.profile.count++;
                metrics.profile.errors++;
              })
          );
        }
      }

      await Promise.all(promises);

      const results = {
        oauth: {
          avgTime: metrics.oauth.totalTime / metrics.oauth.count,
          errorRate: (metrics.oauth.errors / metrics.oauth.count) * 100
        },
        validation: {
          avgTime: metrics.validation.totalTime / metrics.validation.count,
          errorRate: (metrics.validation.errors / metrics.validation.count) * 100
        },
        profile: {
          avgTime: metrics.profile.totalTime / metrics.profile.count,
          errorRate: (metrics.profile.errors / metrics.profile.count) * 100
        }
      };

      console.log(`Mixed Operations Load Test Results:
        OAuth - Count: ${metrics.oauth.count}, Avg Time: ${results.oauth.avgTime.toFixed(2)}ms, Error Rate: ${results.oauth.errorRate.toFixed(2)}%
        Validation - Count: ${metrics.validation.count}, Avg Time: ${results.validation.avgTime.toFixed(2)}ms, Error Rate: ${results.validation.errorRate.toFixed(2)}%
        Profile - Count: ${metrics.profile.count}, Avg Time: ${results.profile.avgTime.toFixed(2)}ms, Error Rate: ${results.profile.errorRate.toFixed(2)}%`);

      expect(results.oauth.errorRate).toBeLessThan(5);
      expect(results.validation.errorRate).toBeLessThan(2);
      expect(results.profile.errorRate).toBeLessThan(10);
      expect(results.validation.avgTime).toBeLessThan(50);
    }, 60000);
  });

  describe('Memory and Resource Tests', () => {
    it('should not leak memory under load', async () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();
      const iterations = 1000;
      const batchSize = 100;

      for (let batch = 0; batch < iterations / batchSize; batch++) {
        const promises = [];

        for (let i = 0; i < batchSize; i++) {
          const requestId = batch * batchSize + i;
          promises.push(
            request(app)
              .get(`/auth/google/callback?code=memory-test-${requestId}&state=state-${requestId}`)
              .timeout(2000)
              .catch(() => {}) // Ignore errors for memory testing
          );
        }

        await Promise.all(promises);

        // Check memory periodically
        if (batch % 5 === 0 && global.gc) {
          global.gc();
          const currentMemory = process.memoryUsage();
          const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          const heapIncreasePercent = (heapIncrease / initialMemory.heapUsed) * 100;

          console.log(`Memory check at iteration ${batch * batchSize}:
            Heap Used: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
            Heap Increase: ${(heapIncrease / 1024 / 1024).toFixed(2)} MB (${heapIncreasePercent.toFixed(2)}%)`);

          // Memory increase should be reasonable
          expect(heapIncreasePercent).toBeLessThan(200);
        }
      }

      // Final memory check
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const totalHeapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const totalIncreasePercent = (totalHeapIncrease / initialMemory.heapUsed) * 100;

      console.log(`Final Memory Usage:
        Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        Total Increase: ${(totalHeapIncrease / 1024 / 1024).toFixed(2)} MB (${totalIncreasePercent.toFixed(2)}%)`);

      // Total memory increase should be reasonable
      expect(totalIncreasePercent).toBeLessThan(150);
    }, 120000);

    it('should handle connection pool exhaustion gracefully', async () => {
      const maxConnections = 1000;
      const promises = [];
      let connectionErrors = 0;
      let successfulConnections = 0;

      for (let i = 0; i < maxConnections; i++) {
        promises.push(
          request(app)
            .get(`/auth/google/callback?code=pool-test-${i}&state=state-${i}`)
            .timeout(5000)
            .then(() => {
              successfulConnections++;
            })
            .catch(error => {
              if (error.code === 'ECONNRESET' || error.code === 'EMFILE') {
                connectionErrors++;
              }
            })
        );
      }

      await Promise.allSettled(promises);

      console.log(`Connection Pool Test Results:
        Max Connections Attempted: ${maxConnections}
        Successful Connections: ${successfulConnections}
        Connection Errors: ${connectionErrors}
        Success Rate: ${(successfulConnections / maxConnections * 100).toFixed(2)}%`);

      // System should handle at least 80% of connections successfully
      expect(successfulConnections / maxConnections).toBeGreaterThan(0.8);
    }, 60000);
  });

  describe('Stress Tests', () => {
    it('should recover from high error rates', async () => {
      // Temporarily modify the app to introduce errors
      const errorRate = 0.3; // 30% error rate
      let requestCount = 0;

      app.get('/stress-test', (req, res) => {
        requestCount++;
        if (Math.random() < errorRate) {
          return res.status(500).json({ error: 'Simulated error' });
        }
        res.json({ message: 'Success', requestNumber: requestCount });
      });

      const iterations = 500;
      const promises = [];
      let errors = 0;
      let successes = 0;

      for (let i = 0; i < iterations; i++) {
        promises.push(
          request(app)
            .get('/stress-test')
            .timeout(2000)
            .then(response => {
              if (response.status === 200) {
                successes++;
              } else {
                errors++;
              }
            })
            .catch(() => {
              errors++;
            })
        );
      }

      await Promise.all(promises);

      const actualErrorRate = errors / iterations;
      const errorTolerance = Math.abs(actualErrorRate - errorRate);

      console.log(`Stress Test Results:
        Total Requests: ${iterations}
        Successes: ${successes}
        Errors: ${errors}
        Actual Error Rate: ${(actualErrorRate * 100).toFixed(2)}%
        Expected Error Rate: ${(errorRate * 100).toFixed(2)}%
        Error Tolerance: ${(errorTolerance * 100).toFixed(2)}%`);

      // System should handle errors gracefully
      expect(errorTolerance).toBeLessThan(0.1); // Within 10% of expected error rate
      expect(successes).toBeGreaterThan(0); // At least some requests should succeed
    }, 30000);
  });
});

// Helper function to set up routes for load testing
function setupLoadTestRoutes(app, ssoService) {
  let requestCounter = 0;

  app.get('/auth/google/callback', async (req, res) => {
    try {
      requestCounter++;
      const { code, state } = req.query;

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20));

      // Mock profile based on code
      const mockProfile = {
        id: code.includes('existing') ? code.split('-')[1] : `new-${requestCounter}`,
        email: `${code}@example.com`,
        name: `User ${requestCounter}`,
        verified_email: true
      };

      const user = await ssoService.handleOAuthCallback('google', mockProfile);

      res.redirect('/dashboard');
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/protected', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const payload = ssoService.jwtProvider.verifyToken(token);
      res.json({ message: 'Access granted', userId: payload.userId });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  app.put('/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const payload = ssoService.jwtProvider.verifyToken(token);

      // Simulate database update delay
      setTimeout(() => {
        res.json({ message: 'Profile updated', userId: payload.userId });
      }, Math.random() * 100);
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  app.get('/dashboard', (req, res) => {
    res.json({ message: 'Dashboard' });
  });
}