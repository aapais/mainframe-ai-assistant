/**
 * Example Usage of Performance Regression Testing System
 * Demonstrates how to set up and use the automated regression testing framework
 */

const { PerformanceRegressionSystem, createExampleTestSuite } = require('../index');

/**
 * Basic usage example
 */
async function basicExample() {
  console.log('=== Basic Performance Regression Testing Example ===\n');
  
  // Initialize the system
  const system = new PerformanceRegressionSystem();
  
  // Add some example test suites
  system.addTestSuite({
    name: 'api-response-time',
    description: 'Test API response time performance',
    testFunction: async (environment, options) => {
      const startTime = process.hrtime.bigint();
      
      // Simulate API call
      await new Promise(resolve => {
        const delay = 100 + Math.random() * 200; // 100-300ms
        setTimeout(resolve, delay);
      });
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to ms
      
      return {
        success: Math.random() > 0.05, // 95% success rate
        duration,
        statusCode: Math.random() > 0.05 ? 200 : 500,
        data: { responseTime: duration }
      };
    },
    environments: ['staging', 'production'],
    metadata: {
      category: 'api',
      priority: 'high'
    }
  });
  
  system.addTestSuite({
    name: 'memory-usage-test',
    description: 'Test memory usage patterns',
    testFunction: async (environment, options) => {
      const startMemory = process.memoryUsage();
      
      // Simulate memory-intensive operation
      const data = new Array(10000).fill(0).map(() => Math.random());
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const endMemory = process.memoryUsage();
      
      return {
        success: true,
        duration: 50,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        data: { dataSize: data.length }
      };
    },
    environments: ['development', 'staging']
  });
  
  try {
    // Run regression tests
    const results = await system.runRegressionTests({
      environments: ['staging'] // Test only staging for this example
    });
    
    console.log('\n🎉 Regression testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Regression testing failed:', error.message);
  } finally {
    system.cleanup();
  }
}

/**
 * Advanced configuration example
 */
async function advancedConfigurationExample() {
  console.log('\n=== Advanced Configuration Example ===\n');
  
  // Custom configuration
  const customConfig = {
    execution: {
      measurementRuns: 15,
      warmupRuns: 3,
      parallelJobs: 2,
      timeout: '45m'
    },
    thresholds: {
      performance: {
        warning: 10,
        critical: 25
      },
      memory: {
        warning: 15,
        critical: 30
      }
    },
    alerts: {
      channels: {
        console: { enabled: true, colors: true },
        slack: {
          enabled: false, // Would be true in production
          webhook: process.env.SLACK_WEBHOOK_URL,
          channel: '#performance-alerts'
        }
      }
    },
    reports: {
      formats: ['html', 'json'],
      includeCharts: true
    }
  };
  
  const system = new PerformanceRegressionSystem(customConfig);
  
  // Configure alerts
  system.configureAlerts({
    channels: {
      console: { enabled: true },
      email: {
        enabled: false, // Would configure SMTP in production
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        },
        from: 'alerts@example.com',
        to: ['team@example.com']
      }
    }
  });
  
  // Add realistic test suites
  system.addTestSuite({
    name: 'database-query-performance',
    testFunction: async (environment) => {
      const startTime = Date.now();
      
      // Simulate database query
      const queryTime = 50 + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, queryTime));
      
      return {
        success: Math.random() > 0.02,
        duration: Date.now() - startTime,
        data: {
          rowsReturned: Math.floor(Math.random() * 1000),
          queryComplexity: 'medium'
        }
      };
    },
    environments: ['staging', 'production']
  });
  
  system.addTestSuite({
    name: 'file-processing-speed',
    testFunction: async (environment) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      // Simulate file processing
      const processingTime = 200 + Math.random() * 300;
      const fileSize = 1024 * 1024; // 1MB
      
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      const endMemory = process.memoryUsage();
      
      return {
        success: true,
        duration: Date.now() - startTime,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        data: {
          fileSize,
          throughput: fileSize / processingTime * 1000 // bytes per second
        }
      };
    }
  });
  
  console.log('System Status:', system.getStatus());
  
  try {
    const results = await system.runEnvironmentTests('staging');
    console.log('\n🎉 Advanced configuration test completed!');
    
  } catch (error) {
    console.error('❌ Advanced test failed:', error.message);
  } finally {
    system.cleanup();
  }
}

/**
 * CI/CD integration example
 */
async function cicdIntegrationExample() {
  console.log('\n=== CI/CD Integration Example ===\n');
  
  const system = new PerformanceRegressionSystem({
    cicd: {
      platforms: {
        github: { enabled: true },
        gitlab: { enabled: false },
        jenkins: { enabled: false }
      },
      failOnRegression: true,
      failOnCritical: true,
      commentOnPR: true
    }
  });
  
  try {
    // Generate CI/CD configurations
    const configs = await system.generateCICDConfigs();
    console.log('Generated CI/CD configurations:');
    Object.entries(configs).forEach(([platform, config]) => {
      console.log(`- ${platform}: ${config.files?.length || config.workflows?.length || 1} files generated`);
    });
    
    // Test alert system
    console.log('\nTesting alert system...');
    const alertTest = await system.testAlerts();
    console.log('Alert test result:', alertTest.success ? '✅ Success' : '❌ Failed');
    
  } catch (error) {
    console.error('❌ CI/CD integration example failed:', error.message);
  } finally {
    system.cleanup();
  }
}

/**
 * Custom test suite example
 */
function customTestSuiteExample() {
  console.log('\n=== Custom Test Suite Example ===\n');
  
  // Example of a comprehensive test suite
  const comprehensiveTestSuite = {
    name: 'e2e-user-journey',
    description: 'End-to-end user journey performance test',
    testFunction: async (environment, options) => {
      const metrics = {
        steps: [],
        totalDuration: 0,
        totalMemoryUsage: 0,
        errors: []
      };
      
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      try {
        // Step 1: User login
        const loginStart = Date.now();
        await simulateStep('login', 100 + Math.random() * 50);
        metrics.steps.push({
          name: 'login',
          duration: Date.now() - loginStart,
          success: Math.random() > 0.01
        });
        
        // Step 2: Dashboard load
        const dashboardStart = Date.now();
        await simulateStep('dashboard', 200 + Math.random() * 100);
        metrics.steps.push({
          name: 'dashboard',
          duration: Date.now() - dashboardStart,
          success: Math.random() > 0.02
        });
        
        // Step 3: Data processing
        const processStart = Date.now();
        await simulateStep('process', 300 + Math.random() * 200);
        metrics.steps.push({
          name: 'process',
          duration: Date.now() - processStart,
          success: Math.random() > 0.05
        });
        
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        metrics.totalDuration = endTime - startTime;
        metrics.totalMemoryUsage = endMemory.heapUsed - startMemory.heapUsed;
        
        const allStepsSuccessful = metrics.steps.every(step => step.success);
        
        return {
          success: allStepsSuccessful,
          duration: metrics.totalDuration,
          memoryUsage: metrics.totalMemoryUsage,
          data: metrics
        };
        
      } catch (error) {
        metrics.errors.push(error.message);
        return {
          success: false,
          duration: Date.now() - startTime,
          error: error.message,
          data: metrics
        };
      }
    },
    environments: ['staging', 'production'],
    metadata: {
      category: 'e2e',
      priority: 'critical',
      tags: ['user-journey', 'integration', 'performance'],
      timeout: '2m'
    },
    thresholds: {
      performance: { warning: 8, critical: 15 },
      memory: { warning: 10, critical: 20 }
    }
  };
  
  async function simulateStep(stepName, duration) {
    // Simulate step execution with potential for failure
    await new Promise(resolve => setTimeout(resolve, duration));
    
    if (Math.random() < 0.01) { // 1% chance of failure
      throw new Error(`Step ${stepName} failed`);
    }
  }
  
  console.log('Custom test suite created:');
  console.log(`- Name: ${comprehensiveTestSuite.name}`);
  console.log(`- Description: ${comprehensiveTestSuite.description}`);
  console.log(`- Environments: ${comprehensiveTestSuite.environments.join(', ')}`);
  console.log(`- Category: ${comprehensiveTestSuite.metadata.category}`);
  
  return comprehensiveTestSuite;
}

/**
 * Configuration management example
 */
function configurationManagementExample() {
  console.log('\n=== Configuration Management Example ===\n');
  
  const system = new PerformanceRegressionSystem();
  
  // Export current configuration
  const currentConfig = system.exportConfiguration();
  console.log('Current configuration exported');
  
  // Modify configuration
  const modifiedConfig = JSON.parse(currentConfig);
  modifiedConfig.execution.measurementRuns = 20;
  modifiedConfig.thresholds.performance.warning = 12;
  
  // Import modified configuration
  const validation = system.importConfiguration(modifiedConfig);
  
  console.log('Configuration validation:');
  console.log(`- Valid: ${validation.valid}`);
  console.log(`- Errors: ${validation.errors.length}`);
  console.log(`- Warnings: ${validation.warnings.length}`);
  
  if (validation.warnings.length > 0) {
    console.log('Warnings:');
    validation.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  console.log('\nUpdated system status:', system.getStatus());
  
  system.cleanup();
}

/**
 * Main example runner
 */
async function runExamples() {
  console.log('📊 Performance Regression Testing System - Examples\n');
  
  try {
    await basicExample();
    await advancedConfigurationExample();
    await cicdIntegrationExample();
    
    const customSuite = customTestSuiteExample();
    configurationManagementExample();
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Example execution failed:', error.message);
    console.error(error.stack);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  basicExample,
  advancedConfigurationExample,
  cicdIntegrationExample,
  customTestSuiteExample,
  configurationManagementExample,
  runExamples
};