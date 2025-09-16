/**
 * ARIA Pattern Templates
 *
 * This module provides reusable ARIA pattern implementations that can be
 * composed into components to ensure consistent accessibility across the app.
 */

import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import { AriaUtils, LiveRegionManager } from '../../utils/accessibility';

// ============================================================================
// ARIA CONTEXT PROVIDERS
// ============================================================================

interface AriaContextValue {
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void;
  generateId: (prefix?: string) => string;
  registerLiveRegion: (id: string, priority: 'polite' | 'assertive') => void;
}

const AriaContext = createContext<AriaContextValue | null>(null);

export const AriaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const liveRegionManager = LiveRegionManager.getInstance();

  const value: AriaContextValue = {
    announceMessage: (message, priority = 'polite') => {
      liveRegionManager.announce(message, priority);
    },
    generateId: (prefix = 'element') => AriaUtils.generateId(prefix),
    registerLiveRegion: (id, priority) => {
      // Implementation for registering custom live regions if needed
    },
  };

  return <AriaContext.Provider value={value}>{children}</AriaContext.Provider>;
};

export const useAria = () => {
  const context = useContext(AriaContext);
  if (!context) {
    throw new Error('useAria must be used within an AriaProvider');
  }
  return context;
};

// ============================================================================
// DISCLOSURE PATTERN (Accordion, Collapsible)
// ============================================================================

interface DisclosureProps {
  children: (props: {
    isExpanded: boolean;
    toggle: () => void;
    triggerProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      'aria-expanded': boolean;
      'aria-controls': string;
    };
    contentProps: React.HTMLAttributes<HTMLDivElement> & {
      id: string;
      'aria-labelledby': string;
    };
  }) => React.ReactNode;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  id?: string;
}

export const Disclosure: React.FC<DisclosureProps> = ({
  children,
  defaultExpanded = false,
  onToggle,
  id: providedId,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { generateId, announceMessage } = useAria();

  const id = providedId || generateId('disclosure');
  const triggerId = `${id}-trigger`;
  const contentId = `${id}-content`;

  const toggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);

    // Announce state change
    announceMessage(
      newExpanded ? 'Section expanded' : 'Section collapsed',
      'polite'
    );
  };

  const triggerProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    'aria-expanded': boolean;
    'aria-controls': string;
  } = {
    type: 'button',
    'aria-expanded': isExpanded,
    'aria-controls': contentId,
    id: triggerId,
    onClick: toggle,
  };

  const contentProps: React.HTMLAttributes<HTMLDivElement> & {
    id: string;
    'aria-labelledby': string;
  } = {
    id: contentId,
    'aria-labelledby': triggerId,
    hidden: !isExpanded,
  };

  return (
    <>
      {children({
        isExpanded,
        toggle,
        triggerProps,
        contentProps,
      })}
    </>
  );
};

// ============================================================================
// COMBOBOX PATTERN (Autocomplete, Select)
// ============================================================================

interface ComboboxProps<T> {
  children: (props: {
    inputProps: React.InputHTMLAttributes<HTMLInputElement> & {
      'aria-expanded': boolean;
      'aria-haspopup': 'listbox';
      'aria-controls': string;
      'aria-activedescendant'?: string;
    };
    listboxProps: React.HTMLAttributes<HTMLUListElement> & {
      id: string;
      role: 'listbox';
      'aria-labelledby': string;
    };
    optionProps: (option: T, index: number) => React.HTMLAttributes<HTMLLIElement> & {
      id: string;
      role: 'option';
      'aria-selected': boolean;
    };
    isExpanded: boolean;
    activeIndex: number;
  }) => React.ReactNode;
  options: T[];
  onSelect?: (option: T) => void;
  getOptionLabel: (option: T) => string;
  getOptionValue: (option: T) => string;
  label?: string;
  id?: string;
}

export function Combobox<T>({
  children,
  options,
  onSelect,
  getOptionLabel,
  getOptionValue,
  label,
  id: providedId,
}: ComboboxProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [inputValue, setInputValue] = useState('');
  const { generateId, announceMessage } = useAria();

  const id = providedId || generateId('combobox');
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const labelId = label ? `${id}-label` : undefined;

  const filteredOptions = options.filter(option =>
    getOptionLabel(option).toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setIsExpanded(true);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isExpanded) {
          setIsExpanded(true);
        }
        setActiveIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        if (activeIndex >= 0 && filteredOptions[activeIndex]) {
          event.preventDefault();
          onSelect?.(filteredOptions[activeIndex]);
          setInputValue(getOptionLabel(filteredOptions[activeIndex]));
          setIsExpanded(false);
          setActiveIndex(-1);
        }
        break;
      case 'Escape':
        setIsExpanded(false);
        setActiveIndex(-1);
        break;
    }
  };

  const inputProps: React.InputHTMLAttributes<HTMLInputElement> & {
    'aria-expanded': boolean;
    'aria-haspopup': 'listbox';
    'aria-controls': string;
    'aria-activedescendant'?: string;
  } = {
    id: inputId,
    value: inputValue,
    onChange: handleInputChange,
    onKeyDown: handleKeyDown,
    'aria-expanded': isExpanded,
    'aria-haspopup': 'listbox',
    'aria-controls': listboxId,
    'aria-activedescendant': activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined,
    'aria-labelledby': labelId,
    autoComplete: 'off',
  };

  const listboxProps: React.HTMLAttributes<HTMLUListElement> & {
    id: string;
    role: 'listbox';
    'aria-labelledby': string;
  } = {
    id: listboxId,
    role: 'listbox',
    'aria-labelledby': labelId || inputId,
    hidden: !isExpanded,
  };

  const optionProps = (option: T, index: number): React.HTMLAttributes<HTMLLIElement> & {
    id: string;
    role: 'option';
    'aria-selected': boolean;
  } => ({
    id: `${id}-option-${index}`,
    role: 'option',
    'aria-selected': index === activeIndex,
    onClick: () => {
      onSelect?.(option);
      setInputValue(getOptionLabel(option));
      setIsExpanded(false);
      setActiveIndex(-1);
    },
  });

  return (
    <>
      {label && (
        <label id={labelId} htmlFor={inputId}>
          {label}
        </label>
      )}
      {children({
        inputProps,
        listboxProps,
        optionProps,
        isExpanded,
        activeIndex,
      })}
    </>
  );
}

// ============================================================================
// TABS PATTERN
// ============================================================================

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  orientation: 'horizontal' | 'vertical';
  generateTabId: (value: string) => string;
  generatePanelId: (value: string) => string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  id?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  children,
  defaultValue,
  value,
  onValueChange,
  orientation = 'horizontal',
  id: providedId,
}) => {
  const [activeTab, setActiveTabState] = useState(value || defaultValue || '');
  const { generateId, announceMessage } = useAria();

  const id = providedId || generateId('tabs');

  const setActiveTab = (tab: string) => {
    if (value === undefined) {
      setActiveTabState(tab);
    }
    onValueChange?.(tab);
    announceMessage(`${tab} tab selected`, 'polite');
  };

  const currentActiveTab = value !== undefined ? value : activeTab;

  const contextValue: TabsContextValue = {
    activeTab: currentActiveTab,
    setActiveTab,
    orientation,
    generateTabId: (tabValue: string) => `${id}-tab-${tabValue}`,
    generatePanelId: (tabValue: string) => `${id}-panel-${tabValue}`,
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div data-orientation={orientation}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs component');
  }
  return context;
};

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  'aria-label'?: string;
}

export const TabsList: React.FC<TabsListProps> = ({
  children,
  'aria-label': ariaLabel = 'Tabs',
  ...props
}) => {
  const { orientation } = useTabsContext();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      {...props}
    >
      {children}
    </div>
  );
};

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  children,
  value,
  ...props
}) => {
  const { activeTab, setActiveTab, generateTabId, generatePanelId } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={generatePanelId(value)}
      id={generateTabId(value)}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActiveTab(value)}
      {...props}
    >
      {children}
    </button>
  );
};

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  children,
  value,
  ...props
}) => {
  const { activeTab, generateTabId, generatePanelId } = useTabsContext();
  const isActive = activeTab === value;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      aria-labelledby={generateTabId(value)}
      id={generatePanelId(value)}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
};

// ============================================================================
// MENU PATTERN
// ============================================================================

interface MenuProps {
  children: (props: {
    triggerProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      'aria-expanded': boolean;
      'aria-haspopup': 'menu';
      'aria-controls': string;
    };
    menuProps: React.HTMLAttributes<HTMLDivElement> & {
      role: 'menu';
      id: string;
      'aria-labelledby': string;
    };
    itemProps: (index: number) => React.HTMLAttributes<HTMLButtonElement> & {
      role: 'menuitem';
      tabIndex: number;
    };
    isOpen: boolean;
    activeIndex: number;
  }) => React.ReactNode;
  trigger: React.ReactNode;
  items: Array<{ label: string; onClick: () => void; disabled?: boolean }>;
  id?: string;
}

export const Menu: React.FC<MenuProps> = ({
  children,
  trigger,
  items,
  id: providedId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { generateId } = useAria();

  const id = providedId || generateId('menu');
  const triggerId = `${id}-trigger`;
  const menuId = `${id}-menu`;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(prev => {
          const nextIndex = prev < items.length - 1 ? prev + 1 : 0;
          return items[nextIndex].disabled ? (nextIndex + 1) % items.length : nextIndex;
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(prev => {
          const prevIndex = prev > 0 ? prev - 1 : items.length - 1;
          return items[prevIndex].disabled ? (prevIndex - 1 + items.length) % items.length : prevIndex;
        });
        break;
      case 'Enter':
      case ' ':
        if (activeIndex >= 0) {
          event.preventDefault();
          items[activeIndex].onClick();
          setIsOpen(false);
          setActiveIndex(-1);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const triggerProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
    'aria-controls': string;
  } = {
    id: triggerId,
    type: 'button',
    'aria-expanded': isOpen,
    'aria-haspopup': 'menu',
    'aria-controls': menuId,
    onClick: () => setIsOpen(!isOpen),
  };

  const menuProps: React.HTMLAttributes<HTMLDivElement> & {
    role: 'menu';
    id: string;
    'aria-labelledby': string;
  } = {
    role: 'menu',
    id: menuId,
    'aria-labelledby': triggerId,
    onKeyDown: handleKeyDown,
    hidden: !isOpen,
  };

  const itemProps = (index: number): React.HTMLAttributes<HTMLButtonElement> & {
    role: 'menuitem';
    tabIndex: number;
  } => ({
    role: 'menuitem',
    tabIndex: index === activeIndex ? 0 : -1,
    disabled: items[index].disabled,
    onClick: items[index].onClick,
  });

  return (
    <>
      {children({
        triggerProps,
        menuProps,
        itemProps,
        isOpen,
        activeIndex,
      })}
    </>
  );
};

// ============================================================================
// MODAL PATTERN
// ============================================================================

interface ModalProps {
  children: (props: {
    modalProps: React.HTMLAttributes<HTMLDivElement> & {
      role: 'dialog';
      'aria-modal': 'true';
      'aria-labelledby'?: string;
      'aria-describedby'?: string;
    };
    overlayProps: React.HTMLAttributes<HTMLDivElement>;
    titleId: string;
    descriptionId: string;
  }) => React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  id?: string;
}

export const Modal: React.FC<ModalProps> = ({
  children,
  isOpen,
  onClose,
  id: providedId,
}) => {
  const { generateId } = useAria();
  const modalRef = useRef<HTMLDivElement>(null);

  const id = providedId || generateId('modal');
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  // Focus trap and restoration
  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement;

    // Focus the modal
    if (modalRef.current) {
      const firstFocusable = modalRef.current.querySelector<HTMLElement>(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalProps: React.HTMLAttributes<HTMLDivElement> & {
    role: 'dialog';
    'aria-modal': 'true';
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
  } = {
    ref: modalRef,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
    'aria-describedby': descriptionId,
  };

  const overlayProps: React.HTMLAttributes<HTMLDivElement> = {
    onClick: (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
  };

  return (
    <>
      {children({
        modalProps,
        overlayProps,
        titleId,
        descriptionId,
      })}
    </>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
  AriaProvider,
  useAria,
  Disclosure,
  Combobox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Menu,
  Modal,
};