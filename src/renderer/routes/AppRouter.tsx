/**
 * Application Router
 * Simple routing for single-page Electron app with lazy-loaded route components
 */

import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { DefaultLoadingFallback } from '../components/LazyComponents';

// Lazy load route components for better initial performance
const LazyApp = React.lazy(() => import('../App'));

const LazyKnowledgeBasePage = React.lazy(() =>
  import('../pages/KnowledgeBasePage').catch(() => ({
    default: () => <div>Knowledge Base page not available</div>
  }))
);

// Future route components (placeholder for MVP2+)
const LazyPatternAnalysisPage = React.lazy(() =>
  Promise.resolve({
    default: () => <div>Pattern Analysis (Coming in MVP2)</div>
  })
);

const LazyCodeAnalysisPage = React.lazy(() =>
  Promise.resolve({
    default: () => <div>Code Analysis (Coming in MVP3)</div>
  })
);

const LazySettingsPage = React.lazy(() =>
  Promise.resolve({
    default: () => <div>Settings page (Coming soon)</div>
  })
);

/**
 * Route-aware loading wrapper with preloading capabilities
 */
const RouteLoadingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  React.useEffect(() => {
    // Preload likely next routes based on current path
    const path = location.pathname;
    console.log('Route changed to:', path);

    // Preload commonly accessed routes after route change
    const preloadTimer = setTimeout(() => {
      switch (path) {
        case '/':
          // From home, users often go to settings or knowledge base
          import('../pages/KnowledgeBasePage').catch(console.warn);
          break;
        case '/knowledge':
          // From knowledge base, users often add entries (already preloaded)
          break;
        default:
          break;
      }
    }, 1000);

    return () => clearTimeout(preloadTimer);
  }, [location]);

  return <>{children}</>;
};

// Enhanced router with lazy loading and route-based code splitting
export const AppRouter: React.FC = () => {
  return (
    <Router>
      <ErrorBoundary>
        <Suspense fallback={<DefaultLoadingFallback />}>
          <RouteLoadingWrapper>
            <Routes>
              {/* Main app route */}
              <Route path="/" element={<LazyApp />} />

              {/* Knowledge Base routes */}
              <Route path="/knowledge" element={<LazyKnowledgeBasePage />} />
              <Route path="/kb" element={<Navigate to="/knowledge" replace />} />

              {/* Future MVP routes */}
              <Route path="/patterns" element={<LazyPatternAnalysisPage />} />
              <Route path="/code" element={<LazyCodeAnalysisPage />} />
              <Route path="/settings" element={<LazySettingsPage />} />

              {/* Catch-all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RouteLoadingWrapper>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
};

// Hook for navigation that integrates with our context system
export const useNavigation = () => {
  const navigate = (path: string) => {
    window.location.hash = `#${path}`;
  };

  const getCurrentPath = (): string => {
    return window.location.hash.substring(1) || '/';
  };

  const isCurrentPath = (path: string): boolean => {
    const current = getCurrentPath();
    return current === path;
  };

  return {
    navigate,
    getCurrentPath,
    isCurrentPath
  };
};

export default AppRouter;