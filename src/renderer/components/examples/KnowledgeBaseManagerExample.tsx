/**
 * Knowledge Base Manager Example
 * Demonstrates how to use all CRUD modals together with proper integration
 */

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, SortAsc, MoreVertical, Edit, Trash2, Archive, Copy, History, FileText, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { KBEntry } from '../../../backend/core/interfaces/ServiceInterfaces';
import { useKnowledgeBaseModals } from '../../hooks/useKnowledgeBaseModals';
import { knowledgeBaseService } from '../../services/KnowledgeBaseService';

// Import the modal components
import AddEntryModal from '../modals/AddEntryModal';
import EditEntryModal from '../modals/EditEntryModal';
import DeleteConfirmDialog from '../modals/DeleteConfirmDialog';

// Mock data for demonstration
const mockEntries: KBEntry[] = [
  {
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
  {
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
  {
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
  }
];

// Notification component
const NotificationCard: React.FC<{
  notification: any;
  onRemove: (id: string) => void;
}> = ({ notification, onRemove }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success': return CheckCircle;
      case 'error': return AlertCircle;
      case 'warning': return AlertCircle;
      case 'info': return Info;
      default: return Info;
    }
  };

  const getColorClasses = () => {
    switch (notification.type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const Icon = getIcon();

  return (
    <div className={`rounded-lg border p-4 ${getColorClasses()}`}>
      <div className="flex items-start">
        <Icon className="h-5 w-5 mt-0.5 mr-3" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{notification.title}</h4>
          <p className="text-sm mt-1">{notification.message}</p>
        </div>
        <button
          onClick={() => onRemove(notification.id)}
          className="ml-3 hover:opacity-70 focus:outline-none"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// Entry card component
const EntryCard: React.FC<{
  entry: KBEntry;
  onEdit: (entry: KBEntry) => void;
  onDelete: (entry: KBEntry) => void;
  onDuplicate: (entry: KBEntry) => void;
  onViewHistory: (entry: KBEntry) => void;
}> = ({ entry, onEdit, onDelete, onDuplicate, onViewHistory }) => {
  const [showActions, setShowActions] = useState(false);

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const successRate = entry.usage_count > 0 ? Math.round((entry.success_count / entry.usage_count) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">{entry.title}</h3>
            <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(entry.severity)}`}>
              {entry.severity}
            </span>
          </div>

          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{entry.problem}</p>

          <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
            <span className="flex items-center">
              <FileText className="h-3 w-3 mr-1" />
              {entry.category}
            </span>
            <span>Usage: {entry.usage_count}</span>
            <span>Success: {successRate}%</span>
            <span>Updated: {new Date(entry.updated_at).toLocaleDateString()}</span>
          </div>

          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.tags.slice(0, 4).map(tag => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                  {tag}
                </span>
              ))}
              {entry.tags.length > 4 && (
                <span className="text-xs text-gray-500">+{entry.tags.length - 4} more</span>
              )}
            </div>
          )}
        </div>

        <div className="relative ml-4">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>

          {showActions && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <div className="py-1">
                <button
                  onClick={() => {
                    onEdit(entry);
                    setShowActions(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Entry
                </button>
                <button
                  onClick={() => {
                    onDuplicate(entry);
                    setShowActions(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    onViewHistory(entry);
                    setShowActions(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <History className="h-4 w-4 mr-2" />
                  View History
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => {
                    onDelete(entry);
                    setShowActions(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Entry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main component
export const KnowledgeBaseManagerExample: React.FC = () => {
  const [entries, setEntries] = useState<KBEntry[]>(mockEntries);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState('date');

  // Use the knowledge base modals hook
  const {
    modals,
    loading,
    currentEntry,
    notifications,
    openAddEntryModal,
    openEditEntryModal,
    openDeleteConfirmModal,
    openEntryHistoryModal,
    closeModals,
    createEntry,
    updateEntry,
    deleteEntry,
    archiveEntry,
    duplicateEntry,
    removeNotification,
    handleError
  } = useKnowledgeBaseModals();

  // Filter and sort entries
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entry.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entry.solution.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || entry.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      case 'usage':
        return b.usage_count - a.usage_count;
      case 'title':
        return a.title.localeCompare(b.title);
      case 'success':
        const successRateA = a.usage_count > 0 ? (a.success_count / a.usage_count) : 0;
        const successRateB = b.usage_count > 0 ? (b.success_count / b.usage_count) : 0;
        return successRateB - successRateA;
      default:
        return 0;
    }
  });

  // Handle refresh after operations
  const refreshEntries = async () => {
    try {
      // In a real app, this would fetch from the backend
      // For now, we'll just simulate the refresh
      console.log('Refreshing entries...');
    } catch (error) {
      handleError(error as Error, 'refresh entries');
    }
  };

  // Handle successful operations
  const handleOperationSuccess = () => {
    refreshEntries();
    closeModals();
  };

  const categories = ['JCL', 'COBOL', 'DB2', 'VSAM', 'CICS', 'IMS', 'TSO', 'ISPF', 'Utilities', 'Security', 'Performance', 'Other'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Mainframe Knowledge Base</h1>
                <p className="text-sm text-gray-600">Accenture Technology Solutions</p>
              </div>
            </div>
            <button
              onClick={openAddEntryModal}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {notifications.map(notification => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onRemove={removeNotification}
            />
          ))}
        </div>
      )}

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entries by title, problem, or solution..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <SortAsc className="h-4 w-4 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="date">Sort by Date</option>
                  <option value="usage">Sort by Usage</option>
                  <option value="title">Sort by Title</option>
                  <option value="success">Sort by Success Rate</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
            <div className="text-sm text-gray-600">Total Entries</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(entries.reduce((sum, entry) => sum + (entry.success_count / entry.usage_count || 0), 0) / entries.length * 100)}%
            </div>
            <div className="text-sm text-gray-600">Avg Success Rate</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">
              {entries.reduce((sum, entry) => sum + entry.usage_count, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Usage</div>
          </div>
        </div>

        {/* Entries Grid */}
        <div className="space-y-4">
          {sortedEntries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No entries found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || filterCategory
                  ? 'Try adjusting your search criteria or filters.'
                  : 'Get started by creating your first knowledge base entry.'
                }
              </p>
              {!searchQuery && !filterCategory && (
                <button
                  onClick={openAddEntryModal}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Entry
                </button>
              )}
            </div>
          ) : (
            sortedEntries.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={openEditEntryModal}
                onDelete={openDeleteConfirmModal}
                onDuplicate={duplicateEntry}
                onViewHistory={openEntryHistoryModal}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <AddEntryModal
        isOpen={modals.addEntry}
        onClose={closeModals}
        onSubmit={createEntry}
        onError={handleError}
        loading={loading.creating}
      />

      <EditEntryModal
        isOpen={modals.editEntry}
        entry={currentEntry || undefined}
        onClose={closeModals}
        onSubmit={updateEntry}
        onError={handleError}
        onArchive={archiveEntry}
        onDuplicate={duplicateEntry}
        onViewHistory={openEntryHistoryModal}
        loading={loading.updating}
        archiving={loading.archiving}
        duplicating={loading.duplicating}
      />

      <DeleteConfirmDialog
        isOpen={modals.deleteConfirm}
        entry={currentEntry || undefined}
        onClose={closeModals}
        onConfirm={deleteEntry}
        onArchiveInstead={archiveEntry}
        loading={loading.deleting}
        archiving={loading.archiving}
      />
    </div>
  );
};

export default KnowledgeBaseManagerExample;