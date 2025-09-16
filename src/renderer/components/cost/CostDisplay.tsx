import React from 'react';
import { useAICosts } from '../../hooks/useAICosts';
import { CostDisplaySize } from '../../../types/cost';

interface CostDisplayProps {
  size?: CostDisplaySize;
  className?: string;
  showTrend?: boolean;
  autoRefresh?: boolean;
}

export const CostDisplay: React.FC<CostDisplayProps> = ({
  size = 'normal',
  className = '',
  showTrend = true,
  autoRefresh = true
}) => {
  const { costData, loading, error, refreshCosts } = useAICosts();

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'down':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'compact':
        return 'p-3 space-y-2 text-sm';
      case 'detailed':
        return 'p-6 space-y-4 text-base';
      default:
        return 'p-4 space-y-3 text-sm';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${getSizeClasses()} ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-6 bg-gray-200 rounded mb-3"></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 rounded-lg shadow-md border border-red-200 ${getSizeClasses()} ${className}`}>
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-red-700 text-sm">{error}</span>
        </div>
        <button
          onClick={refreshCosts}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!costData) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${getSizeClasses()} ${className} transition-all duration-300 hover:shadow-lg`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-[#A100FF] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">AI Costs</h3>
        </div>

        {autoRefresh && (
          <button
            onClick={refreshCosts}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh costs"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Session Cost */}
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Session Cost</p>
            <p className="text-2xl font-bold text-purple-900">{formatCurrency(costData.sessionCost)}</p>
          </div>
          {showTrend && (
            <div className="flex items-center space-x-1">
              {getTrendIcon(costData.trend)}
              <span className={`text-sm font-medium ${
                costData.trend === 'up' ? 'text-red-600' :
                costData.trend === 'down' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {costData.trendPercentage}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Daily and Monthly Costs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Daily Total</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(costData.dailyCost)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Monthly Total</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(costData.monthlyCost)}</p>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs text-gray-500">Live tracking active</span>
      </div>
    </div>
  );
};

export default CostDisplay;