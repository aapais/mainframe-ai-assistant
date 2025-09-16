/**
 * Differential State System Example
 *
 * Demonstrates how to use the differential state management system
 * for efficient data transfer and state synchronization.
 */

import React, { useState, useEffect } from 'react';
import { useDifferentialState, useDifferentialStateMetrics } from '../renderer/hooks/useDifferentialState';
import { batchedIPC } from '../renderer/utils/BatchedIPCManager';

// Example data interfaces
interface DashboardMetrics {
  totalEntries: number;
  searchesPerDay: number;
  averageResolutionTime: number;
  systemHealth: 'good' | 'warning' | 'critical';
  lastUpdated: string;
}

interface SearchResults {
  results: Array<{
    id: string;
    title: string;
    score: number;
    category: string;
  }>;
  totalCount: number;
  query: string;
  executionTime: number;
}

export const DifferentialStateExample: React.FC = () => {
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [manualData, setManualData] = useState<any>(null);

  // Example 1: Basic differential state management
  const dashboardState = useDifferentialState<DashboardMetrics>({
    stateKey: 'dashboard-metrics',
    initialData: {
      totalEntries: 0,
      searchesPerDay: 0,
      averageResolutionTime: 0,
      systemHealth: 'good',
      lastUpdated: new Date().toISOString()
    },
    enableBatching: true,
    enableCompression: true,
    onError: (error) => console.error('Dashboard state error:', error),
    onStateChange: (change) => {
      console.log('Dashboard state changed:', {
        compressionRatio: change.compressionRatio,
        estimatedSavings: change.metadata.estimatedSavings
      });
    }
  });

  // Example 2: Search results with transform
  const searchState = useDifferentialState<SearchResults>({
    stateKey: 'search-results',
    enableBatching: true,
    transformData: (rawData: any) => ({
      ...rawData,
      results: rawData.results?.map((result: any) => ({
        ...result,
        score: Math.round(result.score * 100) / 100 // Round scores
      })) || []
    }),
    onStateChange: (change) => {
      if (change.compressionRatio > 0.5) {
        console.log(`High compression achieved: ${change.compressionRatio.toFixed(2)}`);
      }
    }
  });

  // Global metrics for monitoring
  const { globalMetrics, refresh: refreshMetrics } = useDifferentialStateMetrics();

  // Example 3: Manual differential operations
  const handleManualDifferentialRequest = async () => {
    try {
      console.log('Testing manual differential request...');

      // Get state with differential optimization
      const data = await batchedIPC.executeStateRequest(
        'kb-entries',
        'get',
        undefined,
        { enableDifferential: true, priority: 'high' }
      );

      setManualData(data);
      console.log('Manual differential request completed:', data);
    } catch (error) {
      console.error('Manual differential request failed:', error);
    }
  };

  // Example 4: Batch dashboard loading with differential optimization
  const handleDifferentialDashboardLoad = async () => {
    try {
      console.log('Loading dashboard with differential optimization...');
      const startTime = Date.now();

      const results = await batchedIPC.executeDifferentialDashboardBatch();
      const loadTime = Date.now() - startTime;

      console.log(`Dashboard loaded in ${loadTime}ms with differential optimization:`, results);
    } catch (error) {
      console.error('Differential dashboard load failed:', error);
    }
  };

  // Example 5: State subscription with real-time updates
  const handleSubscribeToState = async () => {
    try {
      if (subscriptionId) {
        await batchedIPC.unsubscribeFromState(subscriptionId);
        setSubscriptionId(null);
        console.log('Unsubscribed from state updates');
        return;
      }

      const id = await batchedIPC.subscribeToState<DashboardMetrics>(
        'dashboard-metrics',
        (data, change) => {
          console.log('Real-time state update received:', {
            data,
            differential: !!change,
            compressionRatio: change?.compressionRatio
          });
        }
      );

      setSubscriptionId(id);
      console.log('Subscribed to state updates:', id);
    } catch (error) {
      console.error('State subscription failed:', error);
    }
  };

  // Example 6: Update state with differential calculation
  const handleUpdateDashboardMetrics = async () => {
    try {
      const newMetrics: DashboardMetrics = {
        totalEntries: Math.floor(Math.random() * 1000) + 100,
        searchesPerDay: Math.floor(Math.random() * 500) + 50,
        averageResolutionTime: Math.floor(Math.random() * 300) + 60,
        systemHealth: ['good', 'warning', 'critical'][Math.floor(Math.random() * 3)] as any,
        lastUpdated: new Date().toISOString()
      };

      await dashboardState.actions.updateState(newMetrics);
      console.log('Dashboard metrics updated:', newMetrics);
    } catch (error) {
      console.error('Failed to update dashboard metrics:', error);
    }
  };

  // Example 7: Force full update (bypass differential)
  const handleForceFullUpdate = async () => {
    try {
      console.log('Forcing full update (bypassing differential)...');

      const data = await batchedIPC.executeStateRequest(
        'dashboard-metrics',
        'get',
        undefined,
        { enableDifferential: false, forceFullUpdate: true }
      );

      console.log('Full update completed:', data);
    } catch (error) {
      console.error('Force full update failed:', error);
    }
  };

  // Example 8: Rollback to previous version
  const handleRollback = async () => {
    try {
      if (dashboardState.version > 1) {
        const success = await dashboardState.actions.rollbackTo(dashboardState.version - 1);
        console.log(`Rollback ${success ? 'successful' : 'failed'}`);
      } else {
        console.log('No previous version to rollback to');
      }
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  };

  // Auto-refresh metrics every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshMetrics();
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshMetrics]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Differential State Management Examples</h1>

      {/* Dashboard State Example */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Dashboard Metrics (Differential State)</h2>

        {dashboardState.isLoading && (
          <div className="text-blue-600 mb-2">Loading dashboard metrics...</div>
        )}

        {dashboardState.error && (
          <div className="text-red-600 mb-2">Error: {dashboardState.error.message}</div>
        )}

        {dashboardState.data && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="font-medium">Total Entries:</span> {dashboardState.data.totalEntries}
            </div>
            <div>
              <span className="font-medium">Searches/Day:</span> {dashboardState.data.searchesPerDay}
            </div>
            <div>
              <span className="font-medium">Avg Resolution Time:</span> {dashboardState.data.averageResolutionTime}s
            </div>
            <div>
              <span className="font-medium">System Health:</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                dashboardState.data.systemHealth === 'good' ? 'bg-green-100 text-green-800' :
                dashboardState.data.systemHealth === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {dashboardState.data.systemHealth}
              </span>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600 mb-4">
          Version: {dashboardState.version} |
          Total Updates: {dashboardState.metrics.totalUpdates} |
          Differential Updates: {dashboardState.metrics.differentialUpdates} |
          Avg Compression: {(dashboardState.metrics.averageCompressionRatio * 100).toFixed(1)}% |
          Total Saved: {dashboardState.metrics.totalBytesSaved}KB
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={dashboardState.actions.refresh}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={dashboardState.isLoading}
          >
            Refresh
          </button>
          <button
            onClick={handleUpdateDashboardMetrics}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Update Metrics
          </button>
          <button
            onClick={handleRollback}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            disabled={dashboardState.version <= 1}
          >
            Rollback
          </button>
        </div>
      </div>

      {/* Search Results Example */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Search Results (Transformed Data)</h2>

        {searchState.data && (
          <div>
            <div className="mb-2">
              Query: <strong>{searchState.data.query || 'N/A'}</strong> |
              Results: {searchState.data.totalCount || 0} |
              Time: {searchState.data.executionTime || 0}ms
            </div>

            <div className="max-h-40 overflow-y-auto">
              {searchState.data.results?.map((result, index) => (
                <div key={result.id || index} className="p-2 border-b">
                  <span className="font-medium">{result.title}</span>
                  <span className="ml-2 text-sm text-gray-600">
                    Score: {result.score} | Category: {result.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => searchState.actions.refresh()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={searchState.isLoading}
        >
          Refresh Search Results
        </button>
      </div>

      {/* Manual Operations */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Manual Differential Operations</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <button
            onClick={handleManualDifferentialRequest}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Manual Differential Request
          </button>
          <button
            onClick={handleDifferentialDashboardLoad}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Differential Dashboard Batch
          </button>
          <button
            onClick={handleSubscribeToState}
            className={`px-4 py-2 text-white rounded ${
              subscriptionId
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {subscriptionId ? 'Unsubscribe' : 'Subscribe'} to State
          </button>
          <button
            onClick={handleForceFullUpdate}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Force Full Update
          </button>
        </div>

        {manualData && (
          <div className="p-4 bg-gray-100 rounded">
            <h3 className="font-medium mb-2">Manual Request Result:</h3>
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(manualData, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Global Metrics */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Global Differential Metrics</h2>

        {globalMetrics ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">Total States:</span> {globalMetrics.totalStates}
            </div>
            <div>
              <span className="font-medium">Total Versions:</span> {globalMetrics.totalVersions}
            </div>
            <div>
              <span className="font-medium">Subscriptions:</span> {globalMetrics.totalSubscriptions}
            </div>
            <div>
              <span className="font-medium">Memory Usage:</span> {Math.round(globalMetrics.memoryUsageBytes / 1024)}KB
            </div>
            <div>
              <span className="font-medium">Total Data Size:</span> {Math.round(globalMetrics.totalDataSizeBytes / 1024)}KB
            </div>
            <div>
              <span className="font-medium">Active Trackers:</span> {globalMetrics.activeTrackers?.length || 0}
            </div>
          </div>
        ) : (
          <div className="text-gray-600">Loading global metrics...</div>
        )}

        <div className="mt-4">
          <button
            onClick={refreshMetrics}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Metrics
          </button>

          <button
            onClick={() => {
              batchedIPC.clearStateVersions();
              console.log('State versions cleared - next requests will be full updates');
            }}
            className="ml-2 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Clear State Versions
          </button>

          <button
            onClick={() => {
              const enabled = !batchedIPC.isDifferentialEnabled();
              batchedIPC.setDifferentialEnabled(enabled);
              console.log(`Differential optimization ${enabled ? 'enabled' : 'disabled'}`);
            }}
            className="ml-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Toggle Differential ({batchedIPC.isDifferentialEnabled() ? 'ON' : 'OFF'})
          </button>
        </div>
      </div>
    </div>
  );
};

export default DifferentialStateExample;