import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface Decision {
  id: string;
  timestamp: string;
  operation: string;
  operationType: 'kb_query' | 'kb_create' | 'kb_update' | 'kb_delete' | 'analysis' | 'generation';
  decision: 'approved' | 'denied' | 'pending' | 'timeout';
  cost: number;
  duration: number;
  reason?: string;
  userPrompt?: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  metadata?: Record<string, any>;
}

interface DecisionHistoryProps {
  dateRange: {
    start: Date;
    end: Date;
  };
}

type SortField = 'timestamp' | 'operation' | 'decision' | 'cost' | 'duration';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'approved' | 'denied' | 'pending' | 'timeout';
type FilterOperation = 'all' | 'kb_query' | 'kb_create' | 'kb_update' | 'kb_delete' | 'analysis' | 'generation';

const DecisionHistory: React.FC<DecisionHistoryProps> = ({ dateRange }) => {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [operationFilter, setOperationFilter] = useState<FilterOperation>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const loadDecisions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await window.electron.ipcRenderer.invoke('dashboard:getDecisionHistory', {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        });

        setDecisions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load decision history');
        console.error('Decision history loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDecisions();

    // Set up real-time updates
    const unsubscribe = window.electron.ipcRenderer.on('dashboard:newDecision', (decision: Decision) => {
      setDecisions(prev => [decision, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [dateRange]);

  const filteredAndSortedDecisions = useMemo(() => {
    let filtered = decisions;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(decision =>
        decision.operation.toLowerCase().includes(search) ||
        decision.reason?.toLowerCase().includes(search) ||
        decision.userPrompt?.toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(decision => decision.decision === statusFilter);
    }

    // Apply operation filter
    if (operationFilter !== 'all') {
      filtered = filtered.filter(decision => decision.operationType === operationFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'timestamp') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [decisions, searchTerm, statusFilter, operationFilter, sortField, sortDirection]);

  const paginatedDecisions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedDecisions.slice(start, start + pageSize);
  }, [filteredAndSortedDecisions, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedDecisions.length / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'denied':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'timeout':
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'timeout':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'kb_query':
        return 'bg-blue-100 text-blue-800';
      case 'kb_create':
        return 'bg-green-100 text-green-800';
      case 'kb_update':
        return 'bg-yellow-100 text-yellow-800';
      case 'kb_delete':
        return 'bg-red-100 text-red-800';
      case 'analysis':
        return 'bg-purple-100 text-purple-800';
      case 'generation':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 bg-gray-200 rounded w-48"></div>
            <div className="flex space-x-2">
              <div className="h-8 bg-gray-200 rounded w-32"></div>
              <div className="h-8 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg border border-red-200">
        <div className="text-center text-red-600">
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
          <p className="font-semibold">Error loading decision history</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Decision History</h3>
            <p className="text-sm text-gray-600">
              Authorization decisions and operation details
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {filteredAndSortedDecisions.length} of {decisions.length} decisions
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search operations, reasons, or prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="pending">Pending</option>
            <option value="timeout">Timeout</option>
          </select>

          {/* Operation Filter */}
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value as FilterOperation)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="all">All Operations</option>
            <option value="kb_query">KB Query</option>
            <option value="kb_create">KB Create</option>
            <option value="kb_update">KB Update</option>
            <option value="kb_delete">KB Delete</option>
            <option value="analysis">Analysis</option>
            <option value="generation">Generation</option>
          </select>

          {/* Page Size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleSort('timestamp')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center space-x-1">
                  <span>Time</span>
                  {sortField === 'timestamp' && (
                    <span className="text-purple-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('operation')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center space-x-1">
                  <span>Operation</span>
                  {sortField === 'operation' && (
                    <span className="text-purple-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('decision')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center space-x-1">
                  <span>Decision</span>
                  {sortField === 'decision' && (
                    <span className="text-purple-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('cost')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center space-x-1">
                  <span>Cost</span>
                  {sortField === 'cost' && (
                    <span className="text-purple-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('duration')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center space-x-1">
                  <span>Duration</span>
                  {sortField === 'duration' && (
                    <span className="text-purple-600">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedDecisions.map((decision) => (
              <tr key={decision.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatTimestamp(decision.timestamp)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-900">
                      {decision.operation}
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOperationColor(decision.operationType)}`}>
                      {decision.operationType.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getDecisionIcon(decision.decision)}
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getDecisionColor(decision.decision)}`}>
                      {decision.decision.toUpperCase()}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(decision.cost)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDuration(decision.duration)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => setSelectedDecision(decision)}
                    className="text-purple-600 hover:text-purple-900 font-medium"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAndSortedDecisions.length)} of {filteredAndSortedDecisions.length} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Decision Details Modal */}
      {selectedDecision && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Decision Details</h3>
                <button
                  onClick={() => setSelectedDecision(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Timestamp</label>
                    <p className="text-sm text-gray-900">{formatTimestamp(selectedDecision.timestamp)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Decision</label>
                    <div className="flex items-center space-x-2 mt-1">
                      {getDecisionIcon(selectedDecision.decision)}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDecisionColor(selectedDecision.decision)}`}>
                        {selectedDecision.decision.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Operation</label>
                  <p className="text-sm text-gray-900">{selectedDecision.operation}</p>
                </div>

                {selectedDecision.reason && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Reason</label>
                    <p className="text-sm text-gray-900">{selectedDecision.reason}</p>
                  </div>
                )}

                {selectedDecision.userPrompt && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">User Prompt</label>
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-900 max-h-32 overflow-y-auto">
                      {selectedDecision.userPrompt}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Cost</label>
                    <p className="text-sm text-gray-900">{formatCurrency(selectedDecision.cost)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Duration</label>
                    <p className="text-sm text-gray-900">{formatDuration(selectedDecision.duration)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tokens</label>
                    <p className="text-sm text-gray-900">
                      {selectedDecision.tokens?.total?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                </div>

                {selectedDecision.tokens && (
                  <div className="bg-gray-50 p-3 rounded">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Token Breakdown</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Input:</span>
                        <span className="ml-2 text-gray-900">{selectedDecision.tokens.input?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Output:</span>
                        <span className="ml-2 text-gray-900">{selectedDecision.tokens.output?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total:</span>
                        <span className="ml-2 font-medium text-gray-900">{selectedDecision.tokens.total?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionHistory;