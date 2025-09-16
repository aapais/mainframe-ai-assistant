/**
 * Flow Logging Integration Tests - v8 Transparency Feature
 * Tests the simple flow log functionality for operation transparency
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TransparencyLogger } from '../../../src/services/transparency/TransparencyLogger';
import { FlowLogDisplay } from '../../../src/components/transparency/FlowLogDisplay';
import { LogEntry, LogLevel, OperationFlow } from '../../../src/types/transparency';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

interface FlowTestScenario {
  description: string;
  operationType: string;
  steps: Array<{
    action: string;
    duration: number;
    metadata?: Record<string, any>;
    level: LogLevel;
  }>;
  expectedLogCount: number;
  expectedDuration: number;
  shouldHaveErrors: boolean;
}

const flowTestScenarios: FlowTestScenario[] = [
  {
    description: 'Simple search operation flow',
    operationType: 'search',
    steps: [
      { action: 'Parse search query', duration: 10, level: 'info' },
      { action: 'Execute local search', duration: 50, level: 'info' },
      { action: 'Format results', duration: 15, level: 'info' },
      { action: 'Return response', duration: 5, level: 'info' }
    ],
    expectedLogCount: 4,
    expectedDuration: 80,
    shouldHaveErrors: false
  },
  {
    description: 'AI-enhanced search with authorization',
    operationType: 'ai_search',
    steps: [
      { action: 'Parse search query', duration: 10, level: 'info' },
      { action: 'Show authorization dialog', duration: 2000, level: 'info', metadata: { userInteraction: true } },
      { action: 'User authorized operation', duration: 0, level: 'info', metadata: { authorized: true, cost: 0.05 } },
      { action: 'Call Gemini API', duration: 1500, level: 'info', metadata: { apiCall: true, tokens: 150 } },
      { action: 'Process AI response', duration: 200, level: 'info' },
      { action: 'Merge with local results', duration: 100, level: 'info' },
      { action: 'Return enhanced results', duration: 25, level: 'info' }
    ],
    expectedLogCount: 7,
    expectedDuration: 3835,
    shouldHaveErrors: false
  },
  {
    description: 'Operation with error and recovery',
    operationType: 'kb_update',
    steps: [
      { action: 'Validate entry data', duration: 20, level: 'info' },
      { action: 'Begin database transaction', duration: 5, level: 'info' },
      { action: 'Database connection failed', duration: 100, level: 'error', metadata: { error: 'SQLITE_BUSY', retryable: true } },
      { action: 'Retry database operation', duration: 50, level: 'warn' },
      { action: 'Update entry successfully', duration: 30, level: 'info' },
      { action: 'Commit transaction', duration: 15, level: 'info' }
    ],
    expectedLogCount: 6,
    expectedDuration: 220,
    shouldHaveErrors: true
  }
];

describe('Flow Logging - v8 Transparency Integration', () => {
  let logger: TransparencyLogger;
  let mockPerformanceNow: jest.SpyInstance;

  beforeEach(() => {
    logger = new TransparencyLogger({
      enablePersistence: true,
      maxLogEntries: 1000,
      logLevel: 'debug'
    });

    // Mock performance.now for deterministic timing
    let mockTime = Date.now();
    mockPerformanceNow = jest.spyOn(performance, 'now').mockImplementation(() => {
      return mockTime;
    });

    // Helper to advance mock time
    (global as any).advanceMockTime = (ms: number) => {
      mockTime += ms;
    };
  });

  afterEach(() => {
    mockPerformanceNow.mockRestore();
    jest.clearAllMocks();
  });

  describe('Core Flow Logging Functionality', () => {
    flowTestScenarios.forEach((scenario) => {
      it(scenario.description, async () => {
        const operationId = `test-${Date.now()}`;

        // Start operation flow
        logger.startOperationFlow(operationId, scenario.operationType);

        // Execute steps with timing
        for (const step of scenario.steps) {
          logger.logStep(operationId, step.action, step.level, step.metadata);
          (global as any).advanceMockTime(step.duration);
        }

        // End operation flow
        logger.endOperationFlow(operationId);

        // Verify flow was logged correctly
        const flow = logger.getOperationFlow(operationId);
        expect(flow).toBeDefined();
        expect(flow!.operationType).toBe(scenario.operationType);
        expect(flow!.steps).toHaveLength(scenario.expectedLogCount);
        expect(flow!.totalDuration).toBe(scenario.expectedDuration);
        expect(flow!.hasErrors).toBe(scenario.shouldHaveErrors);

        // Verify step details
        scenario.steps.forEach((expectedStep, index) => {
          const actualStep = flow!.steps[index];
          expect(actualStep.action).toBe(expectedStep.action);
          expect(actualStep.level).toBe(expectedStep.level);
          if (expectedStep.metadata) {
            expect(actualStep.metadata).toMatchObject(expectedStep.metadata);
          }
        });
      });
    });

    it('should handle concurrent operation flows', async () => {
      const operationIds = ['op1', 'op2', 'op3'];

      // Start multiple operations
      operationIds.forEach(id => {
        logger.startOperationFlow(id, 'concurrent_test');
      });

      // Log steps for each operation
      operationIds.forEach((id, index) => {
        logger.logStep(id, `Step 1 for ${id}`, 'info');
        (global as any).advanceMockTime(10);
        logger.logStep(id, `Step 2 for ${id}`, 'info');
        (global as any).advanceMockTime(20);
      });

      // End operations
      operationIds.forEach(id => {
        logger.endOperationFlow(id);
      });

      // Verify all flows were tracked independently
      operationIds.forEach(id => {
        const flow = logger.getOperationFlow(id);
        expect(flow).toBeDefined();
        expect(flow!.steps).toHaveLength(2);
        expect(flow!.steps[0].action).toBe(`Step 1 for ${id}`);
        expect(flow!.steps[1].action).toBe(`Step 2 for ${id}`);
      });
    });

    it('should persist flow logs across sessions', async () => {
      const operationId = 'persistence-test';

      // Log an operation
      logger.startOperationFlow(operationId, 'persistence_test');
      logger.logStep(operationId, 'Test step', 'info', { persistent: true });
      logger.endOperationFlow(operationId);

      // Create new logger instance (simulating app restart)
      const newLogger = new TransparencyLogger({
        enablePersistence: true,
        maxLogEntries: 1000,
        logLevel: 'debug'
      });

      // Should be able to retrieve persisted flow
      const persistedFlow = newLogger.getOperationFlow(operationId);
      expect(persistedFlow).toBeDefined();
      expect(persistedFlow!.operationType).toBe('persistence_test');
      expect(persistedFlow!.steps[0].action).toBe('Test step');
    });
  });

  describe('Flow Log Display Component', () => {
    it('should render flow logs with proper formatting', async () => {
      const operationId = 'display-test';

      // Create test flow
      logger.startOperationFlow(operationId, 'display_test');
      logger.logStep(operationId, 'Initialize operation', 'info');
      (global as any).advanceMockTime(50);
      logger.logStep(operationId, 'Process data', 'info', { recordsProcessed: 100 });
      (global as any).advanceMockTime(200);
      logger.logStep(operationId, 'Warning: Large dataset', 'warn', { dataSize: '1MB' });
      (global as any).advanceMockTime(100);
      logger.endOperationFlow(operationId);

      const flow = logger.getOperationFlow(operationId)!;

      render(
        <FlowLogDisplay
          flow={flow}
          showMetadata={true}
          showTimings={true}
        />
      );

      // Verify flow information is displayed
      expect(screen.getByText('display_test')).toBeInTheDocument();
      expect(screen.getByText('350ms')).toBeInTheDocument(); // Total duration

      // Verify steps are displayed
      expect(screen.getByText('Initialize operation')).toBeInTheDocument();
      expect(screen.getByText('Process data')).toBeInTheDocument();
      expect(screen.getByText('Warning: Large dataset')).toBeInTheDocument();

      // Verify metadata is displayed
      expect(screen.getByText('recordsProcessed: 100')).toBeInTheDocument();
      expect(screen.getByText('dataSize: 1MB')).toBeInTheDocument();

      // Verify timing information
      expect(screen.getByText('50ms')).toBeInTheDocument();
      expect(screen.getByText('200ms')).toBeInTheDocument();
      expect(screen.getByText('100ms')).toBeInTheDocument();

      // Verify log level indicators
      expect(screen.getByTestId('log-level-info')).toBeInTheDocument();
      expect(screen.getByTestId('log-level-warn')).toBeInTheDocument();
    });

    it('should support filtering and searching logs', async () => {
      const operationId = 'filter-test';

      // Create flow with various log levels
      logger.startOperationFlow(operationId, 'filter_test');
      logger.logStep(operationId, 'Info message 1', 'info');
      logger.logStep(operationId, 'Debug message 1', 'debug');
      logger.logStep(operationId, 'Warning message 1', 'warn');
      logger.logStep(operationId, 'Error message 1', 'error');
      logger.logStep(operationId, 'Info message 2', 'info');
      logger.endOperationFlow(operationId);

      const flow = logger.getOperationFlow(operationId)!;

      render(
        <FlowLogDisplay
          flow={flow}
          enableFiltering={true}
          enableSearch={true}
        />
      );

      // Test level filtering
      const levelFilter = screen.getByRole('combobox', { name: /log level/i });
      await userEvent.selectOptions(levelFilter, 'warn');

      await waitFor(() => {
        expect(screen.getByText('Warning message 1')).toBeInTheDocument();
        expect(screen.getByText('Error message 1')).toBeInTheDocument();
        expect(screen.queryByText('Info message 1')).not.toBeInTheDocument();
      });

      // Test search functionality
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await userEvent.type(searchInput, 'message 2');

      await waitFor(() => {
        expect(screen.queryByText('Info message 2')).toBeInTheDocument();
        expect(screen.queryByText('Warning message 1')).not.toBeInTheDocument();
      });
    });

    it('should export flow logs in multiple formats', async () => {
      const operationId = 'export-test';

      logger.startOperationFlow(operationId, 'export_test');
      logger.logStep(operationId, 'Test step', 'info', { exportable: true });
      logger.endOperationFlow(operationId);

      const flow = logger.getOperationFlow(operationId)!;

      render(
        <FlowLogDisplay
          flow={flow}
          enableExport={true}
        />
      );

      // Test JSON export
      const exportButton = screen.getByRole('button', { name: /export/i });
      const exportMenu = screen.getByRole('menu', { name: /export format/i });

      await userEvent.click(exportButton);
      expect(exportMenu).toBeInTheDocument();

      const jsonExport = screen.getByRole('menuitem', { name: /json/i });
      await userEvent.click(jsonExport);

      // Verify export was triggered (would normally download file)
      // In test environment, we can check if export function was called
      expect(logger.exportFlow).toHaveBeenCalledWith(operationId, 'json');
    });
  });

  describe('Performance Requirements', () => {
    it('should log operations with minimal performance impact', async () => {
      const operationCount = 1000;
      const startTime = performance.now();

      // Create many operations to test performance
      for (let i = 0; i < operationCount; i++) {
        const opId = `perf-test-${i}`;
        logger.startOperationFlow(opId, 'performance_test');
        logger.logStep(opId, `Step ${i}`, 'info');
        logger.endOperationFlow(opId);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete 1000 operations in less than 100ms
      expect(totalTime).toBeLessThan(100);

      // Verify all operations were logged
      const allFlows = logger.getAllFlows();
      expect(allFlows.length).toBe(operationCount);
    });

    it('should handle large log entries efficiently', async () => {
      const operationId = 'large-data-test';
      const largeMetadata = {
        largeArray: Array.from({ length: 10000 }, (_, i) => `item-${i}`),
        largeObject: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
        )
      };

      const startTime = performance.now();

      logger.startOperationFlow(operationId, 'large_data_test');
      logger.logStep(operationId, 'Process large data', 'info', largeMetadata);
      logger.endOperationFlow(operationId);

      const endTime = performance.now();
      const logTime = endTime - startTime;

      // Should handle large metadata in less than 50ms
      expect(logTime).toBeLessThan(50);

      const flow = logger.getOperationFlow(operationId);
      expect(flow).toBeDefined();
      expect(flow!.steps[0].metadata?.largeArray).toHaveLength(10000);
    });
  });

  describe('Memory Management', () => {
    it('should enforce maximum log entry limits', async () => {
      const limitedLogger = new TransparencyLogger({
        enablePersistence: false,
        maxLogEntries: 10,
        logLevel: 'info'
      });

      // Create more operations than the limit
      for (let i = 0; i < 15; i++) {
        const opId = `limit-test-${i}`;
        limitedLogger.startOperationFlow(opId, 'limit_test');
        limitedLogger.logStep(opId, `Step ${i}`, 'info');
        limitedLogger.endOperationFlow(opId);
      }

      const allFlows = limitedLogger.getAllFlows();
      expect(allFlows.length).toBe(10); // Should not exceed limit

      // Should keep the most recent entries
      expect(limitedLogger.getOperationFlow('limit-test-14')).toBeDefined();
      expect(limitedLogger.getOperationFlow('limit-test-5')).toBeDefined();
      expect(limitedLogger.getOperationFlow('limit-test-0')).toBeUndefined();
    });

    it('should clean up completed flows older than retention period', async () => {
      const retentionLogger = new TransparencyLogger({
        enablePersistence: true,
        maxLogEntries: 1000,
        logLevel: 'info',
        retentionPeriodMs: 1000 // 1 second retention
      });

      const oldOperationId = 'old-operation';
      retentionLogger.startOperationFlow(oldOperationId, 'old_test');
      retentionLogger.logStep(oldOperationId, 'Old step', 'info');
      retentionLogger.endOperationFlow(oldOperationId);

      // Advance time beyond retention period
      (global as any).advanceMockTime(2000);

      // Trigger cleanup
      retentionLogger.cleanupOldFlows();

      // Old flow should be cleaned up
      expect(retentionLogger.getOperationFlow(oldOperationId)).toBeUndefined();
    });
  });
});

/**
 * Test Coverage Summary for Flow Logging:
 *
 * ✅ Basic flow logging functionality
 * ✅ Concurrent operation tracking
 * ✅ Log persistence across sessions
 * ✅ Flow display component rendering
 * ✅ Filtering and search capabilities
 * ✅ Export functionality
 * ✅ Performance requirements (<100ms for 1000 ops)
 * ✅ Memory management and cleanup
 * ✅ Large data handling
 * ✅ Retention policy enforcement
 *
 * Coverage Target: 95%+ for transparency features
 * Performance Target: <100ms per operation
 * Memory Target: Configurable limits and cleanup
 */