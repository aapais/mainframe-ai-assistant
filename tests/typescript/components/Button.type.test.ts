/**
 * TypeScript Type Tests for Button Component
 * Tests all prop types, variant constraints, and type inference
 */

import { describe, it, expectTypeOf } from 'vitest';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { Button, ButtonGroup, IconButton } from '../../../src/renderer/components/common/Button';

describe('Button Component TypeScript Tests', () => {
  describe('ButtonProps Interface', () => {
    it('should accept all valid variant types', () => {
      type ButtonVariant = ComponentProps<typeof Button>['variant'];

      expectTypeOf<ButtonVariant>().toEqualTypeOf<
        'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'link' | undefined
      >();
    });

    it('should accept all valid size types', () => {
      type ButtonSize = ComponentProps<typeof Button>['size'];

      expectTypeOf<ButtonSize>().toEqualTypeOf<
        'small' | 'medium' | 'large' | undefined
      >();
    });

    it('should accept proper shortcut configuration', () => {
      type ShortcutConfig = ComponentProps<typeof Button>['shortcut'];

      expectTypeOf<ShortcutConfig>().toEqualTypeOf<{
        key: string;
        ctrlKey?: boolean;
        altKey?: boolean;
        metaKey?: boolean;
        shiftKey?: boolean;
        description?: string;
        scope?: string;
      } | undefined>();
    });

    it('should extend ButtonHTMLAttributes properly', () => {
      type ButtonComponentProps = ComponentProps<typeof Button>;

      // Should include standard button attributes
      expectTypeOf<ButtonComponentProps['onClick']>().toEqualTypeOf<
        ((e: React.MouseEvent<HTMLButtonElement>) => void) | undefined
      >();

      expectTypeOf<ButtonComponentProps['disabled']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<ButtonComponentProps['type']>().toEqualTypeOf<
        'submit' | 'reset' | 'button' | undefined
      >();
    });

    it('should accept proper accessibility props', () => {
      type ButtonComponentProps = ComponentProps<typeof Button>;

      expectTypeOf<ButtonComponentProps['ariaDescription']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ButtonComponentProps['announceClick']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<ButtonComponentProps['announceText']>().toEqualTypeOf<string | undefined>();
    });

    it('should accept loading state props', () => {
      type ButtonComponentProps = ComponentProps<typeof Button>;

      expectTypeOf<ButtonComponentProps['loading']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<ButtonComponentProps['loadingText']>().toEqualTypeOf<string | undefined>();
    });

    it('should accept visual configuration props', () => {
      type ButtonComponentProps = ComponentProps<typeof Button>;

      expectTypeOf<ButtonComponentProps['icon']>().toEqualTypeOf<ReactNode | undefined>();
      expectTypeOf<ButtonComponentProps['fullWidth']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<ButtonComponentProps['badge']>().toEqualTypeOf<string | number | undefined>();
      expectTypeOf<ButtonComponentProps['destructive']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('Event Handler Types', () => {
    it('should properly type onClick handler', () => {
      type OnClickHandler = NonNullable<ComponentProps<typeof Button>['onClick']>;

      expectTypeOf<OnClickHandler>().toMatchTypeOf<
        (e: React.MouseEvent<HTMLButtonElement>) => void
      >();
    });

    it('should properly type focus handlers', () => {
      type OnFocusHandler = NonNullable<ComponentProps<typeof Button>['onFocus']>;
      type OnBlurHandler = NonNullable<ComponentProps<typeof Button>['onBlur']>;

      expectTypeOf<OnFocusHandler>().toMatchTypeOf<
        (e: React.FocusEvent<HTMLButtonElement>) => void
      >();

      expectTypeOf<OnBlurHandler>().toMatchTypeOf<
        (e: React.FocusEvent<HTMLButtonElement>) => void
      >();
    });
  });

  describe('Ref Forwarding Types', () => {
    it('should properly forward ref to HTMLButtonElement', () => {
      // Button component should accept ref to HTMLButtonElement
      expectTypeOf<Parameters<typeof Button>[0]>().toHaveProperty('ref')
        .toEqualTypeOf<RefObject<HTMLButtonElement> | ((instance: HTMLButtonElement | null) => void) | null | undefined>();
    });
  });

  describe('IconButton Component Types', () => {
    it('should require icon and label props', () => {
      type IconButtonProps = ComponentProps<typeof IconButton>;

      expectTypeOf<IconButtonProps['icon']>().toEqualTypeOf<ReactNode>();
      expectTypeOf<IconButtonProps['label']>().toEqualTypeOf<string>();
    });

    it('should omit children from ButtonProps', () => {
      type IconButtonProps = ComponentProps<typeof IconButton>;

      expectTypeOf<IconButtonProps>().not.toHaveProperty('children');
    });

    it('should inherit other Button props', () => {
      type IconButtonProps = ComponentProps<typeof IconButton>;

      expectTypeOf<IconButtonProps['variant']>().toEqualTypeOf<
        'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'link' | undefined
      >();
    });
  });

  describe('ButtonGroup Component Types', () => {
    it('should accept proper orientation values', () => {
      type ButtonGroupOrientation = ComponentProps<typeof ButtonGroup>['orientation'];

      expectTypeOf<ButtonGroupOrientation>().toEqualTypeOf<
        'horizontal' | 'vertical' | undefined
      >();
    });

    it('should accept proper spacing values', () => {
      type ButtonGroupSpacing = ComponentProps<typeof ButtonGroup>['spacing'];

      expectTypeOf<ButtonGroupSpacing>().toEqualTypeOf<
        'compact' | 'normal' | 'relaxed' | undefined
      >();
    });

    it('should require children prop', () => {
      type ButtonGroupProps = ComponentProps<typeof ButtonGroup>;

      expectTypeOf<ButtonGroupProps['children']>().toEqualTypeOf<ReactNode>();
    });

    it('should accept keyboard navigation prop', () => {
      type ButtonGroupProps = ComponentProps<typeof ButtonGroup>;

      expectTypeOf<ButtonGroupProps['keyboardNavigation']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('Type Inference Tests', () => {
    it('should infer correct types for variant-specific configurations', () => {
      // Test discriminated union behavior if any
      const primaryButton = {
        variant: 'primary' as const,
        children: 'Primary Action'
      };

      expectTypeOf(primaryButton).toMatchTypeOf<{
        variant: 'primary';
        children: string;
      }>();
    });

    it('should infer correct types for size-specific configurations', () => {
      const smallButton = {
        size: 'small' as const,
        children: 'Small Button'
      };

      expectTypeOf(smallButton).toMatchTypeOf<{
        size: 'small';
        children: string;
      }>();
    });
  });

  describe('Conditional Type Tests', () => {
    it('should handle loading state type relationships', () => {
      type LoadingButton = {
        loading: true;
        loadingText?: string;
        children: ReactNode;
      };

      expectTypeOf<LoadingButton>().toMatchTypeOf<
        Partial<ComponentProps<typeof Button>>
      >();
    });

    it('should handle destructive action type relationships', () => {
      type DestructiveButton = {
        destructive: true;
        variant?: 'danger';
        children: ReactNode;
      };

      expectTypeOf<DestructiveButton>().toMatchTypeOf<
        Partial<ComponentProps<typeof Button>>
      >();
    });
  });

  describe('Generic Type Parameters', () => {
    it('should handle shortcut key types properly', () => {
      type ShortcutKeys = ComponentProps<typeof Button>['shortcut'];

      if (typeof ShortcutKeys !== 'undefined') {
        expectTypeOf<NonNullable<ShortcutKeys>['key']>().toEqualTypeOf<string>();
      }
    });

    it('should handle badge type union correctly', () => {
      type BadgeType = ComponentProps<typeof Button>['badge'];

      expectTypeOf<BadgeType>().toEqualTypeOf<string | number | undefined>();
    });
  });

  describe('Complex Type Combinations', () => {
    it('should handle all props together correctly', () => {
      type ComplexButtonProps = {
        variant: 'danger';
        size: 'large';
        loading: boolean;
        disabled: boolean;
        fullWidth: true;
        destructive: true;
        icon: ReactNode;
        badge: number;
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
        shortcut: {
          key: string;
          ctrlKey: boolean;
          description: string;
        };
        children: ReactNode;
      };

      expectTypeOf<ComplexButtonProps>().toMatchTypeOf<
        ComponentProps<typeof Button>
      >();
    });
  });

  describe('Type Guards and Utilities', () => {
    it('should properly type data attributes', () => {
      type ButtonProps = ComponentProps<typeof Button>;

      expectTypeOf<ButtonProps['data-testid']>().toEqualTypeOf<string | undefined>();
    });

    it('should properly type aria attributes', () => {
      type ButtonProps = ComponentProps<typeof Button>;

      expectTypeOf<ButtonProps['aria-label']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ButtonProps['aria-describedby']>().toEqualTypeOf<string | undefined>();
    });
  });
});