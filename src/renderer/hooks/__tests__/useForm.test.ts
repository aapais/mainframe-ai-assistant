import { renderHook, act } from '@testing-library/react';
import { useForm } from '../useForm';
import { ValidationRules } from '../../utils/validation';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock debounce for testing
jest.mock('lodash', () => ({
  debounce: (fn: Function, delay: number) => {
    // Return immediate execution for tests
    return (...args: any[]) => fn(...args);
  }
}));

describe('useForm Hook', () => {
  const mockOnSubmit = jest.fn();
  const initialValues = {
    name: '',
    email: '',
    message: '',
    category: '',
    tags: [] as string[],
  };

  const validationSchema = {
    name: [ValidationRules.required('Name is required')],
    email: [
      ValidationRules.required('Email is required'),
      ValidationRules.email('Invalid email format')
    ],
    message: [ValidationRules.minLength(10, 'Message must be at least 10 characters')],
    category: [ValidationRules.required('Category is required')],
    tags: [ValidationRules.arrayMinLength(1, 'At least one tag is required')],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockOnSubmit.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      expect(result.current.formState.data).toEqual(initialValues);
      expect(result.current.formState.errors).toEqual({});
      expect(result.current.formState.touched).toEqual({});
      expect(result.current.isValid).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.formState.isDirty).toBe(false);
    });

    it('should update form data when setValue is called', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.setValue('name', 'John Doe');
      });

      expect(result.current.formState.data.name).toBe('John Doe');
      expect(result.current.formState.isDirty).toBe(true);
    });

    it('should mark field as touched when setTouched is called', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.setTouched('name', true);
      });

      expect(result.current.formState.touched.name).toBe(true);
    });

    it('should reset form to initial values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      // Change values
      act(() => {
        result.current.setValue('name', 'John Doe');
        result.current.setValue('email', 'john@example.com');
        result.current.setTouched('name', true);
      });

      expect(result.current.formState.isDirty).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.formState.data).toEqual(initialValues);
      expect(result.current.formState.touched).toEqual({});
      expect(result.current.formState.isDirty).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate field when setValue is called with validateOnChange', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      act(() => {
        result.current.setValue('name', ''); // Empty value should trigger required validation
      });

      expect(result.current.formState.errors.name).toEqual({
        message: 'Name is required',
        type: 'required'
      });
    });

    it('should validate field when setTouched is called with validateOnBlur', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnBlur: true,
        })
      );

      act(() => {
        result.current.setTouched('name', true); // Should trigger validation on empty field
      });

      expect(result.current.formState.errors.name).toEqual({
        message: 'Name is required',
        type: 'required'
      });
    });

    it('should validate email format correctly', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      act(() => {
        result.current.setValue('email', 'invalid-email');
      });

      expect(result.current.formState.errors.email).toEqual({
        message: 'Invalid email format',
        type: 'email'
      });
    });

    it('should validate minimum length correctly', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      act(() => {
        result.current.setValue('message', 'short');
      });

      expect(result.current.formState.errors.message).toEqual({
        message: 'Message must be at least 10 characters',
        type: 'minLength'
      });
    });

    it('should validate array minimum length', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      act(() => {
        result.current.setValue('tags', []);
      });

      expect(result.current.formState.errors.tags).toEqual({
        message: 'At least one tag is required',
        type: 'arrayMinLength'
      });
    });

    it('should determine form validity correctly', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      expect(result.current.isValid).toBe(false);

      // Fill all required fields correctly
      act(() => {
        result.current.setValue('name', 'John Doe');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('message', 'This is a long enough message');
        result.current.setValue('category', 'general');
        result.current.setValue('tags', ['tag1']);
      });

      expect(result.current.isValid).toBe(true);
    });

    it('should validate all fields when validateForm is called', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.validateForm();
      });

      expect(result.current.formState.errors.name).toEqual({
        message: 'Name is required',
        type: 'required'
      });
      expect(result.current.formState.errors.email).toEqual({
        message: 'Email is required',
        type: 'required'
      });
      expect(result.current.formState.errors.category).toEqual({
        message: 'Category is required',
        type: 'required'
      });
      expect(result.current.formState.errors.tags).toEqual({
        message: 'At least one tag is required',
        type: 'arrayMinLength'
      });
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit when form is valid', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      // Fill valid data
      act(() => {
        result.current.setValue('name', 'John Doe');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('message', 'This is a valid message');
        result.current.setValue('category', 'general');
        result.current.setValue('tags', ['tag1']);
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'This is a valid message',
        category: 'general',
        tags: ['tag1'],
      });
    });

    it('should not call onSubmit when form is invalid', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      await act(async () => {
        await result.current.submit();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should set isSubmitting during submission', async () => {
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      mockOnSubmit.mockReturnValue(submitPromise);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      // Fill valid data
      act(() => {
        result.current.setValue('name', 'John Doe');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('message', 'Valid message here');
        result.current.setValue('category', 'general');
        result.current.setValue('tags', ['tag1']);
      });

      // Start submission
      const submitPromiseResult = act(async () => {
        return result.current.submit();
      });

      expect(result.current.isSubmitting).toBe(true);

      // Resolve submission
      act(() => {
        resolveSubmit!();
      });

      await submitPromiseResult;

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should reset form after successful submission when resetOnSubmit is true', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          resetOnSubmit: true,
        })
      );

      // Fill valid data
      act(() => {
        result.current.setValue('name', 'John Doe');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('message', 'Valid message here');
        result.current.setValue('category', 'general');
        result.current.setValue('tags', ['tag1']);
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.formState.data).toEqual(initialValues);
      expect(result.current.formState.isDirty).toBe(false);
    });
  });

  describe('Draft Management', () => {
    const draftKey = 'test-draft';

    it('should save draft to localStorage when enableDrafts is true', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          enableDrafts: true,
          draftKey,
        })
      );

      act(() => {
        result.current.setValue('name', 'Draft Name');
      });

      act(() => {
        result.current.saveDraft();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        `form-draft-${draftKey}`,
        expect.stringContaining('"name":"Draft Name"')
      );
    });

    it('should load draft from localStorage on initialization', () => {
      const draftData = {
        name: 'Loaded Name',
        email: 'loaded@example.com',
        message: 'Loaded message content',
        category: 'loaded',
        tags: ['loaded-tag'],
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        data: draftData,
        timestamp: Date.now(),
      }));

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          enableDrafts: true,
          draftKey,
        })
      );

      expect(result.current.formState.data).toEqual(draftData);
      expect(result.current.hasDraft).toBe(true);
    });

    it('should clear draft when clearDraft is called', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          enableDrafts: true,
          draftKey,
        })
      );

      act(() => {
        result.current.clearDraft();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(`form-draft-${draftKey}`);
      expect(result.current.hasDraft).toBe(false);
    });

    it('should not save draft when form is clean', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          enableDrafts: true,
          draftKey,
        })
      );

      act(() => {
        result.current.saveDraft();
      });

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle corrupted draft data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          enableDrafts: true,
          draftKey,
        })
      );

      expect(result.current.formState.data).toEqual(initialValues);
      expect(result.current.hasDraft).toBe(false);
    });
  });

  describe('Auto-save', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should auto-save when autoSave is enabled', () => {
      const mockOnAutoSave = jest.fn();

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          autoSave: true,
          onAutoSave: mockOnAutoSave,
        })
      );

      act(() => {
        result.current.setValue('name', 'Auto Save Name');
      });

      // Fast-forward timer
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockOnAutoSave).toHaveBeenCalledWith({
        name: 'Auto Save Name',
        email: '',
        message: '',
        category: '',
        tags: [],
      });
    });

    it('should not auto-save when form is not dirty', () => {
      const mockOnAutoSave = jest.fn();

      renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          autoSave: true,
          onAutoSave: mockOnAutoSave,
        })
      );

      // Fast-forward timer without making changes
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockOnAutoSave).not.toHaveBeenCalled();
    });
  });

  describe('Field Helpers', () => {
    it('should provide field props for form fields', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      const fieldProps = result.current.getFieldProps('name');

      expect(fieldProps).toEqual({
        name: 'name',
        value: '',
        onChange: expect.any(Function),
        onBlur: expect.any(Function),
      });
    });

    it('should get field error', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      act(() => {
        result.current.setValue('name', ''); // Trigger validation
      });

      const error = result.current.getFieldError('name');
      expect(error).toBe('Name is required');
    });

    it('should check if field is touched', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      expect(result.current.isFieldTouched('name')).toBe(false);

      act(() => {
        result.current.setTouched('name', true);
      });

      expect(result.current.isFieldTouched('name')).toBe(true);
    });

    it('should check if field has error', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
          validateOnChange: true,
        })
      );

      expect(result.current.hasFieldError('name')).toBe(false);

      act(() => {
        result.current.setValue('name', ''); // Trigger validation error
      });

      expect(result.current.hasFieldError('name')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle submission errors gracefully', async () => {
      const submitError = new Error('Submission failed');
      mockOnSubmit.mockRejectedValue(submitError);

      const { result } = renderHook(() =>
        useForm({
          initialValues,
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      // Fill valid data
      act(() => {
        result.current.setValue('name', 'John Doe');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('message', 'Valid message here');
        result.current.setValue('category', 'general');
        result.current.setValue('tags', ['tag1']);
      });

      let submitResult;
      await act(async () => {
        submitResult = await result.current.submit();
      });

      expect(submitResult).toEqual({
        success: false,
        error: 'Submission failed'
      });
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined validation schema', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.setValue('name', 'Test');
      });

      expect(result.current.formState.errors).toEqual({});
      expect(result.current.isValid).toBe(true);
    });

    it('should handle fields not in validation schema', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { ...initialValues, extraField: '' },
          validationSchema,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.setValue('extraField', 'Extra Value');
      });

      expect(result.current.formState.data.extraField).toBe('Extra Value');
      expect(result.current.formState.errors.extraField).toBeUndefined();
    });
  });
});