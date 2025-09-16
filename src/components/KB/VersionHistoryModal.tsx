/**
 * Version History Modal Component
 *
 * Displays the version history of a KB entry with options to view details,
 * compare versions, and rollback to previous versions.
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { KBEntry } from '../../database/KnowledgeDB';
import {
  VersionControlService,
  VersionHistory,
  VersionedEntry,
  ChangeRecord
} from '../../services/VersionControlService';

// ========================
// Types & Interfaces
// ========================

export interface VersionHistoryModalProps {
  entry: KBEntry;
  versionService: VersionControlService;
  onClose: () => void;
  onCompareVersions?: (entry: KBEntry, versionA: number, versionB: number) => void;
  onRollback?: (entry: KBEntry, targetVersion: number) => void;
}

// ========================
// Component
// ========================

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  entry,
  versionService,
  onClose,
  onCompareVersions,
  onRollback
}) => {
  const [history, setHistory] = useState<VersionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  // Load version history
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const versionHistory = await versionService.getVersionHistory(entry.id!);
        setHistory(versionHistory);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load version history');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [entry.id, versionService]);

  // Handle version selection for comparison
  const handleVersionSelect = useCallback((version: number) => {
    setSelectedVersions(prev => {
      if (prev.includes(version)) {
        return prev.filter(v => v !== version);
      }

      if (prev.length >= 2) {
        return [prev[1], version]; // Keep most recent selection and new one
      }

      return [...prev, version];
    });
  }, []);

  // Handle compare versions
  const handleCompare = useCallback(() => {
    if (selectedVersions.length === 2 && onCompareVersions) {
      const [versionA, versionB] = selectedVersions.sort((a, b) => b - a); // Newer first
      onCompareVersions(entry, versionA, versionB);
    }
  }, [selectedVersions, entry, onCompareVersions]);

  // Handle rollback
  const handleRollback = useCallback((version: number) => {
    if (onRollback) {
      onRollback(entry, version);
    }
  }, [entry, onRollback]);

  // Toggle version details
  const toggleVersionDetails = useCallback((version: number) => {
    setExpandedVersion(prev => prev === version ? null : version);
  }, []);

  // Format date
  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  // Calculate time ago
  const timeAgo = (date: Date | string): string => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(then);
  };

  // Get change type icon
  const getChangeIcon = (changeType: string): string => {
    switch (changeType) {
      case 'create': return '➕';
      case 'update': return '✏️';
      case 'delete': return '🗑️';
      case 'restore': return '🔄';
      default: return '📝';
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content version-history-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Version History</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading version history...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content version-history-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Version History</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="error-state">
              <p>Error loading version history: {error}</p>
              <button
                className="action-button primary"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!history || history.versions.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content version-history-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Version History</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="empty-state">
              <p>No version history available for this entry.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content version-history-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-info">
            <h3>Version History</h3>
            <p className="entry-title">"{entry.title}"</p>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Action Bar */}
          <div className="action-bar">
            <div className="selection-info">
              {selectedVersions.length === 0 && (
                <span>Select versions to compare</span>
              )}
              {selectedVersions.length === 1 && (
                <span>Select one more version to compare</span>
              )}
              {selectedVersions.length === 2 && (
                <span>Ready to compare versions {selectedVersions.join(' and ')}</span>
              )}
            </div>
            <div className="action-buttons">
              {selectedVersions.length === 2 && (
                <button
                  className="action-button primary"
                  onClick={handleCompare}
                >
                  Compare Versions
                </button>
              )}
              {selectedVersions.length > 0 && (
                <button
                  className="action-button secondary"
                  onClick={() => setSelectedVersions([])}
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Version List */}
          <div className="version-list">
            {history.versions.map((version, index) => {
              const isSelected = selectedVersions.includes(version.version);
              const isExpanded = expandedVersion === version.version;
              const isCurrent = index === 0;
              const change = history.changes.find(c => c.version === version.version);

              return (
                <div
                  key={version.version}
                  className={`version-item ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                >
                  <div className="version-header">
                    <div className="version-info">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleVersionSelect(version.version)}
                        aria-label={`Select version ${version.version}`}
                      />
                      <div className="version-details">
                        <div className="version-number">
                          Version {version.version}
                          {isCurrent && <span className="current-badge">Current</span>}
                        </div>
                        <div className="version-meta">
                          <span className="editor">{version.editor_name || 'Unknown'}</span>
                          <span className="separator">•</span>
                          <span className="timestamp">{timeAgo(version.created_at!)}</span>
                          {change && (
                            <>
                              <span className="separator">•</span>
                              <span className="change-type">
                                {getChangeIcon(change.change_type)} {change.change_type}
                              </span>
                            </>
                          )}
                        </div>
                        {version.change_summary && (
                          <div className="change-summary">{version.change_summary}</div>
                        )}
                        {version.changed_fields && version.changed_fields.length > 0 && (
                          <div className="changed-fields">
                            Changed: {version.changed_fields.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="version-actions">
                      <button
                        className="action-button small"
                        onClick={() => toggleVersionDetails(version.version)}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} details for version ${version.version}`}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                      {!isCurrent && (
                        <button
                          className="action-button small"
                          onClick={() => handleRollback(version.version)}
                          aria-label={`Rollback to version ${version.version}`}
                        >
                          🔄 Rollback
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="version-content">
                      <div className="content-section">
                        <h4>Title</h4>
                        <p>{version.title}</p>
                      </div>
                      <div className="content-section">
                        <h4>Problem</h4>
                        <p>{version.problem}</p>
                      </div>
                      <div className="content-section">
                        <h4>Solution</h4>
                        <p>{version.solution}</p>
                      </div>
                      <div className="content-section">
                        <h4>Category</h4>
                        <p>{version.category || 'None'}</p>
                      </div>
                      {version.tags && version.tags.length > 0 && (
                        <div className="content-section">
                          <h4>Tags</h4>
                          <div className="tags">
                            {version.tags.map((tag, tagIndex) => (
                              <span key={tagIndex} className="tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <span className="version-count">
            {history.versions.length} version{history.versions.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;