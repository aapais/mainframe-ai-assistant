/**
 * ErrorBoundary Component
 *
 * React error boundary for SearchResults components with recovery mechanisms
 * @version 2.0.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorBoundaryProps, ErrorBoundaryState } from '../types';

/**
 * Error boundary component for graceful error handling in SearchResults
 */
export class SearchResultsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo
    });

    // Log error if enabled
    if (this.props.logErrors !== false) {
      console.error('SearchResults Error Boundary caught an error:', error);
      console.error('Error Info:', errorInfo);
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error!, this.state.errorInfo!);
        }
        return this.props.fallback;
      }

      // Default error UI
      return (
        <SearchResultsErrorFallback
          error={this.state.error!}
          errorInfo={this.state.errorInfo!}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
export const SearchResultsErrorFallback: React.FC<{
  error: Error;
  errorInfo: ErrorInfo;
  onRetry?: () => void;
}> = ({ error, errorInfo, onRetry }) => (
  <div
    className="search-results-error-boundary p-8 bg-red-50 border border-red-200 rounded-lg"
    role="alert"
    aria-live="assertive"
  >
    <div className="flex items-start gap-4">
      <div
        className="flex-shrink-0 text-red-500 text-2xl"
        aria-hidden="true"
      >
        ⚠️
      </div>

      <div className="flex-grow">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Search Results Error
        </h3>

        <p className="text-red-700 mb-4">
          Something went wrong while displaying the search results. This is likely a temporary issue.
        </p>

        <details className="mb-4">
          <summary className="cursor-pointer text-red-600 hover:text-red-800 font-medium">
            Technical Details
          </summary>
          <div className="mt-2 p-3 bg-red-100 rounded text-sm text-red-800 font-mono">
            <div className="mb-2">
              <strong>Error:</strong> {error.message}
            </div>
            <div className="mb-2">
              <strong>Stack:</strong>
              <pre className="whitespace-pre-wrap text-xs mt-1">
                {error.stack}
              </pre>
            </div>
            {errorInfo && (
              <div>
                <strong>Component Stack:</strong>
                <pre className="whitespace-pre-wrap text-xs mt-1">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        </details>

        <div className="flex gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              aria-label="Retry loading search results"
            >
              Try Again
            </button>
          )}

          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            aria-label="Reload the page"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>

    {/* Screen reader description */}
    <div className="sr-only">
      An error occurred while displaying search results. Error message: {error.message}.
      Use the retry button to attempt loading again, or reload the page for a fresh start.
    </div>
  </div>
);

/**
 * Simplified error boundary for inline components
 */
export const InlineErrorBoundary: React.FC<{
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}> = ({ children, fallback, componentName = 'Component' }) => {
  return (
    <SearchResultsErrorBoundary
      fallback={fallback || (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            <span>
              {componentName} failed to load. Please try refreshing the page.
            </span>
          </div>
        </div>
      )}
      logErrors={false}
    >
      {children}
    </SearchResultsErrorBoundary>
  );
};

/**
 * HOC for wrapping components with error boundary
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <SearchResultsErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </SearchResultsErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

/**
 * Hook for error reporting from functional components
 */
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    // In a real application, you might want to report this to an error tracking service
    console.error('Component Error:', error);
    if (errorInfo) {
      console.error('Error Info:', errorInfo);
    }

    // You could also trigger a state update to show an error message
    // or trigger a notification system here
  };
};

export { SearchResultsErrorBoundary as ErrorBoundary };
export default SearchResultsErrorBoundary;