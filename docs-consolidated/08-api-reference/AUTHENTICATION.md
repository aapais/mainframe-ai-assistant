# Autenticação - Sistema de Gestão de Incidentes API
## Guia Completo de Autenticação - Versão 2.0

### 📋 Índice
1. [Visão Geral](#visão-geral)
2. [JWT Authentication](#jwt-authentication)
3. [API Keys](#api-keys)
4. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
5. [Refresh Tokens](#refresh-tokens)
6. [Rate Limiting](#rate-limiting)
7. [Session Management](#session-management)
8. [Security Best Practices](#security-best-practices)
9. [Error Handling](#error-handling)
10. [Code Examples](#code-examples)

---

## Visão Geral

O Sistema de Gestão de Incidentes oferece múltiplas opções de autenticação para diferentes casos de uso:

### Métodos de Autenticação Disponíveis
- ✅ **JWT Bearer Tokens** - Padrão para aplicações web e mobile
- ✅ **API Keys** - Para integrações sistema-a-sistema
- ✅ **Session Cookies** - Para aplicações web tradicionais
- ✅ **OAuth 2.0** - Para integrações de terceiros (em desenvolvimento)

### Níveis de Segurança
```
Básico:     Email/Senha
Intermediário: Email/Senha + Rate Limiting
Avançado:   Email/Senha + 2FA
Empresarial: SSO/SAML + 2FA + Device Trust
```

---

## JWT Authentication

### Como Funciona

#### 1. Login e Obtenção de Token
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "password": "senha-segura",
  "twoFactorToken": "123456"
}
```

#### 2. Resposta com Tokens
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "usuario@empresa.com",
      "name": "João Silva",
      "role": "analyst"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLXV1aWQiLCJlbWFpbCI6InVzdWFyaW9AZW1wcmVzYS5jb20iLCJyb2xlIjoiYW5hbHlzdCIsImlhdCI6MTY5NTEyMzYwMCwiZXhwIjoxNjk1MjEwMDAwfQ.signature",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLXV1aWQiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTY5NTEyMzYwMCwiZXhwIjoxNjk1NzI4NDAwfQ.signature",
      "expiresIn": 86400,
      "tokenType": "Bearer"
    }
  }
}
```

### Estrutura do JWT Token

#### Header
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

#### Payload
```json
{
  "sub": "user-uuid",
  "email": "usuario@empresa.com",
  "name": "João Silva",
  "role": "analyst",
  "permissions": [
    "incidents.read",
    "incidents.create",
    "incidents.update_own"
  ],
  "iat": 1695123600,
  "exp": 1695210000,
  "iss": "incident-management-api",
  "aud": "incident-management-client"
}
```

### Usar Token nas Requisições

#### Authorization Header (Recomendado)
```http
GET /api/v1/incidents
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Query Parameter (Para WebSockets)
```http
GET /api/v1/realtime/incidents?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Validação de Token

#### Verificação Automática
Todos os endpoints protegidos verificam automaticamente:
- ✅ **Assinatura** - Token não foi alterado
- ✅ **Expiração** - Token ainda é válido
- ✅ **Formato** - Estrutura correta
- ✅ **Permissões** - Usuário tem acesso ao recurso
- ✅ **Revogação** - Token não foi revogado

#### Exemplo de Token Inválido
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Token de acesso expirado",
    "details": {
      "expired_at": "2024-09-24T10:30:00Z",
      "current_time": "2024-09-24T11:45:00Z"
    }
  }
}
```

---

## API Keys

### Quando Usar API Keys

#### Cenários Ideais
- 🔧 **Integrações Sistema-a-Sistema** - Aplicações backend
- 🤖 **Automação** - Scripts e bots
- 📊 **Monitoramento** - Ferramentas de coleta de métricas
- 🔄 **CI/CD Pipelines** - Deployment automatizado

#### Vantagens sobre JWT
- ✅ **Não Expiram** - Ideais para automação
- ✅ **Rate Limits Maiores** - 10x mais requisições
- ✅ **Simples de Usar** - Sem refresh necessário
- ✅ **Revogação Instantânea** - Controle granular

### Criando uma API Key

#### Request
```http
POST /api/v1/auth/api-keys
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Monitoring Integration",
  "description": "API key for Prometheus metrics collection",
  "permissions": [
    "metrics.read",
    "incidents.read",
    "system.health"
  ],
  "expires_at": "2025-09-24T10:30:00Z",
  "rate_limit": 10000,
  "ip_whitelist": ["192.168.1.0/24", "10.0.0.0/8"]
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "ak_1234567890abcdef",
    "name": "Monitoring Integration",
    "key": "sk-incident-mgmt-1234567890abcdef1234567890abcdef",
    "permissions": [
      "metrics.read",
      "incidents.read",
      "system.health"
    ],
    "rate_limit": 10000,
    "expires_at": "2025-09-24T10:30:00Z",
    "created_at": "2024-09-24T10:30:00Z"
  },
  "meta": {
    "warning": "Esta é a única vez que a chave será exibida. Guarde-a com segurança."
  }
}
```

### Usando API Keys

#### Header Method (Recomendado)
```http
GET /api/v1/incidents
X-API-Key: sk-incident-mgmt-1234567890abcdef1234567890abcdef
```

#### Bearer Token Method
```http
GET /api/v1/incidents
Authorization: Bearer sk-incident-mgmt-1234567890abcdef1234567890abcdef
```

### Gerenciamento de API Keys

#### Listar API Keys
```http
GET /api/v1/auth/api-keys
Authorization: Bearer <your-jwt-token>
```

#### Revogar API Key
```http
DELETE /api/v1/auth/api-keys/{key-id}
Authorization: Bearer <your-jwt-token>
```

#### Rotação de API Key
```http
POST /api/v1/auth/api-keys/{key-id}/rotate
Authorization: Bearer <your-jwt-token>
```

---

## Two-Factor Authentication (2FA)

### Métodos Suportados

#### TOTP (Time-based One-Time Password)
- 📱 **Google Authenticator**
- 📱 **Microsoft Authenticator**
- 📱 **Authy**
- 📱 **1Password**

#### SMS (Opcional)
- 📲 **Código por SMS** - Para usuários sem smartphone
- 📲 **Backup Method** - Quando TOTP não está disponível

#### Backup Codes
- 🔐 **10 códigos únicos** - Para emergências
- 🔐 **Uso único** - Cada código vale uma vez

### Configuração Inicial do 2FA

#### 1. Habilitar 2FA
```http
POST /api/v1/auth/2fa/enable
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "method": "totp"
}
```

#### 2. Resposta com QR Code
```json
{
  "success": true,
  "data": {
    "secret": "ABCD1234EFGH5678IJKL9012MNOP3456",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "manual_entry_key": "ABCD 1234 EFGH 5678 IJKL 9012 MNOP 3456",
    "backup_codes": [
      "12345-67890",
      "23456-78901",
      "34567-89012"
    ]
  },
  "meta": {
    "message": "Configure seu aplicativo autenticador com o QR code ou chave manual"
  }
}
```

#### 3. Confirmar Configuração
```http
POST /api/v1/auth/2fa/confirm
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "token": "123456"
}
```

### Login com 2FA

#### 1. Login Inicial (Retorna Challenge)
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "password": "senha-segura"
}
```

#### 2. Resposta com Challenge
```json
{
  "success": false,
  "error": {
    "code": "2FA_REQUIRED",
    "message": "Autenticação de dois fatores obrigatória",
    "details": {
      "challenge_token": "temp-challenge-uuid",
      "methods": ["totp", "backup_codes"],
      "expires_in": 300
    }
  }
}
```

#### 3. Completar com 2FA
```http
POST /api/v1/auth/2fa/verify
Content-Type: application/json

{
  "challenge_token": "temp-challenge-uuid",
  "method": "totp",
  "token": "123456"
}
```

#### 4. Resposta com Tokens
```json
{
  "success": true,
  "data": {
    "user": { /* user data */ },
    "tokens": { /* JWT tokens */ }
  }
}
```

### Desabilitar 2FA

#### Requer Confirmação Atual
```http
POST /api/v1/auth/2fa/disable
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "current_token": "123456",
  "password": "senha-segura"
}
```

---

## Refresh Tokens

### Renovação Automática de Tokens

#### Por que Usar Refresh Tokens?
- 🔒 **Segurança** - Tokens de acesso com vida curta
- 🔄 **Conveniência** - Renovação automática
- 📱 **Experiência** - Usuário não precisa fazer login novamente
- 🛡️ **Controle** - Revogação granular de sessões

### Fluxo de Refresh

#### 1. Token Expirado
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Token de acesso expirado",
    "details": {
      "expired_at": "2024-09-24T10:30:00Z"
    }
  }
}
```

#### 2. Usar Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 3. Novos Tokens
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

### Implementação Automática

#### JavaScript/Node.js
```javascript
class APIClient {
  constructor(baseURL, tokens) {
    this.baseURL = baseURL;
    this.tokens = tokens;
  }

  async request(endpoint, options = {}) {
    let response = await this.makeRequest(endpoint, options);

    // Auto-refresh se token expirou
    if (response.status === 401 && response.data?.error?.code === 'TOKEN_EXPIRED') {
      await this.refreshTokens();
      response = await this.makeRequest(endpoint, options);
    }

    return response;
  }

  async refreshTokens() {
    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: this.tokens.refreshToken
      })
    });

    if (response.ok) {
      const data = await response.json();
      this.tokens = data.data;
      // Salvar novos tokens
      localStorage.setItem('auth_tokens', JSON.stringify(this.tokens));
    } else {
      // Refresh falhou, redirecionar para login
      window.location.href = '/login';
    }
  }

  async makeRequest(endpoint, options) {
    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }
}
```

#### Python
```python
import requests
import json
from datetime import datetime, timedelta

class APIClient:
    def __init__(self, base_url, tokens):
        self.base_url = base_url
        self.tokens = tokens

    def request(self, endpoint, method='GET', **kwargs):
        response = self._make_request(endpoint, method, **kwargs)

        # Auto-refresh se token expirou
        if response.status_code == 401:
            error_data = response.json()
            if error_data.get('error', {}).get('code') == 'TOKEN_EXPIRED':
                self.refresh_tokens()
                response = self._make_request(endpoint, method, **kwargs)

        return response

    def refresh_tokens(self):
        response = requests.post(
            f"{self.base_url}/auth/refresh",
            json={'refreshToken': self.tokens['refreshToken']}
        )

        if response.ok:
            data = response.json()
            self.tokens = data['data']
            # Salvar novos tokens
            with open('tokens.json', 'w') as f:
                json.dump(self.tokens, f)
        else:
            raise Exception("Failed to refresh tokens")

    def _make_request(self, endpoint, method, **kwargs):
        return requests.request(
            method,
            f"{self.base_url}{endpoint}",
            headers={
                'Authorization': f"Bearer {self.tokens['accessToken']}",
                'Content-Type': 'application/json'
            },
            **kwargs
        )
```

---

## Rate Limiting

### Limites por Tipo de Autenticação

#### JWT Tokens (Por Usuário/Hora)
```
User:        100 requests
Analyst:     500 requests
Manager:     1000 requests
Admin:       2000 requests
Super Admin: 5000 requests
```

#### API Keys (Por Chave/Hora)
```
Basic:       1000 requests
Standard:    5000 requests
Premium:     10000 requests
Enterprise:  50000 requests
```

### Headers de Rate Limit

#### Em Cada Response
```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1695127200
X-RateLimit-Window: 3600
X-RateLimit-Type: user
```

#### Quando Limite Excedido
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1695127200
Retry-After: 1800

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Taxa de requisições excedida",
    "details": {
      "limit": 500,
      "remaining": 0,
      "reset_time": "2024-09-24T11:00:00Z",
      "retry_after": 1800
    }
  }
}
```

### Estratégias para Rate Limiting

#### 1. Exponential Backoff
```javascript
async function requestWithBackoff(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await apiCall();
      return response;
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.headers['retry-after'] || Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }
}
```

#### 2. Request Queuing
```javascript
class RateLimitedAPIClient {
  constructor(baseURL, rateLimit) {
    this.baseURL = baseURL;
    this.queue = [];
    this.processing = false;
    this.rateLimit = rateLimit; // requests per second
    this.lastRequest = 0;
  }

  async request(endpoint, options) {
    return new Promise((resolve, reject) => {
      this.queue.push({ endpoint, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequest;
      const minInterval = 1000 / this.rateLimit;

      if (timeSinceLastRequest < minInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, minInterval - timeSinceLastRequest)
        );
      }

      const { endpoint, options, resolve, reject } = this.queue.shift();

      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, options);
        resolve(response);
      } catch (error) {
        reject(error);
      }

      this.lastRequest = Date.now();
    }

    this.processing = false;
  }
}
```

---

## Session Management

### Gestão de Múltiplas Sessões

#### Sessões Simultâneas
- 👤 **User/Analyst**: 3 sessões
- 👥 **Manager**: 5 sessões
- 🔧 **Admin**: 10 sessões
- 🛡️ **Super Admin**: Ilimitado

#### Informações da Sessão
```json
{
  "session_id": "session-uuid",
  "user_id": "user-uuid",
  "device_info": {
    "type": "desktop",
    "os": "Windows 10",
    "browser": "Chrome 118.0",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
  },
  "created_at": "2024-09-24T09:00:00Z",
  "last_activity": "2024-09-24T10:30:00Z",
  "expires_at": "2024-09-25T09:00:00Z",
  "active": true
}
```

### Listar Sessões Ativas

#### Request
```http
GET /api/v1/auth/sessions
Authorization: Bearer <your-jwt-token>
```

#### Response
```json
{
  "success": true,
  "data": {
    "current_session": "session-uuid-current",
    "sessions": [
      {
        "id": "session-uuid-1",
        "device": "Desktop - Chrome",
        "location": "São Paulo, SP",
        "ip_address": "192.168.1.100",
        "last_activity": "2024-09-24T10:30:00Z",
        "current": true
      },
      {
        "id": "session-uuid-2",
        "device": "Mobile - Safari",
        "location": "São Paulo, SP",
        "ip_address": "192.168.1.105",
        "last_activity": "2024-09-24T08:15:00Z",
        "current": false
      }
    ]
  }
}
```

### Revogação de Sessões

#### Revogar Sessão Específica
```http
DELETE /api/v1/auth/sessions/{session-id}
Authorization: Bearer <your-jwt-token>
```

#### Revogar Todas as Outras Sessões
```http
DELETE /api/v1/auth/sessions/others
Authorization: Bearer <your-jwt-token>
```

#### Revogar Todas as Sessões
```http
DELETE /api/v1/auth/sessions/all
Authorization: Bearer <your-jwt-token>
```

---

## Security Best Practices

### Para Desenvolvedores

#### 1. Armazenamento Seguro de Tokens

##### ✅ Fazer (Recomendado)
```javascript
// Usar httpOnly cookies para refresh tokens
document.cookie = "refreshToken=token; HttpOnly; Secure; SameSite=Strict";

// Usar memory storage para access tokens
const tokenStore = {
  accessToken: null,
  setToken(token) { this.accessToken = token; },
  getToken() { return this.accessToken; },
  clearToken() { this.accessToken = null; }
};
```

##### ❌ Evitar
```javascript
// NUNCA fazer isso - vulnerável a XSS
localStorage.setItem('accessToken', token);
sessionStorage.setItem('accessToken', token);
```

#### 2. Configuração de CORS
```javascript
// Servidor - configurar CORS restritivo
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true,
  optionsSuccessStatus: 200
}));
```

#### 3. Validação de Token no Client
```javascript
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}
```

### Para Administradores

#### 1. Configurações de Segurança
```env
# .env - configurações recomendadas
JWT_SECRET=<256-bit-random-string>
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_TIME=900
ENABLE_2FA_REQUIRED=true
SESSION_TIMEOUT=3600
```

#### 2. Monitoramento de Segurança
```sql
-- Queries para monitoramento
SELECT
  email,
  failed_login_attempts,
  last_failed_login,
  account_locked
FROM users
WHERE failed_login_attempts > 3
ORDER BY last_failed_login DESC;

-- Sessões suspeitas
SELECT
  u.email,
  s.ip_address,
  s.user_agent,
  s.created_at,
  s.last_activity
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.ip_address NOT IN (
  SELECT DISTINCT ip_address
  FROM user_trusted_ips
  WHERE user_id = s.user_id
);
```

### Para Usuários Finais

#### 1. Configuração de 2FA
- 📱 **Use app autenticador** - Mais seguro que SMS
- 💾 **Salve backup codes** - Em local seguro
- 🔄 **Atualize regularmente** - Troque senhas periodicamente

#### 2. Boas Práticas
- 🔐 **Senhas fortes** - Mínimo 12 caracteres
- 🚫 **Não reutilize senhas** - Única para cada sistema
- 📱 **Logout em dispositivos** - Especialmente públicos
- 🛡️ **Monitore sessões** - Revogue sessões suspeitas

---

## Error Handling

### Códigos de Erro de Autenticação

#### AUTH_001 - Invalid Credentials
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Credenciais inválidas",
    "details": {
      "attempts_remaining": 2,
      "lockout_in": null
    }
  }
}
```

#### AUTH_002 - Token Expired
```json
{
  "success": false,
  "error": {
    "code": "AUTH_002",
    "message": "Token expirado",
    "details": {
      "expired_at": "2024-09-24T10:30:00Z",
      "can_refresh": true
    }
  }
}
```

#### AUTH_003 - 2FA Required
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "Autenticação de dois fatores obrigatória",
    "details": {
      "challenge_token": "temp-uuid",
      "methods": ["totp", "backup_codes"],
      "expires_in": 300
    }
  }
}
```

#### AUTH_004 - Account Locked
```json
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Conta bloqueada devido a múltiplas tentativas falhadas",
    "details": {
      "locked_until": "2024-09-24T11:30:00Z",
      "remaining_time": 900,
      "contact_admin": true
    }
  }
}
```

### Tratamento de Erros

#### JavaScript
```javascript
async function handleAPICall(apiCall) {
  try {
    const response = await apiCall();
    return response;
  } catch (error) {
    switch (error.code) {
      case 'AUTH_001':
        showError('Credenciais inválidas. Verifique email e senha.');
        break;

      case 'AUTH_002':
        if (error.details?.can_refresh) {
          await refreshTokens();
          return apiCall(); // Retry
        } else {
          redirectToLogin();
        }
        break;

      case 'AUTH_003':
        showTwoFactorForm(error.details.challenge_token);
        break;

      case 'AUTH_004':
        const lockTime = error.details.remaining_time;
        showError(`Conta bloqueada. Tente novamente em ${lockTime} segundos.`);
        break;

      default:
        showError('Erro de autenticação. Tente novamente.');
    }
  }
}
```

---

## Code Examples

### Complete Authentication Flow

#### React + Hooks
```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        user: action.payload.user,
        tokens: action.payload.tokens,
        isAuthenticated: true
      };

    case 'LOGIN_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false
      };

    case 'LOGOUT':
      return {
        ...state,
        user: null,
        tokens: null,
        isAuthenticated: false
      };

    case 'REFRESH_TOKENS':
      return {
        ...state,
        tokens: action.payload
      };

    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    tokens: null,
    isAuthenticated: false,
    loading: false,
    error: null
  });

  const login = async (email, password, twoFactorToken) => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, twoFactorToken })
      });

      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: data.data });
        localStorage.setItem('auth_tokens', JSON.stringify(data.data.tokens));
      } else {
        dispatch({ type: 'LOGIN_ERROR', payload: data.error });
      }
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR', payload: { message: 'Erro de conexão' } });
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.tokens?.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ all_devices: false })
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    dispatch({ type: 'LOGOUT' });
    localStorage.removeItem('auth_tokens');
  };

  const refreshTokens = async () => {
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: state.tokens?.refreshToken
        })
      });

      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'REFRESH_TOKENS', payload: data.data });
        localStorage.setItem('auth_tokens', JSON.stringify(data.data));
        return true;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    }

    dispatch({ type: 'LOGOUT' });
    localStorage.removeItem('auth_tokens');
    return false;
  };

  // Auto-load tokens on app start
  useEffect(() => {
    const savedTokens = localStorage.getItem('auth_tokens');
    if (savedTokens) {
      try {
        const tokens = JSON.parse(savedTokens);
        // Verificar se token ainda é válido
        const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
        if (Date.now() < payload.exp * 1000) {
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { tokens, user: payload }
          });
        } else {
          refreshTokens();
        }
      } catch (error) {
        localStorage.removeItem('auth_tokens');
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      refreshTokens
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Custom hook para API calls autenticadas
export const useAuthenticatedAPI = () => {
  const { tokens, refreshTokens } = useAuth();

  const apiCall = async (endpoint, options = {}) => {
    let response = await fetch(`/api/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens?.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Auto-refresh em caso de token expirado
    if (response.status === 401) {
      const data = await response.json();
      if (data.error?.code === 'AUTH_002') {
        const refreshed = await refreshTokens();
        if (refreshed) {
          response = await fetch(`/api/v1${endpoint}`, {
            ...options,
            headers: {
              'Authorization': `Bearer ${tokens?.accessToken}`,
              'Content-Type': 'application/json',
              ...options.headers
            }
          });
        }
      }
    }

    return response;
  };

  return { apiCall };
};
```

### Node.js Backend Authentication

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    let user;

    if (apiKey) {
      // API Key authentication
      user = await authenticateAPIKey(apiKey);
    } else if (authHeader) {
      // JWT authentication
      const token = authHeader.split(' ')[1];
      user = await authenticateJWT(token);
    } else {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_MISSING',
          message: 'Token de autenticação requerido'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: error.code || 'AUTH_INVALID',
        message: error.message || 'Token inválido'
      }
    });
  }
};

const authenticateJWT = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.sub);
    if (!user || !user.active) {
      throw new Error('Usuário não encontrado ou inativo');
    }

    return user;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const expiredError = new Error('Token expirado');
      expiredError.code = 'AUTH_002';
      throw expiredError;
    }
    throw new Error('Token inválido');
  }
};

const authenticateAPIKey = async (apiKey) => {
  const key = await APIKey.findOne({
    key: apiKey,
    active: true,
    expires_at: { $gt: new Date() }
  }).populate('user');

  if (!key) {
    throw new Error('API Key inválida ou expirada');
  }

  // Rate limiting para API keys
  await checkAPIKeyRateLimit(key);

  return key.user;
};

const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Autenticação requerida' }
      });
    }

    const hasPermission = requiredPermissions.every(permission =>
      user.permissions.includes(permission) ||
      user.role === 'super_admin'
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_FORBIDDEN', message: 'Permissões insuficientes' }
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorize
};
```

---

**Authentication Guide - Versão 2.0**
**Última Atualização:** 24/09/2024
**Próxima Revisão:** 24/12/2024
**Responsável:** Equipe de Security & API Development