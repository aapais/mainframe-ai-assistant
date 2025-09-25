# Database Schema Documentation - PostgreSQL 16 + pgvector

**Production Database Schema for Mainframe AI Assistant v2.0.0**

## 🏗️ Overview

The Mainframe AI Assistant uses PostgreSQL 16 with the pgvector extension for:
- **Relational data** (incidents, metadata)
- **Vector embeddings** (AI semantic search)
- **Full-text search** (tsvector indexing)
- **ACID compliance** (data integrity)

## 📊 Database Configuration

```sql
-- Database: mainframe_ai
-- User: mainframe_user
-- Extensions: pgvector, pg_trgm, unaccent
-- Encoding: UTF-8
-- Collation: en_US.UTF-8
```

### Connection Details (Development)
```bash
Host: localhost
Port: 5432
Database: mainframe_ai
Username: mainframe_user
Password: mainframe_pass
```

## 📋 Core Schema

### incidents_enhanced Table

**Primary table for incident management with AI capabilities**

```sql
CREATE TABLE incidents_enhanced (
    -- Primary identifiers
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,

    -- Core incident data
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- Categorization
    technical_area VARCHAR(100) DEFAULT 'OTHER',
    business_area VARCHAR(100) DEFAULT 'OTHER',

    -- Status tracking
    status VARCHAR(50) DEFAULT 'OPEN',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    severity VARCHAR(20) DEFAULT 'MEDIUM',

    -- Assignment
    assigned_to VARCHAR(100),
    reporter VARCHAR(100) NOT NULL,
    resolution TEXT,

    -- AI and search features
    embedding VECTOR(1536),           -- OpenAI embedding (1536 dimensions)
    search_vector TSVECTOR,           -- PostgreSQL full-text search

    -- Metadata and tracking
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,

    -- Constraints
    CONSTRAINT incidents_status_check
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED')),
    CONSTRAINT incidents_priority_check
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT incidents_severity_check
        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);
```

### Indexes for Performance

```sql
-- Primary and unique indexes
CREATE UNIQUE INDEX idx_incidents_uuid ON incidents_enhanced(uuid);
CREATE INDEX idx_incidents_created_at ON incidents_enhanced(created_at DESC);

-- Search indexes
CREATE INDEX idx_incidents_search_vector
    ON incidents_enhanced USING GIN(search_vector);
CREATE INDEX idx_incidents_title_trgm
    ON incidents_enhanced USING GIN(title gin_trgm_ops);
CREATE INDEX idx_incidents_description_trgm
    ON incidents_enhanced USING GIN(description gin_trgm_ops);

-- Vector similarity index (HNSW for performance)
CREATE INDEX idx_incidents_embedding_hnsw
    ON incidents_enhanced USING hnsw(embedding vector_cosine_ops);

-- Categorical indexes
CREATE INDEX idx_incidents_technical_area ON incidents_enhanced(technical_area);
CREATE INDEX idx_incidents_status ON incidents_enhanced(status);
CREATE INDEX idx_incidents_priority ON incidents_enhanced(priority);
CREATE INDEX idx_incidents_assigned_to ON incidents_enhanced(assigned_to);

-- Composite indexes for common queries
CREATE INDEX idx_incidents_status_priority
    ON incidents_enhanced(status, priority);
CREATE INDEX idx_incidents_technical_area_status
    ON incidents_enhanced(technical_area, status);

-- JSONB metadata index
CREATE INDEX idx_incidents_metadata_gin
    ON incidents_enhanced USING GIN(metadata);
```

### Triggers and Functions

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON incidents_enhanced
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate search vector for full-text search
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector = to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.description, '') || ' ' ||
        COALESCE(NEW.technical_area, '') || ' ' ||
        COALESCE(NEW.business_area, '') || ' ' ||
        COALESCE(NEW.resolution, '')
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_incidents_search_vector
    BEFORE INSERT OR UPDATE ON incidents_enhanced
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Auto-set resolved_at when status changes to RESOLVED
CREATE OR REPLACE FUNCTION update_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
        NEW.resolved_at = NOW();
    ELSIF NEW.status != 'RESOLVED' THEN
        NEW.resolved_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_incidents_resolved_at
    BEFORE UPDATE ON incidents_enhanced
    FOR EACH ROW EXECUTE FUNCTION update_resolved_at();
```

## 🔍 Query Patterns

### Standard CRUD Operations

```sql
-- Create incident with automatic fields
INSERT INTO incidents_enhanced (
    title, description, technical_area, business_area,
    reporter, embedding, metadata
) VALUES (
    'Database Connection Issue',
    'Oracle database connections timing out during peak hours',
    'DATABASE',
    'PRODUCTION',
    'admin@company.com',
    '[0.1, 0.2, 0.3, ...]'::vector,  -- 1536-dimension embedding
    '{"source": "monitoring", "severity_auto": true}'::jsonb
);

-- Read with all related data
SELECT
    id, uuid, title, description,
    technical_area, business_area,
    status, priority, severity,
    assigned_to, reporter, resolution,
    metadata,
    created_at, updated_at, resolved_at
FROM incidents_enhanced
ORDER BY created_at DESC
LIMIT 50;

-- Update with automatic timestamp
UPDATE incidents_enhanced
SET
    status = 'RESOLVED',
    resolution = 'Increased connection pool size from 10 to 50',
    assigned_to = 'dba@company.com'
WHERE id = $1;

-- Delete (soft delete recommended via status)
UPDATE incidents_enhanced
SET status = 'DELETED', updated_at = NOW()
WHERE id = $1;
```

### Advanced Search Queries

```sql
-- Full-text search with ranking
SELECT
    id, uuid, title, description, technical_area, status,
    ts_rank_cd(search_vector, plainto_tsquery('english', $1)) as rank,
    ts_headline('english', description, plainto_tsquery('english', $1)) as snippet
FROM incidents_enhanced
WHERE search_vector @@ plainto_tsquery('english', $1)
ORDER BY rank DESC, created_at DESC
LIMIT 20;

-- Vector similarity search
SELECT
    id, uuid, title, description, technical_area,
    (1 - (embedding <=> $1::vector)) as similarity_score
FROM incidents_enhanced
WHERE embedding IS NOT NULL
    AND (1 - (embedding <=> $1::vector)) >= 0.7  -- 70% similarity threshold
ORDER BY embedding <=> $1::vector  -- Cosine distance (lower = more similar)
LIMIT 10;

-- Combined text + vector search
SELECT
    id, uuid, title, description, technical_area,
    (1 - (embedding <=> $1::vector)) as vector_similarity,
    ts_rank_cd(search_vector, plainto_tsquery('english', $2)) as text_relevance,
    (
        (0.7 * (1 - (embedding <=> $1::vector))) +
        (0.3 * ts_rank_cd(search_vector, plainto_tsquery('english', $2)))
    ) as combined_score
FROM incidents_enhanced
WHERE embedding IS NOT NULL
    AND (
        search_vector @@ plainto_tsquery('english', $2)
        OR (1 - (embedding <=> $1::vector)) >= 0.6
    )
ORDER BY combined_score DESC
LIMIT 15;
```

### Analytics Queries

```sql
-- Incident statistics by technical area
SELECT
    technical_area,
    COUNT(*) as total_incidents,
    COUNT(*) FILTER (WHERE status = 'OPEN') as open_incidents,
    COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_incidents,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
FROM incidents_enhanced
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY technical_area
ORDER BY total_incidents DESC;

-- Top assignees by resolution rate
SELECT
    assigned_to,
    COUNT(*) as assigned_count,
    COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_count,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'RESOLVED') * 100.0 / COUNT(*), 2
    ) as resolution_rate_percent
FROM incidents_enhanced
WHERE assigned_to IS NOT NULL
    AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY assigned_to
HAVING COUNT(*) >= 5
ORDER BY resolution_rate_percent DESC, resolved_count DESC;

-- Incidents by priority and status
SELECT
    priority,
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM incidents_enhanced
GROUP BY priority, status
ORDER BY priority, status;
```

## 🎯 Data Types and Validation

### Incident Status Values
```sql
-- Valid status transitions
OPEN → IN_PROGRESS → RESOLVED → CLOSED
OPEN → REJECTED
IN_PROGRESS → OPEN (if re-opened)
RESOLVED → OPEN (if re-opened)
```

### Priority and Severity Levels
```sql
-- Priority: Business urgency
LOW     -- Can wait, no immediate business impact
MEDIUM  -- Normal business priority
HIGH    -- Important, affects multiple users
CRITICAL -- Emergency, system-wide impact

-- Severity: Technical complexity
LOW     -- Simple fix, configuration change
MEDIUM  -- Standard troubleshooting required
HIGH    -- Complex investigation needed
CRITICAL -- Architectural or systemic issue
```

### Technical and Business Areas
```sql
-- Common technical_area values
'DATABASE', 'NETWORK', 'APPLICATION', 'SYSTEM',
'SECURITY', 'PERFORMANCE', 'INTEGRATION', 'OTHER'

-- Common business_area values
'PRODUCTION', 'STAGING', 'DEVELOPMENT', 'REMOTE_ACCESS',
'REPORTING', 'BATCH_PROCESSING', 'USER_INTERFACE', 'OTHER'
```

### Metadata JSONB Examples
```json
{
  "source": "monitoring_system",
  "auto_assigned": true,
  "escalation_level": 2,
  "affected_systems": ["oracle_db", "web_app"],
  "customer_impact": {
    "severity": "high",
    "users_affected": 150,
    "business_functions": ["reporting", "data_entry"]
  },
  "resolution_steps": [
    "Identified connection pool exhaustion",
    "Increased pool size from 10 to 50",
    "Monitored for 24 hours",
    "Confirmed resolution"
  ]
}
```

## 🚀 Performance Optimization

### Query Performance Tips

```sql
-- Use indexes effectively
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM incidents_enhanced
WHERE technical_area = 'DATABASE'
    AND status = 'OPEN'
ORDER BY created_at DESC;

-- Vector search performance
SET enable_seqscan = OFF;  -- Force index usage for vector queries

-- Optimize full-text search
SELECT set_limit(0.3);  -- Adjust similarity threshold for trigram searches
```

### Maintenance Tasks

```sql
-- Update table statistics
ANALYZE incidents_enhanced;

-- Reindex vector index if needed
REINDEX INDEX idx_incidents_embedding_hnsw;

-- Check index usage
SELECT
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname = 'incidents_enhanced';
```

## 🔒 Security Considerations

### Row-Level Security (Future Enhancement)
```sql
-- Enable RLS (when authentication is implemented)
ALTER TABLE incidents_enhanced ENABLE ROW LEVEL SECURITY;

-- Policy for user access
CREATE POLICY user_incidents ON incidents_enhanced
    FOR ALL TO authenticated_users
    USING (reporter = current_user_email() OR assigned_to = current_user_email());
```

### Data Privacy
```sql
-- Sensitive data should be encrypted at rest
-- Consider pgcrypto extension for field-level encryption

-- Example: Encrypt reporter email
ALTER TABLE incidents_enhanced
ADD COLUMN reporter_encrypted BYTEA;

-- Function to encrypt/decrypt
CREATE OR REPLACE FUNCTION encrypt_email(email TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(email, 'encryption_key');
END;
$$ LANGUAGE plpgsql;
```

## 📊 Sample Data

The system includes 17 production-ready sample incidents covering:

```sql
-- Sample incident types included
INSERT INTO incidents_enhanced (title, description, technical_area, business_area, reporter) VALUES
('Database Connection Timeout', 'Oracle connections timing out during peak hours', 'DATABASE', 'PRODUCTION', 'dba@company.com'),
('Network Latency Issue', 'High latency between data centers affecting synchronization', 'NETWORK', 'PRODUCTION', 'netadmin@company.com'),
('Application Memory Leak', 'Java application consuming excessive memory over time', 'APPLICATION', 'PRODUCTION', 'dev@company.com'),
('Security Certificate Expiry', 'SSL certificate expiring in 7 days', 'SECURITY', 'PRODUCTION', 'security@company.com'),
('Batch Job Failure', 'Nightly ETL process failing with timeout errors', 'SYSTEM', 'BATCH_PROCESSING', 'ops@company.com');
-- ... 12 more incidents
```

## 🔄 Migration from SQLite

### Legacy Schema Compatibility
```sql
-- Mapping from old SQLite schema to PostgreSQL
-- entries (SQLite) → incidents_enhanced (PostgreSQL)

SELECT
    id,
    title,
    description,
    category as technical_area,  -- Map category to technical_area
    severity,
    status,
    priority,
    assigned_to,
    reporter,
    solution as resolution,      -- Map solution to resolution
    created_at,
    updated_at
FROM entries;  -- SQLite table
```

### Migration Status Tracking
```sql
-- Check migration completeness
SELECT
    COUNT(*) as total_migrated,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
    COUNT(*) FILTER (WHERE search_vector IS NOT NULL) as with_search_vector,
    MIN(created_at) as oldest_incident,
    MAX(created_at) as newest_incident
FROM incidents_enhanced;
```

---

## 🛠️ Development Utilities

### Database Reset (Development Only)
```sql
-- WARNING: This deletes all data
TRUNCATE incidents_enhanced RESTART IDENTITY CASCADE;
```

### Backup and Restore
```bash
# Backup
pg_dump -h localhost -U mainframe_user -d mainframe_ai > backup.sql

# Restore
psql -h localhost -U mainframe_user -d mainframe_ai < backup.sql

# Backup with Docker
docker exec mainframe-ai-postgres pg_dump -U mainframe_user mainframe_ai > backup.sql

# Restore with Docker
docker exec -i mainframe-ai-postgres psql -U mainframe_user -d mainframe_ai < backup.sql
```

---

This schema supports the full functionality of the Mainframe AI Assistant v2.0.0, including AI-powered vector search, full-text search, and comprehensive incident management workflows.