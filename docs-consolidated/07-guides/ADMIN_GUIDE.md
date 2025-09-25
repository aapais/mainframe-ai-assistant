# Guia do Administrador - Sistema de Gestão de Incidentes
## Versão 2.0 - Atualizado em 24/09/2024

### 📋 Índice
1. [Visão Geral Administrativa](#visão-geral-administrativa)
2. [Instalação e Configuração](#instalação-e-configuração)
3. [Gestão de Usuários](#gestão-de-usuários)
4. [Configuração do Sistema](#configuração-do-sistema)
5. [Gestão de Banco de Dados](#gestão-de-banco-de-dados)
6. [Integrações Externas](#integrações-externas)
7. [Monitoramento e Performance](#monitoramento-e-performance)
8. [Backup e Recuperação](#backup-e-recuperação)
9. [Segurança](#segurança)
10. [Manutenção](#manutenção)
11. [Troubleshooting Avançado](#troubleshooting-avançado)

## Visão Geral Administrativa

### Responsabilidades do Administrador
- ✅ **Gestão de Infraestrutura** - Servidores e recursos
- ✅ **Configuração de Sistema** - Parâmetros e integrações
- ✅ **Gestão de Usuários** - Criação, permissões e acesso
- ✅ **Monitoramento** - Performance e disponibilidade
- ✅ **Segurança** - Políticas e compliance
- ✅ **Backup/Recovery** - Proteção e recuperação de dados
- ✅ **Manutenção** - Updates e otimizações

### Arquitetura do Sistema

#### Componentes Principais
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Electron)    │◄──►│   (Node.js)     │◄──►│  (PostgreSQL)   │
│   - React       │    │   - Express     │    │   - Vector      │
│   - TypeScript  │    │   - APIs        │    │   - FTS         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────┐
                    │   External APIs     │
                    │   - OpenAI          │
                    │   - Gemini          │
                    │   - Claude          │
                    │   - ChromaDB        │
                    └─────────────────────┘
```

#### Stack Tecnológico
- **Frontend:** Electron 38.x + React 18 + TypeScript
- **Backend:** Node.js 20.x + Express 5.x
- **Database:** PostgreSQL 16.x + Vector Extensions
- **Cache:** Redis 7.x (opcional)
- **AI/ML:** OpenAI, Google Gemini, Anthropic Claude
- **Vector Search:** ChromaDB, pgvector

### Requisitos de Sistema

#### Servidor/Máquina Principal
- **CPU:** 8 cores, 2.4GHz+ (Intel i7/AMD Ryzen)
- **RAM:** 16GB mínimo, 32GB recomendado
- **Armazenamento:** 1TB SSD para dados + OS
- **Rede:** 1Gbps mínimo, baixa latência
- **OS:** Windows Server 2019+, Ubuntu 20.04+, macOS 12+

#### Banco de Dados
- **CPU:** 4 cores dedicados para DB
- **RAM:** 8GB para PostgreSQL
- **Armazenamento:** SSD NVMe para performance
- **Backup:** Armazenamento separado para backups
- **Conexões:** Suporte para 100+ conexões concorrentes

## Instalação e Configuração

### Instalação do Sistema

#### 1. Preparação do Ambiente
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install nodejs npm postgresql postgresql-contrib git

# Windows (via PowerShell como Admin)
winget install Git.Git Node.js.Node PostgreSQL

# macOS (via Homebrew)
brew install node npm postgresql git
```

#### 2. Clone e Setup Inicial
```bash
# Clone do repositório
git clone https://github.com/aapais/mainframe-ai-assistant.git
cd mainframe-ai-assistant

# Instalação de dependências
npm install
cd src/api && npm install
cd ../../tests/integration && npm install

# Configuração inicial
cp .env.example .env
```

#### 3. Configuração do Banco de Dados
```bash
# Iniciar PostgreSQL
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS

# Criar banco e usuário
sudo -u postgres psql
CREATE DATABASE incident_management;
CREATE USER incident_admin WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE incident_management TO incident_admin;

# Executar schema
psql -U incident_admin -d incident_management -f scripts/database/schema.sql
```

#### 4. Configuração de Variáveis de Ambiente
```bash
# Editar arquivo .env
DATABASE_URL=postgresql://incident_admin:secure_password_here@localhost:5432/incident_management
NODE_ENV=production
PORT=3001

# APIs de IA (obter das respectivas plataformas)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...

# Configurações de segurança
JWT_SECRET=your-super-secret-jwt-key-here
ENCRYPTION_KEY=32-byte-encryption-key-here

# ChromaDB (se usar vector search)
CHROMA_URL=http://localhost:8000

# Redis (se usar cache)
REDIS_URL=redis://localhost:6379
```

### Configuração Avançada

#### 1. SSL/TLS Configuration
```bash
# Gerar certificados SSL (para produção usar certificados válidos)
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes

# Configurar no .env
SSL_CERT_PATH=./certs/cert.pem
SSL_KEY_PATH=./certs/key.pem
ENABLE_HTTPS=true
```

#### 2. Configuração de Proxy Reverso (Nginx)
```nginx
# /etc/nginx/sites-available/incident-management
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 3. Configuração de Firewall
```bash
# UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 443/tcp
sudo ufw allow from trusted_ip to any port 5432  # PostgreSQL
sudo ufw enable

# Windows Firewall
netsh advfirewall firewall add rule name="Incident Management" dir=in action=allow protocol=TCP localport=443
```

## Gestão de Usuários

### Níveis de Acesso

#### Hierarquia de Permissões
1. **Super Admin** - Acesso total ao sistema
2. **Admin** - Gestão de usuários e configurações
3. **Manager** - Supervisão de equipes e relatórios
4. **Analyst** - Gestão de incidentes e conhecimento
5. **User** - Acesso básico de leitura e criação

#### Matriz de Permissões
```
Funcionalidade           | Super | Admin | Manager | Analyst | User
-------------------------|-------|-------|---------|---------|------
Sistema/Configuração     |   ✅  |   ✅  |    ❌   |    ❌   |  ❌
Gestão de Usuários       |   ✅  |   ✅  |    ❌   |    ❌   |  ❌
Relatórios Gerenciais    |   ✅  |   ✅  |    ✅   |    ❌   |  ❌
Criar Incidentes         |   ✅  |   ✅  |    ✅   |    ✅   |  ✅
Editar Todos Incidentes  |   ✅  |   ✅  |    ✅   |    ❌   |  ❌
Editar Próprios Incident.|   ✅  |   ✅  |    ✅   |    ✅   |  ✅
Base de Conhecimento     |   ✅  |   ✅  |    ✅   |    ✅   |  ✅
Backup/Restauração       |   ✅  |   ❌  |    ❌   |    ❌   |  ❌
```

### Criação de Usuários

#### Via Interface Web
1. **Acesse:** Admin Panel > Usuários > Criar Usuário
2. **Dados Básicos:**
   - Nome completo
   - Email (será o login)
   - Senha temporária (usuário deve alterar no primeiro login)
   - Nível de acesso
3. **Configurações:**
   - Forçar alteração de senha
   - Ativar 2FA obrigatório
   - Data de expiração da conta
4. **Notificação:** Sistema envia email de boas-vindas

#### Via Command Line Interface
```bash
# Executar script de criação de usuário
node scripts/admin/create-user.js \
  --name "João Silva" \
  --email "joao.silva@empresa.com" \
  --role "analyst" \
  --force-password-change \
  --send-email
```

#### Via SQL Direto (Emergência)
```sql
-- Criar usuário diretamente no banco (senha será 'temp123')
INSERT INTO users (name, email, password_hash, role, created_at, force_password_change)
VALUES (
  'Emergency User',
  'emergency@empresa.com',
  '$2b$10$...hash_of_temp123...',
  'admin',
  NOW(),
  true
);
```

### Gestão de Sessões

#### Configurações de Sessão
```javascript
// Configuração no .env
SESSION_TIMEOUT=3600        # 1 hora em segundos
MAX_CONCURRENT_SESSIONS=3   # Máximo de sessões por usuário
SESSION_CLEANUP_INTERVAL=300 # Limpeza a cada 5 minutos
```

#### Monitoramento de Sessões
```bash
# Verificar sessões ativas
node scripts/admin/list-sessions.js

# Encerrar sessão específica
node scripts/admin/kill-session.js --session-id "session_uuid_here"

# Encerrar todas as sessões de um usuário
node scripts/admin/kill-user-sessions.js --user-email "user@domain.com"
```

### Auditoria de Usuários

#### Log de Atividades
- **Login/Logout:** Timestamps e IPs
- **Ações Críticas:** Criação, edição, exclusão
- **Falhas de Autenticação:** Tentativas de login inválidas
- **Mudanças de Permissão:** Alterações de níveis de acesso

#### Relatórios de Auditoria
```sql
-- Usuários mais ativos nos últimos 30 dias
SELECT u.name, u.email, COUNT(al.id) as activities
FROM users u
JOIN activity_logs al ON u.id = al.user_id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.name, u.email
ORDER BY activities DESC;

-- Tentativas de login falhadas
SELECT email, ip_address, attempt_time, failure_reason
FROM failed_logins
WHERE attempt_time >= NOW() - INTERVAL '24 hours'
ORDER BY attempt_time DESC;
```

## Configuração do Sistema

### Configurações de Performance

#### Otimizações de Banco de Dados
```postgresql
-- Configurações recomendadas para PostgreSQL
-- postgresql.conf
shared_buffers = '4GB'                    # 25% da RAM
effective_cache_size = '12GB'             # 75% da RAM
work_mem = '256MB'                        # Para operações de sort
maintenance_work_mem = '1GB'              # Para VACUUM, INDEX
checkpoint_completion_target = 0.9
wal_buffers = '64MB'
default_statistics_target = 100
random_page_cost = 1.1                    # Para SSD
effective_io_concurrency = 200            # Para SSD
```

#### Configurações de Node.js
```javascript
// Configurações de processo (package.json)
{
  "scripts": {
    "start:prod": "node --max-old-space-size=4096 --optimize-for-size src/api/incident-ai-server.js"
  }
}

// Configurações de cluster (para alta disponibilidade)
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  require('./incident-ai-server.js');
}
```

### Configurações de Integração

#### APIs de Inteligência Artificial
```javascript
// config/ai-services.js
module.exports = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.3,
    timeout: 30000,
    retries: 3
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-pro',
    temperature: 0.3,
    timeout: 30000,
    retries: 3
  },

  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    timeout: 30000,
    retries: 3
  }
};
```

#### ChromaDB para Vector Search
```bash
# Instalação e configuração do ChromaDB
pip install chromadb

# Configuração em Docker
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest

# Configuração no .env
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION_NAME=incident_knowledge
EMBEDDING_MODEL=text-embedding-ada-002
```

### Configurações de Logging

#### Estrutura de Logs
```javascript
// config/winston.js - Configuração de logging
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'incident-management' },
  transports: [
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

#### Rotação de Logs
```bash
# Configuração logrotate (Linux)
# /etc/logrotate.d/incident-management
/var/log/incident-management/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 appuser appuser
    postrotate
        systemctl restart incident-management
    endscript
}
```

### Configurações de Cache

#### Redis Configuration
```bash
# redis.conf - Configurações recomendadas
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
```

#### Cache Strategy no Código
```javascript
// config/cache.js
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Estratégias de cache por tipo de dados
const CACHE_STRATEGIES = {
  user_sessions: { ttl: 3600, prefix: 'session:' },
  search_results: { ttl: 300, prefix: 'search:' },
  incident_details: { ttl: 600, prefix: 'incident:' },
  knowledge_articles: { ttl: 1800, prefix: 'kb:' }
};
```

## Gestão de Banco de Dados

### Administração Básica

#### Conexão e Monitoramento
```bash
# Conectar ao banco
psql -U incident_admin -d incident_management -h localhost

# Verificar status
\l                    # Listar databases
\dt                   # Listar tabelas
\di                   # Listar índices
\du                   # Listar usuários
\x                    # Modo expandido
```

#### Consultas de Monitoramento
```sql
-- Verificar conexões ativas
SELECT pid, usename, client_addr, state, query_start, query
FROM pg_stat_activity
WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%';

-- Tamanho das tabelas
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Estatísticas de performance
SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
FROM pg_stat_user_tables;
```

### Manutenção Preventiva

#### Scripts de Manutenção Automática
```bash
#!/bin/bash
# scripts/maintenance/daily-maintenance.sh

echo "$(date): Iniciando manutenção diária..."

# Vacuum e analyze nas tabelas principais
psql -U incident_admin -d incident_management <<EOF
VACUUM ANALYZE incidents_enhanced;
VACUUM ANALYZE knowledge_base;
VACUUM ANALYZE users;
VACUUM ANALYZE activity_logs;
EOF

# Limpeza de logs antigos
find /var/log/incident-management -name "*.log" -mtime +30 -delete

# Limpeza de sessões expiradas
node scripts/admin/cleanup-expired-sessions.js

# Backup incremental
scripts/backup/incremental-backup.sh

echo "$(date): Manutenção diária concluída."
```

#### Otimização de Índices
```sql
-- Recriar índices se necessário (executar em horário de baixo uso)
REINDEX INDEX CONCURRENTLY idx_incidents_search_vector;
REINDEX INDEX CONCURRENTLY idx_incidents_created_at;
REINDEX INDEX CONCURRENTLY idx_incidents_status;

-- Verificar estatísticas dos índices
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Identificar índices não utilizados
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexname NOT LIKE '%_pkey';
```

### Backup e Restore

#### Backup Completo
```bash
#!/bin/bash
# scripts/backup/full-backup.sh

BACKUP_DIR="/backup/incident-management"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/full_backup_$DATE.sql"

mkdir -p $BACKUP_DIR

# Backup do banco de dados
pg_dump -U incident_admin -h localhost incident_management > $BACKUP_FILE

# Compactar backup
gzip $BACKUP_FILE

# Backup de arquivos do sistema
tar -czf "$BACKUP_DIR/files_backup_$DATE.tar.gz" \
  --exclude='node_modules' \
  --exclude='logs' \
  /path/to/application

# Manter apenas os últimos 7 backups
find $BACKUP_DIR -name "full_backup_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "files_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completo realizado: $BACKUP_FILE.gz"
```

#### Restore de Backup
```bash
#!/bin/bash
# scripts/backup/restore-backup.sh

if [ -z "$1" ]; then
    echo "Uso: $0 <arquivo_backup.sql.gz>"
    exit 1
fi

BACKUP_FILE=$1

# Confirmar operação
read -p "ATENÇÃO: Esta operação irá substituir todos os dados. Continuar? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "Operação cancelada."
    exit 0
fi

# Parar serviços
systemctl stop incident-management

# Backup de segurança antes do restore
pg_dump -U incident_admin incident_management > "/tmp/pre_restore_backup_$(date +%s).sql"

# Restore
gunzip -c $BACKUP_FILE | psql -U incident_admin incident_management

# Reiniciar serviços
systemctl start incident-management

echo "Restore concluído. Verifique a aplicação."
```

## Integrações Externas

### Configuração de APIs de IA

#### OpenAI Configuration
```javascript
// config/integrations/openai.js
const { Configuration, OpenAIApi } = require("openai");

const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID, // opcional
});

const openai = new OpenAIApi(openaiConfig);

// Configurações específicas por uso
const OPENAI_CONFIGS = {
  categorization: {
    model: "gpt-4",
    temperature: 0.1,
    max_tokens: 150,
    top_p: 1.0
  },
  summary: {
    model: "gpt-3.5-turbo",
    temperature: 0.3,
    max_tokens: 500
  },
  search: {
    model: "text-embedding-ada-002",
    // Usado para embeddings de busca
  }
};
```

#### Rate Limiting e Retry Logic
```javascript
// utils/api-rate-limiter.js
const rateLimit = require('express-rate-limit');

const createAPILimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Diferentes limites para diferentes APIs
const API_LIMITERS = {
  openai: createAPILimiter(60000, 100, "OpenAI rate limit exceeded"),
  gemini: createAPILimiter(60000, 60, "Gemini rate limit exceeded"),
  claude: createAPILimiter(60000, 50, "Claude rate limit exceeded")
};

// Retry logic para APIs externas
const retryAPICall = async (apiCall, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      const waitTime = delay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};
```

### Webhook Integration

#### Configuração de Webhooks
```javascript
// routes/webhooks.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Middleware para validar webhooks
const validateWebhook = (secret) => {
  return (req, res, next) => {
    const signature = req.headers['x-webhook-signature'];
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (signature !== `sha256=${expectedSignature}`) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    next();
  };
};

// Webhook para integração externa
router.post('/external-system',
  validateWebhook(process.env.WEBHOOK_SECRET),
  async (req, res) => {
    try {
      const { event, data } = req.body;

      switch (event) {
        case 'incident.created':
          await handleExternalIncident(data);
          break;
        case 'incident.updated':
          await handleIncidentUpdate(data);
          break;
        default:
          console.log(`Unknown webhook event: ${event}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);
```

### SSO Integration (SAML/OAuth)

#### SAML Configuration
```javascript
// config/saml.js
const saml2 = require('saml2-js');

const sp_options = {
  entity_id: process.env.SAML_ENTITY_ID,
  private_key: process.env.SAML_PRIVATE_KEY,
  certificate: process.env.SAML_CERTIFICATE,
  assert_endpoint: `${process.env.BASE_URL}/auth/saml/assert`,
  sign_get_request: false,
  allow_unencrypted_assertion: false,
  nameid_format: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
};

const idp_options = {
  sso_login_url: process.env.SAML_SSO_URL,
  sso_logout_url: process.env.SAML_SLO_URL,
  certificates: [process.env.SAML_IDP_CERTIFICATE]
};

const sp = new saml2.ServiceProvider(sp_options);
const idp = new saml2.IdentityProvider(idp_options);
```

## Monitoramento e Performance

### Métricas de Sistema

#### Health Check Endpoint
```javascript
// routes/health.js
const express = require('express');
const router = express.Router();

router.get('/health', async (req, res) => {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: process.env.npm_package_version || '2.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'unknown',
    external_apis: {},
    performance: {}
  };

  try {
    // Verificar conexão com banco
    const dbResult = await db.query('SELECT 1');
    healthCheck.database = 'healthy';

    // Verificar APIs externas (com timeout)
    const apiChecks = [
      checkOpenAI(),
      checkGemini(),
      checkClaude()
    ];

    const apiResults = await Promise.allSettled(
      apiChecks.map(check =>
        Promise.race([
          check,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ])
      )
    );

    healthCheck.external_apis = {
      openai: apiResults[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      gemini: apiResults[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      claude: apiResults[2].status === 'fulfilled' ? 'healthy' : 'unhealthy'
    };

    // Métricas de performance
    healthCheck.performance = {
      avg_response_time: await getAvgResponseTime(),
      active_connections: await getActiveConnections(),
      cache_hit_rate: await getCacheHitRate()
    };

  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.error = error.message;
    return res.status(503).json(healthCheck);
  }

  res.json(healthCheck);
});
```

#### Prometheus Metrics
```javascript
// monitoring/prometheus.js
const client = require('prom-client');

// Registrar métricas padrão
client.register.setDefaultLabels({
  app: 'incident-management'
});
client.collectDefaultMetrics();

// Métricas customizadas
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const incidentOperations = new client.Counter({
  name: 'incident_operations_total',
  help: 'Total number of incident operations',
  labelNames: ['operation', 'status']
});

const activeIncidents = new client.Gauge({
  name: 'active_incidents_count',
  help: 'Number of active incidents'
});

const knowledgeBaseSize = new client.Gauge({
  name: 'knowledge_base_articles_count',
  help: 'Number of articles in knowledge base'
});

// Middleware para coletar métricas HTTP
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });

  next();
};
```

### Alerting

#### Configuration de Alertas
```javascript
// monitoring/alerts.js
const nodemailer = require('nodemailer');
const winston = require('winston');

class AlertManager {
  constructor() {
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    this.alertThresholds = {
      response_time: 5000,        // 5 segundos
      error_rate: 0.05,           // 5%
      memory_usage: 0.85,         // 85%
      cpu_usage: 0.80,            // 80%
      disk_usage: 0.90,           // 90%
      db_connections: 80          // 80 conexões
    };

    this.alertCooldown = new Map(); // Previne spam de alertas
  }

  async checkSystemHealth() {
    const metrics = await this.collectMetrics();

    for (const [metric, value] of Object.entries(metrics)) {
      if (this.shouldAlert(metric, value)) {
        await this.sendAlert(metric, value, this.alertThresholds[metric]);
      }
    }
  }

  shouldAlert(metric, value) {
    const threshold = this.alertThresholds[metric];
    if (!threshold || value < threshold) return false;

    // Verificar cooldown (não alertar mais de uma vez por hora)
    const cooldownKey = `${metric}_${Math.floor(Date.now() / 3600000)}`;
    if (this.alertCooldown.has(cooldownKey)) return false;

    this.alertCooldown.set(cooldownKey, true);
    return true;
  }

  async sendAlert(metric, currentValue, threshold) {
    const subject = `🚨 ALERT: ${metric} threshold exceeded`;
    const text = `
Sistema: Incident Management
Métrica: ${metric}
Valor atual: ${currentValue}
Threshold: ${threshold}
Timestamp: ${new Date().toISOString()}

Por favor, verificar o sistema imediatamente.
    `;

    await this.emailTransporter.sendMail({
      from: process.env.ALERT_FROM_EMAIL,
      to: process.env.ALERT_TO_EMAILS,
      subject,
      text
    });

    winston.error(`Alert sent for ${metric}`, {
      metric,
      currentValue,
      threshold,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Log Analysis

#### ELK Stack Integration
```javascript
// monitoring/elk-integration.js
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const esTransportOpts = {
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    auth: {
      username: process.env.ELASTICSEARCH_USER,
      password: process.env.ELASTICSEARCH_PASS
    }
  },
  index: 'incident-management-logs',
  indexTemplate: {
    name: 'incident-management-template',
    patterns: ['incident-management-logs-*'],
    settings: {
      number_of_shards: 2,
      number_of_replicas: 1
    },
    mappings: {
      properties: {
        '@timestamp': { type: 'date' },
        level: { type: 'keyword' },
        message: { type: 'text' },
        service: { type: 'keyword' },
        user_id: { type: 'keyword' },
        incident_id: { type: 'keyword' },
        action: { type: 'keyword' },
        ip_address: { type: 'ip' }
      }
    }
  }
};

const logger = winston.createLogger({
  transports: [
    new ElasticsearchTransport(esTransportOpts),
    new winston.transports.Console()
  ]
});
```

## Backup e Recuperação

### Estratégia de Backup

#### Backup Full Automatizado
```bash
#!/bin/bash
# scripts/backup/automated-full-backup.sh

set -e  # Parar em caso de erro

# Configurações
BACKUP_BASE_DIR="/backup/incident-management"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
DB_USER="incident_admin"
DB_NAME="incident_management"

# Criar diretório se não existir
mkdir -p "$BACKUP_BASE_DIR"

# Função de log
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$BACKUP_BASE_DIR/backup.log"
}

log "Iniciando backup completo..."

# 1. Backup do banco de dados
log "Executando backup do banco de dados..."
DB_BACKUP_FILE="$BACKUP_BASE_DIR/database_$DATE.sql"
pg_dump -U "$DB_USER" -h localhost "$DB_NAME" > "$DB_BACKUP_FILE"

if [ $? -eq 0 ]; then
    gzip "$DB_BACKUP_FILE"
    log "Backup do banco concluído: ${DB_BACKUP_FILE}.gz"
else
    log "ERRO: Falha no backup do banco de dados"
    exit 1
fi

# 2. Backup dos arquivos da aplicação
log "Executando backup dos arquivos..."
APP_BACKUP_FILE="$BACKUP_BASE_DIR/application_$DATE.tar.gz"
tar -czf "$APP_BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='logs/*.log' \
    --exclude='*.tmp' \
    --exclude='.git' \
    -C /path/to/application .

if [ $? -eq 0 ]; then
    log "Backup dos arquivos concluído: $APP_BACKUP_FILE"
else
    log "ERRO: Falha no backup dos arquivos"
    exit 1
fi

# 3. Backup das configurações
log "Executando backup das configurações..."
CONFIG_BACKUP_FILE="$BACKUP_BASE_DIR/configs_$DATE.tar.gz"
tar -czf "$CONFIG_BACKUP_FILE" \
    /etc/nginx/sites-available/incident-management \
    /etc/systemd/system/incident-management.service \
    /etc/logrotate.d/incident-management \
    ~/.env.production

# 4. Limpeza de backups antigos
log "Limpando backups antigos (${RETENTION_DAYS} dias)..."
find "$BACKUP_BASE_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_BASE_DIR" -name "*.sql" -mtime +$RETENTION_DAYS -delete

# 5. Verificar integridade dos backups
log "Verificando integridade dos backups..."
if gzip -t "${DB_BACKUP_FILE}.gz" && tar -tzf "$APP_BACKUP_FILE" >/dev/null; then
    log "✅ Backup completo realizado com sucesso"

    # Enviar notificação de sucesso
    echo "Backup realizado com sucesso em $(date)" | \
    mail -s "✅ Backup Incident Management - Sucesso" admin@empresa.com
else
    log "❌ ERRO: Problemas na integridade dos backups"
    echo "Problemas detectados no backup de $(date)" | \
    mail -s "❌ Backup Incident Management - ERRO" admin@empresa.com
    exit 1
fi

log "Backup finalizado."
```

#### Backup Incremental
```bash
#!/bin/bash
# scripts/backup/incremental-backup.sh

BACKUP_DIR="/backup/incident-management/incremental"
FULL_BACKUP_DIR="/backup/incident-management"
DATE=$(date +%Y%m%d_%H%M%S)
LAST_BACKUP_FILE="$BACKUP_DIR/.last_backup_timestamp"

mkdir -p "$BACKUP_DIR"

# Determinar timestamp do último backup
if [ -f "$LAST_BACKUP_FILE" ]; then
    LAST_BACKUP=$(cat "$LAST_BACKUP_FILE")
else
    # Se não há backup anterior, usar timestamp de 24h atrás
    LAST_BACKUP=$(date -d "1 day ago" +%s)
fi

# WAL-E para backup incremental do PostgreSQL
envdir /etc/wal-e.d/env wal-e backup-push /var/lib/postgresql/12/main

# Backup de arquivos modificados desde o último backup
find /path/to/application \
    -type f \
    -newer "$LAST_BACKUP_FILE" \
    -not -path "*/node_modules/*" \
    -not -path "*/logs/*" \
    -not -path "*/.git/*" \
    | tar -czf "$BACKUP_DIR/incremental_files_$DATE.tar.gz" -T -

# Atualizar timestamp
echo $(date +%s) > "$LAST_BACKUP_FILE"

echo "Backup incremental concluído: $DATE"
```

### Disaster Recovery

#### Plano de Recuperação
```bash
#!/bin/bash
# scripts/recovery/disaster-recovery.sh

# ESTE SCRIPT DEVE SER EXECUTADO APENAS EM CASO DE DISASTER RECOVERY
# ATENÇÃO: IRÁ SUBSTITUIR TODOS OS DADOS ATUAIS

set -e

DR_MODE=$1  # 'database' ou 'full' ou 'files'
BACKUP_DATE=$2  # formato: YYYYMMDD_HHMMSS

if [ -z "$DR_MODE" ] || [ -z "$BACKUP_DATE" ]; then
    echo "Uso: $0 <mode> <backup_date>"
    echo "Modes: database, files, full"
    echo "Example: $0 full 20241201_140530"
    exit 1
fi

# Confirmação de segurança
echo "⚠️  ATENÇÃO: DISASTER RECOVERY ⚠️"
echo "Modo: $DR_MODE"
echo "Backup: $BACKUP_DATE"
echo "Esta operação irá SUBSTITUIR os dados atuais."
read -p "Digite 'CONFIRMO' para continuar: " confirmation

if [ "$confirmation" != "CONFIRMO" ]; then
    echo "Operação cancelada."
    exit 0
fi

BACKUP_BASE_DIR="/backup/incident-management"
DR_LOG="/var/log/disaster-recovery-$(date +%s).log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DR_LOG"
}

log "🚨 Iniciando Disaster Recovery - Modo: $DR_MODE, Backup: $BACKUP_DATE"

# Parar todos os serviços
log "Parando serviços..."
systemctl stop incident-management
systemctl stop nginx

case $DR_MODE in
    "database"|"full")
        log "Restaurando banco de dados..."

        # Backup de segurança atual
        pg_dump -U incident_admin incident_management > "/tmp/pre_dr_backup_$(date +%s).sql"

        # Restaurar banco
        DB_BACKUP_FILE="$BACKUP_BASE_DIR/database_$BACKUP_DATE.sql.gz"
        if [ -f "$DB_BACKUP_FILE" ]; then
            dropdb -U incident_admin incident_management
            createdb -U incident_admin incident_management
            gunzip -c "$DB_BACKUP_FILE" | psql -U incident_admin incident_management
            log "✅ Banco de dados restaurado"
        else
            log "❌ ERRO: Arquivo de backup do banco não encontrado: $DB_BACKUP_FILE"
            exit 1
        fi
        ;;
esac

case $DR_MODE in
    "files"|"full")
        log "Restaurando arquivos da aplicação..."

        # Backup atual
        tar -czf "/tmp/current_app_backup_$(date +%s).tar.gz" -C /path/to/application .

        # Restaurar arquivos
        APP_BACKUP_FILE="$BACKUP_BASE_DIR/application_$BACKUP_DATE.tar.gz"
        if [ -f "$APP_BACKUP_FILE" ]; then
            rm -rf /path/to/application/*
            tar -xzf "$APP_BACKUP_FILE" -C /path/to/application

            # Reinstalar dependências
            cd /path/to/application
            npm install --production
            log "✅ Arquivos da aplicação restaurados"
        else
            log "❌ ERRO: Arquivo de backup da aplicação não encontrado: $APP_BACKUP_FILE"
            exit 1
        fi
        ;;
esac

# Restaurar configurações se disponível
CONFIG_BACKUP_FILE="$BACKUP_BASE_DIR/configs_$BACKUP_DATE.tar.gz"
if [ -f "$CONFIG_BACKUP_FILE" ]; then
    log "Restaurando configurações..."
    tar -xzf "$CONFIG_BACKUP_FILE" -C /
    systemctl daemon-reload
fi

# Verificar integridade
log "Verificando integridade do sistema..."

# Teste de conexão com banco
if psql -U incident_admin -d incident_management -c "SELECT COUNT(*) FROM incidents_enhanced;" >/dev/null 2>&1; then
    log "✅ Banco de dados operacional"
else
    log "❌ ERRO: Problemas no banco de dados"
    exit 1
fi

# Reiniciar serviços
log "Reiniciando serviços..."
systemctl start incident-management
systemctl start nginx

# Verificar se serviços estão rodando
sleep 10
if systemctl is-active --quiet incident-management && systemctl is-active --quiet nginx; then
    log "✅ Serviços reiniciados com sucesso"
else
    log "❌ ERRO: Problemas ao reiniciar serviços"
    systemctl status incident-management
    systemctl status nginx
fi

# Teste final de funcionamento
log "Executando teste de funcionamento..."
if curl -f http://localhost/health >/dev/null 2>&1; then
    log "✅ DISASTER RECOVERY CONCLUÍDO COM SUCESSO"

    # Notificar equipe
    echo "Disaster Recovery concluído com sucesso em $(date)" | \
    mail -s "✅ Disaster Recovery - Sucesso" admin@empresa.com
else
    log "❌ ERRO: Sistema não está respondendo corretamente"
    echo "Disaster Recovery com problemas em $(date). Verificar logs." | \
    mail -s "❌ Disaster Recovery - Problemas" admin@empresa.com
fi

log "Log completo salvo em: $DR_LOG"
```

### Testes de Recovery

#### Script de Teste de Backup
```bash
#!/bin/bash
# scripts/backup/test-backup-integrity.sh

BACKUP_DATE=$1
TEST_DB_NAME="incident_management_test"
BACKUP_BASE_DIR="/backup/incident-management"

if [ -z "$BACKUP_DATE" ]; then
    echo "Uso: $0 <backup_date>"
    echo "Example: $0 20241201_140530"
    exit 1
fi

echo "Testando integridade do backup: $BACKUP_DATE"

# Criar banco de teste temporário
dropdb --if-exists -U incident_admin "$TEST_DB_NAME"
createdb -U incident_admin "$TEST_DB_NAME"

# Restaurar backup no banco de teste
DB_BACKUP_FILE="$BACKUP_BASE_DIR/database_$BACKUP_DATE.sql.gz"
if [ -f "$DB_BACKUP_FILE" ]; then
    gunzip -c "$DB_BACKUP_FILE" | psql -U incident_admin "$TEST_DB_NAME"

    # Verificar dados
    INCIDENT_COUNT=$(psql -U incident_admin -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM incidents_enhanced;" | xargs)
    KB_COUNT=$(psql -U incident_admin -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM knowledge_base;" | xargs)

    echo "✅ Backup restaurado com sucesso no banco de teste"
    echo "   - Incidentes: $INCIDENT_COUNT"
    echo "   - Base de Conhecimento: $KB_COUNT"

    # Limpeza
    dropdb -U incident_admin "$TEST_DB_NAME"
    echo "✅ Banco de teste removido"
else
    echo "❌ ERRO: Arquivo de backup não encontrado: $DB_BACKUP_FILE"
    exit 1
fi

# Testar arquivos de aplicação
APP_BACKUP_FILE="$BACKUP_BASE_DIR/application_$BACKUP_DATE.tar.gz"
if [ -f "$APP_BACKUP_FILE" ]; then
    TEST_DIR="/tmp/backup_test_$(date +%s)"
    mkdir -p "$TEST_DIR"

    tar -xzf "$APP_BACKUP_FILE" -C "$TEST_DIR"

    # Verificar arquivos essenciais
    ESSENTIAL_FILES=(
        "package.json"
        "src/api/incident-ai-server.js"
        "scripts/database/schema.sql"
        ".env.example"
    )

    MISSING_FILES=()
    for file in "${ESSENTIAL_FILES[@]}"; do
        if [ ! -f "$TEST_DIR/$file" ]; then
            MISSING_FILES+=("$file")
        fi
    done

    if [ ${#MISSING_FILES[@]} -eq 0 ]; then
        echo "✅ Todos os arquivos essenciais estão presentes no backup"
    else
        echo "❌ ERRO: Arquivos essenciais faltando:"
        printf '   - %s\n' "${MISSING_FILES[@]}"
    fi

    # Limpeza
    rm -rf "$TEST_DIR"
else
    echo "❌ ERRO: Arquivo de backup da aplicação não encontrado: $APP_BACKUP_FILE"
    exit 1
fi

echo "✅ Teste de integridade concluído"
```

## Segurança

### Configuração de Segurança

#### SSL/TLS Hardening
```nginx
# /etc/nginx/sites-available/incident-management-ssl
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com;" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Rate limiting
        limit_req zone=api burst=10 nodelay;
        limit_req_status 429;

        # Timeout settings
        proxy_connect_timeout       60s;
        proxy_send_timeout          60s;
        proxy_read_timeout          60s;
    }
}

# Rate limiting zones
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

#### Database Security
```postgresql
-- scripts/security/database-hardening.sql

-- Criar role apenas com permissões necessárias
CREATE ROLE incident_read_only;
CREATE ROLE incident_write;
CREATE ROLE incident_admin_role;

-- Permissões granulares
GRANT CONNECT ON DATABASE incident_management TO incident_read_only;
GRANT USAGE ON SCHEMA public TO incident_read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO incident_read_only;

GRANT incident_read_only TO incident_write;
GRANT INSERT, UPDATE, DELETE ON incidents_enhanced, knowledge_base TO incident_write;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO incident_write;

GRANT incident_write TO incident_admin_role;
GRANT CREATE ON DATABASE incident_management TO incident_admin_role;

-- Row Level Security (RLS)
ALTER TABLE incidents_enhanced ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seus próprios incidentes ou incidentes de sua equipe
CREATE POLICY incident_isolation ON incidents_enhanced
    USING (reporter = current_user OR assigned_to = current_user);

-- Auditoria - criar tabela de logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    operation VARCHAR(10) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_name VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET
);

-- Função de auditoria
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name, record_id, operation, old_values, new_values, user_name
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        current_user
    );

    RETURN CASE TG_OP
        WHEN 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de auditoria nas tabelas sensíveis
CREATE TRIGGER audit_incidents_trigger
    AFTER INSERT OR UPDATE OR DELETE ON incidents_enhanced
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_knowledge_trigger
    AFTER INSERT OR UPDATE OR DELETE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### Authentication & Authorization

#### JWT Implementation
```javascript
// utils/auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    this.saltRounds = 12;
  }

  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      this.refreshTokenSecret,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  // Rate limiting para tentativas de login
  async checkLoginAttempts(identifier) {
    const key = `login_attempts:${identifier}`;
    const attempts = await redis.get(key) || 0;

    if (attempts >= 5) {
      const ttl = await redis.ttl(key);
      throw new Error(`Too many login attempts. Try again in ${ttl} seconds.`);
    }

    return parseInt(attempts);
  }

  async recordFailedLogin(identifier) {
    const key = `login_attempts:${identifier}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, 900); // 15 minutos
    }

    return current;
  }

  async clearLoginAttempts(identifier) {
    await redis.del(`login_attempts:${identifier}`);
  }
}

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const authService = new AuthService();
    const decoded = authService.verifyToken(token);

    // Verificar se usuário ainda existe e está ativo
    const user = await User.findById(decoded.id);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: error.message });
  }
};

// Middleware de autorização
const authorize = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
```

#### 2FA Implementation
```javascript
// utils/twofa.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

class TwoFactorAuthService {
  generateSecret(userEmail) {
    const secret = speakeasy.generateSecret({
      name: `Incident Management (${userEmail})`,
      issuer: 'Incident Management System',
      length: 32
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url
    };
  }

  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 steps tolerance (60 seconds before/after)
    });
  }

  // Backup codes para quando 2FA não estiver disponível
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );
    }
    return codes;
  }

  async hashBackupCodes(codes) {
    const hashedCodes = [];
    for (const code of codes) {
      const hash = await bcrypt.hash(code, 10);
      hashedCodes.push(hash);
    }
    return hashedCodes;
  }

  async verifyBackupCode(code, hashedCodes) {
    for (let i = 0; i < hashedCodes.length; i++) {
      const isValid = await bcrypt.compare(code, hashedCodes[i]);
      if (isValid) {
        return i; // Retorna o índice para marcar como usado
      }
    }
    return -1; // Código inválido
  }
}

// Middleware para verificar 2FA
const require2FA = async (req, res, next) => {
  const { twoFactorToken } = req.body;

  if (!req.user.twoFactorEnabled) {
    return next(); // 2FA não habilitado para este usuário
  }

  if (!twoFactorToken) {
    return res.status(400).json({
      error: '2FA token required',
      requires2FA: true
    });
  }

  const twoFAService = new TwoFactorAuthService();
  const user = await User.findById(req.user.id);

  const isValid = twoFAService.verifyToken(
    user.twoFactorSecret,
    twoFactorToken
  );

  if (!isValid) {
    // Verificar backup codes se token TOTP falhou
    const backupCodeIndex = await twoFAService.verifyBackupCode(
      twoFactorToken,
      user.backupCodes
    );

    if (backupCodeIndex >= 0) {
      // Marcar backup code como usado
      user.backupCodes[backupCodeIndex] = null;
      await user.save();
    } else {
      return res.status(400).json({ error: 'Invalid 2FA token' });
    }
  }

  next();
};
```

### Security Scanning

#### Vulnerability Assessment Script
```bash
#!/bin/bash
# scripts/security/vulnerability-scan.sh

REPORT_DIR="/var/log/security-scans"
DATE=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/vulnerability-scan-$DATE.txt"

mkdir -p "$REPORT_DIR"

echo "🔒 Security Vulnerability Scan - $(date)" > "$REPORT_FILE"
echo "=================================================" >> "$REPORT_FILE"

# 1. Verificar dependências do Node.js
echo "📦 Node.js Dependencies Scan" >> "$REPORT_FILE"
echo "---------------------------------" >> "$REPORT_FILE"
cd /path/to/application
npm audit --audit-level moderate >> "$REPORT_FILE" 2>&1

# 2. Verificar configurações de sistema
echo -e "\n🔧 System Configuration Check" >> "$REPORT_FILE"
echo "---------------------------------" >> "$REPORT_FILE"

# Verificar permissões de arquivos sensíveis
echo "File permissions:" >> "$REPORT_FILE"
ls -la .env* >> "$REPORT_FILE" 2>&1
ls -la config/ >> "$REPORT_FILE" 2>&1

# Verificar usuários e grupos
echo -e "\nUsers and groups:" >> "$REPORT_FILE"
getent passwd | grep -E "(incident|postgres|nginx)" >> "$REPORT_FILE"

# 3. Verificar configurações de rede
echo -e "\n🌐 Network Configuration" >> "$REPORT_FILE"
echo "---------------------------------" >> "$REPORT_FILE"
ss -tuln | grep -E ":80|:443|:3001|:5432" >> "$REPORT_FILE"

# 4. Verificar logs de segurança
echo -e "\n📋 Security Logs Analysis" >> "$REPORT_FILE"
echo "---------------------------------" >> "$REPORT_FILE"

# Tentativas de login falhadas nas últimas 24h
echo "Failed login attempts (last 24h):" >> "$REPORT_FILE"
sudo grep "authentication failure" /var/log/auth.log | tail -20 >> "$REPORT_FILE" 2>&1

# Verificar logs da aplicação por padrões suspeitos
echo -e "\nSuspicious patterns in application logs:" >> "$REPORT_FILE"
grep -iE "(injection|script|alert|xss|sql)" /var/log/incident-management/*.log | tail -10 >> "$REPORT_FILE" 2>&1

# 5. Verificar certificados SSL
echo -e "\n🔐 SSL Certificate Check" >> "$REPORT_FILE"
echo "---------------------------------" >> "$REPORT_FILE"
if command -v openssl &> /dev/null; then
    echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | \
    openssl x509 -noout -dates >> "$REPORT_FILE" 2>&1
fi

# 6. Verificar backup e recovery
echo -e "\n💾 Backup Status" >> "$REPORT_FILE"
echo "---------------------------------" >> "$REPORT_FILE"
ls -la /backup/incident-management/ | tail -5 >> "$REPORT_FILE"

# 7. Verificar integridade do banco de dados
echo -e "\n🗄️  Database Security Check" >> "$REPORT_FILE"
echo "---------------------------------" >> "$REPORT_FILE"
sudo -u postgres psql -d incident_management -c "\du" >> "$REPORT_FILE" 2>&1

# 8. Resumo e recomendações
echo -e "\n📊 Summary and Recommendations" >> "$REPORT_FILE"
echo "---------------------------------" >> "$REPORT_FILE"

HIGH_RISK_COUNT=$(grep -i "high" "$REPORT_FILE" | wc -l)
MEDIUM_RISK_COUNT=$(grep -i "moderate" "$REPORT_FILE" | wc -l)

echo "High risk issues found: $HIGH_RISK_COUNT" >> "$REPORT_FILE"
echo "Medium risk issues found: $MEDIUM_RISK_COUNT" >> "$REPORT_FILE"

if [ $HIGH_RISK_COUNT -gt 0 ]; then
    echo "🚨 URGENT: High risk vulnerabilities detected!" >> "$REPORT_FILE"
    echo "📧 Sending alert email..."
    mail -s "🚨 HIGH RISK Security Issues Detected" admin@empresa.com < "$REPORT_FILE"
fi

echo -e "\nRecommendations:" >> "$REPORT_FILE"
echo "1. Keep dependencies updated regularly" >> "$REPORT_FILE"
echo "2. Monitor logs for suspicious activities" >> "$REPORT_FILE"
echo "3. Rotate certificates before expiration" >> "$REPORT_FILE"
echo "4. Test backup and recovery procedures monthly" >> "$REPORT_FILE"
echo "5. Review user permissions quarterly" >> "$REPORT_FILE"

echo "✅ Security scan completed. Report: $REPORT_FILE"

# Agendar próximo scan
echo "0 2 * * 1 /path/to/scripts/security/vulnerability-scan.sh" | crontab -u security -
```

## Manutenção

### Manutenção Preventiva

#### Script de Manutenção Semanal
```bash
#!/bin/bash
# scripts/maintenance/weekly-maintenance.sh

set -e

MAINTENANCE_LOG="/var/log/incident-management/maintenance-$(date +%Y%m%d_%H%M%S).log"
MAINTENANCE_DIR="/tmp/maintenance-$(date +%s)"

mkdir -p "$MAINTENANCE_DIR"
mkdir -p "$(dirname "$MAINTENANCE_LOG")"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$MAINTENANCE_LOG"
}

log "🔧 Iniciando manutenção preventiva semanal..."

# 1. Health Check inicial
log "📊 Executando health check inicial..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health || echo "FAILED")
if [[ "$HEALTH_RESPONSE" == "FAILED" ]]; then
    log "❌ ERRO: Sistema não está respondendo"
    exit 1
fi

# 2. Backup antes da manutenção
log "💾 Executando backup de segurança..."
/path/to/scripts/backup/automated-full-backup.sh

# 3. Limpeza de logs antigos
log "🧹 Limpando logs antigos (>30 dias)..."
find /var/log/incident-management -name "*.log" -mtime +30 -delete
find /var/log/incident-management -name "*.gz" -mtime +90 -delete

# 4. Otimização do banco de dados
log "🗄️  Executando otimização do banco de dados..."

sudo -u postgres psql -d incident_management <<EOF
-- Vacuum completo com análise
VACUUM (VERBOSE, ANALYZE) incidents_enhanced;
VACUUM (VERBOSE, ANALYZE) knowledge_base;
VACUUM (VERBOSE, ANALYZE) users;
VACUUM (VERBOSE, ANALYZE) activity_logs;
VACUUM (VERBOSE, ANALYZE) audit_logs;

-- Reindex se necessário
REINDEX DATABASE incident_management;

-- Estatísticas
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
EOF

# 5. Verificar e otimizar índices
log "📇 Verificando performance dos índices..."
sudo -u postgres psql -d incident_management -c "
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan < 100 AND indexname NOT LIKE '%_pkey'
ORDER BY idx_scan;" >> "$MAINTENANCE_LOG"

# 6. Limpeza de sessões expiradas
log "🔐 Limpando sessões expiradas..."
node /path/to/scripts/admin/cleanup-expired-sessions.js >> "$MAINTENANCE_LOG" 2>&1

# 7. Limpeza de cache
log "🗂️  Limpando cache antigo..."
if command -v redis-cli &> /dev/null; then
    EXPIRED_KEYS=$(redis-cli EVAL "
        local keys = redis.call('KEYS', ARGV[1])
        local expired = 0
        for i=1,#keys do
            if redis.call('TTL', keys[i]) == -1 then
                redis.call('DEL', keys[i])
                expired = expired + 1
            end
        end
        return expired
    " 0 "*:expired:*")
    log "   Removidas $EXPIRED_KEYS chaves de cache expiradas"
fi

# 8. Verificar espaço em disco
log "💿 Verificando espaço em disco..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    log "⚠️  AVISO: Uso de disco alto ($DISK_USAGE%)"
    echo "Uso de disco alto: $DISK_USAGE%" | mail -s "⚠️  Aviso: Espaço em Disco" admin@empresa.com
fi

# 9. Verificar uso de memória
log "🧠 Verificando uso de memória..."
MEMORY_USAGE=$(free | grep MemAvailable | awk '{printf "%.0f", (($2-$7)/$2)*100}')
if [ "$MEMORY_USAGE" -gt 85 ]; then
    log "⚠️  AVISO: Uso de memória alto ($MEMORY_USAGE%)"
fi

# 10. Atualizar estatísticas do sistema
log "📈 Coletando estatísticas do sistema..."
cat > "$MAINTENANCE_DIR/system-stats.txt" <<EOF
Data: $(date)
Uptime: $(uptime)
Uso de CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
Uso de Memória: ${MEMORY_USAGE}%
Uso de Disco: ${DISK_USAGE}%
Processos Ativos: $(ps aux | wc -l)
Conexões de Rede: $(ss -tuln | wc -l)

Estatísticas do Banco:
EOF

sudo -u postgres psql -d incident_management -c "
SELECT
    'incidents_enhanced' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status = 'OPEN') as open_incidents,
    COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_incidents,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_this_week;
SELECT
    'knowledge_base' as table_name,
    COUNT(*) as total_articles,
    AVG(confidence_score) as avg_confidence;
" >> "$MAINTENANCE_DIR/system-stats.txt"

# 11. Verificar certificados SSL
log "🔐 Verificando certificados SSL..."
if command -v openssl &> /dev/null; then
    CERT_EXPIRY=$(echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | \
                  openssl x509 -noout -dates | grep "notAfter" | cut -d= -f2)
    CERT_DAYS=$(( ($(date -d "$CERT_EXPIRY" +%s) - $(date +%s)) / 86400 ))

    log "   Certificado SSL expira em: $CERT_DAYS dias ($CERT_EXPIRY)"

    if [ "$CERT_DAYS" -lt 30 ]; then
        log "⚠️  AVISO: Certificado SSL expira em menos de 30 dias!"
        echo "Certificado SSL expira em $CERT_DAYS dias" | \
        mail -s "⚠️  Aviso: Certificado SSL" admin@empresa.com
    fi
fi

# 12. Health check final
log "🏁 Executando health check final..."
sleep 5
FINAL_HEALTH=$(curl -s http://localhost:3001/health || echo "FAILED")
if [[ "$FINAL_HEALTH" == "FAILED" ]]; then
    log "❌ ERRO: Sistema não está respondendo após manutenção"
    echo "Sistema não responde após manutenção" | \
    mail -s "🚨 ERRO: Problema após manutenção" admin@empresa.com
    exit 1
fi

# 13. Gerar relatório final
log "📋 Gerando relatório de manutenção..."
cat > "$MAINTENANCE_DIR/maintenance-report.md" <<EOF
# Relatório de Manutenção Preventiva
**Data:** $(date)
**Duração:** $SECONDS segundos

## Ações Executadas
- ✅ Backup de segurança realizado
- ✅ Logs antigos removidos
- ✅ Banco de dados otimizado
- ✅ Índices verificados
- ✅ Sessões expiradas removidas
- ✅ Cache limpo
- ✅ Espaço em disco verificado ($DISK_USAGE%)
- ✅ Uso de memória verificado ($MEMORY_USAGE%)
- ✅ Certificado SSL verificado ($CERT_DAYS dias restantes)
- ✅ Health check aprovado

## Alertas
$(if [ "$DISK_USAGE" -gt 80 ]; then echo "⚠️ Uso de disco alto: $DISK_USAGE%"; fi)
$(if [ "$MEMORY_USAGE" -gt 85 ]; then echo "⚠️ Uso de memória alto: $MEMORY_USAGE%"; fi)
$(if [ "$CERT_DAYS" -lt 30 ]; then echo "⚠️ Certificado SSL expira em $CERT_DAYS dias"; fi)

## Próxima Manutenção
**Data:** $(date -d "+1 week")
EOF

# Enviar relatório por email
mail -s "📋 Relatório de Manutenção - $(date +%d/%m/%Y)" admin@empresa.com < "$MAINTENANCE_DIR/maintenance-report.md"

log "✅ Manutenção preventiva concluída com sucesso"
log "📧 Relatório enviado por email"

# Limpeza
rm -rf "$MAINTENANCE_DIR"

# Agendar próxima manutenção (toda segunda-feira às 2h)
(crontab -l 2>/dev/null; echo "0 2 * * 1 /path/to/scripts/maintenance/weekly-maintenance.sh") | crontab -
```

#### Monitoramento Contínuo
```bash
#!/bin/bash
# scripts/monitoring/continuous-monitor.sh

MONITOR_INTERVAL=60  # segundos
LOG_FILE="/var/log/incident-management/monitor.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=90
ALERT_COOLDOWN=3600  # 1 hora entre alertas do mesmo tipo

last_alert_file="/tmp/last_alert"
touch "$last_alert_file"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

send_alert() {
    local alert_type=$1
    local message=$2
    local current_time=$(date +%s)

    # Verificar cooldown
    local last_alert_time=$(grep "^$alert_type:" "$last_alert_file" | cut -d: -f2)
    if [ ! -z "$last_alert_time" ]; then
        local time_diff=$((current_time - last_alert_time))
        if [ $time_diff -lt $ALERT_COOLDOWN ]; then
            return 0  # Ainda em cooldown
        fi
    fi

    # Enviar alerta
    echo "$message" | mail -s "🚨 System Alert: $alert_type" admin@empresa.com
    log "ALERT SENT: $alert_type - $message"

    # Atualizar último alerta
    sed -i "/^$alert_type:/d" "$last_alert_file"
    echo "$alert_type:$current_time" >> "$last_alert_file"
}

check_cpu() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    cpu_usage=${cpu_usage%.*}  # Remover casas decimais

    if [ "$cpu_usage" -gt $ALERT_THRESHOLD_CPU ]; then
        send_alert "HIGH_CPU" "CPU usage is ${cpu_usage}% (threshold: ${ALERT_THRESHOLD_CPU}%)"
    fi

    echo $cpu_usage
}

check_memory() {
    local memory_usage=$(free | awk 'FNR==2{printf "%.0f", $3/$2*100}')

    if [ "$memory_usage" -gt $ALERT_THRESHOLD_MEMORY ]; then
        send_alert "HIGH_MEMORY" "Memory usage is ${memory_usage}% (threshold: ${ALERT_THRESHOLD_MEMORY}%)"
    fi

    echo $memory_usage
}

check_disk() {
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

    if [ "$disk_usage" -gt $ALERT_THRESHOLD_DISK ]; then
        send_alert "HIGH_DISK" "Disk usage is ${disk_usage}% (threshold: ${ALERT_THRESHOLD_DISK}%)"
    fi

    echo $disk_usage
}

check_application() {
    local health_status=$(curl -s --max-time 10 http://localhost:3001/health | jq -r '.status' 2>/dev/null || echo "error")

    if [ "$health_status" != "healthy" ]; then
        send_alert "APP_DOWN" "Application health check failed: $health_status"
        return 1
    fi

    return 0
}

check_database() {
    local db_status=$(sudo -u postgres psql -d incident_management -t -c "SELECT 1;" 2>/dev/null || echo "error")

    if [ "$db_status" != " 1" ]; then
        send_alert "DB_DOWN" "Database connection failed"
        return 1
    fi

    # Verificar conexões ativas
    local active_connections=$(sudo -u postgres psql -d incident_management -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" | xargs)

    if [ "$active_connections" -gt 50 ]; then
        send_alert "HIGH_DB_CONNECTIONS" "High database connections: $active_connections"
    fi

    return 0
}

check_ssl_certificate() {
    if command -v openssl &> /dev/null; then
        local cert_days=$(echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | \
                         openssl x509 -noout -dates | grep "notAfter" | cut -d= -f2 | \
                         xargs -I {} date -d "{} - $(date)" +%s | awk '{print int($1/86400)}')

        if [ "$cert_days" -lt 7 ]; then
            send_alert "SSL_EXPIRING" "SSL certificate expires in $cert_days days"
        fi
    fi
}

# Loop principal de monitoramento
log "Starting continuous monitoring (interval: ${MONITOR_INTERVAL}s)"

while true; do
    cpu_usage=$(check_cpu)
    memory_usage=$(check_memory)
    disk_usage=$(check_disk)

    check_application
    app_status=$?

    check_database
    db_status=$?

    # Log métricas a cada 10 minutos
    if [ $(($(date +%s) % 600)) -eq 0 ]; then
        log "METRICS - CPU: ${cpu_usage}%, Memory: ${memory_usage}%, Disk: ${disk_usage}%, App: $([[ $app_status -eq 0 ]] && echo "OK" || echo "ERROR"), DB: $([[ $db_status -eq 0 ]] && echo "OK" || echo "ERROR")"
    fi

    sleep $MONITOR_INTERVAL
done
```

### Update e Upgrade

#### Script de Atualização Automática
```bash
#!/bin/bash
# scripts/updates/auto-update.sh

set -e

UPDATE_LOG="/var/log/incident-management/updates-$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="/backup/pre-update-$(date +%Y%m%d_%H%M%S)"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$UPDATE_LOG"
}

# Verificar se é seguro atualizar (baixa atividade)
check_system_load() {
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local load_threshold=1.0

    if (( $(echo "$load_avg > $load_threshold" | bc -l) )); then
        log "⚠️  Sistema com alta carga ($load_avg), adiando atualização"
        exit 1
    fi
}

# Backup antes da atualização
create_pre_update_backup() {
    log "💾 Criando backup pré-atualização..."
    mkdir -p "$BACKUP_DIR"

    # Backup do banco
    pg_dump -U incident_admin incident_management | gzip > "$BACKUP_DIR/database.sql.gz"

    # Backup da aplicação
    tar -czf "$BACKUP_DIR/application.tar.gz" \
        --exclude='node_modules' \
        --exclude='logs' \
        -C /path/to/application .

    # Backup das configurações
    cp /etc/nginx/sites-available/incident-management "$BACKUP_DIR/"
    cp /etc/systemd/system/incident-management.service "$BACKUP_DIR/"

    log "✅ Backup pré-atualização criado em: $BACKUP_DIR"
}

# Atualizar dependências do sistema
update_system_packages() {
    log "🔄 Atualizando pacotes do sistema..."

    # Ubuntu/Debian
    if command -v apt &> /dev/null; then
        sudo apt update
        sudo apt upgrade -y
        sudo apt autoremove -y
    fi

    # CentOS/RHEL
    if command -v yum &> /dev/null; then
        sudo yum update -y
    fi
}

# Atualizar Node.js e dependências
update_nodejs_deps() {
    log "📦 Atualizando dependências Node.js..."

    cd /path/to/application

    # Verificar versão atual
    log "Versão atual do Node.js: $(node --version)"
    log "Versão atual do npm: $(npm --version)"

    # Backup package-lock.json
    cp package-lock.json "$BACKUP_DIR/"

    # Atualizar dependências
    npm audit fix
    npm update

    # Verificar vulnerabilidades
    npm audit --audit-level moderate

    log "✅ Dependências Node.js atualizadas"
}

# Atualizar PostgreSQL
update_postgresql() {
    log "🗄️  Verificando atualizações do PostgreSQL..."

    local current_version=$(sudo -u postgres psql -t -c "SELECT version();" | head -1)
    log "Versão atual do PostgreSQL: $current_version"

    # Atualizar apenas patches de segurança
    if command -v apt &> /dev/null; then
        sudo apt update
        sudo apt install --only-upgrade postgresql postgresql-contrib
    fi
}

# Aplicar migrações de banco se necessário
apply_database_migrations() {
    log "🔄 Verificando migrações de banco..."

    # Verificar se existem migrações pendentes
    if [ -d "/path/to/migrations" ] && [ "$(ls -A /path/to/migrations/pending/)" ]; then
        log "Aplicando migrações de banco..."

        for migration in /path/to/migrations/pending/*.sql; do
            log "Aplicando migração: $(basename $migration)"
            sudo -u postgres psql -d incident_management -f "$migration"

            # Mover para pasta de aplicadas
            mv "$migration" "/path/to/migrations/applied/"
        done
    else
        log "Nenhuma migração pendente"
    fi
}

# Reiniciar serviços
restart_services() {
    log "🔄 Reiniciando serviços..."

    # Parar serviços
    sudo systemctl stop incident-management
    sudo systemctl stop nginx

    # Aguardar finalização
    sleep 10

    # Iniciar serviços
    sudo systemctl start postgresql
    sudo systemctl start incident-management
    sudo systemctl start nginx

    # Verificar status
    sleep 15

    if sudo systemctl is-active --quiet incident-management && \
       sudo systemctl is-active --quiet nginx; then
        log "✅ Serviços reiniciados com sucesso"
    else
        log "❌ ERRO: Falha ao reiniciar serviços"
        return 1
    fi
}

# Verificar funcionamento pós-atualização
verify_system_health() {
    log "🔍 Verificando saúde do sistema pós-atualização..."

    # Aguardar inicialização completa
    sleep 30

    # Health check da aplicação
    local health_response=$(curl -s --max-time 30 http://localhost:3001/health || echo "FAILED")

    if [[ "$health_response" == *"healthy"* ]]; then
        log "✅ Health check da aplicação: OK"
    else
        log "❌ ERRO: Health check da aplicação falhou"
        return 1
    fi

    # Teste de conexão com banco
    if sudo -u postgres psql -d incident_management -c "SELECT 1;" > /dev/null 2>&1; then
        log "✅ Conexão com banco de dados: OK"
    else
        log "❌ ERRO: Falha na conexão com banco de dados"
        return 1
    fi

    # Teste de funcionalidade básica
    local test_response=$(curl -s --max-time 10 "http://localhost:3001/api/incidents?limit=1" || echo "FAILED")

    if [[ "$test_response" != "FAILED" ]]; then
        log "✅ Teste de funcionalidade básica: OK"
    else
        log "❌ ERRO: Teste de funcionalidade básica falhou"
        return 1
    fi
}

# Rollback em caso de erro
rollback_update() {
    log "🔄 Iniciando rollback da atualização..."

    # Parar serviços
    sudo systemctl stop incident-management nginx

    # Restaurar aplicação
    rm -rf /path/to/application/*
    tar -xzf "$BACKUP_DIR/application.tar.gz" -C /path/to/application

    # Restaurar banco
    sudo -u postgres dropdb incident_management
    sudo -u postgres createdb incident_management
    gunzip -c "$BACKUP_DIR/database.sql.gz" | sudo -u postgres psql incident_management

    # Restaurar configurações
    sudo cp "$BACKUP_DIR/incident-management" /etc/nginx/sites-available/
    sudo cp "$BACKUP_DIR/incident-management.service" /etc/systemd/system/
    sudo systemctl daemon-reload

    # Reiniciar serviços
    sudo systemctl start postgresql incident-management nginx

    log "⚠️  Rollback concluído. Sistema restaurado para estado anterior."
}

# Limpeza pós-atualização
cleanup_after_update() {
    log "🧹 Executando limpeza pós-atualização..."

    # Limpeza de cache npm
    npm cache clean --force

    # Limpeza de logs antigos
    find /var/log/incident-management -name "*.log" -mtime +7 -delete

    # Limpeza de arquivos temporários
    rm -rf /tmp/npm-*
    rm -rf /tmp/incident-*

    log "✅ Limpeza concluída"
}

# Função principal
main() {
    log "🚀 Iniciando processo de atualização automática..."

    check_system_load
    create_pre_update_backup

    # Tentar atualizar
    if update_system_packages && \
       update_nodejs_deps && \
       update_postgresql && \
       apply_database_migrations && \
       restart_services && \
       verify_system_health; then

        log "✅ Atualização concluída com sucesso!"
        cleanup_after_update

        # Enviar notificação de sucesso
        echo "Sistema atualizado com sucesso em $(date)" | \
        mail -s "✅ Atualização Concluída" admin@empresa.com

    else
        log "❌ ERRO durante a atualização. Iniciando rollback..."
        rollback_update

        if verify_system_health; then
            log "✅ Rollback concluído. Sistema restaurado."
            echo "Atualização falhou, mas rollback foi bem-sucedido em $(date)" | \
            mail -s "⚠️  Atualização Falhou - Rollback OK" admin@empresa.com
        else
            log "❌ ERRO CRÍTICO: Rollback falhou!"
            echo "URGENTE: Atualização e rollback falharam em $(date). Intervenção manual necessária." | \
            mail -s "🚨 ERRO CRÍTICO - Intervenção Necessária" admin@empresa.com
            exit 1
        fi
    fi
}

# Executar apenas se não estiver em modo de teste
if [ "${1:-}" != "--test" ]; then
    main
else
    log "Modo de teste ativado - simulando atualização..."
    echo "Todos os checks passaram. Sistema pronto para atualização."
fi
```

## Troubleshooting Avançado

### Diagnóstico de Problemas

#### Script de Diagnóstico Completo
```bash
#!/bin/bash
# scripts/troubleshooting/system-diagnostic.sh

DIAG_DIR="/tmp/system-diagnostic-$(date +%s)"
REPORT_FILE="$DIAG_DIR/diagnostic-report.txt"

mkdir -p "$DIAG_DIR"

echo "🔍 System Diagnostic Report - $(date)" > "$REPORT_FILE"
echo "=========================================" >> "$REPORT_FILE"

# Função para executar comando e capturar saída
run_diagnostic() {
    local title="$1"
    local command="$2"

    echo -e "\n## $title" >> "$REPORT_FILE"
    echo "Command: $command" >> "$REPORT_FILE"
    echo "----------------------------------------" >> "$REPORT_FILE"

    if eval "$command" >> "$REPORT_FILE" 2>&1; then
        echo "✅ $title: OK"
    else
        echo "❌ $title: ERROR"
        echo "ERROR: Command failed with exit code $?" >> "$REPORT_FILE"
    fi
    echo "" >> "$REPORT_FILE"
}

# 1. Informações do sistema
run_diagnostic "System Information" "uname -a && lsb_release -a"
run_diagnostic "System Resources" "free -h && df -h && lscpu"
run_diagnostic "System Load" "uptime && vmstat 1 3"

# 2. Serviços
run_diagnostic "Service Status" "systemctl status incident-management nginx postgresql"
run_diagnostic "Process List" "ps aux | grep -E '(node|nginx|postgres)'"
run_diagnostic "Network Connections" "ss -tuln | grep -E ':(80|443|3001|5432)'"

# 3. Logs de sistema
run_diagnostic "System Logs (last 50 lines)" "tail -50 /var/log/syslog"
run_diagnostic "Application Logs" "tail -100 /var/log/incident-management/*.log 2>/dev/null || echo 'No application logs found'"

# 4. Banco de dados
run_diagnostic "Database Connection" "sudo -u postgres psql -d incident_management -c 'SELECT version();'"
run_diagnostic "Database Stats" "sudo -u postgres psql -d incident_management -c '
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables ORDER BY n_tup_ins DESC;'"

run_diagnostic "Database Connections" "sudo -u postgres psql -d incident_management -c '
SELECT count(*), state FROM pg_stat_activity GROUP BY state;'"

# 5. Aplicação
run_diagnostic "Application Health" "curl -s --max-time 10 http://localhost:3001/health || echo 'Health check failed'"
run_diagnostic "Application Metrics" "curl -s --max-time 10 http://localhost:3001/api/metrics || echo 'Metrics endpoint failed'"

# 6. Configurações
run_diagnostic "Nginx Configuration Test" "nginx -t"
run_diagnostic "Node.js Version" "node --version && npm --version"
run_diagnostic "Environment Variables" "printenv | grep -E '(NODE_ENV|DATABASE_URL|PORT)' | sed 's/=.*/=***HIDDEN***/'"

# 7. Arquivos de configuração
echo -e "\n## Configuration Files" >> "$REPORT_FILE"
echo "----------------------------------------" >> "$REPORT_FILE"
for config_file in "/etc/nginx/sites-available/incident-management" \
                   "/etc/systemd/system/incident-management.service" \
                   "/path/to/application/.env"; do
    if [ -f "$config_file" ]; then
        echo "### $config_file" >> "$REPORT_FILE"
        # Mascarar informações sensíveis
        sed 's/password=.*/password=***HIDDEN***/g; s/key=.*/key=***HIDDEN***/g' "$config_file" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
done

# 8. Análise de logs para erros
echo -e "\n## Recent Errors Analysis" >> "$REPORT_FILE"
echo "----------------------------------------" >> "$REPORT_FILE"

# Erros recentes nos logs da aplicação
echo "### Application Errors (last 24h):" >> "$REPORT_FILE"
find /var/log/incident-management -name "*.log" -mtime -1 -exec grep -i "error\|fail\|exception" {} \; 2>/dev/null | tail -20 >> "$REPORT_FILE"

# Erros de sistema
echo -e "\n### System Errors (last 24h):" >> "$REPORT_FILE"
journalctl --since "24 hours ago" --priority=3 | tail -20 >> "$REPORT_FILE" 2>/dev/null

# 9. Performance analysis
echo -e "\n## Performance Analysis" >> "$REPORT_FILE"
echo "----------------------------------------" >> "$REPORT_FILE"

# Top processos por CPU e memória
echo "### Top Processes by CPU:" >> "$REPORT_FILE"
ps aux --sort=-%cpu | head -10 >> "$REPORT_FILE"

echo -e "\n### Top Processes by Memory:" >> "$REPORT_FILE"
ps aux --sort=-%mem | head -10 >> "$REPORT_FILE"

# I/O stats se disponível
if command -v iostat &> /dev/null; then
    echo -e "\n### Disk I/O Statistics:" >> "$REPORT_FILE"
    iostat -x 1 3 >> "$REPORT_FILE"
fi

# 10. Conectividade externa
echo -e "\n## External Connectivity" >> "$REPORT_FILE"
echo "----------------------------------------" >> "$REPORT_FILE"

# Teste DNS
echo "### DNS Resolution:" >> "$REPORT_FILE"
nslookup google.com >> "$REPORT_FILE" 2>&1

# Teste conectividade APIs
apis=("https://api.openai.com" "https://generativelanguage.googleapis.com")
for api in "${apis[@]}"; do
    echo "### Testing $api:" >> "$REPORT_FILE"
    curl -s --max-time 5 -I "$api" >> "$REPORT_FILE" 2>&1
done

# 11. Recomendações automáticas
echo -e "\n## Automated Recommendations" >> "$REPORT_FILE"
echo "=========================================" >> "$REPORT_FILE"

# Verificar uso de recursos
MEMORY_USAGE=$(free | awk 'FNR==2{printf "%.0f", $3/$2*100}')
CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$MEMORY_USAGE" -gt 80 ]; then
    echo "⚠️  HIGH MEMORY USAGE ($MEMORY_USAGE%): Consider increasing RAM or optimizing applications" >> "$REPORT_FILE"
fi

if (( $(echo "$CPU_LOAD > 2.0" | bc -l) )); then
    echo "⚠️  HIGH CPU LOAD ($CPU_LOAD): Check for resource-intensive processes" >> "$REPORT_FILE"
fi

if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  HIGH DISK USAGE ($DISK_USAGE%): Clean up old logs and backups" >> "$REPORT_FILE"
fi

# Verificar logs de erro
ERROR_COUNT=$(find /var/log/incident-management -name "*.log" -mtime -1 -exec grep -c -i "error" {} \; 2>/dev/null | awk '{sum += $1} END {print sum}')
if [ "$ERROR_COUNT" -gt 10 ]; then
    echo "⚠️  HIGH ERROR COUNT ($ERROR_COUNT errors in last 24h): Check application logs" >> "$REPORT_FILE"
fi

# Verificar conectividade
if ! curl -s --max-time 5 http://localhost:3001/health > /dev/null; then
    echo "🚨 CRITICAL: Application not responding - check service status" >> "$REPORT_FILE"
fi

# 12. Sugestões de próximos passos
echo -e "\n## Suggested Next Steps" >> "$REPORT_FILE"
echo "----------------------------------------" >> "$REPORT_FILE"
echo "1. Review error logs for specific failure patterns" >> "$REPORT_FILE"
echo "2. Check disk space and clean up if necessary" >> "$REPORT_FILE"
echo "3. Monitor resource usage over time" >> "$REPORT_FILE"
echo "4. Verify all external dependencies are accessible" >> "$REPORT_FILE"
echo "5. Consider restarting services if issues persist" >> "$REPORT_FILE"
echo "6. Check recent configuration changes" >> "$REPORT_FILE"

# Criar arquivo compactado com todos os logs relevantes
echo "Collecting additional logs..."
tar -czf "$DIAG_DIR/logs-backup.tar.gz" \
    /var/log/incident-management/ \
    /var/log/nginx/ \
    /var/log/postgresql/ \
    2>/dev/null || true

echo "✅ Diagnostic complete. Report saved to: $REPORT_FILE"
echo "📦 Logs backup created: $DIAG_DIR/logs-backup.tar.gz"
echo ""
echo "To share this diagnostic:"
echo "  tar -czf system-diagnostic.tar.gz -C $(dirname $DIAG_DIR) $(basename $DIAG_DIR)"
```

### Problemas Específicos e Soluções

#### Database Performance Issues
```sql
-- scripts/troubleshooting/database-performance.sql

-- 1. Identificar queries lentas
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 20;

-- 2. Verificar locks
SELECT
    l.pid,
    l.mode,
    l.locktype,
    l.relation::regclass,
    l.granted,
    a.usename,
    a.query,
    a.query_start,
    age(now(), a.query_start) as "age"
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE not l.granted
ORDER BY a.query_start;

-- 3. Identificar tabelas que precisam de VACUUM
SELECT
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    round(n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) as dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY dead_ratio DESC;

-- 4. Verificar índices não utilizados
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE '%_pkey';

-- 5. Estatísticas de cache hit ratio
SELECT
    'index hit rate' as name,
    (sum(idx_blks_hit)) / nullif(sum(idx_blks_hit + idx_blks_read),0) as ratio
FROM pg_statio_user_indexes
UNION ALL
SELECT
    'table hit rate' as name,
    sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read),0) as ratio
FROM pg_statio_user_tables;

-- 6. Conexões por estado
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state;

-- 7. Tamanho das tabelas e índices
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Recomendações automáticas
-- Se dead_ratio > 20%, executar: VACUUM ANALYZE table_name;
-- Se idx_scan = 0 para índices antigos, considerar: DROP INDEX index_name;
-- Se hit ratio < 0.95, considerar aumentar shared_buffers
-- Se conexões idle > 10, configurar connection pooling
```

#### Node.js Memory Leaks
```javascript
// scripts/troubleshooting/memory-leak-detector.js
const fs = require('fs');
const path = require('path');

class MemoryLeakDetector {
    constructor() {
        this.measurements = [];
        this.interval = null;
        this.alertThreshold = 1024 * 1024 * 1024; // 1GB
        this.measurementInterval = 30000; // 30 segundos
    }

    startMonitoring() {
        console.log('🔍 Iniciando monitoramento de memory leak...');

        this.interval = setInterval(() => {
            const usage = process.memoryUsage();
            const measurement = {
                timestamp: new Date(),
                rss: usage.rss,
                heapTotal: usage.heapTotal,
                heapUsed: usage.heapUsed,
                external: usage.external,
                arrayBuffers: usage.arrayBuffers
            };

            this.measurements.push(measurement);
            this.analyzeTrend();

            // Manter apenas últimas 100 medições
            if (this.measurements.length > 100) {
                this.measurements.shift();
            }

        }, this.measurementInterval);
    }

    analyzeTrend() {
        if (this.measurements.length < 10) return;

        const recent = this.measurements.slice(-10);
        const oldest = recent[0];
        const newest = recent[recent.length - 1];

        const heapGrowth = newest.heapUsed - oldest.heapUsed;
        const rssGrowth = newest.rss - oldest.rss;
        const timespan = newest.timestamp - oldest.timestamp;

        // Calcular taxa de crescimento por minuto
        const heapGrowthRate = (heapGrowth / timespan) * 60000;
        const rssGrowthRate = (rssGrowth / timespan) * 60000;

        console.log(`Memory Growth Rate: Heap ${this.formatBytes(heapGrowthRate)}/min, RSS ${this.formatBytes(rssGrowthRate)}/min`);

        // Alertar se crescimento for muito rápido
        if (heapGrowthRate > 10 * 1024 * 1024) { // 10MB/min
            this.generateAlert('HEAP_LEAK', heapGrowthRate);
        }

        if (rssGrowthRate > 20 * 1024 * 1024) { // 20MB/min
            this.generateAlert('RSS_LEAK', rssGrowthRate);
        }

        // Alertar se uso absoluto for muito alto
        if (newest.heapUsed > this.alertThreshold) {
            this.generateAlert('HIGH_HEAP', newest.heapUsed);
        }
    }

    generateAlert(type, value) {
        const alert = {
            timestamp: new Date(),
            type,
            value,
            measurements: [...this.measurements]
        };

        // Salvar dados para análise
        const alertFile = `/tmp/memory-alert-${Date.now()}.json`;
        fs.writeFileSync(alertFile, JSON.stringify(alert, null, 2));

        console.log(`🚨 MEMORY ALERT: ${type} - ${this.formatBytes(value)}`);
        console.log(`Alert data saved to: ${alertFile}`);

        // Forçar garbage collection se possível
        if (global.gc) {
            console.log('🗑️  Forcing garbage collection...');
            global.gc();
        }
    }

    generateReport() {
        if (this.measurements.length === 0) return;

        const report = {
            summary: {
                totalMeasurements: this.measurements.length,
                duration: this.measurements[this.measurements.length - 1].timestamp - this.measurements[0].timestamp,
                avgHeapUsed: this.measurements.reduce((sum, m) => sum + m.heapUsed, 0) / this.measurements.length,
                maxHeapUsed: Math.max(...this.measurements.map(m => m.heapUsed)),
                avgRss: this.measurements.reduce((sum, m) => sum + m.rss, 0) / this.measurements.length,
                maxRss: Math.max(...this.measurements.map(m => m.rss))
            },
            measurements: this.measurements,
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        const latest = this.measurements[this.measurements.length - 1];

        if (latest.heapUsed > 512 * 1024 * 1024) {
            recommendations.push('Consider increasing heap size with --max-old-space-size');
        }

        if (latest.external > 100 * 1024 * 1024) {
            recommendations.push('High external memory usage - check for large buffers or native modules');
        }

        const heapEfficiency = latest.heapUsed / latest.heapTotal;
        if (heapEfficiency < 0.5) {
            recommendations.push('Heap fragmentation detected - consider periodic garbage collection');
        }

        return recommendations;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    stopMonitoring() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        const report = this.generateReport();
        const reportFile = `/tmp/memory-report-${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        console.log(`Memory monitoring stopped. Report saved to: ${reportFile}`);
        return report;
    }
}

// Usar o detector
if (require.main === module) {
    const detector = new MemoryLeakDetector();
    detector.startMonitoring();

    // Parar após 10 minutos
    setTimeout(() => {
        detector.stopMonitoring();
        process.exit(0);
    }, 10 * 60 * 1000);

    // Handler para parada graceful
    process.on('SIGINT', () => {
        detector.stopMonitoring();
        process.exit(0);
    });
}

module.exports = MemoryLeakDetector;
```

---

**Guia do Administrador - Versão 2.0**
**Última Atualização:** 24/09/2024
**Próxima Revisão:** 24/12/2024
**Responsável:** Equipe de Infraestrutura