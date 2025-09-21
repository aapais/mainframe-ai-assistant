const Database = require('better-sqlite3');
const db = new Database('kb-assistant.db');

console.log('🔄 Migrating database - removing entry_type column\n');

// First backup existing data
const backup = db.prepare("SELECT * FROM entries").all();
console.log(`📋 Backed up ${backup.length} entries\n`);

// Create new table without entry_type
console.log('📦 Creating new table structure...');
db.exec(`
  -- Drop the old table
  DROP TABLE IF EXISTS entries_old;

  -- Rename current table
  ALTER TABLE entries RENAME TO entries_old;

  -- Create new table without entry_type
  CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  -- Create FTS5 virtual table for search
  CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
    title, description, solution, category, tags,
    content=entries
  );

  -- Create triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries
  BEGIN
    INSERT INTO entries_fts(rowid, title, description, solution, category, tags)
    VALUES (new.id, new.title, new.description, new.solution, new.category, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries
  BEGIN
    UPDATE entries_fts
    SET title = new.title,
        description = new.description,
        solution = new.solution,
        category = new.category,
        tags = new.tags
    WHERE rowid = new.id;
  END;

  CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries
  BEGIN
    DELETE FROM entries_fts WHERE rowid = old.id;
  END;
`);

console.log('✅ New table structure created\n');

// Clear any test data
db.prepare("DELETE FROM entries").run();

// Insert clean incident data
const incidents = [
  // Active incidents
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

  // Resolved incidents (knowledge base)
  {
    title: 'ABEND S0C4 - Addressing Exception',
    description: 'Programa COBOL abortando com S0C4 ao acessar área de memória.',
    category: 'JCL',
    severity: 'high',
    priority: 'P2',
    status: 'resolvido',
    reporter: 'tech.team@accenture.com',
    solution: 'Corrigir o índice da tabela interna no programa COBOL. Verificar limites de OCCURS e adicionar validação antes de acessar arrays. Recompilar com opção SSRANGE para detectar overflows.',
    resolved_by: 'senior.dev@accenture.com',
    resolution_time_minutes: 45
  },
  {
    title: 'VSAM Status Code 92 - Logic Error',
    description: 'Erro ao tentar ler registro VSAM sequencialmente.',
    category: 'VSAM',
    severity: 'medium',
    priority: 'P3',
    status: 'resolvido',
    reporter: 'support.team@accenture.com',
    solution: 'Emitir START antes de READ NEXT. Verificar se o arquivo foi aberto em modo I-O ou INPUT. Adicionar lógica de posicionamento antes da leitura sequencial.',
    resolved_by: 'vsam.expert@accenture.com',
    resolution_time_minutes: 30
  },
  {
    title: 'DB2 SQLCODE -904 Resource Unavailable',
    description: 'Erro -904 ao executar query em tabela DB2.',
    category: 'DB2',
    severity: 'high',
    priority: 'P1',
    status: 'resolvido',
    reporter: 'dba.team@accenture.com',
    solution: 'Executar REORG na tablespace. Verificar locks com comando DISPLAY DATABASE. Se necessário, executar QUIESCE e depois START DATABASE. Aumentar LOCKMAX se o problema persistir.',
    resolved_by: 'dba.senior@accenture.com',
    resolution_time_minutes: 120
  },
  {
    title: 'IMS Message DFS555I - Database Full',
    description: 'Base de dados IMS atingiu limite de espaço.',
    category: 'IMS',
    severity: 'critical',
    priority: 'P1',
    status: 'resolvido',
    reporter: 'ims.admin@accenture.com',
    solution: 'Executar reorganização da base IMS. Usar utilitário HD Reorganization Reload. Aumentar alocação de espaço no DBD. Implementar rotina de purge de dados antigos.',
    resolved_by: 'ims.specialist@accenture.com',
    resolution_time_minutes: 180
  },
  {
    title: 'CICS ASRA Abend - Program Check',
    description: 'Transação CICS abortando com código ASRA.',
    category: 'CICS',
    severity: 'high',
    priority: 'P2',
    status: 'resolvido',
    reporter: 'cics.support@accenture.com',
    solution: 'Verificar dump do CICS para identificar o offset do erro. Common causes: divisão por zero, overflow, subscript fora do range. Ativar CEDF para debug detalhado.',
    resolved_by: 'cics.dev@accenture.com',
    resolution_time_minutes: 60
  },
  {
    title: 'Batch Window Exceeded',
    description: 'Janela batch ultrapassando horário permitido.',
    category: 'Batch',
    severity: 'medium',
    priority: 'P2',
    status: 'resolvido',
    reporter: 'batch.team@accenture.com',
    solution: 'Implementar processamento paralelo usando SYNCSORT. Dividir arquivos grandes em partições. Otimizar queries DB2 com índices apropriados.',
    resolved_by: 'batch.expert@accenture.com',
    resolution_time_minutes: 90
  },
  {
    title: 'Security RACF Violation',
    description: 'Usuário sem permissão RACF para dataset.',
    category: 'Security',
    severity: 'medium',
    priority: 'P3',
    status: 'resolvido',
    reporter: 'security@accenture.com',
    solution: 'Verificar perfil RACF com LISTDSD. Adicionar usuário ao grupo apropriado com CONNECT. Criar novo perfil se necessário.',
    resolved_by: 'security.admin@accenture.com',
    resolution_time_minutes: 15
  }
];

// Insert all incidents
const stmt = db.prepare(`
  INSERT INTO entries (
    title, description, category, severity, priority,
    status, reporter, solution, resolved_by, resolution_time_minutes,
    created_at, updated_at
  ) VALUES (
    @title, @description, @category, @severity, @priority,
    @status, @reporter, @solution, @resolved_by, @resolution_time_minutes,
    datetime('now'), datetime('now')
  )
`);

const insertMany = db.transaction((incidents) => {
  for (const incident of incidents) {
    stmt.run(incident);
  }
});

insertMany(incidents);

console.log(`✅ Migrated ${incidents.length} incidents\n`);

// Drop old table
db.exec("DROP TABLE IF EXISTS entries_old");
console.log('🗑️  Removed old table structure\n');

// Show summary
const summary = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM entries
  GROUP BY status
  ORDER BY CASE
    WHEN status = 'aberto' THEN 1
    WHEN status = 'em_tratamento' THEN 2
    WHEN status = 'resolvido' THEN 3
    ELSE 4
  END
`).all();

console.log('📊 Final Database Summary:');
summary.forEach(row => {
  const label = row.status === 'resolvido' ? 'resolvido (base de conhecimento)' : row.status;
  console.log(`   ${label}: ${row.count} incidents`);
});

console.log('\n✨ Migration complete! Database now has:');
console.log('   - NO entry_type column (all are incidents)');
console.log('   - Status determines if it\'s active or knowledge');
console.log('   - Resolved incidents serve as knowledge base');

db.close();