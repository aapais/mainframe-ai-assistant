/**
 * SearchResults Sub-Components Stories
 *
 * Individual stories for SearchResults sub-components
 * @version 2.0.0
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { action } from '@storybook/addon-actions';
import {
  SearchResultItem,
  HighlightText,
  ConfidenceScore,
  LazyImage,
  LoadingState,
  EmptyState,
  ErrorState,
  SearchResultsHeader,
  SearchResultsFooter
} from '../components';
import { SearchResult } from '../../../../types';

// Mock data
const mockResult: SearchResult = {
  entry: {
    id: '1',
    title: 'JCL Step Processing Error - ABEND S0C7',
    problem: 'Job fails at step execution with ABEND S0C7 data exception error in numeric processing',
    solution: 'Check numeric data fields for invalid characters and ensure proper data validation. Use ISPF edit to examine data format.',
    category: 'JCL',
    tags: ['abend', 's0c7', 'data-exception', 'numeric-processing'],
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-15'),
    created_by: 'admin',
    usage_count: 25,
    success_count: 20,
    failure_count: 5,
    version: 1
  },
  score: 0.92,
  matchType: 'exact',
  highlights: ['ABEND S0C7 data exception', 'numeric data fields', 'step execution'],
  explanation: 'Exact match for JCL processing error with high confidence'
};

// SearchResultItem Stories
const searchResultItemMeta: Meta<typeof SearchResultItem> = {
  title: 'Components/Search/SearchResults/SearchResultItem',
  component: SearchResultItem,
  parameters: {
    layout: 'padded'
  },
  argTypes: {
    result: { control: { type: 'object' } },
    index: { control: { type: 'number' } },
    isSelected: { control: { type: 'boolean' } },
    searchTerms: { control: { type: 'object' } },
    showConfidenceScores: { control: { type: 'boolean' } },
    onSelect: { action: 'selected' }
  }
};

export default searchResultItemMeta;

export const DefaultSearchResultItem: StoryObj<typeof SearchResultItem> = {
  args: {
    result: mockResult,
    index: 0,
    isSelected: false,
    searchTerms: ['JCL', 'error', 'processing'],
    showConfidenceScores: true,
    onSelect: action('result-selected')
  }
};

export const SelectedSearchResultItem: StoryObj<typeof SearchResultItem> = {
  args: {
    ...DefaultSearchResultItem.args,
    isSelected: true
  }
};

export const WithoutConfidenceScore: StoryObj<typeof SearchResultItem> = {
  args: {
    ...DefaultSearchResultItem.args,
    showConfidenceScores: false
  }
};

// HighlightText Stories
const highlightTextMeta: Meta<typeof HighlightText> = {
  title: 'Components/Search/SearchResults/HighlightText',
  component: HighlightText,
  parameters: {
    layout: 'centered'
  }
};

export const BasicHighlight: StoryObj<typeof HighlightText> = {
  args: {
    text: 'This is a sample text with some highlighted words for testing purposes.',
    searchTerms: ['sample', 'highlighted', 'testing'],
    className: 'text-lg'
  }
};

export const CaseInsensitiveHighlight: StoryObj<typeof HighlightText> = {
  args: {
    text: 'JCL Job Control Language processing ERROR in mainframe SYSTEM',
    searchTerms: ['jcl', 'error', 'system'],
    className: 'text-base'
  }
};

export const NoMatches: StoryObj<typeof HighlightText> = {
  args: {
    text: 'This text has no matching terms.',
    searchTerms: ['xyz', 'abc'],
    className: 'text-base text-gray-600'
  }
};

// ConfidenceScore Stories
const confidenceScoreMeta: Meta<typeof ConfidenceScore> = {
  title: 'Components/Search/SearchResults/ConfidenceScore',
  component: ConfidenceScore,
  parameters: {
    layout: 'centered'
  }
};

export const HighConfidence: StoryObj<typeof ConfidenceScore> = {
  args: {
    score: 0.92,
    matchType: 'exact',
    showPercentage: true
  }
};

export const MediumConfidence: StoryObj<typeof ConfidenceScore> = {
  args: {
    score: 0.75,
    matchType: 'fuzzy',
    showPercentage: true
  }
};

export const LowConfidence: StoryObj<typeof ConfidenceScore> = {
  args: {
    score: 0.45,
    matchType: 'ai',
    showPercentage: true
  }
};

export const WithoutPercentage: StoryObj<typeof ConfidenceScore> = {
  args: {
    score: 0.88,
    matchType: 'semantic',
    showPercentage: false
  }
};

// LazyImage Stories
const lazyImageMeta: Meta<typeof LazyImage> = {
  title: 'Components/Search/SearchResults/LazyImage',
  component: LazyImage,
  parameters: {
    layout: 'centered'
  }
};

export const ValidImage: StoryObj<typeof LazyImage> = {
  args: {
    src: 'https://via.placeholder.com/300x200/3b82f6/ffffff?text=Sample+Image',
    alt: 'Sample placeholder image',
    className: 'w-64 h-40 rounded border'
  }
};

export const BrokenImage: StoryObj<typeof LazyImage> = {
  args: {
    src: 'https://broken-url-that-does-not-exist.com/image.jpg',
    alt: 'Broken image example',
    className: 'w-64 h-40 rounded border',
    fallbackSrc: 'https://via.placeholder.com/300x200/ef4444/ffffff?text=Fallback'
  }
};

export const CustomPlaceholder: StoryObj<typeof LazyImage> = {
  args: {
    src: 'https://httpstat.us/200?sleep=2000', // Slow loading image
    alt: 'Slow loading image',
    className: 'w-64 h-40 rounded border',
    placeholder: (
      <div className="absolute inset-0 bg-blue-100 rounded flex items-center justify-center">
        <div className="text-blue-600">Custom Loading...</div>
      </div>
    )
  }
};

// State Components Stories
const loadingStateMeta: Meta<typeof LoadingState> = {
  title: 'Components/Search/SearchResults/LoadingState',
  component: LoadingState,
  parameters: {
    layout: 'centered'
  }
};

export const DefaultLoading: StoryObj<typeof LoadingState> = {
  args: {
    message: 'Searching knowledge base...',
    size: 'medium',
    showSpinner: true
  }
};

export const SmallLoading: StoryObj<typeof LoadingState> = {
  args: {
    message: 'Loading...',
    size: 'small',
    showSpinner: true
  }
};

export const LargeLoading: StoryObj<typeof LoadingState> = {
  args: {
    message: 'Processing large dataset...',
    size: 'large',
    showSpinner: true
  }
};

const emptyStateMeta: Meta<typeof EmptyState> = {
  title: 'Components/Search/SearchResults/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered'
  }
};

export const DefaultEmpty: StoryObj<typeof EmptyState> = {
  args: {
    message: 'No results found',
    searchQuery: 'nonexistent query',
    size: 'medium'
  }
};

export const CustomEmptyMessage: StoryObj<typeof EmptyState> = {
  args: {
    message: 'Nothing matches your search',
    description: 'Try using different keywords or check your spelling.',
    searchQuery: 'xyz123',
    icon: '🤔'
  }
};

export const EmptyWithActions: StoryObj<typeof EmptyState> = {
  args: {
    message: 'No results found',
    searchQuery: 'complex query',
    actions: (
      <div className="space-y-2">
        <button className="block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Clear Search
        </button>
        <button className="block px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
          Browse Categories
        </button>
      </div>
    )
  }
};

const errorStateMeta: Meta<typeof ErrorState> = {
  title: 'Components/Search/SearchResults/ErrorState',
  component: ErrorState,
  parameters: {
    layout: 'centered'
  }
};

export const DefaultError: StoryObj<typeof ErrorState> = {
  args: {
    error: 'Failed to fetch search results. Please try again.',
    onRetry: action('retry-clicked')
  }
};

export const NetworkError: StoryObj<typeof ErrorState> = {
  args: {
    error: 'Network connection failed. Check your internet connection.',
    title: 'Connection Error',
    icon: '📡',
    context: 'This might be a temporary issue with your network or our servers.',
    onRetry: action('retry-clicked')
  }
};

export const TimeoutError: StoryObj<typeof ErrorState> = {
  args: {
    error: 'Request timed out. The search took too long to complete.',
    title: 'Timeout Error',
    icon: '⏱️',
    context: 'Try a more specific search query or wait a moment before retrying.',
    onRetry: action('retry-clicked')
  }
};

// Header and Footer Stories
const headerMeta: Meta<typeof SearchResultsHeader> = {
  title: 'Components/Search/SearchResults/SearchResultsHeader',
  component: SearchResultsHeader,
  parameters: {
    layout: 'padded'
  }
};

export const DefaultHeader: StoryObj<typeof SearchResultsHeader> = {
  args: {
    resultCount: 15,
    searchQuery: 'JCL processing error',
    showConfidenceScores: true,
    isLoading: false
  }
};

export const LoadingHeader: StoryObj<typeof SearchResultsHeader> = {
  args: {
    resultCount: 0,
    searchQuery: 'searching...',
    showConfidenceScores: true,
    isLoading: true
  }
};

export const HeaderWithActions: StoryObj<typeof SearchResultsHeader> = {
  args: {
    resultCount: 25,
    searchQuery: 'database connection',
    showConfidenceScores: true,
    actions: (
      <div className="flex gap-2">
        <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
          Sort
        </button>
        <button className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
          Filter
        </button>
      </div>
    )
  }
};

const footerMeta: Meta<typeof SearchResultsFooter> = {
  title: 'Components/Search/SearchResults/SearchResultsFooter',
  component: SearchResultsFooter,
  parameters: {
    layout: 'padded'
  }
};

export const FooterWithLoadMore: StoryObj<typeof SearchResultsFooter> = {
  args: {
    showLoadMore: true,
    hasMoreResults: true,
    isLoadingMore: false,
    onLoadMore: action('load-more-clicked')
  }
};

export const FooterLoading: StoryObj<typeof SearchResultsFooter> = {
  args: {
    showLoadMore: true,
    hasMoreResults: true,
    isLoadingMore: true,
    onLoadMore: action('load-more-clicked')
  }
};

export const FooterEndOfResults: StoryObj<typeof SearchResultsFooter> = {
  args: {
    showLoadMore: true,
    hasMoreResults: false,
    isLoadingMore: false
  }
};

export const FooterWithPagination: StoryObj<typeof SearchResultsFooter> = {
  args: {
    pagination: {
      current: 3,
      total: 10,
      pageSize: 20
    }
  }
};