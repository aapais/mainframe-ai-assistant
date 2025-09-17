/**
 * Lazy Settings Panel - Performance Optimized Settings Component
 *
 * Features:
 * - Dynamic imports with React.lazy()
 * - Intersection Observer for viewport-based loading
 * - Suspense boundaries with skeleton screens
 * - Bundle size optimization
 * - Memory management
 */

import React, {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
} from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { SkeletonScreen } from '../ui/SkeletonScreen';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface LazyPanelConfig {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedSize: number; // KB
  dependencies?: string[];
}

interface LazySettingsPanelProps {
  panelId: string;
  isActive: boolean;
  onLoad?: (panelId: string, loadTime: number) => void;
  onError?: (panelId: string, error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}

interface PanelLoadingState {
  isLoading: boolean;
  isLoaded: boolean;
  isVisible: boolean;
  loadTime?: number;
  error?: Error;
}

// ============================================================================
// LAZY COMPONENT IMPORTS WITH WEBPACK MAGIC COMMENTS
// ============================================================================

// High priority panels (preload)
const APISettings = lazy(() =>
  import('./APISettings' /* webpackChunkName: "settings-api" */)
);

const ProfileSettings = lazy(() =>
  import('./ProfileSettings' /* webpackChunkName: "settings-profile" */)
);

// Medium priority panels (load on demand)
const CostManagementSettings = lazy(() =>
  import('./CostManagementSettings' /* webpackChunkName: "settings-cost" */)
);

const PerformanceSettings = lazy(() =>
  import('./PerformanceSettings' /* webpackChunkName: "settings-performance" */)
);

const PreferencesSettings = lazy(() =>
  import('./PreferencesSettings' /* webpackChunkName: "settings-preferences" */)
);

// Low priority panels (lazy load when visible)
const SecuritySettings = lazy(() =>
  import('./SecuritySettings' /* webpackChunkName: "settings-security" */)
);

const DeveloperSettings = lazy(() =>
  import('./DeveloperSettings' /* webpackChunkName: "settings-developer" */)
);

const LayoutSettings = lazy(() =>
  import('./LayoutSettings' /* webpackChunkName: "settings-layout" */)
);

const WidgetConfigurationSettings = lazy(() =>
  import('./WidgetConfigurationSettings' /* webpackChunkName: "settings-widgets" */)
);

// ============================================================================
// PANEL CONFIGURATION
// ============================================================================

export const PANEL_CONFIGS: Record<string, LazyPanelConfig> = {
  'api-settings': {
    id: 'api-settings',
    title: 'API Configuration',
    description: 'Manage AI service API keys and connections',
    priority: 'high',
    estimatedSize: 45,
    dependencies: ['crypto', 'validation']
  },
  'profile': {
    id: 'profile',
    title: 'Profile Settings',
    description: 'Manage your profile and account information',
    priority: 'high',
    estimatedSize: 35,
  },
  'cost-management': {
    id: 'cost-management',
    title: 'Cost Management',
    description: 'Configure budgets, alerts, and cost tracking',
    priority: 'medium',
    estimatedSize: 55,
    dependencies: ['charts', 'notifications']
  },
  'performance': {
    id: 'performance',
    title: 'Performance',
    description: 'Performance monitoring and optimization settings',
    priority: 'medium',
    estimatedSize: 40,
    dependencies: ['monitoring', 'metrics']
  },
  'preferences': {
    id: 'preferences',
    title: 'Preferences',
    description: 'Customize your application preferences',
    priority: 'medium',
    estimatedSize: 30,
  },
  'security': {
    id: 'security',
    title: 'Security & Privacy',
    description: 'Security policies, privacy settings, and authentication',
    priority: 'low',
    estimatedSize: 50,
    dependencies: ['encryption', 'auth']
  },
  'developer': {
    id: 'developer',
    title: 'Developer Settings',
    description: 'Advanced developer tools and configurations',
    priority: 'low',
    estimatedSize: 60,
    dependencies: ['devtools', 'debugging']
  },
  'layout': {
    id: 'layout',
    title: 'Layout & Appearance',
    description: 'Customize layout, themes, and visual settings',
    priority: 'low',
    estimatedSize: 45,
    dependencies: ['themes', 'css']
  },
  'widgets': {
    id: 'widgets',
    title: 'Widget Configuration',
    description: 'Configure dashboard widgets and displays',
    priority: 'low',
    estimatedSize: 65,
    dependencies: ['widgets', 'dashboard']
  }
};

// ============================================================================
// COMPONENT REGISTRY
// ============================================================================

const COMPONENT_REGISTRY: Record<string, React.LazyExoticComponent<any>> = {
  'api-settings': APISettings,
  'profile': ProfileSettings,
  'cost-management': CostManagementSettings,
  'performance': PerformanceSettings,
  'preferences': PreferencesSettings,
  'security': SecuritySettings,
  'developer': DeveloperSettings,
  'layout': LayoutSettings,
  'widgets': WidgetConfigurationSettings,
};

// ============================================================================
// INTERSECTION OBSERVER HOOK
// ============================================================================

function useIntersectionObserver(
  targetRef: React.RefObject<HTMLElement>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setIsIntersecting(isVisible);

        if (isVisible && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        rootMargin: '50px', // Load 50px before coming into view
        threshold: 0.1,
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [hasIntersected, options]);

  return { isIntersecting, hasIntersected };
}

// ============================================================================
// LAZY SETTINGS PANEL COMPONENT
// ============================================================================

export const LazySettingsPanel: React.FC<LazySettingsPanelProps> = ({
  panelId,
  isActive,
  onLoad,
  onError,
  className = '',
  children
}) => {
  const [loadingState, setLoadingState] = useState<PanelLoadingState>({
    isLoading: false,
    isLoaded: false,
    isVisible: false
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const { isIntersecting, hasIntersected } = useIntersectionObserver(panelRef);
  const { recordMetric } = usePerformanceMonitoring();

  const config = PANEL_CONFIGS[panelId];
  const LazyComponent = COMPONENT_REGISTRY[panelId];

  // Determine if panel should be loaded
  const shouldLoad = useMemo(() => {
    if (!config) return false;

    // High priority panels load immediately when active
    if (config.priority === 'high' && isActive) return true;

    // Medium priority panels load when active or intersecting
    if (config.priority === 'medium' && (isActive || hasIntersected)) return true;

    // Low priority panels load only when visible
    if (config.priority === 'low' && (isActive && hasIntersected)) return true;

    return false;
  }, [config, isActive, hasIntersected]);

  // Load component when needed
  useEffect(() => {
    if (shouldLoad && !loadingState.isLoaded && !loadingState.isLoading) {
      setLoadingState(prev => ({ ...prev, isLoading: true }));

      const startTime = performance.now();

      // Preload the component
      LazyComponent._result || import(`./$(panelId.charAt(0).toUpperCase() + panelId.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase()))Settings`)
        .then(() => {
          const loadTime = performance.now() - startTime;

          setLoadingState(prev => ({
            ...prev,
            isLoading: false,
            isLoaded: true,
            loadTime
          }));

          recordMetric(`settings_panel_load_${panelId}`, loadTime);
          onLoad?.(panelId, loadTime);
        })
        .catch((error) => {
          setLoadingState(prev => ({
            ...prev,
            isLoading: false,
            error
          }));

          onError?.(panelId, error);
        });
    }
  }, [shouldLoad, loadingState.isLoaded, loadingState.isLoading, LazyComponent, panelId, onLoad, onError, recordMetric]);

  // Update visibility state
  useEffect(() => {
    setLoadingState(prev => ({ ...prev, isVisible: isIntersecting }));
  }, [isIntersecting]);

  // Render loading state for non-active panels
  if (!isActive) {
    return (
      <div
        ref={panelRef}
        className={`lazy-panel-placeholder ${className}`}
        data-panel-id={panelId}
        style={{ minHeight: '200px' }}
      >
        {/* Invisible placeholder to maintain layout */}
      </div>
    );
  }

  // Render error state
  if (loadingState.error) {
    return (
      <div className={`lazy-panel-error ${className}`} ref={panelRef}>
        <div className="error-container p-6 text-center">
          <div className="text-red-500 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Failed to load {config?.title || panelId}
          </h3>
          <p className="text-gray-600 mb-4">
            There was an error loading this settings panel.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loadingState.isLoading || !loadingState.isLoaded) {
    return (
      <div className={`lazy-panel-loading ${className}`} ref={panelRef}>
        <SkeletonScreen
          title={config?.title}
          description={config?.description}
          estimatedSize={config?.estimatedSize}
        />
      </div>
    );
  }

  // Render loaded component
  return (
    <div className={`lazy-panel-loaded ${className}`} ref={panelRef}>
      <ErrorBoundary
        fallback={
          <div className="error-fallback p-6 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-gray-600">
              This settings panel encountered an error.
            </p>
          </div>
        }
      >
        <Suspense
          fallback={
            <SkeletonScreen
              title={config?.title}
              description={config?.description}
              estimatedSize={config?.estimatedSize}
            />
          }
        >
          <LazyComponent />
          {children}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

// ============================================================================
// PRELOADER UTILITY
// ============================================================================

export class SettingsPanelPreloader {
  private static loadedPanels = new Set<string>();
  private static loadingPanels = new Set<string>();

  static async preloadPanel(panelId: string): Promise<void> {
    if (this.loadedPanels.has(panelId) || this.loadingPanels.has(panelId)) {
      return;
    }

    this.loadingPanels.add(panelId);

    try {
      const component = COMPONENT_REGISTRY[panelId];
      if (component) {
        await component._result || import(`./$(panelId.charAt(0).toUpperCase() + panelId.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase()))Settings`);
        this.loadedPanels.add(panelId);
      }
    } catch (error) {
      console.warn(`Failed to preload panel ${panelId}:`, error);
    } finally {
      this.loadingPanels.delete(panelId);
    }
  }

  static async preloadHighPriorityPanels(): Promise<void> {
    const highPriorityPanels = Object.entries(PANEL_CONFIGS)
      .filter(([_, config]) => config.priority === 'high')
      .map(([id]) => id);

    await Promise.all(
      highPriorityPanels.map(panelId => this.preloadPanel(panelId))
    );
  }

  static getLoadedPanels(): string[] {
    return Array.from(this.loadedPanels);
  }

  static isLoaded(panelId: string): boolean {
    return this.loadedPanels.has(panelId);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default LazySettingsPanel;