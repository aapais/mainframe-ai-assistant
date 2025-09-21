#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Executando migração para tabela unificada...\n');

// Criar schema SQL inline para evitar dependências
const unifiedSchema = `
-- ============================================
-- MIGRAÇÃO PARA TABELA UNIFICADA
-- ============================================

-- 1. Criar backup das tabelas existentes (se existirem)
DROP TABLE IF EXISTS kb_entries_backup;
DROP TABLE IF EXISTS incidents_backup;

-- Renomear tabelas originais para backup (se existirem)
ALTER TABLE kb_entries RENAME TO kb_entries_backup;
ALTER TABLE incidents RENAME TO incidents_backup;

-- 2. Criar nova tabela unificada
DROP TABLE IF EXISTS entries;
CREATE TABLE entries (
    -- Campos base
    id TEXT PRIMARY KEY,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    solution TEXT,
    category TEXT NOT NULL,
    tags TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,

    -- Campos comuns
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')),

    -- Campos específicos de incidente (NULL para KB)
    status TEXT CHECK(status IN ('aberto', 'em_tratamento', 'resolvido', 'fechado', 'em_revisao')),
    priority TEXT CHECK(priority IN ('P1', 'P2', 'P3', 'P4')),
    assigned_to TEXT,
    resolved_by TEXT,
    resolution_time_minutes INTEGER,
    sla_deadline DATETIME,
    escalation_level TEXT,
    incident_number TEXT,
    reporter TEXT,

    -- Campos específicos de KB (NULL para incidentes)
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    verified BOOLEAN DEFAULT 0,

    -- Campos AI
    ai_suggested BOOLEAN DEFAULT 0,
    ai_confidence_score REAL,

    -- Metadados JSON
    metadata TEXT, -- JSON field

    -- Campos computados
    is_knowledge_base INTEGER GENERATED ALWAYS AS (CASE WHEN entry_type = 'knowledge' THEN 1 ELSE 0 END) STORED,
    is_incident INTEGER GENERATED ALWAYS AS (CASE WHEN entry_type = 'incident' THEN 1 ELSE 0 END) STORED
);

-- 3. Criar índices para performance
CREATE INDEX idx_entries_type ON entries(entry_type);
CREATE INDEX idx_entries_category ON entries(category);
CREATE INDEX idx_entries_status ON entries(status) WHERE status IS NOT NULL;
CREATE INDEX idx_entries_priority ON entries(priority) WHERE priority IS NOT NULL;
CREATE INDEX idx_entries_assigned ON entries(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_entries_created ON entries(created_at);
CREATE INDEX idx_entries_updated ON entries(updated_at);
CREATE INDEX idx_entries_type_category ON entries(entry_type, category);
CREATE INDEX idx_entries_kb ON entries(entry_type) WHERE entry_type = 'knowledge';
CREATE INDEX idx_entries_inc ON entries(entry_type) WHERE entry_type = 'incident';

-- 4. Migrar dados da kb_entries_backup (se existir)
INSERT OR IGNORE INTO entries (
    id, entry_type, title, description, solution, category, tags,
    created_at, updated_at, created_by,
    severity, usage_count, success_count, failure_count, version
)
SELECT
    id,
    'knowledge' as entry_type,
    title,
    COALESCE(problem, description, '') as description,
    solution,
    category,
    tags,
    created_at,
    updated_at,
    created_by,
    severity,
    COALESCE(usage_count, 0),
    COALESCE(success_count, 0),
    COALESCE(failure_count, 0),
    COALESCE(version, 1)
FROM kb_entries_backup
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='kb_entries_backup');

-- 5. Migrar dados da incidents_backup (se existir)
INSERT OR IGNORE INTO entries (
    id, entry_type, title, description, solution, category, tags,
    created_at, updated_at, created_by,
    severity, status, priority, assigned_to, resolved_by,
    resolution_time_minutes, sla_deadline, reporter
)
SELECT
    id,
    'incident' as entry_type,
    title,
    COALESCE(description, problem, '') as description,
    resolution as solution,
    category,
    tags,
    created_at,
    updated_at,
    created_by,
    severity,
    status,
    priority,
    assigned_to,
    resolved_by,
    resolution_time,
    sla_deadline,
    reporter
FROM incidents_backup
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='incidents_backup');

-- 6. Criar views de compatibilidade
DROP VIEW IF EXISTS kb_entries;
CREATE VIEW kb_entries AS
SELECT
    id, title, description as problem, solution, category, tags,
    created_at, updated_at, created_by,
    severity, usage_count, success_count, failure_count, version
FROM entries
WHERE entry_type = 'knowledge';

DROP VIEW IF EXISTS incidents;
CREATE VIEW incidents AS
SELECT
    id, title, description, solution as resolution, category, tags,
    created_at, updated_at, created_by,
    severity, status, priority, assigned_to, resolved_by,
    resolution_time_minutes as resolution_time, sla_deadline, reporter
FROM entries
WHERE entry_type = 'incident';

-- 7. Criar FTS5 para pesquisa unificada
DROP TABLE IF EXISTS entries_fts;
CREATE VIRTUAL TABLE entries_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    solution,
    tags,
    tokenize = 'porter unicode61'
);

-- Popullar FTS5
INSERT INTO entries_fts (id, title, description, solution, tags)
SELECT id, title, description, solution, tags FROM entries;

-- 8. Criar trigger para manter FTS5 atualizado
CREATE TRIGGER entries_fts_insert AFTER INSERT ON entries
BEGIN
    INSERT INTO entries_fts (id, title, description, solution, tags)
    VALUES (new.id, new.title, new.description, new.solution, new.tags);
END;

CREATE TRIGGER entries_fts_update AFTER UPDATE ON entries
BEGIN
    UPDATE entries_fts
    SET title = new.title, description = new.description,
        solution = new.solution, tags = new.tags
    WHERE id = new.id;
END;

CREATE TRIGGER entries_fts_delete AFTER DELETE ON entries
BEGIN
    DELETE FROM entries_fts WHERE id = old.id;
END;

-- 9. Limpar tabelas antigas (após verificação)
DROP TABLE IF EXISTS kb_entries_old;
DROP TABLE IF EXISTS incidents_old;

-- 10. Vacuum para otimizar o banco
VACUUM;
`;

// Escrever arquivo SQL
const sqlPath = path.join(__dirname, '..', 'migration-unified.sql');
fs.writeFileSync(sqlPath, unifiedSchema);

console.log('✅ Script SQL criado: migration-unified.sql');
console.log('\n📋 Para executar a migração:');
console.log('   1. Via SQLite3: sqlite3 kb-assistant.db < scripts/migration-unified.sql');
console.log('   2. Via aplicação: A migração será aplicada automaticamente ao iniciar');
console.log('\n⚠️  IMPORTANTE: Faça backup do banco antes de migrar!');

// Tentar executar se tivermos sqlite3
const { exec } = require('child_process');

exec('which sqlite3', (error) => {
    if (!error) {
        console.log('\n🔧 SQLite3 detectado. Executando migração...');
        exec(`sqlite3 kb-assistant.db < ${sqlPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Erro na migração:', error.message);
            } else {
                console.log('✅ Migração executada com sucesso!');

                // Verificar resultados
                exec('sqlite3 kb-assistant.db "SELECT COUNT(*) as total, entry_type FROM entries GROUP BY entry_type"', (err, out) => {
                    if (!err && out) {
                        console.log('\n📊 Dados migrados:');
                        console.log(out);
                    }
                });

                // Listar tabelas
                exec('sqlite3 kb-assistant.db ".tables"', (err, out) => {
                    if (!err && out) {
                        console.log('\n📁 Tabelas no banco:');
                        console.log(out);
                    }
                });
            }
        });
    } else {
        console.log('\n⚠️  SQLite3 não encontrado. Execute manualmente ou instale com: apt-get install sqlite3');
    }
});