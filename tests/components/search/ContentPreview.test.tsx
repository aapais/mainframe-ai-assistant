import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContentPreview from '../../../src/components/search/ContentPreview';
import type { ContentItem } from '../../../src/components/search/ContentPreview';

const mockTextItem: ContentItem = {
  id: 'test-text-1',
  type: 'text',
  content: 'This is a sample text content for testing. '.repeat(20),
  metadata: {
    filename: 'test.txt',
    size: 800,
    lastModified: new Date('2023-01-01')
  }
};

const mockCodeItem: ContentItem = {
  id: 'test-code-1',
  type: 'code',
  content: `function example() {
  console.log('Hello world');
  return 42;
}`,
  metadata: {
    filename: 'example.js',
    language: 'javascript',
    size: 65
  }
};

const mockJsonItem: ContentItem = {
  id: 'test-json-1',
  type: 'json',
  content: JSON.stringify({
    name: 'Test Object',
    value: 123,
    nested: { prop: 'value' }
  }, null, 2)
};

describe('ContentPreview', () => {
  it('renders text content correctly', () => {
    render(
      <ContentPreview
        item={mockTextItem}
        searchTerms={['sample', 'testing']}
      />
    );

    expect(screen.getByTestId('content-preview-test-text-1')).toBeInTheDocument();
    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('shows expand button for long content', async () => {
    render(
      <ContentPreview
        item={mockTextItem}
        maxHeight={100}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Show more')).toBeInTheDocument();
    });
  });

  it('expands content when expand button is clicked', async () => {
    const onExpand = jest.fn();
    render(
      <ContentPreview
        item={mockTextItem}
        maxHeight={100}
        onExpand={onExpand}
      />
    );

    await waitFor(() => {
      const expandButton = screen.getByText('Show more');
      fireEvent.click(expandButton);
    });

    expect(onExpand).toHaveBeenCalledWith('test-text-1', true);
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('renders code content with syntax highlighting info', () => {
    render(
      <ContentPreview
        item={mockCodeItem}
        searchTerms={['function']}
      />
    );

    expect(screen.getByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('example.js')).toBeInTheDocument();
  });

  it('handles JSON content appropriately', () => {
    render(
      <ContentPreview
        item={mockJsonItem}
      />
    );

    expect(screen.getByTestId('rich-media-json')).toBeInTheDocument();
  });

  it('displays metadata when provided', () => {
    render(
      <ContentPreview
        item={mockTextItem}
      />
    );

    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText('800 B')).toBeInTheDocument();
  });

  it('handles lazy loading when enabled', () => {
    render(
      <ContentPreview
        item={mockTextItem}
        lazyLoad={true}
      />
    );

    expect(screen.getByText('Loading content...')).toBeInTheDocument();
  });

  it('supports non-expandable mode', () => {
    render(
      <ContentPreview
        item={mockTextItem}
        expandable={false}
        maxHeight={100}
      />
    );

    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
  });

  it('highlights search terms correctly', () => {
    render(
      <ContentPreview
        item={mockTextItem}
        searchTerms={['sample']}
      />
    );

    const highlights = screen.getAllByText((content, element) => {
      return element?.tagName === 'MARK' && content.includes('sample');
    });
    expect(highlights.length).toBeGreaterThan(0);
  });
});

describe('ContentPreview accessibility', () => {
  it('has proper ARIA attributes', async () => {
    render(
      <ContentPreview
        item={mockTextItem}
        maxHeight={100}
      />
    );

    await waitFor(() => {
      const expandButton = screen.getByRole('button');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('updates ARIA attributes when expanded', async () => {
    render(
      <ContentPreview
        item={mockTextItem}
        maxHeight={100}
      />
    );

    await waitFor(() => {
      const expandButton = screen.getByText('Show more');
      fireEvent.click(expandButton);
    });

    const collapseButton = screen.getByRole('button');
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
  });
});