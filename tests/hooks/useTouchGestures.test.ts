/**
 * Touch Gestures Hook Tests
 *
 * Comprehensive tests for the touch gesture support hook
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react';
import { useTouchGestures } from '../../src/hooks/useTouchGestures';
import { trackInteraction } from '../../src/utils/analytics';

// Mock analytics
jest.mock('../../src/utils/analytics', () => ({
  trackInteraction: jest.fn()
}));

const mockTrackInteraction = trackInteraction as jest.MockedFunction<typeof trackInteraction>;

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: jest.fn()
});

describe('useTouchGestures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number; timestamp?: number }>) => {
    return {
      type,
      touches: touches.map((touch, index) => ({
        identifier: index,
        clientX: touch.clientX,
        clientY: touch.clientY,
        timestamp: touch.timestamp || Date.now(),
        ...touch
      }))
    } as any;
  };

  describe('Basic Gesture Detection', () => {
    test('should initialize with default options', () => {
      const { result } = renderHook(() => useTouchGestures());

      expect(result.current.gestureState.isActive).toBe(false);
      expect(result.current.gestureState.currentGesture).toBe(null);
      expect(typeof result.current.touchProps.onTouchStart).toBe('function');
      expect(typeof result.current.touchProps.onTouchMove).toBe('function');
      expect(typeof result.current.touchProps.onTouchEnd).toBe('function');
      expect(typeof result.current.resetGestures).toBe('function');
    });

    test('should detect touch start', () => {
      const { result } = renderHook(() => useTouchGestures({
        enableAnalytics: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
      });

      expect(result.current.gestureState.isActive).toBe(true);
      expect(mockTrackInteraction).toHaveBeenCalledWith('touch_gesture', {
        action: 'touch_start',
        touch_count: 1,
        position: expect.objectContaining({ x: 100, y: 100 })
      });
    });

    test('should detect touch end', () => {
      const { result } = renderHook(() => useTouchGestures());

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(result.current.gestureState.isActive).toBe(false);
    });
  });

  describe('Swipe Gesture Detection', () => {
    test('should detect horizontal swipe right', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe,
        swipeThreshold: 50,
        enableAnalytics: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnSwipe).toHaveBeenCalledWith('right', expect.any(Number));
      expect(mockTrackInteraction).toHaveBeenCalledWith('touch_gesture', {
        action: 'swipe',
        direction: 'right',
        distance: expect.any(Number),
        duration: expect.any(Number)
      });
    });

    test('should detect horizontal swipe left', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe,
        swipeThreshold: 50
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 200, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnSwipe).toHaveBeenCalledWith('left', expect.any(Number));
    });

    test('should detect vertical swipe up', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe,
        swipeThreshold: 50
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnSwipe).toHaveBeenCalledWith('up', expect.any(Number));
    });

    test('should detect vertical swipe down', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe,
        swipeThreshold: 50
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 100, clientY: 200 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnSwipe).toHaveBeenCalledWith('down', expect.any(Number));
    });

    test('should not detect swipe below threshold', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe,
        swipeThreshold: 100
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 130, clientY: 100 }]); // Only 30px
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnSwipe).not.toHaveBeenCalled();
    });

    test('should respect swipe timeout', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe,
        swipeTimeout: 100
      }));

      const startTime = Date.now();
      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100, timestamp: startTime }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100, timestamp: startTime + 50 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      // Mock Date.now for the end event
      jest.spyOn(Date, 'now').mockReturnValue(startTime + 200); // 200ms later

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      // Should not detect swipe due to timeout
      expect(mockOnSwipe).not.toHaveBeenCalled();
    });

    test('should disable horizontal swipes when configured', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe,
        enableHorizontalSwipe: false,
        swipeThreshold: 50
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnSwipe).not.toHaveBeenCalled();
    });

    test('should disable vertical swipes when configured', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe,
        enableVerticalSwipe: false,
        swipeThreshold: 50
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 100, clientY: 200 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnSwipe).not.toHaveBeenCalled();
    });
  });

  describe('Tap Gesture Detection', () => {
    test('should detect single tap', () => {
      const mockOnTap = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onTap: mockOnTap,
        enableAnalytics: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      // Wait for tap detection timeout
      act(() => {
        jest.advanceTimersByTime(350);
      });

      expect(mockOnTap).toHaveBeenCalledWith(expect.objectContaining({ x: 100, y: 100 }));
      expect(mockTrackInteraction).toHaveBeenCalledWith('touch_gesture', {
        action: 'tap',
        position: expect.objectContaining({ x: 100, y: 100 })
      });
    });

    test('should detect double tap', () => {
      const mockOnDoubleTap = jest.fn();
      const mockOnTap = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onTap: mockOnTap,
        onDoubleTap: mockOnDoubleTap,
        enableAnalytics: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      // First tap
      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      // Second tap quickly
      act(() => {
        jest.advanceTimersByTime(100);
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnDoubleTap).toHaveBeenCalledWith(expect.objectContaining({ x: 100, y: 100 }));
      expect(mockOnTap).not.toHaveBeenCalled(); // Single tap should be prevented
      expect(mockTrackInteraction).toHaveBeenCalledWith('touch_gesture', {
        action: 'double_tap',
        position: expect.objectContaining({ x: 100, y: 100 })
      });
    });
  });

  describe('Long Press Detection', () => {
    test('should detect long press', () => {
      const mockOnLongPress = jest.fn();
      const mockOnAnnouncement = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onLongPress: mockOnLongPress,
        onAnnouncement: mockOnAnnouncement,
        longPressDuration: 500,
        enableAnalytics: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
      });

      // Advance time to trigger long press
      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(mockOnLongPress).toHaveBeenCalledWith(expect.objectContaining({ x: 100, y: 100 }));
      expect(mockOnAnnouncement).toHaveBeenCalledWith('Long press detected', 'assertive');
      expect(mockTrackInteraction).toHaveBeenCalledWith('touch_gesture', {
        action: 'long_press',
        position: expect.objectContaining({ x: 100, y: 100 })
      });
    });

    test('should cancel long press on movement', () => {
      const mockOnLongPress = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onLongPress: mockOnLongPress,
        longPressDuration: 500
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 120, clientY: 100 }]); // Move >10px

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        jest.advanceTimersByTime(200);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        jest.advanceTimersByTime(400);
      });

      expect(mockOnLongPress).not.toHaveBeenCalled();
    });

    test('should disable long press when configured', () => {
      const mockOnLongPress = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onLongPress: mockOnLongPress,
        enableLongPress: false,
        longPressDuration: 500
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        jest.advanceTimersByTime(600);
      });

      expect(mockOnLongPress).not.toHaveBeenCalled();
    });
  });

  describe('Pinch Gesture Detection', () => {
    test('should detect pinch zoom', () => {
      const mockOnPinch = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onPinch: mockOnPinch,
        enablePinchZoom: true,
        enableAnalytics: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 }
      ]);

      const touchMoveEvent = createTouchEvent('touchmove', [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 }
      ]);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
      });

      expect(result.current.gestureState.isPinching).toBe(true);
      expect(mockOnPinch).toHaveBeenCalledWith(
        expect.any(Number), // scale
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }) // center
      );
      expect(mockTrackInteraction).toHaveBeenCalledWith('touch_gesture', {
        action: 'pinch',
        scale: expect.any(Number),
        center: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      });
    });

    test('should disable pinch when configured', () => {
      const mockOnPinch = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onPinch: mockOnPinch,
        enablePinchZoom: false
      }));

      const touchStartEvent = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 }
      ]);

      const touchMoveEvent = createTouchEvent('touchmove', [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 }
      ]);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
      });

      expect(mockOnPinch).not.toHaveBeenCalled();
    });
  });

  describe('Pull-to-Refresh Detection', () => {
    // Mock window.scrollY
    beforeEach(() => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 0
      });
    });

    test('should detect pull-to-refresh', () => {
      const mockOnPullToRefresh = jest.fn().mockResolvedValue(undefined);
      const mockOnAnnouncement = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onPullToRefresh: mockOnPullToRefresh,
        onAnnouncement: mockOnAnnouncement,
        enablePullToRefresh: true,
        enableAnalytics: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 100, clientY: 250 }]); // 150px down
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnAnnouncement).toHaveBeenCalledWith('Pull to refresh detected', 'polite');
      expect(mockOnPullToRefresh).toHaveBeenCalled();
      expect(mockTrackInteraction).toHaveBeenCalledWith('touch_gesture', {
        action: 'pull_to_refresh'
      });
    });

    test('should not detect pull-to-refresh when not at top', () => {
      // Mock scrolled position
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 100
      });

      const mockOnPullToRefresh = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onPullToRefresh: mockOnPullToRefresh,
        enablePullToRefresh: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 100, clientY: 250 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnPullToRefresh).not.toHaveBeenCalled();
    });

    test('should disable pull-to-refresh when configured', () => {
      const mockOnPullToRefresh = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onPullToRefresh: mockOnPullToRefresh,
        enablePullToRefresh: false
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 100, clientY: 250 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(mockOnPullToRefresh).not.toHaveBeenCalled();
    });
  });

  describe('Haptic Feedback', () => {
    test('should provide haptic feedback when enabled', () => {
      const { result } = renderHook(() => useTouchGestures({
        enableHaptics: true,
        swipeThreshold: 50
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(navigator.vibrate).toHaveBeenCalledWith([10]);
    });

    test('should not provide haptic feedback when disabled', () => {
      const { result } = renderHook(() => useTouchGestures({
        enableHaptics: false,
        swipeThreshold: 50
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      expect(navigator.vibrate).not.toHaveBeenCalled();
    });
  });

  describe('Touch Cancel Handling', () => {
    test('should handle touch cancel', () => {
      const { result } = renderHook(() => useTouchGestures({
        enableAnalytics: true
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchCancelEvent = createTouchEvent('touchcancel', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchCancel(touchCancelEvent);
      });

      expect(result.current.gestureState.isActive).toBe(false);
      expect(mockTrackInteraction).toHaveBeenCalledWith('touch_gesture', {
        action: 'touch_cancel'
      });
    });

    test('should clean up timers on touch cancel', () => {
      const mockOnLongPress = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onLongPress: mockOnLongPress,
        longPressDuration: 500
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      const touchCancelEvent = createTouchEvent('touchcancel', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        jest.advanceTimersByTime(200);
        result.current.touchProps.onTouchCancel(touchCancelEvent);
        jest.advanceTimersByTime(400);
      });

      expect(mockOnLongPress).not.toHaveBeenCalled();
    });
  });

  describe('Reset Gestures', () => {
    test('should reset gesture state', () => {
      const { result } = renderHook(() => useTouchGestures());

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
      });

      expect(result.current.gestureState.isActive).toBe(true);

      act(() => {
        result.current.resetGestures();
      });

      expect(result.current.gestureState.isActive).toBe(false);
      expect(result.current.gestureState.currentGesture).toBe(null);
    });
  });

  describe('Edge Cases', () => {
    test('should handle multiple touches ending at different times', () => {
      const { result } = renderHook(() => useTouchGestures());

      const touchStartEvent = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 }
      ]);

      const touchEndEventOne = createTouchEvent('touchend', [{ clientX: 200, clientY: 100 }]);
      const touchEndEventAll = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchEnd(touchEndEventOne); // One touch ends
      });

      expect(result.current.gestureState.isActive).toBe(true); // Still active

      act(() => {
        result.current.touchProps.onTouchEnd(touchEndEventAll); // All touches end
      });

      expect(result.current.gestureState.isActive).toBe(false);
    });

    test('should handle invalid touch coordinates', () => {
      const mockOnSwipe = jest.fn();
      const { result } = renderHook(() => useTouchGestures({
        onSwipe: mockOnSwipe
      }));

      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: NaN, clientY: 100 }]);
      const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]);
      const touchEndEvent = createTouchEvent('touchend', []);

      act(() => {
        result.current.touchProps.onTouchStart(touchStartEvent);
        result.current.touchProps.onTouchMove(touchMoveEvent);
        result.current.touchProps.onTouchEnd(touchEndEvent);
      });

      // Should not crash or call swipe with invalid coordinates
      expect(mockOnSwipe).not.toHaveBeenCalled();
    });
  });
});