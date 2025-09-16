/**
 * Enhanced Renderer Entry Point with KB-Optimized Routing
 * This file demonstrates how to integrate the new routing system
 * Replace the existing index.tsx with this implementation
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import AppWithRouter from './AppWithRouter';

// Performance monitoring for development
if (process.env.NODE_ENV === 'development') {
  // Enable React DevTools profiler
  if (typeof window !== 'undefined') {
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.onCommitFiberRoot = 
      (id: any, root: any, priorityLevel: any) => {
        console.log('React render:', { id, priorityLevel });
      };
  }

  // Monitor route changes
  let routeChangeStart = 0;
  window.addEventListener('hashchange', () => {
    if (routeChangeStart) {
      console.log('Route change time:', Date.now() - routeChangeStart, 'ms');
    }
    routeChangeStart = Date.now();
  });

  // Initial route change timer
  routeChangeStart = Date.now();
}

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Send to main process for logging
  if (window.electronAPI?.logError) {
    window.electronAPI.logError({
      type: 'unhandled_rejection',
      message: event.reason?.message || 'Unknown error',
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
    });
  }
});

// Global error handler for JavaScript errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  
  if (window.electronAPI?.logError) {
    window.electronAPI.logError({
      type: 'javascript_error',
      message: event.error?.message || event.message,
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: new Date().toISOString(),
    });
  }
});

// Initialize application
const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);

// Render with error boundary and performance monitoring
root.render(
  <React.StrictMode>
    <AppWithRouter />
  </React.StrictMode>
);

// Hot module replacement for development
if (import.meta.hot) {
  import.meta.hot.accept('./AppWithRouter', () => {
    console.log('Hot reload: AppWithRouter updated');
  });

  // Preserve routing state during HMR
  import.meta.hot.accept('./routing/KBRouter', () => {
    console.log('Hot reload: KBRouter updated');
    // The router will handle state preservation automatically
  });
}

// Service worker registration for future PWA support
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.log('Service Worker registration failed:', error);
    }
  });
}