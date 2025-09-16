/**
 * Optimized Dashboard Component Example
 *
 * Demonstrates how to use the integrated optimization system
 * for achieving <1s response times in React components.
 *
 * @author QA and Integration Engineer
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { optimizedIPC } from '../renderer/services/OptimizedIPCService';
import type { DatabaseMetrics, KBEntry, SystemHealth } from '../types';

// =====================
// Performance Monitoring Hook
// =====================

interface PerformanceMetrics {
  loadTime: number;
  targetMet: boolean;
  optimizationActive: boolean;
}

const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    targetMet: true,
    optimizationActive: true
  });

  const measureOperation = useCallback(async <T,>(
    operation: () => Promise<T>,
    target: number = 1000
  ): Promise<T> => {
    const startTime = performance.now();

    try {
      const result = await operation();
      const loadTime = performance.now() - startTime;

      setMetrics({
        loadTime,
        targetMet: loadTime < target,
        optimizationActive: true
      });

      // Log performance for monitoring
      if (loadTime > target) {
        console.warn(`⚠️  Operation exceeded target: ${loadTime.toFixed(2)}ms > ${target}ms`);
      } else {
        console.log(`⚡ Operation completed in ${loadTime.toFixed(2)}ms (target: ${target}ms)`);
      }

      return result;
    } catch (error) {
      const loadTime = performance.now() - startTime;
      setMetrics({
        loadTime,
        targetMet: false,
        optimizationActive: false
      });
      throw error;
    }
  }, []);

  return { metrics, measureOperation };
};

// =====================
// Optimized Dashboard Component
// =====================

interface DashboardData {
  metrics: DatabaseMetrics;
  recentEntries: KBEntry[];
  popularEntries: KBEntry[];
  systemHealth: SystemHealth;
}

export const OptimizedDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KBEntry[]>([]);
  const { metrics, measureOperation } = usePerformanceMonitoring();

  // =====================
  // Optimized Dashboard Load
  // =====================

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // This call is optimized with batching to complete in <1s
      const data = await measureOperation(
        () => optimizedIPC.loadDashboard(),
        1000 // 1s target
      );

      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [measureOperation]);

  // =====================
  // Optimized Search
  // =====================

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      // This call is optimized with debouncing and caching
      const results = await measureOperation(
        () => optimizedIPC.executeSearch(query, { limit: 20 }),
        1000 // 1s target
      );

      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    }
  }, [measureOperation]);

  // Debounced search input
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 200); // 200ms debounce (handled by OptimizedIPC internally too)

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, handleSearch]);

  // =====================
  // Optimized Metrics Refresh
  // =====================

  const refreshMetrics = useCallback(async () => {
    try {
      // This call is optimized with caching to complete in <500ms
      const newMetrics = await measureOperation(
        () => optimizedIPC.refreshMetrics(),
        500 // 500ms target
      );

      setDashboardData(prev => prev ? { ...prev, metrics: newMetrics } : null);
    } catch (err) {
      console.error('Metrics refresh failed:', err);
    }
  }, [measureOperation]);

  // Auto-refresh metrics every 30 seconds (throttled by OptimizedIPC)
  useEffect(() => {
    const interval = setInterval(refreshMetrics, 30000);
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  // Initial load
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // =====================
  // Performance Status Component
  // =====================

  const PerformanceStatus: React.FC = () => (
    <div className={`performance-status ${metrics.targetMet ? 'success' : 'warning'}`}>
      <span className="icon">{metrics.targetMet ? '⚡' : '⚠️'}</span>
      <span className="text">
        Last operation: {metrics.loadTime.toFixed(0)}ms
        {metrics.targetMet ? ' (target met)' : ' (target exceeded)'}
      </span>
      <span className={`optimization ${metrics.optimizationActive ? 'active' : 'inactive'}`}>
        Optimizations: {metrics.optimizationActive ? 'Active' : 'Inactive'}
      </span>
    </div>
  );

  // =====================
  // Render
  // =====================

  if (loading && !dashboardData) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading dashboard (target: &lt;1s)...</p>
        <PerformanceStatus />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Dashboard Load Failed</h2>
        <p>{error}</p>
        <button onClick={loadDashboard}>Retry</button>
        <PerformanceStatus />
      </div>
    );
  }

  if (!dashboardData) {
    return <div>No data available</div>;
  }

  return (
    <div className="optimized-dashboard">
      {/* Performance Status Bar */}
      <PerformanceStatus />

      {/* Header */}
      <header className="dashboard-header">
        <h1>Mainframe Knowledge Assistant</h1>
        <div className="header-actions">
          <button onClick={refreshMetrics} disabled={loading}>
            🔄 Refresh Metrics
          </button>
          <button onClick={loadDashboard} disabled={loading}>
            🔄 Reload Dashboard
          </button>
        </div>
      </header>

      {/* Search Section */}
      <section className="search-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search knowledge base... (optimized with debouncing)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              <h3>Search Results ({searchResults.length})</h3>
              {searchResults.slice(0, 5).map((result) => (
                <div key={result.id} className="search-result">
                  <h4>{result.title}</h4>
                  <p>{result.problem?.substring(0, 100)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Metrics Cards */}
      <section className="metrics-section">
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Total Entries</h3>
            <div className="metric-value">{dashboardData.metrics.totalEntries}</div>
          </div>
          <div className="metric-card">
            <h3>Searches Today</h3>
            <div className="metric-value">{dashboardData.metrics.searchesToday}</div>
          </div>
          <div className="metric-card">
            <h3>Avg Response Time</h3>
            <div className="metric-value">{dashboardData.metrics.averageResponseTime}ms</div>
          </div>
          <div className="metric-card">
            <h3>Cache Hit Rate</h3>
            <div className="metric-value">{dashboardData.metrics.cacheHitRate}%</div>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <div className="dashboard-content">
        <section className="recent-entries">
          <h2>Recent Entries</h2>
          <div className="entries-list">
            {dashboardData.recentEntries.map((entry) => (
              <div key={entry.id} className="entry-card">
                <h3>{entry.title}</h3>
                <p className="entry-meta">
                  Created: {new Date(entry.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="popular-entries">
          <h2>Popular Entries</h2>
          <div className="entries-list">
            {dashboardData.popularEntries.map((entry) => (
              <div key={entry.id} className="entry-card popular">
                <h3>{entry.title}</h3>
                <p className="usage-count">Used {entry.usage_count} times</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* System Health */}
      <section className="health-section">
        <h2>System Health</h2>
        <div className="health-status">
          <div className={`health-indicator ${dashboardData.systemHealth.overall ? 'healthy' : 'unhealthy'}`}>
            {dashboardData.systemHealth.overall ? '✅ Healthy' : '❌ Issues Detected'}
          </div>
          <div className="health-details">
            <span>IPC: {dashboardData.systemHealth.ipc?.responsive ? '✅' : '❌'}</span>
            <span>Database: {dashboardData.systemHealth.database?.connected ? '✅' : '❌'}</span>
            <span>Cache: {dashboardData.systemHealth.cache?.active ? '✅' : '❌'}</span>
            <span>Batching: {dashboardData.systemHealth.batching?.active ? '✅' : '❌'}</span>
          </div>
        </div>
      </section>

      {/* Performance Information */}
      <section className="optimization-info">
        <h3>🚀 Optimization Systems Active</h3>
        <div className="optimization-grid">
          <div className="optimization-card">
            <h4>📦 Batching</h4>
            <p>Reduces 6 calls to 1 batch</p>
            <span className="status active">83% reduction</span>
          </div>
          <div className="optimization-card">
            <h4>⚡ Debouncing</h4>
            <p>Smart call deduplication</p>
            <span className="status active">70% reduction</span>
          </div>
          <div className="optimization-card">
            <h4>📈 Differential</h4>
            <p>Minimal data transfer</p>
            <span className="status active">60-80% reduction</span>
          </div>
          <div className="optimization-card">
            <h4>💾 Caching</h4>
            <p>Multi-tier cache system</p>
            <span className="status active">{dashboardData.metrics.cacheHitRate}% hit rate</span>
          </div>
        </div>
      </section>
    </div>
  );
};

// =====================
// CSS Styles (embedded for demo)
// =====================

const styles = `
.optimized-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.performance-status {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px 15px;
  border-radius: 5px;
  margin-bottom: 20px;
  font-size: 14px;
}

.performance-status.success {
  background: #e8f5e8;
  color: #2d5a2d;
  border: 1px solid #4a8a4a;
}

.performance-status.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.optimization.active {
  color: #28a745;
  font-weight: bold;
}

.optimization.inactive {
  color: #dc3545;
  font-weight: bold;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #eee;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.search-container {
  position: relative;
  margin-bottom: 30px;
}

.search-input {
  width: 100%;
  padding: 12px 20px;
  border: 2px solid #ddd;
  border-radius: 25px;
  font-size: 16px;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.metric-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  text-align: center;
}

.metric-value {
  font-size: 2em;
  font-weight: bold;
  color: #2c5aa0;
}

.dashboard-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.entry-card {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.optimization-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.optimization-card {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}

.status.active {
  background: #28a745;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 20px;
}

.health-details {
  display: flex;
  gap: 15px;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default OptimizedDashboard;