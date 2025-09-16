/**
 * IPC Usage Examples
 * Demonstrates how to use the IPC bridge and React hooks
 */

import React, { useEffect, useState } from 'react';
import { 
  IPCProvider, 
  IPCErrorBoundary, 
  useIPC, 
  useKnowledgeBase, 
  useSearch, 
  useMetrics 
} from '../hooks';
import type { KBEntryInput } from '../../types';

/**
 * Example App Component showing IPC integration
 */
function ExampleApp() {
  return (
    <IPCProvider>
      <IPCErrorBoundary
        fallback={(error) => (
          <div className="error-fallback">
            <h3>IPC Communication Error</h3>
            <p>{error.message}</p>
            <button onClick={() => window.location.reload()}>Reload App</button>
          </div>
        )}
      >
        <MainContent />
      </IPCErrorBoundary>
    </IPCProvider>
  );
}

/**
 * Main content component using all hooks
 */
function MainContent() {
  // IPC Context
  const ipc = useIPC();
  
  // Knowledge Base hook
  const kb = useKnowledgeBase({
    autoLoad: true,
    optimisticUpdates: true
  });
  
  // Search hook
  const search = useSearch({
    enableAI: true,
    autoSearch: false,
    debounceMs: 300,
    fallbackToLocal: true
  });
  
  // Metrics hook
  const metrics = useMetrics({
    autoRefresh: true,
    refreshInterval: 30
  });

  // Handle search
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      await search.searchWithAI(query);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  // Handle add entry
  const handleAddEntry = async () => {
    const newEntry: KBEntryInput = {
      title: 'Example Problem',
      problem: 'This is an example problem description',
      solution: 'This is the solution to the problem',
      category: 'Other',
      tags: ['example', 'test']
    };

    try {
      const id = await kb.addEntry(newEntry);
      console.log('Entry added with ID:', id);
    } catch (error) {
      console.error('Failed to add entry:', error);
    }
  };

  // Handle rate entry
  const handleRateEntry = async (entryId: string, successful: boolean) => {
    try {
      await kb.rateEntry(entryId, successful, 'Test rating');
      console.log('Entry rated successfully');
    } catch (error) {
      console.error('Failed to rate entry:', error);
    }
  };

  return (
    <div className="example-app">
      <h1>IPC Example App</h1>
      
      {/* Connection Status */}
      <ConnectionStatus />
      
      {/* Search Section */}
      <SearchSection search={search} onSearch={handleSearch} />
      
      {/* Knowledge Base Section */}
      <KnowledgeBaseSection kb={kb} onAddEntry={handleAddEntry} onRateEntry={handleRateEntry} />
      
      {/* Metrics Section */}
      <MetricsSection metrics={metrics} />
      
      {/* IPC Status */}
      <IPCStatus ipc={ipc} />
    </div>
  );
}

/**
 * Connection Status Component
 */
function ConnectionStatus() {
  const { isConnected, isOnline, connectionError, aiServiceAvailable, databaseConnected } = useIPC();

  return (
    <div className="connection-status">
      <h2>Connection Status</h2>
      <div className="status-grid">
        <div className={`status-item ${isConnected ? 'connected' : 'disconnected'}`}>
          <span>IPC: {isConnected ? '✅' : '❌'}</span>
        </div>
        <div className={`status-item ${isOnline ? 'online' : 'offline'}`}>
          <span>Network: {isOnline ? '🌐' : '📶'}</span>
        </div>
        <div className={`status-item ${aiServiceAvailable ? 'available' : 'unavailable'}`}>
          <span>AI Service: {aiServiceAvailable ? '🤖' : '🚫'}</span>
        </div>
        <div className={`status-item ${databaseConnected ? 'connected' : 'disconnected'}`}>
          <span>Database: {databaseConnected ? '💾' : '❌'}</span>
        </div>
      </div>
      {connectionError && (
        <div className="error-message">
          Error: {connectionError}
        </div>
      )}
    </div>
  );
}

/**
 * Search Section Component
 */
function SearchSection({ search, onSearch }: { 
  search: ReturnType<typeof useSearch>; 
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <div className="search-section">
      <h2>Search</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search knowledge base..."
          disabled={search.isSearching}
        />
        <button type="submit" disabled={search.isSearching}>
          {search.isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {search.error && (
        <div className="error-message">
          Search Error: {search.error}
          <button onClick={search.retryLastSearch}>Retry</button>
        </div>
      )}
      
      {search.hasResults && (
        <div className="search-results">
          <h3>Results ({search.resultCount})</h3>
          <p>Search Type: {search.searchType}</p>
          <p>Search Time: {search.searchTime.toFixed(0)}ms</p>
          
          {search.topResults.map(result => (
            <div key={result.entry.id} className="search-result">
              <h4>{result.entry.title}</h4>
              <p>Score: {result.score.toFixed(1)}%</p>
              <p>Category: {result.entry.category}</p>
              <p>Match Type: {result.matchType}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Knowledge Base Section Component
 */
function KnowledgeBaseSection({ 
  kb, 
  onAddEntry, 
  onRateEntry 
}: { 
  kb: ReturnType<typeof useKnowledgeBase>;
  onAddEntry: () => void;
  onRateEntry: (id: string, successful: boolean) => void;
}) {
  return (
    <div className="knowledge-base-section">
      <h2>Knowledge Base</h2>
      
      <div className="kb-actions">
        <button onClick={onAddEntry} disabled={kb.isLoading}>
          {kb.isLoading ? 'Adding...' : 'Add Test Entry'}
        </button>
        <button onClick={kb.refreshEntries} disabled={kb.isLoading}>
          Refresh
        </button>
      </div>
      
      {kb.isOptimistic && (
        <div className="optimistic-indicator">
          🔄 Optimistic update in progress...
        </div>
      )}
      
      {kb.error && (
        <div className="error-message">
          KB Error: {kb.error}
          <button onClick={kb.retryLastOperation}>Retry</button>
          <button onClick={kb.clearError}>Dismiss</button>
        </div>
      )}
      
      <div className="kb-entries">
        <h3>Recent Entries ({kb.entries.length})</h3>
        {kb.entries.slice(0, 5).map(result => (
          <div key={result.entry.id} className="kb-entry">
            <h4>{result.entry.title}</h4>
            <p>Category: {result.entry.category}</p>
            <p>Usage: {result.entry.usage_count} times</p>
            <p>Success Rate: {
              result.entry.usage_count > 0 
                ? ((result.entry.success_count / result.entry.usage_count) * 100).toFixed(1)
                : 0
            }%</p>
            <div className="entry-actions">
              <button 
                onClick={() => onRateEntry(result.entry.id, true)}
                disabled={kb.isLoading}
              >
                👍 Helpful
              </button>
              <button 
                onClick={() => onRateEntry(result.entry.id, false)}
                disabled={kb.isLoading}
              >
                👎 Not Helpful
              </button>
              <button 
                onClick={() => kb.selectEntry(result.entry.id)}
                disabled={kb.isLoading}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {kb.selectedEntry && (
        <div className="selected-entry">
          <h3>Selected Entry</h3>
          <h4>{kb.selectedEntry.title}</h4>
          <div className="entry-details">
            <p><strong>Problem:</strong> {kb.selectedEntry.problem}</p>
            <p><strong>Solution:</strong> {kb.selectedEntry.solution}</p>
            <p><strong>Tags:</strong> {kb.selectedEntry.tags?.join(', ') || 'None'}</p>
          </div>
          <button onClick={kb.clearSelection}>Close</button>
        </div>
      )}
    </div>
  );
}

/**
 * Metrics Section Component
 */
function MetricsSection({ metrics }: { metrics: ReturnType<typeof useMetrics> }) {
  const healthStatus = metrics.getHealthStatus();
  const insights = metrics.getPerformanceInsights();

  return (
    <div className="metrics-section">
      <h2>System Metrics</h2>
      
      <div className="metrics-status">
        <span className={`health-status ${healthStatus}`}>
          Health: {healthStatus.toUpperCase()}
        </span>
        {metrics.isDataStale() && (
          <span className="stale-indicator">⚠️ Data may be stale</span>
        )}
      </div>
      
      {metrics.error && (
        <div className="error-message">
          Metrics Error: {metrics.error}
          <button onClick={metrics.retryLastOperation}>Retry</button>
        </div>
      )}
      
      {metrics.metrics && (
        <div className="metrics-grid">
          <div className="metric">
            <label>Total Entries:</label>
            <span>{metrics.metrics.total_entries}</span>
          </div>
          <div className="metric">
            <label>Searches Today:</label>
            <span>{metrics.metrics.searches_today}</span>
          </div>
          <div className="metric">
            <label>Avg Response Time:</label>
            <span>{metrics.metrics.avg_response_time}ms</span>
          </div>
          <div className="metric">
            <label>Cache Hit Rate:</label>
            <span>{metrics.metrics.cache_hit_rate.toFixed(1)}%</span>
          </div>
          <div className="metric">
            <label>Storage Used:</label>
            <span>{metrics.metrics.storage_used_mb.toFixed(1)}MB</span>
          </div>
          <div className="metric">
            <label>Performance Score:</label>
            <span>{metrics.metrics.performance_score.toFixed(1)}/100</span>
          </div>
          <div className="metric">
            <label>Success Rate:</label>
            <span>{metrics.metrics.success_rate.toFixed(1)}%</span>
          </div>
        </div>
      )}
      
      {insights.length > 0 && (
        <div className="performance-insights">
          <h3>Performance Insights</h3>
          <ul>
            {insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="metrics-actions">
        <button onClick={metrics.refreshMetrics} disabled={metrics.isLoading}>
          Refresh Metrics
        </button>
        <button 
          onClick={() => metrics.isAutoRefreshing ? metrics.stopAutoRefresh() : metrics.startAutoRefresh()}
        >
          {metrics.isAutoRefreshing ? 'Stop Auto-refresh' : 'Start Auto-refresh'}
        </button>
      </div>
    </div>
  );
}

/**
 * IPC Status Component
 */
function IPCStatus({ ipc }: { ipc: ReturnType<typeof useIPC> }) {
  return (
    <div className="ipc-status">
      <h2>IPC Status</h2>
      
      <div className="ipc-info">
        <p>App Version: {ipc.appVersion}</p>
        <p>Theme: {ipc.theme}</p>
        <p>Pending Operations: {ipc.pendingOperations}</p>
        <p>Global Loading: {ipc.globalLoading ? 'Yes' : 'No'}</p>
      </div>
      
      <div className="performance-metrics">
        <h3>Performance</h3>
        <p>Average Latency: {ipc.ipcPerformance.averageLatency.toFixed(2)}ms</p>
        <p>Error Rate: {(ipc.ipcPerformance.errorRate * 100).toFixed(1)}%</p>
        <p>Cache Hit Rate: {(ipc.ipcPerformance.cacheHitRate * 100).toFixed(1)}%</p>
      </div>
      
      {ipc.errors.length > 0 && (
        <div className="error-list">
          <h3>Recent Errors</h3>
          {ipc.errors.slice(-3).map(error => (
            <div key={error.timestamp.getTime()} className="error-item">
              <p><strong>{error.type}:</strong> {error.message}</p>
              <p><small>{error.timestamp.toLocaleTimeString()}</small></p>
              <button onClick={() => ipc.removeError(error.timestamp.getTime().toString())}>
                Dismiss
              </button>
            </div>
          ))}
          <button onClick={ipc.clearErrors}>Clear All</button>
        </div>
      )}
      
      <div className="ipc-actions">
        <button onClick={ipc.performHealthCheck} disabled={ipc.globalLoading}>
          Health Check
        </button>
        <button onClick={ipc.reconnect} disabled={ipc.globalLoading}>
          Reconnect
        </button>
        <button onClick={ipc.toggleTheme}>
          Toggle Theme
        </button>
      </div>
    </div>
  );
}

export default ExampleApp;