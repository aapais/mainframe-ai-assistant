# Migration from Basic Authentication to SSO

## 📋 Overview

This guide provides a comprehensive approach to migrating from traditional username/password authentication to the modern SSO system while maintaining user data integrity and minimizing service disruption.

## 🎯 Migration Strategy

### Phase 1: Preparation and Analysis

#### Current System Assessment

```javascript
// scripts/assess-current-auth.js
const fs = require('fs');
const crypto = require('crypto');

class AuthSystemAnalyzer {
  constructor(databaseConnection) {
    this.db = databaseConnection;
  }

  async analyzeCurrentSystem() {
    const analysis = {
      userCount: 0,
      passwordHashes: {},
      userProfiles: [],
      sessionAnalysis: {},
      securityIssues: []
    };

    try {
      // Count total users
      const userCountResult = await this.db.query('SELECT COUNT(*) as count FROM users');
      analysis.userCount = userCountResult.rows[0].count;

      // Analyze password hash formats
      const hashSample = await this.db.query(`
        SELECT DISTINCT
          LENGTH(password_hash) as hash_length,
          SUBSTRING(password_hash, 1, 10) as hash_prefix,
          COUNT(*) as count
        FROM users
        WHERE password_hash IS NOT NULL
        GROUP BY LENGTH(password_hash), SUBSTRING(password_hash, 1, 10)
        ORDER BY count DESC
        LIMIT 10
      `);

      analysis.passwordHashes = hashSample.rows.reduce((acc, row) => {
        acc[`${row.hash_length}_chars`] = row.count;
        return acc;
      }, {});

      // Analyze user data completeness
      const profileData = await this.db.query(`
        SELECT
          COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as missing_email,
          COUNT(CASE WHEN first_name IS NULL OR first_name = '' THEN 1 END) as missing_first_name,
          COUNT(CASE WHEN last_name IS NULL OR last_name = '' THEN 1 END) as missing_last_name,
          COUNT(CASE WHEN created_at IS NULL THEN 1 END) as missing_created_at,
          COUNT(CASE WHEN last_login IS NULL THEN 1 END) as no_login_history
        FROM users
      `);

      analysis.userProfiles = profileData.rows[0];

      // Check for security issues
      const securityChecks = [
        {
          name: 'weak_passwords',
          query: `SELECT COUNT(*) as count FROM users WHERE LENGTH(password_hash) < 40`
        },
        {
          name: 'duplicate_emails',
          query: `SELECT COUNT(*) - COUNT(DISTINCT email) as count FROM users`
        },
        {
          name: 'inactive_users',
          query: `SELECT COUNT(*) as count FROM users WHERE last_login < NOW() - INTERVAL '1 year'`
        }
      ];

      for (const check of securityChecks) {
        const result = await this.db.query(check.query);
        if (result.rows[0].count > 0) {
          analysis.securityIssues.push({
            issue: check.name,
            count: result.rows[0].count
          });
        }
      }

      return analysis;

    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  }

  async generateMigrationPlan(analysis) {
    const plan = {
      phases: [],
      estimatedTime: '4-6 weeks',
      risks: [],
      recommendations: []
    };

    // Phase recommendations based on analysis
    if (analysis.userCount > 10000) {
      plan.phases.push('Large user base detected - recommend gradual migration');
      plan.estimatedTime = '6-8 weeks';
    }

    if (analysis.securityIssues.length > 0) {
      plan.risks.push('Security issues found - prioritize cleanup');
      plan.recommendations.push('Address security issues before migration');
    }

    if (analysis.userProfiles.missing_email > 0) {
      plan.risks.push(`${analysis.userProfiles.missing_email} users without email`);
      plan.recommendations.push('Collect missing email addresses');
    }

    return plan;
  }
}

module.exports = AuthSystemAnalyzer;
```

#### User Data Mapping

```javascript
// scripts/user-data-mapper.js
class UserDataMapper {
  constructor() {
    this.mappingRules = {
      // Standard field mappings
      email: 'email',
      firstName: ['first_name', 'fname', 'given_name'],
      lastName: ['last_name', 'lname', 'surname', 'family_name'],
      displayName: ['display_name', 'full_name', 'name'],

      // Metadata mappings
      createdAt: ['created_at', 'date_created', 'registration_date'],
      updatedAt: ['updated_at', 'last_modified', 'modified_date'],
      lastLogin: ['last_login', 'last_access', 'login_date'],

      // Profile mappings
      avatar: ['avatar_url', 'profile_picture', 'photo_url'],
      timezone: ['timezone', 'tz', 'time_zone'],
      locale: ['locale', 'language', 'lang'],

      // Role/permission mappings
      roles: ['roles', 'user_roles', 'permissions'],
      isActive: ['is_active', 'active', 'enabled', 'status'],
      isVerified: ['is_verified', 'email_verified', 'verified']
    };
  }

  mapUserData(legacyUser) {
    const mappedUser = {
      id: this.generateNewUserId(legacyUser.id),
      email: this.extractField(legacyUser, 'email'),

      // Profile information
      profile: {
        name: this.extractDisplayName(legacyUser),
        given_name: this.extractField(legacyUser, 'firstName'),
        family_name: this.extractField(legacyUser, 'lastName'),
        picture: this.extractField(legacyUser, 'avatar'),
        locale: this.extractField(legacyUser, 'locale') || 'en-US',
        timezone: this.extractField(legacyUser, 'timezone')
      },

      // System fields
      provider: 'migration', // Special provider for migrated users
      provider_id: legacyUser.id.toString(),
      email_verified: this.extractField(legacyUser, 'isVerified') || false,

      // Timestamps
      created_at: this.extractField(legacyUser, 'createdAt'),
      updated_at: new Date(),
      last_login: this.extractField(legacyUser, 'lastLogin'),

      // Status
      active: this.extractField(legacyUser, 'isActive') !== false,

      // Migration metadata
      migration_data: {
        original_id: legacyUser.id,
        migration_date: new Date(),
        source_system: 'basic_auth',
        password_migrated: !!legacyUser.password_hash
      }
    };

    return this.validateMappedUser(mappedUser);
  }

  extractField(user, fieldType) {
    const possibleFields = Array.isArray(this.mappingRules[fieldType])
      ? this.mappingRules[fieldType]
      : [this.mappingRules[fieldType]];

    for (const field of possibleFields) {
      if (user[field] !== undefined && user[field] !== null && user[field] !== '') {
        return user[field];
      }
    }

    return null;
  }

  extractDisplayName(user) {
    // Try display name first
    let displayName = this.extractField(user, 'displayName');

    if (!displayName) {
      // Construct from first/last name
      const firstName = this.extractField(user, 'firstName');
      const lastName = this.extractField(user, 'lastName');

      if (firstName && lastName) {
        displayName = `${firstName} ${lastName}`;
      } else if (firstName) {
        displayName = firstName;
      } else if (lastName) {
        displayName = lastName;
      }
    }

    return displayName || this.extractField(user, 'email');
  }

  generateNewUserId(oldId) {
    // Generate UUID v4 for new system
    return crypto.randomUUID();
  }

  validateMappedUser(user) {
    const errors = [];

    // Required field validation
    if (!user.email) {
      errors.push('Email is required');
    }

    if (!user.profile.name) {
      errors.push('Display name is required');
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (user.email && !emailRegex.test(user.email)) {
      errors.push('Invalid email format');
    }

    if (errors.length > 0) {
      throw new Error(`User validation failed: ${errors.join(', ')}`);
    }

    return user;
  }
}

module.exports = UserDataMapper;
```

### Phase 2: Database Schema Migration

#### New Schema Creation

```sql
-- migrations/001_create_sso_schema.sql

-- Users table for SSO system
CREATE TABLE sso_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,

    -- Provider information
    provider VARCHAR(50) NOT NULL DEFAULT 'migration',
    provider_id VARCHAR(255) NOT NULL,

    -- Profile data (JSONB for flexibility)
    profile JSONB NOT NULL DEFAULT '{}',

    -- Status fields
    email_verified BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,

    -- Migration metadata
    migration_data JSONB,

    -- Indexes for performance
    UNIQUE(provider, provider_id)
);

-- Create indexes
CREATE INDEX idx_sso_users_email ON sso_users(email);
CREATE INDEX idx_sso_users_provider ON sso_users(provider, provider_id);
CREATE INDEX idx_sso_users_active ON sso_users(active);
CREATE INDEX idx_sso_users_created_at ON sso_users(created_at);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES sso_users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,

    -- Session metadata
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),

    -- Session status
    active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(active);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES sso_users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,

    -- Token data
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    family_id UUID NOT NULL,

    -- Status
    revoked BOOLEAN DEFAULT FALSE,
    revocation_reason VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_id) WHERE revoked = FALSE;

-- Migration tracking table
CREATE TABLE migration_log (
    id SERIAL PRIMARY KEY,
    migration_batch VARCHAR(50) NOT NULL,
    old_user_id VARCHAR(255),
    new_user_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_migration_log_batch ON migration_log(migration_batch);
CREATE INDEX idx_migration_log_status ON migration_log(status);

-- User ID mapping table for transition period
CREATE TABLE user_id_mapping (
    old_id VARCHAR(255) PRIMARY KEY,
    new_id UUID NOT NULL REFERENCES sso_users(id),
    system_source VARCHAR(50) DEFAULT 'basic_auth',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_id_mapping_new_id ON user_id_mapping(new_id);
```

#### Data Migration Script

```javascript
// scripts/migrate-users.js
const { Pool } = require('pg');
const UserDataMapper = require('./user-data-mapper');
const crypto = require('crypto');

class UserMigration {
  constructor(oldDbConfig, newDbConfig, batchSize = 1000) {
    this.oldDb = new Pool(oldDbConfig);
    this.newDb = new Pool(newDbConfig);
    this.mapper = new UserDataMapper();
    this.batchSize = batchSize;
    this.migrationBatch = `migration_${Date.now()}`;
  }

  async migrateUsers(dryRun = false) {
    console.log(`Starting user migration (Batch: ${this.migrationBatch})`);
    console.log(`Dry run mode: ${dryRun}`);

    try {
      // Get total user count
      const countResult = await this.oldDb.query('SELECT COUNT(*) as count FROM users');
      const totalUsers = parseInt(countResult.rows[0].count);

      console.log(`Total users to migrate: ${totalUsers}`);

      let processed = 0;
      let successful = 0;
      let failed = 0;

      // Process users in batches
      for (let offset = 0; offset < totalUsers; offset += this.batchSize) {
        console.log(`Processing batch ${offset / this.batchSize + 1}: ${offset}-${Math.min(offset + this.batchSize, totalUsers)}`);

        const users = await this.fetchUserBatch(offset, this.batchSize);

        for (const oldUser of users) {
          try {
            await this.migrateUser(oldUser, dryRun);
            successful++;
          } catch (error) {
            console.error(`Failed to migrate user ${oldUser.id}:`, error.message);

            if (!dryRun) {
              await this.logMigrationError(oldUser.id, error.message);
            }

            failed++;
          }

          processed++;

          // Progress update
          if (processed % 100 === 0) {
            console.log(`Progress: ${processed}/${totalUsers} (${Math.round(processed/totalUsers*100)}%)`);
          }
        }

        // Small delay between batches to avoid overwhelming the database
        await this.sleep(100);
      }

      console.log('\nMigration Summary:');
      console.log(`Total processed: ${processed}`);
      console.log(`Successful: ${successful}`);
      console.log(`Failed: ${failed}`);
      console.log(`Success rate: ${Math.round(successful/processed*100)}%`);

      return {
        processed,
        successful,
        failed,
        successRate: Math.round(successful/processed*100)
      };

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      await this.oldDb.end();
      await this.newDb.end();
    }
  }

  async fetchUserBatch(offset, limit) {
    const result = await this.oldDb.query(`
      SELECT
        id,
        email,
        first_name,
        last_name,
        display_name,
        password_hash,
        avatar_url,
        timezone,
        locale,
        is_active,
        email_verified,
        created_at,
        updated_at,
        last_login
      FROM users
      WHERE email IS NOT NULL
      ORDER BY id
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return result.rows;
  }

  async migrateUser(oldUser, dryRun = false) {
    // Map user data to new format
    const mappedUser = this.mapper.mapUserData(oldUser);

    if (dryRun) {
      console.log(`[DRY RUN] Would migrate user: ${oldUser.email}`);
      return;
    }

    // Begin transaction
    const client = await this.newDb.connect();

    try {
      await client.query('BEGIN');

      // Insert into sso_users table
      const userInsertResult = await client.query(`
        INSERT INTO sso_users (
          id, email, provider, provider_id, profile,
          email_verified, active, created_at, updated_at,
          last_login, migration_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        mappedUser.id,
        mappedUser.email,
        mappedUser.provider,
        mappedUser.provider_id,
        JSON.stringify(mappedUser.profile),
        mappedUser.email_verified,
        mappedUser.active,
        mappedUser.created_at,
        mappedUser.updated_at,
        mappedUser.last_login,
        JSON.stringify(mappedUser.migration_data)
      ]);

      const newUserId = userInsertResult.rows[0].id;

      // Create ID mapping
      await client.query(`
        INSERT INTO user_id_mapping (old_id, new_id, system_source)
        VALUES ($1, $2, $3)
      `, [oldUser.id.toString(), newUserId, 'basic_auth']);

      // Log successful migration
      await client.query(`
        INSERT INTO migration_log (
          migration_batch, old_user_id, new_user_id, status, completed_at
        ) VALUES ($1, $2, $3, 'completed', NOW())
      `, [this.migrationBatch, oldUser.id.toString(), newUserId]);

      await client.query('COMMIT');

      console.log(`✓ Migrated user: ${oldUser.email} (${oldUser.id} → ${newUserId})`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async logMigrationError(oldUserId, errorMessage) {
    try {
      await this.newDb.query(`
        INSERT INTO migration_log (
          migration_batch, old_user_id, status, error_message
        ) VALUES ($1, $2, 'failed', $3)
      `, [this.migrationBatch, oldUserId.toString(), errorMessage]);
    } catch (error) {
      console.error('Failed to log migration error:', error);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI usage
if (require.main === module) {
  const oldDbConfig = {
    host: process.env.OLD_DB_HOST || 'localhost',
    port: process.env.OLD_DB_PORT || 5432,
    database: process.env.OLD_DB_NAME,
    user: process.env.OLD_DB_USER,
    password: process.env.OLD_DB_PASSWORD
  };

  const newDbConfig = {
    host: process.env.NEW_DB_HOST || 'localhost',
    port: process.env.NEW_DB_PORT || 5432,
    database: process.env.NEW_DB_NAME,
    user: process.env.NEW_DB_USER,
    password: process.env.NEW_DB_PASSWORD
  };

  const dryRun = process.argv.includes('--dry-run');
  const batchSize = parseInt(process.env.BATCH_SIZE) || 1000;

  const migration = new UserMigration(oldDbConfig, newDbConfig, batchSize);

  migration.migrateUsers(dryRun)
    .then(result => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = UserMigration;
```

### Phase 3: Hybrid Authentication Setup

During the migration period, both authentication systems need to coexist:

```javascript
// middleware/hybrid-auth.js
class HybridAuthMiddleware {
  constructor(legacyAuth, ssoAuth) {
    this.legacyAuth = legacyAuth;
    this.ssoAuth = ssoAuth;
  }

  async authenticate(req, res, next) {
    try {
      // Try SSO authentication first
      const ssoResult = await this.trySSO(req);

      if (ssoResult.success) {
        req.user = ssoResult.user;
        req.authMethod = 'sso';
        return next();
      }

      // Fall back to legacy authentication
      const legacyResult = await this.tryLegacy(req);

      if (legacyResult.success) {
        req.user = legacyResult.user;
        req.authMethod = 'legacy';

        // Optional: Encourage SSO migration
        res.set('X-Migration-Available', 'true');

        return next();
      }

      // Both authentication methods failed
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Please sign in to continue'
      });

    } catch (error) {
      console.error('Hybrid authentication error:', error);
      return res.status(500).json({
        error: 'authentication_error',
        message: 'Authentication service unavailable'
      });
    }
  }

  async trySSO(req) {
    try {
      const token = this.extractBearerToken(req);

      if (!token) {
        return { success: false, reason: 'no_token' };
      }

      const user = await this.ssoAuth.validateToken(token);

      if (user) {
        return { success: true, user };
      }

      return { success: false, reason: 'invalid_token' };
    } catch (error) {
      return { success: false, reason: 'sso_error', error };
    }
  }

  async tryLegacy(req) {
    try {
      // Check for session-based auth
      if (req.session && req.session.userId) {
        const user = await this.legacyAuth.getUserById(req.session.userId);

        if (user && user.is_active) {
          return { success: true, user: this.normalizeLegacyUser(user) };
        }
      }

      // Check for basic auth header
      const basicAuth = this.extractBasicAuth(req);

      if (basicAuth) {
        const user = await this.legacyAuth.validateCredentials(
          basicAuth.username,
          basicAuth.password
        );

        if (user) {
          return { success: true, user: this.normalizeLegacyUser(user) };
        }
      }

      return { success: false, reason: 'invalid_credentials' };
    } catch (error) {
      return { success: false, reason: 'legacy_error', error };
    }
  }

  extractBearerToken(req) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  extractBasicAuth(req) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Basic ')) {
      const encoded = authHeader.substring(6);
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const [username, password] = decoded.split(':');

      return { username, password };
    }

    return null;
  }

  normalizeLegacyUser(legacyUser) {
    return {
      id: legacyUser.id,
      email: legacyUser.email,
      name: legacyUser.display_name || `${legacyUser.first_name} ${legacyUser.last_name}`,
      profile: {
        given_name: legacyUser.first_name,
        family_name: legacyUser.last_name,
        picture: legacyUser.avatar_url
      },
      provider: 'legacy',
      migrationAvailable: true
    };
  }
}

module.exports = HybridAuthMiddleware;
```

### Phase 4: User Migration Flow

#### Self-Service Migration

```javascript
// routes/migration.js
const express = require('express');
const router = express.Router();
const MigrationService = require('../services/MigrationService');

// Start migration process for logged-in user
router.post('/migrate/start', async (req, res) => {
  try {
    if (req.authMethod !== 'legacy') {
      return res.status(400).json({
        error: 'migration_not_needed',
        message: 'User already using SSO'
      });
    }

    const migrationService = new MigrationService();
    const migrationToken = await migrationService.initiateMigration(req.user);

    res.json({
      message: 'Migration initiated',
      migrationToken,
      nextStep: 'choose_provider',
      availableProviders: ['google', 'microsoft']
    });

  } catch (error) {
    console.error('Migration initiation failed:', error);
    res.status(500).json({
      error: 'migration_failed',
      message: 'Failed to start migration process'
    });
  }
});

// Link SSO provider to existing account
router.post('/migrate/link/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { migrationToken } = req.body;

    const migrationService = new MigrationService();

    // Validate migration token
    const migration = await migrationService.validateMigrationToken(migrationToken);

    if (!migration) {
      return res.status(400).json({
        error: 'invalid_migration_token',
        message: 'Migration session expired or invalid'
      });
    }

    // Generate OAuth URL with migration context
    const authUrl = await migrationService.generateProviderAuthUrl(
      provider,
      migration.userId,
      migrationToken
    );

    res.json({
      authUrl,
      message: `Redirecting to ${provider} for account linking`
    });

  } catch (error) {
    console.error('Provider linking failed:', error);
    res.status(500).json({
      error: 'linking_failed',
      message: 'Failed to link provider account'
    });
  }
});

// Complete migration after OAuth callback
router.post('/migrate/complete', async (req, res) => {
  try {
    const { migrationToken, providerData } = req.body;

    const migrationService = new MigrationService();
    const result = await migrationService.completeMigration(
      migrationToken,
      providerData
    );

    // Generate new SSO tokens
    const tokens = await migrationService.generateSSOTokens(result.user);

    res.json({
      message: 'Migration completed successfully',
      user: result.user,
      tokens,
      legacyAccountStatus: 'migrated'
    });

  } catch (error) {
    console.error('Migration completion failed:', error);
    res.status(500).json({
      error: 'migration_completion_failed',
      message: error.message
    });
  }
});

module.exports = router;
```

#### Migration Service

```javascript
// services/MigrationService.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class MigrationService {
  constructor() {
    this.migrationSessions = new Map();
  }

  async initiateMigration(legacyUser) {
    // Generate secure migration token
    const migrationToken = crypto.randomBytes(32).toString('hex');

    // Store migration session
    const migrationData = {
      userId: legacyUser.id,
      email: legacyUser.email,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      status: 'initiated'
    };

    this.migrationSessions.set(migrationToken, migrationData);

    // Auto-cleanup expired sessions
    setTimeout(() => {
      this.migrationSessions.delete(migrationToken);
    }, 30 * 60 * 1000);

    return migrationToken;
  }

  async validateMigrationToken(token) {
    const migration = this.migrationSessions.get(token);

    if (!migration) {
      return null;
    }

    if (migration.expiresAt < new Date()) {
      this.migrationSessions.delete(token);
      return null;
    }

    return migration;
  }

  async generateProviderAuthUrl(provider, userId, migrationToken) {
    const state = this.generateState();

    // Store state with migration context
    const stateData = {
      provider,
      userId,
      migrationToken,
      timestamp: Date.now()
    };

    // In production, store this in Redis or database
    this.stateStore.set(state, stateData);

    const baseUrl = process.env.API_BASE_URL;
    const authUrl = new URL(`${baseUrl}/api/v2/auth/${provider}/authorize`);

    authUrl.searchParams.set('redirect_uri', `${baseUrl}/api/v2/migrate/callback`);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('migration', 'true');

    return authUrl.toString();
  }

  async completeMigration(migrationToken, providerData) {
    const migration = await this.validateMigrationToken(migrationToken);

    if (!migration) {
      throw new Error('Invalid or expired migration token');
    }

    // Get legacy user data
    const legacyUser = await this.getLegacyUser(migration.userId);

    if (!legacyUser) {
      throw new Error('Legacy user not found');
    }

    // Verify email match
    if (legacyUser.email.toLowerCase() !== providerData.email.toLowerCase()) {
      throw new Error('Email mismatch - cannot link accounts');
    }

    // Create new SSO user
    const ssoUser = await this.createSSOUser(legacyUser, providerData);

    // Update migration session
    migration.status = 'completed';
    migration.completedAt = new Date();
    migration.newUserId = ssoUser.id;

    // Optionally deactivate legacy account
    await this.deactivateLegacyAccount(legacyUser.id);

    // Cleanup migration session
    this.migrationSessions.delete(migrationToken);

    return {
      user: ssoUser,
      migration: migration
    };
  }

  async createSSOUser(legacyUser, providerData) {
    const userMapper = new (require('../scripts/user-data-mapper'))();
    const mappedUser = userMapper.mapUserData(legacyUser);

    // Override with provider data
    mappedUser.provider = providerData.provider;
    mappedUser.provider_id = providerData.provider_id;
    mappedUser.profile = {
      ...mappedUser.profile,
      ...providerData.profile
    };

    // Store in database
    const db = require('../config/database');

    const result = await db.query(`
      INSERT INTO sso_users (
        id, email, provider, provider_id, profile,
        email_verified, active, created_at, updated_at,
        migration_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      mappedUser.id,
      mappedUser.email,
      mappedUser.provider,
      mappedUser.provider_id,
      JSON.stringify(mappedUser.profile),
      mappedUser.email_verified,
      mappedUser.active,
      mappedUser.created_at,
      mappedUser.updated_at,
      JSON.stringify({
        ...mappedUser.migration_data,
        self_migrated: true,
        migration_method: 'user_initiated'
      })
    ]);

    return result.rows[0];
  }

  async generateSSOTokens(user) {
    const tokenService = require('./TokenService');

    const accessToken = await tokenService.generateAccessToken(user);
    const refreshToken = await tokenService.generateRefreshToken(user);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900 // 15 minutes
    };
  }

  generateState() {
    return crypto.randomBytes(16).toString('hex');
  }

  async getLegacyUser(userId) {
    const legacyDb = require('../config/legacy-database');

    const result = await legacyDb.query(`
      SELECT * FROM users WHERE id = $1 AND is_active = true
    `, [userId]);

    return result.rows[0];
  }

  async deactivateLegacyAccount(userId) {
    const legacyDb = require('../config/legacy-database');

    await legacyDb.query(`
      UPDATE users
      SET is_active = false,
          migration_completed_at = NOW(),
          notes = COALESCE(notes, '') || '\nMigrated to SSO system'
      WHERE id = $1
    `, [userId]);
  }
}

module.exports = MigrationService;
```

## 📊 Migration Monitoring and Validation

### Migration Dashboard

```javascript
// routes/migration-admin.js
const express = require('express');
const router = express.Router();

// Migration statistics dashboard
router.get('/admin/migration/stats', async (req, res) => {
  try {
    const db = require('../config/database');

    // Get migration statistics
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_migrations,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_migrations,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_migrations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_migrations,
        MIN(created_at) as first_migration,
        MAX(completed_at) as last_migration
      FROM migration_log
    `);

    // Get migration progress by day
    const daily_progress = await db.query(`
      SELECT
        DATE(completed_at) as migration_date,
        COUNT(*) as migrations_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count
      FROM migration_log
      WHERE completed_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(completed_at)
      ORDER BY migration_date DESC
    `);

    // Get provider distribution
    const provider_stats = await db.query(`
      SELECT
        provider,
        COUNT(*) as user_count
      FROM sso_users
      WHERE migration_data IS NOT NULL
      GROUP BY provider
      ORDER BY user_count DESC
    `);

    res.json({
      summary: stats.rows[0],
      daily_progress: daily_progress.rows,
      provider_distribution: provider_stats.rows
    });

  } catch (error) {
    console.error('Failed to fetch migration stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Failed migrations report
router.get('/admin/migration/failures', async (req, res) => {
  try {
    const db = require('../config/database');

    const failures = await db.query(`
      SELECT
        old_user_id,
        error_message,
        created_at,
        migration_batch
      FROM migration_log
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT 100
    `);

    // Group by error type
    const errorSummary = failures.rows.reduce((acc, failure) => {
      const errorType = failure.error_message.split(':')[0];
      acc[errorType] = (acc[errorType] || 0) + 1;
      return acc;
    }, {});

    res.json({
      failures: failures.rows,
      errorSummary
    });

  } catch (error) {
    console.error('Failed to fetch failure report:', error);
    res.status(500).json({ error: 'Failed to fetch failure report' });
  }
});

module.exports = router;
```

## ✅ Post-Migration Cleanup

### Legacy System Cleanup

```javascript
// scripts/post-migration-cleanup.js
class PostMigrationCleanup {
  constructor() {
    this.cleanupTasks = [
      'validateMigrations',
      'cleanupLegacySessions',
      'archiveOldData',
      'updateApplicationReferences',
      'removeUnusedTables'
    ];
  }

  async executeCleanup(dryRun = true) {
    console.log('Starting post-migration cleanup...');
    console.log(`Dry run mode: ${dryRun}`);

    for (const task of this.cleanupTasks) {
      try {
        console.log(`\nExecuting: ${task}`);
        await this[task](dryRun);
        console.log(`✓ Completed: ${task}`);
      } catch (error) {
        console.error(`✗ Failed: ${task}`, error.message);

        if (!dryRun && task === 'validateMigrations') {
          throw new Error('Critical validation failed - stopping cleanup');
        }
      }
    }

    console.log('\nCleanup completed successfully');
  }

  async validateMigrations(dryRun) {
    const db = require('../config/database');
    const legacyDb = require('../config/legacy-database');

    // Count users in both systems
    const legacyCount = await legacyDb.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    const ssoCount = await db.query('SELECT COUNT(*) as count FROM sso_users WHERE migration_data IS NOT NULL');

    console.log(`Legacy active users: ${legacyCount.rows[0].count}`);
    console.log(`Migrated SSO users: ${ssoCount.rows[0].count}`);

    // Check for missing migrations
    const missingMigrations = await legacyDb.query(`
      SELECT u.id, u.email
      FROM users u
      LEFT JOIN user_id_mapping m ON m.old_id = u.id::text
      WHERE u.is_active = true
      AND m.new_id IS NULL
      LIMIT 10
    `);

    if (missingMigrations.rows.length > 0) {
      console.warn('⚠️  Users not migrated:');
      missingMigrations.rows.forEach(user => {
        console.warn(`  - ${user.email} (ID: ${user.id})`);
      });
    }

    // Validate email uniqueness
    const duplicateEmails = await db.query(`
      SELECT email, COUNT(*) as count
      FROM sso_users
      GROUP BY email
      HAVING COUNT(*) > 1
    `);

    if (duplicateEmails.rows.length > 0) {
      console.error('❌ Duplicate emails found in SSO system:');
      duplicateEmails.rows.forEach(dup => {
        console.error(`  - ${dup.email}: ${dup.count} accounts`);
      });

      throw new Error('Data integrity issues found');
    }

    console.log('✓ Migration validation passed');
  }

  async cleanupLegacySessions(dryRun) {
    const legacyDb = require('../config/legacy-database');

    if (dryRun) {
      const sessionCount = await legacyDb.query('SELECT COUNT(*) as count FROM user_sessions');
      console.log(`[DRY RUN] Would delete ${sessionCount.rows[0].count} legacy sessions`);
      return;
    }

    // Delete old sessions
    const result = await legacyDb.query('DELETE FROM user_sessions WHERE created_at < NOW() - INTERVAL \'7 days\'');
    console.log(`Deleted ${result.rowCount} legacy sessions`);
  }

  async archiveOldData(dryRun) {
    const legacyDb = require('../config/legacy-database');

    const archiveTables = [
      'password_reset_tokens',
      'user_login_history',
      'failed_login_attempts'
    ];

    for (const table of archiveTables) {
      if (dryRun) {
        const count = await legacyDb.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`[DRY RUN] Would archive ${count.rows[0].count} records from ${table}`);
        continue;
      }

      // Create archive table
      await legacyDb.query(`
        CREATE TABLE IF NOT EXISTS archived_${table} AS
        SELECT * FROM ${table} WHERE 1=0
      `);

      // Move old data to archive
      const result = await legacyDb.query(`
        INSERT INTO archived_${table}
        SELECT * FROM ${table}
        WHERE created_at < NOW() - INTERVAL '1 year'
      `);

      // Delete from original table
      await legacyDb.query(`
        DELETE FROM ${table}
        WHERE created_at < NOW() - INTERVAL '1 year'
      `);

      console.log(`Archived ${result.rowCount} records from ${table}`);
    }
  }

  async updateApplicationReferences(dryRun) {
    // This would contain application-specific logic to update
    // any hardcoded references to legacy authentication
    console.log('[DRY RUN] Would update application references to use SSO endpoints');
  }

  async removeUnusedTables(dryRun) {
    const unusedTables = [
      'password_reset_tokens',
      'user_verification_tokens',
      'login_attempts'
    ];

    if (dryRun) {
      console.log(`[DRY RUN] Would drop unused tables: ${unusedTables.join(', ')}`);
      return;
    }

    const legacyDb = require('../config/legacy-database');

    for (const table of unusedTables) {
      try {
        await legacyDb.query(`DROP TABLE IF EXISTS ${table}`);
        console.log(`Dropped unused table: ${table}`);
      } catch (error) {
        console.warn(`Warning: Could not drop table ${table}:`, error.message);
      }
    }
  }
}

// CLI usage
if (require.main === module) {
  const dryRun = !process.argv.includes('--execute');

  const cleanup = new PostMigrationCleanup();

  cleanup.executeCleanup(dryRun)
    .then(() => {
      console.log('\n🎉 Migration cleanup completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Cleanup failed:', error.message);
      process.exit(1);
    });
}

module.exports = PostMigrationCleanup;
```

---

**Summary**: This comprehensive migration guide provides step-by-step instructions for transitioning from basic authentication to SSO while maintaining data integrity and minimizing disruption. The process includes thorough validation, user-friendly migration flows, and proper cleanup procedures.

**Next**: Review [Performance Tuning](../performance/optimization.md) for optimizing your new SSO system.