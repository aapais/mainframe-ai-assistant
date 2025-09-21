const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const db = new Database(path.join(__dirname, 'kb-assistant.db'));

// Clear existing test data
db.prepare("DELETE FROM entries WHERE entry_type = 'incident'").run();

// Sample incidents data
const incidents = [
  // Active incidents (Open/In Progress)
  {
    title: 'JCL Error - Job PAYROLL01 Abended',
    description: 'Job PAYROLL01 está a abortar com ABEND S0C7 no step CALC. Erro de data inválida no processamento.',
    category: 'JCL',
    severity: 'high',
    priority: 'P1',
    status: 'aberto',
    entry_type: 'incident',
    reporter: 'joao.silva@accenture.com',
    solution: null,
    success_rate: null
  },
  {
    title: 'VSAM File Corruption - Customer Master',
    description: 'Arquivo VSAM CUSTMAST apresentando erro de I/O. Possível corrupção após backup incompleto.',
    category: 'VSAM',
    severity: 'critical',
    priority: 'P1',
    status: 'em_tratamento',
    entry_type: 'incident',
    reporter: 'maria.santos@accenture.com',
    solution: null,
    success_rate: null
  },
  {
    title: 'DB2 Connection Pool Exhausted',
    description: 'Aplicação CICS não consegue conectar ao DB2. Pool de conexões esgotado durante pico de transações.',
    category: 'DB2',
    severity: 'high',
    priority: 'P2',
    status: 'aberto',
    entry_type: 'incident',
    reporter: 'pedro.costa@accenture.com',
    solution: null,
    success_rate: null
  },
  {
    title: 'Batch Job Performance Degradation',
    description: 'Jobs batch noturnos a demorar 3x mais que o normal. Impacto na janela batch.',
    category: 'Batch',
    severity: 'medium',
    priority: 'P2',
    status: 'em_tratamento',
    entry_type: 'incident',
    reporter: 'ana.ferreira@accenture.com',
    solution: null,
    success_rate: null
  },
  {
    title: 'CICS Transaction Timeout',
    description: 'Transação TRN001 em timeout após 30 segundos. Usuários relatam lentidão no sistema.',
    category: 'CICS',
    severity: 'medium',
    priority: 'P3',
    status: 'aberto',
    entry_type: 'incident',
    reporter: 'carlos.oliveira@accenture.com',
    solution: null,
    success_rate: null
  },

  // Resolved incidents (Knowledge Base)
  {
    title: 'ABEND S0C4 - Addressing Exception',
    description: 'Programa COBOL abortando com S0C4 ao acessar área de memória.',
    category: 'JCL',
    severity: 'high',
    priority: 'P2',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'tech.team@accenture.com',
    solution: 'Corrigir o índice da tabela interna no programa COBOL. Verificar limites de OCCURS e adicionar validação antes de acessar arrays. Recompilar com opção SSRANGE para detectar overflows.',
    success_rate: 95
  },
  {
    title: 'VSAM Status Code 92 - Logic Error',
    description: 'Erro ao tentar ler registro VSAM sequencialmente.',
    category: 'VSAM',
    severity: 'medium',
    priority: 'P3',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'support.team@accenture.com',
    solution: 'Emitir START antes de READ NEXT. Verificar se o arquivo foi aberto em modo I-O ou INPUT. Adicionar lógica de posicionamento antes da leitura sequencial.',
    success_rate: 88
  },
  {
    title: 'DB2 SQLCODE -904 Resource Unavailable',
    description: 'Erro -904 ao executar query em tabela DB2.',
    category: 'DB2',
    severity: 'high',
    priority: 'P1',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'dba.team@accenture.com',
    solution: 'Executar REORG na tablespace. Verificar locks com comando DISPLAY DATABASE. Se necessário, executar QUIESCE e depois START DATABASE. Aumentar LOCKMAX se o problema persistir.',
    success_rate: 92
  },
  {
    title: 'IMS Message DFS555I - Database Full',
    description: 'Base de dados IMS atingiu limite de espaço.',
    category: 'IMS',
    severity: 'critical',
    priority: 'P1',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'ims.admin@accenture.com',
    solution: 'Executar reorganização da base IMS. Usar utilitário HD Reorganization Reload. Aumentar alocação de espaço no DBD. Implementar rotina de purge de dados antigos.',
    success_rate: 90
  },
  {
    title: 'JCL DD Statement Missing',
    description: 'Job abortando por falta de DD statement.',
    category: 'JCL',
    severity: 'low',
    priority: 'P4',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'operations@accenture.com',
    solution: 'Adicionar DD statement faltante no JCL. Verificar todos os arquivos referenciados no programa. Usar TYPRUN=SCAN para validar JCL antes da execução.',
    success_rate: 98
  },
  {
    title: 'CICS ASRA Abend - Program Check',
    description: 'Transação CICS abortando com código ASRA.',
    category: 'CICS',
    severity: 'high',
    priority: 'P2',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'cics.support@accenture.com',
    solution: 'Verificar dump do CICS para identificar o offset do erro. Common causes: divisão por zero, overflow, subscript fora do range. Ativar CEDF para debug detalhado.',
    success_rate: 85
  },
  {
    title: 'Batch Window Exceeded',
    description: 'Janela batch ultrapassando horário permitido.',
    category: 'Batch',
    severity: 'medium',
    priority: 'P2',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'batch.team@accenture.com',
    solution: 'Implementar processamento paralelo usando SYNCSORT. Dividir arquivos grandes em partições. Otimizar queries DB2 com índices apropriados. Considerar uso de in-memory tables.',
    success_rate: 87
  },
  {
    title: 'Security Violation - RACF',
    description: 'Usuário sem permissão RACF para dataset.',
    category: 'Security',
    severity: 'medium',
    priority: 'P3',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'security@accenture.com',
    solution: 'Verificar perfil RACF com LISTDSD. Adicionar usuário ao grupo apropriado com CONNECT. Se necessário, criar novo perfil com ADDSD. Sempre seguir processo de aprovação de segurança.',
    success_rate: 96
  },
  {
    title: 'Network Timeout - FTP Transfer',
    description: 'Transferências FTP falhando por timeout.',
    category: 'Network',
    severity: 'low',
    priority: 'P4',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'network.ops@accenture.com',
    solution: 'Aumentar timeout no cliente FTP para 300 segundos. Verificar MTU size. Para arquivos grandes, usar modo binário e considerar compressão. Implementar restart/checkpoint para transferências longas.',
    success_rate: 91
  },
  {
    title: 'VSAM VERIFY Error',
    description: 'Arquivo VSAM precisa ser verificado após shutdown anormal.',
    category: 'VSAM',
    severity: 'medium',
    priority: 'P3',
    status: 'resolvido',
    entry_type: 'knowledge',
    reporter: 'storage.admin@accenture.com',
    solution: 'Executar IDCAMS VERIFY no dataset. Se falhar, usar EXPORT/IMPORT para reconstruir. Sempre fazer backup antes. Implementar procedimento automático de VERIFY no startup.',
    success_rate: 89
  }
];

// Prepare insert statement
const insertStmt = db.prepare(`
  INSERT INTO entries (
    title, description, category, severity, priority,
    status, entry_type, reporter, solution, success_rate,
    created_at, updated_at
  ) VALUES (
    @title, @description, @category, @severity, @priority,
    @status, @entry_type, @reporter, @solution, @success_rate,
    datetime('now'), datetime('now')
  )
`);

// Insert all incidents
const insertMany = db.transaction((incidents) => {
  for (const incident of incidents) {
    insertStmt.run(incident);
  }
});

try {
  insertMany(incidents);
  console.log(`✅ Inserted ${incidents.length} sample incidents/knowledge entries successfully!`);

  // Show summary
  const summary = db.prepare(`
    SELECT
      entry_type,
      status,
      COUNT(*) as count
    FROM entries
    WHERE entry_type IN ('incident', 'knowledge')
    GROUP BY entry_type, status
  `).all();

  console.log('\n📊 Database Summary:');
  summary.forEach(row => {
    console.log(`   ${row.entry_type} (${row.status}): ${row.count}`);
  });

  const total = db.prepare("SELECT COUNT(*) as total FROM entries WHERE entry_type IN ('incident', 'knowledge')").get();
  console.log(`\n📋 Total entries: ${total.total}`);

} catch (error) {
  console.error('❌ Error inserting data:', error);
}

db.close();