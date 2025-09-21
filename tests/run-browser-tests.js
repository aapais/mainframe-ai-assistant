#!/usr/bin/env node

const BrowserTestingSuite = require('./browser-testing-suite.js');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class BrowserTestRunner {
  constructor() {
    this.hookPrefix = 'npx claude-flow@alpha hooks';
  }

  async sendHook(type, message) {
    try {
      const command = `${this.hookPrefix} ${type} --message "${message}"`;
      await execAsync(command);
      console.log(`🔗 Hook sent: ${type} - ${message}`);
    } catch (error) {
      console.log(`📝 Hook not available, logging: ${type} - ${message}`);
    }
  }

  async waitForServer() {
    console.log('⏳ Waiting for server to be ready...');

    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch('http://localhost:3002');
        if (response.ok) {
          console.log('✅ Server is ready!');
          return true;
        }
      } catch (error) {
        // Server not ready yet
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`⏳ Attempt ${attempts}/${maxAttempts} - still waiting...`);
    }

    throw new Error('Server did not start within expected time');
  }

  async run() {
    try {
      // Send initial hook
      await this.sendHook('notify', 'Starting comprehensive browser testing suite');

      // Wait for server to be ready
      await this.waitForServer();

      // Create test suite instance
      const suite = new BrowserTestingSuite();

      // Send progress hooks during testing
      await this.sendHook('notify', 'Test Application Load starting');

      // Run the full test suite
      const report = await suite.runFullTestSuite();

      // Send completion hooks
      await this.sendHook('notify', `Testing completed - ${report.summary.passed} passed, ${report.summary.failed} failed`);

      // Display final results
      console.log('\n🎊 BROWSER TESTING COMPLETE!');
      console.log('=' * 50);
      console.log(`📊 Test Summary:`);
      console.log(`   ✅ Passed: ${report.summary.passed}`);
      console.log(`   ❌ Failed: ${report.summary.failed}`);
      console.log(`   ⚠️ Warnings: ${report.summary.warnings}`);
      console.log(`   📈 Total Tests: ${report.summary.totalTests}`);

      if (report.performanceMetrics.appLoad) {
        console.log(`   ⚡ App Load Time: ${report.performanceMetrics.appLoad.duration}ms`);
      }

      console.log('\n📸 Screenshots captured in: /mnt/c/mainframe-ai-assistant/test-results/screenshots');
      console.log('📋 Full report available at: /mnt/c/mainframe-ai-assistant/test-results/browser-test-report.json');

      // Send final hook
      await this.sendHook('post-task', 'browser-testing');

      return report;

    } catch (error) {
      console.error('❌ Browser testing failed:', error);
      await this.sendHook('notify', `Testing failed: ${error.message}`);
      throw error;
    }
  }
}

// Run the tests
if (require.main === module) {
  const runner = new BrowserTestRunner();
  runner.run()
    .then(() => {
      console.log('✅ All tests completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Testing suite failed:', error);
      process.exit(1);
    });
}

module.exports = BrowserTestRunner;