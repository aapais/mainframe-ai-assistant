const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('🔧 Fixing database - all entries should be incidents\n');

// First, update all entries to be type 'incident'
const updateType = db.prepare("UPDATE entries SET entry_type = 'incident' WHERE entry_type IS NOT NULL");
const result = updateType.run();
console.log(`✅ Updated ${result.changes} entries to type 'incident'\n`);

// Clear and re-insert clean data
db.prepare("DELETE FROM entries").run();
console.log('🗑️  Cleared all entries\n');

// All are incidents, some resolved (serve as knowledge base)
const incidents = [
  // Active incidents (problems to solve)
  {
    title: 'JCL Error - Job PAYROLL01 Abended',
    description: 'Job PAYROLL01 está a abortar com ABEND S0C7 no step CALC. Erro de data inválida no processamento.',
    category: 'JCL',
    severity: 'high',
    priority: 'P1',
    status: 'aberto',
    reporter: 'joao.silva@accenture.com',
    solution: null
  },
  {
    title: 'VSAM File Corruption - Customer Master',
    description: 'Arquivo VSAM CUSTMAST apresentando erro de I/O. Possível corrupção após backup incompleto.',
    category: 'VSAM',
    severity: 'critical',
    priority: 'P1',
    status: 'em_tratamento',
    reporter: 'maria.santos@accenture.com',
    solution: null
  },
  {
    title: 'DB2 Connection Pool Exhausted',
    description: 'Aplicação CICS não consegue conectar ao DB2. Pool de conexões esgotado durante pico de transações.',
    category: 'DB2',
    severity: 'high',
    priority: 'P2',
    status: 'aberto',
    reporter: 'pedro.costa@accenture.com',
    solution: null
  },
  {
    title: 'Batch Job Performance Degradation',
    description: 'Jobs batch noturnos a demorar 3x mais que o normal. Impacto na janela batch.',
    category: 'Batch',
    severity: 'medium',
    priority: 'P2',
    status: 'em_tratamento',
    reporter: 'ana.ferreira@accenture.com',
    solution: null
  },
  {
    title: 'CICS Transaction Timeout',
    description: 'Transação TRN001 em timeout após 30 segundos. Usuários relatam lentidão no sistema.',
    category: 'CICS',
    severity: 'medium',
    priority: 'P3',
    status: 'aberto',
    reporter: 'carlos.oliveira@accenture.com',
    solution: null
  },

  // Resolved incidents (these serve as knowledge base)
  {
    title: 'ABEND S0C4 - Addressing Exception',
    description: 'Programa COBOL abortando com S0C4 ao acessar área de memória.',
    category: 'JCL',
    severity: 'high',
    priority: 'P2',
    status: 'resolvido',
    reporter: 'tech.team@accenture.com',
    solution: 'Corrigir o índice da tabela interna no programa COBOL. Verificar limites de OCCURS e adicionar validação antes de acessar arrays. Recompilar com opção SSRANGE para detectar overflows.'
  },
  {
    title: 'VSAM Status Code 92 - Logic Error',
    description: 'Erro ao tentar ler registro VSAM sequencialmente.',
    category: 'VSAM',
    severity: 'medium',
    priority: 'P3',
    status: 'resolvido',
    reporter: 'support.team@accenture.com',
    solution: 'Emitir START antes de READ NEXT. Verificar se o arquivo foi aberto em modo I-O ou INPUT. Adicionar lógica de posicionamento antes da leitura sequencial.'
  },
  {
    title: 'DB2 SQLCODE -904 Resource Unavailable',
    description: 'Erro -904 ao executar query em tabela DB2.',
    category: 'DB2',
    severity: 'high',
    priority: 'P1',
    status: 'resolvido',
    reporter: 'dba.team@accenture.com',
    solution: 'Executar REORG na tablespace. Verificar locks com comando DISPLAY DATABASE. Se necessário, executar QUIESCE e depois START DATABASE. Aumentar LOCKMAX se o problema persistir.'
  },
  {
    title: 'IMS Message DFS555I - Database Full',
    description: 'Base de dados IMS atingiu limite de espaço.',
    category: 'IMS',
    severity: 'critical',
    priority: 'P1',
    status: 'resolvido',
    reporter: 'ims.admin@accenture.com',
    solution: 'Executar reorganização da base IMS. Usar utilitário HD Reorganization Reload. Aumentar alocação de espaço no DBD. Implementar rotina de purge de dados antigos.'
  },
  {
    title: 'JCL DD Statement Missing',
    description: 'Job abortando por falta de DD statement.',
    category: 'JCL',
    severity: 'low',
    priority: 'P4',
    status: 'resolvido',
    reporter: 'operations@accenture.com',
    solution: 'Adicionar DD statement faltante no JCL. Verificar todos os arquivos referenciados no programa. Usar TYPRUN=SCAN para validar JCL antes da execução.'
  },
  {
    title: 'CICS ASRA Abend - Program Check',
    description: 'Transação CICS abortando com código ASRA.',
    category: 'CICS',
    severity: 'high',
    priority: 'P2',
    status: 'resolvido',
    reporter: 'cics.support@accenture.com',
    solution: 'Verificar dump do CICS para identificar o offset do erro. Common causes: divisão por zero, overflow, subscript fora do range. Ativar CEDF para debug detalhado.'
  },
  {
    title: 'Batch Window Exceeded',
    description: 'Janela batch ultrapassando horário permitido.',
    category: 'Batch',
    severity: 'medium',
    priority: 'P2',
    status: 'resolvido',
    reporter: 'batch.team@accenture.com',
    solution: 'Implementar processamento paralelo usando SYNCSORT. Dividir arquivos grandes em partições. Otimizar queries DB2 com índices apropriados. Considerar uso de in-memory tables.'
  }
];

// Insert all as incidents
const stmt = db.prepare(`
  INSERT INTO entries (
    entry_type, title, description, category, severity, priority,
    status, reporter, solution, created_at, updated_at
  ) VALUES (
    'incident', @title, @description, @category, @severity, @priority,
    @status, @reporter, @solution, datetime('now'), datetime('now')
  )
`);

const insertMany = db.transaction((incidents) => {
  for (const incident of incidents) {
    stmt.run(incident);
  }
});

insertMany(incidents);

console.log(`✅ Inserted ${incidents.length} incidents\n`);

// Show summary
const summary = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM entries
  WHERE entry_type = 'incident'
  GROUP BY status
  ORDER BY CASE
    WHEN status = 'aberto' THEN 1
    WHEN status = 'em_tratamento' THEN 2
    WHEN status = 'resolvido' THEN 3
    ELSE 4
  END
`).all();

console.log('📊 Database Summary:');
summary.forEach(row => {
  const label = row.status === 'resolvido' ? 'resolvido (conhecimento)' : row.status;
  console.log(`   ${label}: ${row.count} incidents`);
});

const total = db.prepare("SELECT COUNT(*) as total FROM entries").get();
console.log(`\n📋 Total incidents: ${total.total}`);
console.log('   - Active (aberto/em_tratamento): problemas a resolver');
console.log('   - Resolved: base de conhecimento para consulta');

db.close();