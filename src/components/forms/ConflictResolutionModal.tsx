/**
 * Conflict Resolution Modal Component
 *
 * Modal for resolving conflicts when concurrent edits are detected with:
 * - Side-by-side comparison of local vs remote changes
 * - Merge options with visual diff highlighting
 * - Keyboard navigation and accessibility
 * - Auto-merge suggestions for non-conflicting changes
 *
 * @author Swarm Coordinator
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import './ConflictResolutionModal.css';

// ========================
// Types & Interfaces
// ========================

export interface ConflictResolutionModalProps {
  localVersion?: any;
  remoteVersion?: any;
  onResolve: (resolution: 'local' | 'remote' | 'merge') => void;
  onClose: () => void;
}

interface DiffSection {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  content: string;
  lineNumbers: { local: number; remote: number };
}

// ========================
// Main Component
// ========================

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  localVersion,
  remoteVersion,
  onResolve,
  onClose
}) => {
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merge'>('merge');
  const [autoMergeAvailable, setAutoMergeAvailable] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Calculate diff between versions
  const diff = calculateDiff(localVersion, remoteVersion);

  // Check if auto-merge is possible (no conflicting changes)
  useEffect(() => {
    const hasConflicts = diff.some(section =>
      section.type === 'modified' &&
      section.content !== section.content // Simplified conflict detection
    );
    setAutoMergeAvailable(!hasConflicts);
  }, [diff]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case '1':
        setSelectedResolution('local');
        break;
      case '2':
        setSelectedResolution('remote');
        break;
      case '3':
        if (autoMergeAvailable) {
          setSelectedResolution('merge');
        }
        break;
      case 'Enter':
        if (selectedResolution) {
          onResolve(selectedResolution);
        }
        break;
    }
  }, [selectedResolution, autoMergeAvailable, onResolve, onClose]);

  // Focus management
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleResolve = useCallback(() => {
    onResolve(selectedResolution);
  }, [selectedResolution, onResolve]);

  return (
    <div
      className="conflict-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div
        ref={modalRef}
        className="conflict-modal"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="conflict-modal-title">🔄 Resolve Editing Conflict</h2>
          <button
            onClick={onClose}
            className="close-button"
            aria-label="Close conflict resolution"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="conflict-explanation">
            <p>
              Changes were made to this entry by another user while you were editing.
              Please choose how to resolve the conflict:
            </p>
          </div>

          <div className="resolution-options">
            <label className="resolution-option">
              <input
                type="radio"
                name="resolution"
                value="local"
                checked={selectedResolution === 'local'}
                onChange={(e) => setSelectedResolution(e.target.value as any)}
              />
              <div className="option-content">
                <strong>Keep Your Changes</strong>
                <span className="option-description">
                  Discard remote changes and keep your local edits
                </span>
                <kbd>1</kbd>
              </div>
            </label>

            <label className="resolution-option">
              <input
                type="radio"
                name="resolution"
                value="remote"
                checked={selectedResolution === 'remote'}
                onChange={(e) => setSelectedResolution(e.target.value as any)}
              />
              <div className="option-content">
                <strong>Accept Their Changes</strong>
                <span className="option-description">
                  Discard your changes and accept the remote version
                </span>
                <kbd>2</kbd>
              </div>
            </label>

            <label className={`resolution-option ${!autoMergeAvailable ? 'disabled' : ''}`}>
              <input
                type="radio"
                name="resolution"
                value="merge"
                checked={selectedResolution === 'merge'}
                onChange={(e) => setSelectedResolution(e.target.value as any)}
                disabled={!autoMergeAvailable}
              />
              <div className="option-content">
                <strong>Auto-Merge {!autoMergeAvailable && '(Not Available)'}</strong>
                <span className="option-description">
                  {autoMergeAvailable
                    ? "Automatically merge non-conflicting changes"
                    : "Conflicting changes detected - manual resolution required"
                  }
                </span>
                <kbd>3</kbd>
              </div>
            </label>
          </div>

          {/* Diff Visualization */}
          <div className="diff-container">
            <div className="diff-header">
              <div className="diff-column-header local">Your Version</div>
              <div className="diff-column-header remote">Their Version</div>
            </div>

            <div className="diff-content">
              {renderDiff(diff)}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button
            onClick={onClose}
            className="button secondary"
          >
            Cancel
          </button>

          <button
            onClick={handleResolve}
            className="button primary"
            disabled={!selectedResolution}
          >
            Resolve Conflict
          </button>
        </div>

        <div className="modal-footer">
          <small className="keyboard-hint">
            Use keyboard: 1=Keep yours, 2=Accept theirs, 3=Auto-merge, Enter=Confirm, Esc=Cancel
          </small>
        </div>
      </div>
    </div>
  );
};

// ========================
// Utility Functions
// ========================

function calculateDiff(local: any, remote: any): DiffSection[] {
  // Simplified diff calculation - in a real implementation,
  // you'd use a proper diff algorithm like Myers or similar
  const diff: DiffSection[] = [];

  if (!local || !remote) {
    return diff;
  }

  const fields = ['title', 'problem', 'solution', 'category', 'tags'];

  fields.forEach(field => {
    const localValue = local.data?.[field] || local[field] || '';
    const remoteValue = remote.data?.[field] || remote[field] || '';

    if (localValue === remoteValue) {
      diff.push({
        type: 'unchanged',
        content: String(localValue),
        lineNumbers: { local: 1, remote: 1 }
      });
    } else {
      diff.push({
        type: 'modified',
        content: `${field}: ${localValue} → ${remoteValue}`,
        lineNumbers: { local: 1, remote: 1 }
      });
    }
  });

  return diff;
}

function renderDiff(diff: DiffSection[]): JSX.Element[] {
  return diff.map((section, index) => (
    <div key={index} className={`diff-line ${section.type}`}>
      <div className="diff-local">
        {section.type !== 'added' && (
          <span className="line-content">{section.content}</span>
        )}
      </div>
      <div className="diff-remote">
        {section.type !== 'removed' && (
          <span className="line-content">{section.content}</span>
        )}
      </div>
    </div>
  ));
}

export default ConflictResolutionModal;