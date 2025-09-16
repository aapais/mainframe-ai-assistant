/**
 * Jest Global Setup
 * Initializes test environment and resources for comprehensive testing
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

// Global test configuration
interface TestConfig {
  startTime: number;
  memorySnapshot: NodeJS.MemoryUsage;
  testResults: {
    performance: Map<string, number>;
    coverage: Map<string, number>;
    accessibility: Map<string, any>;
  };
}

declare global {
  var __TEST_CONFIG__: TestConfig;
}

export default async function globalSetup() {
  console.log('🏗️ Setting up comprehensive test environment...\n');

  const startTime = performance.now();
  const memorySnapshot = process.memoryUsage();

  // Initialize global test configuration
  global.__TEST_CONFIG__ = {
    startTime,
    memorySnapshot,
    testResults: {
      performance: new Map(),
      coverage: new Map(),
      accessibility: new Map()
    }
  };

  // Create coverage and reports directories
  const directories = [
    'coverage',
    'coverage/html-report',
    'coverage/accessibility',
    'coverage/performance',
    'tests/reports'
  ];

  directories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  // Setup test database for service tests
  await setupTestDatabase();

  // Initialize performance monitoring
  setupPerformanceMonitoring();

  // Setup accessibility testing configuration
  setupAccessibilityTesting();

  // Setup error tracking
  setupErrorTracking();

  // Environment validation
  validateTestEnvironment();

  const setupTime = performance.now() - startTime;
  console.log(`✅ Test environment setup completed in ${setupTime.toFixed(2)}ms\n`);
}

async function setupTestDatabase() {
  console.log('💾 Setting up test database...');

  const testDbPath = path.join(process.cwd(), 'tests/data/test.db');
  const testDbDir = path.dirname(testDbPath);

  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }

  // Create test database schema if needed
  if (!fs.existsSync(testDbPath)) {
    const schemaPath = path.join(process.cwd(), 'src/database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlite3 = require('better-sqlite3');
      const db = sqlite3(testDbPath);
      const schema = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schema);
      db.close();
    }
  }

  // Seed test data
  await seedTestData(testDbPath);

  console.log('  ✓ Test database ready');
}

async function seedTestData(dbPath: string) {
  const testDataPath = path.join(process.cwd(), 'tests/data/test-kb-entries.json');

  if (fs.existsSync(testDataPath)) {
    const sqlite3 = require('better-sqlite3');
    const db = sqlite3(dbPath);

    const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));

    // Insert test KB entries
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO kb_entries
      (id, title, problem, solution, category, created_at, updated_at, usage_count, success_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const entry of testData.entries || []) {
      insertStmt.run(
        entry.id,
        entry.title,
        entry.problem,
        entry.solution,
        entry.category,
        entry.created_at || new Date().toISOString(),
        entry.updated_at || new Date().toISOString(),
        entry.usage_count || 0,
        entry.success_rate || 0
      );
    }

    db.close();
    console.log(`  ✓ Seeded ${testData.entries?.length || 0} test entries`);
  }
}

function setupPerformanceMonitoring() {
  console.log('📊 Setting up performance monitoring...');

  // Performance baseline measurements
  const performanceBaselines = {
    searchResponse: 100, // 100ms
    uiRender: 50,       // 50ms
    dataLoad: 200,      // 200ms
    batchOperation: 1000 // 1000ms
  };

  // Store baselines globally
  (global as any).__PERFORMANCE_BASELINES__ = performanceBaselines;

  // Setup performance observer if available
  if (typeof PerformanceObserver !== 'undefined') {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        global.__TEST_CONFIG__.testResults.performance.set(
          entry.name,
          entry.duration
        );
      });
    });

    try {
      observer.observe({ entryTypes: ['measure', 'mark'] });
      (global as any).__PERFORMANCE_OBSERVER__ = observer;
    } catch (e) {
      console.log('  ⚠️ Performance observer not available');
    }
  }

  console.log('  ✓ Performance monitoring ready');
}

function setupAccessibilityTesting() {
  console.log('♿ Setting up accessibility testing...');

  // Configure axe-core for comprehensive testing
  const axeConfig = {
    rules: {
      // WCAG 2.1 AA rules
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-order-semantics': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-valid-attr': { enabled: true },
      'button-name': { enabled: true },
      'form-field-multiple-labels': { enabled: true },
      'input-button-name': { enabled: true },
      'label': { enabled: true },
      'link-name': { enabled: true },
      'heading-order': { enabled: true },
      'landmark-one-main': { enabled: true },
      'page-has-heading-one': { enabled: true },
      'bypass': { enabled: true }
    },
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
  };

  (global as any).__AXE_CONFIG__ = axeConfig;

  // Setup accessibility report structure
  const a11yReport = {
    totalTests: 0,
    violations: [],
    passes: 0,
    components: new Map()
  };

  global.__TEST_CONFIG__.testResults.accessibility = a11yReport;

  console.log('  ✓ Accessibility testing configured');
}

function setupErrorTracking() {
  console.log('🚨 Setting up error tracking...');

  const errorLog: any[] = [];

  // Capture unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    errorLog.push({
      type: 'unhandledRejection',
      reason,
      promise,
      timestamp: new Date().toISOString(),
      stack: reason instanceof Error ? reason.stack : undefined
    });
  });

  // Capture uncaught exceptions
  process.on('uncaughtException', (error) => {
    errorLog.push({
      type: 'uncaughtException',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  });

  // Make error log globally available
  (global as any).__ERROR_LOG__ = errorLog;

  console.log('  ✓ Error tracking enabled');
}

function validateTestEnvironment() {
  console.log('🔍 Validating test environment...');

  const requiredEnvVars = [
    'NODE_ENV'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn(`  ⚠️ Missing environment variables: ${missingVars.join(', ')}`);
  }

  // Set test defaults
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-api-key';

  // Validate Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 18) {
    console.warn(`  ⚠️ Node.js version ${nodeVersion} may not be fully supported. Recommended: 18+`);
  }

  // Check available memory
  const totalMemory = require('os').totalmem();
  const freeMemory = require('os').freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

  if (memoryUsage > 80) {
    console.warn(`  ⚠️ High memory usage detected: ${memoryUsage.toFixed(1)}%`);
  }

  console.log('  ✓ Environment validation complete');
}

// Utility function to generate test summary
export function generateTestSummary(): string {
  const config = global.__TEST_CONFIG__;
  const currentMemory = process.memoryUsage();
  const memoryDelta = {
    heapUsed: (currentMemory.heapUsed - config.memorySnapshot.heapUsed) / 1024 / 1024,
    heapTotal: (currentMemory.heapTotal - config.memorySnapshot.heapTotal) / 1024 / 1024
  };

  const performanceData = Array.from(config.testResults.performance.entries());
  const avgPerformance = performanceData.length > 0
    ? performanceData.reduce((sum, [_, duration]) => sum + duration, 0) / performanceData.length
    : 0;

  return `
📊 Test Execution Summary
========================
Duration: ${((performance.now() - config.startTime) / 1000).toFixed(2)}s
Memory Delta: ${memoryDelta.heapUsed.toFixed(2)}MB heap used
Performance Average: ${avgPerformance.toFixed(2)}ms
Error Log Entries: ${(global as any).__ERROR_LOG__?.length || 0}
`;
}