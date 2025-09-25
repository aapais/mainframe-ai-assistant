#!/usr/bin/env python3
"""
SSO Migration Script for PostgreSQL
Uses standard Python libraries - no external dependencies needed
"""

import psycopg2
import os
import json
import hashlib
import secrets
from datetime import datetime
import sys

# Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': os.environ.get('DB_PORT', '5432'),
    'database': os.environ.get('DB_NAME', 'mainframe_ai'),
    'user': os.environ.get('DB_USER', 'mainframe_user'),
    'password': os.environ.get('DB_PASSWORD', 'mainframe_pass'),
}

# SQL Migrations
MIGRATIONS = [
    # 1. Users table
    """
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        email_verified BOOLEAN DEFAULT false,
        password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        display_name VARCHAR(255),
        avatar_url TEXT,
        role VARCHAR(50) DEFAULT 'user',
        permissions JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
    );
    """,

    # 2. SSO Configurations
    """
    CREATE TABLE IF NOT EXISTS sso_configurations (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        client_id TEXT,
        client_secret TEXT,
        authorization_url TEXT,
        token_url TEXT,
        user_info_url TEXT,
        scopes JSONB DEFAULT '[]'::jsonb,
        claims_mapping JSONB DEFAULT '{}'::jsonb,
        is_enabled BOOLEAN DEFAULT false,
        priority INT DEFAULT 100,
        auto_provision_users BOOLEAN DEFAULT false,
        default_role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """,

    # 3. User Sessions
    """
    CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        session_token VARCHAR(500) UNIQUE NOT NULL,
        refresh_token VARCHAR(500),
        ip_address INET,
        user_agent TEXT,
        device_info JSONB,
        status VARCHAR(20) DEFAULT 'active',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """,

    # 4. Encrypted API Keys
    """
    CREATE TABLE IF NOT EXISTS encrypted_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        key_name VARCHAR(100) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        provider VARCHAR(50),
        permissions JSONB DEFAULT '[]'::jsonb,
        last_used TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """,

    # 5. Audit Logs
    """
    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        request_body JSONB,
        response_status INT,
        duration_ms INT,
        metadata JSONB DEFAULT '{}'::jsonb,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """,

    # 6. Security Events
    """
    CREATE TABLE IF NOT EXISTS security_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'info',
        user_id UUID,
        ip_address INET,
        description TEXT,
        details JSONB DEFAULT '{}'::jsonb,
        resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP,
        resolved_by UUID,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """,

    # 7. User Preferences
    """
    CREATE TABLE IF NOT EXISTS user_preferences (
        user_id UUID PRIMARY KEY,
        theme VARCHAR(20) DEFAULT 'light',
        language VARCHAR(10) DEFAULT 'en',
        notifications JSONB DEFAULT '{}'::jsonb,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """,

    # 8. Login Attempts
    """
    CREATE TABLE IF NOT EXISTS login_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        ip_address INET NOT NULL,
        success BOOLEAN DEFAULT false,
        failure_reason VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
]

# Indexes for performance
INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);",
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);",
    "CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON encrypted_api_keys(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);",
    "CREATE INDEX IF NOT EXISTS idx_login_attempts_timestamp ON login_attempts(timestamp);"
]

def hash_password(password):
    """Simple password hashing using SHA256"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${pwd_hash}"

def run_migration():
    """Execute the migration"""
    conn = None
    cursor = None

    try:
        # Connect to PostgreSQL
        print("🔗 Connecting to PostgreSQL...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✅ Connected to PostgreSQL")

        # Execute migrations
        print("\n📄 Creating tables...")
        for i, migration in enumerate(MIGRATIONS, 1):
            try:
                cursor.execute(migration)
                table_name = migration.split('CREATE TABLE IF NOT EXISTS ')[1].split(' ')[0]
                print(f"  ✅ Table created: {table_name}")
            except Exception as e:
                print(f"  ⚠️ Error creating table: {e}")

        # Create indexes
        print("\n🔧 Creating indexes...")
        for index in INDEXES:
            try:
                cursor.execute(index)
                index_name = index.split('CREATE INDEX IF NOT EXISTS ')[1].split(' ')[0]
                print(f"  ✅ Index created: {index_name}")
            except Exception as e:
                print(f"  ⚠️ Error creating index: {e}")

        # Insert default data
        print("\n📊 Inserting default data...")

        # Default SSO providers
        providers = [
            ('google-oauth', 'Google OAuth 2.0', 'google',
             'https://accounts.google.com/o/oauth2/v2/auth',
             'https://oauth2.googleapis.com/token',
             'https://www.googleapis.com/oauth2/v1/userinfo',
             '["openid", "profile", "email"]'),
            ('microsoft-azure', 'Microsoft Azure AD', 'azure_ad',
             'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
             'https://login.microsoftonline.com/common/oauth2/v2.0/token',
             'https://graph.microsoft.com/v1.0/me',
             '["openid", "profile", "email"]')
        ]

        for provider in providers:
            try:
                cursor.execute("""
                    INSERT INTO sso_configurations
                    (id, name, provider, authorization_url, token_url, user_info_url, scopes, is_enabled)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, true)
                    ON CONFLICT (id) DO NOTHING
                """, provider)
                print(f"  ✅ Provider added: {provider[1]}")
            except Exception as e:
                print(f"  ⚠️ Error adding provider: {e}")

        # Create default admin user
        admin_pwd_hash = hash_password("admin123")
        try:
            cursor.execute("""
                INSERT INTO users
                (email, email_verified, password_hash, first_name, last_name,
                 display_name, role, permissions, is_active)
                VALUES ('admin@mainframe.local', true, %s, 'System', 'Administrator',
                        'System Administrator', 'admin', '["read", "write", "admin"]'::jsonb, true)
                ON CONFLICT (email) DO NOTHING
            """, (admin_pwd_hash,))
            print("  ✅ Admin user created (admin@mainframe.local / admin123)")
        except Exception as e:
            print(f"  ⚠️ Error creating admin user: {e}")

        # Commit all changes
        conn.commit()
        print("\n🎉 SSO migration completed successfully!")

        # Verify tables
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)

        tables = cursor.fetchall()
        print("\n📋 Created tables:")
        for table in tables:
            print(f"  - {table[0]}")

    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("\n🔗 Database connection closed")

    return True

if __name__ == "__main__":
    print("=" * 60)
    print("SSO PostgreSQL Migration Script")
    print("=" * 60)

    # Check if psycopg2 is available
    try:
        import psycopg2
    except ImportError:
        print("\n❌ Error: psycopg2 is required but not installed.")
        print("Please install it with: pip install psycopg2-binary")
        sys.exit(1)

    success = run_migration()
    sys.exit(0 if success else 1)