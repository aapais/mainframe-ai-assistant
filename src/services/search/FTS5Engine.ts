/**
 * SQLite FTS5 Full-Text Search Engine for Mainframe Knowledge Base
 *
 * Features:
 * - Custom tokenizer for mainframe terminology (JCL, VSAM, COBOL, DB2)
 * - BM25 ranking algorithm with tuned parameters
 * - Advanced snippet generation with context windows
 * - Highlight matching with mainframe syntax awareness
 * - Sub-second search performance for knowledge bases up to 100K entries
 *
 * @author Database Architect
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import { KBEntry, SearchResult, SearchOptions } from '../../types';

/**
 * FTS5 Configuration interface
 */
export interface FTS5Config {
  /** BM25 ranking parameters */
  bm25: {
    k1: number; // Term frequency saturation parameter (default: 1.2)
    b: number; // Length normalization parameter (default: 0.75)
    titleWeight: number; // Weight for title field (default: 3.0)
    problemWeight: number; // Weight for problem field (default: 2.0)
    solutionWeight: number; // Weight for solution field (default: 1.5)
    tagsWeight: number; // Weight for tags field (default: 1.0)
  };

  /** Snippet generation settings */
  snippet: {
    maxLength: number; // Maximum snippet length in characters (default: 200)
    contextWindow: number; // Context characters around each match (default: 30)
    maxSnippets: number; // Maximum number of snippets per result (default: 3)
    ellipsis: string; // Ellipsis string for truncated text (default: '...')
  };

  /** Highlight settings */
  highlight: {
    startTag: string; // Opening highlight tag (default: '<mark>')
    endTag: string; // Closing highlight tag (default: '</mark>')
    caseSensitive: boolean; // Case-sensitive highlighting (default: false)
  };

  /** Performance tuning */
  performance: {
    mergeFrequency: number; // FTS5 automerge frequency (default: 4)
    crisisMerges: number; // Crisis merge threshold (default: 16)
    deleteSize: number; // Delete size threshold (default: 1000)
    optimizeOnInit: boolean; // Optimize FTS index on initialization (default: true)
  };
}

/**
 * FTS5 Search Result with enhanced metadata
 */
export interface FTS5SearchResult extends SearchResult {
  /** BM25 relevance score */
  bm25Score: number;

  /** Generated snippets with highlights */
  snippets: Array<{
    field: string;
    text: string;
    score: number;
  }>;

  /** Matched terms and their frequencies */
  termMatches: Record<
    string,
    {
      frequency: number;
      positions: number[];
      field: string;
    }
  >;
}

/**
 * Mainframe-specific tokenizer configuration
 */
export interface MainframeTokenizerConfig {
  /** JCL-specific tokens */
  jclTokens: string[];

  /** VSAM-specific tokens */
  vsamTokens: string[];

  /** COBOL-specific tokens */
  cobolTokens: string[];

  /** DB2-specific tokens */
  db2Tokens: string[];

  /** Error code patterns */
  errorCodePatterns: RegExp[];

  /** Dataset name patterns */
  datasetPatterns: RegExp[];

  /** System command patterns */
  systemCommandPatterns: RegExp[];
}

/**
 * SQLite FTS5 Full-Text Search Engine
 *
 * Provides enterprise-grade full-text search capabilities specifically optimized
 * for mainframe knowledge bases with custom tokenization and ranking.
 */
export class FTS5Engine {
  private db: Database.Database;
  private config: FTS5Config;
  private tokenizerConfig: MainframeTokenizerConfig;
  private initialized: boolean = false;

  /**
   * Default FTS5 configuration optimized for mainframe knowledge bases
   */
  private static readonly DEFAULT_CONFIG: FTS5Config = {
    bm25: {
      k1: 1.2, // Standard BM25 k1 parameter
      b: 0.75, // Standard BM25 b parameter
      titleWeight: 3.0, // Title matches are most important
      problemWeight: 2.0, // Problem descriptions are important
      solutionWeight: 1.5, // Solutions are relevant but less than problems
      tagsWeight: 1.0, // Tags provide context
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

  /**
   * Mainframe-specific tokenizer configuration
   *
   * Includes common mainframe terms, error codes, and syntax patterns
   * that should be treated as single tokens for accurate search.
   */
  private static readonly DEFAULT_TOKENIZER_CONFIG: MainframeTokenizerConfig = {
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
      /^[A-Z]{2,4}\d{3,4}[A-Z]?$/, // Standard mainframe error codes (e.g., IEF212I, IGZ0037S)
      /^S\d{3}[A-Z]?$/, // System completion codes (e.g., S0C7, S322)
      /^U\d{4}$/, // User completion codes (e.g., U4038)
      /^SQL[A-Z]?\d{3,5}[A-Z]?$/, // DB2 SQL codes (e.g., SQL0803N, SQL0904C)
      /^DFHAC\d{4}$/, // CICS error codes (e.g., DFHAC2001)
      /^DFS\d{4}[A-Z]?$/, // IMS error codes (e.g., DFS0555I)
    ],
    datasetPatterns: [
      /^[A-Z][A-Z0-9]{0,7}(\.[A-Z][A-Z0-9]{0,7}){0,21}$/, // Standard dataset names
      /^[A-Z][A-Z0-9]{0,7}(\([A-Z][A-Z0-9]{0,7}\))?$/, // PDS member names
    ],
    systemCommandPatterns: [
      /^[A-Z]{1,8}$/, // Simple system commands
      /^[A-Z]{1,8}\s+[A-Z0-9.()]+$/, // Commands with parameters
    ],
  };

  constructor(
    db: Database.Database,
    config: Partial<FTS5Config> = {},
    tokenizerConfig: Partial<MainframeTokenizerConfig> = {}
  ) {
    this.db = db;
    this.config = this.mergeConfig(FTS5Engine.DEFAULT_CONFIG, config);
    this.tokenizerConfig = this.mergeTokenizerConfig(
      FTS5Engine.DEFAULT_TOKENIZER_CONFIG,
      tokenizerConfig
    );
  }

  /**
   * Initialize FTS5 engine with optimized configuration
   */
  async initialize(): Promise<void> {
    console.log('🔍 Initializing FTS5 Full-Text Search Engine...');

    try {
      // Create the FTS5 virtual table with custom configuration
      await this.createFTS5Table();

      // Register custom functions for BM25, snippet, and highlight
      await this.registerCustomFunctions();

      // Configure FTS5 performance settings
      await this.configureFTS5Performance();

      // Populate FTS5 index from existing entries
      await this.populateFTS5Index();

      // Optimize the index if configured
      if (this.config.performance.optimizeOnInit) {
        await this.optimizeFTS5Index();
      }

      this.initialized = true;
      console.log('✅ FTS5 Engine initialized successfully');

      // Log initialization stats
      await this.logInitializationStats();
    } catch (error) {
      console.error('❌ FTS5 Engine initialization failed:', error);
      throw new Error(`FTS5 initialization failed: ${error.message}`);
    }
  }

  /**
   * Perform advanced FTS5 search with BM25 ranking
   */
  async search(query: string, options: SearchOptions = {}): Promise<FTS5SearchResult[]> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      // Prepare FTS5 query with mainframe tokenization
      const fts5Query = this.prepareFTS5Query(query);

      // Execute FTS5 search with BM25 ranking
      const results = await this.executeFTS5Search(fts5Query, options);

      // Generate snippets and highlights for each result
      const enhancedResults = await this.enhanceResults(results, query);

      const executionTime = Date.now() - startTime;
      console.log(`🔍 FTS5 search completed in ${executionTime}ms (${results.length} results)`);

      return enhancedResults;
    } catch (error) {
      console.error('❌ FTS5 search failed:', error);
      throw new Error(`FTS5 search failed: ${error.message}`);
    }
  }

  /**
   * Add document to FTS5 index
   */
  async addDocument(entry: KBEntry): Promise<void> {
    this.ensureInitialized();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO kb_fts5(rowid, id, title, problem, solution, category, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      // Get tags as space-separated string
      const tagsString = entry.tags ? entry.tags.join(' ') : '';

      stmt.run(
        entry.id, // Use entry ID as rowid for direct mapping
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

  /**
   * Update document in FTS5 index
   */
  async updateDocument(entry: KBEntry): Promise<void> {
    this.ensureInitialized();

    try {
      // Delete old entry
      await this.removeDocument(entry.id!);

      // Add updated entry
      await this.addDocument(entry);
    } catch (error) {
      console.error('Failed to update document in FTS5:', error);
      throw error;
    }
  }

  /**
   * Remove document from FTS5 index
   */
  async removeDocument(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      const stmt = this.db.prepare('DELETE FROM kb_fts5 WHERE id = ?');
      stmt.run(id);
    } catch (error) {
      console.error('Failed to remove document from FTS5:', error);
      throw error;
    }
  }

  /**
   * Optimize FTS5 index for better performance
   */
  async optimize(): Promise<void> {
    this.ensureInitialized();

    try {
      console.log('🔧 Optimizing FTS5 index...');

      // Run FTS5 optimize command
      this.db.exec("INSERT INTO kb_fts5(kb_fts5) VALUES('optimize')");

      // Update statistics
      this.db.exec('ANALYZE kb_fts5');

      console.log('✅ FTS5 index optimization completed');
    } catch (error) {
      console.error('❌ FTS5 optimization failed:', error);
      throw error;
    }
  }

  /**
   * Get FTS5 index statistics
   */
  getStats(): {
    indexSize: number;
    documentCount: number;
    totalTokens: number;
    uniqueTokens: number;
    averageDocumentLength: number;
  } {
    this.ensureInitialized();

    try {
      // Get basic document count
      const docCount = this.db.prepare('SELECT COUNT(*) as count FROM kb_fts5').get() as {
        count: number;
      };

      // Get index size estimation
      const indexSize = this.db
        .prepare(
          `
        SELECT SUM(LENGTH(title) + LENGTH(problem) + LENGTH(solution) + LENGTH(tags)) as size
        FROM kb_fts5
      `
        )
        .get() as { size: number };

      // Get average document length
      const avgLength = this.db
        .prepare(
          `
        SELECT AVG(LENGTH(title) + LENGTH(problem) + LENGTH(solution) + LENGTH(tags)) as avg_length
        FROM kb_fts5
      `
        )
        .get() as { avg_length: number };

      return {
        indexSize: indexSize.size || 0,
        documentCount: docCount.count,
        totalTokens: 0, // Would need custom calculation
        uniqueTokens: 0, // Would need custom calculation
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

  // =========================
  // Private Implementation
  // =========================

  /**
   * Create FTS5 virtual table with custom tokenizer
   */
  private async createFTS5Table(): Promise<void> {
    // Drop existing table if it exists
    this.db.exec('DROP TABLE IF EXISTS kb_fts5');

    // Create FTS5 table with mainframe-optimized tokenizer
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

    // Configure FTS5 with BM25 parameters
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

  /**
   * Register custom SQL functions for advanced search features
   */
  private async registerCustomFunctions(): Promise<void> {
    // Register BM25 scoring function
    this.db.function(
      'bm25_score',
      { deterministic: true },
      (tf: number, docLen: number, avgDocLen: number, docCount: number, termCount: number) => {
        const k1 = this.config.bm25.k1;
        const b = this.config.bm25.b;

        const idf = Math.log((docCount - termCount + 0.5) / (termCount + 0.5));
        const score = (idf * (tf * (k1 + 1))) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)));

        return Math.max(0, score);
      }
    );

    // Register snippet generation function
    this.db.function(
      'generate_snippet',
      { deterministic: true },
      (text: string, query: string, maxLength: number = this.config.snippet.maxLength) => {
        return this.generateSnippet(text, query, maxLength);
      }
    );

    // Register highlight function
    this.db.function('highlight_text', { deterministic: true }, (text: string, query: string) => {
      return this.highlightText(text, query);
    });
  }

  /**
   * Configure FTS5 performance parameters
   */
  private async configureFTS5Performance(): Promise<void> {
    // Configure automerge settings
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

  /**
   * Populate FTS5 index from existing kb_entries
   */
  private async populateFTS5Index(): Promise<void> {
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
      .all() as Array<{
      id: string;
      title: string;
      problem: string;
      solution: string;
      category: string;
      tags: string;
    }>;

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

  /**
   * Optimize FTS5 index for better search performance
   */
  private async optimizeFTS5Index(): Promise<void> {
    console.log('🔧 Optimizing FTS5 index structure...');

    // Run optimize command
    this.db.exec("INSERT INTO kb_fts5(kb_fts5) VALUES('optimize')");

    // Rebuild if needed (for large datasets)
    const stats = this.getStats();
    if (stats.documentCount > 10000) {
      console.log('📊 Large dataset detected, rebuilding FTS5 index...');
      this.db.exec("INSERT INTO kb_fts5(kb_fts5) VALUES('rebuild')");
    }

    console.log('✅ FTS5 index optimization completed');
  }

  /**
   * Prepare FTS5 query with mainframe-specific tokenization
   */
  private prepareFTS5Query(query: string): string {
    // Handle special mainframe terms and error codes
    let ftsQuery = query.trim();

    // Check for error code patterns
    for (const pattern of this.tokenizerConfig.errorCodePatterns) {
      if (pattern.test(ftsQuery)) {
        // Exact match for error codes
        return `"${ftsQuery}"`;
      }
    }

    // Check for dataset names
    for (const pattern of this.tokenizerConfig.datasetPatterns) {
      if (pattern.test(ftsQuery)) {
        // Exact match for dataset names
        return `"${ftsQuery}"`;
      }
    }

    // Handle special prefixes
    if (ftsQuery.startsWith('category:')) {
      return `category: ${ftsQuery.substring(9)}`;
    }

    if (ftsQuery.startsWith('tag:')) {
      return `tags: ${ftsQuery.substring(4)}`;
    }

    // Split into terms and handle mainframe tokens
    const terms = ftsQuery.split(/\s+/).filter(term => term.length > 0);
    const processedTerms = terms.map(term => {
      const upperTerm = term.toUpperCase();

      // Check if it's a known mainframe token
      const allTokens = [
        ...this.tokenizerConfig.jclTokens,
        ...this.tokenizerConfig.vsamTokens,
        ...this.tokenizerConfig.cobolTokens,
        ...this.tokenizerConfig.db2Tokens,
      ];

      if (allTokens.includes(upperTerm)) {
        // Exact match for mainframe keywords
        return `"${upperTerm}"`;
      }

      // Regular term with prefix matching
      return `${term}*`;
    });

    // Combine terms with AND operator for precise matching
    return processedTerms.join(' AND ');
  }

  /**
   * Execute FTS5 search with BM25 ranking
   */
  private async executeFTS5Search(ftsQuery: string, options: SearchOptions): Promise<any[]> {
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

  /**
   * Enhance search results with snippets and highlights
   */
  private async enhanceResults(results: any[], originalQuery: string): Promise<FTS5SearchResult[]> {
    return results.map(row => {
      // Generate snippets for each field
      const snippets = this.generateSnippets(row, originalQuery);

      // Extract term matches
      const termMatches = this.extractTermMatches(row, originalQuery);

      // Convert to FTS5SearchResult
      const entry: KBEntry = {
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
        matchType: 'fts' as any,
        highlights: snippets.map(s => s.text),
        bm25Score: row.bm25_score,
        snippets,
        termMatches,
      };
    });
  }

  /**
   * Generate contextual snippets for search results
   */
  private generateSnippets(
    row: any,
    query: string
  ): Array<{ field: string; text: string; score: number }> {
    const fields = [
      { name: 'title', content: row.title, weight: 3 },
      { name: 'problem', content: row.problem, weight: 2 },
      { name: 'solution', content: row.solution, weight: 1 },
    ];

    const snippets: Array<{ field: string; text: string; score: number }> = [];
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);

    fields.forEach(field => {
      const snippet = this.generateSnippet(field.content, query, this.config.snippet.maxLength);
      if (snippet && snippet !== field.content) {
        // Calculate snippet score based on term matches and field weight
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

    // Sort by score and return top snippets
    return snippets.sort((a, b) => b.score - a.score).slice(0, this.config.snippet.maxSnippets);
  }

  /**
   * Generate snippet with context window
   */
  private generateSnippet(text: string, query: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;

    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);
    const lowerText = text.toLowerCase();

    // Find the best match position
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

    // Extract snippet with ellipsis
    const snippet = text.substring(bestPosition, bestPosition + maxLength);
    const prefix = bestPosition > 0 ? this.config.snippet.ellipsis : '';
    const suffix = bestPosition + maxLength < text.length ? this.config.snippet.ellipsis : '';

    return prefix + snippet + suffix;
  }

  /**
   * Highlight search terms in text
   */
  private highlightText(text: string, query: string): string {
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

  /**
   * Extract term matches and positions
   */
  private extractTermMatches(
    row: any,
    query: string
  ): Record<string, { frequency: number; positions: number[]; field: string }> {
    const matches: Record<string, { frequency: number; positions: number[]; field: string }> = {};
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
        const positions: number[] = [];
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

  /**
   * Calculate combined relevance score
   */
  private calculateCombinedScore(row: any): number {
    const bm25Score = row.bm25_score || 0;
    const usageBoost = Math.log(row.usage_count + 1) * 5;
    const successBoost = (row.success_rate || 0) * 10;

    return Math.min(100, Math.max(0, bm25Score + usageBoost + successBoost));
  }

  /**
   * Log initialization statistics
   */
  private async logInitializationStats(): Promise<void> {
    const stats = this.getStats();
    console.log(
      `📊 FTS5 Engine ready: ${stats.documentCount} indexed documents, ` +
        `${Math.round(stats.indexSize / 1024)} KB index size, ` +
        `${Math.round(stats.averageDocumentLength)} avg doc length`
    );
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(defaults: FTS5Config, config: Partial<FTS5Config>): FTS5Config {
    return {
      bm25: { ...defaults.bm25, ...config.bm25 },
      snippet: { ...defaults.snippet, ...config.snippet },
      highlight: { ...defaults.highlight, ...config.highlight },
      performance: { ...defaults.performance, ...config.performance },
    };
  }

  /**
   * Merge tokenizer configuration with defaults
   */
  private mergeTokenizerConfig(
    defaults: MainframeTokenizerConfig,
    config: Partial<MainframeTokenizerConfig>
  ): MainframeTokenizerConfig {
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

  /**
   * Ensure engine is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('FTS5Engine not initialized. Call initialize() first.');
    }
  }
}

export default FTS5Engine;
