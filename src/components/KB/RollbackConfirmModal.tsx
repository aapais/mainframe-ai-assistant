/**
 * Rollback Confirmation Modal Component
 *
 * Provides a confirmation dialog for rolling back a KB entry to a previous version,
 * with options for rollback strategy and change summary.
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { KBEntry } from '../../database/KnowledgeDB';

// ========================
// Types & Interfaces
// ========================

export interface RollbackConfirmModalProps {
  entry: KBEntry;
  targetVersion: number;
  onConfirm: (entry: KBEntry, targetVersion: number, changeSummary?: string, strategy?: 'overwrite' | 'selective' | 'merge') => Promise<void>;
  onCancel: () => void;
}

type RollbackStrategy = 'overwrite' | 'selective' | 'merge';

// ========================
// Component
// ========================

export const RollbackConfirmModal: React.FC<RollbackConfirmModalProps> = ({
  entry,
  targetVersion,
  onConfirm,
  onCancel
}) => {
  const [strategy, setStrategy] = useState<RollbackStrategy>('overwrite');
  const [changeSummary, setChangeSummary] = useState('');
  const [preserveFields, setPreserveFields] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle confirm rollback
  const handleConfirm = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onConfirm(
        entry,
        targetVersion,
        changeSummary || `Rolled back to version ${targetVersion}`,
        strategy
      );
    } catch (error) {
      console.error('Rollback confirmation failed:', error);
      setIsProcessing(false);
    }
  }, [entry, targetVersion, changeSummary, strategy, onConfirm]);

  // Handle field preservation toggle
  const handleFieldToggle = useCallback((fieldName: string) => {
    setPreserveFields(prev => {
      if (prev.includes(fieldName)) {
        return prev.filter(f => f !== fieldName);
      }
      return [...prev, fieldName];
    });
  }, []);

  // Get strategy description
  const getStrategyDescription = (strategyType: RollbackStrategy): string => {
    switch (strategyType) {
      case 'overwrite':
        return 'Replace all current content with the selected version. This is the simplest and most common approach.';
      case 'selective':
        return 'Keep some current fields and restore others from the selected version. Choose which fields to preserve below.';
      case 'merge':
        return 'Attempt to intelligently merge changes between versions. May require manual conflict resolution.';
      default:
        return '';
    }
  };

  // Get strategy warning
  const getStrategyWarning = (strategyType: RollbackStrategy): string | null => {
    switch (strategyType) {
      case 'overwrite':
        return 'All current changes will be lost and cannot be recovered.';
      case 'selective':
        return 'Only selected fields will be preserved from the current version.';
      case 'merge':
        return 'Merge conflicts may occur and require manual resolution.';
      default:
        return null;
    }
  };

  const strategyDescription = getStrategyDescription(strategy);
  const strategyWarning = getStrategyWarning(strategy);

  return (
    <div className="modal-overlay" onClick={!isProcessing ? onCancel : undefined}>
      <div className="modal-content rollback-confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Confirm Rollback</h3>
          <button
            className="close-button"
            onClick={onCancel}
            disabled={isProcessing}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="rollback-info">
            <h4>Entry: "{entry.title}"</h4>
            <p>You are about to rollback this entry to <strong>version {targetVersion}</strong>.</p>
          </div>

          <div className="strategy-section">
            <h4>Rollback Strategy</h4>

            <div className="strategy-options">
              <label className={`strategy-option ${strategy === 'overwrite' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="strategy"
                  value="overwrite"
                  checked={strategy === 'overwrite'}
                  onChange={() => setStrategy('overwrite')}
                  disabled={isProcessing}
                />
                <div className="strategy-info">
                  <div className="strategy-name">Complete Overwrite</div>
                  <div className="strategy-desc">Replace everything with version {targetVersion}</div>
                </div>
              </label>

              <label className={`strategy-option ${strategy === 'selective' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="strategy"
                  value="selective"
                  checked={strategy === 'selective'}
                  onChange={() => setStrategy('selective')}
                  disabled={isProcessing}
                />
                <div className="strategy-info">
                  <div className="strategy-name">Selective Rollback</div>
                  <div className="strategy-desc">Keep some current fields, restore others</div>
                </div>
              </label>

              <label className={`strategy-option ${strategy === 'merge' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="strategy"
                  value="merge"
                  checked={strategy === 'merge'}
                  onChange={() => setStrategy('merge')}
                  disabled={isProcessing}
                />
                <div className="strategy-info">
                  <div className="strategy-name">Smart Merge</div>
                  <div className="strategy-desc">Intelligently merge versions (advanced)</div>
                </div>
              </label>
            </div>

            <div className="strategy-explanation">
              <p>{strategyDescription}</p>
              {strategyWarning && (
                <div className="strategy-warning">
                  <strong>Warning:</strong> {strategyWarning}
                </div>
              )}
            </div>
          </div>

          {strategy === 'selective' && (
            <div className="preserve-fields-section">
              <h4>Fields to Preserve from Current Version</h4>
              <div className="field-checkboxes">
                {['title', 'problem', 'solution', 'category', 'tags'].map(fieldName => (
                  <label key={fieldName} className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={preserveFields.includes(fieldName)}
                      onChange={() => handleFieldToggle(fieldName)}
                      disabled={isProcessing}
                    />
                    <span className="field-name">
                      {fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
              {preserveFields.length === 0 && (
                <div className="field-warning">
                  No fields selected - this will behave like complete overwrite.
                </div>
              )}
            </div>
          )}

          <div className="change-summary-section">
            <h4>Change Summary (Optional)</h4>
            <textarea
              className="change-summary-input"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder={`Rolled back to version ${targetVersion}`}
              rows={3}
              disabled={isProcessing}
            />
            <small>This summary will be recorded in the version history.</small>
          </div>

          <div className="impact-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <h4>Important</h4>
              <ul>
                <li>This action will create a new version in the history</li>
                <li>The current version will be preserved but no longer active</li>
                <li>You can rollback again if needed</li>
                <li>All changes will be logged for audit purposes</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="action-buttons">
            <button
              className="action-button secondary"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              className="action-button danger"
              onClick={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="spinner small"></div>
                  Processing...
                </>
              ) : (
                <>🔄 Confirm Rollback</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RollbackConfirmModal;