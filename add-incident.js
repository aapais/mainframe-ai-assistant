const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('➕ Adicionando novo incidente à BD\n');

// Novo incidente - problema atual com COBOL
const newIncident = {
  title: 'COBOL Compilation Error - Missing LINKAGE',
  description: 'Programa COBOL PAYCALC01 falha na compilação com erro "LINKAGE SECTION item not found". Afeta o processamento de folha de pagamento.',
  category: 'COBOL',
  severity: 'high',
  priority: 'P1',
  status: 'aberto',
  reporter: 'ricardo.mendes@accenture.com',
  solution: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Get next ID
const maxId = db.prepare("SELECT MAX(id) as maxId FROM entries").get();
const nextId = (maxId.maxId || 0) + 1;

// Insert the new incident
const stmt = db.prepare(`
  INSERT INTO entries (
    id, entry_type, title, description, category, severity, priority,
    status, reporter, solution, created_at, updated_at
  ) VALUES (
    @id, 'incident', @title, @description, @category, @severity, @priority,
    @status, @reporter, @solution, @created_at, @updated_at
  )
`);

const result = stmt.run({
  id: nextId,
  ...newIncident
});

console.log(`✅ Novo incidente inserido com ID: ${nextId}`);
console.log(`   Título: ${newIncident.title}`);
console.log(`   Status: ${newIncident.status}`);
console.log(`   Prioridade: ${newIncident.priority}`);
console.log(`   Severidade: ${newIncident.severity}`);
console.log(`   Reporter: ${newIncident.reporter}`);

// Show updated totals
const totals = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'aberto' THEN 1 ELSE 0 END) as abertos,
    SUM(CASE WHEN status = 'em_tratamento' THEN 1 ELSE 0 END) as em_tratamento,
    SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END) as resolvidos
  FROM entries
`).get();

console.log('\n📊 Totais atualizados:');
console.log(`   Total de incidentes: ${totals.total}`);
console.log(`   Abertos: ${totals.abertos}`);
console.log(`   Em tratamento: ${totals.em_tratamento}`);
console.log(`   Resolvidos (Base de Conhecimento): ${totals.resolvidos}`);

db.close();