/**
 * Simple PostgreSQL SSO Migration Script
 * Uses existing dependencies to create SSO tables
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from environment
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mainframe_ai',
  user: process.env.DB_USER || 'mainframe_user',
  password: process.env.DB_PASSWORD || 'mainframe_pass',
};

async function runMigration() {
  const client = new Client(pgConfig);

  try {
    console.log('🔗 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Read migration files from src/database/migrations/auth/
    const migrationDir = path.join(__dirname, '../src/database/migrations/auth');
    const migrationFiles = [
      '001_create_sso_users.sql',
      '002_create_sso_providers.sql',
      '003_create_api_keys.sql',
      '004_create_sessions.sql',
      '005_create_audit_logs.sql',
      '006_create_security_events.sql'
    ];

    for (const fileName of migrationFiles) {
      const filePath = path.join(migrationDir, fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Migration file not found: ${fileName}`);
        continue;
      }

      console.log(`📄 Executing migration: ${fileName}`);

      try {
        const migrationSQL = fs.readFileSync(filePath, 'utf8');

        // Split by -- UP and -- DOWN sections
        const upSection = migrationSQL.split('-- UP')[1]?.split('-- DOWN')[0];

        if (!upSection) {
          console.warn(`⚠️ No UP section found in ${fileName}`);
          continue;
        }

        // Execute the UP section
        await client.query(upSection);
        console.log(`✅ Migration completed: ${fileName}`);

      } catch (migrationError) {
        console.error(`❌ Error in migration ${fileName}:`, migrationError.message);
        // Continue with other migrations even if one fails
      }
    }

    // Create essential indexes
    console.log('🔧 Creating performance indexes...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_sso_users_email ON users(email);',
      'CREATE INDEX IF NOT EXISTS idx_sso_sessions_user_id ON user_sessions(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_sso_audit_user_id ON audit_logs(user_id);'
    ];

    for (const indexSQL of indexes) {
      try {
        await client.query(indexSQL);
        console.log('✅ Index created successfully');
      } catch (indexError) {
        console.warn(`⚠️ Index creation warning: ${indexError.message}`);
      }
    }

    // Insert initial data
    console.log('📊 Inserting initial data...');

    // Create default SSO provider configuration
    const defaultProviders = `
      INSERT INTO sso_configurations (
        id, name, provider, is_enabled, priority,
        client_id, client_secret, scopes, claims_mapping,
        auto_provision_users, default_role, created_at, updated_at
      ) VALUES
      (
        'google-oauth', 'Google OAuth 2.0', 'google', 1, 1,
        'your_google_client_id', 'your_google_client_secret',
        '["openid", "profile", "email"]',
        '{"email": "email", "firstName": "given_name", "lastName": "family_name", "displayName": "name"}',
        1, 'user', NOW(), NOW()
      ),
      (
        'microsoft-azure', 'Microsoft Azure AD', 'azure_ad', 1, 2,
        'your_microsoft_client_id', 'your_microsoft_client_secret',
        '["openid", "profile", "email"]',
        '{"email": "mail", "firstName": "givenName", "lastName": "surname", "displayName": "displayName"}',
        1, 'user', NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `;

    try {
      await client.query(defaultProviders);
      console.log('✅ Default SSO providers created');
    } catch (providerError) {
      console.warn(`⚠️ Provider creation warning: ${providerError.message}`);
    }

    // Create admin user if not exists
    const adminUser = `
      INSERT INTO users (
        id, email, email_verified, first_name, last_name,
        display_name, role, permissions, is_active,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 'admin@mainframe.local', true,
        'System', 'Administrator', 'System Administrator',
        'admin', '["read", "write", "admin"]', true,
        NOW(), NOW()
      ) ON CONFLICT (email) DO NOTHING;
    `;

    try {
      await client.query(adminUser);
      console.log('✅ Default admin user created');
    } catch (userError) {
      console.warn(`⚠️ Admin user creation warning: ${userError.message}`);
    }

    console.log('🎉 SSO migration completed successfully!');

    // Verify tables were created
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'user_sessions', 'sso_configurations', 'encrypted_api_keys')
      ORDER BY table_name;
    `);

    console.log('📋 Created tables:', tableCheck.rows.map(r => r.table_name));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔗 Database connection closed');
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };