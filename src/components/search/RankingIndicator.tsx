import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface RankingData {
  rank: number;
  previousRank?: number;
  score: number;
  maxScore: number;
  confidence: number;
  matchQuality: 'exact' | 'partial' | 'semantic' | 'fuzzy';
  trendDirection?: 'up' | 'down' | 'stable';
}

export interface RankingIndicatorProps {
  ranking: RankingData;
  displayMode?: 'numeric' | 'visual' | 'compact' | 'detailed';
  showTrend?: boolean;
  showScore?: boolean;
  showConfidence?: boolean;
  animated?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'minimal' | 'badge' | 'pill';
  className?: string;
  'aria-label'?: string;
  onClick?: (ranking: RankingData) => void;
}

const RankingIndicator: React.FC<RankingIndicatorProps> = ({
  ranking,
  displayMode = 'numeric',
  showTrend = true,
  showScore = false,
  showConfidence = false,
  animated = true,
  size = 'medium',
  variant = 'default',
  className = '',
  'aria-label': ariaLabel,
  onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [prevRank, setPrevRank] = useState(ranking.rank);

  useEffect(() => {
    if (ranking.rank !== prevRank) {
      setPrevRank(ranking.rank);
    }
  }, [ranking.rank, prevRank]);

  const baseClasses = `
    ranking-indicator
    ${size === 'small' ? 'text-xs' : size === 'large' ? 'text-lg' : 'text-sm'}
    ${variant === 'badge' ? 'badge' : variant === 'pill' ? 'rounded-full' : 'rounded'}
    ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
    transition-all duration-200
    ${className}
  `;

  const getQualityColor = (quality: RankingData['matchQuality']) => {
    switch (quality) {
      case 'exact': return 'text-green-600 bg-green-50 border-green-200';
      case 'partial': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'semantic': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'fuzzy': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = () => {
    if (!showTrend || !ranking.trendDirection) return null;

    const icons = {
      up: '↗',
      down: '↘',
      stable: '→'
    };

    const colors = {
      up: 'text-green-500',
      down: 'text-red-500',
      stable: 'text-gray-500'
    };

    return (
      <motion.span
        className={`ml-1 ${colors[ranking.trendDirection]}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        aria-label={`Trend: ${ranking.trendDirection}`}
      >
        {icons[ranking.trendDirection]}
      </motion.span>
    );
  };

  const getScoreBar = () => {
    if (!showScore) return null;

    const percentage = (ranking.score / ranking.maxScore) * 100;

    return (
      <div className="flex items-center ml-2 min-w-0">
        <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-8">
          <motion.div
            className="bg-blue-500 h-1.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="ml-1 text-xs text-gray-500 whitespace-nowrap">
          {ranking.score.toFixed(1)}
        </span>
      </div>
    );
  };

  const getConfidenceBadge = () => {
    if (!showConfidence) return null;

    const confidenceLevel = ranking.confidence >= 0.8 ? 'high' :
                           ranking.confidence >= 0.6 ? 'medium' : 'low';

    const confidenceColors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`
        ml-2 px-1.5 py-0.5 rounded text-xs font-medium
        ${confidenceColors[confidenceLevel]}
      `}>
        {(ranking.confidence * 100).toFixed(0)}%
      </span>
    );
  };

  const renderNumericMode = () => (
    <motion.div
      className={`
        inline-flex items-center px-2 py-1 border
        ${getQualityColor(ranking.matchQuality)}
        ${baseClasses}
      `}
      initial={animated ? { scale: 0.9, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={onClick ? { scale: 1.05 } : {}}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick?.(ranking)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || `Rank ${ranking.rank} with ${ranking.matchQuality} match quality`}
    >
      <span className="font-semibold">
        #{ranking.rank}
      </span>
      {getTrendIcon()}
      {getScoreBar()}
      {getConfidenceBadge()}
    </motion.div>
  );

  const renderVisualMode = () => {
    const starCount = Math.min(5, Math.ceil((ranking.score / ranking.maxScore) * 5));

    return (
      <motion.div
        className={`inline-flex items-center ${baseClasses}`}
        initial={animated ? { scale: 0.9, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={() => onClick?.(ranking)}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={ariaLabel || `${starCount} out of 5 stars relevance rating`}
      >
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <motion.span
              key={i}
              className={`
                text-lg
                ${i < starCount ? 'text-yellow-400' : 'text-gray-300'}
              `}
              initial={animated ? { scale: 0, rotate: -180 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                duration: 0.3,
                delay: animated ? i * 0.1 : 0,
                type: "spring",
                stiffness: 300
              }}
            >
              ★
            </motion.span>
          ))}
        </div>
        <span className="ml-2 text-sm font-medium">
          #{ranking.rank}
        </span>
        {getTrendIcon()}
      </motion.div>
    );
  };

  const renderCompactMode = () => (
    <motion.div
      className={`
        inline-flex items-center justify-center w-8 h-8 rounded-full
        text-xs font-bold text-white
        ${ranking.rank <= 3 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
          ranking.rank <= 10 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
          'bg-gradient-to-r from-gray-400 to-gray-600'}
        ${baseClasses}
      `}
      initial={animated ? { scale: 0 } : false}
      animate={{ scale: 1 }}
      transition={{
        duration: 0.4,
        type: "spring",
        stiffness: 300
      }}
      whileHover={onClick ? { scale: 1.1 } : {}}
      onClick={() => onClick?.(ranking)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || `Rank ${ranking.rank}`}
    >
      {ranking.rank}
    </motion.div>
  );

  const renderDetailedMode = () => (
    <motion.div
      className={`
        p-3 rounded-lg border shadow-sm bg-white
        ${baseClasses}
      `}
      initial={animated ? { y: 20, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      onClick={() => onClick?.(ranking)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || `Detailed ranking information for position ${ranking.rank}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <span className="text-lg font-bold text-gray-900">
            #{ranking.rank}
          </span>
          {getTrendIcon()}
        </div>
        <span className={`
          px-2 py-1 rounded text-xs font-medium
          ${getQualityColor(ranking.matchQuality)}
        `}>
          {ranking.matchQuality.toUpperCase()}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Score:</span>
          <span className="font-medium">
            {ranking.score.toFixed(2)}/{ranking.maxScore}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Confidence:</span>
          <span className="font-medium">
            {(ranking.confidence * 100).toFixed(1)}%
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-blue-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(ranking.score / ranking.maxScore) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );

  const renderModeContent = () => {
    switch (displayMode) {
      case 'visual': return renderVisualMode();
      case 'compact': return renderCompactMode();
      case 'detailed': return renderDetailedMode();
      default: return renderNumericMode();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {renderModeContent()}
    </AnimatePresence>
  );
};

export default RankingIndicator;