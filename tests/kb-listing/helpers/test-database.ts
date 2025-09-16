/**
 * Test database utilities
 * Provides setup and teardown for database tests
 */

import Database from 'better-sqlite3';
import { KBEntry } from '../../../src/types';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

export interface TestDatabaseOptions {
  seed?: boolean;
  schema?: string;
  memory?: boolean;
  verbose?: boolean;
}

/**
 * Create a test database instance
 */
export function createTestDatabase(options: TestDatabaseOptions = {}): Database.Database {
  const {
    memory = true,
    verbose = false,
    schema
  } = options;

  // Use in-memory database for tests by default
  const dbPath = memory ? ':memory:' : path.join(__dirname, '../fixtures/test.db');

  const db = new Database(dbPath, {
    verbose: verbose ? console.log : undefined
  });

  // Enable foreign key support
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Initialize schema
  if (schema) {
    db.exec(schema);
  } else {
    initializeTestSchema(db);
  }

  return db;
}

/**
 * Initialize the standard test schema
 */
export function initializeTestSchema(db: Database.Database): void {
  const schema = `
    -- Knowledge Base entries table
    CREATE TABLE IF NOT EXISTS kb_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      problem TEXT NOT NULL,
      solution TEXT NOT NULL,
      category TEXT CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other')),
      severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system',
      updated_by TEXT,
      usage_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_used DATETIME,
      archived BOOLEAN DEFAULT FALSE,
      archived_at DATETIME,
      version INTEGER DEFAULT 1
    );

    -- Tags table for many-to-many relationship
    CREATE TABLE IF NOT EXISTS kb_tags (
      entry_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entry_id, tag),
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    );

    -- Full-text search virtual table
    CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
      id UNINDEXED,
      title,
      problem,
      solution,
      tags,
      category,
      content=kb_entries
    );

    -- Search history for analytics
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      results_count INTEGER DEFAULT 0,
      selected_entry_id TEXT,
      user_id TEXT,
      session_id TEXT,
      source TEXT DEFAULT 'manual'
    );

    -- Usage metrics for tracking
    CREATE TABLE IF NOT EXISTS usage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT NOT NULL,
      action TEXT CHECK(action IN ('view', 'copy', 'rate_success', 'rate_failure', 'edit', 'create', 'delete')) NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id TEXT,
      session_id TEXT,
      metadata TEXT, -- JSON for additional data
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    );

    -- Saved searches table
    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      query_json TEXT NOT NULL, -- JSON serialized ListingOptions
      user_id TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      tags_json TEXT, -- JSON array of tags
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      usage_count INTEGER DEFAULT 0,
      last_used DATETIME,
      shortcut TEXT UNIQUE -- Keyboard shortcut
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_kb_category ON kb_entries(category);
    CREATE INDEX IF NOT EXISTS idx_kb_created_at ON kb_entries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_updated_at ON kb_entries(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_usage_count ON kb_entries(usage_count DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_success_rate ON kb_entries(success_count, failure_count);
    CREATE INDEX IF NOT EXISTS idx_kb_last_used ON kb_entries(last_used DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_archived ON kb_entries(archived, archived_at);

    CREATE INDEX IF NOT EXISTS idx_tags_entry_id ON kb_tags(entry_id);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON kb_tags(tag);

    CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_search_user ON search_history(user_id, timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_metrics_entry ON usage_metrics(entry_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_metrics_action ON usage_metrics(action, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_metrics_user ON usage_metrics(user_id, timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_saved_searches_public ON saved_searches(is_public, updated_at DESC);
  `;

  db.exec(schema);
}

/**
 * Seed the database with test data
 */
export async function seedTestData(
  db: Database.Database,
  entries: KBEntry[],
  options: { includeTags?: boolean; includeMetrics?: boolean } = {}
): Promise<void> {
  const { includeTags = true, includeMetrics = true } = options;

  // Prepare statements for better performance
  const insertEntry = db.prepare(`
    INSERT INTO kb_entries (
      id, title, problem, solution, category, severity,
      created_at, updated_at, created_by,
      usage_count, success_count, failure_count, last_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO kb_tags (entry_id, tag) VALUES (?, ?)
  `);

  const insertFTS = db.prepare(`
    INSERT INTO kb_fts (id, title, problem, solution, tags, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMetric = db.prepare(`
    INSERT INTO usage_metrics (entry_id, action, timestamp, user_id)
    VALUES (?, ?, ?, ?)
  `);

  // Use transaction for better performance
  const transaction = db.transaction(() => {
    for (const entry of entries) {
      // Insert main entry
      insertEntry.run(
        entry.id,
        entry.title,
        entry.problem || '',
        entry.solution || '',
        entry.category || 'Other',
        entry.severity || 'medium',
        entry.created_at || new Date().toISOString(),
        entry.updated_at || new Date().toISOString(),
        entry.created_by || 'test-user',
        entry.usage_count || 0,
        entry.success_count || 0,
        entry.failure_count || 0,
        entry.last_used || null
      );

      // Insert tags
      if (includeTags && entry.tags) {
        for (const tag of entry.tags) {
          insertTag.run(entry.id, tag);
        }
      }

      // Insert FTS entry
      const tagsText = entry.tags?.join(' ') || '';
      insertFTS.run(
        entry.id,
        entry.title,
        entry.problem || '',
        entry.solution || '',
        tagsText,
        entry.category || ''
      );

      // Insert sample metrics
      if (includeMetrics && entry.usage_count && entry.usage_count > 0) {
        const metricsCount = Math.min(entry.usage_count, 10); // Limit for test performance
        for (let i = 0; i < metricsCount; i++) {
          const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
          insertMetric.run(
            entry.id,
            Math.random() > 0.8 ? 'rate_success' : 'view',
            timestamp.toISOString(),
            `test-user-${Math.floor(Math.random() * 5) + 1}`
          );
        }
      }
    }
  });

  transaction();
}

/**
 * Seed the database with realistic test scenarios
 */
export async function seedRealisticData(db: Database.Database): Promise<void> {
  const scenarios = generateRealisticScenarios();
  await seedTestData(db, scenarios, { includeTags: true, includeMetrics: true });

  // Add some search history
  const insertSearch = db.prepare(`
    INSERT INTO search_history (query, timestamp, results_count, user_id)
    VALUES (?, ?, ?, ?)
  `);

  const searches = [
    { query: 'VSAM error', results: 5, user: 'user1' },
    { query: 'JCL syntax', results: 3, user: 'user2' },
    { query: 'S0C7 abend', results: 8, user: 'user1' },
    { query: 'database connection', results: 2, user: 'user3' },
    { query: 'file not found', results: 12, user: 'user2' }
  ];

  const transaction = db.transaction(() => {
    for (const search of searches) {
      const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      insertSearch.run(
        search.query,
        timestamp.toISOString(),
        search.results,
        search.user
      );
    }
  });

  transaction();
}

/**
 * Generate realistic KB entry scenarios for testing
 */
function generateRealisticScenarios(): KBEntry[] {
  return [
    {
      id: 'entry-vsam-001',
      title: 'VSAM Status 35 - File Not Found',
      problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file for processing.',
      solution: '1. Verify the dataset exists using LISTCAT\n2. Check DD statement has correct DSN\n3. Ensure file is cataloged\n4. Verify RACF permissions',
      category: 'VSAM',
      severity: 'high',
      tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
      usage_count: 45,
      success_count: 40,
      failure_count: 5,
      created_by: 'support-team'
    },
    {
      id: 'entry-jcl-001',
      title: 'S0C7 Data Exception in COBOL Program',
      problem: 'COBOL program abends with S0C7 data exception during arithmetic operations.',
      solution: '1. Check for non-numeric data in numeric fields\n2. Initialize COMP-3 fields properly\n3. Use NUMERIC test before arithmetic\n4. Review input data validation',
      category: 'Batch',
      severity: 'critical',
      tags: ['s0c7', 'data-exception', 'numeric', 'abend'],
      usage_count: 67,
      success_count: 58,
      failure_count: 9,
      created_by: 'dev-team'
    },
    {
      id: 'entry-db2-001',
      title: 'DB2 SQLCODE -904 Resource Unavailable',
      problem: 'Application receives SQLCODE -904 indicating database resource is unavailable.',
      solution: '1. Check tablespace status with -DISPLAY DATABASE\n2. Run IMAGE COPY if in COPY pending\n3. REBUILD INDEX if needed\n4. Contact DBA for persistent issues',
      category: 'DB2',
      severity: 'high',
      tags: ['db2', 'sqlcode', '-904', 'resource', 'unavailable'],
      usage_count: 23,
      success_count: 20,
      failure_count: 3,
      created_by: 'dba-team'
    },
    {
      id: 'entry-jcl-002',
      title: 'JCL Dataset Not Found IEF212I',
      problem: 'Job fails with IEF212I dataset not found error during allocation.',
      solution: '1. Verify dataset name spelling\n2. Check dataset exists with LISTD\n3. For GDG verify generation exists\n4. Check VOL and UNIT parameters\n5. Ensure quotes around dataset name',
      category: 'JCL',
      severity: 'medium',
      tags: ['jcl', 'dataset', 'not-found', 'ief212i', 'allocation'],
      usage_count: 89,
      success_count: 82,
      failure_count: 7,
      created_by: 'ops-team'
    },
    {
      id: 'entry-batch-001',
      title: 'Sort Failed WER027A Insufficient Storage',
      problem: 'DFSORT utility fails with WER027A insufficient storage message.',
      solution: '1. Increase REGION parameter to REGION=0M\n2. Add DYNALLOC parameters\n3. Use OPTION MAINSIZE=MAX\n4. Check SORTWORK allocation\n5. Consider file size estimate',
      category: 'Batch',
      severity: 'medium',
      tags: ['sort', 'dfsort', 'wer027a', 'storage', 'memory'],
      usage_count: 34,
      success_count: 31,
      failure_count: 3,
      created_by: 'support-team'
    },
    {
      id: 'entry-functional-001',
      title: 'CICS Transaction ASRA Abend',
      problem: 'CICS transaction fails with ASRA abend (program check).',
      solution: '1. Check CEDF for exact offset\n2. Review compile listing at offset\n3. Check for storage violations\n4. Verify COMMAREA length\n5. Enable CICS trace with CETR',
      category: 'Functional',
      severity: 'high',
      tags: ['cics', 'asra', 'abend', 'program-check'],
      usage_count: 56,
      success_count: 48,
      failure_count: 8,
      created_by: 'cics-team'
    }
  ];
}

/**
 * Clean up test database
 */
export function cleanupTestDatabase(db: Database.Database): void {
  if (!db) return;

  try {
    // Close the database connection
    if (db.open) {
      db.close();
    }
  } catch (error) {
    console.warn('Error closing test database:', error);
  }
}

/**
 * Clear all data from test database (for between tests)
 */
export function clearTestData(db: Database.Database): void {
  const tables = [
    'usage_metrics',
    'search_history',
    'kb_fts',
    'kb_tags',
    'kb_entries',
    'saved_searches'
  ];

  const transaction = db.transaction(() => {
    for (const table of tables) {
      try {
        db.prepare(`DELETE FROM ${table}`).run();
      } catch (error) {
        // Table might not exist, continue
      }
    }
  });

  transaction();
}

/**
 * Get database statistics for debugging
 */
export function getDatabaseStats(db: Database.Database): any {
  const stats = {
    entries: db.prepare('SELECT COUNT(*) as count FROM kb_entries').get(),
    tags: db.prepare('SELECT COUNT(*) as count FROM kb_tags').get(),
    searches: db.prepare('SELECT COUNT(*) as count FROM search_history').get(),
    metrics: db.prepare('SELECT COUNT(*) as count FROM usage_metrics').get(),
    categories: db.prepare(`
      SELECT category, COUNT(*) as count
      FROM kb_entries
      GROUP BY category
    `).all(),
    recentSearches: db.prepare(`
      SELECT query, timestamp
      FROM search_history
      ORDER BY timestamp DESC
      LIMIT 5
    `).all()
  };

  return stats;
}

/**
 * Verify database integrity
 */
export function verifyDatabaseIntegrity(db: Database.Database): boolean {
  try {
    // Check foreign key constraints
    const pragmaCheck = db.pragma('foreign_key_check');
    if (pragmaCheck.length > 0) {
      console.error('Foreign key constraint violations:', pragmaCheck);
      return false;
    }

    // Check table integrity
    const integrityCheck = db.pragma('integrity_check');
    if (integrityCheck[0]?.integrity_check !== 'ok') {
      console.error('Database integrity check failed:', integrityCheck);
      return false;
    }

    // Verify critical indexes exist
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name LIKE 'idx_%'
    `).all();

    const expectedIndexes = [
      'idx_kb_category',
      'idx_kb_updated_at',
      'idx_kb_usage_count'
    ];

    const missingIndexes = expectedIndexes.filter(expected =>
      !indexes.some(idx => idx.name === expected)
    );

    if (missingIndexes.length > 0) {
      console.warn('Missing expected indexes:', missingIndexes);
    }

    return true;
  } catch (error) {
    console.error('Database integrity verification failed:', error);
    return false;
  }
}

/**
 * Create test database with specific performance characteristics
 */
export function createPerformanceTestDatabase(): Database.Database {
  const db = createTestDatabase({ memory: true, verbose: false });

  // Optimize for performance testing
  db.pragma('cache_size = 10000'); // 10MB cache
  db.pragma('temp_store = memory');
  db.pragma('mmap_size = 268435456'); // 256MB
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  return db;
}