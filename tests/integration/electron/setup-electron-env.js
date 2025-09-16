/**
 * Electron Environment Setup
 * Sets up environment variables and global configuration for Electron tests
 */

// Prevent Electron from trying to create a real application
process.env.NODE_ENV = 'test';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_ENABLE_LOGGING = 'false';

// Mock display server for headless testing
process.env.DISPLAY = ':99';
process.env.XVFB = 'true';

// Disable hardware acceleration for CI environments
process.env.ELECTRON_DISABLE_HARDWARE_ACCELERATION = 'true';

// Set test-specific paths
process.env.USERDATA_PATH = '/tmp/electron-test-userdata';
process.env.LOGS_PATH = '/tmp/electron-test-logs';
process.env.CACHE_PATH = '/tmp/electron-test-cache';

// Mock file system paths
process.env.HOME = '/tmp/electron-test-home';
process.env.TMPDIR = '/tmp/electron-test-tmp';

// Disable network access during tests
process.env.ELECTRON_DISABLE_NETWORK = 'true';

// Performance settings for tests
process.env.ELECTRON_MAX_MEMORY = '512';
process.env.ELECTRON_RENDERER_PROCESS_LIMIT = '4';

// Mock GPU settings
process.env.LIBGL_ALWAYS_SOFTWARE = '1';
process.env.GALLIUM_DRIVER = 'softpipe';

// Accessibility settings
process.env.ELECTRON_FORCE_ACCESSIBILITY = 'false';

// Security settings for testing
process.env.ELECTRON_ENABLE_REMOTE_MODULE = 'false';
process.env.ELECTRON_CONTEXT_ISOLATION = 'true';
process.env.ELECTRON_NODE_INTEGRATION = 'false';

// Debugging settings
if (process.env.DEBUG_ELECTRON_TESTS) {
  process.env.ELECTRON_ENABLE_STACK_DUMPING = 'true';
  process.env.ELECTRON_ENABLE_LOGGING = 'true';
}

// Mock system info for consistent testing
global.__ELECTRON_TEST_SYSTEM_INFO__ = {
  platform: process.platform,
  arch: process.arch,
  electronVersion: '28.1.0',
  nodeVersion: process.version,
  v8Version: process.versions.v8,
  chromeVersion: '120.0.6099.216'
};

// Global test configuration
global.__ELECTRON_TEST_CONFIG__ = {
  timeout: 30000,
  retries: 2,
  slowTestThreshold: 5000,
  memoryLimit: 512 * 1024 * 1024, // 512MB
  windowLimit: 50,
  enableCoverage: process.env.COLLECT_COVERAGE === 'true',
  enablePerformanceMetrics: process.env.ENABLE_PERFORMANCE_METRICS === 'true'
};

// Mock Electron's crash reporter
global.__ELECTRON_CRASH_REPORTER_DISABLED__ = true;

// Prevent actual file system writes during tests
const fs = require('fs');
const path = require('path');

// Create test directories if they don't exist
const testDirs = [
  process.env.USERDATA_PATH,
  process.env.LOGS_PATH,
  process.env.CACHE_PATH,
  process.env.HOME,
  process.env.TMPDIR
];

testDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      // Ignore errors in test environment
    }
  }
});

// Override console methods in test environment
const originalConsole = console;

// Store original methods
const originalMethods = {
  log: originalConsole.log,
  warn: originalConsole.warn,
  error: originalConsole.error,
  debug: originalConsole.debug,
  info: originalConsole.info
};

// Custom console for tests
if (!process.env.DEBUG_ELECTRON_TESTS) {
  console.log = (...args) => {
    // Only log in debug mode
    if (process.env.VERBOSE_TESTS) {
      originalMethods.log(...args);
    }
  };

  console.debug = (...args) => {
    // Only log in debug mode
    if (process.env.DEBUG_ELECTRON_TESTS) {
      originalMethods.debug(...args);
    }
  };

  console.info = (...args) => {
    // Only log in verbose mode
    if (process.env.VERBOSE_TESTS) {
      originalMethods.info(...args);
    }
  };

  console.warn = (...args) => {
    // Filter out known test warnings
    const message = args.join(' ');
    if (!message.includes('deprecated') &&
        !message.includes('SecurityWarning') &&
        !message.includes('Mock function')) {
      originalMethods.warn(...args);
    }
  };

  console.error = (...args) => {
    // Always show errors but filter mock-related ones
    const message = args.join(' ');
    if (!message.includes('Mock function') &&
        !message.includes('jest.fn()')) {
      originalMethods.error(...args);
    }
  };
}

// Restore console methods after tests
process.on('exit', () => {
  Object.assign(console, originalMethods);
});

// Memory monitoring for tests
if (global.gc && process.env.ENABLE_MEMORY_MONITORING) {
  let memoryCheckInterval;

  const startMemoryMonitoring = () => {
    memoryCheckInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

      if (heapUsedMB > global.__ELECTRON_TEST_CONFIG__.memoryLimit / 1024 / 1024) {
        console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`);
        global.gc();
      }
    }, 5000);
  };

  const stopMemoryMonitoring = () => {
    if (memoryCheckInterval) {
      clearInterval(memoryCheckInterval);
    }
  };

  // Start monitoring when tests begin
  if (typeof global.beforeAll === 'function') {
    global.beforeAll(() => startMemoryMonitoring());
    global.afterAll(() => stopMemoryMonitoring());
  } else {
    // Fallback for environments without global hooks
    setTimeout(startMemoryMonitoring, 1000);
    process.on('exit', stopMemoryMonitoring);
  }
}

// Cleanup function for test environment
global.__ELECTRON_TEST_CLEANUP__ = () => {
  // Clean up test directories
  testDirs.forEach(dir => {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Restore original console
  Object.assign(console, originalMethods);

  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
};

// Run cleanup on process exit
process.on('exit', global.__ELECTRON_TEST_CLEANUP__);
process.on('SIGINT', () => {
  global.__ELECTRON_TEST_CLEANUP__();
  process.exit(0);
});
process.on('SIGTERM', () => {
  global.__ELECTRON_TEST_CLEANUP__();
  process.exit(0);
});

// Export test utilities
module.exports = {
  testSystemInfo: global.__ELECTRON_TEST_SYSTEM_INFO__,
  testConfig: global.__ELECTRON_TEST_CONFIG__,
  cleanup: global.__ELECTRON_TEST_CLEANUP__
};