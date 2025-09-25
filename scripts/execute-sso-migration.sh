#!/bin/bash

# SSO Migration Script for PostgreSQL
# Execute this to set up all SSO tables and initial data

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mainframe_ai}"
DB_USER="${DB_USER:-mainframe_user}"
DB_PASSWORD="${DB_PASSWORD:-mainframe_pass}"

echo "================================================"
echo "SSO PostgreSQL Migration"
echo "================================================"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed."
    echo "Please install PostgreSQL client tools."
    exit 1
fi

# Export password for non-interactive connection
export PGPASSWORD=$DB_PASSWORD

# Check database connection
echo "🔗 Testing database connection..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Error: Cannot connect to PostgreSQL database."
    echo "Please check your database configuration."
    exit 1
fi

echo "✅ Database connection successful"
echo ""

# Execute SQL migration file
echo "📄 Executing SSO migration SQL..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/sso-setup.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSO migration completed successfully!"
    echo ""
    echo "📋 Verification:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%user%' OR table_name LIKE '%sso%' OR table_name LIKE '%session%' ORDER BY table_name;"

    echo ""
    echo "🎉 SSO system is ready!"
    echo ""
    echo "Default admin credentials:"
    echo "  Email: admin@mainframe.local"
    echo "  Password: Admin@123456"
    echo ""
    echo "⚠️  Remember to:"
    echo "  1. Change the admin password immediately"
    echo "  2. Configure your OAuth providers in .env"
    echo "  3. Update client IDs and secrets for SSO providers"
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi

# Clear password from environment
unset PGPASSWORD