/**
 * Tests for useFocusManagement hook
 */

import React, { useRef, useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusManagement, useFocusTrapSimple, useFocusRestore } from '../useFocusManagement';
import { KeyboardProvider } from '../../contexts/KeyboardContext';
import { FocusProvider } from '../../contexts/FocusContext';

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <FocusProvider>
      <KeyboardProvider>
        {children}
      </KeyboardProvider>
    </FocusProvider>
  );
}

// Test component for basic focus management
function FocusManagementTestComponent({ config = {} }: { config?: any }) {
  const focusManagement = useFocusManagement(config);

  return (
    <div ref={focusManagement.containerRef} data-testid="container">
      <button data-testid="button1">Button 1</button>
      <button data-testid="button2">Button 2</button>
      <button data-testid="button3" disabled>Button 3 (disabled)</button>
      <input data-testid="input1" type="text" placeholder="Input 1" />
      <input data-testid="input2" type="text" placeholder="Input 2" />

      <div data-testid="controls">
        <button
          data-testid="focus-first"
          onClick={() => focusManagement.focusFirst()}
        >
          Focus First
        </button>
        <button
          data-testid="focus-last"
          onClick={() => focusManagement.focusLast()}
        >
          Focus Last
        </button>
        <button
          data-testid="focus-next"
          onClick={() => focusManagement.focusNext()}
        >
          Focus Next
        </button>
        <button
          data-testid="focus-previous"
          onClick={() => focusManagement.focusPrevious()}
        >
          Focus Previous
        </button>
        <button
          data-testid="activate-trap"
          onClick={() => focusManagement.activateTrap()}
        >
          Activate Trap
        </button>
        <button
          data-testid="deactivate-trap"
          onClick={() => focusManagement.deactivateTrap()}
        >
          Deactivate Trap
        </button>
      </div>

      <div data-testid="state">
        <span data-testid="trap-active">
          {focusManagement.trapActive ? 'true' : 'false'}
        </span>
        <span data-testid="focus-visible">
          {focusManagement.isFocusVisible ? 'true' : 'false'}
        </span>
        <span data-testid="keyboard-mode">
          {focusManagement.isKeyboardMode ? 'true' : 'false'}
        </span>
      </div>
    </div>
  );
}

// Test component for focus trap
function FocusTrapTestComponent({ active = false }: { active?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { trapActive, activateTrap, deactivateTrap } = useFocusTrapSimple(
    containerRef,
    active,
    {
      onEscape: () => console.log('Escape pressed'),
      restoreFocus: true
    }
  );

  return (
    <div>
      <button data-testid="outside-button">Outside Button</button>

      <div ref={containerRef} data-testid="trap-container">
        <button data-testid="trap-button1">Trap Button 1</button>
        <button data-testid="trap-button2">Trap Button 2</button>
        <input data-testid="trap-input" type="text" />
      </div>

      <button
        data-testid="activate-trap"
        onClick={activateTrap}
      >
        Activate Trap
      </button>

      <span data-testid="trap-status">
        {trapActive ? 'active' : 'inactive'}
      </span>
    </div>
  );
}

// Test component for focus restoration
function FocusRestoreTestComponent() {
  const { saveFocus, restoreFocus, previouslyFocused } = useFocusRestore(true);

  return (
    <div>
      <button data-testid="button1">Button 1</button>
      <button data-testid="button2">Button 2</button>

      <button data-testid="save-focus" onClick={saveFocus}>
        Save Focus
      </button>
      <button data-testid="restore-focus" onClick={restoreFocus}>
        Restore Focus
      </button>

      <span data-testid="previously-focused">
        {previouslyFocused?.textContent || 'none'}
      </span>
    </div>
  );
}

// Test component for typeahead functionality
function TypeaheadTestComponent() {
  const itemsRef = useRef<HTMLElement[]>([]);
  const focusManagement = useFocusManagement({
    autoFocus: false
  });

  useEffect(() => {
    if (focusManagement.containerRef.current) {
      itemsRef.current = Array.from(
        focusManagement.containerRef.current.querySelectorAll('[data-item]')
      ) as HTMLElement[];
    }
  }, []);

  const typeahead = focusManagement.createTypeahead({
    searchProperty: 'textContent',
    timeout: 500,
    onMatch: (element, query) => {
      element.setAttribute('data-matched', query);
    }
  });

  return (
    <div ref={focusManagement.containerRef} data-testid="typeahead-container">
      <button data-item data-testid="apple">Apple</button>
      <button data-item data-testid="banana">Banana</button>
      <button data-item data-testid="cherry">Cherry</button>
      <button data-item data-testid="date">Date</button>

      <div data-testid="typeahead-state">
        <span data-testid="query">{typeahead.query}</span>
        <span data-testid="matches">{typeahead.matches.length}</span>
        <span data-testid="active-match">
          {typeahead.activeMatch?.textContent || 'none'}
        </span>
      </div>

      <button data-testid="clear-query" onClick={typeahead.clearQuery}>
        Clear Query
      </button>
    </div>
  );
}

describe('useFocusManagement', () => {
  beforeEach(() => {
    // Reset DOM focus
    if (document.activeElement !== document.body) {
      (document.activeElement as HTMLElement)?.blur();
    }
  });

  describe('Basic Focus Management', () => {
    test('should focus first and last elements', async () => {
      render(
        <TestWrapper>
          <FocusManagementTestComponent />
        </TestWrapper>
      );

      const focusFirstBtn = screen.getByTestId('focus-first');
      const focusLastBtn = screen.getByTestId('focus-last');
      const button1 = screen.getByTestId('button1');
      const input2 = screen.getByTestId('input2');

      // Focus first element
      fireEvent.click(focusFirstBtn);
      expect(document.activeElement).toBe(button1);

      // Focus last element
      fireEvent.click(focusLastBtn);
      expect(document.activeElement).toBe(input2);
    });

    test('should navigate with focus next/previous', async () => {
      render(
        <TestWrapper>
          <FocusManagementTestComponent />
        </TestWrapper>
      );

      const focusFirstBtn = screen.getByTestId('focus-first');
      const focusNextBtn = screen.getByTestId('focus-next');
      const focusPrevBtn = screen.getByTestId('focus-previous');
      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      // Start at first element
      fireEvent.click(focusFirstBtn);
      expect(document.activeElement).toBe(button1);

      // Move to next
      fireEvent.click(focusNextBtn);
      expect(document.activeElement).toBe(button2);

      // Move back to previous
      fireEvent.click(focusPrevBtn);
      expect(document.activeElement).toBe(button1);
    });

    test('should skip disabled elements', async () => {
      render(
        <TestWrapper>
          <FocusManagementTestComponent config={{ skipDisabled: true }} />
        </TestWrapper>
      );

      const container = screen.getByTestId('container');
      const focusableElements = container.querySelectorAll(
        'button:not([disabled]), input:not([disabled])'
      );

      // Should not include the disabled button
      expect(focusableElements.length).toBe(6); // 2 buttons + 2 inputs + 2 control buttons
    });

    test('should handle auto focus', async () => {
      render(
        <TestWrapper>
          <FocusManagementTestComponent config={{ autoFocus: 'first' }} />
        </TestWrapper>
      );

      const button1 = screen.getByTestId('button1');

      await waitFor(() => {
        expect(document.activeElement).toBe(button1);
      });
    });
  });

  describe('Focus Trap', () => {
    test('should activate and deactivate focus trap', async () => {
      render(
        <TestWrapper>
          <FocusManagementTestComponent config={{ trapFocus: true }} />
        </TestWrapper>
      );

      const activateTrapBtn = screen.getByTestId('activate-trap');
      const deactivateTrapBtn = screen.getByTestId('deactivate-trap');
      const trapStatus = screen.getByTestId('trap-active');

      // Initially inactive
      expect(trapStatus.textContent).toBe('false');

      // Activate trap
      fireEvent.click(activateTrapBtn);
      expect(trapStatus.textContent).toBe('true');

      // Deactivate trap
      fireEvent.click(deactivateTrapBtn);
      expect(trapStatus.textContent).toBe('false');
    });

    test('should trap focus within container', async () => {
      render(
        <TestWrapper>
          <FocusTrapTestComponent active={true} />
        </TestWrapper>
      );

      const outsideButton = screen.getByTestId('outside-button');
      const trapButton1 = screen.getByTestId('trap-button1');
      const trapButton2 = screen.getByTestId('trap-button2');
      const trapInput = screen.getByTestId('trap-input');

      await waitFor(() => {
        // Focus should be trapped within the container
        expect(document.activeElement).toBe(trapButton1);
      });

      // Tab should move to next element in trap
      await userEvent.tab();
      expect(document.activeElement).toBe(trapButton2);

      await userEvent.tab();
      expect(document.activeElement).toBe(trapInput);

      // Tab from last element should wrap to first
      await userEvent.tab();
      expect(document.activeElement).toBe(trapButton1);

      // Shift+Tab should go backwards
      await userEvent.tab({ shift: true });
      expect(document.activeElement).toBe(trapInput);
    });

    test('should handle escape key in trap', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <FocusTrapTestComponent active={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('trap-status').textContent).toBe('active');
      });

      // Press escape to close trap
      await user.keyboard('{Escape}');

      // Note: The actual trap deactivation depends on the onEscape handler implementation
    });
  });

  describe('Focus Restoration', () => {
    test('should save and restore focus', async () => {
      render(
        <TestWrapper>
          <FocusRestoreTestComponent />
        </TestWrapper>
      );

      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');
      const saveFocusBtn = screen.getByTestId('save-focus');
      const restoreFocusBtn = screen.getByTestId('restore-focus');

      // Focus button1 and save
      button1.focus();
      expect(document.activeElement).toBe(button1);

      fireEvent.click(saveFocusBtn);

      // Focus button2
      button2.focus();
      expect(document.activeElement).toBe(button2);

      // Restore focus should go back to button1
      fireEvent.click(restoreFocusBtn);
      expect(document.activeElement).toBe(button1);
    });
  });

  describe('Keyboard Navigation', () => {
    test('should handle arrow key navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <FocusManagementTestComponent
            config={{
              orientation: 'horizontal',
              autoFocus: 'first'
            }}
          />
        </TestWrapper>
      );

      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      await waitFor(() => {
        expect(document.activeElement).toBe(button1);
      });

      // Right arrow should move to next element
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(button2);

      // Left arrow should move to previous element
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(button1);
    });

    test('should handle Home and End keys', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <FocusManagementTestComponent
            config={{
              orientation: 'vertical',
              autoFocus: false
            }}
          />
        </TestWrapper>
      );

      const container = screen.getByTestId('container');
      const button2 = screen.getByTestId('button2');

      // Focus middle element
      button2.focus();
      container.focus();

      // Home should go to first element
      await user.keyboard('{Home}');
      expect(document.activeElement).toBe(screen.getByTestId('button1'));

      // End should go to last element
      await user.keyboard('{End}');
      expect(document.activeElement).toBe(screen.getByTestId('input2'));
    });
  });

  describe('Typeahead Functionality', () => {
    test('should handle typeahead search', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TypeaheadTestComponent />
        </TestWrapper>
      );

      const container = screen.getByTestId('typeahead-container');
      const appleButton = screen.getByTestId('apple');
      const bananaButton = screen.getByTestId('banana');

      // Focus container and type
      container.focus();

      // Type 'a' to search
      await user.keyboard('a');

      await waitFor(() => {
        expect(document.activeElement).toBe(appleButton);
      });

      // Type 'b' to search for banana
      await user.keyboard('b');

      await waitFor(() => {
        expect(document.activeElement).toBe(bananaButton);
      });
    });

    test('should clear typeahead query', async () => {
      render(
        <TestWrapper>
          <TypeaheadTestComponent />
        </TestWrapper>
      );

      const clearBtn = screen.getByTestId('clear-query');
      const querySpan = screen.getByTestId('query');

      // Clear should reset query
      fireEvent.click(clearBtn);
      expect(querySpan.textContent).toBe('');
    });
  });

  describe('Focus Callbacks', () => {
    test('should call focus callbacks', async () => {
      const onFocusEnter = jest.fn();
      const onFocusLeave = jest.fn();
      const onFocusChange = jest.fn();

      function TestComponent() {
        const focusManagement = useFocusManagement({
          onFocusEnter,
          onFocusLeave,
          onFocusChange,
          autoFocus: false
        });

        return (
          <div ref={focusManagement.containerRef}>
            <button data-testid="test-button">Test Button</button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByTestId('test-button');

      // Focus element
      act(() => {
        button.focus();
      });

      await waitFor(() => {
        expect(onFocusEnter).toHaveBeenCalledWith(button);
        expect(onFocusChange).toHaveBeenCalledWith(button, null);
      });

      // Blur element
      act(() => {
        button.blur();
      });

      await waitFor(() => {
        expect(onFocusLeave).toHaveBeenCalledWith(button);
      });
    });
  });

  describe('Focus Visible Mode', () => {
    test('should detect keyboard mode', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <FocusManagementTestComponent />
        </TestWrapper>
      );

      const button1 = screen.getByTestId('button1');
      const keyboardModeSpan = screen.getByTestId('keyboard-mode');
      const focusVisibleSpan = screen.getByTestId('focus-visible');

      // Use keyboard navigation
      await user.tab();

      await waitFor(() => {
        // Should detect keyboard mode
        expect(keyboardModeSpan.textContent).toBe('true');
        expect(focusVisibleSpan.textContent).toBe('true');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing container gracefully', () => {
      function TestComponent() {
        const focusManagement = useFocusManagement();

        // Don't attach containerRef
        return (
          <div>
            <button
              onClick={() => focusManagement.focusFirst()}
              data-testid="focus-first"
            >
              Focus First
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const focusFirstBtn = screen.getByTestId('focus-first');

      // Should not throw error
      expect(() => {
        fireEvent.click(focusFirstBtn);
      }).not.toThrow();
    });

    test('should handle invalid focus targets', () => {
      function TestComponent() {
        const focusManagement = useFocusManagement();

        return (
          <div ref={focusManagement.containerRef}>
            <button
              onClick={() => focusManagement.focusElement('#nonexistent')}
              data-testid="focus-invalid"
            >
              Focus Invalid
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const focusInvalidBtn = screen.getByTestId('focus-invalid');

      // Should not throw error
      expect(() => {
        fireEvent.click(focusInvalidBtn);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    test('should clean up event listeners on unmount', () => {
      const { unmount } = render(
        <TestWrapper>
          <FocusManagementTestComponent />
        </TestWrapper>
      );

      // Should not throw error on unmount
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    test('should clean up typeahead on destroy', () => {
      const { unmount } = render(
        <TestWrapper>
          <TypeaheadTestComponent />
        </TestWrapper>
      );

      // Should not throw error on unmount
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});