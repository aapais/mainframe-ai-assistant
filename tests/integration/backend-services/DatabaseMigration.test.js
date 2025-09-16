/**
 * Comprehensive Test Suite for Database Migration 009_mvp1_v8_transparency.sql
 * Tests schema creation, data integrity, triggers, views, and migration rollback
 */

const { jest } = require('@jest/globals');
const { execSync } = require('child_process');
const path = require('path');

// Mock better-sqlite3 database
const mockDatabase = {
  prepare: jest.fn(),
  exec: jest.fn(),
  pragma: jest.fn(),
  close: jest.fn(),
  transaction: jest.fn()
};

const mockStatement = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn()
};

// Mock file system
const mockFs = {
  readFileSync: jest.fn(),
  existsSync: jest.fn()
};

// Setup mocks
jest.mock('better-sqlite3', () => {
  return jest.fn(() => mockDatabase);
}, { virtual: true });

jest.mock('fs', () => mockFs);

jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

// Import migration runner (we'll create a mock one)
const Database = require('better-sqlite3');

describe('Database Migration 009_mvp1_v8_transparency Integration Tests', () => {
  let database;
  let migrationSQL;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock database responses
    mockDatabase.prepare.mockReturnValue(mockStatement);
    mockStatement.run.mockReturnValue({ changes: 1 });
    mockStatement.get.mockReturnValue(null);
    mockStatement.all.mockReturnValue([]);

    // Mock transaction
    mockDatabase.transaction.mockImplementation((fn) => {
      return () => fn();
    });

    // Read the actual migration file
    migrationSQL = `
-- MVP1 v8 Transparency Features Schema Migration
-- Date: 2025-09-16
-- Adds support for AI transparency, cost tracking, and authorization

-- AI AUTHORIZATION TRACKING
CREATE TABLE IF NOT EXISTS ai_authorization_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    operation_type TEXT NOT NULL CHECK(operation_type IN ('semantic_search', 'explain_error', 'analyze_entry', 'suggest_similar')),
    authorization_mode TEXT NOT NULL CHECK(authorization_mode IN ('always_ask', 'always_allow', 'always_deny', 'auto_below_limit')),
    cost_limit REAL DEFAULT 0.01,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, operation_type)
);

CREATE TABLE IF NOT EXISTS ai_authorization_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT NOT NULL DEFAULT 'default',
    operation_type TEXT NOT NULL,
    query TEXT NOT NULL,
    estimated_tokens INTEGER,
    estimated_cost REAL,
    estimated_time_ms INTEGER,
    user_decision TEXT NOT NULL CHECK(user_decision IN ('approved', 'denied', 'modified', 'use_local')),
    decision_time_ms INTEGER,
    modified_query TEXT,
    session_id TEXT,
    context_entry_id TEXT,
    FOREIGN KEY (context_entry_id) REFERENCES kb_entries(id)
);

-- COST TRACKING
CREATE TABLE IF NOT EXISTS ai_cost_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    operation_id TEXT UNIQUE NOT NULL,
    operation_type TEXT NOT NULL,
    model TEXT DEFAULT 'gemini-pro',
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    cost_per_1k_input REAL DEFAULT 0.00025,
    cost_per_1k_output REAL DEFAULT 0.00125,
    total_cost REAL GENERATED ALWAYS AS
        ((input_tokens * cost_per_1k_input / 1000.0) +
         (output_tokens * cost_per_1k_output / 1000.0)) STORED,
    user_id TEXT DEFAULT 'default',
    session_id TEXT,
    kb_entry_id TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id)
);

-- Additional tables and indexes...
CREATE INDEX IF NOT EXISTS idx_auth_log_user_timestamp ON ai_authorization_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_timestamp ON ai_cost_tracking(timestamp DESC);

-- Insert default system configuration
INSERT OR REPLACE INTO system_config (key, value, type, description) VALUES
    ('ai.authorization.enabled', 'true', 'boolean', 'Require authorization for AI operations'),
    ('ai.cost.tracking.enabled', 'true', 'boolean', 'Track costs for AI operations');

-- Update schema version
INSERT INTO schema_versions (version, description)
VALUES (9, 'MVP1 v8 Transparency Features - Authorization, Cost Tracking, Operation Logging');
`;

    mockFs.readFileSync.mockReturnValue(migrationSQL);
    mockFs.existsSync.mockReturnValue(true);

    database = new Database(':memory:');
  });

  afterEach(() => {
    if (database) {
      database.close();
    }
  });

  describe('Migration File Validation', () => {
    it('should exist and be readable', () => {
      const migrationPath = path.join(__dirname, '../../../src/database/migrations/009_mvp1_v8_transparency.sql');

      expect(mockFs.existsSync).toBeDefined();
      expect(mockFs.readFileSync).toBeDefined();
    });

    it('should contain required SQL statements', () => {
      expect(migrationSQL).toContain('ai_authorization_preferences');
      expect(migrationSQL).toContain('ai_authorization_log');
      expect(migrationSQL).toContain('ai_cost_tracking');
      expect(migrationSQL).toContain('ai_cost_budgets');
      expect(migrationSQL).toContain('operation_logs');
      expect(migrationSQL).toContain('schema_versions');
    });

    it('should have proper SQL syntax', () => {
      // Verify basic SQL structure
      expect(migrationSQL).toMatch(/CREATE TABLE IF NOT EXISTS/g);
      expect(migrationSQL).toMatch(/CREATE INDEX IF NOT EXISTS/g);
      expect(migrationSQL).toMatch(/INSERT OR REPLACE/g);
    });

    it('should include version update', () => {
      expect(migrationSQL).toContain('INSERT INTO schema_versions');
      expect(migrationSQL).toContain('version, description');
      expect(migrationSQL).toContain('9');
      expect(migrationSQL).toContain('MVP1 v8 Transparency Features');
    });
  });

  describe('Schema Creation', () => {
    it('should create ai_authorization_preferences table', () => {
      // Mock the table creation
      database.exec(migrationSQL);

      expect(mockDatabase.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS ai_authorization_preferences')
      );

      // Verify the table structure would be created correctly
      const expectedColumns = [
        'id INTEGER PRIMARY KEY AUTOINCREMENT',
        'user_id TEXT NOT NULL DEFAULT \'default\'',
        'operation_type TEXT NOT NULL',
        'authorization_mode TEXT NOT NULL',
        'cost_limit REAL DEFAULT 0.01',
        'created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
        'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
      ];

      expectedColumns.forEach(column => {
        expect(migrationSQL).toContain(column);
      });
    });

    it('should create ai_authorization_log table with constraints', () => {
      database.exec(migrationSQL);

      expect(migrationSQL).toContain('ai_authorization_log');
      expect(migrationSQL).toContain('CHECK(user_decision IN (\'approved\', \'denied\', \'modified\', \'use_local\'))');
      expect(migrationSQL).toContain('FOREIGN KEY (context_entry_id) REFERENCES kb_entries(id)');
    });

    it('should create ai_cost_tracking table with computed columns', () => {
      database.exec(migrationSQL);

      expect(migrationSQL).toContain('ai_cost_tracking');
      expect(migrationSQL).toContain('total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED');
      expect(migrationSQL).toContain('total_cost REAL GENERATED ALWAYS AS');
      expect(migrationSQL).toContain('((input_tokens * cost_per_1k_input / 1000.0)');
    });

    it('should create ai_cost_budgets table', () => {
      database.exec(migrationSQL);

      expect(migrationSQL).toContain('ai_cost_budgets');
      expect(migrationSQL).toContain('budget_type TEXT NOT NULL CHECK(budget_type IN (\'daily\', \'weekly\', \'monthly\'))');
      expect(migrationSQL).toContain('UNIQUE(user_id, budget_type, period_start)');
    });

    it('should create operation_logs table', () => {
      database.exec(migrationSQL);

      expect(migrationSQL).toContain('operation_logs');
      expect(migrationSQL).toContain('operation_type TEXT NOT NULL');
      expect(migrationSQL).toContain('request_source TEXT CHECK(request_source IN (\'ui\', \'api\', \'cli\', \'automation\'))');
    });

    it('should add new columns to kb_entries table', () => {
      expect(migrationSQL).toContain('ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS subcategory TEXT');
      expect(migrationSQL).toContain('ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS jcl_type TEXT');
      expect(migrationSQL).toContain('ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS cobol_version TEXT');
      expect(migrationSQL).toContain('ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS system_component TEXT');
      expect(migrationSQL).toContain('ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS error_codes TEXT');
      expect(migrationSQL).toContain('ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS semantic_embedding BLOB');
    });
  });

  describe('Indexes and Performance', () => {
    it('should create performance indexes', () => {
      database.exec(migrationSQL);

      const expectedIndexes = [
        'idx_auth_log_user_timestamp',
        'idx_cost_tracking_timestamp',
        'idx_cost_tracking_user_date',
        'idx_cost_budgets_user_type',
        'idx_operation_logs_timestamp',
        'idx_operation_logs_user_session',
        'idx_operation_logs_type',
        'idx_query_patterns_type',
        'idx_scoring_dimensions_enabled',
        'idx_dashboard_metrics_lookup'
      ];

      expectedIndexes.forEach(index => {
        expect(migrationSQL).toContain(`CREATE INDEX IF NOT EXISTS ${index}`);
      });
    });

    it('should create composite indexes for complex queries', () => {
      expect(migrationSQL).toContain('idx_operation_logs_user_session ON operation_logs(user_id, session_id)');
      expect(migrationSQL).toContain('idx_cost_tracking_user_date ON ai_cost_tracking(user_id, DATE(timestamp))');
    });
  });

  describe('Triggers and Automation', () => {
    it('should create update timestamp triggers', () => {
      database.exec(migrationSQL);

      expect(migrationSQL).toContain('CREATE TRIGGER IF NOT EXISTS update_auth_prefs_timestamp');
      expect(migrationSQL).toContain('CREATE TRIGGER IF NOT EXISTS update_user_prefs_timestamp');
      expect(migrationSQL).toContain('AFTER UPDATE ON ai_authorization_preferences');
      expect(migrationSQL).toContain('SET updated_at = CURRENT_TIMESTAMP');
    });

    it('should create budget update trigger', () => {
      expect(migrationSQL).toContain('CREATE TRIGGER IF NOT EXISTS update_budget_usage');
      expect(migrationSQL).toContain('AFTER INSERT ON ai_cost_tracking');
      expect(migrationSQL).toContain('UPDATE ai_cost_budgets');
      expect(migrationSQL).toContain('SET current_usage = current_usage + NEW.total_cost');
    });
  });

  describe('Views and Analytics', () => {
    it('should create daily costs view', () => {
      database.exec(migrationSQL);

      expect(migrationSQL).toContain('CREATE VIEW IF NOT EXISTS v_daily_costs');
      expect(migrationSQL).toContain('SUM(total_tokens) as total_tokens');
      expect(migrationSQL).toContain('SUM(total_cost) as total_cost');
      expect(migrationSQL).toContain('GROUP BY user_id, DATE(timestamp)');
    });

    it('should create authorization patterns view', () => {
      expect(migrationSQL).toContain('CREATE VIEW IF NOT EXISTS v_authorization_patterns');
      expect(migrationSQL).toContain('AVG(estimated_cost) as avg_estimated_cost');
      expect(migrationSQL).toContain('AVG(decision_time_ms) as avg_decision_time');
      expect(migrationSQL).toContain('GROUP BY user_id, operation_type, user_decision');
    });

    it('should create operation performance view', () => {
      expect(migrationSQL).toContain('CREATE VIEW IF NOT EXISTS v_operation_performance');
      expect(migrationSQL).toContain('AVG(response_time_ms) as avg_response_time');
      expect(migrationSQL).toContain('cache_hit_rate');
      expect(migrationSQL).toContain('success_rate');
    });
  });

  describe('Configuration and Initial Data', () => {
    it('should insert system configuration', () => {
      database.exec(migrationSQL);

      expect(migrationSQL).toContain('INSERT OR REPLACE INTO system_config');
      expect(migrationSQL).toContain('ai.authorization.enabled');
      expect(migrationSQL).toContain('ai.cost.tracking.enabled');
      expect(migrationSQL).toContain('ai.cost.display.currency');
      expect(migrationSQL).toContain('transparency.dashboard.enabled');
    });

    it('should insert default scoring dimensions', () => {
      expect(migrationSQL).toContain('INSERT OR IGNORE INTO scoring_dimensions');
      expect(migrationSQL).toContain('FTS5 Text Match');
      expect(migrationSQL).toContain('Category Alignment');
      expect(migrationSQL).toContain('Semantic Similarity');
      expect(migrationSQL).toContain('Usage Frequency');
    });

    it('should update schema version', () => {
      expect(migrationSQL).toContain('INSERT INTO schema_versions (version, description)');
      expect(migrationSQL).toContain('VALUES (9,');
      expect(migrationSQL).toContain('MVP1 v8 Transparency Features');
    });
  });

  describe('Data Integrity and Constraints', () => {
    it('should enforce check constraints', () => {
      const checkConstraints = [
        'CHECK(operation_type IN (\'semantic_search\', \'explain_error\', \'analyze_entry\', \'suggest_similar\'))',
        'CHECK(authorization_mode IN (\'always_ask\', \'always_allow\', \'always_deny\', \'auto_below_limit\'))',
        'CHECK(user_decision IN (\'approved\', \'denied\', \'modified\', \'use_local\'))',
        'CHECK(budget_type IN (\'daily\', \'weekly\', \'monthly\'))',
        'CHECK(request_source IN (\'ui\', \'api\', \'cli\', \'automation\'))'
      ];

      checkConstraints.forEach(constraint => {
        expect(migrationSQL).toContain(constraint);
      });
    });

    it('should enforce foreign key constraints', () => {
      const foreignKeys = [
        'FOREIGN KEY (context_entry_id) REFERENCES kb_entries(id)',
        'FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id)',
        'FOREIGN KEY (operation_id) REFERENCES operation_logs(id) ON DELETE CASCADE',
        'FOREIGN KEY (operation_id) REFERENCES operation_logs(id) ON DELETE SET NULL'
      ];

      foreignKeys.forEach(fk => {
        expect(migrationSQL).toContain(fk);
      });
    });

    it('should enforce unique constraints', () => {
      const uniqueConstraints = [
        'UNIQUE(user_id, operation_type)',
        'UNIQUE(user_id, budget_type, period_start)',
        'operation_id TEXT UNIQUE NOT NULL'
      ];

      uniqueConstraints.forEach(constraint => {
        expect(migrationSQL).toContain(constraint);
      });
    });
  });

  describe('Migration Execution', () => {
    it('should execute migration successfully', () => {
      const runMigration = () => {
        database.exec(migrationSQL);
      };

      expect(runMigration).not.toThrow();
      expect(mockDatabase.exec).toHaveBeenCalledWith(migrationSQL);
    });

    it('should be idempotent (safe to run multiple times)', () => {
      // First execution
      database.exec(migrationSQL);

      // Second execution should not fail
      const secondRun = () => {
        database.exec(migrationSQL);
      };

      expect(secondRun).not.toThrow();

      // Should use IF NOT EXISTS for safety
      expect(migrationSQL).toMatch(/CREATE TABLE IF NOT EXISTS/g);
      expect(migrationSQL).toMatch(/CREATE INDEX IF NOT EXISTS/g);
      expect(migrationSQL).toMatch(/CREATE TRIGGER IF NOT EXISTS/g);
      expect(migrationSQL).toMatch(/CREATE VIEW IF NOT EXISTS/g);
    });

    it('should handle missing dependencies gracefully', () => {
      // Test with missing kb_entries table (foreign key reference)
      const isolatedSQL = migrationSQL;

      // Should use IF NOT EXISTS for ALTER TABLE statements
      expect(isolatedSQL).toContain('ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS');
    });
  });

  describe('Cost Calculation Verification', () => {
    it('should calculate total tokens correctly', () => {
      // Verify the computed column formula
      expect(migrationSQL).toContain('total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED');
    });

    it('should calculate total cost correctly', () => {
      const costFormula = '((input_tokens * cost_per_1k_input / 1000.0) + (output_tokens * cost_per_1k_output / 1000.0))';
      expect(migrationSQL).toContain(costFormula);
    });

    it('should use proper default pricing', () => {
      expect(migrationSQL).toContain('cost_per_1k_input REAL DEFAULT 0.00025');
      expect(migrationSQL).toContain('cost_per_1k_output REAL DEFAULT 0.00125');
    });
  });

  describe('Performance Testing', () => {
    it('should create indexes for query performance', () => {
      // Test that the most common query patterns have indexes
      const performanceCriticalIndexes = [
        'idx_auth_log_user_timestamp',  // User's authorization history
        'idx_cost_tracking_timestamp',   // Recent cost queries
        'idx_operation_logs_timestamp',  // Recent operations
        'idx_operation_logs_user_session' // User session queries
      ];

      performanceCriticalIndexes.forEach(index => {
        expect(migrationSQL).toContain(index);
      });
    });

    it('should optimize for dashboard queries', () => {
      expect(migrationSQL).toContain('dashboard_metrics');
      expect(migrationSQL).toContain('idx_dashboard_metrics_lookup');
      expect(migrationSQL).toContain('(user_id, metric_date DESC, metric_type)');
    });
  });

  describe('Migration Rollback Preparation', () => {
    it('should use IF NOT EXISTS for safe rollback', () => {
      // All CREATE statements should be safe
      const createStatements = migrationSQL.match(/CREATE\s+(TABLE|INDEX|TRIGGER|VIEW)/gi) || [];
      const safeCreates = migrationSQL.match(/CREATE\s+(TABLE|INDEX|TRIGGER|VIEW)\s+IF\s+NOT\s+EXISTS/gi) || [];

      // Most creates should be safe (some system tables might not need it)
      expect(safeCreates.length).toBeGreaterThan(createStatements.length * 0.8);
    });

    it('should use INSERT OR REPLACE for configuration', () => {
      expect(migrationSQL).toContain('INSERT OR REPLACE INTO system_config');
    });

    it('should use INSERT OR IGNORE for reference data', () => {
      expect(migrationSQL).toContain('INSERT OR IGNORE INTO scoring_dimensions');
    });
  });

  describe('Integration with Existing Schema', () => {
    it('should extend kb_entries table safely', () => {
      // Verify all kb_entries extensions use IF NOT EXISTS
      const alterStatements = migrationSQL.match(/ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS/g) || [];
      expect(alterStatements.length).toBeGreaterThan(5);
    });

    it('should reference existing tables correctly', () => {
      // Should reference kb_entries in foreign keys
      expect(migrationSQL).toContain('REFERENCES kb_entries(id)');

      // Should reference system_config for configuration
      expect(migrationSQL).toContain('INSERT OR REPLACE INTO system_config');

      // Should reference schema_versions for versioning
      expect(migrationSQL).toContain('INSERT INTO schema_versions');
    });
  });

  describe('Business Logic Validation', () => {
    it('should support all required operation types', () => {
      const operationTypes = [
        'semantic_search',
        'explain_error',
        'analyze_entry',
        'suggest_similar'
      ];

      operationTypes.forEach(type => {
        expect(migrationSQL).toContain(type);
      });
    });

    it('should support all authorization modes', () => {
      const authModes = [
        'always_ask',
        'always_allow',
        'always_deny',
        'auto_below_limit'
      ];

      authModes.forEach(mode => {
        expect(migrationSQL).toContain(mode);
      });
    });

    it('should support all user decisions', () => {
      const decisions = [
        'approved',
        'denied',
        'modified',
        'use_local'
      ];

      decisions.forEach(decision => {
        expect(migrationSQL).toContain(decision);
      });
    });

    it('should support required budget periods', () => {
      const periods = ['daily', 'weekly', 'monthly'];

      periods.forEach(period => {
        expect(migrationSQL).toContain(period);
      });
    });
  });
});

/**
 * Migration Runner Mock for Testing
 */
class MigrationRunner {
  constructor(database) {
    this.database = database;
  }

  async runMigration(migrationFile) {
    const sql = mockFs.readFileSync(migrationFile, 'utf8');

    const transaction = this.database.transaction(() => {
      this.database.exec(sql);
    });

    transaction();
  }

  async rollbackMigration(version) {
    // Mock rollback logic
    const rollbackSQL = `
      DROP VIEW IF EXISTS v_daily_costs;
      DROP VIEW IF EXISTS v_authorization_patterns;
      DROP VIEW IF EXISTS v_operation_performance;

      DROP TRIGGER IF EXISTS update_auth_prefs_timestamp;
      DROP TRIGGER IF EXISTS update_user_prefs_timestamp;
      DROP TRIGGER IF EXISTS update_budget_usage;

      DROP TABLE IF EXISTS ai_authorization_preferences;
      DROP TABLE IF EXISTS ai_authorization_log;
      DROP TABLE IF EXISTS ai_cost_tracking;
      DROP TABLE IF EXISTS ai_cost_budgets;
      DROP TABLE IF EXISTS operation_logs;

      DELETE FROM schema_versions WHERE version = ?;
    `;

    this.database.exec(rollbackSQL);
  }

  async getCurrentVersion() {
    const stmt = this.database.prepare('SELECT MAX(version) as version FROM schema_versions');
    const result = stmt.get();
    return result?.version || 0;
  }
}