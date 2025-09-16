/**
 * Global setup for cross-platform build tests
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async () => {
  console.log('Setting up cross-platform build test environment...');

  // Create test directories
  const testDirs = [
    'dist',
    'coverage/build',
    '.cache/electron',
    '.cache/electron-builder'
  ];

  testDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Created directory: ${fullPath}`);
    }
  });

  // Set platform-specific globals
  global.BUILD_PLATFORM = os.platform();
  global.BUILD_ARCH = os.arch();
  global.IS_CI = process.env.CI === 'true';

  // Platform detection
  global.IS_WINDOWS = os.platform() === 'win32';
  global.IS_MACOS = os.platform() === 'darwin';
  global.IS_LINUX = os.platform() === 'linux';

  console.log(`Platform: ${global.BUILD_PLATFORM}`);
  console.log(`Architecture: ${global.BUILD_ARCH}`);
  console.log(`CI Environment: ${global.IS_CI}`);

  // Mock environment variables for testing
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  // Create mock build configuration if needed
  const mockConfig = {
    productName: 'Test Application',
    appId: 'com.test.app',
    version: '1.0.0-test'
  };

  global.MOCK_BUILD_CONFIG = mockConfig;

  console.log('Cross-platform build test environment setup complete');
};