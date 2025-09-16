/**
 * AlertMessage Component Tests
 * Comprehensive test suite for accessibility, functionality, and user interactions
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  queryByRole,
  getByRole as getByRoleWithin
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import AlertMessage, {
  AlertMessageRef,
  AlertAction,
  InfoAlert,
  SuccessAlert,
  WarningAlert,
  ErrorAlert,
  showToast
} from '../../src/renderer/components/AlertMessage';

// =========================
// MOCK SETUP
// =========================

// Mock screen reader hooks
jest.mock('../../src/renderer/hooks/useScreenReaderAnnouncements', () => ({
  useScreenReaderAnnouncements: () => ({
    announce: jest.fn(),
    announceError: jest.fn(),
    announceSuccess: jest.fn()
  })
}));

// Mock keyboard navigation
jest.mock('../../src/renderer/hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: () => ({
    containerRef: { current: null },
    focusFirst: jest.fn(),
    focusLast: jest.fn(),
    focusNext: jest.fn(),
    focusPrevious: jest.fn()
  })
}));

// Mock performance optimizer
jest.mock('../../src/components/performance/PerformanceOptimizer', () => ({
  smartMemo: (component: any) => component
}));

// Mock media query for reduced motion
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock timers
jest.useFakeTimers();

describe('AlertMessage Component', () => {
  let mockScreenReader: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    mockScreenReader = {
      announce: jest.fn(),
      announceError: jest.fn(),
      announceSuccess: jest.fn()
    };

    // Reset DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  // =========================
  // BASIC RENDERING TESTS
  // =========================

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(<AlertMessage message="Test alert message" />);

      expect(screen.getByText('Test alert message')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders with title and message', () => {
      render(
        <AlertMessage
          title="Alert Title"
          message="Alert message content"
        />
      );

      expect(screen.getByText('Alert Title')).toBeInTheDocument();
      expect(screen.getByText('Alert message content')).toBeInTheDocument();
    });

    it('renders JSX content as message', () => {
      const messageContent = (
        <div>
          <strong>Important:</strong> This is a rich message
        </div>
      );

      render(<AlertMessage message={messageContent} />);

      expect(screen.getByText('Important:')).toBeInTheDocument();
      expect(screen.getByText('This is a rich message')).toBeInTheDocument();
    });

    it('applies custom className and styles', () => {
      const customStyle = { backgroundColor: 'purple' };

      render(
        <AlertMessage
          message="Test"
          className="custom-alert"
          style={customStyle}
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toHaveClass('custom-alert');
      expect(alert).toHaveStyle('background-color: purple');
    });
  });

  // =========================
  // ACCESSIBILITY TESTS
  // =========================

  describe('Accessibility', () => {
    it('has correct ARIA role based on severity', () => {
      const { rerender } = render(
        <AlertMessage message="Info message" severity="info" />
      );
      expect(screen.getByRole('status')).toBeInTheDocument();

      rerender(<AlertMessage message="Error message" severity="error" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      rerender(<AlertMessage message="Warning message" severity="warning" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('uses alertdialog role when actions are present', () => {
      const actions: AlertAction[] = [
        {
          id: 'confirm',
          label: 'Confirm',
          onClick: jest.fn()
        }
      ];

      render(
        <AlertMessage
          message="Alert with actions"
          actions={actions}
        />
      );

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('has proper ARIA labeling with title', () => {
      render(
        <AlertMessage
          title="Important Notice"
          message="Please read this carefully"
        />
      );

      const alert = screen.getByRole('status');
      const titleElement = screen.getByText('Important Notice');

      expect(alert).toHaveAttribute('aria-labelledby');
      expect(alert.getAttribute('aria-labelledby')).toBe(titleElement.id);
    });

    it('has proper ARIA description', () => {
      render(<AlertMessage message="Alert description" />);

      const alert = screen.getByRole('status');
      const messageElement = screen.getByText('Alert description');

      expect(alert).toHaveAttribute('aria-describedby');
      expect(alert.getAttribute('aria-describedby')).toBe(messageElement.id);
    });

    it('has proper aria-live attribute for status role', () => {
      render(<AlertMessage message="Status message" severity="info" />);

      const alert = screen.getByRole('status');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('has aria-atomic for non-dialog alerts', () => {
      render(<AlertMessage message="Atomic message" />);

      const alert = screen.getByRole('status');
      expect(alert).toHaveAttribute('aria-atomic', 'true');
    });

    it('supports custom ARIA labels', () => {
      render(
        <AlertMessage
          message="Test"
          aria-label="Custom alert label"
          aria-describedby="custom-description"
        />
      );

      const alert = screen.getByRole('status');
      expect(alert).toHaveAttribute('aria-label', 'Custom alert label');
      expect(alert).toHaveAttribute('aria-describedby', 'custom-description');
    });

    it('icons are properly hidden from screen readers', () => {
      render(
        <AlertMessage
          message="Alert with icon"
          severity="success"
          showIcon
        />
      );

      const icon = screen.getByRole('status').querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('is focusable when role is alertdialog', () => {
      const actions: AlertAction[] = [
        { id: 'action', label: 'Action', onClick: jest.fn() }
      ];

      render(
        <AlertMessage
          message="Dialog alert"
          actions={actions}
        />
      );

      const alert = screen.getByRole('alertdialog');
      expect(alert).toHaveAttribute('tabIndex', '0');
    });
  });

  // =========================
  // SEVERITY TESTS
  // =========================

  describe('Severity Levels', () => {
    it('applies correct styling for each severity', () => {
      const severities = ['info', 'success', 'warning', 'error'] as const;

      severities.forEach(severity => {
        const { unmount } = render(
          <AlertMessage
            message={`${severity} message`}
            severity={severity}
            data-testid={`alert-${severity}`}
          />
        );

        const alert = screen.getByTestId(`alert-${severity}`);
        expect(alert).toHaveAttribute('data-severity', severity);

        unmount();
      });
    });

    it('shows correct default icons for each severity', () => {
      const { rerender } = render(
        <AlertMessage message="Test" severity="info" showIcon />
      );
      expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument();

      rerender(<AlertMessage message="Test" severity="success" showIcon />);
      expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument();

      rerender(<AlertMessage message="Test" severity="warning" showIcon />);
      expect(screen.getByRole('alert').querySelector('svg')).toBeInTheDocument();

      rerender(<AlertMessage message="Test" severity="error" showIcon />);
      expect(screen.getByRole('alert').querySelector('svg')).toBeInTheDocument();
    });

    it('allows custom icons', () => {
      const customIcon = <span data-testid="custom-icon">🔥</span>;

      render(
        <AlertMessage
          message="Test"
          icon={customIcon}
          showIcon
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('supports icon functions', () => {
      const iconFunction = (severity: string) => (
        <span data-testid={`icon-${severity}`}>Icon for {severity}</span>
      );

      render(
        <AlertMessage
          message="Test"
          severity="warning"
          icon={iconFunction}
          showIcon
        />
      );

      expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
    });
  });

  // =========================
  // DISMISSIBLE TESTS
  // =========================

  describe('Dismissible Functionality', () => {
    it('shows dismiss button when dismissible', () => {
      const onDismiss = jest.fn();

      render(
        <AlertMessage
          message="Dismissible alert"
          dismissible
          onDismiss={onDismiss}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button is clicked', async () => {
      const onDismiss = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <AlertMessage
          message="Dismissible alert"
          dismissible
          onDismiss={onDismiss}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });
    });

    it('auto-dismisses after specified time', async () => {
      const onDismiss = jest.fn();

      render(
        <AlertMessage
          message="Auto dismiss"
          dismissible
          autoDismiss={1000}
          onDismiss={onDismiss}
        />
      );

      expect(onDismiss).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });
    });

    it('clears auto-dismiss timer when manually dismissed', async () => {
      const onDismiss = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <AlertMessage
          message="Manual dismiss"
          dismissible
          autoDismiss={5000}
          onDismiss={onDismiss}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      // Should be called once from manual dismiss
      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });

      // Advance past auto-dismiss time
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      // Should not be called again
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  // =========================
  // ACTIONS TESTS
  // =========================

  describe('Action Buttons', () => {
    it('renders action buttons', () => {
      const actions: AlertAction[] = [
        {
          id: 'confirm',
          label: 'Confirm',
          onClick: jest.fn()
        },
        {
          id: 'cancel',
          label: 'Cancel',
          onClick: jest.fn(),
          variant: 'secondary'
        }
      ];

      render(
        <AlertMessage
          message="Alert with actions"
          actions={actions}
        />
      );

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('calls action onClick handlers', async () => {
      const confirmHandler = jest.fn();
      const cancelHandler = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const actions: AlertAction[] = [
        {
          id: 'confirm',
          label: 'Confirm',
          onClick: confirmHandler
        },
        {
          id: 'cancel',
          label: 'Cancel',
          onClick: cancelHandler
        }
      ];

      render(
        <AlertMessage
          message="Alert with actions"
          actions={actions}
          id="test-alert"
        />
      );

      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(confirmHandler).toHaveBeenCalledWith('test-alert');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(cancelHandler).toHaveBeenCalledWith('test-alert');
    });

    it('disables action buttons when specified', () => {
      const actions: AlertAction[] = [
        {
          id: 'disabled',
          label: 'Disabled Action',
          onClick: jest.fn(),
          disabled: true
        }
      ];

      render(
        <AlertMessage
          message="Alert with disabled action"
          actions={actions}
        />
      );

      const button = screen.getByRole('button', { name: 'Disabled Action' });
      expect(button).toBeDisabled();
    });

    it('auto-focuses specified action', () => {
      const actions: AlertAction[] = [
        {
          id: 'normal',
          label: 'Normal',
          onClick: jest.fn()
        },
        {
          id: 'focused',
          label: 'Auto Focus',
          onClick: jest.fn(),
          autoFocus: true
        }
      ];

      render(
        <AlertMessage
          message="Alert with auto-focus"
          actions={actions}
        />
      );

      const focusButton = screen.getByRole('button', { name: 'Auto Focus' });
      expect(focusButton).toHaveFocus();
    });

    it('shows keyboard shortcuts in screen reader text', () => {
      const actions: AlertAction[] = [
        {
          id: 'save',
          label: 'Save',
          onClick: jest.fn(),
          shortcut: 'Ctrl+S'
        }
      ];

      render(
        <AlertMessage
          message="Alert with shortcut"
          actions={actions}
        />
      );

      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).toHaveAttribute('aria-keyshortcuts', 'Ctrl+S');
      expect(screen.getByText('(keyboard shortcut: Ctrl+S)')).toBeInTheDocument();
    });
  });

  // =========================
  // KEYBOARD NAVIGATION TESTS
  // =========================

  describe('Keyboard Navigation', () => {
    it('handles Escape key for dismissible alerts', async () => {
      const onDismiss = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <AlertMessage
          message="Dismissible alert"
          dismissible
          onDismiss={onDismiss}
        />
      );

      const alert = screen.getByRole('status');
      alert.focus();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });
    });

    it('handles Escape key for modal alerts', async () => {
      const onClose = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <AlertMessage
          message="Modal alert"
          alertStyle="modal"
          onClose={onClose}
        />
      );

      const alert = screen.getByRole('alertdialog');
      alert.focus();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('navigates between action buttons with arrow keys', async () => {
      const actions: AlertAction[] = [
        { id: 'first', label: 'First', onClick: jest.fn() },
        { id: 'second', label: 'Second', onClick: jest.fn() },
        { id: 'third', label: 'Third', onClick: jest.fn() }
      ];

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <AlertMessage
          message="Alert with multiple actions"
          actions={actions}
        />
      );

      const firstButton = screen.getByRole('button', { name: 'First' });
      const secondButton = screen.getByRole('button', { name: 'Second' });

      firstButton.focus();
      expect(firstButton).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(secondButton).toHaveFocus();
    });
  });

  // =========================
  // ANIMATION TESTS
  // =========================

  describe('Animation and Motion', () => {
    it('applies animation classes when animate is true', () => {
      render(
        <AlertMessage
          message="Animated alert"
          animate={true}
          data-testid="animated-alert"
        />
      );

      const alert = screen.getByTestId('animated-alert');
      expect(alert).toHaveClass('transition-all');
    });

    it('respects reduced motion preference', () => {
      // Mock reduced motion preference
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      render(
        <AlertMessage
          message="Reduced motion alert"
          animate={true}
          respectMotion={true}
          data-testid="motion-alert"
        />
      );

      const alert = screen.getByTestId('motion-alert');
      expect(alert).toHaveClass('transition-opacity');
      expect(alert).not.toHaveClass('transition-all');
    });
  });

  // =========================
  // STYLE VARIANTS TESTS
  // =========================

  describe('Style Variants', () => {
    it('applies correct classes for each alert style', () => {
      const styles = ['inline', 'toast', 'banner', 'modal'] as const;

      styles.forEach(style => {
        const { unmount } = render(
          <AlertMessage
            message={`${style} alert`}
            alertStyle={style}
            data-testid={`${style}-alert`}
          />
        );

        const alert = screen.getByTestId(`${style}-alert`);
        expect(alert).toHaveAttribute('data-style', style);

        unmount();
      });
    });
  });

  // =========================
  // IMPERATIVE API TESTS
  // =========================

  describe('Imperative API', () => {
    it('exposes focus method through ref', () => {
      const ref = React.createRef<AlertMessageRef>();

      render(
        <AlertMessage
          ref={ref}
          message="Alert with ref"
        />
      );

      expect(ref.current?.focus).toBeDefined();
      expect(typeof ref.current?.focus).toBe('function');
    });

    it('exposes dismiss method through ref', () => {
      const ref = React.createRef<AlertMessageRef>();
      const onDismiss = jest.fn();

      render(
        <AlertMessage
          ref={ref}
          message="Alert with ref"
          dismissible
          onDismiss={onDismiss}
        />
      );

      act(() => {
        ref.current?.dismiss();
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('exposes show method through ref', () => {
      const ref = React.createRef<AlertMessageRef>();
      const onShow = jest.fn();

      render(
        <AlertMessage
          ref={ref}
          message="Alert with ref"
          open={false}
          onShow={onShow}
        />
      );

      act(() => {
        ref.current?.show();
      });

      expect(onShow).toHaveBeenCalledTimes(1);
    });

    it('exposes getElement method through ref', () => {
      const ref = React.createRef<AlertMessageRef>();

      render(
        <AlertMessage
          ref={ref}
          message="Alert with ref"
        />
      );

      const element = ref.current?.getElement();
      expect(element).toBeInTheDocument();
      expect(element).toHaveAttribute('role', 'status');
    });
  });

  // =========================
  // CONVENIENCE COMPONENTS TESTS
  // =========================

  describe('Convenience Components', () => {
    it('InfoAlert renders with info severity', () => {
      render(<InfoAlert message="Info message" />);

      const alert = screen.getByRole('status');
      expect(alert).toHaveAttribute('data-severity', 'info');
    });

    it('SuccessAlert renders with success severity', () => {
      render(<SuccessAlert message="Success message" />);

      const alert = screen.getByRole('status');
      expect(alert).toHaveAttribute('data-severity', 'success');
    });

    it('WarningAlert renders with warning severity', () => {
      render(<WarningAlert message="Warning message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-severity', 'warning');
    });

    it('ErrorAlert renders with error severity', () => {
      render(<ErrorAlert message="Error message" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('data-severity', 'error');
    });
  });

  // =========================
  // TOAST FUNCTIONALITY TESTS
  // =========================

  describe('Toast Functionality', () => {
    beforeEach(() => {
      // Mock ReactDOM for toast functionality
      (window as any).ReactDOM = {
        createRoot: jest.fn(() => ({
          render: jest.fn(),
          unmount: jest.fn()
        })),
        render: jest.fn()
      };
    });

    it('showToast creates toast container', () => {
      const toastId = showToast({
        message: 'Toast message',
        severity: 'info'
      });

      expect(toastId).toBeDefined();
      expect(toastId).toMatch(/^toast-\d+$/);

      const container = document.getElementById('toast-container-top-right');
      expect(container).toBeInTheDocument();
    });

    it('showToast with different positions creates different containers', () => {
      showToast({
        message: 'Top left toast',
        position: 'top-left'
      });

      showToast({
        message: 'Bottom right toast',
        position: 'bottom-right'
      });

      expect(document.getElementById('toast-container-top-left')).toBeInTheDocument();
      expect(document.getElementById('toast-container-bottom-right')).toBeInTheDocument();
    });
  });

  // =========================
  // SCREEN READER TESTS
  // =========================

  describe('Screen Reader Announcements', () => {
    let mockAnnounce: jest.Mock;
    let mockAnnounceError: jest.Mock;
    let mockAnnounceSuccess: jest.Mock;

    beforeEach(() => {
      mockAnnounce = jest.fn();
      mockAnnounceError = jest.fn();
      mockAnnounceSuccess = jest.fn();

      // Mock the hook implementation
      jest.doMock('../../src/renderer/hooks/useScreenReaderAnnouncements', () => ({
        useScreenReaderAnnouncements: () => ({
          announce: mockAnnounce,
          announceError: mockAnnounceError,
          announceSuccess: mockAnnounceSuccess
        })
      }));
    });

    it('announces error messages with announceError', async () => {
      render(
        <AlertMessage
          message="Error occurred"
          severity="error"
        />
      );

      await waitFor(() => {
        expect(mockAnnounceError).toHaveBeenCalledWith('Error occurred');
      });
    });

    it('announces success messages with announceSuccess', async () => {
      render(
        <AlertMessage
          message="Operation successful"
          severity="success"
        />
      );

      await waitFor(() => {
        expect(mockAnnounceSuccess).toHaveBeenCalledWith('Operation successful');
      });
    });

    it('announces info messages with announce', async () => {
      render(
        <AlertMessage
          message="Information message"
          severity="info"
        />
      );

      await waitFor(() => {
        expect(mockAnnounce).toHaveBeenCalledWith('Information message', 'polite');
      });
    });

    it('uses title for announcement when message is JSX', async () => {
      const jsxMessage = <div>Complex <strong>JSX</strong> content</div>;

      render(
        <AlertMessage
          title="Important Notice"
          message={jsxMessage}
          severity="warning"
        />
      );

      await waitFor(() => {
        expect(mockAnnounce).toHaveBeenCalledWith('Important Notice', 'assertive');
      });
    });
  });

  // =========================
  // CONTROLLED STATE TESTS
  // =========================

  describe('Controlled State', () => {
    it('shows/hides based on open prop', () => {
      const { rerender } = render(
        <AlertMessage
          message="Controlled alert"
          open={false}
        />
      );

      expect(screen.queryByText('Controlled alert')).not.toBeInTheDocument();

      rerender(
        <AlertMessage
          message="Controlled alert"
          open={true}
        />
      );

      expect(screen.getByText('Controlled alert')).toBeInTheDocument();
    });

    it('calls onShow when open changes to true', () => {
      const onShow = jest.fn();

      const { rerender } = render(
        <AlertMessage
          message="Show test"
          open={false}
          onShow={onShow}
        />
      );

      rerender(
        <AlertMessage
          message="Show test"
          open={true}
          onShow={onShow}
        />
      );

      expect(onShow).toHaveBeenCalledTimes(1);
    });
  });

  // =========================
  // ERROR BOUNDARY TESTS
  // =========================

  describe('Error Handling', () => {
    it('handles missing dependencies gracefully', () => {
      // Test that component doesn't crash if hooks are unavailable
      jest.doMock('../../src/renderer/hooks/useScreenReaderAnnouncements', () => ({
        useScreenReaderAnnouncements: () => ({
          announce: undefined,
          announceError: undefined,
          announceSuccess: undefined
        })
      }));

      expect(() => {
        render(<AlertMessage message="Test error handling" />);
      }).not.toThrow();
    });

    it('handles invalid auto-dismiss values', () => {
      expect(() => {
        render(
          <AlertMessage
            message="Invalid auto-dismiss"
            autoDismiss={-1}
            dismissible
          />
        );
      }).not.toThrow();
    });
  });
});