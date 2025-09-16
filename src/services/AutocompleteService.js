"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutocompleteService = void 0;
const events_1 = require("events");
const HierarchicalCategories_schema_1 = require("../database/schemas/HierarchicalCategories.schema");
class AutocompleteService extends events_1.EventEmitter {
    db;
    cacheService;
    config;
    preparedStatements = new Map();
    trieRoot = { children: new Map(), suggestions: [] };
    lastTrieUpdate = 0;
    TRIE_UPDATE_INTERVAL = 5 * 60 * 1000;
    constructor(db, cacheService, config = {}) {
        super();
        this.db = db;
        this.cacheService = cacheService;
        this.config = {
            cacheEnabled: config.cacheEnabled ?? true,
            cacheTTL: config.cacheTTL ?? 60,
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
                ...config.scoringWeights
            }
        };
        this.initializePreparedStatements();
        this.buildTrie();
    }
    initializePreparedStatements() {
        this.preparedStatements.set('categorySuggestions', this.db.prepare(`
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
    `));
        this.preparedStatements.set('tagSuggestions', this.db.prepare(`
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
    `));
        this.preparedStatements.set('entrySuggestions', this.db.prepare(`
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
    `));
        this.preparedStatements.set('searchTermSuggestions', this.db.prepare(`
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
    `));
        this.preparedStatements.set('ftsSuggestions', this.db.prepare(`
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
    `));
        this.preparedStatements.set('contextSuggestions', this.db.prepare(`
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
    `));
        this.preparedStatements.set('updateCache', this.db.prepare(`
      INSERT OR REPLACE INTO autocomplete_cache (
        id, type, value, display_value, description, score, usage_count, last_used, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `));
        this.preparedStatements.set('recordUsage', this.db.prepare(`
      UPDATE autocomplete_cache
      SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
      WHERE type = ? AND value = ?
    `));
    }
    async getSuggestions(query, context) {
        try {
            const validatedQuery = HierarchicalCategories_schema_1.HierarchicalSchemaValidator.validateAutocompleteQuery(query);
            if (validatedQuery.query.length < this.config.minQueryLength) {
                return [];
            }
            const cacheKey = this.buildCacheKey(validatedQuery, context);
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    this.emit('autocomplete:cache_hit', { query: validatedQuery.query });
                    return cached;
                }
            }
            const suggestions = await this.aggregateSuggestions(validatedQuery, context);
            const rankedSuggestions = this.rankSuggestions(suggestions, validatedQuery, context);
            const finalSuggestions = rankedSuggestions.slice(0, validatedQuery.limit);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, finalSuggestions, this.config.cacheTTL);
            }
            if (this.config.enableLearning) {
                this.learnFromQuery(validatedQuery.query, finalSuggestions, context);
            }
            this.emit('autocomplete:suggestions_generated', {
                query: validatedQuery.query,
                resultCount: finalSuggestions.length,
                sources: Array.from(new Set(suggestions.map(s => s.type)))
            });
            return finalSuggestions;
        }
        catch (error) {
            this.emit('autocomplete:error', { action: 'get_suggestions', error, query, context });
            throw error;
        }
    }
    async recordSelection(query, selectedSuggestion, context) {
        try {
            if (!this.config.enableLearning) {
                return;
            }
            this.preparedStatements.get('recordUsage').run(selectedSuggestion.type, selectedSuggestion.value);
            this.updateTrieWithFeedback(query, selectedSuggestion);
            this.emit('autocomplete:selection_recorded', {
                query,
                suggestion: selectedSuggestion,
                context
            });
        }
        catch (error) {
            this.emit('autocomplete:error', { action: 'record_selection', error, query, selectedSuggestion });
        }
    }
    async getPopularSuggestions(limit = 10) {
        const cacheKey = `autocomplete:popular:${limit}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const popular = this.db.prepare(`
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
      `).all(limit);
            const suggestions = popular.map(row => this.mapRowToSuggestion(row));
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, suggestions, this.config.cacheTTL * 5);
            }
            return suggestions;
        }
        catch (error) {
            this.emit('autocomplete:error', { action: 'get_popular', error, limit });
            throw error;
        }
    }
    async getRecentSuggestions(userId, limit = 10) {
        try {
            const recent = this.db.prepare(`
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
      `).all(userId, limit);
            return recent.map(row => this.mapRowToSuggestion(row));
        }
        catch (error) {
            this.emit('autocomplete:error', { action: 'get_recent', error, userId, limit });
            throw error;
        }
    }
    async rebuildCache() {
        try {
            this.db.prepare('DELETE FROM autocomplete_cache').run();
            await this.cacheFromCategories();
            await this.cacheFromTags();
            await this.cacheFromEntries();
            await this.cacheFromSearchHistory();
            await this.buildTrie();
            this.emit('autocomplete:cache_rebuilt');
        }
        catch (error) {
            this.emit('autocomplete:error', { action: 'rebuild_cache', error });
            throw error;
        }
    }
    async aggregateSuggestions(query, context) {
        const allSuggestions = [];
        const queryPattern = `%${query.query}%`;
        const prefixPattern = `${query.query}%`;
        if (this.shouldUpdateTrie()) {
            await this.buildTrie();
        }
        const trieSuggestions = this.getTrieSuggestions(query.query, query.limit);
        allSuggestions.push(...trieSuggestions);
        if (query.types.includes('category')) {
            const categoryRows = this.preparedStatements.get('categorySuggestions').all(queryPattern, prefixPattern, queryPattern, query.limit);
            allSuggestions.push(...categoryRows.map(row => this.mapRowToSuggestion(row)));
        }
        if (query.types.includes('tag')) {
            const tagRows = this.preparedStatements.get('tagSuggestions').all(queryPattern, queryPattern, queryPattern, query.limit);
            allSuggestions.push(...tagRows.map(row => this.mapRowToSuggestion(row)));
            if (this.config.enableFuzzySearch) {
                const ftsRows = this.preparedStatements.get('ftsSuggestions').all(query.query, query.limit);
                allSuggestions.push(...ftsRows.map(row => this.mapRowToSuggestion(row)));
            }
        }
        if (query.types.includes('entry')) {
            const entryRows = this.preparedStatements.get('entrySuggestions').all(queryPattern, queryPattern, query.limit);
            allSuggestions.push(...entryRows.map(row => this.mapRowToSuggestion(row)));
        }
        if (query.types.includes('search_term')) {
            const searchRows = this.preparedStatements.get('searchTermSuggestions').all(queryPattern, query.limit);
            allSuggestions.push(...searchRows.map(row => this.mapRowToSuggestion(row)));
        }
        if (this.config.enableContextAware && context?.currentEntryId) {
            const contextRows = this.preparedStatements.get('contextSuggestions').all(context.currentEntryId, queryPattern, queryPattern, query.limit);
            allSuggestions.push(...contextRows.map(row => this.mapRowToSuggestion(row)));
        }
        return allSuggestions;
    }
    rankSuggestions(suggestions, query, context) {
        const queryLower = query.query.toLowerCase();
        const now = Date.now();
        const uniqueSuggestions = new Map();
        for (const suggestion of suggestions) {
            const key = `${suggestion.type}:${suggestion.value}`;
            if (uniqueSuggestions.has(key)) {
                const existing = uniqueSuggestions.get(key);
                if (suggestion.score > existing.score) {
                    uniqueSuggestions.set(key, suggestion);
                }
                continue;
            }
            let score = 0;
            const valueLower = suggestion.value.toLowerCase();
            const displayLower = suggestion.display_value.toLowerCase();
            if (valueLower === queryLower || displayLower === queryLower) {
                score += this.config.scoringWeights.exactMatch;
            }
            else if (valueLower.startsWith(queryLower) || displayLower.startsWith(queryLower)) {
                score += this.config.scoringWeights.prefixMatch;
            }
            else if (valueLower.includes(queryLower) || displayLower.includes(queryLower)) {
                score += this.config.scoringWeights.fuzzyMatch;
            }
            if (suggestion.usage_count) {
                score += suggestion.usage_count * this.config.scoringWeights.usageCount;
            }
            if (suggestion.last_used) {
                const ageHours = (now - new Date(suggestion.last_used).getTime()) / (1000 * 60 * 60);
                const recencyScore = Math.max(0, 24 - ageHours) * this.config.scoringWeights.recency;
                score += recencyScore;
            }
            if (context) {
                if (context.currentCategory && suggestion.metadata?.categoryId === context.currentCategory) {
                    score += this.config.scoringWeights.contextRelevance;
                }
                if (context.previousQueries?.some(pq => pq.includes(queryLower))) {
                    score += this.config.scoringWeights.contextRelevance * 0.5;
                }
            }
            switch (suggestion.type) {
                case 'category':
                    score *= 1.1;
                    break;
                case 'tag':
                    score *= 1.0;
                    break;
                case 'entry':
                    score *= 0.9;
                    break;
                case 'search_term':
                    score *= 1.2;
                    break;
            }
            suggestion.score = Math.round(score);
            uniqueSuggestions.set(key, suggestion);
        }
        return Array.from(uniqueSuggestions.values())
            .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return (b.usage_count || 0) - (a.usage_count || 0);
        });
    }
    mapRowToSuggestion(row) {
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
                effectiveUsage: row.effective_usage
            }
        };
    }
    buildCacheKey(query, context) {
        const parts = [
            'autocomplete',
            query.query,
            query.types.join(','),
            query.limit.toString()
        ];
        if (context) {
            if (context.currentCategory)
                parts.push(`cat:${context.currentCategory}`);
            if (context.currentEntryId)
                parts.push(`entry:${context.currentEntryId}`);
            if (context.userId)
                parts.push(`user:${context.userId}`);
        }
        return parts.join(':');
    }
    learnFromQuery(query, suggestions, context) {
        for (const suggestion of suggestions) {
            try {
                this.preparedStatements.get('updateCache').run(suggestion.id, suggestion.type, suggestion.value, suggestion.display_value, suggestion.description, suggestion.score, suggestion.usage_count || 0, suggestion.last_used || new Date());
            }
            catch (error) {
            }
        }
    }
    async buildTrie() {
        this.trieRoot = { children: new Map(), suggestions: [] };
        const categories = this.db.prepare(`
      SELECT name, slug, id, entry_count FROM categories WHERE is_active = TRUE
    `).all();
        for (const cat of categories) {
            this.insertIntoTrie(cat.name.toLowerCase(), {
                id: cat.id,
                type: 'category',
                value: cat.slug,
                display_value: cat.name,
                score: 50 + (cat.entry_count || 0) * 0.1,
                usage_count: cat.entry_count || 0
            });
        }
        const tags = this.db.prepare(`
      SELECT name, display_name, id, usage_count FROM tags ORDER BY usage_count DESC LIMIT 1000
    `).all();
        for (const tag of tags) {
            this.insertIntoTrie(tag.name.toLowerCase(), {
                id: tag.id,
                type: 'tag',
                value: tag.name,
                display_value: tag.display_name,
                score: 50 + (tag.usage_count || 0) * 0.1,
                usage_count: tag.usage_count || 0
            });
        }
        this.lastTrieUpdate = Date.now();
    }
    insertIntoTrie(word, suggestion) {
        let node = this.trieRoot;
        for (const char of word) {
            if (!node.children.has(char)) {
                node.children.set(char, { children: new Map(), suggestions: [] });
            }
            node = node.children.get(char);
        }
        const fullSuggestion = {
            id: suggestion.id || '',
            type: suggestion.type,
            value: suggestion.value || '',
            display_value: suggestion.display_value || '',
            score: suggestion.score || 50,
            usage_count: suggestion.usage_count,
            ...suggestion
        };
        node.suggestions.push(fullSuggestion);
        if (node.suggestions.length > 20) {
            node.suggestions = node.suggestions
                .sort((a, b) => b.score - a.score)
                .slice(0, 20);
        }
    }
    getTrieSuggestions(query, limit) {
        const queryLower = query.toLowerCase();
        let node = this.trieRoot;
        for (const char of queryLower) {
            if (!node.children.has(char)) {
                return [];
            }
            node = node.children.get(char);
        }
        const suggestions = [...node.suggestions];
        const queue = [node];
        while (queue.length > 0 && suggestions.length < limit * 2) {
            const current = queue.shift();
            for (const child of current.children.values()) {
                suggestions.push(...child.suggestions);
                queue.push(child);
            }
        }
        const uniqueSuggestions = new Map();
        for (const suggestion of suggestions) {
            const key = `${suggestion.type}:${suggestion.value}`;
            if (!uniqueSuggestions.has(key) ||
                uniqueSuggestions.get(key).score < suggestion.score) {
                uniqueSuggestions.set(key, suggestion);
            }
        }
        return Array.from(uniqueSuggestions.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    updateTrieWithFeedback(query, selectedSuggestion) {
        const queryLower = query.toLowerCase();
        let node = this.trieRoot;
        for (const char of queryLower) {
            if (!node.children.has(char))
                return;
            node = node.children.get(char);
        }
        const suggestion = node.suggestions.find(s => s.type === selectedSuggestion.type && s.value === selectedSuggestion.value);
        if (suggestion) {
            suggestion.score += 5;
            suggestion.usage_count = (suggestion.usage_count || 0) + 1;
        }
    }
    shouldUpdateTrie() {
        return Date.now() - this.lastTrieUpdate > this.TRIE_UPDATE_INTERVAL;
    }
    async cacheFromCategories() {
        const categories = this.db.prepare(`
      SELECT id, name, slug, description, entry_count, updated_at
      FROM categories WHERE is_active = TRUE
    `).all();
        for (const cat of categories) {
            this.preparedStatements.get('updateCache').run(cat.id, 'category', cat.slug, cat.name, cat.description, 50 + (cat.entry_count || 0) * 0.1, cat.entry_count || 0, cat.updated_at);
        }
    }
    async cacheFromTags() {
        const tags = this.db.prepare(`
      SELECT id, name, display_name, description, usage_count, updated_at
      FROM tags
    `).all();
        for (const tag of tags) {
            this.preparedStatements.get('updateCache').run(tag.id, 'tag', tag.name, tag.display_name, tag.description, 50 + (tag.usage_count || 0) * 0.1, tag.usage_count || 0, tag.updated_at);
        }
    }
    async cacheFromEntries() {
        const entries = this.db.prepare(`
      SELECT id, title, usage_count, last_used
      FROM kb_entries WHERE archived = FALSE
      ORDER BY usage_count DESC LIMIT 500
    `).all();
        for (const entry of entries) {
            this.preparedStatements.get('updateCache').run(entry.id, 'entry', entry.title, entry.title, null, 30 + (entry.usage_count || 0) * 0.05, entry.usage_count || 0, entry.last_used);
        }
    }
    async cacheFromSearchHistory() {
        const searches = this.db.prepare(`
      SELECT query, COUNT(*) as usage_count, MAX(timestamp) as last_used
      FROM search_history
      GROUP BY query
      HAVING usage_count > 1
      ORDER BY usage_count DESC
      LIMIT 200
    `).all();
        for (const search of searches) {
            this.preparedStatements.get('updateCache').run(`search_term:${search.query}`, 'search_term', search.query, search.query, 'Previous search', 20 + search.usage_count * 2, search.usage_count, search.last_used);
        }
    }
    cleanup() {
        this.preparedStatements.forEach(stmt => {
            try {
                stmt.finalize();
            }
            catch (error) {
                console.warn('Error finalizing statement:', error);
            }
        });
        this.preparedStatements.clear();
        this.removeAllListeners();
    }
}
exports.AutocompleteService = AutocompleteService;
exports.default = AutocompleteService;
//# sourceMappingURL=AutocompleteService.js.map