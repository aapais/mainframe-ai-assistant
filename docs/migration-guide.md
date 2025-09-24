# SQLite to PostgreSQL Migration Guide

## Overview

This document describes the migration from SQLite to PostgreSQL with vector embedding support for the Mainframe AI Assistant.

## Implementation Summary

### Backend Developer Agent Deliverables

✅ **Database Migration Script** (`scripts/migration/sqlite-to-postgres.js`)
- Automated SQLite to PostgreSQL data migration
- Vector embedding generation using OpenAI ada-002 model
- Data integrity validation and mapping functions
- Batch processing to avoid API rate limits
- Comprehensive error handling and logging

✅ **Vector Embedding Service** (`src/services/embedding-service.js`)
- OpenAI integration for text embeddings
- Caching mechanism for performance
- Batch processing capabilities
- Similarity calculation functions
- Text preprocessing and optimization

✅ **Enhanced Backend Server** (`src/backend/enhanced-server.js`)
- Dual database support (SQLite fallback, PostgreSQL primary)
- Vector similarity search endpoints
- Hybrid text + vector search capabilities
- Performance monitoring and health checks
- Migration status reporting

✅ **Testing Suite** (`scripts/test-migration.js`)
- Database connection validation
- Data migration integrity checks
- Vector embedding functionality tests
- API endpoint verification
- Performance benchmarking

## Architecture Changes

### Database Schema Evolution

**SQLite (Legacy)**:
```sql
CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  title TEXT,
  description TEXT,
  category TEXT,
  severity TEXT,
  status TEXT,
  priority TEXT,
  -- ... other fields
);
```

**PostgreSQL (Enhanced)**:
```sql
CREATE TABLE incidents_enhanced (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  technical_area VARCHAR(50) NOT NULL,
  business_area VARCHAR(50),
  status VARCHAR(20) DEFAULT 'OPEN',
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  severity VARCHAR(20) DEFAULT 'MEDIUM',
  embedding vector(1536),  -- Vector embeddings for similarity search
  metadata JSONB DEFAULT '{}',
  search_vector tsvector,   -- Full-text search
  -- ... audit fields
);
```

### Vector Search Capabilities

**New Endpoints**:
- `POST /api/incidents/vector-search` - Semantic similarity search
- `GET /api/migration/status` - Migration and database status
- `GET /api/health` - Enhanced health check with vector capabilities

**Search Features**:
- Cosine similarity matching with pgvector
- Hybrid scoring (70% vector + 30% text relevance)
- Configurable similarity thresholds
- Technical area and status filtering
- Performance optimized with ivfflat indexes

## Usage Instructions

### 1. Prerequisites

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your OPENAI_API_KEY to .env
```

### 2. Start PostgreSQL

```bash
# Start PostgreSQL container
npm run docker:postgres

# Wait for container to be ready
docker logs mainframe-ai-postgres
```

### 3. Run Migration

```bash
# Test database connections
npm run migrate:test

# Run full migration with embeddings
npm run migrate:run
```

### 4. Start Enhanced Backend

```bash
# Start new backend with PostgreSQL support
npm run start:backend:enhanced

# Or with environment variable for database selection
USE_POSTGRES=true npm run start:backend:enhanced
```

### 5. Test Vector Search

```bash
# Run comprehensive test suite
node scripts/test-migration.js
```

## API Examples

### Vector Similarity Search

```javascript
// POST /api/incidents/vector-search
{
  "query": "CICS transaction timeout during peak hours",
  "limit": 10,
  "threshold": 0.7,
  "technical_area": "CICS",
  "status": "OPEN"
}

// Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "CICS Transaction Timeout",
      "description": "CICS transactions timing out during peak hours",
      "similarity_score": 0.892,
      "text_relevance": 0.156,
      "combined_score": 0.671
    }
  ],
  "count": 1
}
```

### Migration Status Check

```javascript
// GET /api/migration/status
{
  "success": true,
  "sqlite_available": true,
  "postgres_available": true,
  "current_database": "PostgreSQL",
  "sqlite_entries": 16,
  "postgres_entries": 16,
  "postgres_entries_with_embeddings": 12,
  "vector_search_enabled": true,
  "embedding_service_available": true
}
```

## Performance Optimizations

### Database Indexes

```sql
-- Vector similarity search (ivfflat for approximate nearest neighbor)
CREATE INDEX idx_incidents_embedding ON incidents_enhanced
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search
CREATE INDEX idx_incidents_search ON incidents_enhanced
USING gin(search_vector);

-- Query optimization indexes
CREATE INDEX idx_incidents_area_status ON incidents_enhanced(technical_area, status);
```

### Embedding Service Features

- **Caching**: 24-hour in-memory cache for embeddings
- **Batch Processing**: Configurable batch sizes with rate limiting
- **Text Preprocessing**: Normalization and length limits
- **Error Handling**: Graceful fallbacks for API failures

### Search Performance

- **Hybrid Scoring**: Combines vector similarity with text relevance
- **Index Optimization**: Uses ivfflat for fast approximate search
- **Query Caching**: Embedding results cached to reduce API calls
- **Connection Pooling**: Efficient PostgreSQL connection management

## Data Mapping

### Field Transformations

| SQLite Field | PostgreSQL Field | Transformation |
|-------------|------------------|----------------|
| `category` | `technical_area` | Mapped to controlled vocabulary |
| `status` | `status` | Portuguese → English mapping |
| `priority` | `priority` | P1-P4 → CRITICAL/HIGH/MEDIUM/LOW |
| `severity` | `severity` | Direct mapping with validation |
| `solution` | `resolution` | Direct field rename |

### Status Mapping

```javascript
const statusMapping = {
  'aberto': 'OPEN',
  'em_tratamento': 'IN_PROGRESS',
  'resolvido': 'RESOLVED',
  'fechado': 'CLOSED',
  'reaberto': 'OPEN',
  'em_revisao': 'PENDING'
};
```

## Monitoring and Logging

### Migration Logs

- **Location**: `scripts/logs/migration-log.json`
- **Contents**: Entry counts, embedding statistics, errors
- **Format**: Structured JSON for analysis

### Test Reports

- **Location**: `scripts/logs/test-report.json`
- **Metrics**: Performance times, success rates, detailed results
- **Automation**: Integrated with CI/CD pipelines

## Troubleshooting

### Common Issues

1. **Docker Permission Denied**
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

2. **OpenAI API Rate Limits**
   - Increase delay between API calls
   - Reduce batch sizes
   - Monitor usage in OpenAI dashboard

3. **pgvector Extension Missing**
   ```bash
   docker compose down
   docker compose up -d postgres
   # Wait for container initialization
   ```

4. **Memory Issues with Large Datasets**
   - Increase Node.js heap size: `node --max-old-space-size=4096`
   - Process data in smaller batches
   - Clear embedding cache periodically

### Health Check Commands

```bash
# Check database connectivity
npm run migrate:test

# Verify API endpoints
curl http://localhost:3001/api/health

# Test vector search
curl -X POST http://localhost:3001/api/incidents/vector-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "limit": 5}'
```

## Future Enhancements

### Planned Features

1. **Real-time Embeddings**: Generate embeddings on incident creation
2. **Multi-modal Search**: Support for documents and images
3. **Advanced Analytics**: Vector clustering and pattern analysis
4. **Cache Optimization**: Redis integration for embedding cache
5. **Bulk Operations**: Efficient batch update APIs

### Scalability Considerations

- **Read Replicas**: For high-volume search workloads
- **Connection Pooling**: pgBouncer for production deployments
- **Embedding Models**: Support for multiple embedding providers
- **Horizontal Scaling**: Microservice architecture patterns

## Configuration Reference

### Environment Variables

```bash
# Database Configuration
USE_POSTGRES=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mainframe_ai
DB_USER=mainframe_user
DB_PASSWORD=mainframe_pass

# Vector Search
OPENAI_API_KEY=your-api-key-here
VECTOR_DIMENSION=1536
SIMILARITY_THRESHOLD=0.7

# Performance
EMBEDDING_CACHE_TTL=86400000  # 24 hours
BATCH_SIZE=10
API_DELAY_MS=1000
```

### NPM Scripts

```json
{
  "migrate:test": "node scripts/migration/sqlite-to-postgres.js test",
  "migrate:run": "node scripts/migration/sqlite-to-postgres.js migrate",
  "start:backend:enhanced": "node src/backend/enhanced-server.js",
  "docker:postgres": "docker compose up -d postgres",
  "docker:down": "docker compose down"
}
```

## Success Metrics

The migration has been successfully implemented with:

- ✅ **16/16** incidents migrated from SQLite to PostgreSQL
- ✅ **Vector embeddings** generated for semantic search
- ✅ **Dual database support** with fallback capabilities
- ✅ **API compatibility** maintained for existing clients
- ✅ **Performance optimization** with proper indexing
- ✅ **Comprehensive testing** suite for validation
- ✅ **Documentation** and troubleshooting guides

---

**Backend Developer Agent Task Complete** 🎉

The SQLite to PostgreSQL migration with vector search capabilities has been successfully implemented, tested, and documented.