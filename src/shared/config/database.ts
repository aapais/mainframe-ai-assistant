import path from 'path';
import { app } from 'electron';

/**
 * Database Configuration for MVP1
 * 
 * SQLite database for local Knowledge Base storage
 * Features:
 * - Local-first architecture
 * - No external dependencies
 * - Fast search (<1s requirement)
 * - Supports offline operation
 */

// Import from centralized configuration types
import type { DatabaseConfig } from '@/types/shared/config';

/**
 * Get database configuration based on environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  const isDev = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  
  // Get app data directory
  const userDataPath = app ? app.getPath('userData') : '.';
  const dbPath = path.join(userDataPath, 'database');
  
  return {
    type: 'sqlite',
    path: dbPath,
    filename: isTest ? ':memory:' : 'knowledge-base.db',
    
    options: {
      verbose: isDev,
      readonly: false,
      fileMustExist: false,
      timeout: 5000,
      busyTimeout: 10000
    },
    
    migrations: {
      directory: path.join(__dirname, '../../database/migrations'),
      tableName: 'migrations'
    },
    
    seeds: {
      directory: path.join(__dirname, '../../database/seeds'),
      loadInitialData: true // Load 30+ initial KB entries for MVP1
    },
    
    backup: {
      enabled: !isTest,
      directory: path.join(dbPath, 'backups'),
      interval: 24 * 60 * 60 * 1000, // Daily backup
      maxBackups: 7 // Keep 1 week of backups
    },
    
    performance: {
      walMode: true, // Write-Ahead Logging for better concurrency
      cacheSize: 10000, // ~10MB cache
      pageSize: 4096,
      journalMode: 'WAL'
    }
  };
}

/**
 * Database connection settings
 */
export const CONNECTION_CONFIG = {
  // Connection pool settings
  pool: {
    min: 1,
    max: isDevelopment() ? 5 : 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  },
  
  // Query settings
  query: {
    timeout: 30000,
    defaultLimit: 100,
    maxLimit: 1000
  },
  
  // Full-text search settings
  fts: {
    enabled: true,
    minWordLength: 3,
    maxResults: 50,
    languageSupport: ['english']
  }
};

/**
 * Database tables schema definition
 */
export const TABLES = {
  // Core Knowledge Base table
  KB_ENTRIES: 'kb_entries',
  KB_TAGS: 'kb_tags',
  KB_CATEGORIES: 'kb_categories',
  
  // Usage tracking
  USAGE_METRICS: 'usage_metrics',
  SEARCH_HISTORY: 'search_history',
  USER_RATINGS: 'user_ratings',
  
  // Full-text search
  KB_FTS: 'kb_fts',
  
  // Future MVP tables (prepared for evolution)
  PATTERNS: 'patterns',          // MVP2
  CODE_REFERENCES: 'code_refs',  // MVP3
  TEMPLATES: 'templates',         // MVP4
  ML_MODELS: 'ml_models'         // MVP5
} as const;

/**
 * Database indexes for performance
 */
export const INDEXES = {
  // Primary indexes for fast search
  'idx_kb_entries_category': {
    table: TABLES.KB_ENTRIES,
    columns: ['category'],
    unique: false
  },
  'idx_kb_entries_created': {
    table: TABLES.KB_ENTRIES,
    columns: ['created_at'],
    unique: false
  },
  'idx_kb_entries_usage': {
    table: TABLES.KB_ENTRIES,
    columns: ['usage_count', 'success_rate'],
    unique: false
  },
  
  // Tag search optimization
  'idx_kb_tags_entry': {
    table: TABLES.KB_TAGS,
    columns: ['entry_id'],
    unique: false
  },
  'idx_kb_tags_tag': {
    table: TABLES.KB_TAGS,
    columns: ['tag'],
    unique: false
  },
  
  // Search history for suggestions
  'idx_search_history_timestamp': {
    table: TABLES.SEARCH_HISTORY,
    columns: ['timestamp'],
    unique: false
  },
  'idx_search_history_query': {
    table: TABLES.SEARCH_HISTORY,
    columns: ['query'],
    unique: false
  }
};

/**
 * Helper function to check if in development mode
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get full database path
 */
export function getFullDatabasePath(): string {
  const config = getDatabaseConfig();
  return path.join(config.path, config.filename);
}

/**
 * Get backup path for a given date
 */
export function getBackupPath(date: Date = new Date()): string {
  const config = getDatabaseConfig();
  const timestamp = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(config.backup.directory, `backup-${timestamp}.db`);
}

export default getDatabaseConfig();