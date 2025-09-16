/**
 * Global setup for native dialog tests
 * Initializes the test environment before any tests run
 */

const { spawn } = require('child_process');
const path = require('path');

module.exports = async () => {
  console.log('🚀 Setting up native dialog test environment...');

  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  process.env.ELECTRON_ENABLE_LOGGING = 'false';

  // Create test directories if they don't exist
  const fs = require('fs').promises;
  const testDirs = [
    path.join(process.cwd(), 'coverage/native-dialogs'),
    path.join(process.cwd(), 'tests/native-dialogs/temp'),
    path.join(process.cwd(), 'tests/native-dialogs/fixtures')
  ];

  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
      if (error.code !== 'EEXIST') {
        console.warn(`Warning: Could not create directory ${dir}:`, error.message);
      }
    }
  }

  // Create test fixture files
  const fixtures = [
    {
      path: 'tests/native-dialogs/fixtures/sample.txt',
      content: 'This is a sample text file for testing file dialogs.'
    },
    {
      path: 'tests/native-dialogs/fixtures/sample.json',
      content: JSON.stringify({
        name: 'Test Document',
        type: 'fixture',
        created: new Date().toISOString()
      }, null, 2)
    },
    {
      path: 'tests/native-dialogs/fixtures/sample.csv',
      content: 'Name,Age,City\nJohn Doe,30,New York\nJane Smith,25,Los Angeles'
    }
  ];

  for (const fixture of fixtures) {
    try {
      const fullPath = path.join(process.cwd(), fixture.path);
      await fs.writeFile(fullPath, fixture.content, 'utf8');
    } catch (error) {
      console.warn(`Warning: Could not create fixture ${fixture.path}:`, error.message);
    }
  }

  // Set up global test utilities
  global.__DIALOG_TEST_SETUP__ = {
    startTime: Date.now(),
    tempFiles: [],
    createdWindows: []
  };

  // Check if Electron is available
  try {
    const electronPath = require('electron');
    console.log('✅ Electron found:', electronPath);
  } catch (error) {
    console.warn('⚠️  Electron not found, using mocks:', error.message);
  }

  console.log('✅ Native dialog test environment setup complete');
};