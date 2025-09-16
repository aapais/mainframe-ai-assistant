/**
 * DetailPanel Component
 * Responsive detail view panel with rich content display and interactions
 */

import React, { useState, useMemo, useCallback, useRef, useEffect, ReactNode } from 'react';
import { BaseComponentProps } from '../types/BaseComponent';
import { smartMemo, useStableCallback } from '../performance/PerformanceOptimizer';
import { LayoutPanel } from './LayoutPanel';
import { ResponsiveGrid, GridItem } from './ResponsiveGrid';

// =========================
// TYPE DEFINITIONS
// =========================

export interface DetailItem {
  id: string | number;
  title: string;
  subtitle?: string;
  description?: string;
  content?: string | ReactNode;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  actions?: DetailAction[];
  sections?: DetailSection[];
  attachments?: DetailAttachment[];
  relatedItems?: DetailItem[];
  timestamp?: Date;
  author?: string;
  status?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  [key: string]: any;
}

export interface DetailAction {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void | Promise<void>;
}

export interface DetailSection {
  id: string;
  title: string;
  content: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  icon?: ReactNode;
}

export interface DetailAttachment {
  id: string;
  name: string;
  size?: number;
  type?: string;
  url?: string;
  thumbnail?: string;
  downloadable?: boolean;
}

export interface DetailPanelProps extends BaseComponentProps {
  /** Detail item to display */
  item?: DetailItem;

  /** Loading state */
  loading?: boolean;

  /** Error state */
  error?: string | ReactNode;

  /** Empty state message */
  emptyMessage?: ReactNode;

  /** Panel layout variant */
  layout?: 'standard' | 'compact' | 'sidebar' | 'modal';

  /** Panel width (for sidebar layout) */
  width?: string;

  /** Panel height (for modal layout) */
  height?: string;

  /** Enable panel resizing */
  resizable?: boolean;

  /** Panel position */
  position?: 'left' | 'right' | 'top' | 'bottom';

  /** Show header */
  showHeader?: boolean;

  /** Show actions in header */
  showHeaderActions?: boolean;

  /** Show metadata section */
  showMetadata?: boolean;

  /** Show related items */
  showRelatedItems?: boolean;

  /** Show attachments */
  showAttachments?: boolean;

  /** Custom header content */
  headerContent?: ReactNode;

  /** Custom footer content */
  footerContent?: ReactNode;

  /** Custom empty state component */
  emptyState?: ReactNode;

  /** Custom loading component */
  loadingComponent?: ReactNode;

  /** Custom error component */
  errorComponent?: ReactNode;

  /** Content render function */
  renderContent?: (item: DetailItem) => ReactNode;

  /** Section render function */
  renderSection?: (section: DetailSection, index: number) => ReactNode;

  /** Action render function */
  renderAction?: (action: DetailAction, index: number) => ReactNode;

  /** Related item render function */
  renderRelatedItem?: (item: DetailItem, index: number) => ReactNode;

  /** Panel interactions */
  onClose?: () => void;
  onResize?: (dimensions: { width: number; height: number }) => void;
  onAction?: (action: DetailAction, item: DetailItem) => void;
  onRelatedItemClick?: (relatedItem: DetailItem) => void;

  /** Scrolling behavior */
  scrollable?: boolean;
  scrollToTop?: boolean;

  /** Animation preferences */
  animateContent?: boolean;
  animationDelay?: number;

  /** Accessibility */
  ariaLabel?: string;
  focusOnMount?: boolean;
}

// =========================
// HOOKS
// =========================

/**
 * Panel visibility and animation management
 */
const usePanelVisibility = (
  item?: DetailItem,
  animateContent: boolean = false,
  animationDelay: number = 0
) => {
  const [isVisible, setIsVisible] = useState(!!item);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (item) {
      setIsVisible(true);
      if (animateContent) {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 300 + animationDelay);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
      setIsAnimating(false);
    }
  }, [item, animateContent, animationDelay]);

  return { isVisible, isAnimating };
};

/**
 * Section collapse state management
 */
const useSectionStates = (sections: DetailSection[] = []) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.defaultCollapsed).map(s => s.id))
  );

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  return { collapsedSections, toggleSection };
};

// =========================
// UTILITY FUNCTIONS
// =========================

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getPriorityColor = (priority?: string): string => {
  switch (priority) {
    case 'critical': return 'text-red-600 bg-red-100';
    case 'high': return 'text-orange-600 bg-orange-100';
    case 'medium': return 'text-yellow-600 bg-yellow-100';
    case 'low': return 'text-green-600 bg-green-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

// =========================
// COMPONENT SECTIONS
// =========================

/**
 * Detail Header Component
 */
const DetailHeader: React.FC<{
  item: DetailItem;
  showActions?: boolean;
  onAction?: (action: DetailAction) => void;
  onClose?: () => void;
  headerContent?: ReactNode;
  renderAction?: (action: DetailAction, index: number) => ReactNode;
}> = ({
  item,
  showActions = true,
  onAction,
  onClose,
  headerContent,
  renderAction
}) => (
  <div className="detail-header border-b border-gray-200 bg-white">
    <div className="px-6 py-4">
      {headerContent || (
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {item.title}
              </h1>
              {item.priority && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(item.priority)}`}>
                  {item.priority}
                </span>
              )}
              {item.status && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                  {item.status}
                </span>
              )}
            </div>

            {item.subtitle && (
              <p className="text-sm text-gray-600 mb-2">{item.subtitle}</p>
            )}

            <div className="flex items-center space-x-4 text-xs text-gray-500">
              {item.category && (
                <span className="flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                  </svg>
                  {item.category}
                </span>
              )}
              {item.author && (
                <span>By {item.author}</span>
              )}
              {item.timestamp && (
                <span>{formatDate(item.timestamp)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {showActions && item.actions && item.actions.map((action, index) => (
              <div key={action.id}>
                {renderAction ? renderAction(action, index) : (
                  <button
                    type="button"
                    onClick={() => onAction?.(action)}
                    disabled={action.disabled || action.loading}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      action.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                      action.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                      'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${action.disabled || action.loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {action.loading && (
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {action.icon && <span className="mr-1">{action.icon}</span>}
                    {action.label}
                  </button>
                )}
              </div>
            ))}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {item.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
);

/**
 * Detail Content Component
 */
const DetailContent: React.FC<{
  item: DetailItem;
  renderContent?: (item: DetailItem) => ReactNode;
  renderSection?: (section: DetailSection, index: number) => ReactNode;
  collapsedSections: Set<string>;
  onSectionToggle: (sectionId: string) => void;
}> = ({
  item,
  renderContent,
  renderSection,
  collapsedSections,
  onSectionToggle
}) => (
  <div className="detail-content flex-1 overflow-y-auto">
    <div className="px-6 py-4">
      {/* Description */}
      {item.description && (
        <div className="mb-6">
          <p className="text-gray-700 leading-relaxed">{item.description}</p>
        </div>
      )}

      {/* Main Content */}
      {renderContent ? renderContent(item) : (
        <div className="content-section mb-6">
          {typeof item.content === 'string' ? (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg">
                {item.content}
              </pre>
            </div>
          ) : (
            item.content
          )}
        </div>
      )}

      {/* Sections */}
      {item.sections && item.sections.length > 0 && (
        <div className="sections-container space-y-4">
          {item.sections.map((section, index) => (
            <div key={section.id} className="section">
              {renderSection ? renderSection(section, index) : (
                <LayoutPanel
                  title={section.title}
                  collapsible={section.collapsible}
                  defaultCollapsed={collapsedSections.has(section.id)}
                  onToggle={(collapsed) => {
                    if (section.collapsible) {
                      onSectionToggle(section.id);
                    }
                  }}
                  variant="outlined"
                  padding="md"
                  headerActions={section.icon ? <span>{section.icon}</span> : undefined}
                >
                  {section.content}
                </LayoutPanel>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

/**
 * Detail Sidebar Component
 */
const DetailSidebar: React.FC<{
  item: DetailItem;
  showMetadata?: boolean;
  showAttachments?: boolean;
  showRelatedItems?: boolean;
  onRelatedItemClick?: (relatedItem: DetailItem) => void;
  renderRelatedItem?: (item: DetailItem, index: number) => ReactNode;
}> = ({
  item,
  showMetadata = true,
  showAttachments = true,
  showRelatedItems = true,
  onRelatedItemClick,
  renderRelatedItem
}) => (
  <div className="detail-sidebar w-80 bg-gray-50 border-l border-gray-200 overflow-y-auto">
    <div className="p-4 space-y-6">
      {/* Metadata */}
      {showMetadata && item.metadata && Object.keys(item.metadata).length > 0 && (
        <div className="metadata-section">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Details</h3>
          <dl className="space-y-2">
            {Object.entries(item.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <dt className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                <dd className="text-gray-900 font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Attachments */}
      {showAttachments && item.attachments && item.attachments.length > 0 && (
        <div className="attachments-section">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Attachments</h3>
          <div className="space-y-2">
            {item.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center space-x-3 p-2 bg-white rounded border hover:bg-gray-50"
              >
                <div className="flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{attachment.name}</p>
                  {attachment.size && (
                    <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                  )}
                </div>
                {attachment.downloadable && attachment.url && (
                  <a
                    href={attachment.url}
                    download={attachment.name}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Items */}
      {showRelatedItems && item.relatedItems && item.relatedItems.length > 0 && (
        <div className="related-items-section">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Related Items</h3>
          <div className="space-y-2">
            {item.relatedItems.map((relatedItem, index) => (
              <div key={relatedItem.id}>
                {renderRelatedItem ? renderRelatedItem(relatedItem, index) : (
                  <button
                    type="button"
                    onClick={() => onRelatedItemClick?.(relatedItem)}
                    className="w-full text-left p-2 bg-white rounded border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <p className="text-xs font-medium text-gray-900 truncate">{relatedItem.title}</p>
                    {relatedItem.category && (
                      <p className="text-xs text-gray-500">{relatedItem.category}</p>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

// =========================
// MAIN COMPONENT
// =========================

export const DetailPanel = smartMemo<DetailPanelProps>(
  ({
    item,
    loading = false,
    error,
    emptyMessage,
    layout = 'standard',
    width = '600px',
    height = '400px',
    resizable = false,
    position = 'right',
    showHeader = true,
    showHeaderActions = true,
    showMetadata = true,
    showRelatedItems = true,
    showAttachments = true,
    headerContent,
    footerContent,
    emptyState,
    loadingComponent,
    errorComponent,
    renderContent,
    renderSection,
    renderAction,
    renderRelatedItem,
    onClose,
    onResize,
    onAction,
    onRelatedItemClick,
    scrollable = true,
    scrollToTop = true,
    animateContent = false,
    animationDelay = 0,
    ariaLabel,
    focusOnMount = false,
    className = '',
    style,
    'data-testid': testId,
    ...restProps
  }) => {
    const panelRef = useRef<HTMLDivElement>(null);

    // Panel visibility and animation
    const { isVisible, isAnimating } = usePanelVisibility(item, animateContent, animationDelay);

    // Section states
    const { collapsedSections, toggleSection } = useSectionStates(item?.sections);

    // Focus management
    useEffect(() => {
      if (focusOnMount && panelRef.current && item) {
        panelRef.current.focus();
      }
    }, [focusOnMount, item]);

    // Scroll to top on item change
    useEffect(() => {
      if (scrollToTop && panelRef.current && item) {
        panelRef.current.scrollTop = 0;
      }
    }, [scrollToTop, item]);

    // Handle actions
    const handleAction = useStableCallback((action: DetailAction) => {
      onAction?.(action, item!);
      action.onClick();
    }, [onAction, item]);

    // Panel classes and styles
    const panelClasses = useMemo(() => {
      const classes = [
        'detail-panel',
        'flex',
        'flex-col',
        'h-full',
        'bg-white'
      ];

      if (layout === 'sidebar') {
        classes.push('detail-panel-sidebar');
      } else if (layout === 'modal') {
        classes.push('detail-panel-modal', 'rounded-lg', 'shadow-lg');
      }

      if (animateContent && isAnimating) {
        classes.push('animate-fade-in');
      }

      return className ? `${classes.join(' ')} ${className}` : classes.join(' ');
    }, [layout, animateContent, isAnimating, className]);

    const panelStyles = useMemo(() => ({
      ...style,
      ...(layout === 'sidebar' && { width }),
      ...(layout === 'modal' && { width, height })
    }), [style, layout, width, height]);

    // Handle loading state
    if (loading) {
      if (loadingComponent) return <>{loadingComponent}</>;
      return (
        <div className={panelClasses} style={panelStyles}>
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              <span>Loading details...</span>
            </div>
          </div>
        </div>
      );
    }

    // Handle error state
    if (error) {
      if (errorComponent) return <>{errorComponent}</>;
      return (
        <div className={panelClasses} style={panelStyles}>
          <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 h-full">
            {typeof error === 'string' ? error : error}
          </div>
        </div>
      );
    }

    // Handle empty state
    if (!item) {
      if (emptyState) return <>{emptyState}</>;
      return (
        <div className={panelClasses} style={panelStyles}>
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">{emptyMessage || 'Select an item to view details'}</p>
          </div>
        </div>
      );
    }

    // Main panel layout
    return (
      <div
        ref={panelRef}
        className={panelClasses}
        style={panelStyles}
        data-testid={testId}
        data-layout={layout}
        aria-label={ariaLabel || `Details for ${item.title}`}
        tabIndex={focusOnMount ? 0 : undefined}
        {...restProps}
      >
        {/* Header */}
        {showHeader && (
          <DetailHeader
            item={item}
            showActions={showHeaderActions}
            onAction={handleAction}
            onClose={onClose}
            headerContent={headerContent}
            renderAction={renderAction}
          />
        )}

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Primary content */}
          <div className="flex-1 overflow-hidden">
            <DetailContent
              item={item}
              renderContent={renderContent}
              renderSection={renderSection}
              collapsedSections={collapsedSections}
              onSectionToggle={toggleSection}
            />
          </div>

          {/* Sidebar */}
          {layout === 'standard' && (showMetadata || showAttachments || showRelatedItems) && (
            <DetailSidebar
              item={item}
              showMetadata={showMetadata}
              showAttachments={showAttachments}
              showRelatedItems={showRelatedItems}
              onRelatedItemClick={onRelatedItemClick}
              renderRelatedItem={renderRelatedItem}
            />
          )}
        </div>

        {/* Footer */}
        {footerContent && (
          <div className="detail-footer border-t border-gray-200 bg-gray-50 px-6 py-4">
            {footerContent}
          </div>
        )}
      </div>
    );
  },
  {
    compareProps: ['item', 'layout', 'loading'],
    monitor: process.env.NODE_ENV === 'development'
  }
);

DetailPanel.displayName = 'DetailPanel';

// =========================
// LAYOUT VARIANTS
// =========================

export const SidebarDetailPanel: React.FC<Omit<DetailPanelProps, 'layout'>> = (props) => (
  <DetailPanel layout="sidebar" {...props} />
);

export const ModalDetailPanel: React.FC<Omit<DetailPanelProps, 'layout'>> = (props) => (
  <DetailPanel layout="modal" {...props} />
);

export const CompactDetailPanel: React.FC<Omit<DetailPanelProps, 'layout'>> = (props) => (
  <DetailPanel layout="compact" showMetadata={false} showAttachments={false} {...props} />
);

export default DetailPanel;