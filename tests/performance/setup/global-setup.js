/**
 * Global Performance Test Setup
 * Runs before all performance tests
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('\n🔧 Setting up Performance Test Environment...');
  
  // Ensure reports directory exists
  const reportsDir = path.join(__dirname, '..', 'reports');
  try {
    await fs.mkdir(reportsDir, { recursive: true });
    console.log('✓ Reports directory created');
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('Failed to create reports directory:', error.message);
    }
  }
  
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.PERFORMANCE_TEST = 'true';
  process.env.JEST_WORKER_ID = '1';
  
  // Configure memory settings for performance testing
  if (process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS += ' --expose-gc --max-old-space-size=4096';
  } else {
    process.env.NODE_OPTIONS = '--expose-gc --max-old-space-size=4096';
  }
  
  // Initialize global performance tracking
  global.PERFORMANCE_TEST_START = Date.now();
  
  console.log('✓ Environment variables configured');
  console.log('✓ Memory settings optimized');
  console.log('✓ Global tracking initialized');
  console.log('🎆 Performance test environment ready!\n');
};
