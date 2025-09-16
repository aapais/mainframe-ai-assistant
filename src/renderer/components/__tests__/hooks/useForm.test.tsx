/**
 * useForm Hook Tests
 * Comprehensive testing for custom form hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useForm } from '../../../implementation/frontend/hooks/useForm';

describe('useForm Hook', () => {
  const mockValidationRules = {
    title: {
      required: true,
      minLength: 5,
      maxLength: 100,
      custom: (value: string) => {
        if (value && value.toLowerCase().includes('test')) {
          return 'Title cannot contain the word "test"';
        }
        return undefined;
      },
    },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    age: {
      custom: (value: number) => {
        if (value && (value < 18 || value > 100)) {
          return 'Age must be between 18 and 100';
        }
        return undefined;
      },
    },
  };

  const mockDefaultValues = {
    title: 'Default Title',
    email: '',
    age: 25,
  };

  describe('Initialization', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: mockDefaultValues,
        })
      );

      expect(result.current.formState.data).toEqual(mockDefaultValues);
      expect(result.current.formState.isDirty).toBe(false);
      expect(result.current.formState.isValid).toBe(true);
      expect(result.current.formState.isSubmitting).toBe(false);
      expect(result.current.formState.errors).toEqual({});
      expect(result.current.formState.touched).toEqual({});
    });

    it('initializes with empty values when no defaults provided', () => {
      const { result } = renderHook(() => useForm());

      expect(result.current.formState.data).toEqual({});
      expect(result.current.formState.isDirty).toBe(false);
      expect(result.current.formState.isValid).toBe(true);
    });
  });

  describe('setValue Function', () => {
    it('updates form data correctly', () => {
      const { result } = renderHook(() =>
        useForm({ defaultValues: mockDefaultValues })
      );

      act(() => {
        result.current.setValue('title', 'New Title');
      });

      expect(result.current.formState.data.title).toBe('New Title');
      expect(result.current.formState.isDirty).toBe(true);
    });

    it('validates on change when validateOnChange is enabled', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: mockDefaultValues,
          validationRules: mockValidationRules,
          validateOnChange: true,
        })
      );

      act(() => {
        result.current.setValue('title', 'ab'); // Too short
      });

      expect(result.current.formState.errors.title?.type).toBe('minLength');
      expect(result.current.formState.isValid).toBe(false);
    });

    it('skips validation on change when validateOnChange is disabled', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: mockDefaultValues,
          validationRules: mockValidationRules,
          validateOnChange: false,
        })
      );

      act(() => {
        result.current.setValue('title', 'ab'); // Too short
      });

      expect(result.current.formState.errors.title).toBeUndefined();
      expect(result.current.formState.isValid).toBe(true);
    });

    it('clears validation errors when field becomes valid', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: '' },
          validationRules: mockValidationRules,
          validateOnChange: true,
        })
      );

      // Set invalid value first
      act(() => {
        result.current.setValue('title', 'ab'); // Too short
      });

      expect(result.current.formState.errors.title).toBeDefined();

      // Set valid value
      act(() => {
        result.current.setValue('title', 'Valid Title');
      });

      expect(result.current.formState.errors.title).toBeUndefined();
      expect(result.current.formState.isValid).toBe(true);
    });
  });

  describe('Validation', () => {
    it('validates required fields correctly', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: '', email: '' },
          validationRules: mockValidationRules,
        })
      );

      act(() => {
        result.current.validate();
      });

      expect(result.current.formState.errors.title?.type).toBe('required');
      expect(result.current.formState.errors.email?.type).toBe('required');
      expect(result.current.formState.isValid).toBe(false);
    });

    it('validates minLength constraints', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'abc' },
          validationRules: mockValidationRules,
        })
      );

      act(() => {
        result.current.validate();
      });

      expect(result.current.formState.errors.title?.type).toBe('minLength');
      expect(result.current.formState.errors.title?.message).toContain('at least 5 characters');
    });

    it('validates maxLength constraints', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'a'.repeat(101) },
          validationRules: mockValidationRules,
        })
      );

      act(() => {
        result.current.validate();
      });

      expect(result.current.formState.errors.title?.type).toBe('maxLength');
      expect(result.current.formState.errors.title?.message).toContain('no more than 100 characters');
    });

    it('validates pattern constraints', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { email: 'invalid-email' },
          validationRules: mockValidationRules,
        })
      );

      act(() => {
        result.current.validate();
      });

      expect(result.current.formState.errors.email?.type).toBe('pattern');
      expect(result.current.formState.errors.email?.message).toBe('Invalid format');
    });

    it('validates custom validation rules', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'This is a test title', age: 150 },
          validationRules: mockValidationRules,
        })
      );

      act(() => {
        result.current.validate();
      });

      expect(result.current.formState.errors.title?.type).toBe('custom');
      expect(result.current.formState.errors.title?.message).toContain('cannot contain the word "test"');
      expect(result.current.formState.errors.age?.type).toBe('custom');
      expect(result.current.formState.errors.age?.message).toContain('Age must be between 18 and 100');
    });

    it('validates single field when field name is provided', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'ab', email: 'invalid' },
          validationRules: mockValidationRules,
        })
      );

      act(() => {
        const isValid = result.current.validate('title');
        expect(isValid).toBe(false);
      });

      expect(result.current.formState.errors.title).toBeDefined();
      expect(result.current.formState.errors.email).toBeUndefined(); // Should not validate email
    });

    it('skips other validations for empty non-required fields', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'Valid Title', age: undefined },
          validationRules: {
            title: { required: true, minLength: 5 },
            age: { minLength: 2 }, // Not required, but has minLength
          },
        })
      );

      act(() => {
        result.current.validate();
      });

      expect(result.current.formState.errors.age).toBeUndefined(); // Should not validate empty non-required field
      expect(result.current.formState.isValid).toBe(true);
    });
  });

  describe('setTouched Function', () => {
    it('sets field as touched', () => {
      const { result } = renderHook(() =>
        useForm({ defaultValues: mockDefaultValues })
      );

      act(() => {
        result.current.setTouched('title', true);
      });

      expect(result.current.formState.touched.title).toBe(true);
    });

    it('validates on blur when validateOnBlur is enabled', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'ab' },
          validationRules: mockValidationRules,
          validateOnBlur: true,
        })
      );

      act(() => {
        result.current.setTouched('title', true);
      });

      expect(result.current.formState.errors.title?.type).toBe('minLength');
      expect(result.current.formState.isValid).toBe(false);
    });

    it('skips validation on blur when validateOnBlur is disabled', () => {
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'ab' },
          validationRules: mockValidationRules,
          validateOnBlur: false,
        })
      );

      act(() => {
        result.current.setTouched('title', true);
      });

      expect(result.current.formState.errors.title).toBeUndefined();
    });

    it('only validates on first touch', () => {
      const customRule = jest.fn(() => 'Custom error');
      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'test' },
          validationRules: {
            title: { custom: customRule },
          },
          validateOnBlur: true,
        })
      );

      // First touch - should validate
      act(() => {
        result.current.setTouched('title', true);
      });

      expect(customRule).toHaveBeenCalledTimes(1);

      customRule.mockClear();

      // Second touch - should not validate again
      act(() => {
        result.current.setTouched('title', true);
      });

      expect(customRule).not.toHaveBeenCalled();
    });
  });

  describe('isDirty Detection', () => {
    it('detects when form data has changed from initial values', () => {
      const { result } = renderHook(() =>
        useForm({ defaultValues: mockDefaultValues })
      );

      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setValue('title', 'Changed Title');
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('correctly handles array changes', () => {
      const { result } = renderHook(() =>
        useForm({ defaultValues: { tags: ['tag1', 'tag2'] } })
      );

      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setValue('tags', ['tag1', 'tag2', 'tag3']);
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('resets dirty state when values return to initial state', () => {
      const { result } = renderHook(() =>
        useForm({ defaultValues: mockDefaultValues })
      );

      act(() => {
        result.current.setValue('title', 'Changed Title');
      });

      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.setValue('title', 'Default Title');
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('Form Submission', () => {
    it('submits valid form data', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'Valid Title', email: 'test@example.com' },
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      await act(async () => {
        await result.current.submit();
      });

      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'Valid Title',
        email: 'test@example.com',
      });
      expect(result.current.formState.isSubmitting).toBe(false);
    });

    it('prevents submission of invalid form', async () => {
      const mockOnSubmit = jest.fn();

      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: '', email: '' },
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      await act(async () => {
        await result.current.submit();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.formState.isValid).toBe(false);
    });

    it('sets isSubmitting during submission', async () => {
      let resolveSubmit: (value: any) => void;
      const submitPromise = new Promise(resolve => {
        resolveSubmit = resolve;
      });
      const mockOnSubmit = jest.fn().mockReturnValue(submitPromise);

      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'Valid Title', email: 'test@example.com' },
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      act(() => {
        result.current.submit();
      });

      expect(result.current.formState.isSubmitting).toBe(true);

      await act(async () => {
        resolveSubmit!({ success: true });
        await submitPromise;
      });

      expect(result.current.formState.isSubmitting).toBe(false);
    });

    it('resets form after successful submission when resetOnSubmit is true', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useForm({
          defaultValues: mockDefaultValues,
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
          resetOnSubmit: true,
        })
      );

      act(() => {
        result.current.setValue('title', 'Changed Title');
      });

      expect(result.current.isDirty).toBe(true);

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.formState.data).toEqual(mockDefaultValues);
      expect(result.current.isDirty).toBe(false);
    });

    it('handles submission validation errors', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue({
        success: false,
        validationErrors: {
          title: 'Server validation failed',
          email: 'Email already exists',
        },
      });

      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'Valid Title', email: 'test@example.com' },
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.formState.errors.title?.message).toBe('Server validation failed');
      expect(result.current.formState.errors.email?.message).toBe('Email already exists');
      expect(result.current.formState.isValid).toBe(false);
    });

    it('handles submission errors gracefully', async () => {
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() =>
        useForm({
          defaultValues: { title: 'Valid Title', email: 'test@example.com' },
          validationRules: mockValidationRules,
          onSubmit: mockOnSubmit,
        })
      );

      await act(async () => {
        await result.current.submit();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Form submission error:', expect.any(Error));
      expect(result.current.formState.isSubmitting).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('Reset Function', () => {
    it('resets form to default values', () => {
      const { result } = renderHook(() =>
        useForm({ defaultValues: mockDefaultValues })
      );

      act(() => {
        result.current.setValue('title', 'Changed Title');
        result.current.setTouched('title', true);
      });

      expect(result.current.isDirty).toBe(true);
      expect(result.current.formState.touched.title).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.formState.data).toEqual(mockDefaultValues);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.formState.touched).toEqual({});
      expect(result.current.formState.errors).toEqual({});
      expect(result.current.formState.isValid).toBe(true);
    });

    it('resets form to provided values', () => {
      const newValues = { title: 'New Default', email: 'new@example.com', age: 30 };

      const { result } = renderHook(() =>
        useForm({ defaultValues: mockDefaultValues })
      );

      act(() => {
        result.current.setValue('title', 'Changed Title');
      });

      act(() => {
        result.current.reset(newValues);
      });

      expect(result.current.formState.data).toEqual(newValues);
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('Error Management', () => {
    it('sets custom error for field', () => {
      const { result } = renderHook(() => useForm());

      const customError = {
        message: 'Custom error message',
        type: 'custom' as const,
      };

      act(() => {
        result.current.setError('title', customError);
      });

      expect(result.current.formState.errors.title).toEqual(customError);
      expect(result.current.formState.isValid).toBe(false);
    });

    it('clears error for field', () => {
      const { result } = renderHook(() => useForm());

      const customError = {
        message: 'Custom error message',
        type: 'custom' as const,
      };

      act(() => {
        result.current.setError('title', customError);
      });

      expect(result.current.formState.errors.title).toBeDefined();

      act(() => {
        result.current.clearError('title');
      });

      expect(result.current.formState.errors.title).toBeUndefined();
      expect(result.current.formState.isValid).toBe(true);
    });
  });
});