/**
 * useAriaLive Hook
 * Custom hook for managing ARIA live announcements with advanced features
 */

import { useCallback, useRef, useEffect } from 'react';

export type LiveRegionPoliteness = 'polite' | 'assertive' | 'off';
export type AnnouncementPriority = 'low' | 'medium' | 'high';

export interface AnnouncementOptions {
  politeness?: LiveRegionPoliteness;
  priority?: AnnouncementPriority;
  clearPrevious?: boolean;
  delay?: number;
  interrupt?: boolean;
  persist?: boolean;
}

export interface AnnouncementEntry {
  id: string;
  message: string;
  timestamp: number;
  options: Required<AnnouncementOptions>;
  status: 'pending' | 'announced' | 'cleared';
}

interface UseAriaLiveOptions {
  debounceMs?: number;
  maxQueueSize?: number;
  enableHistory?: boolean;
  autoCleanup?: boolean;
}

/**
 * Advanced ARIA Live Hook with queuing, prioritization, and history
 */
export const useAriaLive = (options: UseAriaLiveOptions = {}) => {
  const {
    debounceMs = 150,
    maxQueueSize = 5,
    enableHistory = true,
    autoCleanup = true
  } = options;

  const queueRef = useRef<AnnouncementEntry[]>([]);
  const historyRef = useRef<AnnouncementEntry[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const regionsRef = useRef<{
    polite: HTMLDivElement | null;
    assertive: HTMLDivElement | null;
  }>({ polite: null, assertive: null });

  // Default announcement options
  const defaultOptions: Required<AnnouncementOptions> = {
    politeness: 'polite',
    priority: 'medium',
    clearPrevious: false,
    delay: 0,
    interrupt: false,
    persist: false
  };

  /**
   * Initialize live regions if they don't exist
   */
  const initializeLiveRegions = useCallback(() => {
    if (!regionsRef.current.polite) {
      regionsRef.current.polite = document.querySelector('[aria-live="polite"][data-testid="polite-announcements"]') as HTMLDivElement;
    }
    if (!regionsRef.current.assertive) {
      regionsRef.current.assertive = document.querySelector('[aria-live="assertive"][data-testid="assertive-announcements"]') as HTMLDivElement;
    }

    // Create regions if they don't exist (fallback)
    if (!regionsRef.current.polite) {
      const politeRegion = document.createElement('div');
      politeRegion.setAttribute('aria-live', 'polite');
      politeRegion.setAttribute('aria-atomic', 'true');
      politeRegion.setAttribute('data-testid', 'polite-announcements');
      politeRegion.className = 'sr-only';
      politeRegion.setAttribute('role', 'status');
      document.body.appendChild(politeRegion);
      regionsRef.current.polite = politeRegion;
    }

    if (!regionsRef.current.assertive) {
      const assertiveRegion = document.createElement('div');
      assertiveRegion.setAttribute('aria-live', 'assertive');
      assertiveRegion.setAttribute('aria-atomic', 'true');
      assertiveRegion.setAttribute('data-testid', 'assertive-announcements');
      assertiveRegion.className = 'sr-only';
      assertiveRegion.setAttribute('role', 'alert');
      document.body.appendChild(assertiveRegion);
      regionsRef.current.assertive = assertiveRegion;
    }
  }, []);

  /**
   * Process the announcement queue
   */
  const processQueue = useCallback(async () => {
    if (queueRef.current.length === 0 || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    initializeLiveRegions();

    // Sort by priority and timestamp
    queueRef.current.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.options.priority] - priorityOrder[a.options.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    const announcement = queueRef.current.shift()!;
    const targetRegion = announcement.options.politeness === 'assertive'
      ? regionsRef.current.assertive
      : regionsRef.current.polite;

    if (targetRegion) {
      // Clear previous content if requested
      if (announcement.options.clearPrevious) {
        if (regionsRef.current.polite) regionsRef.current.polite.textContent = '';
        if (regionsRef.current.assertive) regionsRef.current.assertive.textContent = '';
      }

      // Set the announcement
      targetRegion.textContent = announcement.message;
      announcement.status = 'announced';

      // Add to history
      if (enableHistory) {
        historyRef.current.push(announcement);
        // Limit history size
        if (historyRef.current.length > 50) {
          historyRef.current = historyRef.current.slice(-25);
        }
      }

      // Clear after appropriate time unless persistent
      if (!announcement.options.persist) {
        const clearDelay = Math.max(1000, announcement.message.length * 60);
        setTimeout(() => {
          if (targetRegion && targetRegion.textContent === announcement.message) {
            targetRegion.textContent = '';
            announcement.status = 'cleared';
          }
        }, clearDelay);
      }
    }

    isProcessingRef.current = false;

    // Process next announcement if any
    if (queueRef.current.length > 0) {
      setTimeout(processQueue, debounceMs);
    }
  }, [debounceMs, enableHistory, initializeLiveRegions]);

  /**
   * Main announce function
   */
  const announce = useCallback((
    message: string,
    announcementOptions: AnnouncementOptions = {}
  ): string => {
    if (!message || !message.trim()) {
      throw new Error('Announcement message cannot be empty');
    }

    const fullOptions = { ...defaultOptions, ...announcementOptions };
    const id = `announcement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const entry: AnnouncementEntry = {
      id,
      message: message.trim(),
      timestamp: Date.now(),
      options: fullOptions,
      status: 'pending'
    };

    // Handle interrupt option
    if (fullOptions.interrupt) {
      queueRef.current = [];
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    // Add to queue with size limit
    queueRef.current.push(entry);
    if (queueRef.current.length > maxQueueSize) {
      // Remove lowest priority items first
      queueRef.current.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[a.options.priority] - priorityOrder[b.options.priority];
      });
      queueRef.current = queueRef.current.slice(-maxQueueSize);
    }

    // Schedule processing
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const delay = fullOptions.delay || (isProcessingRef.current ? debounceMs : 0);
    timeoutRef.current = setTimeout(processQueue, delay);

    return id;
  }, [debounceMs, maxQueueSize, processQueue]);

  /**
   * Specialized announcement functions
   */
  const announceError = useCallback((message: string): string => {
    return announce(message, {
      politeness: 'assertive',
      priority: 'high',
      clearPrevious: true,
      interrupt: true
    });
  }, [announce]);

  const announceSuccess = useCallback((message: string): string => {
    return announce(message, {
      politeness: 'polite',
      priority: 'medium',
      clearPrevious: false
    });
  }, [announce]);

  const announceWarning = useCallback((message: string): string => {
    return announce(message, {
      politeness: 'assertive',
      priority: 'high',
      clearPrevious: false
    });
  }, [announce]);

  const announceStatus = useCallback((message: string, persist: boolean = false): string => {
    return announce(message, {
      politeness: 'polite',
      priority: 'low',
      clearPrevious: false,
      persist
    });
  }, [announce]);

  const announceProgress = useCallback((message: string): string => {
    return announce(message, {
      politeness: 'polite',
      priority: 'low',
      clearPrevious: true,
      delay: 500
    });
  }, [announce]);

  /**
   * Clear announcements
   */
  const clearAnnouncements = useCallback((
    politeness?: LiveRegionPoliteness,
    priority?: AnnouncementPriority
  ): void => {
    // Filter queue
    queueRef.current = queueRef.current.filter(entry => {
      if (politeness && entry.options.politeness !== politeness) return true;
      if (priority && entry.options.priority !== priority) return true;
      return false;
    });

    // Clear live regions
    initializeLiveRegions();

    if (!politeness || politeness === 'polite') {
      if (regionsRef.current.polite) {
        regionsRef.current.polite.textContent = '';
      }
    }

    if (!politeness || politeness === 'assertive') {
      if (regionsRef.current.assertive) {
        regionsRef.current.assertive.textContent = '';
      }
    }

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    isProcessingRef.current = false;
  }, [initializeLiveRegions]);

  /**
   * Get announcement history
   */
  const getHistory = useCallback((limit?: number): AnnouncementEntry[] => {
    const history = [...historyRef.current].reverse();
    return limit ? history.slice(0, limit) : history;
  }, []);

  /**
   * Check if announcement is in queue
   */
  const isInQueue = useCallback((id: string): boolean => {
    return queueRef.current.some(entry => entry.id === id);
  }, []);

  /**
   * Remove specific announcement from queue
   */
  const removeFromQueue = useCallback((id: string): boolean => {
    const initialLength = queueRef.current.length;
    queueRef.current = queueRef.current.filter(entry => entry.id !== id);
    return queueRef.current.length < initialLength;
  }, []);

  /**
   * Get queue status
   */
  const getQueueStatus = useCallback(() => {
    return {
      length: queueRef.current.length,
      isProcessing: isProcessingRef.current,
      nextAnnouncement: queueRef.current[0] || null
    };
  }, []);

  /**
   * Batch announcements
   */
  const announceBatch = useCallback((
    messages: Array<{ message: string; options?: AnnouncementOptions }>
  ): string[] => {
    return messages.map(({ message, options }) => announce(message, options));
  }, [announce]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (autoCleanup) {
        // Clean up created regions
        const politeRegion = document.querySelector('[data-testid="polite-announcements"]');
        const assertiveRegion = document.querySelector('[data-testid="assertive-announcements"]');

        if (politeRegion && !politeRegion.closest('[data-testid="app"]')) {
          politeRegion.remove();
        }
        if (assertiveRegion && !assertiveRegion.closest('[data-testid="app"]')) {
          assertiveRegion.remove();
        }
      }
    };
  }, [autoCleanup]);

  return {
    // Main functions
    announce,
    announceError,
    announceSuccess,
    announceWarning,
    announceStatus,
    announceProgress,
    announceBatch,

    // Queue management
    clearAnnouncements,
    removeFromQueue,
    isInQueue,
    getQueueStatus,

    // History
    getHistory: enableHistory ? getHistory : () => [],

    // State
    isProcessing: isProcessingRef.current,
    queueLength: queueRef.current.length,

    // Utilities
    initializeLiveRegions
  };
};

/**
 * Hook for form-specific announcements
 */
export const useFormAnnouncements = () => {
  const { announce, announceError, announceSuccess } = useAriaLive();

  return {
    announceFieldError: (fieldName: string, error: string) => {
      announceError(`${fieldName}: ${error}`);
    },

    announceValidationSummary: (errors: Record<string, string>) => {
      const errorCount = Object.keys(errors).length;
      if (errorCount === 0) return;

      const message = errorCount === 1
        ? `1 error found: ${Object.values(errors)[0]}`
        : `${errorCount} errors found. Please review and correct the highlighted fields.`;

      announceError(message);
    },

    announceFormSubmission: (success: boolean, message: string) => {
      if (success) {
        announceSuccess(message || 'Form submitted successfully');
      } else {
        announceError(message || 'Form submission failed');
      }
    },

    announceFieldChange: (fieldName: string, newValue: string) => {
      announce(`${fieldName} changed to ${newValue}`, {
        politeness: 'polite',
        priority: 'low',
        delay: 1000
      });
    }
  };
};

/**
 * Hook for navigation announcements
 */
export const useNavigationAnnouncements = () => {
  const { announce, announceStatus } = useAriaLive();

  return {
    announceRouteChange: (routeName: string, pageTitle?: string) => {
      const message = pageTitle
        ? `Navigated to ${pageTitle}`
        : `Navigated to ${routeName}`;
      announce(message, { delay: 500 });
    },

    announceModalOpen: (modalTitle: string) => {
      announce(`${modalTitle} dialog opened`, {
        politeness: 'assertive',
        priority: 'medium'
      });
    },

    announceModalClose: (modalTitle?: string) => {
      const message = modalTitle
        ? `${modalTitle} dialog closed`
        : 'Dialog closed';
      announce(message, { priority: 'low' });
    },

    announceMenuOpen: (menuName: string) => {
      announceStatus(`${menuName} menu expanded`);
    },

    announceMenuClose: (menuName: string) => {
      announceStatus(`${menuName} menu collapsed`);
    },

    announceTabChange: (tabName: string, tabIndex: number, totalTabs: number) => {
      announce(`${tabName} tab selected, ${tabIndex + 1} of ${totalTabs}`, {
        priority: 'medium',
        delay: 200
      });
    }
  };
};

export default useAriaLive;