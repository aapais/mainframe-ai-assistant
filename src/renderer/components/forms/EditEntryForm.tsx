/**
 * Edit Knowledge Base Entry Form
 * Specialized form component for editing existing KB entries with enhanced features
 */

import React, { useState, useEffect, useCallback } from 'react';
import { KBEntryForm } from './KBEntryForm';
import { Button } from '../common/Button';
import { KBEntry } from '../../types';
import './EditEntryForm.css';

interface EditEntryFormProps {
  entry: KBEntry;
  onSubmit: (data: Partial<KBEntry>) => Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
  onArchive?: (entryId: string) => Promise<void>;
  onDuplicate?: (entry: KBEntry) => Promise<void>;
  autoSave?: boolean;
  showComparison?: boolean;
  showAdvancedActions?: boolean;
}

interface ChangeComparison {
  field: string;
  original: string;
  updated: string;
  hasChanged: boolean;
}

/**
 * EditEntryForm - Enhanced editing experience for KB entries
 * 
 * Features:
 * - Side-by-side comparison view
 * - Change tracking and highlighting
 * - Archive and duplicate functionality
 * - Version history (if available)
 * - Confirmation dialogs for destructive actions
 * - Auto-save with conflict detection
 */
export const EditEntryForm: React.FC<EditEntryFormProps> = ({
  entry,
  onSubmit,
  onCancel,
  onError,
  onArchive,
  onDuplicate,
  autoSave = true,
  showComparison = false,
  showAdvancedActions = true
}) => {
  const [showChanges, setShowChanges] = useState(showComparison);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [changes, setChanges] = useState<ChangeComparison[]>([]);
  const [lastSavedData, setLastSavedData] = useState(entry);

  // Track changes for comparison
  const handleFormChange = useCallback((newData: any) => {
    const comparisons: ChangeComparison[] = [
      {
        field: 'title',
        original: entry.title,
        updated: newData.title || '',
        hasChanged: entry.title !== (newData.title || '')
      },
      {
        field: 'problem',
        original: entry.problem,
        updated: newData.problem || '',
        hasChanged: entry.problem !== (newData.problem || '')
      },
      {
        field: 'solution',
        original: entry.solution,
        updated: newData.solution || '',
        hasChanged: entry.solution !== (newData.solution || '')
      },
      {
        field: 'category',
        original: entry.category,
        updated: newData.category || '',
        hasChanged: entry.category !== (newData.category || '')
      },
      {
        field: 'tags',
        original: (entry.tags || []).join(', '),
        updated: (newData.tags || []).join(', '),
        hasChanged: JSON.stringify(entry.tags || []) !== JSON.stringify(newData.tags || [])
      }
    ];

    setChanges(comparisons.filter(c => c.hasChanged));
  }, [entry]);

  // Enhanced submit handler with change tracking
  const handleSubmit = useCallback(async (formData: any) => {
    try {
      // Create update object with only changed fields
      const updateData: Partial<KBEntry> = {
        id: entry.id
      };

      // Only include changed fields
      if (formData.title !== entry.title) updateData.title = formData.title;
      if (formData.problem !== entry.problem) updateData.problem = formData.problem;
      if (formData.solution !== entry.solution) updateData.solution = formData.solution;
      if (formData.category !== entry.category) updateData.category = formData.category;
      if (formData.severity !== entry.severity) updateData.severity = formData.severity;
      if (JSON.stringify(formData.tags) !== JSON.stringify(entry.tags)) {
        updateData.tags = formData.tags;
      }

      await onSubmit(updateData);
      setLastSavedData({ ...entry, ...updateData });
    } catch (error) {
      console.error('Edit submission error:', error);
      if (onError) {
        onError(error as Error);
      }
      throw error;
    }
  }, [entry, onSubmit, onError]);

  // Archive entry with confirmation
  const handleArchive = useCallback(async () => {
    if (!onArchive) return;

    const confirmed = window.confirm(
      'Are you sure you want to archive this entry? It will no longer appear in search results but can be restored later.'
    );

    if (confirmed) {
      setIsArchiving(true);
      try {
        await onArchive(entry.id!);
      } catch (error) {
        console.error('Archive error:', error);
        if (onError) {
          onError(error as Error);
        }
      } finally {
        setIsArchiving(false);
      }
    }
  }, [entry.id, onArchive, onError]);

  // Duplicate entry
  const handleDuplicate = useCallback(async () => {
    if (!onDuplicate) return;

    const confirmed = window.confirm(
      'This will create a copy of this entry that you can modify. Continue?'
    );

    if (confirmed) {
      setIsDuplicating(true);
      try {
        await onDuplicate(entry);
      } catch (error) {
        console.error('Duplicate error:', error);
        if (onError) {
          onError(error as Error);
        }
      } finally {
        setIsDuplicating(false);
      }
    }
  }, [entry, onDuplicate, onError]);

  return (
    <div className="edit-entry-form">
      <div className="edit-entry-form__header">
        <div className="edit-entry-form__title">
          <h2>Edit Knowledge Entry</h2>
          <div className="edit-entry-form__entry-info">
            <span className="edit-entry-form__entry-id">
              ID: {entry.id?.substring(0, 8)}...
            </span>
            {entry.created_at && (
              <span className="edit-entry-form__entry-date">
                Created: {new Date(entry.created_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="edit-entry-form__header-actions">
          {showAdvancedActions && (
            <>
              {onDuplicate && (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={handleDuplicate}
                  loading={isDuplicating}
                  title="Create a copy of this entry"
                >
                  Duplicate
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => setShowChanges(!showChanges)}
                title="Toggle change comparison view"
              >
                {showChanges ? 'Hide Changes' : 'Show Changes'}
              </Button>

              {onArchive && (
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={handleArchive}
                  loading={isArchiving}
                  title="Archive this entry (can be restored later)"
                >
                  Archive
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Change Comparison View */}
      {showChanges && changes.length > 0 && (
        <div className="edit-entry-form__changes">
          <h3>Changes Summary</h3>
          <div className="edit-entry-form__changes-list">
            {changes.map((change) => (
              <div key={change.field} className="edit-entry-form__change-item">
                <div className="edit-entry-form__change-header">
                  <strong>{change.field.charAt(0).toUpperCase() + change.field.slice(1)}</strong>
                </div>
                <div className="edit-entry-form__change-comparison">
                  <div className="edit-entry-form__change-before">
                    <label>Before:</label>
                    <div className="edit-entry-form__change-content">
                      {change.original || '<empty>'}
                    </div>
                  </div>
                  <div className="edit-entry-form__change-after">
                    <label>After:</label>
                    <div className="edit-entry-form__change-content">
                      {change.updated || '<empty>'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entry Statistics */}
      <div className="edit-entry-form__stats">
        <div className="edit-entry-form__stat">
          <span className="edit-entry-form__stat-label">Usage:</span>
          <span className="edit-entry-form__stat-value">
            {entry.usage_count || 0} times
          </span>
        </div>
        <div className="edit-entry-form__stat">
          <span className="edit-entry-form__stat-label">Success Rate:</span>
          <span className="edit-entry-form__stat-value">
            {entry.success_count && entry.failure_count
              ? Math.round((entry.success_count / (entry.success_count + entry.failure_count)) * 100)
              : 'N/A'
            }%
          </span>
        </div>
        {entry.last_used && (
          <div className="edit-entry-form__stat">
            <span className="edit-entry-form__stat-label">Last Used:</span>
            <span className="edit-entry-form__stat-value">
              {new Date(entry.last_used).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Main Form */}
      <KBEntryForm
        initialData={{
          title: entry.title,
          problem: entry.problem,
          solution: entry.solution,
          category: entry.category as any,
          severity: entry.severity,
          tags: entry.tags || []
        }}
        mode="edit"
        onSubmit={handleSubmit}
        onCancel={onCancel}
        onError={onError}
        autoSave={autoSave}
        enableDrafts={true}
        showAdvancedOptions={true}
      />
    </div>
  );
};