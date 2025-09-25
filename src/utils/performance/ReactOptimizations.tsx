/**
 * React Performance Optimization Utilities
 * Optimized components with memo, useMemo, useCallback, and best practices
 */

import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';

// Optimized Button Component
export interface OptimizedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  icon?: string;
  loading?: boolean;
}

export const OptimizedButton = memo<OptimizedButtonProps>(
  ({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    disabled = false,
    className = '',
    icon,
    loading = false,
  }) => {
    // Memoize class names to prevent unnecessary recalculations
    const buttonClasses = useMemo(() => {
      const baseClasses =
        'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

      const variantClasses = {
        primary:
          'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 focus:ring-purple-500',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
        outline:
          'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
        ghost:
          'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-500',
      };

      const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm rounded-md',
        md: 'px-4 py-2 text-sm rounded-md',
        lg: 'px-6 py-3 text-base rounded-lg',
      };

      const disabledClasses = disabled || loading ? 'opacity-50 cursor-not-allowed' : '';

      return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`.trim();
    }, [variant, size, disabled, loading, className]);

    // Memoize click handler to prevent unnecessary re-renders
    const handleClick = useCallback(() => {
      if (!disabled && !loading && onClick) {
        onClick();
      }
    }, [disabled, loading, onClick]);

    return (
      <button
        type='button'
        className={buttonClasses}
        onClick={handleClick}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
      >
        {loading && (
          <svg className='animate-spin -ml-1 mr-2 h-4 w-4' fill='none' viewBox='0 0 24 24'>
            <circle
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
              className='opacity-25'
            />
            <path
              fill='currentColor'
              className='opacity-75'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            />
          </svg>
        )}
        {icon && !loading && <span className='mr-2'>{icon}</span>}
        {children}
      </button>
    );
  }
);

OptimizedButton.displayName = 'OptimizedButton';

// Optimized Search Input with Debouncing
export interface OptimizedSearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  initialValue?: string;
}

export const OptimizedSearchInput = memo<OptimizedSearchInputProps>(
  ({
    onSearch,
    placeholder = 'Search...',
    debounceMs = 300,
    className = '',
    initialValue = '',
  }) => {
    const [query, setQuery] = useState(initialValue);
    const debounceRef = useRef<NodeJS.Timeout>();

    // Debounced search function
    const debouncedSearch = useCallback(
      (searchQuery: string) => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
          onSearch(searchQuery);
        }, debounceMs);
      },
      [onSearch, debounceMs]
    );

    // Handle input change with debouncing
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        debouncedSearch(value);
      },
      [debouncedSearch]
    );

    // Handle Enter key press for immediate search
    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          onSearch(query);
        }
      },
      [onSearch, query]
    );

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, []);

    const inputClasses = useMemo(() => {
      return `w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${className}`.trim();
    }, [className]);

    return (
      <div className='relative'>
        <input
          type='text'
          value={query}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className={inputClasses}
          aria-label='Search input'
        />
        <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
          <svg
            className='h-5 w-5 text-gray-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
            />
          </svg>
        </div>
      </div>
    );
  }
);

OptimizedSearchInput.displayName = 'OptimizedSearchInput';

// Optimized List Item Component
export interface OptimizedListItemProps {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  metadata?: Record<string, any>;
}

export const OptimizedListItem = memo<OptimizedListItemProps>(
  ({ id, title, description, category, tags = [], onEdit, onDelete, onClick, metadata }) => {
    // Memoize click handlers
    const handleEdit = useCallback(() => {
      onEdit?.(id);
    }, [onEdit, id]);

    const handleDelete = useCallback(() => {
      onDelete?.(id);
    }, [onDelete, id]);

    const handleClick = useCallback(() => {
      onClick?.(id);
    }, [onClick, id]);

    // Memoize category badge color
    const categoryColor = useMemo(() => {
      if (!category) return 'bg-gray-100 text-gray-800';

      const colors = {
        COBOL: 'bg-blue-100 text-blue-800',
        DB2: 'bg-green-100 text-green-800',
        VSAM: 'bg-yellow-100 text-yellow-800',
        JCL: 'bg-purple-100 text-purple-800',
        CICS: 'bg-red-100 text-red-800',
      };

      return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    }, [category]);

    // Memoize rendered tags
    const renderedTags = useMemo(() => {
      return tags.slice(0, 3).map((tag, index) => (
        <span key={tag} className='px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded'>
          {tag}
        </span>
      ));
    }, [tags]);

    return (
      <div
        className='bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 cursor-pointer'
        onClick={handleClick}
      >
        <div className='flex justify-between items-start mb-2'>
          {category && (
            <span className={`px-2 py-1 rounded text-xs font-semibold ${categoryColor}`}>
              {category}
            </span>
          )}
          <div className='flex space-x-2'>
            {onEdit && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleEdit();
                }}
                className='text-blue-600 hover:text-blue-800 p-1'
                title='Edit'
                aria-label={`Edit ${title}`}
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className='text-red-600 hover:text-red-800 p-1'
                title='Delete'
                aria-label={`Delete ${title}`}
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        <h3 className='font-semibold text-gray-900 mb-2 line-clamp-2'>{title}</h3>

        {description && <p className='text-gray-700 text-sm mb-3 line-clamp-3'>{description}</p>}

        {tags.length > 0 && (
          <div className='flex flex-wrap gap-1 mb-2'>
            {renderedTags}
            {tags.length > 3 && (
              <span className='px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded'>
                +{tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {metadata && (
          <div className='text-xs text-gray-500 flex justify-between items-center'>
            {metadata.usage_count && <span>{metadata.usage_count} uses</span>}
            {metadata.success_rate && (
              <span>{Math.round(metadata.success_rate * 100)}% success</span>
            )}
          </div>
        )}
      </div>
    );
  }
);

OptimizedListItem.displayName = 'OptimizedListItem';

// Optimized Grid Container
export interface OptimizedGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 6;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const OptimizedGrid = memo<OptimizedGridProps>(
  ({ children, columns = 3, gap = 'md', className = '' }) => {
    const gridClasses = useMemo(() => {
      const columnClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        6: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-6',
      };

      const gapClasses = {
        sm: 'gap-3',
        md: 'gap-6',
        lg: 'gap-8',
      };

      return `grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`.trim();
    }, [columns, gap, className]);

    return <div className={gridClasses}>{children}</div>;
  }
);

OptimizedGrid.displayName = 'OptimizedGrid';

// Event Delegation Hook
export const useEventDelegation = (
  containerRef: React.RefObject<HTMLElement>,
  eventType: string,
  selector: string,
  handler: (element: Element, event: Event) => void
) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const delegatedHandler = (event: Event) => {
      const target = event.target as Element;
      const matchedElement = target.closest(selector);

      if (matchedElement && container.contains(matchedElement)) {
        handler(matchedElement, event);
      }
    };

    container.addEventListener(eventType, delegatedHandler);

    return () => {
      container.removeEventListener(eventType, delegatedHandler);
    };
  }, [containerRef, eventType, selector, handler]);
};

// Throttle Hook
export const useThrottle = <T extends any[]>(callback: (...args: T) => void, delay: number) => {
  const throttleRef = useRef<NodeJS.Timeout>();
  const lastCallRef = useRef<number>(0);

  return useCallback(
    (...args: T) => {
      const now = Date.now();

      if (now - lastCallRef.current >= delay) {
        callback(...args);
        lastCallRef.current = now;
      } else {
        if (throttleRef.current) {
          clearTimeout(throttleRef.current);
        }

        throttleRef.current = setTimeout(
          () => {
            callback(...args);
            lastCallRef.current = Date.now();
          },
          delay - (now - lastCallRef.current)
        );
      }
    },
    [callback, delay]
  );
};
