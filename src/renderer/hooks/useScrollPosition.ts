/**
 * useScrollPosition Hook
 * Manages scroll position preservation across view navigation
 * Stores scroll positions in sessionStorage for persistence
 */

import { useEffect, useRef, useCallback } from 'react';

interface ScrollPosition {
  top: number;
  left: number;
}

interface UseScrollPositionOptions {
  key: string;
  enabled?: boolean;
  debounceDelay?: number;
  restoreDelay?: number;
}

const STORAGE_KEY_PREFIX = 'scroll_position_';

export const useScrollPosition = (options: UseScrollPositionOptions) => {
  const {
    key,
    enabled = true,
    debounceDelay = 100,
    restoreDelay = 50
  } = options;

  const containerRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringRef = useRef(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;

  // Save scroll position to sessionStorage
  const saveScrollPosition = useCallback((position: ScrollPosition) => {
    if (!enabled) return;

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(position));
    } catch (error) {
      console.warn('Failed to save scroll position:', error);
    }
  }, [storageKey, enabled]);

  // Load scroll position from sessionStorage
  const loadScrollPosition = useCallback((): ScrollPosition | null => {
    if (!enabled) return null;

    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to load scroll position:', error);
      return null;
    }
  }, [storageKey, enabled]);

  // Debounced scroll handler
  const handleScroll = useCallback(() => {
    if (!enabled || !containerRef.current || isRestoringRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        const scrollElement = containerRef.current === document.body
          ? window
          : containerRef.current;

        const scrollTop = scrollElement === window
          ? window.scrollY
          : (scrollElement as HTMLElement).scrollTop;

        const scrollLeft = scrollElement === window
          ? window.scrollX
          : (scrollElement as HTMLElement).scrollLeft;

        saveScrollPosition({ top: scrollTop, left: scrollLeft });
      }
    }, debounceDelay);
  }, [enabled, saveScrollPosition, debounceDelay]);

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    if (!enabled || !containerRef.current) return;

    const position = loadScrollPosition();
    if (!position) return;

    isRestoringRef.current = true;

    // Delay restoration to allow DOM to fully render
    setTimeout(() => {
      if (containerRef.current) {
        const scrollElement = containerRef.current === document.body
          ? window
          : containerRef.current;

        if (scrollElement === window) {
          window.scrollTo({
            top: position.top,
            left: position.left,
            behavior: 'auto' // Use 'auto' for instant scroll, 'smooth' for animated
          });
        } else {
          (scrollElement as HTMLElement).scrollTop = position.top;
          (scrollElement as HTMLElement).scrollLeft = position.left;
        }
      }

      // Reset restoration flag after a brief delay
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    }, restoreDelay);
  }, [enabled, loadScrollPosition, restoreDelay]);

  // Clear stored scroll position
  const clearScrollPosition = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear scroll position:', error);
    }
  }, [storageKey]);

  // Setup scroll listener and restore position on mount
  useEffect(() => {
    if (!enabled) return;

    const element = containerRef.current || window;

    // Add scroll listener
    element.addEventListener('scroll', handleScroll, { passive: true });

    // Restore scroll position on mount
    restoreScrollPosition();

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, handleScroll, restoreScrollPosition]);

  // Save position before component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Save current scroll position immediately on unmount
      if (enabled && containerRef.current) {
        const scrollElement = containerRef.current === document.body
          ? window
          : containerRef.current;

        const scrollTop = scrollElement === window
          ? window.scrollY
          : (scrollElement as HTMLElement).scrollTop;

        const scrollLeft = scrollElement === window
          ? window.scrollX
          : (scrollElement as HTMLElement).scrollLeft;

        saveScrollPosition({ top: scrollTop, left: scrollLeft });
      }
    };
  }, [enabled, saveScrollPosition]);

  return {
    containerRef,
    restoreScrollPosition,
    clearScrollPosition,
    saveScrollPosition: (position: ScrollPosition) => saveScrollPosition(position)
  };
};

export default useScrollPosition;