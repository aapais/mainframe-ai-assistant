/**
 * ConfidenceScore Component
 *
 * Displays confidence scores with accessibility and visual indicators
 * @version 2.0.0
 */

import React, { memo } from 'react';
import { ConfidenceScoreProps } from '../types';
import {
  getConfidenceScoreColor,
  getConfidenceScoreBackground,
  formatConfidenceScore,
  getMatchTypeIcon,
  getMatchTypeDescription
} from '../utils';

/**
 * Component for displaying confidence scores with visual and accessible indicators
 */
export const ConfidenceScore: React.FC<ConfidenceScoreProps> = memo(({
  score,
  matchType,
  showPercentage = true,
  className = '',
  color
}) => {
  const percentage = Math.round(score * 100);
  const colorClass = color || getConfidenceScoreColor(score);
  const backgroundClass = color || getConfidenceScoreBackground(score);
  const icon = getMatchTypeIcon(matchType);
  const description = getMatchTypeDescription(matchType);

  return (
    <div className={`confidence-score flex items-center gap-2 ${className}`}>
      {/* Match type icon */}
      <span
        className="text-sm"
        aria-hidden="true"
        title={description}
      >
        {icon}
      </span>

      <div className="flex items-center gap-1">
        {/* Progress bar */}
        <div
          className="confidence-score-bar w-16 h-2 bg-gray-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          aria-label={`Confidence score: ${percentage}%`}
          title={`${description}: ${percentage}% confidence`}
        >
          <div
            className={`confidence-score-fill h-full transition-all duration-300 ${backgroundClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Percentage text */}
        {showPercentage && (
          <span className={`confidence-score-text text-xs font-medium ${colorClass}`}>
            {formatConfidenceScore(score)}
          </span>
        )}
      </div>
    </div>
  );
});

ConfidenceScore.displayName = 'ConfidenceScore';

// Compact version for space-constrained layouts
export const ConfidenceScoreCompact: React.FC<ConfidenceScoreProps> = memo(({
  score,
  matchType,
  showPercentage = true,
  className = '',
  color
}) => {
  const percentage = Math.round(score * 100);
  const colorClass = color || getConfidenceScoreColor(score);
  const icon = getMatchTypeIcon(matchType);
  const description = getMatchTypeDescription(matchType);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span
        className="text-xs"
        aria-hidden="true"
        title={description}
      >
        {icon}
      </span>
      {showPercentage && (
        <span
          className={`text-xs font-medium ${colorClass}`}
          title={`${description}: ${percentage}% confidence`}
          aria-label={`Confidence score: ${percentage}%`}
        >
          {formatConfidenceScore(score)}
        </span>
      )}
    </div>
  );
});

ConfidenceScoreCompact.displayName = 'ConfidenceScoreCompact';

// Legend component for explaining confidence scores
export const ConfidenceScoreLegend: React.FC<{ className?: string }> = memo(({ className = '' }) => (
  <div className={`text-xs text-gray-500 ${className}`}>
    <div className="flex items-center gap-2">
      <span>Confidence:</span>
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 bg-green-500 rounded-full" />
        High (80%+)
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 bg-yellow-500 rounded-full" />
        Medium (60-80%)
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 bg-red-500 rounded-full" />
        Low (&lt;60%)
      </span>
    </div>
  </div>
));

ConfidenceScoreLegend.displayName = 'ConfidenceScoreLegend';

export default ConfidenceScore;