import { beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { TestDatabaseFactory } from './TestDatabaseFactory';

// Global test setup
beforeAll(() => {
  // Ensure test directories exist
  const testDirs = [
    path.join(__dirname, '..', 'temp'),
    path.join(__dirname, '..', 'backups'),
    path.join(__dirname, '..', 'migrations'),
  ];

  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
});

afterAll(async () => {
  // Clean up test databases and temp files
  await TestDatabaseFactory.cleanup();

  // Remove test directories
  const testDirs = [path.join(__dirname, '..', 'temp'), path.join(__dirname, '..', 'backups')];

  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveExecutedWithin(received: number, maxMs: number) {
    const pass = received <= maxMs;
    if (pass) {
      return {
        message: () => `expected ${received}ms not to be within ${maxMs}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received}ms to be within ${maxMs}ms but took ${received}ms`,
        pass: false,
      };
    }
  },
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveExecutedWithin(maxMs: number): R;
    }
  }
}
