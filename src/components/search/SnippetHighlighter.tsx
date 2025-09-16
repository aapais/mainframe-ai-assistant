import React, { useMemo } from 'react';

interface SnippetHighlighterProps {
  content: string;
  searchTerms: string[];
  contextRadius?: number;
  maxSnippets?: number;
  className?: string;
  highlightClassName?: string;
}

interface HighlightMatch {
  start: number;
  end: number;
  term: string;
}

const SnippetHighlighter: React.FC<SnippetHighlighterProps> = ({
  content,
  searchTerms,
  contextRadius = 50,
  maxSnippets = 3,
  className = '',
  highlightClassName = 'bg-yellow-200 font-semibold px-1 rounded'
}) => {
  const highlightedContent = useMemo(() => {
    if (!content || searchTerms.length === 0) {
      return content;
    }

    // Find all matches
    const matches: HighlightMatch[] = [];
    const cleanTerms = searchTerms.filter(term => term.trim().length > 0);

    for (const term of cleanTerms) {
      const trimmedTerm = term.trim();
      if (trimmedTerm.length === 0) continue;

      const regex = new RegExp(escapeRegExp(trimmedTerm), 'gi');
      let match;

      while ((match = regex.exec(content)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          term: trimmedTerm
        });
      }
    }

    if (matches.length === 0) {
      return content;
    }

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Merge overlapping matches
    const mergedMatches: HighlightMatch[] = [];
    for (const match of matches) {
      const lastMatch = mergedMatches[mergedMatches.length - 1];

      if (lastMatch && match.start <= lastMatch.end) {
        // Extend the last match
        lastMatch.end = Math.max(lastMatch.end, match.end);
      } else {
        mergedMatches.push({ ...match });
      }
    }

    // Build highlighted content
    let result: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    mergedMatches.forEach((match, matchIndex) => {
      // Add text before the match
      if (lastIndex < match.start) {
        result.push(content.slice(lastIndex, match.start));
      }

      // Add highlighted match
      result.push(
        <mark
          key={`highlight-${matchIndex}`}
          className={highlightClassName}
          data-term={match.term}
        >
          {content.slice(match.start, match.end)}
        </mark>
      );

      lastIndex = match.end;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      result.push(content.slice(lastIndex));
    }

    return result;
  }, [content, searchTerms, highlightClassName]);

  const snippets = useMemo(() => {
    if (!content || searchTerms.length === 0) {
      return null;
    }

    // Find match positions for snippet creation
    const matches: { position: number; term: string }[] = [];
    const cleanTerms = searchTerms.filter(term => term.trim().length > 0);

    for (const term of cleanTerms) {
      const trimmedTerm = term.trim();
      const regex = new RegExp(escapeRegExp(trimmedTerm), 'gi');
      let match;

      while ((match = regex.exec(content)) !== null) {
        matches.push({
          position: match.index,
          term: trimmedTerm
        });
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // Sort by position
    matches.sort((a, b) => a.position - b.position);

    // Create snippets with context
    const snippetRanges: { start: number; end: number; matches: typeof matches }[] = [];

    for (const match of matches.slice(0, maxSnippets)) {
      const start = Math.max(0, match.position - contextRadius);
      const end = Math.min(content.length, match.position + contextRadius);

      // Check if this snippet overlaps with an existing one
      let merged = false;
      for (const snippet of snippetRanges) {
        if (start <= snippet.end && end >= snippet.start) {
          // Merge snippets
          snippet.start = Math.min(snippet.start, start);
          snippet.end = Math.max(snippet.end, end);
          snippet.matches.push(match);
          merged = true;
          break;
        }
      }

      if (!merged) {
        snippetRanges.push({ start, end, matches: [match] });
      }
    }

    return snippetRanges.map((range, index) => {
      const snippetText = content.slice(range.start, range.end);
      const isAtStart = range.start === 0;
      const isAtEnd = range.end === content.length;

      return {
        id: index,
        text: snippetText,
        start: range.start,
        end: range.end,
        isAtStart,
        isAtEnd,
        matches: range.matches
      };
    });
  }, [content, searchTerms, contextRadius, maxSnippets]);

  // If we're showing snippets, render them instead of full content
  if (snippets && snippets.length > 0 && content.length > contextRadius * 4) {
    return (
      <div className={`snippet-highlighter ${className}`}>
        {snippets.map((snippet, index) => (
          <div key={snippet.id} className="snippet-container mb-2">
            {index > 0 && (
              <div className="snippet-separator text-gray-400 text-center my-2">...</div>
            )}
            <div className="snippet-content">
              {!snippet.isAtStart && (
                <span className="text-gray-400">...</span>
              )}
              <SnippetHighlighter
                content={snippet.text}
                searchTerms={searchTerms}
                contextRadius={0} // Prevent recursive snippeting
                className=""
                highlightClassName={highlightClassName}
              />
              {!snippet.isAtEnd && (
                <span className="text-gray-400">...</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render full content with highlights
  return (
    <span className={`snippet-highlighter ${className}`}>
      {Array.isArray(highlightedContent)
        ? highlightedContent.map((part, index) =>
            typeof part === 'string'
              ? <span key={index}>{part}</span>
              : part
          )
        : highlightedContent
      }
    </span>
  );
};

/**
 * Escape special regex characters
 */
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Enhanced snippet highlighter with fuzzy matching
 */
export const FuzzySnippetHighlighter: React.FC<SnippetHighlighterProps & {
  fuzzyMatch?: boolean;
  caseSensitive?: boolean;
}> = ({
  content,
  searchTerms,
  fuzzyMatch = false,
  caseSensitive = false,
  ...props
}) => {
  const processedTerms = useMemo(() => {
    if (!fuzzyMatch) {
      return searchTerms;
    }

    // For fuzzy matching, create variations of search terms
    const variations: string[] = [];

    for (const term of searchTerms) {
      const cleaned = term.trim();
      if (cleaned.length === 0) continue;

      variations.push(cleaned);

      // Add partial matches (for typos)
      if (cleaned.length > 3) {
        // Remove last character
        variations.push(cleaned.slice(0, -1));
        // Remove first character
        variations.push(cleaned.slice(1));
      }
    }

    return variations;
  }, [searchTerms, fuzzyMatch]);

  return (
    <SnippetHighlighter
      {...props}
      content={content}
      searchTerms={processedTerms}
    />
  );
};

/**
 * Snippet highlighter optimized for code content
 */
export const CodeSnippetHighlighter: React.FC<SnippetHighlighterProps & {
  language?: string;
  showLineNumbers?: boolean;
}> = ({
  content,
  searchTerms,
  language = 'text',
  showLineNumbers = false,
  className = '',
  ...props
}) => {
  const lines = content.split('\n');

  if (showLineNumbers) {
    return (
      <div className={`code-snippet-highlighter ${className}`}>
        {lines.map((line, index) => (
          <div key={index} className="code-line flex">
            <span className="line-number text-gray-400 text-xs mr-3 select-none min-w-[2rem] text-right">
              {index + 1}
            </span>
            <span className="line-content flex-1">
              <SnippetHighlighter
                {...props}
                content={line}
                searchTerms={searchTerms}
                className=""
              />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <SnippetHighlighter
      {...props}
      content={content}
      searchTerms={searchTerms}
      className={`code-snippet-highlighter ${className}`}
    />
  );
};

export default SnippetHighlighter;