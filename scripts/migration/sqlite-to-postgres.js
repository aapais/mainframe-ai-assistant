#!/usr/bin/env node

/**
 * SQLite to PostgreSQL Migration Script with Vector Embeddings
 * Migrates incident data from SQLite to PostgreSQL with vector similarity search
 */

const Database = require('better-sqlite3');
const { Client } = require('pg');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const SQLITE_DB_PATH = path.join(__dirname, '../../kb-assistant.db');
const BATCH_SIZE = 10; // Process embeddings in batches to avoid rate limits
const EMBEDDING_DELAY = 1000; // 1 second delay between API calls

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mainframe_ai',
  user: process.env.DB_USER || 'mainframe_user',
  password: process.env.DB_PASSWORD || 'mainframe_pass',
};

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mapping functions for data transformation
function mapSeverity(severity) {
  const mapping = {
    'low': 'LOW',
    'medium': 'MEDIUM',
    'high': 'HIGH',
    'critical': 'CRITICAL'
  };
  return mapping[severity?.toLowerCase()] || 'MEDIUM';
}

function mapStatus(status) {
  const mapping = {
    'aberto': 'OPEN',
    'em_tratamento': 'IN_PROGRESS',
    'resolvido': 'RESOLVED',
    'fechado': 'CLOSED',
    'reaberto': 'OPEN',
    'em_revisao': 'PENDING'
  };
  return mapping[status?.toLowerCase()] || 'OPEN';
}

function mapPriority(priority) {
  const mapping = {
    'P1': 'CRITICAL',
    'P2': 'HIGH',
    'P3': 'MEDIUM',
    'P4': 'LOW'
  };
  return mapping[priority] || 'MEDIUM';
}

function mapTechnicalArea(category) {
  const mapping = {
    'JCL': 'JCL',
    'VSAM': 'VSAM',
    'DB2': 'DB2',
    'CICS': 'CICS',
    'IMS': 'IMS',
    'MQ': 'MQ',
    'COBOL': 'COBOL',
    'TSO': 'TSO',
    'ISPF': 'ISPF',
    'z/OS': 'z/OS',
    'MVS': 'MVS',
    'USS': 'USS',
    'RACF': 'RACF'
  };
  return mapping[category?.toUpperCase()] || 'OTHER';
}

// Generate embedding for text
async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      console.warn('Empty text provided for embedding');
      return null;
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    return null;
  }
}

// Add delay to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main migration function
async function migrateData() {
  let sqliteDb = null;
  let pgClient = null;

  try {
    console.log('🔄 Starting SQLite to PostgreSQL migration...');

    // Connect to SQLite database
    console.log('📖 Connecting to SQLite database...');
    sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });

    // Connect to PostgreSQL database
    console.log('🐘 Connecting to PostgreSQL database...');
    pgClient = new Client(pgConfig);
    await pgClient.connect();

    // Test PostgreSQL connection and pgvector extension
    console.log('🔍 Testing PostgreSQL connection and pgvector extension...');
    const result = await pgClient.query('SELECT version(), current_database();');
    console.log('✅ PostgreSQL connection successful:', result.rows[0]);

    // Check if pgvector extension is available
    try {
      await pgClient.query('SELECT * FROM pg_extension WHERE extname = $1', ['vector']);
      console.log('✅ pgvector extension is available');
    } catch (error) {
      console.error('❌ pgvector extension not found. Please ensure it\'s installed.');
      return;
    }

    // Get all entries from SQLite
    console.log('📊 Fetching data from SQLite...');
    const entries = sqliteDb.prepare(`
      SELECT * FROM entries
      ORDER BY created_at ASC
    `).all();

    console.log(`📈 Found ${entries.length} entries to migrate`);

    // Process entries in batches
    let migratedCount = 0;
    let embeddingCount = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)}...`);

      for (const entry of batch) {
        try {
          // Prepare text for embedding (combine title and description)
          const embeddingText = [
            entry.title || '',
            entry.description || '',
            entry.solution || ''
          ].filter(text => text.trim().length > 0).join(' ');

          // Generate embedding if we have text
          let embedding = null;
          if (embeddingText.trim().length > 0 && process.env.OPENAI_API_KEY) {
            console.log(`🧠 Generating embedding for entry ${entry.id}...`);
            embedding = await generateEmbedding(embeddingText);
            if (embedding) {
              embeddingCount++;
              await delay(EMBEDDING_DELAY); // Avoid rate limiting
            }
          }

          // Prepare metadata
          const metadata = {
            sqlite_id: entry.id,
            usage_count: entry.usage_count || 0,
            success_count: entry.success_count || 0,
            failure_count: entry.failure_count || 0,
            version: entry.version || 1,
            verified: entry.verified || false,
            ai_suggested: entry.ai_suggested || false,
            ai_confidence_score: entry.ai_confidence_score,
            incident_number: entry.incident_number,
            escalation_level: entry.escalation_level,
            resolution_time_minutes: entry.resolution_time_minutes
          };

          // Insert into PostgreSQL
          const insertQuery = `
            INSERT INTO incidents_enhanced (
              title, description, technical_area, business_area, status, priority, severity,
              assigned_to, reporter, resolution, embedding, metadata,
              created_at, updated_at, resolved_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            ) RETURNING id, uuid
          `;

          const values = [
            entry.title || 'Untitled Incident',
            entry.description || '',
            mapTechnicalArea(entry.category),
            'OTHER', // Default business area
            mapStatus(entry.status),
            mapPriority(entry.priority),
            mapSeverity(entry.severity),
            entry.assigned_to,
            entry.reporter,
            entry.solution,
            embedding ? `[${embedding.join(',')}]` : null,
            JSON.stringify(metadata),
            entry.created_at || new Date().toISOString(),
            entry.updated_at || new Date().toISOString(),
            entry.resolved_by ? entry.updated_at : null
          ];

          const result = await pgClient.query(insertQuery, values);
          migratedCount++;

          console.log(`✅ Migrated entry ${entry.id} -> PostgreSQL ID ${result.rows[0].id} (UUID: ${result.rows[0].uuid})`);

        } catch (error) {
          console.error(`❌ Error migrating entry ${entry.id}:`, error.message);
        }
      }
    }

    // Generate migration summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount}/${entries.length} entries`);
    console.log(`🧠 Generated embeddings: ${embeddingCount}/${entries.length} entries`);

    // Verify migration
    const verificationQuery = await pgClient.query('SELECT COUNT(*) as count FROM incidents_enhanced');
    console.log(`🔍 PostgreSQL incidents_enhanced table now contains: ${verificationQuery.rows[0].count} rows`);

    // Test vector similarity search if embeddings were generated
    if (embeddingCount > 0) {
      console.log('\n🧪 Testing vector similarity search...');
      const testQuery = await pgClient.query(`
        SELECT id, title,
               (1 - (embedding <=> (SELECT embedding FROM incidents_enhanced WHERE embedding IS NOT NULL LIMIT 1))) as similarity
        FROM incidents_enhanced
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> (SELECT embedding FROM incidents_enhanced WHERE embedding IS NOT NULL LIMIT 1)
        LIMIT 3
      `);

      console.log('🎯 Similar incidents found:');
      testQuery.rows.forEach(row => {
        console.log(`  - ID ${row.id}: "${row.title}" (similarity: ${parseFloat(row.similarity).toFixed(3)})`);
      });
    }

    // Create migration log entry
    const migrationLog = {
      timestamp: new Date().toISOString(),
      sqlite_db_path: SQLITE_DB_PATH,
      total_entries: entries.length,
      migrated_entries: migratedCount,
      embeddings_generated: embeddingCount,
      pg_config: { ...pgConfig, password: '***' }
    };

    fs.writeFileSync(
      path.join(__dirname, '../logs/migration-log.json'),
      JSON.stringify(migrationLog, null, 2)
    );

    console.log('\n🎉 Migration completed successfully!');
    console.log('📝 Migration log saved to scripts/logs/migration-log.json');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  } finally {
    // Clean up connections
    if (sqliteDb) {
      sqliteDb.close();
      console.log('📖 SQLite connection closed');
    }
    if (pgClient) {
      await pgClient.end();
      console.log('🐘 PostgreSQL connection closed');
    }
  }
}

// Test database connections
async function testConnections() {
  console.log('🔍 Testing database connections...');

  // Test SQLite
  try {
    const sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
    const count = sqliteDb.prepare('SELECT COUNT(*) as count FROM entries').get();
    console.log(`✅ SQLite: Found ${count.count} entries`);
    sqliteDb.close();
  } catch (error) {
    console.error('❌ SQLite connection failed:', error.message);
    return false;
  }

  // Test PostgreSQL
  try {
    const pgClient = new Client(pgConfig);
    await pgClient.connect();
    const result = await pgClient.query('SELECT current_database(), version()');
    console.log('✅ PostgreSQL: Connected to', result.rows[0].current_database);
    await pgClient.end();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    console.log('💡 Make sure PostgreSQL is running: docker compose up -d postgres');
    return false;
  }

  return true;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'test':
        await testConnections();
        break;
      case 'migrate':
        const connectionsOk = await testConnections();
        if (connectionsOk) {
          await migrateData();
        } else {
          console.error('❌ Connection tests failed. Cannot proceed with migration.');
          process.exit(1);
        }
        break;
      default:
        console.log(`
🚀 SQLite to PostgreSQL Migration Tool

Usage:
  node sqlite-to-postgres.js test     - Test database connections
  node sqlite-to-postgres.js migrate  - Run full migration with embeddings

Environment Variables:
  OPENAI_API_KEY - Required for vector embeddings
  DB_HOST        - PostgreSQL host (default: localhost)
  DB_PORT        - PostgreSQL port (default: 5432)
  DB_NAME        - PostgreSQL database (default: mainframe_ai)
  DB_USER        - PostgreSQL user (default: mainframe_user)
  DB_PASSWORD    - PostgreSQL password (default: mainframe_pass)

Examples:
  npm run migrate:test
  npm run migrate:run
        `);
    }
  } catch (error) {
    console.error('💥 Command failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  migrateData,
  testConnections,
  generateEmbedding,
  mapSeverity,
  mapStatus,
  mapPriority,
  mapTechnicalArea
};