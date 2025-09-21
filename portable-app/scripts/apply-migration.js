#!/usr/bin/env node

/**
 * Apply database migration 009_mvp1_v8_transparency.sql
 * For Electron app database
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine database path (Electron app data location)
const appName = 'accenture-mainframe-ai-assistant';
let dbPath;

if (process.platform === 'win32') {
  dbPath = path.join(os.homedir(), 'AppData', 'Roaming', appName, 'knowledge.db');
} else if (process.platform === 'darwin') {
  dbPath = path.join(os.homedir(), 'Library', 'Application Support', appName, 'knowledge.db');
} else {
  dbPath = path.join(os.homedir(), '.config', appName, 'knowledge.db');
}

// Alternative paths to check
const alternativePaths = [
  path.join(process.cwd(), 'knowledge.db'),
  path.join(process.cwd(), 'data', 'knowledge.db'),
  path.join(process.cwd(), 'temp', 'knowledge.db'),
  path.join(os.homedir(), '.accenture-kb', 'knowledge.db')
];

// Find existing database
let foundDb = null;
if (fs.existsSync(dbPath)) {
  foundDb = dbPath;
} else {
  for (const altPath of alternativePaths) {
    if (fs.existsSync(altPath)) {
      foundDb = altPath;
      break;
    }
  }
}

if (!foundDb) {
  // Create new database in project temp folder for testing
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  foundDb = path.join(tempDir, 'knowledge.db');
  console.log('⚠️  Database not found in standard locations');
  console.log(`📁 Creating test database at: ${foundDb}`);
}

console.log('🗄️  Database Migration Tool');
console.log('==========================');
console.log(`📁 Database path: ${foundDb}`);

// Read migration file
const migrationPath = path.join(process.cwd(), 'src', 'database', 'migrations', '009_mvp1_v8_transparency.sql');
if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
console.log(`📄 Migration file: ${migrationPath}`);
console.log(`📏 Migration size: ${migrationSQL.length} characters`);

try {
  // Note: Using runtime 'electron' for compatibility with Electron app
  const db = new Database(foundDb);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  console.log('\n🚀 Applying migration...');

  // Split migration into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    try {
      db.exec(statement + ';');
      successCount++;
      // Show progress for important tables
      if (statement.includes('CREATE TABLE')) {
        const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
        if (tableMatch) {
          console.log(`  ✅ Created table: ${tableMatch[1]}`);
        }
      }
    } catch (err) {
      if (err.message.includes('already exists')) {
        // Ignore if table already exists
        successCount++;
      } else {
        console.error(`  ❌ Error: ${err.message.substring(0, 100)}`);
        errorCount++;
      }
    }
  }

  console.log(`\n📊 Migration Results:`);
  console.log(`  ✅ Successful statements: ${successCount}`);
  console.log(`  ❌ Failed statements: ${errorCount}`);

  // Verify new tables were created
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ai_%' OR name LIKE '%transparen%' OR name LIKE '%cost%' OR name LIKE '%operation%'").all();
  console.log(`\n📋 Transparency-related tables found: ${tables.length}`);
  tables.forEach(t => console.log(`  - ${t.name}`));

  // Check schema version
  const version = db.prepare("SELECT MAX(version) as version FROM schema_versions").get();
  console.log(`\n🏷️  Current schema version: ${version ? version.version : 'unknown'}`);

  db.close();
  console.log('\n✅ Migration completed successfully!');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}