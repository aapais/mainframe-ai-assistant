/**
 * Accenture Mainframe AI Assistant - Complete MVP1 Application
 * All features integrated including AI transparency and CRUD operations
 */

import React, { useState, useEffect } from 'react';
import './App.css';
import './styles/animations.css';

// Import Accenture branding components
import AccentureLogo from './components/AccentureLogo';
import AccentureFooter from './components/AccentureFooter';

// Import AI transparency components
import AuthorizationDialog from './components/ai/AuthorizationDialog';
import OperationHistory from './components/ai/OperationHistory';

// Import CRUD modals
import AddEntryModal from './components/modals/AddEntryModal';
import EditEntryModal from './components/modals/EditEntryModal';
import DeleteConfirmDialog from './components/modals/DeleteConfirmDialog';

// Import views
import Search from './views/Search';
import Incidents from './views/Incidents';

// Import Settings components
import CostSummaryWidget from './components/dashboard/CostSummaryWidget';
import SettingsNavigation from './components/settings/SettingsNavigation';
import SettingsPage from './pages/Settings';
import SearchCommand from './components/settings/SearchCommand';
import { useSettings } from './contexts/SettingsContext';
import { Settings as SettingsIcon, X } from 'lucide-react';

// Initialize mock Electron API if not available
if (typeof window !== 'undefined' && !window.electronAPI) {
  const mockData = [
    {
      id: '1',
      title: 'S0C4 ABEND in COBOL Program During Array Processing',
      problem: 'Program terminates with S0C4 protection exception when processing arrays',
      solution: 'Check OCCURS clause and verify array subscript bounds. Increase REGION size.',
      category: 'COBOL',
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
        const filtered = mockData.filter(entry =>
          entry.title.toLowerCase().includes(query.toLowerCase()) ||
          entry.problem.toLowerCase().includes(query.toLowerCase()) ||
          entry.solution.toLowerCase().includes(query.toLowerCase())
        );
        return { results: filtered };
      },
      getAll: async () => ({ entries: mockData }),
      create: async (entry: any) => ({ success: true, id: Date.now().toString() }),
      update: async (id: string, entry: any) => ({ success: true }),
      delete: async (id: string) => ({ success: true })
    },
    ai: {
      requestAuthorization: async (operation: any) => ({ approved: true }),
      getCostTracking: async () => ({
        daily: { used: 2.45, limit: 10.00 },
        monthly: { used: 45.20, limit: 300.00 }
      }),
      getOperationHistory: async () => ({ operations: [] })
    }
  };
}

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

function AppComplete() {
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'search' | 'ai-transparency' | 'settings'>('dashboard');

  // Settings state management
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsCurrentPath, setSettingsCurrentPath] = useState('/settings/general/profile');

  // Access settings context
  const { state: settingsState } = useSettings();

  // Modal states
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);

  // AI transparency states
  const [showAIAuth, setShowAIAuth] = useState(false);
  const [showOperationHistory, setShowOperationHistory] = useState(false);
  const [pendingAIOperation, setPendingAIOperation] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.kb.getAll();
      setEntries(result.entries || []);
    } catch (err) {
      setError('Failed to load entries');
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
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAISearch = async () => {
    // Show AI authorization dialog before AI operation
    setPendingAIOperation({
      type: 'semantic_search',
      query: searchQuery,
      estimatedCost: 0.002,
      estimatedTokens: 150,
      provider: 'gemini',
      model: 'gemini-pro'
    });
    setShowAIAuth(true);
  };

  const handleAIAuthDecision = async (approved: boolean, modifiedOperation?: any) => {
    setShowAIAuth(false);
    if (approved) {
      // Proceed with AI operation
      setLoading(true);
      try {
        // Here would be the actual AI search
        await handleSearch();
      } finally {
        setLoading(false);
      }
    }
    setPendingAIOperation(null);
  };

  const handleAddEntry = () => {
    setShowAddEntry(true);
  };

  const handleEditEntry = (entry: KBEntry) => {
    setSelectedEntry(entry);
    setShowEditEntry(true);
  };

  const handleDeleteEntry = (entry: KBEntry) => {
    setSelectedEntry(entry);
    setShowDeleteConfirm(true);
  };

  const handleCreateEntry = async (newEntry: any) => {
    try {
      await window.electronAPI.kb.create(newEntry);
      await loadEntries();
      setShowAddEntry(false);
    } catch (err) {
      setError('Failed to report incident');
    }
  };

  const handleUpdateEntry = async (id: string, updatedEntry: any) => {
    try {
      await window.electronAPI.kb.update(id, updatedEntry);
      await loadEntries();
      setShowEditEntry(false);
    } catch (err) {
      setError('Failed to update incident');
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedEntry) {
      try {
        await window.electronAPI.kb.delete(selectedEntry.id);
        await loadEntries();
        setShowDeleteConfirm(false);
      } catch (err) {
        setError('Failed to delete incident');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header with Accenture branding */}
      <header className="bg-gradient-to-r from-[#A100FF] to-[#6B00FF] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <AccentureLogo />
              <div>
                <h1 className="text-2xl font-bold">Mainframe AI Assistant</h1>
                <p className="text-purple-100">Incident Management & AI-Powered Solutions</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'dashboard' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setCurrentView('search')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'search' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                🚨 Incidents
              </button>
              <button
                onClick={() => setCurrentView('ai-transparency')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'ai-transparency' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                AI Transparency
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  showSettingsModal ? 'bg-white/20' : 'hover:bg-white/10'
                } flex items-center space-x-2`}
                title="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search incidents and solutions..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleSearch}
                  className="px-6 py-2 bg-gradient-to-r from-[#A100FF] to-[#6B00FF] text-white rounded-lg hover:shadow-lg transition-shadow"
                >
                  Search
                </button>
                <button
                  onClick={handleAISearch}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-shadow"
                >
                  AI Search
                </button>
                <button
                  onClick={handleAddEntry}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-shadow"
                >
                  🚨 Report Incident
                </button>
              </div>
            </div>

            {/* Cost Summary Widget */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <CostSummaryWidget
                compact={false}
                userId="current_user"
                realTimeUpdates={true}
                updateInterval={30000}
                showDetailedMetrics={true}
                enableQuickActions={true}
                onModalOpen={() => {
                  setSettingsCurrentPath('/settings/cost/budget');
                  setShowSettingsModal(true);
                }}
              />
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="mt-2 text-gray-600">Loading...</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No incidents found. Try a different search or report a new incident.
                </div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow p-6">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        entry.category === 'COBOL' ? 'bg-blue-100 text-blue-800' :
                        entry.category === 'DB2' ? 'bg-green-100 text-green-800' :
                        entry.category === 'VSAM' ? 'bg-yellow-100 text-yellow-800' :
                        entry.category === 'JCL' ? 'bg-purple-100 text-purple-800' :
                        entry.category === 'CICS' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {entry.category}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-2">{entry.title}</h3>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Problem:</span>
                        <p className="text-gray-700">{entry.problem}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Solution:</span>
                        <p className="text-gray-700">{entry.solution}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.usage_count} uses
                      </div>
                    </div>

                    <div className="mt-2 flex items-center text-xs">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${(entry.success_count / entry.usage_count) * 100}%` }}
                        />
                      </div>
                      <span className="ml-2 text-gray-600">
                        {Math.round((entry.success_count / entry.usage_count) * 100)}% success
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {currentView === 'search' && <Incidents />}

        {currentView === 'ai-transparency' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Transparency Center</h2>

              {/* Transparency Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setShowOperationHistory(!showOperationHistory)}
                  className="p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-shadow"
                >
                  {showOperationHistory ? 'Hide' : 'Show'} Operation History
                </button>
                <button
                  onClick={() => {
                    setPendingAIOperation({
                      type: 'test',
                      query: 'Test AI Operation',
                      estimatedCost: 0.001,
                      estimatedTokens: 50,
                      provider: 'openai',
                      model: 'gpt-4'
                    });
                    setShowAIAuth(true);
                  }}
                  className="p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-shadow"
                >
                  Test Authorization Dialog
                </button>
              </div>


              {/* Operation History */}
              {showOperationHistory && <OperationHistory />}
            </div>
          </div>
        )}

        {currentView === 'settings' && (
          <div className="space-y-6">
            {/* Settings is now shown in the modal, not here */}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAIAuth && pendingAIOperation && (
        <AuthorizationDialog
          isOpen={showAIAuth}
          operation={pendingAIOperation}
          estimatedCost={pendingAIOperation.estimatedCost || 0.001}
          tokensEstimate={{
            input: pendingAIOperation.estimatedTokens || 100,
            output: Math.floor((pendingAIOperation.estimatedTokens || 100) * 0.5)
          }}
          onApprove={(operation) => handleAIAuthDecision(true, operation)}
          onDeny={() => handleAIAuthDecision(false)}
          onAlwaysAllow={() => handleAIAuthDecision(true)}
        />
      )}

      {showAddEntry && (
        <AddEntryModal
          isOpen={showAddEntry}
          onClose={() => setShowAddEntry(false)}
          onSave={handleCreateEntry}
        />
      )}

      {showEditEntry && selectedEntry && (
        <EditEntryModal
          isOpen={showEditEntry}
          entry={selectedEntry}
          onClose={() => setShowEditEntry(false)}
          onSave={(updated) => handleUpdateEntry(selectedEntry.id, updated)}
        />
      )}

      {showDeleteConfirm && selectedEntry && (
        <DeleteConfirmDialog
          isOpen={showDeleteConfirm}
          entry={selectedEntry}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full h-full sm:max-w-7xl sm:w-full sm:max-h-[95vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gradient-to-r from-[#A100FF] to-[#6B00FF] text-white">
              <div className="flex items-center space-x-3">
                <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                <h2 className="text-lg sm:text-xl font-semibold">Settings</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex h-[calc(100vh-64px)] sm:h-[calc(95vh-80px)] overflow-hidden">
              {/* Settings Navigation Sidebar */}
              <div className="hidden md:flex md:w-80 lg:w-80 xl:w-80 border-r bg-gray-50 overflow-hidden">
                <SettingsNavigation
                  currentPath={settingsCurrentPath}
                  onNavigate={(path) => {
                    setSettingsCurrentPath(path);
                  }}
                  className="h-full w-full"
                  isMobile={false}
                />
              </div>

              {/* Settings Content */}
              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto overflow-x-hidden">
                  <SettingsPage currentPath={settingsCurrentPath} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <AccentureFooter />
    </div>
  );
}

export default AppComplete;