# Documentação de Setup da Infraestrutura
## Sistema de Resolução de Incidentes com IA - FASE 1

### 📋 Visão Geral

Este documento descreve o processo completo de setup e validação da infraestrutura base para o Sistema de Resolução de Incidentes com IA da Accenture.

### 🏗️ Arquitetura da Infraestrutura

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA AI INCIDENT RESOLUTION              │
├─────────────────────────────────────────────────────────────────┤
│  🖥️  ELECTRON APP         │  🌐 WEB INTERFACE                   │
├─────────────────────────────────────────────────────────────────┤
│  📊 PostgreSQL            │  ⚡ Redis Cache     │  🔍 ChromaDB   │
│  Port: 5432               │  Port: 6379        │  Port: 8000    │
│  Database: ai_incident_   │  Password: ***     │  Vector DB     │
│  system                   │                    │                │
└─────────────────────────────────────────────────────────────────┘
```

### 🔧 Componentes da Infraestrutura

#### 1. PostgreSQL Database (Porta 5432)
- **Função**: Armazenamento principal de dados
- **Schemas**: incident_system, audit_system, ml_system
- **Usuário**: ai_user
- **Database**: ai_incident_system
- **Recursos**: Vector extension, triggers, views

#### 2. Redis Cache (Porta 6379)
- **Função**: Cache de alta performance e sessões
- **Password**: redis_secure_2025
- **Persistência**: AOF habilitada
- **Configuração**: Memory optimized

#### 3. ChromaDB Vector Database (Porta 8000)
- **Função**: Armazenamento de embeddings para IA
- **API**: RESTful interface
- **Autenticação**: Basic auth configurada
- **Persistência**: Volume mapping

### 📁 Estrutura de Diretórios

```
mainframe-ai-assistant/
├── scripts/
│   ├── start-ai-system.sh      # Script principal de inicialização
│   ├── health-check.sh         # Health checks completos
│   ├── connectivity-test.sh    # Testes de conectividade
│   ├── logging-config.json     # Configuração de logs
│   └── init-db.sql            # Schema de banco de dados
├── data/
│   ├── chroma/                # Dados ChromaDB
│   ├── postgres/              # Dados PostgreSQL
│   ├── redis/                 # Dados Redis
│   └── backups/               # Backups automáticos
├── logs/                      # Logs do sistema
├── .env                       # Variáveis de ambiente
├── docker-compose.yml         # Configuração Docker
└── main.js                    # Electron main process
```

### 🚀 Scripts de Automação

#### 1. start-ai-system.sh
Script principal que orquestra toda a inicialização:

```bash
./scripts/start-ai-system.sh start       # Iniciar sistema
./scripts/start-ai-system.sh stop        # Parar sistema
./scripts/start-ai-system.sh restart     # Reiniciar sistema
./scripts/start-ai-system.sh clean-start # Iniciar com dados limpos
./scripts/start-ai-system.sh status      # Ver status
./scripts/start-ai-system.sh backup      # Criar backup
./scripts/start-ai-system.sh logs        # Ver logs em tempo real
```

**Funcionalidades**:
- ✅ Verificação de dependências (Docker, Node.js)
- ✅ Validação de configuração (.env)
- ✅ Criação automática de diretórios
- ✅ Inicialização orquestrada de serviços
- ✅ Health checks automáticos
- ✅ Aguarda serviços ficarem prontos
- ✅ Backup automático
- ✅ Cleanup seguro

#### 2. health-check.sh
Health checks completos do sistema:

```bash
./scripts/health-check.sh
```

**Verificações**:
- ✅ Docker e Docker Compose instalados
- ✅ Status dos containers
- ✅ Conectividade dos serviços
- ✅ Estrutura do banco de dados
- ✅ Dados iniciais carregados
- ✅ Portas de rede disponíveis
- ✅ Arquivos de configuração
- ✅ Variáveis de ambiente
- ✅ Espaço em disco
- ✅ Logs por erros recentes

#### 3. connectivity-test.sh
Testes detalhados de conectividade:

```bash
./scripts/connectivity-test.sh
```

**Testes**:
- ✅ Status dos containers
- ✅ PostgreSQL queries e schemas
- ✅ Redis operações SET/GET
- ✅ ChromaDB API endpoints
- ✅ Conectividade entre serviços
- ✅ Portas expostas
- ✅ Logs de erros
- ✅ Performance básica

### 🔐 Configuração de Segurança

#### Variáveis de Ambiente Críticas (.env)
```bash
# Database
POSTGRES_PASSWORD=ai_secure_2025
REDIS_PASSWORD=redis_secure_2025

# Security
ENCRYPTION_KEY=ai-mainframe-secure-key-2025-32ch
JWT_SECRET=jwt-secret-key-ai-mainframe-2025
SECURITY_SALT=ai-security-salt-2025

# AI Configuration
AI_ANONYMIZE_DATA=true
AI_LOG_OPERATIONS=true
AI_REQUIRES_AUTHORIZATION=true
```

#### Permissões de Banco
- **ai_user**: Acesso limitado aos schemas específicos
- **RLS**: Row Level Security (preparado para implementação)
- **Audit**: Logs completos de auditoria
- **Encryption**: Dados sensíveis mascarados

### 📊 Logging Estruturado

#### Configuração (logging-config.json)
```json
{
  "formatters": {
    "detailed": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d - %(message)s",
    "json": "JsonFormatter for audit"
  },
  "handlers": {
    "console": "Stream para stdout",
    "file": "Rotating file handler",
    "error_file": "Error-only handler",
    "audit_file": "Timed rotating for audit"
  }
}
```

#### Tipos de Logs
- **ai-system.log**: Logs gerais do sistema
- **ai-system-errors.log**: Apenas erros
- **audit.log**: Logs de auditoria (JSON)
- **health-check-*.log**: Resultados de health checks

### 🐳 Docker Compose

#### Configuração Principal
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ai_incident_system
      POSTGRES_USER: ai_user
      POSTGRES_PASSWORD: ai_secure_2025
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass redis_secure_2025
    volumes:
      - ./data/redis:/data

  chromadb:
    image: chromadb/chroma:latest
    environment:
      CHROMA_SERVER_HOST: 0.0.0.0
      CHROMA_SERVER_HTTP_PORT: 8000
    volumes:
      - ./data/chroma:/chroma/chroma
```

### 🔍 Troubleshooting

#### Problemas Comuns

**1. Docker Compose não encontrado**
```bash
# Verificar instalação
docker --version
docker compose version

# Se usar versão antiga
docker-compose --version
```

**2. Permissões de arquivo**
```bash
# Corrigir permissões dos scripts
chmod +x scripts/*.sh

# Corrigir permissões de dados
sudo chown -R $USER:$USER data/
```

**3. Porta já em uso**
```bash
# Verificar processos usando portas
sudo netstat -tulpn | grep :5432
sudo netstat -tulpn | grep :6379
sudo netstat -tulpn | grep :8000

# Parar serviços conflitantes
sudo systemctl stop postgresql
sudo systemctl stop redis-server
```

**4. Containers não iniciam**
```bash
# Ver logs detalhados
docker compose logs postgres
docker compose logs redis
docker compose logs chromadb

# Rebuild containers
docker compose down
docker compose up --build -d
```

**5. Database não inicializa**
```bash
# Verificar se init-db.sql existe
ls -la scripts/init-db.sql

# Executar manualmente
docker compose exec postgres psql -U ai_user -d ai_incident_system -f /docker-entrypoint-initdb.d/init-db.sql
```

#### Comandos de Diagnóstico

```bash
# Status completo
./scripts/start-ai-system.sh status

# Health check completo
./scripts/health-check.sh

# Teste de conectividade
./scripts/connectivity-test.sh

# Logs em tempo real
docker compose logs -f

# Backup de emergência
./scripts/start-ai-system.sh backup
```

### 📈 Métricas e Monitoramento

#### Indicadores de Saúde
- **Taxa de Sucesso**: % de health checks passando
- **Tempo de Resposta**: Latência dos serviços
- **Uso de Memória**: Consumo de RAM
- **Espaço em Disco**: Disponibilidade de storage
- **Conexões Ativas**: PostgreSQL e Redis

#### Alertas Configurados
- **Disk Usage > 90%**: Alerta crítico
- **Service Down**: Falha de health check
- **High Error Rate**: Muitos erros nos logs
- **Memory Usage > 80%**: Alerta de memoria

### 🔄 Processo de Backup

#### Automático
- **PostgreSQL**: pg_dump diário
- **Redis**: BGSAVE automático
- **Configurações**: Backup de .env e docker-compose.yml
- **Retenção**: 7 dias por padrão

#### Manual
```bash
# Backup completo
./scripts/start-ai-system.sh backup

# Backup específico
docker compose exec postgres pg_dump -U ai_user ai_incident_system > backup.sql
docker compose exec redis redis-cli -a redis_secure_2025 BGSAVE
```

### ✅ Checklist de Validação

#### Pré-requisitos
- [ ] Docker instalado e funcionando
- [ ] Docker Compose disponível
- [ ] Portas 5432, 6379, 8000 livres
- [ ] Pelo menos 2GB de RAM disponível
- [ ] 5GB de espaço em disco livre

#### Configuração
- [ ] Arquivo .env configurado
- [ ] Scripts com permissões executáveis
- [ ] Diretórios data/ criados
- [ ] docker-compose.yml válido

#### Serviços
- [ ] PostgreSQL iniciado e respondendo
- [ ] Redis iniciado e respondendo
- [ ] ChromaDB iniciado e respondendo
- [ ] Schemas de banco criados
- [ ] Dados iniciais carregados

#### Segurança
- [ ] Passwords configuradas
- [ ] Encryption keys definidas
- [ ] Logs de auditoria ativos
- [ ] Permissões de arquivo corretas

#### Testes
- [ ] Health checks passando (100%)
- [ ] Conectividade entre serviços
- [ ] Performance dentro do esperado
- [ ] Backup funcionando

### 📞 Suporte

Para problemas com a infraestrutura:

1. **Executar health-check.sh** para diagnóstico
2. **Verificar logs** com `docker compose logs`
3. **Consultar troubleshooting** neste documento
4. **Criar backup** antes de mudanças críticas
5. **Contatar equipe de infraestrutura** se necessário

---

**Versão**: 2.0
**Data**: 2025-09-22
**Responsável**: Infrastructure Orchestrator Agent
**Status**: ✅ IMPLEMENTADO E VALIDADO