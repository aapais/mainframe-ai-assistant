/**
 * Fast Loading Optimized App - Minimal Bundle for Quick Startup
 */

import React, { useState, useEffect } from 'react';
// import { BarChart3 } from 'lucide-react'; // Disabled - not installed
const BarChart3 = () => <span>📊</span>;
// Using existing UnifiedSearch with HIVE improvements
import UnifiedSearch from './components/search/UnifiedSearch';
import { NotificationProvider } from './components/common/SimpleNotificationProvider';

// Simplified mock data for fast initialization
const initializeElectronAPI = () => {
  if (typeof window === 'undefined' || window.electronAPI) return;

  const mockData = [
    {
      id: '1',
      title: 'S0C4 ABEND in COBOL Program',
      problem: 'Protection exception during array access',
      solution: 'Check array bounds and subscript values',
      category: 'COBOL',
      tags: ['cobol', 'abend', 'array'],
      usage_count: 42,
      success_count: 38,
      failure_count: 4
    }
  ];

  (window as any).electronAPI = {
    kb: {
      search: async (query: string) => {
        await new Promise(r => setTimeout(r, 50)); // Faster mock response
        if (!query) return { results: mockData };
        const filtered = mockData.filter(entry =>
          entry.title.toLowerCase().includes(query.toLowerCase())
        );
        return { results: filtered };
      },
      getAll: async () => ({ entries: mockData }),
    },
    ai: {
      requestAuthorization: async () => ({ approved: true }),
      getCostTracking: async () => ({
        daily: { used: 2.45, limit: 10.00 },
        monthly: { used: 45.20, limit: 300.00 }
      })
    }
  };
};

interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  usage_count: number;
  success_count: number;
  failure_count: number;
}

const FastApp: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize fast
  useEffect(() => {
    initializeElectronAPI();
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.kb.getAll();
      setEntries(result.entries || []);
    } catch (err) {
      console.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadEntries();
      return;
    }

    setLoading(true);
    try {
      const result = await window.electronAPI.kb.search(searchQuery);
      setEntries(result.results || []);
    } catch (err) {
      console.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAISearch = async () => {
    // Simplified AI search - no authorization dialog for speed
    await handleSearch();
  };

  return (
    <NotificationProvider>
    <div className="min-h-screen bg-gray-50" lang="en">
      {/* Simplified Header */}
      <header className="bg-purple-600 text-white shadow-sm" role="banner">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                <span className="text-sm font-bold">A</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Mainframe AI Assistant</h1>
                <p className="text-purple-100 text-sm">Fast Dashboard</p>
              </div>
            </div>

            {/* Minimal Navigation */}
            <nav className="flex items-center space-x-2" role="navigation">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded transition-colors flex items-center space-x-2 ${
                  currentView === 'dashboard' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setCurrentView('search')}
                className={`px-3 py-2 rounded transition-colors ${
                  currentView === 'search' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                Search
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6" data-view={currentView}>
        {currentView === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

            {/* Optimized Search - Main Feature */}
            <div className="mb-8">
              <UnifiedSearch
                onSearch={(query, useAI) => {
                  setSearchQuery(query);
                  if (useAI) {
                    handleAISearch();
                  } else {
                    handleSearch();
                  }
                }}
                loading={loading}
                autoFocus={true}
              />
            </div>

            {/* Simple Results */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">
                Results {searchQuery && `for "${searchQuery}"`}
              </h3>

              {loading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : entries.length > 0 ? (
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <div key={entry.id} className="border-l-4 border-purple-500 pl-4">
                      <h4 className="font-medium text-gray-900">{entry.title}</h4>
                      <p className="text-gray-600 text-sm mt-1">{entry.problem}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">{entry.category}</span>
                        <span>Used {entry.usage_count} times</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No results found.</p>
              )}
            </div>
          </div>
        )}

        {currentView === 'search' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Search</h2>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-600">Advanced search features coming soon...</p>
            </div>
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="bg-gray-100 border-t mt-12" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-center text-sm text-gray-600">
            © 2024 Accenture. Mainframe AI Assistant - Fast Mode
          </p>
        </div>
      </footer>
    </div>
    </NotificationProvider>
  );
};

export default FastApp;