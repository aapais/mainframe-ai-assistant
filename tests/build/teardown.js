/**
 * Global teardown for cross-platform build tests
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('Tearing down cross-platform build test environment...');

  // Clean up test artifacts (but preserve coverage)
  const cleanupPaths = [
    'dist/test-*',
    '.cache/test-*',
    'temp-*'
  ];

  cleanupPaths.forEach(pattern => {
    try {
      // Simple cleanup - in real implementation, use glob for pattern matching
      const basePath = pattern.replace('/test-*', '');
      if (fs.existsSync(basePath)) {
        const files = fs.readdirSync(basePath);
        files.forEach(file => {
          if (file.startsWith('test-') || file.startsWith('temp-')) {
            const fullPath = path.join(basePath, file);
            if (fs.existsSync(fullPath)) {
              fs.rmSync(fullPath, { recursive: true, force: true });
              console.log(`Cleaned up: ${fullPath}`);
            }
          }
        });
      }
    } catch (error) {
      console.warn(`Cleanup warning for ${pattern}:`, error.message);
    }
  });

  // Log final test summary
  console.log('Cross-platform build test teardown complete');
  console.log(`Test run completed on ${global.BUILD_PLATFORM} (${global.BUILD_ARCH})`);
};