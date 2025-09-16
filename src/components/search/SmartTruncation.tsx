import React, { useMemo } from 'react';
import SnippetHighlighter from './SnippetHighlighter';

interface SmartTruncationProps {
  content: string;
  maxHeight: number;
  searchTerms?: string[];
  preserveFormatting?: boolean;
  className?: string;
}

const SmartTruncation: React.FC<SmartTruncationProps> = ({
  content,
  maxHeight,
  searchTerms = [],
  preserveFormatting = true,
  className = ''
}) => {
  const truncatedContent = useMemo(() => {
    if (!content) return '';

    // Estimate characters per line (approximate)
    const charsPerLine = 80;
    const lineHeight = 20; // pixels
    const maxLines = Math.floor(maxHeight / lineHeight);
    const maxChars = maxLines * charsPerLine;

    if (content.length <= maxChars) {
      return content;
    }

    // Find the best truncation point considering search terms
    let truncateAt = maxChars;

    // If we have search terms, try to include relevant context
    if (searchTerms.length > 0) {
      const firstMatch = findFirstSearchMatch(content, searchTerms);
      if (firstMatch !== -1) {
        // Try to center the first match in the preview
        const contextStart = Math.max(0, firstMatch - Math.floor(maxChars / 2));
        const contextEnd = Math.min(content.length, contextStart + maxChars);

        // Adjust to word boundaries
        const adjustedStart = findWordBoundary(content, contextStart, 'backward');
        const adjustedEnd = findWordBoundary(content, contextEnd, 'forward');

        return content.slice(adjustedStart, adjustedEnd);
      }
    }

    // Standard truncation at word boundary
    truncateAt = findWordBoundary(content, maxChars, 'backward');

    // Ensure we don't truncate too aggressively
    if (truncateAt < maxChars * 0.8) {
      truncateAt = maxChars;
    }

    return content.slice(0, truncateAt);
  }, [content, maxHeight, searchTerms]);

  const isTruncated = truncatedContent.length < content.length;

  return (
    <div className={`smart-truncation ${className}`}>
      <SnippetHighlighter
        content={truncatedContent}
        searchTerms={searchTerms}
        className={preserveFormatting ? 'whitespace-pre-wrap' : ''}
      />
      {isTruncated && (
        <span className="text-gray-400 italic">...</span>
      )}
    </div>
  );
};

/**
 * Find the first occurrence of any search term in content
 */
const findFirstSearchMatch = (content: string, searchTerms: string[]): number => {
  let firstMatch = -1;

  for (const term of searchTerms) {
    if (!term.trim()) continue;

    const index = content.toLowerCase().indexOf(term.toLowerCase());
    if (index !== -1 && (firstMatch === -1 || index < firstMatch)) {
      firstMatch = index;
    }
  }

  return firstMatch;
};

/**
 * Find the nearest word boundary from a given position
 */
const findWordBoundary = (
  content: string,
  position: number,
  direction: 'forward' | 'backward'
): number => {
  if (position <= 0) return 0;
  if (position >= content.length) return content.length;

  const wordBoundaryRegex = /\s/;
  let currentPos = position;

  if (direction === 'backward') {
    // Move backward to find space or start of string
    while (currentPos > 0 && !wordBoundaryRegex.test(content[currentPos - 1])) {
      currentPos--;
    }
    // If we found a space, don't include it
    if (currentPos > 0 && wordBoundaryRegex.test(content[currentPos - 1])) {
      return currentPos;
    }
  } else {
    // Move forward to find space or end of string
    while (currentPos < content.length && !wordBoundaryRegex.test(content[currentPos])) {
      currentPos++;
    }
  }

  return currentPos;
};

/**
 * Split content into sentences for better truncation
 */
const findSentenceBoundary = (content: string, position: number): number => {
  const sentenceEnders = /[.!?]/;
  let currentPos = position;

  // Look backward for sentence ending
  while (currentPos > 0) {
    if (sentenceEnders.test(content[currentPos])) {
      // Move past the punctuation and any whitespace
      while (currentPos < content.length && /[\s.]/.test(content[currentPos])) {
        currentPos++;
      }
      return currentPos;
    }
    currentPos--;
  }

  // If no sentence boundary found, fall back to word boundary
  return findWordBoundary(content, position, 'backward');
};

/**
 * Enhanced truncation that preserves code structure
 */
export const smartCodeTruncation = (
  code: string,
  maxLines: number,
  searchTerms: string[] = []
): string => {
  const lines = code.split('\n');

  if (lines.length <= maxLines) {
    return code;
  }

  // If we have search terms, try to include relevant lines
  if (searchTerms.length > 0) {
    const matchingLines = new Set<number>();

    lines.forEach((line, index) => {
      for (const term of searchTerms) {
        if (line.toLowerCase().includes(term.toLowerCase())) {
          matchingLines.add(index);
          // Include some context around matching lines
          for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 2); i++) {
            matchingLines.add(i);
          }
        }
      }
    });

    if (matchingLines.size > 0) {
      const sortedLines = Array.from(matchingLines).sort((a, b) => a - b);

      // Take the first set of matching lines that fit within maxLines
      const selectedLines: string[] = [];
      let lastIndex = -1;

      for (const lineIndex of sortedLines) {
        if (selectedLines.length >= maxLines) break;

        // Add gap indicator if there's a jump in line numbers
        if (lastIndex !== -1 && lineIndex > lastIndex + 1) {
          selectedLines.push('// ...');
        }

        selectedLines.push(lines[lineIndex]);
        lastIndex = lineIndex;
      }

      return selectedLines.join('\n');
    }
  }

  // Standard truncation from the beginning
  return lines.slice(0, maxLines).join('\n');
};

export default SmartTruncation;