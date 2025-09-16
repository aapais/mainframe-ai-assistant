/**
 * HighlightText Component
 *
 * Text highlighting component with performance optimizations
 * @version 2.0.0
 */

import React, { memo, useMemo } from 'react';
import { HighlightTextProps } from '../types';
import { useSearchHighlight } from '../hooks/useSearchHighlight';

/**
 * Component for highlighting search terms within text with memoization
 */
export const HighlightText: React.FC<HighlightTextProps> = memo(({
  text,
  searchTerms,
  className = '',
  as: Component = 'span'
}) => {
  const { highlightText } = useSearchHighlight(searchTerms.join(' '), {
    enableMemoization: true,
    highlightClassName: 'search-highlight'
  });

  const highlightedContent = useMemo(() => {
    if (!text) return null;
    return highlightText(text);
  }, [text, highlightText]);

  if (!text) {
    return null;
  }

  return (
    <Component className={className}>
      {highlightedContent}
    </Component>
  );
});

HighlightText.displayName = 'HighlightText';

// Alternative implementation using dangerouslySetInnerHTML for cases where
// React elements in the highlight are not desired
export const HighlightTextHTML: React.FC<HighlightTextProps> = memo(({
  text,
  searchTerms,
  className = '',
  as: Component = 'span'
}) => {
  const highlightedHTML = useMemo(() => {
    if (!text || !searchTerms.length) {
      return text;
    }

    // Create regex for highlighting
    const escapedTerms = searchTerms
      .filter(term => term.length > 1)
      .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (!escapedTerms.length) {
      return text;
    }

    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }, [text, searchTerms]);

  if (!text) {
    return null;
  }

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: highlightedHTML }}
    />
  );
});

HighlightTextHTML.displayName = 'HighlightTextHTML';

export default HighlightText;