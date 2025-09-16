/**
 * Error Handling Test Utilities
 * Comprehensive utilities for error simulation, validation, and recovery testing
 */

import { KnowledgeDB, KBEntry } from '../../../src/database/KnowledgeDB';
import { AppError, ErrorCode, ErrorSeverity } from '../../../src/core/errors/AppError';
import { GeminiService } from '../../../src/services/GeminiService';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import axios, { AxiosError, AxiosResponse } from 'axios';

// =============================================================================
// ERROR SIMULATION UTILITIES
// =============================================================================

/**
 * Database Error Simulator
 * Simulates various database failure scenarios
 */
export class DatabaseErrorSimulator {
  private originalMethods = new Map<string, any>();
  private db: Database.Database | null = null;
  private knowledgeDB: KnowledgeDB | null = null;

  constructor(target?: Database.Database | KnowledgeDB) {
    if (target instanceof Database) {
      this.db = target;
    } else if (target) {
      this.knowledgeDB = target;
      this.db = (target as any).db;
    }
  }

  /**
   * Simulate connection failures
   */
  simulateConnectionError(persistent: boolean = false): void {
    this.interceptMethod('prepare', () => {
      throw new Error('SQLITE_CANTOPEN: unable to open database file');
    }, persistent);
  }

  /**
   * Simulate database corruption
   */
  simulateCorruption(): void {
    this.interceptMethod('exec', () => {
      throw new Error('SQLITE_CORRUPT: database disk image is malformed');
    });
  }

  /**
   * Simulate disk full errors
   */
  simulateDiskFull(): void {
    this.interceptMethod('prepare', () => ({
      run: () => {
        throw new Error('SQLITE_FULL: database or disk is full');
      },
      get: () => {
        throw new Error('SQLITE_FULL: database or disk is full');
      },
      all: () => {
        throw new Error('SQLITE_FULL: database or disk is full');
      }
    }));
  }

  /**
   * Simulate constraint violations
   */
  simulateConstraintViolation(constraintType: 'UNIQUE' | 'FOREIGN_KEY' | 'CHECK' = 'UNIQUE'): void {
    this.interceptMethod('prepare', () => ({
      run: () => {
        throw new Error(`SQLITE_CONSTRAINT: ${constraintType} constraint failed`);
      }
    }));
  }

  /**
   * Simulate database locking
   */
  simulateDatabaseLock(duration: number = 5000): void {
    let lockExpiry = Date.now() + duration;

    this.interceptMethod('prepare', () => {
      if (Date.now() < lockExpiry) {
        throw new Error('SQLITE_BUSY: database is locked');
      }
      return this.getOriginalMethod('prepare')?.apply(this.db, arguments);
    });
  }

  /**
   * Simulate transaction rollback
   */
  simulateTransactionFailure(): void {
    this.interceptMethod('transaction', (fn: Function) => {
      return () => {
        throw new Error('Transaction rolled back due to conflict');
      };
    });
  }

  /**
   * Simulate intermittent failures
   */
  simulateIntermittentFailure(failureRate: number = 0.3, errorType: string = 'SQLITE_BUSY'): void {
    const originalPrepare = this.getOriginalMethod('prepare') || this.db?.prepare;
    
    this.interceptMethod('prepare', (...args) => {
      if (Math.random() < failureRate) {
        throw new Error(`${errorType}: intermittent failure`);
      }
      return originalPrepare?.apply(this.db, args);
    });
  }

  /**
   * Create a corrupted database file
   */
  static createCorruptedDatabase(dbPath: string): void {
    fs.writeFileSync(dbPath, 'SQLite format 3\x00corrupted_data_here');
  }

  /**
   * Generic method interception
   */
  private interceptMethod(methodName: string, mockImplementation: any, persistent: boolean = true): void {
    if (this.db && typeof (this.db as any)[methodName] === 'function') {
      if (!this.originalMethods.has(methodName)) {
        this.originalMethods.set(methodName, (this.db as any)[methodName]);
      }

      if (persistent) {
        (this.db as any)[methodName] = mockImplementation;
      } else {
        // One-time failure
        let called = false;
        (this.db as any)[methodName] = (...args: any[]) => {
          if (!called) {
            called = true;
            return mockImplementation(...args);
          }
          return this.originalMethods.get(methodName)?.apply(this.db, args);
        };
      }
    }
  }

  private getOriginalMethod(methodName: string): any {
    return this.originalMethods.get(methodName);
  }

  /**
   * Restore all original methods
   */
  restore(): void {
    if (this.db) {
      for (const [methodName, originalMethod] of this.originalMethods.entries()) {
        (this.db as any)[methodName] = originalMethod;
      }
    }
    this.originalMethods.clear();
  }
}

/**
 * API Error Simulator
 * Simulates various API failure scenarios
 */
export class APIErrorSimulator {
  private originalPost: any;
  private mockAxios: any;

  constructor() {
    this.mockAxios = axios as any;
    this.originalPost = this.mockAxios.post;
  }

  /**
   * Simulate network connection errors
   */
  simulateNetworkError(errorType: 'ECONNREFUSED' | 'ENOTFOUND' | 'ETIMEDOUT' = 'ECONNREFUSED'): void {
    this.mockAxios.post = jest.fn().mockRejectedValue(new Error(errorType));
  }

  /**
   * Simulate HTTP error responses
   */
  simulateHTTPError(status: number, message: string = 'HTTP Error', headers: Record<string, string> = {}): void {
    const error = new AxiosError(message);
    error.response = {
      status,
      statusText: this.getStatusText(status),
      data: { error: message },
      headers
    } as AxiosResponse;

    this.mockAxios.post = jest.fn().mockRejectedValue(error);
  }

  /**
   * Simulate rate limiting
   */
  simulateRateLimit(retryAfter: number = 60): void {
    this.simulateHTTPError(429, 'Rate limit exceeded', { 'retry-after': retryAfter.toString() });
  }

  /**
   * Simulate authentication errors
   */
  simulateAuthError(errorType: 'invalid_key' | 'expired_key' | 'quota_exceeded' = 'invalid_key'): void {
    const errorMessages = {
      invalid_key: 'API key not valid',
      expired_key: 'API key has expired',
      quota_exceeded: 'Quota exceeded for this API key'
    };

    const status = errorType === 'quota_exceeded' ? 403 : 401;
    this.simulateHTTPError(status, errorMessages[errorType]);
  }

  /**
   * Simulate malformed responses
   */
  simulateMalformedResponse(responseType: 'invalid_json' | 'missing_fields' | 'empty' = 'invalid_json'): void {
    const responses = {
      invalid_json: 'invalid json response',
      missing_fields: { incomplete: 'data' },
      empty: {}
    };

    this.mockAxios.post = jest.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: responses[responseType],
      headers: {},
      config: {}
    });
  }

  /**
   * Simulate service unavailable
   */
  simulateServiceUnavailable(retryAfter?: number): void {
    const headers = retryAfter ? { 'retry-after': retryAfter.toString() } : {};
    this.simulateHTTPError(503, 'Service temporarily unavailable', headers);
  }

  /**
   * Simulate intermittent failures
   */
  simulateIntermittentFailures(
    failureRate: number = 0.5,
    successResponse: any = { candidates: [{ content: { parts: [{ text: '0:85' }] } }] }
  ): void {
    this.mockAxios.post = jest.fn().mockImplementation(() => {
      if (Math.random() < failureRate) {
        return Promise.reject(new Error('Intermittent API failure'));
      }
      return Promise.resolve({
        status: 200,
        statusText: 'OK',
        data: successResponse,
        headers: {},
        config: {}
      });
    });
  }

  /**
   * Simulate progressive degradation
   */
  simulateProgressiveDegradation(stages: Array<{ calls: number; errorRate: number }>): void {
    let callCount = 0;

    this.mockAxios.post = jest.fn().mockImplementation(() => {
      callCount++;
      
      for (const stage of stages) {
        if (callCount <= stage.calls) {
          if (Math.random() < stage.errorRate) {
            return Promise.reject(new Error(`Stage ${stage.calls} failure`));
          }
          break;
        }
      }

      return Promise.resolve({
        status: 200,
        data: { candidates: [{ content: { parts: [{ text: '0:90' }] } }] },
        headers: {},
        config: {}
      });
    });
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    return statusTexts[status] || 'Unknown Error';
  }

  /**
   * Restore original axios behavior
   */
  restore(): void {
    if (this.originalPost && this.mockAxios) {
      this.mockAxios.post = this.originalPost;
    }
  }
}

/**
 * UI Error Simulator
 * Utilities for simulating UI and component errors
 */
export class UIErrorSimulator {
  /**
   * Create an error-throwing React component
   */
  static createFailingComponent(errorType: 'render' | 'effect' | 'event', errorMessage?: string): React.FC<any> {
    return function FailingComponent(props: any) {
      const message = errorMessage || `${errorType} error occurred`;

      if (errorType === 'render') {
        throw new Error(message);
      }

      if (errorType === 'effect') {
        React.useEffect(() => {
          throw new Error(message);
        }, []);
      }

      const handleClick = () => {
        if (errorType === 'event') {
          throw new Error(message);
        }
      };

      return React.createElement('button', {
        onClick: handleClick,
        'data-testid': 'failing-component'
      }, 'Click me');
    };
  }

  /**
   * Mock IPC failures
   */
  static mockIPCFailure(
    errorType: 'timeout' | 'network' | 'validation' | 'unavailable',
    window: Window & typeof globalThis
  ): void {
    const electronAPI = (window as any).electronAPI || {};
    
    const errorMap = {
      timeout: new AppError(ErrorCode.TIMEOUT_ERROR, 'IPC operation timed out'),
      network: new AppError(ErrorCode.NETWORK_ERROR, 'IPC network error'),
      validation: new AppError(ErrorCode.VALIDATION_ERROR, 'IPC validation error'),
      unavailable: new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'IPC service unavailable')
    };

    Object.keys(electronAPI).forEach(method => {
      if (typeof electronAPI[method] === 'function') {
        electronAPI[method] = jest.fn().mockRejectedValue(errorMap[errorType]);
      }
    });
  }

  /**
   * Simulate memory pressure
   */
  static simulateMemoryPressure(): () => void {
    const largeObjects: any[] = [];

    // Allocate memory
    for (let i = 0; i < 100; i++) {
      largeObjects.push(new Array(10000).fill(`memory-pressure-${i}`));
    }

    // Return cleanup function
    return () => {
      largeObjects.length = 0;
      if (global.gc) {
        global.gc();
      }
    };
  }
}

// =============================================================================
// ERROR VALIDATION UTILITIES
// =============================================================================

/**
 * Error Validator
 * Utilities for validating error handling behavior
 */
export class ErrorValidator {
  /**
   * Validate that an error has proper AppError structure
   */
  static validateAppError(error: any, expectedCode?: ErrorCode, expectedSeverity?: ErrorSeverity): boolean {
    if (!(error instanceof AppError)) {
      return false;
    }

    if (expectedCode && error.code !== expectedCode) {
      return false;
    }

    if (expectedSeverity && error.severity !== expectedSeverity) {
      return false;
    }

    return (
      typeof error.message === 'string' &&
      typeof error.code === 'string' &&
      typeof error.severity === 'string' &&
      typeof error.timestamp === 'object' &&
      error.timestamp instanceof Date &&
      typeof error.correlationId === 'string' &&
      typeof error.retryable === 'boolean' &&
      typeof error.userVisible === 'boolean'
    );
  }

  /**
   * Validate error logging output
   */
  static validateErrorLogging(consoleSpy: jest.SpyInstance, expectedLevel: 'error' | 'warn' | 'info' = 'error'): boolean {
    return consoleSpy.mock.calls.some(call => {
      const logLevel = call[0];
      return typeof logLevel === 'string' && logLevel.includes(expectedLevel);
    });
  }

  /**
   * Validate fallback mechanism activation
   */
  static validateFallback(result: any, fallbackIndicator: any): boolean {
    if (Array.isArray(result) && result.length > 0) {
      return result[0].matchType === 'fuzzy' || result[0].hasOwnProperty(fallbackIndicator);
    }
    return result && typeof result === 'object' && result.hasOwnProperty(fallbackIndicator);
  }

  /**
   * Validate error recovery
   */
  static validateRecovery(
    initialState: any,
    finalState: any,
    expectedRecoveryTime: number = 5000
  ): { recovered: boolean; recoveryTime: number } {
    const startTime = Date.now();
    const recovered = JSON.stringify(finalState) === JSON.stringify(initialState);
    const recoveryTime = Date.now() - startTime;

    return {
      recovered,
      recoveryTime: Math.min(recoveryTime, expectedRecoveryTime)
    };
  }

  /**
   * Validate circuit breaker state
   */
  static validateCircuitBreaker(
    breaker: { getState(): string },
    expectedState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  ): boolean {
    return breaker.getState() === expectedState;
  }
}

// =============================================================================
// TEST DATA GENERATORS
// =============================================================================

/**
 * Test Data Generator
 * Generates test data for error scenarios
 */
export class TestDataGenerator {
  /**
   * Generate test KB entries
   */
  static generateKBEntries(count: number = 10): KBEntry[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-entry-${i}`,
      title: `Test Entry ${i}`,
      problem: `This is test problem ${i} description`,
      solution: `This is test solution ${i} steps`,
      category: ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'][i % 5],
      severity: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
      tags: [`tag-${i}`, `category-${i % 3}`, 'test'],
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 80),
      failure_count: Math.floor(Math.random() * 20)
    }));
  }

  /**
   * Generate corrupted KB entry
   */
  static generateCorruptedKBEntry(): Partial<KBEntry> {
    return {
      id: null as any,
      title: undefined as any,
      problem: '',
      solution: '',
      category: 'INVALID_CATEGORY' as any,
      tags: null as any
    };
  }

  /**
   * Generate large test data (for memory pressure testing)
   */
  static generateLargeTestData(sizeInMB: number = 10): string[] {
    const data: string[] = [];
    const itemSize = 1024; // 1KB per item
    const itemCount = (sizeInMB * 1024 * 1024) / itemSize;

    for (let i = 0; i < itemCount; i++) {
      data.push('x'.repeat(itemSize));
    }

    return data;
  }

  /**
   * Generate malformed search queries
   */
  static generateMalformedQueries(): string[] {
    return [
      '', // Empty query
      ' '.repeat(1000), // Whitespace only
      'SELECT * FROM users; DROP TABLE users;', // SQL injection attempt
      '<script>alert("xss")</script>', // XSS attempt
      '\x00\x01\x02', // Binary data
      'query'.repeat(10000), // Extremely long query
      '((((((((((', // Unbalanced parentheses
      'query WITH special"characters\' AND symbols',
      undefined as any,
      null as any,
      123 as any
    ];
  }
}

// =============================================================================
// RECOVERY TEST HELPERS
// =============================================================================

/**
 * Recovery Test Helper
 * Utilities for testing recovery mechanisms
 */
export class RecoveryTestHelper {
  /**
   * Test retry mechanism with exponential backoff
   */
  static async testRetryWithBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 100
  ): Promise<{ result?: T; attempts: number; totalTime: number; success: boolean }> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts++;
      try {
        const result = await operation();
        return {
          result,
          attempts,
          totalTime: Date.now() - startTime,
          success: true
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      attempts,
      totalTime: Date.now() - startTime,
      success: false
    };
  }

  /**
   * Test circuit breaker pattern
   */
  static async testCircuitBreaker(
    breaker: { execute<T>(fn: () => Promise<T>): Promise<T>; getState(): string },
    operation: () => Promise<any>,
    failureThreshold: number = 3
  ): Promise<{ states: string[]; failures: number; successes: number }> {
    const states: string[] = [];
    let failures = 0;
    let successes = 0;

    // Trigger failures to open circuit
    for (let i = 0; i < failureThreshold + 2; i++) {
      try {
        await breaker.execute(operation);
        successes++;
      } catch (error) {
        failures++;
      }
      states.push(breaker.getState());
    }

    return { states, failures, successes };
  }

  /**
   * Test graceful degradation
   */
  static async testGracefulDegradation(
    primaryOperation: () => Promise<any>,
    fallbackOperation: () => Promise<any>,
    errorTypes: string[] = ['NETWORK_ERROR', 'SERVICE_UNAVAILABLE']
  ): Promise<{ primaryFailed: boolean; fallbackSucceeded: boolean; errorType?: string }> {
    let primaryFailed = false;
    let fallbackSucceeded = false;
    let errorType: string | undefined;

    try {
      await primaryOperation();
    } catch (error) {
      primaryFailed = true;
      errorType = (error as Error).message;

      try {
        await fallbackOperation();
        fallbackSucceeded = true;
      } catch (fallbackError) {
        fallbackSucceeded = false;
      }
    }

    return { primaryFailed, fallbackSucceeded, errorType };
  }
}

// =============================================================================
// PERFORMANCE MONITORING UTILITIES
// =============================================================================

/**
 * Performance Monitor
 * Monitors performance during error scenarios
 */
export class ErrorPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  /**
   * Start monitoring an operation
   */
  startOperation(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      
      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }
      
      this.metrics.get(name)!.push(duration);
    };
  }

  /**
   * Get performance statistics
   */
  getStats(operationName: string): { 
    count: number; 
    avg: number; 
    min: number; 
    max: number; 
    p95: number; 
  } | null {
    const timings = this.metrics.get(operationName);
    if (!timings || timings.length === 0) {
      return null;
    }

    const sorted = timings.slice().sort((a, b) => a - b);
    const sum = timings.reduce((a, b) => a + b, 0);

    return {
      count: timings.length,
      avg: sum / timings.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, timings] of this.metrics.entries()) {
      result[name] = this.getStats(name);
    }
    
    return result;
  }
}

// =============================================================================
// MOCK FACTORY
// =============================================================================

/**
 * Mock Factory
 * Creates various mocks for error testing
 */
export class MockFactory {
  /**
   * Create a mock database with controllable failures
   */
  static createMockDatabase(failureModes: string[] = []): {
    db: any;
    simulator: DatabaseErrorSimulator;
  } {
    const mockDb = {
      prepare: jest.fn(),
      exec: jest.fn(),
      transaction: jest.fn(),
      close: jest.fn(),
      pragma: jest.fn()
    };

    const simulator = new DatabaseErrorSimulator(mockDb as any);

    // Configure failure modes
    failureModes.forEach(mode => {
      switch (mode) {
        case 'connection':
          simulator.simulateConnectionError();
          break;
        case 'corruption':
          simulator.simulateCorruption();
          break;
        case 'diskfull':
          simulator.simulateDiskFull();
          break;
        case 'constraint':
          simulator.simulateConstraintViolation();
          break;
      }
    });

    return { db: mockDb, simulator };
  }

  /**
   * Create a mock Gemini service with controllable failures
   */
  static createMockGeminiService(failureModes: string[] = []): {
    service: GeminiService;
    simulator: APIErrorSimulator;
  } {
    const service = new GeminiService({ apiKey: 'test-key' });
    const simulator = new APIErrorSimulator();

    // Configure failure modes
    failureModes.forEach(mode => {
      switch (mode) {
        case 'network':
          simulator.simulateNetworkError();
          break;
        case 'auth':
          simulator.simulateAuthError();
          break;
        case 'ratelimit':
          simulator.simulateRateLimit();
          break;
        case 'malformed':
          simulator.simulateMalformedResponse();
          break;
      }
    });

    return { service, simulator };
  }
}

// Export all utilities
export {
  DatabaseErrorSimulator,
  APIErrorSimulator,
  UIErrorSimulator,
  ErrorValidator,
  TestDataGenerator,
  RecoveryTestHelper,
  ErrorPerformanceMonitor,
  MockFactory
};