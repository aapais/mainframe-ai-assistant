import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Save, AlertTriangle, CheckCircle, Loader2, Tag, FileText, FolderOpen, Clock, Users } from 'lucide-react';
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
import { IncidentFormData } from '../../types/form';
import { CreateIncident } from '../../../backend/core/interfaces/ServiceInterfaces';

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateIncident) => Promise<void>;
  onError?: (error: Error) => void;
  loading?: boolean;
}

interface ValidationErrors {
  title?: string;
  description?: string;
  impact?: string;
  category?: string;
  priority?: string;
  tags?: string;
}

// Incident-specific categories
const INCIDENT_CATEGORIES = [
  { value: 'System Outage', label: 'System Outage', description: 'Complete system or service failure' },
  { value: 'Performance', label: 'Performance Issue', description: 'Slow response times or degraded performance' },
  { value: 'Database', label: 'Database Issue', description: 'DB2, IMS, or VSAM related problems' },
  { value: 'Application', label: 'Application Error', description: 'COBOL, CICS, or batch job failures' },
  { value: 'Security', label: 'Security Incident', description: 'RACF, access control, or security breaches' },
  { value: 'Network', label: 'Network Issue', description: 'Connectivity or communication problems' },
  { value: 'Hardware', label: 'Hardware Failure', description: 'Physical system or storage issues' },
  { value: 'Capacity', label: 'Capacity Issue', description: 'Storage, memory, or processing limits' },
  { value: 'Data', label: 'Data Issue', description: 'Data corruption, loss, or integrity problems' },
  { value: 'Configuration', label: 'Configuration Error', description: 'System or application configuration issues' },
  { value: 'Other', label: 'Other/Miscellaneous', description: 'Other types of incidents' }
];

const PRIORITY_LEVELS = [
  { value: 'P1', label: 'P1 - Critical', color: 'text-red-600', description: 'Complete service failure, immediate action required' },
  { value: 'P2', label: 'P2 - High', color: 'text-orange-600', description: 'Significant impact, requires urgent attention' },
  { value: 'P3', label: 'P3 - Medium', color: 'text-yellow-600', description: 'Moderate impact, normal timeline' },
  { value: 'P4', label: 'P4 - Low', color: 'text-green-600', description: 'Minor impact, can be addressed when convenient' }
];

const IMPACT_LEVELS = [
  { value: 'Critical', label: 'Critical', description: 'Business critical systems affected, major revenue impact' },
  { value: 'High', label: 'High', description: 'Important business functions impacted' },
  { value: 'Medium', label: 'Medium', description: 'Some business functions affected' },
  { value: 'Low', label: 'Low', description: 'Minor impact on business operations' }
];

const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open', description: 'Newly reported incident' },
  { value: 'In Progress', label: 'In Progress', description: 'Incident is being worked on' },
  { value: 'Pending', label: 'Pending', description: 'Waiting for external input or resources' },
  { value: 'Resolved', label: 'Resolved', description: 'Issue has been fixed' },
  { value: 'Closed', label: 'Closed', description: 'Incident is complete and verified' }
];

// Common incident tags for auto-suggestions
const COMMON_INCIDENT_TAGS = [
  'outage', 'performance', 'timeout', 'connection-failed', 'abend', 'error-code',
  'batch-failure', 'online-down', 'database-error', 'file-corruption', 'memory-issue',
  'capacity-exceeded', 'security-breach', 'access-denied', 'network-issue',
  'hardware-failure', 'configuration-error', 'deployment-issue', 'emergency',
  'planned-maintenance', 'unplanned-downtime', 'rollback-required'
];

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onError,
  loading = false
}) => {
  // Form state
  const [formData, setFormData] = useState<IncidentFormData>({
    title: '',
    description: '',
    impact: '',
    category: 'Other',
    priority: 'P3',
    status: 'Open',
    assignee: '',
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
        description: '',
        impact: '',
        category: 'Other',
        priority: 'P3',
        status: 'Open',
        assignee: '',
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
      const filtered = COMMON_INCIDENT_TAGS.filter(tag =>
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
      errors.title = 'Incident title is required';
    } else if (formData.title.length < 10) {
      errors.title = 'Title must be at least 10 characters';
    } else if (formData.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Incident description is required';
    } else if (formData.description.length < 20) {
      errors.description = 'Description must be at least 20 characters';
    } else if (formData.description.length > 5000) {
      errors.description = 'Description must be less than 5000 characters';
    }

    if (!formData.impact.trim()) {
      errors.impact = 'Impact assessment is required';
    } else if (formData.impact.length < 10) {
      errors.impact = 'Impact description must be at least 10 characters';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    if (!formData.priority) {
      errors.priority = 'Priority is required';
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
      const incidentData: CreateIncident = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        impact: formData.impact.trim(),
        category: formData.category as any,
        priority: formData.priority as any,
        status: formData.status as any,
        assignee: formData.assignee || 'unassigned',
        tags: formData.tags,
        reported_by: 'current-user', // This should come from auth context
        reported_at: new Date().toISOString()
      };

      await onSubmit(incidentData);
      onClose();
    } catch (error) {
      console.error('Error reporting incident:', error);
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, isSubmitting, onSubmit, onClose, onError]);

  // Handle input changes
  const handleInputChange = useCallback((field: keyof IncidentFormData, value: any) => {
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
  const descriptionCount = getCharacterCount(formData.description, 5000);
  const impactCount = getCharacterCount(formData.impact, 1000);

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent size="3xl" open={isOpen} className="max-h-[90vh] overflow-hidden">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-600 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <ModalTitle className="text-xl font-semibold text-gray-900">
                  Report New Incident
                </ModalTitle>
                <ModalDescription className="text-sm text-gray-600">
                  Create a new incident report for the Accenture Mainframe System
                </ModalDescription>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Incident Management System
            </div>
          </div>
          <ModalClose />
        </ModalHeader>

        <ModalBody className="overflow-y-auto px-6">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Incident Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Brief, descriptive title (e.g., 'Production DB2 Database Unavailable - SQLCODE -904')"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
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
                Include system names, error codes, or key symptoms for quick identification
              </p>
            </div>

            {/* Priority, Category, and Status Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Priority Field */}
              <div className="space-y-2">
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {PRIORITY_LEVELS.map(priority => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  {PRIORITY_LEVELS.find(p => p.value === formData.priority)?.description}
                </p>
              </div>

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
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                    validationErrors.category ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  {INCIDENT_CATEGORIES.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Field */}
              <div className="space-y-2">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Incident Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Incident Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe what happened, when it occurred, what systems are affected, and any error messages observed..."
                rows={4}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-y ${
                  validationErrors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                maxLength={5000}
              />
              <div className="flex justify-between items-center">
                {validationErrors.description && (
                  <span className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.description}
                  </span>
                )}
                <span className={`text-xs ${descriptionCount.isOverLimit ? 'text-red-600' : descriptionCount.isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {descriptionCount.current}/{descriptionCount.max}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Include: Timeline, affected systems, error messages, user impact, and steps taken so far
              </p>
            </div>

            {/* Impact Assessment */}
            <div className="space-y-2">
              <label htmlFor="impact" className="block text-sm font-medium text-gray-700">
                Business Impact <span className="text-red-500">*</span>
              </label>
              <div className="mb-2">
                <select
                  value={formData.impact.split(' - ')[0] || ''}
                  onChange={(e) => {
                    const selectedLevel = IMPACT_LEVELS.find(level => level.value === e.target.value);
                    if (selectedLevel) {
                      handleInputChange('impact', `${selectedLevel.value} - ${selectedLevel.description}`);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-2"
                >
                  <option value="">Select Impact Level</option>
                  {IMPACT_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label} - {level.description}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                id="impact"
                value={formData.impact}
                onChange={(e) => handleInputChange('impact', e.target.value)}
                placeholder="Describe the business impact: number of users affected, revenue impact, affected business processes..."
                rows={3}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-y ${
                  validationErrors.impact ? 'border-red-300' : 'border-gray-300'
                }`}
                maxLength={1000}
              />
              <div className="flex justify-between items-center">
                {validationErrors.impact && (
                  <span className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.impact}
                  </span>
                )}
                <span className={`text-xs ${impactCount.isOverLimit ? 'text-red-600' : impactCount.isNearLimit ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {impactCount.current}/{impactCount.max}
                </span>
              </div>
            </div>

            {/* Assignee Field */}
            <div className="space-y-2">
              <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
                <Users className="inline h-4 w-4 mr-1" />
                Assign To (Optional)
              </label>
              <input
                id="assignee"
                type="text"
                value={formData.assignee}
                onChange={(e) => handleInputChange('assignee', e.target.value)}
                placeholder="Username or team (leave blank for auto-assignment)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <p className="text-xs text-gray-500">
                Leave blank for automatic assignment based on category and priority
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
                  placeholder="Add relevant keywords (press Enter)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                      className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-red-600 focus:outline-none"
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
                Add relevant keywords to help categorize and search for this incident
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || loading}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reporting...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Report Incident
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

export default ReportIncidentModal;