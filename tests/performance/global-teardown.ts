import path from 'path';
import fs from 'fs';

/**
 * Global teardown for performance tests
 * This runs once after all performance tests complete
 */
export default async function globalTeardown() {
  console.log('\n🧹 Starting global performance test cleanup...');
  
  try {
    // Final garbage collection
    if (global.gc) {
      global.gc();
      console.log('✅ Final garbage collection completed');
    }
    
    // Generate final performance report
    const resultsDir = process.env.PERFORMANCE_RESULTS_DIR;
    const benchmarkFile = process.env.BENCHMARK_RESULTS_FILE;
    
    if (benchmarkFile && fs.existsSync(benchmarkFile)) {
      try {
        const benchmarkData = JSON.parse(fs.readFileSync(benchmarkFile, 'utf8'));
        
        // Update with completion info
        benchmarkData.endTime = new Date().toISOString();
        benchmarkData.duration = new Date().getTime() - new Date(benchmarkData.startTime).getTime();
        
        // Add final system metrics
        const finalMemory = process.memoryUsage();
        benchmarkData.finalSystemState = {
          memory: {
            heapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(finalMemory.heapTotal / 1024 / 1024), // MB
            rss: Math.round(finalMemory.rss / 1024 / 1024), // MB
            external: Math.round(finalMemory.external / 1024 / 1024) // MB
          },
          uptime: Math.round(process.uptime())
        };
        
        // Save updated benchmark data
        fs.writeFileSync(benchmarkFile, JSON.stringify(benchmarkData, null, 2));
        console.log(`📊 Final benchmark data saved to: ${benchmarkFile}`);
        
        // Generate summary report
        const summaryReport = generateSummaryReport(benchmarkData);
        const summaryFile = path.join(resultsDir!, `performance-summary-${Date.now()}.md`);
        fs.writeFileSync(summaryFile, summaryReport);
        console.log(`📋 Performance summary saved to: ${summaryFile}`);
        
      } catch (error) {
        console.warn('⚠️  Could not update benchmark results:', error.message);
      }
    }
    
    // Clean up temporary files
    const tempDir = process.env.PERFORMANCE_TEST_TEMP_DIR;
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        // Remove test databases and temporary files
        const files = fs.readdirSync(tempDir);
        let cleanedFiles = 0;
        
        files.forEach(file => {
          try {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            
            // Only remove files older than 1 hour or test-specific files
            const isOld = (Date.now() - stats.mtime.getTime()) > 3600000; // 1 hour
            const isTestFile = file.includes('test') || file.includes('performance');
            
            if (isOld || isTestFile) {
              fs.unlinkSync(filePath);
              cleanedFiles++;
            }
          } catch (error) {
            // Ignore individual file cleanup errors
          }
        });
        
        console.log(`🗑️  Cleaned up ${cleanedFiles} temporary files`);
        
        // Try to remove temp directory if empty
        try {
          const remainingFiles = fs.readdirSync(tempDir);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(tempDir);
            console.log('📁 Removed temporary directory');
          }
        } catch (error) {
          // Directory not empty or other issue - leave it
        }
        
      } catch (error) {
        console.warn('⚠️  Could not clean up temporary directory:', error.message);
      }
    }
    
    // Display final memory statistics
    const finalMemory = process.memoryUsage();
    console.log('\n📈 Final Performance Test Statistics:');
    console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  External: ${(finalMemory.external / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Process Uptime: ${Math.round(process.uptime())}s`);
    
    // Memory usage warnings
    const heapUsedMB = finalMemory.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) {
      console.warn(`⚠️  High memory usage detected: ${heapUsedMB.toFixed(2)}MB`);
      console.warn('   Consider investigating potential memory leaks');
    }
    
    // Check if any performance thresholds were consistently violated
    const config = global.__PERFORMANCE_CONFIG__;
    if (config && heapUsedMB > config.MAX_MEMORY_USAGE_MB) {
      console.warn(`⚠️  Memory usage exceeded threshold: ${heapUsedMB.toFixed(2)}MB > ${config.MAX_MEMORY_USAGE_MB}MB`);
    }
    
    console.log('\n✅ Global performance test cleanup completed');
    
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    
    // Still try to display basic memory info
    try {
      const memory = process.memoryUsage();
      console.log(`Final memory: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB heap used`);
    } catch (memError) {
      // Ignore memory check error
    }
  }
}

/**
 * Generate a markdown summary report
 */
function generateSummaryReport(benchmarkData: any): string {
  const duration = benchmarkData.duration || 0;
  const durationMinutes = Math.round(duration / 60000);
  
  let report = `# Performance Test Summary\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Duration:** ${durationMinutes} minutes\n\n`;
  
  // System Information
  report += `## System Information\n\n`;
  if (benchmarkData.systemInfo) {
    const sys = benchmarkData.systemInfo;
    report += `- **Platform:** ${sys.platform} (${sys.arch})\n`;
    report += `- **CPUs:** ${sys.cpus}\n`;
    report += `- **Memory:** ${sys.totalMemory}GB\n`;
    report += `- **Node Version:** ${sys.nodeVersion}\n`;
    if (sys.electronVersion && sys.electronVersion !== 'N/A') {
      report += `- **Electron Version:** ${sys.electronVersion}\n`;
    }
  }
  report += `\n`;
  
  // Performance Configuration
  report += `## Performance Thresholds\n\n`;
  if (benchmarkData.performanceConfig) {
    const config = benchmarkData.performanceConfig;
    report += `| Metric | Threshold |\n`;
    report += `|--------|----------|\n`;
    Object.entries(config).forEach(([key, value]) => {
      const unit = key.includes('TIMEOUT') ? 'ms' : 
                   key.includes('MEMORY') ? 'MB' : 
                   key.includes('THROUGHPUT') ? ' ops/sec' : '';
      report += `| ${key.replace(/_/g, ' ')} | ${value}${unit} |\n`;
    });
  }
  report += `\n`;
  
  // Memory Analysis
  report += `## Memory Analysis\n\n`;
  if (benchmarkData.finalSystemState?.memory) {
    const mem = benchmarkData.finalSystemState.memory;
    report += `- **Heap Used:** ${mem.heapUsed}MB\n`;
    report += `- **Heap Total:** ${mem.heapTotal}MB\n`;
    report += `- **RSS:** ${mem.rss}MB\n`;
    report += `- **External:** ${mem.external}MB\n`;
    
    // Memory health assessment
    const maxMemoryMB = benchmarkData.performanceConfig?.MAX_MEMORY_USAGE_MB || 500;
    if (mem.heapUsed > maxMemoryMB) {
      report += `\n⚠️ **Warning:** Memory usage (${mem.heapUsed}MB) exceeded threshold (${maxMemoryMB}MB)\n`;
    } else {
      report += `\n✅ Memory usage within acceptable limits\n`;
    }
  }
  report += `\n`;
  
  // Test Results Summary
  report += `## Test Results\n\n`;
  if (benchmarkData.results && benchmarkData.results.length > 0) {
    const results = benchmarkData.results;
    const totalTests = results.length;
    const passedTests = results.filter((r: any) => r.passed || r.success).length;
    const failedTests = totalTests - passedTests;
    
    report += `- **Total Tests:** ${totalTests}\n`;
    report += `- **Passed:** ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)\n`;
    report += `- **Failed:** ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)\n`;
    
    if (failedTests > 0) {
      report += `\n### Failed Tests\n\n`;
      results.filter((r: any) => !r.passed && !r.success).forEach((result: any) => {
        report += `- **${result.name || 'Unknown Test'}**: ${result.error || result.reason || 'No details available'}\n`;
      });
    }
  } else {
    report += `No detailed test results available.\n`;
  }
  
  // Recommendations
  report += `\n## Recommendations\n\n`;
  
  const recommendations: string[] = [];
  
  if (benchmarkData.finalSystemState?.memory?.heapUsed > 400) {
    recommendations.push('Consider implementing memory optimization strategies - heap usage is high');
  }
  
  if (durationMinutes > 10) {
    recommendations.push('Performance tests took longer than expected - investigate test efficiency');
  }
  
  if (benchmarkData.systemInfo?.cpus < 4) {
    recommendations.push('Consider running performance tests on a machine with more CPU cores for better reliability');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance tests completed successfully with no major issues detected');
  }
  
  recommendations.forEach((rec, index) => {
    report += `${index + 1}. ${rec}\n`;
  });
  
  report += `\n---\n`;
  report += `*Report generated by MVP1 Knowledge Base Assistant Performance Test Suite*\n`;
  
  return report;
}