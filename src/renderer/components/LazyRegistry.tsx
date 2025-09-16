/**
 * Lazy Component Registry
 * Central registry for all lazy-loaded components with proper chunking
 */

import React from 'react';
import {
  withLazyLoading,
  ModalLoadingFallback,
  PanelLoadingFallback,
  DefaultLoadingFallback
} from './LazyComponents';

// Lazy load heavy modal/dialog components
export const LazyMetricsDashboard = React.lazy(() =>
  import('./MetricsDashboard').then(module => ({ default: module.MetricsDashboard }))
);

export const LazySimpleAddEntryForm = React.lazy(() =>
  import('./SimpleAddEntryForm').then(module => ({ default: module.SimpleAddEntryForm }))
);

// Lazy load search components (not visible initially)
export const LazySearchAnalytics = React.lazy(() =>
  import('./search/SearchAnalytics').catch(() => ({
    default: () => <div>Search Analytics not available</div>
  }))
);

export const LazySearchHistory = React.lazy(() =>
  import('./search/SearchHistory').catch(() => ({
    default: () => <div>Search History not available</div>
  }))
);

export const LazyPerformanceIndicator = React.lazy(() =>
  import('./search/PerformanceIndicator').catch(() => ({
    default: () => <div>Performance metrics not available</div>
  }))
);

// Lazy load form components (heavy validation logic)
export const LazyKBEntryForm = React.lazy(() =>
  import('./forms/KBEntryForm').catch(() => ({
    default: () => <div>Advanced form not available</div>
  }))
);

export const LazyEditEntryForm = React.lazy(() =>
  import('./forms/EditEntryForm').catch(() => ({
    default: () => <div>Edit form not available</div>
  }))
);

// Lazy load accessibility components (optional features)
export const LazyAccessibilityChecker = React.lazy(() =>
  import('./accessibility/AccessibilityChecker').catch(() => ({
    default: () => <div>Accessibility checker not available</div>
  }))
);

export const LazyKeyboardHelp = React.lazy(() =>
  import('./KeyboardHelp').then(module => ({ default: module.GlobalKeyboardHelp }))
);

// Lazy load UI library components (design system)
export const LazyModal = React.lazy(() =>
  import('./ui/Modal').catch(() => ({
    default: ({ children }: any) => <div>{children}</div>
  }))
);

export const LazyDataDisplay = React.lazy(() =>
  import('./ui/DataDisplay').catch(() => ({
    default: () => <div>Data display not available</div>
  }))
);

// Lazy load navigation components
export const LazyKBNavigation = React.lazy(() =>
  import('./navigation/KBNavigation').catch(() => ({
    default: () => <div>Navigation not available</div>
  }))
);

// Lazy load performance monitoring (development only)
export const LazyPerformanceMonitoring = React.lazy(() =>
  import('./performance/PerformanceMonitoring').catch(() => ({
    default: () => null
  }))
);

// Wrapped components with appropriate loading states
export const MetricsDashboard = withLazyLoading(
  LazyMetricsDashboard,
  PanelLoadingFallback
);

export const SimpleAddEntryForm = withLazyLoading(
  LazySimpleAddEntryForm,
  ModalLoadingFallback
);

export const SearchAnalytics = withLazyLoading(
  LazySearchAnalytics,
  PanelLoadingFallback
);

export const SearchHistory = withLazyLoading(
  LazySearchHistory,
  DefaultLoadingFallback
);

export const PerformanceIndicator = withLazyLoading(
  LazyPerformanceIndicator,
  DefaultLoadingFallback
);

export const KBEntryForm = withLazyLoading(
  LazyKBEntryForm,
  ModalLoadingFallback
);

export const EditEntryForm = withLazyLoading(
  LazyEditEntryForm,
  ModalLoadingFallback
);

export const AccessibilityChecker = withLazyLoading(
  LazyAccessibilityChecker,
  DefaultLoadingFallback
);

export const KeyboardHelp = withLazyLoading(
  LazyKeyboardHelp,
  DefaultLoadingFallback
);

export const Modal = withLazyLoading(
  LazyModal,
  DefaultLoadingFallback
);

export const DataDisplay = withLazyLoading(
  LazyDataDisplay,
  PanelLoadingFallback
);

export const KBNavigation = withLazyLoading(
  LazyKBNavigation,
  DefaultLoadingFallback
);

export const PerformanceMonitoring = withLazyLoading(
  LazyPerformanceMonitoring,
  () => null // No loading indicator for dev-only component
);

// Preloading utilities for critical user paths
export const preloadComponents = {
  // Preload form when user hovers over add button
  addEntryForm: () => import('./SimpleAddEntryForm'),

  // Preload metrics when user shows interest in analytics
  metricsDashboard: () => import('./MetricsDashboard'),

  // Preload search features for active users
  searchFeatures: () => Promise.all([
    import('./search/SearchAnalytics'),
    import('./search/SearchHistory'),
    import('./search/PerformanceIndicator')
  ]),

  // Preload keyboard help for accessibility
  keyboardHelp: () => import('./KeyboardHelp'),

  // Preload edit form for power users
  editForm: () => import('./forms/EditEntryForm')
};

// Component size estimates for bundle analysis (in KB)
export const componentSizes = {
  MetricsDashboard: 15, // Complex dashboard with charts
  SimpleAddEntryForm: 8, // Form with validation
  SearchAnalytics: 12, // Analytics with data processing
  SearchHistory: 6, // Simple list component
  PerformanceIndicator: 4, // Lightweight metrics
  KBEntryForm: 10, // Advanced form
  EditEntryForm: 9, // Edit form with validation
  AccessibilityChecker: 7, // Accessibility tools
  KeyboardHelp: 5, // Help modal
  Modal: 3, // Basic modal
  DataDisplay: 8, // Data visualization
  KBNavigation: 6, // Navigation component
  PerformanceMonitoring: 12 // Development tools
};

// Usage tracking for optimization
export const trackComponentLoad = (componentName: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔄 Lazy loading: ${componentName}`);

    // Track load times
    const loadTime = performance.now();
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const componentEntry = entries.find(entry =>
        entry.name.includes(componentName.toLowerCase())
      );

      if (componentEntry) {
        const totalTime = performance.now() - loadTime;
        console.log(`✅ ${componentName} loaded in ${totalTime.toFixed(2)}ms`);
      }
    });

    observer.observe({ entryTypes: ['measure', 'navigation'] });
  }
};