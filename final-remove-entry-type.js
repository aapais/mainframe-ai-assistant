const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('🧹 Removendo definitivamente a coluna entry_type\n');

// First, list all views
console.log('📋 Listando todas as views...');
const views = db.prepare("SELECT name FROM sqlite_master WHERE type = 'view'").all();
console.log(`   Encontradas ${views.length} views:`);
views.forEach(v => console.log(`   - ${v.name}`));

// Drop ALL views
console.log('\n🗑️  Removendo todas as views...');
views.forEach(v => {
  try {
    db.exec(`DROP VIEW IF EXISTS ${v.name}`);
    console.log(`   ✅ Removida: ${v.name}`);
  } catch (e) {
    console.log(`   ⚠️ Erro ao remover ${v.name}: ${e.message}`);
  }
});

// Backup current data
console.log('\n📦 Fazendo backup dos dados...');
const backup = db.prepare("SELECT * FROM entries").all();
console.log(`   ${backup.length} incidentes salvos`);

// Create new table without entry_type
console.log('\n🔨 Criando nova tabela sem entry_type...');
db.exec(`
  CREATE TABLE IF NOT EXISTS entries_new (
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

// Copy data (excluding entry_type)
console.log('📝 Migrando dados...');
const insertStmt = db.prepare(`
  INSERT INTO entries_new (
    id, title, description, solution, category, tags,
    created_at, updated_at, created_by, updated_by,
    severity, status, priority, assigned_to, resolved_by,
    resolution_time_minutes, sla_deadline, escalation_level,
    incident_number, reporter, usage_count, success_count,
    failure_count, version, verified, ai_suggested,
    ai_confidence_score, metadata
  ) VALUES (
    @id, @title, @description, @solution, @category, @tags,
    @created_at, @updated_at, @created_by, @updated_by,
    @severity, @status, @priority, @assigned_to, @resolved_by,
    @resolution_time_minutes, @sla_deadline, @escalation_level,
    @incident_number, @reporter, @usage_count, @success_count,
    @failure_count, @version, @verified, @ai_suggested,
    @ai_confidence_score, @metadata
  )
`);

const migrate = db.transaction(() => {
  backup.forEach(row => {
    const {entry_type, is_knowledge_base, is_incident, ...cleanRow} = row;
    insertStmt.run(cleanRow);
  });
});

migrate();

// Replace old table
console.log('\n🔄 Substituindo tabela...');
db.exec(`
  DROP TABLE entries;
  ALTER TABLE entries_new RENAME TO entries;
`);

// Verify
const count = db.prepare("SELECT COUNT(*) as total FROM entries").get();
const statusCount = db.prepare(`
  SELECT
    status,
    COUNT(*) as count
  FROM entries
  GROUP BY status
`).all();

console.log('\n✅ MIGRAÇÃO COMPLETA!\n');
console.log(`📊 Resumo Final:`);
console.log(`   Total de incidentes: ${count.total}`);
console.log(`\n   Por status:`);
statusCount.forEach(s => {
  console.log(`   - ${s.status}: ${s.count}`);
});

// Verify entry_type is gone
const tableInfo = db.prepare("PRAGMA table_info(entries)").all();
const hasEntryType = tableInfo.some(col => col.name === 'entry_type');

console.log(`\n✨ Coluna entry_type existe? ${hasEntryType ? 'SIM ❌' : 'NÃO ✅'}`);
console.log(`   Total de colunas: ${tableInfo.length}`);

db.close();