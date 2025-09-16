import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface RelevanceScoreData {
  overall: number;
  factors: {
    keywordMatch: number;
    semanticSimilarity: number;
    contextRelevance: number;
    freshness: number;
    authority: number;
    userBehavior?: number;
  };
  maxScore: number;
  explanation: string;
  confidence: number;
}

export interface RelevanceScoreProps {
  scoreData: RelevanceScoreData;
  displayMode?: 'simple' | 'detailed' | 'breakdown' | 'visual' | 'gauge';
  showFactors?: boolean;
  showExplanation?: boolean;
  animated?: boolean;
  size?: 'small' | 'medium' | 'large';
  colorScheme?: 'blue' | 'green' | 'purple' | 'gradient';
  className?: string;
  onFactorClick?: (factor: string, value: number) => void;
  'aria-label'?: string;
}

const RelevanceScore: React.FC<RelevanceScoreProps> = ({
  scoreData,
  displayMode = 'simple',
  showFactors = false,
  showExplanation = false,
  animated = true,
  size = 'medium',
  colorScheme = 'blue',
  className = '',
  onFactorClick,
  'aria-label': ariaLabel
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredFactor, setHoveredFactor] = useState<string | null>(null);

  const percentage = Math.round((scoreData.overall / scoreData.maxScore) * 100);

  const getColorClasses = (scheme: string, opacity = '500') => {
    const colors = {
      blue: `text-blue-${opacity} bg-blue-50 border-blue-200`,
      green: `text-green-${opacity} bg-green-50 border-green-200`,
      purple: `text-purple-${opacity} bg-purple-50 border-purple-200`,
      gradient: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
    };
    return colors[scheme as keyof typeof colors] || colors.blue;
  };

  const getSizeClasses = () => {
    const sizes = {
      small: 'text-sm p-2',
      medium: 'text-base p-3',
      large: 'text-lg p-4'
    };
    return sizes[size];
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', color: 'text-green-600' };
    if (score >= 80) return { grade: 'A', color: 'text-green-600' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-600' };
    if (score >= 60) return { grade: 'C', color: 'text-yellow-600' };
    if (score >= 50) return { grade: 'D', color: 'text-orange-600' };
    return { grade: 'F', color: 'text-red-600' };
  };

  const renderSimpleScore = () => {
    const { grade, color } = getScoreGrade(percentage);

    return (
      <motion.div
        className={`
          inline-flex items-center space-x-2 px-3 py-1 rounded-full border
          ${getColorClasses(colorScheme)}
          ${getSizeClasses()}
          ${className}
        `}
        initial={animated ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        aria-label={ariaLabel || `Relevance score: ${percentage}% (${grade})`}
      >
        <span className="font-semibold">
          {percentage}%
        </span>
        <span className={`text-sm font-medium ${color}`}>
          {grade}
        </span>
      </motion.div>
    );
  };

  const renderDetailedScore = () => (
    <motion.div
      className={`
        rounded-lg border p-4 bg-white shadow-sm
        ${className}
      `}
      initial={animated ? { y: 10, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      aria-label={ariaLabel || `Detailed relevance score: ${percentage}%`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Relevance Score
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-gray-900">
            {percentage}%
          </span>
          <span className="text-sm text-gray-500">
            ({scoreData.overall.toFixed(2)}/{scoreData.maxScore})
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Score breakdown</span>
          <span>Confidence: {(scoreData.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className={`h-2 rounded-full ${
              colorScheme === 'gradient'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                : `bg-${colorScheme}-500`
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {showExplanation && (
        <motion.p
          className="text-xs text-gray-600 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {scoreData.explanation}
        </motion.p>
      )}
    </motion.div>
  );

  const renderFactorBreakdown = () => {
    const factors = Object.entries(scoreData.factors).filter(([_, value]) => value !== undefined);

    return (
      <motion.div
        className={`rounded-lg border p-4 bg-white shadow-sm ${className}`}
        initial={animated ? { y: 10, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Score Breakdown
          </h3>
          <span className="text-xl font-bold text-gray-900">
            {percentage}%
          </span>
        </div>

        <div className="space-y-3">
          {factors.map(([factor, value], index) => {
            const factorPercentage = Math.round((value / scoreData.maxScore) * 100);
            const factorName = factor.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

            return (
              <motion.div
                key={factor}
                className={`
                  p-2 rounded cursor-pointer transition-colors
                  ${hoveredFactor === factor ? 'bg-gray-50' : ''}
                  ${onFactorClick ? 'hover:bg-gray-50' : ''}
                `}
                initial={animated ? { x: -20, opacity: 0 } : false}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                onMouseEnter={() => setHoveredFactor(factor)}
                onMouseLeave={() => setHoveredFactor(null)}
                onClick={() => onFactorClick?.(factor, value)}
                role={onFactorClick ? 'button' : undefined}
                tabIndex={onFactorClick ? 0 : undefined}
                aria-label={`${factorName}: ${factorPercentage}%`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {factorName}
                  </span>
                  <span className="text-sm text-gray-600">
                    {factorPercentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <motion.div
                    className={`h-1.5 rounded-full bg-${colorScheme}-500`}
                    initial={{ width: 0 }}
                    animate={{ width: `${factorPercentage}%` }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  const renderVisualScore = () => {
    const radius = size === 'small' ? 30 : size === 'large' ? 50 : 40;
    const strokeWidth = size === 'small' ? 3 : size === 'large' ? 5 : 4;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <motion.div
        className={`relative inline-flex items-center justify-center ${className}`}
        initial={animated ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        aria-label={ariaLabel || `Relevance score: ${percentage}%`}
      >
        <svg
          className="transform -rotate-90"
          width={(radius + strokeWidth) * 2}
          height={(radius + strokeWidth) * 2}
        >
          {/* Background circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <motion.circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={colorScheme === 'gradient' ? 'url(#gradient)' : `var(--color-${colorScheme}-500)`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          {colorScheme === 'gradient' && (
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          )}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              className="font-bold text-gray-900"
              style={{ fontSize: size === 'small' ? '14px' : size === 'large' ? '18px' : '16px' }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              {percentage}%
            </motion.div>
            {size !== 'small' && (
              <div className="text-xs text-gray-500 mt-1">
                {getScoreGrade(percentage).grade}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderGaugeScore = () => {
    const gaugeAngle = (percentage / 100) * 180; // 180 degrees for half circle

    return (
      <motion.div
        className={`relative ${className}`}
        initial={animated ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        aria-label={ariaLabel || `Relevance gauge: ${percentage}%`}
      >
        <div className="relative w-32 h-16 mx-auto">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            {/* Gauge background */}
            <path
              d="M 10 45 A 40 40 0 0 1 90 45"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
            />
            {/* Gauge progress */}
            <motion.path
              d="M 10 45 A 40 40 0 0 1 90 45"
              stroke={colorScheme === 'gradient' ? 'url(#gaugeGradient)' : `var(--color-${colorScheme}-500)`}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="125.6" // Half circumference of radius 40
              initial={{ strokeDashoffset: 125.6 }}
              animate={{ strokeDashoffset: 125.6 - (percentage / 100) * 125.6 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
            {/* Needle */}
            <motion.line
              x1="50"
              y1="45"
              x2="50"
              y2="15"
              stroke="#374151"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ rotate: -90 }}
              animate={{ rotate: gaugeAngle - 90 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              transformOrigin="50px 45px"
            />
            {/* Center dot */}
            <circle cx="50" cy="45" r="3" fill="#374151" />

            {colorScheme === 'gradient' && (
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            )}
          </svg>

          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
            <motion.div
              className="text-lg font-bold text-gray-900"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, duration: 0.3 }}
            >
              {percentage}%
            </motion.div>
            <div className="text-xs text-gray-500">
              {getScoreGrade(percentage).grade}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    switch (displayMode) {
      case 'detailed': return renderDetailedScore();
      case 'breakdown': return renderFactorBreakdown();
      case 'visual': return renderVisualScore();
      case 'gauge': return renderGaugeScore();
      default: return renderSimpleScore();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {renderContent()}
    </AnimatePresence>
  );
};

export default RelevanceScore;