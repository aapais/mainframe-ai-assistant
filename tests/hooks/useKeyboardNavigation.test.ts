/**
 * Keyboard Navigation Hook Tests
 *
 * Comprehensive tests for the enhanced keyboard navigation hook
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../../src/hooks/useKeyboardNavigation';
import { trackInteraction } from '../../src/utils/analytics';

// Mock analytics
jest.mock('../../src/utils/analytics', () => ({
  trackInteraction: jest.fn()
}));

const mockTrackInteraction = trackInteraction as jest.MockedFunction<typeof trackInteraction>;

describe('useKeyboardNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultOptions = {
    itemCount: 5,
    onSelectionChange: jest.fn(),
    onItemActivate: jest.fn(),
    onAnnouncement: jest.fn()
  };

  describe('Basic Navigation', () => {
    test('should initialize with default values', () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultOptions));

      expect(result.current.selectedIndex).toBe(-1);
      expect(typeof result.current.handleKeyDown).toBe('function');
      expect(typeof result.current.navigateToIndex).toBe('function');
    });

    test('should navigate down through items', () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        result.current.navigateDown();
      });

      expect(result.current.selectedIndex).toBe(0);
      expect(defaultOptions.onSelectionChange).toHaveBeenCalledWith(0);

      act(() => {
        result.current.navigateDown();
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    test('should navigate up through items', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        initialSelectedIndex: 2
      }));

      act(() => {
        result.current.navigateUp();
      });

      expect(result.current.selectedIndex).toBe(1);
      expect(defaultOptions.onSelectionChange).toHaveBeenCalledWith(1);

      act(() => {
        result.current.navigateUp();
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test('should navigate to first and last items', () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        result.current.navigateToFirst();
      });

      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.navigateToLast();
      });

      expect(result.current.selectedIndex).toBe(4);
    });

    test('should handle wrapping navigation', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        wrap: true
      }));

      // At beginning, navigate up should wrap to end
      act(() => {
        result.current.navigateUp();
      });

      expect(result.current.selectedIndex).toBe(4);

      // At end, navigate down should wrap to beginning
      act(() => {
        result.current.navigateDown();
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test('should not wrap when wrap is disabled', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        wrap: false
      }));

      // At beginning, navigate up should stay at beginning
      act(() => {
        result.current.navigateUp();
      });

      expect(result.current.selectedIndex).toBe(0);

      // Navigate to end
      act(() => {
        result.current.navigateToLast();
      });

      // At end, navigate down should stay at end
      act(() => {
        result.current.navigateDown();
      });

      expect(result.current.selectedIndex).toBe(4);
    });
  });

  describe('Page Navigation', () => {
    test('should navigate by page down', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        itemCount: 20,
        jumpSize: 5
      }));

      act(() => {
        result.current.navigateByPage('down');
      });

      expect(result.current.selectedIndex).toBe(5);

      act(() => {
        result.current.navigateByPage('down');
      });

      expect(result.current.selectedIndex).toBe(10);
    });

    test('should navigate by page up', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        itemCount: 20,
        initialSelectedIndex: 15,
        jumpSize: 5
      }));

      act(() => {
        result.current.navigateByPage('up');
      });

      expect(result.current.selectedIndex).toBe(10);

      act(() => {
        result.current.navigateByPage('up');
      });

      expect(result.current.selectedIndex).toBe(5);
    });

    test('should not exceed bounds when page navigating', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        itemCount: 5,
        jumpSize: 10
      }));

      // Navigate down beyond bounds
      act(() => {
        result.current.navigateByPage('down');
      });

      expect(result.current.selectedIndex).toBe(4); // Last item

      // Navigate up from beginning
      act(() => {
        result.current.navigateToFirst();
        result.current.navigateByPage('up');
      });

      expect(result.current.selectedIndex).toBe(0); // First item
    });
  });

  describe('Keyboard Event Handling', () => {
    test('should handle arrow key events', () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultOptions));

      const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });

      act(() => {
        result.current.handleKeyDown(arrowDownEvent as any);
      });

      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.handleKeyDown(arrowDownEvent as any);
      });

      expect(result.current.selectedIndex).toBe(1);

      act(() => {
        result.current.handleKeyDown(arrowUpEvent as any);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test('should handle Enter and Space for activation', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        initialSelectedIndex: 1
      }));

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });

      act(() => {
        result.current.handleKeyDown(enterEvent as any);
      });

      expect(defaultOptions.onItemActivate).toHaveBeenCalledWith(1);

      act(() => {
        result.current.handleKeyDown(spaceEvent as any);
      });

      expect(defaultOptions.onItemActivate).toHaveBeenCalledWith(1);
    });

    test('should handle Home and End keys', () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultOptions));

      const homeEvent = new KeyboardEvent('keydown', { key: 'Home' });
      const endEvent = new KeyboardEvent('keydown', { key: 'End' });

      act(() => {
        result.current.handleKeyDown(homeEvent as any);
      });

      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.handleKeyDown(endEvent as any);
      });

      expect(result.current.selectedIndex).toBe(4);
    });

    test('should handle Page keys', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        itemCount: 20,
        jumpSize: 5
      }));

      const pageDownEvent = new KeyboardEvent('keydown', { key: 'PageDown' });
      const pageUpEvent = new KeyboardEvent('keydown', { key: 'PageUp' });

      act(() => {
        result.current.handleKeyDown(pageDownEvent as any);
      });

      expect(result.current.selectedIndex).toBe(5);

      act(() => {
        result.current.handleKeyDown(pageUpEvent as any);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test('should handle Escape key', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        initialSelectedIndex: 2
      }));

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });

      act(() => {
        result.current.handleKeyDown(escapeEvent as any);
      });

      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  describe('Advanced Shortcuts', () => {
    test('should handle vim-style navigation when enabled', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        enableVimNavigation: true
      }));

      const jEvent = new KeyboardEvent('keydown', { key: 'j' });
      const kEvent = new KeyboardEvent('keydown', { key: 'k' });

      act(() => {
        result.current.handleKeyDown(jEvent as any);
      });

      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.handleKeyDown(jEvent as any);
      });

      expect(result.current.selectedIndex).toBe(1);

      act(() => {
        result.current.handleKeyDown(kEvent as any);
      });

      expect(result.current.selectedIndex).toBe(0);
    });

    test('should not handle vim keys when disabled', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        enableVimNavigation: false
      }));

      const jEvent = new KeyboardEvent('keydown', { key: 'j' });

      act(() => {
        result.current.handleKeyDown(jEvent as any);
      });

      expect(result.current.selectedIndex).toBe(-1); // Should not change
    });

    test('should handle advanced shortcuts when enabled', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        enableAdvancedShortcuts: true
      }));

      const ctrlGEvent = new KeyboardEvent('keydown', { key: 'g', ctrlKey: true });
      const shiftGEvent = new KeyboardEvent('keydown', { key: 'G', shiftKey: true });

      act(() => {
        result.current.handleKeyDown(ctrlGEvent as any);
      });

      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.handleKeyDown(shiftGEvent as any);
      });

      expect(result.current.selectedIndex).toBe(4);
    });
  });

  describe('Type-ahead Navigation', () => {
    const items = [
      { id: '1', title: 'Apple' },
      { id: '2', title: 'Banana' },
      { id: '3', title: 'Cherry' },
      { id: '4', title: 'Date' }
    ];

    test('should navigate to matching items with type-ahead', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        itemCount: 4,
        enableTypeAhead: true,
        items
      }));

      const bEvent = new KeyboardEvent('keydown', { key: 'b' });

      act(() => {
        result.current.handleKeyDown(bEvent as any);
      });

      expect(result.current.selectedIndex).toBe(1); // Banana
    });

    test('should accumulate type-ahead query', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        itemCount: 4,
        enableTypeAhead: true,
        items: [
          { id: '1', title: 'Apple' },
          { id: '2', title: 'Apricot' },
          { id: '3', title: 'Banana' },
          { id: '4', title: 'Cherry' }
        ]
      }));

      const aEvent = new KeyboardEvent('keydown', { key: 'a' });
      const pEvent = new KeyboardEvent('keydown', { key: 'p' });

      act(() => {
        result.current.handleKeyDown(aEvent as any);
      });

      expect(result.current.selectedIndex).toBe(0); // Apple

      act(() => {
        result.current.handleKeyDown(pEvent as any);
      });

      expect(result.current.selectedIndex).toBe(1); // Apricot (matches "ap")
    });

    test('should clear type-ahead query', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        enableTypeAhead: true,
        items
      }));

      const aEvent = new KeyboardEvent('keydown', { key: 'a' });

      act(() => {
        result.current.handleKeyDown(aEvent as any);
      });

      expect(result.current.typeAheadQuery).toBe('a');

      act(() => {
        result.current.clearTypeAhead();
      });

      expect(result.current.typeAheadQuery).toBe('');
    });
  });

  describe('Analytics Integration', () => {
    test('should track navigation events when analytics enabled', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        enableAnalytics: true
      }));

      act(() => {
        result.current.navigateDown();
      });

      expect(mockTrackInteraction).toHaveBeenCalledWith('keyboard_navigation', {
        action: 'navigate_to_index',
        method: 'arrow_down',
        from_index: -1,
        to_index: 0,
        total_items: 5
      });
    });

    test('should track activation events', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        enableAnalytics: true,
        initialSelectedIndex: 1
      }));

      act(() => {
        result.current.activateItem();
      });

      expect(mockTrackInteraction).toHaveBeenCalledWith('keyboard_navigation', {
        action: 'activate_item',
        index: 1,
        total_items: 5
      });
    });

    test('should not track events when analytics disabled', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        enableAnalytics: false
      }));

      act(() => {
        result.current.navigateDown();
      });

      expect(mockTrackInteraction).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility Features', () => {
    test('should provide announcements for navigation', () => {
      const { result } = renderHook(() => useKeyboardNavigation(defaultOptions));

      act(() => {
        result.current.navigateDown();
      });

      expect(defaultOptions.onAnnouncement).toHaveBeenCalledWith(
        'Navigated to item 1 of 5',
        'polite'
      );
    });

    test('should provide announcements for activation', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        initialSelectedIndex: 2
      }));

      act(() => {
        result.current.activateItem();
      });

      expect(defaultOptions.onAnnouncement).toHaveBeenCalledWith(
        'Activated item 3',
        'assertive'
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle disabled state', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        disabled: true
      }));

      act(() => {
        result.current.navigateDown();
      });

      expect(result.current.selectedIndex).toBe(-1); // Should not change
      expect(defaultOptions.onSelectionChange).not.toHaveBeenCalled();
    });

    test('should handle empty item list', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        itemCount: 0
      }));

      act(() => {
        result.current.navigateDown();
      });

      expect(result.current.selectedIndex).toBe(-1);
      expect(defaultOptions.onSelectionChange).not.toHaveBeenCalled();
    });

    test('should handle item count changes', () => {
      const { result, rerender } = renderHook(
        ({ itemCount }) => useKeyboardNavigation({
          ...defaultOptions,
          itemCount,
          initialSelectedIndex: 3
        }),
        { initialProps: { itemCount: 5 } }
      );

      expect(result.current.selectedIndex).toBe(3);

      // Reduce item count below selected index
      rerender({ itemCount: 2 });

      expect(result.current.selectedIndex).toBe(1); // Should clamp to last item
    });

    test('should handle negative selected index', () => {
      const { result } = renderHook(() => useKeyboardNavigation({
        ...defaultOptions,
        initialSelectedIndex: -1
      }));

      act(() => {
        result.current.activateItem();
      });

      // Should not activate when no item is selected
      expect(defaultOptions.onItemActivate).not.toHaveBeenCalled();
    });
  });
});