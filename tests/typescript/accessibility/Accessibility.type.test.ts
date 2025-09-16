/**
 * TypeScript Type Tests for Accessibility Components and ARIA Attributes
 * Tests ARIA attribute types, role validation, keyboard event types, and focus management
 */

import { describe, it, expectTypeOf } from 'vitest';
import type {
  ComponentProps,
  ReactNode,
  RefObject,
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  FocusEvent,
  AriaRole,
  AriaAttributes
} from 'react';

// Import components to test their accessibility props
import { Button } from '../../../src/renderer/components/common/Button';
import { TextField, CheckboxField } from '../../../src/renderer/components/common/FormField';
import { Modal, ModalContent } from '../../../src/renderer/components/ui/Modal';
import { TabsList, TabsTrigger } from '../../../src/renderer/components/ui/Navigation';

describe('ARIA Attributes TypeScript Tests', () => {
  describe('Core ARIA Attributes', () => {
    it('should properly type aria-label attributes', () => {
      type AriaLabelType = AriaAttributes['aria-label'];
      expectTypeOf<AriaLabelType>().toEqualTypeOf<string | undefined>();
    });

    it('should properly type aria-labelledby attributes', () => {
      type AriaLabelledByType = AriaAttributes['aria-labelledby'];
      expectTypeOf<AriaLabelledByType>().toEqualTypeOf<string | undefined>();
    });

    it('should properly type aria-describedby attributes', () => {
      type AriaDescribedByType = AriaAttributes['aria-describedby'];
      expectTypeOf<AriaDescribedByType>().toEqualTypeOf<string | undefined>();
    });

    it('should properly type aria-hidden attributes', () => {
      type AriaHiddenType = AriaAttributes['aria-hidden'];
      expectTypeOf<AriaHiddenType>().toEqualTypeOf<boolean | 'false' | 'true' | undefined>();
    });

    it('should properly type aria-expanded attributes', () => {
      type AriaExpandedType = AriaAttributes['aria-expanded'];
      expectTypeOf<AriaExpandedType>().toEqualTypeOf<boolean | 'false' | 'true' | undefined>();
    });

    it('should properly type aria-selected attributes', () => {
      type AriaSelectedType = AriaAttributes['aria-selected'];
      expectTypeOf<AriaSelectedType>().toEqualTypeOf<boolean | 'false' | 'true' | undefined>();
    });

    it('should properly type aria-checked attributes', () => {
      type AriaCheckedType = AriaAttributes['aria-checked'];
      expectTypeOf<AriaCheckedType>().toEqualTypeOf<boolean | 'false' | 'true' | 'mixed' | undefined>();
    });

    it('should properly type aria-pressed attributes', () => {
      type AriaPressedType = AriaAttributes['aria-pressed'];
      expectTypeOf<AriaPressedType>().toEqualTypeOf<boolean | 'false' | 'true' | 'mixed' | undefined>();
    });

    it('should properly type aria-current attributes', () => {
      type AriaCurrentType = AriaAttributes['aria-current'];
      expectTypeOf<AriaCurrentType>().toEqualTypeOf<
        boolean | 'false' | 'true' | 'page' | 'step' | 'location' | 'date' | 'time' | undefined
      >();
    });

    it('should properly type aria-live attributes', () => {
      type AriaLiveType = AriaAttributes['aria-live'];
      expectTypeOf<AriaLiveType>().toEqualTypeOf<'off' | 'assertive' | 'polite' | undefined>();
    });

    it('should properly type aria-atomic attributes', () => {
      type AriaAtomicType = AriaAttributes['aria-atomic'];
      expectTypeOf<AriaAtomicType>().toEqualTypeOf<boolean | 'false' | 'true' | undefined>();
    });

    it('should properly type aria-busy attributes', () => {
      type AriaBusyType = AriaAttributes['aria-busy'];
      expectTypeOf<AriaBusyType>().toEqualTypeOf<boolean | 'false' | 'true' | undefined>();
    });

    it('should properly type aria-invalid attributes', () => {
      type AriaInvalidType = AriaAttributes['aria-invalid'];
      expectTypeOf<AriaInvalidType>().toEqualTypeOf<
        boolean | 'false' | 'true' | 'grammar' | 'spelling' | undefined
      >();
    });

    it('should properly type aria-required attributes', () => {
      type AriaRequiredType = AriaAttributes['aria-required'];
      expectTypeOf<AriaRequiredType>().toEqualTypeOf<boolean | 'false' | 'true' | undefined>();
    });

    it('should properly type aria-disabled attributes', () => {
      type AriaDisabledType = AriaAttributes['aria-disabled'];
      expectTypeOf<AriaDisabledType>().toEqualTypeOf<boolean | 'false' | 'true' | undefined>();
    });

    it('should properly type aria-readonly attributes', () => {
      type AriaReadOnlyType = AriaAttributes['aria-readonly'];
      expectTypeOf<AriaReadOnlyType>().toEqualTypeOf<boolean | 'false' | 'true' | undefined>();
    });
  });

  describe('ARIA Relationship Attributes', () => {
    it('should properly type aria-controls attributes', () => {
      type AriaControlsType = AriaAttributes['aria-controls'];
      expectTypeOf<AriaControlsType>().toEqualTypeOf<string | undefined>();
    });

    it('should properly type aria-owns attributes', () => {
      type AriaOwnsType = AriaAttributes['aria-owns'];
      expectTypeOf<AriaOwnsType>().toEqualTypeOf<string | undefined>();
    });

    it('should properly type aria-activedescendant attributes', () => {
      type AriaActiveDescendantType = AriaAttributes['aria-activedescendant'];
      expectTypeOf<AriaActiveDescendantType>().toEqualTypeOf<string | undefined>();
    });

    it('should properly type aria-flowto attributes', () => {
      type AriaFlowToType = AriaAttributes['aria-flowto'];
      expectTypeOf<AriaFlowToType>().toEqualTypeOf<string | undefined>();
    });
  });

  describe('ARIA Value Attributes', () => {
    it('should properly type aria-valuemin attributes', () => {
      type AriaValueMinType = AriaAttributes['aria-valuemin'];
      expectTypeOf<AriaValueMinType>().toEqualTypeOf<number | undefined>();
    });

    it('should properly type aria-valuemax attributes', () => {
      type AriaValueMaxType = AriaAttributes['aria-valuemax'];
      expectTypeOf<AriaValueMaxType>().toEqualTypeOf<number | undefined>();
    });

    it('should properly type aria-valuenow attributes', () => {
      type AriaValueNowType = AriaAttributes['aria-valuenow'];
      expectTypeOf<AriaValueNowType>().toEqualTypeOf<number | undefined>();
    });

    it('should properly type aria-valuetext attributes', () => {
      type AriaValueTextType = AriaAttributes['aria-valuetext'];
      expectTypeOf<AriaValueTextType>().toEqualTypeOf<string | undefined>();
    });
  });

  describe('ARIA Grid and Table Attributes', () => {
    it('should properly type aria-colcount attributes', () => {
      type AriaColCountType = AriaAttributes['aria-colcount'];
      expectTypeOf<AriaColCountType>().toEqualTypeOf<number | undefined>();
    });

    it('should properly type aria-colindex attributes', () => {
      type AriaColIndexType = AriaAttributes['aria-colindex'];
      expectTypeOf<AriaColIndexType>().toEqualTypeOf<number | undefined>();
    });

    it('should properly type aria-colspan attributes', () => {
      type AriaColSpanType = AriaAttributes['aria-colspan'];
      expectTypeOf<AriaColSpanType>().toEqualTypeOf<number | undefined>();
    });

    it('should properly type aria-rowcount attributes', () => {
      type AriaRowCountType = AriaAttributes['aria-rowcount'];
      expectTypeOf<AriaRowCountType>().toEqualTypeOf<number | undefined>();
    });

    it('should properly type aria-rowindex attributes', () => {
      type AriaRowIndexType = AriaAttributes['aria-rowindex'];
      expectTypeOf<AriaRowIndexType>().toEqualTypeOf<number | undefined>();
    });

    it('should properly type aria-rowspan attributes', () => {
      type AriaRowSpanType = AriaAttributes['aria-rowspan'];
      expectTypeOf<AriaRowSpanType>().toEqualTypeOf<number | undefined>();
    });
  });

  describe('ARIA Live Region Attributes', () => {
    it('should properly type aria-relevant attributes', () => {
      type AriaRelevantType = AriaAttributes['aria-relevant'];
      expectTypeOf<AriaRelevantType>().toEqualTypeOf<
        'additions' | 'additions removals' | 'additions text' | 'all' | 'removals' | 'removals additions' | 'removals text' | 'text' | 'text additions' | 'text removals' | undefined
      >();
    });
  });
});

describe('Role Type Validation', () => {
  describe('Core Role Types', () => {
    it('should properly type role attribute', () => {
      type RoleType = AriaRole;

      // Test some common roles
      expectTypeOf<'button'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'dialog'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'tab'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'tabpanel'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'tablist'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'menuitem'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'menu'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'navigation'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'form'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'search'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'main'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'banner'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'contentinfo'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'region'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'alert'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'alertdialog'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'status'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'log'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'marquee'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'timer'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'progressbar'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'slider'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'spinbutton'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'textbox'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'combobox'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'checkbox'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'radio'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'radiogroup'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'option'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'listbox'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'list'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'listitem'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'tree'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'treeitem'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'grid'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'gridcell'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'row'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'rowgroup'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'columnheader'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'rowheader'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'table'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'cell'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'article'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'document'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'application'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'group'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'img'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'figure'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'math'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'note'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'presentation'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'none'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'separator'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'toolbar'>().toMatchTypeOf<RoleType>();
      expectTypeOf<'tooltip'>().toMatchTypeOf<RoleType>();
    });
  });
});

describe('Keyboard Event Type Validation', () => {
  describe('KeyboardEvent Types', () => {
    it('should properly type keyboard event handlers', () => {
      type OnKeyDownHandler = (e: KeyboardEvent<HTMLElement>) => void;
      type OnKeyUpHandler = (e: KeyboardEvent<HTMLElement>) => void;
      type OnKeyPressHandler = (e: KeyboardEvent<HTMLElement>) => void;

      expectTypeOf<OnKeyDownHandler>().toMatchTypeOf<(e: KeyboardEvent<HTMLElement>) => void>();
      expectTypeOf<OnKeyUpHandler>().toMatchTypeOf<(e: KeyboardEvent<HTMLElement>) => void>();
      expectTypeOf<OnKeyPressHandler>().toMatchTypeOf<(e: KeyboardEvent<HTMLElement>) => void>();
    });

    it('should properly type keyboard event properties', () => {
      type KeyboardEventProps = KeyboardEvent<HTMLElement>;

      expectTypeOf<KeyboardEventProps['key']>().toEqualTypeOf<string>();
      expectTypeOf<KeyboardEventProps['code']>().toEqualTypeOf<string>();
      expectTypeOf<KeyboardEventProps['keyCode']>().toEqualTypeOf<number>();
      expectTypeOf<KeyboardEventProps['which']>().toEqualTypeOf<number>();
      expectTypeOf<KeyboardEventProps['ctrlKey']>().toEqualTypeOf<boolean>();
      expectTypeOf<KeyboardEventProps['altKey']>().toEqualTypeOf<boolean>();
      expectTypeOf<KeyboardEventProps['shiftKey']>().toEqualTypeOf<boolean>();
      expectTypeOf<KeyboardEventProps['metaKey']>().toEqualTypeOf<boolean>();
    });

    it('should properly type element-specific keyboard events', () => {
      type ButtonKeyboardEvent = KeyboardEvent<HTMLButtonElement>;
      type InputKeyboardEvent = KeyboardEvent<HTMLInputElement>;
      type DivKeyboardEvent = KeyboardEvent<HTMLDivElement>;

      expectTypeOf<ButtonKeyboardEvent['currentTarget']>().toEqualTypeOf<HTMLButtonElement>();
      expectTypeOf<InputKeyboardEvent['currentTarget']>().toEqualTypeOf<HTMLInputElement>();
      expectTypeOf<DivKeyboardEvent['currentTarget']>().toEqualTypeOf<HTMLDivElement>();
    });
  });
});

describe('Focus Event Type Validation', () => {
  describe('FocusEvent Types', () => {
    it('should properly type focus event handlers', () => {
      type OnFocusHandler = (e: FocusEvent<HTMLElement>) => void;
      type OnBlurHandler = (e: FocusEvent<HTMLElement>) => void;

      expectTypeOf<OnFocusHandler>().toMatchTypeOf<(e: FocusEvent<HTMLElement>) => void>();
      expectTypeOf<OnBlurHandler>().toMatchTypeOf<(e: FocusEvent<HTMLElement>) => void>();
    });

    it('should properly type focus event properties', () => {
      type FocusEventProps = FocusEvent<HTMLElement>;

      expectTypeOf<FocusEventProps['target']>().toEqualTypeOf<EventTarget | null>();
      expectTypeOf<FocusEventProps['currentTarget']>().toEqualTypeOf<HTMLElement>();
      expectTypeOf<FocusEventProps['relatedTarget']>().toEqualTypeOf<EventTarget | null>();
    });

    it('should properly type element-specific focus events', () => {
      type ButtonFocusEvent = FocusEvent<HTMLButtonElement>;
      type InputFocusEvent = FocusEvent<HTMLInputElement>;

      expectTypeOf<ButtonFocusEvent['currentTarget']>().toEqualTypeOf<HTMLButtonElement>();
      expectTypeOf<InputFocusEvent['currentTarget']>().toEqualTypeOf<HTMLInputElement>();
    });
  });
});

describe('Component Accessibility Integration', () => {
  describe('Button Component Accessibility', () => {
    it('should accept proper ARIA attributes', () => {
      type ButtonProps = ComponentProps<typeof Button>;

      expectTypeOf<ButtonProps['aria-label']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ButtonProps['aria-describedby']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ButtonProps['aria-pressed']>().toEqualTypeOf<
        boolean | 'false' | 'true' | 'mixed' | undefined
      >();
      expectTypeOf<ButtonProps['aria-expanded']>().toEqualTypeOf<
        boolean | 'false' | 'true' | undefined
      >();
    });

    it('should accept proper role attributes', () => {
      type ButtonProps = ComponentProps<typeof Button>;

      expectTypeOf<ButtonProps['role']>().toEqualTypeOf<AriaRole | undefined>();
    });
  });

  describe('Form Component Accessibility', () => {
    it('should accept proper ARIA attributes for TextField', () => {
      type TextFieldProps = ComponentProps<typeof TextField>;

      expectTypeOf<TextFieldProps['aria-label']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TextFieldProps['aria-labelledby']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TextFieldProps['aria-describedby']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TextFieldProps['aria-invalid']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<TextFieldProps['aria-required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('should accept proper ARIA attributes for CheckboxField', () => {
      type CheckboxProps = ComponentProps<typeof CheckboxField>;

      expectTypeOf<CheckboxProps['aria-label']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<CheckboxProps['aria-labelledby']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<CheckboxProps['aria-describedby']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<CheckboxProps['aria-invalid']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('Modal Component Accessibility', () => {
    it('should accept proper ARIA attributes for Modal', () => {
      type ModalContentProps = ComponentProps<typeof ModalContent>;

      expectTypeOf<ModalContentProps['role']>().toEqualTypeOf<AriaRole | undefined>();
      expectTypeOf<ModalContentProps['aria-modal']>().toEqualTypeOf<
        boolean | 'false' | 'true' | undefined
      >();
      expectTypeOf<ModalContentProps['aria-labelledby']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ModalContentProps['aria-describedby']>().toEqualTypeOf<string | undefined>();
    });
  });

  describe('Navigation Component Accessibility', () => {
    it('should accept proper ARIA attributes for TabsList', () => {
      type TabsListProps = ComponentProps<typeof TabsList>;

      expectTypeOf<TabsListProps['role']>().toEqualTypeOf<AriaRole | undefined>();
      expectTypeOf<TabsListProps['aria-orientation']>().toEqualTypeOf<
        'horizontal' | 'vertical' | undefined
      >();
    });

    it('should accept proper ARIA attributes for TabsTrigger', () => {
      type TabsTriggerProps = ComponentProps<typeof TabsTrigger>;

      expectTypeOf<TabsTriggerProps['role']>().toEqualTypeOf<AriaRole | undefined>();
      expectTypeOf<TabsTriggerProps['aria-selected']>().toEqualTypeOf<
        boolean | 'false' | 'true' | undefined
      >();
      expectTypeOf<TabsTriggerProps['aria-controls']>().toEqualTypeOf<string | undefined>();
    });
  });
});

describe('Advanced Accessibility Type Patterns', () => {
  describe('Polymorphic ARIA Types', () => {
    it('should handle conditional ARIA types based on role', () => {
      // Test that certain ARIA attributes are expected for certain roles
      type ButtonWithRole = {
        role: 'button';
        'aria-pressed'?: boolean | 'false' | 'true' | 'mixed';
      };

      type TabWithRole = {
        role: 'tab';
        'aria-selected'?: boolean | 'false' | 'true';
        'aria-controls'?: string;
      };

      expectTypeOf<ButtonWithRole>().toMatchTypeOf<Partial<HTMLAttributes<HTMLElement>>>();
      expectTypeOf<TabWithRole>().toMatchTypeOf<Partial<HTMLAttributes<HTMLElement>>>();
    });
  });

  describe('Focus Management Types', () => {
    it('should handle tabindex types correctly', () => {
      type TabIndexType = HTMLAttributes<HTMLElement>['tabIndex'];
      expectTypeOf<TabIndexType>().toEqualTypeOf<number | undefined>();
    });

    it('should handle autofocus types correctly', () => {
      type AutoFocusType = InputHTMLAttributes<HTMLInputElement>['autoFocus'];
      expectTypeOf<AutoFocusType>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('Live Region Types', () => {
    it('should handle aria-live region configuration', () => {
      type LiveRegionConfig = {
        'aria-live': 'polite' | 'assertive' | 'off';
        'aria-atomic'?: boolean | 'false' | 'true';
        'aria-relevant'?: 'additions' | 'removals' | 'text' | 'all';
      };

      expectTypeOf<LiveRegionConfig>().toMatchTypeOf<Partial<HTMLAttributes<HTMLElement>>>();
    });
  });

  describe('Complex ARIA Relationships', () => {
    it('should handle aria-owns relationships', () => {
      type AriaOwnerConfig = {
        'aria-owns': string;
        'aria-controls'?: string;
      };

      expectTypeOf<AriaOwnerConfig>().toMatchTypeOf<Partial<HTMLAttributes<HTMLElement>>>();
    });

    it('should handle aria-activedescendant patterns', () => {
      type ActiveDescendantConfig = {
        'aria-activedescendant': string;
        role: 'listbox' | 'menu' | 'tree' | 'grid';
      };

      expectTypeOf<ActiveDescendantConfig>().toMatchTypeOf<Partial<HTMLAttributes<HTMLElement>>>();
    });
  });

  describe('Keyboard Navigation Types', () => {
    it('should handle aria-keyshortcuts types', () => {
      type KeyShortcutsType = AriaAttributes['aria-keyshortcuts'];
      expectTypeOf<KeyShortcutsType>().toEqualTypeOf<string | undefined>();
    });

    it('should handle keyboard event modifier combinations', () => {
      type ModifierKeys = {
        ctrlKey: boolean;
        altKey: boolean;
        shiftKey: boolean;
        metaKey: boolean;
      };

      expectTypeOf<ModifierKeys>().toMatchTypeOf<Partial<KeyboardEvent<HTMLElement>>>();
    });
  });
});

describe('Accessibility Testing Helper Types', () => {
  describe('Screen Reader Content Types', () => {
    it('should handle screen reader only content', () => {
      type ScreenReaderOnlyProps = {
        className: 'sr-only' | 'visually-hidden';
        children: ReactNode;
      };

      expectTypeOf<ScreenReaderOnlyProps>().toMatchTypeOf<Partial<HTMLAttributes<HTMLElement>>>();
    });
  });

  describe('Landmark Role Types', () => {
    it('should constrain landmark roles', () => {
      type LandmarkRoles =
        | 'banner'
        | 'main'
        | 'navigation'
        | 'contentinfo'
        | 'complementary'
        | 'search'
        | 'form'
        | 'region';

      expectTypeOf<LandmarkRoles>().toMatchTypeOf<AriaRole>();
    });
  });

  describe('Interactive Element Types', () => {
    it('should handle interactive element requirements', () => {
      type InteractiveElement = {
        tabIndex?: number;
        onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
        onFocus?: (e: FocusEvent<HTMLElement>) => void;
        onBlur?: (e: FocusEvent<HTMLElement>) => void;
        'aria-label'?: string;
        role?: AriaRole;
      };

      expectTypeOf<InteractiveElement>().toMatchTypeOf<Partial<HTMLAttributes<HTMLElement>>>();
    });
  });
});