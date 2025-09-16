/**
 * Global teardown for native dialog tests
 * Cleans up the test environment after all tests complete
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🧹 Tearing down native dialog test environment...');

  // Clean up temporary files
  if (global.__DIALOG_TEST_SETUP__) {
    const { tempFiles, createdWindows } = global.__DIALOG_TEST_SETUP__;

    // Clean up temporary files
    for (const tempFile of tempFiles) {
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        // File might not exist or already be deleted
        if (error.code !== 'ENOENT') {
          console.warn(`Warning: Could not delete temp file ${tempFile}:`, error.message);
        }
      }
    }

    // Report test duration
    const duration = Date.now() - global.__DIALOG_TEST_SETUP__.startTime;
    console.log(`⏱️  Total test duration: ${duration}ms`);

    // Clean up global reference
    delete global.__DIALOG_TEST_SETUP__;
  }

  // Clean up test temp directory
  const tempDir = path.join(process.cwd(), 'tests/native-dialogs/temp');
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stat = await fs.lstat(filePath);
        if (stat.isDirectory()) {
          await fs.rmdir(filePath, { recursive: true });
        } else {
          await fs.unlink(filePath);
        }
      } catch (error) {
        console.warn(`Warning: Could not clean up ${filePath}:`, error.message);
      }
    }
  } catch (error) {
    // Temp directory might not exist
    if (error.code !== 'ENOENT') {
      console.warn('Warning: Could not clean up temp directory:', error.message);
    }
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  console.log('✅ Native dialog test environment teardown complete');
};