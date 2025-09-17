/**
 * Accessible Settings Navigation Hook
 * WCAG 2.1 AAA compliant navigation system with cognitive load reduction
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAriaLive, useNavigationAnnouncements } from './useAriaLive';
import type {
  SettingsSection,
  SettingsCategory,
  SettingsNavigationState
} from '../types/settings';

export interface AccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  simplifiedLayout: boolean;
  screenReaderOptimized: boolean;
  focusIndicatorEnhanced: boolean;
  cognitiveLoadReduction: boolean;
  dyslexiaFriendly: boolean;
  adhdFriendly: boolean;
  motorImpairmentSupport: boolean;
}

export interface KeyboardNavigationState {
  focusedIndex: number;
  focusedCategory: string | null;
  navigationMode: 'browse' | 'search' | 'quick-access';
  lastFocusedElement: HTMLElement | null;
  isNavigatingWithKeyboard: boolean;
}

export interface CognitiveLoadMetrics {
  sectionsDisplayed: number;
  currentDepth: number;
  progressThroughFlow: number;
  estimatedCompletionTime: number;
  cognitiveComplexityScore: number;
}

export interface AccessibleNavigationOptions {
  enableProgressiveDisclosure: boolean;
  enableGuidedFlow: boolean;
  enableQuickActions: boolean;
  enableContextHelp: boolean;
  maxSectionsPerView: number;
  enableKeyboardShortcuts: boolean;
  announceNavigationChanges: boolean;
  enableFocusTrapping: boolean;
}

/**
 * Main hook for accessible settings navigation
 */
export const useAccessibleSettingsNavigation = (
  sections: SettingsSection[],
  categories: SettingsCategory[],
  options: Partial<AccessibleNavigationOptions> = {}
) => {
  const defaultOptions: AccessibleNavigationOptions = {
    enableProgressiveDisclosure: true,
    enableGuidedFlow: true,
    enableQuickActions: true,
    enableContextHelp: true,
    maxSectionsPerView: 5,
    enableKeyboardShortcuts: true,
    announceNavigationChanges: true,
    enableFocusTrapping: true,
    ...options
  };

  // Accessibility preferences (would come from user settings)
  const [accessibilityPrefs, setAccessibilityPrefs] = useState<AccessibilityPreferences>({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
    largeText: false,
    simplifiedLayout: false,
    screenReaderOptimized: false,
    focusIndicatorEnhanced: false,
    cognitiveLoadReduction: false,
    dyslexiaFriendly: false,
    adhdFriendly: false,
    motorImpairmentSupport: false
  });

  // Navigation state
  const [navState, setNavState] = useState<SettingsNavigationState>({
    activeSection: '',
    activeSubsection: undefined,
    searchQuery: '',
    isSearching: false,
    isMobileMenuOpen: false,
    breadcrumbs: [],
    filteredSections: sections
  });

  // Keyboard navigation state
  const [keyboardState, setKeyboardState] = useState<KeyboardNavigationState>({
    focusedIndex: -1,
    focusedCategory: null,
    navigationMode: 'browse',
    lastFocusedElement: null,
    isNavigatingWithKeyboard: false
  });

  // Progressive disclosure state
  const [progressiveState, setProgressiveState] = useState({
    currentStep: 0,
    totalSteps: 0,
    isInGuidedMode: false,
    collapsedSections: new Set<string>(),
    essentialSectionsOnly: false
  });

  // Hooks for announcements
  const {
    announce,
    announceStatus,
    announceProgress,
    clearAnnouncements
  } = useAriaLive({
    debounceMs: 200,
    maxQueueSize: 3,
    enableHistory: true
  });

  const {
    announceRouteChange,
    announceModalOpen,
    announceModalClose,
    announceMenuOpen,
    announceMenuClose
  } = useNavigationAnnouncements();

  // Refs for focus management
  const skipLinksRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigationListRef = useRef<HTMLUListElement>(null);
  const currentFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Simplified category grouping for cognitive load reduction
   */
  const simplifiedCategories = useMemo(() => {
    if (!accessibilityPrefs.cognitiveLoadReduction) {
      return categories;
    }

    // Group related categories together
    const essentialCategories = [
      categories.find(cat => cat.id === 'general'),
      categories.find(cat => cat.id === 'api')
    ].filter(Boolean);

    const advancedCategories = [
      categories.find(cat => cat.id === 'cost'),
      categories.find(cat => cat.id === 'dashboard'),
      categories.find(cat => cat.id === 'advanced')
    ].filter(Boolean);

    return [
      {
        id: 'essential',
        title: 'Essential Settings',
        description: 'Basic settings to get started',
        icon: categories[0]?.icon,
        color: '#A100FF',
        order: 1,
        sections: essentialCategories
      },
      {
        id: 'advanced-group',
        title: 'Advanced Options',
        description: 'Additional configuration options',
        icon: categories[4]?.icon,
        color: '#7C2D12',
        order: 2,
        sections: advancedCategories
      }
    ];
  }, [categories, accessibilityPrefs.cognitiveLoadReduction]);

  /**
   * Filtered sections based on cognitive load preferences
   */
  const accessibleSections = useMemo(() => {
    let filteredSections = sections;

    // Apply cognitive load reduction
    if (accessibilityPrefs.cognitiveLoadReduction || accessibilityPrefs.adhdFriendly) {
      // Show only essential sections initially
      if (progressiveState.essentialSectionsOnly) {
        const essentialSectionIds = ['profile', 'general-preferences', 'api-keys'];
        filteredSections = sections.filter(section =>
          essentialSectionIds.includes(section.id)
        );
      }

      // Limit number of sections per view
      if (filteredSections.length > defaultOptions.maxSectionsPerView) {
        filteredSections = filteredSections.slice(0, defaultOptions.maxSectionsPerView);
      }
    }

    // Apply search filtering
    if (navState.isSearching && navState.searchQuery) {
      const query = navState.searchQuery.toLowerCase();
      filteredSections = filteredSections.filter(section =>
        section.title.toLowerCase().includes(query) ||
        section.description.toLowerCase().includes(query) ||
        section.keywords.some(keyword => keyword.toLowerCase().includes(query))
      );
    }

    return filteredSections;
  }, [sections, accessibilityPrefs, progressiveState, navState, defaultOptions.maxSectionsPerView]);

  /**
   * Calculate cognitive load metrics
   */
  const cognitiveMetrics = useMemo((): CognitiveLoadMetrics => {
    const sectionsDisplayed = accessibleSections.length;
    const currentDepth = navState.activeSubsection ? 3 : navState.activeSection ? 2 : 1;

    // Calculate complexity based on number of options and nesting
    let complexityScore = sectionsDisplayed * 2;
    complexityScore += currentDepth * 3;

    // Add penalty for search mode (cognitive overhead)
    if (navState.isSearching) complexityScore += 5;

    // Reduce score for accessibility optimizations
    if (accessibilityPrefs.cognitiveLoadReduction) complexityScore *= 0.6;
    if (accessibilityPrefs.simplifiedLayout) complexityScore *= 0.8;

    return {
      sectionsDisplayed,
      currentDepth,
      progressThroughFlow: progressiveState.currentStep / Math.max(progressiveState.totalSteps, 1),
      estimatedCompletionTime: sectionsDisplayed * 15, // 15 seconds per section
      cognitiveComplexityScore: Math.round(complexityScore)
    };
  }, [accessibleSections, navState, progressiveState, accessibilityPrefs]);

  /**
   * Skip to main content
   */
  const skipToMainContent = useCallback(() => {
    const mainContent = document.querySelector('[role="main"]') as HTMLElement;
    if (mainContent) {
      mainContent.focus();
      announceStatus('Skipped to main content');
    }
  }, [announceStatus]);

  /**
   * Skip to search
   */
  const skipToSearch = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      announceStatus('Focused on search field');
    }
  }, [announceStatus]);

  /**
   * Skip to navigation
   */
  const skipToNavigation = useCallback(() => {
    if (navigationListRef.current) {
      const firstItem = navigationListRef.current.querySelector('[role="menuitem"]') as HTMLElement;
      if (firstItem) {
        firstItem.focus();
        announceStatus('Focused on navigation menu');
      }
    }
  }, [announceStatus]);

  /**
   * Enhanced focus management with screen reader support
   */
  const manageFocus = useCallback((element: HTMLElement, announceContext = true) => {
    if (!element) return;

    // Store previous focus for restoration
    if (currentFocusRef.current && currentFocusRef.current !== element) {
      setKeyboardState(prev => ({
        ...prev,
        lastFocusedElement: currentFocusRef.current
      }));
    }

    // Set focus with scroll prevention if reduced motion is preferred
    element.focus({
      preventScroll: accessibilityPrefs.reducedMotion
    });

    currentFocusRef.current = element;

    // Announce context for screen readers
    if (announceContext && defaultOptions.announceNavigationChanges) {
      const ariaLabel = element.getAttribute('aria-label');
      const textContent = element.textContent?.trim();
      const roleInfo = element.getAttribute('role');

      let announcement = '';
      if (ariaLabel) {
        announcement = ariaLabel;
      } else if (textContent) {
        announcement = textContent;
      }

      if (roleInfo) {
        announcement += `, ${roleInfo}`;
      }

      if (announcement) {
        announceStatus(announcement);
      }
    }
  }, [accessibilityPrefs.reducedMotion, defaultOptions.announceNavigationChanges, announceStatus]);

  /**
   * Keyboard navigation handler
   */
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    // Don't interfere with input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const focusableElements = Array.from(
      document.querySelectorAll(
        '[role="menuitem"]:not([disabled]), [role="button"]:not([disabled]), input:not([disabled]), [tabindex="0"]'
      )
    ) as HTMLElement[];

    const currentIndex = focusableElements.indexOf(event.target as HTMLElement);

    setKeyboardState(prev => ({ ...prev, isNavigatingWithKeyboard: true }));

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % focusableElements.length;
        manageFocus(focusableElements[nextIndex]);
        setKeyboardState(prev => ({ ...prev, focusedIndex: nextIndex }));
        break;

      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        manageFocus(focusableElements[prevIndex]);
        setKeyboardState(prev => ({ ...prev, focusedIndex: prevIndex }));
        break;

      case 'Home':
        event.preventDefault();
        if (focusableElements.length > 0) {
          manageFocus(focusableElements[0]);
          setKeyboardState(prev => ({ ...prev, focusedIndex: 0 }));
          announceStatus('Moved to first item');
        }
        break;

      case 'End':
        event.preventDefault();
        if (focusableElements.length > 0) {
          const lastIndex = focusableElements.length - 1;
          manageFocus(focusableElements[lastIndex]);
          setKeyboardState(prev => ({ ...prev, focusedIndex: lastIndex }));
          announceStatus('Moved to last item');
        }
        break;

      case 'Escape':
        event.preventDefault();
        handleEscapeKey();
        break;
    }
  }, [manageFocus, announceStatus]);

  /**
   * Handle Escape key for modal dialogs and navigation
   */
  const handleEscapeKey = useCallback(() => {
    if (navState.isMobileMenuOpen) {
      setNavState(prev => ({ ...prev, isMobileMenuOpen: false }));
      announceModalClose('Settings navigation menu');
      return;
    }

    if (navState.isSearching) {
      setNavState(prev => ({
        ...prev,
        isSearching: false,
        searchQuery: '',
        filteredSections: sections
      }));
      announceStatus('Search cleared');
      return;
    }

    // Return to previous context
    if (keyboardState.lastFocusedElement) {
      manageFocus(keyboardState.lastFocusedElement, false);
    }
  }, [navState, keyboardState.lastFocusedElement, manageFocus, announceModalClose, announceStatus, sections]);

  /**
   * Keyboard shortcuts handler
   */
  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {
    if (!defaultOptions.enableKeyboardShortcuts) return;

    const isModifierPressed = event.ctrlKey || event.metaKey;

    if (isModifierPressed) {
      switch (event.key.toLowerCase()) {
        case 'k':
          event.preventDefault();
          skipToSearch();
          break;
        case '/':
          event.preventDefault();
          skipToSearch();
          break;
        case ',':
          event.preventDefault();
          // Open settings (if not already in settings)
          announceStatus('Settings shortcut activated');
          break;
      }
    }

    // Non-modifier shortcuts
    switch (event.key) {
      case '?':
        if (!event.shiftKey) break;
        event.preventDefault();
        // Show keyboard shortcuts help
        announceModalOpen('Keyboard shortcuts help');
        break;

      case 'g':
        if (event.altKey) {
          event.preventDefault();
          // Go to general settings
          announceStatus('Navigating to general settings');
        }
        break;
    }
  }, [defaultOptions.enableKeyboardShortcuts, skipToSearch, announceStatus, announceModalOpen]);

  /**
   * Progressive disclosure - show next set of options
   */
  const showMoreOptions = useCallback(() => {
    if (accessibilityPrefs.cognitiveLoadReduction) {
      setProgressiveState(prev => ({
        ...prev,
        essentialSectionsOnly: false,
        currentStep: Math.min(prev.currentStep + 1, prev.totalSteps)
      }));

      announceProgress('Showing additional options. More settings are now available.');
    }
  }, [accessibilityPrefs.cognitiveLoadReduction, announceProgress]);

  /**
   * Start guided setup flow
   */
  const startGuidedFlow = useCallback(() => {
    const essentialSections = ['profile', 'api-keys', 'general-preferences'];

    setProgressiveState({
      currentStep: 0,
      totalSteps: essentialSections.length,
      isInGuidedMode: true,
      collapsedSections: new Set(),
      essentialSectionsOnly: true
    });

    announceProgress('Started guided setup. We\'ll walk you through the essential settings step by step.');
  }, [announceProgress]);

  /**
   * Navigate to next step in guided flow
   */
  const nextGuidedStep = useCallback(() => {
    setProgressiveState(prev => {
      const nextStep = prev.currentStep + 1;
      const isComplete = nextStep >= prev.totalSteps;

      if (isComplete) {
        announceProgress('Guided setup complete! All essential settings have been configured.');
        return {
          ...prev,
          isInGuidedMode: false,
          currentStep: 0,
          essentialSectionsOnly: false
        };
      } else {
        announceProgress(`Step ${nextStep + 1} of ${prev.totalSteps}. Moving to next setting.`);
        return { ...prev, currentStep: nextStep };
      }
    });
  }, [announceProgress]);

  /**
   * Enhanced search with cognitive load considerations
   */
  const performAccessibleSearch = useCallback((query: string) => {
    setNavState(prev => ({
      ...prev,
      searchQuery: query,
      isSearching: query.trim().length > 0
    }));

    if (query.trim()) {
      // Provide search feedback
      const matchCount = accessibleSections.length;
      if (matchCount === 0) {
        announceStatus('No results found. Try different keywords.');
      } else if (matchCount === 1) {
        announceStatus('1 result found.');
      } else {
        announceStatus(`${matchCount} results found.`);
      }
    } else {
      clearAnnouncements();
    }
  }, [accessibleSections.length, announceStatus, clearAnnouncements]);

  /**
   * Update accessibility preferences
   */
  const updateAccessibilityPrefs = useCallback((updates: Partial<AccessibilityPreferences>) => {
    setAccessibilityPrefs(prev => ({ ...prev, ...updates }));

    // Announce changes that affect navigation
    if (updates.cognitiveLoadReduction !== undefined) {
      announceStatus(
        updates.cognitiveLoadReduction
          ? 'Cognitive load reduction enabled. Simplified navigation is now active.'
          : 'Cognitive load reduction disabled. Full navigation restored.'
      );
    }

    if (updates.screenReaderOptimized !== undefined) {
      announceStatus(
        updates.screenReaderOptimized
          ? 'Screen reader optimization enabled.'
          : 'Screen reader optimization disabled.'
      );
    }
  }, [announceStatus]);

  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation);
    document.addEventListener('keydown', handleKeyboardShortcuts);

    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation);
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [handleKeyboardNavigation, handleKeyboardShortcuts]);

  // Monitor system accessibility preferences
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    const handlePreferenceChange = () => {
      setAccessibilityPrefs(prev => ({
        ...prev,
        reducedMotion: reducedMotionQuery.matches,
        highContrast: highContrastQuery.matches
      }));
    };

    reducedMotionQuery.addEventListener('change', handlePreferenceChange);
    highContrastQuery.addEventListener('change', handlePreferenceChange);

    return () => {
      reducedMotionQuery.removeEventListener('change', handlePreferenceChange);
      highContrastQuery.removeEventListener('change', handlePreferenceChange);
    };
  }, []);

  return {
    // State
    navState,
    keyboardState,
    progressiveState,
    accessibilityPrefs,
    cognitiveMetrics,

    // Data
    simplifiedCategories,
    accessibleSections,

    // Navigation actions
    skipToMainContent,
    skipToSearch,
    skipToNavigation,
    manageFocus,

    // Progressive disclosure
    showMoreOptions,
    startGuidedFlow,
    nextGuidedStep,

    // Search
    performAccessibleSearch,

    // Settings
    updateAccessibilityPrefs,

    // Refs for components
    skipLinksRef,
    searchInputRef,
    navigationListRef,

    // Utilities
    announce,
    announceStatus,
    announceProgress,
    announceRouteChange,
    announceModalOpen,
    announceModalClose,
    announceMenuOpen,
    announceMenuClose
  };
};

/**
 * Hook for ADHD-friendly navigation features
 */
export const useADHDFriendlyNavigation = () => {
  const [adhdSettings, setADHDSettings] = useState({
    reduceAnimations: true,
    simplifyChoices: true,
    showProgress: true,
    enableQuickActions: true,
    minimizeDistractions: true,
    useColorCoding: false // Can be overwhelming for some
  });

  const applyADHDOptimizations = useCallback((element: HTMLElement) => {
    if (!element) return;

    // Reduce visual complexity
    if (adhdSettings.minimizeDistractions) {
      element.style.setProperty('--animation-duration', '0ms');
      element.style.setProperty('--transition-duration', '100ms');
    }

    // Add focus enhancements
    element.style.setProperty('--focus-ring-width', '3px');
    element.style.setProperty('--focus-ring-color', '#4338ca');
    element.style.setProperty('--focus-ring-offset', '2px');
  }, [adhdSettings]);

  return {
    adhdSettings,
    setADHDSettings,
    applyADHDOptimizations
  };
};

/**
 * Hook for dyslexia-friendly navigation features
 */
export const useDyslexiaFriendlyNavigation = () => {
  const [dyslexiaSettings, setDyslexiaSettings] = useState({
    useOpenDyslexicFont: false,
    increasedLineSpacing: true,
    largerFontSize: false,
    reducedJustification: true,
    highlightOnHover: true,
    simplifiedLanguage: true
  });

  const applyDyslexiaOptimizations = useCallback((element: HTMLElement) => {
    if (!element) return;

    if (dyslexiaSettings.useOpenDyslexicFont) {
      element.style.fontFamily = 'OpenDyslexic, Arial, sans-serif';
    }

    if (dyslexiaSettings.increasedLineSpacing) {
      element.style.lineHeight = '1.6';
    }

    if (dyslexiaSettings.largerFontSize) {
      element.style.fontSize = '1.125em';
    }

    if (dyslexiaSettings.reducedJustification) {
      element.style.textAlign = 'left';
    }
  }, [dyslexiaSettings]);

  return {
    dyslexiaSettings,
    setDyslexiaSettings,
    applyDyslexiaOptimizations
  };
};

export default useAccessibleSettingsNavigation;