/**
 * Modal and Overlay Component Interaction Tests
 *
 * Tests for modal components, overlay behaviors, focus management,
 * and modal stacking patterns including accessibility compliance.
 *
 * @author UI Testing Specialist
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import {
  ComponentInteractionTester,
  ComponentCommunicationTester
} from './ComponentInteractionTestSuite';

// Portal implementation for modals
const Portal: React.FC<{ children: React.ReactNode; containerId?: string }> = ({
  children,
  containerId = 'modal-root'
}) => {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    let modalContainer = document.getElementById(containerId);

    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = containerId;
      document.body.appendChild(modalContainer);
    }

    setContainer(modalContainer);

    return () => {
      if (modalContainer && modalContainer.childNodes.length === 0) {
        document.body.removeChild(modalContainer);
      }
    };
  }, [containerId]);

  if (!container) return null;

  return React.createPortal(children, container);
};

// Modal Context for stacking
interface ModalContextValue {
  modals: string[];
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  isTopModal: (id: string) => boolean;
}

const ModalContext = React.createContext<ModalContextValue | null>(null);

const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modals, setModals] = React.useState<string[]>([]);

  const openModal = React.useCallback((id: string) => {
    setModals(prev => [...prev, id]);
  }, []);

  const closeModal = React.useCallback((id: string) => {
    setModals(prev => prev.filter(modalId => modalId !== id));
  }, []);

  const closeAllModals = React.useCallback(() => {
    setModals([]);
  }, []);

  const isTopModal = React.useCallback((id: string) => {
    return modals[modals.length - 1] === id;
  }, [modals]);

  const value = React.useMemo(() => ({
    modals,
    openModal,
    closeModal,
    closeAllModals,
    isTopModal
  }), [modals, openModal, closeModal, closeAllModals, isTopModal]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};

const useModal = () => {
  const context = React.useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

// Focus management hooks
const useFocusTrap = (isActive: boolean) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
};

const useFocusReturn = (isOpen: boolean) => {
  const previousActiveElement = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);
};

// Modal Components
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  id?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  initialFocus?: React.RefObject<HTMLElement>;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  id = 'modal',
  ariaLabelledBy,
  ariaDescribedBy,
  initialFocus
}) => {
  const modalContext = useModal();
  const focusTrapRef = useFocusTrap(isOpen);
  useFocusReturn(isOpen);

  React.useEffect(() => {
    if (isOpen) {
      modalContext.openModal(id);
    } else {
      modalContext.closeModal(id);
    }
  }, [isOpen, id, modalContext]);

  React.useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalContext.isTopModal(id)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose, id, modalContext]);

  React.useEffect(() => {
    if (isOpen && initialFocus?.current) {
      const timer = setTimeout(() => {
        initialFocus.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialFocus]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  const zIndex = 1000 + modalContext.modals.indexOf(id);

  return (
    <Portal>
      <div
        className="modal-overlay"
        style={{ zIndex }}
        data-testid={`modal-overlay-${id}`}
        onClick={closeOnOverlayClick ? onClose : undefined}
      >
        <div
          ref={focusTrapRef}
          className={`modal-content ${sizeClasses[size]}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy || (title ? `${id}-title` : undefined)}
          aria-describedby={ariaDescribedBy}
          data-testid={`modal-${id}`}
          data-size={size}
        >
          {(title || showCloseButton) && (
            <div className="modal-header" data-testid={`modal-header-${id}`}>
              {title && (
                <h2 id={`${id}-title`} className="modal-title">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="modal-close-button"
                  data-testid={`modal-close-${id}`}
                  aria-label="Close modal"
                >
                  ×
                </button>
              )}
            </div>
          )}

          <div className="modal-body" data-testid={`modal-body-${id}`}>
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
};

// Confirmation Modal
interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default'
}) => {
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      id="confirmation"
      size="sm"
      initialFocus={confirmButtonRef}
    >
      <div className="confirmation-content">
        <p data-testid="confirmation-message">{message}</p>

        <div className="confirmation-actions">
          <button
            type="button"
            onClick={onCancel}
            className="button-secondary"
            data-testid="confirmation-cancel"
          >
            {cancelText}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`button-${variant === 'danger' ? 'danger' : 'primary'}`}
            data-testid="confirmation-confirm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Drawer/Sidebar Modal
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: string;
  overlay?: boolean;
}

const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  children,
  position = 'right',
  size = '400px',
  overlay = true
}) => {
  const drawerRef = useFocusTrap(isOpen);
  useFocusReturn(isOpen);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyles = {
    left: { left: 0, top: 0, height: '100vh', width: size },
    right: { right: 0, top: 0, height: '100vh', width: size },
    top: { top: 0, left: 0, width: '100vw', height: size },
    bottom: { bottom: 0, left: 0, width: '100vw', height: size }
  };

  return (
    <Portal>
      {overlay && (
        <div
          className="drawer-overlay"
          onClick={onClose}
          data-testid="drawer-overlay"
        />
      )}

      <div
        ref={drawerRef}
        className={`drawer drawer-${position}`}
        style={positionStyles[position]}
        role="dialog"
        aria-modal="true"
        data-testid="drawer"
        data-position={position}
      >
        <div className="drawer-header">
          <button
            type="button"
            onClick={onClose}
            className="drawer-close"
            data-testid="drawer-close"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        <div className="drawer-content" data-testid="drawer-content">
          {children}
        </div>
      </div>
    </Portal>
  );
};

// Tooltip Modal
interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  placement = 'top',
  trigger = 'hover',
  delay = 200
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  const showTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  const handleMouseEnter = trigger === 'hover' ? showTooltip : undefined;
  const handleMouseLeave = trigger === 'hover' ? hideTooltip : undefined;
  const handleClick = trigger === 'click' ? () => setIsVisible(!isVisible) : undefined;
  const handleFocus = trigger === 'focus' ? showTooltip : undefined;
  const handleBlur = trigger === 'focus' ? hideTooltip : undefined;

  return (
    <div className="tooltip-container" data-testid="tooltip-container">
      <div
        className="tooltip-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-testid="tooltip-trigger"
      >
        {children}
      </div>

      {isVisible && (
        <Portal>
          <div
            className={`tooltip tooltip-${placement}`}
            role="tooltip"
            data-testid="tooltip"
            data-placement={placement}
          >
            {content}
          </div>
        </Portal>
      )}
    </div>
  );
};

describe('Modal and Overlay Component Interactions', () => {
  let tester: ComponentInteractionTester;
  let communicationTester: ComponentCommunicationTester;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    tester = new ComponentInteractionTester();
    communicationTester = new ComponentCommunicationTester();
    user = userEvent.setup();

    // Create modal root for portals
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
  });

  afterEach(() => {
    tester.resetMocks();
    jest.clearAllMocks();

    // Clean up modal root
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) {
      document.body.removeChild(modalRoot);
    }
  });

  describe('Basic Modal Functionality', () => {
    it('should open and close modal correctly', async () => {
      const onClose = tester.createMock('onClose');

      const TestModalComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);

        return (
          <ModalProvider>
            <button
              onClick={() => setIsOpen(true)}
              data-testid="open-modal"
            >
              Open Modal
            </button>

            <Modal
              isOpen={isOpen}
              onClose={() => {
                setIsOpen(false);
                onClose();
              }}
              title="Test Modal"
              id="test"
            >
              <p>Modal content</p>
            </Modal>
          </ModalProvider>
        );
      };

      render(<TestModalComponent />);

      // Modal should not be visible initially
      expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();

      // Open modal
      await user.click(screen.getByTestId('open-modal'));

      // Modal should be visible
      await waitFor(() => {
        expect(screen.getByTestId('modal-test')).toBeInTheDocument();
        expect(screen.getByText('Test Modal')).toBeInTheDocument();
        expect(screen.getByText('Modal content')).toBeInTheDocument();
      });

      // Close modal using close button
      await user.click(screen.getByTestId('modal-close-test'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
        expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();
      });
    });

    it('should handle overlay click to close', async () => {
      const onClose = tester.createMock('onClose');

      render(
        <ModalProvider>
          <Modal
            isOpen={true}
            onClose={onClose}
            title="Test Modal"
            id="test"
            closeOnOverlayClick={true}
          >
            <p>Modal content</p>
          </Modal>
        </ModalProvider>
      );

      // Click overlay
      await user.click(screen.getByTestId('modal-overlay-test'));

      expect(onClose).toHaveBeenCalled();
    });

    it('should not close on overlay click when disabled', async () => {
      const onClose = tester.createMock('onClose');

      render(
        <ModalProvider>
          <Modal
            isOpen={true}
            onClose={onClose}
            title="Test Modal"
            id="test"
            closeOnOverlayClick={false}
          >
            <p>Modal content</p>
          </Modal>
        </ModalProvider>
      );

      // Click overlay
      await user.click(screen.getByTestId('modal-overlay-test'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should handle escape key to close', async () => {
      const onClose = tester.createMock('onClose');

      render(
        <ModalProvider>
          <Modal
            isOpen={true}
            onClose={onClose}
            title="Test Modal"
            id="test"
            closeOnEscape={true}
          >
            <p>Modal content</p>
          </Modal>
        </ModalProvider>
      );

      // Press escape
      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('should trap focus within modal', async () => {
      render(
        <ModalProvider>
          <Modal
            isOpen={true}
            onClose={() => {}}
            title="Test Modal"
            id="test"
          >
            <input data-testid="input-1" placeholder="First input" />
            <button data-testid="button-1">Button</button>
            <input data-testid="input-2" placeholder="Second input" />
          </Modal>
        </ModalProvider>
      );

      const input1 = screen.getByTestId('input-1');
      const button1 = screen.getByTestId('button-1');
      const input2 = screen.getByTestId('input-2');
      const closeButton = screen.getByTestId('modal-close-test');

      // First element should be focused initially
      await waitFor(() => {
        expect(input1).toHaveFocus();
      });

      // Tab through elements
      await user.tab();
      expect(button1).toHaveFocus();

      await user.tab();
      expect(input2).toHaveFocus();

      await user.tab();
      expect(closeButton).toHaveFocus();

      // Tab again should cycle back to first element
      await user.tab();
      expect(input1).toHaveFocus();

      // Shift+tab should go backwards
      await user.tab({ shift: true });
      expect(closeButton).toHaveFocus();
    });

    it('should focus initial element when specified', async () => {
      const TestModalWithInitialFocus = () => {
        const buttonRef = React.useRef<HTMLButtonElement>(null);

        return (
          <ModalProvider>
            <Modal
              isOpen={true}
              onClose={() => {}}
              title="Test Modal"
              id="test"
              initialFocus={buttonRef}
            >
              <input data-testid="input-1" placeholder="First input" />
              <button ref={buttonRef} data-testid="target-button">
                Target Button
              </button>
              <input data-testid="input-2" placeholder="Second input" />
            </Modal>
          </ModalProvider>
        );
      };

      render(<TestModalWithInitialFocus />);

      await waitFor(() => {
        expect(screen.getByTestId('target-button')).toHaveFocus();
      });
    });

    it('should restore focus when modal closes', async () => {
      const TestFocusRestore = () => {
        const [isOpen, setIsOpen] = React.useState(false);

        return (
          <ModalProvider>
            <button
              onClick={() => setIsOpen(true)}
              data-testid="trigger-button"
            >
              Open Modal
            </button>

            <Modal
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              title="Test Modal"
              id="test"
            >
              <p>Modal content</p>
            </Modal>
          </ModalProvider>
        );
      };

      render(<TestFocusRestore />);

      const triggerButton = screen.getByTestId('trigger-button');

      // Focus and click trigger button
      triggerButton.focus();
      expect(triggerButton).toHaveFocus();

      await user.click(triggerButton);

      // Modal should open and steal focus
      await waitFor(() => {
        expect(screen.getByTestId('modal-test')).toBeInTheDocument();
        expect(triggerButton).not.toHaveFocus();
      });

      // Close modal
      await user.keyboard('{Escape}');

      // Focus should be restored to trigger button
      await waitFor(() => {
        expect(screen.queryByTestId('modal-test')).not.toBeInTheDocument();
        expect(triggerButton).toHaveFocus();
      });
    });
  });

  describe('Modal Stacking', () => {
    it('should handle multiple modals with correct z-index', async () => {
      const TestModalStack = () => {
        const [modal1Open, setModal1Open] = React.useState(false);
        const [modal2Open, setModal2Open] = React.useState(false);

        return (
          <ModalProvider>
            <button onClick={() => setModal1Open(true)} data-testid="open-modal-1">
              Open Modal 1
            </button>

            <Modal
              isOpen={modal1Open}
              onClose={() => setModal1Open(false)}
              title="Modal 1"
              id="modal-1"
            >
              <p>First modal content</p>
              <button onClick={() => setModal2Open(true)} data-testid="open-modal-2">
                Open Modal 2
              </button>
            </Modal>

            <Modal
              isOpen={modal2Open}
              onClose={() => setModal2Open(false)}
              title="Modal 2"
              id="modal-2"
            >
              <p>Second modal content</p>
            </Modal>
          </ModalProvider>
        );
      };

      render(<TestModalStack />);

      // Open first modal
      await user.click(screen.getByTestId('open-modal-1'));

      await waitFor(() => {
        expect(screen.getByTestId('modal-modal-1')).toBeInTheDocument();
      });

      // Open second modal from first modal
      await user.click(screen.getByTestId('open-modal-2'));

      await waitFor(() => {
        expect(screen.getByTestId('modal-modal-2')).toBeInTheDocument();
      });

      // Both modals should be present
      expect(screen.getByTestId('modal-modal-1')).toBeInTheDocument();
      expect(screen.getByTestId('modal-modal-2')).toBeInTheDocument();

      // Second modal should have higher z-index
      const overlay1 = screen.getByTestId('modal-overlay-modal-1');
      const overlay2 = screen.getByTestId('modal-overlay-modal-2');

      const zIndex1 = parseInt(window.getComputedStyle(overlay1).zIndex);
      const zIndex2 = parseInt(window.getComputedStyle(overlay2).zIndex);

      expect(zIndex2).toBeGreaterThan(zIndex1);

      // Escape should close only the top modal
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('modal-modal-2')).not.toBeInTheDocument();
        expect(screen.getByTestId('modal-modal-1')).toBeInTheDocument();
      });
    });
  });

  describe('Confirmation Modal', () => {
    it('should handle confirmation flow', async () => {
      const onConfirm = tester.createMock('onConfirm');
      const onCancel = tester.createMock('onCancel');

      render(
        <ModalProvider>
          <ConfirmationModal
            isOpen={true}
            onConfirm={onConfirm}
            onCancel={onCancel}
            message="Are you sure you want to delete this item?"
            variant="danger"
          />
        </ModalProvider>
      );

      expect(screen.getByTestId('confirmation-message')).toHaveTextContent(
        'Are you sure you want to delete this item?'
      );

      // Test confirm
      await user.click(screen.getByTestId('confirmation-confirm'));
      expect(onConfirm).toHaveBeenCalled();

      // Reset mocks
      onConfirm.mockReset();
      onCancel.mockReset();

      // Test cancel
      await user.click(screen.getByTestId('confirmation-cancel'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Drawer Component', () => {
    it('should handle drawer opening and closing', async () => {
      const onClose = tester.createMock('onClose');

      const { rerender } = render(
        <Drawer
          isOpen={false}
          onClose={onClose}
          position="right"
          size="300px"
        >
          <p>Drawer content</p>
        </Drawer>
      );

      // Drawer should not be visible
      expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();

      // Open drawer
      rerender(
        <Drawer
          isOpen={true}
          onClose={onClose}
          position="right"
          size="300px"
        >
          <p>Drawer content</p>
        </Drawer>
      );

      await waitFor(() => {
        expect(screen.getByTestId('drawer')).toBeInTheDocument();
        expect(screen.getByTestId('drawer')).toHaveAttribute('data-position', 'right');
        expect(screen.getByText('Drawer content')).toBeInTheDocument();
      });

      // Close with overlay click
      await user.click(screen.getByTestId('drawer-overlay'));
      expect(onClose).toHaveBeenCalled();

      // Reset and test escape key
      onClose.mockReset();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Tooltip Component', () => {
    it('should show tooltip on hover with delay', async () => {
      jest.useFakeTimers();

      render(
        <Tooltip content="This is a tooltip" delay={200}>
          <button data-testid="tooltip-trigger-btn">Hover me</button>
        </Tooltip>
      );

      const trigger = screen.getByTestId('tooltip-trigger');

      // Hover over trigger
      await user.hover(trigger);

      // Tooltip should not appear immediately
      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Tooltip should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('tooltip')).toBeInTheDocument();
        expect(screen.getByText('This is a tooltip')).toBeInTheDocument();
      });

      // Move mouse away
      await user.unhover(trigger);

      // Tooltip should disappear
      await waitFor(() => {
        expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should handle click trigger', async () => {
      render(
        <Tooltip content="Click tooltip" trigger="click">
          <button data-testid="tooltip-trigger-btn">Click me</button>
        </Tooltip>
      );

      const trigger = screen.getByTestId('tooltip-trigger');

      // Click to show
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      });

      // Click again to hide
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have proper ARIA attributes', async () => {
      render(
        <ModalProvider>
          <Modal
            isOpen={true}
            onClose={() => {}}
            title="Accessible Modal"
            id="accessible"
            ariaDescribedBy="modal-description"
          >
            <p id="modal-description">This modal demonstrates accessibility features</p>
          </Modal>
        </ModalProvider>
      );

      const modal = screen.getByTestId('modal-accessible');

      expect(modal).toHaveAttribute('role', 'dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'accessible-title');
      expect(modal).toHaveAttribute('aria-describedby', 'modal-description');

      const closeButton = screen.getByTestId('modal-close-accessible');
      expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
    });

    it('should handle screen reader announcements', async () => {
      // This would typically require a real screen reader test
      // For now, we verify the proper ARIA structure is in place
      render(
        <ModalProvider>
          <Modal
            isOpen={true}
            onClose={() => {}}
            title="Announcement Test"
            id="announce"
          >
            <div role="status" aria-live="polite" data-testid="announcement">
              Modal opened successfully
            </div>
          </Modal>
        </ModalProvider>
      );

      const announcement = screen.getByTestId('announcement');
      expect(announcement).toHaveAttribute('role', 'status');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should properly cleanup event listeners', async () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <ModalProvider>
          <Modal
            isOpen={true}
            onClose={() => {}}
            title="Cleanup Test"
            id="cleanup"
          >
            <p>Content</p>
          </Modal>
        </ModalProvider>
      );

      // Verify event listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      // Unmount component
      unmount();

      // Verify event listener was removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should handle portal cleanup', async () => {
      const { unmount } = render(
        <ModalProvider>
          <Modal
            isOpen={true}
            onClose={() => {}}
            title="Portal Test"
            id="portal"
          >
            <p>Portal content</p>
          </Modal>
        </ModalProvider>
      );

      // Modal root should contain the modal
      const modalRoot = document.getElementById('modal-root');
      expect(modalRoot?.childNodes.length).toBeGreaterThan(0);

      // Unmount
      unmount();

      // Portal content should be cleaned up
      await waitFor(() => {
        expect(modalRoot?.childNodes.length).toBe(0);
      });
    });
  });
});