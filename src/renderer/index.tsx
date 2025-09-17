import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Import Tailwind CSS
import App from './App';
import './mockElectronAPI'; // Import mock API for web development
import { SettingsProvider } from './contexts/SettingsContext';

/**
 * React 18 Application Entry Point
 *
 * This file initializes the React application in the Electron renderer process.
 * It sets up the root element and renders the main App component.
 *
 * MVP1 Features:
 * - Desktop-first Electron application
 * - React 18 with concurrent features
 * - TypeScript for type safety
 * - Hot module replacement in development
 */

// Ensure we're in the renderer process
if (!window.electronAPI) {
  console.warn('Electron API not found. Using mock API for web development.');
}

// Get root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Check your index.html file.');
}

// Create React root with React 18's createRoot API
const root = ReactDOM.createRoot(rootElement);

// Render application
root.render(
  <React.StrictMode>
    <SettingsProvider autoSave={true} autoSaveDelay={1000}>
      <App />
    </SettingsProvider>
  </React.StrictMode>
);

// Performance monitoring in development
if (process.env.NODE_ENV === 'development') {
  // Log render performance
  const reportWebVitals = (metric: any) => {
    console.log('Performance metric:', metric);
  };

  // Web-vitals temporarily disabled - uncomment after installing: npm install web-vitals
  /*
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(reportWebVitals);
    getFID(reportWebVitals);
    getFCP(reportWebVitals);
    getLCP(reportWebVitals);
    getTTFB(reportWebVitals);
  }).catch(err => {
    console.warn('Web-vitals not available:', err.message);
  });
  */
}

// Handle uncaught errors
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Send error to main process for logging
  if (window.electronAPI?.logError) {
    window.electronAPI.logError({
      type: 'unhandledRejection',
      message: event.reason?.toString() || 'Unknown error',
      stack: event.reason?.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Handle Electron IPC messages
if (window.electronAPI) {
  // Listen for theme changes from main process
  window.electronAPI.onThemeChange?.((theme: 'light' | 'dark' | 'system') => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  // Listen for database status updates
  window.electronAPI.onDatabaseStatus?.((status: { connected: boolean; message?: string }) => {
    if (!status.connected) {
      console.error('Database disconnected:', status.message);
      // Could trigger a notification or error boundary here
    }
  });

  // Listen for AI service status
  window.electronAPI.onAIServiceStatus?.((status: { available: boolean; provider?: string }) => {
    console.log('AI Service status:', status);
  });
}

// Export for testing purposes
export { root };