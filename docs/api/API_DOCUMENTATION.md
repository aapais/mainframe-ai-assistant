# API Documentation - Mainframe AI Assistant

**Real API Documentation for Enhanced Backend Server**

## Base URL
All API endpoints are available at: `http://localhost:3001/api/`

**Backend Status**: ✅ Active (Node.js + Express on port 3001)
**Database**: PostgreSQL 16 + pgvector (17 incidents loaded)
**Last Updated**: September 2025

---

## 📊 System Status

### Health Check
**Endpoint**: `GET /api/health`

Check system health and service availability.

```bash
curl http://localhost:3001/api/health
```

**Response** (200 OK):
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-09-24T12:02:53.791Z",
  "database": {
    "type": "PostgreSQL",
    "connected": true
  },
  "services": {
    "embedding": true,
    "vector_search": true
  }
}
```

**Response** (500 Error):
```json
{
  "success": false,
  "status": "unhealthy",
  "error": "Database connection failed",
  "timestamp": "2025-09-24T12:02:53.791Z"
}
```

---

## 🎯 Incident Management

### List All Incidents
**Endpoint**: `GET /api/incidents`

Retrieve all incidents from the database.

```bash
curl http://localhost:3001/api/incidents
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Database Connection Timeout",
      "description": "Oracle database connection experiencing timeout issues during peak hours",
      "technical_area": "DATABASE",
      "business_area": "PRODUCTION",
      "status": "OPEN",
      "priority": "HIGH",
      "severity": "CRITICAL",
      "assigned_to": "john.doe@accenture.com",
      "reporter": "jane.smith@accenture.com",
      "resolution": null,
      "metadata": {
        "created_via": "web_interface",
        "has_embedding": true,
        "source": "monitoring_system"
      },
      "created_at": "2025-09-24T10:30:00.000Z",
      "updated_at": "2025-09-24T10:30:00.000Z",
      "resolved_at": null
    }
  ],
  "count": 17,
  "database": "PostgreSQL"
}
```

### Create New Incident
**Endpoint**: `POST /api/incidents`

Create a new incident with automatic embedding generation.

```bash
curl -X POST http://localhost:3001/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Network Connectivity Issue",
    "description": "Users unable to access mainframe applications from remote locations",
    "technical_area": "NETWORK",
    "business_area": "REMOTE_ACCESS",
    "severity": "HIGH",
    "priority": "HIGH",
    "reporter": "support@accenture.com"
  }'
```

**Request Body**:
```typescript
interface CreateIncidentRequest {
  title: string;           // Required: Incident title
  description: string;     // Required: Detailed description
  technical_area?: string; // Optional: Technical category
  business_area?: string;  // Optional: Business impact area
  severity?: string;       // Optional: LOW, MEDIUM, HIGH, CRITICAL
  priority?: string;       // Optional: LOW, MEDIUM, HIGH, CRITICAL
  reporter: string;        // Required: Email of person reporting
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 18,
    "uuid": "550e8400-e29b-41d4-a716-446655440001",
    "title": "Network Connectivity Issue",
    "created_at": "2025-09-24T12:15:00.000Z"
  },
  "embedding_generated": true
}
```

### Update Incident
**Endpoint**: `PUT /api/incidents/:id`

Update an existing incident.

```bash
curl -X PUT http://localhost:3001/api/incidents/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "RESOLVED",
    "resolution": "Increased database connection pool size and optimized queries",
    "assigned_to": "john.doe@accenture.com"
  }'
```

### Delete Incident
**Endpoint**: `DELETE /api/incidents/:id`

Delete an incident by ID.

```bash
curl -X DELETE http://localhost:3001/api/incidents/1
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Incident deleted successfully"
}
```

---

## 🔍 Search Operations

### Text-Based Search
**Endpoint**: `GET /api/incidents/search`

Search incidents using PostgreSQL full-text search.

```bash
curl "http://localhost:3001/api/incidents/search?q=database%20connection"
```

**Query Parameters**:
- `q` (required): Search query string

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Database Connection Timeout",
      "description": "Oracle database connection experiencing timeout issues",
      "rank": 0.759,
      "technical_area": "DATABASE",
      "status": "OPEN",
      "created_at": "2025-09-24T10:30:00.000Z"
    }
  ],
  "count": 3,
  "query": "database connection",
  "database": "PostgreSQL"
}
```

### Vector Similarity Search
**Endpoint**: `POST /api/incidents/vector-search`

AI-powered semantic search using OpenAI embeddings.

```bash
curl -X POST http://localhost:3001/api/incidents/vector-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Oracle database connectivity problems",
    "limit": 5,
    "threshold": 0.7,
    "technical_area": "DATABASE"
  }'
```

**Request Body**:
```typescript
interface VectorSearchRequest {
  query: string;           // Required: Search query
  limit?: number;          // Optional: Max results (default: 10)
  threshold?: number;      // Optional: Similarity threshold (default: 0.7)
  technical_area?: string; // Optional: Filter by technical area
  status?: string;         // Optional: Filter by status
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Database Connection Timeout",
      "similarity_score": 0.89,
      "text_relevance": 0.75,
      "combined_score": 0.85,
      "technical_area": "DATABASE",
      "status": "OPEN"
    }
  ],
  "count": 3,
  "query": "Oracle database connectivity problems",
  "threshold": 0.7,
  "filters": {
    "technical_area": "DATABASE"
  }
}
```

**Error Responses**:
```json
// 501 Not Implemented (No PostgreSQL)
{
  "success": false,
  "error": "Vector search requires PostgreSQL with pgvector extension"
}

// 501 Not Implemented (No AI API)
{
  "success": false,
  "error": "Vector search requires OpenAI API key for embeddings"
}
```

---

## 🤖 AI Model Management

### Validate AI Model
**Endpoint**: `POST /api/validate-model`

Test AI provider configuration and model availability.

```bash
curl -X POST http://localhost:3001/api/validate-model \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-your-openai-key",
    "model": "text-embedding-ada-002",
    "azureEndpoint": "https://your-azure-endpoint.openai.azure.com/"
  }'
```

**Request Body**:
```typescript
interface ModelValidationRequest {
  provider: "openai" | "azure" | "claude";
  apiKey: string;
  model: string;
  azureEndpoint?: string; // Required for Azure provider
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Modelo text-embedding-ada-002 validado com sucesso",
  "model": "text-embedding-ada-002",
  "provider": "openai",
  "embeddingDimensions": 1536
}
```

**Response** (400 Error):
```json
{
  "success": false,
  "error": "Invalid API key or model not accessible"
}
```

### Test Model Fallback
**Endpoint**: `POST /api/test-model-fallback`

Test the AI model fallback system with multiple providers.

```bash
curl -X POST http://localhost:3001/api/test-model-fallback \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "llmProvider": "openai",
      "apiKey": "sk-your-key",
      "azureApiKey": "azure-backup-key",
      "claudeApiKey": "sk-ant-backup-key"
    }
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "activeModel": {
    "provider": "azure",
    "model": "text-embedding-ada-002"
  },
  "fallbackUsed": true,
  "message": "Usando modelo fallback: text-embedding-ada-002"
}
```

---

## 🔄 Database Migration

### Migration Status
**Endpoint**: `GET /api/migration/status`

Check SQLite→PostgreSQL migration status and data integrity.

```bash
curl http://localhost:3001/api/migration/status
```

**Response** (200 OK):
```json
{
  "success": true,
  "sqlite_available": true,
  "postgres_available": true,
  "current_database": "PostgreSQL",
  "vector_search_enabled": true,
  "embedding_service_available": true,
  "sqlite_entries": 500,
  "postgres_entries": 17,
  "postgres_entries_with_embeddings": 15
}
```

**Key Fields**:
- `sqlite_available`: Legacy SQLite database accessible
- `postgres_available`: PostgreSQL database active
- `current_database`: Which database is currently being used
- `vector_search_enabled`: AI vector search functionality available
- `postgres_entries_with_embeddings`: Incidents with AI embeddings

---

## 🔧 Error Handling

All API endpoints follow consistent error response format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Technical error details (optional)",
  "code": "ERROR_CODE (optional)"
}
```

### Common HTTP Status Codes

| Status | Description | Example |
|--------|-------------|---------|
| 200    | Success     | Data retrieved successfully |
| 201    | Created     | New incident created |
| 400    | Bad Request | Missing required fields |
| 404    | Not Found   | Incident ID not found |
| 500    | Server Error| Database connection failed |
| 501    | Not Implemented | Feature requires additional setup |

### Error Examples

**400 Bad Request**:
```json
{
  "success": false,
  "error": "Missing required fields: title, description, reporter"
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": "Incident with ID 999 not found"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Database connection failed",
  "details": "Connection timeout after 30 seconds"
}
```

---

## 🚀 Performance & Limits

### Response Time Targets
- **Health check**: < 50ms
- **List incidents**: < 200ms
- **Text search**: < 300ms
- **Vector search**: < 500ms
- **Create incident**: < 400ms (includes embedding generation)

### Rate Limits
- **Standard endpoints**: 100 requests/minute per IP
- **Vector search**: 20 requests/minute per IP (AI API limits)
- **Model validation**: 5 requests/minute per IP

### Data Limits
- **Incident title**: 255 characters max
- **Incident description**: 10,000 characters max
- **Search query**: 500 characters max
- **Batch operations**: 50 items max

---

## 🔐 Authentication & Security

### Current Implementation
- **CORS**: Enabled for all origins (development mode)
- **Input validation**: SQL injection prevention via parameterized queries
- **API keys**: Environment variable security for AI providers
- **Request logging**: All API requests logged with timestamps

### Production Security (Planned)
- JWT token authentication
- Rate limiting per user
- API key rotation
- Request signing
- Role-based access control

---

## 📊 Monitoring & Debugging

### Debug Headers
Add these headers for additional debugging information:

```bash
curl -H "X-Debug: true" http://localhost:3001/api/incidents
```

### Logging
All API requests are logged with:
- Request method and URL
- Response time
- Status code
- Error details (if any)

### Health Monitoring
Monitor system health using:
```bash
# Check if backend is responsive
curl -f http://localhost:3001/api/health

# Check database connection
curl http://localhost:3001/api/migration/status

# Validate AI services
curl -X POST http://localhost:3001/api/validate-model \
  -d '{"provider":"openai","apiKey":"test","model":"test"}'
```

---

## 🧪 Testing

### API Testing Scripts
```bash
# Test all endpoints
npm test

# Manual API testing
curl http://localhost:3001/api/health
curl http://localhost:3001/api/incidents
curl "http://localhost:3001/api/incidents/search?q=test"
```

### Expected Test Data
The system comes with 17 pre-loaded incidents for testing:
- Database connectivity issues
- Network problems
- Application errors
- System performance issues
- Security incidents

---

## 📚 Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

// List incidents
const incidents = await axios.get('http://localhost:3001/api/incidents');
console.log(`Found ${incidents.data.count} incidents`);

// Create incident
const newIncident = await axios.post('http://localhost:3001/api/incidents', {
  title: 'New Issue',
  description: 'Detailed description',
  reporter: 'user@company.com'
});
console.log(`Created incident ${newIncident.data.data.id}`);

// Vector search
const similar = await axios.post('http://localhost:3001/api/incidents/vector-search', {
  query: 'database connection problems',
  limit: 5
});
console.log(`Found ${similar.data.count} similar incidents`);
```

### Python
```python
import requests

# List incidents
response = requests.get('http://localhost:3001/api/incidents')
data = response.json()
print(f"Found {data['count']} incidents")

# Create incident
new_incident = requests.post('http://localhost:3001/api/incidents', json={
    'title': 'Python API Test',
    'description': 'Testing from Python script',
    'reporter': 'python@test.com'
})
print(f"Created incident: {new_incident.json()}")

# Text search
search_results = requests.get(
    'http://localhost:3001/api/incidents/search',
    params={'q': 'database'}
)
print(f"Search found {search_results.json()['count']} results")
```

---

## 🔄 API Versioning

**Current Version**: v2.0.0
**Stability**: Stable
**Breaking Changes**: None expected

### Version History
- **v2.0.0**: PostgreSQL + AI integration (current)
- **v1.0.0**: SQLite-based system (legacy)

### Backward Compatibility
- Legacy SQLite endpoints maintained during migration period
- New PostgreSQL endpoints are primary
- Migration status endpoint helps track transition

---

**For additional help, see [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)**