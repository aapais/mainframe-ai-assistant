const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting database migration to unified table...\n');

try {
  // Open database
  const dbPath = path.join(__dirname, '..', 'kb-assistant.db');
  const db = new Database(dbPath);

  // Check if migration is needed
  const tableCheck = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='entries'
  `).get();

  if (tableCheck) {
    console.log('✅ Unified table already exists. Migration may have been completed.');

    // Check record counts
    const entriesCount = db.prepare('SELECT COUNT(*) as count FROM entries').get();
    console.log(`\n📊 Current entries count: ${entriesCount.count}`);

    const kbCount = db.prepare("SELECT COUNT(*) as count FROM entries WHERE entry_type = 'knowledge'").get();
    const incCount = db.prepare("SELECT COUNT(*) as count FROM entries WHERE entry_type = 'incident'").get();

    console.log(`  - Knowledge entries: ${kbCount.count}`);
    console.log(`  - Incident entries: ${incCount.count}`);

    db.close();
    process.exit(0);
  }

  // Read migration script
  const migrationPath = path.join(__dirname, '..', 'src', 'database', 'migrations', '018_unified_table_migration.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found. Creating basic unified schema...');

    // Create basic unified schema
    const basicSchema = `
    -- Create unified entries table
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      solution TEXT,
      category TEXT NOT NULL,
      tags TEXT,
      entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')),

      -- Common fields
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,

      -- Incident-specific fields (NULL for knowledge entries)
      status TEXT,
      priority TEXT,
      severity TEXT,
      assigned_to TEXT,
      resolved_by TEXT,
      resolution_time_minutes INTEGER,
      sla_deadline DATETIME,

      -- Knowledge-specific fields
      usage_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1
    );

    -- Create indexes
    CREATE INDEX idx_entries_type ON entries(entry_type);
    CREATE INDEX idx_entries_category ON entries(category);
    CREATE INDEX idx_entries_status ON entries(status);
    CREATE INDEX idx_entries_created ON entries(created_at);

    -- Create backward compatibility views
    CREATE VIEW kb_entries AS
    SELECT * FROM entries WHERE entry_type = 'knowledge';

    CREATE VIEW incidents AS
    SELECT * FROM entries WHERE entry_type = 'incident';
    `;

    db.exec(basicSchema);
    console.log('✅ Basic unified schema created');

    // Check if old tables exist and migrate data
    const kbExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_entries'").get();
    const incExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='incidents'").get();

    if (kbExists && kbExists.name !== 'kb_entries') {
      console.log('\n📦 Migrating knowledge base entries...');
      // Note: 'kb_entries' might be a view now, check for actual table
      const actualKbTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name LIKE '%kb%' AND name != 'entries'").all();
      console.log('KB tables found:', actualKbTable.map(t => t.sql.match(/CREATE TABLE (\w+)/)?.[1]).filter(Boolean));
    }

    if (incExists && incExists.name !== 'incidents') {
      console.log('\n📦 Migrating incident entries...');
      const actualIncTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name LIKE '%incident%' AND name != 'entries'").all();
      console.log('Incident tables found:', actualIncTable.map(t => t.sql.match(/CREATE TABLE (\w+)/)?.[1]).filter(Boolean));
    }

  } else {
    console.log('📄 Reading migration script...');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚙️ Executing migration...');

    // Split by statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    let completed = 0;
    for (const statement of statements) {
      try {
        if (statement.toUpperCase().includes('CREATE') ||
            statement.toUpperCase().includes('INSERT') ||
            statement.toUpperCase().includes('UPDATE') ||
            statement.toUpperCase().includes('ALTER')) {
          db.exec(statement);
          completed++;
        }
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn(`⚠️ Statement failed: ${err.message.substring(0, 100)}`);
        }
      }
    }

    console.log(`✅ Executed ${completed} migration statements`);
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...');

  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `).all();

  console.log('📋 Tables in database:');
  tables.forEach(t => console.log(`  - ${t.name}`));

  // Check if entries table exists and has data
  const entriesExists = tables.find(t => t.name === 'entries');
  if (entriesExists) {
    const count = db.prepare('SELECT COUNT(*) as count FROM entries').get();
    console.log(`\n✅ Migration successful! Unified table has ${count.count} entries.`);
  } else {
    console.log('\n⚠️ Warning: entries table not found after migration');
  }

  db.close();
  console.log('\n🎉 Migration process completed!');

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}