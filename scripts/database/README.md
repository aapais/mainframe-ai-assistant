# PostgreSQL with pgvector Setup - Phase 6

## Overview

This phase implements a comprehensive PostgreSQL database with pgvector extension for the mainframe AI assistant, providing vector similarity search capabilities for intelligent incident management and knowledge base operations.

## Files Created

### 1. `/scripts/database/schema.sql`
- Complete PostgreSQL schema with pgvector extension
- Enhanced incidents table with vector embeddings (1536 dimensions for OpenAI ada-002)
- Knowledge base table with semantic search capabilities
- Advanced indexing: ivfflat for vector similarity, GIN for full-text search
- Custom functions for hybrid search (vector + text)
- Sample data for testing

### 2. `/docker-compose.yml`
- Multi-service Docker setup with PostgreSQL, Redis, and application
- pgvector/pgvector:pg16 image for PostgreSQL with vector extension
- Redis for caching and session management
- Health checks and proper service dependencies
- Environment variable configuration
- Optional pgAdmin for database management

### 3. `/scripts/database/migrate-to-postgresql.js`
- Migration script from SQLite to PostgreSQL
- Automatic embedding generation using OpenAI API
- Batch processing for large datasets
- Data mapping and validation
- Error handling and retry logic
- Creates sample data if no existing SQLite database

### 4. `/scripts/database/db-connection.js`
- Professional database connection module
- Connection pooling with PostgreSQL
- Redis integration for caching
- Vector similarity search methods
- Transaction support
- Query optimization and monitoring
- Health status checking

### 5. `/scripts/database/seed-data.sql`
- Comprehensive sample data for testing
- Multiple incident scenarios across various technical areas
- Knowledge base entries with different types and complexity levels
- Performance data and analytics preparation

## Key Features

### Vector Similarity Search
- Semantic search for incidents and knowledge base
- Hybrid scoring (vector similarity + text relevance + confidence)
- Configurable similarity thresholds
- Support for filtering by technical area, status, type, etc.

### Database Schema
```sql
-- Enhanced incidents with vector embeddings
CREATE TABLE incidents_enhanced (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  technical_area VARCHAR(50) NOT NULL,
  business_area VARCHAR(50),
  status VARCHAR(20),
  priority VARCHAR(20),
  embedding vector(1536),  -- OpenAI ada-002 compatible
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- ... additional fields
);

-- Knowledge base with semantic capabilities
CREATE TABLE knowledge_base (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50),  -- PROCEDURE, TROUBLESHOOTING, FAQ, etc.
  technical_area VARCHAR(50),
  title TEXT,
  content TEXT,
  embedding vector(1536),
  confidence_score DECIMAL(3,2),
  tags TEXT[],
  -- ... additional fields
);
```

### Custom Search Functions
- `search_similar_incidents()`: Find similar incidents with hybrid scoring
- `search_knowledge_base()`: Intelligent knowledge retrieval
- Full-text search integration with PostgreSQL's tsvector

### Performance Optimizations
- IVFFlat indexes for approximate nearest neighbor search
- GIN indexes for full-text search and JSON queries
- Connection pooling and caching
- Query result caching with Redis
- Automated VACUUM and ANALYZE

## Quick Start

### 1. Start the Database
```bash
# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Or start everything including pgAdmin
docker-compose --profile admin up -d
```

### 2. Run Migration (Optional)
```bash
# If you have existing SQLite data
cd scripts/database
node migrate-to-postgresql.js

# Or just use the sample data (automatically loaded)
```

### 3. Test the Setup
```bash
# Connect to PostgreSQL
docker exec -it mainframe-ai-postgres psql -U mainframe_user -d mainframe_ai

# Test vector search
SELECT * FROM search_similar_incidents(
  '[0.1, 0.2, ...]'::vector,  -- Your embedding vector
  'CICS timeout',             -- Text query
  5,                          -- Limit
  0.7                         -- Similarity threshold
);
```

### 4. Use the Connection Module
```javascript
const { initializeDatabase } = require('./scripts/database/db-connection');

async function example() {
  const db = await initializeDatabase({
    host: 'localhost',
    database: 'mainframe_ai',
    user: 'mainframe_user',
    password: 'mainframe_pass'
  });

  // Search for similar incidents
  const similar = await db.searchSimilarIncidents(embeddingVector, {
    queryText: 'CICS timeout',
    technicalAreaFilter: 'CICS',
    limit: 5
  });

  // Create new incident with embedding
  const incident = await db.createIncident({
    title: 'New CICS Issue',
    description: 'Description here',
    technical_area: 'CICS',
    priority: 'HIGH'
  }, embeddingVector);
}
```

## Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mainframe_ai
DB_USER=mainframe_user
DB_PASSWORD=mainframe_pass

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_pass

# AI Services
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key

# Vector Search
VECTOR_DIMENSION=1536
SIMILARITY_THRESHOLD=0.7
```

## Technical Areas Supported

The schema supports 30+ mainframe technical areas:
- **CICS, DB2, IMS, MQ** - Core transaction processing
- **COBOL, JCL, VSAM** - Programming and data management
- **z/OS, MVS, USS** - Operating systems
- **RACF, TSO, ISPF** - Security and tools
- **And many more...**

## Business Areas

Support for various industry verticals:
- Banking, Insurance, Finance
- Retail, Manufacturing
- Healthcare, Government
- Utilities, Telecommunications

## Next Steps

1. **Integration**: Update application code to use the new PostgreSQL connection
2. **Testing**: Run comprehensive tests with vector similarity search
3. **Optimization**: Monitor query performance and adjust indexes
4. **Security**: Implement proper authentication and authorization
5. **Monitoring**: Set up database monitoring and alerting

## Troubleshooting

### Common Issues

1. **pgvector Extension Not Found**
   ```sql
   -- Ensure extension is available
   SELECT * FROM pg_available_extensions WHERE name = 'vector';
   ```

2. **Vector Dimension Mismatch**
   - Ensure embeddings are exactly 1536 dimensions (OpenAI ada-002)
   - Validate vector format: `[0.1, 0.2, ...]`

3. **Performance Issues**
   ```sql
   -- Check index usage
   EXPLAIN ANALYZE SELECT * FROM search_similar_incidents(...);

   -- Update statistics
   ANALYZE incidents_enhanced;
   ANALYZE knowledge_base;
   ```

4. **Connection Issues**
   - Verify Docker containers are running: `docker-compose ps`
   - Check logs: `docker-compose logs postgres`
   - Test connection: `docker exec -it mainframe-ai-postgres psql -U mainframe_user`

## Configuration Stored in Memory

The system stores configuration in memory with key `swarm/phase6/postgresql-ready`:
```json
{
  "status": "completed",
  "components": [
    "schema.sql",
    "docker-compose.yml",
    "migrate-to-postgresql.js",
    "db-connection.js",
    "seed-data.sql"
  ],
  "features": [
    "pgvector",
    "vector_similarity_search",
    "full_text_search",
    "caching",
    "connection_pooling"
  ]
}
```

This setup provides a robust, scalable foundation for AI-powered mainframe incident management with semantic search capabilities.