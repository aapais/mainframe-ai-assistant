/**
 * Cache Monitor Panel
 * Displays cache effectiveness metrics and analysis
 */

import React, { useState } from 'react';
import { MetricsChart } from './MetricsChart';

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}

interface CacheMonitorPanelProps {
  cacheMetrics: CacheMetrics;
}

export const CacheMonitorPanel: React.FC<CacheMonitorPanelProps> = ({
  cacheMetrics
}) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'analysis'>('overview');

  const getCacheHealthStatus = (hitRate: number) => {
    if (hitRate >= 0.9) return { status: 'excellent', color: 'text-green-600', bg: 'bg-green-100', icon: '🟢' };
    if (hitRate >= 0.8) return { status: 'good', color: 'text-blue-600', bg: 'bg-blue-100', icon: '🔵' };
    if (hitRate >= 0.6) return { status: 'warning', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '🟡' };
    return { status: 'critical', color: 'text-red-600', bg: 'bg-red-100', icon: '🔴' };
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  const cacheStatus = getCacheHealthStatus(cacheMetrics.hitRate);

  const hitMissData = [
    { name: 'Hits', value: cacheMetrics.hits, color: '#10B981' },
    { name: 'Misses', value: cacheMetrics.misses, color: '#EF4444' }
  ];

  const utilizationPercentage = cacheMetrics.maxSize > 0
    ? (cacheMetrics.size / cacheMetrics.maxSize) * 100
    : 0;

  const getRecommendations = () => {
    const recommendations = [];

    if (cacheMetrics.hitRate < 0.6) {
      recommendations.push({
        type: 'critical',
        title: 'Low Cache Hit Rate',
        description: 'Consider reviewing cache keys and TTL settings',
        icon: '⚠️'
      });
    }

    if (cacheMetrics.hitRate > 0.95 && cacheMetrics.totalRequests > 100) {
      recommendations.push({
        type: 'success',
        title: 'Excellent Cache Performance',
        description: 'Cache is performing optimally',
        icon: '✅'
      });
    }

    if (utilizationPercentage > 90) {
      recommendations.push({
        type: 'warning',
        title: 'High Cache Utilization',
        description: 'Consider increasing cache size or reviewing eviction policies',
        icon: '📈'
      });
    }

    if (cacheMetrics.evictions > cacheMetrics.hits * 0.1) {
      recommendations.push({
        type: 'warning',
        title: 'High Eviction Rate',
        description: 'Frequent evictions may indicate insufficient cache size',
        icon: '🔄'
      });
    }

    if (cacheMetrics.totalRequests === 0) {
      recommendations.push({
        type: 'info',
        title: 'No Cache Activity',
        description: 'No cache requests detected in the current time window',
        icon: 'ℹ️'
      });
    }

    return recommendations;
  };

  const recommendations = getRecommendations();

  return (
    <div className="h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Cache Performance</h2>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${cacheStatus.bg} ${cacheStatus.color}`}>
            <span>{cacheStatus.icon}</span>
            <span>{cacheStatus.status.toUpperCase()}</span>
          </div>
        </div>

        {/* View Toggle */}
        <div className="mt-4 flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'trends', label: 'Trends' },
            { id: 'analysis', label: 'Analysis' }
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.id as any)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedView === view.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* Overview */}
        {selectedView === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {formatPercentage(cacheMetrics.hitRate)}
                </div>
                <div className="text-sm text-gray-600">Hit Rate</div>
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        cacheMetrics.hitRate >= 0.8 ? 'bg-green-500' :
                        cacheMetrics.hitRate >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${cacheMetrics.hitRate * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {formatNumber(cacheMetrics.totalRequests)}
                </div>
                <div className="text-sm text-gray-600">Total Requests</div>
                <div className="mt-1 text-xs text-gray-500">
                  {formatNumber(cacheMetrics.hits)} hits, {formatNumber(cacheMetrics.misses)} misses
                </div>
              </div>
            </div>

            {/* Hit/Miss Chart */}
            {cacheMetrics.totalRequests > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Cache Hit/Miss Distribution</h3>
                <MetricsChart
                  data={hitMissData}
                  type="bar"
                  height={150}
                  showGrid={false}
                />
              </div>
            )}

            {/* Cache Utilization */}
            {cacheMetrics.maxSize > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Cache Utilization</h3>
                  <span className="text-sm text-gray-600">
                    {formatNumber(cacheMetrics.size)} / {formatNumber(cacheMetrics.maxSize)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      utilizationPercentage >= 90 ? 'bg-red-500' :
                      utilizationPercentage >= 75 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {utilizationPercentage.toFixed(1)}% utilized
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trends */}
        {selectedView === 'trends' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Historical Trends</h3>
              <p className="text-gray-600">Cache performance trends over time would be displayed here</p>
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">24h Avg Hit Rate:</span>
                      <span className="ml-2">{formatPercentage(cacheMetrics.hitRate)}</span>
                    </div>
                    <div>
                      <span className="font-medium">Peak Requests/min:</span>
                      <span className="ml-2">{Math.ceil(cacheMetrics.totalRequests / 5)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis */}
        {selectedView === 'analysis' && (
          <div className="space-y-6">
            {/* Recommendations */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Recommendations ({recommendations.length})
              </h3>
              {recommendations.length === 0 ? (
                <div className="text-center py-4 text-gray-600">
                  No specific recommendations at this time
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-l-4 ${
                        rec.type === 'critical' ? 'bg-red-50 border-red-400' :
                        rec.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                        rec.type === 'success' ? 'bg-green-50 border-green-400' :
                        'bg-blue-50 border-blue-400'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        <span className="text-lg">{rec.icon}</span>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{rec.title}</h4>
                          <p className="text-sm text-gray-700">{rec.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cache Statistics */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Detailed Statistics</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hit Rate:</span>
                      <span className="font-medium">{formatPercentage(cacheMetrics.hitRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Miss Rate:</span>
                      <span className="font-medium">{formatPercentage(cacheMetrics.missRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Hits:</span>
                      <span className="font-medium">{formatNumber(cacheMetrics.hits)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Misses:</span>
                      <span className="font-medium">{formatNumber(cacheMetrics.misses)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current Size:</span>
                      <span className="font-medium">{formatNumber(cacheMetrics.size)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max Size:</span>
                      <span className="font-medium">{formatNumber(cacheMetrics.maxSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Evictions:</span>
                      <span className="font-medium">{formatNumber(cacheMetrics.evictions)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Utilization:</span>
                      <span className="font-medium">{utilizationPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Optimization Tips */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Optimization Tips</h3>
              <div className="bg-blue-50 rounded-lg p-4">
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Monitor cache hit rate regularly - aim for &gt;80%</li>
                  <li>• Adjust TTL (Time To Live) based on data freshness requirements</li>
                  <li>• Use cache warming strategies for frequently accessed data</li>
                  <li>• Implement cache hierarchies for different data types</li>
                  <li>• Consider using LRU eviction for memory-constrained scenarios</li>
                  <li>• Profile cache key patterns to identify optimization opportunities</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};