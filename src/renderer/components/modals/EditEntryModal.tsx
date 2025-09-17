import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Save, AlertTriangle, CheckCircle, Loader2, Tag, FileText, FolderOpen, Clock, RotateCcw, Archive, Copy, Trash2, History } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose
} from '../ui/Modal';
import { KBEntryFormData } from '../../types/form';
import { KBEntry, UpdateKBEntry } from '../../../backend/core/interfaces/ServiceInterfaces';

interface EditEntryModalProps {
  isOpen: boolean;
  entry?: KBEntry;
  onClose: () => void;
  onSubmit: (id: string, data: UpdateKBEntry) => Promise<void>;
  onError?: (error: Error) => void;
  onArchive?: (id: string) => Promise<void>;
  onDuplicate?: (entry: KBEntry) => Promise<void>;
  onViewHistory?: (id: string) => Promise<void>;
  loading?: boolean;
  archiving?: boolean;
  duplicating?: boolean;
}

interface ValidationErrors {
  title?: string;
  problem?: string;
  solution?: string;
  category?: string;
  tags?: string;
}

interface ChangeTracker {
  field: string;
  original: any;
  current: any;
  changed: boolean;
}

// Mainframe-specific categories for Accenture KB
const MAINFRAME_CATEGORIES = [
  { value: 'JCL', label: 'JCL - Job Control Language', description: 'Job scheduling and batch processing' },
  { value: 'COBOL', label: 'COBOL - Business Logic', description: 'COBOL program issues and solutions' },
  { value: 'DB2', label: 'DB2 - Database Management', description: 'Database operations and SQL queries' },
  { value: 'VSAM', label: 'VSAM - Virtual Storage Access Method', description: 'File access and storage management' },
  { value: 'CICS', label: 'CICS - Transaction Processing', description: 'Online transaction system' },
  { value: 'IMS', label: 'IMS - Information Management System', description: 'Hierarchical database and transaction manager' },
  { value: 'TSO', label: 'TSO - Time Sharing Option', description: 'Interactive system commands' },
  { value: 'ISPF', label: 'ISPF - Interactive System Productivity Facility', description: 'Development environment' },
  { value: 'Utilities', label: 'System Utilities', description: 'IEBGENER, SORT, IDCAMS, etc.' },
  { value: 'Security', label: 'Security & RACF', description: 'Access control and security management' },
  { value: 'Performance', label: 'Performance Tuning', description: 'System optimization and monitoring' },
  { value: 'Other', label: 'Other/Miscellaneous', description: 'General mainframe issues' }
];

const SEVERITY_LEVELS = [
  { value: 'critical', label: 'Critical - System Down', color: 'text-red-600', description: 'Production system failure' },
  { value: 'high', label: 'High - Major Impact', color: 'text-orange-600', description: 'Significant business impact' },
  { value: 'medium', label: 'Medium - Moderate Impact', color: 'text-yellow-600', description: 'Some business impact' },
  { value: 'low', label: 'Low - Minor Issue', color: 'text-green-600', description: 'Minimal impact' }
];

// Common mainframe tags for auto-suggestions
const COMMON_TAGS = [
  'abend', 'error-code', 'batch-job', 'online-transaction', 'file-error', 'sql-error',
  'compilation-error', 'runtime-error', 'performance', 'memory', 'timeout', 'connection',
  'data-corruption', 'backup-restore', 'migration', 'upgrade', 'configuration',
  'networking', 'storage', 'capacity', 'monitoring', 'troubleshooting'
];

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  isOpen,
  entry,
  onClose,
  onSubmit,
  onError,
  onArchive,
  onDuplicate,
  onViewHistory,
  loading = false,
  archiving = false,
  duplicating = false
}) => {
  // Form state
  const [formData, setFormData] = useState<KBEntryFormData>({
    title: '',
    problem: '',
    solution: '',
    category: 'Other',
    severity: 'medium',
    tags: []
  });

  const [originalData, setOriginalData] = useState<KBEntryFormData | null>(null);

  // UI state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Load entry data when modal opens or entry changes
  useEffect(() => {
    if (isOpen && entry) {
      const initialData: KBEntryFormData = {
        title: entry.title,
        problem: entry.problem,
        solution: entry.solution,
        category: entry.category as any,
        severity: entry.severity || 'medium',
        tags: entry.tags || []
      };

      setFormData(initialData);
      setOriginalData(initialData);
      setValidationErrors({});
      setTagInput('');
      setShowAdvanced(false);
      setShowChanges(false);
      setUnsavedChanges(false);
    }
  }, [isOpen, entry]);

  // Track changes
  useEffect(() => {
    if (originalData) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);
      setUnsavedChanges(hasChanges);
    }
  }, [formData, originalData]);

  // Filter tag suggestions based on input
  useEffect(() => {
    if (tagInput.trim()) {
      const filtered = COMMON_TAGS.filter(tag =>
        tag.toLowerCase().includes(tagInput.toLowerCase()) &&
        !formData.tags.includes(tag)
      ).slice(0, 8);
      setFilteredTags(filtered);
      setShowTagSuggestions(filtered.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  }, [tagInput, formData.tags]);

  // Get change tracking data
  const getChanges = useCallback((): ChangeTracker[] => {
    if (!originalData) return [];

    const changes: ChangeTracker[] = [];

    Object.keys(formData).forEach(key => {
      const field = key as keyof KBEntryFormData;
      const original = originalData[field];
      const current = formData[field];

      let changed = false;
      if (Array.isArray(original) && Array.isArray(current)) {
        changed = JSON.stringify(original.sort()) !== JSON.stringify(current.sort());
      } else {
        changed = original !== current;
      }

      changes.push({
        field: key,
        original,
        current,
        changed
      });
    });

    return changes.filter(change => change.changed);
  }, [formData, originalData]);

  // Validation
  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length < 10) {
      errors.title = 'Title must be at least 10 characters';
    } else if (formData.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    if (!formData.problem.trim()) {
      errors.problem = 'Problem description is required';
    } else if (formData.problem.length < 20) {
      errors.problem = 'Problem description must be at least 20 characters';
    } else if (formData.problem.length > 5000) {
      errors.problem = 'Problem description must be less than 5000 characters';
    }

    if (!formData.solution.trim()) {
      errors.solution = 'Solution is required';
    } else if (formData.solution.length < 20) {
      errors.solution = 'Solution must be at least 20 characters';
    } else if (formData.solution.length > 10000) {
      errors.solution = 'Solution must be less than 10000 characters';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    if (formData.tags.length > 10) {
      errors.tags = 'Maximum 10 tags allowed';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!entry || !validateForm() || isSubmitting || !unsavedChanges) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: UpdateKBEntry = {
        title: formData.title.trim(),
        problem: formData.problem.trim(),
        solution: formData.solution.trim(),
        category: formData.category as any,
        severity: formData.severity as any,
        tags: formData.tags
      };

      await onSubmit(entry.id, updateData);
      onClose();
    } catch (error) {
      console.error('Error updating KB entry:', error);
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, isSubmitting, unsavedChanges, entry, onSubmit, onClose, onError]);

  // Handle input changes
  const handleInputChange = useCallback((field: keyof KBEntryFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear validation error for this field
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [validationErrors]);

  // Tag management
  const handleAddTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !formData.tags.includes(trimmedTag) && formData.tags.length < 10) {
      handleInputChange('tags', [...formData.tags, trimmedTag]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  }, [formData.tags, handleInputChange]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  }, [formData.tags, handleInputChange]);

  const handleTagKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag(tagInput);
      }
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  }, [tagInput, handleAddTag]);

  // Reset changes
  const handleResetChanges = useCallback(() => {
    if (originalData) {
      setFormData(originalData);
      setTagInput('');
      setShowTagSuggestions(false);
      setValidationErrors({});
    }
  }, [originalData]);

  // Handle archive
  const handleArchive = useCallback(async () => {
    if (!entry || archiving) return;

    if (window.confirm(`Are you sure you want to archive "${entry.title}"? It will be moved to the archive and can be restored later.`)) {
      try {
        await onArchive?.(entry.id);
        onClose();
      } catch (error) {
        console.error('Error archiving entry:', error);
        onError?.(error as Error);
      }
    }
  }, [entry, archiving, onArchive, onClose, onError]);

  // Handle duplicate
  const handleDuplicate = useCallback(async () => {
    if (!entry || duplicating) return;

    try {
      await onDuplicate?.(entry);
    } catch (error) {
      console.error('Error duplicating entry:', error);
      onError?.(error as Error);
    }
  }, [entry, duplicating, onDuplicate, onError]);

  // Handle view history
  const handleViewHistory = useCallback(async () => {
    if (!entry) return;

    try {
      await onViewHistory?.(entry.id);
    } catch (error) {
      console.error('Error viewing history:', error);
      onError?.(error as Error);
    }
  }, [entry, onViewHistory, onError]);

  // Character count helper
  const getCharacterCount = (text: string, max: number) => ({
    current: text.length,
    max,
    percentage: (text.length / max) * 100,
    isNearLimit: text.length > max * 0.8,
    isOverLimit: text.length > max
  });

  const titleCount = getCharacterCount(formData.title, 200);
  const problemCount = getCharacterCount(formData.problem, 5000);
  const solutionCount = getCharacterCount(formData.solution, 10000);

  if (!entry) return null;

  const changes = getChanges();

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent size="3xl" open={isOpen} className="max-h-[90vh] overflow-hidden">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <ModalTitle className="text-xl font-semibold text-gray-900">
                  Edit Knowledge Entry
                </ModalTitle>
                <ModalDescription className="text-sm text-gray-600">
                  Modify entry in the Accenture Mainframe Knowledge Base
                </ModalDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {unsavedChanges && (
                <div className="flex items-center text-yellow-600 text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Unsaved changes
                </div>
              )}
              <div className="text-xs text-gray-500">
                ID: {entry.id.slice(-8)}
              </div>
            </div>
          </div>
          <ModalClose />
        </ModalHeader>

        <ModalBody className="overflow-y-auto px-6">
          {/* Entry Metadata */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <div className="text-gray-600">{new Date(entry.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Updated:</span>
                <div className="text-gray-600">{new Date(entry.updated_at).toLocaleDateString()}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Usage Count:</span>
                <div className="text-gray-600">{entry.usage_count}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Success Rate:</span>
                <div className="text-gray-600">
                  {entry.usage_count > 0 ? Math.round((entry.success_count / entry.usage_count) * 100) : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Change Summary */}
          {changes.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium text-yellow-800">
                    {changes.length} field{changes.length !== 1 ? 's' : ''} modified
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChanges(!showChanges)}
                  className="text-xs text-yellow-700 hover:text-yellow-800"
                >
                  {showChanges ? 'Hide' : 'Show'} changes
                </button>
              </div>

              {showChanges && (
                <div className="mt-3 space-y-2">
                  {changes.map(change => (
                    <div key={change.field} className="text-xs bg-white rounded p-2">
                      <div className="font-medium text-gray-700 capitalize">{change.field}:</div>
                      <div className="text-gray-600">
                        <span className="line-through">
                          {Array.isArray(change.original) ? change.original.join(', ') : String(change.original)}
                        </span>
                        {' → '}
                        <span className="font-medium">
                          {Array.isArray(change.current) ? change.current.join(', ') : String(change.current)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Brief, descriptive title (e.g., 'DB2 SQL0904 - Resource Not Available')"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                maxLength={200}
              />
              <div className="flex justify-between items-center">
                {validationErrors.title && (
                  <span className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.title}
                  </span>
                )}
                <span className={`text-xs ${titleCount.isOverLimit ? 'text-red-600' : titleCount.isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {titleCount.current}/{titleCount.max}
                </span>
              </div>
            </div>

            {/* Category and Severity Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Category Field */}
              <div className="space-y-2">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  <FolderOpen className="inline h-4 w-4 mr-1" />
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.category ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  {MAINFRAME_CATEGORIES.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                {validationErrors.category && (
                  <span className="text-sm text-red-600">{validationErrors.category}</span>
                )}
              </div>

              {/* Severity Field */}
              <div className="space-y-2">
                <label htmlFor="severity" className="block text-sm font-medium text-gray-700">
                  Severity Level
                </label>
                <select
                  id="severity"
                  value={formData.severity}
                  onChange={(e) => handleInputChange('severity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SEVERITY_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Problem Description */}
            <div className="space-y-2">
              <label htmlFor="problem" className="block text-sm font-medium text-gray-700">
                Problem Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="problem"
                value={formData.problem}
                onChange={(e) => handleInputChange('problem', e.target.value)}
                placeholder="Describe the problem in detail..."
                rows={4}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${
                  validationErrors.problem ? 'border-red-300' : 'border-gray-300'
                }`}
                maxLength={5000}
              />
              <div className="flex justify-between items-center">
                {validationErrors.problem && (
                  <span className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.problem}
                  </span>
                )}
                <span className={`text-xs ${problemCount.isOverLimit ? 'text-red-600' : problemCount.isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {problemCount.current}/{problemCount.max}
                </span>
              </div>
            </div>

            {/* Solution */}
            <div className="space-y-2">
              <label htmlFor="solution" className="block text-sm font-medium text-gray-700">
                Solution <span className="text-red-500">*</span>
              </label>
              <textarea
                id="solution"
                value={formData.solution}
                onChange={(e) => handleInputChange('solution', e.target.value)}
                placeholder="Provide step-by-step solution instructions..."
                rows={6}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${
                  validationErrors.solution ? 'border-red-300' : 'border-gray-300'
                }`}
                maxLength={10000}
              />
              <div className="flex justify-between items-center">
                {validationErrors.solution && (
                  <span className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.solution}
                  </span>
                )}
                <span className={`text-xs ${solutionCount.isOverLimit ? 'text-red-600' : solutionCount.isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {solutionCount.current}/{solutionCount.max}
                </span>
              </div>
            </div>

            {/* Tags Section */}
            <div className="space-y-2">
              <label htmlFor="tagInput" className="block text-sm font-medium text-gray-700">
                <Tag className="inline h-4 w-4 mr-1" />
                Tags ({formData.tags.length}/10)
              </label>
              <div className="relative">
                <input
                  ref={tagInputRef}
                  id="tagInput"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyPress}
                  placeholder="Add searchable keywords (press Enter)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={30}
                  disabled={formData.tags.length >= 10}
                />

                {/* Tag Suggestions */}
                {showTagSuggestions && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Tags */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-blue-600 focus:outline-none"
                        aria-label={`Remove tag: ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {validationErrors.tags && (
                <span className="text-sm text-red-600">{validationErrors.tags}</span>
              )}
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-between items-center w-full">
            {/* Left side actions */}
            <div className="flex space-x-2">
              {unsavedChanges && (
                <button
                  type="button"
                  onClick={handleResetChanges}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </button>
              )}

              <button
                type="button"
                onClick={handleViewHistory}
                className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <History className="h-3 w-3 mr-1" />
                History
              </button>

              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicating}
                className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {duplicating ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                Duplicate
              </button>

              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="inline-flex items-center px-3 py-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-300 rounded hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              >
                {archiving ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Archive className="h-3 w-3 mr-1" />
                )}
                Archive
              </button>
            </div>

            {/* Right side actions */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || loading || !unsavedChanges}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditEntryModal;