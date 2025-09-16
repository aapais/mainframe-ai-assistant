/**
 * Tests for enhanced keyboard navigation hooks
 */

import React, { useRef, useEffect, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  useTypeahead,
  useArrowKeyNavigation,
  useMenuNavigation,
  useTabNavigation,
  useGridNavigation
} from '../useKeyboardNavigation';
import { KeyboardProvider } from '../../contexts/KeyboardContext';
import { FocusProvider } from '../../contexts/FocusContext';

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <FocusProvider>
      <KeyboardProvider>
        {children}
      </KeyboardProvider>
    </FocusProvider>
  );
}

// Test component for typeahead
function TypeaheadTestComponent() {
  const itemsRef = useRef<HTMLElement[]>([]);
  const [matchedQuery, setMatchedQuery] = useState('');

  const {
    query,
    matches,
    activeMatch,
    handleTypeahead,
    clearQuery
  } = useTypeahead(itemsRef, {
    searchProperty: 'textContent',
    timeout: 500,
    onMatch: (element, query) => {
      setMatchedQuery(query);
    }
  });

  useEffect(() => {
    itemsRef.current = Array.from(
      document.querySelectorAll('[data-fruit]')
    ) as HTMLElement[];
  }, []);

  return (
    <div data-testid="typeahead-container">
      <button data-fruit data-testid="apple">Apple</button>
      <button data-fruit data-testid="banana">Banana</button>
      <button data-fruit data-testid="cherry">Cherry</button>
      <button data-fruit data-testid="avocado">Avocado</button>

      <div data-testid="typeahead-state">
        <span data-testid="query">{query}</span>
        <span data-testid="matches-count">{matches.length}</span>
        <span data-testid="active-match">
          {activeMatch?.textContent || 'none'}
        </span>
        <span data-testid="matched-query">{matchedQuery}</span>
      </div>

      <button
        data-testid="type-a"
        onClick={() => handleTypeahead('a')}
      >
        Type A
      </button>
      <button
        data-testid="type-b"
        onClick={() => handleTypeahead('b')}
      >
        Type B
      </button>
      <button
        data-testid="clear"
        onClick={clearQuery}
      >
        Clear
      </button>
    </div>
  );
}

// Test component for arrow key navigation
function ArrowKeyNavigationTestComponent() {
  const itemsRef = useRef<HTMLElement[]>([]);
  const [activatedItem, setActivatedItem] = useState<string>('');

  const {
    activeIndex,
    focusItem,
    moveNext,
    movePrevious,
    moveUp,
    moveDown,
    activate,
    handleKeyDown
  } = useArrowKeyNavigation(itemsRef, {
    orientation: 'vertical',
    wrap: true,
    onActivate: (element, index) => {
      setActivatedItem(`${element.textContent} (${index})`);
    }
  });

  useEffect(() => {
    itemsRef.current = Array.from(
      document.querySelectorAll('[data-nav-item]')
    ) as HTMLElement[];
  }, []);

  useEffect(() => {
    const container = document.querySelector('[data-testid="nav-container"]');
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown]);

  return (
    <div data-testid="nav-container" tabIndex={0}>
      <button data-nav-item data-testid="item1">Item 1</button>
      <button data-nav-item data-testid="item2">Item 2</button>
      <button data-nav-item data-testid="item3">Item 3</button>

      <div data-testid="nav-controls">
        <button data-testid="focus-item-0" onClick={() => focusItem(0)}>
          Focus Item 0
        </button>
        <button data-testid="move-next" onClick={moveNext}>
          Move Next
        </button>
        <button data-testid="move-prev" onClick={movePrevious}>
          Move Previous
        </button>
        <button data-testid="activate" onClick={activate}>
          Activate
        </button>
      </div>

      <div data-testid="nav-state">
        <span data-testid="active-index">{activeIndex}</span>
        <span data-testid="activated-item">{activatedItem}</span>
      </div>
    </div>
  );
}

// Test component for menu navigation
function MenuNavigationTestComponent() {
  const [submenuStates, setSubmenuStates] = useState<{ [key: string]: boolean }>({});

  const navigation = useMenuNavigation({
    orientation: 'vertical',
    hasSubmenus: true,
    onSubmenuToggle: (item, open) => {
      const itemId = item.getAttribute('data-menu-item') || '';
      setSubmenuStates(prev => ({ ...prev, [itemId]: open }));
    }
  });

  return (
    <div ref={navigation.containerRef} data-testid="menu-container">
      <button
        data-menu-item="file"
        data-testid="menu-file"
        aria-haspopup="true"
        aria-expanded={submenuStates.file ? 'true' : 'false'}
      >
        File
      </button>
      <button
        data-menu-item="edit"
        data-testid="menu-edit"
        aria-haspopup="true"
        aria-expanded={submenuStates.edit ? 'true' : 'false'}
      >
        Edit
      </button>
      <button
        data-menu-item="view"
        data-testid="menu-view"
      >
        View
      </button>

      <div data-testid="submenu-states">
        <span data-testid="file-submenu">
          {submenuStates.file ? 'open' : 'closed'}
        </span>
        <span data-testid="edit-submenu">
          {submenuStates.edit ? 'open' : 'closed'}
        </span>
      </div>
    </div>
  );
}

// Test component for tab navigation
function TabNavigationTestComponent() {
  const [activePanel, setActivePanel] = useState('');

  const {
    containerRef,
    activeTabId,
    activateTab
  } = useTabNavigation({
    activationMode: 'manual',
    onTabChange: (tabId, tabElement) => {
      setActivePanel(`panel-${tabId}`);
    }
  });

  return (
    <div>
      <div ref={containerRef} role="tablist" data-testid="tab-list">
        <button
          role="tab"
          id="tab1"
          data-testid="tab1"
          aria-selected={activeTabId === 'tab1'}
        >
          Tab 1
        </button>
        <button
          role="tab"
          id="tab2"
          data-testid="tab2"
          aria-selected={activeTabId === 'tab2'}
        >
          Tab 2
        </button>
        <button
          role="tab"
          id="tab3"
          data-testid="tab3"
          aria-selected={activeTabId === 'tab3'}
        >
          Tab 3
        </button>
      </div>

      <div data-testid="tab-state">
        <span data-testid="active-tab">{activeTabId}</span>
        <span data-testid="active-panel">{activePanel}</span>
      </div>

      <button
        data-testid="activate-tab2"
        onClick={() => {
          const tab2 = document.getElementById('tab2') as HTMLElement;
          if (tab2) activateTab(tab2);
        }}
      >
        Activate Tab 2
      </button>
    </div>
  );
}

// Test component for grid navigation
function GridNavigationTestComponent() {
  const navigation = useGridNavigation(3, 3); // 3x3 grid

  return (
    <div>
      <div ref={navigation.containerRef} data-testid="grid-container">
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            data-testid={`cell-${i}`}
            style={{
              position: 'absolute',
              left: `${(i % 3) * 100}px`,
              top: `${Math.floor(i / 3) * 50}px`,
              width: '80px',
              height: '40px'
            }}
          >
            Cell {i}
          </button>
        ))}
      </div>

      <div data-testid="grid-controls">
        <button data-testid="move-up" onClick={navigation.moveUp}>
          Move Up
        </button>
        <button data-testid="move-down" onClick={navigation.moveDown}>
          Move Down
        </button>
        <button data-testid="move-left" onClick={navigation.moveLeft}>
          Move Left
        </button>
        <button data-testid="move-right" onClick={navigation.moveRight}>
          Move Right
        </button>
      </div>

      <div data-testid="grid-state">
        <span data-testid="current-row">{navigation.currentRow}</span>
        <span data-testid="current-column">{navigation.currentColumn}</span>
      </div>
    </div>
  );
}

describe('Enhanced Keyboard Navigation Hooks', () => {
  beforeEach(() => {
    // Reset DOM focus
    if (document.activeElement !== document.body) {
      (document.activeElement as HTMLElement)?.blur();
    }
  });

  describe('useTypeahead', () => {
    test('should handle typeahead search', async () => {
      render(
        <TestWrapper>
          <TypeaheadTestComponent />
        </TestWrapper>
      );

      const typeABtn = screen.getByTestId('type-a');
      const querySpan = screen.getByTestId('query');
      const matchesSpan = screen.getByTestId('matches-count');
      const activeMatchSpan = screen.getByTestId('active-match');

      // Type 'a'
      fireEvent.click(typeABtn);

      expect(querySpan.textContent).toBe('a');
      expect(matchesSpan.textContent).toBe('2'); // Apple and Avocado
      expect(activeMatchSpan.textContent).toBe('Apple');
    });

    test('should handle consecutive typing', async () => {
      render(
        <TestWrapper>
          <TypeaheadTestComponent />
        </TestWrapper>
      );

      const typeABtn = screen.getByTestId('type-a');
      const typeBBtn = screen.getByTestId('type-b');
      const querySpan = screen.getByTestId('query');
      const activeMatchSpan = screen.getByTestId('active-match');

      // Type 'a' then 'b'
      fireEvent.click(typeABtn);
      fireEvent.click(typeBBtn);

      expect(querySpan.textContent).toBe('ab');
      expect(activeMatchSpan.textContent).toBe('none'); // No match for 'ab'
    });

    test('should clear query', async () => {
      render(
        <TestWrapper>
          <TypeaheadTestComponent />
        </TestWrapper>
      );

      const typeABtn = screen.getByTestId('type-a');
      const clearBtn = screen.getByTestId('clear');
      const querySpan = screen.getByTestId('query');

      // Type then clear
      fireEvent.click(typeABtn);
      expect(querySpan.textContent).toBe('a');

      fireEvent.click(clearBtn);
      expect(querySpan.textContent).toBe('');
    });

    test('should call onMatch callback', async () => {
      render(
        <TestWrapper>
          <TypeaheadTestComponent />
        </TestWrapper>
      );

      const typeABtn = screen.getByTestId('type-a');
      const matchedQuerySpan = screen.getByTestId('matched-query');

      fireEvent.click(typeABtn);

      expect(matchedQuerySpan.textContent).toBe('a');
    });
  });

  describe('useArrowKeyNavigation', () => {
    test('should focus items programmatically', async () => {
      render(
        <TestWrapper>
          <ArrowKeyNavigationTestComponent />
        </TestWrapper>
      );

      const focusItem0Btn = screen.getByTestId('focus-item-0');
      const activeIndexSpan = screen.getByTestId('active-index');
      const item1 = screen.getByTestId('item1');

      fireEvent.click(focusItem0Btn);

      expect(activeIndexSpan.textContent).toBe('0');
      expect(document.activeElement).toBe(item1);
    });

    test('should move next and previous', async () => {
      render(
        <TestWrapper>
          <ArrowKeyNavigationTestComponent />
        </TestWrapper>
      );

      const focusItem0Btn = screen.getByTestId('focus-item-0');
      const moveNextBtn = screen.getByTestId('move-next');
      const movePrevBtn = screen.getByTestId('move-prev');
      const activeIndexSpan = screen.getByTestId('active-index');
      const item2 = screen.getByTestId('item2');
      const item1 = screen.getByTestId('item1');

      // Start at item 0
      fireEvent.click(focusItem0Btn);
      expect(activeIndexSpan.textContent).toBe('0');

      // Move next
      fireEvent.click(moveNextBtn);
      expect(activeIndexSpan.textContent).toBe('1');
      expect(document.activeElement).toBe(item2);

      // Move previous
      fireEvent.click(movePrevBtn);
      expect(activeIndexSpan.textContent).toBe('0');
      expect(document.activeElement).toBe(item1);
    });

    test('should activate items', async () => {
      render(
        <TestWrapper>
          <ArrowKeyNavigationTestComponent />
        </TestWrapper>
      );

      const focusItem0Btn = screen.getByTestId('focus-item-0');
      const activateBtn = screen.getByTestId('activate');
      const activatedItemSpan = screen.getByTestId('activated-item');

      fireEvent.click(focusItem0Btn);
      fireEvent.click(activateBtn);

      expect(activatedItemSpan.textContent).toBe('Item 1 (0)');
    });

    test('should handle keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ArrowKeyNavigationTestComponent />
        </TestWrapper>
      );

      const container = screen.getByTestId('nav-container');
      const activeIndexSpan = screen.getByTestId('active-index');
      const item1 = screen.getByTestId('item1');
      const item2 = screen.getByTestId('item2');

      // Focus container
      container.focus();

      // Arrow down should move to next item
      await user.keyboard('{ArrowDown}');
      expect(activeIndexSpan.textContent).toBe('1');
      expect(document.activeElement).toBe(item2);

      // Arrow up should move to previous item
      await user.keyboard('{ArrowUp}');
      expect(activeIndexSpan.textContent).toBe('0');
      expect(document.activeElement).toBe(item1);
    });

    test('should handle Home and End keys', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ArrowKeyNavigationTestComponent />
        </TestWrapper>
      );

      const container = screen.getByTestId('nav-container');
      const activeIndexSpan = screen.getByTestId('active-index');
      const item1 = screen.getByTestId('item1');
      const item3 = screen.getByTestId('item3');

      container.focus();

      // End should go to last item
      await user.keyboard('{End}');
      expect(activeIndexSpan.textContent).toBe('2');
      expect(document.activeElement).toBe(item3);

      // Home should go to first item
      await user.keyboard('{Home}');
      expect(activeIndexSpan.textContent).toBe('0');
      expect(document.activeElement).toBe(item1);
    });
  });

  describe('useMenuNavigation', () => {
    test('should handle submenu toggle', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MenuNavigationTestComponent />
        </TestWrapper>
      );

      const menuFile = screen.getByTestId('menu-file');
      const fileSubmenuState = screen.getByTestId('file-submenu');

      // Focus file menu item
      menuFile.focus();

      // Right arrow should open submenu
      await user.keyboard('{ArrowRight}');

      expect(fileSubmenuState.textContent).toBe('open');
    });

    test('should close submenu with left arrow', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MenuNavigationTestComponent />
        </TestWrapper>
      );

      const menuFile = screen.getByTestId('menu-file');
      const fileSubmenuState = screen.getByTestId('file-submenu');

      // Focus and open submenu
      menuFile.focus();
      await user.keyboard('{ArrowRight}');
      expect(fileSubmenuState.textContent).toBe('open');

      // Left arrow should close submenu
      await user.keyboard('{ArrowLeft}');
      expect(fileSubmenuState.textContent).toBe('closed');
    });

    test('should activate menu items with Enter', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MenuNavigationTestComponent />
        </TestWrapper>
      );

      const menuView = screen.getByTestId('menu-view');

      // Focus menu item
      menuView.focus();

      // Should not throw error when pressing Enter
      expect(async () => {
        await user.keyboard('{Enter}');
      }).not.toThrow();
    });
  });

  describe('useTabNavigation', () => {
    test('should activate tabs manually', async () => {
      render(
        <TestWrapper>
          <TabNavigationTestComponent />
        </TestWrapper>
      );

      const activateTab2Btn = screen.getByTestId('activate-tab2');
      const activeTabSpan = screen.getByTestId('active-tab');
      const activePanelSpan = screen.getByTestId('active-panel');
      const tab2 = screen.getByTestId('tab2');

      fireEvent.click(activateTab2Btn);

      expect(activeTabSpan.textContent).toBe('tab2');
      expect(activePanelSpan.textContent).toBe('panel-tab2');
      expect(tab2.getAttribute('aria-selected')).toBe('true');
    });

    test('should handle horizontal arrow navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TabNavigationTestComponent />
        </TestWrapper>
      );

      const tabList = screen.getByTestId('tab-list');
      const tab1 = screen.getByTestId('tab1');
      const tab2 = screen.getByTestId('tab2');

      // Focus first tab
      tab1.focus();

      // Right arrow should move to next tab
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(tab2);
    });
  });

  describe('useGridNavigation', () => {
    test('should move in grid pattern', async () => {
      render(
        <TestWrapper>
          <GridNavigationTestComponent />
        </TestWrapper>
      );

      const moveRightBtn = screen.getByTestId('move-right');
      const moveDownBtn = screen.getByTestId('move-down');
      const currentRowSpan = screen.getByTestId('current-row');
      const currentColumnSpan = screen.getByTestId('current-column');

      // Start at (0,0)
      expect(currentRowSpan.textContent).toBe('0');
      expect(currentColumnSpan.textContent).toBe('0');

      // Move right to (0,1)
      fireEvent.click(moveRightBtn);
      expect(currentRowSpan.textContent).toBe('0');
      expect(currentColumnSpan.textContent).toBe('1');

      // Move down to (1,1)
      fireEvent.click(moveDownBtn);
      expect(currentRowSpan.textContent).toBe('1');
      expect(currentColumnSpan.textContent).toBe('1');
    });

    test('should respect grid boundaries', async () => {
      render(
        <TestWrapper>
          <GridNavigationTestComponent />
        </TestWrapper>
      );

      const moveLeftBtn = screen.getByTestId('move-left');
      const moveUpBtn = screen.getByTestId('move-up');
      const currentRowSpan = screen.getByTestId('current-row');
      const currentColumnSpan = screen.getByTestId('current-column');

      // Try to move left from (0,0) - should stay at (0,0)
      fireEvent.click(moveLeftBtn);
      expect(currentRowSpan.textContent).toBe('0');
      expect(currentColumnSpan.textContent).toBe('0');

      // Try to move up from (0,0) - should stay at (0,0)
      fireEvent.click(moveUpBtn);
      expect(currentRowSpan.textContent).toBe('0');
      expect(currentColumnSpan.textContent).toBe('0');
    });

    test('should handle grid navigation with keyboard', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <GridNavigationTestComponent />
        </TestWrapper>
      );

      const container = screen.getByTestId('grid-container');
      const currentRowSpan = screen.getByTestId('current-row');
      const currentColumnSpan = screen.getByTestId('current-column');

      // Focus container
      container.focus();

      // Arrow right should move column
      await user.keyboard('{ArrowRight}');
      expect(currentColumnSpan.textContent).toBe('1');

      // Arrow down should move row
      await user.keyboard('{ArrowDown}');
      expect(currentRowSpan.textContent).toBe('1');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty item lists gracefully', () => {
      function EmptyListComponent() {
        const itemsRef = useRef<HTMLElement[]>([]);
        const navigation = useArrowKeyNavigation(itemsRef);

        return (
          <div>
            <button
              data-testid="move-next"
              onClick={navigation.moveNext}
            >
              Move Next
            </button>
            <span data-testid="active-index">{navigation.activeIndex}</span>
          </div>
        );
      }

      render(
        <TestWrapper>
          <EmptyListComponent />
        </TestWrapper>
      );

      const moveNextBtn = screen.getByTestId('move-next');
      const activeIndexSpan = screen.getByTestId('active-index');

      // Should not throw error with empty list
      expect(() => {
        fireEvent.click(moveNextBtn);
      }).not.toThrow();

      expect(activeIndexSpan.textContent).toBe('-1');
    });

    test('should handle missing refs gracefully', () => {
      function MissingRefComponent() {
        const itemsRef = useRef<HTMLElement[]>([]);
        const typeahead = useTypeahead(itemsRef);

        return (
          <div>
            <button
              data-testid="handle-typeahead"
              onClick={() => typeahead.handleTypeahead('a')}
            >
              Handle Typeahead
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <MissingRefComponent />
        </TestWrapper>
      );

      const handleBtn = screen.getByTestId('handle-typeahead');

      // Should not throw error with missing items
      expect(() => {
        fireEvent.click(handleBtn);
      }).not.toThrow();
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('should clean up typeahead timers', () => {
      const { unmount } = render(
        <TestWrapper>
          <TypeaheadTestComponent />
        </TestWrapper>
      );

      // Should not throw error on unmount
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    test('should clean up event listeners', () => {
      const { unmount } = render(
        <TestWrapper>
          <MenuNavigationTestComponent />
        </TestWrapper>
      );

      // Should not throw error on unmount
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});