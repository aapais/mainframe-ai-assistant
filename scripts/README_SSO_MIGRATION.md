# PostgreSQL SSO Migration Guide

## Overview

This guide covers the complete PostgreSQL SSO (Single Sign-On) system migration process for the Mainframe AI Assistant application.

## Migration Script: `postgres-sso-migration.js`

### Features

- ✅ **Sequential Migration Execution**: Processes migrations 001-010 in correct dependency order
- ✅ **Dependency Verification**: Validates table dependencies and foreign key relationships
- ✅ **Rollback Safety**: Creates checkpoints before each migration with rollback capabilities
- ✅ **Performance Optimization**: Creates optimized indexes for PostgreSQL
- ✅ **Initial Data Population**: Seeds providers, roles, and system configuration
- ✅ **Referential Integrity**: Validates data consistency throughout the process
- ✅ **Emergency Rollback**: Generates emergency rollback scripts
- ✅ **Detailed Logging**: Comprehensive logging with JSON structured output
- ✅ **Environment Support**: Supports dev, test, and production environments
- ✅ **Dry Run Mode**: Preview changes without executing them

### Prerequisites

1. **PostgreSQL Server**: Version 12+ running and accessible
2. **Database Permissions**: CREATE, DROP, INSERT, UPDATE, DELETE privileges
3. **Node.js Dependencies**: `pg`, `fs`, `path`, `crypto` modules
4. **Environment Variables**: Database connection parameters

### Environment Configuration

Create environment variables for your target environment:

```bash
# Development Environment
export PG_HOST=localhost
export PG_PORT=5432
export PG_DATABASE=mainframe_ai_dev
export PG_USER=postgres
export PG_PASSWORD=your_dev_password

# Production Environment
export PG_HOST_PROD=prod-server.example.com
export PG_PORT_PROD=5432
export PG_DATABASE_PROD=mainframe_ai_prod
export PG_USER_PROD=app_user
export PG_PASSWORD_PROD=your_prod_password
```

### Migration Files Structure

```
src/database/migrations/auth/
├── 001_create_sso_users.sql          # User accounts and roles
├── 002_create_sso_providers.sql      # SSO provider configurations
├── 003_create_api_keys.sql           # API key management
├── 004_create_sessions.sql           # Session management
├── 005_create_audit_logs.sql         # Audit trail system
├── 006_create_security_events.sql    # Security event tracking
├── 007_create_triggers.sql           # Database triggers
├── 008_create_views.sql              # Performance views
├── 009_create_backup_procedures.sql  # Backup automation
└── 010_create_validation_procedures.sql # Data validation
```

## Usage Examples

### 1. Dry Run (Recommended First Step)

```bash
# Preview changes without executing
node scripts/postgres-sso-migration.js --env=dev --dry-run --verbose

# Check what would be executed in production
node scripts/postgres-sso-migration.js --env=prod --dry-run
```

### 2. Development Migration

```bash
# Execute migration on development environment
node scripts/postgres-sso-migration.js --env=dev --verbose

# Force migration despite validation warnings
node scripts/postgres-sso-migration.js --env=dev --force
```

### 3. Production Migration

```bash
# Execute production migration (recommended approach)
node scripts/postgres-sso-migration.js --env=prod

# Production migration with verbose logging
node scripts/postgres-sso-migration.js --env=prod --verbose
```

### 4. Emergency Rollback

```bash
# List available checkpoints (from log files)
cat scripts/migration-logs/sso-migration-prod-*.log | grep "checkpoint"

# Execute rollback to specific checkpoint
node scripts/postgres-sso-migration.js --rollback --checkpoint=abc-123-def

# Use emergency script (if migration tool unavailable)
bash scripts/migration-backups/emergency_rollback_prod.sh
```

## Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--env=ENV` | Target environment (dev/test/prod) | `--env=prod` |
| `--dry-run` | Preview without executing | `--dry-run` |
| `--verbose` | Enable detailed logging | `--verbose` |
| `--force` | Continue despite validation warnings | `--force` |
| `--skip-validation` | Skip integrity validation | `--skip-validation` |
| `--rollback` | Execute rollback operation | `--rollback` |
| `--checkpoint=ID` | Specify rollback checkpoint | `--checkpoint=abc-123` |
| `--help` | Show help message | `--help` |

## Migration Process Flow

### Phase 1: Pre-Migration
1. **Connection Test**: Verify PostgreSQL connectivity
2. **File Reading**: Parse all migration SQL files (001-010)
3. **Dependency Analysis**: Extract table dependencies
4. **Checkpoint Creation**: Create rollback points

### Phase 2: Migration Execution
1. **Sequential Processing**: Execute migrations 001→002→...→010
2. **Transaction Safety**: Each migration runs in isolated transaction
3. **Error Handling**: Automatic rollback on failure
4. **Progress Tracking**: Real-time status updates

### Phase 3: Post-Migration
1. **Performance Indexes**: Create optimized PostgreSQL indexes
2. **Data Population**: Insert providers, roles, system config
3. **Integrity Validation**: Verify referential integrity
4. **Rollback Script**: Generate emergency rollback procedures

## Generated Artifacts

### Log Files
```
scripts/migration-logs/
└── sso-migration-{env}-{timestamp}.log    # Structured JSON logs
```

### Backup Scripts
```
scripts/migration-backups/
├── emergency_rollback_{env}.sh             # Emergency rollback script
└── checkpoint_backup_{timestamp}.sql       # Database state backups
```

### Checkpoints
Each migration creates checkpoints for rollback:
- Pre-migration state capture
- Post-migration validation
- Rollback SQL commands
- Database statistics

## Troubleshooting

### Common Issues

#### 1. Connection Errors
```bash
# Test connection manually
psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE -c "SELECT version();"

# Check environment variables
echo "Host: $PG_HOST, Port: $PG_PORT, DB: $PG_DATABASE, User: $PG_USER"
```

#### 2. Permission Errors
```sql
-- Grant necessary permissions
GRANT CREATE, USAGE ON SCHEMA public TO your_user;
GRANT CREATE ON DATABASE your_database TO your_user;
```

#### 3. Migration Failures
```bash
# Check detailed logs
cat scripts/migration-logs/sso-migration-*.log | grep -E "(error|ERROR)"

# Roll back to last checkpoint
node scripts/postgres-sso-migration.js --rollback --checkpoint=last_checkpoint_id
```

#### 4. Referential Integrity Violations
```bash
# Skip validation temporarily
node scripts/postgres-sso-migration.js --env=dev --skip-validation

# Force migration despite warnings
node scripts/postgres-sso-migration.js --env=dev --force
```

### Validation Queries

Check migration status manually:

```sql
-- Check if tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'sso_%'
ORDER BY tablename;

-- Verify data population
SELECT 'sso_users' as table_name, count(*) as records FROM sso_users
UNION ALL
SELECT 'sso_user_roles', count(*) FROM sso_user_roles
UNION ALL
SELECT 'sso_providers', count(*) FROM sso_providers;

-- Check foreign key constraints
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid::regclass::text LIKE 'sso_%';
```

## Security Considerations

### 1. Credential Management
- Use environment variables for database credentials
- Never commit passwords to version control
- Rotate credentials after migration
- Use connection pooling for production

### 2. Migration Safety
- Always test in development first
- Create full database backup before production migration
- Run migrations during maintenance windows
- Monitor system resources during execution

### 3. Rollback Procedures
- Keep rollback scripts accessible
- Test rollback procedures in development
- Document rollback decision criteria
- Have database administrator available during production migration

## Performance Optimization

### Created Indexes

The migration automatically creates these performance indexes:

```sql
-- User lookup optimization
idx_sso_users_email_active          -- Fast user login by email
idx_sso_users_username_active       -- Fast user lookup by username

-- Session performance
idx_sso_sessions_user_status        -- Active user sessions
idx_sso_sessions_token_hash         -- Fast token validation

-- Audit trail optimization
idx_sso_audit_logs_user_event       -- User activity queries
idx_sso_audit_logs_timestamp        -- Time-based audit reports

-- Security monitoring
idx_sso_security_events_severity    -- Unresolved security events
idx_sso_providers_enabled_priority  -- Provider selection optimization
```

### Query Optimization Tips

```sql
-- Use partial indexes for active records
WHERE status = 'active'

-- Leverage composite indexes
WHERE user_id = $1 AND status = 'active'

-- Use covering indexes when possible
SELECT id, email, status FROM sso_users WHERE email = $1
```

## Monitoring and Maintenance

### Health Checks

```sql
-- Monitor migration progress
SELECT
  migration_id,
  migration_name,
  checkpoint_type,
  created_at
FROM sso_migration_checkpoints_system
ORDER BY created_at DESC;

-- Check system health
SELECT
  count(*) as active_users
FROM sso_users
WHERE status = 'active';

SELECT
  count(*) as active_sessions
FROM sso_sessions
WHERE status = 'active'
  AND expires_at > NOW();
```

### Regular Maintenance

```bash
# Weekly integrity check
node scripts/postgres-sso-migration.js --env=prod --dry-run --verbose

# Monthly performance review
psql -c "SELECT schemaname, tablename, n_tup_ins, n_tup_del FROM pg_stat_user_tables WHERE schemaname = 'public' AND tablename LIKE 'sso_%'"

# Cleanup old checkpoints (after 30 days)
psql -c "DELETE FROM sso_migration_checkpoints_system WHERE created_at < NOW() - INTERVAL '30 days'"
```

## Integration with Existing System

### Application Configuration

Update your application's database connection:

```javascript
// config/database.js
const config = {
  development: {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
    username: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    dialect: 'postgres'
  }
};
```

### Authentication Middleware

```javascript
// middleware/auth.js
const { Pool } = require('pg');
const pool = new Pool(config.database);

async function authenticateUser(email, password) {
  const result = await pool.query(
    'SELECT id, password_hash FROM sso_users WHERE email = $1 AND status = $2',
    [email, 'active']
  );
  // ... authentication logic
}
```

## Support and Troubleshooting

### Log Analysis

```bash
# Find errors in logs
grep -E "(ERROR|FAILED)" scripts/migration-logs/sso-migration-*.log

# Check migration timing
grep -E "(started|completed)" scripts/migration-logs/sso-migration-*.log

# Monitor resource usage
grep -E "(duration|records|performance)" scripts/migration-logs/sso-migration-*.log
```

### Contact Information

For issues and support:
- Check migration logs first
- Review this documentation
- Test in development environment
- Contact database administrator for production issues

---

**⚠️ Important**: Always test migrations in development environment first. Create full database backups before production migration. Keep rollback scripts accessible during migration.