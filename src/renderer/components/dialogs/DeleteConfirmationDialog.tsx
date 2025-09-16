import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, Archive, X, Shield, Clock } from 'lucide-react';
import { Button } from '../common/Button';
import { focusManager, AriaUtils, announceToScreenReader } from '../../utils/accessibility';
import { useAccessibleShortcuts } from '../../hooks/useUXEnhancements';
import './DeleteConfirmationDialog.css';

interface DeleteConfirmationDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  
  /** Dialog title */
  title?: string;
  
  /** Item being deleted (for context) */
  itemName?: string;
  
  /** Type of item being deleted */
  itemType?: string;
  
  /** Detailed description of what will be deleted */
  description?: string;
  
  /** Warning message */
  warningMessage?: string;
  
  /** Whether to show backup option */
  showBackupOption?: boolean;
  
  /** Whether to enable two-step confirmation */
  requireTwoStepConfirmation?: boolean;
  
  /** Custom confirmation text */
  confirmationText?: string;
  
  /** Expected confirmation input for critical items */
  expectedConfirmationInput?: string;
  
  /** Delete button text */
  deleteButtonText?: string;
  
  /** Cancel button text */
  cancelButtonText?: string;
  
  /** Additional metadata to display */
  metadata?: Array<{ label: string; value: string }>;
  
  /** Related items that will be affected */
  relatedItems?: Array<{ name: string; type: string; count?: number }>;
  
  /** Loading states */
  isDeleting?: boolean;
  isBackingUp?: boolean;
  
  /** Variant determines severity styling */
  variant?: 'danger' | 'warning' | 'caution';
  
  /** Handlers */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  onBackup?: () => void | Promise<void>;
  
  /** Error state */
  error?: string;
}

/**
 * Reusable Delete Confirmation Dialog
 * 
 * Features:
 * - Multiple confirmation modes (simple, two-step, typed confirmation)
 * - Backup before deletion option
 * - WCAG 2.1 AA compliant accessibility
 * - Focus trapping and keyboard navigation
 * - Screen reader announcements
 * - Related items impact display
 * - Customizable severity levels
 * - Loading states and error handling
 * - Keyboard shortcuts
 */
export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  title,
  itemName,
  itemType = 'item',
  description,
  warningMessage,
  showBackupOption = false,
  requireTwoStepConfirmation = false,
  confirmationText,
  expectedConfirmationInput,
  deleteButtonText = 'Delete',
  cancelButtonText = 'Cancel',
  metadata = [],
  relatedItems = [],
  isDeleting = false,
  isBackingUp = false,
  variant = 'danger',
  onConfirm,
  onCancel,
  onBackup,
  error
}) => {
  const [currentStep, setCurrentStep] = useState<'initial' | 'confirmation' | 'final'>('initial');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [hasSelectedBackup, setHasSelectedBackup] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(5);
  const [canProceed, setCanProceed] = useState(false);
  
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<any>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('initial');
      setConfirmationInput('');
      setHasSelectedBackup(false);
      setTimeRemaining(5);
      setCanProceed(false);
    }
  }, [isOpen]);
  
  // Countdown timer for safety delay
  useEffect(() => {
    if (isOpen && variant === 'danger' && currentStep === 'initial') {
      countdownInterval.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setCanProceed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
      };
    }
  }, [isOpen, variant, currentStep]);
  
  // Keyboard shortcuts
  useAccessibleShortcuts([
    {
      key: 'Escape',
      handler: onCancel,
      description: 'Cancel deletion'
    }
  ]);
  
  // Focus management
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      // Store currently focused element
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      
      // Create focus trap
      focusTrapRef.current = focusManager.createFocusTrap('delete-confirmation', dialogRef.current);
      focusTrapRef.current.activate();
      
      // Announce to screen readers
      const announcement = `Delete confirmation dialog opened. ${title || 'Confirm deletion'}. ${description || ''}`;
      announceToScreenReader(announcement, 'assertive');
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Cleanup
        if (focusTrapRef.current) {
          focusTrapRef.current.deactivate();
          focusManager.removeFocusTrap('delete-confirmation');
        }
        
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
        
        // Restore focus
        if (previouslyFocusedElement.current) {
          focusManager.restoreFocus(previouslyFocusedElement.current);
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, title, description]);
  
  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }, [onCancel]);
  
  // Handle confirmation steps
  const handleProceed = useCallback(() => {
    if (requireTwoStepConfirmation) {
      if (currentStep === 'initial') {
        setCurrentStep('confirmation');
        announceToScreenReader('Proceeding to confirmation step', 'polite');
      } else if (currentStep === 'confirmation') {
        if (expectedConfirmationInput && confirmationInput !== expectedConfirmationInput) {
          announceToScreenReader('Confirmation text does not match. Please try again.', 'assertive');
          return;
        }
        setCurrentStep('final');
        announceToScreenReader('Final confirmation step', 'polite');
      } else {
        handleConfirm();
      }
    } else {
      handleConfirm();
    }
  }, [requireTwoStepConfirmation, currentStep, confirmationInput, expectedConfirmationInput]);
  
  const handleConfirm = useCallback(async () => {
    try {
      announceToScreenReader('Deletion confirmed. Processing...', 'assertive');
      await onConfirm();
    } catch (error) {
      console.error('Delete confirmation error:', error);
    }
  }, [onConfirm]);
  
  const handleBackup = useCallback(async () => {
    if (onBackup) {
      try {
        setHasSelectedBackup(true);
        announceToScreenReader('Creating backup...', 'polite');
        await onBackup();
        announceToScreenReader('Backup created successfully', 'polite');
      } catch (error) {
        console.error('Backup error:', error);
        announceToScreenReader('Backup failed. Please try again.', 'assertive');
      }
    }
  }, [onBackup]);
  
  if (!isOpen) return null;
  
  const dialogId = 'delete-confirmation-dialog';
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  
  // Get appropriate icon based on variant
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="delete-dialog__icon delete-dialog__icon--danger" />;
      case 'warning':
        return <Trash2 className="delete-dialog__icon delete-dialog__icon--warning" />;
      case 'caution':
        return <Archive className="delete-dialog__icon delete-dialog__icon--caution" />;
      default:
        return <AlertTriangle className="delete-dialog__icon delete-dialog__icon--danger" />;
    }
  };
  
  // Check if user can proceed to deletion
  const canDelete = () => {
    if (variant === 'danger' && !canProceed) return false;
    if (expectedConfirmationInput && confirmationInput !== expectedConfirmationInput) return false;
    return true;
  };
  
  return (
    <div 
      className="delete-dialog__backdrop"
      onClick={handleBackdropClick}
      data-testid="delete-dialog-backdrop"
    >
      <div 
        ref={dialogRef}
        className={`delete-dialog delete-dialog--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="delete-confirmation-dialog"
      >
        {/* Header */}
        <div className="delete-dialog__header">
          <div className="delete-dialog__title-row">
            {getIcon()}
            <h2 id={titleId} className="delete-dialog__title">
              {title || `Delete ${itemType}`}
            </h2>
          </div>
          <button 
            className="delete-dialog__close"
            onClick={onCancel}
            aria-label="Close delete confirmation dialog"
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="delete-dialog__content">
          {error && (
            <div className="delete-dialog__error" role="alert">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
          
          {/* Main description */}
          <div id={descriptionId} className="delete-dialog__description">
            {description || `Are you sure you want to delete this ${itemType}?`}
            {itemName && (
              <div className="delete-dialog__item-name">
                <strong>{itemName}</strong>
              </div>
            )}
          </div>
          
          {/* Warning message */}
          {warningMessage && (
            <div className="delete-dialog__warning" role="alert">
              <Shield size={16} />
              {warningMessage}
            </div>
          )}
          
          {/* Metadata display */}
          {metadata.length > 0 && (
            <div className="delete-dialog__metadata">
              <h3 className="delete-dialog__metadata-title">Item Details:</h3>
              <dl className="delete-dialog__metadata-list">
                {metadata.map(({ label, value }) => (
                  <div key={label} className="delete-dialog__metadata-item">
                    <dt className="delete-dialog__metadata-label">{label}:</dt>
                    <dd className="delete-dialog__metadata-value">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          
          {/* Related items impact */}
          {relatedItems.length > 0 && (
            <div className="delete-dialog__related">
              <h3 className="delete-dialog__related-title">This will also affect:</h3>
              <ul className="delete-dialog__related-list">
                {relatedItems.map(({ name, type, count }) => (
                  <li key={name} className="delete-dialog__related-item">
                    <span className="delete-dialog__related-name">{name}</span>
                    <span className="delete-dialog__related-type">({type})</span>
                    {count && (
                      <span className="delete-dialog__related-count">
                        {count} item{count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Confirmation input for critical deletions */}
          {expectedConfirmationInput && currentStep !== 'initial' && (
            <div className="delete-dialog__confirmation-input">
              <label htmlFor="confirmation-input" className="delete-dialog__input-label">
                Type <strong>{expectedConfirmationInput}</strong> to confirm:
              </label>
              <input
                id="confirmation-input"
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                className="delete-dialog__input"
                placeholder={expectedConfirmationInput}
                autoComplete="off"
                aria-describedby="confirmation-help"
              />
              <div id="confirmation-help" className="delete-dialog__input-help">
                This ensures you understand the consequences of this action.
              </div>
            </div>
          )}
          
          {/* Safety countdown */}
          {variant === 'danger' && !canProceed && currentStep === 'initial' && (
            <div className="delete-dialog__countdown" role="status" aria-live="polite">
              <Clock size={16} />
              Please wait {timeRemaining} second{timeRemaining !== 1 ? 's' : ''} before proceeding...
            </div>
          )}
          
          {/* Permanent deletion warning */}
          <div className="delete-dialog__permanent-warning" role="alert">
            <strong>Warning:</strong> This action cannot be undone.
          </div>
        </div>
        
        {/* Actions */}
        <div className="delete-dialog__actions">
          <div className="delete-dialog__actions-left">
            {showBackupOption && onBackup && (
              <Button
                onClick={handleBackup}
                variant="secondary"
                disabled={isBackingUp || isDeleting}
                loading={isBackingUp}
                title="Create backup before deletion"
              >
                {hasSelectedBackup ? 'Backup Created' : 'Backup First'}
              </Button>
            )}
          </div>
          
          <div className="delete-dialog__actions-right">
            <Button
              onClick={onCancel}
              variant="ghost"
              disabled={isDeleting || isBackingUp}
            >
              {cancelButtonText}
            </Button>
            
            <Button
              onClick={handleProceed}
              variant="danger"
              disabled={!canDelete() || isDeleting || isBackingUp}
              loading={isDeleting}
              data-testid="confirm-delete-button"
            >
              {requireTwoStepConfirmation && currentStep !== 'final' 
                ? (currentStep === 'initial' ? 'Continue' : 'Proceed')
                : deleteButtonText
              }
            </Button>
          </div>
        </div>
        
        {/* Step indicator for multi-step confirmation */}
        {requireTwoStepConfirmation && (
          <div className="delete-dialog__steps" role="progressbar" aria-valuenow={currentStep === 'initial' ? 1 : currentStep === 'confirmation' ? 2 : 3} aria-valuemin={1} aria-valuemax={3}>
            <div className={`delete-dialog__step ${currentStep === 'initial' ? 'delete-dialog__step--current' : currentStep !== 'initial' ? 'delete-dialog__step--completed' : ''}`}>
              1. Review
            </div>
            <div className={`delete-dialog__step ${currentStep === 'confirmation' ? 'delete-dialog__step--current' : currentStep === 'final' ? 'delete-dialog__step--completed' : ''}`}>
              2. Confirm
            </div>
            <div className={`delete-dialog__step ${currentStep === 'final' ? 'delete-dialog__step--current' : ''}`}>
              3. Delete
            </div>
          </div>
        )}
        
        {/* Screen reader announcements */}
        <div className="sr-only" aria-live="polite">
          {currentStep === 'initial' && 'Review deletion details'}
          {currentStep === 'confirmation' && 'Confirm deletion by typing the required text'}
          {currentStep === 'final' && 'Final step: Click delete to proceed'}
        </div>
      </div>
    </div>
  );
};

DeleteConfirmationDialog.displayName = 'DeleteConfirmationDialog';