// Export all preview components for easy importing
export { default as ContentPreview } from './ContentPreview';
export type { ContentItem } from './ContentPreview';

export { default as SmartTruncation } from './SmartTruncation';
export { smartCodeTruncation } from './SmartTruncation';

export { default as RichMediaPreview } from './RichMediaPreview';

export { default as SnippetHighlighter } from './SnippetHighlighter';
export { FuzzySnippetHighlighter, CodeSnippetHighlighter } from './SnippetHighlighter';

export { default as LazyContentLoader } from './LazyContentLoader';
export { ProgressiveContentLoader, VirtualizedContentLoader } from './LazyContentLoader';

export { default as PreviewExpander } from './PreviewExpander';
export { SectionedPreviewExpander, SmartPreviewExpander } from './PreviewExpander';

// Utility types for search functionality
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'code' | 'markdown' | 'json' | 'xml' | 'image' | 'table';
  score: number;
  highlights: string[];
  metadata?: {
    filename?: string;
    language?: string;
    size?: number;
    lastModified?: Date;
    path?: string;
  };
}

export interface PreviewConfig {
  maxHeight?: number;
  expandable?: boolean;
  lazyLoad?: boolean;
  showMetadata?: boolean;
  enableFullScreen?: boolean;
  highlightSearchTerms?: boolean;
  truncationStrategy?: 'smart' | 'simple' | 'none';
}

// Default configurations for different content types
export const DEFAULT_PREVIEW_CONFIGS: Record<string, PreviewConfig> = {
  text: {
    maxHeight: 200,
    expandable: true,
    lazyLoad: false,
    truncationStrategy: 'smart'
  },
  code: {
    maxHeight: 300,
    expandable: true,
    lazyLoad: true,
    showMetadata: true,
    enableFullScreen: true,
    truncationStrategy: 'smart'
  },
  json: {
    maxHeight: 250,
    expandable: true,
    lazyLoad: false,
    showMetadata: true,
    truncationStrategy: 'none'
  },
  markdown: {
    maxHeight: 300,
    expandable: true,
    lazyLoad: false,
    enableFullScreen: true,
    truncationStrategy: 'smart'
  },
  image: {
    maxHeight: 400,
    expandable: false,
    lazyLoad: true,
    showMetadata: true,
    enableFullScreen: true,
    truncationStrategy: 'none'
  },
  table: {
    maxHeight: 350,
    expandable: true,
    lazyLoad: true,
    showMetadata: true,
    truncationStrategy: 'smart'
  }
};