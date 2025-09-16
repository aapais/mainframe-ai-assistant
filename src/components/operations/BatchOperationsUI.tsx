/**
 * Batch Operations UI Component
 *
 * Comprehensive interface for batch operations with:
 * - Progress tracking with real-time updates
 * - Bulk edit, delete, duplicate, and export operations
 * - Operation history and rollback capabilities
 * - Confirmation dialogs with safety checks
 * - Error handling and recovery options
 * - Accessibility compliance (WCAG 2.1 AA)
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo
} from 'react';
import { KnowledgeDB, KBEntry } from '../../database/KnowledgeDB';
import { KBCategory } from '../../types/services';
import { useBatchOperations } from '../../hooks/useBatchOperations';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { BatchOperationsService, BatchOperationProgress, BatchOperationResult } from '../../services/BatchOperationsService';
import './BatchOperationsUI.css';

// ========================
// Types & Interfaces
// ========================

export interface BatchOperation {
  id: string;
  type: 'update' | 'delete' | 'duplicate' | 'export' | 'import';
  name: string;
  description: string;
  icon: string;
  requiresConfirmation: boolean;
  destructive: boolean;
  enabled: boolean;
}

export interface BatchEditFields {
  category?: KBCategory;
  tags?: {
    action: 'add' | 'remove' | 'replace';
    values: string[];
  };
  metadata?: {
    archived?: boolean;
    priority?: number;
  };
}

export interface OperationConfirmation {
  operation: BatchOperation;
  entryIds: string[];
  entries: KBEntry[];
  estimatedTime: number;
  risks: string[];
  canUndo: boolean;
}

export interface BatchOperationsUIProps {
  className?: string;
  /** Knowledge database instance */
  db: KnowledgeDB;
  /** Batch operations service */
  batchService: BatchOperationsService;
  /** Selected entry IDs */
  selectedEntryIds: string[];
  /** All available entries */
  allEntries: KBEntry[];
  /** Available operations */
  availableOperations?: BatchOperation[];
  /** Configuration options */
  config?: {
    enableProgressAnnouncements: boolean;
    enableOperationHistory: boolean;
    enableRollback: boolean;
    confirmationTimeout: number;
    maxBatchSize: number;
  };
  /** Event handlers */
  onOperationStart?: (operation: BatchOperation, entryIds: string[]) => void;
  onOperationComplete?: (operation: BatchOperation, result: BatchOperationResult) => void;
  onOperationError?: (operation: BatchOperation, error: Error) => void;
  onSelectionChange?: (entryIds: string[]) => void;
  onClose?: () => void;
  /** Accessibility */
  ariaLabel?: string;
  announceProgress?: boolean;
}

interface UIState {
  showConfirmation: OperationConfirmation | null;
  showBulkEdit: boolean;
  showExportDialog: boolean;
  showImportDialog: boolean;
  showHistory: boolean;
  bulkEditFields: BatchEditFields;
  exportFormat: 'json' | 'csv' | 'xlsx';
  importData: string;
  importFormat: 'json' | 'csv';
  selectedHistoryItem: string | null;
}

// ========================
// Default Operations
// ========================

const DEFAULT_OPERATIONS: BatchOperation[] = [
  {
    id: 'bulk-edit',
    type: 'update',
    name: 'Bulk Edit',
    description: 'Edit multiple entries at once',
    icon: '✏️',
    requiresConfirmation: false,
    destructive: false,
    enabled: true
  },
  {
    id: 'bulk-duplicate',
    type: 'duplicate',
    name: 'Duplicate',
    description: 'Create copies of selected entries',
    icon: '📋',
    requiresConfirmation: true,
    destructive: false,
    enabled: true
  },
  {
    id: 'bulk-export',
    type: 'export',
    name: 'Export',
    description: 'Export selected entries to file',
    icon: '📤',
    requiresConfirmation: false,
    destructive: false,
    enabled: true
  },
  {
    id: 'bulk-delete',
    type: 'delete',
    name: 'Delete',
    description: 'Permanently delete selected entries',
    icon: '🗑️',
    requiresConfirmation: true,
    destructive: true,
    enabled: true
  }
];

// ========================
// Main Component
// ========================

export const BatchOperationsUI: React.FC<BatchOperationsUIProps> = memo(({
  className = '',
  db,
  batchService,
  selectedEntryIds,
  allEntries,
  availableOperations = DEFAULT_OPERATIONS,
  config = {
    enableProgressAnnouncements: true,
    enableOperationHistory: true,
    enableRollback: true,
    confirmationTimeout: 30000,
    maxBatchSize: 1000
  },
  ariaLabel = 'Batch operations interface',
  announceProgress = true,
  onOperationStart,
  onOperationComplete,
  onOperationError,
  onSelectionChange,
  onClose
}) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const confirmationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State management
  const [uiState, setUIState] = useState<UIState>({
    showConfirmation: null,
    showBulkEdit: false,
    showExportDialog: false,
    showImportDialog: false,
    showHistory: false,
    bulkEditFields: {},
    exportFormat: 'json',
    importData: '',
    importFormat: 'json',
    selectedHistoryItem: null
  });

  // Custom hooks
  const {
    operationState,
    selectionState,
    selectedEntries,
    canBatchEdit,
    canBatchDelete,
    canBatchExport,
    performBatchUpdate,
    performBatchDelete,
    performBatchDuplicate,
    performBatchExport,
    cancelCurrentOperation,
    clearError,
    clearHistory
  } = useBatchOperations(allEntries, new Set(selectedEntryIds), batchService);

  // Update UI state helper
  const updateUIState = useCallback((updates: Partial<UIState>) => {
    setUIState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Get selected entries
  const selectedEntriesData = useMemo(() => {
    return allEntries.filter(entry => entry.id && selectedEntryIds.includes(entry.id));
  }, [allEntries, selectedEntryIds]);

  // Estimate operation time
  const estimateOperationTime = useCallback((operation: BatchOperation, entryCount: number): number => {
    const timePerEntry = {
      update: 50,
      delete: 30,
      duplicate: 100,
      export: 20,
      import: 80
    };

    return (timePerEntry[operation.type] || 50) * entryCount;
  }, []);

  // Get operation risks
  const getOperationRisks = useCallback((operation: BatchOperation, entries: KBEntry[]): string[] => {
    const risks: string[] = [];

    switch (operation.type) {
      case 'delete':
        risks.push('This action cannot be undone');
        if (entries.some(e => (e.usage_count || 0) > 10)) {
          risks.push('Some entries are frequently used');
        }
        if (entries.some(e => (e.success_count || 0) > (e.failure_count || 0) * 3)) {
          risks.push('Some entries have high success rates');
        }
        break;

      case 'update':
        risks.push('Original values will be overwritten');
        if (entries.length > 50) {
          risks.push('Large batch operations may take time to complete');
        }
        break;

      case 'duplicate':
        if (entries.length > 20) {
          risks.push('This will create many new entries');
        }
        risks.push('Check for similar entries to avoid duplicates');
        break;

      case 'export':
        if (entries.some(e => e.solution && e.solution.length > 2000)) {
          risks.push('Export file may be large due to detailed solutions');
        }
        break;
    }

    return risks;
  }, []);

  // Handle operation click
  const handleOperationClick = useCallback(async (operation: BatchOperation) => {
    if (selectedEntryIds.length === 0) return;

    if (selectedEntryIds.length > config.maxBatchSize) {
      alert(`Cannot process more than ${config.maxBatchSize} entries at once`);
      return;
    }

    const entries = selectedEntriesData;
    const estimatedTime = estimateOperationTime(operation, entries.length);
    const risks = getOperationRisks(operation, entries);

    if (operation.requiresConfirmation) {
      const confirmation: OperationConfirmation = {
        operation,
        entryIds: selectedEntryIds,
        entries,
        estimatedTime,
        risks,
        canUndo: operation.type !== 'delete' && config.enableRollback
      };

      updateUIState({ showConfirmation: confirmation });

      // Auto-dismiss confirmation after timeout
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }

      confirmationTimeoutRef.current = setTimeout(() => {
        updateUIState({ showConfirmation: null });
      }, config.confirmationTimeout);
    } else {
      // Execute operation immediately
      await executeOperation(operation);
    }
  }, [
    selectedEntryIds,
    selectedEntriesData,
    config.maxBatchSize,
    config.enableRollback,
    config.confirmationTimeout,
    estimateOperationTime,
    getOperationRisks,
    updateUIState
  ]);

  // Execute operation
  const executeOperation = useCallback(async (operation: BatchOperation) => {
    try {
      onOperationStart?.(operation, selectedEntryIds);

      let result: BatchOperationResult;

      switch (operation.type) {
        case 'update':
          if (operation.id === 'bulk-edit') {
            updateUIState({ showBulkEdit: true });
            return;
          }
          result = await performBatchUpdate(uiState.bulkEditFields);
          break;

        case 'delete':
          result = await performBatchDelete();
          break;

        case 'duplicate':
          result = await performBatchDuplicate();
          break;

        case 'export':
          if (operation.id === 'bulk-export') {
            updateUIState({ showExportDialog: true });
            return;
          }
          result = await performBatchExport(uiState.exportFormat);
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      onOperationComplete?.(operation, result);

      // Announce completion
      if (announceProgress && config.enableProgressAnnouncements) {
        announceToScreenReader(
          `${operation.name} completed successfully. ${result.successCount} entries processed.`
        );
      }

    } catch (error) {
      console.error(`Operation ${operation.name} failed:`, error);
      onOperationError?.(operation, error as Error);

      // Announce error
      if (announceProgress && config.enableProgressAnnouncements) {
        announceToScreenReader(`${operation.name} failed: ${error.message}`);
      }
    } finally {
      updateUIState({ showConfirmation: null });
    }
  }, [
    selectedEntryIds,
    uiState.bulkEditFields,
    uiState.exportFormat,
    performBatchUpdate,
    performBatchDelete,
    performBatchDuplicate,
    performBatchExport,
    onOperationStart,
    onOperationComplete,
    onOperationError,
    announceProgress,
    config.enableProgressAnnouncements,
    updateUIState
  ]);

  // Handle confirmation
  const handleConfirmOperation = useCallback(async () => {
    if (!uiState.showConfirmation) return;

    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
      confirmationTimeoutRef.current = null;
    }

    await executeOperation(uiState.showConfirmation.operation);
  }, [uiState.showConfirmation, executeOperation]);

  // Handle confirmation cancel
  const handleCancelConfirmation = useCallback(() => {
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
      confirmationTimeoutRef.current = null;
    }
    updateUIState({ showConfirmation: null });
  }, [updateUIState]);

  // Handle bulk edit submit
  const handleBulkEditSubmit = useCallback(async () => {
    try {
      const result = await performBatchUpdate(uiState.bulkEditFields);
      updateUIState({ showBulkEdit: false, bulkEditFields: {} });

      if (announceProgress && config.enableProgressAnnouncements) {
        announceToScreenReader(
          `Bulk edit completed. ${result.successCount} entries updated.`
        );
      }
    } catch (error) {
      console.error('Bulk edit failed:', error);
    }
  }, [
    uiState.bulkEditFields,
    performBatchUpdate,
    updateUIState,
    announceProgress,
    config.enableProgressAnnouncements
  ]);

  // Handle export
  const handleExport = useCallback(async () => {
    try {
      const result = await performBatchExport(uiState.exportFormat);
      updateUIState({ showExportDialog: false });

      // Trigger download
      if (result.data) {
        const blob = new Blob([result.data], {
          type: uiState.exportFormat === 'json' ? 'application/json' : 'text/csv'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kb-entries-${Date.now()}.${uiState.exportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      if (announceProgress && config.enableProgressAnnouncements) {
        announceToScreenReader(
          `Export completed. ${result.successCount} entries exported.`
        );
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [
    uiState.exportFormat,
    performBatchExport,
    updateUIState,
    announceProgress,
    config.enableProgressAnnouncements
  ]);

  // Announce to screen reader
  const announceToScreenReader = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.textContent = message;
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  // Keyboard navigation for operations
  useKeyboardNavigation({
    itemCount: availableOperations.filter(op => op.enabled).length,
    onSelect: (index) => {
      const enabledOps = availableOperations.filter(op => op.enabled);
      if (enabledOps[index]) {
        handleOperationClick(enabledOps[index]);
      }
    },
    enabled: !operationState.isOperating && selectedEntryIds.length > 0
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }
    };
  }, []);

  // Format time display
  const formatTime = useCallback((milliseconds: number): string => {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }, []);

  return (
    <div
      ref={containerRef}
      className={`batch-operations-ui ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Header */}
      <div className="batch-header">
        <div className="batch-title">
          <h2>Batch Operations</h2>
          <span className="selection-count">
            {selectedEntryIds.length} item{selectedEntryIds.length !== 1 ? 's' : ''} selected
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="close-button"
            aria-label="Close batch operations"
          >
            ✕
          </button>
        )}
      </div>

      {/* Operation Progress */}
      {operationState.isOperating && operationState.progress && (
        <div
          ref={progressRef}
          className="operation-progress"
          role="progressbar"
          aria-valuenow={operationState.progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${operationState.activeOperation} progress: ${operationState.progress.percentage}%`}
        >
          <div className="progress-header">
            <h3>{operationState.activeOperation}</h3>
            <button
              onClick={cancelCurrentOperation}
              className="cancel-button"
              aria-label="Cancel current operation"
            >
              Cancel
            </button>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${operationState.progress.percentage}%` }}
            />
          </div>

          <div className="progress-details">
            <span>
              {operationState.progress.completed} of {operationState.progress.total} completed
            </span>
            {operationState.progress.estimatedTimeRemaining && (
              <span>
                {formatTime(operationState.progress.estimatedTimeRemaining)} remaining
              </span>
            )}
          </div>

          {operationState.progress.currentItem && (
            <div className="progress-current">
              Processing: {operationState.progress.currentItem}
            </div>
          )}
        </div>
      )}

      {/* Operations Grid */}
      {!operationState.isOperating && (
        <div className="operations-grid">
          {availableOperations
            .filter(op => op.enabled)
            .map(operation => {
              const isDisabled = selectedEntryIds.length === 0 ||
                (operation.type === 'update' && !canBatchEdit) ||
                (operation.type === 'delete' && !canBatchDelete) ||
                (operation.type === 'export' && !canBatchExport);

              return (
                <button
                  key={operation.id}
                  onClick={() => handleOperationClick(operation)}
                  disabled={isDisabled}
                  className={`operation-button ${operation.destructive ? 'destructive' : ''}`}
                  aria-label={`${operation.name}: ${operation.description}`}
                  title={operation.description}
                >
                  <div className="operation-icon">
                    {operation.icon}
                  </div>
                  <div className="operation-content">
                    <div className="operation-name">
                      {operation.name}
                    </div>
                    <div className="operation-description">
                      {operation.description}
                    </div>
                    {operation.requiresConfirmation && (
                      <div className="operation-warning">
                        Requires confirmation
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      )}

      {/* Operation History */}
      {config.enableOperationHistory && operationState.operationHistory.length > 0 && (
        <div className="operation-history">
          <div className="history-header">
            <h3>Recent Operations</h3>
            <div className="history-actions">
              <button
                onClick={() => updateUIState({ showHistory: !uiState.showHistory })}
                className="toggle-history"
                aria-expanded={uiState.showHistory}
              >
                {uiState.showHistory ? 'Hide' : 'Show'} History
              </button>
              <button
                onClick={clearHistory}
                className="clear-history"
                aria-label="Clear operation history"
              >
                Clear
              </button>
            </div>
          </div>

          {uiState.showHistory && (
            <div className="history-list">
              {operationState.operationHistory.slice(0, 10).map(historyItem => (
                <div
                  key={historyItem.id}
                  className={`history-item ${historyItem.success ? 'success' : 'failure'}`}
                >
                  <div className="history-info">
                    <div className="history-type">
                      {historyItem.type} ({historyItem.itemCount} items)
                    </div>
                    <div className="history-time">
                      {historyItem.timestamp.toLocaleString()}
                    </div>
                  </div>
                  <div className="history-result">
                    <span className={`status ${historyItem.success ? 'success' : 'failure'}`}>
                      {historyItem.success ? '✓' : '✗'}
                    </span>
                    <span className="duration">
                      {formatTime(historyItem.duration)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {operationState.error && (
        <div className="operation-error" role="alert">
          <div className="error-content">
            <h3>Operation Failed</h3>
            <p>{operationState.error}</p>
          </div>
          <div className="error-actions">
            <button
              onClick={clearError}
              className="dismiss-error"
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {uiState.showConfirmation && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="confirmation-modal">
            <div className="modal-header">
              <h3>Confirm {uiState.showConfirmation.operation.name}</h3>
              <button
                onClick={handleCancelConfirmation}
                className="modal-close"
                aria-label="Cancel operation"
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="confirmation-details">
                <p>
                  Are you sure you want to {uiState.showConfirmation.operation.name.toLowerCase()}{' '}
                  <strong>{uiState.showConfirmation.entryIds.length}</strong> entries?
                </p>

                {uiState.showConfirmation.estimatedTime > 5000 && (
                  <p className="time-estimate">
                    Estimated time: {formatTime(uiState.showConfirmation.estimatedTime)}
                  </p>
                )}

                {uiState.showConfirmation.risks.length > 0 && (
                  <div className="operation-risks">
                    <h4>⚠️ Please note:</h4>
                    <ul>
                      {uiState.showConfirmation.risks.map((risk, index) => (
                        <li key={index}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="entry-preview">
                <h4>Affected Entries:</h4>
                <div className="entry-list">
                  {uiState.showConfirmation.entries.slice(0, 5).map(entry => (
                    <div key={entry.id} className="entry-item">
                      <div className="entry-title">{entry.title}</div>
                      <div className="entry-category">{entry.category}</div>
                    </div>
                  ))}
                  {uiState.showConfirmation.entries.length > 5 && (
                    <div className="entry-more">
                      ...and {uiState.showConfirmation.entries.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={handleCancelConfirmation}
                className="modal-button secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOperation}
                className={`modal-button primary ${uiState.showConfirmation.operation.destructive ? 'destructive' : ''}`}
              >
                {uiState.showConfirmation.operation.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {uiState.showBulkEdit && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="bulk-edit-modal">
            <div className="modal-header">
              <h3>Bulk Edit {selectedEntryIds.length} Entries</h3>
              <button
                onClick={() => updateUIState({ showBulkEdit: false })}
                className="modal-close"
                aria-label="Close bulk edit"
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="bulk-edit-form">
                {/* Category Update */}
                <div className="form-field">
                  <label htmlFor="bulk-category">Update Category</label>
                  <select
                    id="bulk-category"
                    value={uiState.bulkEditFields.category || ''}
                    onChange={(e) => updateUIState({
                      bulkEditFields: {
                        ...uiState.bulkEditFields,
                        category: e.target.value as KBCategory || undefined
                      }
                    })}
                  >
                    <option value="">No change</option>
                    <option value="JCL">JCL</option>
                    <option value="VSAM">VSAM</option>
                    <option value="DB2">DB2</option>
                    <option value="Batch">Batch</option>
                    <option value="Functional">Functional</option>
                  </select>
                </div>

                {/* Tags Update */}
                <div className="form-field">
                  <label>Update Tags</label>
                  <div className="tag-actions">
                    <button
                      onClick={() => updateUIState({
                        bulkEditFields: {
                          ...uiState.bulkEditFields,
                          tags: { action: 'add', values: [] }
                        }
                      })}
                      className={`tag-action ${uiState.bulkEditFields.tags?.action === 'add' ? 'active' : ''}`}
                    >
                      Add Tags
                    </button>
                    <button
                      onClick={() => updateUIState({
                        bulkEditFields: {
                          ...uiState.bulkEditFields,
                          tags: { action: 'remove', values: [] }
                        }
                      })}
                      className={`tag-action ${uiState.bulkEditFields.tags?.action === 'remove' ? 'active' : ''}`}
                    >
                      Remove Tags
                    </button>
                    <button
                      onClick={() => updateUIState({
                        bulkEditFields: {
                          ...uiState.bulkEditFields,
                          tags: { action: 'replace', values: [] }
                        }
                      })}
                      className={`tag-action ${uiState.bulkEditFields.tags?.action === 'replace' ? 'active' : ''}`}
                    >
                      Replace Tags
                    </button>
                  </div>

                  {uiState.bulkEditFields.tags && (
                    <input
                      type="text"
                      placeholder="Enter tags separated by commas"
                      onChange={(e) => updateUIState({
                        bulkEditFields: {
                          ...uiState.bulkEditFields,
                          tags: {
                            ...uiState.bulkEditFields.tags!,
                            values: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                          }
                        }
                      })}
                      className="tag-input"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => updateUIState({ showBulkEdit: false })}
                className="modal-button secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEditSubmit}
                className="modal-button primary"
              >
                Update {selectedEntryIds.length} Entries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {uiState.showExportDialog && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="export-modal">
            <div className="modal-header">
              <h3>Export {selectedEntryIds.length} Entries</h3>
              <button
                onClick={() => updateUIState({ showExportDialog: false })}
                className="modal-close"
                aria-label="Close export dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="export-options">
                <div className="form-field">
                  <label>Export Format</label>
                  <div className="format-options">
                    {(['json', 'csv'] as const).map(format => (
                      <label key={format} className="format-option">
                        <input
                          type="radio"
                          name="export-format"
                          value={format}
                          checked={uiState.exportFormat === format}
                          onChange={(e) => updateUIState({
                            exportFormat: e.target.value as 'json' | 'csv'
                          })}
                        />
                        <span>{format.toUpperCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => updateUIState({ showExportDialog: false })}
                className="modal-button secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="modal-button primary"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

BatchOperationsUI.displayName = 'BatchOperationsUI';

export default BatchOperationsUI;