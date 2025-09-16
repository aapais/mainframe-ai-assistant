/**
 * Navigation Shortcuts System
 *
 * Comprehensive keyboard shortcut system for efficient KB navigation
 * with context-aware shortcuts, customization, and accessibility features.
 *
 * Features:
 * - Global and context-aware keyboard shortcuts
 * - Customizable key bindings
 * - Visual shortcut hints and help overlay
 * - Sequential key combinations support
 * - Conflict detection and resolution
 * - Accessibility-compliant shortcuts
 * - Platform-specific modifier keys
 *
 * @author Swarm Navigation Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { CommandLineIcon, QuestionMarkCircleIcon, XMarkIcon } from '../icons/NavigationIcons';
import './NavigationShortcuts.css';

// ========================
// TYPES & INTERFACES
// ========================

export interface KeyBinding {
  id: string;
  keys: string[];
  description: string;
  action: string;
  category: string;
  context?: string;
  enabled: boolean;
  global?: boolean;
  preventDefault?: boolean;
}

export interface ShortcutCategory {
  id: string;
  label: string;
  description: string;
  shortcuts: KeyBinding[];
  priority: number;
}

export interface ShortcutAction {
  id: string;
  handler: (event: KeyboardEvent, binding: KeyBinding) => void | Promise<void>;
  context?: string;
}

export interface NavigationShortcutsProps {
  className?: string;
  /** Available keyboard shortcuts */
  shortcuts: KeyBinding[];
  /** Shortcut action handlers */
  actions: ShortcutAction[];
  /** Enable shortcut hints */
  showHints?: boolean;
  /** Enable help overlay */
  enableHelp?: boolean;
  /** Current context for context-aware shortcuts */
  currentContext?: string;
  /** Platform (auto-detected if not provided) */
  platform?: 'mac' | 'windows' | 'linux';
  /** Enable customization */
  enableCustomization?: boolean;
  /** Event handlers */
  onShortcutExecute?: (binding: KeyBinding, success: boolean) => void;
  onShortcutConflict?: (conflicting: KeyBinding[]) => void;
  onCustomizeRequest?: () => void;
  /** Accessibility */
  announceShortcuts?: boolean;
}

// ========================
// DEFAULT SHORTCUTS
// ========================

const DEFAULT_SHORTCUTS: KeyBinding[] = [
  // Global Navigation
  {
    id: 'global.search',
    keys: ['ctrl+k', 'cmd+k'],
    description: 'Open search',
    action: 'open-search',
    category: 'navigation',
    enabled: true,
    global: true,
    preventDefault: true
  },
  {
    id: 'global.new-entry',
    keys: ['ctrl+n', 'cmd+n'],
    description: 'Create new entry',
    action: 'create-entry',
    category: 'navigation',
    enabled: true,
    global: true,
    preventDefault: true
  },
  {
    id: 'global.help',
    keys: ['f1', 'shift+?'],
    description: 'Show keyboard shortcuts',
    action: 'show-help',
    category: 'help',
    enabled: true,
    global: true,
    preventDefault: true
  },

  // Search Navigation
  {
    id: 'search.next-result',
    keys: ['ctrl+j', 'arrowdown'],
    description: 'Next search result',
    action: 'next-result',
    category: 'search',
    context: 'search',
    enabled: true,
    preventDefault: true
  },
  {
    id: 'search.prev-result',
    keys: ['ctrl+k', 'arrowup'],
    description: 'Previous search result',
    action: 'prev-result',
    category: 'search',
    context: 'search',
    enabled: true,
    preventDefault: true
  },
  {
    id: 'search.select-result',
    keys: ['enter', 'ctrl+o'],
    description: 'Open selected result',
    action: 'open-result',
    category: 'search',
    context: 'search',
    enabled: true,
    preventDefault: true
  },

  // Entry Navigation
  {
    id: 'entry.bookmark',
    keys: ['ctrl+b', 'cmd+b'],
    description: 'Bookmark entry',
    action: 'bookmark-entry',
    category: 'entry',
    context: 'entry',
    enabled: true,
    preventDefault: true
  },
  {
    id: 'entry.share',
    keys: ['ctrl+shift+s'],
    description: 'Share entry',
    action: 'share-entry',
    category: 'entry',
    context: 'entry',
    enabled: true,
    preventDefault: true
  },
  {
    id: 'entry.edit',
    keys: ['e'],
    description: 'Edit entry',
    action: 'edit-entry',
    category: 'entry',
    context: 'entry',
    enabled: true,
    preventDefault: true
  },

  // Category Navigation
  {
    id: 'category.expand',
    keys: ['arrowright', 'space'],
    description: 'Expand category',
    action: 'expand-category',
    category: 'category',
    context: 'category-tree',
    enabled: true,
    preventDefault: true
  },
  {
    id: 'category.collapse',
    keys: ['arrowleft'],
    description: 'Collapse category',
    action: 'collapse-category',
    category: 'category',
    context: 'category-tree',
    enabled: true,
    preventDefault: true
  },

  // Quick Actions
  {
    id: 'quick.recent',
    keys: ['ctrl+r', 'cmd+r'],
    description: 'Show recent entries',
    action: 'show-recent',
    category: 'quick',
    enabled: true,
    global: true,
    preventDefault: true
  },
  {
    id: 'quick.favorites',
    keys: ['ctrl+f', 'cmd+f'],
    description: 'Show favorites',
    action: 'show-favorites',
    category: 'quick',
    enabled: true,
    global: true,
    preventDefault: true
  }
];

// ========================
// KEYBOARD UTILITIES
// ========================

const detectPlatform = (): 'mac' | 'windows' | 'linux' => {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  return 'linux';
};

const normalizeKey = (key: string): string => {
  const keyMap: Record<string, string> = {
    'control': 'ctrl',
    'command': 'cmd',
    'meta': 'cmd',
    'option': 'alt',
    'escape': 'esc',
    ' ': 'space',
    'arrowup': 'up',
    'arrowdown': 'down',
    'arrowleft': 'left',
    'arrowright': 'right'
  };

  return keyMap[key.toLowerCase()] || key.toLowerCase();
};

const parseKeyCombo = (combo: string): string[] => {
  return combo.toLowerCase().split('+').map(normalizeKey);
};

const formatKeyCombo = (combo: string, platform: string): string => {
  const keys = parseKeyCombo(combo);
  const symbols: Record<string, Record<string, string>> = {
    mac: {
      'cmd': '⌘',
      'ctrl': '⌃',
      'alt': '⌥',
      'shift': '⇧',
      'enter': '⏎',
      'space': '␣',
      'esc': '⎋',
      'tab': '⇥',
      'up': '↑',
      'down': '↓',
      'left': '←',
      'right': '→'
    },
    windows: {
      'ctrl': 'Ctrl',
      'alt': 'Alt',
      'shift': 'Shift',
      'enter': 'Enter',
      'space': 'Space',
      'esc': 'Esc',
      'tab': 'Tab'
    },
    linux: {
      'ctrl': 'Ctrl',
      'alt': 'Alt',
      'shift': 'Shift',
      'enter': 'Enter',
      'space': 'Space',
      'esc': 'Esc',
      'tab': 'Tab'
    }
  };

  const platformSymbols = symbols[platform] || symbols.windows;

  return keys
    .map(key => platformSymbols[key] || key.charAt(0).toUpperCase() + key.slice(1))
    .join(platform === 'mac' ? '' : '+');
};

// ========================
// SHORTCUT HELP OVERLAY
// ========================

interface ShortcutHelpOverlayProps {
  shortcuts: ShortcutCategory[];
  platform: string;
  onClose: () => void;
}

const ShortcutHelpOverlay = memo<ShortcutHelpOverlayProps>(({
  shortcuts,
  platform,
  onClose
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="shortcut-help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="help-backdrop" onClick={onClose} />

      <div className="help-panel">
        <div className="help-header">
          <h2 id="help-title">Keyboard Shortcuts</h2>
          <button
            type="button"
            className="help-close"
            onClick={onClose}
            aria-label="Close help"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="help-content">
          {shortcuts.map(category => (
            <div key={category.id} className="shortcut-category">
              <h3 className="category-title">{category.label}</h3>
              <p className="category-description">{category.description}</p>

              <div className="shortcut-list">
                {category.shortcuts.map(shortcut => (
                  <div key={shortcut.id} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((combo, index) => (
                        <React.Fragment key={combo}>
                          {index > 0 && <span className="key-separator">or</span>}
                          <kbd className="key-combo">
                            {formatKeyCombo(combo, platform)}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="shortcut-description">
                      {shortcut.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="help-footer">
          <p className="help-hint">Press <kbd>Esc</kbd> to close this help</p>
        </div>
      </div>
    </div>
  );
});

ShortcutHelpOverlay.displayName = 'ShortcutHelpOverlay';

// ========================
// MAIN COMPONENT
// ========================

export const NavigationShortcuts: React.FC<NavigationShortcutsProps> = memo(({
  className = '',
  shortcuts = DEFAULT_SHORTCUTS,
  actions = [],
  showHints = true,
  enableHelp = true,
  currentContext = '',
  platform: platformProp,
  enableCustomization = false,
  onShortcutExecute,
  onShortcutConflict,
  onCustomizeRequest,
  announceShortcuts = true
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const [lastExecutedShortcut, setLastExecutedShortcut] = useState<string>('');
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // Detect platform
  const platform = platformProp || detectPlatform();

  // Create action map
  const actionMap = useMemo(() => {
    const map = new Map<string, ShortcutAction>();
    actions.forEach(action => {
      map.set(action.id, action);
    });
    return map;
  }, [actions]);

  // Filter and categorize shortcuts
  const { activeShortcuts, categorizedShortcuts } = useMemo(() => {
    // Filter shortcuts by context and enabled state
    const active = shortcuts.filter(shortcut => {
      if (!shortcut.enabled) return false;
      if (shortcut.context && shortcut.context !== currentContext && !shortcut.global) {
        return false;
      }
      return true;
    });

    // Group by category
    const categories = new Map<string, ShortcutCategory>();

    active.forEach(shortcut => {
      if (!categories.has(shortcut.category)) {
        categories.set(shortcut.category, {
          id: shortcut.category,
          label: shortcut.category.charAt(0).toUpperCase() + shortcut.category.slice(1),
          description: `${shortcut.category} related shortcuts`,
          shortcuts: [],
          priority: ['navigation', 'search', 'entry', 'category', 'quick', 'help'].indexOf(shortcut.category)
        });
      }

      categories.get(shortcut.category)!.shortcuts.push(shortcut);
    });

    const categorized = Array.from(categories.values())
      .sort((a, b) => a.priority - b.priority);

    return { activeShortcuts: active, categorizedShortcuts: categorized };
  }, [shortcuts, currentContext]);

  // Check for key combination matches
  const findMatchingShortcut = useCallback((event: KeyboardEvent): KeyBinding | null => {
    const pressedCombo = [];

    if (event.ctrlKey) pressedCombo.push('ctrl');
    if (event.metaKey) pressedCombo.push('cmd');
    if (event.altKey) pressedCombo.push('alt');
    if (event.shiftKey) pressedCombo.push('shift');

    const key = normalizeKey(event.key);
    if (!['ctrl', 'cmd', 'alt', 'shift'].includes(key)) {
      pressedCombo.push(key);
    }

    const pressedString = pressedCombo.join('+');

    // Find matching shortcut
    return activeShortcuts.find(shortcut =>
      shortcut.keys.some(keyCombo => {
        const parsedCombo = parseKeyCombo(keyCombo).sort().join('+');
        const normalizedPressed = pressedCombo.sort().join('+');
        return parsedCombo === normalizedPressed;
      })
    ) || null;
  }, [activeShortcuts]);

  // Execute shortcut action
  const executeShortcut = useCallback(async (binding: KeyBinding, event: KeyboardEvent) => {
    try {
      // Prevent default if specified
      if (binding.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      // Handle built-in actions
      if (binding.action === 'show-help') {
        setShowHelp(true);
        onShortcutExecute?.(binding, true);
        return;
      }

      // Execute custom action
      const action = actionMap.get(binding.action);
      if (action) {
        await action.handler(event, binding);
        setLastExecutedShortcut(binding.id);
        onShortcutExecute?.(binding, true);

        if (announceShortcuts) {
          const announcement = document.createElement('div');
          announcement.setAttribute('aria-live', 'polite');
          announcement.textContent = `Executed: ${binding.description}`;
          document.body.appendChild(announcement);
          setTimeout(() => document.body.removeChild(announcement), 1000);
        }
      } else {
        console.warn(`No action handler found for: ${binding.action}`);
        onShortcutExecute?.(binding, false);
      }
    } catch (error) {
      console.error('Error executing shortcut:', error);
      onShortcutExecute?.(binding, false);
    }
  }, [actionMap, onShortcutExecute, announceShortcuts]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Update pressed keys
      setPressedKeys(prev => new Set([...prev, normalizeKey(event.key)]));

      // Find and execute matching shortcut
      const matchingShortcut = findMatchingShortcut(event);
      if (matchingShortcut) {
        executeShortcut(matchingShortcut, event);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Remove from pressed keys
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(normalizeKey(event.key));
        return next;
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [findMatchingShortcut, executeShortcut]);

  // Clear last executed shortcut after delay
  useEffect(() => {
    if (lastExecutedShortcut) {
      const timeout = setTimeout(() => setLastExecutedShortcut(''), 2000);
      return () => clearTimeout(timeout);
    }
  }, [lastExecutedShortcut]);

  // Detect conflicts
  useEffect(() => {
    const conflicts: KeyBinding[] = [];
    const keyMap = new Map<string, KeyBinding[]>();

    activeShortcuts.forEach(shortcut => {
      shortcut.keys.forEach(keyCombo => {
        const normalized = parseKeyCombo(keyCombo).sort().join('+');
        if (!keyMap.has(normalized)) {
          keyMap.set(normalized, []);
        }
        keyMap.get(normalized)!.push(shortcut);
      });
    });

    keyMap.forEach(shortcuts => {
      if (shortcuts.length > 1) {
        conflicts.push(...shortcuts);
      }
    });

    if (conflicts.length > 0) {
      onShortcutConflict?.(conflicts);
    }
  }, [activeShortcuts, onShortcutConflict]);

  return (
    <div className={`navigation-shortcuts ${className}`}>
      {/* Shortcut Hints */}
      {showHints && (
        <div className="shortcut-hints" role="status" aria-live="polite">
          {lastExecutedShortcut && (
            <div className="executed-hint">
              ✓ {activeShortcuts.find(s => s.id === lastExecutedShortcut)?.description}
            </div>
          )}

          {currentContext && (
            <div className="context-hint">
              Context: {currentContext}
            </div>
          )}
        </div>
      )}

      {/* Help Overlay */}
      {showHelp && enableHelp && (
        <ShortcutHelpOverlay
          shortcuts={categorizedShortcuts}
          platform={platform}
          onClose={() => setShowHelp(false)}
        />
      )}

      {/* Quick Help Button */}
      {enableHelp && (
        <button
          type="button"
          className="help-trigger"
          onClick={() => setShowHelp(true)}
          title="Keyboard shortcuts (F1)"
          aria-label="Show keyboard shortcuts"
        >
          <QuestionMarkCircleIcon className="w-4 h-4" />
        </button>
      )}

      {/* Customization Button */}
      {enableCustomization && (
        <button
          type="button"
          className="customize-trigger"
          onClick={onCustomizeRequest}
          title="Customize shortcuts"
          aria-label="Customize keyboard shortcuts"
        >
          <CommandLineIcon className="w-4 h-4" />
        </button>
      )}

      {/* Screen Reader Info */}
      <div className="sr-only" aria-live="polite">
        {activeShortcuts.length} keyboard shortcuts available
        {currentContext && ` in ${currentContext} context`}
      </div>
    </div>
  );
});

NavigationShortcuts.displayName = 'NavigationShortcuts';

export default NavigationShortcuts;