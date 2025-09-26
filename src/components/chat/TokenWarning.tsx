/**
 * TokenWarning Component
 * Alert for token limit warnings
 */

import React from 'react';

export interface TokenWarningProps {
  currentTokens: number;
  maxTokens: number;
  className?: string;
  onDismiss?: () => void;
}

export const TokenWarning: React.FC<TokenWarningProps> = ({
  currentTokens,
  maxTokens,
  className = '',
  onDismiss
}) => {
  const percentage = Math.round((currentTokens / maxTokens) * 100);
  const isWarning = percentage >= 75 && percentage < 90;
  const isCritical = percentage >= 90;

  const getAlertColor = () => {
    if (isCritical) return 'bg-red-50 border-red-200 text-red-800';
    if (isWarning) return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    return 'bg-blue-50 border-blue-200 text-blue-800';
  };

  const getProgressBarColor = () => {
    if (isCritical) return 'bg-red-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getIcon = () => {
    if (isCritical) {
      return (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  return (
    <div
      className={`border rounded-lg p-3 ${getAlertColor()} ${className}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {isCritical
              ? 'Critical: Token limit nearly reached'
              : isWarning
              ? 'Warning: Approaching token limit'
              : 'Token Usage'}
          </h3>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs">
              <span>
                {currentTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
              </span>
              <span>{percentage}%</span>
            </div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getProgressBarColor()}`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
                role="progressbar"
                aria-valuenow={currentTokens}
                aria-valuemin={0}
                aria-valuemax={maxTokens}
                aria-label={`Token usage: ${percentage}% of limit`}
              />
            </div>
          </div>
          {isCritical && (
            <p className="mt-2 text-xs">
              The conversation will be summarized soon to continue.
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-3 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            aria-label="Dismiss token warning"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};