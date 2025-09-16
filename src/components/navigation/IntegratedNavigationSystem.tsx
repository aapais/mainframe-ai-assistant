/**
 * Integrated Navigation System
 *
 * Comprehensive navigation system that orchestrates all navigation components
 * for efficient KB browsing with context-aware features and smart coordination.
 *
 * Features:
 * - Coordinated navigation between all components
 * - Context-aware component activation
 * - Smart layout adaptation based on screen size
 * - Navigation state persistence
 * - Cross-component communication
 * - Unified keyboard shortcut management
 * - Accessibility orchestration
 * - Performance optimization through component lazy loading
 *
 * @author Swarm Navigation Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, memo, Suspense, lazy } from 'react';
import { BreadcrumbNavigation, BreadcrumbItem } from './BreadcrumbNavigation';
import { CategoryFilters, FilterOption } from './CategoryFilters';
import { QuickAccessPatterns, AccessPattern } from './QuickAccessPatterns';
import { SearchResultNavigation, SearchResult, SearchContext } from './SearchResultNavigation';
import { RecentlyViewedSidebar, RecentEntry } from './RecentlyViewedSidebar';
import { NavigationShortcuts, KeyBinding, ShortcutAction } from './NavigationShortcuts';
import { useNavigationState } from '../../hooks/useNavigationState';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import './IntegratedNavigationSystem.css';

// Lazy load non-critical components
const AdvancedFilters = lazy(() => import('./AdvancedFilters'));
const NavigationAnalytics = lazy(() => import('./NavigationAnalytics'));

// ========================
// TYPES & INTERFACES
// ========================

export interface NavigationContext {
  currentLocation: string;
  breadcrumb: BreadcrumbItem[];
  activeCategory?: string;
  searchQuery?: string;
  searchResults?: SearchResult[];
  selectedResult?: SearchResult;
  recentEntries: RecentEntry[];
  filters: Record<string, any>;
  view: 'list' | 'grid' | 'detail';
  sidebar: 'collapsed' | 'expanded' | 'floating';
}

export interface NavigationConfig {
  layout: 'standard' | 'compact' | 'sidebar' | 'fullwidth';
  components: {
    breadcrumb: boolean;
    categoryFilters: boolean;
    quickAccess: boolean;
    searchNavigation: boolean;
    recentSidebar: boolean;
    shortcuts: boolean;
  };
  behavior: {
    autoCollapse: boolean;
    persistState: boolean;
    contextAware: boolean;
    smartSuggestions: boolean;
  };
  accessibility: {
    announcements: boolean;
    keyboardNavigation: boolean;
    screenReader: boolean;
    highContrast: boolean;
  };
}

export interface IntegratedNavigationSystemProps {
  className?: string;
  /** Navigation configuration */
  config?: Partial<NavigationConfig>;
  /** Current navigation context */
  context: NavigationContext;
  /** Available filter options */
  filterOptions: FilterOption[];
  /** Quick access patterns */
  accessPatterns: AccessPattern[];
  /** Search context when in search mode */
  searchContext?: SearchContext;
  /** Enable analytics tracking */
  enableAnalytics?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Event handlers */
  onNavigationChange?: (context: Partial<NavigationContext>) => void;
  onLocationChange?: (location: string, breadcrumb: BreadcrumbItem[]) => void;
  onSearch?: (query: string, filters: Record<string, any>) => void;
  onResultSelect?: (result: SearchResult) => void;
  onFilterChange?: (filters: Record<string, any>) => void;
  onLayoutChange?: (layout: NavigationConfig['layout']) => void;
  onConfigChange?: (config: Partial<NavigationConfig>) => void;
  /** Accessibility */
  ariaLabel?: string;
  announceNavigation?: boolean;
}

// ========================
// DEFAULT CONFIGURATION
// ========================

const DEFAULT_CONFIG: NavigationConfig = {
  layout: 'standard',
  components: {
    breadcrumb: true,
    categoryFilters: true,
    quickAccess: true,
    searchNavigation: true,
    recentSidebar: true,
    shortcuts: true
  },
  behavior: {
    autoCollapse: true,
    persistState: true,
    contextAware: true,
    smartSuggestions: true
  },
  accessibility: {
    announcements: true,
    keyboardNavigation: true,
    screenReader: true,
    highContrast: false
  }
};

// ========================
// LAYOUT COMPONENTS
// ========================

interface NavigationLayoutProps {
  layout: NavigationConfig['layout'];
  responsive: any;
  children: {
    breadcrumb?: React.ReactNode;
    filters?: React.ReactNode;
    quickAccess?: React.ReactNode;
    searchNav?: React.ReactNode;
    sidebar?: React.ReactNode;
    content?: React.ReactNode;
  };
}

const NavigationLayout = memo<NavigationLayoutProps>(({ layout, responsive, children }) => {
  const { isMobile, isTablet } = responsive;

  // Mobile layout - stacked
  if (isMobile) {
    return (
      <div className="navigation-layout mobile">
        <div className="navigation-header">
          {children.breadcrumb}
          {children.filters}
        </div>
        <div className="navigation-main">
          <div className="navigation-content">
            {children.content}
          </div>
          {children.sidebar}
        </div>
        {children.quickAccess}
        {children.searchNav}
      </div>
    );
  }

  // Tablet layout - 2-column
  if (isTablet) {
    return (
      <div className="navigation-layout tablet">
        <div className="navigation-header">
          {children.breadcrumb}
          <div className="navigation-controls">
            {children.filters}
            {children.quickAccess}
          </div>
        </div>
        <div className="navigation-main">
          <div className="navigation-content">
            {children.content}
            {children.searchNav}
          </div>
          {children.sidebar}
        </div>
      </div>
    );
  }

  // Desktop layouts
  switch (layout) {
    case 'compact':
      return (
        <div className="navigation-layout compact">
          <div className="navigation-header">
            {children.breadcrumb}
            <div className="navigation-controls">
              {children.filters}
              {children.quickAccess}
            </div>
          </div>
          <div className="navigation-main">
            <div className="navigation-content">
              {children.content}
              {children.searchNav}
            </div>
            {children.sidebar}
          </div>
        </div>
      );

    case 'sidebar':
      return (
        <div className="navigation-layout sidebar-layout">
          <div className="navigation-sidebar">
            {children.sidebar}
            {children.quickAccess}
          </div>
          <div className="navigation-main">
            <div className="navigation-header">
              {children.breadcrumb}
              {children.filters}
            </div>
            <div className="navigation-content">
              {children.content}
              {children.searchNav}
            </div>
          </div>
        </div>
      );

    case 'fullwidth':
      return (
        <div className="navigation-layout fullwidth">
          <div className="navigation-header">
            {children.breadcrumb}
            <div className="navigation-controls">
              {children.filters}
              {children.quickAccess}
              {children.sidebar}
            </div>
          </div>
          <div className="navigation-main">
            <div className="navigation-content">
              {children.content}
            </div>
            {children.searchNav}
          </div>
        </div>
      );

    default: // standard
      return (
        <div className="navigation-layout standard">
          <div className="navigation-header">
            {children.breadcrumb}
          </div>
          <div className="navigation-controls">
            {children.filters}
            {children.quickAccess}
          </div>
          <div className="navigation-main">
            <div className="navigation-content">
              {children.content}
            </div>
            <div className="navigation-secondary">
              {children.searchNav}
              {children.sidebar}
            </div>
          </div>
        </div>
      );
  }
});

NavigationLayout.displayName = 'NavigationLayout';

// ========================
// MAIN COMPONENT
// ========================

export const IntegratedNavigationSystem: React.FC<IntegratedNavigationSystemProps> = memo(({
  className = '',
  config: configProp,
  context,
  filterOptions = [],
  accessPatterns = [],
  searchContext,
  enableAnalytics = false,
  loading = false,
  onNavigationChange,
  onLocationChange,
  onSearch,
  onResultSelect,
  onFilterChange,
  onLayoutChange,
  onConfigChange,
  ariaLabel = 'Navigation system',
  announceNavigation = true
}) => {
  const navigationRef = useRef<HTMLDivElement>(null);

  // Merge configuration
  const config = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...configProp,
    components: {
      ...DEFAULT_CONFIG.components,
      ...configProp?.components
    },
    behavior: {
      ...DEFAULT_CONFIG.behavior,
      ...configProp?.behavior
    },
    accessibility: {
      ...DEFAULT_CONFIG.accessibility,
      ...configProp?.accessibility
    }
  }), [configProp]);

  // Responsive layout detection
  const responsive = useResponsiveLayout();

  // Navigation state management
  const {
    navigationState,
    updateNavigationState,
    persistNavigationState,
    restoreNavigationState
  } = useNavigationState({
    persistState: config.behavior.persistState,
    initialState: context
  });

  // Merged context with state
  const effectiveContext = useMemo(() => ({
    ...context,
    ...navigationState
  }), [context, navigationState]);

  // Component visibility based on context and config
  const componentVisibility = useMemo(() => {
    const base = config.components;

    // Context-aware adjustments
    if (config.behavior.contextAware) {
      // Hide some components in search mode
      if (effectiveContext.searchQuery) {
        return {
          ...base,
          quickAccess: false,
          categoryFilters: false
        };
      }

      // Hide search navigation when not in search
      if (!searchContext || !effectiveContext.searchResults?.length) {
        return {
          ...base,
          searchNavigation: false
        };
      }
    }

    return base;
  }, [config, effectiveContext, searchContext]);

  // Keyboard shortcut actions
  const shortcutActions: ShortcutAction[] = useMemo(() => [
    {
      id: 'open-search',
      handler: () => {
        // Trigger search opening
        document.dispatchEvent(new CustomEvent('navigation:open-search'));
      }
    },
    {
      id: 'create-entry',
      handler: () => {
        // Trigger entry creation
        document.dispatchEvent(new CustomEvent('navigation:create-entry'));
      }
    },
    {
      id: 'show-recent',
      handler: () => {
        updateNavigationState({ sidebar: 'expanded' });
      }
    },
    {
      id: 'show-favorites',
      handler: () => {
        // Trigger favorites view
        document.dispatchEvent(new CustomEvent('navigation:show-favorites'));
      }
    },
    {
      id: 'next-result',
      handler: () => {
        if (searchContext && effectiveContext.searchResults) {
          const currentIndex = effectiveContext.searchResults.findIndex(
            r => r.id === effectiveContext.selectedResult?.id
          );
          const nextIndex = Math.min(currentIndex + 1, effectiveContext.searchResults.length - 1);
          const nextResult = effectiveContext.searchResults[nextIndex];

          if (nextResult) {
            onResultSelect?.(nextResult);
            updateNavigationState({ selectedResult: nextResult });
          }
        }
      },
      context: 'search'
    },
    {
      id: 'prev-result',
      handler: () => {
        if (searchContext && effectiveContext.searchResults) {
          const currentIndex = effectiveContext.searchResults.findIndex(
            r => r.id === effectiveContext.selectedResult?.id
          );
          const prevIndex = Math.max(currentIndex - 1, 0);
          const prevResult = effectiveContext.searchResults[prevIndex];

          if (prevResult) {
            onResultSelect?.(prevResult);
            updateNavigationState({ selectedResult: prevResult });
          }
        }
      },
      context: 'search'
    }
  ], [updateNavigationState, searchContext, effectiveContext, onResultSelect]);

  // Event handlers
  const handleBreadcrumbNavigate = useCallback((item: BreadcrumbItem, index: number) => {
    const newBreadcrumb = effectiveContext.breadcrumb.slice(0, index + 1);
    const newLocation = item.href || item.label;

    updateNavigationState({
      currentLocation: newLocation,
      breadcrumb: newBreadcrumb
    });

    onLocationChange?.(newLocation, newBreadcrumb);
    onNavigationChange?.({ currentLocation: newLocation, breadcrumb: newBreadcrumb });
  }, [effectiveContext.breadcrumb, updateNavigationState, onLocationChange, onNavigationChange]);

  const handleFilterChange = useCallback((filters: Record<string, any>) => {
    updateNavigationState({ filters });
    onFilterChange?.(filters);
    onNavigationChange?.({ filters });
  }, [updateNavigationState, onFilterChange, onNavigationChange]);

  const handleQuickAccessClick = useCallback((item: any) => {
    // Handle quick access item navigation
    updateNavigationState({ currentLocation: item.href || item.title });
    onNavigationChange?.({ currentLocation: item.href || item.title });
  }, [updateNavigationState, onNavigationChange]);

  const handleSearchResultSelect = useCallback((result: SearchResult) => {
    updateNavigationState({ selectedResult: result });
    onResultSelect?.(result);
    onNavigationChange?.({ selectedResult: result });
  }, [updateNavigationState, onResultSelect, onNavigationChange]);

  const handleRecentEntryClick = useCallback((entry: RecentEntry) => {
    // Navigate to recent entry
    updateNavigationState({
      currentLocation: entry.title,
      breadcrumb: [
        ...effectiveContext.breadcrumb,
        { id: entry.id, label: entry.title }
      ]
    });
    onNavigationChange?.({ currentLocation: entry.title });
  }, [effectiveContext.breadcrumb, updateNavigationState, onNavigationChange]);

  const handleLayoutChange = useCallback((newLayout: NavigationConfig['layout']) => {
    const newConfig = { ...config, layout: newLayout };
    onLayoutChange?.(newLayout);
    onConfigChange?.(newConfig);
  }, [config, onLayoutChange, onConfigChange]);

  // Auto-collapse behavior for mobile
  React.useEffect(() => {
    if (config.behavior.autoCollapse && responsive.isMobile && effectiveContext.sidebar === 'expanded') {
      const timer = setTimeout(() => {
        updateNavigationState({ sidebar: 'collapsed' });
      }, 5000); // Auto-collapse after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [config.behavior.autoCollapse, responsive.isMobile, effectiveContext.sidebar, updateNavigationState]);

  // Context change announcements
  React.useEffect(() => {
    if (announceNavigation && config.accessibility.announcements) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = `Navigated to ${effectiveContext.currentLocation}`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  }, [effectiveContext.currentLocation, announceNavigation, config.accessibility.announcements]);

  // Loading state
  if (loading) {
    return (
      <div className={`integrated-navigation-system loading ${className}`}>
        <div className="navigation-skeleton">
          <div className="skeleton-breadcrumb" />
          <div className="skeleton-filters" />
          <div className="skeleton-content" />
        </div>
      </div>
    );
  }

  const getCurrentContext = () => {
    if (effectiveContext.searchQuery && effectiveContext.searchResults?.length) {
      return 'search';
    }
    if (effectiveContext.activeCategory) {
      return 'category';
    }
    if (effectiveContext.selectedResult) {
      return 'entry';
    }
    return 'navigation';
  };

  return (
    <div
      ref={navigationRef}
      className={`integrated-navigation-system ${config.layout} ${className}`}
      role="navigation"
      aria-label={ariaLabel}
      data-layout={config.layout}
      data-context={getCurrentContext()}
    >
      <NavigationLayout
        layout={config.layout}
        responsive={responsive}
      >
        {{
          // Breadcrumb Navigation
          breadcrumb: componentVisibility.breadcrumb && (
            <BreadcrumbNavigation
              items={effectiveContext.breadcrumb}
              interactive={true}
              responsive={true}
              onNavigate={handleBreadcrumbNavigate}
              ariaLabel="Location breadcrumb"
              announceNavigation={config.accessibility.announcements}
            />
          ),

          // Category Filters
          filters: componentVisibility.categoryFilters && (
            <CategoryFilters
              options={filterOptions}
              activeFilters={Object.keys(effectiveContext.filters || {})}
              enableSearch={true}
              enableBulkOps={true}
              showCounts={true}
              showTrending={true}
              responsive={true}
              onFiltersChange={(filters) => handleFilterChange({ categoryFilters: filters })}
              ariaLabel="Category filters"
              announceChanges={config.accessibility.announcements}
            />
          ),

          // Quick Access Patterns
          quickAccess: componentVisibility.quickAccess && (
            <QuickAccessPatterns
              patterns={accessPatterns}
              enableReordering={true}
              showStats={true}
              showShortcuts={config.accessibility.keyboardNavigation}
              compact={responsive.isMobile}
              onItemClick={handleQuickAccessClick}
              ariaLabel="Quick access patterns"
            />
          ),

          // Search Result Navigation
          searchNav: componentVisibility.searchNavigation && searchContext && (
            <SearchResultNavigation
              results={effectiveContext.searchResults || []}
              context={searchContext}
              selectedIndex={effectiveContext.searchResults?.findIndex(
                r => r.id === effectiveContext.selectedResult?.id
              )}
              enableClustering={true}
              enableMiniMap={true}
              showControls={true}
              enableKeyboard={config.accessibility.keyboardNavigation}
              onResultSelect={handleSearchResultSelect}
              ariaLabel="Search result navigation"
              announceNavigation={config.accessibility.announcements}
            />
          ),

          // Recently Viewed Sidebar
          sidebar: componentVisibility.recentSidebar && (
            <RecentlyViewedSidebar
              entries={effectiveContext.recentEntries}
              enablePinning={true}
              enableSearch={true}
              enablePreview={true}
              showMetadata={true}
              groupByTime={true}
              collapsible={true}
              initiallyCollapsed={effectiveContext.sidebar === 'collapsed'}
              compact={responsive.isMobile || config.layout === 'compact'}
              onEntryClick={handleRecentEntryClick}
              ariaLabel="Recently viewed entries"
              announceChanges={config.accessibility.announcements}
            />
          )
        }}
      </NavigationLayout>

      {/* Keyboard Shortcuts */}
      {componentVisibility.shortcuts && (
        <NavigationShortcuts
          shortcuts={[]} // Would be provided by parent
          actions={shortcutActions}
          showHints={config.accessibility.keyboardNavigation}
          enableHelp={true}
          currentContext={getCurrentContext()}
          enableCustomization={false}
          announceShortcuts={config.accessibility.announcements}
        />
      )}

      {/* Advanced Features (Lazy Loaded) */}
      {config.behavior.smartSuggestions && (
        <Suspense fallback={null}>
          <AdvancedFilters />
        </Suspense>
      )}

      {enableAnalytics && (
        <Suspense fallback={null}>
          <NavigationAnalytics context={effectiveContext} />
        </Suspense>
      )}

      {/* Layout Controls */}
      <div className="navigation-layout-controls">
        <button
          type="button"
          className="layout-toggle"
          onClick={() => {
            const layouts: NavigationConfig['layout'][] = ['standard', 'compact', 'sidebar', 'fullwidth'];
            const currentIndex = layouts.indexOf(config.layout);
            const nextLayout = layouts[(currentIndex + 1) % layouts.length];
            handleLayoutChange(nextLayout);
          }}
          title="Switch layout"
          aria-label="Switch navigation layout"
        >
          ⚏
        </button>
      </div>

      {/* Screen Reader Status */}
      <div className="sr-only" aria-live="polite">
        Navigation system active with {Object.values(componentVisibility).filter(Boolean).length} components
        in {getCurrentContext()} context
      </div>
    </div>
  );
});

IntegratedNavigationSystem.displayName = 'IntegratedNavigationSystem';

export default IntegratedNavigationSystem;