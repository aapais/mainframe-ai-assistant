/**
 * Form-related Type Definitions
 * Comprehensive type safety for form components and validation
 */

import { KBEntry } from './index';

// Form validation types
export interface ValidationRule<T = any> {
  validate: (value: T, allValues?: Record<string, any>) => string | null;
  message?: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationRule[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  firstErrorField?: string;
}

export interface FormErrors {
  [key: string]: string | undefined;
}

export interface FormState<T = Record<string, any>> {
  values: T;
  errors: FormErrors;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

// KB Entry form specific types
export interface KBEntryFormData {
  title: string;
  problem: string;
  solution: string;
  category: 'JCL' | 'VSAM' | 'DB2' | 'Batch' | 'Functional' | 'Other';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
}

export interface KBEntryFormProps {
  initialData?: Partial<KBEntryFormData>;
  onSubmit: (data: KBEntryFormData) => Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
  mode?: 'create' | 'edit';
  autoSave?: boolean;
  enableDrafts?: boolean;
  showAdvancedOptions?: boolean;
}

export interface EditEntryFormProps {
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

// Form field component types
export interface BaseFieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  hintClassName?: string;
  
  // Accessibility
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  
  // Visual indicators
  showRequiredIndicator?: boolean;
  showOptionalIndicator?: boolean;
  showCharacterCount?: boolean;
  maxLength?: number;
  
  // Help and tooltips
  helpText?: string;
  tooltip?: string;
}

export interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'url' | 'tel';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'filled' | 'outlined';
}

export interface TextAreaFieldProps extends BaseFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
  autoResize?: boolean;
}

export interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  multiple?: boolean;
}

export interface CheckboxFieldProps extends Omit<BaseFieldProps, 'required'> {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// Form hook types
export interface UseFormOptions<T extends Record<string, any>> {
  initialValues: T;
  validationSchema?: ValidationSchema;
  onSubmit: (values: T) => Promise<void>;
  onError?: (error: Error) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
  enableDrafts?: boolean;
  draftKey?: string;
}

export interface UseFormReturn<T extends Record<string, any>> {
  // State
  values: T;
  errors: FormErrors;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  isAutoSaving: boolean;
  
  // Actions
  setFieldValue: (field: keyof T, value: any) => void;
  setFieldError: (field: keyof T, error: string | undefined) => void;
  setFieldTouched: (field: keyof T, touched: boolean) => void;
  resetForm: (newValues?: Partial<T>) => void;
  validateForm: () => Promise<boolean>;
  validateField: (field: keyof T) => Promise<string | null>;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  
  // Field helpers
  getFieldProps: (name: keyof T) => FieldProps;
  getFieldError: (name: keyof T) => string | undefined;
  isFieldTouched: (name: keyof T) => boolean;
  isFieldInvalid: (name: keyof T) => boolean;
  
  // Draft management
  saveDraft: () => void;
  loadDraft: () => boolean;
  clearDraft: () => void;
  hasDraft: boolean;
}

export interface FieldProps {
  name: string;
  value: any;
  onChange: (e: React.ChangeEvent<any>) => void;
  onBlur: (e: React.FocusEvent<any>) => void;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

// Change comparison types
export interface ChangeComparison {
  field: string;
  original: string;
  updated: string;
  hasChanged: boolean;
}

// Form notification types
export interface FormNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  actions?: FormNotificationAction[];
}

export interface FormNotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}

// Draft management types
export interface FormDraft {
  values: Record<string, any>;
  timestamp: number;
  version: string;
}

export interface DraftStorage {
  [key: string]: FormDraft;
}

// Form analytics types
export interface FormAnalytics {
  formId: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalTime?: number;
  fieldInteractions: FieldInteraction[];
  validationErrors: ValidationError[];
  submissionAttempts: number;
  successful: boolean;
  abandonedAt?: string;
}

export interface FieldInteraction {
  fieldName: string;
  eventType: 'focus' | 'blur' | 'change' | 'error';
  timestamp: number;
  value?: any;
}

export interface ValidationError {
  fieldName: string;
  errorMessage: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

// Export utility types
export type FormFieldType = 'text' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox' | 'radio';

export type FormValidationMode = 'onChange' | 'onBlur' | 'onSubmit' | 'manual';

export type FormSubmissionState = 'idle' | 'validating' | 'submitting' | 'success' | 'error';

export type FormAutoSaveState = 'idle' | 'saving' | 'saved' | 'error';