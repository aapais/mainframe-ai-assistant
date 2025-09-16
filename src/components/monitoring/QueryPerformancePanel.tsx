/**
 * Query Performance Panel
 * Displays detailed query performance metrics and analysis
 */

import React, { useState } from 'react';
import { MetricsChart } from './MetricsChart';

interface QueryMetrics {
  avgResponseTime: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: number;
  }>;
  queryCount: number;
  errorRate: number;
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    mean: number;
    min: number;
    max: number;
    count: number;
  };
}

interface QueryPerformancePanelProps {
  queryMetrics: QueryMetrics;
}

export const QueryPerformancePanel: React.FC<QueryPerformancePanelProps> = ({
  queryMetrics
}) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'percentiles' | 'slow-queries'>('overview');

  const getPerformanceStatus = (avgTime: number) => {
    if (avgTime < 100) return { status: 'excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (avgTime < 500) return { status: 'good', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (avgTime < 1000) return { status: 'warning', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { status: 'critical', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration.toFixed(0)}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const formatQuery = (query: string) => {
    // Basic SQL formatting
    return query
      .replace(/\s+/g, ' ')
      .replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|INSERT|UPDATE|DELETE)\b/gi, '\n$1')
      .trim();
  };

  const performanceStatus = getPerformanceStatus(queryMetrics.avgResponseTime);

  const percentileData = [
    { name: 'P50', value: queryMetrics.percentiles.p50, color: '#10B981' },
    { name: 'P75', value: queryMetrics.percentiles.p75, color: '#3B82F6' },
    { name: 'P90', value: queryMetrics.percentiles.p90, color: '#F59E0B' },
    { name: 'P95', value: queryMetrics.percentiles.p95, color: '#EF4444' },
    { name: 'P99', value: queryMetrics.percentiles.p99, color: '#8B5CF6' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Query Performance Analysis</h2>

        {/* Tab Navigation */}
        <div className="mt-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'percentiles', label: 'Percentiles' },
              { id: 'slow-queries', label: `Slow Queries (${queryMetrics.slowQueries.length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="p-4">
        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Performance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${performanceStatus.bg} ${performanceStatus.color}`}>
                  {performanceStatus.status.toUpperCase()}
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatDuration(queryMetrics.avgResponseTime)}
                </p>
                <p className="text-sm text-gray-600">Average Response Time</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{queryMetrics.queryCount}</p>
                <p className="text-sm text-gray-600">Total Queries</p>
              </div>

              <div className="text-center">
                <p className={`text-2xl font-bold ${queryMetrics.errorRate > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                  {(queryMetrics.errorRate * 100).toFixed(2)}%
                </p>
                <p className="text-sm text-gray-600">Error Rate</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(queryMetrics.percentiles.p95)}
                </p>
                <p className="text-sm text-gray-600">P95 Response Time</p>
              </div>
            </div>

            {/* Performance Insights */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-md font-semibold text-gray-900 mb-2">Performance Insights</h3>
              <div className="space-y-2 text-sm">
                {queryMetrics.avgResponseTime > 1000 && (
                  <div className="flex items-start space-x-2">
                    <span className="text-red-500">⚠️</span>
                    <span>Average response time is above 1 second. Consider query optimization.</span>
                  </div>
                )}

                {queryMetrics.errorRate > 0.05 && (
                  <div className="flex items-start space-x-2">
                    <span className="text-red-500">⚠️</span>
                    <span>Error rate is above 5%. Check for failing queries and database issues.</span>
                  </div>
                )}

                {queryMetrics.percentiles.p99 > queryMetrics.percentiles.p95 * 3 && (
                  <div className="flex items-start space-x-2">
                    <span className="text-yellow-500">⚠️</span>
                    <span>High P99 latency indicates outlier queries. Review slow query log.</span>
                  </div>
                )}

                {queryMetrics.slowQueries.length > 10 && (
                  <div className="flex items-start space-x-2">
                    <span className="text-yellow-500">⚠️</span>
                    <span>Multiple slow queries detected. Consider adding indexes or query optimization.</span>
                  </div>
                )}

                {queryMetrics.avgResponseTime < 100 && queryMetrics.errorRate < 0.01 && (
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500">✅</span>
                    <span>Query performance is excellent. Keep up the good work!</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Query Activity */}
            <div>
              <h3 className="text-md font-semibold text-gray-900 mb-3">Query Activity Timeline</h3>
              <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                <span className="text-gray-500">Query timeline visualization would go here</span>
              </div>
            </div>
          </div>
        )}

        {/* Percentiles Tab */}
        {selectedTab === 'percentiles' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-semibold text-gray-900 mb-3">Response Time Percentiles</h3>
              <MetricsChart
                data={percentileData}
                type="bar"
                yAxisLabel="Time (ms)"
                height={250}
                showGrid={true}
              />
            </div>

            {/* Percentile Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {percentileData.map((percentile) => (
                <div key={percentile.name} className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: percentile.color }}
                    />
                    <span className="text-sm font-medium text-gray-700">{percentile.name}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {formatDuration(percentile.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Percentile Explanation */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Understanding Percentiles</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>P50 (Median):</strong> 50% of queries complete faster than this time</p>
                <p><strong>P95:</strong> 95% of queries complete faster than this time</p>
                <p><strong>P99:</strong> 99% of queries complete faster than this time</p>
                <p className="mt-2 text-xs">Higher percentiles help identify outliers and worst-case performance.</p>
              </div>
            </div>
          </div>
        )}

        {/* Slow Queries Tab */}
        {selectedTab === 'slow-queries' && (
          <div className="space-y-4">
            {queryMetrics.slowQueries.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">No Slow Queries</h3>
                <p className="text-gray-600">All queries are performing within acceptable limits.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-semibold text-gray-900">
                    Slowest Queries ({queryMetrics.slowQueries.length})
                  </h3>
                  <span className="text-sm text-gray-600">
                    Queries taking &gt; 1 second
                  </span>
                </div>

                <div className="space-y-3">
                  {queryMetrics.slowQueries.map((query, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            query.duration > 5000 ? 'bg-red-100 text-red-800' :
                            query.duration > 2000 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {formatDuration(query.duration)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(query.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <button className="text-xs text-blue-600 hover:text-blue-800">
                          Analyze
                        </button>
                      </div>

                      <div className="bg-gray-50 rounded p-3 font-mono text-sm overflow-x-auto">
                        <pre className="whitespace-pre-wrap text-gray-800">
                          {formatQuery(query.query)}
                        </pre>
                      </div>

                      {/* Query suggestions */}
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium">Optimization suggestions:</span>
                        {query.query.toLowerCase().includes('select *') && (
                          <span className="ml-1">• Avoid SELECT *</span>
                        )}
                        {!query.query.toLowerCase().includes('limit') && query.query.toLowerCase().includes('select') && (
                          <span className="ml-1">• Consider adding LIMIT</span>
                        )}
                        {query.query.toLowerCase().includes('where') && !query.query.toLowerCase().includes('index') && (
                          <span className="ml-1">• Check if WHERE columns are indexed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Optimization Tips */}
                <div className="bg-yellow-50 rounded-lg p-4 mt-6">
                  <h4 className="text-sm font-semibold text-yellow-900 mb-2">Query Optimization Tips</h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Add indexes on frequently queried columns</li>
                    <li>• Use LIMIT clauses to reduce result set size</li>
                    <li>• Avoid SELECT * and only fetch needed columns</li>
                    <li>• Consider query result caching for repeated queries</li>
                    <li>• Use EXPLAIN to analyze query execution plans</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};