# Performance Testing Framework Guide

## Overview

This comprehensive performance testing framework validates <1s response times and ensures SLA compliance through multiple testing strategies:

- **Load Testing**: Realistic user patterns and traffic simulation
- **Stress Testing**: Peak load identification and breaking point analysis
- **Performance Benchmarking**: Detailed response time and throughput measurement
- **SLA Validation**: Compliance verification against defined targets
- **Regression Testing**: Performance change detection between releases
- **Continuous Monitoring**: Real-time performance tracking

## SLA Targets

The framework validates against these default SLA targets:

- **Response Time**: P95 < 1000ms (1 second)
- **Availability**: ≥ 99.9% uptime
- **Throughput**: ≥ 100 requests per second
- **Error Rate**: ≤ 1% of requests

## Quick Start

### 1. Run All Performance Tests

```bash
# Run comprehensive performance testing suite
npm run test:performance

# Or run with custom target URL
npm run test:performance -- http://your-api-url:3000

# Run specific test suite
npm run test:performance:load
npm run test:performance:stress
npm run test:performance:sla
```

### 2. Monitor Performance in Real-time

```bash
# Start continuous monitoring
node scripts/performance/performance-monitor.js

# With custom configuration
node scripts/performance/performance-monitor.js --url http://localhost:3000 --interval 30000
```

### 3. Generate Reports

```bash
# Generate comprehensive performance report
node scripts/performance/performance-report-generator.js --input ./performance-test-results/
```

## Test Suites

### 1. Performance Test Suite

**Location**: `tests/performance/performance-test-suite.js`

Comprehensive testing including:
- Response time validation across different scenarios
- Throughput measurement at various concurrency levels
- Cache effectiveness testing
- Memory usage analysis
- Endurance testing for stability

```javascript
const PerformanceTestSuite = require('./tests/performance/performance-test-suite');

const testSuite = new PerformanceTestSuite({
  baseUrl: 'http://localhost:3000',
  slaTarget: 1000,
  iterations: 100
});

const results = await testSuite.runComprehensiveTest();
```

### 2. Load Testing

**Location**: `tests/load/load-test-runner.js`

Simulates realistic user behavior patterns:

```javascript
const LoadTestRunner = require('./tests/load/load-test-runner');

const scenarios = [
  {
    name: 'typical-user',
    actions: [
      { endpoint: '/api/search', params: { q: 'test' }, weight: 3, thinkTime: 2000 },
      { endpoint: '/api/entries', params: { limit: 10 }, weight: 2, thinkTime: 1500 }
    ]
  }
];

const runner = new LoadTestRunner();
const results = await runner.runLoadTest(scenarios);
```

### 3. Stress Testing

**Location**: `tests/stress/stress-test-framework.js`

Identifies system breaking points:

```javascript
const StressTestFramework = require('./tests/stress/stress-test-framework');

const framework = new StressTestFramework({
  maxLoad: 1000,
  loadIncrement: 50,
  testDuration: 30000
});

const results = await framework.runStressTest();
```

### 4. SLA Compliance Testing

**Location**: `tests/sla-validation/sla-compliance-tests.js`

Validates adherence to service level agreements:

```javascript
const SLAComplianceTests = require('./tests/sla-validation/sla-compliance-tests');

const slaTests = new SLAComplianceTests({
  slaTargets: {
    responseTime: { p95: 1000 },
    availability: 99.9,
    throughput: 100,
    errorRate: 1
  }
});

const results = await slaTests.validateSLACompliance();
```

### 5. Performance Benchmarking

**Location**: `tests/benchmarks/performance-benchmarks.js`

Detailed performance measurement:

```javascript
const PerformanceBenchmarks = require('./tests/benchmarks/performance-benchmarks');

const benchmarks = new PerformanceBenchmarks({
  iterations: 100,
  concurrencyLevels: [1, 5, 10, 25, 50]
});

const results = await benchmarks.runBenchmarkSuite();
```

### 6. Regression Testing

**Location**: `tests/performance/performance-regression-tests.js`

Detects performance changes between releases:

```javascript
const PerformanceRegressionTests = require('./tests/performance/performance-regression-tests');

const regressionTests = new PerformanceRegressionTests({
  baselineFile: './baselines/performance-baseline.json',
  regressionThreshold: 20 // 20% degradation threshold
});

const results = await regressionTests.runRegressionTests();
```

## Monitoring and Alerting

### Real-time Performance Monitor

**Location**: `scripts/performance/performance-monitor.js`

Continuous monitoring with alerting:

```javascript
const PerformanceMonitor = require('./scripts/performance/performance-monitor');

const monitor = new PerformanceMonitor({
  monitoringInterval: 30000,
  alertThresholds: {
    responseTime: 2000,
    errorRate: 5,
    throughput: 50,
    availability: 95
  }
});

monitor.on('alert', (alert) => {
  console.log(`🚨 ALERT: ${alert.message}`);
});

await monitor.startMonitoring();
```

## Custom Matchers

The framework provides custom Jest matchers for performance assertions:

```javascript
// Response time assertions
expect(responseTime).toBeWithinSLA(1000);
expect(responseTime).toBeFasterThan(baseline);

// Throughput assertions
expect(throughput).toMeetThroughputTarget(100);

// Error rate assertions
expect(errorRate).toHaveAcceptableErrorRate(1);

// Availability assertions
expect(availability).toMeetAvailabilitySLA(99.9);

// Percentile assertions
expect(stats).toHavePercentileWithin(95, 1000);

// Regression assertions
expect(currentTime).toShowNoRegression(baselineTime, 20);

// Cache effectiveness
expect({uncached: 100, cached: 30}).toShowCacheEffectiveness(50);
```

## Configuration

### Environment Variables

```bash
# Test target URL
TEST_BASE_URL=http://localhost:3000

# SLA targets
SLA_RESPONSE_TIME=1000
SLA_AVAILABILITY=99.9
SLA_THROUGHPUT=100
SLA_ERROR_RATE=1

# Test configuration
PERFORMANCE_TEST_ITERATIONS=100
PERFORMANCE_TEST_DURATION=60000
PERFORMANCE_MAX_CONCURRENCY=100
```

### Jest Configuration

Performance tests use a specialized Jest configuration (`jest.performance.config.js`):

```javascript
module.exports = {
  testTimeout: 600000, // 10 minutes
  maxWorkers: 1, // Sequential execution
  setupFilesAfterEnv: ['<rootDir>/jest.setup.performance.js'],
  testMatch: [
    '<rootDir>/tests/performance/**/*.test.js',
    '<rootDir>/tests/load/**/*.test.js',
    '<rootDir>/tests/stress/**/*.test.js'
  ]
};
```

## Report Generation

### Comprehensive Reports

The framework generates reports in multiple formats:

```javascript
const PerformanceReportGenerator = require('./scripts/performance/performance-report-generator');

const generator = new PerformanceReportGenerator({
  reportFormats: ['html', 'json', 'csv'],
  includeCharts: true,
  slaTargets: { /* your targets */ }
});

const report = await generator.generateReport(testResults);
```

### Report Contents

Generated reports include:

- **Executive Summary**: Overall grade and SLA compliance
- **Performance Metrics**: Response time, throughput, error rate, availability
- **Test Coverage**: Which test types were executed
- **Trend Analysis**: Performance changes over time
- **Recommendations**: Actionable optimization suggestions
- **Detailed Results**: Raw test data and metrics

## CI/CD Integration

### Package.json Scripts

```json
{
  "scripts": {
    "test:performance": "node scripts/performance/run-performance-tests.js",
    "test:performance:load": "jest --config jest.performance.config.js tests/load/",
    "test:performance:stress": "jest --config jest.performance.config.js tests/stress/",
    "test:performance:sla": "jest --config jest.performance.config.js tests/sla-validation/",
    "test:performance:regression": "jest --config jest.performance.config.js tests/performance/performance-regression-tests.js",
    "monitor:performance": "node scripts/performance/performance-monitor.js"
  }
}
```

### GitHub Actions Example

```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Start application
        run: npm start &

      - name: Wait for application
        run: npx wait-on http://localhost:3000/api/health

      - name: Run performance tests
        run: npm run test:performance
        env:
          TEST_BASE_URL: http://localhost:3000

      - name: Upload performance reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-reports
          path: performance-test-results/
```

## Best Practices

### 1. Test Environment

- Use dedicated performance testing environment
- Ensure consistent hardware and network conditions
- Isolate from other processes and traffic
- Monitor system resources during tests

### 2. Test Data

- Use realistic data volumes
- Maintain consistent test datasets
- Clean up test data between runs
- Use proper data isolation

### 3. Baseline Management

- Establish performance baselines early
- Update baselines when legitimate improvements occur
- Track baseline changes over time
- Document baseline update reasons

### 4. Alerting Strategy

- Set appropriate alert thresholds
- Implement escalation procedures
- Use multiple notification channels
- Include context in alert messages

### 5. Performance Optimization

- Focus on P95/P99 response times
- Optimize for realistic load patterns
- Consider caching strategies
- Monitor database performance
- Implement proper indexing

## Troubleshooting

### Common Issues

1. **Tests Timing Out**
   - Increase Jest timeout in configuration
   - Check application startup time
   - Verify network connectivity

2. **High Response Times**
   - Check database query performance
   - Verify caching effectiveness
   - Monitor system resources
   - Review application logs

3. **Memory Leaks**
   - Monitor heap usage during tests
   - Check for unclosed connections
   - Review event listener cleanup
   - Use garbage collection profiling

4. **Inconsistent Results**
   - Ensure test environment isolation
   - Check for background processes
   - Verify data consistency
   - Review test timing and warmup

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
DEBUG=performance:* npm run test:performance
```

## Advanced Usage

### Custom Test Scenarios

Create custom performance test scenarios:

```javascript
// Custom load test scenario
const customScenario = {
  name: 'heavy-search-user',
  actions: [
    {
      endpoint: '/api/search',
      params: { q: 'complex query', filters: 'multiple' },
      weight: 5,
      thinkTime: 1000,
      validateResponse: (response) => response.data.results.length > 0
    }
  ]
};
```

### Performance Hooks

Use performance hooks for custom measurements:

```javascript
// Before test execution
beforeEach(async () => {
  await performanceUtils.waitForApp();
  performance.mark('test-start');
});

// After test execution
afterEach(() => {
  performance.mark('test-end');
  performance.measure('test-duration', 'test-start', 'test-end');
});
```

### Custom Metrics

Implement custom performance metrics:

```javascript
class CustomMetrics {
  static async measureDatabaseQueryTime(query) {
    const startTime = performance.now();
    const result = await database.query(query);
    const endTime = performance.now();

    return {
      result,
      queryTime: endTime - startTime
    };
  }
}
```

## Resources

- [Jest Performance Testing](https://jestjs.io/docs/configuration#performance)
- [Node.js Performance Hooks](https://nodejs.org/api/perf_hooks.html)
- [Web Performance Best Practices](https://web.dev/performance/)
- [Load Testing Guidelines](https://docs.microsoft.com/en-us/azure/architecture/framework/scalability/load-testing)

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review test logs and error messages
3. Verify test environment configuration
4. Create an issue with detailed reproduction steps