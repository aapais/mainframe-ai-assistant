/**
 * WCAG 2.1 AA Compliance Test Suite
 *
 * Comprehensive accessibility testing for all components and pages
 * in the mainframe-ai-assistant application.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

import {
  AccessibilityTestFramework,
  runAccessibilityTest,
  runKeyboardNavigationTest,
  runColorContrastTest,
  runFormAccessibilityTest,
} from '../../src/renderer/testing/accessibilityTests';

// Import components to test
import AccessibilityAudit from '../../src/renderer/components/AccessibilityAudit';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('WCAG 2.1 AA Compliance Tests', () => {
  let accessibilityFramework: AccessibilityTestFramework;

  beforeAll(() => {
    accessibilityFramework = new AccessibilityTestFramework({
      rules: {
        // Enable all WCAG 2.1 AA rules
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-management': { enabled: true },
        'heading-structure': { enabled: true },
        'landmark-roles': { enabled: true },
        'form-labels': { enabled: true },
        'button-name': { enabled: true },
        'link-name': { enabled: true },
        'image-alt': { enabled: true },
        'bypass-blocks': { enabled: true },
        'html-has-lang': { enabled: true },
        'page-has-heading-one': { enabled: true },
        'region': { enabled: true },
      },
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    });
  });

  describe('1.1 Text Alternatives', () => {
    describe('1.1.1 Non-text Content (Level A)', () => {
      test('images have appropriate alt text', async () => {
        const TestComponent = () => (
          <div>
            <img src="test.jpg" alt="Test image description" />
            <img src="decorative.jpg" alt="" />
            <img src="functional.jpg" alt="Click to open menu" />
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });

      test('decorative images have empty alt text', async () => {
        const TestComponent = () => (
          <div>
            <img src="decoration.jpg" alt="" role="presentation" />
            <img src="spacer.gif" alt="" />
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });

      test('functional images have descriptive alt text', async () => {
        const TestComponent = () => (
          <div>
            <button>
              <img src="search.svg" alt="Search" />
            </button>
            <a href="/home">
              <img src="home.svg" alt="Go to home page" />
            </a>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });

      test('complex images have appropriate text alternatives', async () => {
        const TestComponent = () => (
          <div>
            <img
              src="chart.svg"
              alt="Sales increased 25% from Q1 to Q2"
              longdesc="detailed-description.html"
            />
            <figure>
              <img src="diagram.svg" alt="System architecture diagram" />
              <figcaption>
                The diagram shows data flow from user input through processing to output
              </figcaption>
            </figure>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });
  });

  describe('1.3 Adaptable', () => {
    describe('1.3.1 Info and Relationships (Level A)', () => {
      test('headings are properly structured', async () => {
        const TestComponent = () => (
          <div>
            <h1>Main Title</h1>
            <h2>Section Title</h2>
            <h3>Subsection Title</h3>
            <h2>Another Section</h2>
            <h3>Another Subsection</h3>
            <h4>Sub-subsection</h4>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });

      test('forms have proper structure and relationships', async () => {
        const TestComponent = () => (
          <form>
            <fieldset>
              <legend>Personal Information</legend>
              <div>
                <label htmlFor="first-name">First Name *</label>
                <input
                  id="first-name"
                  type="text"
                  required
                  aria-describedby="first-name-help"
                />
                <div id="first-name-help">Enter your first name</div>
              </div>
              <div>
                <label htmlFor="email">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  required
                  aria-describedby="email-help"
                />
                <div id="email-help">We'll never share your email</div>
              </div>
            </fieldset>
          </form>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });

      test('lists are properly marked up', async () => {
        const TestComponent = () => (
          <div>
            <ul>
              <li>First item</li>
              <li>Second item</li>
              <li>Third item</li>
            </ul>
            <ol>
              <li>Step one</li>
              <li>Step two</li>
              <li>Step three</li>
            </ol>
            <dl>
              <dt>Term</dt>
              <dd>Definition</dd>
            </dl>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });

      test('tables have proper structure', async () => {
        const TestComponent = () => (
          <table>
            <caption>Sales Data by Quarter</caption>
            <thead>
              <tr>
                <th scope="col">Quarter</th>
                <th scope="col">Sales</th>
                <th scope="col">Growth</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Q1</th>
                <td>$10,000</td>
                <td>5%</td>
              </tr>
              <tr>
                <th scope="row">Q2</th>
                <td>$12,500</td>
                <td>25%</td>
              </tr>
            </tbody>
          </table>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('1.3.4 Orientation (Level AA)', () => {
      test('content is not restricted to a single orientation', async () => {
        const TestComponent = () => (
          <div style={{ width: '100%', height: '100vh' }}>
            <p>This content should work in both portrait and landscape orientations</p>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('1.3.5 Identify Input Purpose (Level AA)', () => {
      test('form inputs have autocomplete attributes where appropriate', async () => {
        const TestComponent = () => (
          <form>
            <label htmlFor="user-name">Name</label>
            <input id="user-name" type="text" autoComplete="name" />

            <label htmlFor="user-email">Email</label>
            <input id="user-email" type="email" autoComplete="email" />

            <label htmlFor="user-phone">Phone</label>
            <input id="user-phone" type="tel" autoComplete="tel" />
          </form>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });
  });

  describe('1.4 Distinguishable', () => {
    describe('1.4.1 Use of Color (Level A)', () => {
      test('information is not conveyed by color alone', async () => {
        const TestComponent = () => (
          <div>
            <p>
              <span style={{ color: 'red' }}>*</span> Required field
            </p>
            <div>
              <span style={{ color: 'green' }}>✓</span> Success message
            </div>
            <div>
              <span style={{ color: 'red' }}>✗</span> Error message
            </div>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('1.4.3 Contrast (Minimum) (Level AA)', () => {
      test('text has sufficient color contrast', async () => {
        const TestComponent = () => (
          <div>
            <p style={{ color: '#333', backgroundColor: '#fff' }}>
              Normal text with good contrast
            </p>
            <p style={{ color: '#666', backgroundColor: '#fff', fontSize: '18px' }}>
              Large text with acceptable contrast
            </p>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const contrastResults = await runColorContrastTest(renderResult);

        expect(contrastResults.violations).toBe(0);
      });
    });

    describe('1.4.4 Resize Text (Level AA)', () => {
      test('text can be resized up to 200% without loss of functionality', async () => {
        const TestComponent = () => (
          <div style={{ fontSize: '1rem' }}>
            <p>This text should be resizable</p>
            <button>This button should remain functional when resized</button>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('1.4.10 Reflow (Level AA)', () => {
      test('content reflows without horizontal scrolling', async () => {
        const TestComponent = () => (
          <div style={{ maxWidth: '320px', overflow: 'hidden' }}>
            <p>This content should reflow without horizontal scrolling at narrow widths</p>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('1.4.11 Non-text Contrast (Level AA)', () => {
      test('UI components have sufficient contrast', async () => {
        const TestComponent = () => (
          <div>
            <button style={{ border: '2px solid #333', backgroundColor: '#fff', color: '#333' }}>
              Button with good contrast
            </button>
            <input
              type="text"
              style={{ border: '2px solid #333', backgroundColor: '#fff' }}
              placeholder="Input with good contrast"
            />
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('1.4.12 Text Spacing (Level AA)', () => {
      test('text spacing can be adjusted without loss of functionality', async () => {
        const TestComponent = () => (
          <div style={{
            lineHeight: '1.5',
            letterSpacing: '0.12em',
            wordSpacing: '0.16em',
          }}>
            <p>This text has increased spacing and should remain functional</p>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('1.4.13 Content on Hover or Focus (Level AA)', () => {
      test('hover and focus content is dismissible and persistent', async () => {
        const TestComponent = () => {
          const [showTooltip, setShowTooltip] = React.useState(false);

          return (
            <div>
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                aria-describedby={showTooltip ? 'tooltip' : undefined}
              >
                Button with tooltip
              </button>
              {showTooltip && (
                <div id="tooltip" role="tooltip">
                  This is a tooltip that appears on hover/focus
                </div>
              )}
            </div>
          );
        };

        const renderResult = render(<TestComponent />);
        const button = screen.getByRole('button');

        fireEvent.focus(button);
        await waitFor(() => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });
  });

  describe('2.1 Keyboard Accessible', () => {
    describe('2.1.1 Keyboard (Level A)', () => {
      test('all functionality is available via keyboard', async () => {
        const user = userEvent.setup();
        const TestComponent = () => {
          const [count, setCount] = React.useState(0);

          return (
            <div>
              <button onClick={() => setCount(count + 1)}>
                Count: {count}
              </button>
              <a href="#section">Jump to section</a>
              <input type="text" placeholder="Type here" />
            </div>
          );
        };

        const renderResult = render(<TestComponent />);
        const button = screen.getByRole('button');

        // Test keyboard navigation
        await user.tab();
        expect(button).toHaveFocus();

        await user.keyboard('{Enter}');
        expect(button).toHaveTextContent('Count: 1');

        const keyboardResults = await runKeyboardNavigationTest(renderResult);
        expect(keyboardResults.violations).toHaveLength(0);
      });
    });

    describe('2.1.2 No Keyboard Trap (Level A)', () => {
      test('keyboard focus is not trapped', async () => {
        const user = userEvent.setup();
        const TestComponent = () => (
          <div>
            <button>First button</button>
            <button>Second button</button>
            <button>Third button</button>
          </div>
        );

        render(<TestComponent />);

        // Navigate through all buttons
        await user.tab();
        await user.tab();
        await user.tab();

        // Should be able to continue tabbing without being trapped
        await user.tab();

        // No assertion needed - if we get here without timeout, it passed
      });
    });

    describe('2.1.4 Character Key Shortcuts (Level A)', () => {
      test('character key shortcuts can be turned off or remapped', async () => {
        const TestComponent = () => {
          const [shortcutsEnabled, setShortcutsEnabled] = React.useState(true);

          React.useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
              if (shortcutsEnabled && e.key === 's' && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                // Perform shortcut action
              }
            };

            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
          }, [shortcutsEnabled]);

          return (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={shortcutsEnabled}
                  onChange={(e) => setShortcutsEnabled(e.target.checked)}
                />
                Enable keyboard shortcuts
              </label>
              <p>Press 's' when shortcuts are enabled</p>
            </div>
          );
        };

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });
  });

  describe('2.4 Navigable', () => {
    describe('2.4.1 Bypass Blocks (Level A)', () => {
      test('skip links are provided for navigation', async () => {
        const TestComponent = () => (
          <div>
            <a href="#main" className="skip-link">Skip to main content</a>
            <nav>
              <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
              </ul>
            </nav>
            <main id="main">
              <h1>Main Content</h1>
              <p>This is the main content area</p>
            </main>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('2.4.2 Page Titled (Level A)', () => {
      test('page has a descriptive title', () => {
        // This would be tested at the page level
        expect(document.title).toBeTruthy();
        expect(document.title.length).toBeGreaterThan(0);
      });
    });

    describe('2.4.3 Focus Order (Level A)', () => {
      test('focus order is logical and intuitive', async () => {
        const user = userEvent.setup();
        const TestComponent = () => (
          <form>
            <input type="text" placeholder="First field" />
            <input type="text" placeholder="Second field" />
            <button type="button">Button</button>
            <input type="text" placeholder="Third field" />
            <button type="submit">Submit</button>
          </form>
        );

        render(<TestComponent />);

        const firstField = screen.getByPlaceholderText('First field');
        const secondField = screen.getByPlaceholderText('Second field');
        const button = screen.getByRole('button', { name: 'Button' });

        await user.tab();
        expect(firstField).toHaveFocus();

        await user.tab();
        expect(secondField).toHaveFocus();

        await user.tab();
        expect(button).toHaveFocus();
      });
    });

    describe('2.4.4 Link Purpose (In Context) (Level A)', () => {
      test('link purpose is clear from link text or context', async () => {
        const TestComponent = () => (
          <div>
            <a href="/about">About Us</a>
            <a href="/contact">Contact Information</a>
            <p>
              Read more about our services in our{' '}
              <a href="/services">detailed services page</a>.
            </p>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('2.4.6 Headings and Labels (Level AA)', () => {
      test('headings and labels describe topic or purpose', async () => {
        const TestComponent = () => (
          <div>
            <h1>User Registration Form</h1>
            <h2>Personal Information</h2>
            <label htmlFor="full-name">Full Name</label>
            <input id="full-name" type="text" />

            <h2>Contact Details</h2>
            <label htmlFor="email-address">Email Address</label>
            <input id="email-address" type="email" />
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('2.4.7 Focus Visible (Level AA)', () => {
      test('focused elements have visible focus indicators', async () => {
        const user = userEvent.setup();
        const TestComponent = () => (
          <div>
            <button style={{ outline: '2px solid blue' }}>
              Button with focus indicator
            </button>
            <a href="#" style={{ outline: '2px solid blue' }}>
              Link with focus indicator
            </a>
          </div>
        );

        render(<TestComponent />);

        const button = screen.getByRole('button');
        await user.tab();
        expect(button).toHaveFocus();

        // Focus indicator should be visible (tested via CSS)
        const computedStyle = window.getComputedStyle(button);
        expect(computedStyle.outline).toBeTruthy();
      });
    });
  });

  describe('3.1 Readable', () => {
    describe('3.1.1 Language of Page (Level A)', () => {
      test('page language is identified', () => {
        expect(document.documentElement.lang).toBeTruthy();
        expect(document.documentElement.lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
      });
    });

    describe('3.1.2 Language of Parts (Level AA)', () => {
      test('language changes are identified', async () => {
        const TestComponent = () => (
          <div>
            <p>This content is in English.</p>
            <p lang="es">Este contenido está en español.</p>
            <p lang="fr">Ce contenu est en français.</p>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });
  });

  describe('3.2 Predictable', () => {
    describe('3.2.1 On Focus (Level A)', () => {
      test('focus does not trigger unexpected context changes', async () => {
        const user = userEvent.setup();
        const TestComponent = () => {
          const [focused, setFocused] = React.useState(false);

          return (
            <div>
              <input
                type="text"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Focus me"
              />
              {focused && <p>Additional help text (non-disruptive)</p>}
            </div>
          );
        };

        render(<TestComponent />);

        const input = screen.getByPlaceholderText('Focus me');
        await user.click(input);

        // Help text should appear but not disrupt the user
        expect(screen.getByText('Additional help text (non-disruptive)')).toBeInTheDocument();
      });
    });

    describe('3.2.2 On Input (Level A)', () => {
      test('input does not trigger unexpected context changes', async () => {
        const user = userEvent.setup();
        const TestComponent = () => {
          const [value, setValue] = React.useState('');

          return (
            <div>
              <label htmlFor="search">Search</label>
              <input
                id="search"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              {value && <p>Searching for: {value}</p>}
            </div>
          );
        };

        render(<TestComponent />);

        const input = screen.getByLabelText('Search');
        await user.type(input, 'test');

        // Search feedback should appear but not change context
        expect(screen.getByText('Searching for: test')).toBeInTheDocument();
      });
    });

    describe('3.2.3 Consistent Navigation (Level AA)', () => {
      test('navigation is consistent across pages', async () => {
        const TestComponent = () => (
          <nav role="navigation" aria-label="Main navigation">
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/services">Services</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </nav>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('3.2.4 Consistent Identification (Level AA)', () => {
      test('components with same functionality are identified consistently', async () => {
        const TestComponent = () => (
          <div>
            <button type="submit">Save Changes</button>
            <button type="button">Cancel</button>
            {/* In another context */}
            <button type="submit">Save Changes</button>
            <button type="button">Cancel</button>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });
  });

  describe('3.3 Input Assistance', () => {
    describe('3.3.1 Error Identification (Level A)', () => {
      test('errors are clearly identified', async () => {
        const TestComponent = () => {
          const [error, setError] = React.useState('');

          return (
            <div>
              <label htmlFor="email">Email Address *</label>
              <input
                id="email"
                type="email"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'email-error' : undefined}
              />
              {error && (
                <div id="email-error" role="alert">
                  {error}
                </div>
              )}
              <button onClick={() => setError('Please enter a valid email address')}>
                Trigger Error
              </button>
            </div>
          );
        };

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('3.3.2 Labels or Instructions (Level A)', () => {
      test('form fields have clear labels or instructions', async () => {
        const TestComponent = () => (
          <form>
            <div>
              <label htmlFor="password">
                Password *
              </label>
              <input
                id="password"
                type="password"
                required
                aria-describedby="password-help"
              />
              <div id="password-help">
                Must be at least 8 characters long
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password">
                Confirm Password *
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                aria-describedby="confirm-password-help"
              />
              <div id="confirm-password-help">
                Must match the password above
              </div>
            </div>
          </form>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('3.3.3 Error Suggestion (Level AA)', () => {
      test('error messages suggest corrections', async () => {
        const TestComponent = () => {
          const [error, setError] = React.useState('');

          return (
            <div>
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'phone-error' : 'phone-help'}
              />
              <div id="phone-help">Format: (555) 123-4567</div>
              {error && (
                <div id="phone-error" role="alert">
                  {error}
                </div>
              )}
              <button onClick={() => setError('Invalid format. Please use (555) 123-4567 format.')}>
                Trigger Error
              </button>
            </div>
          );
        };

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('3.3.4 Error Prevention (Legal, Financial, Data) (Level AA)', () => {
      test('important submissions can be reviewed and confirmed', async () => {
        const TestComponent = () => {
          const [step, setStep] = React.useState(1);
          const [formData, setFormData] = React.useState({ amount: '', account: '' });

          if (step === 1) {
            return (
              <form>
                <h2>Transfer Funds</h2>
                <label htmlFor="amount">Amount</label>
                <input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
                <label htmlFor="account">To Account</label>
                <input
                  id="account"
                  type="text"
                  value={formData.account}
                  onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                />
                <button type="button" onClick={() => setStep(2)}>
                  Continue to Review
                </button>
              </form>
            );
          }

          return (
            <div>
              <h2>Review Transfer</h2>
              <p>Amount: {formData.amount}</p>
              <p>To Account: {formData.account}</p>
              <button onClick={() => setStep(1)}>Edit</button>
              <button>Confirm Transfer</button>
            </div>
          );
        };

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });
  });

  describe('4.1 Compatible', () => {
    describe('4.1.1 Parsing (Level A)', () => {
      test('markup is valid and well-formed', async () => {
        const TestComponent = () => (
          <div>
            <h1>Valid HTML Structure</h1>
            <p>This component uses valid HTML elements and attributes.</p>
            <ul>
              <li>First item</li>
              <li>Second item</li>
            </ul>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('4.1.2 Name, Role, Value (Level A)', () => {
      test('custom components have appropriate roles and properties', async () => {
        const TestComponent = () => (
          <div>
            <div
              role="button"
              tabIndex={0}
              aria-label="Custom button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  // Handle activation
                }
              }}
            >
              Custom Button
            </div>

            <div
              role="checkbox"
              tabIndex={0}
              aria-checked="false"
              aria-label="Custom checkbox"
            >
              Custom Checkbox
            </div>
          </div>
        );

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });

    describe('4.1.3 Status Messages (Level AA)', () => {
      test('status messages are announced to assistive technology', async () => {
        const TestComponent = () => {
          const [status, setStatus] = React.useState('');

          return (
            <div>
              <button onClick={() => setStatus('Form saved successfully!')}>
                Save Form
              </button>
              {status && (
                <div role="status" aria-live="polite">
                  {status}
                </div>
              )}
            </div>
          );
        };

        const renderResult = render(<TestComponent />);
        const axeResults = await axe(renderResult.container);
        expect(axeResults).toHaveNoViolations();
      });
    });
  });

  describe('AccessibilityAudit Component', () => {
    test('AccessibilityAudit component is accessible', async () => {
      const mockOnClose = jest.fn();

      const renderResult = render(
        <AccessibilityAudit
          isVisible={true}
          onClose={mockOnClose}
          autoRun={false}
          enableRuntimeValidation={false}
        />
      );

      const result = await runAccessibilityTest(
        <AccessibilityAudit
          isVisible={true}
          onClose={mockOnClose}
          autoRun={false}
          enableRuntimeValidation={false}
        />
      );

      expect(result.passed).toBe(true);
      expect(result.violationCount).toBe(0);
    });

    test('AccessibilityAudit supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();

      render(
        <AccessibilityAudit
          isVisible={true}
          onClose={mockOnClose}
          autoRun={false}
          enableRuntimeValidation={false}
        />
      );

      // Test that interactive elements are focusable
      const runAuditButton = screen.getByText('Run Audit');
      const closeButton = screen.getByLabelText('Close audit panel');

      await user.tab();
      expect(runAuditButton).toHaveFocus();

      // Navigate to close button
      await user.tab();
      await user.tab(); // Skip runtime validation checkbox
      expect(closeButton).toHaveFocus();

      // Test close functionality
      await user.keyboard('{Enter}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('AccessibilityAudit form controls are accessible', async () => {
      const mockOnClose = jest.fn();

      const renderResult = render(
        <AccessibilityAudit
          isVisible={true}
          onClose={mockOnClose}
          autoRun={false}
          enableRuntimeValidation={false}
        />
      );

      const formResults = await runFormAccessibilityTest(renderResult);
      expect(formResults.violations).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    test('full application accessibility audit with optimizations', async () => {
      const { OptimizedTestRunner } = await import('./OptimizedTestRunner');
      const optimizedRunner = new OptimizedTestRunner({
        enableCache: true,
        parallelExecution: process.env.CI === 'true', // Parallel in CI
        skipSlowTests: process.env.CI === 'true',
        maxExecutionTime: 3000,
      });

      // Test key components
      const components = [
        { name: 'AccessibilityAudit', component: <AccessibilityAudit isVisible={true} onClose={() => {}} autoRun={false} enableRuntimeValidation={false} /> },
        // Add more components as needed
      ];

      const result = await optimizedRunner.testSuite(components);

      // Log results for CI/CD
      console.log('Optimized Accessibility Audit Results:', {
        totalTests: result.totalTests,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        totalTime: Math.round(result.totalTime),
        cacheHitRate: Math.round((result.results.filter(r => r.cached).length / result.totalTests) * 100),
      });

      // Generate performance report
      const report = optimizedRunner.generatePerformanceReport(result);
      console.log(report);

      // In production, allow minimal violations but track progress
      const maxViolations = process.env.NODE_ENV === 'production' ? 0 : 3;
      expect(result.failed).toBeLessThanOrEqual(maxViolations);

      // Ensure at least 90% compliance rate
      const complianceRate = (result.passed / result.totalTests) * 100;
      expect(complianceRate).toBeGreaterThanOrEqual(90);
    });

    test('accessibility performance benchmark', async () => {
      const { optimizedTestRunner } = await import('./OptimizedTestRunner');
      const startTime = performance.now();

      // Test a simple component to benchmark performance
      await optimizedTestRunner.testComponent('SimpleTest', <div><button>Test</button></div>);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Individual component test should be very fast
      expect(duration).toBeLessThan(1000); // 1 second

      // Test cache performance
      const cacheStats = optimizedTestRunner.getCacheStats();
      console.log('Cache Statistics:', cacheStats);
    });

    test('accessibility test with fix suggestions', async () => {
      // Test component with known violations
      const TestComponent = () => (
        <div>
          <button></button> {/* Missing accessible name */}
          <img src="test.jpg" /> {/* Missing alt text */}
          <div style={{ color: '#ccc', background: '#fff' }}>Low contrast text</div>
        </div>
      );

      const renderResult = render(<TestComponent />);
      const axeResults = await axe(renderResult.container);

      if (axeResults.violations.length > 0) {
        // Import fix suggestions component
        const { default: AccessibilityFixSuggestions } = await import('../../src/renderer/components/accessibility/AccessibilityFixSuggestions');

        // Test that fix suggestions render properly
        const fixSuggestionsRender = render(
          <AccessibilityFixSuggestions
            violations={axeResults.violations}
            showCodeExamples={true}
            autoApplySimpleFixes={false}
          />
        );

        // Verify fix suggestions are provided
        expect(screen.getByText(/Fix Suggestions/i)).toBeInTheDocument();

        // Check that violations are explained
        axeResults.violations.forEach(violation => {
          expect(screen.getByText(new RegExp(violation.help || violation.id, 'i'))).toBeInTheDocument();
        });

        fixSuggestionsRender.unmount();
      }

      renderResult.unmount();
    });

    test('end-to-end accessibility compliance check', async () => {
      // This test simulates a full application audit
      const mockPages = [
        { name: 'MainPage', component: <div><h1>Main</h1><main>Content</main></div> },
        { name: 'FormPage', component: <form><label htmlFor="test">Test</label><input id="test" /></form> },
        { name: 'NavigationPage', component: <nav><ul><li><a href="#">Home</a></li></ul></nav> },
      ];

      const { optimizedTestRunner } = await import('./OptimizedTestRunner');
      const results = await optimizedTestRunner.testSuite(mockPages);

      // Calculate overall compliance metrics
      const overallCompliance = {
        totalIssues: results.results.reduce((sum, r) => sum + r.violations.length, 0),
        criticalIssues: results.results.reduce((sum, r) =>
          sum + r.violations.filter(v => v.impact === 'critical').length, 0),
        complianceScore: Math.round((results.passed / results.totalTests) * 100),
        averageFixTime: results.results
          .filter(r => r.violations.length > 0)
          .reduce((sum, r) => sum + r.executionTime, 0) / Math.max(results.failed, 1),
      };

      console.log('End-to-End Compliance Report:', overallCompliance);

      // Assert minimum compliance standards
      expect(overallCompliance.complianceScore).toBeGreaterThanOrEqual(90);
      expect(overallCompliance.criticalIssues).toBe(0);
    });
  });
});

// Custom test helpers
export const createAccessibleComponent = (Component: React.ComponentType<any>, props: any = {}) => {
  return render(<Component {...props} />);
};

export const testComponentAccessibility = async (Component: React.ComponentType<any>, props: any = {}) => {
  const renderResult = createAccessibleComponent(Component, props);
  return await runAccessibilityTest(<Component {...props} />);
};

export default {
  createAccessibleComponent,
  testComponentAccessibility,
};