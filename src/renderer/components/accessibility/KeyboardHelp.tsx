/**
 * Keyboard Help Component
 * Displays keyboard shortcuts and navigation help
 */

import React, { useState, useEffect } from 'react';
import { useKeyboard } from '../contexts/KeyboardContext';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
    scope?: string;
  }>;
}

const GLOBAL_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Tab'], description: 'Move to next element' },
      { keys: ['Shift', 'Tab'], description: 'Move to previous element' },
      { keys: ['Enter'], description: 'Activate focused element' },
      { keys: ['Space'], description: 'Activate buttons and checkboxes' },
      { keys: ['Escape'], description: 'Close dialogs and menus' },
    ]
  },
  {
    title: 'Global Actions',
    shortcuts: [
      { keys: ['F1'], description: 'Show/hide this help dialog' },
      { keys: ['/'], description: 'Focus search input' },
      { keys: ['Ctrl', 'K'], description: 'Quick command palette (future)' },
      { keys: ['Alt', 'S'], description: 'Focus search results' },
      { keys: ['Alt', 'A'], description: 'Add new entry' },
    ]
  },
  {
    title: 'Search & Results',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate search results' },
      { keys: ['Enter'], description: 'Open selected entry' },
      { keys: ['Ctrl', 'Enter'], description: 'Open entry in new view' },
      { keys: ['1-9'], description: 'Select entry by number' },
    ]
  },
  {
    title: 'Entry Details',
    shortcuts: [
      { keys: ['Escape'], description: 'Close entry details' },
      { keys: ['R'], description: 'Rate entry as helpful' },
      { keys: ['Shift', 'R'], description: 'Rate entry as not helpful' },
      { keys: ['C'], description: 'Copy solution to clipboard' },
      { keys: ['E'], description: 'Edit entry (if permissions)' },
    ]
  },
  {
    title: 'Forms & Dialogs',
    shortcuts: [
      { keys: ['Tab'], description: 'Next field' },
      { keys: ['Shift', 'Tab'], description: 'Previous field' },
      { keys: ['Ctrl', 'Enter'], description: 'Submit form' },
      { keys: ['Escape'], description: 'Cancel and close' },
      { keys: ['Ctrl', 'S'], description: 'Save draft' },
    ]
  }
];

interface KeyboardHelpProps {
  isOpen: boolean;
  onClose: () => void;
  additionalShortcuts?: ShortcutGroup[];
}

export function KeyboardHelp({ isOpen, onClose, additionalShortcuts = [] }: KeyboardHelpProps) {
  const { state } = useKeyboard();
  const [selectedCategory, setSelectedCategory] = useState(0);

  // Modal navigation removed - using standard keyboard navigation

  // Get all shortcut groups
  const allShortcuts = [
    ...GLOBAL_SHORTCUTS,
    ...additionalShortcuts
  ];

  // Get registered shortcuts from context
  const [registeredShortcuts, setRegisteredShortcuts] = useState<ShortcutGroup[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Convert registered shortcuts to display format
    const shortcuts = Array.from(state.registeredShortcuts.values());
    const groupedShortcuts: { [scope: string]: ShortcutGroup } = {};

    shortcuts.forEach(shortcut => {
      const scope = shortcut.scope || 'global';
      if (!groupedShortcuts[scope]) {
        groupedShortcuts[scope] = {
          title: scope === 'global' ? 'Global' : scope.charAt(0).toUpperCase() + scope.slice(1),
          shortcuts: []
        };
      }

      const keys = [];
      if (shortcut.ctrlKey) keys.push('Ctrl');
      if (shortcut.altKey) keys.push('Alt');
      if (shortcut.metaKey) keys.push('Cmd');
      if (shortcut.shiftKey) keys.push('Shift');
      keys.push(shortcut.key);

      groupedShortcuts[scope].shortcuts.push({
        keys,
        description: shortcut.description,
        scope: shortcut.scope
      });
    });

    setRegisteredShortcuts(Object.values(groupedShortcuts));
  }, [isOpen, state.registeredShortcuts]);

  // Combine all shortcut groups
  const displayShortcuts = [...allShortcuts, ...registeredShortcuts];

  if (!isOpen) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem'
  };

  const dialogStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    maxWidth: '900px',
    width: '100%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const headerStyle: React.CSSProperties = {
    padding: '1.5rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const closeButtonStyle: React.CSSProperties = {
    padding: '0.5rem',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '1.25rem',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  };

  const sidebarStyle: React.CSSProperties = {
    width: '200px',
    borderRight: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    padding: '1rem 0',
    overflow: 'auto'
  };

  const categoryButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
    display: 'block'
  };

  const activeCategoryButtonStyle: React.CSSProperties = {
    ...categoryButtonStyle,
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontWeight: '600'
  };

  const mainContentStyle: React.CSSProperties = {
    flex: 1,
    padding: '1.5rem',
    overflow: 'auto'
  };

  const shortcutListStyle: React.CSSProperties = {
    display: 'grid',
    gap: '1rem'
  };

  const shortcutItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 0',
    borderBottom: '1px solid #f3f4f6'
  };

  const shortcutKeysStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.25rem',
    alignItems: 'center'
  };

  const keyStyle: React.CSSProperties = {
    padding: '0.25rem 0.5rem',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: '#374151',
    minWidth: '1.5rem',
    textAlign: 'center',
    fontFamily: 'monospace'
  };

  const plusStyle: React.CSSProperties = {
    color: '#6b7280',
    fontSize: '0.75rem',
    fontWeight: '500'
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#374151',
    flex: 1,
    marginLeft: '1rem'
  };

  const footerStyle: React.CSSProperties = {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    fontSize: '0.75rem',
    color: '#6b7280',
    textAlign: 'center'
  };

  const currentCategory = displayShortcuts[selectedCategory];

  return (
    <div style={containerStyle} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="keyboard-help-title">
      <div
        // Container ref removed - using standard focus management
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={headerStyle}>
          <h2 id="keyboard-help-title" style={titleStyle}>
            ⌨️ Keyboard Shortcuts
            {state.isKeyboardMode && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '500',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#dcfce7',
                color: '#166534',
                borderRadius: '4px'
              }}>
                Keyboard Mode Active
              </span>
            )}
          </h2>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            aria-label="Close help dialog"
            title="Close (Escape)"
          >
            ✕
          </button>
        </header>

        <div style={contentStyle}>
          <nav style={sidebarStyle} role="tablist" aria-label="Shortcut categories">
            {displayShortcuts.map((group, index) => (
              <button
                key={group.title}
                role="tab"
                aria-selected={selectedCategory === index}
                style={selectedCategory === index ? activeCategoryButtonStyle : categoryButtonStyle}
                onClick={() => setSelectedCategory(index)}
                tabIndex={selectedCategory === index ? 0 : -1}
              >
                {group.title}
              </button>
            ))}
          </nav>

          <main style={mainContentStyle} role="tabpanel">
            {currentCategory && (
              <>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
                  {currentCategory.title}
                </h3>
                <div style={shortcutListStyle} role="list">
                  {currentCategory.shortcuts.map((shortcut, index) => (
                    <div key={index} style={shortcutItemStyle} role="listitem">
                      <div style={shortcutKeysStyle}>
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && <span style={plusStyle}>+</span>}
                            <kbd style={keyStyle}>{key}</kbd>
                          </React.Fragment>
                        ))}
                      </div>
                      <div style={descriptionStyle}>{shortcut.description}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>

        <footer style={footerStyle}>
          <p>
            Tip: Press <kbd style={{ ...keyStyle, fontSize: '0.6875rem', padding: '0.125rem 0.25rem' }}>F1</kbd> anytime to toggle this help dialog.
            {state.isKeyboardMode && ' Keyboard navigation is optimized for your current interaction mode.'}
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * Global Keyboard Help Provider
 * Automatically shows keyboard help when F1 is pressed
 */
export function GlobalKeyboardHelp() {
  const { state, toggleKeyboardHelp } = useKeyboard();

  return (
    <KeyboardHelp
      isOpen={state.showKeyboardHelp}
      onClose={toggleKeyboardHelp}
    />
  );
}

/**
 * Keyboard Help Button
 * Can be placed anywhere in the UI to show keyboard help
 */
interface KeyboardHelpButtonProps {
  className?: string;
  style?: React.CSSProperties;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'text' | 'full';
}

export function KeyboardHelpButton({
  className = '',
  style = {},
  size = 'medium',
  variant = 'icon'
}: KeyboardHelpButtonProps) {
  const { toggleKeyboardHelp, state } = useKeyboard();

  const sizeStyles = {
    small: { padding: '0.25rem', fontSize: '0.75rem' },
    medium: { padding: '0.5rem', fontSize: '0.875rem' },
    large: { padding: '0.75rem', fontSize: '1rem' }
  };

  const buttonStyle: React.CSSProperties = {
    border: '1px solid #d1d5db',
    backgroundColor: '#f9fafb',
    color: '#374151',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontFamily: 'inherit',
    fontWeight: '500',
    transition: 'all 0.2s',
    ...sizeStyles[size],
    ...style
  };

  const getButtonContent = () => {
    switch (variant) {
      case 'icon':
        return '⌨️';
      case 'text':
        return 'Help';
      case 'full':
        return (
          <>
            ⌨️
            <span>Keyboard Help</span>
            <kbd style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.25rem',
              backgroundColor: '#e5e7eb',
              borderRadius: '2px',
              fontWeight: '400'
            }}>
              F1
            </kbd>
          </>
        );
    }
  };

  return (
    <button
      className={className}
      style={buttonStyle}
      onClick={toggleKeyboardHelp}
      title="Show keyboard shortcuts (F1)"
      aria-label="Show keyboard shortcuts"
      type="button"
    >
      {getButtonContent()}
    </button>
  );
}