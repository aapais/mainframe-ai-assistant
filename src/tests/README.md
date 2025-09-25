# SSO Authentication Test Suite

Comprehensive test suite for the SSO (Single Sign-On) authentication system
with >90% code coverage.

## 📁 Test Structure

```
src/tests/auth/
├── unit/                    # Unit tests for individual components
├── integration/             # Integration tests for complete flows
├── security/               # Security vulnerability tests
├── performance/            # Performance and load testing
├── e2e/                   # End-to-end UI component tests
├── snapshots/             # UI component snapshot tests
├── load/                  # Load testing scenarios
├── penetration/           # Penetration testing scenarios
├── mocks/                 # Mock implementations for testing
├── factories/             # Test data factories
└── config/                # Test configuration and setup
```

## 🚀 Quick Start

### Install Dependencies

```bash
cd src/tests/auth
npm install
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Security tests
npm run test:security

# Performance tests
npm run test:performance

# E2E tests
npm run test:e2e

# Load tests
npm run test:load

# Penetration tests
npm run test:penetration

# Snapshot tests
npm run test:snapshots
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Validate coverage thresholds (>90%)
npm run validate-coverage
```

### Continuous Integration

```bash
# CI-optimized test run
npm run test:ci

# Security audit (security + penetration tests)
npm run test:security-audit

# Performance suite (performance + load tests)
npm run test:performance-suite
```

## 🧪 Test Categories

### Unit Tests (`/unit`)

- **SSOService**: OAuth provider registration, token exchange, user management
- **JWTProvider**: Token generation, validation, refresh
- **AuthMiddleware**: Request authentication, authorization
- **UserRepository**: User CRUD operations, queries
- **SessionManager**: Session creation, validation, cleanup

### Integration Tests (`/integration`)

- **OAuth Flow**: Complete OAuth authentication flow
- **Session Management**: Session lifecycle management
- **Account Linking**: Multi-provider account linking
- **Error Handling**: Error scenarios and recovery
- **Database Integration**: Database operations and transactions

### Security Tests (`/security`)

- **Injection Attacks**: SQL injection, XSS, command injection
- **Authentication Bypass**: State manipulation, token tampering
- **Session Security**: Session fixation, hijacking prevention
- **Rate Limiting**: Brute force protection
- **Input Validation**: Malicious input handling

### Performance Tests (`/performance`)

- **OAuth Endpoints**: Response time benchmarks
- **Token Validation**: High-frequency validation performance
- **Database Queries**: Query optimization validation
- **Memory Usage**: Memory leak detection
- **Concurrent Load**: Multi-user scenario testing

### E2E Tests (`/e2e`)

- **Login Components**: OAuth provider selection, authentication flow
- **Dashboard**: User profile display, navigation
- **Profile Management**: User information updates
- **Account Linking**: Provider linking/unlinking UI
- **Accessibility**: Screen reader support, keyboard navigation

### Load Tests (`/load`)

- **Concurrent Authentication**: 1000+ concurrent OAuth flows
- **Sustained Load**: Long-duration load testing
- **Resource Exhaustion**: Connection pool and memory limits
- **Failure Recovery**: Error rate handling and recovery

### Penetration Tests (`/penetration`)

- **Authentication Bypass**: State parameter attacks, JWT manipulation
- **Privilege Escalation**: Parameter pollution, method override
- **Data Exfiltration**: Information disclosure, directory traversal
- **DoS Attacks**: Resource exhaustion, rate limit bypass
- **Advanced Attacks**: Race conditions, cache poisoning

## 🎭 Mock System

### Mock Providers (`/mocks`)

- **MockGoogleProvider**: Google OAuth simulation
- **MockMicrosoftProvider**: Microsoft OAuth simulation
- **MockOktaProvider**: Okta SAML simulation
- **MockJWTProvider**: JWT token operations
- **MockSAMLProvider**: SAML authentication simulation

### Test Data Factories (`/factories`)

- **UserFactory**: User object generation with various roles and providers
- **SessionFactory**: Session data with different states
- **AuthEventFactory**: Authentication event logs including failures

## ⚙️ Configuration

### Test Environment Variables

```bash
NODE_ENV=test
JWT_SECRET=test-secret-key
OAUTH_CLIENT_ID=test-client-id
OAUTH_CLIENT_SECRET=test-client-secret
TEST_DATABASE_URL=sqlite::memory:
```

### Coverage Thresholds

- **Global**: 90% for branches, functions, lines, statements
- **Services**: 95% for core authentication services
- **Critical Components**: 100% for security-critical functions

### Timeout Configuration

- **Unit Tests**: 5 seconds
- **Integration Tests**: 30 seconds
- **Security Tests**: 30 seconds
- **Performance Tests**: 60 seconds
- **Load Tests**: 120 seconds
- **Penetration Tests**: 45 seconds

## 📊 Test Reporting

### Coverage Reports

- **Text**: Console output with coverage summary
- **HTML**: Detailed browser-viewable report
- **LCOV**: CI/CD integration format
- **JSON**: Machine-readable coverage data

### Performance Reports

- **Response Times**: P50, P75, P90, P95, P99 percentiles
- **Throughput**: Requests per second
- **Resource Usage**: Memory, CPU, handles
- **Error Rates**: Success/failure ratios

### Security Reports

- **Vulnerability Scan**: Known attack pattern results
- **Penetration Test**: Advanced attack scenario outcomes
- **Compliance**: Security best practice adherence

## 🔧 Development

### Adding New Tests

1. **Choose the appropriate test category** based on what you're testing
2. **Use existing factories** for test data generation
3. **Follow naming conventions**: `*.test.js` for test files
4. **Include setup/teardown** for proper test isolation
5. **Add descriptive test names** that explain the scenario

### Test File Template

```javascript
/**
 * Test Description
 */

const { TestClass } = require('../../../src/path/to/class');
const { UserFactory } = require('../factories/userFactory');
const { MockProvider } = require('../mocks/mockProvider');

describe('Test Suite Name', () => {
  let testInstance;
  let mockDependency;

  beforeEach(() => {
    mockDependency = new MockProvider();
    testInstance = new TestClass(mockDependency);
  });

  describe('Feature Group', () => {
    it('should handle normal case', async () => {
      const testData = UserFactory.create();

      const result = await testInstance.method(testData);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle error case', async () => {
      const invalidData = UserFactory.create({ invalid: true });

      await expect(testInstance.method(invalidData)).rejects.toThrow(
        'Expected error message'
      );
    });
  });
});
```

### Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Assertions**: Use specific, descriptive expectations
3. **Mock External Dependencies**: Don't rely on external services
4. **Performance Awareness**: Monitor test execution time
5. **Security Focus**: Include security scenarios in all test types

## 🚨 Security Testing

### Vulnerability Categories Tested

- **OWASP Top 10**: Complete coverage of common web vulnerabilities
- **OAuth Security**: State attacks, token manipulation, flow bypasses
- **JWT Security**: Algorithm confusion, signature bypass, payload tampering
- **Session Security**: Fixation, hijacking, prediction attacks
- **Input Validation**: Injection attacks, XSS, directory traversal

### Compliance Testing

- **NIST Guidelines**: Authentication best practices
- **OAuth 2.0 Security**: RFC 6819 security considerations
- **SAML Security**: SAML-specific attack prevention
- **GDPR Compliance**: Data protection and privacy

## 📈 Performance Benchmarks

### Target Performance Metrics

| Operation                      | Target Time | Acceptable Time |
| ------------------------------ | ----------- | --------------- |
| OAuth Authorization            | <50ms       | <100ms          |
| OAuth Callback (New User)      | <200ms      | <500ms          |
| OAuth Callback (Existing User) | <100ms      | <200ms          |
| JWT Validation                 | <5ms        | <20ms           |
| Profile Update                 | <100ms      | <300ms          |

### Load Testing Scenarios

- **Burst Load**: 1000 concurrent requests in 10 seconds
- **Sustained Load**: 100 RPS for 60 seconds
- **Gradual Ramp**: 10 to 500 RPS over 30 seconds
- **Stress Test**: Increase load until failure point

## 🎯 Coverage Goals

### Current Coverage Status

- **Unit Tests**: 95%+ for core services
- **Integration Tests**: 90%+ for complete flows
- **Security Tests**: 100% for critical vulnerabilities
- **E2E Tests**: 85%+ for user journeys

### Coverage Monitoring

- **Branch Coverage**: Ensure all code paths are tested
- **Function Coverage**: All functions have at least one test
- **Line Coverage**: All executable lines are covered
- **Statement Coverage**: All statements are executed

## 🤝 Contributing

1. **Follow existing patterns** in test structure and naming
2. **Update coverage thresholds** if adding new critical components
3. **Add security tests** for any new authentication features
4. **Include performance tests** for new endpoints
5. **Update documentation** for significant changes

## 🐛 Debugging Tests

### Common Issues

- **Timeout Errors**: Increase timeout for slow operations
- **Memory Leaks**: Check for proper cleanup in afterEach
- **Flaky Tests**: Ensure proper async/await usage
- **Mock Issues**: Verify mock implementations match real services

### Debug Commands

```bash
# Run tests in debug mode
npm run test:debug

# Run specific test file
jest path/to/test.js --runInBand

# Watch mode for development
npm run test:watch

# Detect open handles
jest --detectOpenHandles
```

---

**Test Coverage Goal**: >90% across all categories **Security Focus**: Zero
tolerance for authentication vulnerabilities **Performance Standard**:
Sub-second response times for all operations
