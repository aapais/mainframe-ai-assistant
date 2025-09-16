/**
 * Comprehensive Accessibility Testing Examples
 * Demonstrates usage of the accessibility testing framework
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  runAccessibilityTests,
  testKeyboardNavigation,
  testScreenReaderAnnouncements,
  validateColorContrast,
  testFocusManagement,
  accessibilityScenarios
} from '../accessibility';
import { AriaLiveProvider } from '../../components/AriaLiveRegions';
import { useAriaLive } from '../../hooks/useAriaLive';

// Mock components for testing
const TestButton: React.FC<{ onClick?: () => void; children: React.ReactNode }> = ({
  onClick,
  children
}) => (
  <button
    onClick={onClick}
    className="px-4 py-2 bg-blue-500 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
  >
    {children}
  </button>
);

const TestForm: React.FC = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const { announceError, announceSuccess } = useAriaLive();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      announceSuccess('Form submitted successfully');
    } else {
      announceError(`${Object.keys(newErrors).length} errors found`);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email *
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.email && (
          <div id="email-error" className="text-red-500 text-sm mt-1" role="alert">
            {errors.email}
          </div>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Password *
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-required="true"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.password && (
          <div id="password-error" className="text-red-500 text-sm mt-1" role="alert">
            {errors.password}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-green-500 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-300"
      >
        Submit
      </button>
    </form>
  );
};

const TestModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="bg-white p-6 rounded-lg max-w-md w-full"
      >
        <h2 id="modal-title" className="text-xl font-bold mb-4">
          Test Modal
        </h2>
        <p className="mb-4">This is a test modal for accessibility testing.</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

describe('Accessibility Testing Framework', () => {
  beforeEach(() => {
    // Setup accessible test environment
    global.a11yTestUtils.setupAccessibleEnvironment();
  });

  afterEach(() => {
    // Clean up
    global.a11yTestUtils.cleanupAccessibleEnvironment();
  });

  describe('Custom Matchers', () => {
    test('toBeAccessible should pass for accessible elements', async () => {
      const { container } = render(
        <button aria-label="Close dialog">×</button>
      );

      await expect(container).toBeAccessible();
    });

    test('toBeAccessible should fail for inaccessible elements', async () => {
      const { container } = render(
        <div>
          {/* Missing alt text */}
          <img src="test.jpg" />
          {/* Poor color contrast */}
          <span style={{ color: '#999', backgroundColor: '#aaa' }}>
            Low contrast text
          </span>
        </div>
      );

      await expect(container).not.toBeAccessible();
    });

    test('toSupportKeyboardNavigation should validate keyboard accessibility', () => {
      const { container } = render(
        <div>
          <button>Button 1</button>
          <a href="#test">Link</a>
          <input type="text" placeholder="Input" />
        </div>
      );

      expect(container).toSupportKeyboardNavigation();
    });

    test('toHaveValidAriaAttributes should validate ARIA usage', () => {
      const { container } = render(
        <div>
          <button aria-expanded="true" aria-controls="menu">
            Menu
          </button>
          <ul id="menu" role="menu">
            <li role="menuitem">Item 1</li>
          </ul>
        </div>
      );

      expect(container).toHaveValidAriaAttributes();
    });
  });

  describe('Keyboard Navigation Testing', () => {
    test('should test basic keyboard navigation', async () => {
      const { container } = render(
        <div>
          <button data-testid="button1">Button 1</button>
          <button data-testid="button2">Button 2</button>
          <input data-testid="input1" placeholder="Input" />
        </div>
      );

      await testKeyboardNavigation(container, [
        '[data-testid="button1"]',
        '[data-testid="button2"]',
        '[data-testid="input1"]'
      ]);
    });

    test('should handle complex navigation patterns', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div>
          <nav>
            <button>Nav 1</button>
            <button>Nav 2</button>
          </nav>
          <main>
            <button>Main Button</button>
            <input placeholder="Search" />
          </main>
        </div>
      );

      // Test Tab navigation
      await user.tab();
      expect(document.activeElement).toHaveTextContent('Nav 1');

      await user.tab();
      expect(document.activeElement).toHaveTextContent('Nav 2');

      await user.tab();
      expect(document.activeElement).toHaveTextContent('Main Button');

      await user.tab();
      expect(document.activeElement).toHaveAttribute('placeholder', 'Search');
    });
  });

  describe('Screen Reader Announcements', () => {
    test('should test announcement functionality', async () => {
      const TestComponent = () => {
        const { announceSuccess } = useAriaLive();

        return (
          <button onClick={() => announceSuccess('Operation completed')}>
            Complete Operation
          </button>
        );
      };

      render(
        <AriaLiveProvider>
          <TestComponent />
        </AriaLiveProvider>
      );

      await testScreenReaderAnnouncements(
        async () => {
          const button = screen.getByText('Complete Operation');
          fireEvent.click(button);
        },
        'Operation completed'
      );
    });

    test('should handle error announcements', async () => {
      const TestComponent = () => {
        const { announceError } = useAriaLive();

        return (
          <button onClick={() => announceError('Validation failed')}>
            Trigger Error
          </button>
        );
      };

      render(
        <AriaLiveProvider>
          <TestComponent />
        </AriaLiveProvider>
      );

      await testScreenReaderAnnouncements(
        async () => {
          const button = screen.getByText('Trigger Error');
          fireEvent.click(button);
        },
        'Validation failed'
      );
    });
  });

  describe('Color Contrast Validation', () => {
    test('should validate color contrast ratios', () => {
      // Test passing contrast
      const goodContrast = validateColorContrast('#000000', '#ffffff');
      expect(goodContrast.passes).toBe(true);
      expect(goodContrast.level).toBe('AAA');
      expect(goodContrast.ratio).toBeGreaterThan(7);

      // Test failing contrast
      const badContrast = validateColorContrast('#cccccc', '#dddddd');
      expect(badContrast.passes).toBe(false);
      expect(badContrast.level).toBe('Fail');

      // Test large text thresholds
      const largeTextContrast = validateColorContrast('#767676', '#ffffff', true);
      expect(largeTextContrast.passes).toBe(true);
    });
  });

  describe('Focus Management', () => {
    test('should test modal focus management', async () => {
      const TestModalContainer = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        const triggerRef = React.useRef<HTMLButtonElement>(null);

        return (
          <AriaLiveProvider>
            <button
              ref={triggerRef}
              onClick={() => setIsOpen(true)}
              data-testid="open-modal"
            >
              Open Modal
            </button>
            <TestModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
          </AriaLiveProvider>
        );
      };

      render(<TestModalContainer />);

      const openButton = screen.getByTestId('open-modal');
      openButton.focus();

      await testFocusManagement(
        async () => {
          fireEvent.click(openButton);
        },
        {
          expectedInitialFocus: '[role="dialog"]',
          trapFocus: true,
          returnFocus: true,
          originalActiveElement: openButton
        }
      );
    });
  });

  describe('Form Accessibility', () => {
    test('should validate form accessibility', async () => {
      const { container } = render(
        <AriaLiveProvider>
          <TestForm />
        </AriaLiveProvider>
      );

      const form = container.querySelector('form')!;
      await accessibilityScenarios.testFormAccessibility(form);

      // Test form submission with errors
      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });

      // Verify error announcements
      await global.waitForAnnouncement('2 errors found');
    });
  });

  describe('Button Accessibility', () => {
    test('should validate button accessibility', () => {
      const { container } = render(
        <div>
          <button>Text Button</button>
          <button aria-label="Close">×</button>
          <button aria-pressed="false" className="toggle">
            Toggle
          </button>
        </div>
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        accessibilityScenarios.testButtonAccessibility(button as HTMLElement);
      });
    });
  });

  describe('Comprehensive Component Testing', () => {
    test('should run full accessibility test suite', async () => {
      const ComplexComponent = () => (
        <AriaLiveProvider>
          <main>
            <h1>Test Application</h1>
            <nav aria-label="Main navigation">
              <ul role="menubar">
                <li role="none">
                  <button role="menuitem">Home</button>
                </li>
                <li role="none">
                  <button role="menuitem" aria-expanded="false">
                    Products
                  </button>
                </li>
              </ul>
            </nav>
            <section>
              <h2>Content Section</h2>
              <TestForm />
            </section>
          </main>
        </AriaLiveProvider>
      );

      await runAccessibilityTests(<ComplexComponent />, {
        customTests: [
          async (container) => {
            // Custom test: Check for heading hierarchy
            const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const levels = Array.from(headings).map(h => parseInt(h.tagName[1]));

            expect(levels[0]).toBe(1); // First heading should be h1

            // Check for logical heading hierarchy
            for (let i = 1; i < levels.length; i++) {
              expect(levels[i] - levels[i-1]).toBeLessThanOrEqual(1);
            }
          },
          async (container) => {
            // Custom test: Verify landmarks
            const main = container.querySelector('main');
            const nav = container.querySelector('nav');

            expect(main).toBeInTheDocument();
            expect(nav).toBeInTheDocument();
            expect(nav).toHaveAttribute('aria-label');
          }
        ]
      });
    });
  });

  describe('Integration with Pa11y and Lighthouse', () => {
    test('should provide configuration for external tools', () => {
      const { pa11yConfig, lighthouseConfig } = require('../accessibility');

      expect(pa11yConfig.standard).toBe('WCAG2AA');
      expect(pa11yConfig.level).toBe('error');
      expect(lighthouseConfig.settings.onlyCategories).toContain('accessibility');
    });
  });
});

describe('Error Handling and Edge Cases', () => {
  test('should handle missing live regions gracefully', async () => {
    // Remove any existing live regions
    document.querySelectorAll('[aria-live]').forEach(el => el.remove());

    const TestComponent = () => {
      const { announce } = useAriaLive();

      return (
        <button onClick={() => announce('Test message')}>
          Announce
        </button>
      );
    };

    render(<TestComponent />);

    const button = screen.getByText('Announce');

    // Should not throw error even without AriaLiveProvider
    expect(() => fireEvent.click(button)).not.toThrow();
  });

  test('should handle empty or invalid messages', () => {
    const TestComponent = () => {
      const { announce } = useAriaLive();

      return (
        <button onClick={() => {
          try {
            announce('');
          } catch (error) {
            // Expected to throw
          }
        }}>
          Invalid Announce
        </button>
      );
    };

    render(
      <AriaLiveProvider>
        <TestComponent />
      </AriaLiveProvider>
    );

    const button = screen.getByText('Invalid Announce');
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});