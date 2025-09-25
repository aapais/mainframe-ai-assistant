/**
 * Global Jest Setup for SSO Tests
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🚀 Setting up SSO test environment...');

  // Create test directories if they don't exist
  const testDirs = [
    'coverage',
    'test-results',
    'test-artifacts',
    'temp'
  ];

  for (const dir of testDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-' + Math.random().toString(36);
  process.env.OAUTH_CLIENT_ID = 'test-client-id';
  process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
  process.env.TEST_DATABASE_URL = 'sqlite::memory:';
  process.env.REDIS_URL = 'redis://localhost:6379/15'; // Test Redis DB

  // Disable console warnings in tests unless DEBUG is set
  if (!process.env.DEBUG) {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args[0];
      if (typeof message === 'string') {
        // Suppress React warnings and other test noise
        if (
          message.includes('Warning:') ||
          message.includes('deprecated') ||
          message.includes('React.createFactory')
        ) {
          return;
        }
      }
      originalWarn.apply(console, args);
    };
  }

  // Set up performance monitoring
  const performanceData = {
    startTime: Date.now(),
    suites: {},
    memory: {
      initial: process.memoryUsage()
    }
  };

  global.__TEST_PERFORMANCE__ = performanceData;

  // Clean up any existing test artifacts
  const artifactsDir = path.join(__dirname, '..', 'test-artifacts');
  if (fs.existsSync(artifactsDir)) {
    const files = fs.readdirSync(artifactsDir);
    for (const file of files) {
      if (file.startsWith('test-') && file.endsWith('.json')) {
        fs.unlinkSync(path.join(artifactsDir, file));
      }
    }
  }

  // Initialize test database schema (if needed)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'sqlite::memory:') {
    console.log('📊 Initializing test database schema...');
    // In a real scenario, you might run database migrations here
  }

  // Set up test security keys
  const crypto = require('crypto');
  global.__TEST_KEYS__ = {
    jwtSecret: process.env.JWT_SECRET,
    encryptionKey: crypto.randomBytes(32),
    hmacSecret: crypto.randomBytes(64)
  };

  console.log('✅ Test environment setup complete');
};