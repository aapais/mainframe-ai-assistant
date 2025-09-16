import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  overlay?: boolean;
  className?: string;
}

/**
 * LoadingSpinner Component
 * 
 * Displays loading indicators with optional overlay and messages.
 * Features:
 * - Multiple sizes
 * - Optional loading messages
 * - Overlay mode for full-screen loading
 * - Accessibility support
 * - Smooth animations
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  overlay = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'loading-spinner--sm',
    md: 'loading-spinner--md',
    lg: 'loading-spinner--lg'
  };

  const LoadingContent = () => (
    <div className={`loading-spinner ${sizeClasses[size]} ${className}`}>
      <div className="loading-spinner__icon" role="img" aria-label="Loading">
        <svg viewBox="0 0 50 50" className="loading-spinner__svg">
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="31.416"
            strokeDashoffset="31.416"
            className="loading-spinner__circle"
          />
        </svg>
      </div>
      
      {message && (
        <div className="loading-spinner__message" aria-live="polite">
          {message}
        </div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div 
        className="loading-spinner-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Loading"
      >
        <LoadingContent />
      </div>
    );
  }

  return <LoadingContent />;
};

export default LoadingSpinner;