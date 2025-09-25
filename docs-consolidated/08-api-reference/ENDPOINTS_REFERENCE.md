# API Endpoints Reference - Sistema de Gestão de Incidentes
## Referência Completa de Endpoints - Versão 2.0

### 📋 Índice
1. [Dashboard & Metrics](#dashboard--metrics)
2. [Incident Management](#incident-management)
3. [Knowledge Base](#knowledge-base)
4. [Search & AI](#search--ai)
5. [User Management](#user-management)
6. [Authentication](#authentication)
7. [System Administration](#system-administration)
8. [File Management](#file-management)
9. [Reporting](#reporting)
10. [WebHooks](#webhooks)

---

## Dashboard & Metrics

### GET /api/v1/dashboard/overview

Retorna visão geral do sistema com métricas principais.

#### Parâmetros
- **period** (query, optional): Período para métricas (`24h`, `7d`, `30d`, `90d`)
- **timezone** (query, optional): Timezone para cálculos (`UTC`, `America/Sao_Paulo`)

#### Exemplo de Request
```bash
curl -X GET "https://api.incident-system.com/v1/dashboard/overview?period=30d" \
  -H "Authorization: Bearer $TOKEN"
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_incidents": 1250,
      "open_incidents": 45,
      "in_progress_incidents": 23,
      "resolved_incidents": 1182,
      "knowledge_articles": 450
    },
    "metrics": {
      "avg_resolution_time": 4.5,
      "resolution_rate": 0.94,
      "sla_compliance": 0.87,
      "customer_satisfaction": 4.2
    },
    "trends": {
      "incidents_trend": "+5%",
      "resolution_trend": "-12%",
      "knowledge_usage_trend": "+18%"
    }
  }
}
```

### GET /api/v1/dashboard/metrics

Métricas detalhadas para dashboards.

#### Parâmetros
- **metrics** (query, optional): Lista de métricas (`incidents,resolution_time,sla`)
- **group_by** (query, optional): Agrupamento (`day`, `week`, `month`, `technical_area`)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "incident_metrics": {
      "by_status": {
        "OPEN": 45,
        "IN_PROGRESS": 23,
        "RESOLVED": 1182,
        "CLOSED": 1150
      },
      "by_priority": {
        "LOW": 234,
        "MEDIUM": 567,
        "HIGH": 345,
        "CRITICAL": 104
      },
      "by_technical_area": {
        "database": 245,
        "network": 189,
        "application": 456,
        "infrastructure": 360
      }
    },
    "time_series": [
      {
        "date": "2024-09-01",
        "incidents_created": 15,
        "incidents_resolved": 18,
        "avg_resolution_time": 3.2
      }
    ]
  }
}
```

---

## Incident Management

### GET /api/v1/incidents

Lista incidentes com filtros e paginação.

#### Parâmetros de Query
- **status** (string): Filtro por status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`)
- **priority** (string): Filtro por prioridade (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- **technical_area** (string): Área técnica
- **assigned_to** (UUID): ID do usuário assignado
- **created_after** (date): Data de criação mínima (ISO 8601)
- **created_before** (date): Data de criação máxima (ISO 8601)
- **search** (string): Busca textual em título e descrição
- **page** (integer): Página atual (padrão: 1)
- **limit** (integer): Items por página (padrão: 20, max: 100)
- **sort** (string): Campo para ordenação (`created_at`, `priority`, `status`)
- **order** (string): Direção da ordenação (`asc`, `desc`)

#### Exemplo de Request
```bash
curl -X GET "https://api.incident-system.com/v1/incidents?status=OPEN&priority=HIGH&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Database Connection Timeout",
      "description": "PostgreSQL connection timing out after 30 seconds",
      "status": "OPEN",
      "priority": "HIGH",
      "severity": "MAJOR",
      "technical_area": "database",
      "business_area": "operations",
      "assigned_to": {
        "id": "user-uuid",
        "name": "João Silva",
        "email": "joao.silva@empresa.com"
      },
      "reporter": {
        "id": "reporter-uuid",
        "name": "Maria Santos",
        "email": "maria.santos@empresa.com"
      },
      "resolution": null,
      "tags": ["database", "timeout", "postgresql"],
      "created_at": "2024-09-24T10:30:00Z",
      "updated_at": "2024-09-24T10:30:00Z",
      "resolved_at": null,
      "sla_due_at": "2024-09-25T10:30:00Z",
      "metadata": {
        "source_system": "monitoring",
        "affected_users": 150,
        "error_code": "DB_TIMEOUT_001"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 245,
      "pages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### POST /api/v1/incidents

Cria um novo incidente.

#### Request Body
```json
{
  "title": "Database Connection Error",
  "description": "PostgreSQL database is not responding. Connection timeout after 30 seconds. Affecting user authentication and data access.",
  "priority": "HIGH",
  "severity": "MAJOR",
  "technical_area": "database",
  "business_area": "operations",
  "assigned_to": "user-uuid-optional",
  "tags": ["database", "timeout", "postgresql"],
  "metadata": {
    "affected_systems": ["auth-service", "user-portal"],
    "error_logs": "Connection timeout...",
    "monitoring_url": "https://monitor.com/alerts/123"
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Database Connection Error",
    "status": "OPEN",
    "created_at": "2024-09-24T10:30:00Z",
    "sla_due_at": "2024-09-25T10:30:00Z"
  },
  "meta": {
    "message": "Incidente criado com sucesso",
    "ai_suggestions": [
      {
        "type": "similar_incidents",
        "message": "Encontrados 3 incidentes similares",
        "data": ["incident-uuid-1", "incident-uuid-2"]
      },
      {
        "type": "suggested_assignment",
        "message": "Recomendado para DBA Team",
        "data": {"team": "dba", "confidence": 0.85}
      }
    ]
  }
}
```

### GET /api/v1/incidents/{id}

Busca incidente específico por ID.

#### Parâmetros de Path
- **id** (UUID): ID do incidente

#### Parâmetros de Query
- **include** (string): Dados adicionais (`history`, `comments`, `attachments`, `similar`)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Database Connection Timeout",
    "description": "PostgreSQL connection timing out after 30 seconds",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "severity": "MAJOR",
    "technical_area": "database",
    "business_area": "operations",
    "assigned_to": {
      "id": "user-uuid",
      "name": "João Silva",
      "email": "joao.silva@empresa.com",
      "role": "dba"
    },
    "reporter": {
      "id": "reporter-uuid",
      "name": "Maria Santos",
      "email": "maria.santos@empresa.com"
    },
    "resolution": "Increased connection pool size and optimized queries",
    "tags": ["database", "timeout", "postgresql"],
    "created_at": "2024-09-24T10:30:00Z",
    "updated_at": "2024-09-24T14:15:00Z",
    "resolved_at": "2024-09-24T14:15:00Z",
    "sla_due_at": "2024-09-25T10:30:00Z",
    "sla_status": "met",
    "time_to_resolution": 3.75,
    "history": [
      {
        "timestamp": "2024-09-24T10:30:00Z",
        "action": "created",
        "user": "maria.santos@empresa.com",
        "details": "Incident created"
      },
      {
        "timestamp": "2024-09-24T11:00:00Z",
        "action": "assigned",
        "user": "system",
        "details": "Assigned to joão.silva@empresa.com"
      },
      {
        "timestamp": "2024-09-24T14:15:00Z",
        "action": "resolved",
        "user": "joao.silva@empresa.com",
        "details": "Resolution provided and tested"
      }
    ],
    "similar_incidents": [
      {
        "id": "incident-uuid-1",
        "title": "PostgreSQL Connection Pool Exhausted",
        "similarity_score": 0.87,
        "resolution_summary": "Increased max_connections parameter"
      }
    ],
    "knowledge_articles": [
      {
        "id": "kb-uuid-1",
        "title": "Troubleshooting Database Connection Issues",
        "relevance_score": 0.92,
        "url": "/api/v1/knowledge/kb-uuid-1"
      }
    ]
  }
}
```

### PUT /api/v1/incidents/{id}

Atualiza incidente existente.

#### Request Body (Partial Update)
```json
{
  "status": "RESOLVED",
  "resolution": "Fixed by increasing database connection pool size from 20 to 50 connections and optimizing slow queries identified in pg_stat_statements.",
  "assigned_to": "user-uuid",
  "priority": "MEDIUM",
  "tags": ["database", "timeout", "postgresql", "resolved"],
  "metadata": {
    "resolution_time": 3.75,
    "solution_verified": true,
    "post_resolution_monitoring": "24h"
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "updated_fields": ["status", "resolution", "updated_at", "resolved_at"],
    "status": "RESOLVED",
    "resolved_at": "2024-09-24T14:15:00Z"
  },
  "meta": {
    "message": "Incidente atualizado com sucesso",
    "automatic_actions": [
      {
        "action": "knowledge_base_creation",
        "status": "queued",
        "message": "Artigo da base de conhecimento será criado automaticamente"
      },
      {
        "action": "notification_sent",
        "recipients": ["reporter", "watchers"],
        "message": "Notificações enviadas para interessados"
      }
    ]
  }
}
```

### DELETE /api/v1/incidents/{id}

Remove incidente (apenas administradores).

#### Response (204 No Content)
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "meta": {
    "message": "Incidente removido permanentemente",
    "warning": "Esta ação não pode ser desfeita"
  }
}
```

### POST /api/v1/incidents/{id}/comments

Adiciona comentário ao incidente.

#### Request Body
```json
{
  "content": "Investigating the connection pool settings. Found that max_connections is set to 20, which seems low for the current load.",
  "type": "investigation",
  "visibility": "public",
  "mentions": ["user-uuid-1", "user-uuid-2"]
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "comment-uuid",
    "content": "Investigating the connection pool settings...",
    "author": {
      "id": "user-uuid",
      "name": "João Silva"
    },
    "created_at": "2024-09-24T12:30:00Z",
    "type": "investigation"
  }
}
```

---

## Knowledge Base

### GET /api/v1/knowledge

Lista artigos da base de conhecimento.

#### Parâmetros de Query
- **category** (string): Filtro por categoria
- **tags** (string): Filtro por tags (separadas por vírgula)
- **confidence_min** (float): Score mínimo de confiança (0-1)
- **search** (string): Busca textual
- **created_after** (date): Data mínima de criação
- **used_after** (date): Filtro por uso recente
- **page**, **limit**, **sort**, **order**: Paginação padrão

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "kb-550e8400-e29b-41d4-a716-446655440000",
      "uuid": "kb-550e8400-e29b-41d4-a716-446655440000",
      "title": "Database Connection Timeout Resolution",
      "summary": "How to resolve PostgreSQL connection timeout issues by optimizing connection pool settings and identifying slow queries.",
      "category": "database",
      "tags": ["database", "postgresql", "timeout", "connection-pool"],
      "confidence_score": 0.95,
      "usage_count": 45,
      "last_used_at": "2024-09-24T10:00:00Z",
      "source": "incident_resolution",
      "source_incident_id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2024-09-24T14:30:00Z",
      "updated_at": "2024-09-24T14:30:00Z",
      "author": {
        "id": "user-uuid",
        "name": "João Silva",
        "role": "dba"
      }
    }
  ]
}
```

### GET /api/v1/knowledge/{id}

Busca artigo específico da base de conhecimento.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "kb-550e8400-e29b-41d4-a716-446655440000",
    "title": "Database Connection Timeout Resolution",
    "content": "# Database Connection Timeout Resolution\n\n## Problem Description\nPostgreSQL connection timeouts occurring after 30 seconds...\n\n## Root Cause Analysis\n1. Low connection pool size (max_connections = 20)\n2. Slow queries consuming connections\n3. No connection pooling at application level\n\n## Solution Steps\n1. **Increase connection pool size:**\n   ```sql\n   ALTER SYSTEM SET max_connections = 100;\n   SELECT pg_reload_conf();\n   ```\n\n2. **Identify and optimize slow queries:**\n   ```sql\n   SELECT query, mean_time, calls\n   FROM pg_stat_statements\n   WHERE mean_time > 1000\n   ORDER BY mean_time DESC;\n   ```\n\n3. **Implement connection pooling:**\n   - Use PgBouncer or similar\n   - Configure pool size based on workload\n\n## Verification Steps\n1. Monitor connection count: `SELECT count(*) FROM pg_stat_activity;`\n2. Check for timeouts in application logs\n3. Verify response times improved\n\n## Prevention\n- Set up monitoring for connection count\n- Regular query performance reviews\n- Implement connection pool monitoring",
    "summary": "Complete guide for resolving PostgreSQL connection timeout issues",
    "category": "database",
    "tags": ["database", "postgresql", "timeout", "connection-pool", "performance"],
    "confidence_score": 0.95,
    "usage_count": 45,
    "source": "incident_resolution",
    "source_incident_id": "550e8400-e29b-41d4-a716-446655440000",
    "related_incidents": [
      {
        "id": "incident-uuid-1",
        "title": "PostgreSQL Performance Issues",
        "status": "RESOLVED"
      }
    ],
    "related_articles": [
      {
        "id": "kb-uuid-2",
        "title": "PostgreSQL Performance Tuning",
        "similarity_score": 0.78
      }
    ],
    "feedback": {
      "helpful_votes": 42,
      "total_votes": 45,
      "avg_rating": 4.7
    }
  }
}
```

### POST /api/v1/knowledge

Cria novo artigo na base de conhecimento.

#### Request Body
```json
{
  "title": "How to Configure Redis Clustering",
  "content": "# Redis Clustering Configuration\n\n## Overview\nRedis clustering provides high availability and horizontal scaling...\n\n## Configuration Steps\n1. Setup cluster nodes\n2. Configure cluster settings\n3. Initialize cluster\n\n## Testing\nValidate cluster health and failover scenarios.",
  "summary": "Complete guide for setting up Redis clustering for high availability",
  "category": "database",
  "tags": ["redis", "clustering", "high-availability", "scaling"],
  "confidence_score": 0.9,
  "source": "manual_creation"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "kb-new-uuid",
    "title": "How to Configure Redis Clustering",
    "created_at": "2024-09-24T15:00:00Z",
    "url": "/api/v1/knowledge/kb-new-uuid"
  }
}
```

### PUT /api/v1/knowledge/{id}/feedback

Registra feedback sobre artigo da base de conhecimento.

#### Request Body
```json
{
  "helpful": true,
  "rating": 5,
  "comment": "Very helpful, solved my Redis clustering issue quickly",
  "context": {
    "used_for_incident": "incident-uuid-optional",
    "resolution_successful": true
  }
}
```

---

## Search & AI

### POST /api/v1/search/unified

Busca unificada em incidentes e base de conhecimento.

#### Request Body
```json
{
  "query": "database connection timeout postgresql",
  "types": ["incidents", "knowledge"],
  "filters": {
    "technical_areas": ["database"],
    "priority": ["HIGH", "CRITICAL"],
    "date_range": {
      "start": "2024-09-01",
      "end": "2024-09-30"
    }
  },
  "options": {
    "fuzzy_matching": true,
    "semantic_search": true,
    "include_resolved": true,
    "highlight_matches": true
  },
  "pagination": {
    "limit": 20,
    "offset": 0
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "type": "incident",
        "title": "Database Connection Timeout",
        "snippet": "PostgreSQL <em>connection</em> timing out after 30 seconds...",
        "relevance_score": 0.95,
        "status": "RESOLVED",
        "created_at": "2024-09-24T10:30:00Z",
        "matches": {
          "title": ["database", "connection", "timeout"],
          "description": ["postgresql", "connection"]
        }
      },
      {
        "id": "kb-uuid-1",
        "type": "knowledge",
        "title": "Database Connection Timeout Resolution",
        "snippet": "Complete guide for resolving <em>PostgreSQL</em> connection <em>timeout</em> issues...",
        "relevance_score": 0.92,
        "confidence_score": 0.95,
        "usage_count": 45,
        "category": "database"
      }
    ],
    "aggregations": {
      "by_type": {
        "incidents": 15,
        "knowledge": 8
      },
      "by_category": {
        "database": 12,
        "network": 6,
        "application": 5
      },
      "by_status": {
        "OPEN": 3,
        "RESOLVED": 12
      }
    },
    "suggestions": [
      "connection pool",
      "timeout configuration",
      "postgresql performance"
    ]
  },
  "meta": {
    "total": 23,
    "search_time": "0.045s",
    "ai_enhanced": true
  }
}
```

### POST /api/v1/search/semantic

Busca semântica utilizando IA para compreensão de contexto.

#### Request Body
```json
{
  "query": "Como resolver problemas de lentidão na aplicação web?",
  "context": {
    "technical_areas": ["application", "performance"],
    "user_role": "developer",
    "incident_context": "incident-uuid-optional"
  },
  "options": {
    "similarity_threshold": 0.7,
    "include_reasoning": true,
    "max_results": 10,
    "personalized": true
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "kb-perf-001",
        "type": "knowledge",
        "title": "Web Application Performance Troubleshooting",
        "semantic_match": "Performance optimization techniques for web applications",
        "similarity_score": 0.89,
        "relevance_reasoning": "This article covers systematic approach to diagnosing and fixing web application slowness, including database optimization, caching strategies, and frontend performance.",
        "key_concepts": ["performance", "optimization", "web application", "troubleshooting"],
        "solution_steps": [
          "Identify bottlenecks using profiling tools",
          "Optimize database queries",
          "Implement caching strategies",
          "Optimize frontend assets"
        ]
      }
    ],
    "ai_insights": {
      "query_intent": "troubleshooting_performance",
      "suggested_actions": [
        "Check application logs for errors",
        "Monitor database query performance",
        "Review server resource utilization"
      ],
      "related_concepts": [
        "database optimization",
        "caching strategies",
        "load balancing",
        "code profiling"
      ]
    }
  }
}
```

### POST /api/v1/ai/categorize

Categorização automática de incidentes usando IA.

#### Request Body
```json
{
  "title": "Website is loading very slowly for all users",
  "description": "Since this morning, our main website takes more than 30 seconds to load. Users are complaining about timeouts. The database seems fine but CPU usage on web servers is high.",
  "context": {
    "source": "user_report",
    "affected_systems": ["website", "web_servers"],
    "symptoms": ["slow_loading", "high_cpu", "user_complaints"]
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "suggested_category": "performance",
    "confidence": 0.92,
    "reasoning": "Based on the description mentioning slow loading times, high CPU usage, and user complaints about timeouts, this appears to be a performance-related issue affecting web services.",
    "suggested_fields": {
      "priority": "HIGH",
      "severity": "MAJOR",
      "technical_area": "performance",
      "business_area": "operations",
      "tags": ["performance", "website", "timeout", "high_cpu"]
    },
    "similar_incidents": [
      {
        "id": "incident-uuid-1",
        "title": "High CPU causing slow website response",
        "similarity_score": 0.87,
        "resolution": "Optimized database queries and implemented caching"
      }
    ],
    "suggested_assignments": [
      {
        "team": "performance_team",
        "confidence": 0.85,
        "reasoning": "Performance team has expertise in web optimization"
      },
      {
        "user": "john.smith@empresa.com",
        "confidence": 0.78,
        "reasoning": "Previously resolved similar high CPU performance issues"
      }
    ]
  }
}
```

### POST /api/v1/ai/suggest-solution

Sugestões de solução baseadas em IA e base de conhecimento.

#### Request Body
```json
{
  "incident_id": "550e8400-e29b-41d4-a716-446655440000",
  "current_investigation": "Checked database connections, all seem normal. CPU usage on web servers is at 95%. Memory usage normal.",
  "context": {
    "technical_area": "performance",
    "attempted_solutions": ["restarted_services", "checked_database"],
    "current_symptoms": ["high_cpu", "slow_response", "user_complaints"]
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "type": "immediate_action",
        "title": "Check for Resource-Intensive Processes",
        "confidence": 0.89,
        "steps": [
          "Run 'top' or 'htop' to identify CPU-intensive processes",
          "Check for runaway processes or memory leaks",
          "Review recent deployments or configuration changes"
        ],
        "expected_outcome": "Identify specific processes causing high CPU usage",
        "estimated_time": "5-10 minutes"
      },
      {
        "type": "investigation",
        "title": "Analyze Application Performance Metrics",
        "confidence": 0.82,
        "steps": [
          "Review application performance monitoring (APM) data",
          "Check slow query logs in database",
          "Examine web server access logs for patterns"
        ],
        "knowledge_sources": ["kb-perf-001", "kb-monitoring-best-practices"]
      },
      {
        "type": "solution",
        "title": "Implement Performance Optimization",
        "confidence": 0.76,
        "steps": [
          "Enable query caching if not already active",
          "Implement connection pooling for database",
          "Consider scaling web servers horizontally"
        ],
        "based_on_incident": "incident-uuid-similar",
        "success_rate": 0.85
      }
    ],
    "prevention_recommendations": [
      "Set up proactive monitoring for CPU usage thresholds",
      "Implement automated scaling policies",
      "Regular performance testing and optimization reviews"
    ],
    "escalation_criteria": [
      "If CPU usage remains above 90% for more than 30 minutes",
      "If user complaints increase significantly",
      "If database starts showing signs of stress"
    ]
  }
}
```

---

## User Management

### GET /api/v1/users

Lista usuários do sistema (apenas administradores).

#### Parâmetros de Query
- **role** (string): Filtro por papel (`user`, `analyst`, `manager`, `admin`)
- **active** (boolean): Filtro por status ativo
- **search** (string): Busca por nome ou email
- **department** (string): Filtro por departamento

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid-1",
      "email": "joao.silva@empresa.com",
      "name": "João Silva",
      "role": "analyst",
      "department": "IT",
      "active": true,
      "last_login": "2024-09-24T09:15:00Z",
      "created_at": "2024-01-15T10:00:00Z",
      "profile": {
        "phone": "+55 11 99999-9999",
        "timezone": "America/Sao_Paulo",
        "language": "pt-BR",
        "notifications": {
          "email": true,
          "sms": false,
          "push": true
        }
      },
      "stats": {
        "incidents_assigned": 15,
        "incidents_resolved": 12,
        "avg_resolution_time": 4.2,
        "knowledge_articles_created": 3
      }
    }
  ]
}
```

### POST /api/v1/users

Cria novo usuário (apenas administradores).

#### Request Body
```json
{
  "email": "novo.usuario@empresa.com",
  "name": "Novo Usuário",
  "password": "senha-temporaria-123",
  "role": "analyst",
  "department": "IT",
  "profile": {
    "phone": "+55 11 88888-8888",
    "timezone": "America/Sao_Paulo",
    "language": "pt-BR"
  },
  "settings": {
    "force_password_change": true,
    "require_2fa": true,
    "send_welcome_email": true
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "new-user-uuid",
    "email": "novo.usuario@empresa.com",
    "name": "Novo Usuário",
    "role": "analyst",
    "active": true,
    "created_at": "2024-09-24T15:30:00Z",
    "temporary_password": "senha-temporaria-123"
  },
  "meta": {
    "message": "Usuário criado com sucesso",
    "actions": [
      "Welcome email sent",
      "Temporary password generated",
      "2FA setup required on first login"
    ]
  }
}
```

### GET /api/v1/users/me

Retorna dados do usuário atual.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "current-user-uuid",
    "email": "usuario.atual@empresa.com",
    "name": "Usuário Atual",
    "role": "analyst",
    "permissions": [
      "incidents.read",
      "incidents.create",
      "incidents.update_own",
      "knowledge.read",
      "knowledge.create"
    ],
    "profile": {
      "timezone": "America/Sao_Paulo",
      "language": "pt-BR",
      "theme": "light",
      "notifications": {
        "email": true,
        "push": true,
        "incident_assignments": true,
        "incident_updates": true,
        "knowledge_updates": false
      }
    },
    "stats": {
      "incidents_assigned": 8,
      "incidents_resolved_this_month": 5,
      "knowledge_articles_accessed": 23,
      "avg_resolution_time": 3.8
    },
    "preferences": {
      "dashboard_layout": "compact",
      "default_incident_view": "assigned_to_me",
      "auto_refresh_interval": 300
    }
  }
}
```

### PUT /api/v1/users/me

Atualiza perfil do usuário atual.

#### Request Body
```json
{
  "name": "Nome Atualizado",
  "profile": {
    "phone": "+55 11 77777-7777",
    "timezone": "America/Sao_Paulo",
    "language": "en-US",
    "theme": "dark"
  },
  "notifications": {
    "email": true,
    "push": false,
    "incident_assignments": true
  },
  "preferences": {
    "dashboard_layout": "expanded",
    "auto_refresh_interval": 60
  }
}
```

---

## Authentication

### POST /api/v1/auth/login

Autenticação de usuário com suporte a 2FA.

#### Request Body
```json
{
  "email": "usuario@empresa.com",
  "password": "senha-segura",
  "twoFactorToken": "123456",
  "rememberMe": true,
  "deviceInfo": {
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "ipAddress": "192.168.1.100",
    "deviceName": "Desktop - Chrome"
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "usuario@empresa.com",
      "name": "Usuário Sistema",
      "role": "analyst",
      "permissions": ["incidents.read", "incidents.create"],
      "preferences": {
        "theme": "light",
        "language": "pt-BR"
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 86400,
      "tokenType": "Bearer"
    },
    "session": {
      "id": "session-uuid",
      "expiresAt": "2024-09-25T10:30:00Z",
      "device": "Desktop - Chrome"
    }
  },
  "meta": {
    "loginTime": "2024-09-24T10:30:00Z",
    "lastLogin": "2024-09-23T14:20:00Z",
    "failedAttempts": 0,
    "accountStatus": "active"
  }
}
```

#### Response (400 Bad Request) - 2FA Required
```json
{
  "success": false,
  "error": {
    "code": "2FA_REQUIRED",
    "message": "Autenticação de dois fatores obrigatória",
    "details": {
      "methods": ["totp", "sms", "backup_codes"],
      "challenge_token": "temp-challenge-token-uuid"
    }
  }
}
```

### POST /api/v1/auth/refresh

Renovação de token de acesso.

#### Request Body
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer"
  }
}
```

### POST /api/v1/auth/logout

Encerramento de sessão.

#### Request Body
```json
{
  "all_devices": false
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "logged_out": true,
    "session_id": "session-uuid",
    "logout_time": "2024-09-24T18:00:00Z"
  },
  "meta": {
    "message": "Logout realizado com sucesso"
  }
}
```

### POST /api/v1/auth/forgot-password

Solicitação de reset de senha.

#### Request Body
```json
{
  "email": "usuario@empresa.com"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "message": "Se o email existir no sistema, instruções de reset foram enviadas"
  },
  "meta": {
    "request_id": "reset-request-uuid",
    "expires_in": 3600
  }
}
```

---

## System Administration

### GET /api/v1/admin/system/health

Health check detalhado do sistema (apenas administradores).

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "2.0.0",
    "uptime": 86400,
    "timestamp": "2024-09-24T10:30:00Z",
    "services": {
      "database": {
        "status": "healthy",
        "response_time": "0.045s",
        "connections": {
          "active": 15,
          "max": 100,
          "percentage": 15
        }
      },
      "redis": {
        "status": "healthy",
        "memory_usage": "45MB",
        "hit_ratio": 0.94
      },
      "external_apis": {
        "openai": {
          "status": "healthy",
          "last_check": "2024-09-24T10:25:00Z",
          "response_time": "0.245s"
        },
        "gemini": {
          "status": "healthy",
          "last_check": "2024-09-24T10:25:00Z"
        }
      }
    },
    "metrics": {
      "requests_per_minute": 45,
      "avg_response_time": "0.120s",
      "error_rate": 0.002,
      "memory_usage": {
        "used": "1.2GB",
        "total": "8GB",
        "percentage": 15
      },
      "disk_usage": {
        "used": "45GB",
        "total": "500GB",
        "percentage": 9
      }
    }
  }
}
```

### GET /api/v1/admin/system/metrics

Métricas detalhadas do sistema.

#### Parâmetros de Query
- **period** (string): Período (`1h`, `24h`, `7d`, `30d`)
- **metric_type** (string): Tipo específico (`performance`, `usage`, `errors`)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "performance": {
      "avg_response_time": 0.120,
      "p95_response_time": 0.450,
      "p99_response_time": 0.890,
      "requests_per_second": 12.5,
      "error_rate": 0.002
    },
    "database": {
      "query_performance": {
        "avg_query_time": 0.035,
        "slow_queries_count": 3,
        "deadlock_count": 0
      },
      "connections": {
        "current": 15,
        "max_reached": 34,
        "average": 18.5
      }
    },
    "resources": {
      "cpu": {
        "current": 25.5,
        "average": 22.1,
        "peak": 78.9
      },
      "memory": {
        "used_gb": 1.2,
        "available_gb": 6.8,
        "peak_usage": 2.1
      }
    },
    "api_usage": {
      "total_requests": 15420,
      "by_endpoint": {
        "/api/v1/incidents": 8950,
        "/api/v1/search": 3420,
        "/api/v1/knowledge": 2100
      },
      "by_user_role": {
        "admin": 1200,
        "analyst": 8900,
        "user": 5320
      }
    }
  }
}
```

### POST /api/v1/admin/system/maintenance

Colocar sistema em modo de manutenção.

#### Request Body
```json
{
  "enabled": true,
  "message": "Sistema em manutenção para atualizações. Retornamos em 30 minutos.",
  "estimated_duration": 1800,
  "allow_admin_access": true,
  "notify_users": true
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "maintenance_mode": true,
    "started_at": "2024-09-24T10:30:00Z",
    "estimated_end": "2024-09-24T11:00:00Z",
    "maintenance_id": "maint-uuid"
  }
}
```

---

## File Management

### POST /api/v1/files/upload

Upload de arquivos (anexos para incidentes).

#### Request (multipart/form-data)
```bash
curl -X POST "https://api.incident-system.com/v1/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@screenshot.png" \
  -F "incident_id=incident-uuid" \
  -F "description=Screenshot showing the error"
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "file-uuid",
    "filename": "screenshot.png",
    "original_name": "screenshot.png",
    "size": 245760,
    "mime_type": "image/png",
    "url": "/api/v1/files/file-uuid",
    "incident_id": "incident-uuid",
    "uploaded_by": "user-uuid",
    "uploaded_at": "2024-09-24T10:30:00Z",
    "description": "Screenshot showing the error"
  }
}
```

### GET /api/v1/files/{id}

Download/visualização de arquivo.

#### Response (200 OK)
```
Content-Type: image/png
Content-Disposition: inline; filename="screenshot.png"
Content-Length: 245760

[binary file content]
```

---

## Reporting

### GET /api/v1/reports/incidents

Relatório de incidentes com agregações.

#### Parâmetros de Query
- **period** (string): Período do relatório
- **group_by** (string): Agrupamento (`status`, `priority`, `technical_area`, `date`)
- **format** (string): Formato de saída (`json`, `csv`, `excel`)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_incidents": 1250,
      "period": "30d",
      "avg_resolution_time": 4.5,
      "sla_compliance": 0.87
    },
    "by_status": [
      {"status": "OPEN", "count": 45, "percentage": 3.6},
      {"status": "IN_PROGRESS", "count": 23, "percentage": 1.8},
      {"status": "RESOLVED", "count": 1182, "percentage": 94.6}
    ],
    "by_priority": [
      {"priority": "CRITICAL", "count": 15, "avg_resolution_time": 1.2},
      {"priority": "HIGH", "count": 89, "avg_resolution_time": 2.8},
      {"priority": "MEDIUM", "count": 456, "avg_resolution_time": 5.1},
      {"priority": "LOW", "count": 690, "avg_resolution_time": 8.3}
    ],
    "trends": {
      "daily_created": [
        {"date": "2024-09-01", "count": 12},
        {"date": "2024-09-02", "count": 8}
      ],
      "resolution_time_trend": "+15%"
    }
  }
}
```

### GET /api/v1/reports/performance

Relatório de performance da equipe.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "team_performance": [
      {
        "user_id": "user-uuid-1",
        "name": "João Silva",
        "incidents_resolved": 45,
        "avg_resolution_time": 3.2,
        "sla_compliance": 0.92,
        "rating": 4.8
      }
    ],
    "department_summary": [
      {
        "department": "Database Team",
        "total_incidents": 234,
        "avg_resolution_time": 2.1,
        "specialties": ["database", "performance"]
      }
    ]
  }
}
```

---

## WebHooks

### GET /api/v1/webhooks

Lista webhooks configurados.

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "webhook-uuid",
      "url": "https://external-system.com/webhooks/incidents",
      "events": ["incident.created", "incident.resolved"],
      "active": true,
      "secret": "webhook-secret-***",
      "created_at": "2024-09-01T10:00:00Z",
      "last_delivery": {
        "timestamp": "2024-09-24T10:15:00Z",
        "status": "success",
        "response_time": "0.234s"
      },
      "stats": {
        "total_deliveries": 450,
        "successful_deliveries": 445,
        "failed_deliveries": 5,
        "success_rate": 0.989
      }
    }
  ]
}
```

### POST /api/v1/webhooks

Cria novo webhook.

#### Request Body
```json
{
  "url": "https://external-system.com/webhooks/incidents",
  "events": ["incident.created", "incident.updated", "incident.resolved"],
  "secret": "your-webhook-secret",
  "active": true,
  "description": "Integration with external ticketing system",
  "filters": {
    "priority": ["HIGH", "CRITICAL"],
    "technical_areas": ["database", "security"]
  }
}
```

---

**Endpoints Reference - Versão 2.0**
**Última Atualização:** 24/09/2024
**Próxima Revisão:** 24/12/2024
**Responsável:** Equipe de API Development