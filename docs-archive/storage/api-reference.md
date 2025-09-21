# Storage Service API Reference

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Core Storage API](#core-storage-api)
4. [Knowledge Base API](#knowledge-base-api)
5. [Pattern Detection API](#pattern-detection-api)
6. [Code Analysis API](#code-analysis-api)
7. [Template Management API](#template-management-api)
8. [Analytics API](#analytics-api)
9. [Plugin API](#plugin-api)
10. [Monitoring API](#monitoring-api)
11. [Error Handling](#error-handling)
12. [Rate Limiting](#rate-limiting)
13. [WebSocket API](#websocket-api)
14. [SDK Examples](#sdk-examples)

## Overview

The Storage Service API provides comprehensive access to the Mainframe AI Assistant's storage layer across all MVP phases. The API follows RESTful principles with JSON payloads and supports both HTTP and WebSocket protocols for real-time features.

### Base URLs by Environment

```
Development: http://localhost:3000/api/v1
Staging:     https://staging-api.example.com/api/v1
Production:  https://api.example.com/api/v1
```

### API Versioning

The API uses URL versioning. Current version is `v1`. All endpoints are prefixed with `/api/v1`.

### Content Types

- Request: `application/json`
- Response: `application/json`
- File Upload: `multipart/form-data`

## Authentication

### Authentication Methods

#### MVP1-2: API Key Authentication

```http
GET /api/v1/knowledge/entries
Authorization: Bearer YOUR_API_KEY
```

#### MVP3+: JWT Authentication

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "roles": ["user"]
  }
}
```

#### MVP5: SSO Authentication

```http
POST /api/v1/auth/sso
Content-Type: application/json

{
  "provider": "azure_ad",
  "token": "sso_token_here"
}
```

### Token Refresh

```http
POST /api/v1/auth/refresh
Authorization: Bearer REFRESH_TOKEN
```

## Core Storage API

### Health Check

```http
GET /api/v1/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "duration": 5
    },
    "cache": {
      "status": "healthy", 
      "duration": 2
    },
    "ai_service": {
      "status": "healthy",
      "duration": 150
    }
  }
}
```

### System Information

```http
GET /api/v1/system/info
Authorization: Bearer TOKEN
```

Response:
```json
{
  "version": "1.0.0",
  "mvp_level": 3,
  "features": {
    "pattern_detection": true,
    "code_analysis": true,
    "ai_suggestions": true,
    "auto_resolution": false
  },
  "storage": {
    "type": "postgresql",
    "size": "2.5GB",
    "entries": 15420
  },
  "uptime": 86400
}
```

## Knowledge Base API

### List Knowledge Entries

```http
GET /api/v1/knowledge/entries
Authorization: Bearer TOKEN
```

Query Parameters:
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `category` (string): Filter by category
- `tags` (string): Comma-separated tags
- `sort` (string): Sort field (usage_count, created_at, title)
- `order` (string): Sort order (asc, desc)

Response:
```json
{
  "data": [
    {
      "id": "entry-123",
      "title": "VSAM Status 35 - File Not Found",
      "problem": "Job abends with VSAM status code 35...",
      "solution": "1. Verify the dataset exists...",
      "category": "VSAM",
      "tags": ["vsam", "status-35", "file-not-found"],
      "created_at": "2025-01-10T09:15:00Z",
      "updated_at": "2025-01-12T14:30:00Z",
      "usage_count": 45,
      "success_count": 38,
      "failure_count": 7,
      "success_rate": 0.844
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Get Knowledge Entry

```http
GET /api/v1/knowledge/entries/{id}
Authorization: Bearer TOKEN
```

Response:
```json
{
  "id": "entry-123",
  "title": "VSAM Status 35 - File Not Found",
  "problem": "Detailed problem description...",
  "solution": "Step-by-step solution...",
  "category": "VSAM",
  "tags": ["vsam", "status-35", "file-not-found"],
  "created_at": "2025-01-10T09:15:00Z",
  "updated_at": "2025-01-12T14:30:00Z",
  "created_by": "user-456",
  "usage_count": 45,
  "success_count": 38,
  "failure_count": 7,
  "success_rate": 0.844,
  "related_entries": ["entry-124", "entry-125"],
  "code_references": [
    {
      "file": "COBOL/FILEPROC.cbl",
      "lines": "145-160",
      "description": "File open logic"
    }
  ]
}
```

### Create Knowledge Entry

```http
POST /api/v1/knowledge/entries
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "title": "New Issue Resolution",
  "problem": "Description of the problem...",
  "solution": "Step-by-step solution...",
  "category": "JCL",
  "tags": ["jcl", "allocation", "error"]
}
```

Response:
```json
{
  "id": "entry-789",
  "title": "New Issue Resolution",
  "problem": "Description of the problem...",
  "solution": "Step-by-step solution...",
  "category": "JCL",
  "tags": ["jcl", "allocation", "error"],
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z",
  "created_by": "user-123",
  "usage_count": 0,
  "success_count": 0,
  "failure_count": 0,
  "success_rate": 0
}
```

### Update Knowledge Entry

```http
PUT /api/v1/knowledge/entries/{id}
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "title": "Updated Title",
  "solution": "Updated solution steps...",
  "tags": ["updated", "tags"]
}
```

### Delete Knowledge Entry

```http
DELETE /api/v1/knowledge/entries/{id}
Authorization: Bearer TOKEN
```

Response:
```json
{
  "message": "Knowledge entry deleted successfully",
  "id": "entry-123"
}
```

### Search Knowledge Base

```http
POST /api/v1/knowledge/search
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "query": "VSAM file error",
  "use_ai": true,
  "max_results": 10,
  "include_fuzzy": true,
  "filters": {
    "category": "VSAM",
    "tags": ["error"],
    "date_range": {
      "start": "2025-01-01",
      "end": "2025-01-15"
    }
  }
}
```

Response:
```json
{
  "query": "VSAM file error",
  "results": [
    {
      "entry": {
        "id": "entry-123",
        "title": "VSAM Status 35 - File Not Found",
        "problem": "Job abends with VSAM status code 35...",
        "solution": "1. Verify the dataset exists...",
        "category": "VSAM",
        "tags": ["vsam", "status-35", "file-not-found"]
      },
      "score": 95.5,
      "match_type": "ai",
      "highlights": {
        "title": ["<mark>VSAM</mark> Status 35"],
        "problem": ["<mark>VSAM</mark> <mark>file</mark> <mark>error</mark>"]
      }
    }
  ],
  "total_results": 5,
  "search_time_ms": 150,
  "ai_used": true
}
```

### Rate Knowledge Entry

```http
POST /api/v1/knowledge/entries/{id}/rate
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "successful": true,
  "feedback": "Solution worked perfectly",
  "resolution_time": 300
}
```

Response:
```json
{
  "message": "Rating recorded successfully",
  "updated_metrics": {
    "usage_count": 46,
    "success_count": 39,
    "failure_count": 7,
    "success_rate": 0.848
  }
}
```

## Pattern Detection API

*Available from MVP2+*

### List Patterns

```http
GET /api/v1/patterns
Authorization: Bearer TOKEN
```

Query Parameters:
- `active_only` (boolean): Only active patterns (default: true)
- `severity` (string): Filter by severity (critical, high, medium, low)
- `type` (string): Filter by type (temporal, component, error)
- `from_date` (string): Start date (ISO 8601)
- `to_date` (string): End date (ISO 8601)

Response:
```json
{
  "patterns": [
    {
      "id": "pattern-123",
      "type": "temporal",
      "severity": "high",
      "confidence": 92.5,
      "first_seen": "2025-01-14T08:00:00Z",
      "last_seen": "2025-01-15T10:30:00Z",
      "frequency": 8,
      "incidents": [
        {
          "id": "incident-456",
          "timestamp": "2025-01-15T10:30:00Z",
          "title": "VSAM File Access Error",
          "component": "FILE_PROCESSOR",
          "severity": "high"
        }
      ],
      "suggested_cause": "Multiple incidents in short time window",
      "suggested_action": "Check system health and recent changes",
      "related_kb_entries": ["entry-123", "entry-124"]
    }
  ],
  "total": 12,
  "active": 5,
  "critical": 1
}
```

### Get Pattern Details

```http
GET /api/v1/patterns/{id}
Authorization: Bearer TOKEN
```

Response:
```json
{
  "id": "pattern-123",
  "type": "temporal",
  "severity": "high",
  "confidence": 92.5,
  "first_seen": "2025-01-14T08:00:00Z",
  "last_seen": "2025-01-15T10:30:00Z",
  "frequency": 8,
  "incidents": [
    {
      "id": "incident-456",
      "ticket_id": "INC-789",
      "timestamp": "2025-01-15T10:30:00Z",
      "title": "VSAM File Access Error",
      "description": "Application unable to access VSAM file...",
      "component": "FILE_PROCESSOR",
      "severity": "high",
      "resolution": "Restarted file processor service",
      "resolution_time": 1800
    }
  ],
  "root_cause_analysis": {
    "possible_causes": [
      {
        "type": "system_overload",
        "description": "System experiencing high load",
        "confidence": 85,
        "evidence": ["CPU usage >90%", "Memory pressure alerts"],
        "suggestion": "Scale resources or optimize queries"
      }
    ]
  },
  "prevention_recommendations": [
    "Implement resource monitoring",
    "Set up proactive scaling",
    "Add circuit breakers"
  ]
}
```

### Create Incident

```http
POST /api/v1/incidents
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "ticket_id": "INC-123",
  "title": "Application Error",
  "description": "Application crashed with error code S0C7",
  "component": "PAYROLL_BATCH",
  "severity": "high",
  "reporter": "user-456"
}
```

### Trigger Pattern Analysis

```http
POST /api/v1/patterns/analyze
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "time_window_hours": 24,
  "min_incidents": 3,
  "similarity_threshold": 0.7
}
```

Response:
```json
{
  "analysis_id": "analysis-789",
  "status": "started",
  "estimated_completion": "2025-01-15T11:00:00Z",
  "message": "Pattern analysis started for last 24 hours"
}
```

## Code Analysis API

*Available from MVP3+*

### Upload Code File

```http
POST /api/v1/code/upload
Authorization: Bearer TOKEN
Content-Type: multipart/form-data

file: [COBOL file]
project_id: project-123
```

Response:
```json
{
  "file_id": "file-456",
  "name": "PAYROLL.cbl",
  "size": 15420,
  "project_id": "project-123",
  "parsed": true,
  "structure": {
    "program_name": "PAYROLL",
    "divisions": ["IDENTIFICATION", "ENVIRONMENT", "DATA", "PROCEDURE"],
    "paragraphs": 24,
    "variables": 156,
    "calls": 8
  },
  "upload_time": "2025-01-15T10:30:00Z"
}
```

### Parse Code File

```http
POST /api/v1/code/files/{id}/parse
Authorization: Bearer TOKEN
```

Response:
```json
{
  "file_id": "file-456",
  "parsed": true,
  "structure": {
    "program_name": "PAYROLL",
    "divisions": [
      {
        "name": "IDENTIFICATION",
        "start_line": 1,
        "end_line": 5
      },
      {
        "name": "DATA",
        "start_line": 20,
        "end_line": 180,
        "sections": [
          {
            "name": "WORKING-STORAGE",
            "start_line": 21,
            "end_line": 120
          }
        ]
      }
    ],
    "variables": [
      {
        "name": "WS-EMPLOYEE-REC",
        "level": "01",
        "line": 25,
        "type": "group"
      }
    ],
    "calls": [
      {
        "program": "VALIDATE",
        "line": 250,
        "context": "validation"
      }
    ]
  },
  "errors": [],
  "warnings": [
    {
      "line": 150,
      "message": "Unused variable WS-TEMP-COUNTER",
      "severity": "warning"
    }
  ]
}
```

### Analyze Code with AI

```http
POST /api/v1/code/files/{id}/analyze
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "analysis_type": "full",
  "sections": ["PROCEDURE"],
  "focus_areas": ["performance", "maintainability", "errors"]
}
```

Response:
```json
{
  "file_id": "file-456",
  "analysis": {
    "summary": "Code analysis completed. Found 2 potential improvements.",
    "issues": [
      {
        "line": 250,
        "severity": "medium",
        "type": "performance",
        "message": "Nested PERFORM loops may impact performance",
        "suggestion": "Consider restructuring with single loop"
      }
    ],
    "quality_score": 85,
    "complexity": "medium",
    "maintainability": "good"
  },
  "ai_insights": [
    "Program follows good naming conventions",
    "Error handling could be improved in file operations",
    "Consider adding more comments for complex calculations"
  ]
}
```

### Link Code to Knowledge

```http
POST /api/v1/code/links
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "kb_entry_id": "entry-123",
  "file_id": "file-456",
  "start_line": 245,
  "end_line": 260,
  "link_type": "error_location",
  "description": "VSAM file open error handling"
}
```

### Get Code References

```http
GET /api/v1/knowledge/entries/{id}/code-references
Authorization: Bearer TOKEN
```

Response:
```json
{
  "entry_id": "entry-123",
  "references": [
    {
      "file_id": "file-456",
      "file_name": "PAYROLL.cbl",
      "start_line": 245,
      "end_line": 260,
      "link_type": "error_location",
      "description": "VSAM file open error handling",
      "code_snippet": "IF VSAM-STATUS NOT = ZERO\n   DISPLAY 'VSAM ERROR: ' VSAM-STATUS\n   GO TO ABEND-ROUTINE\nEND-IF"
    }
  ]
}
```

## Template Management API

*Available from MVP4+*

### List Templates

```http
GET /api/v1/templates
Authorization: Bearer TOKEN
```

Query Parameters:
- `category` (string): Template category
- `language` (string): Programming language
- `success_rate_min` (float): Minimum success rate

Response:
```json
{
  "templates": [
    {
      "id": "template-123",
      "name": "VSAM File Error Handler",
      "description": "Standard error handling for VSAM files",
      "category": "error_handling",
      "language": "cobol",
      "parameters": [
        {
          "name": "file_name",
          "type": "string",
          "required": true,
          "description": "VSAM file name"
        }
      ],
      "success_rate": 0.92,
      "usage_count": 45,
      "created_at": "2025-01-10T09:15:00Z"
    }
  ]
}
```

### Generate Code from Template

```http
POST /api/v1/templates/{id}/generate
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "parameters": {
    "file_name": "EMPLOYEE-FILE",
    "error_routine": "ABEND-ROUTINE"
  }
}
```

Response:
```json
{
  "template_id": "template-123",
  "generated_code": "IF EMPLOYEE-FILE-STATUS NOT = ZERO\n   DISPLAY 'FILE ERROR: ' EMPLOYEE-FILE-STATUS\n   PERFORM ABEND-ROUTINE\nEND-IF",
  "parameters_used": {
    "file_name": "EMPLOYEE-FILE",
    "error_routine": "ABEND-ROUTINE"
  },
  "validation": {
    "syntax_valid": true,
    "warnings": []
  }
}
```

### Create Template

```http
POST /api/v1/templates
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "name": "Database Connection Handler",
  "description": "Standard DB2 connection handling",
  "category": "database",
  "language": "cobol",
  "template_code": "EXEC SQL CONNECT TO {{database_name}} END-EXEC",
  "parameters": [
    {
      "name": "database_name",
      "type": "string",
      "required": true
    }
  ]
}
```

## Analytics API

*Available from MVP2+*

### System Metrics

```http
GET /api/v1/analytics/metrics
Authorization: Bearer TOKEN
```

Query Parameters:
- `period` (string): Time period (1h, 24h, 7d, 30d)
- `metrics` (string): Comma-separated metric names

Response:
```json
{
  "period": "24h",
  "timestamp": "2025-01-15T10:30:00Z",
  "metrics": {
    "searches": {
      "total": 1250,
      "successful": 1180,
      "failed": 70,
      "avg_response_time": 850
    },
    "knowledge_base": {
      "total_entries": 1540,
      "new_entries": 12,
      "most_used": [
        {
          "id": "entry-123",
          "title": "VSAM Status 35",
          "usage_count": 45
        }
      ]
    },
    "patterns": {
      "detected": 8,
      "critical": 1,
      "resolved": 6
    },
    "incidents": {
      "total": 156,
      "resolved": 142,
      "auto_resolved": 89,
      "avg_resolution_time": 1800
    }
  }
}
```

### Usage Statistics

```http
GET /api/v1/analytics/usage
Authorization: Bearer TOKEN
```

Response:
```json
{
  "period": "30d",
  "users": {
    "total": 45,
    "active": 38,
    "new": 3
  },
  "top_searches": [
    {
      "query": "VSAM error",
      "count": 156,
      "success_rate": 0.89
    }
  ],
  "category_distribution": {
    "VSAM": 35,
    "JCL": 28,
    "DB2": 22,
    "Batch": 15
  },
  "resolution_trends": [
    {
      "date": "2025-01-14",
      "total_incidents": 25,
      "resolved": 23,
      "avg_time": 1650
    }
  ]
}
```

### Performance Report

```http
GET /api/v1/analytics/performance
Authorization: Bearer TOKEN
```

Response:
```json
{
  "report_date": "2025-01-15T10:30:00Z",
  "performance": {
    "search_performance": {
      "avg_response_time": 850,
      "p95_response_time": 1200,
      "p99_response_time": 2100,
      "cache_hit_rate": 0.78
    },
    "database_performance": {
      "query_time": 45,
      "connection_pool_usage": 0.65,
      "slow_queries": 3
    },
    "ai_service_performance": {
      "avg_response_time": 1500,
      "success_rate": 0.96,
      "rate_limit_hits": 5
    }
  },
  "recommendations": [
    "Consider increasing cache TTL",
    "Add index on frequently queried columns",
    "Monitor AI service rate limits"
  ]
}
```

## Plugin API

### List Plugins

```http
GET /api/v1/plugins
Authorization: Bearer TOKEN
```

Response:
```json
{
  "plugins": [
    {
      "id": "plugin-123",
      "name": "VSAM Plugin",
      "version": "1.2.0",
      "status": "active",
      "capabilities": ["search", "analysis"],
      "health": "healthy",
      "last_activity": "2025-01-15T10:25:00Z"
    }
  ]
}
```

### Plugin Health Check

```http
GET /api/v1/plugins/{id}/health
Authorization: Bearer TOKEN
```

### Execute Plugin Operation

```http
POST /api/v1/plugins/{id}/execute
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "operation": "analyze_pattern",
  "data": {
    "incidents": ["incident-123", "incident-124"]
  }
}
```

## Monitoring API

### Get System Status

```http
GET /api/v1/monitoring/status
Authorization: Bearer TOKEN
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "components": {
    "api": "healthy",
    "database": "healthy",
    "cache": "healthy",
    "ai_service": "degraded",
    "plugins": "healthy"
  },
  "alerts": [
    {
      "id": "alert-123",
      "type": "warning",
      "message": "AI service response time elevated",
      "timestamp": "2025-01-15T10:25:00Z"
    }
  ]
}
```

### Get Metrics

```http
GET /api/v1/monitoring/metrics
Authorization: Bearer TOKEN
```

### System Logs

```http
GET /api/v1/monitoring/logs
Authorization: Bearer TOKEN
```

Query Parameters:
- `level` (string): Log level (error, warn, info, debug)
- `component` (string): Component name
- `from` (string): Start timestamp
- `to` (string): End timestamp
- `limit` (integer): Max results

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "category",
        "message": "Category must be one of: JCL, VSAM, DB2, Batch, Functional"
      }
    ],
    "request_id": "req-123456789",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### HTTP Status Codes

| Status Code | Description | Usage |
|-------------|-------------|-------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Upstream service error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Request validation failed |
| AUTHENTICATION_ERROR | Authentication failed |
| AUTHORIZATION_ERROR | Insufficient permissions |
| RESOURCE_NOT_FOUND | Requested resource not found |
| RESOURCE_CONFLICT | Resource already exists |
| RATE_LIMIT_EXCEEDED | Too many requests |
| SERVICE_UNAVAILABLE | External service unavailable |
| INTERNAL_ERROR | Internal server error |

## Rate Limiting

### Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1642248000
X-RateLimit-Window: 3600
```

### Rate Limits by Plan

| Plan | Requests/Hour | Search/Hour | AI Calls/Hour |
|------|---------------|-------------|---------------|
| Basic | 1,000 | 500 | 100 |
| Pro | 10,000 | 5,000 | 1,000 |
| Enterprise | 100,000 | 50,000 | 10,000 |

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "retry_after": 60,
    "limit": 1000,
    "window": 3600
  }
}
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.example.com/v1/ws');
ws.onopen = () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};
```

### Real-time Pattern Alerts

```javascript
// Subscribe to pattern alerts
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'pattern_alerts',
  filters: {
    severity: ['critical', 'high']
  }
}));

// Receive alerts
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'pattern_alert') {
    console.log('New pattern detected:', data.pattern);
  }
};
```

### Real-time Metrics

```javascript
// Subscribe to metrics
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'metrics',
  interval: 5000 // 5 seconds
}));
```

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
import { MainframeAIClient } from '@mainframe-ai/sdk';

const client = new MainframeAIClient({
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'your_api_key'
});

// Search knowledge base
const results = await client.knowledge.search({
  query: 'VSAM error',
  useAI: true,
  maxResults: 10
});

// Create knowledge entry
const entry = await client.knowledge.create({
  title: 'New Solution',
  problem: 'Problem description',
  solution: 'Solution steps',
  category: 'VSAM',
  tags: ['vsam', 'error']
});

// Get patterns
const patterns = await client.patterns.list({
  activeOnly: true,
  severity: 'high'
});
```

### Python SDK

```python
from mainframe_ai import MainframeAIClient

client = MainframeAIClient(
    base_url='https://api.example.com/v1',
    api_key='your_api_key'
)

# Search knowledge base
results = client.knowledge.search(
    query='VSAM error',
    use_ai=True,
    max_results=10
)

# Create incident
incident = client.incidents.create(
    ticket_id='INC-123',
    title='Application Error',
    description='Application crashed',
    component='PAYROLL',
    severity='high'
)

# Get analytics
metrics = client.analytics.get_metrics(period='24h')
```

### cURL Examples

#### Search Knowledge Base

```bash
curl -X POST https://api.example.com/v1/knowledge/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "VSAM file error",
    "use_ai": true,
    "max_results": 10
  }'
```

#### Create Knowledge Entry

```bash
curl -X POST https://api.example.com/v1/knowledge/entries \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "S0C7 Data Exception",
    "problem": "Program abends with S0C7",
    "solution": "Check numeric fields",
    "category": "Batch",
    "tags": ["s0c7", "abend", "numeric"]
  }'
```

#### Get System Status

```bash
curl -X GET https://api.example.com/v1/monitoring/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This comprehensive API reference provides complete documentation for all storage service endpoints across all MVP phases, enabling developers to effectively integrate with the Mainframe AI Assistant platform.