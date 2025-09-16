/**
 * AI Authorization Dialog Integration Tests
 * Tests various cost scenarios and authorization flows
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AIAuthorizationDialog } from '../../../src/renderer/components/dialogs/AIAuthorizationDialog';

// Mock IPC communication
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockIpcRenderer,
  writable: true,
});

// Mock cost scenarios
const mockCostScenarios = {
  low: {
    estimatedCost: 0.15,
    tokensToUse: 1000,
    operation: 'Simple search',
    confidence: 'high',
  },
  medium: {
    estimatedCost: 2.45,
    tokensToUse: 5000,
    operation: 'Complex analysis',
    confidence: 'medium',
  },
  high: {
    estimatedCost: 15.80,
    tokensToUse: 25000,
    operation: 'Full document processing',
    confidence: 'high',
  },
  critical: {
    estimatedCost: 50.00,
    tokensToUse: 100000,
    operation: 'Batch processing',
    confidence: 'low',
  },
};

describe('AIAuthorizationDialog Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRenderer.invoke.mockResolvedValue(true);
  });

  describe('Cost Scenario Testing', () => {
    test('should display low cost scenario with green indicator', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostScenarios.low}
        />
      );

      // Verify cost display
      expect(screen.getByText('$0.15')).toBeInTheDocument();
      expect(screen.getByText('1,000 tokens')).toBeInTheDocument();

      // Check for low-cost styling (should have green indicator)
      const costIndicator = screen.getByTestId('cost-indicator');
      expect(costIndicator).toHaveClass('cost-low');

      // Verify authorization button is enabled
      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      expect(authorizeBtn).not.toBeDisabled();
    });

    test('should display medium cost scenario with yellow indicator', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostScenarios.medium}
        />
      );

      expect(screen.getByText('$2.45')).toBeInTheDocument();
      expect(screen.getByText('5,000 tokens')).toBeInTheDocument();

      const costIndicator = screen.getByTestId('cost-indicator');
      expect(costIndicator).toHaveClass('cost-medium');
    });

    test('should display high cost scenario with orange indicator and warning', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostScenarios.high}
        />
      );

      expect(screen.getByText('$15.80')).toBeInTheDocument();
      expect(screen.getByText('25,000 tokens')).toBeInTheDocument();

      const costIndicator = screen.getByTestId('cost-indicator');
      expect(costIndicator).toHaveClass('cost-high');

      // Should show warning for high cost
      expect(screen.getByText(/high cost operation/i)).toBeInTheDocument();
    });

    test('should display critical cost scenario with red indicator and confirmation', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostScenarios.critical}
        />
      );

      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByText('100,000 tokens')).toBeInTheDocument();

      const costIndicator = screen.getByTestId('cost-indicator');
      expect(costIndicator).toHaveClass('cost-critical');

      // Should require confirmation checkbox for critical costs
      const confirmCheckbox = screen.getByRole('checkbox', { name: /confirm high cost/i });
      expect(confirmCheckbox).toBeInTheDocument();

      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      expect(authorizeBtn).toBeDisabled();

      // Enable after confirmation
      fireEvent.click(confirmCheckbox);
      expect(authorizeBtn).not.toBeDisabled();
    });
  });

  describe('Authorization Flow', () => {
    test('should handle successful authorization', async () => {
      const onAuthorize = jest.fn();
      const onClose = jest.fn();

      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={onClose}
          onAuthorize={onAuthorize}
          costData={mockCostScenarios.low}
        />
      );

      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      fireEvent.click(authorizeBtn);

      await waitFor(() => {
        expect(onAuthorize).toHaveBeenCalledWith({
          approved: true,
          costData: mockCostScenarios.low,
          timestamp: expect.any(Number),
        });
      });
    });

    test('should handle authorization cancellation', async () => {
      const onClose = jest.fn();

      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={onClose}
          onAuthorize={jest.fn()}
          costData={mockCostScenarios.medium}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility Compliance', () => {
    test('should have proper ARIA labels and roles', () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostScenarios.low}
        />
      );

      // Check dialog role and labels
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');

      // Check focus management
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /authorize/i }));
    });

    test('should support keyboard navigation', () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostScenarios.low}
        />
      );

      const dialog = screen.getByRole('dialog');

      // Tab navigation
      fireEvent.keyDown(dialog, { key: 'Tab' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }));

      // Escape key should close
      fireEvent.keyDown(dialog, { key: 'Escape' });
      // onClose should be called
    });
  });

  describe('Accenture Branding', () => {
    test('should apply Accenture brand colors', () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostScenarios.low}
        />
      );

      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      const computedStyle = window.getComputedStyle(authorizeBtn);

      // Check for Accenture purple (#A100FF)
      expect(computedStyle.backgroundColor).toBe('rgb(161, 0, 255)');
    });
  });

  describe('IPC Communication', () => {
    test('should communicate authorization result to main process', async () => {
      const onAuthorize = jest.fn();

      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={onAuthorize}
          costData={mockCostScenarios.medium}
        />
      );

      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      fireEvent.click(authorizeBtn);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'ai:authorization-result',
          expect.objectContaining({
            approved: true,
            costData: mockCostScenarios.medium,
          })
        );
      });
    });
  });
});