/**
 * KB Route Components
 * Defines all route components optimized for Knowledge Base operations
 * Each route is designed for specific user workflows and maintains context
 */

import React, { useEffect, useState, Suspense } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useKBRouter, useSearchURL } from './KBRouter';
import { useSearch } from '../contexts/SearchContext';
import { useApp } from '../context/AppContext';

// Lazy load components for better performance
const SearchInterface = React.lazy(() => import('../components/search/SearchInterface'));
const SearchResults = React.lazy(() => import('../components/search/SearchResults'));
const KBEntryForm = React.lazy(() => import('../components/forms/KBEntryForm'));
const MetricsDashboard = React.lazy(() => import('../components/MetricsDashboard'));
const EntryDetailView = React.lazy(() => import('../components/EntryDetailView'));
const SearchHistory = React.lazy(() => import('../components/search/SearchHistory'));
const SettingsView = React.lazy(() => import('../components/SettingsView'));

// ========================
// Route Component Wrapper
// ========================

interface RouteWrapperProps {
  children: React.ReactNode;
  title?: string;
  preserveContext?: boolean;
}

const RouteWrapper: React.FC<RouteWrapperProps> = ({ 
  children, 
  title = 'KB Assistant',
  preserveContext = true 
}) => {
  useEffect(() => {
    document.title = `${title} - Mainframe Knowledge Base`;
  }, [title]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner message="Loading..." size="lg" />}>
        <div className="route-container" role="main">
          {children}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

// ========================
// Dashboard Route (/)
// ========================

const DashboardRoute: React.FC = () => {
  const { navigateToSearch } = useKBRouter();
  const { state } = useSearch();

  return (
    <RouteWrapper title="Dashboard">
      <div className="dashboard-route">
        <header className="dashboard-header">
          <h1>Knowledge Base Dashboard</h1>
          <p>Recent entries and quick access</p>
        </header>

        <div className="dashboard-content">
          {/* Quick Search */}
          <section className="quick-search">
            <SearchInterface
              onSearch={(query, options) => {
                navigateToSearch(query, options?.category);
              }}
              placeholder="Quick search..."
              showFilters={false}
            />
          </section>

          {/* Recent Results */}
          {state.results.length > 0 && (
            <section className="recent-entries">
              <h2>Recent Entries</h2>
              <SearchResults
                results={state.results.slice(0, 10)}
                query=""
                showPagination={false}
                compact={true}
              />
            </section>
          )}

          {/* Quick Actions */}
          <section className="quick-actions">
            <div className="action-grid">
              <button 
                className="action-card"
                onClick={() => navigateToSearch()}
              >
                <span className="icon">🔍</span>
                <span>Advanced Search</span>
              </button>
              
              <button 
                className="action-card"
                onClick={() => navigateToSearch('', 'JCL')}
              >
                <span className="icon">⚙️</span>
                <span>JCL Issues</span>
              </button>
              
              <button 
                className="action-card"
                onClick={() => navigateToSearch('', 'VSAM')}
              >
                <span className="icon">💾</span>
                <span>VSAM Problems</span>
              </button>
              
              <button 
                className="action-card"
                onClick={() => navigateToSearch('', 'DB2')}
              >
                <span className="icon">🗄️</span>
                <span>DB2 Errors</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </RouteWrapper>
  );
};

// ========================
// Search Route (/search/:query?)
// ========================

const SearchRoute: React.FC = () => {
  const { query } = useParams<{ query?: string }>();
  const location = useLocation();
  const { syncURLWithSearch } = useSearchURL();
  const { state, performSearch } = useSearch();
  const [isInitialized, setIsInitialized] = useState(false);

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlQuery = query ? decodeURIComponent(query) : params.get('q') || '';
    const category = params.get('category') as any;
    const useAI = params.get('ai') !== 'false';

    if (!isInitialized || urlQuery !== state.query) {
      if (urlQuery) {
        performSearch(urlQuery, { category, useAI });
      }
      setIsInitialized(true);
    }
  }, [query, location.search, state.query, performSearch, isInitialized]);

  // Sync URL with search state changes
  useEffect(() => {
    if (isInitialized) {
      syncURLWithSearch();
    }
  }, [state.query, state.filters, state.useAI, syncURLWithSearch, isInitialized]);

  return (
    <RouteWrapper title="Search">
      <div className="search-route">
        <SearchInterface />
        
        <div className="search-results-section">
          <SearchResults
            results={state.results}
            query={state.query}
            isLoading={state.isSearching}
            showPagination={true}
            onEntrySelect={(entry) => {
              // Navigation handled by SearchResults component
            }}
          />
        </div>
      </div>
    </RouteWrapper>
  );
};

// ========================
// Entry Detail Route (/entry/:id)
// ========================

const EntryRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { state: appState } = useApp();
  const { state: searchState } = useSearch();
  const { navigateBack, navigateToSearch } = useKBRouter();
  
  const [entry, setEntry] = useState(appState.selectedEntry);

  // Find entry if not in selected state
  useEffect(() => {
    if (id && !entry) {
      const foundEntry = searchState.results.find(r => r.entry.id === id)?.entry;
      if (foundEntry) {
        setEntry(foundEntry);
      }
    }
  }, [id, entry, searchState.results]);

  if (!entry) {
    return (
      <RouteWrapper title="Entry Not Found">
        <div className="entry-not-found">
          <h1>Entry Not Found</h1>
          <p>The requested knowledge base entry could not be found.</p>
          <button onClick={() => navigateToSearch()}>
            Return to Search
          </button>
        </div>
      </RouteWrapper>
    );
  }

  const params = new URLSearchParams(location.search);
  const returnQuery = params.get('return_query');
  const source = params.get('source');

  return (
    <RouteWrapper title={entry.title}>
      <div className="entry-route">
        <div className="entry-header">
          <button 
            className="back-button"
            onClick={() => {
              if (returnQuery) {
                navigateToSearch(returnQuery);
              } else {
                navigateBack();
              }
            }}
            aria-label="Go back"
          >
            ← Back {returnQuery ? 'to Search' : ''}
          </button>
          
          <div className="entry-meta">
            <span className="category-badge">{entry.category}</span>
            {source && <span className="source-badge">via {source}</span>}
          </div>
        </div>

        <EntryDetailView 
          entry={entry}
          showRelated={true}
          showActions={true}
        />
      </div>
    </RouteWrapper>
  );
};

// ========================
// Add Entry Route (/add)
// ========================

const AddEntryRoute: React.FC = () => {
  const location = useLocation();
  const { navigateToSearch, navigateBack } = useKBRouter();
  
  const params = new URLSearchParams(location.search);
  const category = params.get('category') as any;
  const relatedQuery = params.get('related_query');

  const prefilledData = {
    category: category || undefined,
    tags: relatedQuery ? [relatedQuery] : undefined,
  };

  return (
    <RouteWrapper title="Add New Entry">
      <div className="add-entry-route">
        <header className="add-entry-header">
          <button 
            className="back-button"
            onClick={navigateBack}
            aria-label="Go back"
          >
            ← Back
          </button>
          <h1>Add Knowledge Base Entry</h1>
        </header>

        <KBEntryForm
          mode="create"
          initialData={prefilledData}
          onSubmit={async (data) => {
            // Form handles submission
            // Navigate back to search after successful submission
            if (relatedQuery) {
              navigateToSearch(relatedQuery);
            } else {
              navigateToSearch();
            }
          }}
          onCancel={() => {
            if (relatedQuery) {
              navigateToSearch(relatedQuery);
            } else {
              navigateBack();
            }
          }}
        />
      </div>
    </RouteWrapper>
  );
};

// ========================
// Edit Entry Route (/entry/:id/edit)
// ========================

const EditEntryRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { state: appState } = useApp();
  const { state: searchState } = useSearch();
  const { navigateToEntry, navigateBack } = useKBRouter();
  
  const [entry, setEntry] = useState(appState.selectedEntry);

  useEffect(() => {
    if (id && !entry) {
      const foundEntry = searchState.results.find(r => r.entry.id === id)?.entry;
      if (foundEntry) {
        setEntry(foundEntry);
      }
    }
  }, [id, entry, searchState.results]);

  if (!entry) {
    return (
      <RouteWrapper title="Edit Entry">
        <div className="entry-not-found">
          <h1>Entry Not Found</h1>
          <p>Cannot edit - entry not found.</p>
          <button onClick={navigateBack}>Go Back</button>
        </div>
      </RouteWrapper>
    );
  }

  return (
    <RouteWrapper title={`Edit: ${entry.title}`}>
      <div className="edit-entry-route">
        <header className="edit-entry-header">
          <button 
            className="back-button"
            onClick={() => navigateToEntry(entry.id)}
            aria-label="Cancel editing"
          >
            ← Cancel
          </button>
          <h1>Edit Entry</h1>
        </header>

        <KBEntryForm
          mode="edit"
          initialData={entry}
          onSubmit={async (data) => {
            // Form handles submission
            // Navigate back to entry view
            navigateToEntry(entry.id);
          }}
          onCancel={() => navigateToEntry(entry.id)}
        />
      </div>
    </RouteWrapper>
  );
};

// ========================
// Metrics Route (/metrics)
// ========================

const MetricsRoute: React.FC = () => {
  const { navigateBack } = useKBRouter();

  return (
    <RouteWrapper title="Analytics">
      <div className="metrics-route">
        <MetricsDashboard 
          onClose={navigateBack}
          fullScreen={true}
        />
      </div>
    </RouteWrapper>
  );
};

// ========================
// Search History Route (/history)
// ========================

const HistoryRoute: React.FC = () => {
  const { navigateToSearch } = useKBRouter();

  return (
    <RouteWrapper title="Search History">
      <div className="history-route">
        <SearchHistory
          onSearchSelect={(query, category) => {
            navigateToSearch(query, category);
          }}
        />
      </div>
    </RouteWrapper>
  );
};

// ========================
// Settings Route (/settings)
// ========================

const SettingsRoute: React.FC = () => {
  return (
    <RouteWrapper title="Settings">
      <div className="settings-route">
        <SettingsView />
      </div>
    </RouteWrapper>
  );
};

// ========================
// Main Routes Component
// ========================

export const KBRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Dashboard */}
      <Route path="/" element={<DashboardRoute />} />
      
      {/* Search Routes */}
      <Route path="/search" element={<SearchRoute />} />
      <Route path="/search/:query" element={<SearchRoute />} />
      
      {/* Entry Routes */}
      <Route path="/entry/:id" element={<EntryRoute />} />
      <Route path="/entry/:id/edit" element={<EditEntryRoute />} />
      
      {/* Form Routes */}
      <Route path="/add" element={<AddEntryRoute />} />
      
      {/* Utility Routes */}
      <Route path="/metrics" element={<MetricsRoute />} />
      <Route path="/history" element={<HistoryRoute />} />
      <Route path="/settings" element={<SettingsRoute />} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ========================
// Route Guards
// ========================

export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  condition: boolean;
  fallback: React.ReactNode;
}> = ({ children, condition, fallback }) => {
  return condition ? <>{children}</> : <>{fallback}</>;
};

// ========================
// Route Performance Wrapper
// ========================

export const OptimizedRoute: React.FC<{
  children: React.ReactNode;
  preload?: boolean;
}> = ({ children, preload = false }) => {
  const [isVisible, setIsVisible] = useState(!preload);

  useEffect(() => {
    if (preload && !isVisible) {
      // Small delay to allow other critical rendering first
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [preload, isVisible]);

  if (!isVisible) {
    return <LoadingSpinner size="md" />;
  }

  return <>{children}</>;
};

export default KBRoutes;