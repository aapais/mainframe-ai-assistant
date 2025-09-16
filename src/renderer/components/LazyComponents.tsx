/**
 * Lazy Loading Component Registry
 * Centralizes all lazy-loaded components with proper error boundaries
 */

import React, { Suspense, ComponentType } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

// Loading fallback components for different contexts
export const DefaultLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem',
    minHeight: '200px'
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid #e5e7eb',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{
        fontSize: '0.875rem',
        color: '#6b7280'
      }}>
        Loading...
      </span>
    </div>
  </div>
);

export const ModalLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '3rem',
    minHeight: '300px',
    backgroundColor: '#ffffff',
    borderRadius: '8px'
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #e5e7eb',
        borderTop: '4px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{
        fontSize: '1rem',
        color: '#374151',
        fontWeight: '500'
      }}>
        Loading component...
      </span>
    </div>
  </div>
);

export const PanelLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1.5rem',
    minHeight: '150px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    border: '1px solid #e5e7eb'
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        border: '2px solid #e5e7eb',
        borderTop: '2px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{
        fontSize: '0.875rem',
        color: '#6b7280'
      }}>
        Loading panel...
      </span>
    </div>
  </div>
);

// Error boundary for lazy components
interface LazyErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class LazyErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ComponentType<{ retry: () => void }> }>,
  LazyErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{ fallback?: React.ComponentType<{ retry: () => void }> }>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component loading error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ retry: () => void }> = ({ retry }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    minHeight: '200px',
    backgroundColor: '#fef2f2',
    borderRadius: '6px',
    border: '1px solid #fecaca'
  }}>
    <div style={{
      fontSize: '2rem',
      marginBottom: '1rem'
    }}>
      ⚠️
    </div>
    <h3 style={{
      fontSize: '1rem',
      fontWeight: '600',
      color: '#991b1b',
      margin: '0 0 0.5rem 0'
    }}>
      Failed to load component
    </h3>
    <p style={{
      fontSize: '0.875rem',
      color: '#7f1d1d',
      margin: '0 0 1rem 0',
      textAlign: 'center'
    }}>
      There was an error loading this component.
    </p>
    <button
      onClick={retry}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '500'
      }}
    >
      Try Again
    </button>
  </div>
);

// HOC for wrapping lazy components with consistent loading and error handling
export function withLazyLoading<T extends object>(
  LazyComponent: React.LazyExoticComponent<ComponentType<T>>,
  fallback: React.ComponentType = DefaultLoadingFallback,
  errorFallback?: React.ComponentType<{ retry: () => void }>
) {
  return function LazyWrapper(props: T) {
    return (
      <LazyErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback || <ComponentLoadingFallback />}>
          <LazyComponent {...props} />
        </Suspense>
      </LazyErrorBoundary>
    );
  };
}

// CSS for spinner animation
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinnerStyle);