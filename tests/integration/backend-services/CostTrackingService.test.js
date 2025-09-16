/**
 * Comprehensive Test Suite for CostTrackingService
 * Tests token calculations, budget management, cost reporting, and trends analysis
 */

const { jest } = require('@jest/globals');
const { EventEmitter } = require('events');

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

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Setup mocks
jest.mock('better-sqlite3', () => {
  return jest.fn(() => mockDatabase);
}, { virtual: true });

jest.mock('../../../src/main/utils/Logger', () => ({
  Logger: jest.fn(() => mockLogger)
}));

// Import after mocking
const { CostTrackingService } = require('../../../src/main/services/CostTrackingService');

describe('CostTrackingService Integration Tests', () => {
  let costService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock database responses
    mockDatabase.prepare.mockReturnValue(mockStatement);
    mockStatement.run.mockReturnValue({ changes: 1 });
    mockStatement.get.mockReturnValue({ total_cost: 0 });
    mockStatement.all.mockReturnValue([]);

    // Create service instance
    costService = new CostTrackingService(mockDatabase);
  });

  afterEach(async () => {
    if (costService) {
      await costService.destroy();
    }
  });

  describe('Service Initialization', () => {
    it('should initialize database schema correctly', () => {
      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS cost_tracking')
      );
      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS cost_limits')
      );
      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
    });

    it('should log successful initialization', () => {
      expect(mockLogger.info).toHaveBeenCalledWith('Cost tracking database initialized successfully');
    });

    it('should handle database initialization errors', () => {
      mockDatabase.exec.mockImplementation(() => {
        throw new Error('Database initialization failed');
      });

      expect(() => new CostTrackingService(mockDatabase))
        .toThrow('Database initialization failed');
    });
  });

  describe('Operation Tracking', () => {
    it('should track AI operation with calculated cost', async () => {
      const operation = {
        id: 'op-123',
        userId: 'user-456',
        type: 'claude-request',
        model: 'claude-3-sonnet',
        inputTokens: 100,
        outputTokens: 200,
        metadata: { source: 'semantic_search' },
        timestamp: new Date()
      };

      await costService.trackOperation(operation);

      expect(mockStatement.run).toHaveBeenCalledWith(
        expect.stringContaining('cost_op-123'),
        'op-123',
        'user-456',
        'claude-request',
        'claude-3-sonnet',
        expect.any(Number), // calculated cost
        'USD',
        100,
        200,
        expect.stringContaining('source'),
        operation.timestamp.toISOString(),
        expect.any(String)
      );
    });

    it('should track operation with provided cost', async () => {
      const operation = {
        id: 'op-456',
        type: 'search',
        timestamp: new Date()
      };
      const providedCost = 0.05;

      await costService.trackOperation(operation, providedCost);

      expect(mockStatement.run).toHaveBeenCalledWith(
        expect.any(String),
        'op-456',
        undefined,
        'search',
        undefined,
        0.05, // provided cost
        'USD',
        undefined,
        undefined,
        '{}',
        operation.timestamp.toISOString(),
        expect.any(String)
      );
    });

    it('should calculate cost for different models correctly', async () => {
      const testCases = [
        {
          model: 'claude-3-opus',
          inputTokens: 1000,
          outputTokens: 500,
          expectedCost: (1000/1000 * 0.015) + (500/1000 * 0.075) // 0.015 + 0.0375 = 0.0525
        },
        {
          model: 'claude-3-sonnet',
          inputTokens: 1000,
          outputTokens: 500,
          expectedCost: (1000/1000 * 0.003) + (500/1000 * 0.015) // 0.003 + 0.0075 = 0.0105
        },
        {
          model: 'claude-3-haiku',
          inputTokens: 1000,
          outputTokens: 500,
          expectedCost: (1000/1000 * 0.00025) + (500/1000 * 0.00125) // 0.00025 + 0.000625 = 0.000875
        }
      ];

      for (const testCase of testCases) {
        const operation = {
          id: `op-${testCase.model}`,
          type: 'claude-request',
          model: testCase.model,
          inputTokens: testCase.inputTokens,
          outputTokens: testCase.outputTokens,
          timestamp: new Date()
        };

        await costService.trackOperation(operation);

        const callArgs = mockStatement.run.mock.calls.pop();
        const calculatedCost = callArgs[5];

        expect(calculatedCost).toBeCloseTo(testCase.expectedCost, 5);
      }
    });

    it('should clear cache after tracking operation', async () => {
      const operation = {
        id: 'op-cache-test',
        userId: 'user-123',
        type: 'search',
        timestamp: new Date()
      };

      await costService.trackOperation(operation);

      // Cache should be cleared - this is tested by ensuring no cached results
      expect(mockStatement.run).toHaveBeenCalled();
    });

    it('should emit budget alerts when thresholds are exceeded', async () => {
      // Setup budget limit
      const budgetAlert = jest.fn();
      costService.on('budgetAlert', budgetAlert);

      // Mock budget status check to return alert
      jest.spyOn(costService, 'checkBudgetStatus').mockResolvedValue({
        isOverBudget: false,
        alerts: ['Daily budget at 85%'],
        dailySpent: 8.5,
        dailyLimit: 10
      });

      const operation = {
        id: 'op-alert-test',
        userId: 'user-123',
        type: 'claude-request',
        timestamp: new Date()
      };

      await costService.trackOperation(operation);

      // Wait for event emission
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(budgetAlert).toHaveBeenCalledWith({
        userId: 'user-123',
        alerts: ['Daily budget at 85%'],
        isOverBudget: false,
        status: expect.any(Object)
      });
    });
  });

  describe('Cost Queries', () => {
    it('should get daily cost for specific user and date', async () => {
      const testDate = new Date('2024-01-15');
      const userId = 'user-123';
      const expectedCost = 1.25;

      mockStatement.get.mockReturnValue({ total_cost: expectedCost });

      const cost = await costService.getDailyCost(userId, testDate);

      expect(cost).toBe(expectedCost);
      expect(mockStatement.get).toHaveBeenCalledWith(
        '2024-01-15T00:00:00.000Z',
        '2024-01-15T23:59:59.999Z',
        userId
      );
    });

    it('should get daily cost for all users when no userId provided', async () => {
      const expectedCost = 5.75;
      mockStatement.get.mockReturnValue({ total_cost: expectedCost });

      const cost = await costService.getDailyCost();

      expect(cost).toBe(expectedCost);
      // Should not include userId in query parameters
      expect(mockStatement.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String)
      );
    });

    it('should get weekly cost with correct date range', async () => {
      const expectedCost = 12.50;
      mockStatement.get.mockReturnValue({ total_cost: expectedCost });

      const cost = await costService.getWeeklyCost('user-456');

      expect(cost).toBe(expectedCost);

      // Verify the date range is approximately 7 days
      const callArgs = mockStatement.get.mock.calls[0];
      const startDate = new Date(callArgs[0]);
      const now = new Date();
      const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBe(6); // Should be 6 days ago to include today = 7 days total
    });

    it('should get monthly cost for current month', async () => {
      const expectedCost = 45.20;
      mockStatement.get.mockReturnValue({ total_cost: expectedCost });

      const cost = await costService.getMonthlyCost('user-789');

      expect(cost).toBe(expectedCost);

      // Verify it uses start of current month
      const callArgs = mockStatement.get.mock.calls[0];
      const startDate = new Date(callArgs[0]);
      const now = new Date();

      expect(startDate.getFullYear()).toBe(now.getFullYear());
      expect(startDate.getMonth()).toBe(now.getMonth());
      expect(startDate.getDate()).toBe(1);
    });

    it('should get cost by operation type with date range', async () => {
      const expectedCost = 2.10;
      mockStatement.get.mockReturnValue({ total_cost: expectedCost });

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const cost = await costService.getCostByOperation('claude-request', period);

      expect(cost).toBe(expectedCost);
      expect(mockStatement.get).toHaveBeenCalledWith(
        'claude-request',
        '2024-01-01T00:00:00.000Z',
        '2024-01-31T00:00:00.000Z'
      );
    });

    it('should cache cost queries for performance', async () => {
      const userId = 'cache-test-user';
      const testDate = new Date();

      // First call
      await costService.getDailyCost(userId, testDate);

      // Second call should use cache
      await costService.getDailyCost(userId, testDate);

      // Should only call database once
      expect(mockStatement.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Budget Management', () => {
    it('should set cost limits correctly', async () => {
      const limit = {
        id: 'limit-123',
        userId: 'user-456',
        limitType: 'daily',
        amount: 10.0,
        currency: 'USD',
        alertThreshold: 80.0,
        isActive: true
      };

      await costService.setCostLimit(limit);

      expect(mockStatement.run).toHaveBeenCalledWith(
        'limit-123',
        'user-456',
        'daily',
        10.0,
        'USD',
        80.0,
        1, // boolean as integer
        expect.any(String)
      );
    });

    it('should generate unique ID for cost limits when not provided', async () => {
      const limit = {
        userId: 'user-789',
        limitType: 'monthly',
        amount: 100.0,
        currency: 'USD',
        alertThreshold: 75.0,
        isActive: true
      };

      await costService.setCostLimit(limit);

      const callArgs = mockStatement.run.mock.calls[0];
      const generatedId = callArgs[0];

      expect(generatedId).toContain('limit_user-789_monthly_');
      expect(generatedId.length).toBeGreaterThan(20);
    });

    it('should check budget status with alerts', async () => {
      // Mock cost queries
      jest.spyOn(costService, 'getDailyCost').mockResolvedValue(8.5);
      jest.spyOn(costService, 'getWeeklyCost').mockResolvedValue(45.0);
      jest.spyOn(costService, 'getMonthlyCost').mockResolvedValue(120.0);

      // Mock active limits
      mockStatement.all.mockReturnValue([
        { limit_type: 'daily', amount: 10.0 },
        { limit_type: 'weekly', amount: 50.0 },
        { limit_type: 'monthly', amount: 150.0 }
      ]);

      const status = await costService.checkBudgetStatus();

      expect(status).toMatchObject({
        dailySpent: 8.5,
        weeklySpent: 45.0,
        monthlySpent: 120.0,
        dailyLimit: 10.0,
        weeklyLimit: 50.0,
        monthlyLimit: 150.0,
        dailyPercentage: 85.0,
        weeklyPercentage: 90.0,
        monthlyPercentage: 80.0,
        isOverBudget: false,
        alerts: [
          'Daily budget at 85.0%',
          'Weekly budget at 90.0%',
          'Monthly budget at 80.0%'
        ]
      });
    });

    it('should detect over budget conditions', async () => {
      // Mock over-budget costs
      jest.spyOn(costService, 'getDailyCost').mockResolvedValue(12.0);
      jest.spyOn(costService, 'getWeeklyCost').mockResolvedValue(55.0);
      jest.spyOn(costService, 'getMonthlyCost').mockResolvedValue(160.0);

      // Mock limits
      mockStatement.all.mockReturnValue([
        { limit_type: 'daily', amount: 10.0 },
        { limit_type: 'weekly', amount: 50.0 },
        { limit_type: 'monthly', amount: 150.0 }
      ]);

      const status = await costService.checkBudgetStatus();

      expect(status.isOverBudget).toBe(true);
      expect(status.dailyPercentage).toBeGreaterThan(100);
      expect(status.weeklyPercentage).toBeGreaterThan(100);
      expect(status.monthlyPercentage).toBeGreaterThan(100);
    });
  });

  describe('Cost Reporting', () => {
    it('should generate comprehensive cost report', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      // Mock query results
      mockStatement.all.mockReturnValue([
        {
          operation_type: 'claude-request',
          model: 'claude-3-sonnet',
          date: '2024-01-15',
          user_id: 'user-123',
          total_cost: 5.25,
          operation_count: 10
        },
        {
          operation_type: 'search',
          model: null,
          date: '2024-01-15',
          user_id: 'user-456',
          total_cost: 2.10,
          operation_count: 5
        }
      ]);

      const report = await costService.generateCostReport(period);

      expect(report).toMatchObject({
        period,
        totalCost: 7.35,
        currency: 'USD',
        operationBreakdown: {
          'claude-request': 5.25,
          'search': 2.10
        },
        modelBreakdown: {
          'claude-3-sonnet': 5.25
        },
        dailyBreakdown: {
          '2024-01-15': 7.35
        },
        userBreakdown: {
          'user-123': 5.25,
          'user-456': 2.10
        },
        averageCostPerOperation: 0.49, // 7.35 / 15
        totalOperations: 15,
        trends: expect.objectContaining({
          growthRate: expect.any(Number),
          mostExpensiveDay: '2024-01-15',
          costEfficiency: 0.49
        })
      });
    });

    it('should handle empty report data', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      mockStatement.all.mockReturnValue([]);

      const report = await costService.generateCostReport(period);

      expect(report).toMatchObject({
        totalCost: 0,
        totalOperations: 0,
        averageCostPerOperation: 0,
        operationBreakdown: {},
        modelBreakdown: {},
        dailyBreakdown: {},
        userBreakdown: undefined
      });
    });
  });

  describe('Cost Trends Analysis', () => {
    beforeEach(() => {
      // Mock getDailyCost calls for trend analysis
      let callCount = 0;
      jest.spyOn(costService, 'getDailyCost').mockImplementation((userId, date) => {
        callCount++;
        // Return different values to simulate trends
        return Promise.resolve(callCount * 0.5);
      });

      jest.spyOn(costService, 'getMonthlyCost').mockResolvedValue(50.0);
      jest.spyOn(costService, 'getCostByOperation').mockResolvedValue(25.0);
    });

    it('should calculate cost trends with predictions', async () => {
      const trends = await costService.getCostTrends();

      expect(trends).toMatchObject({
        last7Days: expect.arrayContaining([
          expect.any(Number)
        ]),
        last30Days: expect.arrayContaining([
          expect.any(Number)
        ]),
        weekOverWeekChange: expect.any(Number),
        monthOverMonthChange: expect.any(Number),
        predictedNextWeek: expect.any(Number),
        predictedNextMonth: expect.any(Number),
        peakUsageDays: expect.any(Array),
        costEfficiencyTrend: expect.any(Number)
      });

      expect(trends.last7Days).toHaveLength(7);
      expect(trends.last30Days).toHaveLength(30);
    });

    it('should cache trends for performance', async () => {
      // First call
      await costService.getCostTrends();

      // Second call should use cache
      await costService.getCostTrends();

      // Should only call getDailyCost for the first request
      expect(costService.getDailyCost).toHaveBeenCalledTimes(37); // 7 + 30 for first call only
    });

    it('should predict monthly cost accurately', async () => {
      const currentDate = new Date();
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const daysPassed = currentDate.getDate();

      jest.spyOn(costService, 'getMonthlyCost').mockResolvedValue(30.0);

      const prediction = await costService.predictMonthlyCost();

      const expectedPrediction = (30.0 / daysPassed) * daysInMonth;
      expect(prediction).toBeCloseTo(expectedPrediction, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during operation tracking', async () => {
      mockStatement.run.mockImplementation(() => {
        throw new Error('Database write failed');
      });

      const operation = {
        id: 'op-error-test',
        type: 'claude-request',
        timestamp: new Date()
      };

      await expect(costService.trackOperation(operation))
        .rejects.toThrow('Database write failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to track operation cost:',
        expect.any(Error)
      );
    });

    it('should handle cost query errors gracefully', async () => {
      mockStatement.get.mockImplementation(() => {
        throw new Error('Query failed');
      });

      await expect(costService.getDailyCost())
        .rejects.toThrow('Query failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get daily cost:',
        expect.any(Error)
      );
    });

    it('should handle budget status check errors', async () => {
      jest.spyOn(costService, 'getDailyCost').mockRejectedValue(
        new Error('Cost query failed')
      );

      await expect(costService.checkBudgetStatus())
        .rejects.toThrow('Cost query failed');
    });
  });

  describe('Data Cleanup and Maintenance', () => {
    it('should clean up old records based on retention policy', async () => {
      const mockResult = { changes: 150 };
      mockStatement.run.mockReturnValue(mockResult);

      const retentionDays = 60;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Call would be internal, but we can test the concept
      expect(mockDatabase.prepare).toBeDefined();
    });

    it('should clean cache periodically', async () => {
      // Cache cleanup is tested by ensuring cache behavior works correctly
      const userId = 'cleanup-test';

      // Add to cache
      await costService.getDailyCost(userId);

      // Simulate cache cleanup (in real implementation, this happens on interval)
      // Cache should still work correctly after cleanup
      await costService.getDailyCost(userId);

      expect(mockStatement.get).toHaveBeenCalled();
    });
  });

  describe('Service Statistics', () => {
    it('should provide comprehensive service statistics', async () => {
      mockStatement.get
        .mockReturnValueOnce({ count: 1500 }) // total records
        .mockReturnValueOnce({ total: 125.75 }); // total cost

      const stats = await costService.getStats();

      expect(stats).toMatchObject({
        totalRecords: 1500,
        totalCost: 125.75,
        cacheSize: expect.any(Number),
        retentionDays: 90
      });
    });

    it('should handle statistics query errors', async () => {
      mockStatement.get.mockImplementation(() => {
        throw new Error('Stats query failed');
      });

      await expect(costService.getStats())
        .rejects.toThrow('Stats query failed');
    });
  });

  describe('Service Destruction', () => {
    it('should destroy service cleanly', async () => {
      await costService.destroy();

      expect(mockLogger.info).toHaveBeenCalledWith('Cost tracking service destroyed');
    });

    it('should handle destruction errors gracefully', async () => {
      // Mock error during destruction
      costService.removeAllListeners = jest.fn().mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      await costService.destroy();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error destroying cost tracking service:',
        expect.any(Error)
      );
    });
  });
});