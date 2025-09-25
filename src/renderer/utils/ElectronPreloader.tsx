/**
 * Electron-specific Preloading Utilities
 * Optimizes component loading for Electron environment
 */

export class ElectronPreloader {
  private static loadQueue: Set<string> = new Set();
  private static loadedComponents: Map<string, boolean> = new Map();
  private static resourceCache: Map<string, any> = new Map();

  /**
   * Preload component with Electron optimizations
   */
  static async preloadComponent(
    componentName: string,
    importFn: () => Promise<any>,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    // Skip if already loaded or queued
    if (this.loadedComponents.get(componentName) || this.loadQueue.has(componentName)) {
      return;
    }

    this.loadQueue.add(componentName);

    try {
      // Use requestIdleCallback for low-priority loads
      if (priority === 'low' && 'requestIdleCallback' in window) {
        return new Promise(resolve => {
          window.requestIdleCallback(async () => {
            await this.executeLoad(componentName, importFn);
            resolve();
          });
        });
      }

      // Use setTimeout for medium priority to avoid blocking
      if (priority === 'medium') {
        return new Promise(resolve => {
          setTimeout(async () => {
            await this.executeLoad(componentName, importFn);
            resolve();
          }, 16); // Next frame
        });
      }

      // Execute immediately for high priority
      return this.executeLoad(componentName, importFn);
    } catch (error) {
      console.warn(`Failed to preload ${componentName}:`, error);
      this.loadQueue.delete(componentName);
    }
  }

  /**
   * Execute the actual component loading
   */
  private static async executeLoad(componentName: string, importFn: () => Promise<any>) {
    const startTime = performance.now();

    try {
      const module = await importFn();
      const loadTime = performance.now() - startTime;

      // Cache the loaded module
      this.resourceCache.set(componentName, module);
      this.loadedComponents.set(componentName, true);
      this.loadQueue.delete(componentName);

      // Log performance in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Preloaded ${componentName} in ${loadTime.toFixed(2)}ms`);
      }

      // Dispatch custom event for monitoring
      window.dispatchEvent(
        new CustomEvent('component-preloaded', {
          detail: { componentName, loadTime },
        })
      );
    } catch (error) {
      console.error(`Failed to load ${componentName}:`, error);
      this.loadQueue.delete(componentName);
      throw error;
    }
  }

  /**
   * Preload based on user interaction patterns
   */
  static setupInteractionPreloading() {
    // Preload form components on first interaction
    let hasInteracted = false;

    const handleFirstInteraction = () => {
      if (hasInteracted) return;
      hasInteracted = true;

      // User is active, preload interactive components
      this.preloadComponent(
        'AddEntryForm',
        () => import('../components/common/SimpleAddEntryForm'),
        'medium'
      );

      this.preloadComponent(
        'KeyboardHelp',
        () => import('../components/accessibility/KeyboardHelp'),
        'low'
      );

      // Remove listeners after first interaction
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction, { passive: true });
    document.addEventListener('keydown', handleFirstInteraction, { passive: true });
  }

  /**
   * Preload components based on viewport intersection
   */
  static setupViewportPreloading() {
    const preloadTriggers = document.querySelectorAll('[data-preload-component]');

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const componentName = entry.target.getAttribute('data-preload-component');
              const importPath = entry.target.getAttribute('data-preload-path');

              if (componentName && importPath) {
                this.preloadComponent(componentName, () => import(importPath), 'low');

                // Stop observing this element
                observer.unobserve(entry.target);
              }
            }
          });
        },
        {
          rootMargin: '50px', // Start loading 50px before element comes into view
        }
      );

      preloadTriggers.forEach(trigger => {
        observer.observe(trigger);
      });
    }
  }

  /**
   * Optimize for Electron's local file system access
   */
  static optimizeForElectron() {
    // Disable network-based optimizations that don't apply to Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      // We're in Electron, use local optimizations

      // Preload critical components immediately since file access is fast
      setTimeout(() => {
        this.preloadComponent(
          'ErrorBoundary',
          () => import('../components/common/ErrorBoundary'),
          'high'
        );

        this.preloadComponent(
          'LoadingSpinner',
          () => import('../components/common/LoadingSpinner'),
          'high'
        );
      }, 100);

      // Monitor memory usage and adjust preloading strategy
      if ('memory' in performance) {
        setInterval(() => {
          const memory = (performance as any).memory;
          const usedMB = memory.usedJSHeapSize / 1024 / 1024;

          // If memory usage is high, slow down preloading
          if (usedMB > 150) {
            console.warn('High memory usage, slowing preloading');
          }
        }, 30000);
      }
    }
  }

  /**
   * Prefetch critical resources
   */
  static prefetchResources() {
    const criticalResources = [
      // CSS files for immediate UI
      './styles/keyboard-navigation.css',
      // Icon fonts or images
      // Add any critical assets here
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource;
      document.head.appendChild(link);
    });
  }

  /**
   * Get loading statistics
   */
  static getStats() {
    return {
      loaded: Array.from(this.loadedComponents.keys()),
      queued: Array.from(this.loadQueue),
      cached: Array.from(this.resourceCache.keys()),
      totalLoaded: this.loadedComponents.size,
      memoryEstimate: this.resourceCache.size * 10, // Rough estimate in KB
    };
  }

  /**
   * Clear cache to free memory
   */
  static clearCache() {
    this.resourceCache.clear();
    console.log('🧹 Cleared component cache');
  }
}

/**
 * React hook for component preloading
 */
export function usePreloader() {
  return {
    preload: ElectronPreloader.preloadComponent.bind(ElectronPreloader),
    stats: ElectronPreloader.getStats(),
    clearCache: ElectronPreloader.clearCache.bind(ElectronPreloader),
  };
}

// Initialize Electron optimizations
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ElectronPreloader.optimizeForElectron();
      ElectronPreloader.setupInteractionPreloading();
      ElectronPreloader.prefetchResources();
    });
  } else {
    ElectronPreloader.optimizeForElectron();
    ElectronPreloader.setupInteractionPreloading();
    ElectronPreloader.prefetchResources();
  }
}
