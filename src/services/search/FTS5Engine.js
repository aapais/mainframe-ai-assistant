'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FTS5Engine = void 0;
class FTS5Engine {
  db;
  config;
  tokenizerConfig;
  initialized = false;
  static DEFAULT_CONFIG = {
    bm25: {
      k1: 1.2,
      b: 0.75,
      titleWeight: 3.0,
      problemWeight: 2.0,
      solutionWeight: 1.5,
      tagsWeight: 1.0,
    },
    snippet: {
      maxLength: 200,
      contextWindow: 30,
      maxSnippets: 3,
      ellipsis: '...',
    },
    highlight: {
      startTag: '<mark>',
      endTag: '</mark>',
      caseSensitive: false,
    },
    performance: {
      mergeFrequency: 4,
      crisisMerges: 16,
      deleteSize: 1000,
      optimizeOnInit: true,
    },
  };
  static DEFAULT_TOKENIZER_CONFIG = {
    jclTokens: [
      'JOB',
      'EXEC',
      'DD',
      'SYSIN',
      'SYSOUT',
      'DISP',
      'DSN',
      'DCB',
      'SPACE',
      'UNIT',
      'VOL',
      'LABEL',
      'RECFM',
      'LRECL',
      'BLKSIZE',
      'COND',
      'PARM',
      'PROC',
      'SET',
      'IF',
      'THEN',
      'ELSE',
      'ENDIF',
      'INCLUDE',
      'JCLLIB',
      'OUTPUT',
      'JOBLIB',
      'STEPLIB',
      'SYSLIB',
      'SYSTSIN',
      'SYSPROC',
    ],
    vsamTokens: [
      'VSAM',
      'KSDS',
      'ESDS',
      'RRDS',
      'LDS',
      'DEFINE',
      'DELETE',
      'LISTCAT',
      'REPRO',
      'PRINT',
      'VERIFY',
      'EXAMINE',
      'ALTER',
      'CLUSTER',
      'DATA',
      'INDEX',
      'AIX',
      'PATH',
      'CATALOG',
      'MASTERCATALOG',
      'USERCATALOG',
      'NONVSAM',
      'RECATALOG',
      'UNCATALOG',
      'CNVTCAT',
    ],
    cobolTokens: [
      'IDENTIFICATION',
      'ENVIRONMENT',
      'DATA',
      'PROCEDURE',
      'DIVISION',
      'PROGRAM-ID',
      'WORKING-STORAGE',
      'FILE-SECTION',
      'LINKAGE',
      'PERFORM',
      'CALL',
      'MOVE',
      'ADD',
      'SUBTRACT',
      'MULTIPLY',
      'DIVIDE',
      'COMPUTE',
      'IF',
      'ELSE',
      'EVALUATE',
      'WHEN',
      'GO TO',
      'STOP RUN',
      'PIC',
      'PICTURE',
      'COMP',
      'COMP-3',
      'DISPLAY',
      'BINARY',
      'PACKED-DECIMAL',
      'OCCURS',
      'REDEFINES',
      'VALUE',
      'FILLER',
      'LEVEL',
      '01',
      '05',
      '10',
      '15',
    ],
    db2Tokens: [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'DROP',
      'ALTER',
      'INDEX',
      'TABLE',
      'VIEW',
      'SYNONYM',
      'TABLESPACE',
      'DATABASE',
      'COMMIT',
      'ROLLBACK',
      'BIND',
      'REBIND',
      'RUNSTATS',
      'REORG',
      'EXPLAIN',
      'PLAN_TABLE',
      'SPUFI',
      'QMF',
      'DCLGEN',
      'PRECOMPILE',
      'SQLCODE',
      'SQLSTATE',
      'CURSOR',
      'FETCH',
      'OPEN',
      'CLOSE',
    ],
    errorCodePatterns: [
      /^[A-Z]{2,4}\d{3,4}[A-Z]?$/,
      /^S\d{3}[A-Z]?$/,
      /^U\d{4}$/,
      /^SQL[A-Z]?\d{3,5}[A-Z]?$/,
      /^DFHAC\d{4}$/,
      /^DFS\d{4}[A-Z]?$/,
    ],
    datasetPatterns: [
      /^[A-Z][A-Z0-9]{0,7}(\.[A-Z][A-Z0-9]{0,7}){0,21}$/,
      /^[A-Z][A-Z0-9]{0,7}(\([A-Z][A-Z0-9]{0,7}\))?$/,
    ],
    systemCommandPatterns: [/^[A-Z]{1,8}$/, /^[A-Z]{1,8}\s+[A-Z0-9.()]+$/],
  };
  constructor(db, config = {}, tokenizerConfig = {}) {
    this.db = db;
    this.config = this.mergeConfig(FTS5Engine.DEFAULT_CONFIG, config);
    this.tokenizerConfig = this.mergeTokenizerConfig(
      FTS5Engine.DEFAULT_TOKENIZER_CONFIG,
      tokenizerConfig
    );
  }
  async initialize() {
    console.log('🔍 Initializing FTS5 Full-Text Search Engine...');
    try {
      await this.createFTS5Table();
      await this.registerCustomFunctions();
      await this.configureFTS5Performance();
      await this.populateFTS5Index();
      if (this.config.performance.optimizeOnInit) {
        await this.optimizeFTS5Index();
      }
      this.initialized = true;
      console.log('✅ FTS5 Engine initialized successfully');
      await this.logInitializationStats();
    } catch (error) {
      console.error('❌ FTS5 Engine initialization failed:', error);
      throw new Error(`FTS5 initialization failed: ${error.message}`);
    }
  }
  async search(query, options = {}) {
    this.ensureInitialized();
    const startTime = Date.now();
    try {
      const fts5Query = this.prepareFTS5Query(query);
      const results = await this.executeFTS5Search(fts5Query, options);
      const enhancedResults = await this.enhanceResults(results, query);
      const executionTime = Date.now() - startTime;
      console.log(`🔍 FTS5 search completed in ${executionTime}ms (${results.length} results)`);
      return enhancedResults;
    } catch (error) {
      console.error('❌ FTS5 search failed:', error);
      throw new Error(`FTS5 search failed: ${error.message}`);
    }
  }
  async addDocument(entry) {
    this.ensureInitialized();
    try {
      const stmt = this.db.prepare(`
        INSERT INTO kb_fts5(rowid, id, title, problem, solution, category, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const tagsString = entry.tags ? entry.tags.join(' ') : '';
      stmt.run(
        entry.id,
        entry.id,
        entry.title,
        entry.problem,
        entry.solution,
        entry.category,
        tagsString
      );
    } catch (error) {
      console.error('Failed to add document to FTS5:', error);
      throw error;
    }
  }
  async updateDocument(entry) {
    this.ensureInitialized();
    try {
      await this.removeDocument(entry.id);
      await this.addDocument(entry);
    } catch (error) {
      console.error('Failed to update document in FTS5:', error);
      throw error;
    }
  }
  async removeDocument(id) {
    this.ensureInitialized();
    try {
      const stmt = this.db.prepare('DELETE FROM kb_fts5 WHERE id = ?');
      stmt.run(id);
    } catch (error) {
      console.error('Failed to remove document from FTS5:', error);
      throw error;
    }
  }
  async optimize() {
    this.ensureInitialized();
    try {
      console.log('🔧 Optimizing FTS5 index...');
      this.db.exec("INSERT INTO kb_fts5(kb_fts5) VALUES('optimize')");
      this.db.exec('ANALYZE kb_fts5');
      console.log('✅ FTS5 index optimization completed');
    } catch (error) {
      console.error('❌ FTS5 optimization failed:', error);
      throw error;
    }
  }
  getStats() {
    this.ensureInitialized();
    try {
      const docCount = this.db.prepare('SELECT COUNT(*) as count FROM kb_fts5').get();
      const indexSize = this.db
        .prepare(
          `
        SELECT SUM(LENGTH(title) + LENGTH(problem) + LENGTH(solution) + LENGTH(tags)) as size
        FROM kb_fts5
      `
        )
        .get();
      const avgLength = this.db
        .prepare(
          `
        SELECT AVG(LENGTH(title) + LENGTH(problem) + LENGTH(solution) + LENGTH(tags)) as avg_length
        FROM kb_fts5
      `
        )
        .get();
      return {
        indexSize: indexSize.size || 0,
        documentCount: docCount.count,
        totalTokens: 0,
        uniqueTokens: 0,
        averageDocumentLength: avgLength.avg_length || 0,
      };
    } catch (error) {
      console.error('Failed to get FTS5 stats:', error);
      return {
        indexSize: 0,
        documentCount: 0,
        totalTokens: 0,
        uniqueTokens: 0,
        averageDocumentLength: 0,
      };
    }
  }
  async createFTS5Table() {
    this.db.exec('DROP TABLE IF EXISTS kb_fts5');
    const createTableSQL = `
      CREATE VIRTUAL TABLE kb_fts5 USING fts5(
        id UNINDEXED,
        title,
        problem,
        solution,
        category UNINDEXED,
        tags,
        tokenize = 'porter unicode61 remove_diacritics 1 tokenchars ".-_@"',
        columnsize = 1,
        detail = full
      )
    `;
    this.db.exec(createTableSQL);
    this.db.exec(`
      INSERT INTO kb_fts5(kb_fts5, rank) VALUES('rank', 'bm25(
        ${this.config.bm25.titleWeight},
        ${this.config.bm25.problemWeight},
        ${this.config.bm25.solutionWeight},
        1.0,
        ${this.config.bm25.tagsWeight}
      )')
    `);
  }
  async registerCustomFunctions() {
    this.db.function(
      'bm25_score',
      { deterministic: true },
      (tf, docLen, avgDocLen, docCount, termCount) => {
        const k1 = this.config.bm25.k1;
        const b = this.config.bm25.b;
        const idf = Math.log((docCount - termCount + 0.5) / (termCount + 0.5));
        const score = (idf * (tf * (k1 + 1))) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)));
        return Math.max(0, score);
      }
    );
    this.db.function(
      'generate_snippet',
      { deterministic: true },
      (text, query, maxLength = this.config.snippet.maxLength) => {
        return this.generateSnippet(text, query, maxLength);
      }
    );
    this.db.function('highlight_text', { deterministic: true }, (text, query) => {
      return this.highlightText(text, query);
    });
  }
  async configureFTS5Performance() {
    this.db.exec(`
      INSERT INTO kb_fts5(kb_fts5) VALUES('automerge=${this.config.performance.mergeFrequency}')
    `);
    this.db.exec(`
      INSERT INTO kb_fts5(kb_fts5) VALUES('crisismerge=${this.config.performance.crisisMerges}')
    `);
    this.db.exec(`
      INSERT INTO kb_fts5(kb_fts5) VALUES('deletesize=${this.config.performance.deleteSize}')
    `);
  }
  async populateFTS5Index() {
    const entries = this.db
      .prepare(
        `
      SELECT
        e.id,
        e.title,
        e.problem,
        e.solution,
        e.category,
        GROUP_CONCAT(COALESCE(t.tag, ''), ' ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.archived = FALSE
      GROUP BY e.id, e.title, e.problem, e.solution, e.category
    `
      )
      .all();
    console.log(`📝 Populating FTS5 index with ${entries.length} entries...`);
    const insertStmt = this.db.prepare(`
      INSERT INTO kb_fts5(id, title, problem, solution, category, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const transaction = this.db.transaction(() => {
      entries.forEach(entry => {
        insertStmt.run(
          entry.id,
          entry.title,
          entry.problem,
          entry.solution,
          entry.category,
          entry.tags || ''
        );
      });
    });
    transaction();
    console.log(`✅ FTS5 index populated with ${entries.length} entries`);
  }
  async optimizeFTS5Index() {
    console.log('🔧 Optimizing FTS5 index structure...');
    this.db.exec("INSERT INTO kb_fts5(kb_fts5) VALUES('optimize')");
    const stats = this.getStats();
    if (stats.documentCount > 10000) {
      console.log('📊 Large dataset detected, rebuilding FTS5 index...');
      this.db.exec("INSERT INTO kb_fts5(kb_fts5) VALUES('rebuild')");
    }
    console.log('✅ FTS5 index optimization completed');
  }
  prepareFTS5Query(query) {
    const ftsQuery = query.trim();
    for (const pattern of this.tokenizerConfig.errorCodePatterns) {
      if (pattern.test(ftsQuery)) {
        return `"${ftsQuery}"`;
      }
    }
    for (const pattern of this.tokenizerConfig.datasetPatterns) {
      if (pattern.test(ftsQuery)) {
        return `"${ftsQuery}"`;
      }
    }
    if (ftsQuery.startsWith('category:')) {
      return `category: ${ftsQuery.substring(9)}`;
    }
    if (ftsQuery.startsWith('tag:')) {
      return `tags: ${ftsQuery.substring(4)}`;
    }
    const terms = ftsQuery.split(/\s+/).filter(term => term.length > 0);
    const processedTerms = terms.map(term => {
      const upperTerm = term.toUpperCase();
      const allTokens = [
        ...this.tokenizerConfig.jclTokens,
        ...this.tokenizerConfig.vsamTokens,
        ...this.tokenizerConfig.cobolTokens,
        ...this.tokenizerConfig.db2Tokens,
      ];
      if (allTokens.includes(upperTerm)) {
        return `"${upperTerm}"`;
      }
      return `${term}*`;
    });
    return processedTerms.join(' AND ');
  }
  async executeFTS5Search(ftsQuery, options) {
    const limit = Math.min(options.limit || 10, 100);
    const offset = options.offset || 0;
    const searchSQL = `
      SELECT
        f.id,
        f.title,
        f.problem,
        f.solution,
        f.category,
        f.tags,
        bm25(kb_fts5, ${this.config.bm25.titleWeight}, ${this.config.bm25.problemWeight}, ${this.config.bm25.solutionWeight}, 1.0, ${this.config.bm25.tagsWeight}) as bm25_score,
        e.usage_count,
        e.success_count,
        e.failure_count,
        e.last_used,
        e.severity,
        CASE WHEN (e.success_count + e.failure_count) > 0
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_fts5 f
      JOIN kb_entries e ON f.id = e.id
      WHERE kb_fts5 MATCH ?
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      ORDER BY
        CASE ?
          WHEN 'relevance' THEN bm25_score
          WHEN 'usage' THEN e.usage_count
          WHEN 'success_rate' THEN success_rate
          WHEN 'created_at' THEN julianday(e.created_at)
          ELSE bm25_score
        END DESC,
        e.usage_count DESC
      LIMIT ? OFFSET ?
    `;
    const params = [
      ftsQuery,
      ...(options.category ? [options.category] : []),
      options.sortBy || 'relevance',
      limit,
      offset,
    ];
    return this.db.prepare(searchSQL).all(...params);
  }
  async enhanceResults(results, originalQuery) {
    return results.map(row => {
      const snippets = this.generateSnippets(row, originalQuery);
      const termMatches = this.extractTermMatches(row, originalQuery);
      const entry = {
        id: row.id,
        title: row.title,
        problem: row.problem,
        solution: row.solution,
        category: row.category,
        severity: row.severity,
        tags: row.tags ? row.tags.split(' ').filter(t => t.length > 0) : [],
        usage_count: row.usage_count,
        success_count: row.success_count,
        failure_count: row.failure_count,
        last_used: row.last_used ? new Date(row.last_used) : undefined,
      };
      return {
        entry,
        score: this.calculateCombinedScore(row),
        matchType: 'fts',
        highlights: snippets.map(s => s.text),
        bm25Score: row.bm25_score,
        snippets,
        termMatches,
      };
    });
  }
  generateSnippets(row, query) {
    const fields = [
      { name: 'title', content: row.title, weight: 3 },
      { name: 'problem', content: row.problem, weight: 2 },
      { name: 'solution', content: row.solution, weight: 1 },
    ];
    const snippets = [];
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);
    fields.forEach(field => {
      const snippet = this.generateSnippet(field.content, query, this.config.snippet.maxLength);
      if (snippet && snippet !== field.content) {
        const termScore = queryTerms.reduce((score, term) => {
          return score + (snippet.toLowerCase().includes(term) ? 1 : 0);
        }, 0);
        snippets.push({
          field: field.name,
          text: snippet,
          score: termScore * field.weight,
        });
      }
    });
    return snippets.sort((a, b) => b.score - a.score).slice(0, this.config.snippet.maxSnippets);
  }
  generateSnippet(text, query, maxLength) {
    if (!text || text.length <= maxLength) return text;
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);
    const lowerText = text.toLowerCase();
    let bestPosition = 0;
    let bestScore = 0;
    for (let i = 0; i <= text.length - maxLength; i += 20) {
      const window = lowerText.substring(i, i + maxLength);
      const score = queryTerms.reduce((acc, term) => {
        return acc + (window.includes(term) ? 1 : 0);
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        bestPosition = i;
      }
    }
    const snippet = text.substring(bestPosition, bestPosition + maxLength);
    const prefix = bestPosition > 0 ? this.config.snippet.ellipsis : '';
    const suffix = bestPosition + maxLength < text.length ? this.config.snippet.ellipsis : '';
    return prefix + snippet + suffix;
  }
  highlightText(text, query) {
    const queryTerms = query.split(/\s+/).filter(t => t.length > 2);
    let highlightedText = text;
    queryTerms.forEach(term => {
      const regex = new RegExp(
        `(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        this.config.highlight.caseSensitive ? 'g' : 'gi'
      );
      highlightedText = highlightedText.replace(
        regex,
        `${this.config.highlight.startTag}$1${this.config.highlight.endTag}`
      );
    });
    return highlightedText;
  }
  extractTermMatches(row, query) {
    const matches = {};
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);
    const fields = [
      { name: 'title', content: row.title },
      { name: 'problem', content: row.problem },
      { name: 'solution', content: row.solution },
    ];
    queryTerms.forEach(term => {
      fields.forEach(field => {
        const lowerContent = field.content.toLowerCase();
        const positions = [];
        let index = lowerContent.indexOf(term);
        while (index !== -1) {
          positions.push(index);
          index = lowerContent.indexOf(term, index + 1);
        }
        if (positions.length > 0) {
          if (!matches[term]) {
            matches[term] = { frequency: 0, positions: [], field: field.name };
          }
          matches[term].frequency += positions.length;
          matches[term].positions.push(...positions);
        }
      });
    });
    return matches;
  }
  calculateCombinedScore(row) {
    const bm25Score = row.bm25_score || 0;
    const usageBoost = Math.log(row.usage_count + 1) * 5;
    const successBoost = (row.success_rate || 0) * 10;
    return Math.min(100, Math.max(0, bm25Score + usageBoost + successBoost));
  }
  async logInitializationStats() {
    const stats = this.getStats();
    console.log(
      `📊 FTS5 Engine ready: ${stats.documentCount} indexed documents, ` +
        `${Math.round(stats.indexSize / 1024)} KB index size, ` +
        `${Math.round(stats.averageDocumentLength)} avg doc length`
    );
  }
  mergeConfig(defaults, config) {
    return {
      bm25: { ...defaults.bm25, ...config.bm25 },
      snippet: { ...defaults.snippet, ...config.snippet },
      highlight: { ...defaults.highlight, ...config.highlight },
      performance: { ...defaults.performance, ...config.performance },
    };
  }
  mergeTokenizerConfig(defaults, config) {
    return {
      jclTokens: [...defaults.jclTokens, ...(config.jclTokens || [])],
      vsamTokens: [...defaults.vsamTokens, ...(config.vsamTokens || [])],
      cobolTokens: [...defaults.cobolTokens, ...(config.cobolTokens || [])],
      db2Tokens: [...defaults.db2Tokens, ...(config.db2Tokens || [])],
      errorCodePatterns: [...defaults.errorCodePatterns, ...(config.errorCodePatterns || [])],
      datasetPatterns: [...defaults.datasetPatterns, ...(config.datasetPatterns || [])],
      systemCommandPatterns: [
        ...defaults.systemCommandPatterns,
        ...(config.systemCommandPatterns || []),
      ],
    };
  }
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('FTS5Engine not initialized. Call initialize() first.');
    }
  }
}
exports.FTS5Engine = FTS5Engine;
exports.default = FTS5Engine;
//# sourceMappingURL=FTS5Engine.js.map
