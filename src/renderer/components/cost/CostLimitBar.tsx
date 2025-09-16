import React, { useEffect, useState } from 'react';
import { useAICosts } from '../../hooks/useAICosts';
import { CostLimit } from '../../../types/cost';

interface CostLimitBarProps {
  limit: CostLimit;
  className?: string;
  showPercentage?: boolean;
  animated?: boolean;
  height?: 'sm' | 'md' | 'lg';
}

export const CostLimitBar: React.FC<CostLimitBarProps> = ({
  limit,
  className = '',
  showPercentage = true,
  animated = true,
  height = 'md'
}) => {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const { costData } = useAICosts();

  const getCurrentUsage = () => {
    if (!costData) return 0;
    return limit.type === 'daily' ? costData.dailyCost : costData.monthlyCost;
  };

  const getLimitValue = () => {
    return limit.type === 'daily' ? limit.daily : limit.monthly;
  };

  const usage = getCurrentUsage();
  const limitValue = getLimitValue();
  const percentage = Math.min((usage / limitValue) * 100, 100);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setAnimatedWidth(percentage);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setAnimatedWidth(percentage);
    }
  }, [percentage, animated]);

  const getBarColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    if (percentage >= 60) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  const getBackgroundColor = () => {
    if (percentage >= 90) return 'bg-red-100';
    if (percentage >= 80) return 'bg-yellow-100';
    if (percentage >= 60) return 'bg-yellow-50';
    return 'bg-green-100';
  };

  const getHeightClass = () => {
    switch (height) {
      case 'sm': return 'h-2';
      case 'lg': return 'h-6';
      default: return 'h-4';
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getStatusIcon = () => {
    if (percentage >= 90) {
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
    }
    if (percentage >= 80) {
      return (
        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="font-medium text-gray-900 capitalize">
            {limit.type} Limit
          </span>
        </div>
        {showPercentage && (
          <span className={`text-sm font-semibold ${
            percentage >= 90 ? 'text-red-600' :
            percentage >= 80 ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {percentage.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className={`w-full ${getHeightClass()} ${getBackgroundColor()} rounded-full overflow-hidden`}>
          <div
            className={`${getHeightClass()} ${getBarColor()} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
            style={{ width: `${animatedWidth}%` }}
          >
            {/* Animated shine effect */}
            {animated && percentage > 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 animate-pulse"></div>
            )}
          </div>
        </div>

        {/* Threshold markers */}
        <div className="absolute top-0 left-0 w-full h-full flex items-center">
          {/* 80% warning line */}
          <div
            className="absolute w-0.5 bg-orange-400 opacity-50"
            style={{
              left: '80%',
              height: height === 'lg' ? '150%' : '200%',
              transform: 'translateY(-25%)'
            }}
          />
          {/* 90% danger line */}
          <div
            className="absolute w-0.5 bg-red-400 opacity-50"
            style={{
              left: '90%',
              height: height === 'lg' ? '150%' : '200%',
              transform: 'translateY(-25%)'
            }}
          />
        </div>
      </div>

      {/* Usage Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <span className="text-gray-600">
            Used: <span className="font-semibold text-gray-900">{formatCurrency(usage)}</span>
          </span>
          <span className="text-gray-600">
            Limit: <span className="font-semibold text-gray-900">{formatCurrency(limitValue)}</span>
          </span>
        </div>
        <span className="text-gray-500">
          {formatCurrency(limitValue - usage)} remaining
        </span>
      </div>

      {/* Status Message */}
      {percentage >= 90 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2">
          <p className="text-red-700 text-xs">
            <span className="font-semibold">Critical:</span> You've exceeded 90% of your {limit.type} limit
          </p>
        </div>
      )}
      {percentage >= 80 && percentage < 90 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
          <p className="text-yellow-700 text-xs">
            <span className="font-semibold">Warning:</span> You've reached 80% of your {limit.type} limit
          </p>
        </div>
      )}
    </div>
  );
};

export default CostLimitBar;