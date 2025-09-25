-- Basic PostgreSQL schema for Mainframe AI Assistant
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS incidents_enhanced CASCADE;

-- Incidents table
CREATE TABLE incidents_enhanced (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    technical_area VARCHAR(50) NOT NULL DEFAULT 'General',
    business_area VARCHAR(50),
    status VARCHAR(20) DEFAULT 'OPEN',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    severity VARCHAR(20) DEFAULT 'MEDIUM',
    assigned_to VARCHAR(100),
    reporter VARCHAR(100),
    resolution TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Knowledge base table
CREATE TABLE knowledge_base (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category VARCHAR(50) DEFAULT 'General',
    confidence_score DECIMAL(3,2) DEFAULT 0.9,
    source VARCHAR(100) DEFAULT 'manual',
    last_used_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create basic indexes
CREATE INDEX idx_incidents_status ON incidents_enhanced(status);
CREATE INDEX idx_incidents_priority ON incidents_enhanced(priority);
CREATE INDEX idx_incidents_created ON incidents_enhanced(created_at DESC);
CREATE INDEX idx_kb_category ON knowledge_base(category);
CREATE INDEX idx_kb_created ON knowledge_base(created_at DESC);

-- Insert some sample data for testing
INSERT INTO incidents_enhanced (title, description, technical_area, status, priority, severity, reporter)
VALUES
('Sistema de Login não funciona', 'Usuários não conseguem fazer login no sistema mainframe', 'CICS', 'OPEN', 'HIGH', 'CRITICAL', 'admin'),
('Performance lenta em batch job', 'O job BATCH001 está demorando 3x mais que o normal', 'JCL', 'OPEN', 'MEDIUM', 'MEDIUM', 'operator'),
('Erro no relatório mensal', 'Relatório de faturamento com valores incorretos', 'COBOL', 'RESOLVED', 'HIGH', 'HIGH', 'analyst');

INSERT INTO knowledge_base (title, content, summary, category, source)
VALUES
('Resolução de problemas CICS', 'Passos para diagnosticar problemas comuns no CICS...', 'Guia de troubleshooting CICS', 'CICS', 'documentation'),
('Otimização de JCL', 'Melhores práticas para otimizar jobs JCL...', 'Técnicas de otimização JCL', 'JCL', 'best-practices'),
('Comandos úteis TSO', 'Lista de comandos TSO mais utilizados...', 'Referência rápida TSO', 'TSO', 'reference');