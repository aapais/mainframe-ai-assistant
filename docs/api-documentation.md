# API Documentation - Sistema de Resolução de Incidentes

## Visão Geral

Esta documentação descreve a API REST completa do Sistema de Resolução de Incidentes, incluindo endpoints para gerenciamento de incidentes, busca semântica, autenticação e notificações em tempo real.

## Arquitetura

```
┌─────────────────┐
│   API Gateway   │ ← Rate Limiting, Circuit Breaker
├─────────────────┤
│   Routes Layer  │ ← Incidents, Knowledge, Search, Auth
├─────────────────┤
│ Controllers     │ ← Business Logic
├─────────────────┤
│  Services       │ ← External APIs, ML, Search
├─────────────────┤
│  Database       │ ← PostgreSQL, Redis Cache
└─────────────────┘
```

## Base URL

```
Production: https://api.mainframe-assistant.com
Development: http://localhost:3000
```

## Autenticação

### Bearer Token
Todas as rotas protegidas requerem um token JWT no header Authorization:

```http
Authorization: Bearer <jwt_token>
```

### Refresh Token
Tokens próximos do vencimento (< 15 minutos) são automaticamente renovados:

```http
X-New-Token: <new_jwt_token>
X-Token-Expires: 2024-12-07T15:30:00.000Z
```

## Rate Limiting

- **Global**: 100 requisições por 15 minutos por usuário/IP
- **Auth**: 5 tentativas de login por 15 minutos por IP
- **Search**: 20 buscas por minuto por usuário
- **Upload**: 10 uploads por hora por usuário

Headers de resposta:
```http
X-Rate-Limit-Limit: 100
X-Rate-Limit-Remaining: 95
X-Rate-Limit-Reset: 1633024800
```

## Estrutura de Resposta

### Sucesso
```json
{
  "success": true,
  "data": {
    // Dados da resposta
  },
  "message": "Operação realizada com sucesso",
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "limit": 20
  }
}
```

### Erro
```json
{
  "success": false,
  "message": "Descrição do erro",
  "code": "ERROR_CODE",
  "errors": [
    {
      "field": "campo",
      "message": "mensagem específica",
      "value": "valor inválido"
    }
  ],
  "requestId": "req_123456789",
  "timestamp": "2024-12-07T12:00:00.000Z"
}
```

## Códigos de Status HTTP

- **200**: Sucesso
- **201**: Criado com sucesso
- **400**: Dados inválidos
- **401**: Não autenticado
- **403**: Sem permissão
- **404**: Não encontrado
- **429**: Rate limit excedido
- **500**: Erro interno do servidor
- **503**: Serviço indisponível

---

# Endpoints

## 1. Autenticação

### POST /api/auth/login
Realizar login no sistema.

**Request:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123",
  "rememberMe": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "refresh_token_here",
    "expiresAt": "2024-12-07T15:30:00.000Z",
    "user": {
      "id": "user123",
      "email": "usuario@exemplo.com",
      "name": "João Silva",
      "role": "analyst",
      "permissions": ["incidents.read", "incidents.create"]
    }
  },
  "message": "Login realizado com sucesso"
}
```

### POST /api/auth/logout
Realizar logout e invalidar token.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

### POST /api/auth/refresh
Renovar token de acesso.

**Request:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "expiresAt": "2024-12-07T16:30:00.000Z"
  }
}
```

---

## 2. Incidentes

### POST /api/incidents
Criar novo incidente.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "title": "Sistema de login indisponível",
  "description": "Usuários não conseguem fazer login no sistema principal. Erro 500 sendo retornado.",
  "priority": "high",
  "severity": "major",
  "category": "authentication",
  "subcategory": "login_failure",
  "reportedBy": "João Silva",
  "customerInfo": {
    "company": "Banco ABC",
    "contact": "suporte@bancoabc.com",
    "phone": "+55 11 9999-9999"
  },
  "affectedSystems": ["login_service", "user_auth"],
  "businessImpact": "Clientes não conseguem acessar contas online",
  "urgency": "high",
  "tags": ["login", "authentication", "critical"],
  "attachments": [
    {
      "name": "error_log.txt",
      "url": "/uploads/error_log_123.txt"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "INC-1701949200-ABC123",
    "title": "Sistema de login indisponível",
    "status": "created",
    "priority": "high",
    "severity": "major",
    "category": "authentication",
    "createdAt": "2024-12-07T12:00:00.000Z",
    "createdBy": "user123",
    "estimatedResolutionTime": 240,
    "suggestedAssignee": "analyst456"
  },
  "suggestions": [
    {
      "id": "sug_001",
      "title": "Verificar status do serviço de autenticação",
      "confidence": 0.85,
      "steps": ["Check auth service health", "Verify database connectivity"]
    }
  ],
  "similarIncidents": [
    {
      "id": "INC-1701862800-XYZ789",
      "title": "Falha na autenticação de usuários",
      "similarity": 0.92,
      "resolution": "Reinicializou serviço de autenticação"
    }
  ]
}
```

### GET /api/incidents
Listar incidentes com filtros.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (number): Página (default: 1)
- `limit` (number): Itens por página (default: 20, max: 100)
- `status` (string): Filtrar por status (created, assigned, in_progress, resolved, closed, cancelled)
- `priority` (string): Filtrar por prioridade (low, medium, high, critical)
- `severity` (string): Filtrar por severidade (minor, major, critical)
- `search` (string): Busca textual (min: 3 chars)
- `category` (string): Filtrar por categoria
- `assignedTo` (string): Filtrar por responsável
- `dateFrom` (ISO date): Data inicial
- `dateTo` (ISO date): Data final
- `sortBy` (string): Campo para ordenação (createdAt, updatedAt, priority, status)
- `sortOrder` (string): Ordem (asc, desc)

**Example:**
```
GET /api/incidents?status=in_progress&priority=high&page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "INC-1701949200-ABC123",
      "title": "Sistema de login indisponível",
      "description": "Usuários não conseguem fazer login...",
      "status": "in_progress",
      "priority": "high",
      "severity": "major",
      "category": "authentication",
      "assignedTo": "analyst456",
      "createdAt": "2024-12-07T12:00:00.000Z",
      "updatedAt": "2024-12-07T12:30:00.000Z",
      "estimatedResolutionTime": 240
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 45,
    "limit": 20
  },
  "filters": {
    "status": "in_progress",
    "priority": "high"
  }
}
```

### GET /api/incidents/:id
Obter detalhes de um incidente específico.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "INC-1701949200-ABC123",
    "title": "Sistema de login indisponível",
    "description": "Usuários não conseguem fazer login no sistema principal...",
    "status": "in_progress",
    "priority": "high",
    "severity": "major",
    "category": "authentication",
    "subcategory": "login_failure",
    "assignedTo": "analyst456",
    "createdAt": "2024-12-07T12:00:00.000Z",
    "updatedAt": "2024-12-07T12:30:00.000Z",
    "estimatedResolutionTime": 240,
    "timeToResolve": null,
    "resolution": null,
    "history": [
      {
        "action": "created",
        "timestamp": "2024-12-07T12:00:00.000Z",
        "userId": "user123",
        "details": "Incidente criado"
      },
      {
        "action": "assigned",
        "timestamp": "2024-12-07T12:15:00.000Z",
        "userId": "manager789",
        "details": "Atribuído para analyst456"
      }
    ],
    "relatedIncidents": [
      {
        "id": "INC-1701862800-XYZ789",
        "title": "Falha na autenticação de usuários",
        "similarity": 0.92
      }
    ],
    "suggestions": [
      {
        "id": "sug_001",
        "title": "Verificar status do serviço de autenticação",
        "confidence": 0.85
      }
    ],
    "canEdit": true,
    "canResolve": true
  }
}
```

### PUT /api/incidents/:id/status
Atualizar status do incidente.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "status": "resolved",
  "resolution": "Problema resolvido reiniciando o serviço de autenticação. Causa raiz: alta utilização de memória devido a vazamento em cache de sessões.",
  "resolvedBy": "analyst456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "INC-1701949200-ABC123",
    "status": "resolved",
    "resolution": "Problema resolvido reiniciando o serviço...",
    "resolvedAt": "2024-12-07T13:45:00.000Z",
    "resolvedBy": "analyst456",
    "timeToResolve": 6300,
    "updatedAt": "2024-12-07T13:45:00.000Z"
  },
  "message": "Status do incidente atualizado com sucesso"
}
```

### POST /api/incidents/:id/feedback
Submeter feedback de resolução.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "effectiveness": 0.9,
  "resolution": "Solução foi efetiva e resolveu o problema rapidamente",
  "timeToResolve": 6300,
  "userSatisfaction": 4.5,
  "comments": "Processo de resolução foi rápido e eficiente. Comunicação boa durante todo o processo."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedbackId": "fb_1701952500_DEF456",
    "processed": true,
    "contributesToLearning": true
  },
  "message": "Feedback submetido com sucesso"
}
```

---

## 3. Busca Semântica

### GET /api/search/semantic
Busca semântica com RAG (Retrieval-Augmented Generation).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `query` (string, required): Consulta de busca (min: 3, max: 500 chars)
- `type` (string): Tipo de conteúdo (incidents, knowledge, solutions, all) (default: all)
- `limit` (number): Número máximo de resultados (default: 10, max: 50)
- `threshold` (number): Limiar de similaridade 0-1 (default: 0.7)
- `includeContext` (boolean): Incluir contexto adicional (default: true)
- `category` (string): Filtrar por categoria

**Example:**
```
GET /api/search/semantic?query=problema%20login%20usuários&type=all&limit=10&threshold=0.8
```

**Response:**
```json
{
  "success": true,
  "data": {
    "searchId": "search_1701949800_XYZ123",
    "query": "problema login usuários",
    "results": [
      {
        "id": "INC-1701862800-ABC789",
        "title": "Falha no sistema de autenticação",
        "type": "incident",
        "source": "incidents",
        "similarity": 0.92,
        "content": "Usuários relataram impossibilidade de login no sistema...",
        "highlights": ["login", "autenticação", "usuários"],
        "context": {
          "category": "authentication",
          "status": "resolved",
          "resolution": "Reinicialização do serviço auth"
        }
      },
      {
        "id": "KB-AUTH-001",
        "title": "Troubleshooting de Problemas de Login",
        "type": "knowledge",
        "source": "knowledge",
        "similarity": 0.89,
        "content": "Guia completo para diagnosticar problemas de login...",
        "highlights": ["troubleshooting", "login", "diagnóstico"],
        "context": {
          "tags": ["authentication", "troubleshooting"],
          "lastUpdated": "2024-11-15T10:00:00.000Z"
        }
      }
    ],
    "metadata": {
      "totalFound": 15,
      "afterFiltering": 8,
      "returned": 2,
      "threshold": 0.8,
      "searchType": "all",
      "queryProcessingTime": 245
    }
  }
}
```

### GET /api/search/similar
Buscar conteúdo similar a um incidente específico.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `incidentId` (string, required): ID do incidente de referência
- `limit` (number): Máximo de resultados (default: 5, max: 20)
- `includeResolved` (boolean): Incluir incidentes resolvidos (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "referenceIncident": {
      "id": "INC-1701949200-ABC123",
      "title": "Sistema de login indisponível",
      "description": "Usuários não conseguem fazer login..."
    },
    "similarContent": {
      "similarIncidents": [
        {
          "id": "INC-1701862800-XYZ789",
          "title": "Falha na autenticação de usuários",
          "similarity": 0.92,
          "status": "resolved",
          "resolution": "Reinicialização do serviço"
        }
      ],
      "relatedSolutions": [
        {
          "id": "SOL-AUTH-001",
          "title": "Solução para problemas de autenticação",
          "similarity": 0.87,
          "steps": ["Verificar logs", "Reiniciar serviço"]
        }
      ],
      "knowledgeArticles": [
        {
          "id": "KB-AUTH-001",
          "title": "Troubleshooting de Login",
          "similarity": 0.85,
          "category": "authentication"
        }
      ]
    },
    "metadata": {
      "totalFound": 8,
      "searchMethod": "embedding_similarity"
    }
  }
}
```

### GET /api/search/suggestions
Obter sugestões de busca.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `partial` (string): Texto parcial para autocompletar (min: 1, max: 100 chars)
- `limit` (number): Máximo de sugestões (default: 10, max: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "text": "problema login usuários",
        "source": "history",
        "score": 0.95,
        "frequency": 12
      },
      {
        "text": "problema autenticação banco",
        "source": "trending",
        "score": 0.88,
        "frequency": 8
      },
      {
        "text": "problema login sistema principal",
        "source": "autocomplete",
        "score": 0.82,
        "frequency": 5
      }
    ],
    "metadata": {
      "partial": "problema login",
      "totalSources": 3,
      "returned": 3
    }
  }
}
```

### POST /api/search/feedback
Submeter feedback sobre relevância dos resultados.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "searchId": "search_1701949800_XYZ123",
  "resultId": "INC-1701862800-ABC789",
  "relevance": 0.9,
  "helpful": true,
  "comments": "Resultado muito relevante, ajudou a resolver o problema rapidamente"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedbackId": "feedback_1701950100_DEF456",
    "recorded": true
  },
  "message": "Feedback registrado com sucesso"
}
```

---

## 4. Base de Conhecimento

### GET /api/knowledge
Listar artigos da base de conhecimento.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`, `limit`, `search`, `category`, `tags`, `sortBy`, `sortOrder`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "KB-AUTH-001",
      "title": "Troubleshooting de Problemas de Login",
      "summary": "Guia completo para diagnosticar e resolver problemas de autenticação",
      "category": "authentication",
      "tags": ["login", "troubleshooting", "auth"],
      "lastUpdated": "2024-11-15T10:00:00.000Z",
      "views": 156,
      "rating": 4.5
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 89,
    "limit": 20
  }
}
```

### GET /api/knowledge/:id
Obter artigo específico da base de conhecimento.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "KB-AUTH-001",
    "title": "Troubleshooting de Problemas de Login",
    "content": "## Diagnóstico de Problemas de Login\n\n1. Verificar logs do sistema...",
    "category": "authentication",
    "tags": ["login", "troubleshooting"],
    "attachments": [
      {
        "name": "login_troubleshooting_checklist.pdf",
        "url": "/kb/attachments/checklist.pdf"
      }
    ],
    "relatedArticles": [
      {
        "id": "KB-AUTH-002",
        "title": "Configuração de Autenticação SSO"
      }
    ],
    "metadata": {
      "createdAt": "2024-10-01T08:00:00.000Z",
      "lastUpdated": "2024-11-15T10:00:00.000Z",
      "author": "João Silva",
      "views": 156,
      "rating": 4.5,
      "helpful": 142,
      "notHelpful": 12
    }
  }
}
```

---

## 5. Notificações WebSocket

### Conexão WebSocket
```javascript
const ws = new WebSocket('ws://localhost:8080');

// Autenticar após conexão
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'jwt_token_here'
  }));
};

// Escutar mensagens
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Tipos de Mensagem

#### Autenticação
```json
{
  "type": "authenticate",
  "token": "jwt_token_here"
}
```

#### Inscrição em Eventos
```json
{
  "type": "subscribe",
  "events": ["incidents.new", "incidents.updates", "incidents.assigned"]
}
```

#### Notificações Recebidas

**Novo Incidente:**
```json
{
  "type": "new_incident",
  "data": {
    "id": "INC-1701949200-ABC123",
    "title": "Sistema de login indisponível",
    "priority": "high",
    "createdBy": "user123"
  },
  "timestamp": "2024-12-07T12:00:00.000Z"
}
```

**Atualização de Status:**
```json
{
  "type": "incident_status_updated",
  "data": {
    "id": "INC-1701949200-ABC123",
    "newStatus": "resolved",
    "previousStatus": "in_progress",
    "updatedBy": "analyst456"
  },
  "timestamp": "2024-12-07T13:45:00.000Z"
}
```

---

## 6. Métricas e Analytics

### GET /api/incidents/analytics/metrics
Obter métricas de incidentes (Admin apenas).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIncidents": 1234,
      "openIncidents": 45,
      "resolvedToday": 23,
      "averageResolutionTime": 4320
    },
    "trends": {
      "incidentsByDay": [
        { "date": "2024-12-01", "count": 12 },
        { "date": "2024-12-02", "count": 15 }
      ],
      "resolutionTrends": [
        { "date": "2024-12-01", "avgTime": 3600 }
      ]
    },
    "categorization": {
      "byCategory": {
        "authentication": 123,
        "network": 89,
        "database": 67
      },
      "byPriority": {
        "critical": 12,
        "high": 45,
        "medium": 78,
        "low": 23
      }
    },
    "performance": {
      "resolutionRate": 0.92,
      "firstCallResolution": 0.67,
      "customerSatisfaction": 4.2
    },
    "generatedAt": "2024-12-07T14:00:00.000Z"
  }
}
```

### GET /api/search/analytics
Obter analytics de busca (Admin/Manager).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `timeframe` (string): Período (24h, 7d, 30d, 90d) (default: 7d)
- `metric` (string): Métrica específica (queries, results, clicks, feedback, all) (default: all)

**Response:**
```json
{
  "success": true,
  "data": {
    "searchVolume": {
      "totalQueries": 1456,
      "uniqueUsers": 89,
      "avgQueriesPerUser": 16.4
    },
    "topQueries": [
      {
        "query": "problema login",
        "count": 45,
        "avgResults": 8.2
      }
    ],
    "performance": {
      "avgResponseTime": 245,
      "successRate": 0.94,
      "zeroResultQueries": 0.06
    },
    "feedback": {
      "avgRelevance": 0.78,
      "totalFeedback": 234,
      "positiveRatio": 0.82
    }
  }
}
```

---

## 7. Health Checks

### GET /api/gateway/health
Health check do API Gateway.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "components": [
      {
        "component": "circuitBreaker:database",
        "status": "healthy"
      },
      {
        "component": "memory",
        "status": "healthy",
        "details": {
          "heapUsed": 123456789,
          "heapTotal": 256789012
        }
      }
    ],
    "uptime": 86400,
    "timestamp": "2024-12-07T14:00:00.000Z"
  }
}
```

### GET /api/incidents/health
Health check do sistema de incidentes.

**Headers:** `Authorization: Bearer <token>` (Admin apenas)

### GET /api/search/health
Health check do sistema de busca.

**Headers:** `Authorization: Bearer <token>` (Admin apenas)

---

## Códigos de Erro Específicos

### Autenticação
- `NO_TOKEN`: Token não fornecido
- `INVALID_TOKEN`: Token inválido ou malformado
- `TOKEN_EXPIRED`: Token expirado
- `TOKEN_REVOKED`: Token foi revogado
- `SESSION_EXPIRED`: Sessão expirada
- `IP_MISMATCH`: IP diferente do registrado na sessão

### Autorização
- `INSUFFICIENT_PERMISSIONS`: Permissões insuficientes
- `ACCESS_DENIED`: Acesso negado
- `ADMIN_REQUIRED`: Acesso administrativo necessário

### Rate Limiting
- `RATE_LIMIT_EXCEEDED`: Limite de requisições excedido
- `TOO_MANY_LOGIN_ATTEMPTS`: Muitas tentativas de login

### Validação
- `VALIDATION_ERROR`: Erro de validação de dados
- `INVALID_FILE_TYPE`: Tipo de arquivo não permitido
- `FILE_TOO_LARGE`: Arquivo muito grande

### Circuit Breaker
- `CIRCUIT_BREAKER_OPEN`: Serviço temporariamente indisponível
- `CIRCUIT_BREAKER_TIMEOUT`: Operação expirou

---

## Schemas de Dados

### Incident Schema
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "status": "created|assigned|in_progress|resolved|closed|cancelled",
  "priority": "low|medium|high|critical",
  "severity": "minor|major|critical",
  "category": "string",
  "subcategory": "string",
  "assignedTo": "string",
  "reportedBy": "string",
  "customerInfo": "object",
  "affectedSystems": "array",
  "businessImpact": "string",
  "urgency": "low|medium|high|critical",
  "tags": "array",
  "attachments": "array",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "resolvedAt": "ISO8601",
  "resolution": "string",
  "timeToResolve": "number",
  "history": "array"
}
```

### Search Result Schema
```json
{
  "id": "string",
  "title": "string",
  "type": "incident|knowledge|solution",
  "source": "incidents|knowledge|solutions",
  "similarity": "number",
  "content": "string",
  "highlights": "array",
  "context": "object"
}
```

---

## Exemplos de Integração

### JavaScript/TypeScript
```javascript
class IncidentAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async createIncident(data) {
    const response = await fetch(`${this.baseURL}/api/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(data)
    });

    return await response.json();
  }

  async searchSemantic(query, options = {}) {
    const params = new URLSearchParams({
      query,
      ...options
    });

    const response = await fetch(`${this.baseURL}/api/search/semantic?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return await response.json();
  }
}
```

### Python
```python
import requests

class IncidentAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def create_incident(self, data):
        response = requests.post(
            f'{self.base_url}/api/incidents',
            headers=self.headers,
            json=data
        )
        return response.json()

    def search_semantic(self, query, **options):
        params = {'query': query, **options}
        response = requests.get(
            f'{self.base_url}/api/search/semantic',
            headers=self.headers,
            params=params
        )
        return response.json()
```

---

## Considerações de Segurança

1. **HTTPS Obrigatório** em produção
2. **Rate Limiting** implementado em múltiplas camadas
3. **Validação rigorosa** de entrada
4. **Sanitização** de dados
5. **Logs de auditoria** para todas as operações
6. **Tokens JWT** com expiração curta
7. **Circuit Breakers** para prevenir cascata de falhas
8. **Headers de segurança** (Helmet.js)
9. **CORS** configurado adequadamente
10. **Blacklist de tokens** para logout/revogação

---

## Monitoramento e Observabilidade

- **Métricas**: Coletadas automaticamente para todas as operações
- **Logs estruturados**: Com request IDs únicos para rastreamento
- **Health checks**: Endpoints dedicados para monitoramento
- **Circuit breakers**: Proteção contra falhas em cascata
- **Rate limiting**: Proteção contra abuso
- **Alertas**: Configuráveis para anomalias e falhas

---

*Documentação gerada automaticamente em 2024-12-07*