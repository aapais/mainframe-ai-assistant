const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('🔧 Corrigindo base de dados\n');

// Check what tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
console.log('📋 Tabelas existentes:');
tables.forEach(t => console.log(`   - ${t.name}`));

// Check if entries_new exists with data
if (tables.some(t => t.name === 'entries_new')) {
  console.log('\n✅ Tabela entries_new encontrada');

  // Check if it has data
  const count = db.prepare("SELECT COUNT(*) as total FROM entries_new").get();
  console.log(`   Contém ${count.total} incidentes`);

  if (count.total > 0) {
    // Rename entries_new to entries
    console.log('\n🔄 Renomeando entries_new para entries...');
    db.exec(`
      DROP TABLE IF EXISTS entries;
      ALTER TABLE entries_new RENAME TO entries;
    `);
    console.log('✅ Tabela renomeada com sucesso!');
  }
} else if (!tables.some(t => t.name === 'entries')) {
  console.log('\n❌ Nenhuma tabela entries encontrada! Recreando...');

  // Recreate from scratch
  db.exec(`
    CREATE TABLE entries (
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
  console.log('✅ Tabela entries recriada');
}

// Final check
const finalTables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
const hasEntries = finalTables.some(t => t.name === 'entries');

if (hasEntries) {
  const count = db.prepare("SELECT COUNT(*) as total FROM entries").get();
  const columns = db.prepare("PRAGMA table_info(entries)").all();
  const hasEntryType = columns.some(c => c.name === 'entry_type');

  console.log('\n📊 Estado Final:');
  console.log(`   ✅ Tabela entries existe`);
  console.log(`   📦 Total de incidentes: ${count.total}`);
  console.log(`   🔍 Coluna entry_type existe? ${hasEntryType ? 'SIM ❌' : 'NÃO ✅'}`);
  console.log(`   📋 Total de colunas: ${columns.length}`);
}

db.close();