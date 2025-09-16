/**
 * Global Teardown for IPC Test Suite
 * Runs once after all IPC tests complete
 */

export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up IPC Test Environment...');
  
  const fs = require('fs');
  const path = require('path');
  
  // Restore console methods
  if ((global as any).restoreConsole) {
    (global as any).restoreConsole();
  }
  
  // Generate test report
  const testMetrics = (global as any).testMetrics;
  const errorTracker = (global as any).errorTracker;
  const performanceConfig = (global as any).performanceConfig;
  
  if (testMetrics) {
    testMetrics.memoryUsage.current = process.memoryUsage();
    testMetrics.totalExecutionTime = Date.now() - testMetrics.startTime;
    
    const report = {
      summary: {
        totalExecutionTime: testMetrics.totalExecutionTime,
        testsRun: testMetrics.testsRun,
        testsPassed: testMetrics.testsPassed,
        testsFailed: testMetrics.testsFailed,
        successRate: testMetrics.testsRun > 0 ? (testMetrics.testsPassed / testMetrics.testsRun * 100).toFixed(2) + '%' : '0%'
      },
      performance: {
        memoryUsage: {
          start: testMetrics.memoryUsage.start,
          peak: testMetrics.memoryUsage.peak,
          current: testMetrics.memoryUsage.current,
          increase: {
            heapUsed: testMetrics.memoryUsage.current.heapUsed - testMetrics.memoryUsage.start.heapUsed,
            heapTotal: testMetrics.memoryUsage.current.heapTotal - testMetrics.memoryUsage.start.heapTotal,
            external: testMetrics.memoryUsage.current.external - testMetrics.memoryUsage.start.external
          }
        },
        ipcOperations: testMetrics.ipcOperations,
        config: performanceConfig
      },
      issues: {
        errors: errorTracker?.errors || [],
        warnings: errorTracker?.warnings || [],
        performance: errorTracker?.performance || []
      },
      timestamp: new Date().toISOString()
    };
    
    // Write detailed report
    const reportDir = path.join(process.cwd(), 'coverage', 'ipc');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportFile = path.join(reportDir, 'test-execution-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Write summary report
    const summaryReport = generateSummaryReport(report);
    const summaryFile = path.join(reportDir, 'test-summary.md');
    fs.writeFileSync(summaryFile, summaryReport);
    
    console.log('\n📊 IPC Test Execution Summary:');
    console.log(`   ✅ Tests Passed: ${testMetrics.testsPassed}`);
    console.log(`   ❌ Tests Failed: ${testMetrics.testsFailed}`);
    console.log(`   🕰️ Total Time: ${(testMetrics.totalExecutionTime / 1000).toFixed(2)}s`);
    console.log(`   📨 Memory Increase: ${(report.performance.memoryUsage.increase.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    if (testMetrics.ipcOperations.total > 0) {
      console.log(`   📞 IPC Operations: ${testMetrics.ipcOperations.total} (${testMetrics.ipcOperations.successful} successful)`);
      console.log(`   ⏱️ Avg Response Time: ${testMetrics.ipcOperations.avgResponseTime.toFixed(2)}ms`);
    }
    
    if (errorTracker?.errors?.length > 0) {
      console.log(`   ⚠️  Errors: ${errorTracker.errors.length}`);
    }
    
    if (errorTracker?.warnings?.length > 0) {
      console.log(`   🟡 Warnings: ${errorTracker.warnings.length}`);
    }
    
    console.log(`\n📄 Detailed reports saved to: ${reportDir}`);
  }
  
  // Clean up test data files
  const testDataDir = path.join(process.cwd(), 'tests', 'ipc', 'data');
  if (fs.existsSync(testDataDir)) {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
      console.log('🗑️  Cleaned up test data directory');
    } catch (error) {
      console.warn('⚠️  Could not clean up test data directory:', error.message);
    }
  }
  
  // Clear global variables
  delete (global as any).mockDatabase;
  delete (global as any).testMetrics;
  delete (global as any).errorTracker;
  delete (global as any).performanceConfig;
  delete (global as any).restoreConsole;
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log('🗑️  Performed garbage collection');
  }
  
  console.log('✨ IPC test environment cleanup complete\n');
  
  return Promise.resolve();
}

function generateSummaryReport(report: any): string {
  return `# IPC Test Execution Summary

Generated: ${report.timestamp}

## Test Results

- **Total Tests**: ${report.summary.testsRun}
- **Passed**: ✅ ${report.summary.testsPassed}
- **Failed**: ❌ ${report.summary.testsFailed}
- **Success Rate**: ${report.summary.successRate}
- **Execution Time**: ${(report.summary.totalExecutionTime / 1000).toFixed(2)}s

## Performance Metrics

### Memory Usage

- **Heap Used Increase**: ${(report.performance.memoryUsage.increase.heapUsed / 1024 / 1024).toFixed(2)}MB
- **Heap Total Increase**: ${(report.performance.memoryUsage.increase.heapTotal / 1024 / 1024).toFixed(2)}MB
- **External Memory Increase**: ${(report.performance.memoryUsage.increase.external / 1024 / 1024).toFixed(2)}MB

### IPC Operations

- **Total Operations**: ${report.performance.ipcOperations.total}
- **Successful**: ${report.performance.ipcOperations.successful}
- **Failed**: ${report.performance.ipcOperations.failed}
- **Average Response Time**: ${report.performance.ipcOperations.avgResponseTime.toFixed(2)}ms

## Issues Detected

### Errors (${report.issues.errors.length})

${report.issues.errors.length > 0 
  ? report.issues.errors.map((error: any, i: number) => 
      `${i + 1}. **${new Date(error.timestamp).toISOString()}**: ${error.message}`
    ).join('\n')
  : 'No errors detected ✅'
}

### Warnings (${report.issues.warnings.length})

${report.issues.warnings.length > 0
  ? report.issues.warnings.map((warning: any, i: number) => 
      `${i + 1}. **${new Date(warning.timestamp).toISOString()}**: ${warning.message}`
    ).join('\n')
  : 'No warnings detected ✅'
}

### Performance Issues (${report.issues.performance.length})

${report.issues.performance.length > 0
  ? report.issues.performance.map((issue: any, i: number) => 
      `${i + 1}. **${new Date(issue.timestamp).toISOString()}**: ${issue.message}`
    ).join('\n')
  : 'No performance issues detected ✅'
}

## Configuration

- **Max Test Time**: ${report.performance.config.maxTestTime}ms
- **Max Memory Increase**: ${(report.performance.config.maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB
- **Max Concurrent Requests**: ${report.performance.config.maxConcurrentRequests}

---

*Report generated by IPC Test Suite*
`;
}
