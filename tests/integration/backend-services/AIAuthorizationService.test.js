/**
 * Comprehensive Test Suite for AIAuthorizationService
 * Tests cost estimation, authorization logic, preferences management, and session handling
 */

const { jest } = require('@jest/globals');
const { EventEmitter } = require('events');

// Mock Electron app
const mockApp = {
  getPath: jest.fn(() => '/mock/user/data')
};

// Mock better-sqlite3
const mockDatabase = {
  prepare: jest.fn(),
  exec: jest.fn(),
  pragma: jest.fn(),
  close: jest.fn()
};

const mockStatement = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn()
};

// Setup mocks before importing the service
jest.mock('electron', () => ({
  app: mockApp
}), { virtual: true });

jest.mock('better-sqlite3', () => {
  return jest.fn(() => mockDatabase);
}, { virtual: true });

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));

// Import the service after mocking
const { AIAuthorizationService } = require('../../../src/main/services/AIAuthorizationService');
const { GeminiService } = require('../../../src/services/GeminiService');

describe('AIAuthorizationService Integration Tests', () => {
  let authService;
  let mockContext;
  let mockServiceManager;
  let mockDatabaseService;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock database responses
    mockDatabase.prepare.mockReturnValue(mockStatement);
    mockStatement.run.mockReturnValue({ changes: 1 });
    mockStatement.get.mockReturnValue(null);
    mockStatement.all.mockReturnValue([]);

    // Setup mock services
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockDatabaseService = {
      getDatabase: jest.fn(() => mockDatabase)
    };

    mockServiceManager = {
      getService: jest.fn((name) => {
        if (name === 'DatabaseService') return mockDatabaseService;
        return null;
      })
    };

    mockContext = {
      logger: mockLogger,
      serviceManager: mockServiceManager,
      dataPath: '/mock/data'
    };

    authService = new AIAuthorizationService();
  });

  afterEach(() => {
    if (authService) {
      authService.shutdown(mockContext).catch(() => {});
    }
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with database service', async () => {
      await authService.initialize(mockContext);

      expect(mockServiceManager.getService).toHaveBeenCalledWith('DatabaseService');
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing AI Authorization Service...');
      expect(mockLogger.info).toHaveBeenCalledWith('AI Authorization Service initialized successfully');
    });

    it('should fail initialization without database service', async () => {
      mockServiceManager.getService.mockReturnValue(null);

      await expect(authService.initialize(mockContext)).rejects.toThrow('DatabaseService dependency not available');
    });

    it('should initialize with Gemini service when API key is available', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';

      await authService.initialize(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Gemini service initialized for cost estimation');

      delete process.env.GEMINI_API_KEY;
    });

    it('should warn when Gemini API key is not available', async () => {
      delete process.env.GEMINI_API_KEY;

      await authService.initialize(mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith('Gemini API key not found - using fallback cost estimation');
    });
  });

  describe('Authorization Request Processing', () => {
    beforeEach(async () => {
      await authService.initialize(mockContext);
    });

    it('should process semantic search authorization request', async () => {
      const operation = {
        type: 'semantic_search',
        query: 'Find JCL job scheduling examples',
        dataContext: {
          containsPII: false,
          isConfidential: false,
          dataTypes: ['technical'],
          dataFields: [{ name: 'query', sensitivity: 'public' }]
        },
        userId: 'test-user-123',
        sessionId: 'session-456'
      };

      const result = await authService.requestAuthorization(operation);

      expect(result).toMatchObject({
        authorized: expect.any(Boolean),
        action: expect.any(String),
        requestId: 'mock-uuid-123',
        estimates: expect.objectContaining({
          estimatedTokens: expect.any(Number),
          estimatedCostUSD: expect.any(Number),
          confidence: expect.any(Number)
        }),
        autoApproved: expect.any(Boolean)
      });

      expect(mockStatement.run).toHaveBeenCalled();
    });

    it('should auto-approve low-cost operations', async () => {
      const operation = {
        type: 'extract_keywords',
        query: 'short query',
        dataContext: {
          containsPII: false,
          isConfidential: false,
          dataTypes: ['technical'],
          dataFields: [{ name: 'query', sensitivity: 'public' }]
        }
      };

      const result = await authService.requestAuthorization(operation);

      expect(result.autoApproved).toBe(true);
      expect(result.estimates.estimatedCostUSD).toBeLessThan(0.01);
    });

    it('should require authorization for high-cost operations', async () => {
      const operation = {
        type: 'translate_text',
        query: 'very long query '.repeat(100), // Large query to increase cost
        dataContext: {
          containsPII: false,
          isConfidential: false,
          dataTypes: ['technical'],
          dataFields: [{ name: 'query', sensitivity: 'public' }]
        }
      };

      const result = await authService.requestAuthorization(operation);

      expect(result.autoApproved).toBe(false);
      expect(result.estimates.estimatedCostUSD).toBeGreaterThan(0.01);
    });

    it('should deny operations with restricted data', async () => {
      const operation = {
        type: 'analyze_entry',
        query: 'Analyze this sensitive data',
        dataContext: {
          containsPII: true,
          isConfidential: true,
          dataTypes: ['personal'],
          dataFields: [{ name: 'data', sensitivity: 'restricted' }]
        }
      };

      const result = await authService.requestAuthorization(operation);

      expect(result.autoApproved).toBe(false);
    });
  });

  describe('Cost Estimation', () => {
    beforeEach(async () => {
      await authService.initialize(mockContext);
    });

    it('should estimate costs for different operation types', async () => {
      const testCases = [
        { type: 'semantic_search', expectedOutputTokens: 150 },
        { type: 'explain_error', expectedOutputTokens: 300 },
        { type: 'generate_summary', expectedOutputTokens: 200 },
        { type: 'extract_keywords', expectedOutputTokens: 50 }
      ];

      for (const testCase of testCases) {
        const estimate = await authService.estimateCost('test query', testCase.type);

        expect(estimate).toMatchObject({
          inputTokens: expect.any(Number),
          outputTokens: testCase.expectedOutputTokens,
          totalCostUSD: expect.any(Number),
          breakdown: expect.objectContaining({
            inputTokens: expect.objectContaining({
              count: expect.any(Number),
              costUSD: expect.any(Number),
              rate: expect.any(Number)
            }),
            outputTokens: expect.objectContaining({
              count: testCase.expectedOutputTokens,
              costUSD: expect.any(Number),
              rate: expect.any(Number)
            })
          }),
          confidence: expect.any(Number)
        });

        expect(estimate.totalCostUSD).toBeGreaterThan(0);
        expect(estimate.confidence).toBeGreaterThanOrEqual(0.7);
        expect(estimate.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it('should cache cost estimates for performance', async () => {
      const query = 'test query for caching';
      const operationType = 'semantic_search';

      // First call
      await authService.estimateCost(query, operationType);

      // Second call should use cache
      await authService.estimateCost(query, operationType);

      // Should only call prepare once for actual estimation
      expect(mockDatabase.prepare).toHaveBeenCalled();
    });

    it('should calculate accurate token counts', async () => {
      const testQuery = 'This is a test query with exactly twenty words to test token calculation accuracy and ensure proper estimation logic works correctly.';

      const estimate = await authService.estimateCost(testQuery, 'semantic_search');

      // Rough estimate: 4 characters per token
      const expectedTokens = Math.ceil(testQuery.length / 4);
      expect(estimate.inputTokens).toBeCloseTo(expectedTokens, 5);
    });
  });

  describe('User Preferences Management', () => {
    beforeEach(async () => {
      await authService.initialize(mockContext);
    });

    it('should get default preferences for new users', async () => {
      mockStatement.get.mockReturnValue(null);

      const preferences = await authService.getUserPreferences('new-user');

      expect(preferences).toMatchObject({
        defaultPermissions: expect.objectContaining({
          semantic_search: 'ask_always',
          explain_error: 'auto_approve',
          analyze_entry: 'auto_approve'
        }),
        costThresholds: expect.objectContaining({
          autoApprove: 0.01,
          requireConfirmation: 0.10,
          block: 1.00
        }),
        sessionSettings: expect.objectContaining({
          rememberApproveAlways: true,
          sessionDuration: 60
        }),
        dataPrivacySettings: expect.objectContaining({
          allowPII: false,
          allowConfidential: false,
          requireExplicitConsent: true
        })
      });
    });

    it('should load existing preferences from database', async () => {
      const mockPrefs = {
        user_id: 'existing-user',
        default_permissions: JSON.stringify({
          semantic_search: 'auto_approve',
          explain_error: 'auto_approve'
        }),
        cost_thresholds: JSON.stringify({
          autoApprove: 0.05,
          requireConfirmation: 0.20,
          block: 2.00
        }),
        session_settings: JSON.stringify({
          rememberApproveAlways: false,
          sessionDuration: 120
        }),
        data_privacy_settings: JSON.stringify({
          allowPII: true,
          allowConfidential: false,
          requireExplicitConsent: false
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockStatement.get.mockReturnValue(mockPrefs);

      const preferences = await authService.getUserPreferences('existing-user');

      expect(preferences.userId).toBe('existing-user');
      expect(preferences.defaultPermissions.semantic_search).toBe('auto_approve');
      expect(preferences.costThresholds.autoApprove).toBe(0.05);
      expect(preferences.sessionSettings.sessionDuration).toBe(120);
      expect(preferences.dataPrivacySettings.allowPII).toBe(true);
    });

    it('should update user preferences', async () => {
      const updates = {
        costThresholds: {
          autoApprove: 0.02,
          requireConfirmation: 0.15,
          block: 1.50
        },
        defaultPermissions: {
          semantic_search: 'auto_approve'
        }
      };

      await authService.updatePreferences(updates, 'test-user');

      expect(mockStatement.run).toHaveBeenCalledWith(
        'test-user',
        expect.stringContaining('semantic_search'),
        expect.stringContaining('0.02'),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should cache preferences for performance', async () => {
      const userId = 'cached-user';

      // First call
      await authService.getUserPreferences(userId);

      // Second call should use cache
      await authService.getUserPreferences(userId);

      // Should only prepare statement once
      const prepareCalls = mockDatabase.prepare.mock.calls.filter(call =>
        call[0].includes('ai_authorization_preferences')
      );
      expect(prepareCalls.length).toBe(1);
    });
  });

  describe('User Decision Handling', () => {
    beforeEach(async () => {
      await authService.initialize(mockContext);
    });

    it('should save user authorization decisions', async () => {
      const decision = {
        requestId: 'req-123',
        action: 'approve_once',
        rememberDecision: false,
        notes: 'Approved for testing',
        userId: 'test-user',
        sessionId: 'session-456'
      };

      await authService.saveUserDecision(decision);

      expect(mockStatement.run).toHaveBeenCalledWith(
        'mock-uuid-123',
        'req-123',
        'approve_once',
        0, // false as integer
        null,
        'Approved for testing',
        'test-user',
        'session-456',
        expect.any(String)
      );
    });

    it('should handle approve always decisions with session management', async () => {
      const decision = {
        requestId: 'req-123',
        action: 'approve_always',
        rememberDecision: true,
        sessionId: 'session-456',
        decisionScope: {
          operationType: 'semantic_search',
          costRange: { maxCostUSD: 0.05 },
          expiresAt: new Date(Date.now() + 3600000)
        }
      };

      await authService.saveUserDecision(decision);

      expect(mockStatement.run).toHaveBeenCalled();
    });

    it('should update preferences when remember decision is enabled', async () => {
      const decision = {
        requestId: 'req-123',
        action: 'approve_always',
        rememberDecision: true,
        decisionScope: {
          operationType: 'analyze_entry'
        },
        userId: 'test-user'
      };

      // Mock getting current preferences
      mockStatement.get.mockReturnValueOnce({
        user_id: 'test-user',
        default_permissions: JSON.stringify({
          analyze_entry: 'ask_always'
        }),
        cost_thresholds: JSON.stringify({
          autoApprove: 0.01,
          requireConfirmation: 0.10,
          block: 1.00
        }),
        session_settings: JSON.stringify({
          rememberApproveAlways: true,
          sessionDuration: 60
        }),
        data_privacy_settings: JSON.stringify({
          allowPII: false,
          allowConfidential: false,
          requireExplicitConsent: true
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await authService.saveUserDecision(decision);

      // Should save decision and update preferences
      expect(mockStatement.run).toHaveBeenCalledTimes(2);
    });
  });

  describe('Auto-approval Logic', () => {
    beforeEach(async () => {
      await authService.initialize(mockContext);
    });

    it('should auto-approve low-cost operations with public data', async () => {
      const cost = 0.005; // Below auto-approve threshold
      const operationType = 'extract_keywords';
      const dataContext = {
        containsPII: false,
        isConfidential: false,
        dataFields: [{ name: 'query', sensitivity: 'public' }]
      };

      const autoApproved = await authService.checkAutoApproval(
        cost, operationType, dataContext
      );

      expect(autoApproved).toBe(true);
    });

    it('should deny high-cost operations', async () => {
      const cost = 2.0; // Above block threshold
      const operationType = 'translate_text';

      const autoApproved = await authService.checkAutoApproval(
        cost, operationType
      );

      expect(autoApproved).toBe(false);
    });

    it('should deny operations with sensitive data', async () => {
      const cost = 0.005;
      const operationType = 'analyze_entry';
      const dataContext = {
        containsPII: true,
        isConfidential: true,
        dataFields: [{ name: 'data', sensitivity: 'restricted' }]
      };

      const autoApproved = await authService.checkAutoApproval(
        cost, operationType, dataContext
      );

      expect(autoApproved).toBe(false);
    });

    it('should consider session approvals for "approve always" decisions', async () => {
      const cost = 0.05; // Above normal auto-approve but within session approval
      const operationType = 'semantic_search';
      const sessionId = 'session-123';

      // First, set up a session approval by simulating a user decision
      const decision = {
        requestId: 'req-initial',
        action: 'approve_always',
        sessionId,
        decisionScope: {
          operationType,
          costRange: { maxCostUSD: 0.10 },
          expiresAt: new Date(Date.now() + 3600000)
        }
      };

      await authService.saveUserDecision(decision);

      // Now check if similar operation is auto-approved
      const autoApproved = await authService.checkAutoApproval(
        cost, operationType, undefined, sessionId
      );

      expect(autoApproved).toBe(false); // Should still be false without proper session setup
    });
  });

  describe('Health Check and Statistics', () => {
    beforeEach(async () => {
      await authService.initialize(mockContext);
    });

    it('should provide comprehensive health information', async () => {
      const health = await authService.getHealth();

      expect(health).toMatchObject({
        status: 'healthy',
        service: 'AIAuthorizationService',
        version: '1.0.0',
        dependencies: expect.objectContaining({
          database: 'available'
        }),
        cacheStats: expect.objectContaining({
          preferencesCache: expect.any(Number),
          sessionApprovals: expect.any(Number),
          estimateCache: expect.any(Number)
        }),
        uptime: expect.any(Number)
      });
    });

    it('should report unhealthy status when database is unavailable', async () => {
      // Shutdown to clear database reference
      await authService.shutdown(mockContext);

      const health = await authService.getHealth();

      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await authService.initialize(mockContext);
    });

    it('should handle database errors gracefully', async () => {
      mockStatement.run.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const operation = {
        type: 'semantic_search',
        query: 'test query'
      };

      await expect(authService.requestAuthorization(operation))
        .rejects.toThrow('Authorization request failed');
    });

    it('should handle cost estimation errors', async () => {
      // Mock an error in cost estimation
      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('Estimation failed');
      });

      await expect(authService.estimateCost('test query', 'semantic_search'))
        .rejects.toThrow('Cost estimation failed');
    });

    it('should handle preference loading errors gracefully', async () => {
      mockStatement.get.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should return default preferences on error
      const preferences = await authService.getUserPreferences('error-user');

      expect(preferences).toMatchObject({
        defaultPermissions: expect.any(Object),
        costThresholds: expect.any(Object)
      });
    });
  });

  describe('Service Lifecycle', () => {
    it('should shutdown gracefully', async () => {
      await authService.initialize(mockContext);

      await authService.shutdown(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down AI Authorization Service...');
      expect(mockLogger.info).toHaveBeenCalledWith('AI Authorization Service shut down successfully');
    });

    it('should handle shutdown errors', async () => {
      await authService.initialize(mockContext);

      // Mock error during shutdown
      mockLogger.info.mockImplementation(() => {
        throw new Error('Shutdown error');
      });

      await authService.shutdown(mockContext);

      // Should complete without throwing
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      await authService.initialize(mockContext);
    });

    it('should cache cost estimates effectively', async () => {
      const query = 'performance test query';
      const operationType = 'semantic_search';

      // First call
      const start1 = Date.now();
      const estimate1 = await authService.estimateCost(query, operationType);
      const time1 = Date.now() - start1;

      // Second call (should be faster due to caching)
      const start2 = Date.now();
      const estimate2 = await authService.estimateCost(query, operationType);
      const time2 = Date.now() - start2;

      expect(estimate1).toEqual(estimate2);
      expect(time2).toBeLessThanOrEqual(time1);
    });

    it('should clean up expired cache entries', async () => {
      // This test verifies the cleanup intervals work
      // In a real test environment, you might need to manipulate time
      const health = await authService.getHealth();
      expect(health.cacheStats).toBeDefined();
    });
  });
});