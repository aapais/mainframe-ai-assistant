import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Core imports
import { AppError, ErrorCode, ErrorSeverity } from '../../../src/core/errors/AppError';
import { ServiceFactory } from '../../../src/services/ServiceFactory';
import { GeminiService } from '../../../src/services/GeminiService';

// Test utilities
import { createTestDB, cleanupTestDB, waitFor } from '../test-utils/error-injection-utils';

/**
 * Circuit Breaker States
 */
enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation, requests go through
  OPEN = 'OPEN',          // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is recovered
}

/**
 * Circuit Breaker Configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures to open circuit
  recoveryTimeout: number;      // Time to wait before attempting recovery
  successThreshold: number;     // Successes needed to close circuit
  timeout: number;              // Request timeout
  monitoringWindow: number;     // Time window for failure counting
}

/**
 * Circuit Breaker Metrics
 */
interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  stateChangeTime: Date;
  totalOpenTime: number;
  totalRequests: number;
  totalFailures: number;
  successRate: number;
}

/**
 * Circuit Breaker Implementation for Testing
 */
class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private requests: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private stateChangeTime: Date = new Date();
  private totalOpenTime: number = 0;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private config: CircuitBreakerConfig;
  private failureWindow: Date[] = [];

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    this.requests++;

    // Clean old failures from window
    this.cleanFailureWindow();

    // Check circuit state
    switch (this.state) {
      case CircuitState.OPEN:
        if (this.shouldAttemptRecovery()) {
          this.setState(CircuitState.HALF_OPEN);
          break;
        }
        throw new AppError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Circuit breaker is OPEN - service unavailable',
          { circuitState: this.state, failures: this.failures }
        );

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        break;

      case CircuitState.CLOSED:
        // Normal operation
        break;
    }

    // Execute the operation with timeout
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new AppError(
            ErrorCode.TIMEOUT_ERROR,
            'Operation timed out',
            { timeout: this.config.timeout }
          ));
        }, this.config.timeout);
      });

      const result = await Promise.race([operation(), timeoutPromise]);
      
      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        if (this.successes >= this.config.successThreshold) {
          this.setState(CircuitState.CLOSED);
          this.resetCounters();
        }
        break;

      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failures = 0;
        this.failureWindow = [];
        break;
    }

    this.emit('success', { state: this.state, successes: this.successes });
  }

  private onFailure(error: any): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = new Date();
    this.failureWindow.push(new Date());

    this.emit('failure', { 
      state: this.state, 
      failures: this.failures, 
      error: error.message 
    });

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED && 
        this.failureWindow.length >= this.config.failureThreshold) {
      this.setState(CircuitState.OPEN);
      this.resetCounters();
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this.setState(CircuitState.OPEN);
      this.resetCounters();
    }
  }

  private shouldAttemptRecovery(): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  private setState(newState: CircuitState): void {
    if (newState !== this.state) {
      const oldState = this.state;
      
      // Track open time
      if (oldState === CircuitState.OPEN) {
        this.totalOpenTime += Date.now() - this.stateChangeTime.getTime();
      }

      this.state = newState;
      this.stateChangeTime = new Date();

      this.emit('stateChange', {
        from: oldState,
        to: newState,
        timestamp: this.stateChangeTime
      });
    }
  }

  private resetCounters(): void {
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
  }

  private cleanFailureWindow(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.failureWindow = this.failureWindow.filter(
      time => time.getTime() > cutoff
    );
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangeTime: this.stateChangeTime,
      totalOpenTime: this.totalOpenTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      successRate: this.totalRequests > 0 ? 
        (this.totalRequests - this.totalFailures) / this.totalRequests : 0
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.resetCounters();
    this.failureWindow = [];
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.stateChangeTime = new Date();
    this.totalOpenTime = 0;
    this.totalRequests = 0;
    this.totalFailures = 0;
  }
}

/**
 * Mock Service for Circuit Breaker Testing
 */
class MockService {
  private shouldFail: boolean = false;
  private failureRate: number = 0;
  private responseTime: number = 100;
  private requestCount: number = 0;

  setFailureMode(shouldFail: boolean, failureRate: number = 1.0): void {
    this.shouldFail = shouldFail;
    this.failureRate = failureRate;
  }

  setResponseTime(time: number): void {
    this.responseTime = time;
  }

  async makeRequest(data?: any): Promise<any> {
    this.requestCount++;
    
    // Simulate response time
    await waitFor(this.responseTime);

    // Simulate failures
    if (this.shouldFail && Math.random() < this.failureRate) {
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Mock service failure',
        { requestCount: this.requestCount, data }
      );
    }

    return {
      success: true,
      requestCount: this.requestCount,
      timestamp: new Date(),
      data
    };
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  reset(): void {
    this.requestCount = 0;
    this.shouldFail = false;
    this.failureRate = 0;
    this.responseTime = 100;
  }
}

describe('Circuit Breaker Pattern Validation Tests', () => {
  let circuitBreaker: CircuitBreaker;
  let mockService: MockService;
  let serviceFactory: ServiceFactory;
  let testDbPath: string;

  beforeAll(async () => {
    testDbPath = await createTestDB();
    
    serviceFactory = new ServiceFactory({
      database: {
        path: testDbPath,
        pragmas: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          cache_size: -1000,
          foreign_keys: 'ON'
        },
        backup: { enabled: false, interval: 0, retention: 0, path: '' },
        performance: { connectionPool: 2, busyTimeout: 1000, cacheSize: 1000 }
      },
      cache: { maxSize: 10, ttl: 1000, checkPeriod: 500, strategy: 'lru', persistent: false },
      metrics: { 
        enabled: true, 
        retention: 10000,
        aggregation: { enabled: false, interval: 0, batch: 0 },
        alerts: { enabled: false, thresholds: {} }
      },
      logging: {
        level: 'warn',
        file: { enabled: false, path: '', maxSize: 0, maxFiles: 0 },
        console: false,
        structured: false
      }
    });

    await serviceFactory.initialize();
  });

  afterAll(async () => {
    if (serviceFactory) {
      await serviceFactory.shutdown();
    }
    await cleanupTestDB(testDbPath);
  });

  beforeEach(() => {
    mockService = new MockService();
    
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 2000,
      successThreshold: 2,
      timeout: 1000,
      monitoringWindow: 10000
    });

    // Setup event listeners for debugging
    circuitBreaker.on('stateChange', (event) => {
      console.log(`🔄 Circuit breaker state change: ${event.from} → ${event.to}`);
    });

    circuitBreaker.on('failure', (event) => {
      console.log(`❌ Circuit breaker failure in ${event.state} state (count: ${event.failures})`);
    });

    circuitBreaker.on('success', (event) => {
      console.log(`✅ Circuit breaker success in ${event.state} state (count: ${event.successes})`);
    });
  });

  afterEach(() => {
    circuitBreaker.removeAllListeners();
    mockService.reset();
    circuitBreaker.reset();
  });

  describe('Basic Circuit Breaker Functionality', () => {
    it('should start in CLOSED state and allow requests', async () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      const result = await circuitBreaker.execute(() => 
        mockService.makeRequest({ test: 'data' })
      );

      expect(result.success).toBe(true);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to OPEN state after failure threshold', async () => {
      mockService.setFailureMode(true, 1.0); // 100% failure rate

      // Make requests that will fail
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should fail fast when circuit is OPEN', async () => {
      // First, open the circuit
      mockService.setFailureMode(true, 1.0);
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Now test fast failure
      const startTime = Date.now();
      
      try {
        await circuitBreaker.execute(() => mockService.makeRequest());
        fail('Should have thrown circuit breaker error');
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
        expect(duration).toBeLessThan(100); // Should fail immediately
      }

      // Service should not have received the request
      expect(mockService.getRequestCount()).toBe(3); // Only the initial failures
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Open the circuit
      mockService.setFailureMode(true, 1.0);
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      await waitFor(2100); // Slightly more than recovery timeout

      // Fix the service
      mockService.setFailureMode(false);

      // Next request should transition to HALF_OPEN
      const result = await circuitBreaker.execute(() => mockService.makeRequest());
      
      expect(result.success).toBe(true);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after sufficient successes in HALF_OPEN', async () => {
      // Open the circuit first
      mockService.setFailureMode(true, 1.0);
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      await waitFor(2100);

      // Fix the service
      mockService.setFailureMode(false);

      // Make successful requests to close the circuit
      for (let i = 0; i < 2; i++) { // successThreshold = 2
        const result = await circuitBreaker.execute(() => mockService.makeRequest());
        expect(result.success).toBe(true);
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure in HALF_OPEN state', async () => {
      // Open the circuit
      mockService.setFailureMode(true, 1.0);
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      await waitFor(2100);

      // Service is still failing
      mockService.setFailureMode(true, 1.0);

      // First request should fail and reopen circuit
      try {
        await circuitBreaker.execute(() => mockService.makeRequest());
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      mockService.setResponseTime(2000); // Longer than circuit breaker timeout (1000ms)

      const startTime = Date.now();
      
      try {
        await circuitBreaker.execute(() => mockService.makeRequest());
        fail('Should have thrown timeout error');
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.TIMEOUT_ERROR);
        expect(duration).toBeGreaterThan(900); // Close to timeout
        expect(duration).toBeLessThan(1500); // But not much longer
      }
    });

    it('should treat timeouts as failures for circuit breaker logic', async () => {
      mockService.setResponseTime(2000); // Will timeout

      // Generate timeout failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          expect((error as AppError).code).toBe(ErrorCode.TIMEOUT_ERROR);
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track comprehensive metrics', async () => {
      // Generate mixed success/failure pattern
      mockService.setFailureMode(true, 0.5); // 50% failure rate

      const operations = Array(10).fill(0).map(() => 
        circuitBreaker.execute(() => mockService.makeRequest())
      );

      const results = await Promise.allSettled(operations);
      
      const metrics = circuitBreaker.getMetrics();
      
      expect(metrics.totalRequests).toBe(10);
      expect(metrics.totalFailures).toBeGreaterThan(0);
      expect(metrics.totalFailures).toBeLessThan(10);
      expect(metrics.successRate).toBeGreaterThan(0);
      expect(metrics.successRate).toBeLessThan(1);

      console.log('📊 Circuit Breaker Metrics:', {
        totalRequests: metrics.totalRequests,
        totalFailures: metrics.totalFailures,
        successRate: (metrics.successRate * 100).toFixed(1) + '%',
        state: metrics.state
      });
    });

    it('should track state change timing', async () => {
      const stateChanges: Array<{ from: CircuitState; to: CircuitState; timestamp: Date }> = [];
      
      circuitBreaker.on('stateChange', (event) => {
        stateChanges.push(event);
      });

      // Open the circuit
      mockService.setFailureMode(true, 1.0);
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          // Expected failures
        }
      }

      expect(stateChanges.length).toBe(1);
      expect(stateChanges[0].from).toBe(CircuitState.CLOSED);
      expect(stateChanges[0].to).toBe(CircuitState.OPEN);

      // Wait and trigger recovery
      await waitFor(2100);
      mockService.setFailureMode(false);

      await circuitBreaker.execute(() => mockService.makeRequest());

      expect(stateChanges.length).toBe(2);
      expect(stateChanges[1].from).toBe(CircuitState.OPEN);
      expect(stateChanges[1].to).toBe(CircuitState.HALF_OPEN);

      // Complete recovery
      await circuitBreaker.execute(() => mockService.makeRequest());

      expect(stateChanges.length).toBe(3);
      expect(stateChanges[2].from).toBe(CircuitState.HALF_OPEN);
      expect(stateChanges[2].to).toBe(CircuitState.CLOSED);
    });
  });

  describe('Real Service Integration', () => {
    it('should work with GeminiService failures', async () => {
      const geminiService = new GeminiService({
        apiKey: 'invalid-key-for-testing',
        timeout: 500, // Short timeout
        temperature: 0.3
      });

      const geminiCircuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 1000,
        successThreshold: 1,
        timeout: 1000,
        monitoringWindow: 5000
      });

      // Test circuit breaker with actual service failures
      let openStateReached = false;
      geminiCircuitBreaker.on('stateChange', (event) => {
        if (event.to === CircuitState.OPEN) {
          openStateReached = true;
        }
      });

      // Generate failures
      for (let i = 0; i < 3; i++) {
        try {
          await geminiCircuitBreaker.execute(() => 
            geminiService.explainError('S0C7')
          );
        } catch (error) {
          // Expected failures due to invalid API key
        }
      }

      expect(openStateReached).toBe(true);
      expect(geminiCircuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Verify fast failure
      const startTime = Date.now();
      try {
        await geminiCircuitBreaker.execute(() => 
          geminiService.explainError('S0C4')
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(100);
        expect((error as AppError).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      }
    });
  });

  describe('Advanced Circuit Breaker Patterns', () => {
    it('should handle burst failures correctly', async () => {
      mockService.setFailureMode(true, 1.0);

      // Send burst of failures simultaneously
      const burstPromises = Array(10).fill(0).map(() => 
        circuitBreaker.execute(() => mockService.makeRequest()).catch(() => {})
      );

      await Promise.allSettled(burstPromises);

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalFailures).toBeGreaterThanOrEqual(3);
      expect(metrics.successRate).toBe(0);
    });

    it('should handle intermittent failures with sliding window', async () => {
      mockService.setFailureMode(true, 0.3); // 30% failure rate

      const results = [];
      
      // Generate requests over time with intermittent failures
      for (let i = 0; i < 15; i++) {
        try {
          const result = await circuitBreaker.execute(() => mockService.makeRequest());
          results.push({ success: true, attempt: i });
        } catch (error) {
          results.push({ success: false, attempt: i, error: error.message });
        }
        
        await waitFor(100); // Small delay between requests
      }

      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;

      console.log(`📈 Intermittent failure test: ${successes} successes, ${failures} failures`);

      // With 30% failure rate and sliding window, circuit should remain mostly closed
      // unless we hit a streak of failures
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successRate).toBeGreaterThan(0.5);
    });

    it('should provide proper isolation between multiple circuit breakers', async () => {
      const service1 = new MockService();
      const service2 = new MockService();
      
      const circuit1 = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 1000,
        successThreshold: 1,
        timeout: 500,
        monitoringWindow: 5000
      });

      const circuit2 = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 2000,
        successThreshold: 2,
        timeout: 500,
        monitoringWindow: 5000
      });

      // Make service1 fail
      service1.setFailureMode(true, 1.0);
      service2.setFailureMode(false);

      // Trigger failures in circuit1
      for (let i = 0; i < 2; i++) {
        try {
          await circuit1.execute(() => service1.makeRequest());
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit1 should be open, circuit2 should be closed
      expect(circuit1.getState()).toBe(CircuitState.OPEN);
      expect(circuit2.getState()).toBe(CircuitState.CLOSED);

      // Circuit2 should still work
      const result = await circuit2.execute(() => service2.makeRequest());
      expect(result.success).toBe(true);
      expect(circuit2.getState()).toBe(CircuitState.CLOSED);

      // Circuit1 should fail fast
      try {
        await circuit1.execute(() => service1.makeRequest());
        fail('Should have failed fast');
      } catch (error) {
        expect((error as AppError).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      }

      circuit1.removeAllListeners();
      circuit2.removeAllListeners();
    });
  });

  describe('Circuit Breaker Performance Impact', () => {
    it('should have minimal performance overhead when closed', async () => {
      const iterations = 100;
      
      // Test without circuit breaker
      const startDirect = Date.now();
      for (let i = 0; i < iterations; i++) {
        await mockService.makeRequest();
      }
      const directTime = Date.now() - startDirect;

      mockService.reset();

      // Test with circuit breaker
      const startCircuit = Date.now();
      for (let i = 0; i < iterations; i++) {
        await circuitBreaker.execute(() => mockService.makeRequest());
      }
      const circuitTime = Date.now() - startCircuit;

      const overhead = circuitTime - directTime;
      const overheadPercentage = (overhead / directTime) * 100;

      console.log(`🚀 Performance overhead: ${overhead}ms (${overheadPercentage.toFixed(1)}%)`);

      // Circuit breaker should add minimal overhead (< 20%)
      expect(overheadPercentage).toBeLessThan(20);
    });

    it('should provide significant performance improvement when open', async () => {
      mockService.setFailureMode(true, 1.0);
      mockService.setResponseTime(1000); // Slow failing service

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Test fast failure performance
      const iterations = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        try {
          await circuitBreaker.execute(() => mockService.makeRequest());
        } catch (error) {
          // Expected fast failures
        }
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;

      console.log(`⚡ Fast failure average time: ${avgTime}ms per request`);

      // Should be much faster than service response time
      expect(avgTime).toBeLessThan(100); // Should be nearly instantaneous
    });
  });
});