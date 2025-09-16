/**
 * Authorization Dialog Integration Tests - v8 Transparency Feature
 * Tests the complete authorization flow for AI operations with cost visibility
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIAuthorizationDialog } from '../../../src/components/transparency/AIAuthorizationDialog';
import { CostCalculationService } from '../../../src/services/transparency/CostCalculationService';
import { TransparencyLogger } from '../../../src/services/transparency/TransparencyLogger';

// Mock services for isolated testing
jest.mock('../../../src/services/transparency/CostCalculationService');
jest.mock('../../../src/services/transparency/TransparencyLogger');

const mockCostCalculationService = CostCalculationService as jest.MockedClass<typeof CostCalculationService>;
const mockTransparencyLogger = TransparencyLogger as jest.MockedClass<typeof TransparencyLogger>;

interface AuthorizationTestScenario {
  description: string;
  operation: string;
  estimatedCost: number;
  expectedIndicatorColor: string;
  expectedCostDisplay: string;
  shouldAllowAuthorization: boolean;
  userBudgetRemaining: number;
}

const testScenarios: AuthorizationTestScenario[] = [
  {
    description: 'Low cost scenario with green indicator',
    operation: 'Simple search query',
    estimatedCost: 0.001,
    expectedIndicatorColor: 'green',
    expectedCostDisplay: '$0.001',
    shouldAllowAuthorization: true,
    userBudgetRemaining: 10.0
  },
  {
    description: 'Medium cost scenario with yellow indicator',
    operation: 'Complex semantic analysis',
    estimatedCost: 0.05,
    expectedIndicatorColor: 'yellow',
    expectedCostDisplay: '$0.05',
    shouldAllowAuthorization: true,
    userBudgetRemaining: 1.0
  },
  {
    description: 'High cost scenario with red indicator',
    operation: 'Large document processing',
    estimatedCost: 0.25,
    expectedIndicatorColor: 'red',
    expectedCostDisplay: '$0.25',
    shouldAllowAuthorization: true,
    userBudgetRemaining: 0.5
  },
  {
    description: 'Budget exceeded scenario',
    operation: 'Expensive operation',
    estimatedCost: 1.0,
    expectedIndicatorColor: 'red',
    expectedCostDisplay: '$1.00',
    shouldAllowAuthorization: false,
    userBudgetRemaining: 0.25
  }
];

describe('AI Authorization Dialog - v8 Transparency Integration', () => {
  let mockOnAuthorize: jest.MockedFunction<(approved: boolean, operationId: string) => void>;
  let mockOnClose: jest.MockedFunction<() => void>;
  let costService: jest.Mocked<CostCalculationService>;
  let logger: jest.Mocked<TransparencyLogger>;

  beforeEach(() => {
    // Setup mocks
    mockOnAuthorize = jest.fn();
    mockOnClose = jest.fn();

    // Mock cost calculation service
    costService = new mockCostCalculationService() as jest.Mocked<CostCalculationService>;
    costService.calculateEstimatedCost = jest.fn();
    costService.getUserBudgetRemaining = jest.fn();
    costService.formatCostDisplay = jest.fn();

    // Mock transparency logger
    logger = new mockTransparencyLogger() as jest.Mocked<TransparencyLogger>;
    logger.logAuthorizationRequest = jest.fn();
    logger.logAuthorizationDecision = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Core Authorization Workflow', () => {
    testScenarios.forEach((scenario) => {
      it(scenario.description, async () => {
        // Setup scenario-specific mocks
        costService.calculateEstimatedCost.mockResolvedValue(scenario.estimatedCost);
        costService.getUserBudgetRemaining.mockResolvedValue(scenario.userBudgetRemaining);
        costService.formatCostDisplay.mockReturnValue(scenario.expectedCostDisplay);

        const operationId = `test-op-${Date.now()}`;

        render(
          <AIAuthorizationDialog
            isOpen={true}
            operation={scenario.operation}
            operationId={operationId}
            onAuthorize={mockOnAuthorize}
            onClose={mockOnClose}
            costService={costService}
            logger={logger}
          />
        );

        // Wait for cost calculation to complete
        await waitFor(() => {
          expect(costService.calculateEstimatedCost).toHaveBeenCalledWith(scenario.operation);
        });

        // Verify dialog content
        expect(screen.getByText(scenario.operation)).toBeInTheDocument();
        expect(screen.getByText(scenario.expectedCostDisplay)).toBeInTheDocument();

        // Verify cost indicator color
        const costIndicator = screen.getByTestId('cost-indicator');
        expect(costIndicator).toHaveClass(`cost-indicator--${scenario.expectedIndicatorColor}`);

        // Verify authorization button state
        const authorizeButton = screen.getByRole('button', { name: /authorize/i });
        if (scenario.shouldAllowAuthorization) {
          expect(authorizeButton).toBeEnabled();
        } else {
          expect(authorizeButton).toBeDisabled();
          expect(screen.getByText(/budget exceeded/i)).toBeInTheDocument();
        }

        // Test authorization workflow if allowed
        if (scenario.shouldAllowAuthorization) {
          await userEvent.click(authorizeButton);

          expect(logger.logAuthorizationDecision).toHaveBeenCalledWith(
            operationId,
            true,
            scenario.estimatedCost
          );
          expect(mockOnAuthorize).toHaveBeenCalledWith(true, operationId);
        }
      });
    });

    it('should handle authorization cancellation', async () => {
      const operationId = 'test-cancel-op';
      costService.calculateEstimatedCost.mockResolvedValue(0.01);
      costService.getUserBudgetRemaining.mockResolvedValue(1.0);
      costService.formatCostDisplay.mockReturnValue('$0.01');

      render(
        <AIAuthorizationDialog
          isOpen={true}
          operation="Test operation"
          operationId={operationId}
          onAuthorize={mockOnAuthorize}
          onClose={mockOnClose}
          costService={costService}
          logger={logger}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(logger.logAuthorizationDecision).toHaveBeenCalledWith(
        operationId,
        false,
        0.01
      );
      expect(mockOnAuthorize).toHaveBeenCalledWith(false, operationId);
    });

    it('should handle cost calculation errors gracefully', async () => {
      const operationId = 'test-error-op';
      costService.calculateEstimatedCost.mockRejectedValue(new Error('Cost calculation failed'));
      costService.getUserBudgetRemaining.mockResolvedValue(1.0);

      render(
        <AIAuthorizationDialog
          isOpen={true}
          operation="Test operation"
          operationId={operationId}
          onAuthorize={mockOnAuthorize}
          onClose={mockOnClose}
          costService={costService}
          logger={logger}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/error calculating cost/i)).toBeInTheDocument();
      });

      // Should disable authorization when cost calculation fails
      const authorizeButton = screen.getByRole('button', { name: /authorize/i });
      expect(authorizeButton).toBeDisabled();
    });
  });

  describe('Performance Requirements', () => {
    it('should render within 200ms performance threshold', async () => {
      const startTime = performance.now();

      costService.calculateEstimatedCost.mockResolvedValue(0.01);
      costService.getUserBudgetRemaining.mockResolvedValue(1.0);
      costService.formatCostDisplay.mockReturnValue('$0.01');

      render(
        <AIAuthorizationDialog
          isOpen={true}
          operation="Performance test operation"
          operationId="perf-test"
          onAuthorize={mockOnAuthorize}
          onClose={mockOnClose}
          costService={costService}
          logger={logger}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Performance test operation')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(200); // 200ms threshold
    });

    it('should handle rapid consecutive authorization requests', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => `Operation ${i}`);

      costService.calculateEstimatedCost.mockResolvedValue(0.01);
      costService.getUserBudgetRemaining.mockResolvedValue(1.0);
      costService.formatCostDisplay.mockReturnValue('$0.01');

      for (const operation of operations) {
        const { rerender } = render(
          <AIAuthorizationDialog
            isOpen={true}
            operation={operation}
            operationId={`op-${operation}`}
            onAuthorize={mockOnAuthorize}
            onClose={mockOnClose}
            costService={costService}
            logger={logger}
          />
        );

        await waitFor(() => {
          expect(screen.getByText(operation)).toBeInTheDocument();
        });

        rerender(<div />); // Unmount
      }

      // Verify all operations were processed
      expect(costService.calculateEstimatedCost).toHaveBeenCalledTimes(10);
    });
  });

  describe('Accessibility and Usability', () => {
    it('should be fully keyboard navigable', async () => {
      costService.calculateEstimatedCost.mockResolvedValue(0.01);
      costService.getUserBudgetRemaining.mockResolvedValue(1.0);
      costService.formatCostDisplay.mockReturnValue('$0.01');

      render(
        <AIAuthorizationDialog
          isOpen={true}
          operation="Keyboard test operation"
          operationId="kbd-test"
          onAuthorize={mockOnAuthorize}
          onClose={mockOnClose}
          costService={costService}
          logger={logger}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Keyboard test operation')).toBeInTheDocument();
      });

      // Test keyboard navigation
      const authorizeButton = screen.getByRole('button', { name: /authorize/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      // Tab to authorize button
      await userEvent.tab();
      expect(authorizeButton).toHaveFocus();

      // Tab to cancel button
      await userEvent.tab();
      expect(cancelButton).toHaveFocus();

      // Enter should activate the focused button
      await userEvent.keyboard('{Enter}');
      expect(mockOnAuthorize).toHaveBeenCalledWith(false, 'kbd-test');
    });

    it('should have proper ARIA labels and descriptions', async () => {
      costService.calculateEstimatedCost.mockResolvedValue(0.05);
      costService.getUserBudgetRemaining.mockResolvedValue(1.0);
      costService.formatCostDisplay.mockReturnValue('$0.05');

      render(
        <AIAuthorizationDialog
          isOpen={true}
          operation="ARIA test operation"
          operationId="aria-test"
          onAuthorize={mockOnAuthorize}
          onClose={mockOnClose}
          costService={costService}
          logger={logger}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('ARIA test operation')).toBeInTheDocument();
      });

      // Check ARIA labels
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby');

      const costIndicator = screen.getByTestId('cost-indicator');
      expect(costIndicator).toHaveAttribute('aria-label');

      const authorizeButton = screen.getByRole('button', { name: /authorize/i });
      expect(authorizeButton).toHaveAttribute('aria-describedby');
    });
  });

  describe('Security and Data Protection', () => {
    it('should not log sensitive user data', async () => {
      const sensitiveOperation = 'Process credit card 1234-5678-9012-3456';

      costService.calculateEstimatedCost.mockResolvedValue(0.01);
      costService.getUserBudgetRemaining.mockResolvedValue(1.0);
      costService.formatCostDisplay.mockReturnValue('$0.01');

      render(
        <AIAuthorizationDialog
          isOpen={true}
          operation={sensitiveOperation}
          operationId="security-test"
          onAuthorize={mockOnAuthorize}
          onClose={mockOnClose}
          costService={costService}
          logger={logger}
        />
      );

      const authorizeButton = screen.getByRole('button', { name: /authorize/i });
      await userEvent.click(authorizeButton);

      // Verify logger was called but check for data sanitization
      expect(logger.logAuthorizationDecision).toHaveBeenCalled();
      const loggerCall = logger.logAuthorizationDecision.mock.calls[0];

      // Should not contain full credit card number
      expect(JSON.stringify(loggerCall)).not.toMatch(/1234-5678-9012-3456/);
    });

    it('should validate authorization tokens properly', async () => {
      const invalidToken = 'invalid-token-123';

      render(
        <AIAuthorizationDialog
          isOpen={true}
          operation="Token validation test"
          operationId="token-test"
          onAuthorize={mockOnAuthorize}
          onClose={mockOnClose}
          costService={costService}
          logger={logger}
          authToken={invalidToken}
        />
      );

      // Should show authorization error for invalid token
      await waitFor(() => {
        expect(screen.getByText(/invalid authorization/i)).toBeInTheDocument();
      });

      const authorizeButton = screen.getByRole('button', { name: /authorize/i });
      expect(authorizeButton).toBeDisabled();
    });
  });
});

/**
 * Test Coverage Summary for Authorization Dialog:
 *
 * ✅ Core authorization workflow (approve/deny)
 * ✅ Cost calculation and display
 * ✅ Budget validation and enforcement
 * ✅ Error handling and graceful degradation
 * ✅ Performance requirements (<200ms)
 * ✅ Accessibility (keyboard navigation, ARIA)
 * ✅ Security (data sanitization, token validation)
 * ✅ User experience (visual indicators, clear messaging)
 *
 * Coverage Target: 95%+ for transparency features
 * Performance Target: <200ms response time
 * Security Target: No sensitive data in logs
 */