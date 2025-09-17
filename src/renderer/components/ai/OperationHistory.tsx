import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Download, Filter, Calendar, Clock, DollarSign,
  CheckCircle, XCircle, AlertCircle, Eye, ChevronDown, ChevronUp,
  RefreshCw, FileDown, Zap, Settings
} from 'lucide-react';
import {
  OperationHistoryProps,
  AIOperation,
  AIProvider,
  AIOperationType,
  UserDecision,
  ExportData
} from '../../types/ai';

interface OperationHistoryState {
  operations: AIOperation[];
  filteredOperations: AIOperation[];
  isLoading: boolean;
  error: string | null;
  filters: {
    search: string;
    provider: AIProvider | 'all';
    operationType: AIOperationType | 'all';
    userDecision: UserDecision | 'all';
    dateRange: {
      start: string;
      end: string;
    };
  };
  sortBy: keyof AIOperation;
  sortOrder: 'asc' | 'desc';
  showFilters: boolean;
  selectedOperation: AIOperation | null;
  currentPage: number;
  itemsPerPage: number;
  totalOperations: number;
}

const OperationHistory: React.FC<OperationHistoryProps> = ({
  userId,
  maxResults = 100,
  showFilters = true,
  allowExport = true,
  onOperationSelect,
}) => {
  const [state, setState] = useState<OperationHistoryState>({
    operations: [],
    filteredOperations: [],
    isLoading: true,
    error: null,
    filters: {
      search: '',
      provider: 'all',
      operationType: 'all',
      userDecision: 'all',
      dateRange: {
        start: '',
        end: '',
      },
    },
    sortBy: 'createdAt',
    sortOrder: 'desc',
    showFilters: false,
    selectedOperation: null,
    currentPage: 1,
    itemsPerPage: 25,
    totalOperations: 0,
  });

  // Mock API call - replace with actual service
  const fetchOperations = useCallback(async () => {
    // Mock implementation - replace with actual API call
    const mockOperations: AIOperation[] = Array.from({ length: 150 }, (_, i) => ({
      id: `op_${i + 1}`,
      operationType: ['search', 'generation', 'analysis', 'chat', 'completion'][Math.floor(Math.random() * 5)] as AIOperationType,
      provider: ['openai', 'claude', 'gemini', 'local'][Math.floor(Math.random() * 4)] as AIProvider,
      model: 'gpt-3.5-turbo',
      queryText: `Sample query ${i + 1} - This is a mock query for testing purposes.`,
      purpose: `Testing purpose ${i + 1}`,
      estimatedCost: Math.random() * 0.1,
      actualCost: Math.random() * 0.1,
      tokensInput: Math.floor(Math.random() * 1000) + 100,
      tokensOutput: Math.floor(Math.random() * 500) + 50,
      userDecision: ['approved', 'denied', 'modified', 'auto_approved'][Math.floor(Math.random() * 4)] as UserDecision,
      autoApproved: Math.random() > 0.7,
      timeoutOccurred: Math.random() > 0.9,
      responseText: i % 3 === 0 ? `Mock response for operation ${i + 1}` : undefined,
      responseQualityRating: Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : undefined,
      executionTimeMs: Math.floor(Math.random() * 5000) + 500,
      errorMessage: i % 10 === 0 ? 'Mock error message' : undefined,
      sessionId: `session_${Math.floor(i / 10) + 1}`,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: Math.random() > 0.1 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      userId,
    }));

    return mockOperations.slice(0, maxResults);
  }, [userId, maxResults]);

  const loadOperations = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const operations = await fetchOperations();
      setState(prev => ({
        ...prev,
        operations,
        filteredOperations: operations,
        isLoading: false,
        totalOperations: operations.length,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load operations',
        isLoading: false,
      }));
    }
  }, [fetchOperations]);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  // Filter and sort operations
  const filteredAndSortedOperations = useMemo(() => {
    let filtered = [...state.operations];

    // Apply filters
    if (state.filters.search) {
      const searchLower = state.filters.search.toLowerCase();
      filtered = filtered.filter(op =>
        op.queryText.toLowerCase().includes(searchLower) ||
        op.purpose.toLowerCase().includes(searchLower) ||
        op.model.toLowerCase().includes(searchLower) ||
        (op.responseText && op.responseText.toLowerCase().includes(searchLower))
      );
    }

    if (state.filters.provider !== 'all') {
      filtered = filtered.filter(op => op.provider === state.filters.provider);
    }

    if (state.filters.operationType !== 'all') {
      filtered = filtered.filter(op => op.operationType === state.filters.operationType);
    }

    if (state.filters.userDecision !== 'all') {
      filtered = filtered.filter(op => op.userDecision === state.filters.userDecision);
    }

    if (state.filters.dateRange.start) {
      filtered = filtered.filter(op =>
        new Date(op.createdAt) >= new Date(state.filters.dateRange.start)
      );
    }

    if (state.filters.dateRange.end) {
      filtered = filtered.filter(op =>
        new Date(op.createdAt) <= new Date(state.filters.dateRange.end)
      );
    }

    // Sort operations
    filtered.sort((a, b) => {
      const aValue = a[state.sortBy];
      const bValue = b[state.sortBy];

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return state.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [state.operations, state.filters, state.sortBy, state.sortOrder]);

  // Pagination
  const paginatedOperations = useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    return filteredAndSortedOperations.slice(startIndex, startIndex + state.itemsPerPage);
  }, [filteredAndSortedOperations, state.currentPage, state.itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedOperations.length / state.itemsPerPage);

  const updateFilter = useCallback((key: string, value: any) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
      currentPage: 1,
    }));
  }, []);

  const updateSort = useCallback((field: keyof AIOperation) => {
    setState(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const exportData = useCallback(async () => {
    const exportData: ExportData = {
      operations: filteredAndSortedOperations,
      budgets: [], // Would be fetched from API
      summary: {
        userId,
        totalOperations: filteredAndSortedOperations.length,
        approvedOperations: filteredAndSortedOperations.filter(op => op.userDecision === 'approved').length,
        deniedOperations: filteredAndSortedOperations.filter(op => op.userDecision === 'denied').length,
        totalCost: filteredAndSortedOperations.reduce((sum, op) => sum + (op.actualCost || op.estimatedCost), 0),
        avgCostPerOperation: 0, // Calculated in actual implementation
        totalInputTokens: filteredAndSortedOperations.reduce((sum, op) => sum + op.tokensInput, 0),
        totalOutputTokens: filteredAndSortedOperations.reduce((sum, op) => sum + op.tokensOutput, 0),
        avgExecutionTime: 0, // Calculated in actual implementation
        lastOperation: filteredAndSortedOperations[0]?.createdAt || new Date().toISOString(),
      },
      exportedAt: new Date().toISOString(),
      userId,
      filters: state.filters,
    };

    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-operations-${userId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredAndSortedOperations, userId, state.filters]);

  const exportCSV = useCallback(() => {
    const headers = [
      'ID', 'Created At', 'Operation Type', 'Provider', 'Model', 'Purpose',
      'User Decision', 'Estimated Cost', 'Actual Cost', 'Input Tokens', 'Output Tokens',
      'Execution Time (ms)', 'Auto Approved', 'Error Message'
    ];

    const rows = filteredAndSortedOperations.map(op => [
      op.id,
      op.createdAt,
      op.operationType,
      op.provider,
      op.model,
      op.purpose,
      op.userDecision,
      op.estimatedCost.toString(),
      (op.actualCost || '').toString(),
      op.tokensInput.toString(),
      op.tokensOutput.toString(),
      (op.executionTimeMs || '').toString(),
      op.autoApproved.toString(),
      op.errorMessage || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-operations-${userId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredAndSortedOperations, userId]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(amount);
  };

  const getDecisionIcon = (decision: UserDecision) => {
    switch (decision) {
      case 'approved':
      case 'auto_approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'modified':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getOperationTypeIcon = (operationType: AIOperationType) => {
    switch (operationType) {
      case 'search':
        return <Search className="w-4 h-4" />;
      case 'generation':
        return <Settings className="w-4 h-4" />;
      case 'analysis':
        return <Zap className="w-4 h-4" />;
      case 'chat':
        return <CheckCircle className="w-4 h-4" />;
      case 'completion':
        return <Settings className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (state.isLoading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 text-red-800 mb-2">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error loading operation history</span>
        </div>
        <p className="text-red-600 text-sm mb-3">{state.error}</p>
        <button
          onClick={loadOperations}
          className="text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>AI Operation History</span>
            <span className="text-sm text-gray-500">
              ({filteredAndSortedOperations.length} operations)
            </span>
          </h2>

          <div className="flex items-center space-x-2">
            {allowExport && (
              <div className="relative">
                <button
                  onClick={exportData}
                  className="flex items-center space-x-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Export JSON</span>
                </button>
              </div>
            )}

            {allowExport && (
              <button
                onClick={exportCSV}
                className="flex items-center space-x-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <FileDown className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            )}

            <button
              onClick={loadOperations}
              className="flex items-center space-x-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={state.isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${state.isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {showFilters && (
              <button
                onClick={() => setState(prev => ({ ...prev, showFilters: !prev.showFilters }))}
                className="flex items-center space-x-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {state.showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search operations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
            value={state.filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
        </div>

        {/* Filters */}
        {state.showFilters && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <select
              value={state.filters.provider}
              onChange={(e) => updateFilter('provider', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Providers</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="local">Local</option>
            </select>

            <select
              value={state.filters.operationType}
              onChange={(e) => updateFilter('operationType', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Types</option>
              <option value="search">Search</option>
              <option value="generation">Generation</option>
              <option value="analysis">Analysis</option>
              <option value="chat">Chat</option>
              <option value="completion">Completion</option>
            </select>

            <select
              value={state.filters.userDecision}
              onChange={(e) => updateFilter('userDecision', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Decisions</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="modified">Modified</option>
              <option value="auto_approved">Auto Approved</option>
            </select>

            <input
              type="date"
              value={state.filters.dateRange.start}
              onChange={(e) => updateFilter('dateRange', { ...state.filters.dateRange, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Start date"
            />

            <input
              type="date"
              value={state.filters.dateRange.end}
              onChange={(e) => updateFilter('dateRange', { ...state.filters.dateRange, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="End date"
            />
          </div>
        )}
      </div>

      {/* Operations Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => updateSort('createdAt')}
              >
                <div className="flex items-center space-x-1">
                  <span>Date</span>
                  {state.sortBy === 'createdAt' && (
                    state.sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Operation
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => updateSort('actualCost')}
              >
                <div className="flex items-center space-x-1">
                  <span>Cost</span>
                  {state.sortBy === 'actualCost' && (
                    state.sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Decision
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedOperations.map((operation) => (
              <tr key={operation.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div>{new Date(operation.createdAt).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(operation.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    {getOperationTypeIcon(operation.operationType)}
                    <div>
                      <div className="text-sm font-medium text-gray-900 capitalize">
                        {operation.operationType}
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {operation.purpose}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="capitalize">{operation.provider}</div>
                    <div className="text-xs text-gray-500">{operation.model}</div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-mono">
                      {formatCurrency(operation.actualCost || operation.estimatedCost)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {operation.tokensInput + operation.tokensOutput} tokens
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center space-x-1">
                    {getDecisionIcon(operation.userDecision)}
                    <span className="capitalize text-sm">
                      {operation.userDecision.replace('_', ' ')}
                    </span>
                  </div>
                  {operation.autoApproved && (
                    <div className="text-xs text-blue-600">Auto-approved</div>
                  )}
                  {operation.errorMessage && (
                    <div className="text-xs text-red-600">Error occurred</div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <button
                    onClick={() => {
                      setState(prev => ({ ...prev, selectedOperation: operation }));
                      onOperationSelect?.(operation);
                    }}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((state.currentPage - 1) * state.itemsPerPage) + 1} to{' '}
            {Math.min(state.currentPage * state.itemsPerPage, filteredAndSortedOperations.length)} of{' '}
            {filteredAndSortedOperations.length} operations
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setState(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
              disabled={state.currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setState(prev => ({ ...prev, currentPage: page }))}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      state.currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setState(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
              disabled={state.currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Operation Detail Modal */}
      {state.selectedOperation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Operation Details</h3>
                <button
                  onClick={() => setState(prev => ({ ...prev, selectedOperation: null }))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="font-medium text-gray-700">ID:</label>
                    <div className="font-mono">{state.selectedOperation.id}</div>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Created:</label>
                    <div>{new Date(state.selectedOperation.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Provider:</label>
                    <div className="capitalize">{state.selectedOperation.provider}</div>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Model:</label>
                    <div>{state.selectedOperation.model}</div>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Operation Type:</label>
                    <div className="capitalize">{state.selectedOperation.operationType}</div>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">User Decision:</label>
                    <div className="capitalize">{state.selectedOperation.userDecision.replace('_', ' ')}</div>
                  </div>
                </div>

                <div>
                  <label className="font-medium text-gray-700">Purpose:</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded">{state.selectedOperation.purpose}</div>
                </div>

                <div>
                  <label className="font-medium text-gray-700">Query:</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">{state.selectedOperation.queryText}</pre>
                  </div>
                </div>

                {state.selectedOperation.responseText && (
                  <div>
                    <label className="font-medium text-gray-700">Response:</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded max-h-32 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm">{state.selectedOperation.responseText}</pre>
                    </div>
                  </div>
                )}

                {state.selectedOperation.errorMessage && (
                  <div>
                    <label className="font-medium text-gray-700">Error:</label>
                    <div className="mt-1 p-3 bg-red-50 text-red-800 rounded">{state.selectedOperation.errorMessage}</div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <label className="font-medium text-gray-700">Estimated Cost:</label>
                    <div className="font-mono">{formatCurrency(state.selectedOperation.estimatedCost)}</div>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Actual Cost:</label>
                    <div className="font-mono">
                      {state.selectedOperation.actualCost ? formatCurrency(state.selectedOperation.actualCost) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Input Tokens:</label>
                    <div className="font-mono">{state.selectedOperation.tokensInput.toLocaleString()}</div>
                  </div>
                  <div>
                    <label className="font-medium text-gray-700">Output Tokens:</label>
                    <div className="font-mono">{state.selectedOperation.tokensOutput.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationHistory;

