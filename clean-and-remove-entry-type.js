const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('🧹 Limpando e removendo coluna entry_type\n');

// First, drop all views that might depend on the table
console.log('📦 Removendo views antigas...');
try {
  db.exec(`
    DROP VIEW IF EXISTS v_kb_incident_queue;
    DROP VIEW IF EXISTS v_incident_stats;
    DROP VIEW IF EXISTS v_kb_stats;
  `);
  console.log('✅ Views removidas\n');
} catch (e) {
  console.log('⚠️ Algumas views não existiam\n');
}

// Backup current data
const backup = db.prepare("SELECT * FROM entries").all();
console.log(`📋 Backup de ${backup.length} incidentes\n`);

// Create new table without entry_type
console.log('📦 Criando nova estrutura sem entry_type...');
db.exec(`
  -- Drop tables
  DROP TABLE IF EXISTS entries_new;

  -- Create new table WITHOUT entry_type
  CREATE TABLE entries_new (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    solution TEXT,
    category TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    severity TEXT,
    status TEXT,
    priority TEXT,
    assigned_to TEXT,
    resolved_by TEXT,
    resolution_time_minutes INTEGER,
    sla_deadline DATETIME,
    escalation_level INTEGER,
    incident_number TEXT,
    reporter TEXT,
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    verified BOOLEAN DEFAULT 0,
    ai_suggested BOOLEAN DEFAULT 0,
    ai_confidence_score REAL,
    metadata TEXT
  );
`);

console.log('✅ Nova estrutura criada\n');

// Migrate data
console.log('📝 Migrando dados...');
const stmt = db.prepare(`
  INSERT INTO entries_new SELECT
    id, title, description, solution, category, tags,
    created_at, updated_at, created_by, updated_by,
    severity, status, priority, assigned_to, resolved_by,
    resolution_time_minutes, sla_deadline, escalation_level,
    incident_number, reporter, usage_count, success_count,
    failure_count, version, verified, ai_suggested,
    ai_confidence_score, metadata
  FROM entries
`);

stmt.run();

// Replace old table with new
console.log('🔄 Substituindo tabela antiga...');
db.exec(`
  DROP TABLE entries;
  ALTER TABLE entries_new RENAME TO entries;
`);

console.log('✅ Migração completa!\n');

// Verify the result
const count = db.prepare("SELECT COUNT(*) as total FROM entries").get();
const sample = db.prepare("SELECT id, title, status FROM entries LIMIT 5").all();

console.log(`📊 Verificação:`);
console.log(`   Total de incidentes: ${count.total}`);
console.log(`\n   Primeiros 5 incidentes:`);
sample.forEach(inc => {
  console.log(`   [${inc.id}] ${inc.title} - ${inc.status}`);
});

// Check that entry_type doesn't exist
const tableInfo = db.prepare("PRAGMA table_info(entries)").all();
const hasEntryType = tableInfo.some(col => col.name === 'entry_type');

console.log(`\n✨ Coluna entry_type removida: ${!hasEntryType ? 'SIM ✅' : 'NÃO ❌'}`);

db.close();