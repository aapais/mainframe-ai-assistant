/**
 * Accessibility Testing Framework
 * Comprehensive WCAG 2.1 AA compliance testing for the Mainframe KB Assistant
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations, configureAxe } from 'jest-axe';
import { customRender, AssertionHelpers } from '../utils/TestingUtilities';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

/**
 * Accessibility Configuration
 */
interface AccessibilityConfig {
  wcagLevel: 'A' | 'AA' | 'AAA';
  tags: string[];
  rules: Record<string, any>;
  excludeSelectors: string[];
}

const DEFAULT_ACCESSIBILITY_CONFIG: AccessibilityConfig = {
  wcagLevel: 'AA',
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  rules: {
    // Color contrast requirements
    'color-contrast': { enabled: true },
    'color-contrast-enhanced': { enabled: false }, // AAA level

    // Keyboard navigation
    'focusable-content': { enabled: true },
    'tabindex': { enabled: true },
    'focus-order-semantics': { enabled: true },

    // Screen reader support
    'label': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },

    // Semantic structure
    'heading-order': { enabled: true },
    'landmark-unique': { enabled: true },
    'page-has-heading-one': { enabled: true },

    // Form accessibility
    'label-title-only': { enabled: true },
    'form-field-multiple-labels': { enabled: true }
  },
  excludeSelectors: [
    '.test-only',
    '[data-testid*="mock"]'
  ]
};

/**
 * Base Accessibility Test Class
 */
export abstract class BaseAccessibilityTest {
  protected config: AccessibilityConfig;
  protected axeInstance: any;

  constructor(config: Partial<AccessibilityConfig> = {}) {
    this.config = { ...DEFAULT_ACCESSIBILITY_CONFIG, ...config };
    this.axeInstance = configureAxe({
      tags: this.config.tags,
      rules: this.config.rules
    });
  }

  protected async runAxeTest(element: HTMLElement, context?: string): Promise<void> {
    const results = await this.axeInstance(element);
    expect(results).toHaveNoViolations();

    if (context) {
      console.log(`✓ Accessibility test passed for: ${context}`);
    }
  }

  protected testKeyboardNavigation(
    component: React.ReactElement,
    expectedFocusableElements: number
  ): void {
    customRender(component);

    const focusableElements = screen.getAllByRole((content, element) => {
      return element?.hasAttribute('tabindex') ||
             ['button', 'input', 'select', 'textarea', 'a'].includes(element?.tagName?.toLowerCase() || '');
    });

    expect(focusableElements).toHaveLength(expectedFocusableElements);

    // Test tab order
    let currentIndex = 0;
    focusableElements.forEach((element, index) => {
      element.focus();
      expect(document.activeElement).toBe(element);
      currentIndex = index;
    });
  }

  protected testAriaLabels(component: React.ReactElement): void {
    const { container } = customRender(component);

    // All interactive elements should have accessible names
    const interactiveElements = container.querySelectorAll(
      'button, input, select, textarea, a[href], [role="button"], [role="link"]'
    );

    interactiveElements.forEach(element => {
      const accessibleName =
        element.getAttribute('aria-label') ||
        element.getAttribute('aria-labelledby') ||
        element.textContent?.trim() ||
        element.getAttribute('title') ||
        element.getAttribute('alt');

      expect(accessibleName).toBeTruthy();
    });
  }

  protected testColorContrast(component: React.ReactElement): void {
    const { container } = customRender(component);

    // This would typically use a color contrast analyzer
    // For now, we'll test that text elements have appropriate styling
    const textElements = container.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');

    textElements.forEach(element => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;

      // Basic check - text should not be transparent or same as background
      expect(color).not.toBe('transparent');
      expect(color).not.toBe(backgroundColor);
    });
  }
}

/**
 * Component Accessibility Tests
 */
export class ComponentAccessibilityTest extends BaseAccessibilityTest {
  testSearchInterfaceAccessibility(searchComponent: React.ReactElement): void {
    describe('Search Interface Accessibility', () => {
      it('meets WCAG 2.1 AA requirements', async () => {
        const { container } = customRender(searchComponent);
        await this.runAxeTest(container, 'Search Interface');
      });

      it('supports keyboard navigation', async () => {
        customRender(searchComponent);

        const user = userEvent.setup();

        // Tab to search input
        await user.tab();
        expect(screen.getByRole('textbox')).toHaveFocus();

        // Tab to filters
        await user.tab();
        const filtersButton = screen.getByRole('button', { name: /filter/i });
        expect(filtersButton).toHaveFocus();

        // Tab to results (if any)
        await user.tab();
        // Should focus first result or next interactive element
        expect(document.activeElement).toBeDefined();
      });

      it('provides proper ARIA labels and roles', () => {
        customRender(searchComponent);

        // Search input should be labeled
        const searchInput = screen.getByRole('textbox');
        expect(searchInput).toHaveAttribute('aria-label');

        // Results should have proper structure
        const searchRegion = screen.getByRole('region', { name: /search results/i });
        expect(searchRegion).toBeInTheDocument();

        // Loading state should be announced
        const loadingIndicator = screen.queryByRole('status');
        if (loadingIndicator) {
          expect(loadingIndicator).toHaveAttribute('aria-live');
        }
      });

      it('announces search results to screen readers', async () => {
        customRender(searchComponent);

        const searchInput = screen.getByRole('textbox');
        await userEvent.type(searchInput, 'VSAM');

        // Results should be in a live region
        const resultsRegion = await screen.findByRole('region');
        expect(resultsRegion).toHaveAttribute('aria-live', 'polite');

        // Result count should be announced
        const resultCount = screen.getByText(/results? found/i);
        expect(resultCount).toBeInTheDocument();
      });

      it('handles error states accessibly', async () => {
        // Mock search error
        const ErrorComponent = () => {
          throw new Error('Search failed');
        };

        const { container } = customRender(
          <div role="alert" aria-live="assertive">
            Search error occurred
          </div>
        );

        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive');

        await this.runAxeTest(container, 'Error state');
      });
    });
  }

  testKBEntryAccessibility(kbEntryComponent: React.ReactElement): void {
    describe('KB Entry Accessibility', () => {
      it('meets WCAG 2.1 AA requirements', async () => {
        const { container } = customRender(kbEntryComponent);
        await this.runAxeTest(container, 'KB Entry');
      });

      it('structures content with proper headings', () => {
        customRender(kbEntryComponent);

        // Should have logical heading structure
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);

        // First heading should be h1 or h2 depending on context
        const firstHeading = headings[0];
        expect(['H1', 'H2', 'H3']).toContain(firstHeading.tagName);
      });

      it('makes interactive elements accessible', async () => {
        customRender(kbEntryComponent);

        // Rating buttons should be labeled
        const ratingButtons = screen.getAllByRole('button');
        ratingButtons.forEach(button => {
          expect(button).toHaveAttribute('aria-label');
        });

        // Copy button should announce action
        const copyButton = screen.queryByRole('button', { name: /copy/i });
        if (copyButton) {
          await userEvent.click(copyButton);

          // Should show confirmation
          const confirmation = await screen.findByRole('status');
          expect(confirmation).toBeInTheDocument();
        }
      });

      it('provides expandable content accessibility', async () => {
        customRender(kbEntryComponent);

        // Find expandable sections
        const expandButtons = screen.queryAllByRole('button', { expanded: false });

        for (const button of expandButtons) {
          expect(button).toHaveAttribute('aria-expanded', 'false');
          expect(button).toHaveAttribute('aria-controls');

          const controlsId = button.getAttribute('aria-controls');
          const expandedContent = document.getElementById(controlsId!);

          expect(expandedContent).toBeInTheDocument();

          // Test expansion
          await userEvent.click(button);
          expect(button).toHaveAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  testFormAccessibility(formComponent: React.ReactElement): void {
    describe('Form Accessibility', () => {
      it('meets WCAG 2.1 AA requirements', async () => {
        const { container } = customRender(formComponent);
        await this.runAxeTest(container, 'Form');
      });

      it('associates labels with form controls', () => {
        customRender(formComponent);

        const inputs = screen.getAllByRole('textbox');
        inputs.forEach(input => {
          const inputId = input.getAttribute('id');
          if (inputId) {
            // Should have associated label
            const label = document.querySelector(`label[for="${inputId}"]`);
            expect(label).toBeInTheDocument();
          } else {
            // Should have aria-label
            expect(input).toHaveAttribute('aria-label');
          }
        });
      });

      it('provides accessible error messages', async () => {
        customRender(formComponent);

        const submitButton = screen.getByRole('button', { name: /submit/i });
        await userEvent.click(submitButton);

        // Error messages should be in live regions
        const errorMessages = screen.getAllByRole('alert');
        errorMessages.forEach(error => {
          expect(error).toHaveAttribute('aria-live');
        });

        // Fields with errors should reference error messages
        const invalidInputs = screen.getAllByRole('textbox', { invalid: true });
        invalidInputs.forEach(input => {
          expect(input).toHaveAttribute('aria-describedby');
        });
      });

      it('supports keyboard-only interaction', async () => {
        customRender(formComponent);

        const user = userEvent.setup();

        // Should be able to navigate entire form with keyboard
        const formElements = screen.getAllByRole((content, element) =>
          ['textbox', 'button', 'checkbox', 'radio', 'combobox', 'listbox'].includes(
            element?.getAttribute('role') || ''
          )
        );

        // Tab through all elements
        for (let i = 0; i < formElements.length; i++) {
          await user.tab();
          expect(document.activeElement).toBe(formElements[i]);
        }
      });

      it('provides helpful field descriptions', () => {
        customRender(formComponent);

        // Required fields should be marked
        const requiredInputs = screen.getAllByRole('textbox', { required: true });
        requiredInputs.forEach(input => {
          // Should indicate required either through aria-required or visual indicator
          expect(
            input.hasAttribute('aria-required') ||
            input.hasAttribute('required') ||
            input.getAttribute('aria-describedby')
          ).toBeTruthy();
        });

        // Complex fields should have descriptions
        const complexInputs = screen.queryAllByRole('textbox');
        complexInputs.forEach(input => {
          const describedBy = input.getAttribute('aria-describedby');
          if (describedBy) {
            const description = document.getElementById(describedBy);
            expect(description).toBeInTheDocument();
          }
        });
      });
    });
  }
}

/**
 * Focus Management Tests
 */
export class FocusManagementTest extends BaseAccessibilityTest {
  testFocusManagement(): void {
    describe('Focus Management', () => {
      it('maintains focus order during dynamic content changes', async () => {
        const DynamicComponent = () => {
          const [showExtra, setShowExtra] = React.useState(false);

          return (
            <div>
              <button onClick={() => setShowExtra(!showExtra)}>
                Toggle Content
              </button>
              <input type="text" placeholder="Always visible" />
              {showExtra && (
                <div>
                  <input type="text" placeholder="Dynamic input" />
                  <button>Dynamic button</button>
                </div>
              )}
              <button>Final button</button>
            </div>
          );
        };

        customRender(<DynamicComponent />);

        const user = userEvent.setup();
        const toggleButton = screen.getByRole('button', { name: /toggle/i });

        // Initial focus order
        await user.tab();
        expect(toggleButton).toHaveFocus();

        // Show dynamic content
        await user.click(toggleButton);

        // Focus should move logically through all elements
        await user.tab(); // to first input
        await user.tab(); // to dynamic input
        await user.tab(); // to dynamic button
        await user.tab(); // to final button

        const finalButton = screen.getByRole('button', { name: /final/i });
        expect(finalButton).toHaveFocus();
      });

      it('traps focus in modal dialogs', async () => {
        const ModalComponent = () => {
          return (
            <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
              <h2 id="modal-title">Modal Dialog</h2>
              <input type="text" placeholder="First input" />
              <input type="text" placeholder="Second input" />
              <button>OK</button>
              <button>Cancel</button>
            </div>
          );
        };

        customRender(<ModalComponent />);

        const user = userEvent.setup();
        const modal = screen.getByRole('dialog');

        // Focus should be trapped within modal
        const modalInputs = screen.getAllByRole('textbox');
        const modalButtons = screen.getAllByRole('button');

        // Tab through modal elements
        modalInputs[0].focus();

        await user.tab();
        expect(modalInputs[1]).toHaveFocus();

        await user.tab();
        expect(modalButtons[0]).toHaveFocus();

        await user.tab();
        expect(modalButtons[1]).toHaveFocus();

        // Tab from last element should return to first
        await user.tab();
        expect(modalInputs[0]).toHaveFocus();
      });

      it('restores focus after modal closes', async () => {
        const AppWithModal = () => {
          const [modalOpen, setModalOpen] = React.useState(false);

          return (
            <div>
              <button onClick={() => setModalOpen(true)}>
                Open Modal
              </button>
              <input type="text" placeholder="Outside modal" />

              {modalOpen && (
                <div role="dialog" aria-modal="true">
                  <h2>Modal</h2>
                  <button onClick={() => setModalOpen(false)}>
                    Close
                  </button>
                </div>
              )}
            </div>
          );
        };

        customRender(<AppWithModal />);

        const user = userEvent.setup();
        const openButton = screen.getByRole('button', { name: /open modal/i });

        // Focus on open button
        openButton.focus();
        expect(openButton).toHaveFocus();

        // Open modal
        await user.click(openButton);

        const closeButton = screen.getByRole('button', { name: /close/i });

        // Close modal
        await user.click(closeButton);

        // Focus should return to open button
        expect(openButton).toHaveFocus();
      });
    });
  }
}

/**
 * Screen Reader Support Tests
 */
export class ScreenReaderTest extends BaseAccessibilityTest {
  testScreenReaderSupport(): void {
    describe('Screen Reader Support', () => {
      it('provides meaningful page structure', () => {
        const PageComponent = () => (
          <div>
            <header>
              <h1>Mainframe KB Assistant</h1>
              <nav aria-label="Main navigation">
                <a href="#search">Search</a>
                <a href="#entries">Entries</a>
              </nav>
            </header>

            <main>
              <section aria-labelledby="search-heading">
                <h2 id="search-heading">Search Knowledge Base</h2>
                {/* Search content */}
              </section>

              <section aria-labelledby="results-heading">
                <h2 id="results-heading">Search Results</h2>
                {/* Results content */}
              </section>
            </main>

            <aside aria-label="Additional tools">
              {/* Sidebar content */}
            </aside>

            <footer>
              <p>© 2025 Company Name</p>
            </footer>
          </div>
        );

        const { container } = customRender(<PageComponent />);

        // Check landmark structure
        expect(screen.getByRole('banner')).toBeInTheDocument(); // header
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('complementary')).toBeInTheDocument(); // aside
        expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer

        // Check heading hierarchy
        const headings = screen.getAllByRole('heading');
        expect(headings[0].tagName).toBe('H1');
        expect(headings[1].tagName).toBe('H2');
      });

      it('announces dynamic content changes', async () => {
        const SearchWithAnnouncements = () => {
          const [results, setResults] = React.useState<string[]>([]);
          const [loading, setLoading] = React.useState(false);

          const performSearch = async () => {
            setLoading(true);
            setResults([]);

            // Simulate search
            setTimeout(() => {
              setResults(['Result 1', 'Result 2', 'Result 3']);
              setLoading(false);
            }, 100);
          };

          return (
            <div>
              <button onClick={performSearch}>Search</button>

              {loading && (
                <div role="status" aria-live="polite">
                  Searching...
                </div>
              )}

              <div role="region" aria-live="polite" aria-label="Search results">
                {results.length > 0 && (
                  <div>
                    <p>{results.length} results found</p>
                    <ul>
                      {results.map((result, index) => (
                        <li key={index}>{result}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        };

        customRender(<SearchWithAnnouncements />);

        const searchButton = screen.getByRole('button', { name: /search/i });
        await userEvent.click(searchButton);

        // Loading should be announced
        expect(screen.getByRole('status')).toHaveTextContent('Searching...');

        // Results should be announced when ready
        await screen.findByText('3 results found');

        const resultsRegion = screen.getByRole('region', { name: /search results/i });
        expect(resultsRegion).toHaveAttribute('aria-live', 'polite');
      });

      it('provides accessible data tables', () => {
        const DataTableComponent = () => (
          <table role="table" aria-label="Knowledge base entries">
            <caption>
              Knowledge Base Entries (5 total)
            </caption>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Category</th>
                <th scope="col">Usage Count</th>
                <th scope="col">Success Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>VSAM Status 35 Error</td>
                <td>VSAM</td>
                <td>25</td>
                <td>92%</td>
              </tr>
              <tr>
                <td>S0C7 Data Exception</td>
                <td>Batch</td>
                <td>18</td>
                <td>88%</td>
              </tr>
            </tbody>
          </table>
        );

        customRender(<DataTableComponent />);

        const table = screen.getByRole('table');
        expect(table).toHaveAttribute('aria-label');

        const caption = screen.getByText(/knowledge base entries/i);
        expect(caption).toBeInTheDocument();

        // Column headers should have scope
        const columnHeaders = screen.getAllByRole('columnheader');
        columnHeaders.forEach(header => {
          expect(header).toHaveAttribute('scope', 'col');
        });
      });
    });
  }
}

/**
 * Accessibility Test Runner
 */
export class AccessibilityTestRunner {
  private componentTest: ComponentAccessibilityTest;
  private focusTest: FocusManagementTest;
  private screenReaderTest: ScreenReaderTest;

  constructor(config: Partial<AccessibilityConfig> = {}) {
    this.componentTest = new ComponentAccessibilityTest(config);
    this.focusTest = new FocusManagementTest(config);
    this.screenReaderTest = new ScreenReaderTest(config);
  }

  runAllTests(components: {
    searchInterface?: React.ReactElement;
    kbEntry?: React.ReactElement;
    form?: React.ReactElement;
  }): void {
    describe('Accessibility Test Suite', () => {
      if (components.searchInterface) {
        this.componentTest.testSearchInterfaceAccessibility(components.searchInterface);
      }

      if (components.kbEntry) {
        this.componentTest.testKBEntryAccessibility(components.kbEntry);
      }

      if (components.form) {
        this.componentTest.testFormAccessibility(components.form);
      }

      this.focusTest.testFocusManagement();
      this.screenReaderTest.testScreenReaderSupport();
    });
  }

  async generateAccessibilityReport(component: React.ReactElement): Promise<any> {
    const { container } = customRender(component);

    const results = await axe(container, {
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      rules: {
        'color-contrast': { enabled: true },
        'keyboard': { enabled: true },
        'aria': { enabled: true }
      }
    });

    return {
      violations: results.violations,
      passes: results.passes,
      incomplete: results.incomplete,
      summary: {
        violationCount: results.violations.length,
        passCount: results.passes.length,
        incompleteCount: results.incomplete.length
      }
    };
  }
}

// Export accessibility testing classes
export {
  BaseAccessibilityTest,
  ComponentAccessibilityTest,
  FocusManagementTest,
  ScreenReaderTest,
  AccessibilityTestRunner,
  type AccessibilityConfig,
  DEFAULT_ACCESSIBILITY_CONFIG
};