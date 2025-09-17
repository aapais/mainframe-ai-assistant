/**
 * UX Enhancement Hooks
 * Provides React hooks for auto-save, confirmation dialogs, loading states, and user experience improvements
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { announceToScreenReader, announceLoading, announceSuccess } from '../utils/accessibility';

// Auto-save hook
export interface UseAutoSaveOptions {
  delay?: number; // Delay in milliseconds before auto-save triggers
  enabled?: boolean;
  onSave: (data: any) => Promise<void>;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  error: string | null;
}

export function useAutoSave<T>(
  data: T,
  options: UseAutoSaveOptions
): AutoSaveState {
  const {
    delay = 2000,
    enabled = true,
    onSave,
    onError,
    onSuccess
  } = options;

  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    error: null
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastDataRef = useRef<T>(data);
  const isInitialRender = useRef(true);

  const performSave = useCallback(async () => {
    if (!enabled) return;

    setState(prev => ({ ...prev, isSaving: true, error: null }));
    announceLoading(true, 'auto-save');

    try {
      await onSave(data);
      setState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
        error: null
      }));
      
      announceLoading(false, 'auto-save');
      announceSuccess('Changes saved automatically');
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Auto-save failed';
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: errorMessage
      }));
      
      announceLoading(false, 'auto-save');
      announceToScreenReader(`Auto-save failed: ${errorMessage}`, 'assertive');
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [data, enabled, onSave, onSuccess, onError]);

  useEffect(() => {
    // Skip auto-save on initial render
    if (isInitialRender.current) {
      isInitialRender.current = false;
      lastDataRef.current = data;
      return;
    }

    // Check if data has actually changed
    if (JSON.stringify(data) === JSON.stringify(lastDataRef.current)) {
      return;
    }

    lastDataRef.current = data;
    setState(prev => ({ ...prev, hasUnsavedChanges: true }));

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(performSave, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, performSave]);

  // Manual save function
  const manualSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    performSave();
  }, [performSave]);

  // Add manual save to return object
  return useMemo(() => ({
    ...state,
    manualSave
  }), [state, manualSave]);
}

// Confirmation dialog hook
export interface UseConfirmationOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export interface ConfirmationState {
  isOpen: boolean;
  options: UseConfirmationOptions | null;
  resolve: ((value: boolean) => void) | null;
}

export function useConfirmation() {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    options: null,
    resolve: null
  });

  const confirm = useCallback((options: UseConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options: {
          title: 'Confirm Action',
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          variant: 'info',
          ...options
        },
        resolve
      });

      // Announce to screen readers
      announceToScreenReader(
        `Confirmation dialog opened: ${options.message}`,
        'assertive'
      );
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (state.resolve) {
      state.resolve(true);
      announceToScreenReader('Action confirmed', 'polite');
    }
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    if (state.resolve) {
      state.resolve(false);
      announceToScreenReader('Action cancelled', 'polite');
    }
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  return {
    isOpen: state.isOpen,
    options: state.options,
    confirm,
    handleConfirm,
    handleCancel
  };
}

// Loading states hook with screen reader announcements
export interface LoadingState {
  [key: string]: boolean;
}

export function useLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = useCallback((key: string, isLoading: boolean, context?: string) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));

    // Announce loading state to screen readers
    announceLoading(isLoading, context || key);
  }, []);

  const isLoading = useCallback((key?: string) => {
    if (key) {
      return loadingStates[key] || false;
    }
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  return { loadingStates, setLoading, isLoading };
}

// Success/Error notification hook
export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  duration?: number;
  action?: {
    label: string;
    handler: () => void;
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);

  const addNotification = useCallback((
    type: NotificationState['type'],
    message: string,
    options?: {
      duration?: number;
      action?: NotificationState['action'];
    }
  ) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: NotificationState = {
      id,
      type,
      message,
      timestamp: new Date(),
      duration: options?.duration || (type === 'error' ? 0 : 5000), // Errors don't auto-dismiss
      action: options?.action
    };

    setNotifications(prev => [...prev, notification]);

    // Announce to screen readers
    const priority = type === 'error' ? 'assertive' : 'polite';
    announceToScreenReader(`${type}: ${message}`, priority);

    // Auto-dismiss if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((message: string, options?: { duration?: number; action?: NotificationState['action'] }) => {
    return addNotification('success', message, options);
  }, [addNotification]);

  const error = useCallback((message: string, options?: { action?: NotificationState['action'] }) => {
    return addNotification('error', message, { ...options, duration: 0 });
  }, [addNotification]);

  const warning = useCallback((message: string, options?: { duration?: number; action?: NotificationState['action'] }) => {
    return addNotification('warning', message, options);
  }, [addNotification]);

  const info = useCallback((message: string, options?: { duration?: number; action?: NotificationState['action'] }) => {
    return addNotification('info', message, options);
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    success,
    error,
    warning,
    info
  };
}

// Form validation hook with accessibility
export interface FieldError {
  field: string;
  message: string;
  type?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FieldError[];
  firstErrorField?: string;
}

export type Validator<T> = (value: T) => string | null;
export type ValidatorMap<T> = {
  [K in keyof T]?: Validator<T[K]>[];
};

export function useFormValidation<T extends Record<string, any>>(
  data: T,
  validators: ValidatorMap<T>
) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());

  const validateField = useCallback((field: keyof T, value: any): string | null => {
    const fieldValidators = validators[field];
    if (!fieldValidators) return null;

    for (const validator of fieldValidators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  }, [validators]);

  const validateAll = useCallback((): ValidationResult => {
    const newErrors: FieldError[] = [];

    Object.keys(validators).forEach(field => {
      const error = validateField(field as keyof T, data[field]);
      if (error) {
        newErrors.push({
          field: field as string,
          message: error
        });
      }
    });

    setErrors(newErrors);

    // Announce validation errors to screen readers
    if (newErrors.length > 0) {
      const firstError = newErrors[0];
      announceToScreenReader(
        `Form has ${newErrors.length} error${newErrors.length > 1 ? 's' : ''}. First error: ${firstError.message}`,
        'assertive'
      );
    }

    return {
      isValid: newErrors.length === 0,
      errors: newErrors,
      firstErrorField: newErrors[0]?.field
    };
  }, [data, validators, validateField]);

  const setFieldTouched = useCallback((field: keyof T) => {
    setTouched(prev => new Set(prev).add(field));

    // Validate this field
    const error = validateField(field, data[field]);
    setErrors(prev => {
      const newErrors = prev.filter(e => e.field !== field);
      if (error) {
        newErrors.push({ field: field as string, message: error });
        // Announce field error
        announceToScreenReader(`Error in ${field as string}: ${error}`, 'assertive');
      }
      return newErrors;
    });
  }, [data, validateField]);

  const getFieldError = useCallback((field: keyof T): string | null => {
    if (!touched.has(field)) return null;
    const error = errors.find(e => e.field === field);
    return error?.message || null;
  }, [errors, touched]);

  const hasFieldError = useCallback((field: keyof T): boolean => {
    return getFieldError(field) !== null;
  }, [getFieldError]);

  const clearFieldError = useCallback((field: keyof T) => {
    setErrors(prev => prev.filter(e => e.field !== field));
    setTouched(prev => {
      const newTouched = new Set(prev);
      newTouched.delete(field);
      return newTouched;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors([]);
    setTouched(new Set());
  }, []);

  return {
    errors,
    touched,
    validateAll,
    setFieldTouched,
    getFieldError,
    hasFieldError,
    clearFieldError,
    clearAllErrors,
    isValid: errors.length === 0
  };
}

// Keyboard shortcuts hook with accessibility
export interface ShortcutConfig {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  handler: (event: KeyboardEvent) => void;
  description: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  disabled?: boolean;
}

export function useAccessibleShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    const isInputElement = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                          target.contentEditable === 'true';

    if (isInputElement && event.key !== 'Escape') return;

    shortcuts.forEach(shortcut => {
      if (shortcut.disabled) return;

      const { key, modifiers = [], handler, preventDefault = true, stopPropagation = true } = shortcut;
      
      // Check if key matches
      if (event.key.toLowerCase() !== key.toLowerCase()) return;

      // Check modifiers
      const hasCtrl = modifiers.includes('ctrl') && (event.ctrlKey || event.metaKey);
      const hasAlt = modifiers.includes('alt') && event.altKey;
      const hasShift = modifiers.includes('shift') && event.shiftKey;
      const hasMeta = modifiers.includes('meta') && event.metaKey;

      const requiredModifiers = modifiers.length;
      const activeModifiers = [hasCtrl, hasAlt, hasShift, hasMeta].filter(Boolean).length;

      // Exact modifier match required
      if (activeModifiers !== requiredModifiers) return;
      if (modifiers.includes('ctrl') && !hasCtrl) return;
      if (modifiers.includes('alt') && !hasAlt) return;
      if (modifiers.includes('shift') && !hasShift) return;
      if (modifiers.includes('meta') && !hasMeta) return;

      // Execute handler
      if (preventDefault) event.preventDefault();
      if (stopPropagation) event.stopPropagation();
      
      try {
        handler(event);
      } catch (error) {
        console.error('Error executing keyboard shortcut:', error);
      }
    });
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return shortcuts help text
  const getShortcutsHelp = useCallback(() => {
    return shortcuts
      .filter(s => !s.disabled)
      .map(s => ({
        shortcut: s.modifiers ? 
          `${s.modifiers.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' + ')} + ${s.key}` :
          s.key,
        description: s.description
      }));
  }, [shortcuts]);

  return { getShortcutsHelp };
}

// Delayed execution hook (debounce with loading state)
export function useDelayedExecution(delay: number = 300) {
  const [isExecuting, setIsExecuting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const execute = useCallback(async (
    action: () => Promise<void> | void,
    context = 'action'
  ) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsExecuting(true);
    announceLoading(true, context);

    timeoutRef.current = setTimeout(async () => {
      try {
        await action();
        announceLoading(false, context);
      } catch (error) {
        announceToScreenReader(`${context} failed`, 'assertive');
        console.error(`Delayed execution error for ${context}:`, error);
      } finally {
        setIsExecuting(false);
      }
    }, delay);
  }, [delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setIsExecuting(false);
      announceLoading(false, 'action');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { execute, cancel, isExecuting };
}

export default {
  useAutoSave,
  useConfirmation,
  useLoadingStates,
  useNotifications,
  useFormValidation,
  useAccessibleShortcuts,
  useDelayedExecution
};