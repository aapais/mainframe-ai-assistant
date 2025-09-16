/**
 * Comprehensive Test Suite for IPC Handlers
 * Tests AuthorizationHandler, CostTrackingHandler, and OperationLoggerHandler
 */

const { jest } = require('@jest/globals');

// Mock IPC utilities
const mockHandlerUtils = {
  createSuccessResponse: jest.fn((requestId, startTime, data, metadata) => ({
    success: true,
    requestId,
    data,
    metadata,
    timestamp: Date.now()
  })),
  createErrorResponse: jest.fn((requestId, startTime, errorCode, message, details) => ({
    success: false,
    requestId,
    error: { code: errorCode, message, details },
    timestamp: Date.now()
  })),
  sanitizeString: jest.fn((str, maxLength) => str.substring(0, maxLength))
};

const mockHandlerConfigs = {
  READ_HEAVY: { timeout: 5000, retries: 3 },
  WRITE_OPERATIONS: { timeout: 10000, retries: 1 },
  CRITICAL_OPERATIONS: { timeout: 30000, retries: 0 },
  SYSTEM_OPERATIONS: { timeout: 15000, retries: 2 }
};

// Mock services
const mockAuthorizationService = {
  requestAuthorization: jest.fn(),
  saveUserDecision: jest.fn(),
  getUserPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  estimateCost: jest.fn(),
  checkAutoApproval: jest.fn(),
  getHealth: jest.fn()
};

const mockCostTrackingService = {
  trackOperation: jest.fn(),
  getDailyCost: jest.fn(),
  getWeeklyCost: jest.fn(),
  getMonthlyCost: jest.fn(),
  getCostByOperation: jest.fn(),
  setCostLimit: jest.fn(),
  checkBudgetStatus: jest.fn(),
  generateCostReport: jest.fn(),
  getCostTrends: jest.fn(),
  predictMonthlyCost: jest.fn(),
  getStats: jest.fn(),
  on: jest.fn()
};

const mockOperationLoggerService = {
  logOperation: jest.fn(),
  logDecision: jest.fn(),
  logError: jest.fn(),
  getOperationHistory: jest.fn(),
  getOperationMetrics: jest.fn(),
  getOperationById: jest.fn(),
  searchLogs: jest.fn(),
  exportLogs: jest.fn(),
  cleanupOldLogs: jest.fn(),
  healthCheck: jest.fn(),
  getMetrics: jest.fn()
};

// Mock Electron IPC
const mockIpcMain = {
  handle: jest.fn(),
  removeHandler: jest.fn()
};

const mockWebContents = {
  getAllWebContents: jest.fn(() => [
    { isDestroyed: jest.fn(() => false), send: jest.fn() }
  ])
};

// Setup mocks
jest.mock('electron', () => ({
  ipcMain: mockIpcMain,
  webContents: mockWebContents
}), { virtual: true });

jest.mock('../../../src/main/ipc/handlers/index', () => ({
  HandlerUtils: mockHandlerUtils,
  HandlerConfigs: mockHandlerConfigs
}));

// Import handlers after mocking
const { AuthorizationHandler } = require('../../../src/main/ipc/handlers/AuthorizationHandler');
const { CostTrackingHandler } = require('../../../src/main/ipc/handlers/CostTrackingHandler');
const { OperationLoggerHandler } = require('../../../src/main/ipc/handlers/OperationLoggerHandler');

describe('IPC Handlers Integration Tests', () => {
  describe('AuthorizationHandler', () => {
    let authHandler;

    beforeEach(() => {
      jest.clearAllMocks();
      authHandler = new AuthorizationHandler(mockAuthorizationService);
    });

    describe('Authorization Request Handling', () => {
      it('should handle valid authorization request', async () => {
        const mockResult = {
          authorized: true,
          action: 'approve_once',
          requestId: 'req-123',
          estimates: {
            estimatedTokens: 150,
            estimatedCostUSD: 0.025,
            confidence: 0.9
          },
          autoApproved: false
        };

        mockAuthorizationService.requestAuthorization.mockResolvedValue(mockResult);

        const request = {
          requestId: 'ipc-req-456',
          operation: {
            type: 'semantic_search',
            query: 'Find JCL job examples',
            dataContext: {
              containsPII: false,
              isConfidential: false,
              dataFields: [{ name: 'query', sensitivity: 'public' }]
            }
          }
        };

        const response = await authHandler.handleAuthorizationRequest(request);

        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockResult);
        expect(mockAuthorizationService.requestAuthorization).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'semantic_search',
            query: 'Find JCL job examples'
          })
        );
        expect(mockHandlerUtils.createSuccessResponse).toHaveBeenCalled();
      });

      it('should reject request with invalid operation type', async () => {
        const request = {
          requestId: 'ipc-req-789',
          operation: {
            type: 'invalid_operation',
            query: 'Test query'
          }
        };

        const response = await authHandler.handleAuthorizationRequest(request);

        expect(response.success).toBe(false);
        expect(mockHandlerUtils.createErrorResponse).toHaveBeenCalledWith(
          'ipc-req-789',
          expect.any(Number),
          'INVALID_REQUEST_DATA',
          expect.stringContaining('Invalid operation type'),
          expect.any(Object)
        );
        expect(mockAuthorizationService.requestAuthorization).not.toHaveBeenCalled();
      });

      it('should reject request with missing required fields', async () => {
        const request = {
          requestId: 'ipc-req-missing',
          operation: {
            type: 'semantic_search'
            // Missing query
          }
        };

        const response = await authHandler.handleAuthorizationRequest(request);

        expect(response.success).toBe(false);
        expect(mockHandlerUtils.createErrorResponse).toHaveBeenCalledWith(
          'ipc-req-missing',
          expect.any(Number),
          'INVALID_REQUEST_DATA',
          'Missing required operation type or query',
          expect.any(Object)
        );
      });

      it('should sanitize input query', async () => {
        mockAuthorizationService.requestAuthorization.mockResolvedValue({
          authorized: true,
          action: 'approve_once',
          requestId: 'req-sanitize'
        });

        const longQuery = 'x'.repeat(6000); // Exceeds limit
        const request = {
          requestId: 'ipc-req-sanitize',
          operation: {
            type: 'semantic_search',
            query: longQuery
          }
        };

        await authHandler.handleAuthorizationRequest(request);

        expect(mockHandlerUtils.sanitizeString).toHaveBeenCalledWith(longQuery, 5000);
        expect(mockAuthorizationService.requestAuthorization).toHaveBeenCalledWith(
          expect.objectContaining({
            query: longQuery.substring(0, 5000)
          })
        );
      });
    });

    describe('Decision Saving', () => {
      it('should save valid user decision', async () => {
        mockAuthorizationService.saveUserDecision.mockResolvedValue();

        const request = {
          requestId: 'ipc-decision-123',
          decision: {
            requestId: 'auth-req-456',
            action: 'approve_once',
            rememberDecision: false,
            notes: 'Approved for testing'
          }
        };

        const response = await authHandler.handleSaveDecision(request);

        expect(response.success).toBe(true);
        expect(mockAuthorizationService.saveUserDecision).toHaveBeenCalledWith(
          expect.objectContaining({
            requestId: 'auth-req-456',
            action: 'approve_once'
          })
        );
      });

      it('should reject invalid decision action', async () => {
        const request = {
          requestId: 'ipc-decision-invalid',
          decision: {
            requestId: 'auth-req-789',
            action: 'invalid_action'
          }
        };

        const response = await authHandler.handleSaveDecision(request);

        expect(response.success).toBe(false);
        expect(mockHandlerUtils.createErrorResponse).toHaveBeenCalledWith(
          'ipc-decision-invalid',
          expect.any(Number),
          'INVALID_REQUEST_DATA',
          expect.stringContaining('Invalid authorization action'),
          expect.any(Object)
        );
      });

      it('should sanitize decision notes', async () => {
        mockAuthorizationService.saveUserDecision.mockResolvedValue();

        const longNotes = 'x'.repeat(1500);
        const request = {
          requestId: 'ipc-decision-notes',
          decision: {
            requestId: 'auth-req-notes',
            action: 'approve_once',
            notes: longNotes
          }
        };

        await authHandler.handleSaveDecision(request);

        expect(mockHandlerUtils.sanitizeString).toHaveBeenCalledWith(longNotes, 1000);
      });
    });

    describe('Preferences Management', () => {
      it('should get user preferences', async () => {
        const mockPreferences = {
          defaultPermissions: {
            semantic_search: 'ask_always',
            explain_error: 'auto_approve'
          },
          costThresholds: {
            autoApprove: 0.01,
            requireConfirmation: 0.10,
            block: 1.00
          }
        };

        mockAuthorizationService.getUserPreferences.mockResolvedValue(mockPreferences);

        const request = {
          requestId: 'ipc-prefs-get',
          userId: 'user-123'
        };

        const response = await authHandler.handleGetPreferences(request);

        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockPreferences);
        expect(mockAuthorizationService.getUserPreferences).toHaveBeenCalledWith('user-123');
      });

      it('should update user preferences', async () => {
        mockAuthorizationService.updatePreferences.mockResolvedValue();

        const request = {
          requestId: 'ipc-prefs-update',
          preferences: {
            costThresholds: {
              autoApprove: 0.02
            }
          },
          userId: 'user-456'
        };

        const response = await authHandler.handleUpdatePreferences(request);

        expect(response.success).toBe(true);
        expect(mockAuthorizationService.updatePreferences).toHaveBeenCalledWith(
          { costThresholds: { autoApprove: 0.02 } },
          'user-456'
        );
      });
    });

    describe('Cost Estimation', () => {
      it('should estimate operation cost', async () => {
        const mockEstimate = {
          inputTokens: 100,
          outputTokens: 200,
          totalCostUSD: 0.045,
          confidence: 0.85
        };

        mockAuthorizationService.estimateCost.mockResolvedValue(mockEstimate);

        const request = {
          requestId: 'ipc-estimate-123',
          query: 'Analyze this COBOL code',
          operationType: 'analyze_entry'
        };

        const response = await authHandler.handleEstimateCost(request);

        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockEstimate);
        expect(mockAuthorizationService.estimateCost).toHaveBeenCalledWith(
          'Analyze this COBOL code',
          'analyze_entry'
        );
      });
    });

    describe('Auto-approval Check', () => {
      it('should check auto-approval', async () => {
        mockAuthorizationService.checkAutoApproval.mockResolvedValue(true);

        const request = {
          requestId: 'ipc-auto-check',
          cost: 0.005,
          operationType: 'extract_keywords',
          dataContext: {
            containsPII: false,
            isConfidential: false
          }
        };

        const response = await authHandler.handleCheckAutoApproval(request);

        expect(response.success).toBe(true);
        expect(response.data.autoApproved).toBe(true);
        expect(mockAuthorizationService.checkAutoApproval).toHaveBeenCalledWith(
          0.005,
          'extract_keywords',
          request.dataContext,
          undefined,
          undefined
        );
      });
    });
  });

  describe('CostTrackingHandler', () => {
    let costHandler;

    beforeEach(() => {
      jest.clearAllMocks();
      costHandler = new CostTrackingHandler(mockCostTrackingService);
    });

    describe('Operation Tracking', () => {
      it('should track operation successfully', async () => {
        mockCostTrackingService.trackOperation.mockResolvedValue();

        const operation = {
          id: 'op-123',
          type: 'claude-request',
          model: 'claude-3-sonnet',
          inputTokens: 100,
          outputTokens: 200,
          timestamp: new Date()
        };

        const response = await costHandler.handleTrackOperation(
          { sender: {} },
          operation,
          0.05
        );

        expect(response.success).toBe(true);
        expect(mockCostTrackingService.trackOperation).toHaveBeenCalledWith(operation, 0.05);
      });

      it('should handle tracking errors', async () => {
        mockCostTrackingService.trackOperation.mockRejectedValue(
          new Error('Database error')
        );

        const operation = {
          id: 'op-error',
          type: 'search',
          timestamp: new Date()
        };

        const response = await costHandler.handleTrackOperation(
          { sender: {} },
          operation
        );

        expect(response.success).toBe(false);
        expect(response.error).toContain('Database error');
      });
    });

    describe('Cost Queries', () => {
      it('should get daily cost', async () => {
        mockCostTrackingService.getDailyCost.mockResolvedValue(5.25);

        const response = await costHandler.handleGetDailyCost(
          { sender: {} },
          'user-123',
          '2024-01-15'
        );

        expect(response.success).toBe(true);
        expect(response.cost).toBe(5.25);
        expect(mockCostTrackingService.getDailyCost).toHaveBeenCalledWith(
          'user-123',
          new Date('2024-01-15')
        );
      });

      it('should get weekly cost', async () => {
        mockCostTrackingService.getWeeklyCost.mockResolvedValue(25.50);

        const response = await costHandler.handleGetWeeklyCost(
          { sender: {} },
          'user-456'
        );

        expect(response.success).toBe(true);
        expect(response.cost).toBe(25.50);
      });

      it('should get monthly cost', async () => {
        mockCostTrackingService.getMonthlyCost.mockResolvedValue(125.75);

        const response = await costHandler.handleGetMonthlyCost(
          { sender: {} },
          'user-789'
        );

        expect(response.success).toBe(true);
        expect(response.cost).toBe(125.75);
      });

      it('should get cost by operation type', async () => {
        mockCostTrackingService.getCostByOperation.mockResolvedValue(15.25);

        const response = await costHandler.handleGetCostByOperation(
          { sender: {} },
          'claude-request',
          { start: '2024-01-01', end: '2024-01-31' }
        );

        expect(response.success).toBe(true);
        expect(response.cost).toBe(15.25);
        expect(mockCostTrackingService.getCostByOperation).toHaveBeenCalledWith(
          'claude-request',
          {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31')
          }
        );
      });
    });

    describe('Budget Management', () => {
      it('should set cost limit', async () => {
        mockCostTrackingService.setCostLimit.mockResolvedValue();

        const limit = {
          userId: 'user-123',
          limitType: 'daily',
          amount: 10.0,
          currency: 'USD',
          alertThreshold: 80.0,
          isActive: true
        };

        const response = await costHandler.handleSetCostLimit(
          { sender: {} },
          limit
        );

        expect(response.success).toBe(true);
        expect(mockCostTrackingService.setCostLimit).toHaveBeenCalledWith(limit);
      });

      it('should check budget status', async () => {
        const mockStatus = {
          dailySpent: 8.5,
          weeklySpent: 45.0,
          monthlySpent: 120.0,
          dailyLimit: 10.0,
          isOverBudget: false,
          alerts: ['Daily budget at 85%']
        };

        mockCostTrackingService.checkBudgetStatus.mockResolvedValue(mockStatus);

        const response = await costHandler.handleCheckBudgetStatus({ sender: {} });

        expect(response.success).toBe(true);
        expect(response.status).toEqual(mockStatus);
      });
    });

    describe('Reporting and Analytics', () => {
      it('should generate cost report', async () => {
        const mockReport = {
          period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
          totalCost: 125.50,
          totalOperations: 250,
          operationBreakdown: {
            'claude-request': 100.25,
            'search': 25.25
          }
        };

        mockCostTrackingService.generateCostReport.mockResolvedValue(mockReport);

        const response = await costHandler.handleGenerateCostReport(
          { sender: {} },
          { start: '2024-01-01', end: '2024-01-31' }
        );

        expect(response.success).toBe(true);
        expect(response.report).toEqual(mockReport);
      });

      it('should get cost trends', async () => {
        const mockTrends = {
          last7Days: [1, 2, 3, 4, 5, 6, 7],
          last30Days: Array(30).fill(0).map((_, i) => i + 1),
          weekOverWeekChange: 15.5,
          monthOverMonthChange: 8.2
        };

        mockCostTrackingService.getCostTrends.mockResolvedValue(mockTrends);

        const response = await costHandler.handleGetCostTrends({ sender: {} });

        expect(response.success).toBe(true);
        expect(response.trends).toEqual(mockTrends);
      });

      it('should predict monthly cost', async () => {
        mockCostTrackingService.predictMonthlyCost.mockResolvedValue(185.75);

        const response = await costHandler.handlePredictMonthlyCost({ sender: {} });

        expect(response.success).toBe(true);
        expect(response.prediction).toBe(185.75);
      });
    });

    describe('Budget Alerts', () => {
      it('should handle budget alerts', () => {
        const alertData = {
          userId: 'user-123',
          alerts: ['Daily budget at 90%'],
          isOverBudget: false
        };

        costHandler.handleBudgetAlert(alertData);

        expect(mockWebContents.getAllWebContents).toHaveBeenCalled();
        // Verify alert was sent to renderer processes
      });
    });
  });

  describe('OperationLoggerHandler', () => {
    let loggerHandler;

    beforeEach(() => {
      jest.clearAllMocks();
      loggerHandler = new OperationLoggerHandler(mockOperationLoggerService);
    });

    describe('Operation Logging', () => {
      it('should log operation successfully', async () => {
        mockOperationLoggerService.logOperation.mockResolvedValue();

        const request = {
          requestId: 'ipc-log-op',
          operation: {
            type: 'semantic_search',
            query: 'Find JCL examples',
            status: 'completed',
            startTime: new Date(),
            userId: 'user-123'
          }
        };

        const response = await loggerHandler.handleLogOperation(request);

        expect(response.success).toBe(true);
        expect(mockOperationLoggerService.logOperation).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'semantic_search',
            query: 'Find JCL examples'
          })
        );
      });

      it('should validate operation type', async () => {
        const request = {
          requestId: 'ipc-log-invalid',
          operation: {
            type: 'invalid_type',
            query: 'Test'
          }
        };

        const response = await loggerHandler.handleLogOperation(request);

        expect(response.success).toBe(false);
        expect(mockHandlerUtils.createErrorResponse).toHaveBeenCalledWith(
          'ipc-log-invalid',
          expect.any(Number),
          'INVALID_REQUEST_DATA',
          expect.stringContaining('Invalid operation type'),
          expect.any(Object)
        );
      });

      it('should sanitize operation query and metadata', async () => {
        mockOperationLoggerService.logOperation.mockResolvedValue();

        const request = {
          requestId: 'ipc-log-sanitize',
          operation: {
            type: 'analyze_entry',
            query: 'x'.repeat(6000), // Too long
            status: 'completed',
            startTime: new Date(),
            metadata: {
              longField: 'y'.repeat(2000)
            }
          }
        };

        await loggerHandler.handleLogOperation(request);

        expect(mockHandlerUtils.sanitizeString).toHaveBeenCalledWith(
          expect.any(String),
          5000
        );
      });
    });

    describe('Decision Logging', () => {
      it('should log authorization decision', async () => {
        mockOperationLoggerService.logDecision.mockResolvedValue();

        const request = {
          requestId: 'ipc-log-decision',
          decision: {
            operationId: 'op-123',
            action: 'approve_once',
            autoApproved: false,
            timestamp: new Date(),
            rememberChoice: true
          }
        };

        const response = await loggerHandler.handleLogDecision(request);

        expect(response.success).toBe(true);
        expect(mockOperationLoggerService.logDecision).toHaveBeenCalledWith(
          expect.objectContaining({
            operationId: 'op-123',
            action: 'approve_once'
          })
        );
      });

      it('should validate decision action', async () => {
        const request = {
          requestId: 'ipc-log-decision-invalid',
          decision: {
            operationId: 'op-456',
            action: 'invalid_action',
            timestamp: new Date()
          }
        };

        const response = await loggerHandler.handleLogDecision(request);

        expect(response.success).toBe(false);
        expect(mockHandlerUtils.createErrorResponse).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          'INVALID_REQUEST_DATA',
          expect.stringContaining('Invalid decision action'),
          expect.any(Object)
        );
      });
    });

    describe('Error Logging', () => {
      it('should log operation error', async () => {
        mockOperationLoggerService.logError.mockResolvedValue();

        const request = {
          requestId: 'ipc-log-error',
          error: {
            operationId: 'op-error',
            errorCode: 'TIMEOUT_ERROR',
            errorType: 'timeout_error',
            message: 'Operation timed out',
            severity: 'high',
            timestamp: new Date(),
            resolved: false
          }
        };

        const response = await loggerHandler.handleLogError(request);

        expect(response.success).toBe(true);
        expect(mockOperationLoggerService.logError).toHaveBeenCalledWith(
          expect.objectContaining({
            errorCode: 'TIMEOUT_ERROR',
            errorType: 'timeout_error'
          })
        );
      });

      it('should validate error severity', async () => {
        const request = {
          requestId: 'ipc-log-error-invalid',
          error: {
            errorCode: 'TEST_ERROR',
            errorType: 'system_error',
            message: 'Test error',
            severity: 'invalid_severity',
            timestamp: new Date(),
            resolved: false
          }
        };

        const response = await loggerHandler.handleLogError(request);

        expect(response.success).toBe(false);
        expect(mockHandlerUtils.createErrorResponse).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          'INVALID_REQUEST_DATA',
          expect.stringContaining('Invalid error severity'),
          expect.any(Object)
        );
      });
    });

    describe('Query Interface', () => {
      it('should get operation history with filters', async () => {
        const mockOperations = [
          {
            id: 'op-1',
            type: 'semantic_search',
            query: 'Test query',
            status: 'completed'
          }
        ];

        mockOperationLoggerService.getOperationHistory.mockResolvedValue(mockOperations);

        const request = {
          requestId: 'ipc-get-history',
          filters: {
            type: 'semantic_search',
            status: 'completed',
            limit: 10
          }
        };

        const response = await loggerHandler.handleGetOperationHistory(request);

        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockOperations);
        expect(mockOperationLoggerService.getOperationHistory).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'semantic_search',
            status: 'completed',
            limit: 10
          })
        );
      });

      it('should get operation metrics', async () => {
        const mockMetrics = {
          totalOperations: 150,
          successfulOperations: 135,
          failedOperations: 15,
          averageResponseTime: 2500,
          totalCost: 12.75
        };

        mockOperationLoggerService.getOperationMetrics.mockResolvedValue(mockMetrics);

        const request = {
          requestId: 'ipc-get-metrics',
          period: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31')
          }
        };

        const response = await loggerHandler.handleGetOperationMetrics(request);

        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockMetrics);
      });

      it('should search logs', async () => {
        const mockResults = [
          { id: 'op-search-1', query: 'JCL example', type: 'semantic_search' }
        ];

        mockOperationLoggerService.searchLogs.mockResolvedValue(mockResults);

        const request = {
          requestId: 'ipc-search-logs',
          query: 'JCL'
        };

        const response = await loggerHandler.handleSearchLogs(request);

        expect(response.success).toBe(true);
        expect(response.data).toEqual(mockResults);
        expect(mockHandlerUtils.sanitizeString).toHaveBeenCalledWith('JCL', 200);
      });
    });

    describe('Export and Cleanup', () => {
      it('should export logs to CSV', async () => {
        mockOperationLoggerService.exportLogs.mockResolvedValue('/mock/export.csv');

        const mockStats = { size: 2048 };
        const mockFs = require('fs');
        mockFs.promises = { stat: jest.fn().mockResolvedValue(mockStats) };

        const request = {
          requestId: 'ipc-export-csv',
          format: 'csv',
          period: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31')
          }
        };

        const response = await loggerHandler.handleExportLogs(request);

        expect(response.success).toBe(true);
        expect(mockOperationLoggerService.exportLogs).toHaveBeenCalledWith(
          'csv',
          expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date)
          }),
          undefined
        );
      });

      it('should cleanup old logs', async () => {
        mockOperationLoggerService.cleanupOldLogs.mockResolvedValue(45);

        const request = {
          requestId: 'ipc-cleanup',
          daysToKeep: 60
        };

        const response = await loggerHandler.handleCleanupLogs(request);

        expect(response.success).toBe(true);
        expect(response.data.deletedCount).toBe(45);
        expect(mockOperationLoggerService.cleanupOldLogs).toHaveBeenCalledWith(60);
      });
    });

    describe('Health and Statistics', () => {
      it('should get service statistics', async () => {
        const mockHealth = {
          healthy: true,
          details: {
            operationsToday: 25,
            databaseSize: 1024000
          }
        };

        const mockMetrics = {
          uptime: 86400000,
          operationsCount: 1500,
          errorRate: 0.02,
          averageResponseTime: 1200,
          cacheHitRate: 0.85
        };

        mockOperationLoggerService.healthCheck.mockResolvedValue(mockHealth);
        mockOperationLoggerService.getMetrics.mockReturnValue(mockMetrics);

        const request = { requestId: 'ipc-service-stats' };

        const response = await loggerHandler.handleGetServiceStats(request);

        expect(response.success).toBe(true);
        expect(response.data).toMatchObject({
          uptime: 86400000,
          totalOperations: 1500,
          operationsToday: 25,
          errorRate: 0.02,
          averageResponseTime: 1200,
          cacheHitRate: 0.85
        });
      });
    });
  });

  describe('Handler Configuration', () => {
    it('should provide proper configuration for AuthorizationHandler', () => {
      const config = AuthorizationHandler.getHandlerConfig();

      expect(config).toHaveProperty('authorization:request');
      expect(config).toHaveProperty('authorization:save_decision');
      expect(config).toHaveProperty('authorization:get_preferences');
      expect(config).toHaveProperty('authorization:update_preferences');
      expect(config).toHaveProperty('authorization:estimate_cost');
      expect(config).toHaveProperty('authorization:check_auto_approval');

      // Verify critical operations have appropriate configuration
      expect(config['authorization:request'].config).toMatchObject({
        ...mockHandlerConfigs.CRITICAL_OPERATIONS,
        trackMetrics: true,
        validateInput: true,
        sanitizeInput: true
      });
    });

    it('should provide proper configuration for OperationLoggerHandler', () => {
      const config = OperationLoggerHandler.getHandlerConfig();

      expect(config).toHaveProperty('operationLogger:logOperation');
      expect(config).toHaveProperty('operationLogger:logDecision');
      expect(config).toHaveProperty('operationLogger:logError');
      expect(config).toHaveProperty('operationLogger:getOperationHistory');
      expect(config).toHaveProperty('operationLogger:exportLogs');
      expect(config).toHaveProperty('operationLogger:cleanupLogs');

      // Verify export operations have appropriate restrictions
      expect(config['operationLogger:exportLogs'].config.rateLimitConfig).toEqual({
        requests: 5,
        windowMs: 300000
      });

      // Verify cleanup operations require authentication
      expect(config['operationLogger:cleanupLogs'].config.requireAuth).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const authHandler = new AuthorizationHandler(mockAuthorizationService);

      mockAuthorizationService.requestAuthorization.mockRejectedValue(
        new Error('Service unavailable')
      );

      const request = {
        requestId: 'ipc-error-test',
        operation: {
          type: 'semantic_search',
          query: 'Test query'
        }
      };

      const response = await authHandler.handleAuthorizationRequest(request);

      expect(response.success).toBe(false);
      expect(mockHandlerUtils.createErrorResponse).toHaveBeenCalledWith(
        'ipc-error-test',
        expect.any(Number),
        'AUTHORIZATION_FAILED',
        'Authorization request failed',
        expect.objectContaining({
          error: 'Service unavailable'
        })
      );
    });

    it('should handle invalid request data', async () => {
      const authHandler = new AuthorizationHandler(mockAuthorizationService);

      const request = {
        requestId: 'ipc-invalid-test',
        operation: null // Invalid operation
      };

      const response = await authHandler.handleAuthorizationRequest(request);

      expect(response.success).toBe(false);
      expect(mockHandlerUtils.createErrorResponse).toHaveBeenCalledWith(
        'ipc-invalid-test',
        expect.any(Number),
        'INVALID_REQUEST_DATA',
        'Missing required operation type or query',
        expect.any(Object)
      );
    });
  });
});