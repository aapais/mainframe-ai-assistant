/**
 * Accessibility and WCAG 2.1 AA Compliance Tests
 * Tests Accenture branding (#A100FF) and accessibility standards
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

// Import components for testing
import { AIAuthorizationDialog } from '../../../src/renderer/components/dialogs/AIAuthorizationDialog';
import { TransparencyDashboard } from '../../../src/renderer/components/dashboard/TransparencyDashboard';
import { APISettingsManagement } from '../../../src/renderer/components/settings/APISettingsManagement';
import { KBEntryDetail } from '../../../src/renderer/components/KB/KBEntryDetail';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock data
const mockCostData = {
  estimatedCost: 2.45,
  tokensToUse: 5000,
  operation: 'Document Analysis',
  confidence: 'high',
};

const mockKBEntry = {
  id: 'kb-123',
  title: 'Test Entry',
  content: 'Test content',
  tags: ['test'],
  category: 'General',
  author: 'Test Author',
  lastModified: new Date().toISOString(),
};

// Mock IPC
const mockIpcRenderer = {
  invoke: jest.fn().mockResolvedValue({}),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockIpcRenderer,
  writable: true,
});

describe('Accessibility and WCAG 2.1 AA Compliance Tests', () => {
  describe('Color Contrast and Accenture Branding', () => {
    test('should use Accenture purple (#A100FF) with proper contrast ratios', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostData}
        />
      );

      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      const computedStyle = window.getComputedStyle(authorizeBtn);

      // Check Accenture brand color
      expect(computedStyle.backgroundColor).toBe('rgb(161, 0, 255)'); // #A100FF

      // Check text color for contrast
      expect(computedStyle.color).toBe('rgb(255, 255, 255)'); // White text

      // Calculate contrast ratio (simplified check)
      // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
      const bgRgb = [161, 0, 255];
      const textRgb = [255, 255, 255];

      // Luminance calculation
      const getLuminance = (rgb: number[]) => {
        const [r, g, b] = rgb.map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const bgLum = getLuminance(bgRgb);
      const textLum = getLuminance(textRgb);
      const contrastRatio = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);

      expect(contrastRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA compliance
    });

    test('should maintain brand consistency across components', async () => {
      const components = [
        <AIAuthorizationDialog isOpen={true} onClose={jest.fn()} onAuthorize={jest.fn()} costData={mockCostData} />,
        <APISettingsManagement />,
      ];

      for (const component of components) {
        const { container } = render(component);

        // Find primary action buttons
        const primaryButtons = container.querySelectorAll('[data-brand-primary="true"], .btn-primary');

        primaryButtons.forEach(button => {
          const style = window.getComputedStyle(button);
          expect(style.backgroundColor).toBe('rgb(161, 0, 255)');
        });
      }
    });

    test('should provide sufficient focus indicators', async () => {
      render(
        <TransparencyDashboard />
      );

      const tabs = screen.getAllByRole('tab');

      tabs.forEach(tab => {
        tab.focus();
        const style = window.getComputedStyle(tab);

        // Should have visible focus indicator
        expect(style.outline).not.toBe('none');
        expect(style.outlineWidth).not.toBe('0px');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation in dialogs', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostData}
        />
      );

      const dialog = screen.getByRole('dialog');

      // Tab through all focusable elements
      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      // First element should receive focus when dialog opens
      expect(document.activeElement).toBe(focusableElements[0]);

      // Test tab navigation
      fireEvent.keyDown(dialog, { key: 'Tab' });
      expect(document.activeElement).toBe(focusableElements[1] || focusableElements[0]);

      // Test escape key
      fireEvent.keyDown(dialog, { key: 'Escape' });
      // Should trigger onClose
    });

    test('should trap focus within modals', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostData}
        />
      );

      const dialog = screen.getByRole('dialog');
      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      // Focus last element and tab forward - should go to first
      lastElement.focus();
      fireEvent.keyDown(lastElement, { key: 'Tab' });
      expect(document.activeElement).toBe(firstElement);

      // Focus first element and shift+tab - should go to last
      firstElement.focus();
      fireEvent.keyDown(firstElement, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(lastElement);
    });

    test('should support arrow key navigation for tabs', async () => {
      render(<TransparencyDashboard />);

      const tabs = screen.getAllByRole('tab');
      const firstTab = tabs[0];
      const secondTab = tabs[1];

      firstTab.focus();
      expect(document.activeElement).toBe(firstTab);

      // Arrow right should move to next tab
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(secondTab);

      // Arrow left should move to previous tab
      fireEvent.keyDown(secondTab, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(firstTab);
    });
  });

  describe('Screen Reader Support', () => {
    test('should have proper ARIA labels and roles', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostData}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');

      // Check buttons have accessible names
      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });

      expect(authorizeBtn).toHaveAccessibleName();
      expect(cancelBtn).toHaveAccessibleName();
    });

    test('should provide live region announcements', async () => {
      render(<APISettingsManagement />);

      // Look for live regions
      const liveRegions = screen.getAllByRole('status');
      expect(liveRegions.length).toBeGreaterThan(0);

      liveRegions.forEach(region => {
        expect(region).toHaveAttribute('aria-live');
      });
    });

    test('should use semantic HTML elements', async () => {
      render(<KBEntryDetail entryId="kb-123" />);

      // Should use proper heading hierarchy
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);

      // Should use lists for tags
      const lists = screen.getAllByRole('list');
      expect(lists.length).toBeGreaterThan(0);

      // Should use buttons for actions
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should provide descriptive text for complex UI elements', async () => {
      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostData}
        />
      );

      // Cost information should be described
      const costElement = screen.getByTestId('cost-display');
      expect(costElement).toHaveAttribute('aria-describedby');

      const description = document.getElementById(
        costElement.getAttribute('aria-describedby') || ''
      );
      expect(description).toBeInTheDocument();
      expect(description?.textContent).toContain('estimated cost');
    });
  });

  describe('WCAG 2.1 AA Compliance', () => {
    test('should pass axe accessibility tests - AI Authorization Dialog', async () => {
      const { container } = render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={mockCostData}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should pass axe accessibility tests - Transparency Dashboard', async () => {
      const { container } = render(<TransparencyDashboard />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should pass axe accessibility tests - API Settings', async () => {
      const { container } = render(<APISettingsManagement />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should pass axe accessibility tests - KB Entry Detail', async () => {
      const { container } = render(<KBEntryDetail entryId="kb-123" />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Form Accessibility', () => {
    test('should associate labels with form controls', async () => {
      render(<APISettingsManagement />);

      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        // Should have associated label
        expect(input).toHaveAttribute('aria-labelledby', expect.any(String));

        // Or should have aria-label
        if (!input.getAttribute('aria-labelledby')) {
          expect(input).toHaveAttribute('aria-label', expect.any(String));
        }
      });
    });

    test('should provide error messages with proper associations', async () => {
      render(<APISettingsManagement />);

      // Trigger validation error
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      // Wait for error messages
      const errorMessages = screen.queryAllByRole('alert');
      errorMessages.forEach(error => {
        expect(error).toBeInTheDocument();

        // Should be associated with relevant input
        const errorId = error.getAttribute('id');
        if (errorId) {
          const associatedInput = document.querySelector(`[aria-describedby*="${errorId}"]`);
          expect(associatedInput).toBeInTheDocument();
        }
      });
    });
  });

  describe('Motion and Animation', () => {
    test('should respect prefers-reduced-motion', async () => {
      // Mock reduced motion preference
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

      render(<TransparencyDashboard />);

      // Check that animations are disabled or reduced
      const animatedElements = document.querySelectorAll('[data-animated="true"]');
      animatedElements.forEach(element => {
        const style = window.getComputedStyle(element);
        expect(style.animationDuration).toBe('0s');
      });
    });
  });

  describe('Language and Internationalization', () => {
    test('should have proper lang attributes', async () => {
      render(<TransparencyDashboard />);

      const root = document.documentElement;
      expect(root).toHaveAttribute('lang');
    });

    test('should use appropriate text direction', async () => {
      render(<KBEntryDetail entryId="kb-123" />);

      const textElements = screen.getAllByText(/test/i);
      textElements.forEach(element => {
        const style = window.getComputedStyle(element);
        expect(style.direction).toBe('ltr'); // Default for English
      });
    });
  });

  describe('Error Handling and User Feedback', () => {
    test('should provide clear error messages', async () => {
      render(<APISettingsManagement />);

      // Trigger error state
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      const errorMessages = screen.queryAllByRole('alert');
      errorMessages.forEach(error => {
        expect(error.textContent).toBeTruthy();
        expect(error.textContent?.length).toBeGreaterThan(5); // Meaningful message
      });
    });

    test('should provide success feedback', async () => {
      mockIpcRenderer.invoke.mockResolvedValue({ success: true });

      render(<APISettingsManagement />);

      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);

      // Should show success message
      const successMessage = await screen.findByRole('status');
      expect(successMessage).toBeInTheDocument();
      expect(successMessage.textContent).toContain('success');
    });
  });
});