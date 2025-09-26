# 🚀 pgvector Setup Guide

## Overview
pgvector is a PostgreSQL extension that enables vector similarity search, essential for optimal RAG (Retrieval-Augmented Generation) performance in the Mainframe AI Assistant.

## Prerequisites
- PostgreSQL 12+ installed and running
- Node.js 18+ installed
- sudo/admin access for PostgreSQL

## Installation

### Option 1: Automated Installation (Recommended)

```bash
# Make script executable
chmod +x scripts/setup-pgvector.sh

# Run installation script (requires sudo)
sudo ./scripts/setup-pgvector.sh
```

### Option 2: Manual Installation

#### On Ubuntu/Debian:
```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y postgresql-server-dev-all build-essential git

# Clone and build pgvector
cd /tmp
git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Create extension in database
sudo -u postgres psql -d assistente_db -c "CREATE EXTENSION vector;"
```

#### On macOS:
```bash
# Install via Homebrew
brew install pgvector

# Create extension in database
psql -U postgres -d assistente_db -c "CREATE EXTENSION vector;"
```

#### On Windows:
1. Use WSL2 with Ubuntu and follow Linux instructions, OR
2. Download from: https://github.com/pgvector/pgvector/releases
3. Follow Windows-specific installation instructions

## Database Configuration

### 1. Apply pgvector Schema
```bash
# Run the setup SQL script
psql -U assistente_user -d assistente_db -f scripts/database/setup-pgvector.sql
```

### 2. Apply Multi-Provider Embeddings
```bash
# Add columns for different embedding providers
psql -U assistente_user -d assistente_db -f scripts/database/add-multi-provider-embeddings.sql
```

## Node.js Setup

### Install pgvector Client
```bash
# Install Node.js client library
npm install pgvector
```

## Verification

### 1. Check pgvector Installation
```sql
-- Connect to database
psql -U assistente_user -d assistente_db

-- Verify extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check version
SELECT extversion FROM pg_extension WHERE extname = 'vector';

-- Test vector operations
SELECT '[1,2,3]'::vector <=> '[3,2,1]'::vector;
```

### 2. Verify Indexes
```sql
-- Check existing indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'knowledge_base'
AND indexname LIKE '%embedding%';
```

### 3. Test Vector Search
```javascript
// Run test script
node scripts/test-vector-search.js
```

## Features

### Multi-Provider Support
The system supports embeddings from multiple providers:
- **OpenAI**: 1536 dimensions (text-embedding-ada-002)
- **Gemini**: 768 dimensions (embedding-001)
- **Anthropic**: 1024 dimensions (claude embeddings)

### Optimized Indexes
Uses HNSW (Hierarchical Navigable Small World) indexes for fast similarity search:
```sql
CREATE INDEX idx_kb_embedding_openai_hnsw
ON knowledge_base USING hnsw (embedding_openai vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Automatic Fallback
The EnhancedRAGChatService automatically:
1. Detects pgvector availability
2. Uses vector search when available
3. Falls back to enhanced text search when pgvector is not available

## Performance Tuning

### PostgreSQL Configuration
Add to `postgresql.conf`:
```ini
# Increase shared memory for vector operations
shared_buffers = 256MB
work_mem = 16MB
maintenance_work_mem = 512MB

# Enable parallel queries
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

### Index Parameters
Adjust HNSW parameters based on your dataset:
```sql
-- For larger datasets (>100k documents)
WITH (m = 32, ef_construction = 128)

-- For smaller datasets (<10k documents)
WITH (m = 8, ef_construction = 32)
```

## Troubleshooting

### Error: "vector type does not exist"
pgvector is not installed. Run the installation script.

### Error: "could not open extension control file"
PostgreSQL dev headers missing. Install postgresql-server-dev-all.

### Slow vector searches
1. Check index exists: `\di+ idx_kb_embedding_*`
2. Run ANALYZE: `ANALYZE knowledge_base;`
3. Increase work_mem: `SET work_mem = '256MB';`

### PostgreSQL not running
```bash
# Check status
sudo service postgresql status

# Start PostgreSQL
sudo service postgresql start
```

## Maintenance

### Reindex Periodically
```sql
-- Rebuild indexes for optimal performance
REINDEX INDEX idx_kb_embedding_openai_hnsw;
REINDEX INDEX idx_kb_embedding_gemini_hnsw;
```

### Update Statistics
```sql
-- Update table statistics
ANALYZE knowledge_base;
```

### Monitor Performance
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename = 'knowledge_base';
```

## Benefits

With pgvector properly configured:
- ✅ **10-100x faster** similarity search
- ✅ **Better relevance** in RAG responses
- ✅ **Multi-provider** embedding support
- ✅ **Scalable** to millions of documents
- ✅ **Automatic fallback** for compatibility

## Support

For issues or questions:
1. Check logs: `tail -f server.log`
2. Verify setup: `node scripts/check-embeddings-status.js`
3. Run diagnostics: `npm run diagnose:pgvector`

---

**Note**: The application works without pgvector but with reduced performance. Installing pgvector is highly recommended for production use.