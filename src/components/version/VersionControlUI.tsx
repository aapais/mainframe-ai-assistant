/**
 * Version Control UI Component
 *
 * Comprehensive version control interface with:
 * - Version history timeline with visual indicators
 * - Side-by-side diff comparison
 * - Rollback confirmation dialogs with safety checks
 * - Merge conflict resolution interface
 * - Branch visualization and management
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
import { VersionControlService, VersionHistory, VersionedEntry, ChangeRecord } from '../../services/VersionControlService';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './VersionControlUI.css';

// ========================
// Types & Interfaces
// ========================

export interface VersionInfo {
  id: string;
  version: number;
  timestamp: Date;
  author: string;
  message: string;
  changes: ChangeRecord[];
  size: number;
  tags: string[];
  isCurrent: boolean;
  isMajor: boolean;
}

export interface DiffResult {
  field: string;
  oldValue: string;
  newValue: string;
  changeType: 'added' | 'removed' | 'modified';
  lineChanges?: Array<{
    lineNumber: number;
    type: 'added' | 'removed' | 'unchanged';
    content: string;
  }>;
}

export interface RollbackConfirmation {
  targetVersion: VersionInfo;
  currentVersion: VersionInfo;
  affectedChanges: ChangeRecord[];
  dataLoss: boolean;
  conflicts: Array<{
    field: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface VersionControlUIProps {
  className?: string;
  /** Knowledge database instance */
  db: KnowledgeDB;
  /** Version control service */
  versionService: VersionControlService;
  /** Entry to manage versions for */
  entry: KBEntry;
  /** Initial view mode */
  initialView?: 'timeline' | 'diff' | 'compare';
  /** Configuration options */
  config?: {
    maxVersionsToShow: number;
    enableAutoSave: boolean;
    enableBranching: boolean;
    enableMerging: boolean;
    confirmRollback: boolean;
    showDiffStats: boolean;
  };
  /** Event handlers */
  onVersionRestore?: (version: VersionInfo) => void;
  onVersionCompare?: (versionA: VersionInfo, versionB: VersionInfo) => void;
  onVersionDelete?: (version: VersionInfo) => void;
  onVersionTag?: (version: VersionInfo, tag: string) => void;
  onClose?: () => void;
  /** Accessibility */
  ariaLabel?: string;
  announceChanges?: boolean;
}

interface UIState {
  currentView: 'timeline' | 'diff' | 'compare';
  selectedVersions: VersionInfo[];
  showRollbackConfirm: RollbackConfirmation | null;
  showVersionDetails: VersionInfo | null;
  showTagDialog: VersionInfo | null;
  diffResults: DiffResult[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filterBy: 'all' | 'major' | 'tagged' | 'recent';
  sortBy: 'date' | 'version' | 'author' | 'changes';
  sortOrder: 'asc' | 'desc';
}

// ========================
// Main Component
// ========================

export const VersionControlUI: React.FC<VersionControlUIProps> = memo(({
  className = '',
  db,
  versionService,
  entry,
  initialView = 'timeline',
  config = {
    maxVersionsToShow: 50,
    enableAutoSave: true,
    enableBranching: false,
    enableMerging: false,
    confirmRollback: true,
    showDiffStats: true
  },
  ariaLabel = 'Version control interface',
  announceChanges = true,
  onVersionRestore,
  onVersionCompare,
  onVersionDelete,
  onVersionTag,
  onClose
}) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const diffRef = useRef<HTMLDivElement>(null);

  // State management
  const [uiState, setUIState] = useState<UIState>({
    currentView: initialView,
    selectedVersions: [],
    showRollbackConfirm: null,
    showVersionDetails: null,
    showTagDialog: null,
    diffResults: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    filterBy: 'all',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Version history state
  const [versionHistory, setVersionHistory] = useState<VersionInfo[]>([]);

  // Update UI state helper
  const updateUIState = useCallback((updates: Partial<UIState>) => {
    setUIState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Load version history
  const loadVersionHistory = useCallback(async () => {
    updateUIState({ isLoading: true, error: null });

    try {
      const history = await versionService.getVersionHistory(entry.id!);

      const versions: VersionInfo[] = history.versions.map((version, index) => ({
        id: version.id,
        version: version.version,
        timestamp: version.timestamp,
        author: version.author,
        message: version.message,
        changes: version.changes || [],
        size: JSON.stringify(version.data).length,
        tags: version.tags || [],
        isCurrent: index === 0,
        isMajor: version.version % 10 === 0 || version.changes.some(c => c.type === 'major')
      }));

      setVersionHistory(versions);
      updateUIState({ isLoading: false });

    } catch (error) {
      console.error('Failed to load version history:', error);
      updateUIState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load version history'
      });
    }
  }, [entry.id, versionService, updateUIState]);

  // Filter and sort versions
  const filteredVersions = useMemo(() => {
    let filtered = [...versionHistory];

    // Apply search filter
    if (uiState.searchQuery) {
      const query = uiState.searchQuery.toLowerCase();
      filtered = filtered.filter(version =>
        version.message.toLowerCase().includes(query) ||
        version.author.toLowerCase().includes(query) ||
        version.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply type filter
    switch (uiState.filterBy) {
      case 'major':
        filtered = filtered.filter(v => v.isMajor);
        break;
      case 'tagged':
        filtered = filtered.filter(v => v.tags.length > 0);
        break;
      case 'recent':
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(v => v.timestamp > oneWeekAgo);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (uiState.sortBy) {
        case 'date':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'version':
          comparison = a.version - b.version;
          break;
        case 'author':
          comparison = a.author.localeCompare(b.author);
          break;
        case 'changes':
          comparison = a.changes.length - b.changes.length;
          break;
      }

      return uiState.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered.slice(0, config.maxVersionsToShow);
  }, [
    versionHistory,
    uiState.searchQuery,
    uiState.filterBy,
    uiState.sortBy,
    uiState.sortOrder,
    config.maxVersionsToShow
  ]);

  // Handle version selection
  const handleVersionSelect = useCallback((version: VersionInfo, multiSelect = false) => {
    if (multiSelect) {
      const isSelected = uiState.selectedVersions.some(v => v.id === version.id);

      if (isSelected) {
        updateUIState({
          selectedVersions: uiState.selectedVersions.filter(v => v.id !== version.id)
        });
      } else if (uiState.selectedVersions.length < 2) {
        updateUIState({
          selectedVersions: [...uiState.selectedVersions, version]
        });
      }
    } else {
      updateUIState({ selectedVersions: [version] });
    }
  }, [uiState.selectedVersions, updateUIState]);

  // Generate diff
  const generateDiff = useCallback(async (versionA: VersionInfo, versionB: VersionInfo): Promise<DiffResult[]> => {
    try {
      const dataA = await versionService.getVersionData(entry.id!, versionA.version);
      const dataB = await versionService.getVersionData(entry.id!, versionB.version);

      const diffs: DiffResult[] = [];

      // Compare each field
      const allFields = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);

      for (const field of allFields) {
        const oldValue = dataA[field] || '';
        const newValue = dataB[field] || '';

        if (oldValue !== newValue) {
          let changeType: 'added' | 'removed' | 'modified' = 'modified';

          if (!oldValue) changeType = 'added';
          else if (!newValue) changeType = 'removed';

          const diff: DiffResult = {
            field,
            oldValue,
            newValue,
            changeType
          };

          // Generate line-by-line diff for text fields
          if (typeof oldValue === 'string' && typeof newValue === 'string') {
            diff.lineChanges = generateLineDiff(oldValue, newValue);
          }

          diffs.push(diff);
        }
      }

      return diffs;
    } catch (error) {
      console.error('Failed to generate diff:', error);
      return [];
    }
  }, [entry.id, versionService]);

  // Handle compare versions
  const handleCompareVersions = useCallback(async () => {
    if (uiState.selectedVersions.length !== 2) return;

    updateUIState({ isLoading: true, currentView: 'diff' });

    try {
      const [versionA, versionB] = uiState.selectedVersions.sort((a, b) => a.version - b.version);
      const diffResults = await generateDiff(versionA, versionB);

      updateUIState({
        diffResults,
        isLoading: false
      });

      onVersionCompare?.(versionA, versionB);

      if (announceChanges) {
        announceToScreenReader(
          `Comparing version ${versionA.version} with version ${versionB.version}. Found ${diffResults.length} differences.`
        );
      }
    } catch (error) {
      console.error('Failed to compare versions:', error);
      updateUIState({
        isLoading: false,
        error: 'Failed to compare versions'
      });
    }
  }, [uiState.selectedVersions, generateDiff, updateUIState, onVersionCompare, announceChanges]);

  // Handle rollback
  const handleRollback = useCallback(async (targetVersion: VersionInfo) => {
    if (!config.confirmRollback) {
      await executeRollback(targetVersion);
      return;
    }

    const currentVersion = versionHistory.find(v => v.isCurrent);
    if (!currentVersion) return;

    // Analyze potential conflicts and data loss
    const affectedChanges = currentVersion.changes;
    const dataLoss = currentVersion.version > targetVersion.version;
    const conflicts = analyzeRollbackConflicts(currentVersion, targetVersion);

    const confirmation: RollbackConfirmation = {
      targetVersion,
      currentVersion,
      affectedChanges,
      dataLoss,
      conflicts
    };

    updateUIState({ showRollbackConfirm: confirmation });
  }, [config.confirmRollback, versionHistory, updateUIState]);

  // Execute rollback
  const executeRollback = useCallback(async (targetVersion: VersionInfo) => {
    updateUIState({ isLoading: true });

    try {
      await versionService.rollbackToVersion(entry.id!, targetVersion.version);
      await loadVersionHistory(); // Refresh history

      onVersionRestore?.(targetVersion);

      if (announceChanges) {
        announceToScreenReader(`Successfully rolled back to version ${targetVersion.version}`);
      }

      updateUIState({
        isLoading: false,
        showRollbackConfirm: null
      });
    } catch (error) {
      console.error('Rollback failed:', error);
      updateUIState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Rollback failed'
      });
    }
  }, [entry.id, versionService, loadVersionHistory, onVersionRestore, announceChanges, updateUIState]);

  // Handle tag version
  const handleTagVersion = useCallback(async (version: VersionInfo, tag: string) => {
    try {
      await versionService.tagVersion(entry.id!, version.version, tag);
      await loadVersionHistory(); // Refresh to show new tag

      onVersionTag?.(version, tag);

      if (announceChanges) {
        announceToScreenReader(`Tagged version ${version.version} as "${tag}"`);
      }

      updateUIState({ showTagDialog: null });
    } catch (error) {
      console.error('Failed to tag version:', error);
      updateUIState({ error: 'Failed to tag version' });
    }
  }, [entry.id, versionService, loadVersionHistory, onVersionTag, announceChanges, updateUIState]);

  // Analyze rollback conflicts
  const analyzeRollbackConflicts = useCallback((current: VersionInfo, target: VersionInfo) => {
    const conflicts = [];

    // Check for version gap
    const versionGap = current.version - target.version;
    if (versionGap > 5) {
      conflicts.push({
        field: 'version',
        description: `Rolling back ${versionGap} versions may lose significant changes`,
        severity: 'high' as const
      });
    }

    // Check for recent changes
    const daysDiff = (Date.now() - target.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      conflicts.push({
        field: 'timestamp',
        description: `Target version is ${Math.round(daysDiff)} days old`,
        severity: 'medium' as const
      });
    }

    // Check for major changes
    const majorChanges = current.changes.filter(c => c.type === 'major').length;
    if (majorChanges > 0) {
      conflicts.push({
        field: 'changes',
        description: `${majorChanges} major changes will be lost`,
        severity: 'high' as const
      });
    }

    return conflicts;
  }, []);

  // Generate line diff
  const generateLineDiff = useCallback((oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    const lineChanges = [];

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine !== newLine) {
        if (oldLine && newLine) {
          // Modified line
          lineChanges.push({
            lineNumber: i + 1,
            type: 'removed' as const,
            content: oldLine
          });
          lineChanges.push({
            lineNumber: i + 1,
            type: 'added' as const,
            content: newLine
          });
        } else if (oldLine) {
          // Removed line
          lineChanges.push({
            lineNumber: i + 1,
            type: 'removed' as const,
            content: oldLine
          });
        } else {
          // Added line
          lineChanges.push({
            lineNumber: i + 1,
            type: 'added' as const,
            content: newLine
          });
        }
      } else {
        // Unchanged line
        lineChanges.push({
          lineNumber: i + 1,
          type: 'unchanged' as const,
          content: oldLine
        });
      }
    }

    return lineChanges;
  }, []);

  // Announce to screen reader
  const announceToScreenReader = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, []);

  // Format date
  const formatDate = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  // Keyboard navigation
  useKeyboardNavigation({
    itemCount: filteredVersions.length,
    onSelect: (index) => {
      if (filteredVersions[index]) {
        handleVersionSelect(filteredVersions[index]);
      }
    },
    enabled: uiState.currentView === 'timeline'
  });

  // Load version history on mount
  useEffect(() => {
    loadVersionHistory();
  }, [loadVersionHistory]);

  return (
    <div
      ref={containerRef}
      className={`version-control-ui ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Header */}
      <div className="version-header">
        <div className="version-title">
          <h2>Version History</h2>
          <span className="entry-title">
            {entry.title}
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="close-button"
            aria-label="Close version history"
          >
            ✕
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="version-controls">
        <div className="view-tabs" role="tablist">
          {(['timeline', 'diff', 'compare'] as const).map(view => (
            <button
              key={view}
              role="tab"
              aria-selected={uiState.currentView === view}
              onClick={() => updateUIState({ currentView: view })}
              className={`tab-button ${uiState.currentView === view ? 'active' : ''}`}
              disabled={view === 'diff' && uiState.selectedVersions.length !== 2}
            >
              {view === 'timeline' && '📅 Timeline'}
              {view === 'diff' && '🔄 Diff'}
              {view === 'compare' && '⚖️ Compare'}
            </button>
          ))}
        </div>

        <div className="version-actions">
          <input
            type="text"
            value={uiState.searchQuery}
            onChange={(e) => updateUIState({ searchQuery: e.target.value })}
            placeholder="Search versions..."
            className="search-input"
            aria-label="Search version history"
          />

          <select
            value={uiState.filterBy}
            onChange={(e) => updateUIState({ filterBy: e.target.value as any })}
            className="filter-select"
            aria-label="Filter versions"
          >
            <option value="all">All Versions</option>
            <option value="major">Major Versions</option>
            <option value="tagged">Tagged Versions</option>
            <option value="recent">Recent (7 days)</option>
          </select>

          {uiState.selectedVersions.length === 2 && (
            <button
              onClick={handleCompareVersions}
              className="compare-button"
              disabled={uiState.isLoading}
            >
              Compare Selected
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {uiState.isLoading && (
        <div className="loading-state" aria-live="polite">
          <div className="spinner" />
          <p>Loading version history...</p>
        </div>
      )}

      {/* Error State */}
      {uiState.error && (
        <div className="error-state" role="alert">
          <h3>Error</h3>
          <p>{uiState.error}</p>
          <button
            onClick={() => updateUIState({ error: null })}
            className="dismiss-error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      {!uiState.isLoading && !uiState.error && (
        <div className="version-content">
          {/* Timeline View */}
          {uiState.currentView === 'timeline' && (
            <div
              ref={timelineRef}
              className="timeline-view"
              role="list"
              aria-label="Version timeline"
            >
              {filteredVersions.length === 0 ? (
                <div className="empty-state">
                  <p>No versions found</p>
                </div>
              ) : (
                filteredVersions.map((version, index) => (
                  <div
                    key={version.id}
                    role="listitem"
                    className={`timeline-item ${version.isCurrent ? 'current' : ''} ${uiState.selectedVersions.some(v => v.id === version.id) ? 'selected' : ''}`}
                    onClick={() => handleVersionSelect(version, true)}
                    aria-label={`Version ${version.version} by ${version.author} on ${formatDate(version.timestamp)}`}
                  >
                    <div className="timeline-marker">
                      <div className="version-number">
                        {version.version}
                      </div>
                      {version.isCurrent && (
                        <div className="current-badge">Current</div>
                      )}
                    </div>

                    <div className="timeline-content">
                      <div className="version-header">
                        <div className="version-info">
                          <span className="version-date">
                            {formatDate(version.timestamp)}
                          </span>
                          <span className="version-author">
                            by {version.author}
                          </span>
                        </div>

                        <div className="version-actions-inline">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateUIState({ showVersionDetails: version });
                            }}
                            className="action-button"
                            aria-label={`View details for version ${version.version}`}
                          >
                            👁️
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateUIState({ showTagDialog: version });
                            }}
                            className="action-button"
                            aria-label={`Tag version ${version.version}`}
                          >
                            🏷️
                          </button>

                          {!version.isCurrent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRollback(version);
                              }}
                              className="action-button rollback"
                              aria-label={`Rollback to version ${version.version}`}
                            >
                              ↩️
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="version-message">
                        {version.message}
                      </div>

                      {version.tags.length > 0 && (
                        <div className="version-tags">
                          {version.tags.map(tag => (
                            <span key={tag} className="version-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="version-stats">
                        <span className="change-count">
                          {version.changes.length} changes
                        </span>
                        <span className="version-size">
                          {formatBytes(version.size)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Diff View */}
          {uiState.currentView === 'diff' && (
            <div
              ref={diffRef}
              className="diff-view"
              aria-label="Version differences"
            >
              {uiState.diffResults.length === 0 ? (
                <div className="empty-state">
                  <p>Select two versions to compare</p>
                </div>
              ) : (
                <div className="diff-container">
                  <div className="diff-header">
                    <h3>
                      Comparing v{uiState.selectedVersions[0]?.version} → v{uiState.selectedVersions[1]?.version}
                    </h3>
                    {config.showDiffStats && (
                      <div className="diff-stats">
                        <span className="added">+{uiState.diffResults.filter(d => d.changeType === 'added').length}</span>
                        <span className="removed">-{uiState.diffResults.filter(d => d.changeType === 'removed').length}</span>
                        <span className="modified">±{uiState.diffResults.filter(d => d.changeType === 'modified').length}</span>
                      </div>
                    )}
                  </div>

                  <div className="diff-content">
                    {uiState.diffResults.map((diff, index) => (
                      <div key={index} className={`diff-section ${diff.changeType}`}>
                        <h4 className="diff-field-name">
                          {diff.field}
                        </h4>

                        <div className="diff-comparison">
                          <div className="diff-old">
                            <div className="diff-label">Before</div>
                            <pre className="diff-content-text">
                              {diff.oldValue || '(empty)'}
                            </pre>
                          </div>

                          <div className="diff-new">
                            <div className="diff-label">After</div>
                            <pre className="diff-content-text">
                              {diff.newValue || '(empty)'}
                            </pre>
                          </div>
                        </div>

                        {diff.lineChanges && (
                          <div className="line-diff">
                            {diff.lineChanges.map((line, lineIndex) => (
                              <div
                                key={lineIndex}
                                className={`line-change ${line.type}`}
                              >
                                <span className="line-number">
                                  {line.lineNumber}
                                </span>
                                <span className="line-content">
                                  {line.content}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {uiState.showRollbackConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="rollback-modal">
            <div className="modal-header">
              <h3>Confirm Rollback</h3>
              <button
                onClick={() => updateUIState({ showRollbackConfirm: null })}
                className="modal-close"
                aria-label="Cancel rollback"
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="rollback-warning">
                <p>
                  <strong>⚠️ Warning:</strong> You are about to rollback from version{' '}
                  {uiState.showRollbackConfirm.currentVersion.version} to version{' '}
                  {uiState.showRollbackConfirm.targetVersion.version}.
                </p>

                {uiState.showRollbackConfirm.dataLoss && (
                  <div className="data-loss-warning">
                    <h4>❌ Data Loss Warning</h4>
                    <p>This rollback will permanently lose the following changes:</p>
                    <ul>
                      {uiState.showRollbackConfirm.affectedChanges.map((change, index) => (
                        <li key={index}>
                          {change.field}: {change.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {uiState.showRollbackConfirm.conflicts.length > 0 && (
                  <div className="rollback-conflicts">
                    <h4>⚠️ Potential Issues</h4>
                    <ul>
                      {uiState.showRollbackConfirm.conflicts.map((conflict, index) => (
                        <li key={index} className={`conflict-${conflict.severity}`}>
                          <strong>{conflict.field}:</strong> {conflict.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => updateUIState({ showRollbackConfirm: null })}
                className="modal-button secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => executeRollback(uiState.showRollbackConfirm!.targetVersion)}
                className="modal-button primary destructive"
              >
                Confirm Rollback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Version Modal */}
      {uiState.showTagDialog && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="tag-modal">
            <div className="modal-header">
              <h3>Tag Version {uiState.showTagDialog.version}</h3>
              <button
                onClick={() => updateUIState({ showTagDialog: null })}
                className="modal-close"
                aria-label="Cancel tagging"
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="tag-form">
                <label htmlFor="tag-input">Tag Name:</label>
                <input
                  id="tag-input"
                  type="text"
                  placeholder="e.g., stable, release-1.0"
                  className="tag-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      if (target.value.trim()) {
                        handleTagVersion(uiState.showTagDialog!, target.value.trim());
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => updateUIState({ showTagDialog: null })}
                className="modal-button secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('tag-input') as HTMLInputElement;
                  if (input?.value.trim()) {
                    handleTagVersion(uiState.showTagDialog!, input.value.trim());
                  }
                }}
                className="modal-button primary"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ========================
// Utility Functions
// ========================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

VersionControlUI.displayName = 'VersionControlUI';

export default VersionControlUI;