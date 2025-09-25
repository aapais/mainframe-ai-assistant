'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.INDEXES = exports.TABLES = exports.CONNECTION_CONFIG = void 0;
exports.getDatabaseConfig = getDatabaseConfig;
exports.getFullDatabasePath = getFullDatabasePath;
exports.getBackupPath = getBackupPath;
const tslib_1 = require('tslib');
const path_1 = tslib_1.__importDefault(require('path'));
const electron_1 = require('electron');
function getDatabaseConfig() {
  const isDev = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';
  const userDataPath = electron_1.app ? electron_1.app.getPath('userData') : '.';
  const dbPath = path_1.default.join(userDataPath, 'database');
  return {
    type: 'sqlite',
    path: dbPath,
    filename: isTest ? ':memory:' : 'knowledge-base.db',
    options: {
      verbose: isDev,
      readonly: false,
      fileMustExist: false,
      timeout: 5000,
      busyTimeout: 10000,
    },
    migrations: {
      directory: path_1.default.join(__dirname, '../../database/migrations'),
      tableName: 'migrations',
    },
    seeds: {
      directory: path_1.default.join(__dirname, '../../database/seeds'),
      loadInitialData: true,
    },
    backup: {
      enabled: !isTest,
      directory: path_1.default.join(dbPath, 'backups'),
      interval: 24 * 60 * 60 * 1000,
      maxBackups: 7,
    },
    performance: {
      walMode: true,
      cacheSize: 10000,
      pageSize: 4096,
      journalMode: 'WAL',
    },
  };
}
exports.CONNECTION_CONFIG = {
  pool: {
    min: 1,
    max: isDevelopment() ? 5 : 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
  query: {
    timeout: 30000,
    defaultLimit: 100,
    maxLimit: 1000,
  },
  fts: {
    enabled: true,
    minWordLength: 3,
    maxResults: 50,
    languageSupport: ['english'],
  },
};
exports.TABLES = {
  KB_ENTRIES: 'kb_entries',
  KB_TAGS: 'kb_tags',
  KB_CATEGORIES: 'kb_categories',
  USAGE_METRICS: 'usage_metrics',
  SEARCH_HISTORY: 'search_history',
  USER_RATINGS: 'user_ratings',
  KB_FTS: 'kb_fts',
  PATTERNS: 'patterns',
  CODE_REFERENCES: 'code_refs',
  TEMPLATES: 'templates',
  ML_MODELS: 'ml_models',
};
exports.INDEXES = {
  idx_kb_entries_category: {
    table: exports.TABLES.KB_ENTRIES,
    columns: ['category'],
    unique: false,
  },
  idx_kb_entries_created: {
    table: exports.TABLES.KB_ENTRIES,
    columns: ['created_at'],
    unique: false,
  },
  idx_kb_entries_usage: {
    table: exports.TABLES.KB_ENTRIES,
    columns: ['usage_count', 'success_rate'],
    unique: false,
  },
  idx_kb_tags_entry: {
    table: exports.TABLES.KB_TAGS,
    columns: ['entry_id'],
    unique: false,
  },
  idx_kb_tags_tag: {
    table: exports.TABLES.KB_TAGS,
    columns: ['tag'],
    unique: false,
  },
  idx_search_history_timestamp: {
    table: exports.TABLES.SEARCH_HISTORY,
    columns: ['timestamp'],
    unique: false,
  },
  idx_search_history_query: {
    table: exports.TABLES.SEARCH_HISTORY,
    columns: ['query'],
    unique: false,
  },
};
function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}
function getFullDatabasePath() {
  const config = getDatabaseConfig();
  return path_1.default.join(config.path, config.filename);
}
function getBackupPath(date = new Date()) {
  const config = getDatabaseConfig();
  const timestamp = date.toISOString().split('T')[0];
  return path_1.default.join(config.backup.directory, `backup-${timestamp}.db`);
}
exports.default = getDatabaseConfig();
//# sourceMappingURL=database.js.map
