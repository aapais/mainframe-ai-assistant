# Reliability Testing Suite

Comprehensive reliability testing framework for the Mainframe KB Assistant MVP1, designed to ensure system resilience, data integrity, and high availability under all conditions.

## Overview

This reliability testing suite provides comprehensive validation of:
- **Data Persistence**: Data integrity during shutdowns, crashes, and recovery
- **High Availability**: 99.9% uptime validation and service continuity
- **Long-Running Stability**: Memory leak detection and 24+ hour operation testing
- **Disaster Recovery**: Backup, restore, and failover mechanisms
- **System Monitoring**: Real-time health checks and automated recovery

## Test Structure

```
tests/reliability/
├── data-persistence.test.ts          # Data integrity and transaction tests
├── high-availability.test.ts         # Uptime and availability validation  
├── stability.test.ts                 # Memory leaks and long-running tests
├── disaster-recovery.test.ts         # Backup/restore and disaster scenarios
├── monitoring.ts                     # Monitoring and alerting utilities
├── reliability-test-runner.test.ts   # Comprehensive test suite runner
├── jest.reliability.config.js        # Specialized Jest configuration
├── jest.reliability.setup.js         # Global test setup and utilities
└── README.md                         # This documentation
```

## Quick Start

### Prerequisites

```bash
# Enable garbage collection for memory leak detection
node --expose-gc

# For comprehensive testing, increase memory limits
node --max-old-space-size=2048
```

### Running Tests

```bash
# Run all reliability tests
npm run test:reliability

# Run specific test suites
npm run test:reliability:data          # Data persistence tests
npm run test:reliability:availability  # High availability tests  
npm run test:reliability:stability     # Long-running stability tests
npm run test:reliability:recovery      # Disaster recovery tests

# Run comprehensive test suite with reporting
npm run test:reliability:comprehensive

# Generate detailed HTML reports
npm run test:reliability:report

# CI/CD pipeline testing
npm run test:reliability:ci
```

### Monitoring and Stress Testing

```bash
# Start reliability monitoring (5 minute session)
npm run reliability:monitor

# Run stress testing with memory optimization
npm run reliability:stress
```

## Test Categories

### 1. Data Persistence Tests (`data-persistence.test.ts`)

Validates data integrity under various failure scenarios:

- **Transaction Atomicity**: Ensures all-or-nothing transaction behavior
- **Graceful Shutdowns**: Data preservation during normal shutdowns
- **Crash Recovery**: Data integrity after unexpected termination
- **Backup & Restore**: Point-in-time backup consistency
- **Session Persistence**: User state preservation across restarts
- **Referential Integrity**: Database constraint enforcement

**Key Metrics:**
- Zero data loss during normal operations
- < 1 second recovery time from crashes  
- 100% backup integrity validation
- Complete transaction rollback on failures

### 2. High Availability Tests (`high-availability.test.ts`)

Ensures 99.9% availability target and service continuity:

- **Uptime Validation**: Extended availability monitoring
- **Service Continuity**: Operations during partial failures
- **Graceful Degradation**: Reduced functionality over complete failure
- **Connection Pooling**: Resource management under load
- **Failover Mechanisms**: Automatic switching to backup systems
- **Load Balancing**: Request distribution and health checks

**Key Metrics:**
- 99.9% uptime target (< 8.77 hours downtime/year)
- < 30 seconds failover time
- 95% success rate during degraded conditions
- < 10 seconds recovery from transient failures

### 3. Long-Running Stability Tests (`stability.test.ts`)

Validates system stability over extended operations:

- **Memory Leak Detection**: Automated memory growth monitoring
- **Resource Exhaustion**: Prevention and graceful handling
- **Performance Degradation**: Response time stability over time
- **Concurrent Operations**: Thread safety and race condition prevention
- **State Consistency**: Data integrity during high concurrency
- **Extended Operations**: 24+ hour continuous operation validation

**Key Metrics:**
- < 50 MB memory growth per hour
- < 1% error rate over extended periods
- < 2x response time degradation over 24 hours
- Zero memory leaks in continuous operation

### 4. Disaster Recovery Tests (`disaster-recovery.test.ts`)

Comprehensive disaster recovery and business continuity:

- **Data Corruption Recovery**: Detection and automatic restoration
- **Hardware Failure Simulation**: Primary storage failure scenarios
- **Network Partitions**: Split-brain and consistency handling
- **Multi-Site Replication**: Geographic disaster recovery
- **Recovery Time/Point Objectives**: RTO < 30s, RPO < 15min
- **Cascading Failures**: Multiple simultaneous failure handling

**Key Metrics:**
- < 30 seconds Recovery Time Objective (RTO)
- < 15 minutes Recovery Point Objective (RPO)
- 100% data restoration accuracy
- < 5 minutes backup creation time

### 5. System Monitoring (`monitoring.ts`)

Real-time system health monitoring and automated recovery:

- **Health Check Framework**: Configurable system health validation
- **Performance Monitoring**: Response time and throughput tracking
- **Resource Monitoring**: Memory, CPU, and disk space monitoring
- **Uptime Tracking**: Availability statistics and downtime analysis
- **Automated Recovery**: Self-healing mechanisms and auto-recovery
- **Alert Management**: Threshold-based alerting system

**Components:**
- `SystemHealthMonitor`: Orchestrates health checks and alerting
- `UptimeMonitor`: Tracks availability and downtime events
- `PerformanceMonitor`: Response time and throughput analysis
- `ResourceMonitor`: System resource utilization tracking
- `RecoveryAutomation`: Automated recovery action framework

## Reliability Thresholds

The system is designed to meet strict reliability targets:

```typescript
const RELIABILITY_TARGETS = {
  availability: 99.9,           // 99.9% uptime
  responseTime: 1000,           // < 1 second average response
  recoveryTime: 30000,          // < 30 seconds recovery time
  memoryGrowth: 50,            // < 50 MB/hour growth
  errorRate: 1,                // < 1% error rate
  backupTime: 30,              // < 30 seconds backup time
  dataIntegrity: 100           // 100% data consistency
};
```

## Configuration

### Test Configuration

Customize test behavior via `reliability-test-runner.test.ts`:

```typescript
const TEST_CONFIG = {
  testDuration: {
    short: 5000,      // 5 seconds for quick tests
    medium: 15000,    // 15 seconds for standard tests  
    long: 30000       // 30 seconds for thorough tests
  },
  thresholds: {
    uptimeTarget: 99.9,
    maxResponseTime: 1000,
    maxRecoveryTime: 30000,
    maxMemoryGrowth: 50,
    maxErrorRate: 1
  },
  loadTest: {
    concurrency: 10,
    operationsPerSecond: 50,
    duration: 10000
  }
};
```

### Monitoring Configuration

Configure health monitoring via `monitoring.ts`:

```typescript
const MONITORING_CONFIG = {
  healthCheckInterval: 30000,    // 30 seconds
  alertThresholds: {
    responseTime: { warning: 1000, critical: 5000 },
    memoryUsage: { warning: 80, critical: 95 },
    errorRate: { warning: 1, critical: 5 },
    diskSpace: { warning: 20, critical: 10 }
  }
};
```

## Running in Different Environments

### Development Environment

```bash
# Quick reliability validation
npm run test:reliability

# With verbose output and coverage
npm run test:reliability -- --verbose --coverage
```

### CI/CD Pipeline

```bash
# Optimized for CI environment
npm run test:reliability:ci

# With strict exit codes and reporting
npm run test:reliability:ci -- --bail --verbose
```

### Production Monitoring

```bash
# Long-running production monitoring
node --expose-gc tests/reliability/monitoring.js --duration=24h

# Stress testing production system
npm run reliability:stress -- --duration=1h --concurrency=20
```

## Reporting

Test results are automatically generated in multiple formats:

### HTML Reports
- **Location**: `tests/reliability/reports/reliability-test-report.html`
- **Content**: Interactive test results with metrics and charts
- **Features**: Expandable test details, failure analysis, trends

### JUnit XML
- **Location**: `tests/reliability/reports/reliability-junit.xml`
- **Usage**: CI/CD integration, test result parsing
- **Format**: Standard JUnit XML for toolchain compatibility

### JSON Reports
- **Location**: `tests/reliability/reports/reliability-summary.json`
- **Content**: Machine-readable test metrics and status
- **Usage**: Automated analysis, trend tracking, alerting

### Example Report Structure

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "testSuite": "System Reliability Validation",
  "results": { "passed": 24, "failed": 0, "total": 24 },
  "metrics": {
    "uptime": 99.95,
    "averageResponseTime": 145.2,
    "maxResponseTime": 892.1,
    "errorRate": 0.02,
    "memoryUsage": 23.4
  },
  "alerts": [],
  "recommendations": [
    "System is performing well within all reliability thresholds"
  ]
}
```

## Best Practices

### Test Development

1. **Isolation**: Each test should be independent and create its own test data
2. **Cleanup**: Always clean up resources in `afterEach`/`afterAll` hooks
3. **Timeouts**: Set appropriate timeouts for long-running operations
4. **Error Handling**: Test both success and failure scenarios
5. **Monitoring**: Use built-in monitoring tools for test validation

### Test Execution

1. **Sequential Execution**: Run reliability tests sequentially to avoid resource conflicts
2. **Memory Limits**: Use `--expose-gc` and `--max-old-space-size` for memory testing
3. **Clean Environment**: Start with fresh database and clean temp directories
4. **Resource Monitoring**: Monitor system resources during test execution
5. **Report Generation**: Always generate reports for analysis

### Production Integration

1. **Scheduled Testing**: Run reliability tests on regular schedule
2. **Threshold Monitoring**: Set up alerts for threshold violations
3. **Trend Analysis**: Track reliability metrics over time
4. **Automated Recovery**: Implement self-healing mechanisms
5. **Documentation**: Keep reliability procedures updated

## Troubleshooting

### Common Issues

#### Memory Leak Detection

**Issue**: False positive memory leak detection
**Solution**: 
```bash
# Run with proper garbage collection
node --expose-gc --max-old-space-size=2048 npm run test:reliability:stability
```

#### Test Timeouts

**Issue**: Tests timing out in CI environment
**Solution**:
```bash
# Increase timeout for specific tests
npm run test:reliability -- --testTimeout=300000
```

#### Database Locks

**Issue**: Tests failing due to database locks
**Solution**:
- Ensure proper cleanup in `afterEach` hooks
- Use unique database files for each test
- Implement retry logic for transient failures

#### Resource Exhaustion

**Issue**: System running out of file descriptors
**Solution**:
```bash
# Increase system limits
ulimit -n 4096

# Use connection pooling in tests
# Implement proper resource cleanup
```

### Debug Mode

Enable detailed debugging:

```bash
# Enable debug logging
DEBUG=reliability:* npm run test:reliability

# Verbose Jest output
npm run test:reliability -- --verbose --no-cache

# Memory debugging
node --inspect --expose-gc npm run test:reliability:stability
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Reliability Tests
  run: |
    npm ci
    npm run test:reliability:ci
  env:
    NODE_OPTIONS: "--expose-gc --max-old-space-size=2048"
    
- name: Upload Reliability Reports
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: reliability-reports
    path: tests/reliability/reports/
```

### Jenkins Pipeline Example

```groovy
stage('Reliability Tests') {
  steps {
    sh '''
      export NODE_OPTIONS="--expose-gc --max-old-space-size=2048"
      npm run test:reliability:ci
    '''
  }
  post {
    always {
      publishHTML([
        allowMissing: false,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: 'tests/reliability/reports',
        reportFiles: 'reliability-test-report.html',
        reportName: 'Reliability Test Report'
      ])
    }
  }
}
```

## Contributing

When adding new reliability tests:

1. Follow the existing test structure and naming conventions
2. Include proper error handling and cleanup
3. Document test objectives and expected outcomes  
4. Add appropriate timeouts and resource limits
5. Update this README with new test descriptions

## Support

For questions or issues with reliability testing:

1. Check the troubleshooting section above
2. Review test logs in `tests/reliability/reports/`
3. Examine system monitoring data
4. Create issue with detailed error information and system configuration

---

**Note**: Reliability testing is crucial for production systems. These tests should be run regularly and their results should inform system architecture and deployment decisions.