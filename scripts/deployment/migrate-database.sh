#!/bin/bash

# Database Migration Script with Rollback Support
# Usage: ./migrate-database.sh <environment>

set -euo pipefail

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

source "$SCRIPT_DIR/common.sh"

# Database configuration
if [[ "$ENVIRONMENT" == "production" ]]; then
    DB_URL="${DATABASE_URL:-}"
    DB_BACKUP_RETENTION=30
else
    DB_URL="${DATABASE_URL:-}"
    DB_BACKUP_RETENTION=7
fi

if [[ -z "$DB_URL" ]]; then
    log_error "DATABASE_URL environment variable is required"
    exit 1
fi

log_info "Starting database migration for $ENVIRONMENT"

# Create backup before migration
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S)_pre_migration.sql"
log_info "Creating backup: $BACKUP_FILE"

pg_dump "$DB_URL" > "/tmp/$BACKUP_FILE"
aws s3 cp "/tmp/$BACKUP_FILE" "s3://mainframe-ai-backups/$ENVIRONMENT/migrations/" || {
    log_error "Failed to upload backup to S3"
    exit 1
}

log_success "Backup created and uploaded: $BACKUP_FILE"

# Check for pending migrations
cd "$ROOT_DIR"

MIGRATION_FILES=($(find src/database/migrations -name "*.sql" | sort))
APPLIED_MIGRATIONS=$(psql "$DB_URL" -t -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null | tr -d ' ' | grep -v '^$' || true)

PENDING_MIGRATIONS=()
for migration in "${MIGRATION_FILES[@]}"; do
    VERSION=$(basename "$migration" .sql)
    if ! echo "$APPLIED_MIGRATIONS" | grep -q "^$VERSION$"; then
        PENDING_MIGRATIONS+=("$migration")
    fi
done

if [[ ${#PENDING_MIGRATIONS[@]} -eq 0 ]]; then
    log_info "No pending migrations found"
    exit 0
fi

log_info "Found ${#PENDING_MIGRATIONS[@]} pending migrations"

# Create schema_migrations table if it doesn't exist
psql "$DB_URL" -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW(),
    checksum VARCHAR(255)
);" || {
    log_error "Failed to create schema_migrations table"
    exit 1
}

# Apply migrations with transaction safety
for migration in "${PENDING_MIGRATIONS[@]}"; do
    VERSION=$(basename "$migration" .sql)
    CHECKSUM=$(md5sum "$migration" | cut -d' ' -f1)

    log_info "Applying migration: $VERSION"

    # Start transaction
    psql "$DB_URL" -c "BEGIN;" || {
        log_error "Failed to start transaction for migration $VERSION"
        exit 1
    }

    # Apply migration
    if psql "$DB_URL" -f "$migration"; then
        # Record successful migration
        psql "$DB_URL" -c "INSERT INTO schema_migrations (version, checksum) VALUES ('$VERSION', '$CHECKSUM');" || {
            log_error "Failed to record migration $VERSION"
            psql "$DB_URL" -c "ROLLBACK;"
            exit 1
        }

        psql "$DB_URL" -c "COMMIT;" || {
            log_error "Failed to commit migration $VERSION"
            exit 1
        }

        log_success "Applied migration: $VERSION"
    else
        log_error "Failed to apply migration: $VERSION"
        psql "$DB_URL" -c "ROLLBACK;"

        # Restore from backup
        log_info "Restoring database from backup..."
        psql "$DB_URL" < "/tmp/$BACKUP_FILE" || {
            log_error "Failed to restore from backup"
            exit 1
        }

        exit 1
    fi
done

# Verify database integrity
log_info "Verifying database integrity..."
psql "$DB_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" > /dev/null || {
    log_error "Database integrity check failed"
    exit 1
}

# Update database statistics
log_info "Updating database statistics..."
psql "$DB_URL" -c "ANALYZE;" || {
    log_warning "Failed to update database statistics"
}

# Clean up old backups
log_info "Cleaning up old migration backups..."
aws s3 ls "s3://mainframe-ai-backups/$ENVIRONMENT/migrations/" --recursive | \
    while read -r line; do
        BACKUP_DATE=$(echo "$line" | awk '{print $1}')
        BACKUP_FILE=$(echo "$line" | awk '{print $4}')

        if [[ -n "$BACKUP_DATE" && "$BACKUP_DATE" < "$(date -d "$DB_BACKUP_RETENTION days ago" +%Y-%m-%d)" ]]; then
            aws s3 rm "s3://mainframe-ai-backups/$BACKUP_FILE"
            log_info "Removed old backup: $BACKUP_FILE"
        fi
    done

log_success "Database migration completed successfully"