/**
 * BulkOperations Component
 * Provides bulk operations toolbar for multi-selected search results
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Trash2,
  Archive,
  Tag,
  Copy,
  Download,
  Eye,
  EyeOff,
  Star,
  StarOff,
  MoreHorizontal,
  X,
  Check,
  AlertTriangle,
  Package,
  Share,
  FileText,
  BarChart3,
  RefreshCw,
  Filter,
  ArrowRight
} from 'lucide-react';
import { KBEntry } from '../../../types/services';

interface BulkOperationsProps {
  selectedEntries: KBEntry[];
  totalCount: number;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onBulkDelete?: (entryIds: string[]) => Promise<void>;
  onBulkArchive?: (entryIds: string[], archive: boolean) => Promise<void>;
  onBulkTag?: (entryIds: string[], tags: string[]) => Promise<void>;
  onBulkDuplicate?: (entryIds: string[]) => Promise<void>;
  onBulkExport?: (entryIds: string[], format: 'pdf' | 'csv' | 'json') => Promise<void>;
  onBulkUpdateSeverity?: (entryIds: string[], severity: string) => Promise<void>;
  onBulkUpdateCategory?: (entryIds: string[], category: string) => Promise<void>;
  onBulkShare?: (entryIds: string[]) => void;
  onRefreshResults?: () => void;
  className?: string;
}

interface BulkActionConfig {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  onClick: () => void;
  destructive?: boolean;
  requiresConfirm?: boolean;
  confirmMessage?: string;
  disabled?: boolean;
  tooltip?: string;
  badge?: string | number;
}

export const BulkOperations: React.FC<BulkOperationsProps> = ({
  selectedEntries,
  totalCount,
  onClearSelection,
  onSelectAll,
  onBulkDelete,
  onBulkArchive,
  onBulkTag,
  onBulkDuplicate,
  onBulkExport,
  onBulkUpdateSeverity,
  onBulkUpdateCategory,
  onBulkShare,
  onRefreshResults,
  className = ''
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [newSeverity, setNewSeverity] = useState('medium');
  const [newCategory, setNewCategory] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedIds = useMemo(() => selectedEntries.map(entry => entry.id), [selectedEntries]);
  const allSelected = selectedEntries.length === totalCount && totalCount > 0;
  const someSelected = selectedEntries.length > 0;

  // Calculate selection statistics
  const selectionStats = useMemo(() => {
    const categories = new Map<string, number>();
    const severities = new Map<string, number>();
    let archivedCount = 0;

    selectedEntries.forEach(entry => {
      // Categories
      const category = entry.category || 'Unknown';
      categories.set(category, (categories.get(category) || 0) + 1);

      // Severities
      const severity = entry.severity || 'medium';
      severities.set(severity, (severities.get(severity) || 0) + 1);

      // Archived count
      if (entry.archived) archivedCount++;
    });

    return {
      categories: Array.from(categories.entries()).sort((a, b) => b[1] - a[1]),
      severities: Array.from(severities.entries()).sort((a, b) => b[1] - a[1]),
      archivedCount,
      activeCount: selectedEntries.length - archivedCount
    };
  }, [selectedEntries]);

  // Handle bulk action with confirmation
  const handleBulkAction = useCallback(async (
    actionKey: string,
    action: () => Promise<void>,
    requiresConfirm = false,
    confirmMessage = ''
  ) => {
    if (requiresConfirm && confirmAction !== actionKey) {
      setConfirmAction(actionKey);
      return;
    }

    setIsProcessing(true);
    try {
      await action();
      setConfirmAction(null);
    } catch (error) {
      console.error(`Bulk action ${actionKey} failed:`, error);
    } finally {
      setIsProcessing(false);
    }
  }, [confirmAction]);

  // Handle bulk tagging
  const handleBulkTag = useCallback(async () => {
    if (!bulkTagInput.trim() || !onBulkTag) return;

    const tags = bulkTagInput.split(',').map(tag => tag.trim()).filter(Boolean);
    await handleBulkAction('tag', () => onBulkTag(selectedIds, tags));
    setBulkTagInput('');
    setShowTagInput(false);
  }, [bulkTagInput, onBulkTag, selectedIds, handleBulkAction]);

  // Define primary bulk actions
  const primaryActions: BulkActionConfig[] = [
    {
      key: 'archive',
      label: selectionStats.archivedCount === selectedEntries.length ? 'Unarchive' : 'Archive',
      icon: Archive,
      onClick: () => handleBulkAction(
        'archive',
        () => onBulkArchive!(selectedIds, selectionStats.archivedCount !== selectedEntries.length),
        true,
        `${selectionStats.archivedCount === selectedEntries.length ? 'Unarchive' : 'Archive'} ${selectedEntries.length} entries?`
      ),
      disabled: !onBulkArchive,
      requiresConfirm: true,
      tooltip: selectionStats.archivedCount === selectedEntries.length ? 'Restore from archive' : 'Move to archive'
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      onClick: () => handleBulkAction('duplicate', () => onBulkDuplicate!(selectedIds)),
      disabled: !onBulkDuplicate,
      tooltip: 'Create copies of selected entries'
    },
    {
      key: 'export',
      label: 'Export',
      icon: Download,
      onClick: () => handleBulkAction('export', () => onBulkExport!(selectedIds, exportFormat)),
      disabled: !onBulkExport,
      tooltip: `Export as ${exportFormat.toUpperCase()}`
    },
    {
      key: 'tag',
      label: 'Add Tags',
      icon: Tag,
      onClick: () => setShowTagInput(!showTagInput),
      disabled: !onBulkTag,
      tooltip: 'Add tags to selected entries'
    }
  ];

  // Define secondary bulk actions
  const secondaryActions: BulkActionConfig[] = [
    {
      key: 'share',
      label: 'Share',
      icon: Share,
      onClick: () => onBulkShare?.(selectedIds),
      disabled: !onBulkShare,
      tooltip: 'Share selected entries'
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: () => handleBulkAction(
        'delete',
        () => onBulkDelete!(selectedIds),
        true,
        `Permanently delete ${selectedEntries.length} entries? This cannot be undone.`
      ),
      destructive: true,
      disabled: !onBulkDelete,
      requiresConfirm: true,
      tooltip: 'Permanently delete selected entries'
    }
  ];

  if (!someSelected) {
    return null;
  }

  return (
    <div className={`bg-white border-b border-gray-200 shadow-sm ${className}`}>
      <div className="px-4 py-3">
        {/* Main Toolbar */}
        <div className="flex items-center justify-between">
          {/* Selection Info */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={allSelected ? onClearSelection : onSelectAll}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  aria-label={allSelected ? 'Deselect all' : 'Select all'}
                />
                <span className="text-sm font-medium text-gray-900">
                  {selectedEntries.length} selected
                </span>
              </div>

              {selectedEntries.length < totalCount && (
                <button
                  onClick={onSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Select all {totalCount}
                </button>
              )}
            </div>

            {/* Selection Stats */}
            <div className="hidden sm:flex items-center space-x-4 text-xs text-gray-500">
              {selectionStats.categories.length > 0 && (
                <span>
                  Categories: {selectionStats.categories.slice(0, 2).map(([cat, count]) => `${cat} (${count})`).join(', ')}
                  {selectionStats.categories.length > 2 && ` +${selectionStats.categories.length - 2} more`}
                </span>
              )}
              {selectionStats.archivedCount > 0 && (
                <span className="flex items-center">
                  <Archive className="h-3 w-3 mr-1" />
                  {selectionStats.archivedCount} archived
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Primary Actions */}
            {primaryActions.filter(action => !action.disabled).slice(0, 3).map((action) => (
              <button
                key={action.key}
                onClick={action.onClick}
                disabled={isProcessing || action.disabled}
                className={`
                  inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${action.destructive
                    ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                    : 'text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }
                `}
                title={action.tooltip}
              >
                <action.icon className="h-4 w-4 mr-2" />
                {action.label}
              </button>
            ))}

            {/* More Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md"
                title="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {showAdvanced && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <div className="py-1">
                    {secondaryActions.filter(action => !action.disabled).map((action) => (
                      <button
                        key={action.key}
                        onClick={action.onClick}
                        disabled={isProcessing}
                        className={`
                          flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors
                          ${action.destructive ? 'text-red-700 hover:bg-red-50' : 'text-gray-700'}
                        `}
                      >
                        <action.icon className="h-4 w-4 mr-3" />
                        {action.label}
                      </button>
                    ))}

                    {/* Export Format Selector */}
                    {onBulkExport && (
                      <div className="px-3 py-2 border-t border-gray-100">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Export Format
                        </label>
                        <select
                          value={exportFormat}
                          onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'csv' | 'json')}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="pdf">PDF</option>
                          <option value="csv">CSV</option>
                          <option value="json">JSON</option>
                        </select>
                      </div>
                    )}

                    {/* Bulk Category Update */}
                    {onBulkUpdateCategory && (
                      <div className="px-3 py-2 border-t border-gray-100">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Change Category
                        </label>
                        <div className="flex space-x-1">
                          <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="New category"
                            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                          />
                          <button
                            onClick={() => handleBulkAction('category', () => onBulkUpdateCategory(selectedIds, newCategory))}
                            disabled={!newCategory.trim() || isProcessing}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bulk Severity Update */}
                    {onBulkUpdateSeverity && (
                      <div className="px-3 py-2 border-t border-gray-100">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Change Severity
                        </label>
                        <div className="flex space-x-1">
                          <select
                            value={newSeverity}
                            onChange={(e) => setNewSeverity(e.target.value)}
                            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                          <button
                            onClick={() => handleBulkAction('severity', () => onBulkUpdateSeverity(selectedIds, newSeverity))}
                            disabled={isProcessing}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Clear Selection */}
            <button
              onClick={onClearSelection}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Confirmation Bar */}
        {confirmAction && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  {primaryActions.find(a => a.key === confirmAction)?.confirmMessage ||
                   secondaryActions.find(a => a.key === confirmAction)?.confirmMessage}
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const action = [...primaryActions, ...secondaryActions].find(a => a.key === confirmAction);
                    if (action) {
                      handleBulkAction(confirmAction, action.onClick);
                    }
                  }}
                  disabled={isProcessing}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={isProcessing}
                  className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Tag Input */}
        {showTagInput && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-3">
                <label className="block text-sm font-medium text-blue-800 mb-1">
                  Add Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={bulkTagInput}
                  onChange={(e) => setBulkTagInput(e.target.value)}
                  placeholder="error, maintenance, resolved"
                  className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBulkTag();
                    }
                  }}
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleBulkTag}
                  disabled={!bulkTagInput.trim() || isProcessing}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Adding...' : 'Add Tags'}
                </button>
                <button
                  onClick={() => {
                    setShowTagInput(false);
                    setBulkTagInput('');
                  }}
                  className="px-3 py-2 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mt-3 flex items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-md">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600 mr-2" />
            <span className="text-sm text-blue-800">Processing bulk operation...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkOperations;