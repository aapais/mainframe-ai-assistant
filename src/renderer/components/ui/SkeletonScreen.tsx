/**
 * Skeleton Screen Component - Performance Optimized Loading States
 *
 * Features:
 * - Adaptive skeleton based on content type
 * - CSS-only animations for better performance
 * - Configurable layout patterns
 * - Progress indication
 * - Accessibility support
 */

import React, { useMemo } from 'react';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface SkeletonScreenProps {
  title?: string;
  description?: string;
  estimatedSize?: number; // KB
  type?: 'form' | 'list' | 'grid' | 'text' | 'custom';
  rows?: number;
  columns?: number;
  showProgress?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface SkeletonItemProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
  pulse?: boolean;
}

// ============================================================================
// SKELETON ITEM COMPONENT
// ============================================================================

const SkeletonItem: React.FC<SkeletonItemProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = true,
  pulse = true
}) => {
  const style = useMemo(() => ({
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  }), [width, height]);

  return (
    <div
      className={`
        skeleton-item
        ${rounded ? 'rounded' : ''}
        ${pulse ? 'skeleton-pulse' : ''}
        ${className}
      `}
      style={style}
      aria-hidden="true"
    />
  );
};

// ============================================================================
// SKELETON PATTERNS
// ============================================================================

const FormSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="skeleton-form space-y-6">
    {/* Form Header */}
    <div className="space-y-2">
      <SkeletonItem width="40%" height="1.5rem" />
      <SkeletonItem width="70%" height="1rem" />
    </div>

    {/* Form Fields */}
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="skeleton-field space-y-2">
        <SkeletonItem width="25%" height="1rem" />
        <SkeletonItem width="100%" height="2.5rem" />
        <SkeletonItem width="60%" height="0.75rem" />
      </div>
    ))}

    {/* Form Actions */}
    <div className="flex space-x-3 pt-4">
      <SkeletonItem width="120px" height="2.25rem" />
      <SkeletonItem width="100px" height="2.25rem" />
    </div>
  </div>
);

const ListSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="skeleton-list space-y-4">
    {/* List Header */}
    <div className="flex justify-between items-center">
      <SkeletonItem width="30%" height="1.25rem" />
      <SkeletonItem width="80px" height="2rem" />
    </div>

    {/* List Items */}
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="skeleton-list-item flex items-center space-x-4 p-4 border rounded-lg">
        <SkeletonItem width="40px" height="40px" rounded />
        <div className="flex-1 space-y-2">
          <SkeletonItem width="60%" height="1rem" />
          <SkeletonItem width="40%" height="0.75rem" />
        </div>
        <SkeletonItem width="80px" height="1.5rem" />
      </div>
    ))}
  </div>
);

const GridSkeleton: React.FC<{ rows: number; columns: number }> = ({ rows, columns }) => (
  <div className="skeleton-grid">
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`
      }}
    >
      {Array.from({ length: rows * columns }, (_, i) => (
        <div key={i} className="skeleton-grid-item space-y-3 p-4 border rounded-lg">
          <SkeletonItem width="100%" height="120px" />
          <SkeletonItem width="80%" height="1rem" />
          <SkeletonItem width="60%" height="0.75rem" />
        </div>
      ))}
    </div>
  </div>
);

const TextSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="skeleton-text space-y-3">
    {Array.from({ length: rows }, (_, i) => (
      <SkeletonItem
        key={i}
        width={i === rows - 1 ? '75%' : '100%'}
        height="1rem"
      />
    ))}
  </div>
);

// ============================================================================
// PROGRESS INDICATOR
// ============================================================================

const ProgressIndicator: React.FC<{ estimatedSize?: number }> = ({ estimatedSize }) => {
  const loadingText = useMemo(() => {
    if (!estimatedSize) return 'Loading...';
    if (estimatedSize < 30) return 'Loading lightweight component...';
    if (estimatedSize < 60) return 'Loading component...';
    return 'Loading advanced component...';
  }, [estimatedSize]);

  return (
    <div className="skeleton-progress flex items-center space-x-3 text-sm text-gray-500">
      <div className="skeleton-spinner">
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
      <span>{loadingText}</span>
      {estimatedSize && (
        <span className="text-xs text-gray-400">
          (~{estimatedSize}KB)
        </span>
      )}
    </div>
  );
};

// ============================================================================
// MAIN SKELETON SCREEN COMPONENT
// ============================================================================

export const SkeletonScreen: React.FC<SkeletonScreenProps> = ({
  title,
  description,
  estimatedSize,
  type = 'form',
  rows = 4,
  columns = 2,
  showProgress = true,
  className = '',
  children
}) => {
  const renderSkeleton = useMemo(() => {
    switch (type) {
      case 'form':
        return <FormSkeleton rows={rows} />;
      case 'list':
        return <ListSkeleton rows={rows} />;
      case 'grid':
        return <GridSkeleton rows={rows} columns={columns} />;
      case 'text':
        return <TextSkeleton rows={rows} />;
      case 'custom':
        return children;
      default:
        return <FormSkeleton rows={rows} />;
    }
  }, [type, rows, columns, children]);

  return (
    <div
      className={`skeleton-screen p-6 ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      {/* Header */}
      {(title || description) && (
        <div className="skeleton-header mb-6">
          {title && (
            <div className="skeleton-title mb-2">
              <SkeletonItem width="40%" height="1.75rem" />
            </div>
          )}
          {description && (
            <div className="skeleton-description">
              <SkeletonItem width="70%" height="1rem" />
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="skeleton-content">
        {renderSkeleton}
      </div>

      {/* Progress */}
      {showProgress && (
        <div className="skeleton-footer mt-6 pt-4 border-t border-gray-200">
          <ProgressIndicator estimatedSize={estimatedSize} />
        </div>
      )}

      <style jsx>{`
        .skeleton-item {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
        }

        .skeleton-pulse {
          animation: skeleton-loading 1.5s ease-in-out infinite;
        }

        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .spinner-border {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          vertical-align: text-bottom;
          border: 0.125em solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: spinner-border 0.75s linear infinite;
        }

        @keyframes spinner-border {
          to {
            transform: rotate(360deg);
          }
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .skeleton-item {
            background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .skeleton-pulse,
          .spinner-border {
            animation: none;
          }

          .skeleton-item {
            background: #f0f0f0;
          }

          @media (prefers-color-scheme: dark) {
            .skeleton-item {
              background: #2a2a2a;
            }
          }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// SKELETON VARIANTS
// ============================================================================

export const SettingsFormSkeleton: React.FC = () => (
  <SkeletonScreen
    title="Settings Panel"
    description="Loading configuration options..."
    type="form"
    rows={6}
    estimatedSize={45}
  />
);

export const SettingsListSkeleton: React.FC = () => (
  <SkeletonScreen
    title="Settings List"
    description="Loading settings items..."
    type="list"
    rows={5}
    estimatedSize={30}
  />
);

export const SettingsGridSkeleton: React.FC = () => (
  <SkeletonScreen
    title="Settings Grid"
    description="Loading configuration grid..."
    type="grid"
    rows={2}
    columns={3}
    estimatedSize={55}
  />
);

// ============================================================================
// SKELETON BUILDER UTILITY
// ============================================================================

export class SkeletonBuilder {
  private props: SkeletonScreenProps = {};

  static create(): SkeletonBuilder {
    return new SkeletonBuilder();
  }

  title(title: string): SkeletonBuilder {
    this.props.title = title;
    return this;
  }

  description(description: string): SkeletonBuilder {
    this.props.description = description;
    return this;
  }

  type(type: SkeletonScreenProps['type']): SkeletonBuilder {
    this.props.type = type;
    return this;
  }

  rows(rows: number): SkeletonBuilder {
    this.props.rows = rows;
    return this;
  }

  columns(columns: number): SkeletonBuilder {
    this.props.columns = columns;
    return this;
  }

  estimatedSize(size: number): SkeletonBuilder {
    this.props.estimatedSize = size;
    return this;
  }

  showProgress(show: boolean = true): SkeletonBuilder {
    this.props.showProgress = show;
    return this;
  }

  className(className: string): SkeletonBuilder {
    this.props.className = className;
    return this;
  }

  build(): React.FC {
    const props = { ...this.props };
    return () => <SkeletonScreen {...props} />;
  }
}

export default SkeletonScreen;