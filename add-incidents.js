const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const db = new Database(path.join(__dirname, 'kb-assistant.db'));

// First check what columns exist
const tableInfo = db.prepare("PRAGMA table_info(entries)").all();
console.log('📋 Table structure:');
console.log(tableInfo.map(col => col.name).join(', '));

// Clear existing test incidents only
db.prepare("DELETE FROM entries WHERE entry_type = 'incident' OR category IN ('JCL', 'VSAM', 'DB2', 'CICS', 'Batch', 'IMS', 'Security', 'Network')").run();

// Sample incidents - adapted to actual schema
const incidents = [
  // Active incidents
  {
    title: 'JCL Error - Job PAYROLL01 Abended',
    description: 'Job PAYROLL01 está a abortar com ABEND S0C7 no step CALC. Erro de data inválida.',
    category: 'JCL',
    severity: 'high',
    priority: 'P1',
    status: 'aberto',
    entry_type: 'incident',
    reporter: 'joao.silva@accenture.com',
    solution: ''
  },
  {
    title: 'VSAM File Corruption',
    description: 'Arquivo VSAM CUSTMAST apresentando erro de I/O após backup incompleto.',
    category: 'VSAM',
    severity: 'critical',
    priority: 'P1',
    status: 'em_tratamento',
    entry_type: 'incident',
    reporter: 'maria.santos@accenture.com',
    solution: ''
  },
  {
    title: 'DB2 Connection Pool Exhausted',
    description: 'Aplicação CICS não consegue conectar ao DB2. Pool de conexões esgotado.',
    category: 'DB2',
    severity: 'high',
    priority: 'P2',
    status: 'aberto',
    entry_type: 'incident',
    reporter: 'pedro.costa@accenture.com',
    solution: ''
  },
  {
    title: 'Batch Job Performance Issue',
    description: 'Jobs batch noturnos demorando 3x mais que o normal.',
    category: 'Batch',
    severity: 'medium',
    priority: 'P2',
    status: 'em_tratamento',
    entry_type: 'incident',
    reporter: 'ana.ferreira@accenture.com',
    solution: ''
  },
  {
    title: 'CICS Transaction Timeout',
    description: 'Transação TRN001 em timeout após 30 segundos.',
    category: 'CICS',
    severity: 'medium',
    priority: 'P3',
    status: 'aberto',
    entry_type: 'incident',
    reporter: 'carlos.oliveira@accenture.com',
    solution: ''
  },

  // Resolved incidents (Knowledge Base)
  {
    title: 'ABEND S0C4 - Addressing Exception',
    description: 'Programa COBOL abortando com S0C4 ao acessar memória.',
    category: 'JCL',
    severity: 'high',
    priority: 'P2',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'tech.team@accenture.com',
    solution: 'Corrigir índice da tabela interna. Verificar limites de OCCURS. Recompilar com SSRANGE.'
  },
  {
    title: 'VSAM Status Code 92',
    description: 'Erro ao ler registro VSAM sequencialmente.',
    category: 'VSAM',
    severity: 'medium',
    priority: 'P3',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'support@accenture.com',
    solution: 'Emitir START antes de READ NEXT. Verificar modo de abertura do arquivo.'
  },
  {
    title: 'DB2 SQLCODE -904',
    description: 'Resource unavailable ao executar query.',
    category: 'DB2',
    severity: 'high',
    priority: 'P1',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'dba@accenture.com',
    solution: 'Executar REORG na tablespace. Verificar locks. Aumentar LOCKMAX se necessário.'
  },
  {
    title: 'IMS Database Full',
    description: 'Base IMS atingiu limite de espaço.',
    category: 'IMS',
    severity: 'critical',
    priority: 'P1',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'ims.admin@accenture.com',
    solution: 'Reorganizar base IMS. Aumentar alocação. Implementar purge de dados antigos.'
  },
  {
    title: 'CICS ASRA Abend',
    description: 'Transação abortando com código ASRA.',
    category: 'CICS',
    severity: 'high',
    priority: 'P2',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'cics.support@accenture.com',
    solution: 'Verificar dump CICS. Common: divisão por zero, overflow. Usar CEDF para debug.'
  },
  {
    title: 'Batch Window Exceeded',
    description: 'Janela batch ultrapassando horário.',
    category: 'Batch',
    severity: 'medium',
    priority: 'P2',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'batch@accenture.com',
    solution: 'Implementar processamento paralelo. Otimizar queries DB2 com índices.'
  },
  {
    title: 'RACF Security Violation',
    description: 'Usuário sem permissão para dataset.',
    category: 'Security',
    severity: 'medium',
    priority: 'P3',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'security@accenture.com',
    solution: 'Verificar perfil com LISTDSD. Adicionar ao grupo com CONNECT.'
  }
];

// Get actual column names from table
const columns = tableInfo.map(col => col.name);
const hasSuccessRate = columns.includes('success_rate');
const hasSolution = columns.includes('solution');

// Prepare insert based on actual schema
let insertSQL = `INSERT INTO entries (
  title, description, category, severity, priority,
  status, entry_type, reporter`;

if (hasSolution) insertSQL += ', solution';
insertSQL += `, created_at, updated_at
) VALUES (
  @title, @description, @category, @severity, @priority,
  @status, @entry_type, @reporter`;

if (hasSolution) insertSQL += ', @solution';
insertSQL += `, datetime('now'), datetime('now'))`;

const insertStmt = db.prepare(insertSQL);

// Insert all incidents
const insertMany = db.transaction((incidents) => {
  for (const incident of incidents) {
    const data = { ...incident };
    if (!hasSolution) delete data.solution;
    insertStmt.run(data);
  }
});

try {
  insertMany(incidents);
  console.log(`✅ Inserted ${incidents.length} incidents successfully!`);

  // Show summary
  const summary = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM entries
    WHERE entry_type IN ('incident', 'knowledge')
    GROUP BY status
    ORDER BY status
  `).all();

  console.log('\n📊 Database Summary:');
  summary.forEach(row => {
    console.log(`   ${row.status}: ${row.count} incidents`);
  });

  const total = db.prepare("SELECT COUNT(*) as total FROM entries").get();
  console.log(`\n📋 Total entries in database: ${total.total}`);

} catch (error) {
  console.error('❌ Error:', error.message);
}

db.close();