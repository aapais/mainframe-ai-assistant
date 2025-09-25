# API Reference - Sistema de Gestão de Incidentes
## Visão Geral da API - Versão 2.0

### 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [Base URL e Versionamento](#base-url-e-versionamento)
4. [Padrões de Resposta](#padrões-de-resposta)
5. [Rate Limiting](#rate-limiting)
6. [Códigos de Status](#códigos-de-status)
7. [Paginação](#paginação)
8. [Filtros e Busca](#filtros-e-busca)
9. [WebHooks](#webhooks)
10. [SDKs e Libraries](#sdks-e-libraries)

## Visão Geral

A API REST do Sistema de Gestão de Incidentes fornece acesso programático a todas as funcionalidades do sistema, incluindo gestão de incidentes, base de conhecimento, busca unificada e integração com IA.

### Principais Recursos da API
- ✅ **RESTful Design** - Segue princípios REST padrão
- ✅ **JSON API** - Formato JSON para requests e responses
- ✅ **Autenticação JWT** - Tokens seguros com refresh
- ✅ **Rate Limiting** - Proteção contra abuso
- ✅ **Paginação** - Resultados paginados
- ✅ **Filtros Avançados** - Busca e filtros flexíveis
- ✅ **Real-time** - WebSockets para updates em tempo real
- ✅ **OpenAPI/Swagger** - Documentação interativa
- ✅ **Versionamento** - Suporte a múltiplas versões

### Endpoints Principais
```
📊 Dashboard & Metrics
GET    /api/v1/dashboard/metrics
GET    /api/v1/dashboard/overview

🎫 Incident Management
GET    /api/v1/incidents
POST   /api/v1/incidents
GET    /api/v1/incidents/{id}
PUT    /api/v1/incidents/{id}
DELETE /api/v1/incidents/{id}

📚 Knowledge Base
GET    /api/v1/knowledge
POST   /api/v1/knowledge
GET    /api/v1/knowledge/{id}
PUT    /api/v1/knowledge/{id}

🔍 Search & AI
POST   /api/v1/search/unified
POST   /api/v1/search/semantic
POST   /api/v1/ai/categorize
POST   /api/v1/ai/suggest-solution

👤 User Management
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/{id}

🔐 Authentication
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

## Autenticação

### JWT Bearer Token

A API utiliza JWT (JSON Web Tokens) para autenticação. Todos os endpoints (exceto login) requerem um token válido.

#### Obter Token de Acesso
```bash
curl -X POST "https://api.incident-system.com/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@empresa.com",
    "password": "sua-senha",
    "twoFactorToken": "123456"
  }'
```

#### Resposta de Login
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@empresa.com",
      "name": "João Silva",
      "role": "analyst"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 86400
    }
  }
}
```

#### Usar Token nas Requisições
```bash
curl -X GET "https://api.incident-system.com/v1/incidents" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Refresh de Token
```bash
curl -X POST "https://api.incident-system.com/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### Níveis de Acesso

#### Hierarquia de Permissões
```
super_admin > admin > manager > analyst > user
```

#### Matriz de Permissões por Endpoint
| Endpoint | User | Analyst | Manager | Admin | Super Admin |
|----------|------|---------|---------|--------|------------|
| GET /incidents | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /incidents | ✅ | ✅ | ✅ | ✅ | ✅ |
| PUT /incidents | 📝¹ | ✅ | ✅ | ✅ | ✅ |
| DELETE /incidents | ❌ | ❌ | ✅ | ✅ | ✅ |
| GET /knowledge | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /knowledge | ❌ | ✅ | ✅ | ✅ | ✅ |
| GET /users | ❌ | ❌ | ❌ | ✅ | ✅ |
| POST /users | ❌ | ❌ | ❌ | ✅ | ✅ |

¹ Apenas próprios incidentes

## Base URL e Versionamento

### URLs de Ambiente
```
Desenvolvimento: http://localhost:3001/api/v1
Homologação:    https://staging-api.incident-system.com/v1
Produção:       https://api.incident-system.com/v1
```

### Versionamento
A API usa versionamento semântico na URL:
- `/api/v1/` - Versão estável atual
- `/api/v2/` - Próxima versão (beta)

#### Headers de Versionamento (Alternativo)
```bash
curl -X GET "https://api.incident-system.com/incidents" \
  -H "API-Version: v1"
```

### Content Types Suportados
```
application/json       # Padrão para API
application/xml        # Suporte limitado
multipart/form-data    # Para uploads
text/plain            # Para alguns endpoints específicos
```

## Padrões de Resposta

### Estrutura Padrão de Resposta

#### Sucesso (2xx)
```json
{
  "success": true,
  "data": {
    // Dados solicitados
  },
  "meta": {
    "timestamp": "2024-09-24T10:30:00Z",
    "requestId": "uuid-request-id",
    "version": "2.0.0",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

#### Erro (4xx/5xx)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados de entrada inválidos",
    "details": [
      {
        "field": "email",
        "message": "Email é obrigatório"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-09-24T10:30:00Z",
    "requestId": "uuid-request-id"
  }
}
```

### Códigos de Resposta Padronizados

#### Success Responses
```json
// Criação bem-sucedida
{
  "success": true,
  "data": {
    "id": "uuid",
    "created": true
  },
  "meta": {
    "message": "Incidente criado com sucesso"
  }
}

// Atualização bem-sucedida
{
  "success": true,
  "data": {
    "id": "uuid",
    "updated": true
  },
  "meta": {
    "message": "Incidente atualizado com sucesso"
  }
}

// Exclusão bem-sucedida
{
  "success": true,
  "data": {
    "deleted": true
  },
  "meta": {
    "message": "Incidente removido com sucesso"
  }
}
```

## Rate Limiting

### Limites por Nível de Usuário

```
User:        100 requests/hour
Analyst:     500 requests/hour
Manager:     1000 requests/hour
Admin:       2000 requests/hour
Super Admin: 5000 requests/hour
API Key:     10000 requests/hour
```

### Headers de Rate Limiting
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1695123600
X-RateLimit-Window: 3600
```

### Resposta de Rate Limit Excedido
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Taxa de requisições excedida",
    "details": {
      "limit": 100,
      "remaining": 0,
      "resetTime": "2024-09-24T11:00:00Z"
    }
  }
}
```

### Bypass para Rate Limiting
```bash
# Usar API Key para limites mais altos
curl -X GET "https://api.incident-system.com/v1/incidents" \
  -H "X-API-Key: your-api-key-here"
```

## Códigos de Status

### Códigos HTTP Utilizados

#### 2xx Success
- **200 OK** - Requisição bem-sucedida
- **201 Created** - Recurso criado com sucesso
- **202 Accepted** - Requisição aceita para processamento assíncrono
- **204 No Content** - Operação bem-sucedida sem retorno de dados

#### 3xx Redirection
- **301 Moved Permanently** - Endpoint movido permanentemente
- **302 Found** - Redirecionamento temporário

#### 4xx Client Error
- **400 Bad Request** - Dados inválidos na requisição
- **401 Unauthorized** - Autenticação necessária
- **403 Forbidden** - Sem permissão para acessar recurso
- **404 Not Found** - Recurso não encontrado
- **405 Method Not Allowed** - Método HTTP não suportado
- **409 Conflict** - Conflito nos dados (ex: email já existe)
- **422 Unprocessable Entity** - Dados válidos mas não processáveis
- **429 Too Many Requests** - Rate limit excedido

#### 5xx Server Error
- **500 Internal Server Error** - Erro interno do servidor
- **502 Bad Gateway** - Erro no gateway/proxy
- **503 Service Unavailable** - Serviço temporariamente indisponível
- **504 Gateway Timeout** - Timeout no gateway/proxy

### Códigos de Erro Personalizados

#### Autenticação (AUTH_*)
```
AUTH_001: Invalid credentials
AUTH_002: Token expired
AUTH_003: Token invalid
AUTH_004: 2FA required
AUTH_005: Account locked
AUTH_006: Password change required
```

#### Validação (VALIDATION_*)
```
VALIDATION_001: Required field missing
VALIDATION_002: Invalid field format
VALIDATION_003: Field length exceeded
VALIDATION_004: Invalid enum value
VALIDATION_005: Date format invalid
```

#### Business Rules (BUSINESS_*)
```
BUSINESS_001: Incident cannot be deleted (has dependencies)
BUSINESS_002: Status transition not allowed
BUSINESS_003: User not assigned to incident
BUSINESS_004: Duplicate incident detected
```

## Paginação

### Paginação Offset/Limit (Padrão)

#### Parâmetros de Query
```
page=1          # Página atual (1-indexed)
limit=20        # Items por página (max: 100)
sort=created_at # Campo para ordenação
order=desc      # Direção: asc, desc
```

#### Exemplo de Request
```bash
curl "https://api.incident-system.com/v1/incidents?page=2&limit=50&sort=priority&order=desc"
```

#### Resposta com Metadata
```json
{
  "success": true,
  "data": [
    // Array de incidentes
  ],
  "meta": {
    "pagination": {
      "page": 2,
      "limit": 50,
      "total": 1250,
      "pages": 25,
      "hasNext": true,
      "hasPrev": true,
      "nextPage": "/api/v1/incidents?page=3&limit=50&sort=priority&order=desc",
      "prevPage": "/api/v1/incidents?page=1&limit=50&sort=priority&order=desc"
    }
  }
}
```

### Paginação Cursor (Para Performance)

#### Parâmetros para Datasets Grandes
```
cursor=eyJpZCI6MTIzLCJjcmVhdGVkX2F0IjoiMjAyNC0wOS0yNCJ9  # Base64 cursor
limit=50                                                    # Items por página
```

#### Response com Cursor
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "limit": 50,
      "hasNext": true,
      "nextCursor": "eyJpZCI6MTc0LCJjcmVhdGVkX2F0IjoiMjAyNC0wOS0yNSJ9"
    }
  }
}
```

## Filtros e Busca

### Filtros Simples (Query Parameters)

```bash
# Filtro por status
GET /api/v1/incidents?status=OPEN

# Múltiplos valores
GET /api/v1/incidents?status=OPEN,IN_PROGRESS

# Filtros de data
GET /api/v1/incidents?created_after=2024-09-01&created_before=2024-09-30

# Filtros numéricos
GET /api/v1/incidents?priority=HIGH&severity=MAJOR
```

### Busca Textual

#### Busca Simples
```bash
# Busca em título e descrição
GET /api/v1/incidents?search=database+error

# Busca em campo específico
GET /api/v1/incidents?title_contains=login
```

#### Busca Avançada
```bash
# Operadores de busca
GET /api/v1/incidents?search="database error" AND priority:HIGH

# Busca por range de datas
GET /api/v1/incidents?created_at=[2024-09-01 TO 2024-09-30]
```

### Filtros Complexos (POST Request)

```bash
curl -X POST "https://api.incident-system.com/v1/incidents/search" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "status": {
        "in": ["OPEN", "IN_PROGRESS"]
      },
      "priority": {
        "gte": "MEDIUM"
      },
      "created_at": {
        "between": ["2024-09-01", "2024-09-30"]
      },
      "assigned_to": {
        "not_null": true
      }
    },
    "search": {
      "query": "database error",
      "fields": ["title", "description"],
      "fuzzy": true
    },
    "sort": [
      {"field": "priority", "order": "desc"},
      {"field": "created_at", "order": "asc"}
    ],
    "pagination": {
      "page": 1,
      "limit": 25
    }
  }'
```

### Busca Semântica com IA

```bash
curl -X POST "https://api.incident-system.com/v1/search/semantic" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Como resolver problemas de conectividade com banco de dados?",
    "type": "hybrid", // text, semantic, hybrid
    "limit": 10,
    "include_knowledge": true,
    "include_incidents": true,
    "similarity_threshold": 0.7
  }'
```

## WebHooks

### Configuração de WebHooks

#### Criar WebHook
```bash
curl -X POST "https://api.incident-system.com/v1/webhooks" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhooks/incidents",
    "events": ["incident.created", "incident.updated", "incident.resolved"],
    "secret": "your-webhook-secret",
    "active": true
  }'
```

### Eventos Disponíveis

#### Incident Events
```
incident.created     # Novo incidente criado
incident.updated     # Incidente atualizado
incident.assigned    # Incidente atribuído
incident.resolved    # Incidente resolvido
incident.closed      # Incidente fechado
incident.reopened    # Incidente reaberto
```

#### Knowledge Events
```
knowledge.created    # Novo artigo na base de conhecimento
knowledge.updated    # Artigo atualizado
knowledge.accessed   # Artigo acessado
```

#### System Events
```
user.login          # Login de usuário
user.created        # Novo usuário criado
system.maintenance   # Manutenção do sistema
```

### Estrutura do Payload

```json
{
  "event": "incident.created",
  "timestamp": "2024-09-24T10:30:00Z",
  "data": {
    "id": "incident-uuid",
    "title": "Database Connection Error",
    "status": "OPEN",
    "priority": "HIGH",
    "created_by": "user-uuid",
    "assigned_to": null
  },
  "meta": {
    "webhook_id": "webhook-uuid",
    "delivery_id": "delivery-uuid",
    "attempt": 1
  }
}
```

### Validação de WebHook

#### Verificar Signature
```javascript
const crypto = require('crypto');

function validateWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}
```

## SDKs e Libraries

### JavaScript/Node.js SDK

#### Instalação
```bash
npm install @incident-system/api-client
```

#### Uso Básico
```javascript
const IncidentAPI = require('@incident-system/api-client');

const client = new IncidentAPI({
  baseURL: 'https://api.incident-system.com/v1',
  apiKey: 'your-api-key'
});

// Listar incidentes
const incidents = await client.incidents.list({
  status: 'OPEN',
  limit: 50
});

// Criar incidente
const newIncident = await client.incidents.create({
  title: 'Database Error',
  description: 'Connection timeout to PostgreSQL',
  priority: 'HIGH',
  technical_area: 'database'
});

// Busca unificada
const results = await client.search.unified({
  query: 'database error',
  limit: 10
});
```

### Python SDK

#### Instalação
```bash
pip install incident-system-api
```

#### Uso Básico
```python
from incident_system import IncidentClient

client = IncidentClient(
    base_url='https://api.incident-system.com/v1',
    api_key='your-api-key'
)

# Listar incidentes
incidents = client.incidents.list(
    status='OPEN',
    limit=50
)

# Criar incidente
new_incident = client.incidents.create(
    title='Database Error',
    description='Connection timeout to PostgreSQL',
    priority='HIGH',
    technical_area='database'
)

# Busca semântica
results = client.search.semantic(
    query='Como resolver problemas de banco de dados?',
    limit=10
)
```

### cURL Examples

#### Incident Management
```bash
# Listar incidentes
curl -X GET "https://api.incident-system.com/v1/incidents" \
  -H "Authorization: Bearer $TOKEN"

# Criar incidente
curl -X POST "https://api.incident-system.com/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sistema Lento",
    "description": "Performance degradada desde ontem",
    "priority": "MEDIUM",
    "technical_area": "performance"
  }'

# Atualizar status
curl -X PUT "https://api.incident-system.com/v1/incidents/{id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "assigned_to": "user-uuid"
  }'
```

### Postman Collection

Baixe a coleção completa do Postman:
- **URL:** `https://api.incident-system.com/v1/postman/collection.json`
- **Inclui:** Todos os endpoints, autenticação e exemplos
- **Variáveis:** Configuração para diferentes ambientes

### OpenAPI/Swagger

Documentação interativa disponível em:
- **Swagger UI:** `https://api.incident-system.com/docs`
- **OpenAPI Schema:** `https://api.incident-system.com/v1/openapi.json`
- **ReDoc:** `https://api.incident-system.com/redoc`

---

**API Reference - Versão 2.0**
**Última Atualização:** 24/09/2024
**Próxima Revisão:** 24/12/2024
**Responsável:** Equipe de API Development