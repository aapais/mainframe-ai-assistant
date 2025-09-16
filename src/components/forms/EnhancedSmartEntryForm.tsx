/**
 * Enhanced Smart Entry Form Component
 *
 * Advanced KB entry creation/editing form with:
 * - Rich text editing for problem/solution fields
 * - Auto-save functionality with visual feedback
 * - Draft management system
 * - Keyboard shortcuts for power users
 * - Optimistic UI updates
 * - Conflict resolution for concurrent edits
 * - Enhanced accessibility compliance (WCAG 2.1 AA)
 *
 * @author Swarm Coordinator
 * @version 2.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
  KeyboardEvent
} from 'react';
import { debounce } from 'lodash';
import { KnowledgeDB, KBEntry } from '../../database/KnowledgeDB';
import { KBCategory } from '../../types/services';
import { useKBData } from '../../hooks/useKBData';
import { useFormValidation } from '../../hooks/useFormValidation';
import { useDraftManager } from '../../hooks/useDraftManager';
import { RichTextEditor } from './RichTextEditor';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { DraftManagerPanel } from './DraftManagerPanel';
import './EnhancedSmartEntryForm.css';

// ========================
// Types & Interfaces (Enhanced)
// ========================

export interface EnhancedSmartEntryFormProps {
  className?: string;
  db: KnowledgeDB;
  entry?: KBEntry;
  initialValues?: Partial<KBEntry>;
  templates?: KBTemplate[];
  config?: {
    enableTemplates: boolean;
    enableAutoComplete: boolean;
    enableDuplicateDetection: boolean;
    enableRichTextEditor: boolean;
    enableAISuggestions: boolean;
    enableAutoSave: boolean;
    enableDraftManager: boolean;
    enableKeyboardShortcuts: boolean;
    enableOptimisticUpdates: boolean;
    duplicateThreshold: number;
    suggestionDelay: number;
    autoSaveInterval: number;
  };
  onSubmit?: (entry: Omit<KBEntry, 'id'>) => Promise<void>;
  onCancel?: () => void;
  onDuplicatesFound?: (duplicates: DuplicateEntry[]) => void;
  onTemplateSelect?: (template: KBTemplate) => void;
  onFieldChange?: (field: string, value: any) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
  onAutoSave?: (entry: Partial<KBEntry>) => Promise<void>;
  onConflict?: (localVersion: any, remoteVersion: any) => void;
  ariaLabel?: string;
  autoFocus?: boolean;
  enableRealTimeCollaboration?: boolean;
}

export interface EnhancedSmartEntryFormRef {
  submit: () => Promise<boolean>;
  reset: () => void;
  validate: () => boolean;
  fillTemplate: (template: KBTemplate) => void;
  focusFirstError: () => void;
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  exportDraft: () => string;
  importDraft: (data: string) => void;
}

interface FormData {
  title: string;
  problem: string;
  solution: string;
  category: KBCategory | '';
  tags: string[];
}

interface FormState {
  data: FormData;
  suggestions: Record<string, FormSuggestion[]>;
  duplicates: DuplicateEntry[];
  selectedTemplate: KBTemplate | null;
  showTemplates: boolean;
  showDuplicates: boolean;
  showDraftManager: boolean;
  showConflictModal: boolean;
  isSubmitting: boolean;
  isOptimisticUpdate: boolean;
  touchedFields: Set<string>;
}

// ========================
// Default Configuration
// ========================

const DEFAULT_CONFIG = {
  enableTemplates: true,
  enableAutoComplete: true,
  enableDuplicateDetection: true,
  enableRichTextEditor: true,
  enableAISuggestions: true,
  enableAutoSave: true,
  enableDraftManager: true,
  enableKeyboardShortcuts: true,
  enableOptimisticUpdates: true,
  duplicateThreshold: 0.7,
  suggestionDelay: 300,
  autoSaveInterval: 30000,
};

// ========================
// Keyboard Shortcuts
// ========================

const KEYBOARD_SHORTCUTS = {
  'Ctrl+S': 'Save draft',
  'Ctrl+Shift+S': 'Submit entry',
  'Ctrl+D': 'Toggle draft manager',
  'Ctrl+T': 'Toggle templates',
  'Ctrl+K': 'Focus search/tags',
  'Ctrl+/': 'Show shortcuts help',
  'Ctrl+Z': 'Undo (in rich text fields)',
  'Ctrl+Y': 'Redo (in rich text fields)',
  'Escape': 'Cancel/close modals',
};

// ========================
// Main Component
// ========================

export const EnhancedSmartEntryForm = forwardRef<EnhancedSmartEntryFormRef, EnhancedSmartEntryFormProps>(({
  className = '',
  db,
  entry,
  initialValues = {},
  templates = [],
  config = DEFAULT_CONFIG,
  ariaLabel = 'Enhanced knowledge base entry form',
  autoFocus = true,
  enableRealTimeCollaboration = false,
  onSubmit,
  onCancel,
  onDuplicatesFound,
  onTemplateSelect,
  onFieldChange,
  onValidationChange,
  onAutoSave,
  onConflict
}, ref) => {
  // Refs
  const titleInputRef = useRef<HTMLInputElement>(null);
  const problemEditorRef = useRef<any>(null);
  const solutionEditorRef = useRef<any>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Initialize form data
  const initialData: FormData = {
    title: entry?.title || initialValues.title || '',
    problem: entry?.problem || initialValues.problem || '',
    solution: entry?.solution || initialValues.solution || '',
    category: entry?.category || initialValues.category || '',
    tags: entry?.tags || initialValues.tags || []
  };

  // State management
  const [state, setState] = useState<FormState>({
    data: initialData,
    suggestions: {},
    duplicates: [],
    selectedTemplate: null,
    showTemplates: false,
    showDuplicates: false,
    showDraftManager: false,
    showConflictModal: false,
    isSubmitting: false,
    isOptimisticUpdate: false,
    touchedFields: new Set()
  });

  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Custom hooks
  const { searchEntries, getSuggestions } = useKBData(db, {
    autoLoadEntries: false
  });

  const {
    errors,
    isValid,
    validate,
    validateField,
    clearErrors,
    setFieldTouched
  } = useFormValidation(
    {
      title: { required: true, minLength: 5, maxLength: 200 },
      problem: { required: true, minLength: 20, maxLength: 2000 },
      solution: { required: true, minLength: 20, maxLength: 5000 },
      category: { required: true },
      tags: { minItems: 1, maxItems: 10 }
    },
    state.data
  );

  // Draft management
  const {
    draftData,
    saveState,
    metadata: draftMetadata,
    versions,
    updateDraft,
    saveDraft: saveDraftInternal,
    loadDraft,
    createDraft,
    getDraftsList,
    exportDraft,
    importDraft,
    resolveConflict,
  } = useDraftManager({
    autoSaveInterval: config.autoSaveInterval,
    enableConflictDetection: enableRealTimeCollaboration,
    onSave: async (data) => {
      if (onAutoSave) {
        await onAutoSave({
          id: entry?.id,
          title: data.title,
          problem: data.problem,
          solution: data.solution,
          category: data.category as KBCategory,
          tags: data.tags,
        });
      }
    },
    onConflict: (local, remote) => {
      setState(prev => ({ ...prev, showConflictModal: true }));
      onConflict?.(local, remote);
    },
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<FormState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Sync form data with draft data
  useEffect(() => {
    if (draftData && config.enableDraftManager) {
      setState(prev => ({
        ...prev,
        data: {
          title: draftData.title,
          problem: draftData.problem,
          solution: draftData.solution,
          category: draftData.category as KBCategory | '',
          tags: draftData.tags,
        }
      }));
    }
  }, [draftData, config.enableDraftManager]);

  // Update form data with optimistic updates
  const updateFormData = useCallback((field: keyof FormData, value: any) => {
    const newData = { ...state.data, [field]: value };

    // Optimistic UI update
    if (config.enableOptimisticUpdates) {
      updateState({
        data: newData,
        isOptimisticUpdate: true,
        touchedFields: new Set([...state.touchedFields, field])
      });

      // Revert optimistic update after delay if needed
      setTimeout(() => {
        updateState({ isOptimisticUpdate: false });
      }, 300);
    } else {
      updateState({
        data: newData,
        touchedFields: new Set([...state.touchedFields, field])
      });
    }

    // Update draft if enabled
    if (config.enableDraftManager) {
      updateDraft({ [field]: value });
    }

    // Mark field as touched
    setFieldTouched(field);

    // Trigger field change event
    onFieldChange?.(field, value);

    // Validate field
    validateField(field, value);
  }, [state.data, state.touchedFields, config, updateState, updateDraft, setFieldTouched, onFieldChange, validateField]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLFormElement>) => {
    if (!config.enableKeyboardShortcuts) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          if (e.shiftKey) {
            handleSubmit();
          } else {
            handleSaveDraft();
          }
          break;
        case 'd':
          e.preventDefault();
          updateState({ showDraftManager: !state.showDraftManager });
          break;
        case 't':
          e.preventDefault();
          updateState({ showTemplates: !state.showTemplates });
          break;
        case 'k':
          e.preventDefault();
          // Focus first input or tags field
          const tagsInput = document.querySelector('.tag-input') as HTMLInputElement;
          tagsInput?.focus();
          break;
        case '/':
          e.preventDefault();
          setShowShortcutsHelp(true);
          break;
      }
    }

    if (e.key === 'Escape') {
      if (state.showConflictModal) {
        updateState({ showConflictModal: false });
      } else if (state.showDraftManager) {
        updateState({ showDraftManager: false });
      } else if (state.showTemplates) {
        updateState({ showTemplates: false });
      } else if (showShortcutsHelp) {
        setShowShortcutsHelp(false);
      }
    }
  }, [config, state, updateState, showShortcutsHelp]);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!validate()) {
      focusFirstError();
      return false;
    }

    updateState({ isSubmitting: true });

    try {
      const entryData: Omit<KBEntry, 'id'> = {
        title: state.data.title.trim(),
        problem: state.data.problem.trim(),
        solution: state.data.solution.trim(),
        category: state.data.category as KBCategory,
        tags: state.data.tags.filter(Boolean),
        created_at: entry?.created_at || new Date(),
        updated_at: new Date(),
        usage_count: entry?.usage_count || 0,
        success_count: entry?.success_count || 0,
        failure_count: entry?.failure_count || 0
      };

      await onSubmit?.(entryData);

      updateState({ isSubmitting: false });
      return true;
    } catch (error) {
      console.error('Form submission failed:', error);
      updateState({ isSubmitting: false });
      return false;
    }
  }, [validate, state.data, entry, updateState, onSubmit]);

  // Handle draft save
  const handleSaveDraft = useCallback(async () => {
    if (!config.enableDraftManager) return;

    try {
      await saveDraftInternal();
    } catch (error) {
      console.error('Draft save failed:', error);
    }
  }, [config, saveDraftInternal]);

  // Focus first error field
  const focusFirstError = useCallback(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const field = errorFields[0];
    const element = field === 'title' ? titleInputRef.current :
                   field === 'problem' ? problemEditorRef.current :
                   field === 'solution' ? solutionEditorRef.current :
                   null;

    if (element) {
      if (element.focus) {
        element.focus();
      } else if (element.current?.focus) {
        element.current.focus();
      }
    }
  }, [errors]);

  // Handle conflict resolution
  const handleConflictResolution = useCallback((resolution: 'local' | 'remote' | 'merge') => {
    resolveConflict(resolution);
    updateState({ showConflictModal: false });
  }, [resolveConflict, updateState]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    submit: handleSubmit,
    reset: () => {
      updateState({
        data: initialData,
        suggestions: {},
        duplicates: [],
        selectedTemplate: null,
        showTemplates: false,
        showDuplicates: false,
        isSubmitting: false,
        touchedFields: new Set()
      });
      clearErrors();
    },
    validate: () => validate(),
    fillTemplate: (template) => {
      // Implementation for template filling
    },
    focusFirstError,
    saveDraft: handleSaveDraft,
    loadDraft,
    exportDraft,
    importDraft
  }), [handleSubmit, handleSaveDraft, loadDraft, exportDraft, importDraft, validate, clearErrors, focusFirstError, initialData, updateState]);

  // Auto-focus first field
  useEffect(() => {
    if (autoFocus && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  // Validation change callback
  useEffect(() => {
    onValidationChange?.(isValid, errors);
  }, [isValid, errors, onValidationChange]);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className={`enhanced-smart-entry-form ${className} ${state.isOptimisticUpdate ? 'optimistic-update' : ''}`}
      role="form"
      aria-label={ariaLabel}
      noValidate
    >
      {/* Auto-save indicator */}
      {config.enableAutoSave && (
        <div className="auto-save-status" role="status" aria-live="polite">
          <span className={`status-indicator ${saveState.status}`}>
            {saveState.status === 'saving' && '💾 Saving...'}
            {saveState.status === 'saved' && '✅ Saved'}
            {saveState.status === 'error' && '❌ Save failed'}
            {saveState.status === 'idle' && saveState.hasUnsavedChanges && '● Unsaved changes'}
          </span>
          {saveState.lastSaved && (
            <span className="last-saved">
              Last saved: {saveState.lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Draft Manager Panel */}
      {config.enableDraftManager && state.showDraftManager && (
        <DraftManagerPanel
          drafts={getDraftsList()}
          currentDraft={draftMetadata}
          onLoadDraft={loadDraft}
          onDeleteDraft={() => {}} // Implementation needed
          onClose={() => updateState({ showDraftManager: false })}
        />
      )}

      {/* Main Form Fields */}
      <div className="form-content">
        {/* Title Field */}
        <div className="form-field">
          <label htmlFor="entry-title" className="field-label">
            Title <span className="required">*</span>
          </label>
          <div className="input-wrapper">
            <input
              ref={titleInputRef}
              id="entry-title"
              type="text"
              value={state.data.title}
              onChange={(e) => updateFormData('title', e.target.value)}
              className={`form-input ${errors.title ? 'error' : ''}`}
              placeholder="Brief, descriptive title for this issue"
              aria-describedby={errors.title ? "title-error" : undefined}
              aria-invalid={!!errors.title}
              maxLength={200}
            />
          </div>
          {errors.title && (
            <div id="title-error" className="field-error" role="alert">
              {errors.title}
            </div>
          )}
        </div>

        {/* Category Field */}
        <div className="form-field">
          <label htmlFor="entry-category" className="field-label">
            Category <span className="required">*</span>
          </label>
          <select
            id="entry-category"
            value={state.data.category}
            onChange={(e) => updateFormData('category', e.target.value as KBCategory)}
            className={`form-select ${errors.category ? 'error' : ''}`}
            aria-describedby={errors.category ? "category-error" : undefined}
            aria-invalid={!!errors.category}
          >
            <option value="">Select a category</option>
            <option value="JCL">JCL</option>
            <option value="VSAM">VSAM</option>
            <option value="DB2">DB2</option>
            <option value="Batch">Batch</option>
            <option value="Functional">Functional</option>
          </select>
          {errors.category && (
            <div id="category-error" className="field-error" role="alert">
              {errors.category}
            </div>
          )}
        </div>

        {/* Tags Field */}
        <div className="form-field">
          <label htmlFor="entry-tags" className="field-label">
            Tags <span className="required">*</span>
          </label>
          <div className="tags-input-wrapper">
            <div className="tags-container">
              {state.data.tags.map(tag => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      const newTags = state.data.tags.filter(t => t !== tag);
                      updateFormData('tags', newTags);
                    }}
                    className="tag-remove"
                    aria-label={`Remove ${tag} tag`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                id="entry-tags"
                type="text"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const input = e.currentTarget;
                    const tag = input.value.trim();

                    if (tag && !state.data.tags.includes(tag)) {
                      updateFormData('tags', [...state.data.tags, tag]);
                      input.value = '';
                    }
                  }
                }}
                className="tag-input"
                placeholder="Type tags and press Enter"
                aria-describedby={errors.tags ? "tags-error" : undefined}
              />
            </div>
          </div>
          {errors.tags && (
            <div id="tags-error" className="field-error" role="alert">
              {errors.tags}
            </div>
          )}
        </div>

        {/* Problem Field with Rich Text Editor */}
        <div className="form-field">
          <label htmlFor="entry-problem" className="field-label">
            Problem Description <span className="required">*</span>
          </label>
          {config.enableRichTextEditor ? (
            <RichTextEditor
              ref={problemEditorRef}
              id="entry-problem"
              value={state.data.problem}
              onChange={(value) => updateFormData('problem', value)}
              placeholder="Describe the problem in detail. Include error messages, symptoms, and context."
              maxLength={2000}
              aria-describedby={errors.problem ? "problem-error" : undefined}
              aria-invalid={!!errors.problem}
              enableMainframeFormatting={true}
              autoSave={config.enableAutoSave}
              onAutoSave={(content) => updateDraft({ problem: content })}
            />
          ) : (
            <textarea
              id="entry-problem"
              value={state.data.problem}
              onChange={(e) => updateFormData('problem', e.target.value)}
              className={`form-textarea ${errors.problem ? 'error' : ''}`}
              placeholder="Describe the problem in detail. Include error messages, symptoms, and context."
              rows={6}
              maxLength={2000}
            />
          )}
          {errors.problem && (
            <div id="problem-error" className="field-error" role="alert">
              {errors.problem}
            </div>
          )}
        </div>

        {/* Solution Field with Rich Text Editor */}
        <div className="form-field">
          <label htmlFor="entry-solution" className="field-label">
            Solution <span className="required">*</span>
          </label>
          {config.enableRichTextEditor ? (
            <RichTextEditor
              ref={solutionEditorRef}
              id="entry-solution"
              value={state.data.solution}
              onChange={(value) => updateFormData('solution', value)}
              placeholder="Provide step-by-step solution. Be specific and include commands, code, or procedures."
              maxLength={5000}
              aria-describedby={errors.solution ? "solution-error" : undefined}
              aria-invalid={!!errors.solution}
              enableMainframeFormatting={true}
              enableCodeBlocks={true}
              autoSave={config.enableAutoSave}
              onAutoSave={(content) => updateDraft({ solution: content })}
            />
          ) : (
            <textarea
              id="entry-solution"
              value={state.data.solution}
              onChange={(e) => updateFormData('solution', e.target.value)}
              className={`form-textarea ${errors.solution ? 'error' : ''}`}
              placeholder="Provide step-by-step solution. Be specific and include commands, code, or procedures."
              rows={8}
              maxLength={5000}
            />
          )}
          {errors.solution && (
            <div id="solution-error" className="field-error" role="alert">
              {errors.solution}
            </div>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        {config.enableDraftManager && (
          <button
            type="button"
            onClick={() => updateState({ showDraftManager: !state.showDraftManager })}
            className="form-button tertiary"
            disabled={state.isSubmitting}
          >
            📁 Drafts
          </button>
        )}

        {config.enableKeyboardShortcuts && (
          <button
            type="button"
            onClick={() => setShowShortcutsHelp(true)}
            className="form-button tertiary"
            disabled={state.isSubmitting}
            title="Show keyboard shortcuts"
          >
            ⌨️
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="form-button secondary"
          disabled={state.isSubmitting}
        >
          Cancel
        </button>

        {config.enableDraftManager && (
          <button
            type="button"
            onClick={handleSaveDraft}
            className="form-button tertiary"
            disabled={state.isSubmitting}
            title="Save draft (Ctrl+S)"
          >
            💾 Save Draft
          </button>
        )}

        <button
          type="submit"
          className="form-button primary"
          disabled={state.isSubmitting || !isValid}
          title={config.enableKeyboardShortcuts ? "Submit (Ctrl+Shift+S)" : "Submit"}
        >
          {state.isSubmitting ? (
            <>
              <span className="spinner" />
              {entry ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            entry ? 'Update Entry' : 'Create Entry'
          )}
        </button>
      </div>

      {/* Conflict Resolution Modal */}
      {state.showConflictModal && (
        <ConflictResolutionModal
          onResolve={handleConflictResolution}
          onClose={() => updateState({ showConflictModal: false })}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcutsHelp && (
        <div className="shortcuts-modal" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="close-button"
                aria-label="Close shortcuts help"
              >
                ✕
              </button>
            </div>
            <div className="shortcuts-list">
              {Object.entries(KEYBOARD_SHORTCUTS).map(([key, description]) => (
                <div key={key} className="shortcut-item">
                  <kbd>{key}</kbd>
                  <span>{description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
});

EnhancedSmartEntryForm.displayName = 'EnhancedSmartEntryForm';

export default EnhancedSmartEntryForm;