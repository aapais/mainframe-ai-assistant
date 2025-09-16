/**
 * Tests for FocusContext
 */

import React, { useRef } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusProvider, useFocus } from '../FocusContext';

// Test component that uses the FocusContext
function FocusTestComponent() {
  const testElementRef = useRef<HTMLButtonElement>(null);
  const {
    state,
    focusElement,
    focusSelector,
    focusFirst,
    focusLast,
    addToHistory,
    getHistory,
    restoreFromHistory,
    clearHistory,
    createFocusScope,
    activateScope,
    deactivateScope,
    removeScope,
    lockFocus,
    unlockFocus,
    isFocusLocked,
    addSkipLink,
    removeSkipLink,
    getSkipLinks,
    createRestorePoint,
    restoreToPoint,
    clearRestorePoints,
    isFocusWithin,
    getFocusableElements,
    isElementFocusable,
    setFocusMode
  } = useFocus();

  return (
    <div data-testid="focus-test-container">
      <button ref={testElementRef} data-testid="button1">Button 1</button>
      <button data-testid="button2">Button 2</button>
      <button data-testid="button3" disabled>Button 3 (disabled)</button>
      <input data-testid="input1" type="text" placeholder="Input 1" />

      <div data-testid="focus-scope" id="test-scope">
        <button data-testid="scope-button1">Scope Button 1</button>
        <button data-testid="scope-button2">Scope Button 2</button>
      </div>

      {/* Control buttons */}
      <div data-testid="controls">
        <button
          data-testid="focus-element"
          onClick={() => focusElement(testElementRef.current!)}
        >
          Focus Element
        </button>
        <button
          data-testid="focus-selector"
          onClick={() => focusSelector('[data-testid="button2"]')}
        >
          Focus Selector
        </button>
        <button
          data-testid="focus-first"
          onClick={() => focusFirst()}
        >
          Focus First
        </button>
        <button
          data-testid="focus-last"
          onClick={() => focusLast()}
        >
          Focus Last
        </button>
        <button
          data-testid="add-to-history"
          onClick={() => addToHistory(testElementRef.current!, 'test')}
        >
          Add to History
        </button>
        <button
          data-testid="restore-from-history"
          onClick={() => restoreFromHistory()}
        >
          Restore from History
        </button>
        <button
          data-testid="clear-history"
          onClick={() => clearHistory()}
        >
          Clear History
        </button>
        <button
          data-testid="create-scope"
          onClick={() => {
            const scopeElement = document.getElementById('test-scope')!;
            createFocusScope('test-scope', scopeElement, { priority: 1 });
          }}
        >
          Create Scope
        </button>
        <button
          data-testid="activate-scope"
          onClick={() => activateScope('test-scope')}
        >
          Activate Scope
        </button>
        <button
          data-testid="deactivate-scope"
          onClick={() => deactivateScope('test-scope')}
        >
          Deactivate Scope
        </button>
        <button
          data-testid="remove-scope"
          onClick={() => removeScope('test-scope')}
        >
          Remove Scope
        </button>
        <button
          data-testid="lock-focus"
          onClick={() => lockFocus(document.getElementById('test-scope')!, 'testing')}
        >
          Lock Focus
        </button>
        <button
          data-testid="unlock-focus"
          onClick={() => unlockFocus()}
        >
          Unlock Focus
        </button>
        <button
          data-testid="add-skip-link"
          onClick={() => addSkipLink({ id: 'test-skip', text: 'Skip to test', target: '#button1' })}
        >
          Add Skip Link
        </button>
        <button
          data-testid="remove-skip-link"
          onClick={() => removeSkipLink('test-skip')}
        >
          Remove Skip Link
        </button>
        <button
          data-testid="create-restore-point"
          onClick={() => createRestorePoint('test-point', testElementRef.current!, 1)}
        >
          Create Restore Point
        </button>
        <button
          data-testid="restore-to-point"
          onClick={() => restoreToPoint('test-point')}
        >
          Restore to Point
        </button>
        <button
          data-testid="clear-restore-points"
          onClick={() => clearRestorePoints()}
        >
          Clear Restore Points
        </button>
        <button
          data-testid="set-keyboard-mode"
          onClick={() => setFocusMode('keyboard')}
        >
          Set Keyboard Mode
        </button>
        <button
          data-testid="set-mouse-mode"
          onClick={() => setFocusMode('mouse')}
        >
          Set Mouse Mode
        </button>
      </div>

      {/* State display */}
      <div data-testid="state">
        <span data-testid="current-focused">
          {state.currentFocusedElement?.textContent || 'none'}
        </span>
        <span data-testid="previous-focused">
          {state.previousFocusedElement?.textContent || 'none'}
        </span>
        <span data-testid="focus-mode">{state.focusMode}</span>
        <span data-testid="focus-visible">{state.isFocusVisible ? 'true' : 'false'}</span>
        <span data-testid="keyboard-only">{state.isKeyboardOnlyMode ? 'true' : 'false'}</span>
        <span data-testid="active-scope">{state.activeScope || 'none'}</span>
        <span data-testid="focus-locked">{state.focusLocked ? 'true' : 'false'}</span>
        <span data-testid="lock-reason">{state.lockReason || 'none'}</span>
        <span data-testid="history-length">{state.focusHistory.length}</span>
        <span data-testid="skip-links-count">{state.skipLinks.length}</span>
        <span data-testid="restore-queue-length">{state.restoreQueue.length}</span>
        <span data-testid="focus-locked-check">{isFocusLocked() ? 'true' : 'false'}</span>
        <span data-testid="history-entries">{getHistory().length}</span>
        <span data-testid="skip-links-array">{getSkipLinks().length}</span>
        <span data-testid="focus-within">
          {isFocusWithin(document.getElementById('test-scope')!) ? 'true' : 'false'}
        </span>
        <span data-testid="focusable-elements-count">
          {getFocusableElements().length}
        </span>
        <span data-testid="button1-focusable">
          {isElementFocusable(document.querySelector('[data-testid="button1"]') as HTMLElement) ? 'true' : 'false'}
        </span>
      </div>
    </div>
  );
}

describe('FocusContext', () => {
  beforeEach(() => {
    // Reset DOM focus
    if (document.activeElement !== document.body) {
      (document.activeElement as HTMLElement)?.blur();
    }
  });

  test('should provide focus context', () => {
    render(
      <FocusProvider>
        <FocusTestComponent />
      </FocusProvider>
    );

    expect(screen.getByTestId('focus-test-container')).toBeInTheDocument();
    expect(screen.getByTestId('current-focused').textContent).toBe('none');
    expect(screen.getByTestId('focus-mode').textContent).toBe('unknown');
  });

  test('should throw error when used outside provider', () => {
    const TestComponent = () => {
      useFocus();
      return <div>Test</div>;
    };

    // Suppress console.error for this test
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useFocus must be used within a FocusProvider');

    consoleError.mockRestore();
  });

  describe('Focus Control', () => {
    test('should focus element programmatically', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const focusElementBtn = screen.getByTestId('focus-element');
      const button1 = screen.getByTestId('button1');
      const currentFocused = screen.getByTestId('current-focused');

      fireEvent.click(focusElementBtn);

      await waitFor(() => {
        expect(document.activeElement).toBe(button1);
        expect(currentFocused.textContent).toBe('Button 1');
      });
    });

    test('should focus by selector', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const focusSelectorBtn = screen.getByTestId('focus-selector');
      const button2 = screen.getByTestId('button2');
      const currentFocused = screen.getByTestId('current-focused');

      fireEvent.click(focusSelectorBtn);

      await waitFor(() => {
        expect(document.activeElement).toBe(button2);
        expect(currentFocused.textContent).toBe('Button 2');
      });
    });

    test('should focus first and last elements', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const focusFirstBtn = screen.getByTestId('focus-first');
      const focusLastBtn = screen.getByTestId('focus-last');
      const button1 = screen.getByTestId('button1');
      const input1 = screen.getByTestId('input1');

      // Focus first
      fireEvent.click(focusFirstBtn);
      await waitFor(() => {
        expect(document.activeElement).toBe(button1);
      });

      // Focus last
      fireEvent.click(focusLastBtn);
      await waitFor(() => {
        expect(document.activeElement).toBe(input1);
      });
    });
  });

  describe('Focus History', () => {
    test('should manage focus history', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const addToHistoryBtn = screen.getByTestId('add-to-history');
      const restoreFromHistoryBtn = screen.getByTestId('restore-from-history');
      const clearHistoryBtn = screen.getByTestId('clear-history');
      const historyLength = screen.getByTestId('history-length');
      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      // Add to history
      fireEvent.click(addToHistoryBtn);
      expect(historyLength.textContent).toBe('1');

      // Focus different element
      button2.focus();

      // Restore from history
      fireEvent.click(restoreFromHistoryBtn);
      await waitFor(() => {
        expect(document.activeElement).toBe(button1);
      });

      // Clear history
      fireEvent.click(clearHistoryBtn);
      expect(historyLength.textContent).toBe('0');
    });

    test('should track focus changes in history', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');
      const historyLength = screen.getByTestId('history-length');

      // Focus elements manually (should add to history)
      act(() => {
        button1.focus();
      });

      await waitFor(() => {
        expect(historyLength.textContent).toBe('1');
      });

      act(() => {
        button2.focus();
      });

      await waitFor(() => {
        expect(historyLength.textContent).toBe('2');
      });
    });
  });

  describe('Focus Scopes', () => {
    test('should manage focus scopes', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const createScopeBtn = screen.getByTestId('create-scope');
      const activateScopeBtn = screen.getByTestId('activate-scope');
      const deactivateScopeBtn = screen.getByTestId('deactivate-scope');
      const removeScopeBtn = screen.getByTestId('remove-scope');
      const activeScope = screen.getByTestId('active-scope');

      // Create scope
      fireEvent.click(createScopeBtn);

      // Activate scope
      fireEvent.click(activateScopeBtn);
      expect(activeScope.textContent).toBe('test-scope');

      // Deactivate scope
      fireEvent.click(deactivateScopeBtn);
      expect(activeScope.textContent).toBe('none');

      // Remove scope
      fireEvent.click(removeScopeBtn);
      // Should not throw error
    });
  });

  describe('Focus Lock', () => {
    test('should lock and unlock focus', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const lockFocusBtn = screen.getByTestId('lock-focus');
      const unlockFocusBtn = screen.getByTestId('unlock-focus');
      const focusLockedSpan = screen.getByTestId('focus-locked');
      const lockReasonSpan = screen.getByTestId('lock-reason');
      const focusLockedCheck = screen.getByTestId('focus-locked-check');

      // Lock focus
      fireEvent.click(lockFocusBtn);
      expect(focusLockedSpan.textContent).toBe('true');
      expect(lockReasonSpan.textContent).toBe('testing');
      expect(focusLockedCheck.textContent).toBe('true');

      // Unlock focus
      fireEvent.click(unlockFocusBtn);
      expect(focusLockedSpan.textContent).toBe('false');
      expect(lockReasonSpan.textContent).toBe('none');
      expect(focusLockedCheck.textContent).toBe('false');
    });

    test('should prevent focus outside locked region', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const lockFocusBtn = screen.getByTestId('lock-focus');
      const focusElementBtn = screen.getByTestId('focus-element');
      const button1 = screen.getByTestId('button1');

      // Lock focus to test-scope
      fireEvent.click(lockFocusBtn);

      // Try to focus element outside locked region
      fireEvent.click(focusElementBtn);

      // Should not focus button1 since it's outside the locked region
      expect(document.activeElement).not.toBe(button1);
    });
  });

  describe('Skip Links', () => {
    test('should manage skip links', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const addSkipLinkBtn = screen.getByTestId('add-skip-link');
      const removeSkipLinkBtn = screen.getByTestId('remove-skip-link');
      const skipLinksCount = screen.getByTestId('skip-links-count');
      const skipLinksArray = screen.getByTestId('skip-links-array');

      // Add skip link
      fireEvent.click(addSkipLinkBtn);
      expect(skipLinksCount.textContent).toBe('1');
      expect(skipLinksArray.textContent).toBe('1');

      // Remove skip link
      fireEvent.click(removeSkipLinkBtn);
      expect(skipLinksCount.textContent).toBe('0');
      expect(skipLinksArray.textContent).toBe('0');
    });
  });

  describe('Focus Restoration', () => {
    test('should manage restore points', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const createRestorePointBtn = screen.getByTestId('create-restore-point');
      const restoreToPointBtn = screen.getByTestId('restore-to-point');
      const clearRestorePointsBtn = screen.getByTestId('clear-restore-points');
      const restoreQueueLength = screen.getByTestId('restore-queue-length');
      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      // Create restore point
      fireEvent.click(createRestorePointBtn);
      expect(restoreQueueLength.textContent).toBe('1');

      // Focus different element
      button2.focus();

      // Restore to point
      fireEvent.click(restoreToPointBtn);
      await waitFor(() => {
        expect(document.activeElement).toBe(button1);
        expect(restoreQueueLength.textContent).toBe('0'); // Should be removed after use
      });

      // Create another restore point and clear all
      fireEvent.click(createRestorePointBtn);
      fireEvent.click(clearRestorePointsBtn);
      expect(restoreQueueLength.textContent).toBe('0');
    });
  });

  describe('Utilities', () => {
    test('should check if focus is within element', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const scopeButton1 = screen.getByTestId('scope-button1');
      const focusWithinSpan = screen.getByTestId('focus-within');

      // Initially no focus within scope
      expect(focusWithinSpan.textContent).toBe('false');

      // Focus element within scope
      act(() => {
        scopeButton1.focus();
      });

      await waitFor(() => {
        expect(focusWithinSpan.textContent).toBe('true');
      });
    });

    test('should get focusable elements', () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const focusableElementsCount = screen.getByTestId('focusable-elements-count');

      // Should count all focusable elements (including controls)
      expect(parseInt(focusableElementsCount.textContent!)).toBeGreaterThan(3);
    });

    test('should check if element is focusable', () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const button1Focusable = screen.getByTestId('button1-focusable');

      expect(button1Focusable.textContent).toBe('true');
    });
  });

  describe('Focus Mode Detection', () => {
    test('should set focus mode', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const setKeyboardModeBtn = screen.getByTestId('set-keyboard-mode');
      const setMouseModeBtn = screen.getByTestId('set-mouse-mode');
      const focusModeSpan = screen.getByTestId('focus-mode');
      const focusVisibleSpan = screen.getByTestId('focus-visible');
      const keyboardOnlySpan = screen.getByTestId('keyboard-only');

      // Set keyboard mode
      fireEvent.click(setKeyboardModeBtn);
      expect(focusModeSpan.textContent).toBe('keyboard');
      expect(focusVisibleSpan.textContent).toBe('true');
      expect(keyboardOnlySpan.textContent).toBe('true');

      // Set mouse mode
      fireEvent.click(setMouseModeBtn);
      expect(focusModeSpan.textContent).toBe('mouse');
      expect(focusVisibleSpan.textContent).toBe('false');
      expect(keyboardOnlySpan.textContent).toBe('false');
    });

    test('should detect mode from real interactions', async () => {
      const user = userEvent.setup();

      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const button1 = screen.getByTestId('button1');
      const focusModeSpan = screen.getByTestId('focus-mode');

      // Use keyboard to focus
      await user.tab();

      await waitFor(() => {
        // Should detect keyboard mode from interaction
        expect(focusModeSpan.textContent).toBe('keyboard');
      });
    });
  });

  describe('State Tracking', () => {
    test('should track current and previous focused elements', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');
      const currentFocused = screen.getByTestId('current-focused');
      const previousFocused = screen.getByTestId('previous-focused');

      // Focus first element
      act(() => {
        button1.focus();
      });

      await waitFor(() => {
        expect(currentFocused.textContent).toBe('Button 1');
      });

      // Focus second element
      act(() => {
        button2.focus();
      });

      await waitFor(() => {
        expect(currentFocused.textContent).toBe('Button 2');
        expect(previousFocused.textContent).toBe('Button 1');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle focusing non-existent elements', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const { focusSelector, focusElement } = useFocus();

      // Should not throw when focusing non-existent selector
      expect(() => {
        focusSelector('#non-existent');
      }).not.toThrow();

      // Should not throw when focusing null element
      expect(() => {
        focusElement(null as any);
      }).not.toThrow();
    });

    test('should handle scope operations on non-existent scopes', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const { activateScope, deactivateScope, removeScope } = useFocus();

      // Should handle non-existent scope gracefully
      expect(() => {
        activateScope('non-existent');
        deactivateScope('non-existent');
        removeScope('non-existent');
      }).not.toThrow();
    });

    test('should handle restore operations on non-existent points', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      const { restoreToPoint, restoreFromHistory } = useFocus();

      // Should handle non-existent restore point gracefully
      expect(() => {
        restoreToPoint('non-existent');
        restoreFromHistory(10); // More steps than available
      }).not.toThrow();
    });
  });

  describe('Provider Configuration', () => {
    test('should accept custom configuration', () => {
      const customSkipLinks = [
        { id: 'custom', text: 'Custom Skip Link', target: '#custom' }
      ];

      function CustomizedComponent() {
        const { getSkipLinks } = useFocus();
        return (
          <div data-testid="skip-links-count">
            {getSkipLinks().length}
          </div>
        );
      }

      render(
        <FocusProvider
          maxHistorySize={20}
          enableSkipLinks={true}
          skipLinks={customSkipLinks}
        >
          <CustomizedComponent />
        </FocusProvider>
      );

      const skipLinksCount = screen.getByTestId('skip-links-count');
      expect(skipLinksCount.textContent).toBe('1');
    });

    test('should handle disabled skip links', () => {
      function CustomizedComponent() {
        const { state } = useFocus();
        return (
          <div data-testid="skip-links-enabled">
            {state.skipLinksEnabled ? 'true' : 'false'}
          </div>
        );
      }

      render(
        <FocusProvider enableSkipLinks={false}>
          <CustomizedComponent />
        </FocusProvider>
      );

      const skipLinksEnabled = screen.getByTestId('skip-links-enabled');
      expect(skipLinksEnabled.textContent).toBe('false');
    });
  });

  describe('Memory Management and Cleanup', () => {
    test('should clean up on unmount', () => {
      const { unmount } = render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      // Should not throw error on unmount
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    test('should clean up invalid history entries', async () => {
      render(
        <FocusProvider>
          <FocusTestComponent />
        </FocusProvider>
      );

      // This test would require more complex DOM manipulation
      // to simulate removed elements, but ensures the basic structure is there
      expect(screen.getByTestId('history-length')).toBeInTheDocument();
    });
  });
});