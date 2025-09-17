/**
 * Integrated Search CRUD Example
 * Demonstrates the complete integration of search results with CRUD operations
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Search, Settings, Filter, RefreshCw, BarChart3 } from 'lucide-react';
import { SearchResult, SearchOptions, KBEntry } from '../../../types/services';
import SearchResultsContainer from '../search/SearchResultsContainer';
import AddEntryModal from '../modals/AddEntryModal';
import EditEntryModal from '../modals/EditEntryModal';
import DeleteConfirmDialog from '../modals/DeleteConfirmDialog';

// Mock search service
const mockSearchService = {
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Return mock results based on query
    if (!query.trim()) return [];

    const mockResults: SearchResult[] = [
      {
        entry: {
          id: '1',
          title: 'DB2 SQL0904 - Resource Not Available Error',
          problem: 'SQL0904N Unsuccessful execution caused by an unavailable resource. Name: TABLESPACE, type: 2, reason: 3.',
          solution: '1. Check tablespace status using db2 list tablespaces\n2. Verify available disk space\n3. Restart DB2 if necessary\n4. Contact DBA if problem persists',
          category: 'DB2',
          severity: 'high',
          tags: ['sql-error', 'tablespace', 'resource-unavailable', 'db2'],
          created_at: new Date('2024-01-15'),
          updated_at: new Date('2024-01-20'),
          created_by: 'john.doe@accenture.com',
          usage_count: 45,
          success_count: 42,
          failure_count: 3,
          last_used: new Date('2024-01-25'),
          archived: false,
          confidence_score: 0.95
        },
        score: 95,
        matchType: 'exact',
        highlights: [
          { field: 'title', start: 4, end: 11, text: 'SQL0904' },
          { field: 'problem', start: 0, end: 7, text: 'SQL0904' }
        ],
        explanation: 'Direct match on error code SQL0904 found in title and problem description.',
        metadata: {
          source: 'database',
          processingTime: 12,
          confidence: 0.95,
          fallback: false
        }
      },
      {
        entry: {
          id: '2',
          title: 'JCL ABEND S322 - Time Limit Exceeded',
          problem: 'Job failed with ABEND S322 indicating that the CPU time limit was exceeded during execution.',
          solution: '1. Review TIME parameter in JOB statement\n2. Optimize program logic for better performance\n3. Contact operations to increase time limit if justified\n4. Check for infinite loops in the program',
          category: 'JCL',
          severity: 'medium',
          tags: ['abend', 's322', 'time-limit', 'performance', 'jcl'],
          created_at: new Date('2024-01-10'),
          updated_at: new Date('2024-01-18'),
          created_by: 'jane.smith@accenture.com',
          usage_count: 28,
          success_count: 25,
          failure_count: 3,
          last_used: new Date('2024-01-24'),
          archived: false,
          confidence_score: 0.89
        },
        score: 87,
        matchType: 'fuzzy',
        highlights: [
          { field: 'tags', start: 0, end: 5, text: 'abend' }
        ],
        explanation: 'Fuzzy match on related error handling patterns.',
        metadata: {
          source: 'database',
          processingTime: 8,
          confidence: 0.87,
          fallback: false
        }
      },
      {
        entry: {
          id: '3',
          title: 'CICS ASRA ABEND - Program Check',
          problem: 'CICS transaction terminated with ASRA abend due to program check (0C4 - Protection Exception).',
          solution: '1. Review program dump to identify failing instruction\n2. Check array bounds and pointer validity\n3. Verify working storage layout\n4. Recompile program with debugging options\n5. Test with smaller data sets',
          category: 'CICS',
          severity: 'critical',
          tags: ['asra', 'abend', '0c4', 'program-check', 'cics'],
          created_at: new Date('2024-01-12'),
          updated_at: new Date('2024-01-22'),
          created_by: 'mike.wilson@accenture.com',
          usage_count: 67,
          success_count: 61,
          failure_count: 6,
          last_used: new Date('2024-01-26'),
          archived: false,
          confidence_score: 0.91
        },
        score: 82,
        matchType: 'semantic',
        highlights: [
          { field: 'problem', start: 30, end: 35, text: 'abend' }
        ],
        explanation: 'Semantic match found related system error patterns.',
        metadata: {
          source: 'ai',
          processingTime: 45,
          confidence: 0.82,
          fallback: false
        }
      }
    ];

    // Filter results based on query
    return mockResults.filter(result =>
      result.entry.title.toLowerCase().includes(query.toLowerCase()) ||
      result.entry.problem.toLowerCase().includes(query.toLowerCase()) ||
      result.entry.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
  }
};

export const IntegratedSearchCRUDExample: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SearchOptions['sortBy']>('relevance');
  const [sortOrder, setSortOrder] = useState<SearchOptions['sortOrder']>('desc');
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contextualData, setContextualData] = useState<any>(null);

  // Search functionality
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return [];
    }

    setIsLoading(true);
    try {
      const searchResults = await mockSearchService.search(searchQuery, {
        sortBy,
        sortOrder,
        includeArchived: false,
        limit: 50
      });
      setResults(searchResults);
      return searchResults;
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, sortOrder]);

  // Handle search input
  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery);
    performSearch(newQuery);
  }, [performSearch]);

  // Handle entry selection
  const handleEntrySelect = useCallback((result: SearchResult) => {
    setSelectedEntry(result.entry);
    // Could open a detailed view modal here
    console.log('Selected entry:', result.entry);
  }, []);

  // Handle entry rating
  const handleEntryRate = useCallback(async (entryId: string, successful: boolean) => {
    console.log(`Rated entry ${entryId} as ${successful ? 'successful' : 'unsuccessful'}`);
    // Update local results optimistically
    setResults(prevResults =>
      prevResults.map(result => {
        if (result.entry.id === entryId) {
          const updatedEntry = {
            ...result.entry,
            usage_count: result.entry.usage_count + 1,
            success_count: successful
              ? result.entry.success_count + 1
              : result.entry.success_count,
            failure_count: successful
              ? result.entry.failure_count
              : result.entry.failure_count + 1
          };
          return { ...result, entry: updatedEntry };
        }
        return result;
      })
    );
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((newSortBy: SearchOptions['sortBy'], newSortOrder: SearchOptions['sortOrder']) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    // Re-search with new sort options
    if (query.trim()) {
      performSearch(query);
    }
  }, [query, performSearch]);

  // Handle add entry with context
  const handleAddEntry = useCallback((contextData?: any) => {
    setContextualData(contextData);
    setShowAddModal(true);
  }, []);

  // Handle refresh results
  const handleRefreshResults = useCallback(async (refreshQuery: string) => {
    return await mockSearchService.search(refreshQuery, {
      sortBy,
      sortOrder,
      includeArchived: false,
      limit: 50
    });
  }, [sortBy, sortOrder]);

  // Modal handlers
  const handleCreateEntry = useCallback(async (data: any) => {
    console.log('Creating entry:', data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setShowAddModal(false);
    setContextualData(null);
    // Refresh search results
    if (query.trim()) {
      performSearch(query);
    }
  }, [query, performSearch]);

  const handleUpdateEntry = useCallback(async (id: string, data: any) => {
    console.log('Updating entry:', id, data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setShowEditModal(false);
    setSelectedEntry(null);
    // Refresh search results
    if (query.trim()) {
      performSearch(query);
    }
  }, [query, performSearch]);

  const handleDeleteEntry = useCallback(async () => {
    if (!selectedEntry) return;
    console.log('Deleting entry:', selectedEntry.id);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setShowDeleteModal(false);
    setSelectedEntry(null);
    // Refresh search results
    if (query.trim()) {
      performSearch(query);
    }
  }, [selectedEntry, query, performSearch]);

  // Initial search on mount
  useEffect(() => {
    if (query.trim()) {
      performSearch(query);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Search className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Integrated Search & CRUD Demo
                </h1>
                <p className="text-sm text-gray-600">
                  Search with inline editing, bulk operations, and contextual add
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Interface */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search for mainframe solutions, error codes, or procedures..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => performSearch(query)}
                disabled={isLoading}
                className="p-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                title="Refresh search"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                className="p-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                title="Search settings"
              >
                <Settings className="h-5 w-5" />
              </button>

              <button
                className="p-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                title="Search analytics"
              >
                <BarChart3 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search Tips */}
          {!query.trim() && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Search Tips</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
                <div>• Try "SQL0904" for database errors</div>
                <div>• Use "ABEND S322" for JCL issues</div>
                <div>• Search "CICS ASRA" for transaction problems</div>
                <div>• Enter "DB2 performance" for tuning tips</div>
              </div>
            </div>
          )}
        </div>

        {/* Results Container */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <SearchResultsContainer
            initialResults={results}
            query={query}
            isLoading={isLoading}
            onEntrySelect={handleEntrySelect}
            onEntryRate={handleEntryRate}
            onSortChange={handleSortChange}
            onRefreshResults={handleRefreshResults}
            onAddEntry={handleAddEntry}
            sortBy={sortBy}
            sortOrder={sortOrder}
            enableBulkOperations={true}
            enableInlineEditing={true}
            enableContextualAdd={true}
            enableRealTimeUpdates={true}
            updateInterval={30000}
            contextualData={{
              category: query.toLowerCase().includes('db2') ? 'DB2' :
                       query.toLowerCase().includes('jcl') ? 'JCL' :
                       query.toLowerCase().includes('cics') ? 'CICS' : undefined,
              severity: query.toLowerCase().includes('critical') ? 'critical' :
                       query.toLowerCase().includes('abend') ? 'high' : undefined
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <AddEntryModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setContextualData(null);
        }}
        onSubmit={handleCreateEntry}
        initialData={contextualData}
        loading={false}
      />

      <EditEntryModal
        isOpen={showEditModal}
        entry={selectedEntry || undefined}
        onClose={() => {
          setShowEditModal(false);
          setSelectedEntry(null);
        }}
        onSubmit={handleUpdateEntry}
        loading={false}
      />

      <DeleteConfirmDialog
        isOpen={showDeleteModal}
        entry={selectedEntry || undefined}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedEntry(null);
        }}
        onConfirm={handleDeleteEntry}
        loading={false}
      />
    </div>
  );
};

export default IntegratedSearchCRUDExample;