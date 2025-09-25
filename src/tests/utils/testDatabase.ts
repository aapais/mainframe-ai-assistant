/**
 * Test Database Setup and Utilities
 *
 * Provides in-memory database setup, transaction management,
 * and cleanup utilities for integration tests.
 */

import Database from 'better-sqlite3';
import { KnowledgeDB } from '../../database/KnowledgeDB';
import { TagService } from '../../services/EnhancedTagService';
import { CategoryService } from '../../services/CategoryHierarchyService';

// ===========================
// TEST DATABASE SETUP
// ===========================

export interface TestDatabase {
  knowledgeDB: KnowledgeDB;
  tagService: TagService;
  categoryService: CategoryService;
  rawDB: Database.Database;
  cleanup: () => Promise<void>;
  reset: () => Promise<void>;
  beginTransaction: () => void;
  rollbackTransaction: () => void;
  commitTransaction: () => void;
}

export const setupTestDatabase = async (): Promise<TestDatabase> => {
  // Create in-memory database
  const rawDB = new Database(':memory:');

  // Enable foreign keys and WAL mode for testing
  rawDB.pragma('foreign_keys = ON');
  rawDB.pragma('journal_mode = WAL');

  // Initialize schema
  const schema = `
    -- Knowledge Base Tables
    CREATE TABLE IF NOT EXISTS kb_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      problem TEXT NOT NULL,
      solution TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system',
      usage_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      success_rate REAL DEFAULT 0.0,
      trending_score REAL DEFAULT 0.0,
      last_used DATETIME
    );

    -- Categories Table
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      is_system BOOLEAN DEFAULT 0,
      entry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      trending_score REAL DEFAULT 0.0,
      FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE SET NULL
    );

    -- Tags Table
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      color TEXT,
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system',
      category TEXT,
      is_system BOOLEAN DEFAULT 0,
      auto_suggest BOOLEAN DEFAULT 1,
      related_tags TEXT DEFAULT '[]',
      synonyms TEXT DEFAULT '[]'
    );

    -- Entry-Tag Junction Table
    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id TEXT,
      tag_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entry_id, tag_name),
      FOREIGN KEY (entry_id) REFERENCES kb_entries (id) ON DELETE CASCADE
    );

    -- Full-text search tables
    CREATE VIRTUAL TABLE IF NOT EXISTS kb_entries_fts USING fts5(
      id UNINDEXED,
      title,
      problem,
      solution,
      tags,
      content=kb_entries
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS tags_fts USING fts5(
      id UNINDEXED,
      name,
      description,
      synonyms,
      content=tags
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_kb_category ON kb_entries(category);
    CREATE INDEX IF NOT EXISTS idx_kb_usage ON kb_entries(usage_count DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_success_rate ON kb_entries(success_rate DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_trending ON kb_entries(trending_score DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_last_used ON kb_entries(last_used DESC);

    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
    CREATE INDEX IF NOT EXISTS idx_categories_trending ON categories(trending_score DESC);

    CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags(usage_count DESC);
    CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
    CREATE INDEX IF NOT EXISTS idx_tags_auto_suggest ON tags(auto_suggest);

    -- Test-specific tables for tracking operations
    CREATE TABLE IF NOT EXISTS test_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      operation_data TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      test_session TEXT
    );

    CREATE TABLE IF NOT EXISTS test_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_name TEXT UNIQUE NOT NULL,
      kb_entries_data TEXT,
      tags_data TEXT,
      categories_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  rawDB.exec(schema);

  // Create service instances
  const knowledgeDB = new KnowledgeDB(':memory:', { database: rawDB });
  const tagService = new TagService(rawDB);
  const categoryService = new CategoryService(rawDB);

  // Transaction management
  let currentTransaction: Database.Transaction | null = null;

  const beginTransaction = () => {
    if (currentTransaction) {
      throw new Error('Transaction already in progress');
    }
    currentTransaction = rawDB.transaction(() => {});
    currentTransaction.immediate();
  };

  const rollbackTransaction = () => {
    if (currentTransaction) {
      currentTransaction.rollback();
      currentTransaction = null;
    }
  };

  const commitTransaction = () => {
    if (currentTransaction) {
      currentTransaction.commit();
      currentTransaction = null;
    }
  };

  const cleanup = async () => {
    if (currentTransaction) {
      rollbackTransaction();
    }
    rawDB.close();
  };

  const reset = async () => {
    if (currentTransaction) {
      rollbackTransaction();
    }

    // Clear all tables
    const tables = [
      'test_operations',
      'test_snapshots',
      'entry_tags',
      'kb_entries_fts',
      'tags_fts',
      'kb_entries',
      'tags',
      'categories',
    ];

    rawDB.transaction(() => {
      tables.forEach(table => {
        try {
          rawDB.prepare(`DELETE FROM ${table}`).run();
        } catch (error) {
          // Ignore errors for virtual tables that might not support DELETE
          console.warn(`Could not clear table ${table}:`, error);
        }
      });
    })();
  };

  return {
    knowledgeDB,
    tagService,
    categoryService,
    rawDB,
    cleanup,
    reset,
    beginTransaction,
    rollbackTransaction,
    commitTransaction,
  };
};

// ===========================
// TEST DATA SEEDERS
// ===========================

export const seedDatabase = async (
  db: TestDatabase,
  data: {
    entries?: any[];
    tags?: any[];
    categories?: any[];
  }
) => {
  const { knowledgeDB, tagService, categoryService } = db;

  // Seed categories first
  if (data.categories) {
    for (const category of data.categories) {
      await categoryService.createCategory(category);
    }
  }

  // Seed tags
  if (data.tags) {
    for (const tag of data.tags) {
      await tagService.createTag(tag);
    }
  }

  // Seed entries
  if (data.entries) {
    for (const entry of data.entries) {
      await knowledgeDB.addEntry(entry);
    }
  }
};

// ===========================
// TEST ASSERTIONS
// ===========================

export const createDatabaseAssertions = (db: TestDatabase) => ({
  async assertEntryExists(entryId: string) {
    const entry = await db.knowledgeDB.getEntry(entryId);
    expect(entry).toBeDefined();
    return entry;
  },

  async assertEntryCount(expectedCount: number) {
    const count = db.rawDB.prepare('SELECT COUNT(*) as count FROM kb_entries').get() as {
      count: number;
    };
    expect(count.count).toBe(expectedCount);
  },

  async assertTagExists(tagName: string) {
    const tag = await db.tagService.getTag(tagName);
    expect(tag).toBeDefined();
    return tag;
  },

  async assertTagCount(expectedCount: number) {
    const count = db.rawDB.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number };
    expect(count.count).toBe(expectedCount);
  },

  async assertCategoryExists(categoryId: string) {
    const category = await db.categoryService.getCategory(categoryId);
    expect(category).toBeDefined();
    return category;
  },

  async assertCategoryCount(expectedCount: number) {
    const count = db.rawDB.prepare('SELECT COUNT(*) as count FROM categories').get() as {
      count: number;
    };
    expect(count.count).toBe(expectedCount);
  },

  async assertEntryHasTag(entryId: string, tagName: string) {
    const entry = await db.knowledgeDB.getEntry(entryId);
    expect(entry?.tags).toContain(tagName);
  },

  async assertEntryHasCategory(entryId: string, categoryName: string) {
    const entry = await db.knowledgeDB.getEntry(entryId);
    expect(entry?.category).toBe(categoryName);
  },

  async assertForeignKeyIntegrity() {
    // Check that all entry categories exist
    const orphanedEntries = db.rawDB
      .prepare(
        `
      SELECT e.id, e.category
      FROM kb_entries e
      LEFT JOIN categories c ON e.category = c.name
      WHERE c.name IS NULL AND e.category != 'Other'
    `
      )
      .all();

    expect(orphanedEntries).toHaveLength(0);

    // Check that all entry tags exist
    const orphanedTags = db.rawDB
      .prepare(
        `
      SELECT et.entry_id, et.tag_name
      FROM entry_tags et
      LEFT JOIN tags t ON et.tag_name = t.name
      WHERE t.name IS NULL
    `
      )
      .all();

    expect(orphanedTags).toHaveLength(0);
  },

  async assertIndexUsage(query: string, expectedIndexes: string[]) {
    const plan = db.rawDB.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
    const planText = plan.map((row: any) => row.detail).join(' ');

    expectedIndexes.forEach(index => {
      expect(planText).toContain(index);
    });
  },
});

// ===========================
// PERFORMANCE TESTING
// ===========================

export const createPerformanceTester = (db: TestDatabase) => ({
  async measureQueryPerformance(
    query: string,
    params: any[] = []
  ): Promise<{
    duration: number;
    rowCount: number;
    result: any[];
  }> {
    const start = performance.now();
    const result = db.rawDB.prepare(query).all(...params);
    const end = performance.now();

    return {
      duration: end - start,
      rowCount: result.length,
      result,
    };
  },

  async benchmarkBulkInsert(
    count: number,
    generator: (index: number) => any
  ): Promise<{
    duration: number;
    rate: number; // operations per second
  }> {
    const start = performance.now();

    const insertStmt = db.rawDB.prepare(`
      INSERT INTO kb_entries (id, title, problem, solution, category, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.rawDB.transaction((items: any[]) => {
      for (const item of items) {
        insertStmt.run(
          item.id,
          item.title,
          item.problem,
          item.solution,
          item.category,
          JSON.stringify(item.tags)
        );
      }
    });

    const items = Array.from({ length: count }, (_, i) => generator(i));
    transaction(items);

    const end = performance.now();
    const duration = end - start;

    return {
      duration,
      rate: count / (duration / 1000),
    };
  },

  async profileQuery(
    query: string,
    params: any[] = []
  ): Promise<{
    duration: number;
    plan: any[];
    stats: any;
  }> {
    // Get query plan
    const plan = db.rawDB.prepare(`EXPLAIN QUERY PLAN ${query}`).all();

    // Measure execution time
    const start = performance.now();
    const result = db.rawDB.prepare(query).all(...params);
    const end = performance.now();

    // Get database stats
    const stats = {
      pageReads: db.rawDB.pragma('cache_spill', { simple: true }),
      memoryUsed: db.rawDB.pragma('memory_used', { simple: true }),
      resultRows: result.length,
    };

    return {
      duration: end - start,
      plan,
      stats,
    };
  },
});

// ===========================
// SNAPSHOT TESTING
// ===========================

export const createSnapshotManager = (db: TestDatabase) => ({
  async createSnapshot(name: string) {
    const kbEntries = db.rawDB.prepare('SELECT * FROM kb_entries ORDER BY id').all();
    const tags = db.rawDB.prepare('SELECT * FROM tags ORDER BY name').all();
    const categories = db.rawDB.prepare('SELECT * FROM categories ORDER BY name').all();

    db.rawDB
      .prepare(
        `
      INSERT OR REPLACE INTO test_snapshots (snapshot_name, kb_entries_data, tags_data, categories_data)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(name, JSON.stringify(kbEntries), JSON.stringify(tags), JSON.stringify(categories));
  },

  async restoreSnapshot(name: string) {
    const snapshot = db.rawDB
      .prepare(
        `
      SELECT kb_entries_data, tags_data, categories_data
      FROM test_snapshots
      WHERE snapshot_name = ?
    `
      )
      .get(name);

    if (!snapshot) {
      throw new Error(`Snapshot '${name}' not found`);
    }

    // Clear current data
    await db.reset();

    // Restore data
    const kbEntries = JSON.parse(snapshot.kb_entries_data);
    const tags = JSON.parse(snapshot.tags_data);
    const categories = JSON.parse(snapshot.categories_data);

    const transaction = db.rawDB.transaction(() => {
      // Restore categories
      const insertCategory = db.rawDB.prepare(`
        INSERT INTO categories (id, name, description, icon, color, is_system, entry_count,
                               created_at, updated_at, parent_id, sort_order, tags, trending_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      categories.forEach((cat: any) => {
        insertCategory.run(
          cat.id,
          cat.name,
          cat.description,
          cat.icon,
          cat.color,
          cat.is_system,
          cat.entry_count,
          cat.created_at,
          cat.updated_at,
          cat.parent_id,
          cat.sort_order,
          cat.tags,
          cat.trending_score
        );
      });

      // Restore tags
      const insertTag = db.rawDB.prepare(`
        INSERT INTO tags (id, name, description, color, usage_count, created_at, created_by,
                         category, is_system, auto_suggest, related_tags, synonyms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      tags.forEach((tag: any) => {
        insertTag.run(
          tag.id,
          tag.name,
          tag.description,
          tag.color,
          tag.usage_count,
          tag.created_at,
          tag.created_by,
          tag.category,
          tag.is_system,
          tag.auto_suggest,
          tag.related_tags,
          tag.synonyms
        );
      });

      // Restore entries
      const insertEntry = db.rawDB.prepare(`
        INSERT INTO kb_entries (id, title, problem, solution, category, tags, created_at,
                               updated_at, created_by, usage_count, success_count, failure_count,
                               success_rate, trending_score, last_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      kbEntries.forEach((entry: any) => {
        insertEntry.run(
          entry.id,
          entry.title,
          entry.problem,
          entry.solution,
          entry.category,
          entry.tags,
          entry.created_at,
          entry.updated_at,
          entry.created_by,
          entry.usage_count,
          entry.success_count,
          entry.failure_count,
          entry.success_rate,
          entry.trending_score,
          entry.last_used
        );
      });
    });

    transaction();
  },

  async compareWithSnapshot(name: string): Promise<{
    identical: boolean;
    differences: any;
  }> {
    const current = {
      kbEntries: db.rawDB.prepare('SELECT * FROM kb_entries ORDER BY id').all(),
      tags: db.rawDB.prepare('SELECT * FROM tags ORDER BY name').all(),
      categories: db.rawDB.prepare('SELECT * FROM categories ORDER BY name').all(),
    };

    const snapshot = db.rawDB
      .prepare(
        `
      SELECT kb_entries_data, tags_data, categories_data
      FROM test_snapshots
      WHERE snapshot_name = ?
    `
      )
      .get(name);

    if (!snapshot) {
      return { identical: false, differences: { error: 'Snapshot not found' } };
    }

    const snapshotData = {
      kbEntries: JSON.parse(snapshot.kb_entries_data),
      tags: JSON.parse(snapshot.tags_data),
      categories: JSON.parse(snapshot.categories_data),
    };

    const differences = {
      kbEntries: {
        added: current.kbEntries.filter(e => !snapshotData.kbEntries.some(s => s.id === e.id)),
        removed: snapshotData.kbEntries.filter(s => !current.kbEntries.some(e => e.id === s.id)),
        modified: [],
      },
      tags: {
        added: current.tags.filter(t => !snapshotData.tags.some(s => s.name === t.name)),
        removed: snapshotData.tags.filter(s => !current.tags.some(t => t.name === s.name)),
        modified: [],
      },
      categories: {
        added: current.categories.filter(c => !snapshotData.categories.some(s => s.id === c.id)),
        removed: snapshotData.categories.filter(s => !current.categories.some(c => c.id === s.id)),
        modified: [],
      },
    };

    const identical = Object.values(differences).every(
      diff => diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0
    );

    return { identical, differences };
  },
});
