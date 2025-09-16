import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { X, Save, Archive, Copy, RotateCcw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../common/Button';
import { KBEntryForm } from '../forms/KBEntryForm';
import { DeleteConfirmationDialog } from '../dialogs/DeleteConfirmationDialog';
import { focusManager, AriaUtils, announceToScreenReader } from '../../utils/accessibility';
import { useAccessibleShortcuts } from '../../hooks/useUXEnhancements';
import { KBEntry } from '../kb-entry/KBEntryCard';
import { KBEntryFormData } from '../../types/form';
import './EditKBEntryModal.css';

interface EditKBEntryModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  
  /** KB entry to edit */
  entry?: KBEntry;
  
  /** Close handler */
  onClose: () => void;
  
  /** Save handler */
  onSave: (entryId: string, data: KBEntryFormData) => Promise<void>;
  
  /** Delete handler */
  onDelete?: (entryId: string) => Promise<void>;
  
  /** Archive handler */
  onArchive?: (entryId: string) => Promise<void>;
  
  /** Duplicate handler */
  onDuplicate?: (entry: KBEntry) => Promise<void>;
  
  /** Error handler */
  onError?: (error: Error) => void;
  
  /** Loading states */
  isSaving?: boolean;
  isDeleting?: boolean;
  isArchiving?: boolean;
  
  /** Feature flags */
  enableAutoSave?: boolean;
  enableDrafts?: boolean;
  showComparison?: boolean;
  showAdvancedActions?: boolean;
  
  /** Validation configuration */
  customValidation?: (data: KBEntryFormData) => Promise<string[]>;
  
  /** Available categories for dropdown */
  categories?: Array<{ value: string; label: string }>;
  
  /** Tag suggestions */
  tagSuggestions?: string[];
  
  /** User permissions */
  canDelete?: boolean;
  canArchive?: boolean;
  canDuplicate?: boolean;
}

interface UnsavedChangesState {
  hasChanges: boolean;
  changedFields: string[];
  lastSaved?: Date;
}

/**
 * Edit KB Entry Modal Component
 * 
 * Features:
 * - Pre-populated form with current entry values
 * - Field validation with real-time feedback
 * - Unsaved changes warning
 * - Auto-save functionality (optional)
 * - Change comparison view
 * - Advanced actions (delete, archive, duplicate)
 * - Keyboard shortcuts
 * - Accessibility support
 * - Draft management
 * - Error handling with user-friendly messages
 */
export const EditKBEntryModal = memo<EditKBEntryModalProps>({
  isOpen,
  entry,
  onClose,
  onSave,
  onDelete,
  onArchive,
  onDuplicate,
  onError,
  isSaving = false,
  isDeleting = false,
  isArchiving = false,
  enableAutoSave = false,
  enableDrafts = true,
  showComparison = false,
  showAdvancedActions = false,
  customValidation,
  categories,
  tagSuggestions,
  canDelete = true,
  canArchive = true,
  canDuplicate = true
}) => {
  const [unsavedChanges, setUnsavedChanges] = useState<UnsavedChangesState>({
    hasChanges: false,
    changedFields: []
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [originalData, setOriginalData] = useState<KBEntryFormData | null>(null);
  const [currentData, setCurrentData] = useState<KBEntryFormData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<any>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize form data when entry changes
  useEffect(() => {
    if (entry) {
      const formData: KBEntryFormData = {
        title: entry.title,
        problem: entry.problem,
        solution: entry.solution,
        category: entry.category,
        tags: entry.tags
      };
      setOriginalData(formData);
      setCurrentData(formData);
      setUnsavedChanges({ hasChanges: false, changedFields: [] });
    }
  }, [entry]);
  
  // Keyboard shortcuts
  useAccessibleShortcuts([
    {
      key: 'Escape',
      handler: handleClose,
      description: 'Close modal (with unsaved changes warning)'
    },
    {
      key: 's',
      ctrlKey: true,
      handler: handleSave,
      description: 'Save changes'
    },
    {
      key: 'd',
      ctrlKey: true,
      handler: () => onDuplicate?.(entry!),
      description: 'Duplicate entry',
      disabled: !canDuplicate || !entry
    }
  ]);
  
  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Store currently focused element
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      
      // Create focus trap
      focusTrapRef.current = focusManager.createFocusTrap('edit-kb-entry-modal', modalRef.current);
      focusTrapRef.current.activate();
      
      // Announce to screen readers
      const announcement = `Edit KB entry modal opened. ${entry?.title || 'Loading entry'}.`;
      announceToScreenReader(announcement, 'assertive');
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Cleanup
        if (focusTrapRef.current) {
          focusTrapRef.current.deactivate();
          focusManager.removeFocusTrap('edit-kb-entry-modal');
        }
        
        if (autoSaveTimeout.current) {
          clearTimeout(autoSaveTimeout.current);
        }
        
        // Restore focus
        if (previouslyFocusedElement.current) {
          focusManager.restoreFocus(previouslyFocusedElement.current);
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, entry?.title]);
  
  // Auto-save functionality
  useEffect(() => {
    if (enableAutoSave && unsavedChanges.hasChanges && currentData && entry) {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
      
      autoSaveTimeout.current = setTimeout(async () => {
        try {
          await onSave(entry.id, currentData);
          setLastAutoSave(new Date());
          setUnsavedChanges(prev => ({ ...prev, hasChanges: false }));
          announceToScreenReader('Changes auto-saved', 'polite');
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 2000);
    }
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [enableAutoSave, unsavedChanges.hasChanges, currentData, entry, onSave]);
  
  // Handle form data changes
  const handleFormChange = useCallback((data: KBEntryFormData) => {
    setCurrentData(data);
    
    if (originalData) {
      const changedFields = Object.keys(data).filter(key => {
        const currentValue = data[key as keyof KBEntryFormData];
        const originalValue = originalData[key as keyof KBEntryFormData];
        
        // Special handling for arrays (tags)
        if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
          return JSON.stringify(currentValue.sort()) !== JSON.stringify(originalValue.sort());
        }
        
        return currentValue !== originalValue;
      });
      
      setUnsavedChanges({
        hasChanges: changedFields.length > 0,
        changedFields,
        lastSaved: lastAutoSave || undefined
      });
    }
  }, [originalData, lastAutoSave]);
  
  // Custom validation
  const runCustomValidation = useCallback(async (data: KBEntryFormData): Promise<boolean> => {
    if (customValidation) {
      try {
        const errors = await customValidation(data);
        setValidationErrors(errors);
        return errors.length === 0;
      } catch (error) {
        console.error('Custom validation error:', error);
        setValidationErrors(['Validation failed. Please try again.']);
        return false;
      }
    }
    setValidationErrors([]);
    return true;
  }, [customValidation]);
  
  // Handle save
  const handleSave = useCallback(async () => {
    if (!entry || !currentData || isSaving) return;
    
    try {
      // Run custom validation if provided
      const isValid = await runCustomValidation(currentData);
      if (!isValid) {
        announceToScreenReader('Please fix validation errors before saving', 'assertive');
        return;
      }
      
      await onSave(entry.id, currentData);
      setOriginalData(currentData);
      setUnsavedChanges({ hasChanges: false, changedFields: [] });
      announceToScreenReader('Entry saved successfully', 'polite');
    } catch (error) {
      console.error('Save error:', error);
      onError?.(error as Error);
      announceToScreenReader('Failed to save entry. Please try again.', 'assertive');
    }
  }, [entry, currentData, isSaving, onSave, onError, runCustomValidation]);
  
  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (unsavedChanges.hasChanges) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }, [unsavedChanges.hasChanges, onClose]);
  
  // Force close without saving
  const handleForceClose = useCallback(() => {
    setShowUnsavedWarning(false);
    setUnsavedChanges({ hasChanges: false, changedFields: [] });
    onClose();
  }, [onClose]);
  
  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!entry || !onDelete) return;
    
    try {
      await onDelete(entry.id);
      announceToScreenReader('Entry deleted successfully', 'polite');
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      onError?.(error as Error);
    } finally {
      setShowDeleteDialog(false);
    }
  }, [entry, onDelete, onClose, onError]);
  
  // Handle archive
  const handleArchive = useCallback(async () => {
    if (!entry || !onArchive) return;
    
    try {
      await onArchive(entry.id);
      announceToScreenReader('Entry archived successfully', 'polite');
      onClose();
    } catch (error) {
      console.error('Archive error:', error);
      onError?.(error as Error);
    } finally {
      setShowArchiveDialog(false);
    }
  }, [entry, onArchive, onClose, onError]);
  
  // Handle duplicate
  const handleDuplicate = useCallback(async () => {
    if (!entry || !onDuplicate) return;
    
    try {
      await onDuplicate(entry);
      announceToScreenReader('Entry duplicated successfully', 'polite');
    } catch (error) {
      console.error('Duplicate error:', error);
      onError?.(error as Error);
    }
  }, [entry, onDuplicate, onError]);
  
  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);
  
  if (!isOpen || !entry) return null;
  
  const modalId = 'edit-kb-entry-modal';
  const titleId = `${modalId}-title`;
  
  return (
    <>
      {/* Main modal */}
      <div 
        className="edit-kb-entry-modal__backdrop"
        onClick={handleBackdropClick}
        data-testid="edit-modal-backdrop"
      >
        <div 
          ref={modalRef}
          className="edit-kb-entry-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="edit-kb-entry-modal"
        >
          {/* Header */}
          <header className="edit-kb-entry-modal__header">
            <div className="edit-kb-entry-modal__title-section">
              <h1 id={titleId} className="edit-kb-entry-modal__title">
                Edit KB Entry
              </h1>
              
              {/* Status indicators */}
              <div className="edit-kb-entry-modal__status">
                {unsavedChanges.hasChanges && (
                  <div className="edit-kb-entry-modal__unsaved-indicator" title="Unsaved changes">
                    <Clock size={14} />
                    Unsaved changes
                  </div>
                )}
                
                {enableAutoSave && lastAutoSave && (
                  <div className="edit-kb-entry-modal__auto-save-indicator" title="Last auto-saved">
                    <CheckCircle size={14} />
                    Auto-saved {lastAutoSave.toLocaleTimeString()}
                  </div>
                )}
                
                {validationErrors.length > 0 && (
                  <div className="edit-kb-entry-modal__validation-indicator" title="Validation errors">
                    <AlertTriangle size={14} />
                    {validationErrors.length} error{validationErrors.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
            
            {/* Header actions */}
            <div className="edit-kb-entry-modal__header-actions">
              {showAdvancedActions && (
                <>
                  {canDuplicate && (
                    <Button
                      onClick={handleDuplicate}
                      variant="ghost"
                      size="small"
                      title="Duplicate entry (Ctrl+D)"
                    >
                      <Copy size={16} />
                      Duplicate
                    </Button>
                  )}
                  
                  {canArchive && (
                    <Button
                      onClick={() => setShowArchiveDialog(true)}
                      variant="ghost"
                      size="small"
                      disabled={isArchiving}
                    >
                      <Archive size={16} />
                      Archive
                    </Button>
                  )}
                  
                  {canDelete && (
                    <Button
                      onClick={() => setShowDeleteDialog(true)}
                      variant="danger"
                      size="small"
                      disabled={isDeleting}
                    >
                      <Trash2 size={16} />
                      Delete
                    </Button>
                  )}
                </>
              )}
              
              <Button
                onClick={handleClose}
                variant="ghost"
                size="small"
                title="Close (Escape)"
                aria-label="Close modal"
              >
                <X size={16} />
              </Button>
            </div>
          </header>
          
          {/* Validation errors display */}
          {validationErrors.length > 0 && (
            <div className="edit-kb-entry-modal__validation-errors" role="alert">
              <h3>Please correct the following errors:</h3>
              <ul>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Change comparison view */}
          {showComparison && unsavedChanges.hasChanges && originalData && currentData && (
            <div className="edit-kb-entry-modal__comparison">
              <h3>Changed Fields:</h3>
              <div className="edit-kb-entry-modal__changes">
                {unsavedChanges.changedFields.map(field => {
                  const original = originalData[field as keyof KBEntryFormData];
                  const current = currentData[field as keyof KBEntryFormData];
                  
                  return (
                    <div key={field} className="edit-kb-entry-modal__change">
                      <div className="edit-kb-entry-modal__change-field">{field}:</div>
                      <div className="edit-kb-entry-modal__change-diff">
                        <div className="edit-kb-entry-modal__change-original">
                          <strong>Original:</strong> {Array.isArray(original) ? original.join(', ') : String(original)}
                        </div>
                        <div className="edit-kb-entry-modal__change-current">
                          <strong>New:</strong> {Array.isArray(current) ? current.join(', ') : String(current)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Form content */}
          <div className="edit-kb-entry-modal__content">
            <KBEntryForm
              initialData={originalData || undefined}
              onSubmit={async (data) => {
                setCurrentData(data);
                await handleSave();
              }}
              onCancel={handleClose}
              onError={onError}
              mode="edit"
              autoSave={enableAutoSave}
              enableDrafts={enableDrafts}
              showAdvancedOptions={showAdvancedActions}
            />
          </div>
          
          {/* Footer actions */}
          <footer className="edit-kb-entry-modal__footer">
            <div className="edit-kb-entry-modal__footer-left">
              {unsavedChanges.hasChanges && (
                <Button
                  onClick={() => {
                    setCurrentData(originalData);
                    setUnsavedChanges({ hasChanges: false, changedFields: [] });
                    announceToScreenReader('Changes reverted', 'polite');
                  }}
                  variant="ghost"
                  size="small"
                  title="Revert all changes"
                >
                  <RotateCcw size={16} />
                  Revert Changes
                </Button>
              )}
            </div>
            
            <div className="edit-kb-entry-modal__footer-right">
              <Button
                onClick={handleClose}
                variant="secondary"
                disabled={isSaving}
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleSave}
                variant="primary"
                disabled={!unsavedChanges.hasChanges || isSaving || validationErrors.length > 0}
                loading={isSaving}
                title="Save changes (Ctrl+S)"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </footer>
          
          {/* Keyboard shortcuts help */}
          <div className="edit-kb-entry-modal__shortcuts">
            <details>
              <summary>Keyboard Shortcuts</summary>
              <ul>
                <li><kbd>Ctrl+S</kbd> - Save changes</li>
                <li><kbd>Ctrl+D</kbd> - Duplicate entry</li>
                <li><kbd>Escape</kbd> - Close modal</li>
              </ul>
            </details>
          </div>
        </div>
      </div>
      
      {/* Unsaved changes warning dialog */}
      {showUnsavedWarning && (
        <DeleteConfirmationDialog
          isOpen={showUnsavedWarning}
          title="Unsaved Changes"
          description="You have unsaved changes that will be lost if you continue."
          itemName="Unsaved changes"
          itemType="changes"
          warningMessage="All modifications will be lost and cannot be recovered."
          deleteButtonText="Discard Changes"
          cancelButtonText="Keep Editing"
          variant="warning"
          requireTwoStepConfirmation={false}
          onConfirm={handleForceClose}
          onCancel={() => setShowUnsavedWarning(false)}
          metadata={[
            { label: 'Changed fields', value: unsavedChanges.changedFields.join(', ') },
            { label: 'Entry', value: entry.title }
          ]}
        />
      )}
      
      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <DeleteConfirmationDialog
          isOpen={showDeleteDialog}
          title="Delete KB Entry"
          description="This will permanently delete the knowledge base entry."
          itemName={entry.title}
          itemType="KB entry"
          warningMessage="This entry may be referenced by other entries or used in search results."
          requireTwoStepConfirmation={true}
          expectedConfirmationInput={entry.title}
          isDeleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
          metadata={[
            { label: 'Category', value: entry.category },
            { label: 'Usage count', value: entry.usage_count.toString() },
            { label: 'Success rate', value: `${Math.round((entry.success_count / entry.usage_count) * 100)}%` },
            { label: 'Created', value: entry.created_at.toLocaleDateString() }
          ]}
          relatedItems={[
            { name: 'Search results', type: 'searches that may reference this entry' },
            { name: 'User bookmarks', type: 'saved references', count: entry.usage_count }
          ]}
        />
      )}
      
      {/* Archive confirmation dialog */}
      {showArchiveDialog && (
        <DeleteConfirmationDialog
          isOpen={showArchiveDialog}
          title="Archive KB Entry"
          description="This will move the entry to the archive. It can be restored later."
          itemName={entry.title}
          itemType="KB entry"
          deleteButtonText="Archive"
          variant="caution"
          isDeleting={isArchiving}
          onConfirm={handleArchive}
          onCancel={() => setShowArchiveDialog(false)}
          metadata={[
            { label: 'Category', value: entry.category },
            { label: 'Usage count', value: entry.usage_count.toString() }
          ]}
        />
      )}
    </>
  );
});

EditKBEntryModal.displayName = 'EditKBEntryModal';