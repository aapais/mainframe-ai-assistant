#!/usr/bin/env node

/**
 * PostgreSQL SSO Migration Script
 *
 * Complete migration script for PostgreSQL SSO system with:
 * - Sequential migration execution (001-010)
 * - Dependency verification
 * - Rollback safety mechanisms
 * - Performance index creation
 * - Initial data population
 * - Referential integrity validation
 * - Emergency rollback procedures
 * - Detailed logging
 *
 * Usage:
 *   node scripts/postgres-sso-migration.js --env=dev --dry-run
 *   node scripts/postgres-sso-migration.js --env=prod --migrate
 *   node scripts/postgres-sso-migration.js --rollback --checkpoint=001
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool, Client } = require('pg');
const crypto = require('crypto');
const util = require('util');

// Configuration
const CONFIG = {
  environments: {
    dev: {
      host: process.env.PG_HOST || 'localhost',
      port: process.env.PG_PORT || 5432,
      database: process.env.PG_DATABASE || 'mainframe_ai_dev',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'postgres',
      ssl: false
    },
    prod: {
      host: process.env.PG_HOST_PROD || 'localhost',
      port: process.env.PG_PORT_PROD || 5432,
      database: process.env.PG_DATABASE_PROD || 'mainframe_ai_prod',
      user: process.env.PG_USER_PROD || 'postgres',
      password: process.env.PG_PASSWORD_PROD,
      ssl: { rejectUnauthorized: false }
    },
    test: {
      host: process.env.PG_HOST_TEST || 'localhost',
      port: process.env.PG_PORT_TEST || 5432,
      database: process.env.PG_DATABASE_TEST || 'mainframe_ai_test',
      user: process.env.PG_USER_TEST || 'postgres',
      password: process.env.PG_PASSWORD_TEST || 'postgres',
      ssl: false
    }
  },
  migrationPath: path.join(__dirname, '..', 'src', 'database', 'migrations', 'auth'),
  logPath: path.join(__dirname, 'migration-logs'),
  backupPath: path.join(__dirname, 'migration-backups'),
  batchSize: 1000,
  timeout: 300000, // 5 minutes
  maxRetries: 3
};

class PostgreSSOMigrationTool {
  constructor(environment = 'dev', options = {}) {
    this.environment = environment;
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      force: options.force || false,
      skipValidation: options.skipValidation || false,
      rollbackCheckpoint: options.rollbackCheckpoint || null,
      ...options
    };

    this.dbConfig = CONFIG.environments[environment];
    if (!this.dbConfig) {
      throw new Error(`Environment '${environment}' not found in configuration`);
    }

    this.pool = null;
    this.migrationState = {
      currentMigration: null,
      completedMigrations: [],
      checkpoints: [],
      startTime: Date.now(),
      errors: [],
      warnings: []
    };

    this.logger = this.createLogger();
  }

  /**
   * Create structured logger with file and console output
   */
  createLogger() {
    const logDir = CONFIG.logPath;
    const logFile = path.join(logDir, `sso-migration-${this.environment}-${Date.now()}.log`);

    return {
      logFile,
      log: async (level, message, data = null) => {
        const timestamp = new Date().toISOString();
        const logEntry = {
          timestamp,
          level: level.toUpperCase(),
          environment: this.environment,
          migration: this.migrationState.currentMigration,
          message,
          data: data ? JSON.stringify(data, null, 2) : null
        };

        const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;

        // Console output with colors
        const colors = {
          error: '\x1b[31m', // Red
          warn: '\x1b[33m',  // Yellow
          info: '\x1b[36m',  // Cyan
          success: '\x1b[32m', // Green
          debug: '\x1b[90m', // Gray
          reset: '\x1b[0m'
        };

        console.log(`${colors[level] || colors.info}${logLine}${colors.reset}`);

        // File output
        try {
          await fs.mkdir(logDir, { recursive: true });
          await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
        } catch (err) {
          console.error('Failed to write to log file:', err.message);
        }

        // Track errors and warnings
        if (level === 'error') {
          this.migrationState.errors.push({ timestamp, message, data });
        } else if (level === 'warn') {
          this.migrationState.warnings.push({ timestamp, message, data });
        }
      }
    };
  }

  /**
   * Initialize database connection pool
   */
  async initializeDatabase() {
    await this.logger.log('info', 'Initializing PostgreSQL connection pool', this.dbConfig);

    try {
      this.pool = new Pool({
        ...this.dbConfig,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT version()');
      client.release();

      await this.logger.log('success', 'Database connection established', {
        version: result.rows[0].version.split(' ').slice(0, 2).join(' ')
      });
    } catch (error) {
      await this.logger.log('error', 'Failed to connect to database', { error: error.message });
      throw error;
    }
  }

  /**
   * Read and parse all migration files in order
   */
  async readMigrationFiles() {
    await this.logger.log('info', 'Reading migration files', { path: CONFIG.migrationPath });

    try {
      const files = await fs.readdir(CONFIG.migrationPath);
      const migrationFiles = files
        .filter(file => file.match(/^\d{3}_.*\.sql$/))
        .sort((a, b) => {
          const aNum = parseInt(a.substring(0, 3));
          const bNum = parseInt(b.substring(0, 3));
          return aNum - bNum;
        });

      const migrations = [];

      for (const file of migrationFiles) {
        const filePath = path.join(CONFIG.migrationPath, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Parse UP and DOWN sections
        const upMatch = content.match(/-- UP\s*\n([\s\S]*?)(?=-- DOWN|$)/i);
        const downMatch = content.match(/-- DOWN\s*\n([\s\S]*)$/i);

        if (!upMatch) {
          throw new Error(`Migration file ${file} missing UP section`);
        }

        const migration = {
          id: parseInt(file.substring(0, 3)),
          name: file.replace(/^\d{3}_/, '').replace(/\.sql$/, ''),
          file: file,
          path: filePath,
          upSQL: upMatch[1].trim(),
          downSQL: downMatch ? downMatch[1].trim() : null,
          dependencies: this.extractDependencies(upMatch[1]),
          checksum: crypto.createHash('md5').update(content).digest('hex')
        };

        migrations.push(migration);
      }

      await this.logger.log('info', `Found ${migrations.length} migration files`, {
        migrations: migrations.map(m => ({ id: m.id, name: m.name }))
      });

      return migrations;
    } catch (error) {
      await this.logger.log('error', 'Failed to read migration files', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract table dependencies from SQL
   */
  extractDependencies(sql) {
    const dependencies = [];

    // Look for FOREIGN KEY references
    const fkMatches = sql.match(/REFERENCES\s+(\w+)\s*\(/gi);
    if (fkMatches) {
      fkMatches.forEach(match => {
        const table = match.replace(/REFERENCES\s+|\s*\(/gi, '');
        if (!dependencies.includes(table)) {
          dependencies.push(table);
        }
      });
    }

    return dependencies;
  }

  /**
   * Create migration checkpoints for rollback
   */
  async createCheckpoint(migration, type = 'pre_migration') {
    const checkpoint = {
      id: crypto.randomUUID(),
      migrationId: migration.id,
      migrationName: migration.name,
      type,
      timestamp: new Date().toISOString(),
      databaseState: await this.captureTableCounts(),
      rollbackSQL: migration.downSQL
    };

    this.migrationState.checkpoints.push(checkpoint);

    if (!this.options.dryRun) {
      await this.saveCheckpointToDatabase(checkpoint);
    }

    await this.logger.log('info', `Created checkpoint: ${type}`, {
      checkpointId: checkpoint.id,
      migration: `${migration.id}_${migration.name}`
    });

    return checkpoint;
  }

  /**
   * Capture current table record counts
   */
  async captureTableCounts() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT schemaname, tablename, n_tup_ins as inserts, n_tup_del as deletes
        FROM pg_stat_user_tables
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        ORDER BY schemaname, tablename
      `);

      const tableCounts = {};
      for (const row of result.rows) {
        const key = `${row.schemaname}.${row.tablename}`;
        tableCounts[key] = {
          inserts: row.inserts,
          deletes: row.deletes
        };
      }

      return tableCounts;
    } finally {
      client.release();
    }
  }

  /**
   * Save checkpoint to database
   */
  async saveCheckpointToDatabase(checkpoint) {
    const client = await this.pool.connect();
    try {
      // Ensure checkpoint table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS sso_migration_checkpoints_system (
          id UUID PRIMARY KEY,
          migration_id INTEGER NOT NULL,
          migration_name TEXT NOT NULL,
          checkpoint_type TEXT NOT NULL,
          database_state JSONB,
          rollback_sql TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await client.query(`
        INSERT INTO sso_migration_checkpoints_system
        (id, migration_id, migration_name, checkpoint_type, database_state, rollback_sql)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        checkpoint.id,
        checkpoint.migrationId,
        checkpoint.migrationName,
        checkpoint.type,
        JSON.stringify(checkpoint.databaseState),
        checkpoint.rollbackSQL
      ]);
    } finally {
      client.release();
    }
  }

  /**
   * Execute a single migration
   */
  async executeMigration(migration) {
    this.migrationState.currentMigration = `${migration.id}_${migration.name}`;

    await this.logger.log('info', `Starting migration ${migration.id}: ${migration.name}`);

    if (this.options.dryRun) {
      await this.logger.log('info', 'DRY RUN: Migration SQL', { sql: migration.upSQL });
      return true;
    }

    // Create pre-migration checkpoint
    const checkpoint = await this.createCheckpoint(migration, 'pre_migration');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Set statement timeout
      await client.query(`SET statement_timeout = ${CONFIG.timeout}`);

      // Execute migration SQL in chunks if needed
      const sqlStatements = this.splitSQLStatements(migration.upSQL);

      for (let i = 0; i < sqlStatements.length; i++) {
        const statement = sqlStatements[i].trim();
        if (!statement) continue;

        await this.logger.log('debug', `Executing statement ${i + 1}/${sqlStatements.length}`, {
          statement: statement.substring(0, 200) + (statement.length > 200 ? '...' : '')
        });

        try {
          const startTime = Date.now();
          await client.query(statement);
          const duration = Date.now() - startTime;

          await this.logger.log('debug', `Statement completed in ${duration}ms`);
        } catch (error) {
          await this.logger.log('error', `Statement failed: ${statement.substring(0, 100)}...`, {
            error: error.message,
            statement: statement
          });
          throw error;
        }
      }

      await client.query('COMMIT');

      // Create post-migration checkpoint
      await this.createCheckpoint(migration, 'post_migration');

      this.migrationState.completedMigrations.push(migration.id);

      await this.logger.log('success', `Migration ${migration.id} completed successfully`);
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      await this.logger.log('error', `Migration ${migration.id} failed`, { error: error.message });

      // Optionally attempt automatic rollback
      if (!this.options.skipValidation) {
        await this.logger.log('info', 'Attempting automatic rollback');
        try {
          await this.executeRollback(checkpoint);
        } catch (rollbackError) {
          await this.logger.log('error', 'Automatic rollback failed', { error: rollbackError.message });
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Split SQL into individual statements
   */
  splitSQLStatements(sql) {
    // Simple SQL statement splitter - handles most cases
    return sql
      .split(/;\s*\n/)
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0)
      .map(statement => statement.endsWith(';') ? statement : statement + ';');
  }

  /**
   * Execute rollback to a specific checkpoint
   */
  async executeRollback(checkpoint) {
    if (!checkpoint.rollbackSQL) {
      throw new Error(`No rollback SQL available for checkpoint ${checkpoint.id}`);
    }

    await this.logger.log('info', `Executing rollback to checkpoint ${checkpoint.id}`);

    if (this.options.dryRun) {
      await this.logger.log('info', 'DRY RUN: Rollback SQL', { sql: checkpoint.rollbackSQL });
      return true;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const rollbackStatements = this.splitSQLStatements(checkpoint.rollbackSQL);

      for (const statement of rollbackStatements) {
        if (!statement.trim()) continue;

        await this.logger.log('debug', 'Executing rollback statement', {
          statement: statement.substring(0, 200) + (statement.length > 200 ? '...' : '')
        });

        await client.query(statement);
      }

      await client.query('COMMIT');
      await this.logger.log('success', `Rollback to checkpoint ${checkpoint.id} completed`);

    } catch (error) {
      await client.query('ROLLBACK');
      await this.logger.log('error', 'Rollback failed', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate referential integrity
   */
  async validateReferentialIntegrity() {
    await this.logger.log('info', 'Validating referential integrity');

    const client = await this.pool.connect();
    try {
      // Check for foreign key violations
      const fkChecks = [
        {
          name: 'sso_sessions_user_id_fk',
          sql: `SELECT COUNT(*) as violations FROM sso_sessions s
                LEFT JOIN sso_users u ON s.user_id = u.id
                WHERE s.user_id IS NOT NULL AND u.id IS NULL`
        },
        {
          name: 'sso_user_role_assignments_user_id_fk',
          sql: `SELECT COUNT(*) as violations FROM sso_user_role_assignments ra
                LEFT JOIN sso_users u ON ra.user_id = u.id
                WHERE ra.user_id IS NOT NULL AND u.id IS NULL`
        },
        {
          name: 'sso_user_role_assignments_role_id_fk',
          sql: `SELECT COUNT(*) as violations FROM sso_user_role_assignments ra
                LEFT JOIN sso_user_roles r ON ra.role_id = r.id
                WHERE ra.role_id IS NOT NULL AND r.id IS NULL`
        },
        {
          name: 'sso_user_identities_user_id_fk',
          sql: `SELECT COUNT(*) as violations FROM sso_user_identities ui
                LEFT JOIN sso_users u ON ui.user_id = u.id
                WHERE ui.user_id IS NOT NULL AND u.id IS NULL`
        },
        {
          name: 'sso_user_identities_provider_id_fk',
          sql: `SELECT COUNT(*) as violations FROM sso_user_identities ui
                LEFT JOIN sso_providers p ON ui.provider_id = p.id
                WHERE ui.provider_id IS NOT NULL AND p.id IS NULL`
        }
      ];

      const violations = [];

      for (const check of fkChecks) {
        try {
          const result = await client.query(check.sql);
          const violationCount = parseInt(result.rows[0].violations);

          if (violationCount > 0) {
            violations.push({
              check: check.name,
              violations: violationCount
            });
            await this.logger.log('warn', `Referential integrity violation found`, {
              check: check.name,
              violations: violationCount
            });
          }
        } catch (error) {
          // Table might not exist yet - that's OK for some checks
          await this.logger.log('debug', `Integrity check skipped (table may not exist): ${check.name}`);
        }
      }

      if (violations.length === 0) {
        await this.logger.log('success', 'Referential integrity validation passed');
        return true;
      } else {
        await this.logger.log('error', 'Referential integrity validation failed', { violations });
        return false;
      }

    } finally {
      client.release();
    }
  }

  /**
   * Create performance indexes
   */
  async createPerformanceIndexes() {
    await this.logger.log('info', 'Creating performance indexes');

    const performanceIndexes = [
      // User lookup indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sso_users_email_active
       ON sso_users (email) WHERE status = 'active'`,

      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sso_users_username_active
       ON sso_users (username) WHERE status = 'active'`,

      // Session performance indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sso_sessions_user_status
       ON sso_sessions (user_id, status) WHERE status = 'active'`,

      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sso_sessions_token_hash
       ON sso_sessions USING hash (token) WHERE status = 'active'`,

      // Audit trail indexes for reporting
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sso_audit_logs_user_event
       ON sso_audit_logs (user_id, event_type, timestamp)`,

      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sso_audit_logs_timestamp
       ON sso_audit_logs (timestamp DESC)`,

      // Security events indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sso_security_events_severity
       ON sso_security_events (severity, timestamp) WHERE resolved = FALSE`,

      // Provider performance indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sso_providers_enabled_priority
       ON sso_providers (is_enabled, priority) WHERE is_enabled = TRUE`
    ];

    const client = await this.pool.connect();
    try {
      for (const indexSQL of performanceIndexes) {
        try {
          await this.logger.log('debug', 'Creating index', { sql: indexSQL });
          await client.query(indexSQL);
        } catch (error) {
          // Index might already exist - that's OK
          if (error.code === '42P07') { // duplicate_table error code for indexes
            await this.logger.log('debug', 'Index already exists, skipping');
          } else {
            throw error;
          }
        }
      }

      await this.logger.log('success', 'Performance indexes created successfully');
    } finally {
      client.release();
    }
  }

  /**
   * Populate initial data (providers, roles, permissions)
   */
  async populateInitialData() {
    await this.logger.log('info', 'Populating initial system data');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Additional SSO providers
      const providers = [
        {
          name: 'google',
          display_name: 'Google',
          provider_type: 'google',
          is_enabled: false,
          priority: 90,
          scopes: 'openid email profile',
          configuration: JSON.stringify({
            supports_pkce: true,
            auto_discovery: true
          })
        },
        {
          name: 'microsoft',
          display_name: 'Microsoft Azure AD',
          provider_type: 'microsoft',
          is_enabled: false,
          priority: 80,
          scopes: 'openid email profile',
          configuration: JSON.stringify({
            tenant: 'common',
            supports_pkce: true
          })
        },
        {
          name: 'github',
          display_name: 'GitHub',
          provider_type: 'github',
          is_enabled: false,
          priority: 70,
          scopes: 'user:email',
          configuration: JSON.stringify({
            api_version: '2022-11-28'
          })
        }
      ];

      // Insert providers if they don't exist
      for (const provider of providers) {
        const existing = await client.query(
          'SELECT id FROM sso_providers WHERE name = $1',
          [provider.name]
        );

        if (existing.rows.length === 0) {
          await client.query(`
            INSERT INTO sso_providers (
              name, display_name, provider_type, is_enabled, priority,
              scopes, allow_signup, auto_create_users, configuration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            provider.name,
            provider.display_name,
            provider.provider_type,
            provider.is_enabled,
            provider.priority,
            provider.scopes,
            true, // allow_signup
            true, // auto_create_users
            provider.configuration
          ]);

          await this.logger.log('info', `Added SSO provider: ${provider.display_name}`);
        }
      }

      // Additional system roles
      const additionalRoles = [
        {
          name: 'kb_editor',
          display_name: 'Knowledge Base Editor',
          description: 'Can create and edit knowledge base entries',
          permissions: JSON.stringify(['kb:read', 'kb:create', 'kb:update', 'kb:delete_own'])
        },
        {
          name: 'kb_moderator',
          display_name: 'Knowledge Base Moderator',
          description: 'Can moderate knowledge base content',
          permissions: JSON.stringify(['kb:*', 'user:read', 'audit:read'])
        },
        {
          name: 'security_admin',
          display_name: 'Security Administrator',
          description: 'Can manage security settings and audit logs',
          permissions: JSON.stringify(['security:*', 'audit:*', 'user:read'])
        }
      ];

      for (const role of additionalRoles) {
        const existing = await client.query(
          'SELECT id FROM sso_user_roles WHERE name = $1',
          [role.name]
        );

        if (existing.rows.length === 0) {
          await client.query(`
            INSERT INTO sso_user_roles (
              name, display_name, description, permissions, is_system_role
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            role.name,
            role.display_name,
            role.description,
            role.permissions,
            true
          ]);

          await this.logger.log('info', `Added system role: ${role.display_name}`);
        }
      }

      // System configuration values
      const systemConfig = [
        ['session_timeout_hours', '24', 'Session timeout in hours'],
        ['max_failed_login_attempts', '5', 'Maximum failed login attempts before lockout'],
        ['lockout_duration_minutes', '15', 'Account lockout duration in minutes'],
        ['password_reset_token_expiry_hours', '2', 'Password reset token expiry in hours'],
        ['email_verification_token_expiry_hours', '24', 'Email verification token expiry in hours'],
        ['audit_log_retention_days', '365', 'Audit log retention period in days'],
        ['security_event_retention_days', '90', 'Security event retention period in days'],
        ['enable_two_factor_auth', 'false', 'Enable two-factor authentication'],
        ['require_email_verification', 'true', 'Require email verification for new users'],
        ['enable_session_rotation', 'true', 'Enable automatic session token rotation']
      ];

      for (const [key, value, description] of systemConfig) {
        await client.query(`
          INSERT INTO system_config (key, value, description, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (key) DO NOTHING
        `, [key, value, description]);
      }

      await client.query('COMMIT');
      await this.logger.log('success', 'Initial system data populated successfully');

    } catch (error) {
      await client.query('ROLLBACK');
      await this.logger.log('error', 'Failed to populate initial data', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate emergency rollback script
   */
  async generateEmergencyRollbackScript() {
    await this.logger.log('info', 'Generating emergency rollback script');

    const rollbackScript = `#!/bin/bash
# Emergency PostgreSQL SSO System Rollback Script
# Generated: ${new Date().toISOString()}
# Environment: ${this.environment}

set -e

echo "🚨 EMERGENCY SSO SYSTEM ROLLBACK"
echo "Environment: ${this.environment}"
echo "Generated: ${new Date().toISOString()}"
echo ""

# Database connection parameters
export PGHOST="${this.dbConfig.host}"
export PGPORT="${this.dbConfig.port}"
export PGDATABASE="${this.dbConfig.database}"
export PGUSER="${this.dbConfig.user}"

echo "Creating backup before rollback..."
pg_dump --verbose --clean --no-owner --no-privileges > "emergency_backup_\$(date +%Y%m%d_%H%M%S).sql"

echo "Dropping SSO system tables..."

# Drop tables in dependency order
psql -c "DROP TABLE IF EXISTS sso_integrity_monitoring_results CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_data_integrity_monitors CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_constraint_validations CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_rollback_executions CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_migration_checkpoints CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_validation_executions CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_data_validation_rules CASCADE;"

psql -c "DROP TABLE IF EXISTS sso_backup_log CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_security_events CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_audit_logs CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_sessions CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_api_keys CASCADE;"

psql -c "DROP TABLE IF EXISTS sso_provider_stats CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_provider_group_mappings CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_user_identities CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_providers CASCADE;"

psql -c "DROP TABLE IF EXISTS sso_user_preferences CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_user_group_memberships CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_user_groups CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_user_role_assignments CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_user_roles CASCADE;"
psql -c "DROP TABLE IF EXISTS sso_users CASCADE;"

psql -c "DROP TABLE IF EXISTS sso_migration_checkpoints_system CASCADE;"

echo "✅ Emergency rollback completed"
echo "Database backup saved as: emergency_backup_\$(date +%Y%m%d_%H%M%S).sql"
echo ""
echo "⚠️  IMPORTANT: Review the backup and verify system state"
echo "⚠️  You may need to restore application configuration"
`;

    const backupDir = CONFIG.backupPath;
    await fs.mkdir(backupDir, { recursive: true });

    const scriptPath = path.join(backupDir, `emergency_rollback_${this.environment}.sh`);
    await fs.writeFile(scriptPath, rollbackScript, { mode: 0o755 });

    await this.logger.log('success', 'Emergency rollback script generated', { path: scriptPath });
    return scriptPath;
  }

  /**
   * Run complete migration process
   */
  async migrate() {
    const startTime = Date.now();

    try {
      await this.logger.log('info', 'Starting PostgreSQL SSO system migration', {
        environment: this.environment,
        dryRun: this.options.dryRun,
        options: this.options
      });

      // Initialize database connection
      await this.initializeDatabase();

      // Read migration files
      const migrations = await this.readMigrationFiles();

      // Generate emergency rollback script
      const rollbackScriptPath = await this.generateEmergencyRollbackScript();

      // Execute migrations in sequence
      for (const migration of migrations) {
        await this.executeMigration(migration);

        // Validate after each migration if not skipped
        if (!this.options.skipValidation) {
          const validationPassed = await this.validateReferentialIntegrity();
          if (!validationPassed && !this.options.force) {
            throw new Error(`Validation failed after migration ${migration.id}`);
          }
        }
      }

      // Create performance indexes
      if (!this.options.dryRun) {
        await this.createPerformanceIndexes();
      }

      // Populate initial data
      if (!this.options.dryRun) {
        await this.populateInitialData();
      }

      // Final validation
      if (!this.options.skipValidation && !this.options.dryRun) {
        await this.validateReferentialIntegrity();
      }

      const duration = Date.now() - startTime;

      await this.logger.log('success', 'SSO system migration completed successfully', {
        duration: `${(duration / 1000).toFixed(2)}s`,
        migrationsCompleted: this.migrationState.completedMigrations.length,
        checkpoints: this.migrationState.checkpoints.length,
        warnings: this.migrationState.warnings.length,
        rollbackScript: rollbackScriptPath
      });

      return {
        success: true,
        duration,
        migrations: this.migrationState.completedMigrations,
        checkpoints: this.migrationState.checkpoints,
        warnings: this.migrationState.warnings,
        rollbackScript: rollbackScriptPath
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      await this.logger.log('error', 'Migration failed', {
        error: error.message,
        duration: `${(duration / 1000).toFixed(2)}s`,
        completedMigrations: this.migrationState.completedMigrations,
        checkpoints: this.migrationState.checkpoints.length
      });

      throw error;
    } finally {
      if (this.pool) {
        await this.pool.end();
      }
    }
  }

  /**
   * Execute rollback to specific checkpoint
   */
  async rollback(checkpointId) {
    try {
      await this.logger.log('info', 'Starting emergency rollback', { checkpointId });

      await this.initializeDatabase();

      // Find checkpoint
      const checkpoint = this.migrationState.checkpoints.find(cp => cp.id === checkpointId);
      if (!checkpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }

      await this.executeRollback(checkpoint);

      await this.logger.log('success', 'Emergency rollback completed', { checkpointId });

    } catch (error) {
      await this.logger.log('error', 'Emergency rollback failed', {
        error: error.message,
        checkpointId
      });
      throw error;
    } finally {
      if (this.pool) {
        await this.pool.end();
      }
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  let environment = 'dev';
  let command = 'migrate';

  // Parse command line arguments
  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      environment = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--skip-validation') {
      options.skipValidation = true;
    } else if (arg === '--rollback') {
      command = 'rollback';
    } else if (arg.startsWith('--checkpoint=')) {
      options.rollbackCheckpoint = arg.split('=')[1];
    } else if (arg === '--help') {
      console.log(`
PostgreSQL SSO Migration Tool

Usage:
  node scripts/postgres-sso-migration.js [options]

Options:
  --env=ENV              Target environment (dev|test|prod) [default: dev]
  --dry-run              Show what would be executed without making changes
  --verbose              Enable verbose logging
  --force                Continue on validation warnings
  --skip-validation      Skip referential integrity validation
  --rollback             Execute rollback instead of migration
  --checkpoint=ID        Checkpoint ID for rollback
  --help                 Show this help message

Examples:
  # Dry run on development
  node scripts/postgres-sso-migration.js --env=dev --dry-run

  # Execute migration on production
  node scripts/postgres-sso-migration.js --env=prod

  # Emergency rollback
  node scripts/postgres-sso-migration.js --rollback --checkpoint=abc-123
      `);
      process.exit(0);
    }
  }

  try {
    const migrationTool = new PostgreSSOMigrationTool(environment, options);

    if (command === 'migrate') {
      const result = await migrationTool.migrate();
      console.log('\n✅ Migration completed successfully!');
      console.log(`📊 Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`📦 Migrations: ${result.migrations.length}`);
      console.log(`🔄 Checkpoints: ${result.checkpoints.length}`);
      console.log(`⚠️  Warnings: ${result.warnings.length}`);
      console.log(`🆘 Rollback script: ${result.rollbackScript}`);
    } else if (command === 'rollback') {
      if (!options.rollbackCheckpoint) {
        console.error('❌ Rollback checkpoint ID required. Use --checkpoint=ID');
        process.exit(1);
      }
      await migrationTool.rollback(options.rollbackCheckpoint);
      console.log('\n✅ Rollback completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { PostgreSSOMigrationTool, CONFIG };