/**
 * KB Data Provider - Master Context Provider
 * 
 * This component wraps the entire app with all necessary context providers
 * in the optimal order for performance and functionality. It provides:
 * - Hierarchical context composition 
 * - Error boundaries for each context layer
 * - Performance optimization with provider ordering
 * - Centralized provider configuration
 * - Offline capability indicators
 * 
 * @author Frontend Integration Specialist
 * @version 1.0.0
 */

import React, { ReactNode, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { AppProvider } from '../context/AppContext';
import { KBDataProvider as KBDataContextProvider } from '../contexts/KBDataContext';
import { SearchProvider } from '../contexts/SearchContext';
import { MetricsProvider } from '../contexts/MetricsContext';
import { LoadingIndicator } from './common/LoadingIndicator';

// =====================
// Types & Interfaces
// =====================

export interface KBDataProviderProps {
  children: ReactNode;
  config?: {
    // Cache configuration
    cacheTimeout?: number;
    searchDebounceDelay?: number;
    
    // Feature flags
    enableOfflineMode?: boolean;
    enableAISearch?: boolean;
    enableMetrics?: boolean;
    
    // Performance settings
    maxSearchResults?: number;
    maxCacheSize?: number;
    
    // Initial data
    initialSearchQuery?: string;
    initialCategory?: string;
    
    // Debug settings
    enableDebugMode?: boolean;
    logPerformanceMetrics?: boolean;
  };
}

// =====================
// Error Fallback Components
// =====================

const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ 
  error, 
  resetErrorBoundary 
}) => (
  <div 
    className="error-boundary-fallback" 
    role="alert"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      margin: '1rem',
      border: '1px solid #dc2626',
      borderRadius: '8px',
      backgroundColor: '#fef2f2',
      color: '#991b1b',
    }}
  >
    <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem' }}>
      ⚠️ Something went wrong
    </h2>
    <p style={{ margin: '0 0 1rem 0', textAlign: 'center' }}>
      An error occurred in the Knowledge Base system. This might be due to a network issue 
      or a temporary problem with the application.
    </p>
    <details style={{ marginBottom: '1rem', width: '100%' }}>
      <summary style={{ cursor: 'pointer', padding: '0.5rem', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
        View technical details
      </summary>
      <pre style={{ 
        marginTop: '0.5rem', 
        padding: '1rem', 
        backgroundColor: '#fef2f2',
        borderRadius: '4px',
        fontSize: '0.875rem',
        overflow: 'auto',
        maxHeight: '200px'
      }}>
        {error.message}
        {error.stack && '\n\nStack trace:\n' + error.stack}
      </pre>
    </details>
    <button 
      onClick={resetErrorBoundary}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '1rem'
      }}
    >
      Try Again
    </button>
  </div>
);

const LoadingFallback: React.FC<{ message?: string }> = ({ message = "Loading Knowledge Base..." }) => (
  <div 
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '50vh',
      gap: '1rem'
    }}
  >
    <LoadingIndicator size="lg" message={message} />
    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
      Initializing contexts and loading data...
    </p>
  </div>
);

// =====================
// Provider Composition Component
// =====================

/**
 * ContextComposition - Hierarchical provider wrapper
 * 
 * Provider order is critical for performance:
 * 1. AppProvider - Core app state (most stable)
 * 2. KBDataProvider - Knowledge base data (moderate changes)
 * 3. SearchProvider - Search state (frequent changes)
 * 4. MetricsProvider - Analytics data (least frequent, but independent)
 */
const ContextComposition: React.FC<{
  children: ReactNode;
  config: NonNullable<KBDataProviderProps['config']>;
}> = ({ children, config }) => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('App Context Error:', error, errorInfo);
        
        // Report to metrics if available
        if (config.enableMetrics && window.electronAPI?.recordError) {
          window.electronAPI.recordError('context_error', error.message, {
            stack: error.stack,
            errorInfo
          });
        }
      }}
    >
      <AppProvider>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error, errorInfo) => {
            console.error('KB Data Context Error:', error, errorInfo);
          }}
        >
          <KBDataContextProvider
            cacheTimeout={config.cacheTimeout}
            enableOfflineMode={config.enableOfflineMode}
            initialState={{
              pagination: {
                currentPage: 1,
                pageSize: config.maxSearchResults || 50,
                hasMore: false,
              },
            }}
          >
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onError={(error, errorInfo) => {
                console.error('Search Context Error:', error, errorInfo);
              }}
            >
              <SearchProvider
                cacheTimeout={config.cacheTimeout}
                debounceDelay={config.searchDebounceDelay}
                enableOfflineSearch={config.enableOfflineMode}
                initialState={{
                  query: config.initialSearchQuery || '',
                  useAI: config.enableAISearch !== false,
                  pageSize: config.maxSearchResults || 20,
                }}
              >
                {config.enableMetrics ? (
                  <ErrorBoundary
                    FallbackComponent={ErrorFallback}
                    onError={(error, errorInfo) => {
                      console.error('Metrics Context Error:', error, errorInfo);
                    }}
                  >
                    <MetricsProvider
                      collectionEnabled={config.enableMetrics}
                      enableDebugMode={config.enableDebugMode}
                      logPerformanceMetrics={config.logPerformanceMetrics}
                    >
                      {children}
                    </MetricsProvider>
                  </ErrorBoundary>
                ) : (
                  children
                )}
              </SearchProvider>
            </ErrorBoundary>
          </KBDataContextProvider>
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
};

// =====================
// Connection Status Component
// =====================

const ConnectionStatus: React.FC<{ enableOfflineMode: boolean }> = ({ enableOfflineMode }) => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [aiAvailable, setAiAvailable] = React.useState(true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check AI availability periodically
  React.useEffect(() => {
    const checkAIAvailability = async () => {
      try {
        if (window.electronAPI?.checkAIAvailability) {
          const available = await window.electronAPI.checkAIAvailability();
          setAiAvailable(available);
        }
      } catch (error) {
        setAiAvailable(false);
      }
    };

    // Check immediately and then every 5 minutes
    checkAIAvailability();
    const interval = setInterval(checkAIAvailability, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (!enableOfflineMode && !isOnline) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#dc2626',
          color: 'white',
          padding: '0.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          zIndex: 9999,
        }}
        role="alert"
      >
        ⚠️ No internet connection. Some features may be unavailable.
      </div>
    );
  }

  return (
    <>
      {!isOnline && enableOfflineMode && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            right: '1rem',
            backgroundColor: '#f59e0b',
            color: 'white',
            padding: '0.25rem 0.5rem',
            borderRadius: '0 0 4px 4px',
            fontSize: '0.75rem',
            zIndex: 9998,
          }}
          title="Working offline - some features limited"
        >
          📡 Offline
        </div>
      )}
      
      {!aiAvailable && (
        <div 
          style={{
            position: 'fixed',
            top: isOnline ? 0 : '2rem',
            right: '1rem',
            backgroundColor: '#6b7280',
            color: 'white',
            padding: '0.25rem 0.5rem',
            borderRadius: '0 0 4px 4px',
            fontSize: '0.75rem',
            zIndex: 9997,
          }}
          title="AI search unavailable - using local search only"
        >
          🤖 AI Unavailable
        </div>
      )}
    </>
  );
};

// =====================
// Main Provider Component
// =====================

/**
 * KBDataProvider - Master context provider with optimal configuration
 * 
 * This is the main provider that wraps the entire Knowledge Base application.
 * It handles:
 * - Context composition in the correct order
 * - Error boundaries for each layer
 * - Loading states and fallbacks
 * - Configuration management
 * - Performance optimization
 * - Offline capability indicators
 */
export const KBDataProvider: React.FC<KBDataProviderProps> = ({ 
  children, 
  config = {} 
}) => {
  // Default configuration with performance optimizations
  const mergedConfig = React.useMemo(() => ({
    // Cache settings
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    searchDebounceDelay: 300, // 300ms
    
    // Feature flags (default to enabled for MVP1)
    enableOfflineMode: true,
    enableAISearch: true,
    enableMetrics: true,
    
    // Performance settings
    maxSearchResults: 50,
    maxCacheSize: 1000,
    
    // Debug settings (disabled in production)
    enableDebugMode: process.env.NODE_ENV === 'development',
    logPerformanceMetrics: process.env.NODE_ENV === 'development',
    
    // Override with provided config
    ...config,
  }), [config]);

  // Debug logging for development
  React.useEffect(() => {
    if (mergedConfig.enableDebugMode) {
      console.log('🚀 KBDataProvider initialized with config:', mergedConfig);
      
      // Log context mount performance
      const startTime = performance.now();
      requestAnimationFrame(() => {
        const mountTime = performance.now() - startTime;
        console.log(`📊 Context providers mounted in ${mountTime.toFixed(2)}ms`);
      });
    }
  }, [mergedConfig]);

  return (
    <>
      {/* Connection status indicators */}
      <ConnectionStatus enableOfflineMode={mergedConfig.enableOfflineMode} />
      
      {/* Main context composition with suspense boundaries */}
      <Suspense fallback={<LoadingFallback message="Initializing Knowledge Base..." />}>
        <ContextComposition config={mergedConfig}>
          <Suspense fallback={<LoadingFallback message="Loading application..." />}>
            {children}
          </Suspense>
        </ContextComposition>
      </Suspense>
    </>
  );
};

// =====================
// Convenience Hooks
// =====================

/**
 * useKBProviderConfig - Access provider configuration
 */
export const useKBProviderConfig = () => {
  // This would need to be passed down through context if needed
  // For now, return default config
  return {
    enableOfflineMode: true,
    enableAISearch: true,
    enableMetrics: true,
    enableDebugMode: process.env.NODE_ENV === 'development',
  };
};

/**
 * useKBStatus - Get overall KB system status
 */
export const useKBStatus = () => {
  const [status, setStatus] = React.useState({
    isOnline: navigator.onLine,
    isAIAvailable: true,
    isLoading: false,
    hasError: false,
  });

  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        setStatus(prev => ({ ...prev, isLoading: true }));
        
        const aiAvailable = window.electronAPI?.checkAIAvailability ? 
          await window.electronAPI.checkAIAvailability() : true;
        
        setStatus(prev => ({
          ...prev,
          isAIAvailable: aiAvailable,
          isLoading: false,
          hasError: false,
        }));
      } catch (error) {
        setStatus(prev => ({
          ...prev,
          isLoading: false,
          hasError: true,
        }));
      }
    };

    checkStatus();
    
    // Check status every minute
    const interval = setInterval(checkStatus, 60 * 1000);
    
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
};

export default KBDataProvider;