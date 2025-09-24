/**
 * Global Jest Setup Configuration
 * Common setup for all test suites
 */

const { jest } = require('@jest/globals');

// Extend Jest timeout for complex tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Database utilities
  createTestDatabase: async () => {
    // Implementation for test database creation
    return 'test_db_connection';
  },

  cleanupTestData: async () => {
    // Implementation for test data cleanup
    console.log('Cleaning up test data...');
  },

  // Mock data generators
  generateMockIncident: (overrides = {}) => ({
    id: 'INC-TEST-001',
    title: 'Test Incident',
    description: 'Test incident description',
    category: 'SYSTEM',
    severity: 'MEDIUM',
    status: 'OPEN',
    reportedBy: 'test_user',
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  generateMockUser: (overrides = {}) => ({
    id: 'user_test_001',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['INCIDENT_VIEWER'],
    permissions: ['READ_INCIDENTS'],
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  // AI/ML test utilities
  generateTestPredictions: (count = 100) => {
    const categories = ['DATABASE', 'NETWORK', 'APPLICATION', 'SECURITY', 'HARDWARE'];
    const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    return Array.from({ length: count }, (_, i) => ({
      id: `pred_${i}`,
      predicted: categories[Math.floor(Math.random() * categories.length)],
      actual: categories[Math.floor(Math.random() * categories.length)],
      confidence: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
      severity: severities[Math.floor(Math.random() * severities.length)]
    }));
  },

  // Performance test utilities
  measureExecutionTime: async (fn) => {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },

  // Security test utilities
  generateMaliciousInputs: () => [
    '<script>alert("XSS")</script>',
    '"; DROP TABLE incidents; --',
    '{{7*7}}',
    '../../../etc/passwd',
    'javascript:void(0)',
    '${7*7}',
    '<img src=x onerror=alert(1)>'
  ],

  // Compliance test utilities
  generateLGPDTestData: () => ({
    personalData: {
      name: 'João Silva',
      cpf: '123.456.789-00',
      email: 'joao@email.com',
      phone: '+55 11 99999-9999'
    },
    sensitiveData: {
      medicalInfo: 'Diabetic',
      biometricData: '[FINGERPRINT_HASH]'
    },
    consentStatus: 'GIVEN',
    processingBasis: 'LEGITIMATE_INTEREST'
  }),

  generateSOXTestData: () => ({
    financialSystem: 'GENERAL_LEDGER',
    userRole: 'FINANCIAL_ANALYST',
    transaction: {
      amount: 10000.00,
      account: '1001-REVENUE',
      approver: 'finance_manager'
    },
    controlType: 'ITGC',
    complianceRequired: true
  })
};

// Global mocks
global.mockDatabase = {
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  close: jest.fn()
};

global.mockAIService = {
  predict: jest.fn(),
  train: jest.fn(),
  evaluate: jest.fn()
};

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Fail the test if running in test environment
  if (process.env.NODE_ENV === 'test') {
    throw reason;
  }
});

// Console suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Only show errors that are not expected test errors
  if (!args[0]?.toString().includes('Expected test error')) {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  // Suppress specific warnings during tests
  const suppressedWarnings = [
    'Warning: ReactDOM.render is deprecated',
    'Warning: componentWillMount has been renamed'
  ];

  if (!suppressedWarnings.some(warning => args[0]?.toString().includes(warning))) {
    originalConsoleWarn(...args);
  }
};

// Environment variable setup for tests
process.env.NODE_ENV = 'test';
process.env.DB_CONNECTION_STRING = 'sqlite::memory:';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_characters';

// Performance benchmarks for tests
global.performanceBenchmarks = {
  apiResponse: 1000, // 1 second
  databaseQuery: 500, // 500ms
  aiPrediction: 100, // 100ms
  authenticationCheck: 50 // 50ms
};

// Compliance thresholds
global.complianceThresholds = {
  lgpd: {
    dataSubjectResponseTime: 15, // days
    breachNotificationTime: 72, // hours
    dataMinimizationScore: 0.9
  },
  sox: {
    auditTrailCompleteness: 1.0,
    controlEffectiveness: 0.95,
    accessReviewFrequency: 90 // days
  }
};

// AI/ML testing thresholds
global.aiTestingThresholds = {
  minimumAccuracy: 0.85,
  minimumF1Score: 0.80,
  maximumBias: 0.1,
  maximumInferenceTime: 100, // milliseconds
  minimumExplainability: 0.7
};

// Security testing configurations
global.securityTestConfig = {
  bruteForceThreshold: 5, // attempts
  sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
  passwordMinLength: 12,
  mfaRequired: true,
  auditLogRetention: 7 * 365 * 24 * 60 * 60 * 1000 // 7 years
};

// Custom Jest matchers
expect.extend({
  toBeWithinPerformanceThreshold(received, threshold) {
    const pass = received <= threshold;
    if (pass) {
      return {
        message: () => `Expected ${received} to be greater than ${threshold}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to be within performance threshold of ${threshold}ms`,
        pass: false
      };
    }
  },

  toMeetComplianceStandard(received, standard, threshold) {
    const pass = received >= threshold;
    if (pass) {
      return {
        message: () => `Expected ${received} to not meet ${standard} compliance standard of ${threshold}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to meet ${standard} compliance standard of ${threshold}`,
        pass: false
      };
    }
  },

  toHaveAcceptableAIAccuracy(received, minimumAccuracy = 0.85) {
    const pass = received >= minimumAccuracy;
    if (pass) {
      return {
        message: () => `Expected AI accuracy ${received} to be below ${minimumAccuracy}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected AI accuracy ${received} to be at least ${minimumAccuracy}`,
        pass: false
      };
    }
  },

  toBeSecurelyEncrypted(received) {
    const encryptionPattern = /^[A-Za-z0-9+/]+=*$/; // Base64 pattern
    const pass = typeof received === 'string' && encryptionPattern.test(received) && received.length > 20;

    if (pass) {
      return {
        message: () => `Expected "${received}" to not be securely encrypted`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected "${received}" to be securely encrypted (Base64, length > 20)`,
        pass: false
      };
    }
  }
});

console.log('🧪 Jest global setup completed successfully');
console.log('📊 Performance benchmarks loaded');
console.log('🔒 Security test configurations loaded');
console.log('📋 Compliance thresholds set');
console.log('🤖 AI testing thresholds configured');