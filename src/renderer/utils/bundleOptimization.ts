/**
 * Bundle Optimization and Code Splitting Utilities
 *
 * Implements advanced bundle optimization strategies:
 * - Dynamic imports for code splitting
 * - Lazy loading components
 * - Bundle analysis and optimization
 * - Resource preloading strategies
 * - Module federation setup
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

import React, { lazy, Suspense, ComponentType } from 'react';

// ===========================================
// Types and Interfaces
// ===========================================

export interface BundleAnalysis {
  totalSize: number;
  compressedSize: number;
  chunkSizes: Record<string, number>;
  duplicateModules: string[];
  unusedExports: string[];
  largeModules: Array<{ name: string; size: number }>;
}

export interface LazyComponentOptions {
  fallback?: React.ComponentType;
  errorBoundary?: React.ComponentType<{ error: Error; retry: () => void }>;
  preload?: boolean;
  retryCount?: number;
  timeout?: number;
}

export interface PreloadStrategy {
  components: string[];
  priority: 'high' | 'medium' | 'low';
  condition?: () => boolean;
}

// ===========================================
// Lazy Loading Utilities
// ===========================================

export class LazyLoader {
  private static preloadedComponents = new Set<string>();
  private static componentCache = new Map<string, Promise<any>>();

  /**
   * Create a lazy-loaded component with advanced options
   */
  static createLazyComponent<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    options: LazyComponentOptions = {}
  ): React.ComponentType<React.ComponentProps<T>> {
    const {
      fallback: Fallback,
      errorBoundary: ErrorBoundary,
      preload = false,
      retryCount = 3,
      timeout = 10000,
    } = options;

    // Create component with retry logic
    const importWithRetry = async (retries = retryCount): Promise<{ default: T }> => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Import timeout')), timeout);
        });

        const result = await Promise.race([importFn(), timeoutPromise]);
        return result;
      } catch (error) {
        if (retries > 0) {
          console.warn(`Component import failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return importWithRetry(retries - 1);
        }
        throw error;
      }
    };

    const LazyComponent = lazy(importWithRetry);

    // Preload if requested
    if (preload) {
      this.preloadComponent(importWithRetry);
    }

    return function LazyComponentWrapper(props: React.ComponentProps<T>) {
      const fallbackComponent = Fallback ?
        React.createElement(Fallback) :
        React.createElement('div', {
          className: 'lazy-loading-fallback',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            fontSize: '0.875rem',
            color: '#6b7280',
          }
        }, 'Loading component...');

      if (ErrorBoundary) {
        return React.createElement(ErrorBoundary, {
          error: new Error('Component failed to load'),
          retry: () => window.location.reload()
        }, React.createElement(Suspense, { fallback: fallbackComponent },
          React.createElement(LazyComponent, props)
        ));
      }

      return React.createElement(Suspense, { fallback: fallbackComponent },
        React.createElement(LazyComponent, props)
      );
    };
  }

  /**
   * Preload a component without rendering it
   */
  static async preloadComponent(importFn: () => Promise<any>): Promise<void> {
    const componentKey = importFn.toString();

    if (this.preloadedComponents.has(componentKey)) {
      return;
    }

    try {
      if (!this.componentCache.has(componentKey)) {
        this.componentCache.set(componentKey, importFn());
      }

      await this.componentCache.get(componentKey);
      this.preloadedComponents.add(componentKey);
    } catch (error) {
      console.warn('Failed to preload component:', error);
    }
  }

  /**
   * Preload multiple components based on strategy
   */
  static async preloadComponents(strategies: PreloadStrategy[]): Promise<void> {
    const preloadPromises: Promise<void>[] = [];

    for (const strategy of strategies) {
      if (strategy.condition && !strategy.condition()) {
        continue;
      }

      for (const componentPath of strategy.components) {
        const importFn = () => import(componentPath);

        if (strategy.priority === 'high') {
          preloadPromises.push(this.preloadComponent(importFn));
        } else {
          // Delay lower priority preloads
          setTimeout(() => {
            this.preloadComponent(importFn);
          }, strategy.priority === 'medium' ? 2000 : 5000);
        }
      }
    }

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Clear preload cache
   */
  static clearCache(): void {
    this.preloadedComponents.clear();
    this.componentCache.clear();
  }
}

// ===========================================
// Bundle Analysis
// ===========================================

export class BundleAnalyzer {
  /**
   * Analyze current bundle size and composition
   */
  static async analyzeBundles(): Promise<BundleAnalysis> {
    const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
    const chunkSizes: Record<string, number> = {};
    let totalSize = 0;
    let compressedSize = 0;

    // Analyze each script/chunk
    for (const script of scripts) {
      try {
        const response = await fetch(script.src, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        const contentEncoding = response.headers.get('content-encoding');

        if (contentLength) {
          const size = parseInt(contentLength, 10);
          const chunkName = this.extractChunkName(script.src);

          chunkSizes[chunkName] = size;
          totalSize += size;

          if (contentEncoding === 'gzip' || contentEncoding === 'br') {
            compressedSize += size;
          }
        }
      } catch (error) {
        console.warn('Failed to analyze bundle:', script.src, error);
      }
    }

    // Identify large modules (> 100KB)
    const largeModules = Object.entries(chunkSizes)
      .filter(([, size]) => size > 100 * 1024)
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size);

    return {
      totalSize,
      compressedSize,
      chunkSizes,
      duplicateModules: [], // Would need build-time analysis
      unusedExports: [], // Would need build-time analysis
      largeModules,
    };
  }

  private static extractChunkName(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('?')[0]; // Remove query parameters
  }

  /**
   * Generate optimization recommendations
   */
  static generateRecommendations(analysis: BundleAnalysis): string[] {
    const recommendations: string[] = [];

    // Check total bundle size
    if (analysis.totalSize > 2 * 1024 * 1024) { // 2MB
      recommendations.push('Consider implementing more aggressive code splitting');
    }

    // Check compression
    const compressionRatio = analysis.compressedSize / analysis.totalSize;
    if (compressionRatio > 0.7) {
      recommendations.push('Enable better compression (gzip/brotli) on your server');
    }

    // Check for large chunks
    for (const module of analysis.largeModules) {
      if (module.size > 500 * 1024) { // 500KB
        recommendations.push(`Consider splitting large module: ${module.name} (${this.formatBytes(module.size)})`);
      }
    }

    // General recommendations
    if (Object.keys(analysis.chunkSizes).length < 3) {
      recommendations.push('Implement more granular code splitting');
    }

    if (recommendations.length === 0) {
      recommendations.push('Bundle optimization looks good!');
    }

    return recommendations;
  }

  private static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// ===========================================
// Resource Preloading
// ===========================================

export class ResourcePreloader {
  private static preloadedResources = new Set<string>();

  /**
   * Preload critical resources
   */
  static preloadCriticalResources(resources: Array<{
    href: string;
    as: 'script' | 'style' | 'font' | 'image';
    crossOrigin?: 'anonymous' | 'use-credentials';
  }>): void {
    for (const resource of resources) {
      if (this.preloadedResources.has(resource.href)) {
        continue;
      }

      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;

      if (resource.crossOrigin) {
        link.crossOrigin = resource.crossOrigin;
      }

      document.head.appendChild(link);
      this.preloadedResources.add(resource.href);
    }
  }

  /**
   * Prefetch resources for future navigation
   */
  static prefetchResources(urls: string[]): void {
    for (const url of urls) {
      if (this.preloadedResources.has(url)) {
        continue;
      }

      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;

      document.head.appendChild(link);
      this.preloadedResources.add(url);
    }
  }

  /**
   * Preconnect to external domains
   */
  static preconnectDomains(domains: string[]): void {
    for (const domain of domains) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;

      document.head.appendChild(link);
    }
  }

  /**
   * DNS prefetch for external resources
   */
  static dnsPrefetch(domains: string[]): void {
    for (const domain of domains) {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;

      document.head.appendChild(link);
    }
  }
}

// ===========================================
// Dynamic Import Utilities
// ===========================================

export class DynamicImporter {
  private static importCache = new Map<string, Promise<any>>();

  /**
   * Dynamic import with caching and error handling
   */
  static async import<T = any>(
    modulePath: string,
    options: {
      timeout?: number;
      retries?: number;
      cache?: boolean;
    } = {}
  ): Promise<T> {
    const { timeout = 10000, retries = 3, cache = true } = options;

    if (cache && this.importCache.has(modulePath)) {
      return this.importCache.get(modulePath);
    }

    const importPromise = this.importWithRetry(modulePath, timeout, retries);

    if (cache) {
      this.importCache.set(modulePath, importPromise);
    }

    return importPromise;
  }

  private static async importWithRetry<T>(
    modulePath: string,
    timeout: number,
    retries: number
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i <= retries; i++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Import timeout: ${modulePath}`)), timeout);
        });

        const importPromise = import(modulePath);
        return await Promise.race([importPromise, timeoutPromise]);
      } catch (error) {
        lastError = error as Error;

        if (i < retries) {
          console.warn(`Import failed for ${modulePath}, retrying... (${retries - i} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
      }
    }

    throw lastError!;
  }

  /**
   * Import multiple modules in parallel
   */
  static async importAll<T = any>(
    modulePaths: string[],
    options: { timeout?: number; retries?: number } = {}
  ): Promise<T[]> {
    const importPromises = modulePaths.map(path => this.import<T>(path, options));
    return Promise.all(importPromises);
  }

  /**
   * Clear import cache
   */
  static clearCache(): void {
    this.importCache.clear();
  }
}

// ===========================================
// Smart Loading Strategies
// ===========================================

export class SmartLoader {
  private static intersectionObserver?: IntersectionObserver;
  private static loadingQueue = new Map<string, () => Promise<void>>();

  /**
   * Initialize smart loading with intersection observer
   */
  static initialize(): void {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, falling back to immediate loading');
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const loaderId = target.dataset.loaderId;

            if (loaderId && this.loadingQueue.has(loaderId)) {
              const loadFn = this.loadingQueue.get(loaderId)!;
              loadFn();
              this.loadingQueue.delete(loaderId);
              this.intersectionObserver?.unobserve(target);
            }
          }
        }
      },
      {
        rootMargin: '100px', // Load 100px before entering viewport
        threshold: 0.1,
      }
    );
  }

  /**
   * Load component when element enters viewport
   */
  static loadOnVisible(
    element: HTMLElement,
    loadFn: () => Promise<void>
  ): void {
    if (!this.intersectionObserver) {
      // Fallback to immediate loading
      loadFn();
      return;
    }

    const loaderId = `loader-${Date.now()}-${Math.random()}`;
    element.dataset.loaderId = loaderId;

    this.loadingQueue.set(loaderId, loadFn);
    this.intersectionObserver.observe(element);
  }

  /**
   * Load component on user interaction
   */
  static loadOnInteraction(
    element: HTMLElement,
    loadFn: () => Promise<void>,
    events: string[] = ['click', 'mouseenter', 'touchstart']
  ): void {
    let loaded = false;

    const handleInteraction = () => {
      if (loaded) return;
      loaded = true;

      events.forEach(event => {
        element.removeEventListener(event, handleInteraction);
      });

      loadFn();
    };

    events.forEach(event => {
      element.addEventListener(event, handleInteraction, { once: true, passive: true });
    });
  }

  /**
   * Load component on idle time
   */
  static loadOnIdle(loadFn: () => Promise<void>): void {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadFn, { timeout: 5000 });
    } else {
      setTimeout(loadFn, 100);
    }
  }

  /**
   * Destroy smart loader
   */
  static destroy(): void {
    this.intersectionObserver?.disconnect();
    this.loadingQueue.clear();
  }
}

// ===========================================
// Bundle Optimization Configuration
// ===========================================

export const bundleOptimizationConfig = {
  // Critical resources to preload
  criticalResources: [
    { href: '/fonts/Inter-Regular.woff2', as: 'font' as const, crossOrigin: 'anonymous' as const },
    { href: '/css/critical.css', as: 'style' as const },
  ],

  // Resources to prefetch for future navigation
  prefetchResources: [
    '/js/dashboard.chunk.js',
    '/js/settings.chunk.js',
  ],

  // External domains to preconnect
  preconnectDomains: [
    'https://fonts.googleapis.com',
    'https://api.example.com',
  ],

  // DNS prefetch domains
  dnsPrefetchDomains: [
    'https://cdn.example.com',
  ],

  // Component preload strategies
  preloadStrategies: [
    {
      components: ['./SearchResults', './IncidentForm'],
      priority: 'high' as const,
      condition: () => window.location.pathname.includes('/search'),
    },
    {
      components: ['./Dashboard', './Analytics'],
      priority: 'medium' as const,
      condition: () => document.cookie.includes('user=authenticated'),
    },
  ] as PreloadStrategy[],
};

// Initialize smart loader on module load
if (typeof window !== 'undefined') {
  SmartLoader.initialize();
}

// ===========================================
// Export utilities
// ===========================================

export {
  LazyLoader,
  BundleAnalyzer,
  ResourcePreloader,
  DynamicImporter,
  SmartLoader,
};

export default {
  LazyLoader,
  BundleAnalyzer,
  ResourcePreloader,
  DynamicImporter,
  SmartLoader,
  config: bundleOptimizationConfig,
};