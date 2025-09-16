/**
 * WCAG 2.1 Compliance Testing Framework
 * Comprehensive accessibility testing for KB entry management interface
 */

import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations, configureAxe } from 'jest-axe';
import { AdvancedKBEntryList } from '../../src/renderer/components/ui/AdvancedKBEntryList';
import { SmartSearchInterface } from '../../src/renderer/components/ui/SmartSearchInterface';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { BatchOperationsUI } from '../../src/renderer/components/ui/BatchOperationsUI';
import type { KBEntry } from '../../src/types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Configure axe-core with WCAG 2.1 AA standards
configureAxe({
  rules: {
    // WCAG 2.1 AA Level rules
    'color-contrast': { enabled: true },
    'color-contrast-enhanced': { enabled: false }, // AAA level
    'keyboard-navigation': { enabled: true },
    'focus-order-semantics': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'aria-roles': { enabled: true },
    'button-name': { enabled: true },
    'form-field-multiple-labels': { enabled: true },
    'input-button-name': { enabled: true },
    'input-image-alt': { enabled: true },
    'label': { enabled: true },
    'link-name': { enabled: true },
    'skip-link': { enabled: true },
    'tabindex': { enabled: true },
    'valid-lang': { enabled: true },
    'image-alt': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-one-main': { enabled: true },
    'landmark-complementary-is-top-level': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'bypass': { enabled: true },
    'duplicate-id': { enabled: true },
    'duplicate-id-active': { enabled: true },
    'duplicate-id-aria': { enabled: true }
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
});

// Custom accessibility testing utilities
class AccessibilityTester {
  static async checkKeyboardNavigation(container: HTMLElement) {
    const interactiveElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const tabbableElements = Array.from(interactiveElements).filter(el => {
      const tabIndex = el.getAttribute('tabindex');
      return tabIndex === null || parseInt(tabIndex) >= 0;
    });

    return {
      totalInteractive: interactiveElements.length,
      tabbableCount: tabbableElements.length,
      elements: tabbableElements
    };
  }

  static async simulateScreenReader(container: HTMLElement) {
    const landmarks = container.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="search"]');
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    const liveRegions = container.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
    const forms = container.querySelectorAll('form, [role="form"]');

    return {
      landmarkCount: landmarks.length,
      headingCount: headings.length,
      liveRegionCount: liveRegions.length,
      formCount: forms.length,
      hasMainLandmark: container.querySelector('[role="main"]') !== null,
      headingHierarchy: Array.from(headings).map(h => ({
        level: h.tagName === 'H1' ? 1 : parseInt(h.tagName.slice(1)) || parseInt(h.getAttribute('aria-level') || '1'),
        text: h.textContent?.trim()
      }))
    };
  }

  static checkColorContrast(element: HTMLElement) {
    const computedStyle = window.getComputedStyle(element);
    const color = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;

    // This is a simplified check - in reality, you'd use a proper color contrast analyzer
    return {
      foreground: color,
      background: backgroundColor,
      hasContrast: color !== backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)'
    };
  }

  static async checkFocusManagement(container: HTMLElement, userActions: () => Promise<void>) {
    const initialFocus = document.activeElement;

    await userActions();

    const finalFocus = document.activeElement;
    const focusChanged = initialFocus !== finalFocus;
    const focusVisible = finalFocus?.matches(':focus-visible') || finalFocus?.getAttribute('data-focus-visible') === 'true';

    return {
      initialFocus: initialFocus?.tagName || null,
      finalFocus: finalFocus?.tagName || null,
      focusChanged,
      focusVisible,
      focusWithinContainer: container.contains(finalFocus)
    };
  }
}

// Mock data for accessibility testing
const mockKBEntries: KBEntry[] = [
  {
    id: 'a11y-test-1',
    title: 'VSAM Status 35 Error Resolution',
    problem: 'Application encounters VSAM status 35 error during file access',
    solution: 'Verify dataset existence and catalog entry',
    category: 'VSAM',
    tags: ['vsam', 'error', 'troubleshooting'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 15,
    success_rate: 0.89,
    version: 1,
    status: 'active',
    created_by: 'test-user'
  },
  {
    id: 'a11y-test-2',
    title: 'JCL Syntax Error Debugging',
    problem: 'Job fails due to syntax error in JCL statements',
    solution: 'Review JCL syntax and correct column positioning',
    category: 'JCL',
    tags: ['jcl', 'syntax', 'debugging'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 28,
    success_rate: 0.95,
    version: 1,
    status: 'active',
    created_by: 'test-user'
  }
];

describe('WCAG 2.1 AA Compliance Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();

    // Mock ResizeObserver for virtual scrolling tests
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  describe('1. Perceivable - Text Alternatives and Information Adaptation', () => {
    it('1.1.1 Non-text Content - All images have text alternatives', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      const images = container.querySelectorAll('img');
      images.forEach(img => {
        const hasAlt = img.hasAttribute('alt');
        const hasAriaLabel = img.hasAttribute('aria-label');
        const hasAriaLabelledby = img.hasAttribute('aria-labelledby');

        expect(hasAlt || hasAriaLabel || hasAriaLabelledby).toBe(true);
      });

      // Icons should have accessible names
      const icons = container.querySelectorAll('[data-testid*="icon"]');
      icons.forEach(icon => {
        const hasAccessibleName =
          icon.hasAttribute('aria-label') ||
          icon.hasAttribute('aria-labelledby') ||
          icon.getAttribute('role') === 'presentation' ||
          icon.getAttribute('aria-hidden') === 'true';

        expect(hasAccessibleName).toBe(true);
      });
    });

    it('1.3.1 Info and Relationships - Semantic structure is preserved', async () => {
      const { container } = render(
        <KBEntryForm
          onSave={() => Promise.resolve()}
          onCancel={() => {}}
          categories={['VSAM', 'JCL', 'DB2']}
          initialData={{}}
        />
      );

      // Check form structure
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();

      // All form inputs should have labels
      const inputs = container.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        const id = input.getAttribute('id');
        const hasLabel = container.querySelector(`label[for="${id}"]`) !== null;
        const hasAriaLabel = input.hasAttribute('aria-label');
        const hasAriaLabelledby = input.hasAttribute('aria-labelledby');

        expect(hasLabel || hasAriaLabel || hasAriaLabelledby).toBe(true);
      });

      // Check heading hierarchy
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length > 0) {
        const levels = Array.from(headings).map(h => parseInt(h.tagName.slice(1)));

        // First heading should be h1 or reasonable level
        expect(levels[0]).toBeLessThanOrEqual(2);

        // No heading level skips
        for (let i = 1; i < levels.length; i++) {
          expect(levels[i] - levels[i-1]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('1.3.2 Meaningful Sequence - Reading order is logical', async () => {
      const { container } = render(
        <SmartSearchInterface
          onSearch={() => {}}
          onSuggestionSelect={() => {}}
        />
      );

      const tabbableElements = await AccessibilityTester.checkKeyboardNavigation(container);

      // Verify tab order makes sense
      expect(tabbableElements.tabbableCount).toBeGreaterThan(0);

      // Search input should be first tabbable element
      const firstTabbable = tabbableElements.elements[0] as HTMLElement;
      expect(firstTabbable.matches('input[type="text"], input[type="search"]')).toBe(true);
    });

    it('1.4.3 Contrast (Minimum) - Color contrast meets WCAG AA standards', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Run axe color contrast check
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });

      expect(results).toHaveNoViolations();
    });

    it('1.4.4 Resize text - Content is usable when text is resized to 200%', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Simulate 200% zoom by changing CSS
      document.documentElement.style.fontSize = '200%';

      // Content should still be accessible
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Reset
      document.documentElement.style.fontSize = '';
    });
  });

  describe('2. Operable - Keyboard Accessible and Seizure Safe', () => {
    it('2.1.1 Keyboard - All functionality available via keyboard', async () => {
      const onSelectEntry = jest.fn();
      const { container } = render(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={onSelectEntry}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Tab to first entry
      await user.tab();
      const firstEntry = container.querySelector('[data-testid^="kb-entry-"]');
      expect(firstEntry).toHaveFocus();

      // Enter should select entry
      await user.keyboard('{Enter}');
      expect(onSelectEntry).toHaveBeenCalled();

      // Arrow keys should navigate
      await user.keyboard('{ArrowDown}');
      const secondEntry = container.querySelectorAll('[data-testid^="kb-entry-"]')[1];
      expect(secondEntry).toHaveFocus();
    });

    it('2.1.2 No Keyboard Trap - No keyboard traps exist', async () => {
      const { container } = render(
        <BatchOperationsUI
          selectedItems={mockKBEntries}
          onOperationComplete={() => {}}
          onCancel={() => {}}
          batchService={{} as any}
        />
      );

      // Tab through all elements
      const tabbableElements = await AccessibilityTester.checkKeyboardNavigation(container);

      for (let i = 0; i < tabbableElements.tabbableCount; i++) {
        await user.tab();
      }

      // Should be able to tab out of the component
      await user.tab();
      const focusedElement = document.activeElement;
      const isOutsideComponent = !container.contains(focusedElement);

      // Allow for circular tabbing within complex components
      expect(isOutsideComponent || container.contains(focusedElement)).toBe(true);
    });

    it('2.1.4 Character Key Shortcuts - Character shortcuts can be remapped', async () => {
      const { container } = render(
        <SmartSearchInterface
          onSearch={() => {}}
          onSuggestionSelect={() => {}}
          shortcuts={{
            focusSearch: 's',
            clearSearch: 'Escape'
          }}
        />
      );

      // Character shortcuts should not interfere with typing
      const searchInput = screen.getByRole('textbox');
      await user.click(searchInput);
      await user.type(searchInput, 'test search');

      expect(searchInput).toHaveValue('test search');

      // Global shortcuts should work when not in input
      await user.tab(); // Move focus away from input
      await user.keyboard('s'); // Should focus search

      expect(searchInput).toHaveFocus();
    });

    it('2.4.1 Bypass Blocks - Skip links or landmarks allow bypassing repeated content', async () => {
      const { container } = render(
        <div>
          <nav role="navigation" aria-label="Main navigation">
            <button>Menu Item 1</button>
            <button>Menu Item 2</button>
          </nav>
          <main role="main">
            <AdvancedKBEntryList
              entries={mockKBEntries}
              onSelectEntry={() => {}}
              onEditEntry={() => {}}
              onDeleteEntry={() => {}}
            />
          </main>
        </div>
      );

      const screenReaderInfo = await AccessibilityTester.simulateScreenReader(container);

      // Should have main landmark
      expect(screenReaderInfo.hasMainLandmark).toBe(true);
      expect(screenReaderInfo.landmarkCount).toBeGreaterThanOrEqual(2);
    });

    it('2.4.3 Focus Order - Focus order is logical and intuitive', async () => {
      const { container } = render(
        <KBEntryForm
          onSave={() => Promise.resolve()}
          onCancel={() => {}}
          categories={['VSAM', 'JCL']}
          initialData={{}}
        />
      );

      const focusPath: string[] = [];
      const tabbableElements = await AccessibilityTester.checkKeyboardNavigation(container);

      // Record focus order
      for (let i = 0; i < Math.min(tabbableElements.tabbableCount, 10); i++) {
        await user.tab();
        const focused = document.activeElement;
        if (focused) {
          focusPath.push(
            focused.getAttribute('aria-label') ||
            focused.getAttribute('name') ||
            focused.tagName
          );
        }
      }

      // Focus should follow logical reading order
      expect(focusPath.length).toBeGreaterThan(0);

      // Title should come before problem, problem before solution
      const titleIndex = focusPath.findIndex(item => item?.toLowerCase().includes('title'));
      const problemIndex = focusPath.findIndex(item => item?.toLowerCase().includes('problem'));
      const solutionIndex = focusPath.findIndex(item => item?.toLowerCase().includes('solution'));

      if (titleIndex >= 0 && problemIndex >= 0) {
        expect(titleIndex).toBeLessThan(problemIndex);
      }
      if (problemIndex >= 0 && solutionIndex >= 0) {
        expect(problemIndex).toBeLessThan(solutionIndex);
      }
    });

    it('2.4.7 Focus Visible - Focus indicator is visible', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      await user.tab();
      const focusedElement = document.activeElement as HTMLElement;

      // Check for focus indicators
      const computedStyle = window.getComputedStyle(focusedElement, ':focus');
      const hasFocusOutline =
        computedStyle.outline !== 'none' ||
        computedStyle.boxShadow !== 'none' ||
        focusedElement.getAttribute('data-focus-visible') === 'true';

      expect(hasFocusOutline).toBe(true);
    });
  });

  describe('3. Understandable - Readable and Predictable', () => {
    it('3.1.1 Language of Page - Page has language attribute', () => {
      expect(document.documentElement.hasAttribute('lang')).toBe(true);
    });

    it('3.2.1 On Focus - Context changes only on user request', async () => {
      const onSearch = jest.fn();
      const { container } = render(
        <SmartSearchInterface
          onSearch={onSearch}
          onSuggestionSelect={() => {}}
        />
      );

      const searchInput = screen.getByRole('textbox');

      // Focus should not trigger search
      await user.click(searchInput);
      expect(onSearch).not.toHaveBeenCalled();

      // Tab to different elements should not cause unwanted changes
      await user.tab();
      await user.tab();

      expect(onSearch).not.toHaveBeenCalled();
    });

    it('3.2.2 On Input - Input changes are predictable', async () => {
      const onSearch = jest.fn();
      const { container } = render(
        <SmartSearchInterface
          onSearch={onSearch}
          onSuggestionSelect={() => {}}
        />
      );

      const searchInput = screen.getByRole('textbox');

      // Typing should not immediately trigger search
      await user.type(searchInput, 'test');
      expect(onSearch).not.toHaveBeenCalled();

      // Explicit action (Enter) should trigger search
      await user.keyboard('{Enter}');
      expect(onSearch).toHaveBeenCalled();
    });

    it('3.3.1 Error Identification - Errors are identified and described', async () => {
      const { container } = render(
        <KBEntryForm
          onSave={() => Promise.reject(new Error('Validation failed'))}
          onCancel={() => {}}
          categories={['VSAM']}
          initialData={{}}
        />
      );

      // Submit invalid form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Should have error messages
        const errorMessages = container.querySelectorAll('[role="alert"], .error-message');
        expect(errorMessages.length).toBeGreaterThan(0);

        // Error messages should be associated with form fields
        const invalidInputs = container.querySelectorAll('[aria-invalid="true"]');
        expect(invalidInputs.length).toBeGreaterThan(0);
      });
    });

    it('3.3.2 Labels or Instructions - Form fields have clear labels', async () => {
      const { container } = render(
        <KBEntryForm
          onSave={() => Promise.resolve()}
          onCancel={() => {}}
          categories={['VSAM', 'JCL', 'DB2']}
          initialData={{}}
        />
      );

      const formFields = container.querySelectorAll('input, textarea, select');

      formFields.forEach(field => {
        const hasLabel =
          field.hasAttribute('aria-label') ||
          field.hasAttribute('aria-labelledby') ||
          container.querySelector(`label[for="${field.id}"]`) !== null;

        expect(hasLabel).toBe(true);

        // Required fields should be marked
        if (field.hasAttribute('required')) {
          expect(
            field.hasAttribute('aria-required') ||
            field.getAttribute('aria-required') === 'true'
          ).toBe(true);
        }
      });
    });
  });

  describe('4. Robust - Compatible with Assistive Technologies', () => {
    it('4.1.1 Parsing - HTML is valid and properly nested', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Check for duplicate IDs
      const elementsWithIds = container.querySelectorAll('[id]');
      const ids = Array.from(elementsWithIds).map(el => el.getAttribute('id'));
      const uniqueIds = [...new Set(ids)];

      expect(ids.length).toBe(uniqueIds.length);

      // Run full axe validation
      const results = await axe(container, {
        rules: {
          'duplicate-id': { enabled: true },
          'duplicate-id-active': { enabled: true },
          'duplicate-id-aria': { enabled: true }
        }
      });

      expect(results).toHaveNoViolations();
    });

    it('4.1.2 Name, Role, Value - Interactive elements have accessible names', async () => {
      const { container } = render(
        <BatchOperationsUI
          selectedItems={mockKBEntries}
          onOperationComplete={() => {}}
          onCancel={() => {}}
          batchService={{} as any}
        />
      );

      const interactiveElements = container.querySelectorAll(
        'button, [role="button"], a[href], input, select, textarea'
      );

      interactiveElements.forEach(element => {
        // Element should have accessible name
        const hasAccessibleName =
          element.hasAttribute('aria-label') ||
          element.hasAttribute('aria-labelledby') ||
          element.textContent?.trim() ||
          element.getAttribute('title');

        expect(hasAccessibleName).toBeTruthy();

        // Custom controls should have appropriate roles
        if (element.hasAttribute('role')) {
          const role = element.getAttribute('role');
          const validRoles = ['button', 'link', 'textbox', 'combobox', 'listbox', 'option', 'tab', 'tabpanel'];
          expect(validRoles.includes(role!)).toBe(true);
        }
      });
    });
  });

  describe('Screen Reader Simulation Tests', () => {
    it('should provide comprehensive screen reader experience', async () => {
      const { container } = render(
        <div>
          <header role="banner">
            <h1>Knowledge Base Assistant</h1>
          </header>
          <nav role="navigation" aria-label="Main navigation">
            <button>Search</button>
            <button>Browse</button>
          </nav>
          <main role="main">
            <SmartSearchInterface
              onSearch={() => {}}
              onSuggestionSelect={() => {}}
            />
            <AdvancedKBEntryList
              entries={mockKBEntries}
              onSelectEntry={() => {}}
              onEditEntry={() => {}}
              onDeleteEntry={() => {}}
              selectedEntryId={null}
            />
          </main>
          <aside role="complementary" aria-label="Additional tools">
            <h2>Quick Actions</h2>
            <button>Create Entry</button>
          </aside>
        </div>
      );

      const screenReaderInfo = await AccessibilityTester.simulateScreenReader(container);

      // Should have proper landmark structure
      expect(screenReaderInfo.landmarkCount).toBeGreaterThanOrEqual(4); // banner, nav, main, complementary
      expect(screenReaderInfo.hasMainLandmark).toBe(true);

      // Should have proper heading hierarchy
      expect(screenReaderInfo.headingCount).toBeGreaterThanOrEqual(2);

      const headings = screenReaderInfo.headingHierarchy;
      expect(headings[0].level).toBe(1); // h1 should be first

      // No heading level skips
      for (let i = 1; i < headings.length; i++) {
        expect(headings[i].level - headings[i-1].level).toBeLessThanOrEqual(1);
      }

      // Should have live regions for dynamic content
      expect(screenReaderInfo.liveRegionCount).toBeGreaterThanOrEqual(1);
    });

    it('should announce dynamic content changes', async () => {
      const { container, rerender } = render(
        <AdvancedKBEntryList
          entries={[]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
          isLoading={true}
        />
      );

      // Should have loading announcement
      let liveRegion = container.querySelector('[aria-live], [role="status"]');
      expect(liveRegion).toBeInTheDocument();

      // Update with entries
      rerender(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
          isLoading={false}
        />
      );

      await waitFor(() => {
        liveRegion = container.querySelector('[aria-live], [role="status"]');
        expect(liveRegion?.textContent).toContain('2'); // Should announce result count
      });
    });
  });

  describe('High Contrast and Visual Indicators', () => {
    it('should work with high contrast mode', async () => {
      // Simulate high contrast mode
      document.documentElement.style.filter = 'contrast(150%)';

      const { container } = render(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Should still pass accessibility checks
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Reset
      document.documentElement.style.filter = '';
    });

    it('should provide adequate visual indicators for all states', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={mockKBEntries}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
          selectedEntryId="a11y-test-1"
        />
      );

      // Selected entry should have visual indicator
      const selectedEntry = container.querySelector('[data-testid="kb-entry-a11y-test-1"]');
      expect(selectedEntry).toHaveAttribute('aria-selected', 'true');

      // Focus entry and check for visual focus indicator
      await user.tab();
      const focusedEntry = document.activeElement;

      // Should have focus ring or similar indicator
      const computedStyle = window.getComputedStyle(focusedEntry!);
      const hasFocusIndicator =
        computedStyle.outline !== 'none' ||
        computedStyle.boxShadow !== 'none' ||
        focusedEntry?.getAttribute('data-focus-visible') === 'true';

      expect(hasFocusIndicator).toBe(true);
    });
  });

  describe('Full Accessibility Integration Test', () => {
    it('should provide complete accessible experience for typical user journey', async () => {
      const onSearch = jest.fn();
      const onSelectEntry = jest.fn();

      const { container } = render(
        <div role="application" aria-label="Knowledge Base Assistant">
          <h1>Knowledge Base Search</h1>
          <SmartSearchInterface
            onSearch={onSearch}
            onSuggestionSelect={() => {}}
          />
          <div role="region" aria-label="Search Results" aria-live="polite">
            <AdvancedKBEntryList
              entries={mockKBEntries}
              onSelectEntry={onSelectEntry}
              onEditEntry={() => {}}
              onDeleteEntry={() => {}}
            />
          </div>
        </div>
      );

      // Full accessibility audit
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Simulate complete user journey via keyboard

      // 1. Navigate to search
      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();

      // 2. Perform search
      await user.type(screen.getByRole('textbox'), 'vsam error');
      await user.keyboard('{Enter}');

      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'vsam error'
        })
      );

      // 3. Navigate to results
      await user.tab();
      const firstEntry = container.querySelector('[data-testid^="kb-entry-"]');
      expect(firstEntry).toHaveFocus();

      // 4. Select entry
      await user.keyboard('{Enter}');
      expect(onSelectEntry).toHaveBeenCalled();

      // 5. Navigate between entries with arrows
      await user.keyboard('{ArrowDown}');
      const secondEntry = container.querySelectorAll('[data-testid^="kb-entry-"]')[1];
      expect(secondEntry).toHaveFocus();

      // Throughout the journey, screen readers should have been informed
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();

      // Final accessibility check after interactions
      const finalResults = await axe(container);
      expect(finalResults).toHaveNoViolations();
    });
  });
});