#!/usr/bin/env python3

import sqlite3
import os
from datetime import datetime

print("🚀 Executando migração para tabela unificada...")
print("=" * 50)

# Path para o banco de dados
db_path = os.path.join(os.path.dirname(__file__), '..', 'kb-assistant.db')

# Conectar ao banco
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Verificar tabelas existentes
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = [row[0] for row in cursor.fetchall()]

    print(f"\n📋 Tabelas existentes: {', '.join(existing_tables)}")

    # Verificar se já foi migrado
    if 'entries' in existing_tables:
        print("\n✅ Tabela 'entries' já existe. Verificando dados...")
        cursor.execute("SELECT COUNT(*) as total, entry_type FROM entries GROUP BY entry_type")
        results = cursor.fetchall()

        if results:
            print("\n📊 Dados na tabela unificada:")
            for row in results:
                print(f"   - {row[1]}: {row[0]} registros")
        else:
            print("   - Tabela vazia")

        print("\n⚠️  Migração já foi executada anteriormente.")
    else:
        print("\n🔧 Iniciando migração...")

        # Backup das tabelas originais
        if 'kb_entries' in existing_tables:
            print("   - Fazendo backup de kb_entries...")
            cursor.execute("ALTER TABLE kb_entries RENAME TO kb_entries_backup")

        if 'incidents' in existing_tables:
            print("   - Fazendo backup de incidents...")
            cursor.execute("ALTER TABLE incidents RENAME TO incidents_backup")

        # Criar nova tabela unificada
        print("   - Criando tabela unificada 'entries'...")
        cursor.execute("""
        CREATE TABLE entries (
            id TEXT PRIMARY KEY,
            entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')),
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            solution TEXT,
            category TEXT NOT NULL,
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_by TEXT,
            severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')),
            status TEXT CHECK(status IN ('aberto', 'em_tratamento', 'resolvido', 'fechado', 'em_revisao')),
            priority TEXT CHECK(priority IN ('P1', 'P2', 'P3', 'P4')),
            assigned_to TEXT,
            resolved_by TEXT,
            resolution_time_minutes INTEGER,
            sla_deadline DATETIME,
            escalation_level TEXT,
            incident_number TEXT,
            reporter TEXT,
            usage_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0,
            version INTEGER DEFAULT 1,
            verified BOOLEAN DEFAULT 0,
            ai_suggested BOOLEAN DEFAULT 0,
            ai_confidence_score REAL,
            metadata TEXT,
            is_knowledge_base INTEGER GENERATED ALWAYS AS (CASE WHEN entry_type = 'knowledge' THEN 1 ELSE 0 END) STORED,
            is_incident INTEGER GENERATED ALWAYS AS (CASE WHEN entry_type = 'incident' THEN 1 ELSE 0 END) STORED
        )
        """)

        # Criar índices
        print("   - Criando índices...")
        indices = [
            "CREATE INDEX idx_entries_type ON entries(entry_type)",
            "CREATE INDEX idx_entries_category ON entries(category)",
            "CREATE INDEX idx_entries_status ON entries(status) WHERE status IS NOT NULL",
            "CREATE INDEX idx_entries_priority ON entries(priority) WHERE priority IS NOT NULL",
            "CREATE INDEX idx_entries_assigned ON entries(assigned_to) WHERE assigned_to IS NOT NULL",
            "CREATE INDEX idx_entries_created ON entries(created_at)",
            "CREATE INDEX idx_entries_updated ON entries(updated_at)"
        ]

        for idx in indices:
            cursor.execute(idx)

        # Migrar dados de kb_entries_backup
        if 'kb_entries_backup' in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()[0]:
            print("   - Migrando dados de kb_entries...")
            cursor.execute("""
            INSERT OR IGNORE INTO entries (
                id, entry_type, title, description, solution, category, tags,
                created_at, updated_at, created_by, severity
            )
            SELECT
                id, 'knowledge', title,
                COALESCE(problem, description, ''),
                solution, category, tags,
                created_at, updated_at, created_by, severity
            FROM kb_entries_backup
            """)
            kb_count = cursor.rowcount
            print(f"     ✓ {kb_count} registros de knowledge base migrados")

        # Migrar dados de incidents_backup
        if 'incidents_backup' in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()[0]:
            print("   - Migrando dados de incidents...")
            cursor.execute("""
            INSERT OR IGNORE INTO entries (
                id, entry_type, title, description, solution, category, tags,
                created_at, updated_at, created_by, severity,
                status, priority, assigned_to, resolved_by
            )
            SELECT
                id, 'incident', title,
                COALESCE(description, problem, ''),
                resolution, category, tags,
                created_at, updated_at, created_by, severity,
                status, priority, assigned_to, resolved_by
            FROM incidents_backup
            """)
            inc_count = cursor.rowcount
            print(f"     ✓ {inc_count} registros de incidentes migrados")

        # Criar views de compatibilidade
        print("   - Criando views de compatibilidade...")

        cursor.execute("""
        CREATE VIEW IF NOT EXISTS kb_entries AS
        SELECT
            id, title, description as problem, solution, category, tags,
            created_at, updated_at, created_by, severity,
            usage_count, success_count, failure_count, version
        FROM entries
        WHERE entry_type = 'knowledge'
        """)

        cursor.execute("""
        CREATE VIEW IF NOT EXISTS incidents AS
        SELECT
            id, title, description, solution as resolution, category, tags,
            created_at, updated_at, created_by, severity,
            status, priority, assigned_to, resolved_by,
            resolution_time_minutes as resolution_time, sla_deadline, reporter
        FROM entries
        WHERE entry_type = 'incident'
        """)

        print("\n✅ Migração concluída com sucesso!")

        # Verificar resultados
        cursor.execute("SELECT COUNT(*) as total, entry_type FROM entries GROUP BY entry_type")
        results = cursor.fetchall()

        print("\n📊 Resumo da migração:")
        total = 0
        for row in results:
            print(f"   - {row[1]}: {row[0]} registros")
            total += row[0]
        print(f"   - TOTAL: {total} registros")

    # Limpar tabelas antigas desnecessárias
    print("\n🧹 Limpando tabelas desnecessárias...")

    # Lista de tabelas antigas que podem ser removidas após migração bem-sucedida
    tables_to_remove = [
        'kb_entries_old', 'incidents_old',
        'kb_entries_temp', 'incidents_temp',
        'kb_entry_related'  # Tabela de relações antiga se existir
    ]

    for table in tables_to_remove:
        if table in existing_tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
            print(f"   - Removida tabela: {table}")

    # Commit das mudanças
    conn.commit()

    # VACUUM para otimizar o banco
    print("\n🔧 Otimizando banco de dados...")
    conn.execute("VACUUM")

    print("\n✨ Processo completo! Banco de dados unificado e otimizado.")

except Exception as e:
    print(f"\n❌ Erro durante a migração: {e}")
    conn.rollback()

finally:
    # Fechar conexão
    conn.close()

print("\n" + "=" * 50)
print("🎉 Migração finalizada!")