#!/usr/bin/env node

/**
 * KnowledgeDB Integration Test Runner
 * 
 * Specialized test runner for database integration tests with:
 * - Test environment setup and cleanup
 * - Performance monitoring and reporting
 * - Memory leak detection
 * - Detailed test results analysis
 * 
 * Usage:
 *   node run-integration-tests.js [options]
 * 
 * Options:
 *   --suite <name>     Run specific test suite (crud, performance, migration, etc.)
 *   --timeout <ms>     Set test timeout (default: 60000)
 *   --verbose          Enable verbose output
 *   --coverage         Generate coverage report
 *   --memory-check     Enable memory leak detection
 *   --performance      Generate performance report
 *   --parallel         Run tests in parallel (when possible)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class IntegrationTestRunner {
  constructor() {
    this.options = this.parseArguments();
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      performance: {},
      memoryUsage: {},
      errors: []
    };
    this.startTime = Date.now();
    this.initialMemory = process.memoryUsage();
  }

  parseArguments() {
    const args = process.argv.slice(2);
    const options = {
      suite: null,
      timeout: 60000,
      verbose: false,
      coverage: false,
      memoryCheck: false,
      performance: false,
      parallel: false
    };

    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case '--suite':
          options.suite = args[++i];
          break;
        case '--timeout':
          options.timeout = parseInt(args[++i]);
          break;
        case '--verbose':
          options.verbose = true;
          break;
        case '--coverage':
          options.coverage = true;
          break;
        case '--memory-check':
          options.memoryCheck = true;
          break;
        case '--performance':
          options.performance = true;
          break;
        case '--parallel':
          options.parallel = true;
          break;
        case '--help':
          this.showHelp();
          process.exit(0);
        default:
          if (args[i].startsWith('--')) {
            console.warn(`Unknown option: ${args[i]}`);
          }
      }
    }

    return options;
  }

  showHelp() {
    console.log(`
KnowledgeDB Integration Test Runner

Usage: node run-integration-tests.js [options]

Options:
  --suite <name>     Run specific test suite:
                     - crud: CRUD operations and concurrent access
                     - transaction: Transaction integrity and rollbacks
                     - performance: Performance benchmarks
                     - fts: FTS5 index consistency tests
                     - migration: Schema migration tests
                     - backup: Backup and restore validation
                     - error: Error recovery and edge cases
                     - health: System health and monitoring
  
  --timeout <ms>     Set test timeout in milliseconds (default: 60000)
  --verbose          Enable verbose output with detailed logs
  --coverage         Generate test coverage report
  --memory-check     Enable memory leak detection and reporting
  --performance      Generate detailed performance analysis report
  --parallel         Run independent tests in parallel (faster execution)
  --help             Show this help message

Examples:
  node run-integration-tests.js                           # Run all tests
  node run-integration-tests.js --suite performance      # Run only performance tests
  node run-integration-tests.js --verbose --performance  # Verbose with performance analysis
  node run-integration-tests.js --coverage --memory-check # Full analysis
`);
  }

  async run() {
    console.log('🚀 Starting KnowledgeDB Integration Tests\n');
    
    this.printSystemInfo();
    this.setupTestEnvironment();

    try {
      await this.runTests();
      this.generateReports();
      this.printSummary();
      
      process.exit(this.testResults.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }
  }

  printSystemInfo() {
    if (this.options.verbose) {
      console.log('📊 System Information:');
      console.log(`   OS: ${os.type()} ${os.release()}`);
      console.log(`   Node.js: ${process.version}`);
      console.log(`   Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB total`);
      console.log(`   CPUs: ${os.cpus().length} cores`);
      console.log(`   Platform: ${process.platform} ${process.arch}`);
      console.log();
    }
  }

  setupTestEnvironment() {
    // Ensure test directories exist
    const testDirs = [
      path.join(__dirname, '..', '..', 'temp'),
      path.join(__dirname, '..', '..', 'temp', 'integration'),
      path.join(__dirname, '..', '..', 'temp', 'integration', 'db'),
      path.join(__dirname, '..', '..', 'temp', 'integration', 'backups')
    ];

    testDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        if (this.options.verbose) {
          console.log(`📁 Created test directory: ${dir}`);
        }
      }
    });

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.TEST_INTEGRATION = 'true';
    
    if (this.options.verbose) {
      console.log('🔧 Test environment configured\n');
    }
  }

  async runTests() {
    const jestArgs = this.buildJestArgs();
    
    if (this.options.verbose) {
      console.log(`📝 Running Jest with args: ${jestArgs.join(' ')}\n`);
    }

    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', ...jestArgs], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..', '..', '..')
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        if (this.options.verbose) {
          process.stdout.write(output);
        }
      });

      jest.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        if (this.options.verbose || output.includes('ERROR')) {
          process.stderr.write(output);
        }
      });

      jest.on('close', (code) => {
        this.parseTestResults(stdout, stderr);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Jest exited with code ${code}`));
        }
      });

      jest.on('error', (error) => {
        reject(error);
      });
    });
  }

  buildJestArgs() {
    const args = [];

    // Test file pattern
    if (this.options.suite) {
      args.push('--testNamePattern', this.getSuitePattern(this.options.suite));
    } else {
      args.push('tests/integration/database/knowledge-db.integration.test.ts');
    }

    // Configuration options
    args.push('--testTimeout', this.options.timeout.toString());
    args.push('--detectOpenHandles');
    args.push('--forceExit');

    if (this.options.coverage) {
      args.push('--coverage');
      args.push('--coverageDirectory', 'coverage/integration');
      args.push('--collectCoverageFrom', 'src/database/**/*.ts');
    }

    if (this.options.verbose) {
      args.push('--verbose');
    }

    if (this.options.parallel && !this.options.suite) {
      args.push('--maxWorkers', '2');
    } else {
      args.push('--runInBand'); // Sequential execution for database tests
    }

    // Output formatting
    args.push('--reporters', 'default');
    if (this.options.performance) {
      args.push('--reporters', 'jest-slow-test-reporter');
    }

    return args;
  }

  getSuitePattern(suite) {
    const patterns = {
      crud: 'CRUD Operations with Concurrent Access',
      transaction: 'Transaction Integrity and Rollback Scenarios',
      performance: 'Performance Benchmarks',
      fts: 'FTS5 Index Consistency',
      migration: 'Schema Migration Testing',
      backup: 'Backup and Restore Validation',
      error: 'Error Recovery and Edge Cases',
      health: 'System Health and Monitoring'
    };

    return patterns[suite] || suite;
  }

  parseTestResults(stdout, stderr) {
    // Parse Jest output for test results
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed.*?(\d+) failed.*?(\d+) skipped/);
        if (match) {
          this.testResults.passed = parseInt(match[1]) || 0;
          this.testResults.failed = parseInt(match[2]) || 0;
          this.testResults.skipped = parseInt(match[3]) || 0;
        }
      }
      
      if (line.includes('Time:')) {
        const match = line.match(/Time:\s+([\d.]+)\s*s/);
        if (match) {
          this.testResults.duration = parseFloat(match[1]) * 1000;
        }
      }
    }

    // Extract performance information if available
    if (this.options.performance) {
      this.extractPerformanceMetrics(stdout);
    }

    // Check for memory issues
    if (this.options.memoryCheck) {
      this.checkMemoryUsage();
    }

    // Extract errors
    if (stderr) {
      this.testResults.errors.push(stderr);
    }
  }

  extractPerformanceMetrics(output) {
    const performanceLines = output.split('\n').filter(line => 
      line.includes('Performance') || 
      line.includes('ms') || 
      line.includes('time:') ||
      line.includes('average')
    );

    this.testResults.performance = {
      metrics: performanceLines,
      searchTimes: this.extractSearchTimes(output),
      concurrentOperations: this.extractConcurrentResults(output)
    };
  }

  extractSearchTimes(output) {
    const searchTimes = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/Search "([^"]+)":\s+(\d+)ms/);
      if (match) {
        searchTimes.push({
          query: match[1],
          time: parseInt(match[2])
        });
      }
    }
    
    return searchTimes;
  }

  extractConcurrentResults(output) {
    const results = {};
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('successful') && line.includes('failed')) {
        const match = line.match(/(\d+) successful.*?(\d+) failed.*?([\d.]+)% success rate/);
        if (match) {
          results.successful = parseInt(match[1]);
          results.failed = parseInt(match[2]);
          results.successRate = parseFloat(match[3]);
        }
      }
    }
    
    return results;
  }

  checkMemoryUsage() {
    const currentMemory = process.memoryUsage();
    const memoryDelta = {
      rss: currentMemory.rss - this.initialMemory.rss,
      heapUsed: currentMemory.heapUsed - this.initialMemory.heapUsed,
      heapTotal: currentMemory.heapTotal - this.initialMemory.heapTotal,
      external: currentMemory.external - this.initialMemory.external
    };

    this.testResults.memoryUsage = {
      initial: this.initialMemory,
      final: currentMemory,
      delta: memoryDelta,
      leak: memoryDelta.heapUsed > 50 * 1024 * 1024 // 50MB threshold
    };
  }

  generateReports() {
    const reportsDir = path.join(__dirname, '..', '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate JSON report
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      options: this.options,
      results: this.testResults,
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memory: os.totalmem(),
        cpus: os.cpus().length
      }
    };

    const reportPath = path.join(reportsDir, `integration-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    if (this.options.verbose) {
      console.log(`📊 Test report saved to: ${reportPath}`);
    }

    // Generate performance report if requested
    if (this.options.performance && this.testResults.performance.searchTimes) {
      this.generatePerformanceReport(reportsDir);
    }

    // Generate memory report if requested
    if (this.options.memoryCheck && this.testResults.memoryUsage) {
      this.generateMemoryReport(reportsDir);
    }
  }

  generatePerformanceReport(reportsDir) {
    const searchTimes = this.testResults.performance.searchTimes;
    if (!searchTimes.length) return;

    const avgTime = searchTimes.reduce((sum, st) => sum + st.time, 0) / searchTimes.length;
    const maxTime = Math.max(...searchTimes.map(st => st.time));
    const minTime = Math.min(...searchTimes.map(st => st.time));

    const performanceReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalQueries: searchTimes.length,
        averageTime: Math.round(avgTime),
        maxTime,
        minTime,
        threshold: 1000,
        passed: maxTime < 1000
      },
      details: searchTimes,
      concurrent: this.testResults.performance.concurrentOperations
    };

    const perfPath = path.join(reportsDir, `performance-report-${Date.now()}.json`);
    fs.writeFileSync(perfPath, JSON.stringify(performanceReport, null, 2));

    console.log(`🚀 Performance report saved to: ${perfPath}`);
  }

  generateMemoryReport(reportsDir) {
    const memoryUsage = this.testResults.memoryUsage;
    
    const memoryReport = {
      timestamp: new Date().toISOString(),
      summary: {
        heapUsedDelta: Math.round(memoryUsage.delta.heapUsed / 1024 / 1024), // MB
        potentialLeak: memoryUsage.leak,
        finalHeapUsed: Math.round(memoryUsage.final.heapUsed / 1024 / 1024), // MB
        finalRSS: Math.round(memoryUsage.final.rss / 1024 / 1024) // MB
      },
      details: memoryUsage
    };

    const memPath = path.join(reportsDir, `memory-report-${Date.now()}.json`);
    fs.writeFileSync(memPath, JSON.stringify(memoryReport, null, 2));

    console.log(`🧠 Memory report saved to: ${memPath}`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    
    const total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
    const successRate = total > 0 ? (this.testResults.passed / total * 100).toFixed(1) : 0;
    
    console.log(`📊 Results: ${this.testResults.passed} passed, ${this.testResults.failed} failed, ${this.testResults.skipped} skipped`);
    console.log(`✅ Success Rate: ${successRate}%`);
    console.log(`⏱️  Duration: ${Math.round(this.testResults.duration)}ms`);
    
    if (this.options.performance && this.testResults.performance.searchTimes) {
      const searchTimes = this.testResults.performance.searchTimes;
      const avgTime = searchTimes.reduce((sum, st) => sum + st.time, 0) / searchTimes.length;
      console.log(`🔍 Search Performance: ${Math.round(avgTime)}ms average (${searchTimes.length} queries)`);
    }

    if (this.options.memoryCheck && this.testResults.memoryUsage) {
      const heapDelta = Math.round(this.testResults.memoryUsage.delta.heapUsed / 1024 / 1024);
      console.log(`🧠 Memory Usage: ${heapDelta}MB delta ${this.testResults.memoryUsage.leak ? '⚠️ POTENTIAL LEAK' : '✅ OK'}`);
    }

    if (this.testResults.errors.length > 0) {
      console.log(`❌ Errors: ${this.testResults.errors.length} issues detected`);
    }

    console.log('='.repeat(60));
    
    if (this.testResults.failed === 0) {
      console.log('🎉 All tests passed successfully!');
    } else {
      console.log('❌ Some tests failed. Check the output above for details.');
    }
  }
}

// Main execution
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.run().catch(error => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTestRunner;