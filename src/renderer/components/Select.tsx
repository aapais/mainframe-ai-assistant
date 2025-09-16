import React, {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, focusRing, transition } from '../utils/className';
import { focusManager } from '../utils/focusManager';
import { Button } from './ui/Button';

// Select variant definitions
const selectVariants = cva(
  [
    'relative w-full rounded-md border text-sm',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors duration-200'
  ],
  {
    variants: {
      variant: {
        default: 'border-input bg-background hover:bg-accent/5',
        outline: 'border-input bg-background hover:border-primary/30',
        filled: 'border-transparent bg-muted hover:bg-muted/80'
      },
      size: {
        sm: 'h-8 px-3 py-1 text-xs',
        default: 'h-10 px-3 py-2 text-sm',
        lg: 'h-12 px-4 py-3 text-base'
      },
      state: {
        default: '',
        error: 'border-destructive focus:ring-destructive',
        success: 'border-success focus:ring-success',
        warning: 'border-warning focus:ring-warning'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      state: 'default'
    }
  }
);

const optionVariants = cva(
  [
    'w-full px-3 py-2 text-left text-sm cursor-pointer',
    'focus:outline-none focus:bg-accent focus:text-accent-foreground',
    'hover:bg-accent hover:text-accent-foreground',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors duration-150'
  ],
  {
    variants: {
      selected: {
        true: 'bg-primary/10 text-primary font-medium',
        false: 'text-foreground'
      },
      highlighted: {
        true: 'bg-accent text-accent-foreground',
        false: ''
      }
    }
  }
);

// TypeScript interfaces
export interface SelectOption<T = any> {
  label: string;
  value: T;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
  group?: string;
}

export interface SelectOptionGroup<T = any> {
  label: string;
  options: SelectOption<T>[];
}

export interface SelectProps<T = any>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'onSelect'>,
    VariantProps<typeof selectVariants> {
  // Core functionality
  options?: SelectOption<T>[];
  optionGroups?: SelectOptionGroup<T>[];
  value?: T | T[];
  defaultValue?: T | T[];
  onChange?: (value: T | T[] | undefined) => void;
  onSelect?: (option: SelectOption<T>) => void;

  // Multi-select
  multiple?: boolean;
  maxSelections?: number;

  // Search/filter
  searchable?: boolean;
  searchPlaceholder?: string;
  filterFunction?: (option: SelectOption<T>, searchTerm: string) => boolean;

  // Customization
  placeholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;

  // States
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;

  // Custom rendering
  renderOption?: (option: SelectOption<T>, state: { selected: boolean; highlighted: boolean }) => React.ReactNode;
  renderValue?: (value: T | T[], options: SelectOption<T>[]) => React.ReactNode;
  renderSearchInput?: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.ReactNode;

  // Accessibility
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-invalid'?: boolean;

  // Layout
  dropdownPosition?: 'auto' | 'top' | 'bottom';
  dropdownClassName?: string;
  maxDropdownHeight?: number;

  // Form integration
  name?: string;
  form?: string;

  // Callbacks
  onOpen?: () => void;
  onClose?: () => void;
  onSearch?: (searchTerm: string) => void;
  onClear?: () => void;
}

export interface SelectRef<T = any> {
  focus: () => void;
  blur: () => void;
  open: () => void;
  close: () => void;
  clear: () => void;
  getSelectedOptions: () => SelectOption<T>[];
  getValue: () => T | T[] | undefined;
}

// Custom hooks for Select functionality
function useSelectState<T>(
  options: SelectOption<T>[],
  value?: T | T[],
  defaultValue?: T | T[],
  multiple?: boolean
) {
  const [internalValue, setInternalValue] = useState<T | T[] | undefined>(
    value ?? defaultValue
  );

  const currentValue = value !== undefined ? value : internalValue;

  const selectedOptions = useMemo(() => {
    if (currentValue === undefined) return [];

    const values = Array.isArray(currentValue) ? currentValue : [currentValue];
    return options.filter(option => values.includes(option.value));
  }, [options, currentValue]);

  const setValue = useCallback((newValue: T | T[] | undefined) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
  }, [value]);

  return {
    value: currentValue,
    setValue,
    selectedOptions
  };
}

function useSelectKeyboard<T>(
  isOpen: boolean,
  filteredOptions: SelectOption<T>[],
  onSelect: (option: SelectOption<T>) => void,
  onToggle: () => void,
  onClose: () => void
) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOptions]);

  // Clear search term when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { key, altKey } = event;

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          onToggle();
        } else {
          const nextIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
          setHighlightedIndex(nextIndex);
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (isOpen && altKey) {
          onClose();
        } else if (isOpen) {
          const prevIndex = Math.max(highlightedIndex - 1, 0);
          setHighlightedIndex(prevIndex);
        }
        break;

      case 'Home':
        if (isOpen) {
          event.preventDefault();
          setHighlightedIndex(0);
        }
        break;

      case 'End':
        if (isOpen) {
          event.preventDefault();
          setHighlightedIndex(filteredOptions.length - 1);
        }
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          onToggle();
        } else if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          const option = filteredOptions[highlightedIndex];
          if (!option.disabled) {
            onSelect(option);
          }
        }
        break;

      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          onClose();
        }
        break;

      case 'Tab':
        if (isOpen) {
          onClose();
        }
        break;

      default:
        // Type-ahead search
        if (isOpen && key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          event.preventDefault();

          const newSearchTerm = searchTerm + key.toLowerCase();
          setSearchTerm(newSearchTerm);

          // Find matching option
          const matchIndex = filteredOptions.findIndex(option =>
            option.label.toLowerCase().startsWith(newSearchTerm) && !option.disabled
          );

          if (matchIndex >= 0) {
            setHighlightedIndex(matchIndex);
          }

          // Clear search term after delay
          if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
          }

          searchTimeoutRef.current = setTimeout(() => {
            setSearchTerm('');
          }, 1000);
        }
        break;
    }
  }, [isOpen, highlightedIndex, filteredOptions, onToggle, onClose, onSelect, searchTerm]);

  return {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown
  };
}

// Main Select component
const Select = forwardRef<SelectRef, SelectProps>(({
  // Options
  options = [],
  optionGroups,
  value,
  defaultValue,
  onChange,
  onSelect,

  // Multi-select
  multiple = false,
  maxSelections,

  // Search
  searchable = false,
  searchPlaceholder = 'Search options...',
  filterFunction,

  // Display
  placeholder = 'Select an option...',
  emptyMessage = 'No options available',
  loadingMessage = 'Loading...',

  // States
  loading = false,
  disabled = false,
  required = false,
  readOnly = false,

  // Variants
  variant,
  size,
  state,

  // Custom rendering
  renderOption,
  renderValue,
  renderSearchInput,

  // Accessibility
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-errormessage': ariaErrorMessage,
  'aria-invalid': ariaInvalid,

  // Layout
  dropdownPosition = 'auto',
  dropdownClassName,
  maxDropdownHeight = 200,

  // Form
  name,
  form,

  // Callbacks
  onOpen,
  onClose,
  onSearch,
  onClear,

  // HTML props
  className,
  id,
  ...props
}, ref) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [announcement, setAnnouncement] = useState('');

  // Flatten options from groups
  const allOptions = useMemo(() => {
    if (optionGroups) {
      return optionGroups.flatMap(group => group.options);
    }
    return options;
  }, [options, optionGroups]);

  // Select state management
  const { value: currentValue, setValue, selectedOptions } = useSelectState(
    allOptions,
    value,
    defaultValue,
    multiple
  );

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchInput || !searchable) return allOptions;

    const searchTerm = searchInput.toLowerCase();
    return allOptions.filter(option => {
      if (filterFunction) {
        return filterFunction(option, searchTerm);
      }
      return option.label.toLowerCase().includes(searchTerm) ||
             (option.description && option.description.toLowerCase().includes(searchTerm));
    });
  }, [allOptions, searchInput, searchable, filterFunction]);

  // Keyboard navigation
  const { highlightedIndex, setHighlightedIndex, handleKeyDown } = useSelectKeyboard(
    isOpen,
    filteredOptions,
    handleOptionSelect,
    toggleDropdown,
    closeDropdown
  );

  // Dropdown positioning
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let position = dropdownPosition;
      if (position === 'auto') {
        position = spaceBelow >= maxDropdownHeight || spaceBelow >= spaceAbove ? 'bottom' : 'top';
      }

      const style: React.CSSProperties = {
        width: rect.width,
        maxHeight: maxDropdownHeight,
        position: 'absolute',
        zIndex: 50,
        left: 0
      };

      if (position === 'bottom') {
        style.top = '100%';
        style.marginTop = 4;
      } else {
        style.bottom = '100%';
        style.marginBottom = 4;
      }

      setDropdownStyle(style);
    }
  }, [isOpen, dropdownPosition, maxDropdownHeight]);

  // Functions
  function toggleDropdown() {
    if (disabled || readOnly) return;

    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function openDropdown() {
    if (disabled || readOnly) return;

    setIsOpen(true);
    onOpen?.();

    // Focus search input if searchable
    if (searchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }

    // Announce to screen readers
    const count = filteredOptions.length;
    setAnnouncement(`${count} option${count !== 1 ? 's' : ''} available`);
  }

  function closeDropdown() {
    setIsOpen(false);
    setSearchInput('');
    setHighlightedIndex(-1);
    onClose?.();

    // Return focus to trigger
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  }

  function handleOptionSelect(option: SelectOption) {
    if (option.disabled) return;

    let newValue: typeof currentValue;

    if (multiple) {
      const currentValues = Array.isArray(currentValue) ? currentValue : [];
      const isSelected = currentValues.includes(option.value);

      if (isSelected) {
        newValue = currentValues.filter(v => v !== option.value);
      } else {
        if (maxSelections && currentValues.length >= maxSelections) {
          // Replace last selection if at max
          newValue = [...currentValues.slice(0, -1), option.value];
        } else {
          newValue = [...currentValues, option.value];
        }
      }
    } else {
      newValue = option.value;
      closeDropdown();
    }

    setValue(newValue);
    onChange?.(newValue);
    onSelect?.(option);

    // Announce selection to screen readers
    const action = multiple && Array.isArray(currentValue) && currentValue.includes(option.value)
      ? 'deselected' : 'selected';
    setAnnouncement(`${option.label} ${action}`);
  }

  function handleClear() {
    const newValue = multiple ? [] : undefined;
    setValue(newValue);
    onChange?.(newValue);
    onClear?.();
    setAnnouncement('Selection cleared');
  }

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const searchTerm = event.target.value;
    setSearchInput(searchTerm);
    setHighlightedIndex(-1);
    onSearch?.(searchTerm);
  }

  // Imperative API
  useImperativeHandle(ref, () => ({
    focus: () => triggerRef.current?.focus(),
    blur: () => triggerRef.current?.blur(),
    open: openDropdown,
    close: closeDropdown,
    clear: handleClear,
    getSelectedOptions: () => selectedOptions,
    getValue: () => currentValue
  }));

  // Event handlers
  const handleTriggerKeyDown = useCallback((event: React.KeyboardEvent) => {
    handleKeyDown(event);
  }, [handleKeyDown]);

  const handleDropdownKeyDown = useCallback((event: React.KeyboardEvent) => {
    handleKeyDown(event);
  }, [handleKeyDown]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Generate IDs for ARIA relationships
  const triggerIdinternal = React.useId();
  const triggerId = id || triggerIdinternal;
  const dropdownId = `${triggerId}-dropdown`;
  const searchId = `${triggerId}-search`;
  const optionIdPrefix = `${triggerId}-option`;

  // Render value display
  const renderDisplayValue = () => {
    if (renderValue) {
      return renderValue(currentValue, allOptions);
    }

    if (!selectedOptions.length) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    if (multiple) {
      if (selectedOptions.length === 1) {
        return selectedOptions[0].label;
      }
      return `${selectedOptions.length} selected`;
    }

    return selectedOptions[0]?.label;
  };

  // Render option
  const renderOptionContent = (option: SelectOption, index: number) => {
    const isSelected = selectedOptions.some(selected => selected.value === option.value);
    const isHighlighted = index === highlightedIndex;

    if (renderOption) {
      return renderOption(option, { selected: isSelected, highlighted: isHighlighted });
    }

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {option.icon}
          <div>
            <div>{option.label}</div>
            {option.description && (
              <div className="text-xs text-muted-foreground">{option.description}</div>
            )}
          </div>
        </div>
        {multiple && isSelected && (
          <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    );
  };

  // Render options list
  const renderOptions = () => {
    if (loading) {
      return (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {loadingMessage}
        </div>
      );
    }

    if (filteredOptions.length === 0) {
      return (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {searchInput ? `No options match "${searchInput}"` : emptyMessage}
        </div>
      );
    }

    if (optionGroups && !searchInput) {
      return optionGroups.map((group, groupIndex) => {
        const groupOptions = group.options.filter(option =>
          filteredOptions.includes(option)
        );

        if (groupOptions.length === 0) return null;

        return (
          <div key={group.label} className="py-1">
            <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.label}
            </div>
            {groupOptions.map((option, optionIndex) => {
              const globalIndex = filteredOptions.indexOf(option);
              return renderSingleOption(option, globalIndex, groupIndex, optionIndex);
            })}
          </div>
        );
      });
    }

    return filteredOptions.map((option, index) => renderSingleOption(option, index));
  };

  const renderSingleOption = (option: SelectOption, index: number, groupIndex?: number, optionIndex?: number) => {
    const isSelected = selectedOptions.some(selected => selected.value === option.value);
    const isHighlighted = index === highlightedIndex;

    return (
      <div
        key={`${groupIndex !== undefined ? `${groupIndex}-` : ''}${optionIndex !== undefined ? optionIndex : index}`}
        id={`${optionIdPrefix}-${index}`}
        role="option"
        aria-selected={isSelected}
        aria-disabled={option.disabled}
        className={cn(
          optionVariants({ selected: isSelected, highlighted: isHighlighted }),
          option.disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !option.disabled && handleOptionSelect(option)}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        {renderOptionContent(option, index)}
      </div>
    );
  };

  const hasSelectedValues = selectedOptions.length > 0;
  const showClearButton = hasSelectedValues && !disabled && !readOnly;

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      {...props}
    >
      {/* Hidden form input for form integration */}
      {name && (
        <input
          type="hidden"
          name={name}
          form={form}
          value={
            currentValue === undefined ? '' :
            Array.isArray(currentValue) ? currentValue.join(',') :
            String(currentValue)
          }
        />
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={dropdownId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-errormessage={ariaErrorMessage}
        aria-invalid={ariaInvalid}
        aria-required={required}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0
            ? `${optionIdPrefix}-${highlightedIndex}`
            : undefined
        }
        disabled={disabled || loading}
        className={cn(
          selectVariants({ variant, size, state }),
          'flex items-center justify-between gap-2'
        )}
        onClick={toggleDropdown}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="flex-1 text-left truncate">
          {renderDisplayValue()}
        </span>

        <div className="flex items-center gap-1">
          {loading && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}

          {showClearButton && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="h-4 w-4 p-0 hover:bg-muted"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}

          <svg
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          id={dropdownId}
          role="listbox"
          aria-label={multiple ? "Select multiple options" : "Select an option"}
          aria-multiselectable={multiple}
          style={dropdownStyle}
          className={cn(
            'border border-border bg-popover text-popover-foreground shadow-lg rounded-md overflow-hidden',
            'animate-in fade-in-0 zoom-in-95',
            dropdownClassName
          )}
          onKeyDown={handleDropdownKeyDown}
        >
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-border">
              {renderSearchInput ?
                renderSearchInput({
                  id: searchId,
                  placeholder: searchPlaceholder,
                  value: searchInput,
                  onChange: handleSearchChange,
                  ref: searchInputRef
                }) :
                <input
                  ref={searchInputRef}
                  id={searchId}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchInput}
                  onChange={handleSearchChange}
                  className="w-full px-2 py-1 text-sm bg-transparent border-none outline-none"
                  role="searchbox"
                  aria-label="Search options"
                  aria-autocomplete="list"
                  aria-controls={dropdownId}
                />
              }
            </div>
          )}

          {/* Options */}
          <div
            className="py-1 overflow-y-auto"
            style={{ maxHeight: searchable ? maxDropdownHeight - 44 : maxDropdownHeight }}
          >
            {renderOptions()}
          </div>
        </div>
      )}

      {/* Screen reader announcements */}
      <div
        ref={announceRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
});

Select.displayName = 'Select';

export { Select, selectVariants, optionVariants };
export type { SelectProps, SelectRef, SelectOption, SelectOptionGroup };