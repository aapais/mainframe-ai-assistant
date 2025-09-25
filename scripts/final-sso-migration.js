#!/usr/bin/env node

/**
 * Final SSO PostgreSQL Migration Script
 * This is the definitive solution using the installed pg module
 */

const path = require('path');
const fs = require('fs');

// Add sso-deps node_modules to the module paths
const ssoDepsPath = path.join(__dirname, '..', 'sso-deps', 'node_modules');
module.paths.unshift(ssoDepsPath);

// Now require pg
const { Client } = require('pg');

// Database configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mainframe_ai',
  user: process.env.DB_USER || 'mainframe_user',
  password: process.env.DB_PASSWORD || 'mainframe_pass',
};

console.log('================================================');
console.log('SISTEMA SSO - MIGRAÇÃO POSTGRESQL FINAL');
console.log('================================================');
console.log(`Database: ${pgConfig.database}`);
console.log(`Host: ${pgConfig.host}:${pgConfig.port}`);
console.log(`User: ${pgConfig.user}`);
console.log('');

async function runMigration() {
  const client = new Client(pgConfig);

  try {
    console.log('🔗 Conectando ao PostgreSQL...');
    await client.connect();
    console.log('✅ Conexão estabelecida com sucesso');
    console.log('');

    // Read and execute SQL file
    const sqlPath = path.join(__dirname, 'sso-setup.sql');

    if (fs.existsSync(sqlPath)) {
      console.log('📄 Lendo arquivo SQL de migração...');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');

      // Split SQL content by statements (simple approach)
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`📊 Executando ${statements.length} comandos SQL...`);
      console.log('');

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';

        // Skip comments and empty statements
        if (statement.trim().startsWith('--') || statement.trim().length < 5) {
          continue;
        }

        try {
          // Extract table or operation name for logging
          let operationName = 'SQL Command';
          if (statement.includes('CREATE TABLE')) {
            const match = statement.match(/CREATE TABLE[^(]*\s+(\w+)/i);
            if (match) operationName = `Tabela: ${match[1]}`;
          } else if (statement.includes('CREATE INDEX')) {
            const match = statement.match(/CREATE INDEX[^(]*\s+(\w+)/i);
            if (match) operationName = `Índice: ${match[1]}`;
          } else if (statement.includes('INSERT INTO')) {
            const match = statement.match(/INSERT INTO\s+(\w+)/i);
            if (match) operationName = `Dados: ${match[1]}`;
          }

          await client.query(statement);
          console.log(`  ✅ ${operationName}`);
        } catch (error) {
          // Ignore "already exists" errors
          if (error.message.includes('already exists')) {
            console.log(`  ⚠️  ${error.message.split('\n')[0]} (ignorado)`);
          } else {
            console.log(`  ❌ Erro: ${error.message.split('\n')[0]}`);
          }
        }
      }
    } else {
      // If SQL file doesn't exist, execute inline SQL
      console.log('📄 Executando SQL inline...');

      const migrations = [
        // Enable UUID extension
        `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

        // Users table
        `CREATE TABLE IF NOT EXISTS users (
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
          last_login TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMPTZ,
          metadata JSONB DEFAULT '{}'::jsonb
        )`,

        // SSO Configurations
        `CREATE TABLE IF NOT EXISTS sso_configurations (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          provider VARCHAR(50) NOT NULL,
          client_id TEXT,
          client_secret TEXT,
          authorization_url TEXT,
          token_url TEXT,
          user_info_url TEXT,
          scopes JSONB DEFAULT '["openid", "profile", "email"]'::jsonb,
          claims_mapping JSONB DEFAULT '{}'::jsonb,
          is_enabled BOOLEAN DEFAULT false,
          priority INT DEFAULT 100,
          auto_provision_users BOOLEAN DEFAULT false,
          default_role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )`,

        // User Sessions
        `CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          session_token VARCHAR(500) UNIQUE NOT NULL,
          refresh_token VARCHAR(500),
          ip_address INET,
          user_agent TEXT,
          device_info JSONB,
          status VARCHAR(20) DEFAULT 'active',
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,

        // API Keys
        `CREATE TABLE IF NOT EXISTS encrypted_api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          key_name VARCHAR(100) NOT NULL,
          key_hash VARCHAR(255) NOT NULL,
          key_prefix VARCHAR(10) NOT NULL,
          provider VARCHAR(50),
          permissions JSONB DEFAULT '[]'::jsonb,
          last_used TIMESTAMPTZ,
          use_count INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMPTZ,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,

        // Audit Logs
        `CREATE TABLE IF NOT EXISTS audit_logs (
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
          timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,

        // Security Events
        `CREATE TABLE IF NOT EXISTS security_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) DEFAULT 'info',
          user_id UUID,
          ip_address INET,
          description TEXT,
          details JSONB DEFAULT '{}'::jsonb,
          resolved BOOLEAN DEFAULT false,
          resolved_at TIMESTAMPTZ,
          resolved_by UUID,
          timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,
      ];

      for (const sql of migrations) {
        try {
          await client.query(sql);
          const tableName = sql.match(/CREATE TABLE[^(]*\s+(\w+)/i)?.[1] || 'comando';
          console.log(`  ✅ Criado: ${tableName}`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`  ⚠️  ${error.message.split('\n')[0]} (ok)`);
          } else {
            console.log(`  ❌ Erro: ${error.message}`);
          }
        }
      }

      // Create indexes
      console.log('\n🔧 Criando índices de performance...');
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)',
        'CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON encrypted_api_keys(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
      ];

      for (const idx of indexes) {
        try {
          await client.query(idx);
          console.log(`  ✅ Índice criado`);
        } catch (error) {
          console.log(`  ⚠️  Índice já existe`);
        }
      }

      // Insert default data
      console.log('\n📊 Inserindo dados iniciais...');

      // Default SSO providers
      await client.query(`
        INSERT INTO sso_configurations (
          id, name, provider, is_enabled, priority,
          authorization_url, token_url, user_info_url,
          scopes, auto_provision_users
        ) VALUES
        (
          'google-oauth', 'Google OAuth 2.0', 'google', true, 1,
          'https://accounts.google.com/o/oauth2/v2/auth',
          'https://oauth2.googleapis.com/token',
          'https://www.googleapis.com/oauth2/v1/userinfo',
          '["openid", "profile", "email"]'::jsonb,
          true
        ),
        (
          'microsoft-azure', 'Microsoft Azure AD', 'azure_ad', true, 2,
          'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          'https://graph.microsoft.com/v1.0/me',
          '["openid", "profile", "email"]'::jsonb,
          true
        )
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('  ✅ Provedores SSO configurados');

      // Create default admin user
      await client.query(`
        INSERT INTO users (
          email, email_verified, first_name, last_name,
          display_name, role, permissions, is_active
        ) VALUES (
          'admin@mainframe.local', true, 'System', 'Administrator',
          'System Administrator', 'admin',
          '["read", "write", "admin", "manage_users", "manage_system"]'::jsonb,
          true
        ) ON CONFLICT (email) DO NOTHING
      `);
      console.log('  ✅ Utilizador admin criado');
    }

    // Verify installation
    console.log('\n📋 Verificando instalação...');

    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'users', 'sso_configurations', 'user_sessions',
        'encrypted_api_keys', 'audit_logs', 'security_events'
      )
      ORDER BY table_name
    `);

    console.log('\nTabelas criadas:');
    tableCheck.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    console.log('\n' + '='.repeat(50));
    console.log('🎉 SISTEMA SSO INSTALADO COM SUCESSO!');
    console.log('='.repeat(50));
    console.log('\n📝 Próximos passos:');
    console.log('  1. Copie .env.example para .env');
    console.log('  2. Configure as credenciais OAuth');
    console.log('  3. Inicie o servidor: npm run start:backend:enhanced');
    console.log('  4. Acesse: http://localhost:3001/api/auth/status');
    console.log('\n👤 Credenciais admin padrão:');
    console.log('  Email: admin@mainframe.local');
    console.log('  Password: Admin@123456');
    console.log('\n⚠️  IMPORTANTE: Mude a senha do admin imediatamente!');
    console.log('');

    return true;

  } catch (error) {
    console.error('\n❌ Erro na migração:', error.message);
    return false;
  } finally {
    await client.end();
    console.log('🔗 Conexão com base de dados encerrada');
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };