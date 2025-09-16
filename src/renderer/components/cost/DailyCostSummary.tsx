import React, { useState } from 'react';
import { useAICosts } from '../../hooks/useAICosts';
import { CostBreakdown } from '../../../types/cost';

interface DailyCostSummaryProps {
  className?: string;
  showComparison?: boolean;
  expandable?: boolean;
}

export const DailyCostSummary: React.FC<DailyCostSummaryProps> = ({
  className = '',
  showComparison = true,
  expandable = true
}) => {
  const { dailySummary, loading, error } = useAICosts();
  const [expanded, setExpanded] = useState(false);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    }).format(amount);
  };

  const getComparisonIcon = (comparison: number) => {
    if (comparison > 0) {
      return (
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    } else if (comparison < 0) {
      return (
        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    );
  };

  const getOperationIcon = (operationType: string) => {
    switch (operationType.toLowerCase()) {
      case 'text generation':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'code analysis':
        return (
          <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      case 'search queries':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        );
      case 'data processing':
        return (
          <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 000 2h.01a1 1 0 100-2H3zM6 4a1 1 0 000 2h.01a1 1 0 100-2H6zM9 4a1 1 0 000 2h.01a1 1 0 100-2H9zM2 7a1 1 0 011-1h14a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V7zM4 9a1 1 0 000 2v2a1 1 0 002 0v-2a1 1 0 100-2zM12 11a1 1 0 01-1 1v2a1 1 0 002 0v-2a1 1 0 01-1-1zM10 9a1 1 0 000 2v2a1 1 0 002 0v-2a1 1 0 100-2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  <div className="w-24 h-4 bg-gray-200 rounded"></div>
                </div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !dailySummary) {
    return (
      <div className={`bg-red-50 rounded-lg shadow-md border border-red-200 p-6 ${className}`}>
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-red-700 text-sm">
            {error || 'Failed to load daily cost summary'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 transition-all duration-300 hover:shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Daily Cost Summary</h3>
              <p className="text-sm text-gray-500">
                Today: {formatCurrency(dailySummary.totalToday)}
              </p>
            </div>
          </div>

          {/* Comparison */}
          {showComparison && (
            <div className="flex items-center space-x-2">
              {getComparisonIcon(dailySummary.comparison)}
              <span className={`text-sm font-medium ${
                dailySummary.comparison > 0 ? 'text-red-600' :
                dailySummary.comparison < 0 ? 'text-green-600' :
                'text-gray-600'
              }`}>
                {Math.abs(dailySummary.comparison).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">vs yesterday</span>
            </div>
          )}
        </div>
      </div>

      {/* Today's Breakdown */}
      <div className="px-6 pb-4">
        <div className="space-y-3">
          {dailySummary.today.map((breakdown, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-3">
                {getOperationIcon(breakdown.operationType)}
                <div>
                  <p className="font-medium text-gray-900 text-sm">{breakdown.operationType}</p>
                  <p className="text-xs text-gray-500">{breakdown.count} operations</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(breakdown.totalCost)}</p>
                <p className="text-xs text-gray-500">{formatCurrency(breakdown.averageCost)} avg</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Yesterday Comparison */}
      {expandable && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-6 py-3 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Compare with Yesterday ({formatCurrency(dailySummary.totalYesterday)})
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </button>

          {expanded && (
            <div className="px-6 pb-6">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Yesterday's Breakdown</h4>
                {dailySummary.yesterday.map((breakdown, index) => {
                  const todayBreakdown = dailySummary.today.find(t => t.operationType === breakdown.operationType);
                  const costDiff = todayBreakdown ? todayBreakdown.totalCost - breakdown.totalCost : -breakdown.totalCost;
                  const countDiff = todayBreakdown ? todayBreakdown.count - breakdown.count : -breakdown.count;

                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-25 rounded-lg border border-gray-100">
                      <div className="flex items-center space-x-3">
                        {getOperationIcon(breakdown.operationType)}
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{breakdown.operationType}</p>
                          <p className="text-xs text-gray-500">
                            {breakdown.count} operations
                            {countDiff !== 0 && (
                              <span className={`ml-1 ${countDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                ({countDiff > 0 ? '+' : ''}{countDiff})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-700">{formatCurrency(breakdown.totalCost)}</p>
                        {costDiff !== 0 && (
                          <p className={`text-xs font-medium ${costDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {costDiff > 0 ? '+' : ''}{formatCurrency(costDiff)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyCostSummary;