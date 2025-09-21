import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

// Import components to test
import SkipNavigation from '../../src/renderer/components/common/SkipNavigation';
import ScreenReaderOnly, { LiveRegion, StatusMessage } from '../../src/renderer/components/common/ScreenReaderOnly';
import AccessibleModal, { ConfirmDialog } from '../../src/renderer/components/common/AccessibleModal';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Accessibility Implementation Tests', () => {
  describe('SkipNavigation Component', () => {
    test('should render skip navigation links', () => {
      render(<SkipNavigation />);

      const skipMainLink = screen.getByRole('link', { name: /skip to main content/i });
      const skipNavLink = screen.getByRole('link', { name: /skip to navigation/i });
      const skipSearchLink = screen.getByRole('link', { name: /skip to search/i });

      expect(skipMainLink).toBeInTheDocument();
      expect(skipNavLink).toBeInTheDocument();
      expect(skipSearchLink).toBeInTheDocument();
    });

    test('should be accessible', async () => {
      const { container } = render(<SkipNavigation />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper HREF attributes', () => {
      render(<SkipNavigation />);

      expect(screen.getByRole('link', { name: /skip to main content/i }))
        .toHaveAttribute('href', '#main-content');
      expect(screen.getByRole('link', { name: /skip to navigation/i }))
        .toHaveAttribute('href', '#navigation');
      expect(screen.getByRole('link', { name: /skip to search/i }))
        .toHaveAttribute('href', '#search');
    });
  });

  describe('ScreenReaderOnly Component', () => {
    test('should render content for screen readers only', () => {
      render(<ScreenReaderOnly>Screen reader only content</ScreenReaderOnly>);

      const element = screen.getByText('Screen reader only content');
      expect(element).toBeInTheDocument();

      // Check that it has screen reader only styling
      expect(element).toHaveClass('sr-only');
    });

    test('should support different HTML elements', () => {
      render(<ScreenReaderOnly as="span">Test content</ScreenReaderOnly>);

      const element = screen.getByText('Test content');
      expect(element.tagName).toBe('SPAN');
    });

    test('should support ARIA live regions', () => {
      render(
        <ScreenReaderOnly aria-live="polite" aria-atomic={true}>
          Live region content
        </ScreenReaderOnly>
      );

      const element = screen.getByText('Live region content');
      expect(element).toHaveAttribute('aria-live', 'polite');
      expect(element).toHaveAttribute('aria-atomic', 'true');
    });

    test('should be accessible', async () => {
      const { container } = render(
        <ScreenReaderOnly>Accessible content</ScreenReaderOnly>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('LiveRegion Component', () => {
    test('should announce messages to screen readers', () => {
      render(<LiveRegion message="Test announcement" />);

      const liveRegion = screen.getByText('Test announcement');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
      expect(liveRegion).toHaveAttribute('role', 'status');
    });

    test('should support different politeness levels', () => {
      render(<LiveRegion message="Urgent message" politeness="assertive" />);

      const liveRegion = screen.getByText('Urgent message');
      expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
    });

    test('should clear messages after specified time', async () => {
      jest.useFakeTimers();

      render(<LiveRegion message="Temporary message" clearAfter={1000} />);

      expect(screen.getByText('Temporary message')).toBeInTheDocument();

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      await screen.findByText(''); // Should be empty now

      jest.useRealTimers();
    });
  });

  describe('StatusMessage Component', () => {
    test('should render different status types', () => {
      const { rerender } = render(
        <StatusMessage message="Error message" type="error" />
      );

      let statusElement = screen.getByText('Error message');
      expect(statusElement).toHaveAttribute('role', 'alert');

      rerender(<StatusMessage message="Success message" type="success" />);
      statusElement = screen.getByText('Success message');
      expect(statusElement).toHaveAttribute('role', 'status');
    });

    test('should not render when show is false', () => {
      render(<StatusMessage message="Hidden message" show={false} />);

      expect(screen.queryByText('Hidden message')).not.toBeInTheDocument();
    });
  });

  describe('AccessibleModal Component', () => {
    test('should render modal with proper ARIA attributes', () => {
      render(
        <AccessibleModal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </AccessibleModal>
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');

      const title = screen.getByText('Test Modal');
      expect(title).toHaveAttribute('id', 'modal-title');
    });

    test('should not render when isOpen is false', () => {
      render(
        <AccessibleModal isOpen={false} onClose={() => {}} title="Hidden Modal">
          <p>Modal content</p>
        </AccessibleModal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should call onClose when close button is clicked', async () => {
      const handleClose = jest.fn();

      render(
        <AccessibleModal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </AccessibleModal>
      );

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      await userEvent.click(closeButton);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    test('should handle escape key', async () => {
      const handleClose = jest.fn();

      render(
        <AccessibleModal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </AccessibleModal>
      );

      await userEvent.keyboard('{Escape}');

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    test('should be accessible', async () => {
      const { container } = render(
        <AccessibleModal isOpen={true} onClose={() => {}} title="Accessible Modal">
          <div>
            <p>Modal content with form</p>
            <input type="text" aria-label="Test input" />
            <button>Test button</button>
          </div>
        </AccessibleModal>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('ConfirmDialog Component', () => {
    test('should render confirmation dialog', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Confirm Action"
          message="Are you sure you want to proceed?"
        />
      );

      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    test('should call onConfirm when confirm button is clicked', async () => {
      const handleConfirm = jest.fn();
      const handleClose = jest.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title="Confirm Action"
          message="Are you sure?"
        />
      );

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);

      expect(handleConfirm).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    test('should render different variants', () => {
      const { rerender } = render(
        <ConfirmDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Danger Dialog"
          message="This action is dangerous"
          variant="danger"
        />
      );

      // Check for danger styling (you may need to adjust based on implementation)
      let confirmButton = screen.getByRole('button', { name: /confirm/i });
      expect(confirmButton).toHaveClass('bg-red-600');

      rerender(
        <ConfirmDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Warning Dialog"
          message="This action needs attention"
          variant="warning"
        />
      );

      confirmButton = screen.getByRole('button', { name: /confirm/i });
      expect(confirmButton).toHaveClass('bg-yellow-600');
    });
  });

  describe('Focus Management', () => {
    test('should trap focus within modal', async () => {
      render(
        <AccessibleModal isOpen={true} onClose={() => {}} title="Focus Test">
          <div>
            <input data-testid="first-input" aria-label="First input" />
            <button data-testid="middle-button">Middle button</button>
            <input data-testid="last-input" aria-label="Last input" />
          </div>
        </AccessibleModal>
      );

      const firstInput = screen.getByTestId('first-input');
      const lastInput = screen.getByTestId('last-input');

      // Tab from last element should wrap to first
      lastInput.focus();
      await userEvent.tab();
      expect(firstInput).toHaveFocus();

      // Shift+Tab from first element should wrap to last
      firstInput.focus();
      await userEvent.tab({ shift: true });
      expect(lastInput).toHaveFocus();
    });
  });

  describe('Integration Tests', () => {
    test('should work together without accessibility violations', async () => {
      const { container } = render(
        <div>
          <SkipNavigation />
          <main id="main-content">
            <h1>Test Application</h1>
            <ScreenReaderOnly>
              Application loaded successfully
            </ScreenReaderOnly>
            <LiveRegion message="Welcome to the application" />
          </main>
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});

// Mock implementations for hooks if needed
jest.mock('../../src/renderer/hooks/useAccessibleFocus', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    containerRef: { current: null },
    focusFirst: jest.fn(),
    focusLast: jest.fn(),
    getFocusableElements: jest.fn(() => [])
  })),
  useFocusVisible: jest.fn(() => false),
  useArrowKeyNavigation: jest.fn(() => ({
    containerRef: { current: null },
    focusFirst: jest.fn(),
    focusLast: jest.fn(),
    getFocusableElements: jest.fn(() => [])
  }))
}));