/**
 * ARIA Live Regions Component
 * Manages screen reader announcements with priority queuing and debouncing
 */

import React, { useEffect, useRef, createContext, useContext, ReactNode } from 'react';

export type LiveRegionPoliteness = 'polite' | 'assertive' | 'off';

export interface AnnouncementOptions {
  politeness?: LiveRegionPoliteness;
  priority?: 'low' | 'medium' | 'high';
  clearPrevious?: boolean;
  delay?: number;
}

export interface QueuedAnnouncement {
  id: string;
  message: string;
  options: Required<AnnouncementOptions>;
  timestamp: number;
}

interface AriaLiveContextValue {
  announce: (message: string, options?: AnnouncementOptions) => void;
  announceError: (message: string) => void;
  announceSuccess: (message: string) => void;
  announceStatus: (message: string) => void;
  clearAnnouncements: (politeness?: LiveRegionPoliteness) => void;
  isAnnouncing: boolean;
}

const AriaLiveContext = createContext<AriaLiveContextValue | null>(null);

export const useAriaLive = (): AriaLiveContextValue => {
  const context = useContext(AriaLiveContext);
  if (!context) {
    throw new Error('useAriaLive must be used within AriaLiveProvider');
  }
  return context;
};

interface AriaLiveRegionsProps {
  children: ReactNode;
  debounceMs?: number;
  maxQueueSize?: number;
}

export const AriaLiveProvider: React.FC<AriaLiveRegionsProps> = ({
  children,
  debounceMs = 150,
  maxQueueSize = 5
}) => {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<QueuedAnnouncement[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAnnouncingRef = useRef<boolean>(false);
  const [isAnnouncing, setIsAnnouncing] = React.useState(false);

  // Default announcement options
  const defaultOptions: Required<AnnouncementOptions> = {
    politeness: 'polite',
    priority: 'medium',
    clearPrevious: false,
    delay: 0
  };

  /**
   * Process the announcement queue
   */
  const processQueue = React.useCallback(() => {
    if (queueRef.current.length === 0) {
      isAnnouncingRef.current = false;
      setIsAnnouncing(false);
      return;
    }

    isAnnouncingRef.current = true;
    setIsAnnouncing(true);

    // Sort by priority (high -> medium -> low) then by timestamp
    queueRef.current.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.options.priority] - priorityOrder[a.options.priority];
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });

    const announcement = queueRef.current.shift()!;
    const targetRef = announcement.options.politeness === 'assertive'
      ? assertiveRef
      : politeRef;

    if (targetRef.current) {
      // Clear previous content if requested
      if (announcement.options.clearPrevious) {
        politeRef.current && (politeRef.current.textContent = '');
        assertiveRef.current && (assertiveRef.current.textContent = '');
      }

      // Set the announcement
      targetRef.current.textContent = announcement.message;

      // Clear after a delay to allow screen readers to process
      setTimeout(() => {
        if (targetRef.current) {
          targetRef.current.textContent = '';
        }
      }, Math.max(1000, announcement.message.length * 50));
    }

    // Process next announcement after delay
    if (queueRef.current.length > 0) {
      setTimeout(processQueue, debounceMs);
    } else {
      isAnnouncingRef.current = false;
      setIsAnnouncing(false);
    }
  }, [debounceMs]);

  /**
   * Add announcement to queue
   */
  const announce = React.useCallback((
    message: string,
    options: AnnouncementOptions = {}
  ): void => {
    if (!message.trim()) return;

    const fullOptions = { ...defaultOptions, ...options };
    const announcement: QueuedAnnouncement = {
      id: `announcement-${Date.now()}-${Math.random()}`,
      message: message.trim(),
      options: fullOptions,
      timestamp: Date.now()
    };

    // Handle immediate high-priority announcements
    if (fullOptions.priority === 'high' && fullOptions.politeness === 'assertive') {
      // Clear queue for high priority assertive announcements
      queueRef.current = [];
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    // Add to queue with size limit
    queueRef.current.push(announcement);
    if (queueRef.current.length > maxQueueSize) {
      queueRef.current = queueRef.current
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.options.priority] - priorityOrder[a.options.priority];
        })
        .slice(0, maxQueueSize);
    }

    // Debounce processing
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const delay = fullOptions.delay || (isAnnouncingRef.current ? debounceMs : 0);
    timeoutRef.current = setTimeout(processQueue, delay);
  }, [debounceMs, maxQueueSize, processQueue]);

  /**
   * Specialized announcement methods
   */
  const announceError = React.useCallback((message: string): void => {
    announce(message, {
      politeness: 'assertive',
      priority: 'high',
      clearPrevious: true
    });
  }, [announce]);

  const announceSuccess = React.useCallback((message: string): void => {
    announce(message, {
      politeness: 'polite',
      priority: 'medium',
      clearPrevious: false
    });
  }, [announce]);

  const announceStatus = React.useCallback((message: string): void => {
    announce(message, {
      politeness: 'polite',
      priority: 'low',
      clearPrevious: false
    });
  }, [announce]);

  /**
   * Clear announcements
   */
  const clearAnnouncements = React.useCallback((
    politeness?: LiveRegionPoliteness
  ): void => {
    if (politeness) {
      queueRef.current = queueRef.current.filter(
        announcement => announcement.options.politeness !== politeness
      );

      const targetRef = politeness === 'assertive' ? assertiveRef : politeRef;
      if (targetRef.current) {
        targetRef.current.textContent = '';
      }
    } else {
      queueRef.current = [];
      if (politeRef.current) politeRef.current.textContent = '';
      if (assertiveRef.current) assertiveRef.current.textContent = '';
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    isAnnouncingRef.current = false;
    setIsAnnouncing(false);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const contextValue: AriaLiveContextValue = {
    announce,
    announceError,
    announceSuccess,
    announceStatus,
    clearAnnouncements,
    isAnnouncing
  };

  return (
    <AriaLiveContext.Provider value={contextValue}>
      {children}

      {/* Screen Reader Live Regions */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <div
          ref={politeRef}
          data-testid="polite-announcements"
          role="status"
          aria-label="Polite announcements"
        />
      </div>

      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        <div
          ref={assertiveRef}
          data-testid="assertive-announcements"
          role="alert"
          aria-label="Important announcements"
        />
      </div>
    </AriaLiveContext.Provider>
  );
};

/**
 * Hook for managing announcements with specific patterns
 */
export const useAnnouncementPatterns = () => {
  const { announce, announceError, announceSuccess } = useAriaLive();

  return {
    /**
     * Announce form validation results
     */
    announceFormValidation: (errors: string[], successMessage?: string) => {
      if (errors.length > 0) {
        const errorMessage = errors.length === 1
          ? `Error: ${errors[0]}`
          : `${errors.length} errors found: ${errors.join(', ')}`;
        announceError(errorMessage);
      } else if (successMessage) {
        announceSuccess(successMessage);
      }
    },

    /**
     * Announce search results
     */
    announceSearchResults: (count: number, query?: string) => {
      const message = count === 0
        ? `No results found${query ? ` for "${query}"` : ''}`
        : count === 1
        ? `1 result found${query ? ` for "${query}"` : ''}`
        : `${count} results found${query ? ` for "${query}"` : ''}`;

      announce(message, { priority: 'medium' });
    },

    /**
     * Announce loading states
     */
    announceLoading: (action: string) => {
      announce(`Loading ${action}...`, {
        priority: 'low',
        clearPrevious: true
      });
    },

    /**
     * Announce completion
     */
    announceCompletion: (action: string) => {
      announceSuccess(`${action} completed`);
    },

    /**
     * Announce navigation
     */
    announceNavigation: (location: string) => {
      announce(`Navigated to ${location}`, {
        priority: 'low',
        delay: 500
      });
    },

    /**
     * Announce data changes
     */
    announceDataChange: (type: 'added' | 'updated' | 'deleted', item: string) => {
      const action = type === 'added' ? 'Added' :
                   type === 'updated' ? 'Updated' : 'Deleted';
      announceSuccess(`${action} ${item}`);
    }
  };
};

/**
 * Component for testing live regions
 */
export const LiveRegionTester: React.FC = () => {
  const { announce, announceError, announceSuccess, clearAnnouncements } = useAriaLive();

  return (
    <div className="p-4 border rounded" data-testid="live-region-tester">
      <h3 className="text-lg font-bold mb-4">ARIA Live Region Tester</h3>

      <div className="space-y-2">
        <button
          onClick={() => announce('This is a polite announcement')}
          className="px-4 py-2 bg-blue-500 text-white rounded mr-2"
        >
          Polite Announcement
        </button>

        <button
          onClick={() => announceError('This is an error message')}
          className="px-4 py-2 bg-red-500 text-white rounded mr-2"
        >
          Error Announcement
        </button>

        <button
          onClick={() => announceSuccess('This is a success message')}
          className="px-4 py-2 bg-green-500 text-white rounded mr-2"
        >
          Success Announcement
        </button>

        <button
          onClick={() => clearAnnouncements()}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default AriaLiveProvider;