/**
 * Real-time Performance Dashboard
 * Main dashboard component for monitoring system performance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { metricsCollector } from '../../services/metrics/MetricsCollector';
import { MetricsChart } from './MetricsChart';
import { QueryPerformancePanel } from './QueryPerformancePanel';
import { CacheMonitorPanel } from './CacheMonitorPanel';
import { SLAStatusPanel } from './SLAStatusPanel';
import { AlertsPanel } from './AlertsPanel';

interface DashboardMetrics {
  timestamp: number;
  query: any;
  cache: any;
  responseTime: any;
  sla: any;
}

export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [selectedTimeRange, setSelectedTimeRange] = useState('5m');

  // Subscribe to real-time metrics updates
  useEffect(() => {
    const unsubscribe = metricsCollector.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      setIsConnected(true);
    });

    // Initial load
    const initialMetrics = metricsCollector.getCurrentMetrics();
    setMetrics(initialMetrics);

    return unsubscribe;
  }, []);

  // Handle connection status
  useEffect(() => {
    const checkConnection = () => {
      if (metrics && Date.now() - metrics.timestamp > 30000) {
        setIsConnected(false);
      }
    };

    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [metrics]);

  const handleRefreshIntervalChange = useCallback((interval: number) => {
    setRefreshInterval(interval);
  }, []);

  const handleTimeRangeChange = useCallback((range: string) => {
    setSelectedTimeRange(range);
  }, []);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading performance metrics...</span>
      </div>
    );
  }

  const connectionStatusClass = isConnected
    ? 'bg-green-100 border-green-500 text-green-700'
    : 'bg-red-100 border-red-500 text-red-700';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
          <div className={`px-3 py-1 rounded-full border text-sm font-medium ${connectionStatusClass}`}>
            {isConnected ? '● Connected' : '● Disconnected'}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Refresh:</label>
            <select
              value={refreshInterval}
              onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={1000}>1s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Time Range:</label>
            <select
              value={selectedTimeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value="1m">1 minute</option>
              <option value="5m">5 minutes</option>
              <option value="15m">15 minutes</option>
              <option value="1h">1 hour</option>
            </select>
          </div>

          <div className="text-sm text-gray-500">
            Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* SLA Status - Top Priority */}
      <div className="mb-6">
        <SLAStatusPanel slaMetrics={metrics.sla} />
      </div>

      {/* Alerts Panel */}
      {metrics.sla.violations.length > 0 && (
        <div className="mb-6">
          <AlertsPanel violations={metrics.sla.violations} />
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Response Time Chart */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Response Time Percentiles</h2>
          </div>
          <div className="p-4">
            <MetricsChart
              data={[
                { name: 'P50', value: metrics.responseTime.p50, color: '#10B981' },
                { name: 'P75', value: metrics.responseTime.p75, color: '#F59E0B' },
                { name: 'P90', value: metrics.responseTime.p90, color: '#EF4444' },
                { name: 'P95', value: metrics.responseTime.p95, color: '#8B5CF6' },
                { name: 'P99', value: metrics.responseTime.p99, color: '#EC4899' }
              ]}
              type="bar"
              yAxisLabel="Time (ms)"
            />
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Mean:</span>
                <span className="ml-1 font-medium">{metrics.responseTime.mean.toFixed(1)}ms</span>
              </div>
              <div>
                <span className="text-gray-500">Min:</span>
                <span className="ml-1 font-medium">{metrics.responseTime.min.toFixed(1)}ms</span>
              </div>
              <div>
                <span className="text-gray-500">Max:</span>
                <span className="ml-1 font-medium">{metrics.responseTime.max.toFixed(1)}ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cache Performance */}
        <div className="bg-white rounded-lg shadow-sm border">
          <CacheMonitorPanel cacheMetrics={metrics.cache} />
        </div>
      </div>

      {/* Query Performance Panel */}
      <div className="mb-6">
        <QueryPerformancePanel queryMetrics={metrics.query} />
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.responseTime.count}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metrics.query.errorRate * 100).toFixed(2)}%
              </p>
            </div>
            <div className={`p-2 rounded-lg ${metrics.query.errorRate > 0.05 ? 'bg-red-100' : 'bg-green-100'}`}>
              <svg className={`w-6 h-6 ${metrics.query.errorRate > 0.05 ? 'text-red-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Cache Hit Rate */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metrics.cache.hitRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className={`p-2 rounded-lg ${metrics.cache.hitRate > 0.8 ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <svg className={`w-6 h-6 ${metrics.cache.hitRate > 0.8 ? 'text-green-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Throughput */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Throughput</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics.sla.throughputActual.toFixed(1)}/min
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};