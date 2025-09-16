import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export interface MatchData {
  text: string;
  matches: {
    start: number;
    end: number;
    type: 'exact' | 'partial' | 'fuzzy' | 'semantic';
    score: number;
    query: string;
  }[];
  caseSensitive?: boolean;
}

export interface MatchHighlighterProps {
  matchData: MatchData;
  highlightClassName?: string;
  exactMatchClassName?: string;
  partialMatchClassName?: string;
  fuzzyMatchClassName?: string;
  semanticMatchClassName?: string;
  animated?: boolean;
  showTooltips?: boolean;
  maxLength?: number;
  truncateStrategy?: 'start' | 'middle' | 'end' | 'around-matches';
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  onMatchClick?: (match: MatchData['matches'][0], text: string) => void;
  'aria-label'?: string;
}

const MatchHighlighter: React.FC<MatchHighlighterProps> = ({
  matchData,
  highlightClassName = '',
  exactMatchClassName = 'bg-yellow-200 font-semibold',
  partialMatchClassName = 'bg-blue-100 font-medium',
  fuzzyMatchClassName = 'bg-orange-100',
  semanticMatchClassName = 'bg-purple-100',
  animated = true,
  showTooltips = false,
  maxLength,
  truncateStrategy = 'around-matches',
  className = '',
  as: Component = 'span',
  onMatchClick,
  'aria-label': ariaLabel
}) => {
  const processedData = useMemo(() => {
    let { text, matches } = matchData;

    // Sort matches by start position
    const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

    // Handle text truncation if needed
    if (maxLength && text.length > maxLength) {
      const truncated = truncateText(text, sortedMatches, maxLength, truncateStrategy);
      text = truncated.text;
      // Adjust match positions after truncation
      const offsetAdjustment = truncated.offset;
      sortedMatches.forEach(match => {
        match.start = Math.max(0, match.start - offsetAdjustment);
        match.end = Math.max(0, match.end - offsetAdjustment);
      });
      // Filter out matches that are now outside the truncated text
      const validMatches = sortedMatches.filter(match =>
        match.start < text.length && match.end > 0
      );
      return { text, matches: validMatches };
    }

    return { text, matches: sortedMatches };
  }, [matchData, maxLength, truncateStrategy]);

  const truncateText = (
    text: string,
    matches: MatchData['matches'],
    maxLength: number,
    strategy: string
  ): { text: string; offset: number } => {
    if (text.length <= maxLength) {
      return { text, offset: 0 };
    }

    switch (strategy) {
      case 'start':
        return { text: text.substring(0, maxLength - 3) + '...', offset: 0 };

      case 'end':
        const offset = text.length - maxLength + 3;
        return { text: '...' + text.substring(offset), offset: offset - 3 };

      case 'middle':
        const midOffset = Math.floor((text.length - maxLength + 6) / 2);
        return {
          text: text.substring(0, maxLength / 2 - 3) + '...' + text.substring(text.length - maxLength / 2 + 3),
          offset: midOffset
        };

      case 'around-matches':
        if (matches.length === 0) {
          return { text: text.substring(0, maxLength - 3) + '...', offset: 0 };
        }

        // Find the best range that includes the most important matches
        const firstMatch = matches[0];
        const lastMatch = matches[matches.length - 1];
        const matchSpan = lastMatch.end - firstMatch.start;

        if (matchSpan <= maxLength) {
          // All matches can fit, center around them
          const center = (firstMatch.start + lastMatch.end) / 2;
          const start = Math.max(0, Math.floor(center - maxLength / 2));
          const end = Math.min(text.length, start + maxLength);
          const actualStart = Math.max(0, end - maxLength);

          let result = text.substring(actualStart, end);
          if (actualStart > 0) result = '...' + result.substring(3);
          if (end < text.length) result = result.substring(0, result.length - 3) + '...';

          return { text: result, offset: actualStart };
        } else {
          // Focus on the highest-scoring matches
          const bestMatch = matches.reduce((best, current) =>
            current.score > best.score ? current : best
          );
          const center = (bestMatch.start + bestMatch.end) / 2;
          const start = Math.max(0, Math.floor(center - maxLength / 2));
          const end = Math.min(text.length, start + maxLength);
          const actualStart = Math.max(0, end - maxLength);

          let result = text.substring(actualStart, end);
          if (actualStart > 0) result = '...' + result.substring(3);
          if (end < text.length) result = result.substring(0, result.length - 3) + '...';

          return { text: result, offset: actualStart };
        }

      default:
        return { text: text.substring(0, maxLength - 3) + '...', offset: 0 };
    }
  };

  const getMatchClassName = (matchType: MatchData['matches'][0]['type']) => {
    const baseClasses = 'match-highlight transition-colors duration-200 cursor-pointer';
    const typeClasses = {
      exact: exactMatchClassName,
      partial: partialMatchClassName,
      fuzzy: fuzzyMatchClassName,
      semantic: semanticMatchClassName
    };

    return `${baseClasses} ${typeClasses[matchType]} ${highlightClassName}`.trim();
  };

  const renderHighlightedText = () => {
    const { text, matches } = processedData;

    if (matches.length === 0) {
      return text;
    }

    const segments: React.ReactNode[] = [];
    let currentPosition = 0;

    // Merge overlapping matches
    const mergedMatches = mergeOverlappingMatches(matches);

    mergedMatches.forEach((match, index) => {
      // Add text before the match
      if (currentPosition < match.start) {
        segments.push(
          <span key={`text-${index}`}>
            {text.substring(currentPosition, match.start)}
          </span>
        );
      }

      // Add the highlighted match
      const matchText = text.substring(match.start, match.end);
      const highlightElement = (
        <motion.mark
          key={`match-${index}`}
          className={getMatchClassName(match.type)}
          initial={animated ? { backgroundColor: 'transparent' } : false}
          animate={animated ? { backgroundColor: 'currentColor' } : false}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          onClick={() => onMatchClick?.(match, matchText)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onMatchClick?.(match, matchText);
            }
          }}
          role={onMatchClick ? 'button' : undefined}
          tabIndex={onMatchClick ? 0 : undefined}
          title={showTooltips ? `${match.type} match (${Math.round(match.score * 100)}%)` : undefined}
          aria-label={showTooltips ? `${match.type} match for "${match.query}" with ${Math.round(match.score * 100)}% confidence` : undefined}
          style={{
            backgroundColor: 'transparent',
            color: 'inherit'
          }}
        >
          {matchText}
        </motion.mark>
      );

      segments.push(highlightElement);
      currentPosition = match.end;
    });

    // Add remaining text after the last match
    if (currentPosition < text.length) {
      segments.push(
        <span key="text-final">
          {text.substring(currentPosition)}
        </span>
      );
    }

    return segments;
  };

  const mergeOverlappingMatches = (matches: MatchData['matches']) => {
    if (matches.length <= 1) return matches;

    const merged: MatchData['matches'] = [];
    let currentMatch = { ...matches[0] };

    for (let i = 1; i < matches.length; i++) {
      const nextMatch = matches[i];

      if (nextMatch.start <= currentMatch.end) {
        // Overlapping or adjacent matches - merge them
        currentMatch.end = Math.max(currentMatch.end, nextMatch.end);
        // Use the higher score and more specific type
        if (nextMatch.score > currentMatch.score) {
          currentMatch.type = nextMatch.type;
          currentMatch.score = nextMatch.score;
          currentMatch.query = nextMatch.query;
        }
      } else {
        // No overlap - add current match and start new one
        merged.push(currentMatch);
        currentMatch = { ...nextMatch };
      }
    }

    merged.push(currentMatch);
    return merged;
  };

  const getAriaLabel = () => {
    if (ariaLabel) return ariaLabel;

    const matchCount = processedData.matches.length;
    if (matchCount === 0) return undefined;

    const matchTypes = [...new Set(processedData.matches.map(m => m.type))];
    return `Text with ${matchCount} ${matchCount === 1 ? 'match' : 'matches'} of type: ${matchTypes.join(', ')}`;
  };

  return (
    <Component
      className={`match-highlighter ${className}`.trim()}
      aria-label={getAriaLabel()}
    >
      {renderHighlightedText()}
    </Component>
  );
};

export default MatchHighlighter;