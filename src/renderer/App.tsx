/**
 * Simplified Main Application Component for Mainframe KB Assistant MVP1
 * Emergency Week 2 version - simplified and functional
 */

import React, { useState, useEffect } from 'react';

// Initialize mock Electron API if not available
if (typeof window !== 'undefined' && !window.electronAPI) {
  const mockData = [
    {
      id: '1',
      title: 'S0C4 ABEND in COBOL Program During Array Processing',
      problem: 'Program terminates with S0C4 protection exception when processing arrays',
      solution: 'Check OCCURS clause and verify array subscript bounds. Increase REGION size.',
      category: 'ABEND',
      tags: ['cobol', 'array', 'abend'],
      usage_count: 45,
      success_count: 38,
      failure_count: 7
    },
    {
      id: '2',
      title: 'DB2 SQLCODE -818 Timestamp Mismatch',
      problem: 'Timestamp mismatch between DBRM and plan',
      solution: 'Rebind the package with current DBRM',
      category: 'DB2',
      tags: ['db2', 'sql', 'bind'],
      usage_count: 32,
      success_count: 28,
      failure_count: 4
    },
    {
      id: '3',
      title: 'VSAM File Status 93',
      problem: 'Record not available for read',
      solution: 'Check file status and record locks',
      category: 'VSAM',
      tags: ['vsam', 'file', 'io'],
      usage_count: 19,
      success_count: 15,
      failure_count: 4
    }
  ];

  (window as any).electronAPI = {
    kb: {
      search: async (query: string) => {
        await new Promise(r => setTimeout(r, 100));
        if (!query) return { results: mockData };
        const filtered = mockData.filter(e =>
          e.title.toLowerCase().includes(query.toLowerCase()) ||
          e.problem.toLowerCase().includes(query.toLowerCase())
        );
        return { results: filtered };
      },
      addEntry: async (data: any) => {
        await new Promise(r => setTimeout(r, 100));
        return { success: true };
      }
    }
  };
  console.log('📱 Mock Electron API initialized');
}
import { SimpleSearchBar } from './components/SimpleSearchBar';
import { SimpleEntryList } from './components/SimpleEntryList';
import { KeyboardProvider, useKeyboardShortcuts } from './contexts/KeyboardContext';
import { SimpleAddEntryForm, KeyboardHelp, preloadComponents, trackComponentLoad } from './components/LazyRegistry';
import { BundleAnalyzer } from './components/performance/BundleAnalyzer';
import { ElectronPreloader, usePreloader } from './utils/ElectronPreloader';
import { AccentureHeaderLogo } from './components/AccentureLogo';
import { AccentureFooter } from './components/AccentureFooter';
import './styles/keyboard-navigation.css';

interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags?: string[];
  usage_count?: number;
  success_count?: number;
  failure_count?: number;
  created_at?: string;
  score?: number;
}

/**
 * Internal App Component with keyboard shortcuts
 */
function AppContent() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Use Electron-optimized preloader
  const preloader = usePreloader();

  // Register keyboard shortcuts for the app
  useKeyboardShortcuts([
    {
      key: '/',
      description: 'Focus search input',
      action: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    },
    {
      key: 'n',
      ctrlKey: true,
      description: 'Add new entry',
      action: () => setShowAddForm(true)
    },
    {
      key: 'Escape',
      description: 'Close modals and clear selection',
      action: () => {
        if (showAddForm) {
          setShowAddForm(false);
        } else if (selectedEntry) {
          setSelectedEntry(null);
        }
      }
    },
    {
      key: 'r',
      ctrlKey: true,
      description: 'Refresh entries',
      action: () => {
        if (searchQuery) {
          handleSearch(searchQuery, entries);
        } else {
          loadAllEntries();
        }
      }
    }
  ], 'app');

  // Load initial entries on mount and setup optimized preloading
  useEffect(() => {
    loadAllEntries();

    // Use Electron-optimized preloading strategy
    const preloadTimer = setTimeout(() => {
      // Preload critical components with optimized timing
      ElectronPreloader.preloadComponent(
        'SimpleAddEntryForm',
        () => import('./components/SimpleAddEntryForm'),
        'medium'
      ).then(() => trackComponentLoad('SimpleAddEntryForm'));

      ElectronPreloader.preloadComponent(
        'KeyboardHelp',
        () => import('./components/KeyboardHelp'),
        'low'
      ).then(() => trackComponentLoad('KeyboardHelp'));

      // Preload metrics dashboard for power users
      ElectronPreloader.preloadComponent(
        'MetricsDashboard',
        () => import('./components/MetricsDashboard'),
        'low'
      ).then(() => trackComponentLoad('MetricsDashboard'));

    }, 1500); // Optimized timing for Electron

    return () => clearTimeout(preloadTimer);
  }, []);

  const loadAllEntries = async () => {
    setLoading(true);
    try {
      // Search with empty query to get all entries
      const response = await window.electronAPI.kb.search('');
      if (response.success !== false) {
        setEntries(response.results || response || []);
        setError(null);
      } else {
        setError(response.error || 'Failed to load entries');
      }
    } catch (err) {
      console.error('Failed to load entries:', err);
      setError('Failed to connect to knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string, results: KBEntry[]) => {
    setSearchQuery(query);
    setEntries(results);
    setSelectedEntry(null);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadAllEntries();
    setSelectedEntry(null);
  };

  const handleEntrySelect = (entry: KBEntry) => {
    setSelectedEntry(entry);
  };

  const handleAddEntry = async (entryData: Omit<KBEntry, 'id'>) => {
    try {
      const response = await window.electronAPI.kb.addEntry(entryData);
      if (response.success) {
        setShowAddForm(false);
        // Refresh the list
        if (searchQuery) {
          handleSearch(searchQuery, entries);
        } else {
          loadAllEntries();
        }
      } else {
        setError(response.error || 'Failed to add entry');
      }
    } catch (err) {
      console.error('Failed to add entry:', err);
      setError('Failed to add entry');
    }
  };

  // Accenture-branded styles
  const appStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    fontFamily: 'GT America, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderBottom: '2px solid #A100FF',
    padding: '1.5rem 2rem',
    boxShadow: '0 2px 8px 0 rgba(161, 0, 255, 0.1)',
  };

  const titleContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  };

  const brandingRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
  };

  const taglineStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: '0.025em',
  };

  const appTitleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#000000',
    margin: '0.5rem 0 0 0',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '1rem',
    color: '#6b7280',
    margin: 0,
    fontWeight: '400',
  };

  const mainStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: selectedEntry ? '1fr 400px' : '1fr',
    gap: '2rem',
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
    transition: 'grid-template-columns 0.3s ease',
  };

  const leftPanelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    minWidth: 0,
  };

  const rightPanelStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '1.5rem',
    height: 'fit-content',
    maxHeight: '80vh',
    overflow: 'auto',
    position: 'sticky',
    top: '2rem',
  };

  const errorStyle: React.CSSProperties = {
    padding: '1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    color: '#991b1b',
    textAlign: 'center',
  };

  const addButtonStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '2rem',
    right: '2rem',
    padding: '1rem',
    backgroundColor: '#A100FF',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '1.5rem',
    width: '64px',
    height: '64px',
    boxShadow: '0 8px 25px rgba(161, 0, 255, 0.3)',
    zIndex: 1000,
    transition: 'all 0.2s ease',
    fontFamily: 'GT America, sans-serif',
  };

  if (error && entries.length === 0) {
    return (
      <div style={appStyle}>
        <div style={headerStyle}>
          <h1 style={appTitleStyle}>📚 Knowledge Base Assistant</h1>
        </div>
        <div style={{ padding: '2rem' }}>
          <div style={errorStyle}>
            <h3>⚠️ Error</h3>
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                loadAllEntries();
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={appStyle}>
      {/* Header */}
      <header style={headerStyle} id="navigation">
        <div style={titleContainerStyle}>
          <div style={brandingRowStyle}>
            <AccentureHeaderLogo showTagline={false} />
            <div style={taglineStyle}>
              Let there be change
            </div>
          </div>

          <h1 style={appTitleStyle}>
            Mainframe AI Assistant
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '500',
              padding: '0.25rem 0.75rem',
              backgroundColor: '#f5e6ff',
              color: '#A100FF',
              borderRadius: '20px',
              marginLeft: '1rem',
              border: '1px solid #A100FF',
            }}>
              Enterprise Edition
            </span>
          </h1>

          <p style={subtitleStyle}>
            {searchQuery
              ? `${entries.length} results for "${searchQuery}"`
              : `${entries.length} knowledge base entries`
            }
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main style={mainStyle} id="main-content">
        {/* Left Panel - Search and Results */}
        <div style={leftPanelStyle}>
          <div id="search">
            <SimpleSearchBar
              onSearch={handleSearch}
              onClear={handleClearSearch}
              autoFocus
            />
          </div>

          {error && (
            <div style={errorStyle}>
              {error}
              <button
                onClick={() => setError(null)}
                style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem' }}
              >
                Dismiss
              </button>
            </div>
          )}

          <SimpleEntryList
            entries={entries}
            onEntrySelect={handleEntrySelect}
            selectedEntryId={selectedEntry?.id}
            loading={loading}
          />
        </div>

        {/* Right Panel - Entry Details */}
        {selectedEntry && (
          <aside style={rightPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <span style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: 'white',
                backgroundColor: '#A100FF',
                borderRadius: '4px',
              }}>
                {selectedEntry.category}
              </span>
              <button
                onClick={() => setSelectedEntry(null)}
                style={{
                  padding: '0.25rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                }}
              >
                ✕
              </button>
            </div>

            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
              {selectedEntry.title}
            </h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                Problem:
              </h4>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                fontSize: '0.875rem',
                lineHeight: '1.5',
              }}>
                {selectedEntry.problem}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                Solution:
              </h4>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
              }}>
                {selectedEntry.solution}
              </div>
            </div>

            {selectedEntry.tags && selectedEntry.tags.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                  Tags:
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {selectedEntry.tags.map(tag => (
                    <span key={tag} style={{
                      padding: '0.125rem 0.375rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      borderRadius: '12px',
                      border: '1px solid #d1d5db',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600' }}>
                Usage Statistics:
              </h4>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: '1.5' }}>
                <div>Used {selectedEntry.usage_count || 0} times</div>
                <div>Success: {selectedEntry.success_count || 0} | Failures: {selectedEntry.failure_count || 0}</div>
                <div>Success Rate: {
                  (selectedEntry.usage_count || 0) > 0
                    ? (((selectedEntry.success_count || 0) / (selectedEntry.usage_count || 1)) * 100).toFixed(1)
                    : 0
                }%</div>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Add Entry Button */}
      <button
        style={addButtonStyle}
        onClick={() => setShowAddForm(true)}
        onMouseEnter={() => {
          // Use Electron-optimized preloading on hover
          ElectronPreloader.preloadComponent(
            'SimpleAddEntryForm',
            () => import('./components/SimpleAddEntryForm'),
            'high'
          ).catch(console.warn);
        }}
        title="Add new knowledge entry"
      >
        +
      </button>

      {/* Add Entry Modal */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '1rem',
        }} onClick={() => setShowAddForm(false)}>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <SimpleAddEntryForm
              onSubmit={handleAddEntry}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {/* Development Tools */}
      <BundleAnalyzer />

      {/* Accenture Footer */}
      <AccentureFooter />
    </div>
  );
}

/**
 * Main App Component with Keyboard Provider
 */
function App() {
  return (
    <KeyboardProvider
      enableSkipLinks={true}
      skipLinks={[
        { href: '#main-content', text: 'Skip to main content' },
        { href: '#search', text: 'Skip to search' },
        { href: '#navigation', text: 'Skip to navigation' }
      ]}
    >
      <AppContent />
      <KeyboardHelp />
    </KeyboardProvider>
  );
}

// Hot Module Replacement support for development
if (import.meta.hot) {
  import.meta.hot.accept();
}

export default App;