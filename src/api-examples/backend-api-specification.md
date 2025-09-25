# Backend API Specification for localhost:3001

This document specifies the REST API endpoints that the AI-enhanced frontend
expects to be available at `localhost:3001`.

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

## Base URL

```
http://localhost:3001/api
```

---

## 1. AI Categorization Endpoints

### POST /ai/categorize

Categorize an incident using AI.

**Request Body:**

```json
{
  "title": "Erro CICS região PROD01",
  "description": "Região CICS apresentando travamentos frequentes",
  "context": {
    "timestamp": "2024-01-20T10:30:00Z",
    "source": "mainframe-assistant"
  }
}
```

**Response:**

```json
{
  "category": "CICS",
  "confidence": 0.94,
  "subcategory": "Performance",
  "suggestedPriority": "Alta",
  "reasoning": "Detected CICS-related keywords and performance issues"
}
```

### GET /ai/categorize/history

Get categorization history.

**Query Parameters:**

- `limit` (optional): Number of records to return (default: 50)

**Response:**

```json
{
  "history": [
    {
      "id": 1,
      "title": "...",
      "predicted_category": "CICS",
      "confidence": 0.94,
      "timestamp": "2024-01-20T10:30:00Z"
    }
  ]
}
```

---

## 2. Semantic Search Endpoints

### POST /knowledge/semantic-search

Perform semantic search on knowledge base.

**Request Body:**

```json
{
  "query": "Como resolver erro CICS ABEND S0C7",
  "mode": "semantic",
  "limit": 10,
  "threshold": 0.7,
  "filters": {
    "category": "CICS",
    "dateRange": "30d",
    "author": "admin"
  }
}
```

**Response:**

```json
{
  "results": [
    {
      "id": 1,
      "title": "Resolução ABEND S0C7 em CICS",
      "content": "Procedimento para resolver...",
      "similarity_score": 0.92,
      "category": "CICS",
      "last_updated": "2024-01-15",
      "author": "João Silva",
      "tags": ["cics", "abend", "error-handling"],
      "metadata": {
        "document_type": "procedure",
        "version": "1.2"
      }
    }
  ],
  "total": 5,
  "query_time": 0.234
}
```

### GET /knowledge/search-analytics

Get search analytics.

**Query Parameters:**

- `timeframe`: 1d, 7d, 30d, 90d (default: 7d)

**Response:**

```json
{
  "total_searches": 1547,
  "avg_results_per_search": 7.3,
  "top_categories": [
    { "category": "CICS", "count": 234 },
    { "category": "DB2", "count": 189 }
  ],
  "search_success_rate": 0.87
}
```

### GET /knowledge/popular-searches

Get popular search terms.

**Query Parameters:**

- `limit` (optional): Number of terms to return (default: 20)

**Response:**

```json
{
  "popular_terms": [
    { "term": "CICS error", "count": 89, "trend": "up" },
    { "term": "DB2 performance", "count": 67, "trend": "stable" }
  ]
}
```

---

## 3. RAG Pipeline Endpoints

### POST /rag/generate-resolution

Generate resolution using RAG pipeline.

**Request Body:**

```json
{
  "incident": {
    "title": "Erro CICS região PROD01",
    "description": "Região apresentando travamentos",
    "category": "CICS",
    "priority": "Alta",
    "history": []
  },
  "context": {
    "includeHistory": true,
    "includeSimilar": true,
    "maxSources": 10,
    "confidenceThreshold": 0.8
  },
  "options": {
    "language": "pt-BR",
    "format": "structured",
    "includeSteps": true,
    "includeRationale": true
  }
}
```

**Response:**

```json
{
  "resolution": "Baseado na análise de documentos similares...",
  "confidence": 0.89,
  "sources": [
    {
      "title": "Manual CICS Operations v12.3",
      "relevance": 0.94,
      "document_id": "doc_123"
    }
  ],
  "steps": ["1. Verificar logs do sistema", "2. Ajustar parâmetros de memória"],
  "rationale": "Similar incidents were resolved using memory optimization",
  "estimated_time": "2-4 hours",
  "risk_level": "low",
  "alternatives": ["Alternative approach: Full system restart"]
}
```

### GET /rag/metrics

Get RAG pipeline metrics.

**Response:**

```json
{
  "total_generations": 1234,
  "avg_confidence": 0.87,
  "success_rate": 0.92,
  "avg_response_time": 2.3,
  "model_performance": {
    "text_generation": 0.91,
    "document_retrieval": 0.88,
    "answer_synthesis": 0.89
  }
}
```

### POST /rag/feedback

Provide feedback on RAG response.

**Request Body:**

```json
{
  "resolution_id": "res_123",
  "feedback": {
    "helpful": true,
    "accuracy": 0.9,
    "completeness": 0.8,
    "comments": "Very helpful resolution"
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Feedback recorded successfully"
}
```

---

## 4. Similar Incidents Endpoints

### POST /incidents/find-similar

Find similar incidents.

**Request Body:**

```json
{
  "incident": {
    "title": "Erro CICS região PROD01",
    "description": "Região apresentando travamentos",
    "category": "CICS"
  },
  "options": {
    "limit": 10,
    "threshold": 0.75,
    "includeResolved": true,
    "timeframe": "90d",
    "priorityFilter": ["Alta", "Crítica"]
  }
}
```

**Response:**

```json
{
  "similar_incidents": [
    {
      "id": 101,
      "title": "Erro similar CICS PROD02",
      "description": "Comportamento instável",
      "similarity_score": 0.94,
      "status": "Resolvido",
      "resolution": "Ajuste de parâmetros de memória",
      "resolution_time": "2h 15min",
      "resolved_by": "Maria Santos",
      "resolved_date": "2024-01-20",
      "category": "CICS",
      "priority": "Alta",
      "tags": ["cics", "memory", "performance"]
    }
  ],
  "total_found": 5
}
```

### GET /incidents/resolution-patterns

Get incident resolution patterns.

**Query Parameters:**

- `category`: Incident category
- `timeframe`: Time period (30d, 90d, all)

**Response:**

```json
{
  "patterns": [
    {
      "pattern": "Memory adjustment",
      "frequency": 34,
      "success_rate": 0.91,
      "avg_resolution_time": "2.5 hours"
    }
  ],
  "category": "CICS",
  "timeframe": "90d"
}
```

---

## 5. Dashboard & Metrics Endpoints

### GET /dashboard/ai-metrics

Get real-time AI metrics.

**Response:**

```json
{
  "active_models": 5,
  "processed_today": 127,
  "avg_accuracy": 94.2,
  "response_times": [1200, 890, 1100, 950],
  "model_status": {
    "categorization": { "status": "healthy", "accuracy": 96.1 },
    "semantic_search": { "status": "healthy", "accuracy": 93.8 },
    "rag_pipeline": { "status": "healthy", "accuracy": 91.5 }
  },
  "realtime_events": [
    {
      "timestamp": "2024-01-20T10:30:00Z",
      "type": "categorization",
      "message": "Incident categorized as CICS"
    }
  ],
  "system_health": "healthy"
}
```

### WebSocket /dashboard/realtime

Real-time updates via WebSocket.

**Connection URL:**

```
ws://localhost:3001/api/dashboard/realtime
```

**Subscribe Message:**

```json
{
  "type": "subscribe",
  "channels": ["ai-metrics", "incidents", "search-activity"]
}
```

**Update Messages:**

```json
{
  "channel": "ai-metrics",
  "type": "metrics_update",
  "data": {
    "processed_today": 128,
    "latest_accuracy": 94.5
  },
  "timestamp": "2024-01-20T10:31:00Z"
}
```

### GET /dashboard/performance

Get system performance metrics.

**Response:**

```json
{
  "cpu_usage": 45.2,
  "memory_usage": 67.8,
  "disk_usage": 34.1,
  "api_response_times": {
    "avg": 234,
    "p95": 456,
    "p99": 789
  },
  "error_rates": {
    "categorization": 0.02,
    "search": 0.01,
    "rag": 0.03
  }
}
```

---

## 6. Incident Management Endpoints

### POST /incidents

Create new incident.

**Request Body:**

```json
{
  "title": "Erro CICS região PROD01",
  "description": "Região apresentando travamentos",
  "category": "CICS",
  "priority": "Alta",
  "assignee": "João Silva",
  "status": "Aberto",
  "ai_categorized": true,
  "ai_confidence": 0.94,
  "source": "ai-assistant",
  "created_at": "2024-01-20T10:30:00Z"
}
```

**Response:**

```json
{
  "id": 1001,
  "title": "Erro CICS região PROD01",
  "description": "Região apresentando travamentos",
  "category": "CICS",
  "priority": "Alta",
  "assignee": "João Silva",
  "status": "Aberto",
  "created_at": "2024-01-20T10:30:00Z",
  "updated_at": "2024-01-20T10:30:00Z"
}
```

### PATCH /incidents/{id}

Update incident.

**Request Body:**

```json
{
  "status": "Em Tratamento",
  "assignee": "Maria Santos",
  "resolution": "Ajustados parâmetros de memória",
  "updated_at": "2024-01-20T11:00:00Z"
}
```

**Response:**

```json
{
  "id": 1001,
  "status": "Em Tratamento",
  "assignee": "Maria Santos",
  "updated_at": "2024-01-20T11:00:00Z"
}
```

### GET /incidents

Get incidents with filters.

**Query Parameters:**

- `status`: Filter by status
- `category`: Filter by category
- `priority`: Filter by priority
- `assignee`: Filter by assignee
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**

```json
{
  "incidents": [
    {
      "id": 1001,
      "title": "Erro CICS região PROD01",
      "description": "Região apresentando travamentos",
      "category": "CICS",
      "priority": "Alta",
      "status": "Aberto",
      "assignee": "João Silva",
      "created_at": "2024-01-20T10:30:00Z",
      "updated_at": "2024-01-20T10:30:00Z"
    }
  ],
  "total": 45,
  "limit": 50,
  "offset": 0
}
```

---

## 7. Authentication Endpoints

### POST /auth/login

Authenticate user.

**Request Body:**

```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2024-01-20T18:30:00Z",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "administrator"
  }
}
```

### GET /health

Check API health.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "ai_models": "healthy",
    "search_engine": "healthy"
  }
}
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request

```json
{
  "error": "bad_request",
  "message": "Invalid request parameters",
  "details": {
    "field": "title",
    "issue": "Title is required"
  }
}
```

### 401 Unauthorized

```json
{
  "error": "unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "forbidden",
  "message": "Insufficient permissions"
}
```

### 429 Too Many Requests

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 60
}
```

### 500 Internal Server Error

```json
{
  "error": "internal_server_error",
  "message": "An unexpected error occurred",
  "request_id": "req_123456"
}
```

---

## Rate Limiting

- **General endpoints**: 100 requests per minute per IP
- **AI endpoints**: 20 requests per minute per user
- **Search endpoints**: 50 requests per minute per user
- **Dashboard endpoints**: 200 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642681200
```
