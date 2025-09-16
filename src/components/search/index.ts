// Ranking and Relevance Components
export { default as RankingIndicator } from './RankingIndicator';
export type { RankingIndicatorProps, RankingData } from './RankingIndicator';

export { default as RelevanceScore } from './RelevanceScore';
export type { RelevanceScoreProps, RelevanceScoreData } from './RelevanceScore';

export { default as RankingExplanation } from './RankingExplanation';
export type { RankingExplanationProps, ExplanationData } from './RankingExplanation';

export { default as MatchHighlighter } from './MatchHighlighter';
export type { MatchHighlighterProps, MatchData } from './MatchHighlighter';

export { default as ComparisonView } from './ComparisonView';
export type { ComparisonViewProps, ComparisonItem } from './ComparisonView';

// Re-export existing components (if the index.ts file exists)
export * from './SearchInterface';
export * from './SearchResults';
export * from './SearchFilters';
export * from './SmartSearchInterface';
export * from './IntelligentSearchInput';
export * from './PredictiveSearchSuggestions';
export * from './ResponsiveSearchLayout';
export * from './EnhancedSearchResults';
export * from './IncrementalSearchResults';
export * from './SearchResultsOptimized';
export * from './VirtualizedResultsContainer';
export * from './SnippetPreview';
export * from './SearchInterfaceExample';

// Advanced filtering system
export * from './FilterPanel';
export * from './FacetedFilter';
export * from './DateRangeFilter';
export * from './QueryBuilder';
export * from './FilterPresets';