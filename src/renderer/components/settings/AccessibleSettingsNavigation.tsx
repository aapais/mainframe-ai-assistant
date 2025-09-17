/**
 * Accessible Settings Navigation Component
 * WCAG 2.1 AAA compliant navigation with cognitive load reduction
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Menu,
  ArrowLeft,
  HelpCircle,
  Eye,
  Zap,
  Play,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Home,
  SkipForward
} from 'lucide-react';

import { useAccessibleSettingsNavigation } from '../../hooks/useAccessibleSettingsNavigation';
import type {
  SettingsSection,
  SettingsCategory,
  SettingsNavigationProps
} from '../../types/settings';

interface AccessibleSettingsNavigationProps extends Omit<SettingsNavigationProps, 'className'> {
  accessibilityMode?: 'standard' | 'simplified' | 'guided';
  enableProgressiveDisclosure?: boolean;
  enableGuidedFlow?: boolean;
  showCognitiveLoadIndicator?: boolean;
  className?: string;
}

/**
 * Skip Links Component for keyboard navigation
 */
const SkipLinks: React.FC<{
  onSkipToMain: () => void;
  onSkipToSearch: () => void;
  onSkipToNavigation: () => void;
}> = ({ onSkipToMain, onSkipToSearch, onSkipToNavigation }) => (
  <div
    className="skip-links sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-white focus:p-4 focus:shadow-lg"
    role="navigation"
    aria-label="Skip navigation links"
  >
    <button
      onClick={onSkipToMain}
      className="skip-link mr-4 px-3 py-2 bg-blue-600 text-white rounded focus:ring-2 focus:ring-blue-300"
    >
      Skip to main content
    </button>
    <button
      onClick={onSkipToSearch}
      className="skip-link mr-4 px-3 py-2 bg-blue-600 text-white rounded focus:ring-2 focus:ring-blue-300"
    >
      Skip to search
    </button>
    <button
      onClick={onSkipToNavigation}
      className="skip-link px-3 py-2 bg-blue-600 text-white rounded focus:ring-2 focus:ring-blue-300"
    >
      Skip to navigation
    </button>
  </div>
);

/**
 * Cognitive Load Indicator Component
 */
const CognitiveLoadIndicator: React.FC<{
  metrics: {
    sectionsDisplayed: number;
    cognitiveComplexityScore: number;
    estimatedCompletionTime: number;
  };
}> = ({ metrics }) => {
  const getComplexityColor = (score: number) => {
    if (score <= 10) return 'text-green-600';
    if (score <= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplexityLabel = (score: number) => {
    if (score <= 10) return 'Low complexity';
    if (score <= 20) return 'Medium complexity';
    return 'High complexity - consider simplifying';
  };

  return (
    <div
      className="cognitive-load-indicator p-3 bg-gray-50 border-l-4 border-blue-500 mb-4"
      role="status"
      aria-live="polite"
      aria-label="Navigation complexity information"
    >
      <div className="flex items-center space-x-2 text-sm">
        <Eye className="w-4 h-4 text-blue-500" aria-hidden="true" />
        <span className="font-medium">Navigation Overview:</span>
      </div>
      <div className="mt-1 text-sm text-gray-600 space-y-1">
        <div>
          {metrics.sectionsDisplayed} sections visible
        </div>
        <div className={getComplexityColor(metrics.cognitiveComplexityScore)}>
          {getComplexityLabel(metrics.cognitiveComplexityScore)}
        </div>
        <div>
          Estimated time: {Math.ceil(metrics.estimatedCompletionTime / 60)} minutes
        </div>
      </div>
    </div>
  );
};

/**
 * Guided Flow Progress Component
 */
const GuidedFlowProgress: React.FC<{
  currentStep: number;
  totalSteps: number;
  isInGuidedMode: boolean;
  onStartGuided: () => void;
  onNextStep: () => void;
}> = ({ currentStep, totalSteps, isInGuidedMode, onStartGuided, onNextStep }) => {
  if (!isInGuidedMode && totalSteps === 0) {
    return (
      <div className="guided-flow-prompt p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <div className="flex items-start space-x-3">
          <Play className="w-5 h-5 text-blue-600 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900 mb-1">
              Need help getting started?
            </h3>
            <p className="text-sm text-blue-700 mb-3">
              We can guide you through the essential settings step by step.
            </p>
            <button
              onClick={onStartGuided}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
              aria-describedby="guided-flow-description"
            >
              Start Guided Setup
            </button>
            <div id="guided-flow-description" className="sr-only">
              This will walk you through the most important settings in a structured way
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInGuidedMode) return null;

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div
      className="guided-flow-progress p-4 bg-green-50 border border-green-200 rounded-lg mb-4"
      role="status"
      aria-live="polite"
      aria-label={`Guided setup progress: step ${currentStep + 1} of ${totalSteps}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-600" aria-hidden="true" />
          <span className="text-sm font-medium text-green-900">
            Guided Setup - Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
        <span className="text-xs text-green-700">
          {Math.round(progressPercentage)}% complete
        </span>
      </div>

      <div className="w-full bg-green-200 rounded-full h-2 mb-3">
        <div
          className="bg-green-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Setup progress: ${Math.round(progressPercentage)} percent complete`}
        />
      </div>

      {currentStep < totalSteps - 1 && (
        <button
          onClick={onNextStep}
          className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:ring-2 focus:ring-green-300 focus:ring-offset-2"
        >
          Next Step
          <SkipForward className="w-4 h-4 ml-2 inline" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

/**
 * Enhanced Search Component with accessibility features
 */
const AccessibleSearchBar: React.FC<{
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  resultsCount: number;
}> = ({ searchQuery, onSearchChange, onClearSearch, searchInputRef, resultsCount }) => {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <div className="search-container mb-4" role="search" aria-label="Settings search">
      <label htmlFor="settings-search" className="sr-only">
        Search settings and options
      </label>

      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          <Search
            className="w-4 h-4 text-gray-400"
            aria-hidden="true"
          />
        </div>

        <input
          ref={searchInputRef}
          id="settings-search"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search settings... (Ctrl+K)"
          className={`
            w-full pl-10 pr-10 py-2
            border border-gray-300 rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            text-gray-900 placeholder-gray-500
            ${searchFocused ? 'bg-white' : 'bg-gray-50'}
            transition-colors duration-200
          `}
          aria-describedby="search-results-status search-help"
          autoComplete="off"
        />

        {searchQuery && (
          <button
            onClick={onClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:text-gray-600"
            aria-label="Clear search"
            tabIndex={0}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Search status for screen readers */}
      <div
        id="search-results-status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {searchQuery && (
          resultsCount === 0
            ? 'No results found'
            : `${resultsCount} result${resultsCount !== 1 ? 's' : ''} found`
        )}
      </div>

      <div id="search-help" className="sr-only">
        Use Ctrl+K to focus search. Type to filter settings by name or description.
      </div>
    </div>
  );
};

/**
 * Simplified Category Card Component
 */
const SimplifiedCategoryCard: React.FC<{
  category: any;
  sections: SettingsSection[];
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: (path: string) => void;
  accessibilityPrefs: any;
}> = ({ category, sections, isExpanded, onToggle, onNavigate, accessibilityPrefs }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Apply accessibility optimizations
  useEffect(() => {
    if (cardRef.current && accessibilityPrefs.dyslexiaFriendly) {
      cardRef.current.style.lineHeight = '1.6';
      cardRef.current.style.textAlign = 'left';
    }
  }, [accessibilityPrefs.dyslexiaFriendly]);

  return (
    <div
      ref={cardRef}
      className={`
        category-card border rounded-lg mb-4 overflow-hidden
        ${accessibilityPrefs.highContrast ? 'border-gray-900' : 'border-gray-200'}
        ${accessibilityPrefs.simplifiedLayout ? 'shadow-none' : 'shadow-sm hover:shadow-md'}
        transition-shadow duration-200
      `}
    >
      <button
        onClick={onToggle}
        className={`
          w-full p-4 text-left
          ${accessibilityPrefs.highContrast ? 'bg-white hover:bg-gray-100' : 'bg-gray-50 hover:bg-gray-100'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
          transition-colors duration-200
        `}
        aria-expanded={isExpanded}
        aria-controls={`category-${category.id}-content`}
        aria-describedby={`category-${category.id}-description`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="flex-shrink-0"
              style={{ color: category.color }}
              aria-hidden="true"
            >
              {category.icon}
            </div>
            <div>
              <h3 className={`
                text-base font-medium text-gray-900
                ${accessibilityPrefs.largeText ? 'text-lg' : ''}
              `}>
                {category.title}
              </h3>
              <p
                id={`category-${category.id}-description`}
                className={`
                  text-sm text-gray-600 mt-1
                  ${accessibilityPrefs.largeText ? 'text-base' : ''}
                `}
              >
                {category.description}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
              {sections.length} setting{sections.length !== 1 ? 's' : ''}
            </span>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                isExpanded ? 'transform rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div
          id={`category-${category.id}-content`}
          className="px-4 pb-4"
          role="region"
          aria-labelledby={`category-${category.id}-title`}
        >
          <ul
            className="space-y-2"
            role="menu"
            aria-label={`${category.title} settings`}
          >
            {sections.map((section) => (
              <li key={section.id} role="none">
                <button
                  onClick={() => onNavigate(section.path)}
                  className={`
                    w-full text-left p-3 rounded-md transition-colors duration-200
                    hover:bg-gray-100 focus:bg-gray-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                    ${accessibilityPrefs.motorImpairmentSupport ? 'p-4' : 'p-3'}
                  `}
                  role="menuitem"
                  aria-describedby={`section-${section.id}-description`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 text-gray-600" aria-hidden="true">
                      {section.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`
                        text-sm font-medium text-gray-900
                        ${accessibilityPrefs.largeText ? 'text-base' : ''}
                      `}>
                        {section.title}
                        {section.badge && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {section.badge}
                          </span>
                        )}
                      </h4>
                      <p
                        id={`section-${section.id}-description`}
                        className={`
                          text-xs text-gray-600 mt-1
                          ${accessibilityPrefs.largeText ? 'text-sm' : ''}
                        `}
                      >
                        {section.description}
                      </p>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Main Accessible Settings Navigation Component
 */
export const AccessibleSettingsNavigation: React.FC<AccessibleSettingsNavigationProps> = ({
  sections = [],
  categories = [],
  currentPath = '',
  onNavigate,
  accessibilityMode = 'standard',
  enableProgressiveDisclosure = true,
  enableGuidedFlow = true,
  showCognitiveLoadIndicator = true,
  isMobile = false,
  className = ''
}) => {
  const {
    navState,
    keyboardState,
    progressiveState,
    accessibilityPrefs,
    cognitiveMetrics,
    simplifiedCategories,
    accessibleSections,
    skipToMainContent,
    skipToSearch,
    skipToNavigation,
    showMoreOptions,
    startGuidedFlow,
    nextGuidedStep,
    performAccessibleSearch,
    skipLinksRef,
    searchInputRef,
    navigationListRef,
    announceMenuOpen,
    announceMenuClose
  } = useAccessibleSettingsNavigation(sections, categories, {
    enableProgressiveDisclosure,
    enableGuidedFlow,
    maxSectionsPerView: accessibilityMode === 'simplified' ? 3 : 6,
    announceNavigationChanges: true
  });

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Group sections by category for simplified view
  const categorizedSections = useMemo(() => {
    const grouped = new Map();

    accessibleSections.forEach(section => {
      const categoryId = section.category.id;
      if (!grouped.has(categoryId)) {
        grouped.set(categoryId, {
          category: section.category,
          sections: []
        });
      }
      grouped.get(categoryId).sections.push(section);
    });

    return Array.from(grouped.values());
  }, [accessibleSections]);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
        announceMenuClose(categories.find(cat => cat.id === categoryId)?.title || 'Category');
      } else {
        newSet.add(categoryId);
        announceMenuOpen(categories.find(cat => cat.id === categoryId)?.title || 'Category');
      }
      return newSet;
    });
  }, [categories, announceMenuOpen, announceMenuClose]);

  const handleNavigation = useCallback((path: string) => {
    onNavigate?.(path);
  }, [onNavigate]);

  const handleShowMoreOptions = useCallback(() => {
    setShowAdvancedOptions(true);
    showMoreOptions();
  }, [showMoreOptions]);

  return (
    <div className={`accessible-settings-navigation ${className}`}>
      {/* Skip Links */}
      <SkipLinks
        onSkipToMain={skipToMainContent}
        onSkipToSearch={skipToSearch}
        onSkipToNavigation={skipToNavigation}
      />

      {/* Live Region for Announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="polite-announcements"
      />
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-testid="assertive-announcements"
      />

      {/* Main Navigation Content */}
      <div
        className="navigation-content p-4"
        role="navigation"
        aria-label="Settings navigation"
      >
        {/* Cognitive Load Indicator */}
        {showCognitiveLoadIndicator && (
          <CognitiveLoadIndicator metrics={cognitiveMetrics} />
        )}

        {/* Guided Flow Progress */}
        {enableGuidedFlow && (
          <GuidedFlowProgress
            currentStep={progressiveState.currentStep}
            totalSteps={progressiveState.totalSteps}
            isInGuidedMode={progressiveState.isInGuidedMode}
            onStartGuided={startGuidedFlow}
            onNextStep={nextGuidedStep}
          />
        )}

        {/* Search Bar */}
        <AccessibleSearchBar
          searchQuery={navState.searchQuery}
          onSearchChange={performAccessibleSearch}
          onClearSearch={() => performAccessibleSearch('')}
          searchInputRef={searchInputRef}
          resultsCount={accessibleSections.length}
        />

        {/* Navigation Menu */}
        <nav
          ref={navigationListRef}
          className="navigation-menu"
          role="navigation"
          aria-label="Settings categories and sections"
        >
          {categorizedSections.map(({ category, sections: categorySections }) => (
            <SimplifiedCategoryCard
              key={category.id}
              category={category}
              sections={categorySections}
              isExpanded={expandedCategories.has(category.id)}
              onToggle={() => handleCategoryToggle(category.id)}
              onNavigate={handleNavigation}
              accessibilityPrefs={accessibilityPrefs}
            />
          ))}

          {/* Show More Options Button */}
          {enableProgressiveDisclosure &&
           accessibilityPrefs.cognitiveLoadReduction &&
           !showAdvancedOptions && (
            <div className="show-more-container mt-6 text-center">
              <button
                onClick={handleShowMoreOptions}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 transition-colors duration-200"
                aria-describedby="show-more-description"
              >
                <MoreHorizontal className="w-4 h-4 mr-2 inline" aria-hidden="true" />
                Show More Options
              </button>
              <div id="show-more-description" className="sr-only">
                This will display additional settings categories that may be less commonly used
              </div>
            </div>
          )}
        </nav>

        {/* Accessibility Quick Actions */}
        <div
          className="accessibility-quick-actions mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
          role="region"
          aria-label="Accessibility quick actions"
        >
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
            Accessibility Options
          </h3>

          <div className="space-y-2">
            <button
              onClick={() => {/* Toggle simplified layout */}}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 rounded p-1"
              aria-pressed={accessibilityPrefs.simplifiedLayout}
            >
              {accessibilityPrefs.simplifiedLayout ? '✓' : '○'} Simplified Layout
            </button>

            <button
              onClick={() => {/* Toggle cognitive load reduction */}}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 rounded p-1"
              aria-pressed={accessibilityPrefs.cognitiveLoadReduction}
            >
              {accessibilityPrefs.cognitiveLoadReduction ? '✓' : '○'} Reduce Cognitive Load
            </button>

            <button
              onClick={() => {/* Show keyboard shortcuts help */}}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 rounded p-1"
            >
              <HelpCircle className="w-3 h-3 mr-1 inline" aria-hidden="true" />
              Keyboard Shortcuts (?)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessibleSettingsNavigation;