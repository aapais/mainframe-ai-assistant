/**
 * Comprehensive Inclusive Design Validation Suite
 *
 * Tests the mainframe AI assistant interface across all accessibility dimensions:
 * 1. Cognitive accessibility
 * 2. Motor accessibility
 * 3. Visual accessibility
 * 4. Auditory accessibility
 * 5. Temporary and situational impairments
 *
 * This suite validates that the interface works for all users regardless of ability.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

// Test utilities for simulating disabilities
import { simulateColorBlindness, simulateLowVision, simulateReducedMotion } from '../test-utils/accessibility-simulations';
import { TouchTargetValidator, CognitiveLoadAnalyzer, KeyboardOnlyValidator } from '../test-utils/inclusive-design-tools';

// Components to test
import { AppLayout } from '../../src/renderer/components/AppLayout';
import { KBSearchBar } from '../../src/renderer/components/KBSearchBar';
import { KBEntryList } from '../../src/renderer/components/KBEntryList';
import { MetricsDashboard } from '../../src/renderer/components/MetricsDashboard';

expect.extend(toHaveNoViolations);

describe('Inclusive Design Validation Suite', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // Reset any simulation states
    document.body.removeAttribute('data-reduced-motion');
    document.body.removeAttribute('data-high-contrast');
    document.body.removeAttribute('data-color-blind-sim');
  });

  describe('1. Cognitive Accessibility', () => {
    describe('Cognitive Load and Clarity', () => {
      test('should have clear, simple navigation structure', async () => {
        render(<AppLayout />);

        // Check for clear hierarchical structure
        const nav = screen.getByRole('navigation');
        expect(nav).toBeInTheDocument();

        // Verify main content areas are clearly labeled
        const main = screen.getByRole('main');
        expect(main).toHaveAttribute('aria-label', expect.stringMatching(/main|content|application/i));

        // Check for breadcrumb navigation
        const breadcrumbs = screen.queryByRole('navigation', { name: /breadcrumb/i });
        if (breadcrumbs) {
          expect(breadcrumbs).toHaveAttribute('aria-label', 'Breadcrumb');
        }
      });

      test('should provide clear error messages and recovery paths', async () => {
        const onError = jest.fn();
        render(<KBSearchBar onError={onError} />);

        const searchInput = screen.getByRole('searchbox');

        // Trigger validation error
        await user.type(searchInput, '!@#$%^&*()');
        await user.keyboard('{Enter}');

        await waitFor(() => {
          const errorMessage = screen.getByRole('alert');
          expect(errorMessage).toBeInTheDocument();

          // Error message should be clear and actionable
          expect(errorMessage).toHaveTextContent(/clear|simple|specific/i);

          // Should provide suggestion for recovery
          const suggestion = within(errorMessage).queryByText(/try|suggestion|example/i);
          expect(suggestion).toBeInTheDocument();
        });
      });

      test('should use consistent language and terminology', async () => {
        render(<AppLayout />);

        // Check for consistent button labeling
        const buttons = screen.getAllByRole('button');
        const buttonTexts = buttons.map(btn => btn.textContent?.toLowerCase() || '');

        // Should use consistent action words
        const actionWords = ['add', 'edit', 'delete', 'save', 'cancel', 'search'];
        const usedActions = buttonTexts.filter(text =>
          actionWords.some(action => text.includes(action))
        );

        // Check for consistent terminology (not mixing synonyms)
        expect(usedActions).not.toContain('remove'); // if using 'delete'
        expect(usedActions).not.toContain('find'); // if using 'search'
      });

      test('should provide contextual help and guidance', async () => {
        render(<KBSearchBar />);

        const searchInput = screen.getByRole('searchbox');

        // Check for placeholder text guidance
        expect(searchInput).toHaveAttribute('placeholder', expect.stringMatching(/search|find|enter/i));

        // Check for help text or tooltips
        const helpText = screen.queryByText(/help|tip|example/i);
        const tooltip = screen.queryByRole('tooltip');

        expect(helpText || tooltip).toBeInTheDocument();
      });

      test('should limit cognitive load in complex interfaces', () => {
        render(<MetricsDashboard />);

        const analyzer = new CognitiveLoadAnalyzer();
        const complexity = analyzer.analyzeInterface(document.body);

        // Check cognitive load metrics
        expect(complexity.informationDensity).toBeLessThan(7); // Miller's rule: 7±2 items
        expect(complexity.navigationDepth).toBeLessThan(4); // Max 3 levels deep
        expect(complexity.interactionComplexity).toBe('low'); // Simple interactions

        // Check for progressive disclosure
        const expandableItems = screen.getAllByRole('button', { expanded: false });
        expect(expandableItems.length).toBeGreaterThan(0); // Uses progressive disclosure
      });
    });

    describe('Mental Models and Familiarity', () => {
      test('should follow familiar UI patterns', () => {
        render(<AppLayout />);

        // Check for familiar search pattern
        const searchBox = screen.getByRole('searchbox');
        const searchContainer = searchBox.closest('[role="search"]');
        expect(searchContainer).toBeInTheDocument();

        // Check for familiar navigation patterns
        const nav = screen.getByRole('navigation');
        const navItems = within(nav).getAllByRole('link');
        expect(navItems.length).toBeGreaterThan(0);
      });

      test('should provide consistent interaction patterns', async () => {
        render(<KBEntryList />);

        // All interactive items should behave consistently
        const listItems = screen.getAllByRole('listitem');

        for (const item of listItems) {
          const interactiveElement = within(item).queryByRole('button') || within(item).queryByRole('link');

          if (interactiveElement) {
            // Should respond to both click and keyboard
            expect(interactiveElement).toHaveAttribute('tabIndex', expect.stringMatching(/0|-1/));

            // Should have consistent visual feedback
            fireEvent.focus(interactiveElement);
            expect(interactiveElement).toHaveStyle('outline: 2px solid rgb(59, 130, 246)'); // Focus ring
          }
        }
      });
    });
  });

  describe('2. Motor Accessibility', () => {
    describe('Touch Target Sizes', () => {
      test('should meet minimum touch target size (44x44px)', () => {
        render(<AppLayout />);

        const validator = new TouchTargetValidator();
        const results = validator.validateAllTargets(document.body);

        results.targets.forEach(target => {
          expect(target.width).toBeGreaterThanOrEqual(44);
          expect(target.height).toBeGreaterThanOrEqual(44);
        });

        expect(results.violations).toHaveLength(0);
      });

      test('should provide adequate spacing between touch targets', () => {
        render(<KBSearchBar />);

        const buttons = screen.getAllByRole('button');
        const validator = new TouchTargetValidator();

        for (let i = 0; i < buttons.length - 1; i++) {
          const spacing = validator.getSpacingBetween(buttons[i], buttons[i + 1]);
          expect(spacing).toBeGreaterThanOrEqual(8); // Minimum 8px spacing
        }
      });
    });

    describe('Alternative Input Methods', () => {
      test('should support keyboard-only navigation completely', async () => {
        render(<AppLayout />);

        const validator = new KeyboardOnlyValidator();
        const results = await validator.testFullKeyboardAccess(document.body);

        expect(results.unreachableElements).toHaveLength(0);
        expect(results.trapViolations).toHaveLength(0);
        expect(results.missingShortcuts).toHaveLength(0);
      });

      test('should support voice commands and speech recognition', async () => {
        render(<KBSearchBar />);

        const searchInput = screen.getByRole('searchbox');

        // Test speech recognition support
        fireEvent.focus(searchInput);

        // Simulate voice input (would require speech recognition API)
        Object.defineProperty(window, 'SpeechRecognition', {
          value: jest.fn(() => ({
            start: jest.fn(),
            stop: jest.fn(),
            addEventListener: jest.fn()
          }))
        });

        // Check if component supports speech input
        const speechButton = screen.queryByLabelText(/voice|speech|microphone/i);
        if (speechButton) {
          expect(speechButton).toBeInTheDocument();
          expect(speechButton).toHaveAttribute('aria-label', expect.stringMatching(/voice|speech/i));
        }
      });

      test('should support switch navigation', async () => {
        render(<AppLayout />);

        // Simulate switch navigation (single button press cycles through elements)
        const focusableElements = document.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        // Should be able to reach all interactive elements with single switch
        let currentIndex = 0;

        // Simulate scanning mode
        const scanNext = () => {
          if (currentIndex < focusableElements.length) {
            (focusableElements[currentIndex] as HTMLElement).focus();
            currentIndex++;
            return true;
          }
          return false;
        };

        // Test that all elements can be reached
        while (scanNext()) {
          const activeElement = document.activeElement;
          expect(activeElement).toBe(focusableElements[currentIndex - 1]);
        }
      });
    });

    describe('One-Handed Operation', () => {
      test('should be operable with one hand on mobile', () => {
        // Simulate mobile viewport
        Object.defineProperty(window, 'innerWidth', { value: 375 });
        Object.defineProperty(window, 'innerHeight', { value: 667 });

        render(<AppLayout />);

        // Check that important actions are within thumb reach
        const primaryActions = screen.getAllByRole('button', { name: /search|add|save|submit/i });

        primaryActions.forEach(button => {
          const rect = button.getBoundingClientRect();
          const isInThumbReach = rect.bottom <= window.innerHeight * 0.75; // Bottom 75% of screen
          expect(isInThumbReach).toBe(true);
        });
      });

      test('should support gesture alternatives', async () => {
        render(<KBEntryList />);

        const listItems = screen.getAllByRole('listitem');

        if (listItems.length > 0) {
          const firstItem = listItems[0];

          // Test swipe gestures (simulated with touch events)
          fireEvent.touchStart(firstItem, {
            touches: [{ clientX: 100, clientY: 100 }]
          });

          fireEvent.touchMove(firstItem, {
            touches: [{ clientX: 200, clientY: 100 }]
          });

          fireEvent.touchEnd(firstItem);

          // Should reveal action buttons or provide feedback
          await waitFor(() => {
            const actionButtons = within(firstItem).queryAllByRole('button');
            const gestureIndicator = within(firstItem).queryByText(/swipe|gesture/i);

            expect(actionButtons.length > 0 || gestureIndicator).toBe(true);
          });
        }
      });
    });
  });

  describe('3. Visual Accessibility', () => {
    describe('Color Accessibility', () => {
      test('should work with color blindness simulation', async () => {
        render(<MetricsDashboard />);

        // Test different types of color blindness
        const colorBlindTypes = ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];

        for (const type of colorBlindTypes) {
          simulateColorBlindness(type);

          // Check that information is still accessible
          const statusIndicators = screen.getAllByRole('status');
          statusIndicators.forEach(indicator => {
            // Should not rely solely on color
            const hasTextIndicator = indicator.textContent?.match(/success|error|warning|info/i);
            const hasIcon = within(indicator).queryByRole('img') || indicator.textContent?.match(/[✓✗⚠ℹ]/);

            expect(hasTextIndicator || hasIcon).toBeTruthy();
          });
        }
      });

      test('should meet WCAG AA contrast requirements', async () => {
        render(<AppLayout />);

        const results = await axe(document.body, {
          rules: {
            'color-contrast': { enabled: true }
          }
        });

        expect(results).toHaveNoViolations();
      });

      test('should support high contrast mode', () => {
        // Simulate high contrast mode
        document.body.setAttribute('data-high-contrast', 'true');
        Object.defineProperty(window, 'matchMedia', {
          value: jest.fn(() => ({
            matches: true,
            media: '(prefers-contrast: high)',
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
          }))
        });

        render(<AppLayout />);

        // Check that high contrast styles are applied
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          const styles = window.getComputedStyle(button);
          const borderWidth = parseInt(styles.borderWidth);

          expect(borderWidth).toBeGreaterThanOrEqual(2); // Thicker borders in high contrast
        });
      });
    });

    describe('Low Vision Support', () => {
      test('should work at 200% zoom', () => {
        // Simulate 200% zoom
        Object.defineProperty(window, 'devicePixelRatio', { value: 2 });

        render(<AppLayout />);

        // Check that content doesn't overflow or become unusable
        const container = screen.getByRole('main');
        const rect = container.getBoundingClientRect();

        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);

        // Check that text remains readable
        const textElements = container.querySelectorAll('p, span, div');
        textElements.forEach(element => {
          const styles = window.getComputedStyle(element);
          const fontSize = parseInt(styles.fontSize);

          if (fontSize > 0) {
            expect(fontSize).toBeGreaterThanOrEqual(16); // Minimum readable size at zoom
          }
        });
      });

      test('should support screen magnification', () => {
        render(<KBSearchBar />);

        const searchInput = screen.getByRole('searchbox');

        // Focus should be clearly visible when magnified
        fireEvent.focus(searchInput);

        const styles = window.getComputedStyle(searchInput);
        const outlineWidth = parseInt(styles.outlineWidth);
        const outlineStyle = styles.outlineStyle;

        expect(outlineWidth).toBeGreaterThanOrEqual(2);
        expect(outlineStyle).not.toBe('none');
      });
    });

    describe('Motion and Animation', () => {
      test('should respect reduced motion preferences', () => {
        // Simulate reduced motion preference
        simulateReducedMotion(true);

        render(<AppLayout />);

        // Check that animations are disabled or reduced
        const animatedElements = document.querySelectorAll('*');
        animatedElements.forEach(element => {
          const styles = window.getComputedStyle(element);
          const animationDuration = styles.animationDuration;
          const transitionDuration = styles.transitionDuration;

          if (animationDuration !== 'none') {
            expect(parseFloat(animationDuration)).toBeLessThanOrEqual(0.01); // Nearly instant
          }

          if (transitionDuration !== 'none') {
            expect(parseFloat(transitionDuration)).toBeLessThanOrEqual(0.01); // Nearly instant
          }
        });
      });

      test('should provide animation controls', () => {
        render(<MetricsDashboard />);

        // Look for animation control options
        const animationToggle = screen.queryByLabelText(/animation|motion|reduce/i);
        const settingsButton = screen.queryByLabelText(/settings|preferences/i);

        expect(animationToggle || settingsButton).toBeInTheDocument();
      });
    });
  });

  describe('4. Auditory Accessibility', () => {
    describe('Screen Reader Support', () => {
      test('should provide comprehensive screen reader support', async () => {
        render(<AppLayout />);

        const results = await axe(document.body, {
          rules: {
            'aria-allowed-attr': { enabled: true },
            'aria-required-attr': { enabled: true },
            'aria-valid-attr-value': { enabled: true },
            'aria-valid-attr': { enabled: true }
          }
        });

        expect(results).toHaveNoViolations();
      });

      test('should announce dynamic content changes', async () => {
        render(<KBSearchBar />);

        const searchInput = screen.getByRole('searchbox');

        // Look for live regions
        const liveRegions = document.querySelectorAll('[aria-live]');
        expect(liveRegions.length).toBeGreaterThan(0);

        // Test that search results are announced
        await user.type(searchInput, 'test query');

        await waitFor(() => {
          const statusLiveRegion = screen.queryByRole('status');
          expect(statusLiveRegion).toBeInTheDocument();
        });
      });

      test('should provide meaningful audio descriptions', () => {
        render(<MetricsDashboard />);

        // Check for audio descriptions of visual content
        const charts = screen.getAllByRole('img');
        charts.forEach(chart => {
          expect(chart).toHaveAttribute('alt', expect.stringMatching(/.+/)); // Non-empty alt text

          // Check for detailed description
          const describedBy = chart.getAttribute('aria-describedby');
          if (describedBy) {
            const description = document.getElementById(describedBy);
            expect(description).toBeInTheDocument();
            expect(description?.textContent).toMatch(/.{10,}/); // Meaningful description
          }
        });
      });
    });

    describe('Audio Alternatives', () => {
      test('should provide visual alternatives for audio cues', () => {
        render(<AppLayout />);

        // Check that any audio notifications have visual counterparts
        const notificationArea = screen.queryByRole('status') || screen.queryByRole('alert');

        if (notificationArea) {
          // Should have visual indicator
          const visualIndicator = within(notificationArea).queryByRole('img') ||
                                 notificationArea.textContent?.match(/[✓✗⚠ℹ]/);

          expect(visualIndicator).toBeTruthy();
        }
      });

      test('should support caption preferences', () => {
        render(<AppLayout />);

        // Look for caption or subtitle controls
        const captionControl = screen.queryByLabelText(/caption|subtitle|cc/i);
        const settingsButton = screen.queryByLabelText(/settings|accessibility/i);

        // Should have caption support or settings access
        expect(captionControl || settingsButton).toBeInTheDocument();
      });
    });
  });

  describe('5. Temporary and Situational Impairments', () => {
    describe('Bright Light Conditions', () => {
      test('should remain usable in bright light', () => {
        // Simulate bright environment
        document.body.style.filter = 'brightness(2)';

        render(<AppLayout />);

        // Check that important elements are still visible
        const primaryActions = screen.getAllByRole('button', { name: /search|add|submit/i });
        primaryActions.forEach(button => {
          const styles = window.getComputedStyle(button);
          const backgroundColor = styles.backgroundColor;
          const color = styles.color;

          // Should have sufficient contrast even in bright conditions
          expect(backgroundColor).not.toBe('rgb(255, 255, 255)'); // Not pure white
          expect(color).not.toBe('rgb(128, 128, 128)'); // Not light gray
        });

        document.body.style.filter = '';
      });
    });

    describe('One-Handed Operation (Injury)', () => {
      test('should support operation with dominant hand injury', async () => {
        render(<KBSearchBar />);

        // Test that all functions can be accessed with non-dominant hand
        const searchInput = screen.getByRole('searchbox');

        // Should be accessible from right side of screen
        const rect = searchInput.getBoundingClientRect();
        expect(rect.right).toBeLessThan(window.innerWidth * 0.8); // Within reach from right side

        // Test keyboard shortcuts for common actions
        await user.keyboard('{Control>}f{/Control}'); // Common search shortcut
        expect(searchInput).toHaveFocus();
      });
    });

    describe('Noisy Environment', () => {
      test('should work without audio cues', () => {
        render(<AppLayout />);

        // Ensure all feedback is visual
        const interactiveElements = screen.getAllByRole('button');

        interactiveElements.forEach(element => {
          fireEvent.click(element);

          // Should provide visual feedback
          const visualFeedback = element.style.backgroundColor !== '' ||
                                element.classList.contains('active') ||
                                element.classList.contains('pressed');

          expect(visualFeedback).toBeTruthy();
        });
      });
    });

    describe('Limited Bandwidth/Slow Connection', () => {
      test('should provide essential functionality with minimal resources', () => {
        render(<KBSearchBar />);

        // Essential functions should work without heavy assets
        const searchInput = screen.getByRole('searchbox');
        expect(searchInput).toBeInTheDocument();

        // Should not require complex animations or heavy images for basic function
        const essentialButtons = screen.getAllByRole('button', { name: /search/i });
        expect(essentialButtons.length).toBeGreaterThan(0);
      });

      test('should show loading states for slow operations', async () => {
        render(<KBSearchBar />);

        const searchInput = screen.getByRole('searchbox');
        await user.type(searchInput, 'test');
        await user.keyboard('{Enter}');

        // Should show loading indicator
        const loadingIndicator = screen.queryByRole('status', { name: /loading|searching/i });
        expect(loadingIndicator).toBeInTheDocument();
      });
    });

    describe('Cognitive Fatigue', () => {
      test('should minimize cognitive load when users are tired', () => {
        render(<MetricsDashboard />);

        // Check for simplified interaction patterns
        const analyzer = new CognitiveLoadAnalyzer();
        const complexity = analyzer.analyzeInterface(document.body);

        // Should offer simple, familiar patterns when complex
        expect(complexity.hasSimpleMode || complexity.informationDensity < 5).toBe(true);

        // Should have clear primary actions
        const primaryActions = screen.getAllByRole('button', { name: /add|search|save/i });
        expect(primaryActions.length).toBeGreaterThan(0);
        expect(primaryActions.length).toBeLessThan(4); // Not overwhelming
      });

      test('should provide shortcuts for experienced users', () => {
        render(<AppLayout />);

        // Check for keyboard shortcuts
        const shortcutElements = screen.getAllByText(/ctrl|cmd|alt|shift/i);
        expect(shortcutElements.length).toBeGreaterThan(0);

        // Should have shortcut documentation
        const helpButton = screen.queryByLabelText(/help|shortcuts|keyboard/i);
        expect(helpButton).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Disability Support', () => {
    test('should work for users with multiple disabilities', async () => {
      // Simulate user with both motor and visual impairments
      document.body.setAttribute('data-high-contrast', 'true');
      simulateReducedMotion(true);

      render(<AppLayout />);

      // Should be fully keyboard accessible
      const validator = new KeyboardOnlyValidator();
      const keyboardResults = await validator.testFullKeyboardAccess(document.body);
      expect(keyboardResults.unreachableElements).toHaveLength(0);

      // Should meet visual accessibility requirements
      const results = await axe(document.body);
      expect(results).toHaveNoViolations();

      // Should have large enough touch targets
      const touchValidator = new TouchTargetValidator();
      const touchResults = touchValidator.validateAllTargets(document.body);
      expect(touchResults.violations).toHaveLength(0);
    });
  });
});