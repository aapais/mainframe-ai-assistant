/**
 * SearchResults Storybook Stories
 *
 * Comprehensive documentation and examples for SearchResults components
 * @version 2.0.0
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { action } from '@storybook/addon-actions';
import SearchResults from '../SearchResults';
import { SearchResult } from '../../../../types/index';

// Mock data for stories
const mockResults: SearchResult[] = [
  {
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
  },
  {
    entry: {
      id: '2',
      title: 'VSAM Dataset Access Issue - File Not Found',
      problem: 'Unable to access VSAM dataset, receiving IGG0CLEA file not found error during batch processing',
      solution: 'Verify dataset allocation and catalog entries using IDCAMS listcat. Check dataset name spelling and availability.',
      category: 'VSAM',
      tags: ['vsam', 'dataset', 'catalog', 'igg0clea', 'file-not-found'],
      created_at: new Date('2024-01-02'),
      updated_at: new Date('2024-01-16'),
      created_by: 'user1',
      usage_count: 15,
      success_count: 12,
      failure_count: 3,
      version: 1
    },
    score: 0.78,
    matchType: 'fuzzy',
    highlights: ['VSAM dataset', 'file not found', 'catalog entries'],
    explanation: 'Fuzzy match for dataset access problems with good confidence'
  },
  {
    entry: {
      id: '3',
      title: 'DB2 Connection Timeout in Batch Processing',
      problem: 'Database connection timing out during long-running batch processes, causing job failures',
      solution: 'Increase connection timeout parameters in DB2 connection pool and optimize SQL queries for better performance',
      category: 'DB2',
      tags: ['db2', 'timeout', 'connection', 'batch-processing', 'performance'],
      created_at: new Date('2024-01-03'),
      updated_at: new Date('2024-01-17'),
      created_by: 'user2',
      usage_count: 8,
      success_count: 6,
      failure_count: 2,
      version: 1
    },
    score: 0.65,
    matchType: 'ai',
    highlights: ['connection timing out', 'batch processes'],
    explanation: 'AI-powered match for database connectivity issues'
  },
  {
    entry: {
      id: '4',
      title: 'COBOL COMP-3 Data Corruption During Arithmetic',
      problem: 'COMP-3 packed decimal fields showing incorrect values after arithmetic operations in COBOL programs',
      solution: 'Verify field definitions with proper PIC clauses and use MOVE statements instead of direct arithmetic on packed fields',
      category: 'COBOL',
      tags: ['cobol', 'comp-3', 'packed-decimal', 'arithmetic', 'data-corruption'],
      created_at: new Date('2024-01-04'),
      updated_at: new Date('2024-01-18'),
      created_by: 'expert-user',
      usage_count: 45,
      success_count: 40,
      failure_count: 5,
      version: 2
    },
    score: 0.88,
    matchType: 'semantic',
    highlights: ['COMP-3 packed decimal', 'arithmetic operations', 'field definitions'],
    explanation: 'Semantic match for COBOL data handling with high confidence'
  }
];

// Create many results for virtualization testing
const manyResults = Array.from({ length: 50 }, (_, i) => ({
  ...mockResults[i % mockResults.length],
  entry: {
    ...mockResults[i % mockResults.length].entry,
    id: `result-${i}`,
    title: `${mockResults[i % mockResults.length].entry.title} (${i + 1})`
  }
}));

const meta: Meta<typeof SearchResults> = {
  title: 'Components/Search/SearchResults',
  component: SearchResults,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# SearchResults Component

A highly optimized and accessible search results component with modular architecture, featuring:

- **Virtual Scrolling**: Efficient rendering for large datasets
- **Keyboard Navigation**: Full accessibility with arrow keys
- **Search Highlighting**: Visual highlighting of search terms
- **Confidence Scores**: Match quality indicators
- **Error Boundaries**: Graceful error handling
- **Compound Pattern**: Flexible composition with sub-components
- **TypeScript Strict**: Full type safety

## Architecture

The component follows a modular architecture with:
- Separate sub-components for maintainability
- Custom hooks for reusable logic
- Provider pattern for state management
- Error boundaries for resilience
- Strict TypeScript compliance

## Usage Patterns

### Basic Usage
\`\`\`tsx
<SearchResults
  results={results}
  searchQuery="JCL error"
  onResultSelect={(result, index) => console.log(result)}
/>
\`\`\`

### Compound Pattern
\`\`\`tsx
<SearchResults.Provider value={contextValue}>
  <SearchResults.Header />
  <SearchResults.List />
  <SearchResults.Footer />
</SearchResults.Provider>
\`\`\`
        `
      }
    }
  },
  argTypes: {
    results: {
      description: 'Array of search results to display',
      control: { type: 'object' }
    },
    searchQuery: {
      description: 'Search query string for highlighting',
      control: { type: 'text' }
    },
    isLoading: {
      description: 'Loading state indicator',
      control: { type: 'boolean' }
    },
    error: {
      description: 'Error message to display',
      control: { type: 'text' }
    },
    selectedIndex: {
      description: 'Currently selected result index',
      control: { type: 'number' }
    },
    showConfidenceScores: {
      description: 'Whether to show match confidence scores',
      control: { type: 'boolean' }
    },
    virtualizationThreshold: {
      description: 'Number of items before virtualization kicks in',
      control: { type: 'number', min: 1, max: 100 }
    },
    onResultSelect: {
      description: 'Callback when a result is selected',
      action: 'resultSelected'
    },
    onLoadMore: {
      description: 'Callback for loading more results',
      action: 'loadMore'
    }
  },
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic Stories
export const Default: Story = {
  args: {
    results: mockResults,
    searchQuery: 'JCL error processing',
    showConfidenceScores: true,
    onResultSelect: action('result-selected'),
    onLoadMore: action('load-more')
  }
};

export const WithoutConfidenceScores: Story = {
  args: {
    ...Default.args,
    showConfidenceScores: false
  }
};

export const SelectedResult: Story = {
  args: {
    ...Default.args,
    selectedIndex: 1
  }
};

// State Stories
export const LoadingState: Story = {
  args: {
    results: [],
    searchQuery: 'Loading search...',
    isLoading: true
  }
};

export const EmptyState: Story = {
  args: {
    results: [],
    searchQuery: 'nonexistent query',
    isLoading: false
  }
};

export const ErrorState: Story = {
  args: {
    results: [],
    searchQuery: 'error query',
    isLoading: false,
    error: 'Failed to fetch search results. Please try again.'
  }
};

// Performance Stories
export const VirtualizedList: Story = {
  args: {
    results: manyResults,
    searchQuery: 'performance test',
    showConfidenceScores: true,
    virtualizationThreshold: 10,
    onResultSelect: action('result-selected')
  },
  parameters: {
    docs: {
      description: {
        story: 'Large dataset (50 items) demonstrating virtual scrolling for performance optimization.'
      }
    }
  }
};

export const SmallDataset: Story = {
  args: {
    results: mockResults.slice(0, 2),
    searchQuery: 'small dataset',
    showConfidenceScores: true,
    onResultSelect: action('result-selected')
  },
  parameters: {
    docs: {
      description: {
        story: 'Small dataset that uses regular rendering instead of virtualization.'
      }
    }
  }
};

// Interaction Stories
export const WithLoadMore: Story = {
  args: {
    results: Array.from({ length: 25 }, (_, i) => ({
      ...mockResults[i % mockResults.length],
      entry: {
        ...mockResults[i % mockResults.length].entry,
        id: `loadmore-${i}`,
        title: `${mockResults[i % mockResults.length].entry.title} (Page 1 - ${i + 1})`
      }
    })),
    searchQuery: 'paginated results',
    showConfidenceScores: true,
    onResultSelect: action('result-selected'),
    onLoadMore: action('load-more')
  },
  parameters: {
    docs: {
      description: {
        story: 'Results with load more functionality for pagination.'
      }
    }
  }
};

export const KeyboardNavigation: Story = {
  args: {
    ...Default.args,
    selectedIndex: 0
  },
  parameters: {
    docs: {
      description: {
        story: `
Demonstrates keyboard navigation features:
- **Arrow Keys**: Navigate up/down through results
- **Home/End**: Jump to first/last result
- **Enter**: Select current result
- **Escape**: Clear selection

Click on the component and use keyboard to navigate.
        `
      }
    }
  }
};

// Match Type Stories
export const VariousMatchTypes: Story = {
  args: {
    results: [
      { ...mockResults[0], matchType: 'exact' as const },
      { ...mockResults[1], matchType: 'fuzzy' as const },
      { ...mockResults[2], matchType: 'ai' as const },
      { ...mockResults[3], matchType: 'semantic' as const }
    ],
    searchQuery: 'different match types',
    showConfidenceScores: true,
    onResultSelect: action('result-selected')
  },
  parameters: {
    docs: {
      description: {
        story: 'Showcases different match types: exact (🎯), fuzzy (🔍), AI (🤖), and semantic (🧠).'
      }
    }
  }
};

// Confidence Score Stories
export const ConfidenceVariations: Story = {
  args: {
    results: [
      { ...mockResults[0], score: 0.95 }, // High confidence
      { ...mockResults[1], score: 0.75 }, // Medium confidence
      { ...mockResults[2], score: 0.45 }, // Low confidence
      { ...mockResults[3], score: 0.85 }  // High confidence
    ],
    searchQuery: 'confidence score variations',
    showConfidenceScores: true,
    onResultSelect: action('result-selected')
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates confidence score color coding: Green (80%+), Yellow (60-80%), Red (<60%).'
      }
    }
  }
};

// Accessibility Stories
export const AccessibilityDemo: Story = {
  args: {
    ...Default.args,
    ariaLabel: 'Custom accessibility label for search results'
  },
  parameters: {
    docs: {
      description: {
        story: `
Accessibility features included:
- **Screen Reader Support**: Full ARIA labels and descriptions
- **Keyboard Navigation**: Complete keyboard control
- **Focus Management**: Proper focus indicators and management
- **Live Regions**: Dynamic content announcements
- **High Contrast Support**: Respects user preferences
        `
      }
    }
  }
};

// Customization Stories
export const CustomStyling: Story = {
  args: {
    ...Default.args,
    className: 'custom-search-results-styling'
  },
  decorators: [
    (Story) => (
      <div>
        <style>{`
          .custom-search-results-styling {
            border: 2px solid #3b82f6;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(59, 130, 246, 0.1);
          }
          .custom-search-results-styling .search-results-header {
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            color: white;
          }
          .custom-search-results-styling .search-result-item:hover {
            background: rgba(59, 130, 246, 0.05);
            transform: translateX(4px);
          }
        `}</style>
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Example of custom styling applied to the SearchResults component.'
      }
    }
  }
};

// Error Boundary Story
export const ErrorBoundaryDemo: Story = {
  args: {
    results: [
      // Intentionally malformed data to trigger error boundary
      null as any,
      undefined as any,
      ...mockResults.slice(0, 2)
    ],
    searchQuery: 'error boundary test',
    onResultSelect: action('result-selected')
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates error boundary functionality with malformed data.'
      }
    }
  }
};

// Mobile Responsive Story
export const MobileView: Story = {
  args: {
    ...Default.args
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    },
    docs: {
      description: {
        story: 'Mobile-responsive view with optimized layout for smaller screens.'
      }
    }
  }
};

// Dark Mode Story (if supported)
export const DarkMode: Story = {
  args: {
    ...Default.args
  },
  decorators: [
    (Story) => (
      <div className="dark" style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '8px' }}>
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: 'Dark mode version with appropriate color scheme.'
      }
    }
  }
};