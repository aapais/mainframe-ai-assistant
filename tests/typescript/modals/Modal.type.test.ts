/**
 * TypeScript Type Tests for Modal Component
 * Tests modal prop interfaces, render prop types, and children validation
 */

import { describe, it, expectTypeOf } from 'vitest';
import type { ComponentProps, ReactNode, RefObject, HTMLAttributes } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
  Overlay,
  ConfirmModal,
  AlertModal,
  type ModalProps,
  type ModalContentProps,
  type ModalHeaderProps,
  type ModalTitleProps,
  type ModalDescriptionProps,
  type ModalBodyProps,
  type ModalFooterProps,
  type ModalCloseProps,
  type OverlayProps,
  type ConfirmModalProps,
  type AlertModalProps
} from '../../../src/renderer/components/ui/Modal';

describe('Modal Component TypeScript Tests', () => {
  describe('ModalProps Interface', () => {
    it('should require open and onOpenChange props', () => {
      expectTypeOf<ModalProps['open']>().toEqualTypeOf<boolean>();
      expectTypeOf<ModalProps['onOpenChange']>().toEqualTypeOf<(open: boolean) => void>();
    });

    it('should require children prop', () => {
      expectTypeOf<ModalProps['children']>().toEqualTypeOf<ReactNode>();
    });

    it('should accept optional configuration props', () => {
      expectTypeOf<ModalProps['modal']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<ModalProps['closeOnOverlayClick']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<ModalProps['closeOnEscape']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<ModalProps['preventBodyScroll']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('ModalContentProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<ModalContentProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept size variants', () => {
      expectTypeOf<ModalContentProps['size']>().toEqualTypeOf<
        'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full' | 'screen' | undefined
      >();
    });

    it('should accept open state prop', () => {
      expectTypeOf<ModalContentProps['open']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('OverlayProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<OverlayProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept variant types', () => {
      expectTypeOf<OverlayProps['variant']>().toEqualTypeOf<
        'default' | 'dark' | 'blur' | undefined
      >();
    });

    it('should accept open state prop', () => {
      expectTypeOf<OverlayProps['open']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('ModalHeaderProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<ModalHeaderProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });
  });

  describe('ModalTitleProps Interface', () => {
    it('should extend HTMLHeadingElement attributes', () => {
      expectTypeOf<ModalTitleProps>().toMatchTypeOf<HTMLAttributes<HTMLHeadingElement>>();
    });

    it('should accept heading level variants', () => {
      expectTypeOf<ModalTitleProps['as']>().toEqualTypeOf<
        'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | undefined
      >();
    });
  });

  describe('ModalDescriptionProps Interface', () => {
    it('should extend HTMLParagraphElement attributes', () => {
      expectTypeOf<ModalDescriptionProps>().toMatchTypeOf<HTMLAttributes<HTMLParagraphElement>>();
    });
  });

  describe('ModalBodyProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<ModalBodyProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });
  });

  describe('ModalFooterProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<ModalFooterProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });
  });

  describe('ModalCloseProps Interface', () => {
    it('should extend HTMLButtonElement attributes', () => {
      expectTypeOf<ModalCloseProps>().toMatchTypeOf<React.ButtonHTMLAttributes<HTMLButtonElement>>();
    });
  });

  describe('ConfirmModalProps Interface', () => {
    it('should require essential props', () => {
      expectTypeOf<ConfirmModalProps['open']>().toEqualTypeOf<boolean>();
      expectTypeOf<ConfirmModalProps['onOpenChange']>().toEqualTypeOf<(open: boolean) => void>();
      expectTypeOf<ConfirmModalProps['title']>().toEqualTypeOf<string>();
      expectTypeOf<ConfirmModalProps['description']>().toEqualTypeOf<string>();
      expectTypeOf<ConfirmModalProps['onConfirm']>().toEqualTypeOf<() => void | Promise<void>>();
    });

    it('should accept optional configuration props', () => {
      expectTypeOf<ConfirmModalProps['confirmText']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ConfirmModalProps['cancelText']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ConfirmModalProps['loading']>().toEqualTypeOf<boolean | undefined>();
    });

    it('should accept variant types', () => {
      expectTypeOf<ConfirmModalProps['variant']>().toEqualTypeOf<
        'default' | 'destructive' | undefined
      >();
    });
  });

  describe('AlertModalProps Interface', () => {
    it('should require essential props', () => {
      expectTypeOf<AlertModalProps['open']>().toEqualTypeOf<boolean>();
      expectTypeOf<AlertModalProps['onOpenChange']>().toEqualTypeOf<(open: boolean) => void>();
      expectTypeOf<AlertModalProps['title']>().toEqualTypeOf<string>();
      expectTypeOf<AlertModalProps['description']>().toEqualTypeOf<string>();
    });

    it('should accept optional configuration props', () => {
      expectTypeOf<AlertModalProps['actionText']>().toEqualTypeOf<string | undefined>();
    });

    it('should accept variant types', () => {
      expectTypeOf<AlertModalProps['variant']>().toEqualTypeOf<
        'info' | 'success' | 'warning' | 'error' | undefined
      >();
    });
  });

  describe('Ref Forwarding Types', () => {
    it('should properly forward ref for Overlay', () => {
      type OverlayRef = Parameters<typeof Overlay>[1];
      expectTypeOf<OverlayRef>().toEqualTypeOf<
        RefObject<HTMLDivElement> | ((instance: HTMLDivElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for ModalContent', () => {
      type ModalContentRef = Parameters<typeof ModalContent>[1];
      expectTypeOf<ModalContentRef>().toEqualTypeOf<
        RefObject<HTMLDivElement> | ((instance: HTMLDivElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for ModalHeader', () => {
      type ModalHeaderRef = Parameters<typeof ModalHeader>[1];
      expectTypeOf<ModalHeaderRef>().toEqualTypeOf<
        RefObject<HTMLDivElement> | ((instance: HTMLDivElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for ModalTitle', () => {
      type ModalTitleRef = Parameters<typeof ModalTitle>[1];
      expectTypeOf<ModalTitleRef>().toEqualTypeOf<
        RefObject<HTMLHeadingElement> | ((instance: HTMLHeadingElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for ModalClose', () => {
      type ModalCloseRef = Parameters<typeof ModalClose>[1];
      expectTypeOf<ModalCloseRef>().toEqualTypeOf<
        RefObject<HTMLButtonElement> | ((instance: HTMLButtonElement | null) => void) | null | undefined
      >();
    });
  });

  describe('Event Handler Types', () => {
    it('should properly type onOpenChange callback', () => {
      type OnOpenChangeHandler = ModalProps['onOpenChange'];

      expectTypeOf<OnOpenChangeHandler>().toMatchTypeOf<
        (open: boolean) => void
      >();
    });

    it('should properly type confirm modal onConfirm callback', () => {
      type OnConfirmHandler = ConfirmModalProps['onConfirm'];

      expectTypeOf<OnConfirmHandler>().toMatchTypeOf<
        () => void | Promise<void>
      >();
    });

    it('should properly type overlay click handler', () => {
      type OverlayClickHandler = NonNullable<ComponentProps<typeof Overlay>['onClick']>;

      expectTypeOf<OverlayClickHandler>().toMatchTypeOf<
        (event: React.MouseEvent<HTMLDivElement>) => void
      >();
    });
  });

  describe('Children Type Validation', () => {
    it('should accept ReactNode children for Modal', () => {
      type ModalChildren = ModalProps['children'];

      expectTypeOf<ModalChildren>().toEqualTypeOf<ReactNode>();
    });

    it('should accept ReactNode children for ModalContent', () => {
      type ModalContentChildren = ComponentProps<typeof ModalContent>['children'];

      expectTypeOf<ModalContentChildren>().toEqualTypeOf<ReactNode | undefined>();
    });

    it('should accept ReactNode children for all modal sub-components', () => {
      expectTypeOf<ComponentProps<typeof ModalHeader>['children']>().toEqualTypeOf<ReactNode | undefined>();
      expectTypeOf<ComponentProps<typeof ModalBody>['children']>().toEqualTypeOf<ReactNode | undefined>();
      expectTypeOf<ComponentProps<typeof ModalFooter>['children']>().toEqualTypeOf<ReactNode | undefined>();
    });
  });

  describe('Size Variant Type Constraints', () => {
    it('should constrain ModalContent size to valid options', () => {
      type SizeVariants = NonNullable<ModalContentProps['size']>;

      expectTypeOf<SizeVariants>().toEqualTypeOf<
        'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full' | 'screen'
      >();
    });

    it('should handle size-specific modal configurations', () => {
      type SmallModal = {
        size: 'sm';
        children: ReactNode;
      };

      type FullscreenModal = {
        size: 'screen';
        children: ReactNode;
      };

      expectTypeOf<SmallModal>().toMatchTypeOf<Partial<ModalContentProps>>();
      expectTypeOf<FullscreenModal>().toMatchTypeOf<Partial<ModalContentProps>>();
    });
  });

  describe('Variant Type Constraints', () => {
    it('should constrain Overlay variant to valid options', () => {
      type OverlayVariants = NonNullable<OverlayProps['variant']>;

      expectTypeOf<OverlayVariants>().toEqualTypeOf<
        'default' | 'dark' | 'blur'
      >();
    });

    it('should constrain ConfirmModal variant to valid options', () => {
      type ConfirmVariants = NonNullable<ConfirmModalProps['variant']>;

      expectTypeOf<ConfirmVariants>().toEqualTypeOf<
        'default' | 'destructive'
      >();
    });

    it('should constrain AlertModal variant to valid options', () => {
      type AlertVariants = NonNullable<AlertModalProps['variant']>;

      expectTypeOf<AlertVariants>().toEqualTypeOf<
        'info' | 'success' | 'warning' | 'error'
      >();
    });
  });

  describe('Heading Level Type Constraints', () => {
    it('should constrain ModalTitle as prop to valid heading levels', () => {
      type HeadingLevels = NonNullable<ModalTitleProps['as']>;

      expectTypeOf<HeadingLevels>().toEqualTypeOf<
        'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      >();
    });

    it('should handle dynamic heading level configurations', () => {
      type DynamicTitle = {
        as: 'h1';
        children: ReactNode;
      };

      expectTypeOf<DynamicTitle>().toMatchTypeOf<Partial<ModalTitleProps>>();
    });
  });

  describe('Async Handler Types', () => {
    it('should handle async onConfirm handlers', () => {
      type AsyncConfirm = () => Promise<void>;
      type SyncConfirm = () => void;

      expectTypeOf<AsyncConfirm>().toMatchTypeOf<ConfirmModalProps['onConfirm']>();
      expectTypeOf<SyncConfirm>().toMatchTypeOf<ConfirmModalProps['onConfirm']>();
    });

    it('should handle loading states with async operations', () => {
      type AsyncConfirmModal = {
        onConfirm: () => Promise<void>;
        loading: boolean;
      };

      expectTypeOf<AsyncConfirmModal>().toMatchTypeOf<Partial<ConfirmModalProps>>();
    });
  });

  describe('Modal State Management Types', () => {
    it('should handle controlled modal state', () => {
      type ControlledModal = {
        open: boolean;
        onOpenChange: (open: boolean) => void;
      };

      expectTypeOf<ControlledModal>().toMatchTypeOf<
        Pick<ModalProps, 'open' | 'onOpenChange'>
      >();
    });

    it('should handle modal configuration options', () => {
      type ModalConfig = {
        modal: boolean;
        closeOnOverlayClick: boolean;
        closeOnEscape: boolean;
        preventBodyScroll: boolean;
      };

      expectTypeOf<ModalConfig>().toMatchTypeOf<
        Partial<ModalProps>
      >();
    });
  });

  describe('Complex Modal Type Combinations', () => {
    it('should handle complete modal with all props', () => {
      type CompleteModal = {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        children: ReactNode;
        modal: boolean;
        closeOnOverlayClick: boolean;
        closeOnEscape: boolean;
        preventBodyScroll: boolean;
      };

      expectTypeOf<CompleteModal>().toMatchTypeOf<ModalProps>();
    });

    it('should handle complete confirm modal with all props', () => {
      type CompleteConfirmModal = {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        title: string;
        description: string;
        confirmText: string;
        cancelText: string;
        variant: 'destructive';
        onConfirm: () => Promise<void>;
        loading: boolean;
      };

      expectTypeOf<CompleteConfirmModal>().toMatchTypeOf<ConfirmModalProps>();
    });

    it('should handle complete alert modal with all props', () => {
      type CompleteAlertModal = {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        title: string;
        description: string;
        variant: 'error';
        actionText: string;
      };

      expectTypeOf<CompleteAlertModal>().toMatchTypeOf<AlertModalProps>();
    });
  });

  describe('Component Composition Types', () => {
    it('should handle modal with multiple sub-components', () => {
      type ModalComposition = {
        modalProps: ModalProps;
        contentProps: ModalContentProps;
        headerProps: ModalHeaderProps;
        titleProps: ModalTitleProps;
        bodyProps: ModalBodyProps;
        footerProps: ModalFooterProps;
      };

      expectTypeOf<ModalComposition['modalProps']>().toMatchTypeOf<ModalProps>();
      expectTypeOf<ModalComposition['contentProps']>().toMatchTypeOf<ModalContentProps>();
      expectTypeOf<ModalComposition['headerProps']>().toMatchTypeOf<ModalHeaderProps>();
    });
  });

  describe('Type Inference Tests', () => {
    it('should infer correct types for modal configurations', () => {
      const modalConfig = {
        open: true,
        onOpenChange: (open: boolean) => {},
        size: 'lg' as const,
        variant: 'destructive' as const
      };

      expectTypeOf(modalConfig).toMatchTypeOf<{
        open: boolean;
        onOpenChange: (open: boolean) => void;
        size: 'lg';
        variant: 'destructive';
      }>();
    });

    it('should infer correct types for overlay configurations', () => {
      const overlayConfig = {
        open: true,
        variant: 'blur' as const,
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {}
      };

      expectTypeOf(overlayConfig).toMatchTypeOf<
        Partial<OverlayProps>
      >();
    });
  });
});