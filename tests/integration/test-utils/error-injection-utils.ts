import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';

/**
 * Utility function to create a temporary test database
 */
export async function createTestDB(): Promise<string> {
  const testDir = path.join(__dirname, '..', '..', 'temp');
  await fs.mkdir(testDir, { recursive: true });
  
  const dbPath = path.join(testDir, `test-${randomBytes(8).toString('hex')}.db`);
  
  // Create a basic database with schema
  const db = new Database(dbPath);
  
  try {
    // Basic schema for testing
    db.exec(`
      CREATE TABLE IF NOT EXISTS kb_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        category TEXT CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS kb_tags (
        entry_id TEXT,
        tag TEXT,
        PRIMARY KEY (entry_id, tag),
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT,
        action TEXT CHECK(action IN ('view', 'copy', 'rate_success', 'rate_failure')),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        session_id TEXT,
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id)
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_category ON kb_entries(category);
      CREATE INDEX IF NOT EXISTS idx_usage ON kb_entries(usage_count DESC);
      CREATE INDEX IF NOT EXISTS idx_created_at ON kb_entries(created_at DESC);
    `);
  } finally {
    db.close();
  }
  
  return dbPath;
}

/**
 * Clean up test database
 */
export async function cleanupTestDB(dbPath: string): Promise<void> {
  try {
    await fs.unlink(dbPath);
  } catch (error) {
    // Ignore if file doesn't exist
  }
  
  // Also clean up any backup files
  const dir = path.dirname(dbPath);
  const baseName = path.basename(dbPath, '.db');
  
  try {
    const files = await fs.readdir(dir);
    const relatedFiles = files.filter(file => 
      file.startsWith(baseName) && (file.endsWith('.backup') || file.endsWith('.tmp'))
    );
    
    for (const file of relatedFiles) {
      try {
        await fs.unlink(path.join(dir, file));
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    // Ignore if directory doesn't exist
  }
}

/**
 * Wait for a specified amount of time
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Inject various types of errors for testing
 */
export async function injectError(type: 'memory' | 'disk' | 'network' | 'corruption'): Promise<void> {
  switch (type) {
    case 'memory':
      // Create memory pressure
      const memoryConsumer: any[] = [];
      try {
        while (memoryConsumer.length < 10000) {
          memoryConsumer.push(new Array(1000).fill('memory-pressure-test'));
        }
      } catch (error) {
        // Expected to fail with out of memory
      }
      break;
      
    case 'disk':
      // Simulate disk space issues by trying to write large files
      const tempDir = path.join(__dirname, '..', '..', 'temp');
      const largePath = path.join(tempDir, 'large-file.tmp');
      
      try {
        const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
        await fs.writeFile(largePath, largeBuffer);
      } catch (error) {
        // Expected to fail if disk is full
      } finally {
        try {
          await fs.unlink(largePath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      break;
      
    case 'network':
      // Simulate network issues by making requests to invalid endpoints
      const invalidEndpoints = [
        'http://nonexistent-host-for-testing.invalid',
        'http://timeout-test.invalid',
        'http://127.0.0.1:99999' // Invalid port
      ];
      
      const promises = invalidEndpoints.map(async (endpoint) => {
        try {
          const response = await fetch(endpoint, { 
            method: 'GET',
            signal: AbortSignal.timeout(1000)
          });
          return response;
        } catch (error) {
          // Expected network errors
          throw error;
        }
      });
      
      await Promise.allSettled(promises);
      break;
      
    case 'corruption':
      throw new Error('Database corruption simulation requires specific file path');
      
    default:
      throw new Error(`Unknown error injection type: ${type}`);
  }
}

/**
 * Create large payload for memory/performance testing
 */
export function createLargePayload(size: number, prefix: string = 'data'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = `${prefix}-`;
  
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Simulate specific failure types
 */
export async function simulateFailure(target: string, failureType: 'corruption' | 'permission' | 'lock' | 'timeout'): Promise<void> {
  switch (failureType) {
    case 'corruption':
      if (target === 'network') {
        // Simulate network partition
        await waitFor(100);
        return;
      }
      
      // Corrupt database file
      try {
        const stats = await fs.stat(target);
        if (stats.isFile()) {
          // Append random data to corrupt the file
          const corruptData = randomBytes(1024);
          await fs.appendFile(target, corruptData);
        }
      } catch (error) {
        throw new Error(`Failed to corrupt file ${target}: ${error.message}`);
      }
      break;
      
    case 'permission':
      try {
        await fs.chmod(target, 0o000); // No permissions
      } catch (error) {
        throw new Error(`Failed to change permissions for ${target}: ${error.message}`);
      }
      break;
      
    case 'lock':
      // Create a lock file to simulate resource locking
      const lockFile = `${target}.lock`;
      try {
        await fs.writeFile(lockFile, process.pid.toString());
      } catch (error) {
        throw new Error(`Failed to create lock file ${lockFile}: ${error.message}`);
      }
      break;
      
    case 'timeout':
      // Simulate timeout by creating artificial delay
      await waitFor(5000);
      break;
      
    default:
      throw new Error(`Unknown failure type: ${failureType}`);
  }
}

/**
 * Recovery Monitor for tracking recovery attempts and metrics
 */
export class RecoveryMonitor extends EventEmitter {
  private recoveryAttempts: Map<string, number> = new Map();
  private recoveryTimes: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  startRecovery(identifier: string): void {
    this.startTimes.set(identifier, Date.now());
    const attempts = this.recoveryAttempts.get(identifier) || 0;
    this.recoveryAttempts.set(identifier, attempts + 1);
    
    this.emit('recoveryStarted', { identifier, attempt: attempts + 1 });
  }

  completeRecovery(identifier: string, successful: boolean): void {
    const startTime = this.startTimes.get(identifier);
    if (startTime) {
      const duration = Date.now() - startTime;
      
      if (!this.recoveryTimes.has(identifier)) {
        this.recoveryTimes.set(identifier, []);
      }
      this.recoveryTimes.get(identifier)!.push(duration);
      
      this.startTimes.delete(identifier);
      
      this.emit('recoveryCompleted', {
        identifier,
        successful,
        duration,
        totalAttempts: this.recoveryAttempts.get(identifier) || 0
      });
    }
  }

  getRecoveryStats(identifier: string): {
    attempts: number;
    averageTime: number;
    totalRecoveries: number;
    successRate: number;
  } {
    const attempts = this.recoveryAttempts.get(identifier) || 0;
    const times = this.recoveryTimes.get(identifier) || [];
    const averageTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    
    return {
      attempts,
      averageTime,
      totalRecoveries: times.length,
      successRate: attempts > 0 ? times.length / attempts : 0
    };
  }

  getAllStats(): Record<string, ReturnType<typeof this.getRecoveryStats>> {
    const stats: Record<string, ReturnType<typeof this.getRecoveryStats>> = {};
    
    for (const identifier of this.recoveryAttempts.keys()) {
      stats[identifier] = this.getRecoveryStats(identifier);
    }
    
    return stats;
  }

  reset(): void {
    this.recoveryAttempts.clear();
    this.recoveryTimes.clear();
    this.startTimes.clear();
    this.removeAllListeners();
  }
}

/**
 * Error Pattern Generator for creating predictable error scenarios
 */
export class ErrorPatternGenerator {
  private patterns: Map<string, () => boolean> = new Map();

  /**
   * Create a pattern that fails with specified rate
   */
  createFailureRatePattern(name: string, failureRate: number): void {
    this.patterns.set(name, () => Math.random() < failureRate);
  }

  /**
   * Create a pattern that fails in bursts
   */
  createBurstPattern(name: string, burstSize: number, burstInterval: number): void {
    let counter = 0;
    this.patterns.set(name, () => {
      counter++;
      const position = counter % (burstSize + burstInterval);
      return position < burstSize;
    });
  }

  /**
   * Create a pattern that alternates between success and failure
   */
  createAlternatingPattern(name: string, successCount: number, failureCount: number): void {
    let counter = 0;
    this.patterns.set(name, () => {
      counter++;
      const cyclePosition = counter % (successCount + failureCount);
      return cyclePosition >= successCount;
    });
  }

  /**
   * Create a pattern that degrades over time
   */
  createDegradingPattern(name: string, initialSuccessRate: number, degradationRate: number): void {
    let requestCount = 0;
    this.patterns.set(name, () => {
      requestCount++;
      const currentSuccessRate = Math.max(0, initialSuccessRate - (requestCount * degradationRate));
      return Math.random() >= currentSuccessRate;
    });
  }

  /**
   * Check if the pattern should fail for the current request
   */
  shouldFail(patternName: string): boolean {
    const pattern = this.patterns.get(patternName);
    if (!pattern) {
      throw new Error(`Pattern ${patternName} not found`);
    }
    return pattern();
  }

  /**
   * Remove a pattern
   */
  removePattern(name: string): void {
    this.patterns.delete(name);
  }

  /**
   * Clear all patterns
   */
  clearPatterns(): void {
    this.patterns.clear();
  }

  /**
   * Get all pattern names
   */
  getPatternNames(): string[] {
    return Array.from(this.patterns.keys());
  }
}

/**
 * Resource Monitor for tracking resource usage during error scenarios
 */
export class ResourceMonitor {
  private startTime: number = Date.now();
  private memorySnapshots: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];
  private interval: NodeJS.Timeout | null = null;

  start(intervalMs: number = 1000): void {
    this.startTime = Date.now();
    this.memorySnapshots = [];
    
    this.interval = setInterval(() => {
      this.memorySnapshots.push({
        timestamp: Date.now(),
        usage: process.memoryUsage()
      });
    }, intervalMs);
  }

  stop(): {
    duration: number;
    peakMemory: number;
    averageMemory: number;
    memoryGrowth: number;
    snapshots: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }>;
  } {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    const duration = Date.now() - this.startTime;
    const memoryValues = this.memorySnapshots.map(s => s.usage.heapUsed);
    
    const peakMemory = Math.max(...memoryValues);
    const averageMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
    const memoryGrowth = memoryValues.length > 1 ? 
      memoryValues[memoryValues.length - 1] - memoryValues[0] : 0;

    return {
      duration,
      peakMemory,
      averageMemory,
      memoryGrowth,
      snapshots: [...this.memorySnapshots]
    };
  }

  getCurrentMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }
}

/**
 * Chaos Testing Utilities
 */
export class ChaosEngine {
  private isActive: boolean = false;
  private chaosInterval: NodeJS.Timeout | null = null;
  private chaosActions: Array<() => Promise<void>> = [];

  addChaosAction(action: () => Promise<void>): void {
    this.chaosActions.push(action);
  }

  start(intervalMs: number = 5000): void {
    this.isActive = true;
    
    this.chaosInterval = setInterval(async () => {
      if (this.chaosActions.length > 0) {
        const randomAction = this.chaosActions[
          Math.floor(Math.random() * this.chaosActions.length)
        ];
        
        try {
          await randomAction();
        } catch (error) {
          // Chaos actions are expected to potentially fail
          console.warn('Chaos action failed:', error.message);
        }
      }
    }, intervalMs);
  }

  stop(): void {
    this.isActive = false;
    
    if (this.chaosInterval) {
      clearInterval(this.chaosInterval);
      this.chaosInterval = null;
    }
  }

  isRunning(): boolean {
    return this.isActive;
  }

  clearActions(): void {
    this.chaosActions = [];
  }
}

/**
 * Test Data Generators
 */
export const TestDataGenerators = {
  /**
   * Generate test KB entries with various patterns
   */
  generateKBEntries(count: number, pattern: 'simple' | 'complex' | 'large' = 'simple'): Array<{
    title: string;
    problem: string;
    solution: string;
    category: string;
    tags: string[];
  }> {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];
    const entries = [];

    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length];
      const baseTitle = `Test Entry ${i + 1}`;
      
      let entry;
      switch (pattern) {
        case 'simple':
          entry = {
            title: baseTitle,
            problem: `Simple test problem ${i + 1}`,
            solution: `Simple test solution ${i + 1}`,
            category,
            tags: [`tag-${i}`, category.toLowerCase()]
          };
          break;
          
        case 'complex':
          entry = {
            title: `${baseTitle} - Complex Scenario`,
            problem: `Complex test problem ${i + 1} with multiple steps and conditions. ` +
                    `This involves several system components and requires careful analysis. ` +
                    `The issue manifests under specific conditions and may have multiple root causes.`,
            solution: `Complex test solution ${i + 1} with detailed steps:\n` +
                     `1. Analyze the initial conditions\n` +
                     `2. Check system logs for related errors\n` +
                     `3. Verify configuration settings\n` +
                     `4. Apply corrective measures\n` +
                     `5. Monitor for resolution`,
            category,
            tags: [`tag-${i}`, category.toLowerCase(), 'complex', 'multi-step']
          };
          break;
          
        case 'large':
          entry = {
            title: baseTitle,
            problem: createLargePayload(1000, `problem-${i}`),
            solution: createLargePayload(1000, `solution-${i}`),
            category,
            tags: [`tag-${i}`, category.toLowerCase(), 'large-data']
          };
          break;
      }
      
      entries.push(entry);
    }

    return entries;
  },

  /**
   * Generate test metrics data
   */
  generateMetricsData(entryIds: string[], eventCount: number): Array<{
    entry_id: string;
    action: string;
    user_id: string;
    timestamp: Date;
  }> {
    const actions = ['view', 'copy', 'rate_success', 'rate_failure'];
    const users = ['user1', 'user2', 'user3', 'admin', 'test-user'];
    const events = [];

    for (let i = 0; i < eventCount; i++) {
      const entryId = entryIds[Math.floor(Math.random() * entryIds.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const userId = users[Math.floor(Math.random() * users.length)];
      const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days

      events.push({
        entry_id: entryId,
        action,
        user_id: userId,
        timestamp
      });
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
};

/**
 * Utility to validate error handling patterns
 */
export function validateErrorHandling(error: any, expectedPattern: {
  type?: any;
  code?: string;
  message?: RegExp | string;
  severity?: string;
  retryable?: boolean;
}): boolean {
  if (expectedPattern.type && !(error instanceof expectedPattern.type)) {
    return false;
  }

  if (expectedPattern.code && error.code !== expectedPattern.code) {
    return false;
  }

  if (expectedPattern.message) {
    if (expectedPattern.message instanceof RegExp) {
      if (!expectedPattern.message.test(error.message)) {
        return false;
      }
    } else {
      if (error.message !== expectedPattern.message) {
        return false;
      }
    }
  }

  if (expectedPattern.severity && error.severity !== expectedPattern.severity) {
    return false;
  }

  if (expectedPattern.retryable !== undefined && error.retryable !== expectedPattern.retryable) {
    return false;
  }

  return true;
}