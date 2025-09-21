"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FTS5EnhancedSearch = void 0;
exports.createEnhancedFTS5Search = createEnhancedFTS5Search;
const FTS5MainframeTokenizer_1 = require("./FTS5MainframeTokenizer");
class FTS5EnhancedSearch {
    db;
    tokenizer;
    termWeights;
    queryCache;
    CACHE_TTL = 300000;
    constructor(database) {
        this.db = database;
        this.tokenizer = (0, FTS5MainframeTokenizer_1.createMainframeTokenizer)({
            preserveErrorCodes: true,
            preserveJclSyntax: true,
            preserveCobolKeywords: true,
            preserveSystemMessages: true,
            caseSensitive: false,
            stemming: true
        });
        this.termWeights = this.tokenizer.getTokenWeights();
        this.queryCache = new Map();
        this.initializeEnhancedFTS5();
    }
    initializeEnhancedFTS5() {
        try {
            const tokenizerSQL = (0, FTS5MainframeTokenizer_1.registerMainframeTokenizer)();
            this.db.exec(tokenizerSQL);
            this.db.exec(`
        -- Enhanced FTS5 configuration with custom ranking
        DROP TABLE IF EXISTS kb_fts_enhanced;

        CREATE VIRTUAL TABLE kb_fts_enhanced USING fts5(
          id UNINDEXED,
          title,
          problem,
          solution,
          category UNINDEXED,
          tags,
          severity UNINDEXED,
          -- Custom tokenizer configuration
          tokenize = 'porter unicode61 remove_diacritics 2',
          -- Content configuration
          content = 'kb_entries',
          content_rowid = 'rowid',
          -- Ranking configuration
          rank = 'bm25(3.0, 2.0, 1.5, 1.0, 1.0)'
        );
      `);
            this.db.exec(`
        -- Enhanced FTS5 triggers with mainframe-aware processing
        DROP TRIGGER IF EXISTS kb_fts_enhanced_insert;
        DROP TRIGGER IF EXISTS kb_fts_enhanced_delete;
        DROP TRIGGER IF EXISTS kb_fts_enhanced_update;
        DROP TRIGGER IF EXISTS kb_tags_fts_enhanced_update;

        CREATE TRIGGER kb_fts_enhanced_insert AFTER INSERT ON kb_entries BEGIN
          INSERT INTO kb_fts_enhanced(rowid, id, title, problem, solution, category, tags, severity)
          SELECT
            NEW.rowid,
            NEW.id,
            NEW.title,
            NEW.problem,
            NEW.solution,
            NEW.category,
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''),
            NEW.severity;
        END;

        CREATE TRIGGER kb_fts_enhanced_delete AFTER DELETE ON kb_entries BEGIN
          DELETE FROM kb_fts_enhanced WHERE rowid = OLD.rowid;
        END;

        CREATE TRIGGER kb_fts_enhanced_update AFTER UPDATE ON kb_entries BEGIN
          DELETE FROM kb_fts_enhanced WHERE rowid = OLD.rowid;
          INSERT INTO kb_fts_enhanced(rowid, id, title, problem, solution, category, tags, severity)
          SELECT
            NEW.rowid,
            NEW.id,
            NEW.title,
            NEW.problem,
            NEW.solution,
            NEW.category,
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''),
            NEW.severity;
        END;

        CREATE TRIGGER kb_tags_fts_enhanced_update AFTER INSERT OR UPDATE OR DELETE ON kb_tags BEGIN
          DELETE FROM kb_fts_enhanced WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
          INSERT INTO kb_fts_enhanced(rowid, id, title, problem, solution, category, tags, severity)
          SELECT
            e.rowid,
            e.id,
            e.title,
            e.problem,
            e.solution,
            e.category,
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = e.id), ''),
            e.severity
          FROM kb_entries e WHERE e.id = COALESCE(NEW.entry_id, OLD.entry_id);
        END;
      `);
            this.rebuildFTS5Index();
            console.log('✅ Enhanced FTS5 search engine initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize enhanced FTS5:', error);
            throw error;
        }
    }
    rebuildFTS5Index() {
        try {
            this.db.exec('DELETE FROM kb_fts_enhanced;');
            const stmt = this.db.prepare(`
        INSERT INTO kb_fts_enhanced(rowid, id, title, problem, solution, category, tags, severity)
        SELECT
          e.rowid,
          e.id,
          e.title,
          e.problem,
          e.solution,
          e.category,
          COALESCE((SELECT GROUP_CONCAT(t.tag, ' ') FROM kb_tags t WHERE t.entry_id = e.id), ''),
          e.severity
        FROM kb_entries e
        WHERE e.archived = FALSE
      `);
            const result = stmt.run();
            console.log(`🔄 Rebuilt FTS5 index with ${result.changes} entries`);
            this.db.exec('INSERT INTO kb_fts_enhanced(kb_fts_enhanced) VALUES("optimize");');
            console.log('⚡ FTS5 index optimized');
        }
        catch (error) {
            console.error('❌ Failed to rebuild FTS5 index:', error);
        }
    }
    async search(query, options = {}) {
        const startTime = performance.now();
        if (!query?.trim()) {
            return [];
        }
        const cacheKey = this.generateCacheKey(query, options);
        const cached = this.queryCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            return cached.results;
        }
        try {
            const ftsQuery = this.tokenizer.generateFTS5Query(query);
            console.log(`🔍 FTS5 Query: "${query}" -> "${ftsQuery}"`);
            const results = await this.executeEnhancedSearch(ftsQuery, query, options);
            if (options.enableSnippets !== false) {
                await this.addSnippets(results, query, options);
            }
            const queryTime = performance.now() - startTime;
            results.forEach((result, index) => {
                result.debugInfo = {
                    ftsScore: result.raw_score || 0,
                    rankingProfile: options.rankingProfile || 'balanced',
                    matchedTerms: this.extractMatchedTerms(query, result.entry),
                    queryTime: Math.round(queryTime * 100) / 100
                };
            });
            this.queryCache.set(cacheKey, {
                results,
                timestamp: Date.now()
            });
            this.cleanCache();
            console.log(`⚡ Enhanced FTS5 search completed in ${queryTime.toFixed(2)}ms, found ${results.length} results`);
            return results;
        }
        catch (error) {
            console.error('❌ Enhanced FTS5 search failed:', error);
            throw error;
        }
    }
    async executeEnhancedSearch(ftsQuery, originalQuery, options) {
        const rankingProfile = options.rankingProfile || 'balanced';
        const limit = options.limit || 20;
        const offset = options.offset || 0;
        const sql = `
      WITH ranked_results AS (
        SELECT
          e.*,
          f.rank as base_rank,
          -- Custom BM25 ranking with mainframe weights
          bm25(kb_fts_enhanced,
               ${this.getRankingWeights(rankingProfile).title},
               ${this.getRankingWeights(rankingProfile).problem},
               ${this.getRankingWeights(rankingProfile).solution},
               ${this.getRankingWeights(rankingProfile).tags}
          ) as bm25_score,

          -- Usage popularity boost (logarithmic)
          LOG(e.usage_count + 1) * 0.1 as usage_boost,

          -- Success rate boost
          CASE WHEN (e.success_count + e.failure_count) > 0
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 0.2
               ELSE 0 END as success_boost,

          -- Recency boost
          CASE WHEN julianday('now') - julianday(e.created_at) < 30
               THEN 0.05 ELSE 0 END as recency_boost,

          -- Mainframe term weight boost
          ${this.buildTermWeightBoost(originalQuery)} as term_weight_boost,

          GROUP_CONCAT(DISTINCT t.tag, ', ') as tags_list

        FROM kb_fts_enhanced f
        JOIN kb_entries e ON f.rowid = e.rowid
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE f MATCH ?
          AND e.archived = FALSE
          ${options.category ? 'AND e.category = ?' : ''}
          ${options.tags?.length ? `AND EXISTS (SELECT 1 FROM kb_tags WHERE entry_id = e.id AND tag IN (${  options.tags.map(() => '?').join(',')  }))` : ''}
        GROUP BY e.id, f.rank, bm25_score
      )
      SELECT *,
        -- Final composite score
        (ABS(bm25_score) + usage_boost + success_boost + recency_boost + term_weight_boost) as final_score
      FROM ranked_results
      ORDER BY final_score DESC, e.usage_count DESC
      LIMIT ? OFFSET ?
    `;
        const params = [ftsQuery];
        if (options.category)
            params.push(options.category);
        if (options.tags?.length)
            params.push(...options.tags);
        params.push(limit, offset);
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);
        return rows.map((row) => ({
            entry: {
                id: row.id,
                title: row.title,
                problem: row.problem,
                solution: row.solution,
                category: row.category,
                severity: row.severity,
                tags: row.tags_list ? row.tags_list.split(', ') : [],
                created_at: new Date(row.created_at),
                updated_at: new Date(row.updated_at),
                usage_count: row.usage_count || 0,
                success_count: row.success_count || 0,
                failure_count: row.failure_count || 0,
                last_used: row.last_used ? new Date(row.last_used) : undefined
            },
            score: Math.min(100, Math.max(0, row.final_score * 20 + 50)),
            matchType: 'fts',
            raw_score: row.bm25_score,
            explanation: this.generateExplanation(row, originalQuery)
        }));
    }
    async addSnippets(results, query, options) {
        const snippetLength = options.snippetLength || 150;
        const highlightTags = options.highlightTags || { start: '<mark>', end: '</mark>' };
        for (const result of results) {
            const snippets = [];
            const fields = [
                { name: 'title', content: result.entry.title, weight: 3 },
                { name: 'problem', content: result.entry.problem, weight: 2 },
                { name: 'solution', content: result.entry.solution, weight: 1 }
            ];
            for (const field of fields) {
                const snippet = this.generateSnippet(field.content, query, snippetLength, highlightTags, field.weight);
                if (snippet.highlights.length > 0) {
                    snippets.push({
                        field: field.name,
                        ...snippet
                    });
                }
            }
            result.snippets = snippets
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);
        }
    }
    generateSnippet(content, query, maxLength, highlightTags, fieldWeight) {
        if (!content) {
            return { text: '', highlights: [], score: 0 };
        }
        const queryTokens = this.tokenizer.tokenize(query);
        const searchTerms = queryTokens.map(t => t.token.toLowerCase());
        const highlights = [];
        const contentLower = content.toLowerCase();
        let score = 0;
        const matches = [];
        for (const token of queryTokens) {
            const term = token.token.toLowerCase();
            const termWeight = this.termWeights.get(term) || 1.0;
            let startIndex = 0;
            while (true) {
                const index = contentLower.indexOf(term, startIndex);
                if (index === -1)
                    break;
                matches.push({
                    start: index,
                    end: index + term.length,
                    term: content.substring(index, index + term.length),
                    weight: termWeight * fieldWeight
                });
                score += termWeight * fieldWeight;
                startIndex = index + 1;
            }
        }
        if (matches.length === 0) {
            return { text: '', highlights: [], score: 0 };
        }
        matches.sort((a, b) => a.start - b.start);
        const snippetStart = this.findBestSnippetStart(content, matches, maxLength);
        const snippetEnd = Math.min(content.length, snippetStart + maxLength);
        let snippetText = content.substring(snippetStart, snippetEnd);
        if (snippetStart > 0)
            snippetText = `...${  snippetText}`;
        if (snippetEnd < content.length)
            snippetText = `${snippetText  }...`;
        const snippetOffset = snippetStart > 0 ? 3 : 0;
        for (const match of matches) {
            if (match.start >= snippetStart && match.end <= snippetEnd) {
                highlights.push({
                    start: match.start - snippetStart + snippetOffset,
                    end: match.end - snippetStart + snippetOffset,
                    term: match.term
                });
            }
        }
        let highlightedText = snippetText;
        highlights
            .sort((a, b) => b.start - a.start)
            .forEach(highlight => {
            highlightedText =
                highlightedText.substring(0, highlight.start) +
                    highlightTags.start +
                    highlight.term +
                    highlightTags.end +
                    highlightedText.substring(highlight.end);
        });
        return {
            text: highlightedText,
            highlights,
            score: score / matches.length
        };
    }
    findBestSnippetStart(content, matches, maxLength) {
        if (matches.length === 0)
            return 0;
        let bestStart = 0;
        let bestScore = 0;
        const candidates = new Set();
        candidates.add(0);
        for (const match of matches) {
            candidates.add(Math.max(0, match.start - 50));
            candidates.add(Math.max(0, match.start - 20));
            candidates.add(match.start);
        }
        for (const start of candidates) {
            const end = Math.min(content.length, start + maxLength);
            let score = 0;
            let matchCount = 0;
            for (const match of matches) {
                if (match.start >= start && match.end <= end) {
                    score += match.weight;
                    matchCount++;
                }
            }
            if (matchCount > 0) {
                score = score * matchCount;
                if (score > bestScore) {
                    bestScore = score;
                    bestStart = start;
                }
            }
        }
        return bestStart;
    }
    getRankingWeights(profile) {
        const profiles = {
            balanced: { title: 3.0, problem: 2.0, solution: 1.5, tags: 1.0 },
            precision: { title: 4.0, problem: 2.5, solution: 1.0, tags: 2.0 },
            recall: { title: 2.0, problem: 2.0, solution: 2.0, tags: 1.5 },
            mainframe_focused: { title: 3.5, problem: 3.0, solution: 2.0, tags: 2.5 }
        };
        return profiles[profile] || profiles.balanced;
    }
    buildTermWeightBoost(query) {
        const tokens = this.tokenizer.tokenize(query);
        const weightExpressions = [];
        for (const token of tokens) {
            if (token.weight > 1.0) {
                weightExpressions.push(`
          CASE WHEN (
            e.title LIKE '%${token.token}%' OR
            e.problem LIKE '%${token.token}%' OR
            e.solution LIKE '%${token.token}%'
          ) THEN ${(token.weight - 1.0) * 0.1} ELSE 0 END
        `);
            }
        }
        return weightExpressions.length > 0
            ? `(${weightExpressions.join(' + ')})`
            : '0';
    }
    extractMatchedTerms(query, entry) {
        const tokens = this.tokenizer.tokenize(query);
        const matched = [];
        const entryText = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
        for (const token of tokens) {
            if (entryText.includes(token.token.toLowerCase())) {
                matched.push(token.token);
            }
        }
        return matched;
    }
    generateExplanation(row, query) {
        const explanations = [];
        if (row.bm25_score) {
            explanations.push(`Relevance score: ${Math.abs(row.bm25_score).toFixed(2)}`);
        }
        if (row.usage_boost > 0) {
            explanations.push(`Popular entry (used ${row.usage_count} times)`);
        }
        if (row.success_boost > 0) {
            const successRate = Math.round((row.success_count / (row.success_count + row.failure_count)) * 100);
            explanations.push(`High success rate (${successRate}%)`);
        }
        if (row.term_weight_boost > 0) {
            explanations.push('Contains important mainframe terminology');
        }
        if (row.recency_boost > 0) {
            explanations.push('Recently created or updated');
        }
        return explanations.join('; ');
    }
    generateCacheKey(query, options) {
        const optionsKey = JSON.stringify({
            category: options.category,
            tags: options.tags,
            limit: options.limit,
            offset: options.offset,
            rankingProfile: options.rankingProfile,
            enableSnippets: options.enableSnippets
        });
        return `fts5:${query}:${Buffer.from(optionsKey).toString('base64')}`;
    }
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.queryCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.queryCache.delete(key);
            }
        }
    }
    getStatistics() {
        const indexInfo = this.db.prepare(`
      SELECT COUNT(*) as count FROM kb_fts_enhanced
    `).get();
        return {
            indexSize: indexInfo.count,
            cacheSize: this.queryCache.size,
            totalQueries: 0,
            averageQueryTime: 0
        };
    }
    optimize() {
        try {
            this.db.exec('INSERT INTO kb_fts_enhanced(kb_fts_enhanced) VALUES("optimize");');
            console.log('✅ FTS5 index optimized');
        }
        catch (error) {
            console.error('❌ Failed to optimize FTS5 index:', error);
        }
    }
    clearCache() {
        this.queryCache.clear();
        console.log('🗑️ FTS5 search cache cleared');
    }
}
exports.FTS5EnhancedSearch = FTS5EnhancedSearch;
function createEnhancedFTS5Search(database) {
    return new FTS5EnhancedSearch(database);
}
//# sourceMappingURL=FTS5EnhancedSearch.js.map