/**
 * Knowledge Base Page - Main Application Page
 * 
 * This is the main page that combines all KB components with proper layout,
 * state management, and performance optimizations. It demonstrates:
 * - Optimal component composition and layout
 * - Context integration patterns
 * - Performance optimization techniques
 * - Responsive design principles
 * - Accessibility implementation
 * - Error handling and recovery
 * - Progressive enhancement
 * 
 * @author Frontend Integration Specialist
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useMemo, Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useKBData } from '../contexts/KBDataContext';
import { useSearch } from '../contexts/SearchContext';
import { useApp } from '../context/AppContext';
import { KBSearchBar } from '../components/kb/KBSearchBar';
import { KBEntryList } from '../components/kb/KBEntryList';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { KBEntry } from '../../types/services';

// Lazy load heavy components for better performance
const KBMetricsPanel = lazy(() => import('../components/KBMetricsPanel'));
const KBEntryForm = lazy(() => import('../components/forms/KBEntryForm'));

// =====================
// Types & Interfaces
// =====================

export interface KnowledgeBasePageProps {
  className?: string;
}

type ViewMode = 'search' | 'metrics' | 'add_entry' | 'edit_entry';

// =====================
// Error Fallback Component
// =====================

const ErrorFallback: React.FC<{ 
  error: Error; 
  resetErrorBoundary: () => void;
  title?: string;
}> = ({ error, resetErrorBoundary, title = "Something went wrong" }) => (
  <div
    style={{
      padding: '2rem',
      margin: '1rem',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      backgroundColor: '#fef2f2',
      color: '#991b1b',
      textAlign: 'center',
    }}
    role="alert"
  >
    <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
      ⚠️ {title}
    </h2>
    <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem' }}>
      {error.message}
    </p>
    <button
      onClick={resetErrorBoundary}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.875rem',
      }}
    >
      Try Again
    </button>
  </div>
);

// =====================
// Header Component
// =====================

const PageHeader: React.FC<{
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  entriesCount: number;
  searchResultsCount: number;
}> = ({ currentView, onViewChange, entriesCount, searchResultsCount }) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.5rem 2rem',
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}
      role="banner"
    >
      {/* Title Section */}
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: '2rem',
            fontWeight: '700',
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📚 Knowledge Base Assistant
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: '500',
              padding: '0.25rem 0.5rem',
              backgroundColor: '#dbeafe',
              color: '#1d4ed8',
              borderRadius: '4px',
            }}
          >
            MVP1
          </span>
        </h1>
        <p
          style={{
            margin: '0.5rem 0 0 0',
            fontSize: '1rem',
            color: '#6b7280',
          }}
        >
          {searchResultsCount > 0 && searchResultsCount !== entriesCount
            ? `${searchResultsCount} of ${entriesCount} entries`
            : `${entriesCount} knowledge base entries`
          }
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={() => onViewChange('metrics')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            border: `1px solid ${currentView === 'metrics' ? '#3b82f6' : '#d1d5db'}`,
            backgroundColor: currentView === 'metrics' ? '#eff6ff' : 'white',
            color: currentView === 'metrics' ? '#1d4ed8' : '#374151',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s ease',
          }}
          aria-pressed={currentView === 'metrics'}
        >
          📊 Metrics
        </button>

        <button
          onClick={() => onViewChange('add_entry')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            border: 'none',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            transition: 'all 0.2s ease',
          }}
          aria-label="Add new knowledge entry"
        >
          ➕ Add Entry
        </button>
      </div>
    </header>
  );
};

// =====================
// Quick Stats Component
// =====================

const QuickStats: React.FC = React.memo(() => {
  const { state: kbState } = useKBData();
  const { state: searchState } = useSearch();

  const stats = useMemo(() => {
    const entries = Array.from(kbState.entries.values());
    const totalUsage = entries.reduce((sum, entry) => sum + entry.usage_count, 0);
    const successfulEntries = entries.filter(entry => entry.success_count > entry.failure_count);
    
    return {
      totalEntries: entries.length,
      totalUsage,
      successfulEntries: successfulEntries.length,
      cacheHitRate: searchState.cacheStats.hitRate,
    };
  }, [kbState.entries, searchState.cacheStats]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        padding: '1rem 2rem',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
          {stats.totalEntries}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
          Total Entries
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669' }}>
          {stats.totalUsage}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
          Total Usage
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
          {((stats.successfulEntries / stats.totalEntries) * 100 || 0).toFixed(0)}%
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
          Success Rate
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
          {(stats.cacheHitRate * 100).toFixed(0)}%
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>
          Cache Hit Rate
        </div>
      </div>
    </div>
  );
});

QuickStats.displayName = 'QuickStats';

// =====================
// Main Layout Component
// =====================

const MainLayout: React.FC<{
  currentView: ViewMode;
  selectedEntry: KBEntry | null;
  onEntrySelect: (entry: KBEntry) => void;
  onEntryRate: (entryId: string, successful: boolean) => void;
  onViewChange: (view: ViewMode) => void;
}> = ({ currentView, selectedEntry, onEntrySelect, onEntryRate, onViewChange }) => {
  const { state: searchState } = useSearch();

  return (
    <main
      style={{
        display: 'grid',
        gridTemplateColumns: selectedEntry ? '1fr 400px' : '1fr',
        gap: '1rem',
        padding: '2rem',
        backgroundColor: '#f9fafb',
        minHeight: 'calc(100vh - 200px)',
        transition: 'grid-template-columns 0.3s ease',
      }}
      role="main"
    >
      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
        {/* Search Bar */}
        {currentView === 'search' && (
          <ErrorBoundary
            FallbackComponent={(props) => <ErrorFallback {...props} title="Search Error" />}
            resetKeys={[searchState.query]}
          >
            <KBSearchBar
              autoFocus
              showFilters
              showHistory
              showSuggestions
              onSearchStart={(query) => console.log('Search started:', query)}
              onSearchComplete={(results, query) => console.log('Search completed:', results.length, 'results for', query)}
              onError={(error) => console.error('Search error:', error)}
            />
          </ErrorBoundary>
        )}

        {/* Entry List */}
        {currentView === 'search' && (
          <ErrorBoundary
            FallbackComponent={(props) => <ErrorFallback {...props} title="Entry List Error" />}
            resetKeys={[searchState.results]}
          >
            <KBEntryList
              onEntrySelect={onEntrySelect}
              onEntryRate={onEntryRate}
              selectedEntryId={selectedEntry?.id}
              showUsageStats
              showCategories
              enableVirtualization={searchState.results.length > 50}
            />
          </ErrorBoundary>
        )}

        {/* Metrics Panel */}
        {currentView === 'metrics' && (
          <ErrorBoundary
            FallbackComponent={(props) => <ErrorFallback {...props} title="Metrics Error" />}
          >
            <Suspense fallback={<LoadingIndicator message="Loading metrics..." />}>
              <KBMetricsPanel
                onClose={() => onViewChange('search')}
                showAdvanced
                refreshInterval={30000}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>

      {/* Entry Detail Sidebar */}
      {selectedEntry && currentView === 'search' && (
        <aside
          style={{
            padding: '1.5rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
          role="complementary"
          aria-label="Entry details"
        >
          {/* Entry Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: 'white',
                backgroundColor: '#3b82f6',
                borderRadius: '4px',
                flexShrink: 0,
              }}
            >
              {selectedEntry.category}
            </span>
            <button
              onClick={() => onEntrySelect(null as any)}
              style={{
                marginLeft: 'auto',
                padding: '0.25rem',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#6b7280',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              aria-label="Close entry details"
            >
              ✕
            </button>
          </div>

          {/* Entry Content */}
          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
              {selectedEntry.title}
            </h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                Problem:
              </h4>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#4b5563',
                  lineHeight: '1.5',
                  padding: '0.75rem',
                  backgroundColor: '#fef2f2',
                  borderRadius: '4px',
                  border: '1px solid #fecaca',
                }}
              >
                {selectedEntry.problem}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                Solution:
              </h4>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#4b5563',
                  lineHeight: '1.5',
                  padding: '0.75rem',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '4px',
                  border: '1px solid #bbf7d0',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedEntry.solution}
              </div>
            </div>

            {/* Tags */}
            {selectedEntry.tags && selectedEntry.tags.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                  Tags:
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {selectedEntry.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.125rem 0.375rem',
                        fontSize: '0.75rem',
                        color: '#374151',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '12px',
                        border: '1px solid #d1d5db',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Stats */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '4px',
                border: '1px solid #e5e7eb',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                Usage Statistics:
              </h4>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: '1.5' }}>
                <div>Used {selectedEntry.usage_count} times</div>
                <div>Success: {selectedEntry.success_count} | Failures: {selectedEntry.failure_count}</div>
                <div>Success Rate: {
                  selectedEntry.usage_count > 0 
                    ? ((selectedEntry.success_count / selectedEntry.usage_count) * 100).toFixed(1)
                    : 0
                }%</div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </main>
  );
};

// =====================
// Main Knowledge Base Page Component
// =====================

export const KnowledgeBasePage: React.FC<KnowledgeBasePageProps> = ({ className = '' }) => {
  // Context hooks
  const { state: kbState, refreshEntries } = useKBData();
  const { state: searchState, resetSearch } = useSearch();
  const { addNotification } = useApp();

  // Local state
  const [currentView, setCurrentView] = useState<ViewMode>('search');
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // =====================
  // Event Handlers
  // =====================

  const handleViewChange = useCallback((view: ViewMode) => {
    setCurrentView(view);
    
    // Clear selection when changing views
    if (view !== 'search') {
      setSelectedEntry(null);
    }
    
    // Reset search when going to metrics
    if (view === 'metrics') {
      resetSearch();
    }
  }, [resetSearch]);

  const handleEntrySelect = useCallback((entry: KBEntry | null) => {
    setSelectedEntry(entry);
  }, []);

  const handleEntryRate = useCallback(async (entryId: string, successful: boolean) => {
    try {
      // The rating is handled by the KBEntryList component through context
      addNotification({
        type: 'success',
        message: successful ? 'Thank you for the positive feedback!' : 'Thanks for the feedback. We\'ll work on improving this entry.',
        duration: 3000,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to record feedback. Please try again.',
        duration: 5000,
      });
    }
  }, [addNotification]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refreshEntries();
      addNotification({
        type: 'success',
        message: 'Knowledge base refreshed successfully',
        duration: 3000,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to refresh knowledge base',
        duration: 5000,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshEntries, addNotification]);

  // =====================
  // Computed Values
  // =====================

  const entriesCount = kbState.totalEntries;
  const searchResultsCount = searchState.results.length;

  // =====================
  // Effects
  // =====================

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Global shortcuts
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 'k': // Cmd/Ctrl + K - Focus search
            event.preventDefault();
            if (currentView !== 'search') {
              setCurrentView('search');
            }
            // Focus search input
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
            searchInput?.focus();
            break;
          case 'm': // Cmd/Ctrl + M - Open metrics
            event.preventDefault();
            handleViewChange(currentView === 'metrics' ? 'search' : 'metrics');
            break;
          case 'n': // Cmd/Ctrl + N - New entry
            event.preventDefault();
            handleViewChange('add_entry');
            break;
          case 'r': // Cmd/Ctrl + R - Refresh
            event.preventDefault();
            handleRefresh();
            break;
        }
      }
      
      // Escape key - Close modals/selections
      if (event.key === 'Escape') {
        if (selectedEntry) {
          setSelectedEntry(null);
        } else if (currentView !== 'search') {
          setCurrentView('search');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, selectedEntry, handleViewChange, handleRefresh]);

  // =====================
  // Render
  // =====================

  return (
    <div 
      className={`knowledge-base-page ${className}`}
      style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}
    >
      {/* Page Header */}
      <PageHeader
        currentView={currentView}
        onViewChange={handleViewChange}
        entriesCount={entriesCount}
        searchResultsCount={searchResultsCount}
      />

      {/* Quick Stats */}
      <ErrorBoundary
        FallbackComponent={(props) => <ErrorFallback {...props} title="Stats Error" />}
      >
        <QuickStats />
      </ErrorBoundary>

      {/* Main Content */}
      <ErrorBoundary
        FallbackComponent={(props) => <ErrorFallback {...props} title="Page Error" />}
        onError={(error, errorInfo) => {
          console.error('Page Error:', error, errorInfo);
          addNotification({
            type: 'error',
            message: 'A page error occurred. Some features may not work properly.',
            duration: 10000,
          });
        }}
      >
        <MainLayout
          currentView={currentView}
          selectedEntry={selectedEntry}
          onEntrySelect={handleEntrySelect}
          onEntryRate={handleEntryRate}
          onViewChange={handleViewChange}
        />
      </ErrorBoundary>

      {/* Add Entry Modal */}
      {currentView === 'add_entry' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => handleViewChange('search')}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ErrorBoundary
              FallbackComponent={(props) => <ErrorFallback {...props} title="Form Error" />}
            >
              <Suspense fallback={<LoadingIndicator message="Loading form..." />}>
                <KBEntryForm
                  mode="create"
                  onSubmit={async (data) => {
                    // Handle form submission through context
                    console.log('Form submitted:', data);
                    handleViewChange('search');
                  }}
                  onCancel={() => handleViewChange('search')}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* Refresh Indicator */}
      {isRefreshing && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <LoadingIndicator size="sm" />
          Refreshing...
        </div>
      )}
    </div>
  );
};

export default KnowledgeBasePage;