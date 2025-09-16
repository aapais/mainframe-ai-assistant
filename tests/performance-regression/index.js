/**
 * Performance Regression Testing System
 * Main entry point for the automated regression testing framework
 */

const PerformanceTestRunner = require('./core/test-runner');
const BaselineComparator = require('./core/baseline-comparator');
const RegressionDetector = require('./algorithms/regression-detector');
const AlertManager = require('./alerts/alert-manager');
const ReportGenerator = require('./reports/report-generator');
const PipelineIntegration = require('./ci-cd/pipeline-integration');
const { RegressionConfig, config } = require('./config/regression-config');
const StatisticalAnalysis = require('./utils/statistical-analysis');
const TestMetrics = require('./utils/test-metrics');

/**
 * Main Performance Regression Testing System
 */
class PerformanceRegressionSystem {
  constructor(customConfig = {}) {
    // Initialize configuration
    this.config = new RegressionConfig();
    if (Object.keys(customConfig).length > 0) {
      this.config.importConfig(customConfig);
    }

    // Initialize core components
    this.testRunner = new PerformanceTestRunner(this.config.getAll());
    this.baseline = new BaselineComparator(this.config.getAll());
    this.detector = new RegressionDetector(this.config.getAll());
    this.alerts = new AlertManager(this.config.getAll());
    this.reports = new ReportGenerator(this.config.getAll());
    this.pipeline = new PipelineIntegration(this.config.getAll());
    this.stats = new StatisticalAnalysis();
    this.metrics = new TestMetrics();
    
    // Validate configuration
    const validation = this.config.validate();
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
    
    if (validation.warnings.length > 0) {
      console.warn('Configuration warnings:', validation.warnings.join(', '));
    }
  }

  /**
   * Run complete performance regression test suite
   */
  async runRegressionTests(options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting performance regression testing...');
      
      // Execute test suite
      const result = await this.testRunner.executeRegressionSuite({
        environments: options.environments || this.config.get('execution.environments'),
        suites: options.suites || this.config.get('testSuites'),
        ...options
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ Performance regression testing completed in ${duration}ms`);
      
      // Print summary
      this.printSummary(result);
      
      return result;
      
    } catch (error) {
      console.error('❌ Performance regression testing failed:', error.message);
      throw error;
    }
  }

  /**
   * Run tests for specific environment
   */
  async runEnvironmentTests(environment, options = {}) {
    return await this.runRegressionTests({
      environments: [environment],
      ...options
    });
  }

  /**
   * Add test suite
   */
  addTestSuite(suite) {
    return this.config.addTestSuite(suite);
  }

  /**
   * Configure alerts
   */
  configureAlerts(alertConfig) {
    const config = this.config.configureAlerts(alertConfig);
    this.alerts = new AlertManager(this.config.getAll());
    return config;
  }

  /**
   * Generate CI/CD configurations
   */
  async generateCICDConfigs() {
    return await this.pipeline.generateAllConfigurations();
  }

  /**
   * Test alert system
   */
  async testAlerts() {
    return await this.alerts.testAlerts();
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      config: this.config.getSummary(),
      testSuites: this.config.get('testSuites').length,
      environments: this.config.get('execution.environments'),
      thresholds: this.config.get('thresholds'),
      alerts: {
        enabled: Object.entries(this.config.get('alerts.channels'))
          .filter(([_, config]) => config.enabled)
          .map(([channel, _]) => channel)
      }
    };
  }

  /**
   * Print test results summary
   */
  printSummary(result) {
    console.log('\n📊 Performance Test Summary:');
    console.log('─'.repeat(50));
    console.log(`Run ID: ${result.runId}`);
    console.log(`Total Tests: ${result.regressions.summary.totalTests}`);
    console.log(`Regressions: ${result.regressions.summary.regressionCount}`);
    console.log(`Critical Issues: ${result.regressions.summary.criticalRegressions}`);
    console.log(`Improvements: ${result.regressions.summary.improvementCount}`);
    
    if (result.regressions.summary.criticalRegressions > 0) {
      console.log('\n🚨 Critical Regressions Detected:');
      result.regressions.regressions
        .filter(r => r.severity === 'critical')
        .forEach(regression => {
          console.log(`  • ${regression.testSuite} (${regression.environment})`);
          if (regression.summary) {
            console.log(`    ${regression.summary.message}`);
          }
        });
    }
    
    if (result.regressions.summary.improvementCount > 0) {
      console.log('\n🎉 Performance Improvements:');
      result.regressions.improvements.forEach(improvement => {
        console.log(`  • ${improvement.testSuite} (${improvement.environment})`);
      });
    }
    
    if (result.report?.url) {
      console.log(`\n📋 Full Report: ${result.report.url}`);
    }
    
    console.log('─'.repeat(50));
  }

  /**
   * Export system configuration
   */
  exportConfiguration() {
    return this.config.exportConfig();
  }

  /**
   * Import system configuration
   */
  importConfiguration(configJson) {
    const validation = this.config.importConfig(configJson);
    
    // Reinitialize components with new configuration
    const newConfig = this.config.getAll();
    this.testRunner = new PerformanceTestRunner(newConfig);
    this.baseline = new BaselineComparator(newConfig);
    this.detector = new RegressionDetector(newConfig);
    this.alerts = new AlertManager(newConfig);
    this.reports = new ReportGenerator(newConfig);
    this.pipeline = new PipelineIntegration(newConfig);
    
    return validation;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.testRunner) {
      this.testRunner.cleanup();
    }
    if (this.metrics) {
      this.metrics.clear();
    }
  }
}

/**
 * Create example test suite
 */
function createExampleTestSuite(name, baseUrl) {
  return {
    name,
    description: `Example performance test for ${name}`,
    testFunction: async (environment, options) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      try {
        // Simulate HTTP request
        const response = await fetch(`${baseUrl}/api/test`, {
          method: 'GET',
          timeout: 5000
        });
        
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        return {
          success: response.ok,
          duration: endTime - startTime,
          statusCode: response.status,
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
          responseSize: response.headers.get('content-length') || 0
        };
        
      } catch (error) {
        const endTime = Date.now();
        
        return {
          success: false,
          duration: endTime - startTime,
          error: error.message,
          statusCode: 0,
          memoryUsage: 0
        };
      }
    },
    environments: ['staging', 'production'],
    metadata: {
      category: 'api',
      priority: 'high',
      tags: ['http', 'api', 'performance']
    }
  };
}

/**
 * CLI interface
 */
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const system = new PerformanceRegressionSystem();
  
  try {
    switch (command) {
      case 'run':
        const environment = args[1];
        if (environment) {
          await system.runEnvironmentTests(environment);
        } else {
          await system.runRegressionTests();
        }
        break;
        
      case 'config':
        console.log(JSON.stringify(system.getStatus(), null, 2));
        break;
        
      case 'generate-cicd':
        const configs = await system.generateCICDConfigs();
        console.log('Generated CI/CD configurations:', configs);
        break;
        
      case 'test-alerts':
        const alertResult = await system.testAlerts();
        console.log('Alert test result:', alertResult);
        break;
        
      case 'status':
        console.log(system.getStatus());
        break;
        
      default:
        console.log(`
Performance Regression Testing System CLI

Usage:
  node index.js <command> [options]

Commands:
  run [environment]     Run regression tests for all or specific environment
  config               Show current configuration
  generate-cicd        Generate CI/CD pipeline configurations
  test-alerts          Test alert system
  status               Show system status

Examples:
  node index.js run
  node index.js run staging
  node index.js generate-cicd
`);
    }
    
  } catch (error) {
    console.error('CLI Error:', error.message);
    process.exit(1);
  } finally {
    system.cleanup();
  }
}

// Export main classes and utilities
module.exports = {
  PerformanceRegressionSystem,
  PerformanceTestRunner,
  BaselineComparator,
  RegressionDetector,
  AlertManager,
  ReportGenerator,
  PipelineIntegration,
  RegressionConfig,
  StatisticalAnalysis,
  TestMetrics,
  createExampleTestSuite,
  config
};

// Run CLI if this file is executed directly
if (require.main === module) {
  cli().catch(console.error);
}