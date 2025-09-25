/**
 * Autocomplete Service
 * Advanced autocomplete and suggestion engine with machine learning-inspired ranking
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { CacheService } from './CacheService';
import {
  AutocompleteSuggestion,
  AutocompleteQuery,
  HierarchicalSchemaValidator,
} from '../database/schemas/HierarchicalCategories.schema';
import { AppError, ErrorCode } from '../core/errors/AppError';

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

export class AutocompleteService extends EventEmitter {
  private db: Database.Database;
  private cacheService?: CacheService;
  private config: Required<AutocompleteConfig>;
  private preparedStatements: Map<string, Database.Statement> = new Map();

  // Trie data structure for fast prefix matching
  private trieRoot: TrieNode = { children: new Map(), suggestions: [] };
  private lastTrieUpdate: number = 0;
  private readonly TRIE_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(db: Database.Database, cacheService?: CacheService, config: AutocompleteConfig = {}) {
    super();

    this.db = db;
    this.cacheService = cacheService;
    this.config = {
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? 60, // 1 minute for autocomplete
      maxSuggestions: config.maxSuggestions ?? 10,
      minQueryLength: config.minQueryLength ?? 1,
      enableFuzzySearch: config.enableFuzzySearch ?? true,
      enableContextAware: config.enableContextAware ?? true,
      enableLearning: config.enableLearning ?? true,
      scoringWeights: {
        exactMatch: 100,
        prefixMatch: 80,
        fuzzyMatch: 60,
        usageCount: 0.1,
        recency: 0.05,
        contextRelevance: 20,
        popularity: 0.02,
        ...config.scoringWeights,
      },
    };

    this.initializePreparedStatements();
    this.buildTrie();
  }

  private initializePreparedStatements(): void {
    // Category suggestions
    this.preparedStatements.set(
      'categorySuggestions',
      this.db.prepare(`
      SELECT
        id,
        'category' as type,
        slug as value,
        name as display_value,
        description,
        entry_count as usage_count,
        updated_at as last_used
      FROM categories
      WHERE is_active = TRUE AND (
        name LIKE ? OR slug LIKE ? OR description LIKE ?
      )
      ORDER BY entry_count DESC, name ASC
      LIMIT ?
    `)
    );

    // Tag suggestions
    this.preparedStatements.set(
      'tagSuggestions',
      this.db.prepare(`
      SELECT
        id,
        'tag' as type,
        name as value,
        display_name as display_value,
        description,
        usage_count,
        updated_at as last_used
      FROM tags
      WHERE (name LIKE ? OR display_name LIKE ? OR description LIKE ?)
      ORDER BY usage_count DESC, name ASC
      LIMIT ?
    `)
    );

    // Entry suggestions (titles)
    this.preparedStatements.set(
      'entrySuggestions',
      this.db.prepare(`
      SELECT
        id,
        'entry' as type,
        title as value,
        title as display_value,
        SUBSTR(problem, 1, 100) as description,
        usage_count,
        last_used
      FROM kb_entries
      WHERE archived = FALSE AND (
        title LIKE ? OR problem LIKE ?
      )
      ORDER BY usage_count DESC, updated_at DESC
      LIMIT ?
    `)
    );

    // Search term suggestions from history
    this.preparedStatements.set(
      'searchTermSuggestions',
      this.db.prepare(`
      SELECT
        'search_term' as type,
        query as value,
        query as display_value,
        'Recent search' as description,
        COUNT(*) as usage_count,
        MAX(timestamp) as last_used
      FROM search_history
      WHERE query LIKE ?
      GROUP BY query
      ORDER BY usage_count DESC, last_used DESC
      LIMIT ?
    `)
    );

    // FTS-based suggestions
    this.preparedStatements.set(
      'ftsSuggestions',
      this.db.prepare(`
      SELECT DISTINCT
        t.id,
        'tag' as type,
        t.name as value,
        t.display_name as display_value,
        t.description,
        t.usage_count,
        t.updated_at as last_used,
        rank
      FROM tags_fts fts
      JOIN tags t ON fts.id = t.id
      WHERE tags_fts MATCH ?
      ORDER BY rank, usage_count DESC
      LIMIT ?
    `)
    );

    // Context-aware suggestions based on current entry
    this.preparedStatements.set(
      'contextSuggestions',
      this.db.prepare(`
      SELECT DISTINCT
        t.id,
        'tag' as type,
        t.name as value,
        t.display_name as display_value,
        t.description,
        t.usage_count + COALESCE(context_boost.boost, 0) as effective_usage,
        t.updated_at as last_used
      FROM tags t
      LEFT JOIN (
        SELECT
          ta2.tag_id,
          COUNT(*) * 5 as boost
        FROM tag_associations ta1
        JOIN tag_associations ta2 ON ta1.entry_id != ta2.entry_id
        WHERE ta1.tag_id IN (
          SELECT tag_id FROM tag_associations WHERE entry_id = ?
        )
        GROUP BY ta2.tag_id
      ) context_boost ON t.id = context_boost.tag_id
      WHERE (t.name LIKE ? OR t.display_name LIKE ?)
      ORDER BY effective_usage DESC
      LIMIT ?
    `)
    );

    // Update autocomplete cache
    this.preparedStatements.set(
      'updateCache',
      this.db.prepare(`
      INSERT OR REPLACE INTO autocomplete_cache (
        id, type, value, display_value, description, score, usage_count, last_used, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    );

    // Record usage for learning
    this.preparedStatements.set(
      'recordUsage',
      this.db.prepare(`
      UPDATE autocomplete_cache
      SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
      WHERE type = ? AND value = ?
    `)
    );
  }

  /**
   * Get autocomplete suggestions
   */
  async getSuggestions(
    query: AutocompleteQuery,
    context?: SearchContext
  ): Promise<AutocompleteSuggestion[]> {
    try {
      // Validate query
      const validatedQuery = HierarchicalSchemaValidator.validateAutocompleteQuery(query);

      if (validatedQuery.query.length < this.config.minQueryLength) {
        return [];
      }

      const cacheKey = this.buildCacheKey(validatedQuery, context);

      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<AutocompleteSuggestion[]>(cacheKey);
        if (cached) {
          this.emit('autocomplete:cache_hit', { query: validatedQuery.query });
          return cached;
        }
      }

      // Get suggestions from multiple sources
      const suggestions = await this.aggregateSuggestions(validatedQuery, context);

      // Rank and score suggestions
      const rankedSuggestions = this.rankSuggestions(suggestions, validatedQuery, context);

      // Limit results
      const finalSuggestions = rankedSuggestions.slice(0, validatedQuery.limit);

      // Cache results
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, finalSuggestions, this.config.cacheTTL);
      }

      // Learn from this query if learning is enabled
      if (this.config.enableLearning) {
        this.learnFromQuery(validatedQuery.query, finalSuggestions, context);
      }

      this.emit('autocomplete:suggestions_generated', {
        query: validatedQuery.query,
        resultCount: finalSuggestions.length,
        sources: Array.from(new Set(suggestions.map(s => s.type))),
      });

      return finalSuggestions;
    } catch (error) {
      this.emit('autocomplete:error', { action: 'get_suggestions', error, query, context });
      throw error;
    }
  }

  /**
   * Record that a suggestion was selected
   */
  async recordSelection(
    query: string,
    selectedSuggestion: AutocompleteSuggestion,
    context?: SearchContext
  ): Promise<void> {
    try {
      if (!this.config.enableLearning) {
        return;
      }

      // Update usage count in cache
      this.preparedStatements
        .get('recordUsage')!
        .run(selectedSuggestion.type, selectedSuggestion.value);

      // Update trie with selection feedback
      this.updateTrieWithFeedback(query, selectedSuggestion);

      // Emit event for analytics
      this.emit('autocomplete:selection_recorded', {
        query,
        suggestion: selectedSuggestion,
        context,
      });
    } catch (error) {
      this.emit('autocomplete:error', {
        action: 'record_selection',
        error,
        query,
        selectedSuggestion,
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Get popular suggestions (trending terms)
   */
  async getPopularSuggestions(limit: number = 10): Promise<AutocompleteSuggestion[]> {
    const cacheKey = `autocomplete:popular:${limit}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<AutocompleteSuggestion[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get most used suggestions
      const popular = this.db
        .prepare(
          `
        SELECT
          id,
          type,
          value,
          display_value,
          description,
          score,
          usage_count,
          last_used
        FROM autocomplete_cache
        ORDER BY usage_count DESC, last_used DESC
        LIMIT ?
      `
        )
        .all(limit) as any[];

      const suggestions = popular.map(row => this.mapRowToSuggestion(row));

      // Cache results
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, suggestions, this.config.cacheTTL * 5); // Longer cache for popular
      }

      return suggestions;
    } catch (error) {
      this.emit('autocomplete:error', { action: 'get_popular', error, limit });
      throw error;
    }
  }

  /**
   * Get recent suggestions for a user
   */
  async getRecentSuggestions(
    userId: string,
    limit: number = 10
  ): Promise<AutocompleteSuggestion[]> {
    try {
      // This would typically query user-specific search history
      // For now, we'll return recent search terms
      const recent = this.db
        .prepare(
          `
        SELECT DISTINCT
          'search_term' as type,
          query as value,
          query as display_value,
          'Recent search' as description,
          1 as usage_count,
          timestamp as last_used
        FROM search_history
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `
        )
        .all(userId, limit) as any[];

      return recent.map(row => this.mapRowToSuggestion(row));
    } catch (error) {
      this.emit('autocomplete:error', { action: 'get_recent', error, userId, limit });
      throw error;
    }
  }

  /**
   * Rebuild autocomplete cache
   */
  async rebuildCache(): Promise<void> {
    try {
      // Clear existing cache
      this.db.prepare('DELETE FROM autocomplete_cache').run();

      // Rebuild from various sources
      await this.cacheFromCategories();
      await this.cacheFromTags();
      await this.cacheFromEntries();
      await this.cacheFromSearchHistory();

      // Rebuild trie
      await this.buildTrie();

      this.emit('autocomplete:cache_rebuilt');
    } catch (error) {
      this.emit('autocomplete:error', { action: 'rebuild_cache', error });
      throw error;
    }
  }

  /**
   * Private methods
   */
  private async aggregateSuggestions(
    query: AutocompleteQuery,
    context?: SearchContext
  ): Promise<AutocompleteSuggestion[]> {
    const allSuggestions: AutocompleteSuggestion[] = [];
    const queryPattern = `%${query.query}%`;
    const prefixPattern = `${query.query}%`;

    // 1. Fast trie-based prefix matching
    if (this.shouldUpdateTrie()) {
      await this.buildTrie();
    }
    const trieSuggestions = this.getTrieSuggestions(query.query, query.limit);
    allSuggestions.push(...trieSuggestions);

    // 2. Category suggestions
    if (query.types.includes('category')) {
      const categoryRows = this.preparedStatements
        .get('categorySuggestions')!
        .all(queryPattern, prefixPattern, queryPattern, query.limit) as any[];
      allSuggestions.push(...categoryRows.map(row => this.mapRowToSuggestion(row)));
    }

    // 3. Tag suggestions
    if (query.types.includes('tag')) {
      const tagRows = this.preparedStatements
        .get('tagSuggestions')!
        .all(queryPattern, queryPattern, queryPattern, query.limit) as any[];
      allSuggestions.push(...tagRows.map(row => this.mapRowToSuggestion(row)));

      // FTS search for tags if fuzzy search is enabled
      if (this.config.enableFuzzySearch) {
        const ftsRows = this.preparedStatements
          .get('ftsSuggestions')!
          .all(query.query, query.limit) as any[];
        allSuggestions.push(...ftsRows.map(row => this.mapRowToSuggestion(row)));
      }
    }

    // 4. Entry suggestions
    if (query.types.includes('entry')) {
      const entryRows = this.preparedStatements
        .get('entrySuggestions')!
        .all(queryPattern, queryPattern, query.limit) as any[];
      allSuggestions.push(...entryRows.map(row => this.mapRowToSuggestion(row)));
    }

    // 5. Search term suggestions
    if (query.types.includes('search_term')) {
      const searchRows = this.preparedStatements
        .get('searchTermSuggestions')!
        .all(queryPattern, query.limit) as any[];
      allSuggestions.push(...searchRows.map(row => this.mapRowToSuggestion(row)));
    }

    // 6. Context-aware suggestions
    if (this.config.enableContextAware && context?.currentEntryId) {
      const contextRows = this.preparedStatements
        .get('contextSuggestions')!
        .all(context.currentEntryId, queryPattern, queryPattern, query.limit) as any[];
      allSuggestions.push(...contextRows.map(row => this.mapRowToSuggestion(row)));
    }

    return allSuggestions;
  }

  private rankSuggestions(
    suggestions: AutocompleteSuggestion[],
    query: AutocompleteQuery,
    context?: SearchContext
  ): AutocompleteSuggestion[] {
    const queryLower = query.query.toLowerCase();
    const now = Date.now();

    // Remove duplicates and calculate scores
    const uniqueSuggestions = new Map<string, AutocompleteSuggestion>();

    for (const suggestion of suggestions) {
      const key = `${suggestion.type}:${suggestion.value}`;

      if (uniqueSuggestions.has(key)) {
        // Merge duplicate suggestions by taking the higher score
        const existing = uniqueSuggestions.get(key)!;
        if (suggestion.score > existing.score) {
          uniqueSuggestions.set(key, suggestion);
        }
        continue;
      }

      // Calculate comprehensive score
      let score = 0;
      const valueLower = suggestion.value.toLowerCase();
      const displayLower = suggestion.display_value.toLowerCase();

      // Exact match bonus
      if (valueLower === queryLower || displayLower === queryLower) {
        score += this.config.scoringWeights.exactMatch;
      }
      // Prefix match bonus
      else if (valueLower.startsWith(queryLower) || displayLower.startsWith(queryLower)) {
        score += this.config.scoringWeights.prefixMatch;
      }
      // Contains match
      else if (valueLower.includes(queryLower) || displayLower.includes(queryLower)) {
        score += this.config.scoringWeights.fuzzyMatch;
      }

      // Usage count bonus
      if (suggestion.usage_count) {
        score += suggestion.usage_count * this.config.scoringWeights.usageCount;
      }

      // Recency bonus
      if (suggestion.last_used) {
        const ageHours = (now - new Date(suggestion.last_used).getTime()) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 24 - ageHours) * this.config.scoringWeights.recency;
        score += recencyScore;
      }

      // Context relevance
      if (context) {
        // Category context
        if (
          context.currentCategory &&
          suggestion.metadata?.categoryId === context.currentCategory
        ) {
          score += this.config.scoringWeights.contextRelevance;
        }

        // Previous queries context
        if (context.previousQueries?.some(pq => pq.includes(queryLower))) {
          score += this.config.scoringWeights.contextRelevance * 0.5;
        }
      }

      // Type-specific adjustments
      switch (suggestion.type) {
        case 'category':
          score *= 1.1; // Slight boost for categories
          break;
        case 'tag':
          score *= 1.0; // Neutral
          break;
        case 'entry':
          score *= 0.9; // Slight penalty for entries (usually too specific)
          break;
        case 'search_term':
          score *= 1.2; // Boost for search terms (proven useful)
          break;
      }

      // Apply final score
      suggestion.score = Math.round(score);
      uniqueSuggestions.set(key, suggestion);
    }

    // Sort by score and return
    return Array.from(uniqueSuggestions.values()).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Secondary sort by usage count
      return (b.usage_count || 0) - (a.usage_count || 0);
    });
  }

  private mapRowToSuggestion(row: any): AutocompleteSuggestion {
    return {
      id: row.id?.toString() || `${row.type}:${row.value}`,
      type: row.type,
      value: row.value,
      display_value: row.display_value,
      description: row.description,
      score: row.score || 50,
      usage_count: row.usage_count || 0,
      last_used: row.last_used ? new Date(row.last_used) : undefined,
      metadata: {
        rank: row.rank,
        categoryId: row.category_id,
        effectiveUsage: row.effective_usage,
      },
    };
  }

  private buildCacheKey(query: AutocompleteQuery, context?: SearchContext): string {
    const parts = ['autocomplete', query.query, query.types.join(','), query.limit.toString()];

    if (context) {
      if (context.currentCategory) parts.push(`cat:${context.currentCategory}`);
      if (context.currentEntryId) parts.push(`entry:${context.currentEntryId}`);
      if (context.userId) parts.push(`user:${context.userId}`);
    }

    return parts.join(':');
  }

  private learnFromQuery(
    query: string,
    suggestions: AutocompleteSuggestion[],
    context?: SearchContext
  ): void {
    // Update autocomplete cache with new data
    for (const suggestion of suggestions) {
      try {
        this.preparedStatements
          .get('updateCache')!
          .run(
            suggestion.id,
            suggestion.type,
            suggestion.value,
            suggestion.display_value,
            suggestion.description,
            suggestion.score,
            suggestion.usage_count || 0,
            suggestion.last_used || new Date()
          );
      } catch (error) {
        // Ignore individual update failures
      }
    }
  }

  // Trie-based fast prefix matching
  private async buildTrie(): Promise<void> {
    this.trieRoot = { children: new Map(), suggestions: [] };

    // Build from categories
    const categories = this.db
      .prepare(
        `
      SELECT name, slug, id, entry_count FROM categories WHERE is_active = TRUE
    `
      )
      .all() as any[];

    for (const cat of categories) {
      this.insertIntoTrie(cat.name.toLowerCase(), {
        id: cat.id,
        type: 'category',
        value: cat.slug,
        display_value: cat.name,
        score: 50 + (cat.entry_count || 0) * 0.1,
        usage_count: cat.entry_count || 0,
      });
    }

    // Build from tags
    const tags = this.db
      .prepare(
        `
      SELECT name, display_name, id, usage_count FROM tags ORDER BY usage_count DESC LIMIT 1000
    `
      )
      .all() as any[];

    for (const tag of tags) {
      this.insertIntoTrie(tag.name.toLowerCase(), {
        id: tag.id,
        type: 'tag',
        value: tag.name,
        display_value: tag.display_name,
        score: 50 + (tag.usage_count || 0) * 0.1,
        usage_count: tag.usage_count || 0,
      });
    }

    this.lastTrieUpdate = Date.now();
  }

  private insertIntoTrie(word: string, suggestion: Partial<AutocompleteSuggestion>): void {
    let node = this.trieRoot;

    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map(), suggestions: [] });
      }
      node = node.children.get(char)!;
    }

    // Add suggestion to this node and parent nodes for prefix matching
    const fullSuggestion: AutocompleteSuggestion = {
      id: suggestion.id || '',
      type: suggestion.type as any,
      value: suggestion.value || '',
      display_value: suggestion.display_value || '',
      score: suggestion.score || 50,
      usage_count: suggestion.usage_count,
      ...suggestion,
    };

    node.suggestions.push(fullSuggestion);

    // Limit suggestions per node to prevent memory bloat
    if (node.suggestions.length > 20) {
      node.suggestions = node.suggestions.sort((a, b) => b.score - a.score).slice(0, 20);
    }
  }

  private getTrieSuggestions(query: string, limit: number): AutocompleteSuggestion[] {
    const queryLower = query.toLowerCase();
    let node = this.trieRoot;

    // Navigate to the query prefix
    for (const char of queryLower) {
      if (!node.children.has(char)) {
        return [];
      }
      node = node.children.get(char)!;
    }

    // Collect suggestions from this node and its descendants
    const suggestions = [...node.suggestions];

    // BFS to collect more suggestions from child nodes
    const queue: TrieNode[] = [node];
    while (queue.length > 0 && suggestions.length < limit * 2) {
      const current = queue.shift()!;

      for (const child of current.children.values()) {
        suggestions.push(...child.suggestions);
        queue.push(child);
      }
    }

    // Remove duplicates and sort by score
    const uniqueSuggestions = new Map<string, AutocompleteSuggestion>();
    for (const suggestion of suggestions) {
      const key = `${suggestion.type}:${suggestion.value}`;
      if (!uniqueSuggestions.has(key) || uniqueSuggestions.get(key)!.score < suggestion.score) {
        uniqueSuggestions.set(key, suggestion);
      }
    }

    return Array.from(uniqueSuggestions.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private updateTrieWithFeedback(query: string, selectedSuggestion: AutocompleteSuggestion): void {
    // Boost the score of the selected suggestion in the trie
    const queryLower = query.toLowerCase();
    let node = this.trieRoot;

    for (const char of queryLower) {
      if (!node.children.has(char)) return;
      node = node.children.get(char)!;
    }

    // Find and boost the selected suggestion
    const suggestion = node.suggestions.find(
      s => s.type === selectedSuggestion.type && s.value === selectedSuggestion.value
    );

    if (suggestion) {
      suggestion.score += 5; // Boost score
      suggestion.usage_count = (suggestion.usage_count || 0) + 1;
    }
  }

  private shouldUpdateTrie(): boolean {
    return Date.now() - this.lastTrieUpdate > this.TRIE_UPDATE_INTERVAL;
  }

  private async cacheFromCategories(): Promise<void> {
    const categories = this.db
      .prepare(
        `
      SELECT id, name, slug, description, entry_count, updated_at
      FROM categories WHERE is_active = TRUE
    `
      )
      .all() as any[];

    for (const cat of categories) {
      this.preparedStatements
        .get('updateCache')!
        .run(
          cat.id,
          'category',
          cat.slug,
          cat.name,
          cat.description,
          50 + (cat.entry_count || 0) * 0.1,
          cat.entry_count || 0,
          cat.updated_at
        );
    }
  }

  private async cacheFromTags(): Promise<void> {
    const tags = this.db
      .prepare(
        `
      SELECT id, name, display_name, description, usage_count, updated_at
      FROM tags
    `
      )
      .all() as any[];

    for (const tag of tags) {
      this.preparedStatements
        .get('updateCache')!
        .run(
          tag.id,
          'tag',
          tag.name,
          tag.display_name,
          tag.description,
          50 + (tag.usage_count || 0) * 0.1,
          tag.usage_count || 0,
          tag.updated_at
        );
    }
  }

  private async cacheFromEntries(): Promise<void> {
    const entries = this.db
      .prepare(
        `
      SELECT id, title, usage_count, last_used
      FROM kb_entries WHERE archived = FALSE
      ORDER BY usage_count DESC LIMIT 500
    `
      )
      .all() as any[];

    for (const entry of entries) {
      this.preparedStatements
        .get('updateCache')!
        .run(
          entry.id,
          'entry',
          entry.title,
          entry.title,
          null,
          30 + (entry.usage_count || 0) * 0.05,
          entry.usage_count || 0,
          entry.last_used
        );
    }
  }

  private async cacheFromSearchHistory(): Promise<void> {
    const searches = this.db
      .prepare(
        `
      SELECT query, COUNT(*) as usage_count, MAX(timestamp) as last_used
      FROM search_history
      GROUP BY query
      HAVING usage_count > 1
      ORDER BY usage_count DESC
      LIMIT 200
    `
      )
      .all() as any[];

    for (const search of searches) {
      this.preparedStatements
        .get('updateCache')!
        .run(
          `search_term:${search.query}`,
          'search_term',
          search.query,
          search.query,
          'Previous search',
          20 + search.usage_count * 2,
          search.usage_count,
          search.last_used
        );
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.preparedStatements.forEach(stmt => {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn('Error finalizing statement:', error);
      }
    });
    this.preparedStatements.clear();
    this.removeAllListeners();
  }
}

// Trie node interface
interface TrieNode {
  children: Map<string, TrieNode>;
  suggestions: AutocompleteSuggestion[];
}

export default AutocompleteService;
