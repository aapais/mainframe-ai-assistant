import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { CacheService } from './CacheService';
import {
  AutocompleteSuggestion,
  AutocompleteQuery,
} from '../database/schemas/HierarchicalCategories.schema';
export interface AutocompleteConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  maxSuggestions?: number;
  minQueryLength?: number;
  enableFuzzySearch?: boolean;
  enableContextAware?: boolean;
  enableLearning?: boolean;
  scoringWeights?: ScoringWeights;
}
export interface ScoringWeights {
  exactMatch: number;
  prefixMatch: number;
  fuzzyMatch: number;
  usageCount: number;
  recency: number;
  contextRelevance: number;
  popularity: number;
}
export interface SearchContext {
  userId?: string;
  sessionId?: string;
  previousQueries?: string[];
  currentCategory?: string;
  currentEntryId?: string;
  userPreferences?: Record<string, any>;
}
export declare class AutocompleteService extends EventEmitter {
  private db;
  private cacheService?;
  private config;
  private preparedStatements;
  private trieRoot;
  private lastTrieUpdate;
  private readonly TRIE_UPDATE_INTERVAL;
  constructor(db: Database.Database, cacheService?: CacheService, config?: AutocompleteConfig);
  private initializePreparedStatements;
  getSuggestions(
    query: AutocompleteQuery,
    context?: SearchContext
  ): Promise<AutocompleteSuggestion[]>;
  recordSelection(
    query: string,
    selectedSuggestion: AutocompleteSuggestion,
    context?: SearchContext
  ): Promise<void>;
  getPopularSuggestions(limit?: number): Promise<AutocompleteSuggestion[]>;
  getRecentSuggestions(userId: string, limit?: number): Promise<AutocompleteSuggestion[]>;
  rebuildCache(): Promise<void>;
  private aggregateSuggestions;
  private rankSuggestions;
  private mapRowToSuggestion;
  private buildCacheKey;
  private learnFromQuery;
  private buildTrie;
  private insertIntoTrie;
  private getTrieSuggestions;
  private updateTrieWithFeedback;
  private shouldUpdateTrie;
  private cacheFromCategories;
  private cacheFromTags;
  private cacheFromEntries;
  private cacheFromSearchHistory;
  cleanup(): void;
}
export default AutocompleteService;
//# sourceMappingURL=AutocompleteService.d.ts.map
