/**
 * Comprehensive Test Suite for OperationLoggerService
 * Tests operation logging, decision tracking, error logging, metrics, and export functionality
 */

const { jest } = require('@jest/globals');
const { EventEmitter } = require('events');
const path = require('path');

// Mock better-sqlite3 database
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

// Mock file system
const mockFs = {
  mkdir: jest.fn().mockResolvedValue(),
  writeFile: jest.fn().mockResolvedValue(),
  stat: jest.fn().mockResolvedValue({ size: 1024 })
};

// Setup mocks
jest.mock('better-sqlite3', () => {
  return jest.fn(() => mockDatabase);
}, { virtual: true });

jest.mock('fs', () => ({
  promises: mockFs,
  createWriteStream: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(() => '/mock/dir')
}));

// Import service after mocking
const { OperationLoggerService } = require('../../../src/main/services/OperationLoggerService');

describe('OperationLoggerService Integration Tests', () => {
  let operationLogger;
  let mockContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock database responses
    mockDatabase.prepare.mockReturnValue(mockStatement);
    mockStatement.run.mockReturnValue({ changes: 1 });
    mockStatement.get.mockReturnValue({ test: 1 });
    mockStatement.all.mockReturnValue([]);

    // Setup mock context
    mockContext = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      },
      dataPath: '/mock/data',
      isDevelopment: false
    };

    operationLogger = new OperationLoggerService();
  });

  afterEach(async () => {
    if (operationLogger) {
      await operationLogger.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with proper database setup', async () => {
      await operationLogger.initialize(mockContext);

      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS operation_logs')
      );
      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS operation_decisions')
      );
      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS operation_errors')
      );
      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );

      expect(mockContext.logger.info).toHaveBeenCalledWith('Initializing Operation Logger Service...');
      expect(mockContext.logger.info).toHaveBeenCalledWith('Operation Logger Service initialized successfully');
    });

    it('should enable verbose logging in development mode', async () => {
      mockContext.isDevelopment = true;

      await operationLogger.initialize(mockContext);

      // Database should be created with verbose logging
      expect(mockDatabase).toHaveBeenCalledWith(
        expect.any(String),
        { verbose: console.log }
      );
    });

    it('should setup database optimizations', async () => {
      await operationLogger.initialize(mockContext);

      expect(mockDatabase.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('synchronous = NORMAL');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('cache_size = 10000');
      expect(mockDatabase.pragma).toHaveBeenCalledWith('temp_store = memory');
    });

    it('should handle initialization errors', async () => {
      mockDatabase.exec.mockImplementation(() => {
        throw new Error('Database creation failed');
      });

      await expect(operationLogger.initialize(mockContext))
        .rejects.toThrow('Database creation failed');
    });
  });

  describe('Operation Logging', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should log basic operation successfully', async () => {
      const operation = {
        type: 'semantic_search',
        subtype: 'jcl_search',
        userId: 'user-123',
        sessionId: 'session-456',
        query: 'Find JCL job examples',
        context: {
          sourceComponent: 'search-interface',
          userAgent: 'test-agent'
        },
        status: 'completed',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:00:02Z'),
        duration: 2000,
        result: {
          success: true,
          resultCount: 5,
          cached: false
        },
        metadata: {
          searchTerms: ['JCL', 'job', 'examples'],
          category: 'technical'
        },
        kbEntryId: 'kb-entry-789'
      };

      await operationLogger.logOperation(operation);

      expect(mockStatement.run).toHaveBeenCalledWith(
        expect.stringMatching(/^op_\d+_[a-z0-9]+$/), // Generated ID pattern
        'semantic_search',
        'jcl_search',
        'user-123',
        'session-456',
        'Find JCL job examples',
        expect.stringContaining('sourceComponent'), // JSON context
        'completed',
        '2024-01-15T10:00:00.000Z',
        '2024-01-15T10:00:02.000Z',
        2000,
        expect.stringContaining('success'), // JSON result
        expect.stringContaining('searchTerms'), // JSON metadata
        'kb-entry-789',
        null, // cost_data
        null, // error_id
        expect.any(String), // created_at
        expect.any(String)  // updated_at
      );
    });

    it('should log operation with cost data', async () => {
      const operation = {
        type: 'analyze_entry',
        query: 'Analyze this COBOL code',
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        cost: {
          estimatedCost: 0.05,
          actualCost: 0.048,
          tokens: { input: 100, output: 50, total: 150 },
          model: 'claude-3-sonnet',
          provider: 'anthropic',
          currency: 'USD'
        }
      };

      await operationLogger.logOperation(operation);

      const callArgs = mockStatement.run.mock.calls[0];
      const costDataJson = callArgs[14]; // cost_data field

      expect(costDataJson).toContain('0.05');
      expect(costDataJson).toContain('claude-3-sonnet');
      expect(JSON.parse(costDataJson)).toMatchObject({
        estimatedCost: 0.05,
        actualCost: 0.048,
        tokens: { input: 100, output: 50, total: 150 }
      });
    });

    it('should log operation with error', async () => {
      const operationError = {
        id: 'error-123',
        errorCode: 'TIMEOUT_ERROR',
        errorType: 'timeout_error',
        message: 'Operation timed out',
        severity: 'medium',
        timestamp: new Date(),
        resolved: false
      };

      const operation = {
        type: 'translate_text',
        query: 'Translate this text',
        status: 'failed',
        startTime: new Date(),
        error: operationError
      };

      await operationLogger.logOperation(operation);

      const callArgs = mockStatement.run.mock.calls[0];
      const errorId = callArgs[15]; // error_id field

      expect(errorId).toBe('error-123');
    });

    it('should emit operation events', async () => {
      const operationLoggedListener = jest.fn();
      const operationCompletedListener = jest.fn();

      operationLogger.on('operation:logged', operationLoggedListener);
      operationLogger.on('operation:completed', operationCompletedListener);

      const operation = {
        type: 'kb_search',
        query: 'Search query',
        status: 'completed',
        startTime: new Date()
      };

      await operationLogger.logOperation(operation);

      expect(operationLoggedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'kb_search',
          status: 'completed',
          id: expect.any(String)
        })
      );

      expect(operationCompletedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'kb_search',
          status: 'completed'
        })
      );
    });

    it('should handle failed operations with error events', async () => {
      const operationFailedListener = jest.fn();
      operationLogger.on('operation:failed', operationFailedListener);

      const operation = {
        type: 'semantic_search',
        query: 'Failed search',
        status: 'failed',
        startTime: new Date(),
        error: {
          id: 'error-456',
          errorCode: 'SEARCH_FAILED',
          errorType: 'system_error',
          message: 'Search index unavailable',
          severity: 'high',
          timestamp: new Date(),
          resolved: false
        }
      };

      await operationLogger.logOperation(operation);

      expect(operationFailedListener).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
        expect.objectContaining({ errorCode: 'SEARCH_FAILED' })
      );
    });
  });

  describe('Decision Logging', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should log authorization decisions', async () => {
      const decision = {
        operationId: 'op-123',
        userId: 'user-456',
        sessionId: 'session-789',
        action: 'approve_once',
        autoApproved: false,
        reason: 'User approved after reviewing cost',
        timestamp: new Date('2024-01-15T11:00:00Z'),
        rememberChoice: true,
        cost: 0.025,
        notes: 'Approved for research purposes',
        scope: 'operation',
        metadata: {
          reviewTime: 15000,
          alternatives: ['deny', 'use_local_only']
        }
      };

      await operationLogger.logDecision(decision);

      expect(mockStatement.run).toHaveBeenCalledWith(
        expect.stringMatching(/^dec_\d+_[a-z0-9]+$/),
        'op-123',
        'user-456',
        'session-789',
        'approve_once',
        0, // autoApproved as integer
        'User approved after reviewing cost',
        '2024-01-15T11:00:00.000Z',
        1, // rememberChoice as integer
        0.025,
        'Approved for research purposes',
        'operation',
        expect.stringContaining('reviewTime')
      );
    });

    it('should log auto-approved decisions', async () => {
      const decision = {
        operationId: 'op-456',
        action: 'approve_once',
        autoApproved: true,
        reason: 'Auto-approved based on cost threshold',
        timestamp: new Date(),
        rememberChoice: false
      };

      await operationLogger.logDecision(decision);

      const callArgs = mockStatement.run.mock.calls[0];
      expect(callArgs[5]).toBe(1); // autoApproved = true as 1
      expect(callArgs[8]).toBe(0); // rememberChoice = false as 0
    });

    it('should emit decision logged events', async () => {
      const decisionLoggedListener = jest.fn();
      operationLogger.on('decision:logged', decisionLoggedListener);

      const decision = {
        operationId: 'op-789',
        action: 'deny',
        autoApproved: false,
        timestamp: new Date(),
        rememberChoice: false
      };

      await operationLogger.logDecision(decision);

      expect(decisionLoggedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deny',
          autoApproved: false,
          id: expect.any(String)
        })
      );
    });
  });

  describe('Error Logging', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should log operation errors with full details', async () => {
      const error = {
        operationId: 'op-error-123',
        errorCode: 'AUTH_FAILED',
        errorType: 'authorization_error',
        message: 'User authorization failed for AI operation',
        stack: 'Error: User authorization failed\n    at AuthService.authorize\n    at line 42',
        severity: 'high',
        userId: 'user-789',
        sessionId: 'session-012',
        timestamp: new Date('2024-01-15T12:00:00Z'),
        resolved: false,
        metadata: {
          attemptNumber: 2,
          lastAttempt: '2024-01-15T11:59:30Z',
          failureReason: 'insufficient_permissions'
        }
      };

      await operationLogger.logError(error);

      expect(mockStatement.run).toHaveBeenCalledWith(
        expect.stringMatching(/^err_\d+_[a-z0-9]+$/),
        'op-error-123',
        'AUTH_FAILED',
        'authorization_error',
        'User authorization failed for AI operation',
        expect.stringContaining('AuthService.authorize'),
        'high',
        'user-789',
        'session-012',
        '2024-01-15T12:00:00.000Z',
        0, // resolved as integer
        expect.stringContaining('attemptNumber')
      );
    });

    it('should log system errors without operation context', async () => {
      const error = {
        errorCode: 'DB_CONNECTION_FAILED',
        errorType: 'database_error',
        message: 'Failed to connect to database',
        severity: 'critical',
        timestamp: new Date(),
        resolved: false
      };

      await operationLogger.logError(error);

      const callArgs = mockStatement.run.mock.calls[0];
      expect(callArgs[1]).toBeNull(); // operationId should be null
      expect(callArgs[3]).toBe('database_error');
      expect(callArgs[6]).toBe('critical');
    });

    it('should emit error logged events', async () => {
      const errorLoggedListener = jest.fn();
      operationLogger.on('error:logged', errorLoggedListener);

      const error = {
        errorCode: 'VALIDATION_FAILED',
        errorType: 'validation_error',
        message: 'Invalid input parameters',
        severity: 'medium',
        timestamp: new Date(),
        resolved: false
      };

      await operationLogger.logError(error);

      expect(errorLoggedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'VALIDATION_FAILED',
          errorType: 'validation_error',
          id: expect.any(String)
        })
      );
    });
  });

  describe('Query Interface', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should get operation history with filters', async () => {
      const mockOperations = [
        {
          id: 'op-1',
          type: 'semantic_search',
          user_id: 'user-123',
          status: 'completed',
          start_time: '2024-01-15T10:00:00Z',
          query: 'Test query 1',
          context: null,
          subtype: null,
          session_id: null,
          end_time: '2024-01-15T10:00:02Z',
          duration: 2000,
          result: null,
          metadata: null,
          kb_entry_id: null,
          cost_data: null,
          error_id: null,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:02Z'
        }
      ];

      mockStatement.all.mockReturnValue(mockOperations);

      const filters = {
        type: 'semantic_search',
        userId: 'user-123',
        status: 'completed',
        limit: 10
      };

      const operations = await operationLogger.getOperationHistory(filters);

      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        id: 'op-1',
        type: 'semantic_search',
        userId: 'user-123',
        status: 'completed',
        query: 'Test query 1'
      });

      // Verify SQL query construction
      const prepareCall = mockDatabase.prepare.mock.calls.find(call =>
        call[0].includes('SELECT ol.*, oe.error_code')
      );
      expect(prepareCall).toBeDefined();
    });

    it('should get operation by ID', async () => {
      const mockOperation = {
        id: 'op-specific',
        type: 'analyze_entry',
        user_id: 'user-456',
        query: 'Analyze COBOL code',
        status: 'completed',
        start_time: '2024-01-15T11:00:00Z',
        context: null,
        subtype: null,
        session_id: null,
        end_time: '2024-01-15T11:00:05Z',
        duration: 5000,
        result: null,
        metadata: null,
        kb_entry_id: null,
        cost_data: null,
        error_id: null,
        created_at: '2024-01-15T11:00:00Z',
        updated_at: '2024-01-15T11:00:05Z'
      };

      mockStatement.get.mockReturnValue(mockOperation);

      const operation = await operationLogger.getOperationById('op-specific');

      expect(operation).toMatchObject({
        id: 'op-specific',
        type: 'analyze_entry',
        userId: 'user-456',
        query: 'Analyze COBOL code'
      });

      expect(mockStatement.get).toHaveBeenCalledWith('op-specific');
    });

    it('should return null for non-existent operation', async () => {
      mockStatement.get.mockReturnValue(undefined);

      const operation = await operationLogger.getOperationById('non-existent');

      expect(operation).toBeNull();
    });

    it('should search logs with query string', async () => {
      const mockResults = [
        {
          id: 'op-search-1',
          type: 'kb_search',
          query: 'JCL job examples',
          status: 'completed',
          start_time: '2024-01-15T09:00:00Z',
          user_id: null,
          context: null,
          subtype: null,
          session_id: null,
          end_time: null,
          duration: null,
          result: null,
          metadata: null,
          kb_entry_id: null,
          cost_data: null,
          error_id: null,
          created_at: '2024-01-15T09:00:00Z',
          updated_at: '2024-01-15T09:00:00Z'
        }
      ];

      mockStatement.all.mockReturnValue(mockResults);

      const results = await operationLogger.searchLogs('JCL');

      expect(results).toHaveLength(1);
      expect(results[0].query).toContain('JCL');

      // Verify search query with LIKE patterns
      expect(mockStatement.all).toHaveBeenCalledWith(
        '%JCL%', '%JCL%', '%JCL%', '%JCL%'
      );
    });
  });

  describe('Operation Metrics', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should calculate comprehensive operation metrics', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      // Mock various database queries for metrics
      mockStatement.get
        .mockReturnValueOnce({
          total_operations: 150,
          successful_operations: 135,
          failed_operations: 15,
          avg_response_time: 2500,
          total_cost: 12.75,
          avg_cost: 0.085
        })
        .mockReturnValueOnce({
          decisions_count: 45,
          auto_approved_count: 30
        });

      mockStatement.all
        .mockReturnValueOnce([
          { type: 'semantic_search', count: 75 },
          { type: 'analyze_entry', count: 50 },
          { type: 'kb_search', count: 25 }
        ])
        .mockReturnValueOnce([
          { status: 'completed', count: 135 },
          { status: 'failed', count: 15 }
        ])
        .mockReturnValueOnce([
          { error_type: 'timeout_error', count: 8 },
          { error_type: 'validation_error', count: 7 }
        ])
        .mockReturnValueOnce([
          { user_id: 'user-1', operation_count: 25 },
          { user_id: 'user-2', operation_count: 20 }
        ])
        .mockReturnValueOnce([
          { duration: 1000 },
          { duration: 2000 },
          { duration: 3000 },
          { duration: 4000 },
          { duration: 5000 }
        ])
        .mockReturnValueOnce([
          { hour: 9, count: 15 },
          { hour: 14, count: 12 }
        ])
        .mockReturnValueOnce([
          { date: '2024-01-15', cost: 5.25 },
          { date: '2024-01-16', cost: 7.50 }
        ]);

      const metrics = await operationLogger.getOperationMetrics(period);

      expect(metrics).toMatchObject({
        totalOperations: 150,
        successfulOperations: 135,
        failedOperations: 15,
        averageResponseTime: 2500,
        totalCost: 12.75,
        averageCost: 0.085,
        operationsByType: {
          semantic_search: 75,
          analyze_entry: 50,
          kb_search: 25
        },
        operationsByStatus: {
          completed: 135,
          failed: 15
        },
        errorsByType: {
          timeout_error: 8,
          validation_error: 7
        },
        decisionsCount: 45,
        autoApprovedCount: 30,
        userDecisionsCount: 15,
        topUsers: [
          { userId: 'user-1', operationCount: 25 },
          { userId: 'user-2', operationCount: 20 }
        ],
        peakUsageHours: [
          { hour: 9, count: 15 },
          { hour: 14, count: 12 }
        ],
        costByDay: [
          { date: '2024-01-15', cost: 5.25 },
          { date: '2024-01-16', cost: 7.50 }
        ],
        responseTimePercentiles: {
          p50: 3000,
          p90: 5000,
          p95: 5000,
          p99: 5000
        },
        period,
        generatedAt: expect.any(Date)
      });
    });

    it('should cache metrics for performance', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      // Mock minimal response for caching test
      mockStatement.get.mockReturnValue({
        total_operations: 10,
        successful_operations: 9,
        failed_operations: 1,
        avg_response_time: 1000,
        total_cost: 1.0,
        avg_cost: 0.1
      });

      mockStatement.all.mockReturnValue([]);

      // First call
      await operationLogger.getOperationMetrics(period);

      // Second call should use cache
      await operationLogger.getOperationMetrics(period);

      // Should only prepare the main metrics query once
      const metricsCalls = mockDatabase.prepare.mock.calls.filter(call =>
        call[0].includes('total_operations')
      );
      expect(metricsCalls.length).toBe(1);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should export operations to CSV format', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      // Mock operations for export
      jest.spyOn(operationLogger, 'getOperationHistory').mockResolvedValue([
        {
          id: 'op-1',
          type: 'semantic_search',
          subtype: 'jcl_search',
          userId: 'user-123',
          sessionId: 'session-456',
          query: 'Find JCL examples',
          status: 'completed',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T10:00:02Z'),
          duration: 2000,
          cost: { estimatedCost: 0.025 },
          kbEntryId: 'kb-789',
          error: null,
          createdAt: new Date('2024-01-15T10:00:00Z')
        }
      ]);

      const filePath = await operationLogger.exportLogs('csv', period, '/mock/export.csv');

      expect(filePath).toBe('/mock/export.csv');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/mock', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/mock/export.csv',
        expect.stringContaining('ID,Type,Subtype'),
        'utf8'
      );

      // Verify CSV content structure
      const csvContent = mockFs.writeFile.mock.calls[0][1];
      expect(csvContent).toContain('op-1,semantic_search,jcl_search');
      expect(csvContent).toContain('user-123,session-456');
      expect(csvContent).toContain('"Find JCL examples"');
    });

    it('should export operations to JSON format', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      jest.spyOn(operationLogger, 'getOperationHistory').mockResolvedValue([
        {
          id: 'op-2',
          type: 'analyze_entry',
          query: 'Analyze COBOL',
          status: 'completed',
          startTime: new Date('2024-01-15T11:00:00Z'),
          createdAt: new Date('2024-01-15T11:00:00Z')
        }
      ]);

      const filePath = await operationLogger.exportLogs('json', period);

      expect(filePath).toMatch(/operations_export_.*\.json$/);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"exportDate"'),
        'utf8'
      );

      // Verify JSON content structure
      const jsonContent = mockFs.writeFile.mock.calls[0][1];
      const parsed = JSON.parse(jsonContent);
      expect(parsed).toMatchObject({
        exportDate: expect.any(String),
        totalOperations: 1,
        operations: expect.arrayContaining([
          expect.objectContaining({
            id: 'op-2',
            type: 'analyze_entry'
          })
        ])
      });
    });

    it('should emit export completed events', async () => {
      const exportListener = jest.fn();
      operationLogger.on('export:completed', exportListener);

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      jest.spyOn(operationLogger, 'getOperationHistory').mockResolvedValue([]);

      await operationLogger.exportLogs('json', period);

      expect(exportListener).toHaveBeenCalledWith(
        expect.stringMatching(/\.json$/),
        'json'
      );
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should cleanup old logs based on retention policy', async () => {
      const retentionDays = 60;

      mockStatement.run
        .mockReturnValueOnce({ changes: 45 })  // operations deleted
        .mockReturnValueOnce({ changes: 12 })  // decisions deleted
        .mockReturnValueOnce({ changes: 8 });  // errors deleted

      const deletedCount = await operationLogger.cleanupOldLogs(retentionDays);

      expect(deletedCount).toBe(65); // 45 + 12 + 8

      // Verify cleanup queries
      const cleanupCalls = mockDatabase.prepare.mock.calls.filter(call =>
        call[0].includes('DELETE FROM')
      );
      expect(cleanupCalls.length).toBe(3);
    });

    it('should emit cleanup completed events', async () => {
      const cleanupListener = jest.fn();
      operationLogger.on('cleanup:completed', cleanupListener);

      mockStatement.run.mockReturnValue({ changes: 25 });

      await operationLogger.cleanupOldLogs(30);

      expect(cleanupListener).toHaveBeenCalledWith(75); // 25 * 3 tables
    });

    it('should use default retention period when not specified', async () => {
      mockStatement.run.mockReturnValue({ changes: 10 });

      await operationLogger.cleanupOldLogs(); // No parameter

      // Should use default 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const prepareCall = mockDatabase.prepare.mock.calls.find(call =>
        call[0].includes('DELETE FROM operation_logs')
      );
      expect(prepareCall).toBeDefined();
    });
  });

  describe('Health Check and Service Stats', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should provide comprehensive health check', async () => {
      // Mock today's operations count
      mockStatement.get.mockReturnValue({ count: 25 });

      const health = await operationLogger.healthCheck();

      expect(health).toMatchObject({
        healthy: true,
        responseTime: expect.any(Number),
        lastCheck: expect.any(Date),
        details: expect.objectContaining({
          status: 'running',
          uptime: expect.any(Number),
          cacheSize: expect.any(Number),
          operationsToday: 25
        })
      });
    });

    it('should report unhealthy when database is unavailable', async () => {
      // Shutdown to remove database reference
      await operationLogger.shutdown();

      const health = await operationLogger.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Database connection not available');
    });

    it('should provide service metrics', async () => {
      const metrics = operationLogger.getMetrics();

      expect(metrics).toMatchObject({
        operationsCount: expect.any(Number),
        averageResponseTime: expect.any(Number),
        errorRate: expect.any(Number),
        uptime: expect.any(Number),
        memoryUsage: expect.any(Number),
        cacheHitRate: expect.any(Number)
      });
    });

    it('should reset metrics when requested', () => {
      operationLogger.resetMetrics();

      const metrics = operationLogger.getMetrics();
      expect(metrics.operationsCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await operationLogger.initialize(mockContext);
    });

    it('should handle database errors during operation logging', async () => {
      mockStatement.run.mockImplementation(() => {
        throw new Error('Database write failed');
      });

      const operation = {
        type: 'semantic_search',
        query: 'Test query',
        status: 'completed',
        startTime: new Date()
      };

      await expect(operationLogger.logOperation(operation))
        .rejects.toThrow('Database write failed');
    });

    it('should handle query errors gracefully', async () => {
      mockStatement.all.mockImplementation(() => {
        throw new Error('Query execution failed');
      });

      await expect(operationLogger.getOperationHistory())
        .rejects.toThrow('Query execution failed');
    });

    it('should handle export errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('File write failed'));

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      jest.spyOn(operationLogger, 'getOperationHistory').mockResolvedValue([]);

      await expect(operationLogger.exportLogs('csv', period))
        .rejects.toThrow('File write failed');
    });
  });

  describe('Service Lifecycle', () => {
    it('should shutdown gracefully', async () => {
      await operationLogger.initialize(mockContext);
      await operationLogger.shutdown();

      expect(mockContext.logger.info).toHaveBeenCalledWith('Shutting down Operation Logger Service...');
      expect(mockContext.logger.info).toHaveBeenCalledWith('Operation Logger Service shut down successfully');
      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      await operationLogger.initialize(mockContext);

      mockDatabase.close.mockImplementation(() => {
        throw new Error('Database close failed');
      });

      await expect(operationLogger.shutdown())
        .rejects.toThrow('Database close failed');
    });
  });
});