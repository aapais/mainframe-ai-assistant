const fs = require('fs');
const path = require('path');
const os = require('os');

// Global test setup for deployment tests
console.log('🚀 Setting up deployment test environment...');

// Create temporary directories for testing
global.TEST_TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'deployment-tests-'));
global.TEST_PACKAGES_DIR = path.join(global.TEST_TEMP_DIR, 'packages');
global.TEST_INSTALL_DIR = path.join(global.TEST_TEMP_DIR, 'installations');
global.TEST_BACKUP_DIR = path.join(global.TEST_TEMP_DIR, 'backups');
global.TEST_CACHE_DIR = path.join(global.TEST_TEMP_DIR, 'cache');

// Create test directories
[
  global.TEST_PACKAGES_DIR,
  global.TEST_INSTALL_DIR,
  global.TEST_BACKUP_DIR,
  global.TEST_CACHE_DIR
].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Global test utilities
global.createMockPackage = function(packageInfo = {}) {
  const defaultInfo = {
    name: 'test-package',
    version: '1.0.0',
    files: {
      'app.js': 'console.log("Hello World");',
      'package.json': JSON.stringify({ name: 'test-app', version: '1.0.0' }),
      'LICENSE': 'MIT License'
    }
  };

  const info = { ...defaultInfo, ...packageInfo };
  const packagePath = path.join(global.TEST_PACKAGES_DIR, `${info.name}-${info.version}.zip`);

  // Create mock package content
  const packageContent = JSON.stringify({
    manifest: {
      name: info.name,
      version: info.version,
      files: Object.keys(info.files).map(fileName => ({
        path: fileName,
        checksum: 'mock-checksum-' + fileName.replace(/[^a-zA-Z0-9]/g, ''),
        size: Buffer.from(info.files[fileName]).length,
        required: fileName !== 'README.md'
      }))
    },
    files: info.files
  });

  fs.writeFileSync(packagePath, packageContent);
  return packagePath;
};

global.createMockDeploymentPackage = function() {
  const files = new Map();

  const appFile = Buffer.from('console.log("Application running");');
  const configFile = Buffer.from('{"env": "test", "debug": true}');
  const licenseFile = Buffer.from('MIT License\n\nCopyright (c) 2024');

  files.set('app/main.js', appFile);
  files.set('config/app.json', configFile);
  files.set('LICENSE', licenseFile);

  return {
    manifest: {
      name: 'test-deployment-package',
      version: '1.0.0',
      files: [
        {
          path: 'app/main.js',
          checksum: 'mock-checksum-app-main-js',
          size: appFile.length,
          required: true
        },
        {
          path: 'config/app.json',
          checksum: 'mock-checksum-config-app-json',
          size: configFile.length,
          required: true
        },
        {
          path: 'LICENSE',
          checksum: 'mock-checksum-license',
          size: licenseFile.length,
          required: true
        }
      ],
      dependencies: {
        'express': '^4.18.0',
        'lodash': '^4.17.21'
      },
      timestamp: Date.now()
    },
    files,
    metadata: {
      buildDate: new Date().toISOString(),
      buildEnvironment: 'test',
      buildCommit: 'test-commit-hash',
      platform: 'test',
      architecture: 'x64'
    }
  };
};

global.waitForCondition = async function(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
};

global.mockNetworkDelay = function(min = 50, max = 200) {
  const delay = Math.random() * (max - min) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Mock console methods for cleaner test output
const originalConsole = { ...console };
global.originalConsole = originalConsole;

// Custom matchers for deployment testing
expect.extend({
  toBeValidPackage(received) {
    const pass = received &&
                 received.manifest &&
                 received.manifest.name &&
                 received.manifest.version &&
                 Array.isArray(received.manifest.files) &&
                 received.files instanceof Map;

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid package`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid package with manifest and files`,
        pass: false
      };
    }
  },

  toHaveValidChecksum(received, expectedChecksum) {
    const pass = received === expectedChecksum;

    if (pass) {
      return {
        message: () => `expected checksum ${received} not to match ${expectedChecksum}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected checksum ${received} to match ${expectedChecksum}`,
        pass: false
      };
    }
  },

  toBeWithinDuration(received, expectedDuration, tolerance = 1000) {
    const difference = Math.abs(received - expectedDuration);
    const pass = difference <= tolerance;

    if (pass) {
      return {
        message: () => `expected duration ${received}ms not to be within ${tolerance}ms of ${expectedDuration}ms`,
        pass: true
      };
    } else {
      return {
        message: () => `expected duration ${received}ms to be within ${tolerance}ms of ${expectedDuration}ms (difference: ${difference}ms)`,
        pass: false
      };
    }
  },

  toHaveSuccessfulDeployment(received) {
    const pass = received &&
                 received.success === true &&
                 received.errors &&
                 received.errors.length === 0;

    if (pass) {
      return {
        message: () => `expected deployment result not to be successful`,
        pass: true
      };
    } else {
      return {
        message: () => `expected deployment result to be successful but got: ${JSON.stringify(received)}`,
        pass: false
      };
    }
  }
});

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'deployment';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Global cleanup
global.cleanupTestEnvironment = function() {
  try {
    if (fs.existsSync(global.TEST_TEMP_DIR)) {
      fs.rmSync(global.TEST_TEMP_DIR, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('Failed to cleanup test environment:', error.message);
  }
};

// Register cleanup on exit
process.on('exit', global.cleanupTestEnvironment);
process.on('SIGINT', () => {
  global.cleanupTestEnvironment();
  process.exit(0);
});
process.on('SIGTERM', () => {
  global.cleanupTestEnvironment();
  process.exit(0);
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('✅ Deployment test environment setup complete');
console.log(`📁 Test temp directory: ${global.TEST_TEMP_DIR}`);

// Mock implementations for external dependencies
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() }
  })),
  exec: jest.fn((cmd, callback) => {
    callback(null, 'mock output', '');
  })
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash-value')
  }))
}));

// Increase timeout for deployment tests
jest.setTimeout(30000);