# Deployment Package Integrity Testing Suite

This comprehensive testing suite validates deployment packages for integrity, security, and reliability. It ensures that all deployment artifacts are correct, complete, and secure before being deployed to production environments.

## Overview

The testing suite includes multiple components that work together to provide complete validation:

### 🔍 **Package Integrity Tests** (`package-integrity.test.ts`)
- File integrity verification using SHA256 checksums
- Digital signature validation
- Manifest file structure verification
- Dependency inclusion checks
- License file presence and validation
- Asset validation (images, fonts, etc.)
- Performance validation for package size constraints

### 🛠️ **Installer Validation Tests** (`installer-validation.test.ts`)
- Fresh installation testing
- Update and downgrade scenario testing
- Uninstallation completeness verification
- System registration and shortcut creation
- Error handling and recovery testing
- Installation validation and startup testing

### 🔄 **Update Mechanism Tests** (`update-mechanism.test.ts`)
- Update detection and channel management
- Download progress tracking and resumption
- Delta update application and fallback
- Installation process validation
- Rollback mechanism testing
- Staged rollout and canary releases
- Network failure handling

### 🤖 **Auto-Updater Tests** (`auto-updater.test.ts`)
- Update scheduling and detection
- Download management and limiting
- Installation and rollback management
- User experience and notifications
- Security and integrity verification
- Performance monitoring and optimization

### 🔒 **Security Verification** (`../scripts/security-verification.js`)
- Digital signature verification
- Malware detection and quarantine
- Vulnerability assessment
- Static code analysis
- Dependency security auditing
- Configuration security review
- Network security validation

### 📊 **Deployment Monitoring** (`../scripts/deployment-monitoring.js`)
- Real-time deployment tracking
- Performance metrics collection
- Error detection and alerting
- Health status monitoring
- Comprehensive reporting

### ✅ **Checksum Generation** (`../scripts/checksum-generator.js`)
- Directory-wide checksum generation
- Verification against existing checksums
- Manifest file creation
- Batch processing capabilities
- Watch mode for continuous monitoring

## Quick Start

### Running All Tests
```bash
# Run complete deployment test suite
npm run test:deployment

# Run with coverage
npm run test:deployment -- --coverage

# Run specific test category
npm run test:deployment -- --testNamePattern="Package Integrity"
```

### Running Individual Test Suites
```bash
# Package integrity tests
jest tests/deployment/package-integrity.test.ts

# Installer validation tests
jest tests/deployment/installer-validation.test.ts

# Update mechanism tests
jest tests/deployment/update-mechanism.test.ts

# Auto-updater tests
jest tests/deployment/auto-updater.test.ts

# Integration tests
jest tests/deployment/integration.test.ts
```

### Command Line Tools

#### Package Validation
```bash
# Validate a deployment package
node scripts/validate-deployment.js validate ./dist/app-1.0.0.zip

# Test installation process
node scripts/validate-deployment.js install ./dist/app-1.0.0.zip

# Test update mechanism
node scripts/validate-deployment.js update stable
```

#### Checksum Generation
```bash
# Generate checksums for directory
node scripts/checksum-generator.js generate ./dist ./checksums.json

# Verify checksums
node scripts/checksum-generator.js verify ./checksums.json ./dist

# Compare checksum files
node scripts/checksum-generator.js compare ./old-checksums.json ./new-checksums.json

# Generate deployment manifest
node scripts/checksum-generator.js manifest ./dist ./manifest.json

# Watch directory for changes
node scripts/checksum-generator.js watch ./src ./src-checksums.json
```

#### Security Verification
```bash
# Comprehensive security scan
node scripts/security-verification.js scan ./app-1.0.0.zip

# Verify digital signatures only
node scripts/security-verification.js verify ./signed-package.zip

# Security audit and assessment
node scripts/security-verification.js audit ./deployment-package.tar.gz
```

#### Deployment Monitoring
```bash
# Start monitoring system
node scripts/deployment-monitoring.js start

# Get current system status
node scripts/deployment-monitoring.js status

# Generate monitoring report
node scripts/deployment-monitoring.js report --format json
```

## Test Scenarios

### 1. **Fresh Installation Testing**
- Clean environment installation
- Required directory creation
- File permission setting
- System registration
- Desktop shortcut creation
- Error handling for invalid paths

### 2. **Update Testing**
- Version upgrade validation
- User data preservation
- Configuration migration
- Backup creation
- Rollback capability

### 3. **Security Testing**
- Package signature verification
- Malware scanning
- Vulnerability assessment
- Dependency security audit
- Configuration security review

### 4. **Performance Testing**
- Package size validation
- Installation speed measurement
- Resource usage monitoring
- Concurrent deployment handling
- Large package efficiency

### 5. **Error Handling**
- Corrupted package detection
- Network failure recovery
- Insufficient disk space
- Permission errors
- Installation interruption recovery

## Configuration

### Test Configuration (`jest.config.js`)
```javascript
module.exports = {
  displayName: 'Deployment Tests',
  testEnvironment: 'node',
  testTimeout: 30000,
  maxWorkers: 1, // Sequential execution
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Environment Variables
```bash
NODE_ENV=test
TEST_MODE=deployment
LOG_LEVEL=error
TEST_TIMEOUT=30000
```

## Custom Matchers

The test suite includes custom Jest matchers for deployment-specific assertions:

```typescript
// Package validation
expect(package).toBeValidPackage();

// Checksum verification
expect(actualChecksum).toHaveValidChecksum(expectedChecksum);

// Performance validation
expect(duration).toBeWithinDuration(expectedDuration, tolerance);

// Deployment success
expect(result).toHaveSuccessfulDeployment();
```

## Test Data and Fixtures

### Mock Package Creation
```typescript
// Create mock deployment package
const testPackage = global.createMockDeploymentPackage();

// Create custom mock package
const customPackage = global.createMockPackage({
  name: 'custom-app',
  version: '2.0.0',
  files: {
    'app.js': 'console.log("Custom app");',
    'config.json': '{"env": "production"}'
  }
});
```

### Test Utilities
```typescript
// Wait for asynchronous conditions
await global.waitForCondition(
  () => fs.existsSync(installPath),
  5000 // timeout in ms
);

// Simulate network delays
await global.mockNetworkDelay(100, 500);

// Cleanup test environment
global.cleanupTestEnvironment();
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Deployment Tests

on: [push, pull_request]

jobs:
  deployment-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run deployment tests
        run: npm run test:deployment

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: coverage/lcov.info
```

## Performance Benchmarks

### Expected Performance Metrics
- **Package Validation**: < 5 seconds for typical packages
- **Security Scanning**: < 30 seconds comprehensive scan
- **Installation Testing**: < 2 minutes full workflow
- **Memory Usage**: < 500MB peak during testing
- **Concurrent Deployments**: Support 5+ simultaneous validations

### Performance Monitoring
```typescript
// Performance test example
const startTime = Date.now();
const result = await packageValidator.validateComplete(package);
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(5000); // 5 second limit
```

## Troubleshooting

### Common Issues

1. **Test Timeout Errors**
   ```bash
   # Increase timeout in jest.config.js
   testTimeout: 60000 // 60 seconds
   ```

2. **Permission Errors on Linux/Mac**
   ```bash
   # Ensure test directories are writable
   chmod -R 755 tests/deployment/temp
   ```

3. **Mock Package Creation Failures**
   ```bash
   # Check available disk space
   df -h /tmp

   # Clean old test files
   rm -rf /tmp/deployment-tests-*
   ```

4. **Security Scan False Positives**
   ```bash
   # Run with less strict mode
   node scripts/security-verification.js scan --no-strict ./package.zip
   ```

### Debug Mode
```bash
# Enable verbose logging
DEBUG=deployment-tests npm run test:deployment

# Run single test with full output
jest tests/deployment/package-integrity.test.ts --verbose --no-cache
```

## Contributing

### Adding New Tests
1. Create test file in appropriate category
2. Follow naming convention: `feature-name.test.ts`
3. Include both positive and negative test cases
4. Add performance benchmarks where applicable
5. Update this README with new test descriptions

### Test Guidelines
- **Isolation**: Each test should be independent
- **Cleanup**: Always clean up test artifacts
- **Performance**: Include timing assertions
- **Documentation**: Comment complex test logic
- **Mocking**: Use mocks for external dependencies

## Security Considerations

### Test Environment Security
- Tests run in isolated environments
- No real credentials or sensitive data
- Simulated external services
- Quarantine for detected threats

### Production Validation
- All tests must pass before deployment
- Security scans are mandatory
- Performance thresholds enforced
- Rollback procedures tested

## License

This deployment testing suite is part of the mainframe-ai-assistant project and follows the same MIT license terms.