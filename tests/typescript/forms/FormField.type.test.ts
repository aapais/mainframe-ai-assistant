/**
 * TypeScript Type Tests for FormField Components
 * Tests all form field prop types, validation, and generic constraints
 */

import { describe, it, expectTypeOf } from 'vitest';
import type { ComponentProps, ReactNode, RefObject, ChangeEvent, FocusEvent } from 'react';
import {
  FormField,
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField,
  type BaseFieldProps,
  type TextFieldProps,
  type TextAreaFieldProps,
  type SelectFieldProps,
  type CheckboxFieldProps
} from '../../../src/renderer/components/common/FormField';

describe('FormField Component TypeScript Tests', () => {
  describe('BaseFieldProps Interface', () => {
    it('should require label and name properties', () => {
      expectTypeOf<BaseFieldProps['label']>().toEqualTypeOf<string>();
      expectTypeOf<BaseFieldProps['name']>().toEqualTypeOf<string>();
    });

    it('should accept optional validation props', () => {
      expectTypeOf<BaseFieldProps['error']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['hint']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['required']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<BaseFieldProps['disabled']>().toEqualTypeOf<boolean | undefined>();
    });

    it('should accept styling class props', () => {
      expectTypeOf<BaseFieldProps['className']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['labelClassName']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['inputClassName']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['errorClassName']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['hintClassName']>().toEqualTypeOf<string | undefined>();
    });

    it('should accept accessibility props', () => {
      expectTypeOf<BaseFieldProps['aria-label']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['aria-labelledby']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['aria-describedby']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['aria-invalid']>().toEqualTypeOf<boolean | undefined>();
    });

    it('should accept visual indicator props', () => {
      expectTypeOf<BaseFieldProps['showRequiredIndicator']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<BaseFieldProps['showOptionalIndicator']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<BaseFieldProps['showCharacterCount']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<BaseFieldProps['maxLength']>().toEqualTypeOf<number | undefined>();
    });

    it('should accept help and tooltip props', () => {
      expectTypeOf<BaseFieldProps['helpText']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<BaseFieldProps['tooltip']>().toEqualTypeOf<string | undefined>();
    });
  });

  describe('TextFieldProps Interface', () => {
    it('should extend BaseFieldProps', () => {
      expectTypeOf<TextFieldProps>().toMatchTypeOf<BaseFieldProps>();
    });

    it('should accept valid input types', () => {
      expectTypeOf<TextFieldProps['type']>().toEqualTypeOf<
        'text' | 'email' | 'password' | 'url' | 'tel' | undefined
      >();
    });

    it('should require value and onChange', () => {
      expectTypeOf<TextFieldProps['value']>().toEqualTypeOf<string>();
      expectTypeOf<TextFieldProps['onChange']>().toEqualTypeOf<
        (e: ChangeEvent<HTMLInputElement>) => void
      >();
    });

    it('should accept optional event handlers', () => {
      expectTypeOf<TextFieldProps['onBlur']>().toEqualTypeOf<
        ((e: FocusEvent<HTMLInputElement>) => void) | undefined
      >();
      expectTypeOf<TextFieldProps['onFocus']>().toEqualTypeOf<
        ((e: FocusEvent<HTMLInputElement>) => void) | undefined
      >();
    });

    it('should accept input configuration props', () => {
      expectTypeOf<TextFieldProps['placeholder']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TextFieldProps['autoComplete']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TextFieldProps['autoFocus']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<TextFieldProps['readOnly']>().toEqualTypeOf<boolean | undefined>();
    });

    it('should accept size and variant props', () => {
      expectTypeOf<TextFieldProps['size']>().toEqualTypeOf<
        'small' | 'medium' | 'large' | undefined
      >();
      expectTypeOf<TextFieldProps['variant']>().toEqualTypeOf<
        'default' | 'filled' | 'outlined' | undefined
      >();
    });
  });

  describe('TextAreaFieldProps Interface', () => {
    it('should extend BaseFieldProps', () => {
      expectTypeOf<TextAreaFieldProps>().toMatchTypeOf<BaseFieldProps>();
    });

    it('should require value and onChange for textarea', () => {
      expectTypeOf<TextAreaFieldProps['value']>().toEqualTypeOf<string>();
      expectTypeOf<TextAreaFieldProps['onChange']>().toEqualTypeOf<
        (e: ChangeEvent<HTMLTextAreaElement>) => void
      >();
    });

    it('should accept textarea-specific event handlers', () => {
      expectTypeOf<TextAreaFieldProps['onBlur']>().toEqualTypeOf<
        ((e: FocusEvent<HTMLTextAreaElement>) => void) | undefined
      >();
      expectTypeOf<TextAreaFieldProps['onFocus']>().toEqualTypeOf<
        ((e: FocusEvent<HTMLTextAreaElement>) => void) | undefined
      >();
    });

    it('should accept textarea configuration props', () => {
      expectTypeOf<TextAreaFieldProps['rows']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<TextAreaFieldProps['minRows']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<TextAreaFieldProps['maxRows']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<TextAreaFieldProps['placeholder']>().toEqualTypeOf<string | undefined>();
    });

    it('should accept resize and auto-resize props', () => {
      expectTypeOf<TextAreaFieldProps['resize']>().toEqualTypeOf<
        'none' | 'both' | 'horizontal' | 'vertical' | undefined
      >();
      expectTypeOf<TextAreaFieldProps['autoResize']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('SelectFieldProps Interface', () => {
    it('should extend BaseFieldProps', () => {
      expectTypeOf<SelectFieldProps>().toMatchTypeOf<BaseFieldProps>();
    });

    it('should require value and onChange for select', () => {
      expectTypeOf<SelectFieldProps['value']>().toEqualTypeOf<string>();
      expectTypeOf<SelectFieldProps['onChange']>().toEqualTypeOf<
        (e: ChangeEvent<HTMLSelectElement>) => void
      >();
    });

    it('should accept select-specific event handlers', () => {
      expectTypeOf<SelectFieldProps['onBlur']>().toEqualTypeOf<
        ((e: FocusEvent<HTMLSelectElement>) => void) | undefined
      >();
      expectTypeOf<SelectFieldProps['onFocus']>().toEqualTypeOf<
        ((e: FocusEvent<HTMLSelectElement>) => void) | undefined
      >();
    });

    it('should require properly typed options array', () => {
      expectTypeOf<SelectFieldProps['options']>().toEqualTypeOf<
        Array<{ value: string; label: string; disabled?: boolean }>
      >();
    });

    it('should accept select configuration props', () => {
      expectTypeOf<SelectFieldProps['placeholder']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<SelectFieldProps['multiple']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('CheckboxFieldProps Interface', () => {
    it('should extend BaseFieldProps but omit required', () => {
      expectTypeOf<CheckboxFieldProps>().toMatchTypeOf<Omit<BaseFieldProps, 'required'>>();
    });

    it('should require checked and onChange for checkbox', () => {
      expectTypeOf<CheckboxFieldProps['checked']>().toEqualTypeOf<boolean>();
      expectTypeOf<CheckboxFieldProps['onChange']>().toEqualTypeOf<
        (e: ChangeEvent<HTMLInputElement>) => void
      >();
    });

    it('should accept checkbox-specific event handlers', () => {
      expectTypeOf<CheckboxFieldProps['onBlur']>().toEqualTypeOf<
        ((e: FocusEvent<HTMLInputElement>) => void) | undefined
      >();
      expectTypeOf<CheckboxFieldProps['onFocus']>().toEqualTypeOf<
        ((e: FocusEvent<HTMLInputElement>) => void) | undefined
      >();
    });

    it('should accept checkbox-specific props', () => {
      expectTypeOf<CheckboxFieldProps['indeterminate']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<CheckboxFieldProps['size']>().toEqualTypeOf<
        'small' | 'medium' | 'large' | undefined
      >();
    });

    it('should not have required prop', () => {
      expectTypeOf<CheckboxFieldProps>().not.toHaveProperty('required');
    });
  });

  describe('FormField Wrapper Component Types', () => {
    it('should accept proper children and fieldProps', () => {
      type FormFieldProps = ComponentProps<typeof FormField>;

      expectTypeOf<FormFieldProps['children']>().toEqualTypeOf<ReactNode>();
      expectTypeOf<FormFieldProps['fieldProps']>().toEqualTypeOf<BaseFieldProps>();
      expectTypeOf<FormFieldProps['fieldId']>().toEqualTypeOf<string>();
      expectTypeOf<FormFieldProps['currentLength']>().toEqualTypeOf<number | undefined>();
    });
  });

  describe('Ref Forwarding Types', () => {
    it('should properly forward ref for TextField', () => {
      type TextFieldRef = Parameters<typeof TextField>[1];
      expectTypeOf<TextFieldRef>().toEqualTypeOf<
        RefObject<HTMLInputElement> | ((instance: HTMLInputElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for TextAreaField', () => {
      type TextAreaFieldRef = Parameters<typeof TextAreaField>[1];
      expectTypeOf<TextAreaFieldRef>().toEqualTypeOf<
        RefObject<HTMLTextAreaElement> | ((instance: HTMLTextAreaElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for SelectField', () => {
      type SelectFieldRef = Parameters<typeof SelectField>[1];
      expectTypeOf<SelectFieldRef>().toEqualTypeOf<
        RefObject<HTMLSelectElement> | ((instance: HTMLSelectElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for CheckboxField', () => {
      type CheckboxFieldRef = Parameters<typeof CheckboxField>[1];
      expectTypeOf<CheckboxFieldRef>().toEqualTypeOf<
        RefObject<HTMLInputElement> | ((instance: HTMLInputElement | null) => void) | null | undefined
      >();
    });
  });

  describe('Event Handler Type Constraints', () => {
    it('should constrain TextField event handlers correctly', () => {
      type TextFieldOnChange = NonNullable<TextFieldProps['onChange']>;
      type TextFieldOnBlur = NonNullable<TextFieldProps['onBlur']>;
      type TextFieldOnFocus = NonNullable<TextFieldProps['onFocus']>;

      expectTypeOf<TextFieldOnChange>().toMatchTypeOf<
        (e: ChangeEvent<HTMLInputElement>) => void
      >();
      expectTypeOf<TextFieldOnBlur>().toMatchTypeOf<
        (e: FocusEvent<HTMLInputElement>) => void
      >();
      expectTypeOf<TextFieldOnFocus>().toMatchTypeOf<
        (e: FocusEvent<HTMLInputElement>) => void
      >();
    });

    it('should constrain TextAreaField event handlers correctly', () => {
      type TextAreaOnChange = NonNullable<TextAreaFieldProps['onChange']>;
      type TextAreaOnBlur = NonNullable<TextAreaFieldProps['onBlur']>;

      expectTypeOf<TextAreaOnChange>().toMatchTypeOf<
        (e: ChangeEvent<HTMLTextAreaElement>) => void
      >();
      expectTypeOf<TextAreaOnBlur>().toMatchTypeOf<
        (e: FocusEvent<HTMLTextAreaElement>) => void
      >();
    });

    it('should constrain SelectField event handlers correctly', () => {
      type SelectOnChange = NonNullable<SelectFieldProps['onChange']>;

      expectTypeOf<SelectOnChange>().toMatchTypeOf<
        (e: ChangeEvent<HTMLSelectElement>) => void
      >();
    });

    it('should constrain CheckboxField event handlers correctly', () => {
      type CheckboxOnChange = NonNullable<CheckboxFieldProps['onChange']>;

      expectTypeOf<CheckboxOnChange>().toMatchTypeOf<
        (e: ChangeEvent<HTMLInputElement>) => void
      >();
    });
  });

  describe('Generic Type Parameters', () => {
    it('should handle select options generic constraints', () => {
      type SelectOption = SelectFieldProps['options'][number];

      expectTypeOf<SelectOption>().toEqualTypeOf<{
        value: string;
        label: string;
        disabled?: boolean;
      }>();
    });

    it('should handle character count relationships', () => {
      type FieldWithCharCount = {
        showCharacterCount: true;
        maxLength: number;
        value: string;
      };

      expectTypeOf<FieldWithCharCount>().toMatchTypeOf<
        Partial<TextFieldProps & TextAreaFieldProps>
      >();
    });
  });

  describe('Discriminated Union Types', () => {
    it('should handle textarea resize variants', () => {
      type ResizeVariants = NonNullable<TextAreaFieldProps['resize']>;

      expectTypeOf<ResizeVariants>().toEqualTypeOf<
        'none' | 'both' | 'horizontal' | 'vertical'
      >();
    });

    it('should handle input type variants', () => {
      type InputTypes = NonNullable<TextFieldProps['type']>;

      expectTypeOf<InputTypes>().toEqualTypeOf<
        'text' | 'email' | 'password' | 'url' | 'tel'
      >();
    });

    it('should handle size variants', () => {
      type SizeVariants = NonNullable<TextFieldProps['size']>;

      expectTypeOf<SizeVariants>().toEqualTypeOf<
        'small' | 'medium' | 'large'
      >();
    });
  });

  describe('Complex Type Combinations', () => {
    it('should handle required field with error state', () => {
      type RequiredFieldWithError = {
        label: string;
        name: string;
        value: string;
        onChange: (e: ChangeEvent<HTMLInputElement>) => void;
        required: true;
        error: string;
        'aria-invalid': true;
      };

      expectTypeOf<RequiredFieldWithError>().toMatchTypeOf<
        TextFieldProps
      >();
    });

    it('should handle auto-resizing textarea with constraints', () => {
      type AutoResizeTextArea = {
        label: string;
        name: string;
        value: string;
        onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
        autoResize: true;
        minRows: number;
        maxRows: number;
        resize: 'vertical';
      };

      expectTypeOf<AutoResizeTextArea>().toMatchTypeOf<
        TextAreaFieldProps
      >();
    });

    it('should handle multi-select with proper typing', () => {
      type MultiSelect = {
        label: string;
        name: string;
        value: string;
        onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
        options: Array<{ value: string; label: string }>;
        multiple: true;
      };

      expectTypeOf<MultiSelect>().toMatchTypeOf<
        SelectFieldProps
      >();
    });
  });

  describe('Type Inference Tests', () => {
    it('should infer correct types for field validation states', () => {
      const fieldWithError = {
        label: 'Email',
        name: 'email',
        value: '',
        onChange: (e: ChangeEvent<HTMLInputElement>) => {},
        error: 'Required field',
        'aria-invalid': true as const
      };

      expectTypeOf(fieldWithError).toMatchTypeOf<
        Partial<TextFieldProps>
      >();
    });

    it('should infer correct types for accessibility configurations', () => {
      const accessibleField = {
        label: 'Password',
        name: 'password',
        type: 'password' as const,
        value: '',
        onChange: (e: ChangeEvent<HTMLInputElement>) => {},
        'aria-describedby': 'password-help',
        'aria-required': true as const
      };

      expectTypeOf(accessibleField).toMatchTypeOf<
        Partial<TextFieldProps>
      >();
    });
  });
});