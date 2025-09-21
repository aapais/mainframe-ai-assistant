import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
}

/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI.
 * Features:
 * - Automatic error catching and reporting
 * - Retry mechanism with configurable attempts
 * - Custom fallback UI support
 * - Error reporting to external services
 * - Development mode error details
 * - Accessibility support
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Report error to external service if configured
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to Electron main process for logging
    if (window.electronAPI?.reportError) {
      window.electronAPI.reportError({
        message: error.message,
        stack: error.stack || '',
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0
    });
  };

  handleReload = () => {
    if (window.electronAPI?.reloadApplication) {
      window.electronAPI.reloadApplication();
    } else {
      window.location.reload();
    }
  };

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { children, fallback, maxRetries = 3 } = this.props;

    if (hasError) {
      // Custom fallback UI if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      const isDevelopment = process.env.NODE_ENV === 'development';
      const canRetry = retryCount < maxRetries;

      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__container">
            <div className="error-boundary__header">
              <div className="error-boundary__icon">⚠️</div>
              <h1 className="error-boundary__title">
                Oops! Something went wrong
              </h1>
            </div>

            <div className="error-boundary__content">
              <p className="error-boundary__message">
                The application encountered an unexpected error and cannot continue normally.
              </p>

              {error && (
                <div className="error-boundary__error-summary">
                  <h2>Error Details:</h2>
                  <p><strong>Message:</strong> {error.message}</p>
                  {isDevelopment && error.stack && (
                    <details className="error-boundary__stack-trace">
                      <summary>Stack Trace (Development)</summary>
                      <pre>{error.stack}</pre>
                    </details>
                  )}
                </div>
              )}

              {isDevelopment && errorInfo && (
                <details className="error-boundary__component-stack">
                  <summary>Component Stack (Development)</summary>
                  <pre>{errorInfo.componentStack}</pre>
                </details>
              )}

              <div className="error-boundary__suggestions">
                <h3>What you can try:</h3>
                <ul>
                  <li>Check your internet connection</li>
                  <li>Close and reopen the application</li>
                  <li>Clear the application cache</li>
                  <li>Contact support if the problem persists</li>
                </ul>
              </div>
            </div>

            <div className="error-boundary__actions">
              {canRetry && (
                <button 
                  onClick={this.handleRetry}
                  className="btn btn--primary"
                >
                  Try Again ({maxRetries - retryCount} attempts left)
                </button>
              )}
              
              <button 
                onClick={this.handleReset}
                className="btn btn--secondary"
              >
                Reset Component
              </button>
              
              <button 
                onClick={this.handleReload}
                className="btn btn--outline"
              >
                Reload Application
              </button>
            </div>

            {retryCount > 0 && (
              <div className="error-boundary__retry-info">
                <p>Retry attempt: {retryCount}/{maxRetries}</p>
              </div>
            )}

            <div className="error-boundary__support">
              <p>
                If this problem continues, please contact support with the error details above.
              </p>
              <p>
                <strong>Error ID:</strong> {Date.now().toString(36)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;