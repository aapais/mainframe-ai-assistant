/**
 * AlertMessage Component Accessibility Tests
 * Demonstrates comprehensive accessibility testing for the AlertMessage component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  runAccessibilityTests,
  testScreenReaderAnnouncements,
  validateColorContrast,
  accessibilityScenarios
} from '../accessibility';
import { AriaLiveProvider } from '../../components/AriaLiveRegions';
import { useAriaLive } from '../../hooks/useAriaLive';

// Mock AlertMessage component for testing
interface AlertMessageProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onDismiss?: () => void;
  autoDissmiss?: boolean;
  duration?: number;
}

const AlertMessage: React.FC<AlertMessageProps> = ({
  type,
  message,
  onDismiss,
  autoDissmiss = false,
  duration = 5000
}) => {
  const { announceSuccess, announceError, announceStatus } = useAriaLive();
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    // Announce the alert message
    switch (type) {
      case 'success':
        announceSuccess(message);
        break;
      case 'error':
        announceError(message);
        break;
      case 'warning':
        announceError(`Warning: ${message}`);
        break;
      case 'info':
        announceStatus(message);
        break;
    }
  }, [type, message, announceSuccess, announceError, announceStatus]);

  React.useEffect(() => {
    if (autoDissmiss && isVisible) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoDissmiss, duration, isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleDismiss();
    }
  };

  if (!isVisible) return null;

  const getAlertStyles = () => {
    const baseStyles = 'p-4 rounded-lg border flex items-center justify-between';
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 text-green-800 border-green-200`;
      case 'error':
        return `${baseStyles} bg-red-50 text-red-800 border-red-200`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 text-yellow-800 border-yellow-200`;
      case 'info':
        return `${baseStyles} bg-blue-50 text-blue-800 border-blue-200`;
      default:
        return baseStyles;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  return (
    <div
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={getAlertStyles()}
      data-testid={`alert-${type}`}
      onKeyDown={handleKeyDown}
      tabIndex={onDismiss ? 0 : -1}
    >
      <div className="flex items-center">
        <span
          className="mr-2 text-lg"
          aria-hidden="true"
          data-testid="alert-icon"
        >
          {getIcon()}
        </span>
        <span className="font-medium">{message}</span>
      </div>

      {onDismiss && (
        <button
          onClick={handleDismiss}
          aria-label={`Dismiss ${type} alert`}
          className="ml-4 p-1 rounded hover:bg-opacity-20 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          data-testid="alert-dismiss"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
};

describe('AlertMessage Accessibility Tests', () => {
  beforeEach(() => {
    global.a11yTestUtils.setupAccessibleEnvironment();
  });

  afterEach(() => {
    global.a11yTestUtils.cleanupAccessibleEnvironment();
  });

  describe('Basic Accessibility Compliance', () => {
    test('success alert should be accessible', async () => {
      await runAccessibilityTests(
        <AriaLiveProvider>
          <AlertMessage type="success" message="Operation completed successfully" />
        </AriaLiveProvider>
      );
    });

    test('error alert should be accessible', async () => {
      await runAccessibilityTests(
        <AriaLiveProvider>
          <AlertMessage type="error" message="An error occurred" />
        </AriaLiveProvider>
      );
    });

    test('warning alert should be accessible', async () => {
      await runAccessibilityTests(
        <AriaLiveProvider>
          <AlertMessage type="warning" message="Please review your input" />
        </AriaLiveProvider>
      );
    });

    test('info alert should be accessible', async () => {
      await runAccessibilityTests(
        <AriaLiveProvider>
          <AlertMessage type="info" message="Additional information available" />
        </AriaLiveProvider>
      );
    });
  });

  describe('ARIA Live Announcements', () => {
    test('should announce success messages', async () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="success" message="Form saved successfully" />
        </AriaLiveProvider>
      );

      await global.waitForAnnouncement('Form saved successfully');
    });

    test('should announce error messages with assertive politeness', async () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="error" message="Validation failed" />
        </AriaLiveProvider>
      );

      await global.waitForAnnouncement('Validation failed');

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveAttribute('aria-live', 'assertive');
    });

    test('should announce warning messages', async () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="warning" message="Unsaved changes" />
        </AriaLiveProvider>
      );

      await global.waitForAnnouncement('Warning: Unsaved changes');
    });

    test('should announce info messages', async () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="info" message="System maintenance scheduled" />
        </AriaLiveProvider>
      );

      await global.waitForAnnouncement('System maintenance scheduled');
    });
  });

  describe('Keyboard Interaction', () => {
    test('dismissible alerts should handle Escape key', () => {
      const handleDismiss = jest.fn();

      render(
        <AriaLiveProvider>
          <AlertMessage
            type="info"
            message="Dismissible alert"
            onDismiss={handleDismiss}
          />
        </AriaLiveProvider>
      );

      const alertElement = screen.getByRole('alert');

      // Should be focusable when dismissible
      expect(alertElement).toHaveAttribute('tabIndex', '0');

      // Test Escape key
      fireEvent.keyDown(alertElement, { key: 'Escape' });
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    test('non-dismissible alerts should not be focusable', () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="info" message="Non-dismissible alert" />
        </AriaLiveProvider>
      );

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveAttribute('tabIndex', '-1');
    });

    test('dismiss button should be accessible', () => {
      const handleDismiss = jest.fn();

      render(
        <AriaLiveProvider>
          <AlertMessage
            type="success"
            message="Success message"
            onDismiss={handleDismiss}
          />
        </AriaLiveProvider>
      );

      const dismissButton = screen.getByTestId('alert-dismiss');

      // Should have accessible label
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss success alert');

      // Should be clickable
      fireEvent.click(dismissButton);
      expect(handleDismiss).toHaveBeenCalledTimes(1);

      // Should handle keyboard activation
      fireEvent.keyDown(dismissButton, { key: 'Enter' });
    });
  });

  describe('Color Contrast Validation', () => {
    test('success alert should have sufficient color contrast', () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="success" message="Success message" />
        </AriaLiveProvider>
      );

      // Test green text on green background (typical success colors)
      const contrast = validateColorContrast('#065f46', '#d1fae5'); // dark green on light green
      expect(contrast.passes).toBe(true);
      expect(contrast.level).toBe('AAA');
    });

    test('error alert should have sufficient color contrast', () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="error" message="Error message" />
        </AriaLiveProvider>
      );

      // Test red text on red background (typical error colors)
      const contrast = validateColorContrast('#7f1d1d', '#fee2e2'); // dark red on light red
      expect(contrast.passes).toBe(true);
      expect(contrast.level).toBe('AAA');
    });

    test('warning alert should have sufficient color contrast', () => {
      // Test yellow/orange colors
      const contrast = validateColorContrast('#78350f', '#fef3c7'); // dark yellow on light yellow
      expect(contrast.passes).toBe(true);
    });

    test('info alert should have sufficient color contrast', () => {
      // Test blue colors
      const contrast = validateColorContrast('#1e3a8a', '#dbeafe'); // dark blue on light blue
      expect(contrast.passes).toBe(true);
    });
  });

  describe('ARIA Attributes', () => {
    test('should have correct ARIA attributes', () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="error" message="Error message" />
        </AriaLiveProvider>
      );

      const alertElement = screen.getByRole('alert');

      expect(alertElement).toHaveAttribute('role', 'alert');
      expect(alertElement).toHaveAttribute('aria-live', 'assertive');
      expect(alertElement).toHaveAttribute('aria-atomic', 'true');
    });

    test('should hide decorative icons from screen readers', () => {
      render(
        <AriaLiveProvider>
          <AlertMessage type="success" message="Success message" />
        </AriaLiveProvider>
      );

      const icon = screen.getByTestId('alert-icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');

      const dismissButton = screen.getByText('×');
      expect(dismissButton).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Auto-dismiss Functionality', () => {
    test('should auto-dismiss after specified duration', async () => {
      const handleDismiss = jest.fn();

      render(
        <AriaLiveProvider>
          <AlertMessage
            type="info"
            message="Auto-dismiss message"
            onDismiss={handleDismiss}
            autoDissmiss={true}
            duration={1000}
          />
        </AriaLiveProvider>
      );

      // Should be visible initially
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Wait for auto-dismiss
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    test('should clean up timers on unmount', () => {
      const { unmount } = render(
        <AriaLiveProvider>
          <AlertMessage
            type="info"
            message="Auto-dismiss message"
            autoDissmiss={true}
            duration={5000}
          />
        </AriaLiveProvider>
      );

      // Should not throw error on unmount
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Custom Accessibility Tests', () => {
    test('should follow semantic HTML structure', async () => {
      const { container } = render(
        <AriaLiveProvider>
          <AlertMessage
            type="error"
            message="Error message"
            onDismiss={() => {}}
          />
        </AriaLiveProvider>
      );

      await runAccessibilityTests(
        <AriaLiveProvider>
          <AlertMessage
            type="error"
            message="Error message"
            onDismiss={() => {}}
          />
        </AriaLiveProvider>,
        {
          customTests: [
            async (container) => {
              // Check that alert has proper role
              const alert = container.querySelector('[role="alert"]');
              expect(alert).toBeInTheDocument();

              // Check that dismiss button is a proper button element
              const button = container.querySelector('button');
              expect(button).toBeInTheDocument();
              expect(button).toHaveAttribute('aria-label');
            },
            async (container) => {
              // Check for proper focus management
              const dismissButton = container.querySelector('button');
              if (dismissButton) {
                expect(dismissButton).toHaveClass('focus:ring-2');
                expect(dismissButton).toHaveClass('focus:outline-none');
              }
            }
          ]
        }
      );
    });

    test('should handle multiple alerts properly', async () => {
      render(
        <AriaLiveProvider>
          <div>
            <AlertMessage type="success" message="Success message" />
            <AlertMessage type="error" message="Error message" />
            <AlertMessage type="warning" message="Warning message" />
          </div>
        </AriaLiveProvider>
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(3);

      // Each alert should have unique test IDs
      expect(screen.getByTestId('alert-success')).toBeInTheDocument();
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
      expect(screen.getByTestId('alert-warning')).toBeInTheDocument();

      // Test that all announcements are made
      await global.waitForAnnouncement('Success message');
      await global.waitForAnnouncement('Error message');
      await global.waitForAnnouncement('Warning: Warning message');
    });
  });

  describe('Integration with Form Validation', () => {
    test('should work properly in form validation context', async () => {
      const FormWithValidation = () => {
        const [error, setError] = React.useState<string | null>(null);
        const [success, setSuccess] = React.useState<string | null>(null);

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const formData = new FormData(form);
          const email = formData.get('email') as string;

          if (!email) {
            setError('Email is required');
            setSuccess(null);
          } else {
            setError(null);
            setSuccess('Form submitted successfully');
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                aria-describedby={error ? 'email-error' : undefined}
                aria-invalid={!!error}
              />
              {error && (
                <div id="email-error">
                  <AlertMessage
                    type="error"
                    message={error}
                    onDismiss={() => setError(null)}
                  />
                </div>
              )}
            </div>

            {success && (
              <AlertMessage
                type="success"
                message={success}
                autoDissmiss={true}
                duration={3000}
              />
            )}

            <button type="submit">Submit</button>
          </form>
        );
      };

      render(
        <AriaLiveProvider>
          <FormWithValidation />
        </AriaLiveProvider>
      );

      // Test form validation
      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);

      // Should show error alert
      await global.waitForAnnouncement('Email is required');

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();

      // Fill form and submit
      const emailInput = screen.getByLabelText('Email *');
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      // Should show success alert
      await global.waitForAnnouncement('Form submitted successfully');
    });
  });
});

describe('AlertMessage Edge Cases', () => {
  test('should handle empty messages gracefully', () => {
    render(
      <AriaLiveProvider>
        <AlertMessage type="info" message="" />
      </AriaLiveProvider>
    );

    // Should still render but with empty content
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  test('should handle very long messages', async () => {
    const longMessage = 'This is a very long alert message that should still be accessible and properly announced to screen readers even though it contains a lot of text that might wrap to multiple lines.';

    render(
      <AriaLiveProvider>
        <AlertMessage type="info" message={longMessage} />
      </AriaLiveProvider>
    );

    await global.waitForAnnouncement(longMessage);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(longMessage);
  });

  test('should handle rapid successive alerts', async () => {
    const AlertContainer = () => {
      const [alerts, setAlerts] = React.useState<string[]>([]);

      const addAlert = () => {
        setAlerts(prev => [...prev, `Alert ${prev.length + 1}`]);
      };

      return (
        <div>
          <button onClick={addAlert}>Add Alert</button>
          {alerts.map((message, index) => (
            <AlertMessage
              key={index}
              type="info"
              message={message}
              onDismiss={() => {
                setAlerts(prev => prev.filter((_, i) => i !== index));
              }}
            />
          ))}
        </div>
      );
    };

    render(
      <AriaLiveProvider>
        <AlertContainer />
      </AriaLiveProvider>
    );

    const addButton = screen.getByText('Add Alert');

    // Add multiple alerts rapidly
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    // All alerts should be present and accessible
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(3);

    // Each should have proper ARIA attributes
    alerts.forEach(alert => {
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert).toHaveAttribute('aria-live');
    });
  });
});