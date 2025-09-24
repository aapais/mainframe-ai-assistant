-- AI Incident Resolution System - Database Initialization
-- PostgreSQL Schema and Initial Data

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS incident_system;
CREATE SCHEMA IF NOT EXISTS audit_system;
CREATE SCHEMA IF NOT EXISTS ml_system;

-- Set search path
SET search_path TO incident_system, public;

-- =============================================
-- CORE TABLES
-- =============================================

-- Business Areas (Áreas de Negócio Bancário)
CREATE TABLE business_areas (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES business_areas(id),
    priority INTEGER DEFAULT 3,
    sla_hours INTEGER DEFAULT 24,
    contact_group VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Technology Areas (Áreas Tecnológicas)
CREATE TABLE technology_areas (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    keywords TEXT[],
    patterns TEXT[],
    priority INTEGER DEFAULT 3,
    sla_hours INTEGER DEFAULT 8,
    tech_lead VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Application Modules (Módulos de Aplicação)
CREATE TABLE application_modules (
    id SERIAL PRIMARY KEY,
    business_area_id INTEGER REFERENCES business_areas(id),
    technology_area_id INTEGER REFERENCES technology_areas(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    criticality VARCHAR(20) DEFAULT 'medium',
    owner_team VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Incidents (Incidentes)
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    description_masked TEXT, -- Versão mascarada para IA
    business_area_id INTEGER REFERENCES business_areas(id),
    technology_area_id INTEGER REFERENCES technology_areas(id),
    application_module_id INTEGER REFERENCES application_modules(id),
    severity VARCHAR(20) DEFAULT 'medium',
    priority INTEGER DEFAULT 3,
    status VARCHAR(50) DEFAULT 'new',
    assigned_to VARCHAR(100),
    reporter VARCHAR(100) NOT NULL,
    environment VARCHAR(20) DEFAULT 'production',
    affected_systems TEXT[],
    impact_description TEXT,
    workaround TEXT,
    resolution_summary TEXT,
    root_cause TEXT,
    prevention_measures TEXT,
    tags TEXT[],
    category_confidence DECIMAL(3,2),
    ai_analysis JSONB,
    similar_incidents UUID[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP
);

-- Knowledge Base (Base de Conhecimento)
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- text, faq, procedure, solution
    business_area_id INTEGER REFERENCES business_areas(id),
    technology_area_id INTEGER REFERENCES technology_areas(id),
    application_module_id INTEGER REFERENCES application_modules(id),
    tags TEXT[],
    keywords TEXT[],
    source_incident_id UUID REFERENCES incidents(id),
    author VARCHAR(100) NOT NULL,
    approver VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft', -- draft, approved, archived
    version INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP
);

-- Incident Resolution Steps (Passos de Resolução)
CREATE TABLE incident_resolution_steps (
    id SERIAL PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    performed_by VARCHAR(100) NOT NULL,
    duration_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, skipped
    result TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- AI Suggestions (Sugestões de IA)
CREATE TABLE ai_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(50) NOT NULL, -- resolution, category, escalation, knowledge
    content TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    source_type VARCHAR(50), -- similar_incident, knowledge_base, pattern_analysis
    source_id UUID,
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    prompt_template VARCHAR(100),
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    accepted BOOLEAN,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    feedback_at TIMESTAMP
);

-- =============================================
-- VECTOR STORAGE METADATA
-- =============================================

-- Vector Embeddings Metadata
CREATE TABLE vector_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- incident, knowledge, pattern
    entity_id UUID NOT NULL,
    vector_collection VARCHAR(100) NOT NULL,
    vector_id VARCHAR(100) NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    dimensions INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(entity_type, entity_id, vector_collection)
);

-- =============================================
-- AUDIT TABLES
-- =============================================

-- Audit Log (Sistema de Auditoria)
CREATE TABLE audit_system.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- create, update, delete, view, search
    user_id VARCHAR(100) NOT NULL,
    user_role VARCHAR(50),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    compliance_flags TEXT[], -- LGPD, SOX, BACEN
    data_sensitivity VARCHAR(20), -- public, internal, confidential, restricted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Masking Log
CREATE TABLE audit_system.data_masking_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    masking_strategy VARCHAR(50) NOT NULL,
    original_hash VARCHAR(64), -- Hash do valor original para auditoria
    masked_preview VARCHAR(50), -- Prévia do valor mascarado
    user_id VARCHAR(100) NOT NULL,
    is_reversible BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ML/AI TABLES
-- =============================================

-- ML Models and Training Data
CREATE TABLE ml_system.classification_models (
    id SERIAL PRIMARY KEY,
    model_type VARCHAR(50) NOT NULL, -- category_classifier, priority_predictor
    model_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    accuracy DECIMAL(4,3),
    precision_score DECIMAL(4,3),
    recall_score DECIMAL(4,3),
    f1_score DECIMAL(4,3),
    training_data_size INTEGER,
    model_file_path VARCHAR(500),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP
);

-- Feedback Collection
CREATE TABLE ml_system.feedback_collection (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID REFERENCES incidents(id),
    suggestion_id UUID REFERENCES ai_suggestions(id),
    feedback_type VARCHAR(50) NOT NULL, -- accuracy, usefulness, completeness
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    user_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- A/B Testing
CREATE TABLE ml_system.ab_testing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_name VARCHAR(100) NOT NULL,
    variant VARCHAR(50) NOT NULL, -- A, B, control
    incident_id UUID REFERENCES incidents(id),
    configuration JSONB,
    metrics JSONB,
    user_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Incidents indexes
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_business_area ON incidents(business_area_id);
CREATE INDEX idx_incidents_technology_area ON incidents(technology_area_id);
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
CREATE INDEX idx_incidents_assigned_to ON incidents(assigned_to);
CREATE INDEX idx_incidents_tags ON incidents USING GIN(tags);
CREATE INDEX idx_incidents_affected_systems ON incidents USING GIN(affected_systems);
CREATE INDEX idx_incidents_title_desc ON incidents USING GIN(to_tsvector('portuguese', title || ' ' || description));

-- Knowledge base indexes
CREATE INDEX idx_knowledge_business_area ON knowledge_base(business_area_id);
CREATE INDEX idx_knowledge_technology_area ON knowledge_base(technology_area_id);
CREATE INDEX idx_knowledge_status ON knowledge_base(status);
CREATE INDEX idx_knowledge_tags ON knowledge_base USING GIN(tags);
CREATE INDEX idx_knowledge_keywords ON knowledge_base USING GIN(keywords);
CREATE INDEX idx_knowledge_content_search ON knowledge_base USING GIN(to_tsvector('portuguese', title || ' ' || content));

-- Audit indexes
CREATE INDEX idx_audit_entity ON audit_system.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_system.audit_log(user_id);
CREATE INDEX idx_audit_created_at ON audit_system.audit_log(created_at);
CREATE INDEX idx_audit_compliance ON audit_system.audit_log USING GIN(compliance_flags);

-- Vector embeddings indexes
CREATE INDEX idx_vector_entity ON vector_embeddings(entity_type, entity_id);
CREATE INDEX idx_vector_collection ON vector_embeddings(vector_collection);

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert Business Areas
INSERT INTO business_areas (code, name, description, priority, sla_hours) VALUES
('retail-banking', 'Banco de Varejo', 'Produtos e serviços para pessoas físicas', 1, 4),
('corporate-banking', 'Banco Corporativo', 'Produtos e serviços para empresas', 1, 2),
('investment-banking', 'Banco de Investimento', 'Mercado de capitais e investimentos', 2, 8),
('private-banking', 'Private Banking', 'Atendimento a clientes high net worth', 2, 4),
('digital-banking', 'Banco Digital', 'Canais digitais e mobile banking', 1, 1),
('payments', 'Meios de Pagamento', 'PIX, cartões, transferências', 1, 2),
('credit-risk', 'Risco de Crédito', 'Análise e gestão de risco creditício', 2, 8),
('compliance', 'Compliance', 'Conformidade regulatória', 1, 4),
('treasury', 'Tesouraria', 'Gestão de liquidez e ALM', 2, 8),
('operations', 'Operações', 'Back office e processamento', 2, 8),
('technology', 'Tecnologia', 'Infraestrutura e sistemas', 1, 4),
('security', 'Segurança', 'Segurança da informação', 1, 2);

-- Insert Technology Areas
INSERT INTO technology_areas (code, name, description, keywords, priority, sla_hours) VALUES
('mainframe', 'Mainframe', 'Sistemas IBM z/OS e COBOL', ARRAY['cobol', 'jcl', 'cics', 'db2', 'vsam', 'mainframe'], 1, 2),
('core-banking', 'Core Banking', 'Sistema central bancário', ARRAY['core', 'account', 'transaction', 'balance'], 1, 1),
('mobile-banking', 'Mobile Banking', 'Aplicativos móveis', ARRAY['mobile', 'app', 'ios', 'android', 'react-native'], 2, 4),
('internet-banking', 'Internet Banking', 'Plataforma web', ARRAY['web', 'browser', 'html', 'javascript', 'angular'], 2, 4),
('api-gateway', 'API Gateway', 'APIs e microserviços', ARRAY['api', 'rest', 'microservice', 'gateway', 'json'], 2, 4),
('database', 'Base de Dados', 'Sistemas de banco de dados', ARRAY['database', 'sql', 'oracle', 'postgresql', 'mongodb'], 1, 2),
('middleware', 'Middleware', 'Sistemas de integração', ARRAY['middleware', 'mq', 'esb', 'kafka', 'integration'], 2, 4),
('security-systems', 'Sistemas de Segurança', 'Autenticação e autorização', ARRAY['security', 'auth', 'ldap', 'oauth', 'encryption'], 1, 2);

-- Insert Application Modules
INSERT INTO application_modules (business_area_id, technology_area_id, code, name, description, criticality) VALUES
(1, 2, 'account-mgmt', 'Gestão de Contas', 'Sistema de abertura e manutenção de contas', 'high'),
(6, 2, 'pix-system', 'Sistema PIX', 'Processamento de transações PIX', 'critical'),
(1, 2, 'current-account', 'Conta Corrente', 'Movimentação de conta corrente', 'critical'),
(1, 2, 'savings-account', 'Conta Poupança', 'Gestão de contas poupança', 'high'),
(2, 2, 'corporate-loans', 'Empréstimos Corporativos', 'Sistema de crédito corporativo', 'high'),
(5, 3, 'mobile-app', 'App Mobile', 'Aplicativo mobile banking', 'high'),
(5, 4, 'internet-banking', 'Internet Banking', 'Portal web do banco', 'high'),
(6, 5, 'payment-api', 'API de Pagamentos', 'API para processamento de pagamentos', 'critical'),
(8, 8, 'fraud-detection', 'Detecção de Fraude', 'Sistema de prevenção à fraude', 'critical'),
(11, 6, 'data-warehouse', 'Data Warehouse', 'Armazém de dados corporativo', 'medium'),
(7, 1, 'credit-scoring', 'Credit Scoring', 'Sistema de análise de crédito', 'high'),
(9, 2, 'treasury-system', 'Sistema Tesouraria', 'Gestão de liquidez', 'high');

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_updated_at BEFORE UPDATE ON knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_areas_updated_at BEFORE UPDATE ON business_areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_technology_areas_updated_at BEFORE UPDATE ON technology_areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_application_modules_updated_at BEFORE UPDATE ON application_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate incident numbers
CREATE OR REPLACE FUNCTION generate_incident_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.incident_number IS NULL THEN
        NEW.incident_number := 'INC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                              LPAD(nextval('incident_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create sequence for incident numbers
CREATE SEQUENCE IF NOT EXISTS incident_number_seq START 1;

-- Apply trigger for incident number generation
CREATE TRIGGER generate_incident_number_trigger
    BEFORE INSERT ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION generate_incident_number();

-- =============================================
-- VIEWS FOR REPORTING
-- =============================================

-- View: Incident Summary
CREATE VIEW v_incident_summary AS
SELECT
    i.id,
    i.incident_number,
    i.title,
    i.severity,
    i.status,
    ba.name as business_area,
    ta.name as technology_area,
    am.name as application_module,
    i.assigned_to,
    i.created_at,
    i.resolved_at,
    EXTRACT(EPOCH FROM (COALESCE(i.resolved_at, CURRENT_TIMESTAMP) - i.created_at))/3600 as resolution_hours
FROM incidents i
LEFT JOIN business_areas ba ON i.business_area_id = ba.id
LEFT JOIN technology_areas ta ON i.technology_area_id = ta.id
LEFT JOIN application_modules am ON i.application_module_id = am.id;

-- View: Knowledge Base Summary
CREATE VIEW v_knowledge_summary AS
SELECT
    kb.id,
    kb.title,
    kb.content_type,
    ba.name as business_area,
    ta.name as technology_area,
    am.name as application_module,
    kb.status,
    kb.usage_count,
    kb.rating,
    kb.created_at
FROM knowledge_base kb
LEFT JOIN business_areas ba ON kb.business_area_id = ba.id
LEFT JOIN technology_areas ta ON kb.technology_area_id = ta.id
LEFT JOIN application_modules am ON kb.application_module_id = am.id;

-- =============================================
-- SECURITY
-- =============================================

-- Create application user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ai_app_user') THEN
        CREATE ROLE ai_app_user WITH LOGIN PASSWORD 'app_secure_2025';
    END IF;
END
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA incident_system TO ai_app_user;
GRANT USAGE ON SCHEMA audit_system TO ai_app_user;
GRANT USAGE ON SCHEMA ml_system TO ai_app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA incident_system TO ai_app_user;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit_system TO ai_app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA ml_system TO ai_app_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA incident_system TO ai_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ml_system TO ai_app_user;

-- Row Level Security (Future enhancement)
-- ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

COMMIT;