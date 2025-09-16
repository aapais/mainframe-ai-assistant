/**
 * Batch Performance Demo
 *
 * Demonstrates the performance improvement achieved by the batching system
 * Compares individual IPC calls vs batched calls for dashboard loading.
 */

import React, { useState, useCallback } from 'react';
import { batchedIPC } from '../renderer/utils/BatchedIPCManager';

interface PerformanceResult {
  method: string;
  executionTime: number;
  requestCount: number;
  averagePerRequest: number;
  cacheHits?: number;
  errors?: number;
}

export const BatchPerformanceDemo: React.FC = () => {
  const [results, setResults] = useState<PerformanceResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [batchStats, setBatchStats] = useState<any>(null);

  const runIndividualRequests = useCallback(async () => {
    const startTime = Date.now();
    const promises = [
      window.electronAPI?.db?.getStats(),
      window.electronAPI?.perf?.getStatus(),
      window.electronAPI?.system?.getInfo(),
      window.electronAPI?.db?.getPopular(10),
      window.electronAPI?.db?.getRecent(10),
      window.electronAPI?.config?.get('theme')
    ];

    try {
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      return {
        method: 'Individual Requests',
        executionTime: totalTime,
        requestCount: 6,
        averagePerRequest: totalTime / 6
      };
    } catch (error) {
      console.error('Individual requests failed:', error);
      throw error;
    }
  }, []);

  const runBatchedRequests = useCallback(async () => {
    const startTime = Date.now();

    try {
      const batchResult = await batchedIPC.executeDashboardBatch();
      const totalTime = Date.now() - startTime;

      // Get batch statistics
      const stats = await batchedIPC.getStats();

      return {
        method: 'Batched Requests',
        executionTime: totalTime,
        requestCount: 6,
        averagePerRequest: totalTime / 6,
        cacheHits: stats.cacheHitRate,
        batchStats: stats
      };
    } catch (error) {
      console.error('Batched requests failed:', error);
      throw error;
    }
  }, []);

  const runPerformanceTest = useCallback(async () => {
    setIsRunning(true);
    setResults([]);

    try {
      console.log('[BatchDemo] Starting performance comparison...');

      // Run individual requests test
      const individualResult = await runIndividualRequests();
      setResults(prev => [...prev, individualResult]);

      // Wait a moment to avoid interference
      await new Promise(resolve => setTimeout(resolve, 100));

      // Run batched requests test
      const batchedResult = await runBatchedRequests();
      setResults(prev => [...prev, batchedResult]);

      // Get final batch stats
      const finalStats = await batchedIPC.getStats();
      setBatchStats(finalStats);

      console.log('[BatchDemo] Performance test completed');

    } catch (error) {
      console.error('[BatchDemo] Performance test failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [runIndividualRequests, runBatchedRequests]);

  const clearStats = useCallback(async () => {
    await batchedIPC.clearStats();
    setBatchStats(null);
    setResults([]);
  }, []);

  const calculateImprovement = useCallback(() => {
    if (results.length < 2) return null;

    const individual = results.find(r => r.method === 'Individual Requests');
    const batched = results.find(r => r.method === 'Batched Requests');

    if (!individual || !batched) return null;

    const timeSaved = individual.executionTime - batched.executionTime;
    const percentImprovement = (timeSaved / individual.executionTime) * 100;

    return {
      timeSaved,
      percentImprovement,
      speedupRatio: individual.executionTime / batched.executionTime
    };
  }, [results]);

  const improvement = calculateImprovement();

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🚀 Batch IPC Performance Demo</h2>
      <p>
        This demo compares the performance of individual IPC calls vs batched calls
        for dashboard data loading. The batching system should show significant performance improvements.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={runPerformanceTest}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? '🔄 Running Test...' : '▶️ Run Performance Test'}
        </button>

        <button
          onClick={clearStats}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🗑️ Clear Stats
        </button>
      </div>

      {/* Results Table */}
      {results.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>📊 Performance Results</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Method</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Total Time (ms)</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Requests</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Avg per Request</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Cache Hits</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={index}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {result.method}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {result.executionTime}ms
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {result.requestCount}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {result.averagePerRequest.toFixed(1)}ms
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {result.cacheHits ? `${(result.cacheHits * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Performance Improvement Summary */}
      {improvement && (
        <div style={{
          padding: '15px',
          backgroundColor: improvement.percentImprovement > 0 ? '#d4edda' : '#f8d7da',
          border: `1px solid ${improvement.percentImprovement > 0 ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <h4>🎯 Performance Improvement</h4>
          <ul style={{ margin: '10px 0' }}>
            <li><strong>Time Saved:</strong> {improvement.timeSaved}ms</li>
            <li><strong>Percent Improvement:</strong> {improvement.percentImprovement.toFixed(1)}%</li>
            <li><strong>Speedup Ratio:</strong> {improvement.speedupRatio.toFixed(2)}x faster</li>
          </ul>
          {improvement.percentImprovement > 0 ? (
            <p>✅ <strong>Batching system is working!</strong> Dashboard loads {improvement.percentImprovement.toFixed(1)}% faster.</p>
          ) : (
            <p>⚠️ Batching system may need optimization or network conditions are affecting results.</p>
          )}
        </div>
      )}

      {/* Batch Statistics */}
      {batchStats && (
        <div style={{ marginBottom: '20px' }}>
          <h3>📈 Batch System Statistics</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Total Batches:</strong> {batchStats.totalBatches}
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Total Requests:</strong> {batchStats.totalRequests}
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Avg Batch Size:</strong> {batchStats.averageBatchSize.toFixed(1)}
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Avg Execution Time:</strong> {batchStats.averageExecutionTime.toFixed(1)}ms
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Cache Hit Rate:</strong> {(batchStats.cacheHitRate * 100).toFixed(1)}%
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Error Rate:</strong> {(batchStats.errorRate * 100).toFixed(1)}%
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Total Time Saved:</strong> {batchStats.timesSaved}ms
            </div>
          </div>
        </div>
      )}

      <div style={{
        padding: '15px',
        backgroundColor: '#e9ecef',
        borderRadius: '4px',
        fontSize: '0.9em'
      }}>
        <h4>ℹ️ How It Works</h4>
        <p>
          The batching system collects multiple IPC requests within a short time window (100ms) and
          sends them as a single batch to the main process. This reduces:
        </p>
        <ul>
          <li><strong>Network round-trips:</strong> 6 requests → 1 batch request</li>
          <li><strong>IPC overhead:</strong> Less serialization/deserialization</li>
          <li><strong>Context switching:</strong> Fewer main-renderer process switches</li>
          <li><strong>Database connections:</strong> Shared connections and transactions</li>
        </ul>
        <p>
          The target is to achieve <strong>&lt;1 second</strong> dashboard loading time vs the previous
          6-12 seconds with individual calls.
        </p>
      </div>
    </div>
  );
};

export default BatchPerformanceDemo;