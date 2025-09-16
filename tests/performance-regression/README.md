# Automated Performance Regression Testing System

A comprehensive framework for automated performance regression detection, analysis, and reporting with CI/CD integration.

## 🚀 Features

- **Automated Test Execution**: Parallel test execution with configurable retry logic
- **Statistical Analysis**: Advanced regression detection using multiple algorithms
- **Baseline Management**: Intelligent baseline storage and comparison
- **Multi-Environment Support**: Test across development, staging, and production
- **Real-time Alerts**: Slack, email, webhook, and console notifications
- **Comprehensive Reports**: HTML, JSON, PDF, and Markdown reports with charts
- **CI/CD Integration**: Ready-to-use configurations for GitHub Actions, GitLab CI, Jenkins, and Azure DevOps
- **Performance Trending**: Track performance over time with trend analysis
- **Outlier Detection**: Statistical outlier detection with configurable thresholds

## 📦 Installation

```bash
npm install
# or
yarn install
```

## 🎯 Quick Start

### Basic Usage

```javascript
const { PerformanceRegressionSystem } = require('./tests/performance-regression');

// Initialize the system
const system = new PerformanceRegressionSystem();

// Add a test suite
system.addTestSuite({
  name: 'api-performance',
  testFunction: async (environment) => {
    const startTime = Date.now();
    // Your performance test logic here
    const response = await fetch(`https://${environment}.example.com/api/test`);
    return {
      success: response.ok,
      duration: Date.now() - startTime,
      statusCode: response.status
    };
  },
  environments: ['staging', 'production']
});

// Run regression tests
const results = await system.runRegressionTests();
console.log('Test Results:', results);
```

### Command Line Interface

```bash
# Run all regression tests
node tests/performance-regression/index.js run

# Run tests for specific environment
node tests/performance-regression/index.js run staging

# Generate CI/CD configurations
node tests/performance-regression/index.js generate-cicd

# Test alert system
node tests/performance-regression/index.js test-alerts

# Show system status
node tests/performance-regression/index.js status
```

## 🏗️ Architecture

```
tests/performance-regression/
├── core/                    # Core testing components
│   ├── test-runner.js      # Main test execution engine
│   └── baseline-comparator.js # Baseline management
├── algorithms/              # Regression detection algorithms
│   └── regression-detector.js # Statistical analysis
├── alerts/                  # Alert management
│   └── alert-manager.js    # Multi-channel notifications
├── reports/                 # Report generation
│   └── report-generator.js # Comprehensive reporting
├── ci-cd/                   # CI/CD integration
│   └── pipeline-integration.js # Pipeline configurations
├── utils/                   # Utility modules
│   ├── statistical-analysis.js # Advanced statistics
│   └── test-metrics.js     # Metrics collection
├── config/                  # Configuration management
│   └── regression-config.js # System configuration
└── examples/                # Usage examples
    └── example-usage.js    # Complete examples
```

## ⚙️ Configuration

### Environment Configuration

```javascript
const config = {
  execution: {
    timeout: '30m',
    retryAttempts: 3,
    parallelJobs: 4,
    warmupRuns: 2,
    measurementRuns: 10,
    environments: ['development', 'staging', 'production']
  },
  thresholds: {
    performance: {
      warning: 15,    // 15% performance degradation
      critical: 30    // 30% performance degradation
    },
    memory: {
      warning: 20,    // 20% memory increase
      critical: 40    // 40% memory increase
    }
  },
  alerts: {
    channels: {
      slack: {
        enabled: true,
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: '#performance-alerts'
      },
      email: {
        enabled: true,
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        }
      }
    }
  }
};

const system = new PerformanceRegressionSystem(config);
```

## 📊 Test Suites

### Creating Test Suites

```javascript
// Simple API test
system.addTestSuite({
  name: 'user-login-api',
  description: 'Test user login API performance',
  testFunction: async (environment, options) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    try {
      const response = await fetch(`https://${environment}.example.com/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'test' })
      });
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      return {
        success: response.ok,
        duration: Number(endTime - startTime) / 1000000, // Convert to ms
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        statusCode: response.status,
        data: {
          responseTime: response.headers.get('x-response-time'),
          contentLength: response.headers.get('content-length')
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Number(process.hrtime.bigint() - startTime) / 1000000
      };
    }
  },
  environments: ['staging', 'production'],
  metadata: {
    category: 'authentication',
    priority: 'critical',
    tags: ['api', 'auth', 'security']
  }
});

// Database performance test
system.addTestSuite({
  name: 'database-query-performance',
  testFunction: async (environment) => {
    const queries = [
      'SELECT * FROM users WHERE active = true LIMIT 100',
      'SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL 24 HOUR',
      'SELECT p.*, c.name FROM products p JOIN categories c ON p.category_id = c.id LIMIT 50'
    ];
    
    const results = [];
    
    for (const query of queries) {
      const startTime = Date.now();
      // Execute query (pseudo-code)
      const result = await database.query(query);
      results.push({
        query,
        duration: Date.now() - startTime,
        rowCount: result.length
      });
    }
    
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    return {
      success: true,
      duration: totalDuration,
      data: {
        queries: results,
        averageDuration: totalDuration / results.length
      }
    };
  }
});
```

## 📈 Regression Detection

The system uses multiple statistical algorithms for regression detection:

### Statistical Analysis
- **T-tests**: Compare current performance with baseline
- **Effect Size**: Calculate Cohen's d for practical significance
- **Confidence Intervals**: Statistical confidence in results

### Trend Analysis
- **Time Series**: Track performance over time
- **Correlation Analysis**: Identify performance patterns
- **Volatility Assessment**: Detect unstable performance

### Change Point Detection
- **CUSUM**: Cumulative sum control charts
- **PELT**: Pruned Exact Linear Time algorithm

### Anomaly Detection
- **Z-score**: Standard deviation-based outliers
- **IQR**: Interquartile range method
- **Modified Z-score**: Median absolute deviation

## 🚨 Alerting

### Alert Channels

```javascript
// Configure multiple alert channels
system.configureAlerts({
  channels: {
    console: {
      enabled: true,
      colors: true
    },
    slack: {
      enabled: true,
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: '#performance-alerts'
    },
    email: {
      enabled: true,
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      },
      from: 'alerts@company.com',
      to: ['team@company.com', 'ops@company.com']
    },
    webhook: {
      enabled: true,
      url: process.env.ALERT_WEBHOOK_URL,
      headers: {
        'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN}`
      }
    }
  },
  rateLimiting: {
    enabled: true,
    maxAlertsPerHour: 10,
    duplicateSuppressionMinutes: 30
  }
});
```

### Alert Types
- **Critical Regressions**: Immediate attention required
- **Performance Warnings**: Monitor closely
- **Test Failures**: Infrastructure or test issues
- **Trend Alerts**: Gradual performance degradation

## 📋 Reports

### Report Formats
- **HTML**: Interactive dashboard with charts
- **JSON**: Machine-readable data
- **PDF**: Printable executive summary
- **Markdown**: Documentation-friendly format

### Report Contents
- Executive summary with key metrics
- Detailed regression analysis
- Performance trends and charts
- Environment comparison
- Actionable recommendations
- Historical data analysis

## 🔧 CI/CD Integration

### GitHub Actions

```yaml
name: Performance Regression Testing

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'

jobs:
  performance-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [staging, production]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: |
          node tests/performance-regression/index.js run ${{ matrix.environment }}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SMTP_USER: ${{ secrets.SMTP_USER }}
          SMTP_PASS: ${{ secrets.SMTP_PASS }}
      
      - name: Upload reports
        uses: actions/upload-artifact@v4
        with:
          name: performance-report-${{ matrix.environment }}
          path: reports/
```

### GitLab CI

```yaml
stages:
  - test
  - report

performance:staging:
  stage: test
  script:
    - npm ci
    - node tests/performance-regression/index.js run staging
  artifacts:
    when: always
    paths:
      - reports/
    expire_in: 30 days
  only:
    - merge_requests
    - main
```

## 🌍 Environment Variables

```bash
# Alert Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@company.com
SMTP_PASS=your-password
ALERT_WEBHOOK_URL=https://api.company.com/alerts

# Test Configuration
TEST_TIMEOUT=30m
MEASUREMENT_RUNS=10
PARALLEL_JOBS=4

# Environment URLs
STAGING_BASE_URL=https://staging.company.com
PRODUCTION_BASE_URL=https://production.company.com
```

## 📚 API Reference

### PerformanceRegressionSystem

```javascript
const system = new PerformanceRegressionSystem(config);

// Core methods
await system.runRegressionTests(options)     // Run complete test suite
await system.runEnvironmentTests(env)        // Test specific environment
system.addTestSuite(suite)                   // Add test suite
system.configureAlerts(alertConfig)          // Configure alerts
await system.generateCICDConfigs()           // Generate CI/CD configs
await system.testAlerts()                    // Test alert system
system.getStatus()                           // Get system status
system.cleanup()                             // Cleanup resources
```

### Test Suite Structure

```javascript
const testSuite = {
  name: 'unique-test-name',
  description: 'Human-readable description',
  testFunction: async (environment, options) => {
    // Return test result object
    return {
      success: boolean,     // Required: Test success status
      duration: number,     // Required: Test duration in ms
      memoryUsage: number,  // Optional: Memory usage in bytes
      error: string,        // Optional: Error message if failed
      data: object         // Optional: Additional test data
    };
  },
  environments: ['dev', 'staging', 'prod'],
  metadata: {
    category: 'api',
    priority: 'high',
    tags: ['authentication', 'security']
  },
  thresholds: {           // Optional: Suite-specific thresholds
    performance: { warning: 10, critical: 20 },
    memory: { warning: 15, critical: 30 }
  }
};
```

## 🧪 Examples

See [examples/example-usage.js](examples/example-usage.js) for comprehensive usage examples including:

- Basic regression testing setup
- Advanced configuration
- CI/CD integration
- Custom test suites
- Configuration management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:

1. Check the [examples](examples/) directory
2. Review the configuration options
3. Validate your test suite structure
4. Check environment variables
5. Enable debug logging

## 🔄 Changelog

### v1.0.0
- Initial release
- Core regression testing framework
- Multi-algorithm detection
- CI/CD integration
- Comprehensive reporting
- Multi-channel alerting
