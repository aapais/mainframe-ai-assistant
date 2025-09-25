/**
 * Enhanced Touch Gesture Support Hook
 *
 * Comprehensive touch and mobile gesture support with:
 * - Swipe navigation (left/right, up/down)
 * - Pinch-to-zoom support
 * - Long press detection
 * - Pull-to-refresh
 * - Momentum scrolling
 * - Accessibility support for screen readers
 * - Haptic feedback
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef, TouchEvent } from 'react';
import { trackInteraction } from '../utils/analytics';

export interface TouchGestureOptions {
  /** Enable swipe left/right navigation */
  enableHorizontalSwipe?: boolean;
  /** Enable swipe up/down navigation */
  enableVerticalSwipe?: boolean;
  /** Enable pinch-to-zoom */
  enablePinchZoom?: boolean;
  /** Enable long press detection */
  enableLongPress?: boolean;
  /** Enable pull-to-refresh */
  enablePullToRefresh?: boolean;
  /** Minimum swipe distance in pixels */
  swipeThreshold?: number;
  /** Maximum time for swipe gesture in ms */
  swipeTimeout?: number;
  /** Long press duration in ms */
  longPressDuration?: number;
  /** Enable haptic feedback */
  enableHaptics?: boolean;
  /** Enable interaction analytics */
  enableAnalytics?: boolean;
  /** Announcement callback for screen readers */
  onAnnouncement?: (message: string, priority: 'polite' | 'assertive') => void;
  /** Callback for swipe gestures */
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', distance: number) => void;
  /** Callback for pinch gesture */
  onPinch?: (scale: number, center: { x: number; y: number }) => void;
  /** Callback for long press */
  onLongPress?: (point: { x: number; y: number }) => void;
  /** Callback for pull-to-refresh */
  onPullToRefresh?: () => Promise<void>;
  /** Callback for tap gesture */
  onTap?: (point: { x: number; y: number }) => void;
  /** Callback for double tap */
  onDoubleTap?: (point: { x: number; y: number }) => void;
}

export interface TouchGestureReturn {
  touchProps: {
    onTouchStart: (event: TouchEvent) => void;
    onTouchMove: (event: TouchEvent) => void;
    onTouchEnd: (event: TouchEvent) => void;
    onTouchCancel: (event: TouchEvent) => void;
  };
  gestureState: {
    isActive: boolean;
    currentGesture: string | null;
    swipeDirection: string | null;
    pinchScale: number;
    isPinching: boolean;
    isLongPressing: boolean;
    isPullingToRefresh: boolean;
  };
  resetGestures: () => void;
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface GestureState {
  isActive: boolean;
  startPoints: TouchPoint[];
  currentPoints: TouchPoint[];
  initialDistance: number;
  currentScale: number;
  gestureType: string | null;
  swipeDirection: string | null;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  lastTapTime: number;
  tapCount: number;
}

// Utility functions
const getDistance = (point1: TouchPoint, point2: TouchPoint): number => {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const getCenter = (point1: TouchPoint, point2: TouchPoint): { x: number; y: number } => {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2,
  };
};

const getSwipeDirection = (
  start: TouchPoint,
  end: TouchPoint,
  threshold: number
): string | null => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < threshold) return null;

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (angle >= -45 && angle <= 45) return 'right';
  if (angle >= 135 || angle <= -135) return 'left';
  if (angle >= 45 && angle <= 135) return 'down';
  if (angle >= -135 && angle <= -45) return 'up';

  return null;
};

const hapticFeedback = (type: 'impact' | 'selection' | 'notification' = 'impact') => {
  if ('vibrate' in navigator) {
    // Simple vibration patterns for different feedback types
    const patterns = {
      impact: [10],
      selection: [5],
      notification: [10, 50, 10],
    };
    navigator.vibrate(patterns[type]);
  }
};

/**
 * Hook for comprehensive touch gesture support
 */
export const useTouchGestures = (options: TouchGestureOptions = {}): TouchGestureReturn => {
  const {
    enableHorizontalSwipe = true,
    enableVerticalSwipe = true,
    enablePinchZoom = true,
    enableLongPress = true,
    enablePullToRefresh = false,
    swipeThreshold = 50,
    swipeTimeout = 300,
    longPressDuration = 500,
    enableHaptics = true,
    enableAnalytics = true,
    onAnnouncement,
    onSwipe,
    onPinch,
    onLongPress,
    onPullToRefresh,
    onTap,
    onDoubleTap,
  } = options;

  const [gestureState, setGestureState] = useState<GestureState>({
    isActive: false,
    startPoints: [],
    currentPoints: [],
    initialDistance: 0,
    currentScale: 1,
    gestureType: null,
    swipeDirection: null,
    longPressTimer: null,
    lastTapTime: 0,
    tapCount: 0,
  });

  const gestureRef = useRef<GestureState>(gestureState);
  gestureRef.current = gestureState;

  // Update gesture state
  const updateGestureState = useCallback((updates: Partial<GestureState>) => {
    setGestureState(prev => ({ ...prev, ...updates }));
  }, []);

  // Convert Touch to TouchPoint
  const touchToPoint = useCallback(
    (touch: Touch): TouchPoint => ({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    }),
    []
  );

  // Handle touch start
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      const touches = Array.from(event.touches).map(touchToPoint);

      // Clear any existing long press timer
      if (gestureRef.current.longPressTimer) {
        clearTimeout(gestureRef.current.longPressTimer);
      }

      updateGestureState({
        isActive: true,
        startPoints: touches,
        currentPoints: touches,
        gestureType: null,
        swipeDirection: null,
        initialDistance: touches.length === 2 ? getDistance(touches[0], touches[1]) : 0,
        currentScale: 1,
      });

      // Start long press timer for single touch
      if (enableLongPress && touches.length === 1) {
        const longPressTimer = setTimeout(() => {
          if (enableHaptics) hapticFeedback('notification');

          onLongPress?.(touches[0]);
          onAnnouncement?.('Long press detected', 'assertive');

          if (enableAnalytics) {
            trackInteraction('touch_gesture', {
              action: 'long_press',
              position: touches[0],
            });
          }

          updateGestureState({
            gestureType: 'longpress',
            longPressTimer: null,
          });
        }, longPressDuration);

        updateGestureState({ longPressTimer });
      }

      if (enableAnalytics) {
        trackInteraction('touch_gesture', {
          action: 'touch_start',
          touch_count: touches.length,
          position: touches[0],
        });
      }
    },
    [
      touchToPoint,
      updateGestureState,
      enableLongPress,
      enableHaptics,
      enableAnalytics,
      longPressDuration,
      onLongPress,
      onAnnouncement,
    ]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!gestureRef.current.isActive) return;

      const touches = Array.from(event.touches).map(touchToPoint);
      const { startPoints, longPressTimer, gestureType } = gestureRef.current;

      // Cancel long press if touch moves significantly
      if (longPressTimer && touches.length === 1 && startPoints.length === 1) {
        const distance = getDistance(startPoints[0], touches[0]);
        if (distance > 10) {
          // 10px threshold for movement cancellation
          clearTimeout(longPressTimer);
          updateGestureState({ longPressTimer: null });
        }
      }

      updateGestureState({ currentPoints: touches });

      // Handle pinch zoom
      if (enablePinchZoom && touches.length === 2 && startPoints.length === 2) {
        const currentDistance = getDistance(touches[0], touches[1]);
        const scale = currentDistance / gestureRef.current.initialDistance;

        updateGestureState({
          gestureType: 'pinch',
          currentScale: scale,
        });

        const center = getCenter(touches[0], touches[1]);
        onPinch?.(scale, center);

        if (enableAnalytics) {
          trackInteraction('touch_gesture', {
            action: 'pinch',
            scale,
            center,
          });
        }
      }

      // Handle pull-to-refresh
      if (enablePullToRefresh && touches.length === 1 && startPoints.length === 1) {
        const dy = touches[0].y - startPoints[0].y;
        if (dy > 100 && window.scrollY === 0) {
          // 100px threshold at top of page
          updateGestureState({ gestureType: 'pulltorefresh' });
          onAnnouncement?.('Pull to refresh detected', 'polite');
        }
      }
    },
    [
      updateGestureState,
      enablePinchZoom,
      enablePullToRefresh,
      enableAnalytics,
      onPinch,
      onAnnouncement,
    ]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      const { startPoints, currentPoints, gestureType, longPressTimer, lastTapTime, tapCount } =
        gestureRef.current;

      // Clear long press timer
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }

      // Handle swipe gestures
      if (startPoints.length === 1 && currentPoints.length === 1 && !gestureType) {
        const start = startPoints[0];
        const end = currentPoints[0];
        const timeDiff = end.timestamp - start.timestamp;

        if (timeDiff <= swipeTimeout) {
          let direction: string | null = null;

          if (enableHorizontalSwipe || enableVerticalSwipe) {
            direction = getSwipeDirection(start, end, swipeThreshold);

            if (direction) {
              const distance = getDistance(start, end);

              // Filter directions based on enabled options
              if ((direction === 'left' || direction === 'right') && !enableHorizontalSwipe) {
                direction = null;
              }
              if ((direction === 'up' || direction === 'down') && !enableVerticalSwipe) {
                direction = null;
              }

              if (direction) {
                if (enableHaptics) hapticFeedback('impact');

                onSwipe?.(direction as any, distance);
                onAnnouncement?.(`Swiped ${direction}`, 'polite');

                updateGestureState({
                  gestureType: 'swipe',
                  swipeDirection: direction,
                });

                if (enableAnalytics) {
                  trackInteraction('touch_gesture', {
                    action: 'swipe',
                    direction,
                    distance,
                    duration: timeDiff,
                  });
                }
              }
            }
          }

          // Handle tap and double tap if no swipe detected
          if (!direction) {
            const currentTime = Date.now();
            const timeSinceLastTap = currentTime - lastTapTime;

            if (timeSinceLastTap < 300 && tapCount === 1) {
              // Double tap detected
              if (enableHaptics) hapticFeedback('selection');

              onDoubleTap?.(end);
              onAnnouncement?.('Double tap detected', 'polite');

              updateGestureState({
                gestureType: 'doubletap',
                tapCount: 0,
                lastTapTime: 0,
              });

              if (enableAnalytics) {
                trackInteraction('touch_gesture', {
                  action: 'double_tap',
                  position: end,
                });
              }
            } else {
              // Single tap
              updateGestureState({
                tapCount: 1,
                lastTapTime: currentTime,
              });

              // Wait for potential double tap
              setTimeout(() => {
                if (
                  gestureRef.current.tapCount === 1 &&
                  gestureRef.current.lastTapTime === currentTime
                ) {
                  if (enableHaptics) hapticFeedback('selection');

                  onTap?.(end);

                  updateGestureState({
                    gestureType: 'tap',
                    tapCount: 0,
                    lastTapTime: 0,
                  });

                  if (enableAnalytics) {
                    trackInteraction('touch_gesture', {
                      action: 'tap',
                      position: end,
                    });
                  }
                }
              }, 300);
            }
          }
        }
      }

      // Handle pull-to-refresh completion
      if (gestureType === 'pulltorefresh' && enablePullToRefresh) {
        if (enableHaptics) hapticFeedback('notification');
        onPullToRefresh?.();

        if (enableAnalytics) {
          trackInteraction('touch_gesture', {
            action: 'pull_to_refresh',
          });
        }
      }

      // Reset gesture state if no more touches
      if (event.touches.length === 0) {
        updateGestureState({
          isActive: false,
          gestureType: null,
          swipeDirection: null,
          longPressTimer: null,
          currentScale: 1,
        });
      }
    },
    [
      updateGestureState,
      enableHorizontalSwipe,
      enableVerticalSwipe,
      enablePullToRefresh,
      enableHaptics,
      enableAnalytics,
      swipeThreshold,
      swipeTimeout,
      onSwipe,
      onTap,
      onDoubleTap,
      onPullToRefresh,
      onAnnouncement,
    ]
  );

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    if (gestureRef.current.longPressTimer) {
      clearTimeout(gestureRef.current.longPressTimer);
    }

    updateGestureState({
      isActive: false,
      gestureType: null,
      swipeDirection: null,
      longPressTimer: null,
      currentScale: 1,
    });

    if (enableAnalytics) {
      trackInteraction('touch_gesture', {
        action: 'touch_cancel',
      });
    }
  }, [updateGestureState, enableAnalytics]);

  // Reset gestures function
  const resetGestures = useCallback(() => {
    if (gestureRef.current.longPressTimer) {
      clearTimeout(gestureRef.current.longPressTimer);
    }

    setGestureState({
      isActive: false,
      startPoints: [],
      currentPoints: [],
      initialDistance: 0,
      currentScale: 1,
      gestureType: null,
      swipeDirection: null,
      longPressTimer: null,
      lastTapTime: 0,
      tapCount: 0,
    });
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (gestureRef.current.longPressTimer) {
        clearTimeout(gestureRef.current.longPressTimer);
      }
    };
  }, []);

  return {
    touchProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
    gestureState: {
      isActive: gestureState.isActive,
      currentGesture: gestureState.gestureType,
      swipeDirection: gestureState.swipeDirection,
      pinchScale: gestureState.currentScale,
      isPinching: gestureState.gestureType === 'pinch',
      isLongPressing: gestureState.gestureType === 'longpress',
      isPullingToRefresh: gestureState.gestureType === 'pulltorefresh',
    },
    resetGestures,
  };
};

export default useTouchGestures;
