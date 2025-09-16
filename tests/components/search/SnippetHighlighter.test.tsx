import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SnippetHighlighter from '../../../src/components/search/SnippetHighlighter';

const sampleText = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco.
`;

describe('SnippetHighlighter', () => {
  it('renders text without highlights when no search terms provided', () => {
    render(
      <SnippetHighlighter
        content={sampleText}
        searchTerms={[]}
      />
    );

    expect(screen.getByText(/Lorem ipsum dolor/)).toBeInTheDocument();
    expect(screen.queryByRole('mark')).not.toBeInTheDocument();
  });

  it('highlights single search term', () => {
    render(
      <SnippetHighlighter
        content={sampleText}
        searchTerms={['lorem']}
      />
    );

    const highlights = screen.getAllByText((content, element) => {
      return element?.tagName === 'MARK' && content.toLowerCase().includes('lorem');
    });
    expect(highlights.length).toBeGreaterThan(0);
  });

  it('highlights multiple search terms', () => {
    render(
      <SnippetHighlighter
        content={sampleText}
        searchTerms={['lorem', 'dolor']}
      />
    );

    const loremHighlights = screen.getAllByText((content, element) => {
      return element?.tagName === 'MARK' && content.toLowerCase().includes('lorem');
    });
    const dolorHighlights = screen.getAllByText((content, element) => {
      return element?.tagName === 'MARK' && content.toLowerCase().includes('dolor');
    });

    expect(loremHighlights.length).toBeGreaterThan(0);
    expect(dolorHighlights.length).toBeGreaterThan(0);
  });

  it('handles case insensitive highlighting', () => {
    render(
      <SnippetHighlighter
        content={sampleText}
        searchTerms={['LOREM', 'Dolor']}
      />
    );

    const highlights = screen.getAllByRole('mark');
    expect(highlights.length).toBeGreaterThan(0);
  });

  it('creates snippets for long content', () => {
    const longText = 'This is a very long text. '.repeat(100) + 'Important keyword here.' + 'More text after.'.repeat(50);

    render(
      <SnippetHighlighter
        content={longText}
        searchTerms={['keyword']}
        contextRadius={50}
        maxSnippets={1}
      />
    );

    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'MARK' && content.includes('keyword');
    })).toBeInTheDocument();
  });

  it('merges overlapping highlights', () => {
    const text = 'Hello world test';

    render(
      <SnippetHighlighter
        content={text}
        searchTerms={['hello world', 'world test']}
      />
    );

    // Should merge overlapping highlights rather than creating separate ones
    const highlights = screen.getAllByRole('mark');
    expect(highlights.length).toBeGreaterThan(0);
  });

  it('applies custom highlight className', () => {
    render(
      <SnippetHighlighter
        content="test content"
        searchTerms={['test']}
        highlightClassName="custom-highlight"
      />
    );

    const highlight = screen.getByRole('mark');
    expect(highlight).toHaveClass('custom-highlight');
  });

  it('handles empty search terms gracefully', () => {
    render(
      <SnippetHighlighter
        content={sampleText}
        searchTerms={['', '  ', null as any, undefined as any]}
      />
    );

    expect(screen.getByText(/Lorem ipsum dolor/)).toBeInTheDocument();
    expect(screen.queryByRole('mark')).not.toBeInTheDocument();
  });

  it('escapes regex special characters in search terms', () => {
    const text = 'Price: $100 (20% off)';

    render(
      <SnippetHighlighter
        content={text}
        searchTerms={['$100', '(20%']}
      />
    );

    const dollarHighlight = screen.getByText((content, element) => {
      return element?.tagName === 'MARK' && content.includes('$100');
    });
    const percentHighlight = screen.getByText((content, element) => {
      return element?.tagName === 'MARK' && content.includes('(20%');
    });

    expect(dollarHighlight).toBeInTheDocument();
    expect(percentHighlight).toBeInTheDocument();
  });
});