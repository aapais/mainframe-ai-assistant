import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { MigrationManager } from './MigrationManager';
import { QueryOptimizer, SearchOptions } from './QueryOptimizer';
import { PerformanceTuner } from './PerformanceTuner';
import { BackupManager } from './BackupManager';
import { DataSeeder } from './DataSeeder';
import { AdvancedIndexStrategy } from './AdvancedIndexStrategy';
import { QueryCache } from './QueryCache';
import { ConnectionPool } from './ConnectionPool';
import { PerformanceMonitor } from './PerformanceMonitor';

/**
 * Core Knowledge Base Entry interface
 * Represents a single knowledge base entry with problem, solution, and metadata
 *
 * @interface KBEntry
 * @example
 * ```typescript
 * const entry: KBEntry = {
 *   id: 'uuid-v4-string',
 *   title: 'VSAM Status 35 - File Not Found',
 *   problem: 'Job abends with VSAM status code 35...',
 *   solution: '1. Verify dataset exists\n2. Check cataloging...',
 *   category: 'VSAM',
 *   severity: 'medium',
 *   tags: ['vsam', 'status-35', 'file-not-found'],
 *   usage_count: 15,
 *   success_count: 12,
 *   failure_count: 3
 * };
 * ```
 */
export interface KBEntry {
  /** Unique identifier (UUID v4) - auto-generated if not provided */
  id?: string;
  /** Brief, descriptive title of the problem/solution */
  title: string;
  /** Detailed description of the problem or error condition */
  problem: string;
  /** Step-by-step solution or resolution steps */
  solution: string;
  /** Mainframe component category (JCL, VSAM, DB2, Batch, Functional, etc.) */
  category: string;
  /** Severity level indicating urgency/impact */
  severity?: 'critical' | 'high' | 'medium' | 'low';
  /** Array of searchable tags for categorization */
  tags?: string[];
  /** Timestamp when entry was created */
  created_at?: Date;
  /** Timestamp when entry was last modified */
  updated_at?: Date;
  /** User ID or system that created the entry */
  created_by?: string;
  /** Total number of times this entry has been accessed */
  usage_count?: number;
  /** Number of times users reported this solution as successful */
  success_count?: number;
  /** Number of times users reported this solution as failed */
  failure_count?: number;
  /** Timestamp when entry was last accessed */
  last_used?: Date;
  /** Whether entry is archived (hidden from normal searches) */
  archived?: boolean;
}

/**
 * Search result container with scoring and match information
 *
 * @interface SearchResult
 * @example
 * ```typescript
 * const result: SearchResult = {
 *   entry: kbEntry,
 *   score: 85.3,
 *   matchType: 'fuzzy',
 *   highlights: ['VSAM status code 35', 'file not found error']
 * };
 * ```
 */
export interface SearchResult {
  /** The matched knowledge base entry */
  entry: KBEntry;
  /** Relevance score (0-100) - higher is more relevant */
  score: number;
  /** Type of matching algorithm used */
  matchType: 'exact' | 'fuzzy' | 'ai' | 'category' | 'tag';
  /** Text snippets that matched the search query */
  highlights?: string[];
}

/**
 * Database statistics and health metrics
 *
 * @interface DatabaseStats
 * @example
 * ```typescript
 * const stats: DatabaseStats = {
 *   totalEntries: 150,
 *   categoryCounts: { 'JCL': 45, 'VSAM': 32, 'DB2': 28 },
 *   recentActivity: 15,
 *   searchesToday: 89,
 *   averageSuccessRate: 87.5,
 *   topEntries: [
 *     { title: 'S0C7 Data Exception', usage_count: 45 }
 *   ],
 *   diskUsage: 2048576,
 *   performance: { avgSearchTime: 125, cacheHitRate: 78.2 }
 * };
 * ```
 */
export interface DatabaseStats {
  /** Total number of active (non-archived) entries */
  totalEntries: number;
  /** Count of entries by category */
  categoryCounts: Record<string, number>;
  /** Number of entries accessed in last 7 days */
  recentActivity: number;
  /** Number of searches performed today */
  searchesToday: number;
  /** Average success rate across all entries (percentage) */
  averageSuccessRate: number;
  /** Most frequently used entries */
  topEntries: Array<{ title: string; usage_count: number }>;
  /** Database file size in bytes */
  diskUsage: number;
  /** Performance metrics */
  performance: {
    /** Average search response time in milliseconds */
    avgSearchTime: number;
    /** Cache hit rate as percentage */
    cacheHitRate: number;
  };
}

/**
 * Main Knowledge Base Database Manager
 *
 * Provides comprehensive knowledge base functionality including:
 * - CRUD operations for knowledge entries
 * - Advanced search with AI integration
 * - Performance monitoring and optimization
 * - Backup and restore capabilities
 * - Automatic database maintenance
 *
 * @class KnowledgeDB
 * @example
 * ```typescript
 * // Initialize the database
 * const db = new KnowledgeDB('./knowledge.db', {
 *   autoBackup: true,
 *   backupInterval: 24
 * });
 *
 * // Add a new entry
 * const entryId = await db.addEntry({
 *   title: 'VSAM Status 35',
 *   problem: 'Job fails with VSAM status code 35',
 *   solution: '1. Check file existence\n2. Verify catalog',
 *   category: 'VSAM',
 *   tags: ['vsam', 'file-error']
 * });
 *
 * // Search the knowledge base
 * const results = await db.search('VSAM status 35');
 * console.log(`Found ${results.length} matching entries`);
 *
 * // Get database statistics
 * const stats = await db.getStats();
 * console.log(`Database has ${stats.totalEntries} entries`);
 * ```
 */
export class KnowledgeDB {
  private db: Database.Database;
  private migrationManager: MigrationManager;
  private queryOptimizer: QueryOptimizer;
  private performanceTuner: PerformanceTuner;
  private backupManager: BackupManager;
  private dataSeeder: DataSeeder;
  private advancedIndexStrategy: AdvancedIndexStrategy;
  private queryCache: QueryCache;
  private connectionPool: ConnectionPool;
  private performanceMonitor: PerformanceMonitor;
  private initialized: boolean = false;

  /**
   * Creates a new KnowledgeDB instance
   *
   * @param dbPath - Path to SQLite database file (default: './knowledge.db')
   * @param options - Configuration options
   * @param options.backupDir - Directory for backup files
   * @param options.maxBackups - Maximum number of backup files to retain (default: 10)
   * @param options.autoBackup - Enable automatic periodic backups (default: true)
   * @param options.backupInterval - Hours between automatic backups (default: 24)
   *
   * @example
   * ```typescript
   * // Basic initialization
   * const db = new KnowledgeDB();
   *
   * // Custom path and backup settings
   * const db = new KnowledgeDB('/data/kb.db', {
   *   backupDir: '/backups',
   *   autoBackup: true,
   *   backupInterval: 12
   * });
   * ```
   */
  constructor(
    dbPath: string = './knowledge.db',
    options?: {
      backupDir?: string;
      maxBackups?: number;
      autoBackup?: boolean;
      backupInterval?: number;
    }
  ) {
    console.log('🚀 Initializing Knowledge Database...');

    // Initialize SQLite database
    this.db = new Database(dbPath);

    // Initialize managers
    this.migrationManager = new MigrationManager(this.db);
    this.performanceTuner = new PerformanceTuner(this.db);
    this.queryOptimizer = new QueryOptimizer(this.db);
    this.backupManager = new BackupManager(this.db, options?.backupDir, options?.maxBackups);
    this.dataSeeder = new DataSeeder(this);

    // Initialize advanced performance components
    this.advancedIndexStrategy = new AdvancedIndexStrategy(this.db);
    this.queryCache = new QueryCache(this.db, {
      maxSize: 1000,
      defaultTTL: 300000, // 5 minutes
      maxMemoryMB: 100,
      persistToDisk: true,
      compressionEnabled: true,
    });
    this.connectionPool = new ConnectionPool(dbPath, {
      maxReaders: 5,
      maxWriters: 1,
      acquireTimeout: 30000,
      idleTimeout: 300000,
      enableWAL: true,
    });
    this.performanceMonitor = new PerformanceMonitor(this.db, {
      slowQueryThreshold: 1000,
      criticalThreshold: 5000,
      enableRealTimeAlerts: true,
      enableQueryPlanCapture: true,
    });

    // Initialize database
    this.initialize(options);
  }

  /**
   * Initialize database with schema, optimizations, and initial data
   */
  private async initialize(options?: {
    autoBackup?: boolean;
    backupInterval?: number;
  }): Promise<void> {
    try {
      console.log('🔧 Setting up database schema and optimizations...');

      // Run migrations
      const migrationResults = await this.migrationManager.migrate();
      if (migrationResults.some(r => !r.success)) {
        console.warn('⚠️ Some migrations failed, but continuing...');
      }

      // Apply performance optimizations
      this.performanceTuner.optimize();

      // Schedule maintenance
      this.performanceTuner.scheduleMaintenace();

      // Setup automatic backups if enabled
      if (options?.autoBackup !== false) {
        this.backupManager.scheduleAutoBackups(options?.backupInterval || 24);
      }

      // Seed initial data if needed
      if (await this.dataSeeder.needsSeeding()) {
        console.log('🌱 Database appears empty, seeding with initial data...');
        await this.dataSeeder.seedAll();
      }

      this.initialized = true;
      console.log('✅ Knowledge Database initialized successfully');

      // Log database stats
      this.logInitializationStats();
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add a new knowledge base entry
   *
   * @param entry - The knowledge base entry to add
   * @param entry.title - Brief, descriptive title (required)
   * @param entry.problem - Detailed problem description (required)
   * @param entry.solution - Step-by-step solution (required)
   * @param entry.category - Component category (required)
   * @param entry.severity - Severity level (optional, defaults to 'medium')
   * @param entry.tags - Array of searchable tags (optional)
   * @param userId - User ID creating the entry (optional, defaults to 'system')
   *
   * @returns Promise resolving to the unique entry ID
   *
   * @throws {Error} If entry validation fails or database operation fails
   *
   * @example
   * ```typescript
   * // Add a simple entry
   * const id = await db.addEntry({
   *   title: 'S0C7 Data Exception',
   *   problem: 'Program abends with S0C7 during arithmetic operation',
   *   solution: '1. Check for uninitialized COMP-3 fields\n2. Validate input data',
   *   category: 'Batch',
   *   severity: 'high',
   *   tags: ['s0c7', 'abend', 'arithmetic']
   * }, 'john.smith');
   *
   * console.log(`Created entry with ID: ${id}`);
   * ```
   */
  async addEntry(entry: KBEntry, userId?: string): Promise<string> {
    this.ensureInitialized();

    const id = entry.id || uuidv4();

    const transaction = this.db.transaction(() => {
      try {
        // Insert main entry
        this.db
          .prepare(
            `
          INSERT INTO kb_entries (
            id, title, problem, solution, category, severity, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            id,
            entry.title,
            entry.problem,
            entry.solution,
            entry.category,
            entry.severity || 'medium',
            userId || 'system'
          );

        // Insert tags
        if (entry.tags && entry.tags.length > 0) {
          const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
          entry.tags.forEach(tag => {
            tagStmt.run(id, tag.toLowerCase().trim());
          });
        }

        return id;
      } catch (error) {
        console.error('Failed to add entry:', error);
        throw error;
      }
    });

    return transaction();
  }

  /**
   * Update existing entry
   */
  async updateEntry(id: string, updates: Partial<KBEntry>, userId?: string): Promise<void> {
    this.ensureInitialized();

    const transaction = this.db.transaction(() => {
      // Update main entry
      const setClause = [];
      const values = [];

      if (updates.title !== undefined) {
        setClause.push('title = ?');
        values.push(updates.title);
      }
      if (updates.problem !== undefined) {
        setClause.push('problem = ?');
        values.push(updates.problem);
      }
      if (updates.solution !== undefined) {
        setClause.push('solution = ?');
        values.push(updates.solution);
      }
      if (updates.category !== undefined) {
        setClause.push('category = ?');
        values.push(updates.category);
      }
      if (updates.severity !== undefined) {
        setClause.push('severity = ?');
        values.push(updates.severity);
      }
      if (updates.archived !== undefined) {
        setClause.push('archived = ?');
        values.push(updates.archived);
      }

      if (setClause.length > 0) {
        setClause.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        this.db
          .prepare(
            `
          UPDATE kb_entries 
          SET ${setClause.join(', ')}
          WHERE id = ?
        `
          )
          .run(...values);
      }

      // Update tags if provided
      if (updates.tags !== undefined) {
        // Remove existing tags
        this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);

        // Add new tags
        if (updates.tags.length > 0) {
          const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
          updates.tags.forEach(tag => {
            tagStmt.run(id, tag.toLowerCase().trim());
          });
        }
      }
    });

    transaction();
  }

  /**
   * Perform advanced search on the knowledge base
   *
   * Uses intelligent query routing to select optimal search strategy:
   * - Exact matching for error codes (S0C7, IEF212I, etc.)
   * - Full-text search with BM25 ranking for general queries
   * - Fuzzy matching for partial/typo-tolerant search
   * - Category/tag filtering for structured searches
   * - Hybrid approach combining multiple strategies
   *
   * @param query - Search query string
   * @param options - Search configuration options
   * @param options.limit - Maximum number of results (default: 10, max: 100)
   * @param options.offset - Number of results to skip for pagination (default: 0)
   * @param options.sortBy - Sort order: 'relevance', 'usage', 'success_rate', 'created_at' (default: 'relevance')
   * @param options.includeArchived - Include archived entries (default: false)
   * @param options.category - Filter by specific category
   * @param options.tags - Filter by specific tags
   * @param options.fuzzyThreshold - Fuzzy matching threshold 0-1 (default: 0.7)
   *
   * @returns Promise resolving to array of search results, sorted by relevance
   *
   * @example
   * ```typescript
   * // Simple search
   * const results = await db.search('VSAM status 35');
   *
   * // Advanced search with filters
   * const results = await db.search('file error', {
   *   category: 'VSAM',
   *   limit: 5,
   *   sortBy: 'usage'
   * });
   *
   * // Tag-based search
   * const results = await db.search('tag:s0c7');
   *
   * // Category search
   * const results = await db.search('category:JCL');
   *
   * // Process results
   * results.forEach(result => {
   *   console.log(`${result.entry.title} (${result.score.toFixed(1)}%)`);
   *   console.log(`Match type: ${result.matchType}`);
   *   if (result.highlights) {
   *     console.log(`Highlights: ${result.highlights.join(', ')}`);
   *   }
   * });
   * ```
   */
  async search(
    query: string,
    options?: Partial<
      SearchOptions & {
        streaming?: boolean;
        fuzzyThreshold?: number;
        enableAutoComplete?: boolean;
      }
    >
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    const searchOptions: SearchOptions & { streaming?: boolean } = {
      query,
      limit: 10,
      offset: 0,
      sortBy: 'relevance',
      includeArchived: false,
      ...options,
    };

    // Generate optimized cache key with query normalization
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = this.generateSearchCacheKey(normalizedQuery, searchOptions);

    return this.performanceMonitor.measureOperation(
      'search',
      async () => {
        // Quick cache lookup with streaming support
        return this.queryCache.get(
          cacheKey,
          async () => {
            // Hybrid search strategy selection
            const strategy = await this.selectSearchStrategy(normalizedQuery, searchOptions);
            const result = await this.executeHybridSearch(strategy, normalizedQuery, searchOptions);

            // Convert to SearchResult format with enhanced highlights
            const searchResults = result.results.map(row => ({
              entry: {
                id: row.id,
                title: row.title,
                problem: row.problem,
                solution: row.solution,
                category: row.category,
                severity: row.severity,
                tags: row.tags ? row.tags.split(', ') : [],
                usage_count: row.usage_count,
                success_count: row.success_count,
                failure_count: row.failure_count,
                last_used: row.last_used ? new Date(row.last_used) : undefined,
              },
              score: this.calculateRelevanceScore(row, normalizedQuery, result.strategy),
              matchType: result.strategy as any,
              highlights: this.generateAdvancedHighlights(normalizedQuery, row),
            }));

            return searchResults;
          },
          {
            ttl: this.calculateCacheTTL(searchOptions),
            tags: this.generateCacheTags(searchOptions),
            priority: this.getCachePriority(normalizedQuery),
          }
        );
      },
      {
        recordsProcessed: searchOptions.limit || 10,
        queryComplexity: this.calculateQueryComplexity(normalizedQuery),
      }
    );
  }

  /**
   * Auto-complete search with sub-50ms response time
   */
  async autoComplete(
    query: string,
    limit: number = 5
  ): Promise<Array<{ suggestion: string; category: string; score: number }>> {
    if (!query || query.length < 2) return [];

    const cacheKey = `autocomplete:${query.toLowerCase()}:${limit}`;

    return this.queryCache.get(
      cacheKey,
      async () => {
        const suggestions = this.db
          .prepare(
            `
        WITH suggestions AS (
          -- Common search terms
          SELECT DISTINCT 
            SUBSTR(query, 1, 50) as suggestion,
            'search' as category,
            COUNT(*) * 2 as score
          FROM search_history 
          WHERE query LIKE ? || '%'
          GROUP BY SUBSTR(query, 1, 50)
          
          UNION ALL
          
          -- Entry titles
          SELECT DISTINCT 
            title as suggestion,
            'entry' as category,
            usage_count + success_count as score
          FROM kb_entries 
          WHERE title LIKE '%' || ? || '%'
            AND archived = FALSE
          
          UNION ALL
          
          -- Categories
          SELECT DISTINCT 
            'category:' || category as suggestion,
            'filter' as category,
            COUNT(*) * 1.5 as score
          FROM kb_entries 
          WHERE category LIKE ? || '%'
            AND archived = FALSE
          GROUP BY category
          
          UNION ALL
          
          -- Tags
          SELECT DISTINCT 
            'tag:' || tag as suggestion,
            'filter' as category,
            COUNT(*) as score
          FROM kb_tags 
          WHERE tag LIKE ? || '%'
          GROUP BY tag
        )
        SELECT suggestion, category, score
        FROM suggestions
        WHERE suggestion IS NOT NULL
        ORDER BY score DESC, length(suggestion) ASC
        LIMIT ?
      `
          )
          .all(query, query, query, query, limit);

        return suggestions;
      },
      {
        ttl: 30000, // 30 seconds for auto-complete
        priority: 'high',
      }
    );
  }

  /**
   * Search with faceted filtering and real-time counts
   */
  async searchWithFacets(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<{
    results: SearchResult[];
    facets: {
      categories: Array<{ name: string; count: number }>;
      tags: Array<{ name: string; count: number }>;
      severities: Array<{ name: string; count: number }>;
    };
    totalCount: number;
  }> {
    const searchResults = await this.search(query, options);

    const facetsCacheKey = `facets:${this.normalizeQuery(query)}`;
    const facets = await this.queryCache.get(
      facetsCacheKey,
      async () => {
        return this.calculateFacets(query, options);
      },
      {
        ttl: 120000, // 2 minutes
        tags: ['facets'],
      }
    );

    return {
      results: searchResults,
      facets,
      totalCount: searchResults.length,
    };
  }

  /**
   * Get entry by ID
   */
  async getEntry(id: string): Promise<KBEntry | null> {
    this.ensureInitialized();

    const entry = this.queryOptimizer.getById(id);
    if (!entry) return null;

    return {
      id: entry.id,
      title: entry.title,
      problem: entry.problem,
      solution: entry.solution,
      category: entry.category,
      severity: entry.severity,
      tags: entry.tags ? entry.tags.split(', ') : [],
      created_at: new Date(entry.created_at),
      updated_at: new Date(entry.updated_at),
      created_by: entry.created_by,
      usage_count: entry.usage_count,
      success_count: entry.success_count,
      failure_count: entry.failure_count,
      last_used: entry.last_used ? new Date(entry.last_used) : undefined,
      archived: entry.archived,
    };
  }

  /**
   * Record usage and rate entry effectiveness
   */
  async recordUsage(entryId: string, successful: boolean, userId?: string): Promise<void> {
    this.ensureInitialized();

    const action = successful ? 'rate_success' : 'rate_failure';

    this.db
      .prepare(
        `
      INSERT INTO usage_metrics (entry_id, action, user_id)
      VALUES (?, ?, ?)
    `
      )
      .run(entryId, action, userId || 'anonymous');
  }

  /**
   * Get popular entries
   */
  async getPopular(limit: number = 10): Promise<SearchResult[]> {
    this.ensureInitialized();

    const entries = this.queryOptimizer.getPopular(limit);

    return entries.map(entry => ({
      entry: {
        id: entry.id,
        title: entry.title,
        category: entry.category,
        tags: entry.tags ? entry.tags.split(', ') : [],
        usage_count: entry.usage_count,
        success_count: entry.success_count,
        failure_count: entry.failure_count,
        last_used: entry.last_used ? new Date(entry.last_used) : undefined,
      } as KBEntry,
      score: entry.success_rate,
      matchType: 'popular' as any,
    }));
  }

  /**
   * Get recent entries
   */
  async getRecent(limit: number = 10): Promise<SearchResult[]> {
    this.ensureInitialized();

    const entries = this.queryOptimizer.getRecent(limit);

    return entries.map(entry => ({
      entry: {
        id: entry.id,
        title: entry.title,
        category: entry.category,
        tags: entry.tags ? entry.tags.split(', ') : [],
        created_at: new Date(entry.created_at),
        usage_count: entry.usage_count,
      } as KBEntry,
      score: 100,
      matchType: 'recent' as any,
    }));
  }

  /**
   * Get comprehensive database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    this.ensureInitialized();

    const stats = this.db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalEntries,
        COUNT(CASE WHEN last_used > datetime('now', '-7 days') THEN 1 END) as recentActivity,
        AVG(CASE WHEN (success_count + failure_count) > 0 
                 THEN CAST(success_count AS REAL) / (success_count + failure_count)
                 ELSE 0 END) as averageSuccessRate
      FROM kb_entries
      WHERE archived = FALSE
    `
      )
      .get() as any;

    const categoryCounts = this.db
      .prepare(
        `
      SELECT category, COUNT(*) as count
      FROM kb_entries
      WHERE archived = FALSE
      GROUP BY category
    `
      )
      .all() as Array<{ category: string; count: number }>;

    const searchesToday = this.db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM search_history
      WHERE date(timestamp) = date('now')
    `
      )
      .get() as { count: number };

    const topEntries = this.db
      .prepare(
        `
      SELECT title, usage_count
      FROM kb_entries
      WHERE archived = FALSE
      ORDER BY usage_count DESC
      LIMIT 5
    `
      )
      .all() as Array<{ title: string; usage_count: number }>;

    const performance = this.queryOptimizer.getPerformanceStats();
    const diskUsage = this.getDiskUsage();

    const categoryMap: Record<string, number> = {};
    categoryCounts.forEach(cat => {
      categoryMap[cat.category] = cat.count;
    });

    return {
      totalEntries: stats.totalEntries,
      categoryCounts: categoryMap,
      recentActivity: stats.recentActivity,
      searchesToday: searchesToday.count,
      averageSuccessRate: Math.round((stats.averageSuccessRate || 0) * 100),
      topEntries,
      diskUsage,
      performance: {
        avgSearchTime: performance.avgSearchTime,
        cacheHitRate: performance.cacheHitRate,
      },
    };
  }

  /**
   * Create manual backup
   */
  async createBackup(): Promise<void> {
    this.ensureInitialized();
    await this.backupManager.createBackup('manual');
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath?: string): Promise<void> {
    this.ensureInitialized();
    await this.backupManager.restoreFromBackup({ backupPath });
  }

  /**
   * Export database to JSON
   */
  async exportToJSON(outputPath: string): Promise<void> {
    this.ensureInitialized();
    await this.backupManager.exportToJSON(outputPath);
  }

  /**
   * Import from JSON file
   */
  async importFromJSON(jsonPath: string, mergeMode: boolean = false): Promise<void> {
    this.ensureInitialized();
    await this.backupManager.importFromJSON(jsonPath, mergeMode);
  }

  /**
   * Get system configuration value
   */
  getConfig(key: string): string | null {
    this.ensureInitialized();

    const result = this.db.prepare('SELECT value FROM system_config WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return result?.value || null;
  }

  /**
   * Set system configuration value
   */
  async setConfig(
    key: string,
    value: string,
    type: string = 'string',
    description?: string
  ): Promise<void> {
    this.ensureInitialized();

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO system_config (key, value, type, description)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(key, value, type, description);
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    this.ensureInitialized();

    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM kb_entries WHERE archived = FALSE')
      .get() as { count: number };
    return result.count;
  }

  /**
   * Optimize database performance
   */
  async optimize(): Promise<void> {
    this.ensureInitialized();

    console.log('🔧 Optimizing database...');
    this.performanceTuner.optimize();
    this.queryOptimizer.optimize();
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    this.ensureInitialized();
    return this.performanceTuner.getRecommendations();
  }

  /**
   * Get real-time performance status
   */
  getPerformanceStatus(): any {
    this.ensureInitialized();
    return this.performanceMonitor.getRealTimeStatus();
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(startTime?: number, endTime?: number): any {
    this.ensureInitialized();
    return this.performanceMonitor.generateReport(startTime, endTime);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(hours: number = 24): any {
    this.ensureInitialized();
    return this.performanceMonitor.getPerformanceTrends(hours);
  }

  /**
   * Get slow queries analysis
   */
  getSlowQueries(limit: number = 10): any {
    this.ensureInitialized();
    return this.performanceMonitor.getSlowQueries(limit);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    this.ensureInitialized();
    return this.queryCache.getStats();
  }

  /**
   * Get connection pool statistics
   */
  getConnectionPoolStats(): any {
    this.ensureInitialized();
    return this.connectionPool.getStats();
  }

  /**
   * Get index effectiveness analysis
   */
  getIndexAnalysis(): any {
    this.ensureInitialized();
    return this.advancedIndexStrategy.analyzeIndexEffectiveness();
  }

  /**
   * Generate index maintenance report
   */
  getIndexMaintenanceReport(): any {
    this.ensureInitialized();
    return this.advancedIndexStrategy.generateMaintenanceReport();
  }

  /**
   * Optimize indexes based on query patterns
   */
  async optimizeIndexes(): Promise<any> {
    this.ensureInitialized();
    return this.advancedIndexStrategy.optimizeForQueryPatterns();
  }

  /**
   * Pre-warm cache with common queries
   */
  async preWarmCache(): Promise<void> {
    this.ensureInitialized();
    await this.queryCache.preWarm();
  }

  /**
   * Invalidate cache entries
   */
  async invalidateCache(pattern?: string, tags?: string[]): Promise<number> {
    this.ensureInitialized();
    return this.queryCache.invalidate(pattern, tags);
  }

  /**
   * Perform health check on all components
   */
  async healthCheck(): Promise<{
    overall: boolean;
    database: boolean;
    cache: boolean;
    connections: boolean;
    performance: boolean;
    issues: string[];
  }> {
    this.ensureInitialized();

    const issues: string[] = [];
    let dbHealthy = true;
    let cacheHealthy = true;
    let connectionsHealthy = true;
    let performanceHealthy = true;

    try {
      // Test basic database operations
      this.db.prepare('SELECT 1').get();
    } catch (error) {
      dbHealthy = false;
      issues.push('Database connectivity issue');
    }

    try {
      // Check cache performance
      const cacheStats = this.queryCache.getStats();
      if (cacheStats.hitRate < 0.5) {
        issues.push('Low cache hit rate');
      }
    } catch (error) {
      cacheHealthy = false;
      issues.push('Cache system issue');
    }

    try {
      // Check connection pool
      const poolHealth = await this.connectionPool.healthCheck();
      if (!poolHealth.healthy) {
        connectionsHealthy = false;
        issues.push(...poolHealth.issues);
      }
    } catch (error) {
      connectionsHealthy = false;
      issues.push('Connection pool issue');
    }

    try {
      // Check performance metrics
      const perfStatus = this.performanceMonitor.getRealTimeStatus();
      if (!perfStatus.isHealthy) {
        performanceHealthy = false;
        issues.push('Performance degradation detected');
      }
    } catch (error) {
      performanceHealthy = false;
      issues.push('Performance monitoring issue');
    }

    const overall = dbHealthy && cacheHealthy && connectionsHealthy && performanceHealthy;

    return {
      overall,
      database: dbHealthy,
      cache: cacheHealthy,
      connections: connectionsHealthy,
      performance: performanceHealthy,
      issues,
    };
  }

  /**
   * Close database connection and cleanup resources
   */
  async close(): Promise<void> {
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
    }

    if (this.connectionPool) {
      await this.connectionPool.close();
    }

    if (this.db) {
      this.db.close();
    }
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Database not initialized. Wait for initialization to complete.');
    }
  }

  private logSearch(query: string, resultCount: number, timeMs: number, userId?: string): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO search_history (query, results_count, search_time_ms, user_id)
        VALUES (?, ?, ?, ?)
      `
        )
        .run(query, resultCount, timeMs, userId || 'anonymous');
    } catch (error) {
      // Non-critical error, don't throw
      console.warn('Failed to log search:', error);
    }
  }

  // Advanced search helper methods

  /**
   * Normalize query for consistent processing and caching
   */
  private normalizeQuery(query: string): string {
    return query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s:@.-]/g, ''); // Keep special search operators
  }

  /**
   * Generate optimized cache key for search queries
   */
  private generateSearchCacheKey(normalizedQuery: string, options: any): string {
    const keyParts = [
      'search',
      normalizedQuery,
      options.category || 'all',
      options.sortBy || 'relevance',
      options.limit || 10,
      options.offset || 0,
    ];
    return keyParts.join(':');
  }

  /**
   * Intelligent search strategy selection
   *
   * Analyzes the query structure and selects the most appropriate search algorithm
   * based on query characteristics and performance considerations.
   */
  private async selectSearchStrategy(
    query: string,
    options: SearchOptions
  ): Promise<'exact' | 'fts' | 'fuzzy' | 'category' | 'tag' | 'hybrid'> {
    // Strategy 1: Exact match for known error code patterns
    // Pattern matches: IEF212I, S0C7, WER027A, etc.
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      return 'exact'; // Highest priority - direct string matching
    }

    // Strategy 2: Category-specific search using indexes
    // Faster than full-text when filtering by category
    if (query.startsWith('category:') || options.category) {
      return 'category'; // Uses category index for fast filtering
    }

    // Strategy 3: Tag-based search for precise categorization
    // Leverages tag indexes for exact tag matches
    if (query.startsWith('tag:') || (options.tags && options.tags.length > 0)) {
      return 'tag'; // Direct tag lookup via junction table
    }

    // Strategy 4: Analyze query complexity to choose between FTS, fuzzy, or hybrid
    const complexity = this.calculateQueryComplexity(query);

    if (complexity.isComplex) {
      // Complex queries: multiple terms, operators, or long phrases
      // Use hybrid approach combining multiple strategies
      return 'hybrid'; // Parallel execution of multiple algorithms
    } else if (complexity.hasFuzzyTerms) {
      // Short terms, wildcards, or likely typos
      // Use fuzzy matching for partial/approximate matches
      return 'fuzzy'; // LIKE-based pattern matching
    } else {
      // Standard queries: use FTS5 with BM25 ranking
      // Best performance for natural language queries
      return 'fts'; // Full-text search with relevance scoring
    }
  }

  /**
   * Execute hybrid search with optimal performance
   */
  private async executeHybridSearch(
    strategy: string,
    query: string,
    options: SearchOptions
  ): Promise<{ results: any[]; strategy: string }> {
    const startTime = Date.now();
    let results: any[] = [];

    switch (strategy) {
      case 'exact':
        results = await this.executeExactSearch(query, options);
        break;
      case 'fts':
        results = await this.executeFTSSearch(query, options);
        break;
      case 'fuzzy':
        results = await this.executeFuzzySearch(query, options);
        break;
      case 'category':
        results = await this.executeCategorySearch(query, options);
        break;
      case 'tag':
        results = await this.executeTagSearch(query, options);
        break;
      case 'hybrid':
        results = await this.executeMultiStrategySearch(query, options);
        break;
      default:
        results = await this.executeFTSSearch(query, options);
    }

    const executionTime = Date.now() - startTime;

    // Log slow queries for optimization
    if (executionTime > 500) {
      console.warn(`Slow ${strategy} search (${executionTime}ms): "${query}"`);
    }

    return { results, strategy };
  }

  /**
   * Execute exact search for error codes and specific terms
   */
  private async executeExactSearch(query: string, options: SearchOptions): Promise<any[]> {
    return this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        100 as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE (e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?)
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY e.usage_count DESC, success_rate DESC
      LIMIT ?
    `
      )
      .all(
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        ...(options.category ? [options.category] : []),
        options.limit || 10
      );
  }

  /**
   * Execute full-text search with BM25 ranking
   */
  private async executeFTSSearch(query: string, options: SearchOptions): Promise<any[]> {
    const ftsQuery = this.prepareFTSQuery(query);

    return this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        bm25(kb_fts, 3.0, 2.0, 1.5, 1.0) as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts MATCH ?
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY 
        CASE ?
          WHEN 'relevance' THEN relevance_score
          WHEN 'usage' THEN e.usage_count
          WHEN 'success_rate' THEN success_rate
          ELSE relevance_score
        END DESC
      LIMIT ?
    `
      )
      .all(
        ftsQuery,
        ...(options.category ? [options.category] : []),
        options.sortBy || 'relevance',
        options.limit || 10
      );
  }

  /**
   * Execute fuzzy search for partial matches and typos
   */
  private async executeFuzzySearch(query: string, options: SearchOptions): Promise<any[]> {
    const fuzzyTerms = query.split(/\s+/).filter(term => term.length > 2);
    const likeConditions = fuzzyTerms
      .map(() => '(e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?)')
      .join(' AND ');

    const params = fuzzyTerms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]);

    return this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        (${fuzzyTerms.map(() => 'CASE WHEN e.title LIKE ? THEN 3 ELSE 0 END').join(' + ')}) +
        (${fuzzyTerms.map(() => 'CASE WHEN e.problem LIKE ? THEN 2 ELSE 0 END').join(' + ')}) +
        (${fuzzyTerms.map(() => 'CASE WHEN e.solution LIKE ? THEN 1 ELSE 0 END').join(' + ')}) as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE ${likeConditions}
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      HAVING relevance_score > 0
      ORDER BY relevance_score DESC, e.usage_count DESC
      LIMIT ?
    `
      )
      .all(
        ...params,
        ...fuzzyTerms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]),
        ...(options.category ? [options.category] : []),
        options.limit || 10
      );
  }

  /**
   * Execute category-specific search
   */
  private async executeCategorySearch(query: string, options: SearchOptions): Promise<any[]> {
    const category = options.category || query.replace('category:', '');

    return this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        CASE 
          WHEN e.title LIKE ? THEN 90
          WHEN e.problem LIKE ? THEN 80
          WHEN e.solution LIKE ? THEN 70
          ELSE 60
        END as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.category = ?
        AND e.archived = FALSE
        ${query && !query.startsWith('category:') ? 'AND (e.title LIKE ? OR e.problem LIKE ?)' : ''}
      GROUP BY e.id
      ORDER BY relevance_score DESC, e.usage_count DESC
      LIMIT ?
    `
      )
      .all(
        ...(query && !query.startsWith('category:')
          ? [`%${query}%`, `%${query}%`, `%${query}%`]
          : ['', '', '']),
        category,
        ...(query && !query.startsWith('category:') ? [`%${query}%`, `%${query}%`] : []),
        options.limit || 10
      );
  }

  /**
   * Execute tag-based search
   */
  private async executeTagSearch(query: string, options: SearchOptions): Promise<any[]> {
    const tags = options.tags || [query.replace('tag:', '')];
    const tagPlaceholders = tags.map(() => '?').join(',');

    return this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        COUNT(DISTINCT CASE WHEN t.tag IN (${tagPlaceholders}) THEN t.tag END) as tag_matches,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      JOIN kb_tags t ON e.id = t.entry_id
      WHERE t.tag IN (${tagPlaceholders})
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY tag_matches DESC, e.usage_count DESC
      LIMIT ?
    `
      )
      .all(...tags, ...tags, ...(options.category ? [options.category] : []), options.limit || 10);
  }

  /**
   * Execute multi-strategy search with result fusion
   *
   * Combines multiple search algorithms in parallel and uses intelligent
   * result fusion to provide comprehensive coverage while maintaining performance.
   */
  private async executeMultiStrategySearch(query: string, options: SearchOptions): Promise<any[]> {
    // Define strategies to execute in parallel
    // Each strategy provides different coverage: FTS for relevance, fuzzy for flexibility, exact for precision
    const strategies = ['fts', 'fuzzy', 'exact'];
    const allResults = new Map<string, any>(); // Use Map to deduplicate by entry ID

    // Execute multiple search strategies in parallel for better performance
    const searchPromises = strategies.map(async strategy => {
      try {
        let results: any[] = [];

        // Limit each strategy to 5 results to prevent overwhelming the final result set
        const strategyOptions = { ...options, limit: 5 };

        switch (strategy) {
          case 'fts':
            // Full-text search with BM25 ranking - best for semantic relevance
            results = await this.executeFTSSearch(query, strategyOptions);
            break;
          case 'fuzzy':
            // Fuzzy matching - good for handling typos and partial matches
            results = await this.executeFuzzySearch(query, strategyOptions);
            break;
          case 'exact':
            // Exact string matching - essential for error codes and specific terms
            results = await this.executeExactSearch(query, strategyOptions);
            break;
        }

        // Tag results with their strategy for fusion algorithm
        return results.map(r => ({ ...r, strategy }));
      } catch (error) {
        // Log strategy failures but continue with other strategies
        // This ensures partial results even if one strategy fails
        console.warn(`Strategy ${strategy} failed:`, error);
        return [];
      }
    });

    // Wait for all strategies to complete
    const strategyResults = await Promise.all(searchPromises);

    // Result fusion algorithm: merge results from different strategies
    strategyResults.forEach(results => {
      results.forEach(result => {
        const existing = allResults.get(result.id);
        if (existing) {
          // Entry found by multiple strategies - boost its score
          // Take the highest relevance score from any strategy
          existing.relevance_score = Math.max(existing.relevance_score, result.relevance_score);

          // Track how many strategies found this result (diversity bonus)
          existing.strategy_count = (existing.strategy_count || 1) + 1;
        } else {
          // New result - add it to the result set
          allResults.set(result.id, { ...result, strategy_count: 1 });
        }
      });
    });

    // Final ranking: combine relevance score with strategy diversity bonus
    // Results found by multiple strategies get higher priority
    return Array.from(allResults.values())
      .sort((a, b) => {
        // Apply logarithmic boost for strategy diversity
        // Log function prevents over-boosting while rewarding multi-strategy matches
        const scoreA = a.relevance_score * Math.log(a.strategy_count + 1);
        const scoreB = b.relevance_score * Math.log(b.strategy_count + 1);
        return scoreB - scoreA;
      })
      .slice(0, options.limit || 10); // Respect original limit
  }

  /**
   * Calculate advanced relevance score
   *
   * Combines multiple signals to produce a comprehensive relevance score:
   * - Base search relevance (from algorithm-specific scoring)
   * - Usage popularity (logarithmic to prevent dominance)
   * - Success rate (user feedback-based quality signal)
   * - Strategy-specific multipliers (different algorithms have different precision)
   */
  private calculateRelevanceScore(row: any, query: string, strategy: string): number {
    // Start with algorithm-specific base score (0-100)
    let baseScore = row.relevance_score || 0;

    // Signal 1: Usage popularity boost (logarithmic scaling)
    // Popular entries are more likely to be useful, but we use log to prevent
    // a few heavily-used entries from dominating search results
    const usageBoost = Math.log(row.usage_count + 1) * 10; // Max ~46 points for 100 uses

    // Signal 2: Success rate boost (user feedback quality indicator)
    // Entries with higher success rates get priority in rankings
    const successRate = row.success_rate || 0; // 0-1 normalized success rate
    const successBoost = successRate * 20; // Max 20 points for 100% success rate

    // Signal 3: Strategy confidence multipliers
    // Different algorithms have different precision characteristics
    const strategyMultiplier =
      {
        exact: 1.5, // Exact matches are highly reliable
        fts: 1.0, // Full-text search baseline
        fuzzy: 0.8, // Fuzzy matching less precise
        category: 1.2, // Category matches are quite reliable
        tag: 1.1, // Tag matches are moderately reliable
        hybrid: 1.3, // Hybrid results benefit from multi-algorithm consensus
      }[strategy] || 1.0;

    // Combine all signals with strategy multiplier
    // Cap at 100 to maintain consistent scoring scale
    const finalScore = (baseScore + usageBoost + successBoost) * strategyMultiplier;
    return Math.min(100, Math.max(0, finalScore)); // Ensure 0-100 range
  }

  /**
   * Generate advanced highlights with context
   */
  private generateAdvancedHighlights(query: string, row: any): string[] {
    const highlights: string[] = [];
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);

    // Check each field for matches
    const fields = [
      { name: 'title', content: row.title, weight: 3 },
      { name: 'problem', content: row.problem, weight: 2 },
      { name: 'solution', content: row.solution, weight: 1 },
    ];

    fields.forEach(field => {
      const lowerContent = field.content.toLowerCase();
      queryTerms.forEach(term => {
        const index = lowerContent.indexOf(term);
        if (index !== -1) {
          const start = Math.max(0, index - 30);
          const end = Math.min(field.content.length, index + term.length + 30);
          const snippet = field.content.substring(start, end);

          highlights.push({
            field: field.name,
            snippet: start > 0 ? '...' + snippet : snippet,
            term: term,
          } as any);
        }
      });
    });

    return highlights.slice(0, 3); // Limit highlights
  }

  /**
   * Calculate query complexity for optimization
   */
  private calculateQueryComplexity(query: string): {
    isComplex: boolean;
    hasFuzzyTerms: boolean;
    termCount: number;
    hasOperators: boolean;
  } {
    const terms = query.split(/\s+/);
    const hasOperators = /[:@]/.test(query);
    const hasFuzzyTerms = terms.some(term => term.length < 3 || /[*?]/.test(term));

    return {
      isComplex: terms.length > 3 || hasOperators,
      hasFuzzyTerms,
      termCount: terms.length,
      hasOperators,
    };
  }

  /**
   * Calculate optimal cache TTL based on query characteristics
   */
  private calculateCacheTTL(options: SearchOptions): number {
    // Longer TTL for category/tag searches (more stable)
    if (options.category || (options.tags && options.tags.length > 0)) {
      return 600000; // 10 minutes
    }

    // Shorter TTL for text searches (content may change)
    return 300000; // 5 minutes
  }

  /**
   * Generate cache tags for precise invalidation
   */
  private generateCacheTags(options: SearchOptions): string[] {
    const tags = ['search'];

    if (options.category) tags.push(`category:${options.category}`);
    if (options.sortBy) tags.push(`sort:${options.sortBy}`);
    if (options.tags) tags.push(...options.tags.map(tag => `tag:${tag}`));

    return tags;
  }

  /**
   * Determine cache priority based on query characteristics
   */
  private getCachePriority(query: string): 'low' | 'normal' | 'high' {
    // High priority for error codes and specific terms
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      return 'high';
    }

    // High priority for common categories
    const commonCategories = ['JCL', 'VSAM', 'DB2', 'CICS', 'Batch'];
    if (commonCategories.some(cat => query.toLowerCase().includes(cat.toLowerCase()))) {
      return 'high';
    }

    return 'normal';
  }

  /**
   * Calculate facets for filtered search
   */
  private async calculateFacets(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<{
    categories: Array<{ name: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
    severities: Array<{ name: string; count: number }>;
  }> {
    const baseWhere = query
      ? 'WHERE (e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?) AND e.archived = FALSE'
      : 'WHERE e.archived = FALSE';

    const params = query ? [`%${query}%`, `%${query}%`, `%${query}%`] : [];

    const [categories, tags, severities] = await Promise.all([
      this.db
        .prepare(
          `
        SELECT e.category as name, COUNT(*) as count
        FROM kb_entries e
        ${baseWhere}
        GROUP BY e.category
        ORDER BY count DESC
        LIMIT 10
      `
        )
        .all(...params),

      this.db
        .prepare(
          `
        SELECT t.tag as name, COUNT(*) as count
        FROM kb_entries e
        JOIN kb_tags t ON e.id = t.entry_id
        ${baseWhere}
        GROUP BY t.tag
        ORDER BY count DESC
        LIMIT 15
      `
        )
        .all(...params),

      this.db
        .prepare(
          `
        SELECT COALESCE(e.severity, 'medium') as name, COUNT(*) as count
        FROM kb_entries e
        ${baseWhere}
        GROUP BY COALESCE(e.severity, 'medium')
        ORDER BY count DESC
      `
        )
        .all(...params),
    ]);

    return { categories, tags, severities };
  }

  /**
   * Prepare FTS query with advanced operators
   */
  private prepareFTSQuery(query: string): string {
    // Handle special prefixes
    if (query.startsWith('category:')) {
      return `category:${query.substring(9)}`;
    }
    if (query.startsWith('tag:')) {
      return `tags:${query.substring(4)}`;
    }

    // Clean and prepare query
    let ftsQuery = query.trim().replace(/['"]/g, '');
    const terms = ftsQuery.split(/\s+/).filter(term => term.length > 1);

    if (terms.length === 0) return ftsQuery;

    // Use phrase search for multi-word queries
    if (terms.length > 1) {
      return `"${terms.join(' ')}"`;
    }

    // Single term with prefix matching
    return `${terms[0]}*`;
  }

  private extractHighlights(query: string, title: string, problem: string): string[] {
    // Legacy method - kept for backward compatibility
    return this.generateAdvancedHighlights(query, { title, problem }) as any;
  }

  private getDiskUsage(): number {
    try {
      if (this.db.name === ':memory:') return 0;
      return fs.statSync(this.db.name).size;
    } catch (error) {
      return 0;
    }
  }

  private logInitializationStats(): void {
    const stats = {
      entries: this.getEntryCount(),
      dbSize: this.formatBytes(this.getDiskUsage()),
      version: this.migrationManager.getCurrentVersion(),
    };

    console.log(
      `📊 Database ready: ${stats.entries} entries, ${stats.dbSize}, schema v${stats.version}`
    );
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export factory function for easy initialization
export async function createKnowledgeDB(
  dbPath?: string,
  options?: {
    backupDir?: string;
    maxBackups?: number;
    autoBackup?: boolean;
    backupInterval?: number;
  }
): Promise<KnowledgeDB> {
  const db = new KnowledgeDB(dbPath, options);

  // Wait for initialization to complete
  await new Promise(resolve => {
    const checkInit = () => {
      if (db['initialized']) {
        resolve(undefined);
      } else {
        setTimeout(checkInit, 100);
      }
    };
    checkInit();
  });

  return db;
}
