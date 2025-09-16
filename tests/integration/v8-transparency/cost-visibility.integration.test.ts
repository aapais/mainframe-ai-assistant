/**
 * Cost Visibility Integration Tests - v8 Transparency Feature
 * Tests real-time cost calculation, display, and budget management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CostVisibilityDashboard } from '../../../src/components/transparency/CostVisibilityDashboard';
import { CostCalculationService } from '../../../src/services/transparency/CostCalculationService';
import { BudgetManager } from '../../../src/services/transparency/BudgetManager';
import { CostAlert, CostMetrics, BudgetConfig } from '../../../src/types/transparency';

interface CostTestScenario {
  description: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  expectedCost: number;
  expectedCostDisplay: string;
  budgetImpact: number;
}

const costTestScenarios: CostTestScenario[] = [
  {
    description: 'Small query with Gemini Pro',
    operation: 'simple_search',
    inputTokens: 50,
    outputTokens: 100,
    model: 'gemini-pro',
    expectedCost: 0.0015,
    expectedCostDisplay: '$0.002',
    budgetImpact: 0.0015
  },
  {
    description: 'Medium complexity analysis',
    operation: 'semantic_analysis',
    inputTokens: 500,
    outputTokens: 300,
    model: 'gemini-pro',
    expectedCost: 0.008,
    expectedCostDisplay: '$0.008',
    budgetImpact: 0.008
  },
  {
    description: 'Large document processing',
    operation: 'document_analysis',
    inputTokens: 5000,
    outputTokens: 1000,
    model: 'gemini-pro',
    expectedCost: 0.06,
    expectedCostDisplay: '$0.06',
    budgetImpact: 0.06
  },
  {
    description: 'Vision model usage',
    operation: 'image_analysis',
    inputTokens: 1000,
    outputTokens: 500,
    model: 'gemini-pro-vision',
    expectedCost: 0.025,
    expectedCostDisplay: '$0.025',
    budgetImpact: 0.025
  }
];

describe('Cost Visibility - v8 Transparency Integration', () => {
  let costService: CostCalculationService;
  let budgetManager: BudgetManager;
  let mockBudgetConfig: BudgetConfig;

  beforeEach(() => {
    // Initialize cost calculation service
    costService = new CostCalculationService({
      modelPricing: {
        'gemini-pro': { inputTokenPrice: 0.00001, outputTokenPrice: 0.00003 },
        'gemini-pro-vision': { inputTokenPrice: 0.00002, outputTokenPrice: 0.00006 }
      },
      currencyFormatter: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 3
      })
    });

    // Initialize budget manager
    mockBudgetConfig = {
      dailyBudget: 10.0,
      monthlyBudget: 200.0,
      alertThresholds: {
        warning: 0.8,
        critical: 0.95
      },
      autoStop: false,
      departmentCode: 'TEST_DEPT'
    };

    budgetManager = new BudgetManager(mockBudgetConfig);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Real-time Cost Calculation', () => {
    costTestScenarios.forEach((scenario) => {
      it(scenario.description, async () => {
        const operationId = `cost-test-${Date.now()}`;

        // Calculate cost for the scenario
        const cost = await costService.calculateCost({
          operationId,
          operation: scenario.operation,
          inputTokens: scenario.inputTokens,
          outputTokens: scenario.outputTokens,
          model: scenario.model
        });

        // Verify cost calculation accuracy
        expect(cost.totalCost).toBeCloseTo(scenario.expectedCost, 3);
        expect(cost.formattedCost).toBe(scenario.expectedCostDisplay);
        expect(cost.breakdown.inputCost + cost.breakdown.outputCost).toBeCloseTo(scenario.expectedCost, 3);

        // Verify cost components
        const expectedInputCost = scenario.inputTokens * (scenario.model === 'gemini-pro' ? 0.00001 : 0.00002);
        const expectedOutputCost = scenario.outputTokens * (scenario.model === 'gemini-pro' ? 0.00003 : 0.00006);

        expect(cost.breakdown.inputCost).toBeCloseTo(expectedInputCost, 6);
        expect(cost.breakdown.outputCost).toBeCloseTo(expectedOutputCost, 6);
      });
    });

    it('should calculate costs for batch operations', async () => {
      const batchOperations = costTestScenarios.map((scenario, index) => ({
        operationId: `batch-${index}`,
        operation: scenario.operation,
        inputTokens: scenario.inputTokens,
        outputTokens: scenario.outputTokens,
        model: scenario.model
      }));

      const batchCosts = await costService.calculateBatchCosts(batchOperations);

      expect(batchCosts).toHaveLength(costTestScenarios.length);

      // Verify total batch cost
      const expectedTotal = costTestScenarios.reduce((sum, scenario) => sum + scenario.expectedCost, 0);
      const actualTotal = batchCosts.reduce((sum, cost) => sum + cost.totalCost, 0);

      expect(actualTotal).toBeCloseTo(expectedTotal, 3);
    });

    it('should handle cost estimation for pending operations', async () => {
      const pendingOperation = {
        operation: 'estimate_test',
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
        model: 'gemini-pro'
      };

      const estimation = await costService.estimateCost(pendingOperation);

      expect(estimation.estimatedCost).toBeCloseTo(0.025, 3);
      expect(estimation.confidence).toBeGreaterThan(0.8);
      expect(estimation.range.min).toBeLessThan(estimation.estimatedCost);
      expect(estimation.range.max).toBeGreaterThan(estimation.estimatedCost);
    });
  });

  describe('Budget Management and Tracking', () => {
    it('should track daily budget consumption', async () => {
      const operations = costTestScenarios.slice(0, 2); // Use first 2 scenarios

      for (const scenario of operations) {
        await budgetManager.recordCost({
          operationId: `budget-test-${Date.now()}`,
          cost: scenario.expectedCost,
          operation: scenario.operation,
          timestamp: new Date()
        });
      }

      const dailyUsage = await budgetManager.getDailyUsage();
      const expectedDailyTotal = operations.reduce((sum, scenario) => sum + scenario.expectedCost, 0);

      expect(dailyUsage.totalCost).toBeCloseTo(expectedDailyTotal, 3);
      expect(dailyUsage.remainingBudget).toBeCloseTo(mockBudgetConfig.dailyBudget - expectedDailyTotal, 3);
      expect(dailyUsage.percentageUsed).toBeCloseTo((expectedDailyTotal / mockBudgetConfig.dailyBudget) * 100, 2);
    });

    it('should generate budget alerts at configured thresholds', async () => {
      // Record costs to reach warning threshold (80% of daily budget)
      const warningCost = mockBudgetConfig.dailyBudget * 0.8;

      await budgetManager.recordCost({
        operationId: 'warning-test',
        cost: warningCost,
        operation: 'large_operation',
        timestamp: new Date()
      });

      const alerts = await budgetManager.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('warning');
      expect(alerts[0].threshold).toBe(0.8);

      // Record additional cost to reach critical threshold (95% of daily budget)
      const criticalCost = mockBudgetConfig.dailyBudget * 0.15;

      await budgetManager.recordCost({
        operationId: 'critical-test',
        cost: criticalCost,
        operation: 'another_operation',
        timestamp: new Date()
      });

      const updatedAlerts = await budgetManager.getActiveAlerts();
      expect(updatedAlerts).toHaveLength(2);
      expect(updatedAlerts.some(alert => alert.type === 'critical')).toBeTruthy();
    });

    it('should handle budget overruns and auto-stop functionality', async () => {
      // Configure auto-stop
      budgetManager.updateConfig({ ...mockBudgetConfig, autoStop: true });

      // Attempt to record cost that exceeds daily budget
      const excessiveCost = mockBudgetConfig.dailyBudget * 1.1;

      const result = await budgetManager.recordCost({
        operationId: 'overage-test',
        cost: excessiveCost,
        operation: 'expensive_operation',
        timestamp: new Date()
      });

      expect(result.allowed).toBeFalsy();
      expect(result.reason).toBe('budget_exceeded');
      expect(result.autoStopped).toBeTruthy();

      // Verify budget enforcement
      const dailyUsage = await budgetManager.getDailyUsage();
      expect(dailyUsage.totalCost).toBeLessThanOrEqual(mockBudgetConfig.dailyBudget);
    });
  });

  describe('Cost Visibility Dashboard', () => {
    it('should display real-time cost metrics', async () => {
      // Setup test data
      const testCosts = costTestScenarios.slice(0, 3);
      const metrics: CostMetrics = {
        today: {
          totalCost: testCosts.reduce((sum, scenario) => sum + scenario.expectedCost, 0),
          operationCount: testCosts.length,
          averageCostPerOperation: testCosts.reduce((sum, scenario) => sum + scenario.expectedCost, 0) / testCosts.length
        },
        thisWeek: {
          totalCost: 0.5,
          operationCount: 25,
          averageCostPerOperation: 0.02
        },
        thisMonth: {
          totalCost: 15.0,
          operationCount: 150,
          averageCostPerOperation: 0.10
        }
      };

      render(
        <CostVisibilityDashboard
          metrics={metrics}
          budgetConfig={mockBudgetConfig}
          realTimeUpdates={true}
        />
      );

      // Verify metrics display
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText(`$${metrics.today.totalCost.toFixed(3)}`)).toBeInTheDocument();
      expect(screen.getByText(`${metrics.today.operationCount} operations`)).toBeInTheDocument();

      // Verify budget information
      expect(screen.getByText(`Daily Budget: $${mockBudgetConfig.dailyBudget.toFixed(2)}`)).toBeInTheDocument();
      expect(screen.getByText(`Monthly Budget: $${mockBudgetConfig.monthlyBudget.toFixed(2)}`)).toBeInTheDocument();

      // Verify progress indicators
      const dailyProgress = screen.getByTestId('daily-budget-progress');
      const monthlyProgress = screen.getByTestId('monthly-budget-progress');

      expect(dailyProgress).toBeInTheDocument();
      expect(monthlyProgress).toBeInTheDocument();
    });

    it('should update costs in real-time', async () => {
      const initialMetrics: CostMetrics = {
        today: { totalCost: 0.1, operationCount: 5, averageCostPerOperation: 0.02 },
        thisWeek: { totalCost: 0.5, operationCount: 25, averageCostPerOperation: 0.02 },
        thisMonth: { totalCost: 2.0, operationCount: 100, averageCostPerOperation: 0.02 }
      };

      const { rerender } = render(
        <CostVisibilityDashboard
          metrics={initialMetrics}
          budgetConfig={mockBudgetConfig}
          realTimeUpdates={true}
        />
      );

      expect(screen.getByText('$0.100')).toBeInTheDocument();

      // Simulate real-time update
      const updatedMetrics: CostMetrics = {
        today: { totalCost: 0.15, operationCount: 6, averageCostPerOperation: 0.025 },
        thisWeek: { totalCost: 0.55, operationCount: 26, averageCostPerOperation: 0.021 },
        thisMonth: { totalCost: 2.05, operationCount: 101, averageCostPerOperation: 0.020 }
      };

      rerender(
        <CostVisibilityDashboard
          metrics={updatedMetrics}
          budgetConfig={mockBudgetConfig}
          realTimeUpdates={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('$0.150')).toBeInTheDocument();
        expect(screen.getByText('6 operations')).toBeInTheDocument();
      });
    });

    it('should display cost breakdown by operation type', async () => {
      const operationBreakdown = [
        { operation: 'search', totalCost: 0.05, count: 10, percentage: 25 },
        { operation: 'analysis', totalCost: 0.10, count: 5, percentage: 50 },
        { operation: 'generation', totalCost: 0.05, count: 2, percentage: 25 }
      ];

      render(
        <CostVisibilityDashboard
          metrics={{} as CostMetrics}
          budgetConfig={mockBudgetConfig}
          operationBreakdown={operationBreakdown}
          showBreakdown={true}
        />
      );

      // Verify breakdown is displayed
      expect(screen.getByText('Cost Breakdown')).toBeInTheDocument();

      operationBreakdown.forEach(item => {
        expect(screen.getByText(item.operation)).toBeInTheDocument();
        expect(screen.getByText(`$${item.totalCost.toFixed(3)}`)).toBeInTheDocument();
        expect(screen.getByText(`${item.count} ops`)).toBeInTheDocument();
        expect(screen.getByText(`${item.percentage}%`)).toBeInTheDocument();
      });
    });

    it('should export cost reports in multiple formats', async () => {
      const mockExportService = {
        exportCostReport: jest.fn()
      };

      render(
        <CostVisibilityDashboard
          metrics={{} as CostMetrics}
          budgetConfig={mockBudgetConfig}
          exportService={mockExportService}
          enableExport={true}
        />
      );

      // Test CSV export
      const exportButton = screen.getByRole('button', { name: /export/i });
      await userEvent.click(exportButton);

      const csvOption = screen.getByRole('menuitem', { name: /csv/i });
      await userEvent.click(csvOption);

      expect(mockExportService.exportCostReport).toHaveBeenCalledWith('csv', expect.any(Object));

      // Test PDF export
      await userEvent.click(exportButton);
      const pdfOption = screen.getByRole('menuitem', { name: /pdf/i });
      await userEvent.click(pdfOption);

      expect(mockExportService.exportCostReport).toHaveBeenCalledWith('pdf', expect.any(Object));
    });
  });

  describe('Performance and Accuracy', () => {
    it('should calculate costs within 50ms performance threshold', async () => {
      const operationsCount = 100;
      const startTime = performance.now();

      const calculations = Array.from({ length: operationsCount }, async (_, i) => {
        return costService.calculateCost({
          operationId: `perf-${i}`,
          operation: 'performance_test',
          inputTokens: 100,
          outputTokens: 50,
          model: 'gemini-pro'
        });
      });

      await Promise.all(calculations);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete 100 cost calculations in less than 50ms
      expect(totalTime).toBeLessThan(50);
    });

    it('should maintain cost calculation accuracy across currency conversions', async () => {
      const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
      const eurFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

      const costServiceEUR = new CostCalculationService({
        modelPricing: {
          'gemini-pro': { inputTokenPrice: 0.00001, outputTokenPrice: 0.00003 }
        },
        currencyFormatter: eurFormatter,
        exchangeRate: 0.85 // USD to EUR
      });

      const operation = {
        operationId: 'currency-test',
        operation: 'currency_conversion',
        inputTokens: 1000,
        outputTokens: 500,
        model: 'gemini-pro'
      };

      const usdCost = await costService.calculateCost(operation);
      const eurCost = await costServiceEUR.calculateCost(operation);

      // Verify currency conversion accuracy
      const expectedEURCost = usdCost.totalCost * 0.85;
      expect(eurCost.totalCost).toBeCloseTo(expectedEURCost, 4);
    });
  });

  describe('Security and Compliance', () => {
    it('should audit all cost-related operations', async () => {
      const auditLogger = {
        logCostOperation: jest.fn()
      };

      const auditingCostService = new CostCalculationService({
        modelPricing: {
          'gemini-pro': { inputTokenPrice: 0.00001, outputTokenPrice: 0.00003 }
        },
        auditLogger
      });

      await auditingCostService.calculateCost({
        operationId: 'audit-test',
        operation: 'audit_operation',
        inputTokens: 100,
        outputTokens: 50,
        model: 'gemini-pro',
        userId: 'test-user-123'
      });

      expect(auditLogger.logCostOperation).toHaveBeenCalledWith({
        operationId: 'audit-test',
        operation: 'audit_operation',
        cost: expect.any(Number),
        userId: 'test-user-123',
        timestamp: expect.any(Date)
      });
    });

    it('should protect sensitive cost data in exports', async () => {
      const costData = {
        operations: [
          { id: 'op1', cost: 0.05, userId: 'user123', department: 'secret-dept' },
          { id: 'op2', cost: 0.10, userId: 'user456', department: 'public-dept' }
        ]
      };

      const sanitizedExport = costService.sanitizeExportData(costData, {
        excludeFields: ['userId', 'department'],
        anonymizeUsers: true
      });

      expect(sanitizedExport.operations[0]).not.toHaveProperty('userId');
      expect(sanitizedExport.operations[0]).not.toHaveProperty('department');
      expect(sanitizedExport.operations[0].cost).toBe(0.05); // Cost data preserved
    });
  });
});

/**
 * Test Coverage Summary for Cost Visibility:
 *
 * ✅ Real-time cost calculation accuracy
 * ✅ Multi-model cost calculations
 * ✅ Batch operation cost processing
 * ✅ Cost estimation for pending operations
 * ✅ Budget tracking and management
 * ✅ Budget alerts and thresholds
 * ✅ Auto-stop functionality
 * ✅ Dashboard real-time updates
 * ✅ Cost breakdown by operation type
 * ✅ Export functionality (CSV, PDF)
 * ✅ Performance requirements (<50ms)
 * ✅ Currency conversion accuracy
 * ✅ Audit logging for compliance
 * ✅ Data sanitization for security
 *
 * Coverage Target: 95%+ for transparency features
 * Performance Target: <50ms per cost calculation
 * Accuracy Target: 99.9% cost calculation accuracy
 */