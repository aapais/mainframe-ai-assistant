import React, { useEffect, useRef } from 'react';
import { Button } from '../common/Button';
import { focusManager, AriaUtils, announceToScreenReader } from '../../utils/accessibility';
import { useAccessibleShortcuts } from '../../hooks/useUXEnhancements';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  description?: string;
}

/**
 * Accessible Confirmation Modal Component
 * 
 * Features:
 * - WCAG 2.1 AA compliant
 * - Focus trapping
 * - Screen reader announcements
 * - Keyboard navigation
 * - High contrast support
 * 
 * MVP1 Usage:
 * - Delete KB entry confirmation
 * - Clear search history
 * - Reset settings
 * - Exit without saving
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
  destructive = false,
  description
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<any>(null);

  // Keyboard shortcuts for the modal
  useAccessibleShortcuts([
    {
      key: 'Escape',
      handler: onCancel,
      description: 'Cancel and close modal'
    },
    {
      key: 'Enter',
      handler: onConfirm,
      description: 'Confirm action',
      disabled: destructive // Require explicit click for destructive actions
    }
  ]);

  // Setup focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Store currently focused element
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      
      // Create focus trap
      focusTrapRef.current = focusManager.createFocusTrap('confirm-modal', modalRef.current);
      focusTrapRef.current.activate();
      
      // Announce to screen readers
      const announcement = `${title}. ${message}. ${description || ''}. Use Tab to navigate, Escape to cancel.`;
      announceToScreenReader(announcement, 'assertive');
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Cleanup
        if (focusTrapRef.current) {
          focusTrapRef.current.deactivate();
          focusManager.removeFocusTrap('confirm-modal');
        }
        
        // Restore focus
        if (previouslyFocusedElement.current) {
          focusManager.restoreFocus(previouslyFocusedElement.current);
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, title, message, description]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleConfirm = () => {
    announceToScreenReader('Action confirmed', 'polite');
    onConfirm();
  };

  const handleCancel = () => {
    announceToScreenReader('Action cancelled', 'polite');
    onCancel();
  };

  const modalId = 'confirm-modal';
  const titleId = `${modalId}-title`;
  const descriptionId = `${modalId}-description`;

  // Determine icon and additional styling based on variant
  const getVariantIcon = () => {
    switch (variant) {
      case 'danger':
        return '⚠️';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❓';
    }
  };

  return (
    <div 
      className="modal-backdrop modal-backdrop--confirm"
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <div 
        ref={modalRef}
        className={`modal-content modal-content--${variant} ${destructive ? 'modal-content--destructive' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-testid="confirm-modal"
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-icon" aria-hidden="true">
              {getVariantIcon()}
            </span>
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
          </div>
          <button 
            className="modal-close"
            onClick={handleCancel}
            aria-label={`Close ${title} dialog`}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        
        <div className="modal-body">
          <p className="modal-message">{message}</p>
          {description && (
            <p id={descriptionId} className="modal-description">
              {description}
            </p>
          )}
          
          {destructive && (
            <div className="modal-warning" role="alert">
              <strong>Warning:</strong> This action cannot be undone.
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <Button
            variant="ghost"
            onClick={handleCancel}
            autoFocus={!destructive} // Don't auto-focus if destructive
            data-testid="cancel-button"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            autoFocus={false} // Never auto-focus confirm for safety
            data-testid="confirm-button"
          >
            {confirmText}
          </Button>
        </div>
        
        {/* Keyboard hints for screen readers */}
        <div className="sr-only" aria-live="polite">
          Press Tab to navigate between buttons, Enter to activate, Escape to cancel
        </div>
      </div>
    </div>
  );
};