/**
 * Focus Management System Examples
 * Demonstrates how to use the comprehensive focus management system
 */

import React, { useRef, useState } from 'react';
import {
  FocusProvider,
  useFocus,
  KeyboardProvider,
  useKeyboard,
  useFocusManagement,
  useArrowKeyNavigation,
  useTypeahead,
  useModalNavigation,
  useMenuNavigation,
  useTabNavigation,
  useGridNavigation
} from '../hooks';

// 1. Basic Focus Management Example
export function BasicFocusExample() {
  const focusManagement = useFocusManagement({
    autoFocus: 'first',
    restoreFocus: true,
    manageFocusVisible: true
  });

  return (
    <div ref={focusManagement.containerRef}>
      <h2>Basic Focus Management</h2>
      <button>First Button</button>
      <input type="text" placeholder="Input field" />
      <button>Last Button</button>

      <div>
        <button onClick={() => focusManagement.focusFirst()}>
          Focus First Element
        </button>
        <button onClick={() => focusManagement.focusLast()}>
          Focus Last Element
        </button>
        <button onClick={() => focusManagement.focusNext()}>
          Focus Next
        </button>
        <button onClick={() => focusManagement.focusPrevious()}>
          Focus Previous
        </button>
      </div>

      <div>
        <p>Focus visible: {focusManagement.isFocusVisible ? 'Yes' : 'No'}</p>
        <p>Keyboard mode: {focusManagement.isKeyboardMode ? 'Yes' : 'No'}</p>
        <p>Current element: {focusManagement.currentFocusedElement?.textContent || 'None'}</p>
      </div>
    </div>
  );
}

// 2. Focus Trap Example (Modal Dialog)
export function FocusTrapExample() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <h2>Focus Trap Example</h2>
      <button onClick={() => setModalOpen(true)}>
        Open Modal
      </button>

      {modalOpen && <Modal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function Modal({ onClose }: { onClose: () => void }) {
  const navigation = useModalNavigation(true, onClose);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div
        ref={navigation.containerRef}
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          minWidth: '300px'
        }}
      >
        <h3>Modal Dialog</h3>
        <p>Focus is trapped within this modal. Use Tab to navigate.</p>

        <input type="text" placeholder="First input" />
        <input type="text" placeholder="Second input" />

        <div style={{ marginTop: '10px' }}>
          <button onClick={onClose}>OK</button>
          <button onClick={onClose} style={{ marginLeft: '10px' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// 3. Arrow Key Navigation Example
export function ArrowNavigationExample() {
  const itemsRef = useRef<HTMLElement[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');

  const navigation = useArrowKeyNavigation(itemsRef, {
    orientation: 'vertical',
    wrap: true,
    onActivate: (element, index) => {
      setSelectedItem(`${element.textContent} (index ${index})`);
    }
  });

  React.useEffect(() => {
    itemsRef.current = Array.from(
      document.querySelectorAll('[data-nav-item]')
    ) as HTMLElement[];
  }, []);

  return (
    <div>
      <h2>Arrow Key Navigation</h2>
      <p>Use arrow keys to navigate, Enter to activate</p>

      <div onKeyDown={navigation.handleKeyDown} tabIndex={0}>
        <div data-nav-item tabIndex={0} style={{ padding: '8px', border: '1px solid #ccc', margin: '4px' }}>
          Item 1
        </div>
        <div data-nav-item tabIndex={0} style={{ padding: '8px', border: '1px solid #ccc', margin: '4px' }}>
          Item 2
        </div>
        <div data-nav-item tabIndex={0} style={{ padding: '8px', border: '1px solid #ccc', margin: '4px' }}>
          Item 3
        </div>
      </div>

      <div style={{ marginTop: '10px' }}>
        <p>Active Index: {navigation.activeIndex}</p>
        <p>Selected Item: {selectedItem}</p>

        <button onClick={navigation.moveNext}>Move Next</button>
        <button onClick={navigation.movePrevious}>Move Previous</button>
        <button onClick={navigation.activate}>Activate Current</button>
      </div>
    </div>
  );
}

// 4. Typeahead Search Example
export function TypeaheadExample() {
  const itemsRef = useRef<HTMLElement[]>([]);

  const typeahead = useTypeahead(itemsRef, {
    searchProperty: 'textContent',
    timeout: 1000,
    onMatch: (element, query) => {
      console.log(`Matched "${query}" with "${element.textContent}"`);
    }
  });

  React.useEffect(() => {
    itemsRef.current = Array.from(
      document.querySelectorAll('[data-typeahead-item]')
    ) as HTMLElement[];
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      typeahead.handleTypeahead(event.key);
    }
  };

  return (
    <div>
      <h2>Typeahead Search</h2>
      <p>Focus the list and start typing to search</p>

      <div onKeyDown={handleKeyDown} tabIndex={0} style={{ border: '1px solid #ccc', padding: '10px' }}>
        <div data-typeahead-item tabIndex={0} style={{ padding: '4px' }}>Apple</div>
        <div data-typeahead-item tabIndex={0} style={{ padding: '4px' }}>Banana</div>
        <div data-typeahead-item tabIndex={0} style={{ padding: '4px' }}>Cherry</div>
        <div data-typeahead-item tabIndex={0} style={{ padding: '4px' }}>Date</div>
        <div data-typeahead-item tabIndex={0} style={{ padding: '4px' }}>Elderberry</div>
      </div>

      <div style={{ marginTop: '10px' }}>
        <p>Query: "{typeahead.query}"</p>
        <p>Matches: {typeahead.matches.length}</p>
        <p>Active Match: {typeahead.activeMatch?.textContent || 'None'}</p>

        <button onClick={typeahead.clearQuery}>Clear Query</button>
      </div>
    </div>
  );
}

// 5. Menu Navigation Example
export function MenuExample() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenuStates, setSubmenuStates] = useState<{[key: string]: boolean}>({});

  const navigation = useMenuNavigation({
    orientation: 'vertical',
    hasSubmenus: true,
    onClose: () => setMenuOpen(false),
    onSubmenuToggle: (item, open) => {
      const itemId = item.getAttribute('data-menu-item') || '';
      setSubmenuStates(prev => ({ ...prev, [itemId]: open }));
    }
  });

  return (
    <div>
      <h2>Menu Navigation</h2>
      <button onClick={() => setMenuOpen(!menuOpen)}>
        Toggle Menu
      </button>

      {menuOpen && (
        <div
          ref={navigation.containerRef}
          style={{
            border: '1px solid #ccc',
            backgroundColor: 'white',
            padding: '8px',
            marginTop: '5px'
          }}
        >
          <div
            data-menu-item="file"
            tabIndex={0}
            style={{ padding: '4px' }}
            aria-haspopup="true"
            aria-expanded={submenuStates.file ? 'true' : 'false'}
          >
            File {submenuStates.file ? '▶' : '▼'}
          </div>
          <div
            data-menu-item="edit"
            tabIndex={0}
            style={{ padding: '4px' }}
            aria-haspopup="true"
            aria-expanded={submenuStates.edit ? 'true' : 'false'}
          >
            Edit {submenuStates.edit ? '▶' : '▼'}
          </div>
          <div data-menu-item="view" tabIndex={0} style={{ padding: '4px' }}>
            View
          </div>
        </div>
      )}
    </div>
  );
}

// 6. Tab Navigation Example
export function TabExample() {
  const [activePanel, setActivePanel] = useState('panel1');

  const tabNavigation = useTabNavigation({
    activationMode: 'manual',
    onTabChange: (tabId, tabElement) => {
      setActivePanel(`panel${tabId.slice(-1)}`);
    }
  });

  return (
    <div>
      <h2>Tab Navigation</h2>

      <div ref={tabNavigation.containerRef} role="tablist" style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
        <button
          role="tab"
          id="tab1"
          aria-selected={tabNavigation.activeTabId === 'tab1'}
          style={{
            padding: '8px 16px',
            border: 'none',
            backgroundColor: tabNavigation.activeTabId === 'tab1' ? '#f0f0f0' : 'transparent'
          }}
        >
          Tab 1
        </button>
        <button
          role="tab"
          id="tab2"
          aria-selected={tabNavigation.activeTabId === 'tab2'}
          style={{
            padding: '8px 16px',
            border: 'none',
            backgroundColor: tabNavigation.activeTabId === 'tab2' ? '#f0f0f0' : 'transparent'
          }}
        >
          Tab 2
        </button>
        <button
          role="tab"
          id="tab3"
          aria-selected={tabNavigation.activeTabId === 'tab3'}
          style={{
            padding: '8px 16px',
            border: 'none',
            backgroundColor: tabNavigation.activeTabId === 'tab3' ? '#f0f0f0' : 'transparent'
          }}
        >
          Tab 3
        </button>
      </div>

      <div style={{ padding: '20px', border: '1px solid #ccc', borderTop: 'none' }}>
        {activePanel === 'panel1' && <div>Content for Tab 1</div>}
        {activePanel === 'panel2' && <div>Content for Tab 2</div>}
        {activePanel === 'panel3' && <div>Content for Tab 3</div>}
      </div>
    </div>
  );
}

// 7. Grid Navigation Example
export function GridExample() {
  const gridNavigation = useGridNavigation(3, 3); // 3x3 grid

  const cellStyle = (row: number, col: number) => ({
    position: 'absolute' as const,
    left: `${col * 120}px`,
    top: `${row * 60}px`,
    width: '100px',
    height: '40px',
    border: '1px solid #ccc',
    backgroundColor:
      gridNavigation.currentRow === row && gridNavigation.currentColumn === col
        ? '#e0e0e0'
        : 'white'
  });

  return (
    <div>
      <h2>Grid Navigation</h2>
      <p>Use arrow keys or buttons to navigate the grid</p>

      <div
        ref={gridNavigation.containerRef}
        style={{ position: 'relative', height: '200px', width: '360px', border: '1px solid #000' }}
      >
        {Array.from({ length: 9 }, (_, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          return (
            <button
              key={i}
              style={cellStyle(row, col)}
              tabIndex={gridNavigation.currentRow === row && gridNavigation.currentColumn === col ? 0 : -1}
            >
              Cell ({row},{col})
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: '220px' }}>
        <p>Current Position: ({gridNavigation.currentRow}, {gridNavigation.currentColumn})</p>

        <div>
          <button onClick={gridNavigation.moveUp}>↑ Up</button>
          <button onClick={gridNavigation.moveDown}>↓ Down</button>
          <button onClick={gridNavigation.moveLeft}>← Left</button>
          <button onClick={gridNavigation.moveRight}>→ Right</button>
        </div>
      </div>
    </div>
  );
}

// 8. Global Focus State Example
export function GlobalFocusStateExample() {
  const {
    state,
    focusElement,
    addToHistory,
    getHistory,
    restoreFromHistory,
    createFocusScope,
    activateScope,
    lockFocus,
    unlockFocus
  } = useFocus();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <h2>Global Focus State Management</h2>

      <div>
        <button ref={buttonRef}>Focus Target Button</button>
        <input type="text" placeholder="Input field" />
        <textarea placeholder="Text area"></textarea>
      </div>

      <div ref={scopeRef} style={{ border: '1px solid blue', padding: '10px', margin: '10px 0' }}>
        <h3>Focus Scope</h3>
        <button>Scope Button 1</button>
        <button>Scope Button 2</button>
      </div>

      <div>
        <h3>Focus Controls</h3>
        <button onClick={() => buttonRef.current && focusElement(buttonRef.current)}>
          Focus Target Button
        </button>
        <button onClick={() => buttonRef.current && addToHistory(buttonRef.current)}>
          Add Button to History
        </button>
        <button onClick={() => restoreFromHistory()}>
          Restore from History
        </button>
        <button onClick={() => scopeRef.current && createFocusScope('example-scope', scopeRef.current)}>
          Create Focus Scope
        </button>
        <button onClick={() => activateScope('example-scope')}>
          Activate Scope
        </button>
        <button onClick={() => scopeRef.current && lockFocus(scopeRef.current, 'example lock')}>
          Lock Focus to Scope
        </button>
        <button onClick={() => unlockFocus()}>
          Unlock Focus
        </button>
      </div>

      <div>
        <h3>Focus State</h3>
        <p>Current focused: {state.currentFocusedElement?.textContent || 'None'}</p>
        <p>Previous focused: {state.previousFocusedElement?.textContent || 'None'}</p>
        <p>Focus mode: {state.focusMode}</p>
        <p>Focus visible: {state.isFocusVisible ? 'Yes' : 'No'}</p>
        <p>Keyboard only: {state.isKeyboardOnlyMode ? 'Yes' : 'No'}</p>
        <p>Active scope: {state.activeScope || 'None'}</p>
        <p>Focus locked: {state.focusLocked ? 'Yes' : 'No'}</p>
        <p>Lock reason: {state.lockReason || 'None'}</p>
        <p>History length: {state.focusHistory.length}</p>
      </div>
    </div>
  );
}

// 9. Complete Example Application
export function CompleteFocusManagementExample() {
  return (
    <FocusProvider>
      <KeyboardProvider>
        <div style={{ padding: '20px' }}>
          <h1>Focus Management System Examples</h1>

          <div style={{ marginBottom: '40px' }}>
            <BasicFocusExample />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <FocusTrapExample />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <ArrowNavigationExample />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <TypeaheadExample />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <MenuExample />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <TabExample />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <GridExample />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <GlobalFocusStateExample />
          </div>
        </div>
      </KeyboardProvider>
    </FocusProvider>
  );
}