/**
 * Version Compare Modal Component
 *
 * Displays a side-by-side comparison of two versions of a KB entry,
 * highlighting differences and providing rollback options.
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { KBEntry } from '../../database/KnowledgeDB';
import {
  VersionControlService,
  VersionedEntry,
  ComparisonResult,
  FieldDiff
} from '../../services/VersionControlService';

// ========================
// Types & Interfaces
// ========================

export interface VersionCompareModalProps {
  entry: KBEntry;
  versionA: number;
  versionB: number;
  versionService: VersionControlService;
  onClose: () => void;
  onRollback?: (entry: KBEntry, targetVersion: number) => void;
}

interface VersionData {
  version: VersionedEntry;
  comparison: ComparisonResult;
}

// ========================
// Component
// ========================

export const VersionCompareModal: React.FC<VersionCompareModalProps> = ({
  entry,
  versionA,
  versionB,
  versionService,
  onClose,
  onRollback
}) => {
  const [data, setData] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightMode, setHighlightMode] = useState<'all' | 'changes-only'>('changes-only');

  // Load versions and comparison
  useEffect(() => {
    const loadComparison = async () => {
      setLoading(true);
      setError(null);

      try {
        const [versionAData, versionBData, comparisonResult] = await Promise.all([
          versionService.getVersion(entry.id!, versionA),
          versionService.getVersion(entry.id!, versionB),
          versionService.compareVersions(entry.id!, versionA, versionB)
        ]);

        if (!versionAData || !versionBData) {
          throw new Error('Could not load version data');
        }

        setData({
          version: { versionA: versionAData, versionB: versionBData } as any,
          comparison: comparisonResult
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comparison');
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [entry.id, versionA, versionB, versionService]);

  // Handle rollback
  const handleRollback = useCallback((targetVersion: number) => {
    if (onRollback) {
      onRollback(entry, targetVersion);
    }
  }, [entry, onRollback]);

  // Get field differences for a specific field
  const getFieldDiffs = (fieldName: string): FieldDiff[] => {
    if (!data) return [];
    return data.comparison.differences.filter(diff =>
      diff.field === fieldName || diff.field.startsWith(`${fieldName}[`)
    );
  };

  // Check if field has changes
  const hasFieldChanges = (fieldName: string): boolean => {
    return getFieldDiffs(fieldName).length > 0;
  };

  // Get change type for field
  const getFieldChangeType = (fieldName: string): 'added' | 'removed' | 'changed' | null => {
    const diffs = getFieldDiffs(fieldName);
    if (diffs.length === 0) return null;

    if (diffs.some(d => d.operation === 'changed')) return 'changed';
    if (diffs.some(d => d.operation === 'added')) return 'added';
    if (diffs.some(d => d.operation === 'removed')) return 'removed';
    return null;
  };

  // Render field comparison
  const renderFieldComparison = (
    fieldName: string,
    labelA: string,
    valueA: any,
    labelB: string,
    valueB: any
  ) => {
    const hasChanges = hasFieldChanges(fieldName);
    const changeType = getFieldChangeType(fieldName);

    if (highlightMode === 'changes-only' && !hasChanges) {
      return null;
    }

    // Handle array fields (tags)
    if (Array.isArray(valueA) || Array.isArray(valueB)) {
      return renderArrayFieldComparison(fieldName, labelA, valueA || [], labelB, valueB || []);
    }

    return (
      <div key={fieldName} className={`field-comparison ${hasChanges ? 'has-changes' : ''}`}>
        <div className="field-label">
          <h4>{fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}</h4>
          {hasChanges && (
            <span className={`change-indicator ${changeType}`}>
              {changeType === 'added' && '+ Added'}
              {changeType === 'removed' && '- Removed'}
              {changeType === 'changed' && '~ Changed'}
            </span>
          )}
        </div>
        <div className="field-values">
          <div className={`version-value version-a ${changeType === 'removed' ? 'removed' : ''}`}>
            <div className="version-label">{labelA}</div>
            <div className="value-content">
              {valueA || <span className="empty-value">Empty</span>}
            </div>
          </div>
          <div className={`version-value version-b ${changeType === 'added' ? 'added' : ''}`}>
            <div className="version-label">{labelB}</div>
            <div className="value-content">
              {valueB || <span className="empty-value">Empty</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render array field comparison (for tags)
  const renderArrayFieldComparison = (
    fieldName: string,
    labelA: string,
    valueA: string[],
    labelB: string,
    valueB: string[]
  ) => {
    const diffs = getFieldDiffs(fieldName);
    const addedItems = diffs.filter(d => d.operation === 'added').map(d => d.new_value);
    const removedItems = diffs.filter(d => d.operation === 'removed').map(d => d.old_value);

    return (
      <div key={fieldName} className="field-comparison array-field has-changes">
        <div className="field-label">
          <h4>{fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}</h4>
          <span className="change-indicator changed">
            {addedItems.length > 0 && `+${addedItems.length} added`}
            {addedItems.length > 0 && removedItems.length > 0 && ', '}
            {removedItems.length > 0 && `-${removedItems.length} removed`}
          </span>
        </div>
        <div className="field-values">
          <div className="version-value version-a">
            <div className="version-label">{labelA}</div>
            <div className="tags">
              {valueA.length === 0 ? (
                <span className="empty-value">No tags</span>
              ) : (
                valueA.map((tag, index) => (
                  <span
                    key={index}
                    className={`tag ${removedItems.includes(tag) ? 'removed' : ''}`}
                  >
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="version-value version-b">
            <div className="version-label">{labelB}</div>
            <div className="tags">
              {valueB.length === 0 ? (
                <span className="empty-value">No tags</span>
              ) : (
                valueB.map((tag, index) => (
                  <span
                    key={index}
                    className={`tag ${addedItems.includes(tag) ? 'added' : ''}`}
                  >
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Format date
  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content version-compare-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Comparing Versions</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading version comparison...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content version-compare-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Comparison Error</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="error-state">
              <p>Error loading comparison: {error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const versionAData = (data.version as any).versionA as VersionedEntry;
  const versionBData = (data.version as any).versionB as VersionedEntry;
  const comparison = data.comparison;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content version-compare-modal large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-info">
            <h3>Version Comparison</h3>
            <p className="entry-title">"{entry.title}"</p>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="comparison-header">
          <div className="version-info version-a">
            <h4>Version {versionA}</h4>
            <p>By {versionAData.editor_name || 'Unknown'}</p>
            <p>{formatDate(versionAData.created_at!)}</p>
          </div>
          <div className="comparison-stats">
            <div className="similarity-score">
              <span className="label">Similarity</span>
              <span className={`score ${comparison.similarity_score > 0.8 ? 'high' : comparison.similarity_score > 0.5 ? 'medium' : 'low'}`}>
                {Math.round(comparison.similarity_score * 100)}%
              </span>
            </div>
            <div className="change-impact">
              <span className="label">Impact</span>
              <span className={`impact ${comparison.impact_assessment}`}>
                {comparison.impact_assessment}
              </span>
            </div>
          </div>
          <div className="version-info version-b">
            <h4>Version {versionB}</h4>
            <p>By {versionBData.editor_name || 'Unknown'}</p>
            <p>{formatDate(versionBData.created_at!)}</p>
          </div>
        </div>

        <div className="comparison-controls">
          <div className="view-options">
            <label>
              <input
                type="radio"
                name="highlight-mode"
                checked={highlightMode === 'changes-only'}
                onChange={() => setHighlightMode('changes-only')}
              />
              Changes Only
            </label>
            <label>
              <input
                type="radio"
                name="highlight-mode"
                checked={highlightMode === 'all'}
                onChange={() => setHighlightMode('all')}
              />
              All Fields
            </label>
          </div>
          <div className="rollback-options">
            <button
              className="action-button secondary"
              onClick={() => handleRollback(versionA)}
            >
              🔄 Rollback to Version {versionA}
            </button>
            <button
              className="action-button secondary"
              onClick={() => handleRollback(versionB)}
            >
              🔄 Rollback to Version {versionB}
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="comparison-summary">
            <h4>Summary of Changes</h4>
            <p>{comparison.change_summary}</p>
            {comparison.differences.length === 0 && (
              <p className="no-changes">No differences found between these versions.</p>
            )}
          </div>

          <div className="field-comparisons">
            {renderFieldComparison(
              'title',
              `Version ${versionA}`,
              versionAData.title,
              `Version ${versionB}`,
              versionBData.title
            )}
            {renderFieldComparison(
              'problem',
              `Version ${versionA}`,
              versionAData.problem,
              `Version ${versionB}`,
              versionBData.problem
            )}
            {renderFieldComparison(
              'solution',
              `Version ${versionA}`,
              versionAData.solution,
              `Version ${versionB}`,
              versionBData.solution
            )}
            {renderFieldComparison(
              'category',
              `Version ${versionA}`,
              versionAData.category,
              `Version ${versionB}`,
              versionBData.category
            )}
            {renderFieldComparison(
              'tags',
              `Version ${versionA}`,
              versionAData.tags,
              `Version ${versionB}`,
              versionBData.tags
            )}
          </div>

          {highlightMode === 'changes-only' && comparison.differences.length === 0 && (
            <div className="no-visible-changes">
              <p>No changes to display. Switch to "All Fields" to see complete versions.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className="changes-count">
            {comparison.differences.length} change{comparison.differences.length === 1 ? '' : 's'} detected
          </span>
        </div>
      </div>
    </div>
  );
};

export default VersionCompareModal;