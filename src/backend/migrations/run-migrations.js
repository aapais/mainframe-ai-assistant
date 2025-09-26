/**
 * Database Migration Runner for Chat Feature
 * Executes all chat-related migrations in order
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database configuration from environment or defaults
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'mainframe_ai',
  user: process.env.DB_USER || 'mainframe_user',
  password: process.env.DB_PASSWORD || 'mainframe_pass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(dbConfig);

// Migration files in order
const migrations = [
  '001_chat_conversations.sql',
  '002_chat_messages.sql',
  '003_conversation_summaries.sql',
  '004_knowledge_context.sql',
  '005_knowledge_base_vectors.sql',
  '006_vector_indexes.sql'
];

// Create migrations tracking table if it doesn't exist
async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await pool.query(query);
    console.log('✓ Migrations table ready');
  } catch (error) {
    console.error('✗ Failed to create migrations table:', error.message);
    throw error;
  }
}

// Check if a migration has been executed
async function isMigrationExecuted(migrationName) {
  const query = 'SELECT 1 FROM schema_migrations WHERE migration = $1';
  const result = await pool.query(query, [migrationName]);
  return result.rowCount > 0;
}

// Mark migration as executed
async function markMigrationExecuted(migrationName) {
  const query = 'INSERT INTO schema_migrations (migration) VALUES ($1)';
  await pool.query(query, [migrationName]);
}

// Run a single migration
async function runMigration(migrationFile) {
  const migrationPath = path.join(__dirname, migrationFile);

  // Check if already executed
  if (await isMigrationExecuted(migrationFile)) {
    console.log(`⊙ Migration ${migrationFile} already executed, skipping...`);
    return;
  }

  // Read migration SQL
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Execute migration in transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await markMigrationExecuted(migrationFile);
    await client.query('COMMIT');
    console.log(`✓ Migration ${migrationFile} executed successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Migration ${migrationFile} failed:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Verify pgvector extension
async function verifyPgVector() {
  const query = `
    SELECT 1 FROM pg_extension WHERE extname = 'vector';
  `;

  try {
    const result = await pool.query(query);
    if (result.rowCount === 0) {
      console.warn('⚠ pgvector extension not installed. Installing...');
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('✓ pgvector extension installed');
    } else {
      console.log('✓ pgvector extension verified');
    }
  } catch (error) {
    console.error('✗ Failed to verify/install pgvector:', error.message);
    console.error('  Please ensure pgvector is installed in PostgreSQL');
    console.error('  Run: CREATE EXTENSION vector; as superuser');
    throw error;
  }
}

// Verify schema after migrations
async function verifySchema() {
  const tables = [
    'chat_conversations',
    'chat_messages',
    'conversation_summaries',
    'knowledge_context'
  ];

  console.log('\nVerifying schema...');

  for (const table of tables) {
    const query = `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1;
    `;

    const result = await pool.query(query, [table]);
    if (result.rowCount > 0) {
      console.log(`  ✓ Table ${table} exists`);
    } else {
      console.error(`  ✗ Table ${table} not found`);
      throw new Error(`Schema verification failed: ${table} missing`);
    }
  }

  // Verify vector columns
  const vectorQuery = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'knowledge_base'
    AND column_name IN ('embedding_openai', 'embedding_gemini');
  `;

  const vectorResult = await pool.query(vectorQuery);
  if (vectorResult.rowCount >= 2) {
    console.log('  ✓ Vector columns verified');
  } else {
    console.warn('  ⚠ Some vector columns may be missing');
  }
}

// Main migration runner
async function main() {
  console.log('Chat Feature Database Migration Runner');
  console.log('=====================================\n');

  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✓ Database connection established\n');

    // Create migrations table
    await createMigrationsTable();

    // Verify pgvector
    await verifyPgVector();

    // Run migrations
    console.log('\nRunning migrations...');
    for (const migration of migrations) {
      await runMigration(migration);
    }

    // Verify schema
    await verifySchema();

    console.log('\n✓ All migrations completed successfully!');

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { runMigration, verifySchema };