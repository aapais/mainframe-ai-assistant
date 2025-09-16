/**
 * useScreenReaderAnnouncements Hook
 * Provides easy access to screen reader announcements within React components
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  EnhancedLiveRegionManager,
  ScreenReaderPriority,
  ScreenReaderMessages,
  getScreenReaderManager
} from '../utils/screenReaderUtils';

export interface UseScreenReaderAnnouncementsOptions {
  /**
   * Custom messages to override defaults
   */
  customMessages?: Partial<ScreenReaderMessages>;

  /**
   * Default priority for announcements
   */
  defaultPriority?: ScreenReaderPriority;

  /**
   * Auto-announce component mount/unmount
   */
  announceLifecycle?: {
    onMount?: string;
    onUnmount?: string;
  };

  /**
   * Auto-announce when component props change
   */
  announceOnPropsChange?: {
    props: string[];
    getMessage: (changes: Record<string, any>) => string;
  };
}

export interface ScreenReaderAnnouncementAPI {
  // Basic announcement
  announce: (message: string, priority?: ScreenReaderPriority) => void;

  // Predefined announcements
  announceLoading: (message?: string) => void;
  announceLoaded: (message?: string) => void;
  announceSaving: (message?: string) => void;
  announceSaved: (message?: string) => void;
  announceError: (error: string) => void;
  announceSuccess: (message?: string) => void;
  announceSearching: (query?: string) => void;
  announceSearchResults: (count: number, query?: string) => void;
  announceFormValidation: (isValid: boolean, errorCount?: number) => void;
  announcePageChange: (pageName: string) => void;
  announceSelectionChange: (selectedItem: string, totalItems?: number) => void;
  announceModalOpen: (modalTitle: string) => void;
  announceModalClose: (modalTitle?: string) => void;
  announceTableUpdate: (rowCount: number, description?: string) => void;
  announceProgress: (current: number, total: number, operation?: string) => void;
  announceProgressComplete: (operation?: string) => void;

  // State management
  setDefaultPriority: (priority: ScreenReaderPriority) => void;
  isEnabled: boolean;
  enable: () => void;
  disable: () => void;
}

/**
 * Hook for managing screen reader announcements
 */
export function useScreenReaderAnnouncements(
  options: UseScreenReaderAnnouncementsOptions = {}
): ScreenReaderAnnouncementAPI {
  const {
    customMessages,
    defaultPriority = 'polite',
    announceLifecycle,
    announceOnPropsChange
  } = options;

  const managerRef = useRef<EnhancedLiveRegionManager | null>(null);
  const isEnabledRef = useRef(true);
  const currentPriorityRef = useRef(defaultPriority);
  const previousPropsRef = useRef<Record<string, any>>({});

  // Initialize manager
  useEffect(() => {
    managerRef.current = getScreenReaderManager(customMessages);

    // Announce component mount
    if (announceLifecycle?.onMount) {
      managerRef.current.announce(announceLifecycle.onMount, currentPriorityRef.current);
    }

    // Cleanup on unmount
    return () => {
      if (announceLifecycle?.onUnmount) {
        managerRef.current?.announce(announceLifecycle.onUnmount, currentPriorityRef.current);
      }
    };
  }, [announceLifecycle, customMessages]);

  // Track prop changes for auto-announcements
  useEffect(() => {
    if (!announceOnPropsChange) return;

    const { props, getMessage } = announceOnPropsChange;
    const currentProps: Record<string, any> = {};
    const changes: Record<string, any> = {};

    // This would need to be implemented by the consuming component
    // passing current prop values through a dependency array or context

    props.forEach(propName => {
      if (previousPropsRef.current[propName] !== currentProps[propName]) {
        changes[propName] = {
          from: previousPropsRef.current[propName],
          to: currentProps[propName]
        };
      }
    });

    if (Object.keys(changes).length > 0 && Object.keys(previousPropsRef.current).length > 0) {
      const message = getMessage(changes);
      if (message && managerRef.current) {
        managerRef.current.announce(message, currentPriorityRef.current);
      }
    }

    previousPropsRef.current = { ...currentProps };
  });

  // Basic announcement function
  const announce = useCallback((message: string, priority?: ScreenReaderPriority) => {
    if (!isEnabledRef.current || !managerRef.current) return;

    const announcementPriority = priority || currentPriorityRef.current;
    managerRef.current.announce(message, announcementPriority);
  }, []);

  // Predefined announcement functions
  const announceLoading = useCallback((message?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceLoading(message);
  }, []);

  const announceLoaded = useCallback((message?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceLoaded(message);
  }, []);

  const announceSaving = useCallback((message?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceSaving(message);
  }, []);

  const announceSaved = useCallback((message?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceSaved(message);
  }, []);

  const announceError = useCallback((error: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceError(error);
  }, []);

  const announceSuccess = useCallback((message?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceSuccess(message);
  }, []);

  const announceSearching = useCallback((query?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceSearching(query);
  }, []);

  const announceSearchResults = useCallback((count: number, query?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceSearchResults(count, query);
  }, []);

  const announceFormValidation = useCallback((isValid: boolean, errorCount?: number) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceFormValidation(isValid, errorCount);
  }, []);

  const announcePageChange = useCallback((pageName: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announcePageChange(pageName);
  }, []);

  const announceSelectionChange = useCallback((selectedItem: string, totalItems?: number) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceSelectionChange(selectedItem, totalItems);
  }, []);

  const announceModalOpen = useCallback((modalTitle: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceModalOpen(modalTitle);
  }, []);

  const announceModalClose = useCallback((modalTitle?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceModalClose(modalTitle);
  }, []);

  const announceTableUpdate = useCallback((rowCount: number, description?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceTableUpdate(rowCount, description);
  }, []);

  const announceProgress = useCallback((current: number, total: number, operation?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceProgress(current, total, operation);
  }, []);

  const announceProgressComplete = useCallback((operation?: string) => {
    if (!isEnabledRef.current || !managerRef.current) return;
    managerRef.current.announceProgressComplete(operation);
  }, []);

  // State management functions
  const setDefaultPriority = useCallback((priority: ScreenReaderPriority) => {
    currentPriorityRef.current = priority;
  }, []);

  const enable = useCallback(() => {
    isEnabledRef.current = true;
  }, []);

  const disable = useCallback(() => {
    isEnabledRef.current = false;
  }, []);

  return {
    announce,
    announceLoading,
    announceLoaded,
    announceSaving,
    announceSaved,
    announceError,
    announceSuccess,
    announceSearching,
    announceSearchResults,
    announceFormValidation,
    announcePageChange,
    announceSelectionChange,
    announceModalOpen,
    announceModalClose,
    announceTableUpdate,
    announceProgress,
    announceProgressComplete,
    setDefaultPriority,
    isEnabled: isEnabledRef.current,
    enable,
    disable
  };
}

/**
 * Specialized hook for search functionality
 */
export function useSearchAnnouncements() {
  const { announceSearching, announceSearchResults, announceError } = useScreenReaderAnnouncements();

  const announceSearchStart = useCallback((query: string) => {
    announceSearching(query);
  }, [announceSearching]);

  const announceSearchEnd = useCallback((results: { count: number; query: string; timeMs?: number }) => {
    let message = `Search completed. Found ${results.count} result${results.count !== 1 ? 's' : ''}`;
    if (results.query) {
      message += ` for "${results.query}"`;
    }
    if (results.timeMs) {
      message += ` in ${(results.timeMs / 1000).toFixed(2)} seconds`;
    }
    announceSearchResults(results.count, results.query);
  }, [announceSearchResults]);

  const announceSearchError = useCallback((error: string, query?: string) => {
    const message = query
      ? `Search failed for "${query}": ${error}`
      : `Search failed: ${error}`;
    announceError(message);
  }, [announceError]);

  return {
    announceSearchStart,
    announceSearchEnd,
    announceSearchError
  };
}

/**
 * Specialized hook for form announcements
 */
export function useFormAnnouncements() {
  const { announceFormValidation, announceSuccess, announceError } = useScreenReaderAnnouncements();

  const announceFieldError = useCallback((fieldName: string, error: string) => {
    announceError(`${fieldName}: ${error}`);
  }, [announceError]);

  const announceFormSubmit = useCallback((isSubmitting: boolean) => {
    if (isSubmitting) {
      announceSuccess('Submitting form...');
    }
  }, [announceSuccess]);

  const announceFormSuccess = useCallback((message?: string) => {
    announceSuccess(message || 'Form submitted successfully');
  }, [announceSuccess]);

  const announceFormError = useCallback((message: string) => {
    announceError(`Form submission failed: ${message}`);
  }, [announceError]);

  const announceValidationSummary = useCallback((errors: Record<string, string[]>) => {
    const errorCount = Object.keys(errors).length;
    if (errorCount === 0) {
      announceFormValidation(true);
    } else {
      const errorMessages = Object.entries(errors)
        .map(([field, fieldErrors]) => `${field}: ${fieldErrors.join(', ')}`)
        .join('. ');
      announceFormValidation(false, errorCount);
      // Detailed errors announced separately
      setTimeout(() => announceError(errorMessages), 500);
    }
  }, [announceFormValidation, announceError]);

  return {
    announceFieldError,
    announceFormSubmit,
    announceFormSuccess,
    announceFormError,
    announceValidationSummary,
    announceFormValidation
  };
}

/**
 * Specialized hook for navigation announcements
 */
export function useNavigationAnnouncements() {
  const { announcePageChange, announceSelectionChange } = useScreenReaderAnnouncements();

  const announceRouteChange = useCallback((routeName: string, routePath?: string) => {
    let message = `Navigated to ${routeName}`;
    if (routePath) {
      message += ` at ${routePath}`;
    }
    announcePageChange(message);
  }, [announcePageChange]);

  const announceTabChange = useCallback((tabName: string, tabIndex: number, totalTabs: number) => {
    announceSelectionChange(`${tabName} tab`, totalTabs);
  }, [announceSelectionChange]);

  const announceMenuToggle = useCallback((isOpen: boolean, menuName?: string) => {
    const action = isOpen ? 'opened' : 'closed';
    const name = menuName || 'Menu';
    announcePageChange(`${name} ${action}`);
  }, [announcePageChange]);

  return {
    announceRouteChange,
    announceTabChange,
    announceMenuToggle
  };
}

export default useScreenReaderAnnouncements;