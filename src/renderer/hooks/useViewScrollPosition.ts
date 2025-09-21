/**
 * useViewScrollPosition Hook
 * Manages scroll position preservation for the main app views
 * Specifically designed for the dashboard/incidents navigation pattern
 */

import { useEffect, useRef } from 'react';
import { useScrollPosition } from './useScrollPosition';

type ViewType = 'dashboard' | 'incidents' | 'settings';

interface UseViewScrollPositionOptions {
  currentView: ViewType;
  enabled?: boolean;
}

export const useViewScrollPosition = (options: UseViewScrollPositionOptions) => {
  const { currentView, enabled = true } = options;
  const previousViewRef = useRef<ViewType | null>(null);

  // Create scroll position hook for the current view
  const {
    containerRef,
    restoreScrollPosition,
    clearScrollPosition,
    saveScrollPosition
  } = useScrollPosition({
    key: currentView,
    enabled,
    debounceDelay: 150,
    restoreDelay: 100
  });

  // Handle view changes
  useEffect(() => {
    const previousView = previousViewRef.current;
    previousViewRef.current = currentView;

    // If this is not the initial load and view has changed
    if (previousView && previousView !== currentView) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        restoreScrollPosition();
      }, 100);
    }
  }, [currentView, restoreScrollPosition]);

  // Clear scroll positions (useful for logout or reset)
  const clearAllScrollPositions = () => {
    ['dashboard', 'incidents', 'settings'].forEach(view => {
      try {
        sessionStorage.removeItem(`scroll_position_${view}`);
      } catch (error) {
        console.warn(`Failed to clear scroll position for ${view}:`, error);
      }
    });
  };

  // Get current scroll position
  const getCurrentScrollPosition = () => {
    if (!containerRef.current) return { top: 0, left: 0 };

    const scrollElement = containerRef.current === document.body
      ? window
      : containerRef.current;

    const scrollTop = scrollElement === window
      ? window.scrollY
      : (scrollElement as HTMLElement).scrollTop;

    const scrollLeft = scrollElement === window
      ? window.scrollX
      : (scrollElement as HTMLElement).scrollLeft;

    return { top: scrollTop, left: scrollLeft };
  };

  return {
    containerRef,
    restoreScrollPosition,
    clearScrollPosition,
    clearAllScrollPositions,
    getCurrentScrollPosition,
    saveScrollPosition
  };
};

export default useViewScrollPosition;