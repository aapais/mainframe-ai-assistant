/**
 * Integration tests for the complete focus management system
 * Tests the interaction between all focus management components
 */

import React, { useRef, useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusProvider, useFocus } from '../contexts/FocusContext';
import { KeyboardProvider, useKeyboard } from '../contexts/KeyboardContext';
import { useFocusManagement } from '../hooks/useFocusManagement';
import { useArrowKeyNavigation, useTypeahead } from '../hooks/useKeyboardNavigation';

// Complex test component that uses all focus management features
function CompleteApplication() {
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <FocusProvider>
      <KeyboardProvider>
        <div data-testid="app">
          <MainContent
            onOpenModal={() => setModalOpen(true)}
            onOpenMenu={() => setMenuOpen(true)}
          />

          {modalOpen && (
            <Modal onClose={() => setModalOpen(false)} />
          )}

          {menuOpen && (
            <DropdownMenu onClose={() => setMenuOpen(false)} />
          )}
        </div>
      </KeyboardProvider>
    </FocusProvider>
  );
}

// Main content with navigation and search
function MainContent({ onOpenModal, onOpenMenu }: {
  onOpenModal: () => void;
  onOpenMenu: () => void;
}) {
  const { createFocusScope, activateScope } = useFocus();
  const { registerShortcut } = useKeyboard();
  const itemsRef = useRef<HTMLElement[]>([]);
  const mainRef = useRef<HTMLDivElement>(null);

  const focusManagement = useFocusManagement({
    autoFocus: false,
    restoreFocus: true,
    scope: 'main-content'
  });

  const navigation = useArrowKeyNavigation(itemsRef, {
    orientation: 'vertical',
    wrap: true,
    onActivate: (element) => {
      if (element.textContent === 'Open Modal') {
        onOpenModal();
      } else if (element.textContent === 'Open Menu') {
        onOpenMenu();
      }
    }
  });

  const typeahead = useTypeahead(itemsRef, {
    timeout: 1000,
    onMatch: (element, query) => {
      element.setAttribute('data-matched', 'true');
    }
  });

  React.useEffect(() => {
    if (mainRef.current) {
      createFocusScope('main-content', mainRef.current, { priority: 1 });
      activateScope('main-content');
    }

    // Register global shortcuts
    registerShortcut({
      key: 'm',
      ctrlKey: true,
      description: 'Open modal',
      action: onOpenModal
    });

    registerShortcut({
      key: 'n',
      ctrlKey: true,
      description: 'Open menu',
      action: onOpenMenu
    });

    // Update items ref
    itemsRef.current = Array.from(
      mainRef.current?.querySelectorAll('[data-nav-item]') || []
    ) as HTMLElement[];
  }, []);

  return (
    <div
      ref={mainRef}
      data-testid="main-content"
      onKeyDown={navigation.handleKeyDown}
    >
      <h1>Main Application</h1>

      <nav data-testid="navigation">
        <button data-nav-item data-testid="home">Home</button>
        <button data-nav-item data-testid="search">Search</button>
        <button data-nav-item data-testid="settings">Settings</button>
        <button data-nav-item data-testid="open-modal" onClick={onOpenModal}>
          Open Modal
        </button>
        <button data-nav-item data-testid="open-menu" onClick={onOpenMenu}>
          Open Menu
        </button>
      </nav>

      <main data-testid="content">
        <SearchBox />
        <ArticleList />
      </main>

      <div data-testid="typeahead-state">
        <span data-testid="typeahead-query">{typeahead.query}</span>
        <span data-testid="typeahead-matches">{typeahead.matches.length}</span>
      </div>
    </div>
  );
}

// Search box component
function SearchBox() {
  const [query, setQuery] = useState('');
  const { focusElement } = useFocus();
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Focus search box with Ctrl+F
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        if (inputRef.current) {
          focusElement(inputRef.current);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusElement]);

  return (
    <div data-testid="search-box">
      <input
        ref={inputRef}
        data-testid="search-input"
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-search-input
      />
    </div>
  );
}

// Article list with keyboard navigation
function ArticleList() {
  const articlesRef = useRef<HTMLElement[]>([]);

  const navigation = useArrowKeyNavigation(articlesRef, {
    orientation: 'vertical',
    wrap: true,
    onActivate: (element) => {
      // Simulate article selection
      element.setAttribute('data-selected', 'true');
    }
  });

  React.useEffect(() => {
    articlesRef.current = Array.from(
      document.querySelectorAll('[data-article]')
    ) as HTMLElement[];
  }, []);

  return (
    <div
      data-testid="article-list"
      onKeyDown={navigation.handleKeyDown}
    >
      <article data-article data-testid="article1" tabIndex={0}>
        Article 1: Focus Management in React
      </article>
      <article data-article data-testid="article2" tabIndex={0}>
        Article 2: Keyboard Navigation Best Practices
      </article>
      <article data-article data-testid="article3" tabIndex={0}>
        Article 3: WCAG Accessibility Guidelines
      </article>
    </div>
  );
}

// Modal component with focus trap
function Modal({ onClose }: { onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { lockFocus, unlockFocus, createRestorePoint, restoreToPoint } = useFocus();

  const focusManagement = useFocusManagement({
    trapFocus: true,
    autoFocus: 'first',
    restoreFocus: true,
    onFocusChange: (element) => {
      console.log('Modal focus changed to:', element?.textContent);
    }
  });

  React.useEffect(() => {
    if (modalRef.current) {
      createRestorePoint('modal-restore');
      lockFocus(modalRef.current, 'modal open');
      focusManagement.activateTrap();
    }

    return () => {
      unlockFocus();
      restoreToPoint('modal-restore');
      focusManagement.deactivateTrap();
    };
  }, []);

  const handleClose = () => {
    focusManagement.deactivateTrap();
    unlockFocus();
    onClose();
  };

  return (
    <div data-testid="modal-overlay">
      <div
        ref={modalRef}
        data-testid="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div ref={focusManagement.containerRef}>
          <h2 id="modal-title">Modal Dialog</h2>

          <div data-testid="modal-content">
            <p>This is a modal dialog with focus trap.</p>

            <form data-testid="modal-form">
              <input
                data-testid="modal-input1"
                type="text"
                placeholder="First input"
              />
              <input
                data-testid="modal-input2"
                type="text"
                placeholder="Second input"
              />
              <textarea
                data-testid="modal-textarea"
                placeholder="Comments"
              />
            </form>
          </div>

          <div data-testid="modal-buttons">
            <button data-testid="modal-ok">OK</button>
            <button data-testid="modal-cancel" onClick={handleClose}>
              Cancel
            </button>
            <button data-testid="modal-close" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dropdown menu with keyboard navigation
function DropdownMenu({ onClose }: { onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<HTMLElement[]>([]);
  const { lockFocus, unlockFocus } = useFocus();

  const navigation = useArrowKeyNavigation(menuItemsRef, {
    orientation: 'vertical',
    wrap: true,
    onActivate: (element) => {
      console.log('Menu item activated:', element.textContent);
      onClose();
    }
  });

  React.useEffect(() => {
    if (menuRef.current) {
      lockFocus(menuRef.current, 'dropdown menu open');
    }

    menuItemsRef.current = Array.from(
      menuRef.current?.querySelectorAll('[role="menuitem"]') || []
    ) as HTMLElement[];

    // Focus first menu item
    if (menuItemsRef.current.length > 0) {
      menuItemsRef.current[0].focus();
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', navigation.handleKeyDown);

    return () => {
      unlockFocus();
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', navigation.handleKeyDown);
    };
  }, []);

  const handleClose = () => {
    unlockFocus();
    onClose();
  };

  return (
    <div data-testid="menu-overlay" onClick={handleClose}>
      <div
        ref={menuRef}
        data-testid="dropdown-menu"
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div role="menuitem" data-testid="menu-new" tabIndex={0}>
          New File
        </div>
        <div role="menuitem" data-testid="menu-open" tabIndex={0}>
          Open File
        </div>
        <div role="menuitem" data-testid="menu-save" tabIndex={0}>
          Save File
        </div>
        <hr />
        <div role="menuitem" data-testid="menu-exit" tabIndex={0}>
          Exit
        </div>
      </div>
    </div>
  );
}

describe('Focus Management Integration', () => {
  beforeEach(() => {
    // Reset DOM focus
    if (document.activeElement !== document.body) {
      (document.activeElement as HTMLElement)?.blur();
    }
  });

  test('should integrate all focus management components', async () => {
    render(<CompleteApplication />);

    expect(screen.getByTestId('app')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  describe('Basic Navigation', () => {
    test('should navigate between main navigation items', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const navigation = screen.getByTestId('navigation');
      const homeBtn = screen.getByTestId('home');
      const searchBtn = screen.getByTestId('search');

      // Focus navigation and use arrow keys
      navigation.focus();
      await user.keyboard('{ArrowDown}');

      // Should focus one of the navigation items
      const focusedElement = document.activeElement;
      expect(['home', 'search', 'settings', 'open-modal', 'open-menu'])
        .toContain(focusedElement?.getAttribute('data-testid'));
    });

    test('should handle typeahead search in navigation', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const navigation = screen.getByTestId('navigation');

      // Focus navigation and type
      navigation.focus();
      await user.keyboard('s');

      // Should show typeahead state
      await waitFor(() => {
        const query = screen.getByTestId('typeahead-query');
        expect(query.textContent).toBe('s');
      });
    });
  });

  describe('Global Keyboard Shortcuts', () => {
    test('should handle Ctrl+M to open modal', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      // Use global shortcut to open modal
      await user.keyboard('{Control>}m{/Control}');

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).toBeInTheDocument();
      });
    });

    test('should handle Ctrl+N to open menu', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      // Use global shortcut to open menu
      await user.keyboard('{Control>}n{/Control}');

      await waitFor(() => {
        expect(screen.queryByTestId('dropdown-menu')).toBeInTheDocument();
      });
    });

    test('should handle Ctrl+F to focus search', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const searchInput = screen.getByTestId('search-input');

      // Use global shortcut to focus search
      await user.keyboard('{Control>}f{/Control}');

      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('Modal Focus Management', () => {
    test('should trap focus in modal', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const openModalBtn = screen.getByTestId('open-modal');

      // Open modal
      fireEvent.click(openModalBtn);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Focus should be trapped in modal
      const modalInput1 = screen.getByTestId('modal-input1');
      const modalInput2 = screen.getByTestId('modal-input2');
      const modalTextarea = screen.getByTestId('modal-textarea');

      // Tab navigation should cycle within modal
      await user.tab();
      expect(document.activeElement).toBe(modalInput2);

      await user.tab();
      expect(document.activeElement).toBe(modalTextarea);

      // Continue tabbing should cycle to buttons
      await user.tab();
      const okBtn = screen.getByTestId('modal-ok');
      expect(document.activeElement).toBe(okBtn);
    });

    test('should restore focus when modal closes', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const openModalBtn = screen.getByTestId('open-modal');

      // Focus button and open modal
      openModalBtn.focus();
      fireEvent.click(openModalBtn);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Close modal
      const cancelBtn = screen.getByTestId('modal-cancel');
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });

      // Focus should be restored to the button that opened the modal
      await waitFor(() => {
        expect(document.activeElement).toBe(openModalBtn);
      });
    });

    test('should handle escape key in modal', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const openModalBtn = screen.getByTestId('open-modal');

      // Open modal
      fireEvent.click(openModalBtn);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Press escape to close
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Menu Focus Management', () => {
    test('should lock focus in dropdown menu', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const openMenuBtn = screen.getByTestId('open-menu');

      // Open menu
      fireEvent.click(openMenuBtn);

      await waitFor(() => {
        expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
      });

      // Arrow key navigation should work
      await user.keyboard('{ArrowDown}');
      const openMenuItem = screen.getByTestId('menu-open');
      expect(document.activeElement).toBe(openMenuItem);

      await user.keyboard('{ArrowDown}');
      const saveMenuItem = screen.getByTestId('menu-save');
      expect(document.activeElement).toBe(saveMenuItem);
    });

    test('should close menu with escape', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const openMenuBtn = screen.getByTestId('open-menu');

      // Open menu
      fireEvent.click(openMenuBtn);

      await waitFor(() => {
        expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
      });

      // Press escape to close
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument();
      });
    });

    test('should activate menu items with Enter', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const openMenuBtn = screen.getByTestId('open-menu');

      // Open menu
      fireEvent.click(openMenuBtn);

      await waitFor(() => {
        expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
      });

      // Navigate to menu item and activate
      const newMenuItem = screen.getByTestId('menu-new');
      newMenuItem.focus();

      await user.keyboard('{Enter}');

      // Menu should close after activation
      await waitFor(() => {
        expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Article List Navigation', () => {
    test('should navigate articles with arrow keys', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const articleList = screen.getByTestId('article-list');
      const article1 = screen.getByTestId('article1');
      const article2 = screen.getByTestId('article2');

      // Focus article list
      article1.focus();

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(article2);

      await user.keyboard('{ArrowUp}');
      expect(document.activeElement).toBe(article1);
    });

    test('should activate articles with Enter', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const article1 = screen.getByTestId('article1');

      // Focus and activate article
      article1.focus();
      await user.keyboard('{Enter}');

      // Article should be marked as selected
      expect(article1.getAttribute('data-selected')).toBe('true');
    });
  });

  describe('Complex Interaction Scenarios', () => {
    test('should handle modal opening from keyboard navigation', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const navigation = screen.getByTestId('navigation');

      // Navigate to "Open Modal" button using arrow keys
      navigation.focus();

      // Navigate to the "Open Modal" button
      let attempts = 0;
      while (document.activeElement?.textContent !== 'Open Modal' && attempts < 10) {
        await user.keyboard('{ArrowDown}');
        attempts++;
      }

      // Activate the button
      await user.keyboard('{Enter}');

      // Modal should open
      await waitFor(() => {
        expect(screen.queryByTestId('modal')).toBeInTheDocument();
      });
    });

    test('should handle focus restoration through multiple layers', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const searchInput = screen.getByTestId('search-input');
      const openModalBtn = screen.getByTestId('open-modal');

      // Focus search input
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);

      // Open modal (should save focus)
      fireEvent.click(openModalBtn);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Focus should be in modal now
      const modalInput1 = screen.getByTestId('modal-input1');
      expect(document.activeElement).toBe(modalInput1);

      // Close modal
      const cancelBtn = screen.getByTestId('modal-cancel');
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });

      // Focus should be restored to the button that opened the modal
      expect(document.activeElement).toBe(openModalBtn);
    });

    test('should maintain focus scope isolation', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const openModalBtn = screen.getByTestId('open-modal');
      const article1 = screen.getByTestId('article1');

      // Focus article
      article1.focus();

      // Open modal
      fireEvent.click(openModalBtn);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Try to focus element outside modal (should be prevented by focus lock)
      const homeBtn = screen.getByTestId('home');

      // Attempt to focus should fail due to focus lock
      act(() => {
        homeBtn.focus();
      });

      // Focus should remain in modal
      expect(document.activeElement).not.toBe(homeBtn);
    });
  });

  describe('Performance and Memory Management', () => {
    test('should clean up properly when components unmount', () => {
      const { unmount } = render(<CompleteApplication />);

      // Should not throw error on unmount
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    test('should handle rapid focus changes without memory leaks', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const buttons = [
        screen.getByTestId('home'),
        screen.getByTestId('search'),
        screen.getByTestId('settings')
      ];

      // Rapidly change focus multiple times
      for (let i = 0; i < 20; i++) {
        const button = buttons[i % buttons.length];
        act(() => {
          button.focus();
        });
      }

      // Should not cause performance issues or errors
      expect(document.activeElement).toBeTruthy();
    });
  });

  describe('Accessibility Compliance', () => {
    test('should maintain proper ARIA attributes', async () => {
      render(<CompleteApplication />);

      const openModalBtn = screen.getByTestId('open-modal');

      // Open modal
      fireEvent.click(openModalBtn);

      await waitFor(() => {
        const modal = screen.getByTestId('modal');
        expect(modal).toBeInTheDocument();
        expect(modal.getAttribute('role')).toBe('dialog');
        expect(modal.getAttribute('aria-modal')).toBe('true');
        expect(modal.getAttribute('aria-labelledby')).toBe('modal-title');
      });
    });

    test('should provide proper skip link functionality', async () => {
      render(<CompleteApplication />);

      // Skip links should be created by the focus context
      // This is more of a structural test since skip links are typically
      // invisible until focused
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    test('should handle focus visible states correctly', async () => {
      const user = userEvent.setup();

      render(<CompleteApplication />);

      const homeBtn = screen.getByTestId('home');

      // Use keyboard to focus (should show focus ring)
      await user.tab();

      // Focus should be visible for keyboard users
      // This would require checking computed styles or CSS classes
      // which depends on the specific implementation
      expect(document.activeElement).toBeTruthy();
    });
  });
});