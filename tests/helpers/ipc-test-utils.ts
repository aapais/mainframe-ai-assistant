/**
 * IPC Test Utilities
 * 
 * Helper functions and utilities for testing IPC functionality
 * including mocks, assertions, and test setup/teardown helpers.
 */

import { EventEmitter } from 'events';
import { 
  BaseIPCRequest, 
  BaseIPCResponse, 
  IPCError, 
  IPCErrorCode,
  IPCChannel 
} from '../../src/types/ipc';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { MultiLayerCacheManager } from '../../src/caching/MultiLayerCacheManager';

// ===========================
// Mock Classes
// ===========================

export class MockIPCMain extends EventEmitter {
  private handlers: Map<string, Function> = new Map();
  private callHistory: Array<{ channel: string; data: any; timestamp: number }> = [];

  handle(channel: string, handler: Function) {
    this.handlers.set(channel, handler);
    this.callHistory.push({
      channel,
      data: { type: 'register' },
      timestamp: Date.now()
    });
  }

  invoke(channel: string, data: any): Promise<any> {
    const handler = this.handlers.get(channel);
    this.callHistory.push({ channel, data, timestamp: Date.now() });
    
    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`);
    }
    
    try {
      const result = handler(data);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  removeHandler(channel: string) {
    this.handlers.delete(channel);
  }

  removeAllListeners(channel?: string) {
    if (channel) {
      this.handlers.delete(channel);
    } else {
      this.handlers.clear();
    }
    super.removeAllListeners(channel);
  }

  getCallHistory() {
    return [...this.callHistory];
  }

  clearCallHistory() {
    this.callHistory = [];
  }

  getRegisteredChannels() {
    return Array.from(this.handlers.keys());
  }
}

export class MockBrowserWindow extends EventEmitter {
  public webContents = new MockWebContents();
  
  constructor(options?: any) {
    super();
  }

  send(channel: string, data: any) {
    this.webContents.send(channel, data);
  }

  isDestroyed() {
    return false;
  }
}

export class MockWebContents extends EventEmitter {
  send(channel: string, data: any) {
    this.emit('send', { channel, data });
  }

  executeJavaScript(code: string) {
    return Promise.resolve();
  }
}

export class MockKnowledgeDB {
  private entries: Map<string, any> = new Map();
  private operationDelay = 0;

  constructor(entries: any[] = [], delay = 0) {
    entries.forEach(entry => this.entries.set(entry.id, entry));
    this.operationDelay = delay;
  }

  async search(query: string, options: any = {}): Promise<any[]> {
    await this.delay();
    const results = Array.from(this.entries.values())
      .filter(entry => 
        entry.title?.includes(query) || 
        entry.problem?.includes(query) ||
        entry.solution?.includes(query)
      );
    return results.slice(0, options.limit || 10);
  }

  async addEntry(entry: any): Promise<string> {
    await this.delay();
    const id = entry.id || `mock-${Date.now()}`;
    this.entries.set(id, { ...entry, id });
    return id;
  }

  async getEntry(id: string): Promise<any | null> {
    await this.delay();
    return this.entries.get(id) || null;
  }

  async updateEntry(id: string, updates: any): Promise<void> {
    await this.delay();
    const entry = this.entries.get(id);
    if (!entry) throw new Error('Entry not found');
    this.entries.set(id, { ...entry, ...updates });
  }

  async deleteEntry(id: string): Promise<void> {
    await this.delay();
    if (!this.entries.has(id)) throw new Error('Entry not found');
    this.entries.delete(id);
  }

  async recordUsage(entryId: string, successful: boolean): Promise<void> {
    await this.delay();
    const entry = this.entries.get(entryId);
    if (entry) {
      entry.usage_count = (entry.usage_count || 0) + 1;
      if (successful) {
        entry.success_count = (entry.success_count || 0) + 1;
      } else {
        entry.failure_count = (entry.failure_count || 0) + 1;
      }
    }
  }

  async getMetrics(): Promise<any> {
    await this.delay();
    return {
      totalEntries: this.entries.size,
      totalUsage: Array.from(this.entries.values())
        .reduce((sum, entry) => sum + (entry.usage_count || 0), 0)
    };
  }

  private async delay(): Promise<void> {
    if (this.operationDelay > 0) {
      return new Promise(resolve => setTimeout(resolve, this.operationDelay));
    }
  }
}

export class MockCacheManager {
  private cache: Map<string, any> = new Map();
  private hitCount = 0;
  private missCount = 0;

  async get(key: string): Promise<any> {
    if (this.cache.has(key)) {
      this.hitCount++;
      return this.cache.get(key);
    } else {
      this.missCount++;
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.cache.set(key, value);
    if (ttl) {
      setTimeout(() => this.cache.delete(key), ttl * 1000);
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  getStats() {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      size: this.cache.size
    };
  }
}

// ===========================
// Test Utilities
// ===========================

export class IPCTestEnvironment {
  public ipcMain: MockIPCMain;
  public browserWindow: MockBrowserWindow;
  public knowledgeDB: MockKnowledgeDB;
  public cacheManager: MockCacheManager;

  constructor() {
    this.ipcMain = new MockIPCMain();
    this.browserWindow = new MockBrowserWindow();
    this.knowledgeDB = new MockKnowledgeDB();
    this.cacheManager = new MockCacheManager();
  }

  reset() {
    this.ipcMain.removeAllListeners();
    this.ipcMain.clearCallHistory();
    this.browserWindow.removeAllListeners();
    this.knowledgeDB = new MockKnowledgeDB();
    this.cacheManager.clear();
  }

  async setupTestData(entries: any[] = []) {
    for (const entry of entries) {
      await this.knowledgeDB.addEntry(entry);
    }
  }
}

// ===========================
// Assertion Helpers
// ===========================

export function assertValidIPCRequest(request: any): asserts request is BaseIPCRequest {
  expect(request).toBeDefined();
  expect(request.requestId).toEqual(expect.any(String));
  expect(request.timestamp).toEqual(expect.any(Number));
  expect(request.channel).toEqual(expect.any(String));
  expect(request.version).toEqual(expect.any(String));
}

export function assertValidIPCResponse<T = any>(response: any): asserts response is BaseIPCResponse<T> {
  expect(response).toBeDefined();
  expect(response.success).toEqual(expect.any(Boolean));
  expect(response.requestId).toEqual(expect.any(String));
  expect(response.timestamp).toEqual(expect.any(Number));
  expect(response.executionTime).toEqual(expect.any(Number));
  
  if (response.success) {
    expect(response.data).toBeDefined();
    expect(response.error).toBeUndefined();
  } else {
    expect(response.error).toBeDefined();
    assertValidIPCError(response.error);
  }
}

export function assertValidIPCError(error: any): asserts error is IPCError {
  expect(error).toBeDefined();
  expect(error.code).toEqual(expect.any(String));
  expect(error.message).toEqual(expect.any(String));
  expect(error.severity).toMatch(/^(low|medium|high|critical)$/);
  expect(error.retryable).toEqual(expect.any(Boolean));
}

export function assertPerformanceMetrics(executionTime: number, maxTime: number) {
  expect(executionTime).toBeGreaterThan(0);
  expect(executionTime).toBeLessThan(maxTime);
}

export function assertSecurityValidation(response: BaseIPCResponse, shouldFail: boolean = true) {
  if (shouldFail) {
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect([
      IPCErrorCode.VALIDATION_ERROR,
      IPCErrorCode.SECURITY_VIOLATION,
      IPCErrorCode.UNAUTHORIZED
    ]).toContain(response.error?.code);
  }
}

// ===========================
// Performance Testing
// ===========================

export class PerformanceTracker {
  private measurements: Array<{
    operation: string;
    startTime: number;
    endTime: number;
    duration: number;
  }> = [];

  start(operation: string): string {
    const id = `${operation}-${Date.now()}-${Math.random()}`;
    this.measurements.push({
      operation: id,
      startTime: performance.now(),
      endTime: 0,
      duration: 0
    });
    return id;
  }

  end(operation: string): number {
    const measurement = this.measurements.find(m => m.operation === operation);
    if (!measurement) {
      throw new Error(`Performance measurement not found: ${operation}`);
    }
    
    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;
    return measurement.duration;
  }

  getResults() {
    return this.measurements.map(m => ({
      operation: m.operation,
      duration: m.duration
    }));
  }

  getStats() {
    const durations = this.measurements.map(m => m.duration);
    return {
      count: durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      total: durations.reduce((sum, d) => sum + d, 0)
    };
  }

  reset() {
    this.measurements = [];
  }
}

// ===========================
// Load Testing
// ===========================

export class LoadTestRunner {
  private results: Array<{
    requestId: string;
    startTime: number;
    endTime: number;
    success: boolean;
    error?: string;
  }> = [];

  async runConcurrentRequests<T>(
    requests: Array<() => Promise<T>>,
    maxConcurrency: number = 10
  ): Promise<LoadTestResults> {
    const chunks = this.chunkArray(requests, maxConcurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (request, index) => {
        const requestId = `req-${Date.now()}-${index}`;
        const startTime = performance.now();
        
        try {
          await request();
          this.results.push({
            requestId,
            startTime,
            endTime: performance.now(),
            success: true
          });
        } catch (error) {
          this.results.push({
            requestId,
            startTime,
            endTime: performance.now(),
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
      
      await Promise.all(promises);
    }
    
    return this.getLoadTestResults();
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private getLoadTestResults(): LoadTestResults {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const durations = this.results.map(r => r.endTime - r.startTime);

    return {
      total: this.results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: successful.length / this.results.length,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      errors: failed.map(f => f.error || 'Unknown error')
    };
  }

  reset() {
    this.results = [];
  }
}

export interface LoadTestResults {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  errors: string[];
}

// ===========================
// Test Cleanup
// ===========================

export function createTestCleanup() {
  const cleanupTasks: Array<() => Promise<void> | void> = [];

  return {
    add(task: () => Promise<void> | void) {
      cleanupTasks.push(task);
    },

    async cleanup() {
      for (const task of cleanupTasks.reverse()) {
        try {
          await task();
        } catch (error) {
          console.warn('Cleanup task failed:', error);
        }
      }
      cleanupTasks.length = 0;
    }
  };
}

// ===========================
// Helper Functions
// ===========================

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function expectWithinTime(duration: number, maxTime: number, operation: string) {
  expect(duration).toBeLessThan(maxTime);
  if (duration > maxTime * 0.8) {
    console.warn(`${operation} took ${duration}ms, approaching limit of ${maxTime}ms`);
  }
}