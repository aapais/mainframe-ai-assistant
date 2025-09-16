/**
 * Test Setup for KnowledgeDB Integration Tests
 * 
 * Global setup and configuration for integration testing environment
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Extend Jest timeout for integration tests
jest.setTimeout(60000);

// Global test configuration
declare global {
  namespace NodeJS {
    interface Global {
      testConfig: {
        tempDir: string;
        dbDir: string;
        backupDir: string;
        reportsDir: string;
      };
    }
  }
}

// Setup test directories
const baseDir = path.join(__dirname, '..', '..', 'temp', 'integration');
const testConfig = {
  tempDir: baseDir,
  dbDir: path.join(baseDir, 'db'),
  backupDir: path.join(baseDir, 'backups'), 
  reportsDir: path.join(baseDir, 'reports')
};

// Ensure test directories exist
Object.values(testConfig).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Make test config globally available
(global as any).testConfig = testConfig;

// Setup console override for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

console.log = (...args: any[]) => {
  if (process.env.NODE_ENV === 'test' && !process.env.VERBOSE_TESTS) {
    // Only log important messages during tests
    const message = args.join(' ');
    if (message.includes('ERROR') || message.includes('FAIL') || message.includes('🚀') || message.includes('✅')) {
      originalConsoleLog(...args);
    }
  } else {
    originalConsoleLog(...args);
  }
};

console.warn = (...args: any[]) => {
  if (process.env.NODE_ENV === 'test' && !process.env.VERBOSE_TESTS) {
    const message = args.join(' ');
    if (message.includes('ERROR') || message.includes('CRITICAL')) {
      originalConsoleWarn(...args);
    }
  } else {
    originalConsoleWarn(...args);
  }
};

// Global cleanup after all tests
process.on('exit', () => {
  if (fs.existsSync(testConfig.tempDir)) {
    try {
      fs.rmSync(testConfig.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  }
});

console.log('🔧 KnowledgeDB Integration Test setup complete');