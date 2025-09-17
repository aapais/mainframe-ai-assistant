/**
 * Jest Setup for Build Tests
 * Configure testing environment for cross-platform build testing
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Extend Jest timeout for build operations
jest.setTimeout(60000);

// Set up global test environment
beforeAll(async () => {
  console.log('Setting up build test environment...');

  // Ensure test directories exist
  const testDirs = [
    path.join(process.cwd(), 'dist'),
    path.join(process.cwd(), 'coverage', 'build'),
    path.join(process.cwd(), '.cache', 'electron'),
    path.join(process.cwd(), '.cache', 'electron-builder')
  ];

  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Set global platform information
  global.TEST_PLATFORM = os.platform();
  global.TEST_ARCH = os.arch();
  global.IS_CI = process.env.CI === 'true';

  // Platform detection helpers
  global.IS_WINDOWS = os.platform() === 'win32';
  global.IS_MACOS = os.platform() === 'darwin';
  global.IS_LINUX = os.platform() === 'linux';

  // Mock build environment variables
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  console.log(`Build tests running on ${global.TEST_PLATFORM} (${global.TEST_ARCH})`);
});

// Clean up after all tests
afterAll(async () => {
  console.log('Cleaning up build test environment...');

  // Clean up test artifacts
  const tempPaths = [
    path.join(process.cwd(), 'dist', 'test-*'),
    path.join(process.cwd(), '.cache', 'test-*')
  ];

  tempPaths.forEach(pattern => {
    try {
      const basePath = path.dirname(pattern);
      if (fs.existsSync(basePath)) {
        const files = fs.readdirSync(basePath);
        files.forEach(file => {
          if (file.startsWith('test-')) {
            const fullPath = path.join(basePath, file);
            if (fs.existsSync(fullPath)) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            }
          }
        });
      }
    } catch (error) {
      console.warn(`Cleanup warning: ${error.message}`);
    }
  });
});

// Suppress console output during tests (unless in debug mode)
if (process.env.DEBUG !== 'true') {
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });
}

// Add custom matchers
require('./tests/build/matchers');

// Mock electron-builder for testing
jest.mock('electron-builder', () => ({
  build: jest.fn(() => Promise.resolve({
    outDir: path.join(process.cwd(), 'dist'),
    artifactPaths: ['test-artifact.exe']
  }))
}));

// Mock file system operations for cross-platform testing
const originalExistsSync = fs.existsSync;
jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
  // Mock existence of config files for testing
  if (path.includes('electron-builder-configs')) {
    return true;
  }
  return originalExistsSync(path);
});

// Helper functions for tests
global.mockPlatform = (platform) => {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true
  });
};

global.mockArch = (arch) => {
  Object.defineProperty(process, 'arch', {
    value: arch,
    writable: true
  });
};

global.createMockBuildConfig = (platform) => {
  return {
    productName: 'Test Application',
    appId: 'com.test.app',
    version: '1.0.0-test',
    directories: {
      output: 'dist',
      app: 'src'
    },
    [platform]: {
      target: platform === 'win' ? ['nsis'] : platform === 'mac' ? ['dmg'] : ['AppImage']
    }
  };
};

global.createMockArtifacts = (platform) => {
  const artifacts = {
    win32: ['test-app.exe', 'test-app.msi'],
    darwin: ['test-app.dmg', 'test-app.pkg'],
    linux: ['test-app.AppImage', 'test-app.deb', 'test-app.rpm']
  };

  return artifacts[platform] || [];
};

console.log('Build test setup completed');