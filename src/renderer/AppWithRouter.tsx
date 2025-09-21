/**
 * Enhanced App Component with KB-Optimized Routing
 * Integrates the new routing system with existing context providers
 * Optimized for Knowledge Base workflows and user experience
 */

import React, { useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import { SearchProvider } from './contexts/SearchContext';
import { KBAppRouter } from './routing/KBRouter';
import { KBRoutes } from './routes/KBRoutes';
import { KBNavigation, useKBKeyboardShortcuts } from './components/navigation/KBNavigation';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotificationContainer } from './components/common/NotificationContainer';
import { useNotifications } from './context/AppContext';
import './styles/global.css';
import './styles/navigation.css';
import './styles/routing.css';

// ========================
// Main App Content
// ========================

const AppContent: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();
  
  // Enable keyboard shortcuts
  useKBKeyboardShortcuts();
  
  // Set up document-level event handlers
  useEffect(() => {
    // Handle browser back/forward buttons
    const handlePopState = (event: PopStateEvent) => {
      // Router handles this automatically, but we can add custom logic here
      console.log('Navigation via browser controls');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Performance monitoring
  useEffect(() => {
    // Track route changes for analytics
    const trackRouteChange = () => {
      if (window.electronAPI?.trackNavigation) {
        window.electronAPI.trackNavigation({
          path: window.location.hash,
          timestamp: new Date(),
        });
      }
    };

    trackRouteChange(); // Track initial load
    window.addEventListener('hashchange', trackRouteChange);
    return () => window.removeEventListener('hashchange', trackRouteChange);
  }, []);

  return (
    <div className="app-with-router" role="application">
      {/* Global Navigation */}
      <KBNavigation />
      
      {/* Main Content Area */}
      <main className="app-main" role="main">
        <KBRoutes />
      </main>
      
      {/* Global Notifications */}
      <NotificationContainer
        notifications={notifications}
        onDismiss={removeNotification}
        position="top-right"
      />
      
      {/* Performance Monitor (Development) */}
      {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}
    </div>
  );
};

// ========================
// Performance Monitor Component
// ========================

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<{
    routeChangeTime?: number;
    searchTime?: number;
    renderTime?: number;
  }>({});

  useEffect(() => {
    // Monitor route change performance
    const startTime = performance.now();
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          setMetrics(prev => ({
            ...prev,
            routeChangeTime: entry.duration,
          }));
        }
      }
    });

    observer.observe({ entryTypes: ['navigation'] });
    
    return () => observer.disconnect();
  }, []);

  if (Object.keys(metrics).length === 0) return null;

  return (
    <div className="performance-monitor">
      <details>
        <summary>Performance</summary>
        <pre>{JSON.stringify(metrics, null, 2)}</pre>
      </details>
    </div>
  );
};

// ========================
// Context Providers Wrapper
// ========================

const ContextProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AppProvider>
      <SearchProvider>
        {children}
      </SearchProvider>
    </AppProvider>
  );
};

// ========================
// Main App Component
// ========================

function AppWithRouter() {
  return (
    <ErrorBoundary>
      <KBAppRouter>
        <ContextProviders>
          <AppContent />
        </ContextProviders>
      </KBAppRouter>
    </ErrorBoundary>
  );
}

// ========================
// Hot Module Replacement
// ========================

if (import.meta.hot) {
  import.meta.hot.accept();
  
  // Preserve router state on HMR
  import.meta.hot.accept('./routing/KBRouter', () => {
    console.log('Router updated via HMR');
  });
  
  // Preserve search state on HMR
  import.meta.hot.accept('./contexts/SearchContext', () => {
    console.log('Search context updated via HMR');
  });
}

export default AppWithRouter;