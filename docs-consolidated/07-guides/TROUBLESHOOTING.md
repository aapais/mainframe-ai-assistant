# Guia de Solução de Problemas - Sistema de Gestão de Incidentes
## Versão 2.0 - Atualizado em 24/09/2024

### 📋 Índice
1. [Problemas Comuns](#problemas-comuns)
2. [Diagnóstico Inicial](#diagnóstico-inicial)
3. [Problemas de Conectividade](#problemas-de-conectividade)
4. [Problemas de Performance](#problemas-de-performance)
5. [Problemas de Banco de Dados](#problemas-de-banco-de-dados)
6. [Problemas de Interface](#problemas-de-interface)
7. [Problemas de IA/APIs Externas](#problemas-de-iaapis-externas)
8. [Códigos de Erro](#códigos-de-erro)
9. [Logs e Monitoramento](#logs-e-monitoramento)
10. [Procedimentos de Emergência](#procedimentos-de-emergência)

## Problemas Comuns

### 🚫 Sistema Não Inicia

#### Sintomas
- Aplicação não carrega
- Erro "Cannot connect to server"
- Tela branca ao abrir a aplicação

#### Diagnóstico
```bash
# Verificar se os serviços estão rodando
systemctl status incident-management
systemctl status nginx
systemctl status postgresql

# Verificar logs de inicialização
journalctl -u incident-management -f
```

#### Soluções
1. **Verificar Dependências**
   ```bash
   # Verificar Node.js
   node --version  # Deve ser >= 20.x
   npm --version

   # Verificar PostgreSQL
   sudo -u postgres psql -c "SELECT version();"
   ```

2. **Reiniciar Serviços**
   ```bash
   sudo systemctl restart postgresql
   sudo systemctl restart incident-management
   sudo systemctl restart nginx
   ```

3. **Verificar Configurações**
   ```bash
   # Verificar arquivo .env
   ls -la /path/to/application/.env

   # Testar conectividade com banco
   psql -U incident_admin -d incident_management -h localhost -c "SELECT 1;"
   ```

### 🐌 Sistema Lento

#### Sintomas
- Interface responsiva lenta
- Pesquisas demoram mais que 5 segundos
- Carregamento de páginas lento

#### Diagnóstico Rápido
```bash
# Verificar recursos do sistema
htop
free -h
df -h

# Verificar conexões de banco
sudo -u postgres psql -d incident_management -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

#### Soluções Imediatas
1. **Verificar Recursos**
   ```bash
   # CPU e Memória
   if [ $(free | awk 'FNR==2{print $3/$2*100}' | cut -d. -f1) -gt 85 ]; then
       echo "Memória alta - considerar restart"
   fi
   ```

2. **Limpar Cache**
   ```bash
   # Cache da aplicação
   redis-cli FLUSHALL  # Se usar Redis

   # Cache do navegador - orientar usuário
   echo "Limpar cache do navegador: Ctrl+Shift+R"
   ```

3. **Otimização Emergencial**
   ```bash
   # Vacuum no banco
   sudo -u postgres psql -d incident_management -c "VACUUM ANALYZE;"

   # Restart da aplicação
   systemctl restart incident-management
   ```

### 🔍 Busca Não Funciona

#### Sintomas
- Busca não retorna resultados
- Resultados irrelevantes
- Erro "Search service unavailable"

#### Diagnóstico
```bash
# Verificar índices de busca
sudo -u postgres psql -d incident_management -c "
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE indexname LIKE '%search%' OR indexname LIKE '%fts%';"

# Testar busca diretamente
curl "http://localhost:3001/api/search?q=test" -H "Authorization: Bearer your-token"
```

#### Soluções
1. **Recriar Índices de Busca**
   ```sql
   -- Conectar ao banco
   sudo -u postgres psql -d incident_management

   -- Recriar índice de busca full-text
   DROP INDEX IF EXISTS idx_incidents_search_vector;
   CREATE INDEX idx_incidents_search_vector ON incidents_enhanced
   USING GIN (search_vector);

   -- Atualizar estatísticas
   ANALYZE incidents_enhanced;
   ```

2. **Verificar Configuração FTS**
   ```sql
   -- Verificar configuração de idioma
   SHOW default_text_search_config;

   -- Testar busca manual
   SELECT title FROM incidents_enhanced
   WHERE search_vector @@ to_tsquery('english', 'test');
   ```

### 🔐 Problemas de Login

#### Sintomas
- "Invalid credentials" mesmo com senha correta
- Login fica carregando indefinidamente
- Erro de 2FA não funciona

#### Diagnóstico
```bash
# Verificar logs de autenticação
grep "authentication" /var/log/incident-management/app.log | tail -10

# Verificar sessões ativas
redis-cli KEYS "session:*" | wc -l  # Se usar Redis

# Verificar tentativas de login
sudo -u postgres psql -d incident_management -c "
SELECT email, ip_address, attempt_time
FROM failed_logins
WHERE attempt_time >= NOW() - INTERVAL '1 hour'
ORDER BY attempt_time DESC
LIMIT 10;"
```

#### Soluções
1. **Reset de Senha Manual**
   ```bash
   # Script de reset de senha
   node scripts/admin/reset-password.js --email user@domain.com --new-password temp123
   ```

2. **Limpar Tentativas de Login**
   ```bash
   # Limpar rate limiting
   redis-cli DEL "login_attempts:user@domain.com"

   # Ou direto no banco
   sudo -u postgres psql -d incident_management -c "
   DELETE FROM failed_logins
   WHERE email = 'user@domain.com';"
   ```

3. **Bypass 2FA (Emergência)**
   ```sql
   -- APENAS EM EMERGÊNCIA
   UPDATE users SET
     two_factor_enabled = false,
     two_factor_secret = null
   WHERE email = 'user@domain.com';
   ```

## Diagnóstico Inicial

### ✅ Health Check Completo
```bash
#!/bin/bash
# Script de diagnóstico rápido

echo "🔍 DIAGNÓSTICO RÁPIDO DO SISTEMA"
echo "================================="

# 1. Verificar serviços
echo "📋 Serviços:"
systemctl is-active incident-management && echo "✅ App: ATIVO" || echo "❌ App: INATIVO"
systemctl is-active nginx && echo "✅ Nginx: ATIVO" || echo "❌ Nginx: INATIVO"
systemctl is-active postgresql && echo "✅ PostgreSQL: ATIVO" || echo "❌ PostgreSQL: INATIVO"

# 2. Verificar recursos
echo -e "\n💾 Recursos:"
MEMORY_USAGE=$(free | awk 'FNR==2{printf "%.0f", $3/$2*100}')
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
echo "Memória: ${MEMORY_USAGE}%"
echo "Disco: ${DISK_USAGE}%"

# 3. Testar conectividade
echo -e "\n🌐 Conectividade:"
if curl -s --max-time 5 http://localhost:3001/health > /dev/null; then
    echo "✅ Health endpoint: OK"
else
    echo "❌ Health endpoint: FALHA"
fi

if sudo -u postgres psql -d incident_management -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Banco de dados: OK"
else
    echo "❌ Banco de dados: FALHA"
fi

# 4. Verificar logs de erro recentes
echo -e "\n📋 Erros Recentes:"
ERROR_COUNT=$(find /var/log/incident-management -name "*.log" -mtime -1 -exec grep -c "ERROR" {} \; 2>/dev/null | awk '{sum += $1} END {print sum+0}')
echo "Erros nas últimas 24h: $ERROR_COUNT"

if [ "$ERROR_COUNT" -gt 10 ]; then
    echo "⚠️  ALERTA: Muitos erros recentes"
    echo "Últimos 3 erros:"
    find /var/log/incident-management -name "*.log" -exec grep "ERROR" {} \; 2>/dev/null | tail -3
fi

echo -e "\n✅ Diagnóstico concluído"
```

### 📊 Verificação de Performance
```bash
#!/bin/bash
# Performance check script

echo "⚡ VERIFICAÇÃO DE PERFORMANCE"
echo "============================="

# Tempo de resposta da aplicação
echo "🌐 Testando tempo de resposta:"
time curl -s http://localhost:3001/health > /dev/null

# Verificar queries lentas no banco
echo -e "\n🗄️  Queries mais lentas (últimas 24h):"
sudo -u postgres psql -d incident_management -c "
SELECT query, mean_time, calls
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 5;" 2>/dev/null || echo "pg_stat_statements não configurado"

# Verificar cache hit ratio
echo -e "\n📊 Cache Hit Ratio:"
sudo -u postgres psql -d incident_management -c "
SELECT
  'Buffer Cache Hit Rate' as metric,
  (sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))) * 100 as percentage
FROM pg_statio_user_tables
WHERE heap_blks_read > 0;"

# Verificar tamanho das tabelas
echo -e "\n📏 Tamanho das tabelas principais:"
sudo -u postgres psql -d incident_management -c "
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 5;"
```

## Problemas de Conectividade

### 🌐 Aplicação Não Responde

#### Verificação de Portas
```bash
# Verificar portas em uso
netstat -tulpn | grep -E ":80|:443|:3001|:5432"
ss -tulpn | grep -E ":80|:443|:3001|:5432"

# Testar conectividade local
telnet localhost 3001
nc -zv localhost 3001
```

#### Verificação de Firewall
```bash
# Ubuntu/Debian
sudo ufw status
sudo iptables -L

# CentOS/RHEL
sudo firewall-cmd --list-all
sudo systemctl status firewalld
```

#### Soluções
1. **Liberar Portas**
   ```bash
   # Ubuntu
   sudo ufw allow 3001/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp

   # CentOS
   sudo firewall-cmd --add-port=3001/tcp --permanent
   sudo firewall-cmd --reload
   ```

2. **Verificar Binding de Portas**
   ```bash
   # Verificar configuração no código
   grep -r "listen\|port" /path/to/application/src/

   # Verificar variáveis de ambiente
   grep PORT /path/to/application/.env
   ```

### 🔒 Problemas de SSL/HTTPS

#### Sintomas
- "Connection not secure" no navegador
- Erro de certificado expirado
- Mixed content warnings

#### Diagnóstico
```bash
# Verificar certificado
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout

# Testar SSL
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Verificar configuração Nginx
nginx -t
sudo nginx -T | grep ssl
```

#### Soluções
1. **Renovar Certificado Let's Encrypt**
   ```bash
   sudo certbot renew --dry-run
   sudo certbot renew
   sudo systemctl reload nginx
   ```

2. **Verificar Configuração SSL**
   ```nginx
   # /etc/nginx/sites-available/incident-management
   server {
       listen 443 ssl http2;
       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

       # Testar configuração
       ssl_protocols TLSv1.2 TLSv1.3;
   }
   ```

## Problemas de Performance

### 🐌 Queries Lentas

#### Identificar Queries Problemáticas
```sql
-- Habilitar extensão para monitoramento (se não estiver)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Queries mais lentas
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE mean_time > 1000  -- Mais de 1 segundo
ORDER BY mean_time DESC
LIMIT 10;

-- Queries que consomem mais tempo total
SELECT
    query,
    calls,
    total_time,
    mean_time,
    (total_time/sum(total_time) OVER()) * 100 as percentage
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

#### Otimização de Queries
```sql
-- Verificar uso de índices
EXPLAIN ANALYZE
SELECT * FROM incidents_enhanced
WHERE status = 'OPEN' AND created_at > NOW() - INTERVAL '30 days';

-- Criar índices otimizados
CREATE INDEX CONCURRENTLY idx_incidents_status_date
ON incidents_enhanced (status, created_at)
WHERE status IN ('OPEN', 'IN_PROGRESS');

-- Atualizar estatísticas
ANALYZE incidents_enhanced;
```

### 📊 Problemas de Memória

#### Monitoramento de Memória
```bash
# Verificar uso por processo
ps aux --sort=-%mem | head -10

# Verificar memória Node.js
node --max-old-space-size=4096 src/api/incident-ai-server.js

# Monitorar memory leaks
node --inspect src/api/incident-ai-server.js
# Conectar no Chrome: chrome://inspect
```

#### Otimização
```javascript
// Configurações Node.js recomendadas
process.env.NODE_OPTIONS = "--max-old-space-size=4096 --optimize-for-size";

// Garbage collection manual (se necessário)
if (global.gc) {
    setInterval(() => {
        const before = process.memoryUsage();
        global.gc();
        const after = process.memoryUsage();
        console.log('GC freed:', (before.heapUsed - after.heapUsed) / 1024 / 1024, 'MB');
    }, 30000);
}
```

## Problemas de Banco de Dados

### 🗄️ Conexão com Banco Falhando

#### Diagnóstico
```bash
# Verificar serviço PostgreSQL
systemctl status postgresql
sudo -u postgres pg_lsclusters

# Verificar conexões
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Testar conexão
psql -U incident_admin -d incident_management -h localhost -p 5432
```

#### Soluções Comuns
1. **Excesso de Conexões**
   ```sql
   -- Verificar limite
   SHOW max_connections;

   -- Conexões atuais
   SELECT count(*) FROM pg_stat_activity;

   -- Matar conexões inativas
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND state_change < now() - interval '30 minutes';
   ```

2. **Configuração de Conexão**
   ```bash
   # Verificar pg_hba.conf
   sudo cat /etc/postgresql/16/main/pg_hba.conf | grep -v ^# | grep -v ^$

   # Deve ter linha similar a:
   # local   incident_management   incident_admin   md5
   # host    incident_management   incident_admin   127.0.0.1/32   md5
   ```

### 🔧 Problemas de Performance do Banco

#### Queries Bloqueadas
```sql
-- Verificar locks
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity
    ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### Manutenção Preventiva
```sql
-- Vacuum automático
SELECT
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    round(n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) as dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_ratio DESC;

-- Executar vacuum se necessário
VACUUM (VERBOSE, ANALYZE) incidents_enhanced;
VACUUM (VERBOSE, ANALYZE) knowledge_base;

-- Reindex se fragmentação alta
REINDEX INDEX CONCURRENTLY idx_incidents_search_vector;
```

## Problemas de Interface

### 🖥️ Interface Não Carrega

#### Sintomas
- Tela branca
- Erro "Failed to load resource"
- Console mostra erros JavaScript

#### Diagnóstico
```bash
# Verificar arquivos estáticos
ls -la /path/to/application/public/
ls -la /path/to/application/build/

# Verificar logs do navegador
# F12 > Console
# F12 > Network
```

#### Soluções
1. **Rebuild da Aplicação**
   ```bash
   cd /path/to/application
   rm -rf node_modules
   npm install
   npm run build
   ```

2. **Verificar Proxy/Nginx**
   ```nginx
   # Configuração para arquivos estáticos
   location /static/ {
       alias /path/to/application/build/static/;
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

### 📱 Problemas de Responsividade

#### CSS/Layout Quebrado
```bash
# Verificar se CSS está sendo servido
curl -I http://localhost:3001/static/css/main.css

# Verificar Content-Type
curl -v http://localhost:3001/static/css/main.css | head -5
```

#### Soluções
```nginx
# Nginx - configurar MIME types corretos
location ~* \.(css|js)$ {
    add_header Content-Type text/css;
    expires 1y;
}
```

## Problemas de IA/APIs Externas

### 🤖 APIs de IA Não Respondem

#### Diagnóstico
```bash
# Testar OpenAI
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}],"max_tokens":10}' \
     https://api.openai.com/v1/chat/completions

# Testar Gemini
curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"test"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$GEMINI_API_KEY"
```

#### Problemas Comuns
1. **Rate Limiting**
   ```javascript
   // Implementar exponential backoff
   const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

   async function callWithRetry(apiCall, maxRetries = 3) {
       for (let i = 0; i < maxRetries; i++) {
           try {
               return await apiCall();
           } catch (error) {
               if (error.status === 429) {
                   await delay(Math.pow(2, i) * 1000);
                   continue;
               }
               throw error;
           }
       }
   }
   ```

2. **API Key Inválida**
   ```bash
   # Verificar variáveis de ambiente
   echo $OPENAI_API_KEY | cut -c1-10  # Primeiros 10 chars
   echo $GEMINI_API_KEY | cut -c1-10

   # Testar validade
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models | jq .
   ```

### 🔍 Busca Vetorial Falhando

#### ChromaDB Issues
```bash
# Verificar se ChromaDB está rodando
curl http://localhost:8000/api/v1/heartbeat

# Verificar coleções
curl http://localhost:8000/api/v1/collections

# Restart ChromaDB
docker restart chromadb
# ou
pkill -f chroma
python -m chromadb.server --host 0.0.0.0 --port 8000
```

## Códigos de Erro

### 🔢 Códigos de Sistema

#### HTTP Status Codes
- **200**: Success
- **400**: Bad Request - Dados inválidos
- **401**: Unauthorized - Token inválido/expirado
- **403**: Forbidden - Sem permissão
- **404**: Not Found - Recurso não encontrado
- **429**: Too Many Requests - Rate limit excedido
- **500**: Internal Server Error - Erro interno
- **503**: Service Unavailable - Serviço temporariamente indisponível

#### Application Error Codes
```
ERR_DB_001: Database connection failed
ERR_DB_002: Query timeout
ERR_DB_003: Constraint violation
ERR_DB_004: Transaction failed

ERR_AUTH_001: Invalid credentials
ERR_AUTH_002: Token expired
ERR_AUTH_003: 2FA required
ERR_AUTH_004: Account locked

ERR_API_001: External API unavailable
ERR_API_002: API rate limit exceeded
ERR_API_003: Invalid API response
ERR_API_004: API authentication failed

ERR_SEARCH_001: Search index unavailable
ERR_SEARCH_002: Invalid search query
ERR_SEARCH_003: Search timeout

ERR_FILE_001: File not found
ERR_FILE_002: File too large
ERR_FILE_003: Invalid file type
```

### 🔧 Correções por Código

#### Database Errors (ERR_DB_*)
```bash
# ERR_DB_001: Database connection failed
sudo systemctl restart postgresql
psql -U incident_admin -d incident_management -c "SELECT 1;"

# ERR_DB_002: Query timeout
sudo -u postgres psql -d incident_management -c "
SELECT pid, query_start, query
FROM pg_stat_activity
WHERE state = 'active' AND query_start < now() - interval '5 minutes';"

# ERR_DB_004: Transaction failed
sudo -u postgres psql -d incident_management -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

#### Authentication Errors (ERR_AUTH_*)
```bash
# ERR_AUTH_001: Invalid credentials
redis-cli DEL "login_attempts:user@domain.com"

# ERR_AUTH_002: Token expired
# Orientar usuário a fazer novo login

# ERR_AUTH_004: Account locked
sudo -u postgres psql -d incident_management -c "
UPDATE users SET locked = false, failed_attempts = 0
WHERE email = 'user@domain.com';"
```

## Logs e Monitoramento

### 📋 Localização dos Logs

#### Logs da Aplicação
```bash
# Logs principais
/var/log/incident-management/app.log
/var/log/incident-management/error.log
/var/log/incident-management/access.log

# Logs de sistema
/var/log/syslog
journalctl -u incident-management

# Logs do PostgreSQL
/var/log/postgresql/postgresql-16-main.log

# Logs do Nginx
/var/log/nginx/access.log
/var/log/nginx/error.log
```

#### Comandos Úteis para Logs
```bash
# Logs em tempo real
tail -f /var/log/incident-management/app.log

# Filtrar por nível de erro
grep "ERROR\|WARN" /var/log/incident-management/app.log

# Logs das últimas 24h
find /var/log/incident-management -name "*.log" -mtime -1 -exec grep "ERROR" {} \;

# Análise de padrões
awk '/ERROR/ {print $1, $2, $NF}' /var/log/incident-management/app.log | sort | uniq -c
```

### 📊 Monitoramento em Tempo Real

#### Health Check Dashboard
```bash
#!/bin/bash
# scripts/monitoring/realtime-dashboard.sh

watch -n 5 '
clear
echo "🖥️  INCIDENT MANAGEMENT SYSTEM - REAL-TIME DASHBOARD"
echo "=================================================="
echo "⏰ $(date)"
echo ""

# Status dos serviços
echo "📋 SERVIÇOS:"
systemctl is-active incident-management && echo "✅ Application: RUNNING" || echo "❌ Application: STOPPED"
systemctl is-active nginx && echo "✅ Nginx: RUNNING" || echo "❌ Nginx: STOPPED"
systemctl is-active postgresql && echo "✅ PostgreSQL: RUNNING" || echo "❌ PostgreSQL: STOPPED"

echo ""
echo "💾 RECURSOS:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk "{print \$2}" | sed "s/%us,//")"
echo "Memory: $(free | awk "FNR==2{printf \"%.1f\", \$3/\$2*100}")%"
echo "Disk: $(df -h / | awk "NR==2 {print \$5}")"

echo ""
echo "🗄️  DATABASE:"
ACTIVE_CONNECTIONS=$(sudo -u postgres psql -d incident_management -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs)
echo "Active connections: ${ACTIVE_CONNECTIONS:-ERROR}"

echo ""
echo "📊 APPLICATION METRICS:"
if curl -s --max-time 3 http://localhost:3001/health > /dev/null; then
    echo "✅ Health check: OK"
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3001/health)
    echo "Response time: ${RESPONSE_TIME}s"
else
    echo "❌ Health check: FAILED"
fi

echo ""
echo "🚨 RECENT ERRORS (last 10 minutes):"
ERROR_COUNT=$(find /var/log/incident-management -name "*.log" -mmin -10 -exec grep -c "ERROR" {} \; 2>/dev/null | awk "{sum += \$1} END {print sum+0}")
echo "Error count: $ERROR_COUNT"

if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "Last error:"
    find /var/log/incident-management -name "*.log" -exec grep "ERROR" {} \; 2>/dev/null | tail -1
fi
'
```

## Procedimentos de Emergência

### 🚨 Sistema Completamente Fora do Ar

#### Procedimento de Emergência
```bash
#!/bin/bash
# scripts/emergency/system-recovery.sh

echo "🚨 PROCEDIMENTO DE EMERGÊNCIA - RECUPERAÇÃO DO SISTEMA"
echo "======================================================"

# 1. Verificar hardware/VM
echo "1. Verificando recursos do sistema..."
free -h
df -h
uptime

# 2. Verificar serviços críticos
echo "2. Verificando serviços..."
sudo systemctl start postgresql
sleep 5
sudo systemctl start incident-management
sleep 5
sudo systemctl start nginx

# 3. Verificar conectividade básica
echo "3. Testando conectividade..."
if ping -c 1 8.8.8.8 > /dev/null; then
    echo "✅ Internet: OK"
else
    echo "❌ Internet: FAIL"
fi

# 4. Testar banco de dados
echo "4. Testando banco de dados..."
if sudo -u postgres psql -d incident_management -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database: OK"
else
    echo "❌ Database: FAIL - Tentando recuperação..."
    sudo -u postgres pg_ctl restart
    sleep 10
fi

# 5. Testar aplicação
echo "5. Testando aplicação..."
sleep 15
if curl -s --max-time 10 http://localhost:3001/health > /dev/null; then
    echo "✅ Application: OK"
else
    echo "❌ Application: FAIL - Verificar logs"
    tail -20 /var/log/incident-management/error.log
fi

# 6. Notificar equipe
echo "6. Enviando notificação..."
echo "Sistema de incidentes: $(systemctl is-active incident-management)" | \
mail -s "🚨 Emergency Recovery Status" admin@empresa.com

echo "✅ Procedimento de emergência concluído"
```

### 🔄 Rollback de Emergência

#### Quando Usar
- Atualização causou instabilidade
- Novo deploy quebrou funcionalidades críticas
- Performance degradou significativamente

#### Procedimento
```bash
#!/bin/bash
# scripts/emergency/emergency-rollback.sh

BACKUP_DIR="/backup/pre-update-$(date +%Y%m%d)"

echo "🔄 ROLLBACK DE EMERGÊNCIA"
echo "========================="

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ ERRO: Backup não encontrado em $BACKUP_DIR"
    exit 1
fi

# Confirmação
read -p "⚠️  Confirma rollback para backup de $BACKUP_DIR? (yes/NO): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Operação cancelada"
    exit 0
fi

# Parar serviços
echo "1. Parando serviços..."
sudo systemctl stop incident-management nginx

# Backup atual (segurança)
echo "2. Criando backup de segurança..."
EMERGENCY_BACKUP="/backup/emergency-$(date +%s)"
mkdir -p "$EMERGENCY_BACKUP"
pg_dump -U incident_admin incident_management | gzip > "$EMERGENCY_BACKUP/current.sql.gz"
tar -czf "$EMERGENCY_BACKUP/current-app.tar.gz" -C /path/to/application .

# Restaurar banco
echo "3. Restaurando banco de dados..."
sudo -u postgres dropdb incident_management
sudo -u postgres createdb incident_management
gunzip -c "$BACKUP_DIR/database.sql.gz" | sudo -u postgres psql incident_management

# Restaurar aplicação
echo "4. Restaurando aplicação..."
rm -rf /path/to/application/*
tar -xzf "$BACKUP_DIR/application.tar.gz" -C /path/to/application

# Reinstalar dependências
echo "5. Reinstalando dependências..."
cd /path/to/application
npm install --production

# Reiniciar serviços
echo "6. Reiniciando serviços..."
sudo systemctl start postgresql
sudo systemctl start incident-management
sudo systemctl start nginx

# Verificar funcionamento
echo "7. Verificando funcionamento..."
sleep 20
if curl -s --max-time 10 http://localhost:3001/health > /dev/null; then
    echo "✅ ROLLBACK CONCLUÍDO COM SUCESSO"
    echo "Sistema restaurado para: $(ls -ld $BACKUP_DIR | awk '{print $6, $7, $8}')"
else
    echo "❌ ERRO: Sistema não está respondendo após rollback"
    echo "Backup de emergência criado em: $EMERGENCY_BACKUP"
fi
```

### 📞 Contatos de Emergência

#### Escalação de Problemas
```
NÍVEL 1 - Problemas Menores (< 30 min)
- Técnico de Suporte: +55 11 9999-1111
- Email: suporte@empresa.com

NÍVEL 2 - Problemas Médios (30-60 min)
- Administrador de Sistema: +55 11 9999-2222
- Email: admin@empresa.com

NÍVEL 3 - Problemas Críticos (> 60 min)
- Tech Lead: +55 11 9999-3333
- Gerente de TI: +55 11 9999-4444
- Email: emergencia@empresa.com

FORNECEDORES CRÍTICOS:
- Provedor de Internet: 0800-xxx-xxxx
- Hosting/Cloud: suporte@provider.com
- Banco de Dados: dba@empresa.com
```

#### Template de Comunicação
```
ASSUNTO: 🚨 [CRÍTICO] Sistema de Incidentes - [DESCRIÇÃO PROBLEMA]

DETALHES DO INCIDENTE:
- Data/Hora: [TIMESTAMP]
- Severidade: [BAIXA/MÉDIA/ALTA/CRÍTICA]
- Impacto: [Número de usuários afetados]
- Sintomas: [Descrição do problema]
- Ações Tomadas: [O que já foi tentado]
- Status Atual: [EM_INVESTIGACAO/EM_CORRECAO/RESOLVIDO]
- ETA Resolução: [Estimativa]

PRÓXIMOS PASSOS:
1. [Ação 1]
2. [Ação 2]
3. [Ação 3]

CONTATO:
[Nome] - [Telefone] - [Email]
```

---

**Guia de Solução de Problemas - Versão 2.0**
**Última Atualização:** 24/09/2024
**Próxima Revisão:** 24/12/2024
**Responsável:** Equipe de Suporte Técnico