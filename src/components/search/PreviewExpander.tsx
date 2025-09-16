import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline';

interface PreviewExpanderProps {
  children: React.ReactNode;
  maxHeight?: number;
  expandable?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  animationDuration?: number;
  fadeEdge?: boolean;
  fullScreenMode?: boolean;
  className?: string;
  onExpandChange?: (expanded: boolean) => void;
  expandButtonText?: string;
  collapseButtonText?: string;
}

const PreviewExpander: React.FC<PreviewExpanderProps> = ({
  children,
  maxHeight = 300,
  expandable = true,
  collapsible = true,
  defaultExpanded = false,
  animationDuration = 300,
  fadeEdge = true,
  fullScreenMode = false,
  className = '',
  onExpandChange,
  expandButtonText = 'Show more',
  collapseButtonText = 'Show less'
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [needsExpansion, setNeedsExpansion] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      setNeedsExpansion(height > maxHeight);
    }
  }, [children, maxHeight]);

  const handleExpand = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandChange?.(newExpanded);
  };

  const handleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const currentMaxHeight = isExpanded || isFullScreen ? 'none' : `${maxHeight}px`;

  const shouldShowExpandButton = needsExpansion && expandable && !isFullScreen;
  const shouldShowCollapseButton = isExpanded && collapsible && !isFullScreen;
  const shouldShowFullScreenButton = fullScreenMode && (needsExpansion || isExpanded);

  const containerClasses = [
    'preview-expander',
    'relative',
    'transition-all',
    'ease-in-out',
    className
  ].filter(Boolean).join(' ');

  const contentClasses = [
    'preview-content',
    'overflow-hidden',
    'transition-all',
    'ease-in-out'
  ].join(' ');

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Full-screen header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="text-lg font-medium">Full Screen Preview</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleFullScreen}
              className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowsPointingInIcon className="h-4 w-4" />
              <span>Exit Full Screen</span>
            </button>
          </div>
        </div>

        {/* Full-screen content */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      style={{
        transitionDuration: `${animationDuration}ms`
      }}
    >
      {/* Content area */}
      <div
        ref={contentRef}
        className={contentClasses}
        style={{
          maxHeight: currentMaxHeight,
          transitionDuration: `${animationDuration}ms`
        }}
      >
        {children}

        {/* Fade edge overlay */}
        {fadeEdge && needsExpansion && !isExpanded && (
          <div
            className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"
            style={{
              opacity: fadeEdge ? 1 : 0,
              transition: `opacity ${animationDuration}ms ease-in-out`
            }}
          />
        )}
      </div>

      {/* Control buttons */}
      {(shouldShowExpandButton || shouldShowCollapseButton || shouldShowFullScreenButton) && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
          <div className="flex items-center space-x-2">
            {/* Expand/Collapse button */}
            {shouldShowExpandButton && (
              <button
                onClick={handleExpand}
                className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors rounded hover:bg-blue-50"
                aria-expanded={isExpanded}
              >
                <ChevronDownIcon className="h-4 w-4" />
                <span>{expandButtonText}</span>
              </button>
            )}

            {shouldShowCollapseButton && (
              <button
                onClick={handleExpand}
                className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors rounded hover:bg-blue-50"
                aria-expanded={isExpanded}
              >
                <ChevronUpIcon className="h-4 w-4" />
                <span>{collapseButtonText}</span>
              </button>
            )}
          </div>

          {/* Full screen button */}
          {shouldShowFullScreenButton && (
            <button
              onClick={handleFullScreen}
              className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors rounded hover:bg-gray-50"
              title="Full Screen"
            >
              <ArrowsPointingOutIcon className="h-4 w-4" />
              <span className="sr-only">Full Screen</span>
            </button>
          )}
        </div>
      )}

      {/* Content metadata */}
      {needsExpansion && (
        <div className="text-xs text-gray-500 mt-1">
          {isExpanded
            ? `Showing full content (${Math.round(contentHeight)}px)`
            : `Showing preview (${maxHeight}px of ${Math.round(contentHeight)}px)`
          }
        </div>
      )}
    </div>
  );
};

/**
 * Enhanced expander with sections
 */
export const SectionedPreviewExpander: React.FC<{
  sections: Array<{
    id: string;
    title: string;
    content: React.ReactNode;
    defaultExpanded?: boolean;
    collapsible?: boolean;
  }>;
  className?: string;
  accordionMode?: boolean;
}> = ({
  sections,
  className = '',
  accordionMode = false
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.defaultExpanded).map(s => s.id))
  );

  const handleSectionToggle = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);

      if (accordionMode) {
        // In accordion mode, only one section can be open
        newSet.clear();
        if (!prev.has(sectionId)) {
          newSet.add(sectionId);
        }
      } else {
        // In normal mode, toggle individual sections
        if (prev.has(sectionId)) {
          newSet.delete(sectionId);
        } else {
          newSet.add(sectionId);
        }
      }

      return newSet;
    });
  };

  return (
    <div className={`sectioned-preview-expander space-y-2 ${className}`}>
      {sections.map((section) => {
        const isExpanded = expandedSections.has(section.id);
        const isCollapsible = section.collapsible !== false;

        return (
          <div key={section.id} className="section border rounded-lg overflow-hidden">
            <button
              onClick={() => isCollapsible && handleSectionToggle(section.id)}
              className={`w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between ${
                !isCollapsible ? 'cursor-default' : ''
              }`}
              disabled={!isCollapsible}
            >
              <span className="font-medium text-gray-800">{section.title}</span>
              {isCollapsible && (
                <ChevronDownIcon
                  className={`h-4 w-4 text-gray-500 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            <div
              className={`section-content transition-all duration-300 ease-in-out ${
                isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-4">
                {section.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Smart expander that auto-detects content type
 */
export const SmartPreviewExpander: React.FC<{
  content: any;
  contentType?: 'text' | 'code' | 'json' | 'html' | 'markdown';
  searchTerms?: string[];
  className?: string;
}> = ({
  content,
  contentType = 'text',
  searchTerms = [],
  className = ''
}) => {
  const detectContentHeight = (content: any, type: string): number => {
    switch (type) {
      case 'code':
        return (content as string).split('\n').length * 20; // 20px per line
      case 'json':
        return JSON.stringify(content, null, 2).split('\n').length * 20;
      case 'text':
        return Math.ceil((content as string).length / 80) * 20; // ~80 chars per line
      default:
        return 200;
    }
  };

  const estimatedHeight = detectContentHeight(content, contentType);
  const shouldExpand = estimatedHeight > 300;

  return (
    <PreviewExpander
      maxHeight={300}
      expandable={shouldExpand}
      fullScreenMode={estimatedHeight > 600}
      className={className}
    >
      {contentType === 'json' ? (
        <pre className="text-sm overflow-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      ) : (
        <div className="whitespace-pre-wrap text-sm">
          {content}
        </div>
      )}
    </PreviewExpander>
  );
};

export default PreviewExpander;