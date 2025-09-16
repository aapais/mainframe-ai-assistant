/**
 * Advanced Form Management Hook
 * Provides comprehensive form state management with validation, auto-save, and UX optimizations
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ValidationSchema,
  validateForm,
  validateField,
  FormState,
  createInitialFormState,
  FormErrors
} from '../utils/validation';

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

export function useForm<T extends Record<string, any>>({
  initialValues,
  validationSchema,
  onSubmit,
  onError,
  validateOnChange = true,
  validateOnBlur = true,
  autoSave = false,
  autoSaveDelay = 2000,
  enableDrafts = false,
  draftKey
}: UseFormOptions<T>): UseFormReturn<T> {
  
  // Form state
  const [formState, setFormState] = useState<FormState<T>>(() => 
    createInitialFormState(initialValues)
  );
  
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  
  // Refs for debouncing and cleanup
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const validationTimeoutRef = useRef<NodeJS.Timeout>();
  const isUnmountedRef = useRef(false);
  
  // Draft key for localStorage
  const effectiveDraftKey = draftKey || `form-draft-${Date.now()}`;
  
  // Initialize form (check for drafts)
  useEffect(() => {
    if (enableDrafts && draftKey) {
      const hasSavedDraft = loadDraft();
      setHasDraft(hasSavedDraft);
    }
    
    return () => {
      isUnmountedRef.current = true;
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);
  
  // Auto-save functionality
  useEffect(() => {
    if (autoSave && formState.isDirty && !formState.isSubmitting) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          performAutoSave();
        }
      }, autoSaveDelay);
    }
  }, [formState.values, formState.isDirty, autoSave, autoSaveDelay]);
  
  const performAutoSave = useCallback(async () => {
    if (!formState.isValid || formState.isSubmitting) return;
    
    setIsAutoSaving(true);
    try {
      // Call a separate auto-save endpoint if available
      if (window.electronAPI?.autoSaveKBEntry) {
        await window.electronAPI.autoSaveKBEntry(formState.values);
      }
      
      // Save draft
      if (enableDrafts) {
        saveDraft();
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      if (!isUnmountedRef.current) {
        setIsAutoSaving(false);
      }
    }
  }, [formState.values, formState.isValid, formState.isSubmitting, enableDrafts]);
  
  // Field value setter
  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setFormState(prev => {
      const newValues = { ...prev.values, [field]: value };
      const isDirty = JSON.stringify(newValues) !== JSON.stringify(initialValues);
      
      let errors = { ...prev.errors };
      let isValid = prev.isValid;
      
      // Real-time validation on change
      if (validateOnChange && validationSchema) {
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
        }
        
        validationTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            const fieldError = validateField(value, validationSchema[field as string], newValues);
            setFormState(current => {
              const updatedErrors = { ...current.errors };
              if (fieldError) {
                updatedErrors[field as string] = fieldError;
              } else {
                delete updatedErrors[field as string];
              }
              
              const newIsValid = Object.keys(updatedErrors).length === 0;
              
              return {
                ...current,
                errors: updatedErrors,
                isValid: newIsValid
              };
            });
          }
        }, 300);
      }
      
      return {
        ...prev,
        values: newValues,
        isDirty,
        errors,
        isValid
      };
    });
  }, [initialValues, validateOnChange, validationSchema]);
  
  // Field error setter
  const setFieldError = useCallback((field: keyof T, error: string | undefined) => {
    setFormState(prev => {
      const newErrors = { ...prev.errors };
      if (error) {
        newErrors[field as string] = error;
      } else {
        delete newErrors[field as string];
      }
      
      return {
        ...prev,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0
      };
    });
  }, []);
  
  // Field touched setter
  const setFieldTouched = useCallback((field: keyof T, touched: boolean) => {
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, [field]: touched }
    }));
  }, []);
  
  // Form reset
  const resetForm = useCallback((newValues?: Partial<T>) => {
    const resetValues = { ...initialValues, ...newValues } as T;
    setFormState(createInitialFormState(resetValues));
    
    if (enableDrafts) {
      clearDraft();
    }
  }, [initialValues, enableDrafts]);
  
  // Form validation
  const validateFormValues = useCallback(async (): Promise<boolean> => {
    if (!validationSchema) return true;
    
    const result = validateForm(formState.values, validationSchema);
    
    setFormState(prev => ({
      ...prev,
      errors: result.errors,
      isValid: result.isValid
    }));
    
    // Focus first error field
    if (!result.isValid && result.firstErrorField) {
      setTimeout(() => {
        const element = document.querySelector(
          `[name="${result.firstErrorField}"], #${result.firstErrorField}`
        ) as HTMLElement;
        element?.focus();
      }, 100);
    }
    
    return result.isValid;
  }, [formState.values, validationSchema]);
  
  // Single field validation
  const validateSingleField = useCallback(async (field: keyof T): Promise<string | null> => {
    if (!validationSchema || !validationSchema[field as string]) return null;
    
    const error = validateField(
      formState.values[field], 
      validationSchema[field as string], 
      formState.values
    );
    
    setFieldError(field, error || undefined);
    return error;
  }, [formState.values, validationSchema, setFieldError]);
  
  // Form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (formState.isSubmitting) return;
    
    setFormState(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      // Validate form
      const isValid = await validateFormValues();
      if (!isValid) {
        return;
      }
      
      // Submit form
      await onSubmit(formState.values);
      
      // Clear draft on successful submission
      if (enableDrafts) {
        clearDraft();
      }
      
      // Reset dirty state
      setFormState(prev => ({ ...prev, isDirty: false }));
      
    } catch (error) {
      console.error('Form submission error:', error);
      if (onError) {
        onError(error as Error);
      }
    } finally {
      if (!isUnmountedRef.current) {
        setFormState(prev => ({ ...prev, isSubmitting: false }));
      }
    }
  }, [formState.values, formState.isSubmitting, validateFormValues, onSubmit, onError, enableDrafts]);
  
  // Field props generator
  const getFieldProps = useCallback((name: keyof T): FieldProps => {
    return {
      name: name as string,
      value: formState.values[name] || '',
      onChange: (e: React.ChangeEvent<any>) => {
        const target = e.target;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        setFieldValue(name, value);
      },
      onBlur: async (e: React.FocusEvent<any>) => {
        setFieldTouched(name, true);
        
        if (validateOnBlur) {
          await validateSingleField(name);
        }
      },
      'aria-invalid': !!formState.errors[name as string] && !!formState.touched[name as string],
      'aria-describedby': formState.errors[name as string] ? `${name as string}-error` : undefined
    };
  }, [formState.values, formState.errors, formState.touched, setFieldValue, setFieldTouched, validateOnBlur, validateSingleField]);
  
  // Field error getter
  const getFieldError = useCallback((name: keyof T): string | undefined => {
    return formState.touched[name as string] ? formState.errors[name as string] : undefined;
  }, [formState.errors, formState.touched]);
  
  // Field touched checker
  const isFieldTouched = useCallback((name: keyof T): boolean => {
    return !!formState.touched[name as string];
  }, [formState.touched]);
  
  // Field invalid checker
  const isFieldInvalid = useCallback((name: keyof T): boolean => {
    return !!formState.errors[name as string] && !!formState.touched[name as string];
  }, [formState.errors, formState.touched]);
  
  // Draft management
  const saveDraft = useCallback(() => {
    if (!enableDrafts || !draftKey) return;
    
    try {
      localStorage.setItem(effectiveDraftKey, JSON.stringify({
        values: formState.values,
        timestamp: Date.now()
      }));
      setHasDraft(true);
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [enableDrafts, draftKey, effectiveDraftKey, formState.values]);
  
  const loadDraft = useCallback((): boolean => {
    if (!enableDrafts || !draftKey) return false;
    
    try {
      const draftData = localStorage.getItem(effectiveDraftKey);
      if (draftData) {
        const { values, timestamp } = JSON.parse(draftData);
        
        // Check if draft is not too old (24 hours)
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setFormState(prev => ({
            ...prev,
            values: { ...initialValues, ...values },
            isDirty: true
          }));
          return true;
        } else {
          clearDraft();
        }
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
    
    return false;
  }, [enableDrafts, draftKey, effectiveDraftKey, initialValues]);
  
  const clearDraft = useCallback(() => {
    if (!enableDrafts || !draftKey) return;
    
    try {
      localStorage.removeItem(effectiveDraftKey);
      setHasDraft(false);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [enableDrafts, draftKey, effectiveDraftKey]);
  
  return {
    // State
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isSubmitting: formState.isSubmitting,
    isDirty: formState.isDirty,
    isValid: formState.isValid,
    isAutoSaving,
    
    // Actions
    setFieldValue,
    setFieldError,
    setFieldTouched,
    resetForm,
    validateForm: validateFormValues,
    validateField: validateSingleField,
    handleSubmit,
    
    // Field helpers
    getFieldProps,
    getFieldError,
    isFieldTouched,
    isFieldInvalid,
    
    // Draft management
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft
  };
}