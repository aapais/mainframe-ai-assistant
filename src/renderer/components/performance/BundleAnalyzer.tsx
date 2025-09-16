/**
 * Bundle Analyzer Component
 * Development tool for monitoring bundle sizes and lazy loading performance
 */

import React, { useState, useEffect } from 'react';
import { componentSizes } from '../LazyRegistry';

interface BundleMetrics {
  totalSize: number;
  loadedChunks: string[];
  lazyChunks: string[];
  loadTimes: Record<string, number>;
  cacheHits: Record<string, number>;
}

interface ComponentLoadMetrics {
  name: string;
  size: number;
  loadTime?: number;
  isLoaded: boolean;
  loadCount: number;
}

export const BundleAnalyzer: React.FC = () => {
  const [metrics, setMetrics] = useState<BundleMetrics>({
    totalSize: 0,
    loadedChunks: [],
    lazyChunks: [],
    loadTimes: {},
    cacheHits: {}
  });

  const [componentMetrics, setComponentMetrics] = useState<ComponentLoadMetrics[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Initialize component metrics
    const initialMetrics = Object.entries(componentSizes).map(([name, size]) => ({
      name,
      size,
      isLoaded: false,
      loadCount: 0
    }));

    setComponentMetrics(initialMetrics);

    // Monitor performance entries for chunk loading
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('.js') || entry.name.includes('.css')) {
          const chunkName = entry.name.split('/').pop() || 'unknown';

          setMetrics(prev => ({
            ...prev,
            loadTimes: {
              ...prev.loadTimes,
              [chunkName]: entry.duration
            }
          }));

          // Update component metrics if it's a component chunk
          const componentName = Object.keys(componentSizes).find(name =>
            chunkName.toLowerCase().includes(name.toLowerCase())
          );

          if (componentName) {
            setComponentMetrics(prev =>
              prev.map(comp =>
                comp.name === componentName
                  ? {
                      ...comp,
                      isLoaded: true,
                      loadTime: entry.duration,
                      loadCount: comp.loadCount + 1
                    }
                  : comp
              )
            );
          }
        }
      });
    });

    observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });

    return () => observer.disconnect();
  }, []);

  // Calculate total bundle size
  useEffect(() => {
    const totalSize = componentMetrics
      .filter(comp => comp.isLoaded)
      .reduce((sum, comp) => sum + comp.size, 0);

    setMetrics(prev => ({ ...prev, totalSize }));
  }, [componentMetrics]);

  const formatSize = (kb: number) => {
    if (kb < 1) return `${Math.round(kb * 1024)}B`;
    if (kb < 1024) return `${Math.round(kb)}KB`;
    return `${(kb / 1024).toFixed(1)}MB`;
  };

  const formatTime = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getLoadStatus = (component: ComponentLoadMetrics) => {
    if (!component.isLoaded) return { icon: '⚪', color: '#6b7280', status: 'Not Loaded' };
    if (component.loadCount === 1) return { icon: '🟢', color: '#10b981', status: 'Loaded' };
    return { icon: '🔄', color: '#f59e0b', status: `Loaded ${component.loadCount}x` };
  };

  const totalLoadedSize = componentMetrics
    .filter(comp => comp.isLoaded)
    .reduce((sum, comp) => sum + comp.size, 0);

  const totalPossibleSize = componentMetrics
    .reduce((sum, comp) => sum + comp.size, 0);

  const loadedPercentage = (totalLoadedSize / totalPossibleSize) * 100;

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          padding: '8px 12px',
          backgroundColor: '#1f2937',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 10000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}
        title="Bundle Analyzer (Dev Only)"
      >
        📦 {formatSize(totalLoadedSize)}
      </button>

      {/* Analyzer panel */}
      {isVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '400px',
            maxHeight: '500px',
            backgroundColor: '#1f2937',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 10001,
            fontSize: '12px',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #374151',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                Bundle Analyzer
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>
                Development Mode
              </p>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          {/* Summary */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #374151' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Loaded Size:</span>
              <span style={{ fontWeight: '600' }}>{formatSize(totalLoadedSize)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Total Size:</span>
              <span>{formatSize(totalPossibleSize)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Loaded:</span>
              <span>{Math.round(loadedPercentage)}%</span>
            </div>

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#374151',
                borderRadius: '2px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${loadedPercentage}%`,
                  height: '100%',
                  backgroundColor: '#10b981',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          {/* Component list */}
          <div
            style={{
              maxHeight: '300px',
              overflow: 'auto'
            }}
          >
            {componentMetrics
              .sort((a, b) => b.size - a.size)
              .map((component) => {
                const status = getLoadStatus(component);
                return (
                  <div
                    key={component.name}
                    style={{
                      padding: '8px 16px',
                      borderBottom: '1px solid #374151',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                        <span style={{ marginRight: '6px' }}>{status.icon}</span>
                        {component.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        {formatSize(component.size)}
                        {component.loadTime && ` • ${formatTime(component.loadTime)}`}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: status.color,
                        fontWeight: '500'
                      }}
                    >
                      {status.status}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid #374151',
              fontSize: '10px',
              color: '#9ca3af',
              textAlign: 'center'
            }}
          >
            Lazy Loading Performance Monitor
          </div>
        </div>
      )}
    </>
  );
};