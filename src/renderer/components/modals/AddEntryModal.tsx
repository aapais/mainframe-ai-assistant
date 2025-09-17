import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Save, AlertTriangle, CheckCircle, Loader2, Tag, FileText, FolderOpen } from 'lucide-react';
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
import { CreateKBEntry } from '../../../backend/core/interfaces/ServiceInterfaces';

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateKBEntry) => Promise<void>;
  onError?: (error: Error) => void;
  loading?: boolean;
}

interface ValidationErrors {
  title?: string;
  problem?: string;
  solution?: string;
  category?: string;
  tags?: string;
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

export const AddEntryModal: React.FC<AddEntryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onError,
  loading = false
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

  // UI state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        problem: '',
        solution: '',
        category: 'Other',
        severity: 'medium',
        tags: []
      });
      setValidationErrors({});
      setTagInput('');
      setShowAdvanced(false);
    }
  }, [isOpen]);

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

    if (!validateForm() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const entryData: CreateKBEntry = {
        title: formData.title.trim(),
        problem: formData.problem.trim(),
        solution: formData.solution.trim(),
        category: formData.category as any,
        severity: formData.severity as any,
        tags: formData.tags,
        created_by: 'current-user' // This should come from auth context
      };

      await onSubmit(entryData);
      onClose();
    } catch (error) {
      console.error('Error creating KB entry:', error);
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, isSubmitting, onSubmit, onClose, onError]);

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
                  Add New Knowledge Entry
                </ModalTitle>
                <ModalDescription className="text-sm text-gray-600">
                  Create a new entry in the Accenture Mainframe Knowledge Base
                </ModalDescription>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Accenture Technology Solutions
            </div>
          </div>
          <ModalClose />
        </ModalHeader>

        <ModalBody className="overflow-y-auto px-6">
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
                autoFocus
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
              <p className="text-xs text-gray-500">
                Include error codes, system names, or key symptoms for better searchability
              </p>
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
                <p className="text-xs text-gray-500">
                  {MAINFRAME_CATEGORIES.find(c => c.value === formData.category)?.description}
                </p>
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
                <p className="text-xs text-gray-500">
                  {SEVERITY_LEVELS.find(s => s.value === formData.severity)?.description}
                </p>
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
                placeholder="Describe the problem in detail. Include error messages, symptoms, and context when the issue occurs..."
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
              <p className="text-xs text-gray-500">
                Include: 1) What you were trying to do, 2) What happened instead, 3) Error messages or codes, 4) When/where it occurs
              </p>
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
                placeholder="Provide step-by-step solution instructions. Use numbered steps for clarity..."
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
              <p className="text-xs text-gray-500">
                Structure: 1) Prerequisites, 2) Step-by-step actions, 3) Verification steps, 4) Additional notes
              </p>
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
              <p className="text-xs text-gray-500">
                Add relevant keywords to help others find this solution
              </p>
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-between items-center w-full">
            <div className="text-xs text-gray-500">
              All fields marked with * are required
            </div>
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
                disabled={isSubmitting || loading}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Entry
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

export default AddEntryModal;