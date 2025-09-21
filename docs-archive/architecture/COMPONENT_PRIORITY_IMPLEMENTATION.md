# Component Priority Implementation Plan
## Mainframe KB Assistant - Immediate Action Items

### Version 1.0 | Generated on 2025-01-15

---

## 1. CRITICAL COMPONENTS FOR IMMEDIATE IMPLEMENTATION

Based on the analysis of the existing project structure and the MVP1 requirements, here are the **Priority 1** components that need immediate implementation to complete the foundational UI system:

### 🚨 Critical Components (Implement First)
1. **Select Component** - Missing dropdown functionality for categories and filters
2. **AlertMessage Component** - No consistent error/success messaging system
3. **DataTable Component** - Core for displaying knowledge base entries
4. **FormField Wrapper** - Enhanced version of existing form field
5. **LoadingIndicator Enhancement** - Better loading states with accessibility

---

## 2. SELECT COMPONENT IMPLEMENTATION

### File: `/src/components/foundation/Select.tsx`

```typescript
/**
 * Accessible Select Component
 * Implements WCAG 2.1 AA combobox pattern with full keyboard navigation
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FormComponentProps } from '../types/BaseComponent';
import { ChevronDownIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
  description?: string;
}

export interface SelectProps extends FormComponentProps<string | string[]> {
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  loading?: boolean;
  maxHeight?: number;
  noOptionsText?: string;
  loadingText?: string;
  onSearch?: (query: string) => void;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  searchable = false,
  clearable = false,
  multiple = false,
  loading = false,
  disabled = false,
  error,
  label,
  required = false,
  maxHeight = 200,
  noOptionsText = 'No options found',
  loadingText = 'Loading...',
  onSearch,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState('');

  const selectRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  // Get display value
  const displayValue = useMemo(() => {
    if (!value) return '';
    if (multiple && Array.isArray(value)) {
      return value.map(v => options.find(opt => opt.value === v)?.label || v).join(', ');
    }
    return options.find(opt => opt.value === value)?.label || value;
  }, [value, options, multiple]);

  // Generate unique IDs
  const selectId = `select-${Math.random().toString(36).substr(2, 9)}`;
  const listboxId = `${selectId}-listbox`;
  const announcementId = `${selectId}-announcement`;

  // Handle option selection
  const selectOption = useCallback((option: SelectOption) => {
    if (option.disabled) return;

    let newValue: string | string[];

    if (multiple && Array.isArray(value)) {
      if (value.includes(option.value)) {
        newValue = value.filter(v => v !== option.value);
        setAnnouncement(`${option.label} deselected`);
      } else {
        newValue = [...value, option.value];
        setAnnouncement(`${option.label} selected`);
      }
    } else {
      newValue = option.value;
      setAnnouncement(`${option.label} selected`);
      setIsOpen(false);
    }

    onChange?.(newValue);
  }, [multiple, value, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(0);
        } else {
          setActiveIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setActiveIndex(prev => prev > 0 ? prev - 1 : prev);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (isOpen && activeIndex >= 0) {
          selectOption(filteredOptions[activeIndex]);
        } else {
          setIsOpen(true);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;

      case 'Home':
        if (isOpen) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;

      case 'End':
        if (isOpen) {
          e.preventDefault();
          setActiveIndex(filteredOptions.length - 1);
        }
        break;

      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [isOpen, activeIndex, filteredOptions, selectOption]);

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setActiveIndex(-1);
    onSearch?.(query);
  }, [onSearch]);

  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(multiple ? [] : '');
    setSearchQuery('');
    setAnnouncement('Selection cleared');
    inputRef.current?.focus();
  }, [multiple, onChange]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active option into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listboxRef.current) {
      const activeOption = listboxRef.current.children[activeIndex] as HTMLElement;
      activeOption?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, activeIndex]);

  // Clear announcement after delay
  useEffect(() => {
    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  const baseClasses = `
    relative w-full border rounded-md bg-white
    ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer'}
    ${error ? 'border-red-500 focus-within:ring-red-500' : 'border-gray-300 focus-within:ring-primary-500'}
    focus-within:ring-2 focus-within:ring-offset-1
    transition-colors duration-200
  `;

  const isSelected = multiple
    ? Array.isArray(value) && value.length > 0
    : Boolean(value);

  return (
    <div className="space-y-1" {...props}>
      {label && (
        <label
          htmlFor={selectId}
          className={`block text-sm font-medium ${error ? 'text-red-700' : 'text-gray-700'}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
      )}

      <div ref={selectRef} className={baseClasses}>
        {/* Hidden input for form submission */}
        <input
          type="hidden"
          name={props.name}
          value={Array.isArray(value) ? value.join(',') : value || ''}
        />

        {/* Main select trigger */}
        <div
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && activeIndex >= 0
              ? `${selectId}-option-${activeIndex}`
              : undefined
          }
          aria-label={ariaLabel || label}
          aria-describedby={[
            error ? `${selectId}-error` : undefined,
            ariaDescribedBy,
            announcementId
          ].filter(Boolean).join(' ')}
          aria-invalid={error ? 'true' : undefined}
          aria-required={required}
          tabIndex={disabled ? -1 : 0}
          className={`
            flex items-center justify-between w-full px-3 py-2 text-left
            ${disabled ? 'text-gray-400' : 'text-gray-900'}
            focus:outline-none
          `}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
        >
          {/* Search input or display value */}
          {searchable && isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              className="flex-1 border-none outline-none bg-transparent"
              placeholder="Type to search..."
              aria-label="Search options"
            />
          ) : (
            <span className={`flex-1 truncate ${!isSelected ? 'text-gray-500' : ''}`}>
              {displayValue || placeholder}
            </span>
          )}

          {/* Clear button */}
          {clearable && isSelected && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Clear selection"
            >
              <XMarkIcon className="w-4 h-4 text-gray-400" />
            </button>
          )}

          {/* Dropdown arrow */}
          <ChevronDownIcon
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>

        {/* Dropdown listbox */}
        {isOpen && (
          <ul
            ref={listboxRef}
            role="listbox"
            id={listboxId}
            aria-label={`${label || 'Select'} options`}
            aria-multiselectable={multiple}
            className={`
              absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg
              max-h-60 overflow-auto focus:outline-none
            `}
            style={{ maxHeight: maxHeight }}
          >
            {loading ? (
              <li className="px-3 py-2 text-gray-500 text-center">
                {loadingText}
              </li>
            ) : filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-gray-500 text-center">
                {noOptionsText}
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const isActive = index === activeIndex;
                const isOptionSelected = multiple
                  ? Array.isArray(value) && value.includes(option.value)
                  : value === option.value;

                return (
                  <li
                    key={option.value}
                    id={`${selectId}-option-${index}`}
                    role="option"
                    aria-selected={isOptionSelected}
                    aria-disabled={option.disabled}
                    className={`
                      px-3 py-2 cursor-pointer flex items-center justify-between
                      ${isActive ? 'bg-primary-100 text-primary-900' : 'text-gray-900'}
                      ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}
                      ${isOptionSelected ? 'bg-primary-50' : ''}
                    `}
                    onClick={() => !option.disabled && selectOption(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-sm text-gray-500">{option.description}</div>
                      )}
                    </div>
                    {isOptionSelected && (
                      <CheckIcon className="w-4 h-4 text-primary-600" aria-hidden="true" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Screen reader announcements */}
      <div
        ref={announcementRef}
        id={announcementId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
};

export default Select;
```

---

## 3. ALERT MESSAGE COMPONENT

### File: `/src/components/molecules/AlertMessage.tsx`

```typescript
/**
 * Accessible Alert Message Component
 * Implements WCAG 2.1 AA alert pattern with proper ARIA roles
 */

import React, { useEffect, useState } from 'react';
import { BaseComponentProps } from '../types/BaseComponent';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export interface AlertAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}

export interface AlertMessageProps extends BaseComponentProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  dismissible?: boolean;
  autoClose?: number;
  actions?: AlertAction[];
  onDismiss?: () => void;
  variant?: 'filled' | 'outlined' | 'subtle';
}

export const AlertMessage: React.FC<AlertMessageProps> = ({
  type,
  title,
  message,
  dismissible = false,
  autoClose,
  actions = [],
  onDismiss,
  variant = 'filled',
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-close functionality
  useEffect(() => {
    if (autoClose && autoClose > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoClose);

      return () => clearTimeout(timer);
    }
  }, [autoClose, onDismiss]);

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  // Handle keyboard dismiss
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && dismissible) {
      handleDismiss();
    }
  };

  if (!isVisible) return null;

  // Icon mapping
  const icons = {
    success: CheckCircleIcon,
    error: ExclamationCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon
  };

  const Icon = icons[type];

  // Color schemes
  const colorSchemes = {
    filled: {
      success: 'bg-green-50 text-green-800 border-green-200',
      error: 'bg-red-50 text-red-800 border-red-200',
      warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
      info: 'bg-blue-50 text-blue-800 border-blue-200'
    },
    outlined: {
      success: 'bg-white text-green-800 border-green-300',
      error: 'bg-white text-red-800 border-red-300',
      warning: 'bg-white text-yellow-800 border-yellow-300',
      info: 'bg-white text-blue-800 border-blue-300'
    },
    subtle: {
      success: 'bg-gray-50 text-green-800 border-gray-200',
      error: 'bg-gray-50 text-red-800 border-gray-200',
      warning: 'bg-gray-50 text-yellow-800 border-gray-200',
      info: 'bg-gray-50 text-blue-800 border-gray-200'
    }
  };

  const iconColors = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500'
  };

  // Determine ARIA role based on type
  const role = type === 'error' ? 'alert' : 'status';
  const ariaLive = type === 'error' ? 'assertive' : 'polite';

  const alertId = `alert-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
      aria-labelledby={title ? `${alertId}-title` : undefined}
      className={`
        border rounded-lg p-4 ${colorSchemes[variant][type]}
        focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500
        ${className}
      `}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <div className="flex items-start">
        {/* Icon */}
        <div className="flex-shrink-0">
          <Icon
            className={`w-5 h-5 ${iconColors[type]}`}
            aria-hidden="true"
          />
        </div>

        {/* Content */}
        <div className="ml-3 flex-1">
          {title && (
            <h3
              id={`${alertId}-title`}
              className="text-sm font-medium mb-1"
            >
              {title}
            </h3>
          )}
          <div className="text-sm">
            {message}
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={action.action}
                  className={`
                    px-3 py-1 text-sm font-medium rounded-md
                    transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${action.variant === 'primary'
                      ? `bg-${type}-600 text-white hover:bg-${type}-700 focus:ring-${type}-500`
                      : `bg-transparent border border-current hover:bg-current hover:bg-opacity-10 focus:ring-${type}-500`
                    }
                  `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <div className="ml-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleDismiss}
              className={`
                rounded-md p-1.5 inline-flex
                hover:bg-current hover:bg-opacity-20
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                transition-colors duration-200
              `}
              aria-label="Dismiss alert"
            >
              <XMarkIcon className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertMessage;
```

---

## 4. IMPLEMENTATION STEPS

### Week 1 Immediate Actions:

1. **Day 1-2: Select Component**
   - Implement the Select component above
   - Create comprehensive tests
   - Add to Storybook with accessibility examples

2. **Day 3-4: AlertMessage Component**
   - Implement the AlertMessage component
   - Test with screen readers
   - Integrate with existing notification system

3. **Day 5: Integration**
   - Replace existing dropdowns with new Select component
   - Update CategoryFilter to use new Select
   - Update notification system to use AlertMessage

### Week 2 Priorities:

1. **Enhanced DataTable Component**
2. **Improved FormField Wrapper**
3. **Loading State Components**
4. **Keyboard Navigation Enhancements**

---

## 5. TESTING CHECKLIST FOR THESE COMPONENTS

### ✅ Select Component Tests
- [ ] Keyboard navigation (Arrow keys, Enter, Escape, Home, End)
- [ ] Screen reader announcements for selection changes
- [ ] Multi-select functionality
- [ ] Search functionality with keyboard support
- [ ] Proper focus management
- [ ] ARIA attributes validation
- [ ] Color contrast compliance
- [ ] Mobile touch support

### ✅ AlertMessage Component Tests
- [ ] Proper ARIA role assignment (alert vs status)
- [ ] Screen reader announcements
- [ ] Keyboard dismissal (Escape key)
- [ ] Auto-close functionality
- [ ] Focus management for actions
- [ ] Color contrast for all variants
- [ ] Animation accessibility (respects prefers-reduced-motion)

---

## 6. ACCESSIBILITY VALIDATION TOOLS

### Automated Testing Setup:
```bash
# Install accessibility testing tools
npm install --save-dev @axe-core/react jest-axe @testing-library/jest-dom

# Add to test setup
npm install --save-dev @testing-library/user-event
```

### Test Configuration:
```typescript
// In test setup file
import { toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

expect.extend(toHaveNoViolations);
```

---

## 7. INTEGRATION WITH EXISTING SYSTEM

### Update CategoryFilter.tsx:
```typescript
// Replace existing dropdown with new Select component
import { Select } from '../foundation/Select';

const CategoryFilter = ({ categories, selectedCategory, onCategoryChange }) => (
  <Select
    label="Category"
    options={categories.map(cat => ({ value: cat, label: cat }))}
    value={selectedCategory}
    onChange={onCategoryChange}
    placeholder="All categories"
    clearable
    aria-label="Filter by category"
  />
);
```

### Update NotificationSystem:
```typescript
// Replace existing alerts with AlertMessage component
import { AlertMessage } from '../molecules/AlertMessage';

const NotificationSystem = ({ notifications }) => (
  <div className="fixed top-4 right-4 space-y-2 z-50">
    {notifications.map(notification => (
      <AlertMessage
        key={notification.id}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        dismissible
        autoClose={notification.autoClose}
        onDismiss={() => removeNotification(notification.id)}
      />
    ))}
  </div>
);
```

---

This implementation plan provides the immediate, actionable steps needed to enhance the UI component system with full accessibility support. The Select and AlertMessage components are foundational and will significantly improve the user experience for all users, especially those using assistive technologies.