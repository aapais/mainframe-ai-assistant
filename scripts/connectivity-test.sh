#!/bin/bash

# =======================================================================
# TESTE DE CONECTIVIDADE - SISTEMA AI
# Accenture Mainframe AI Assistant v2.0
# =======================================================================

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

echo "======================================================================="
echo "              TESTE DE CONECTIVIDADE - SERVIÇOS AI"
echo "======================================================================="
echo ""

# 1. Verificar se containers estão rodando
log "1. Verificando status dos containers..."

POSTGRES_RUNNING=$(docker compose ps postgres 2>/dev/null | grep -c "Up" || echo "0")
REDIS_RUNNING=$(docker compose ps redis 2>/dev/null | grep -c "Up" || echo "0")
CHROMADB_RUNNING=$(docker compose ps chromadb 2>/dev/null | grep -c "Up" || echo "0")

if [ "$POSTGRES_RUNNING" -eq 1 ]; then
    log_success "PostgreSQL container está executando"
else
    log_error "PostgreSQL container não está executando"
fi

if [ "$REDIS_RUNNING" -eq 1 ]; then
    log_success "Redis container está executando"
else
    log_error "Redis container não está executando"
fi

if [ "$CHROMADB_RUNNING" -eq 1 ]; then
    log_success "ChromaDB container está executando"
else
    log_error "ChromaDB container não está executando"
fi

# 2. Teste de conectividade PostgreSQL
log "2. Testando conectividade PostgreSQL..."

if docker compose exec -T postgres pg_isready -U ai_user -d ai_incident_system &>/dev/null; then
    log_success "PostgreSQL está aceitando conexões"

    # Testar query básica
    if docker compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT 1;" &>/dev/null; then
        log_success "PostgreSQL: Query test OK"
    else
        log_error "PostgreSQL: Query test FAILED"
    fi

    # Verificar schemas
    SCHEMAS=$(docker compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('incident_system', 'audit_system', 'ml_system');" -t 2>/dev/null | grep -v "^$" | wc -l)
    if [ "$SCHEMAS" -eq 3 ]; then
        log_success "PostgreSQL: Todos os schemas encontrados ($SCHEMAS/3)"
    else
        log_warning "PostgreSQL: Schemas incompletos ($SCHEMAS/3)"
    fi

else
    log_error "PostgreSQL não está aceitando conexões"
fi

# 3. Teste de conectividade Redis
log "3. Testando conectividade Redis..."

if docker compose exec -T redis redis-cli -a redis_secure_2025 ping 2>/dev/null | grep -q PONG; then
    log_success "Redis está respondendo ao PING"

    # Testar operações básicas
    TEST_KEY="test:$(date +%s)"
    if docker compose exec -T redis redis-cli -a redis_secure_2025 set "$TEST_KEY" "test_value" &>/dev/null; then
        log_success "Redis: Operação SET OK"

        if docker compose exec -T redis redis-cli -a redis_secure_2025 get "$TEST_KEY" 2>/dev/null | grep -q "test_value"; then
            log_success "Redis: Operação GET OK"
        else
            log_error "Redis: Operação GET FAILED"
        fi

        # Limpar teste
        docker compose exec -T redis redis-cli -a redis_secure_2025 del "$TEST_KEY" &>/dev/null
    else
        log_error "Redis: Operação SET FAILED"
    fi
else
    log_error "Redis não está respondendo"
fi

# 4. Teste de conectividade ChromaDB
log "4. Testando conectividade ChromaDB..."

if curl -s http://localhost:8000/api/v1/heartbeat 2>/dev/null | grep -q "OK"; then
    log_success "ChromaDB heartbeat OK"

    # Testar API version
    VERSION=$(curl -s http://localhost:8000/api/v1/version 2>/dev/null | jq -r '.version' 2>/dev/null || echo "unknown")
    if [ "$VERSION" != "unknown" ]; then
        log_success "ChromaDB versão: $VERSION"
    else
        log_warning "ChromaDB versão não detectada"
    fi

    # Testar listagem de collections
    if curl -s http://localhost:8000/api/v1/collections 2>/dev/null >/dev/null; then
        log_success "ChromaDB: API collections OK"
    else
        log_error "ChromaDB: API collections FAILED"
    fi

else
    log_error "ChromaDB não está respondendo"
fi

# 5. Teste de conectividade entre serviços
log "5. Testando conectividade entre serviços..."

# PostgreSQL -> Redis (simular cache)
if docker compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT 1;" &>/dev/null && \
   docker compose exec -T redis redis-cli -a redis_secure_2025 ping &>/dev/null; then
    log_success "PostgreSQL <-> Redis: Conectividade OK"
else
    log_error "PostgreSQL <-> Redis: Conectividade FAILED"
fi

# 6. Verificar portas expostas
log "6. Verificando portas expostas..."

check_port() {
    local port=$1
    local service=$2
    if nc -z localhost "$port" 2>/dev/null || timeout 3 bash -c "</dev/tcp/localhost/$port" 2>/dev/null; then
        log_success "Porta $port ($service) está acessível"
    else
        log_error "Porta $port ($service) não está acessível"
    fi
}

check_port 5432 "PostgreSQL"
check_port 6379 "Redis"
check_port 8000 "ChromaDB"

# 7. Verificar logs por erros
log "7. Verificando logs dos serviços..."

# PostgreSQL logs
PG_ERRORS=$(docker compose logs postgres 2>/dev/null | grep -i "error\|fatal" | wc -l || echo "0")
if [ "$PG_ERRORS" -eq 0 ]; then
    log_success "PostgreSQL: Nenhum erro nos logs"
else
    log_warning "PostgreSQL: $PG_ERRORS erros encontrados nos logs"
fi

# Redis logs
REDIS_ERRORS=$(docker compose logs redis 2>/dev/null | grep -i "error\|fatal" | wc -l || echo "0")
if [ "$REDIS_ERRORS" -eq 0 ]; then
    log_success "Redis: Nenhum erro nos logs"
else
    log_warning "Redis: $REDIS_ERRORS erros encontrados nos logs"
fi

# ChromaDB logs
CHROMA_ERRORS=$(docker compose logs chromadb 2>/dev/null | grep -i "error\|fatal" | wc -l || echo "0")
if [ "$CHROMA_ERRORS" -eq 0 ]; then
    log_success "ChromaDB: Nenhum erro nos logs"
else
    log_warning "ChromaDB: $CHROMA_ERRORS erros encontrados nos logs"
fi

# 8. Teste de performance básico
log "8. Executando testes de performance básicos..."

# PostgreSQL query performance
PG_TIME=$(docker compose exec -T postgres psql -U ai_user -d ai_incident_system -c "\timing on" -c "SELECT COUNT(*) FROM incident_system.business_areas;" 2>/dev/null | grep "Time:" | awk '{print $2}' || echo "N/A")
if [ "$PG_TIME" != "N/A" ]; then
    log_success "PostgreSQL query time: ${PG_TIME}"
else
    log_warning "PostgreSQL query time: Não medido"
fi

# Redis response time
REDIS_START=$(date +%s%N)
docker compose exec -T redis redis-cli -a redis_secure_2025 ping &>/dev/null
REDIS_END=$(date +%s%N)
REDIS_TIME=$(( (REDIS_END - REDIS_START) / 1000000 ))
log_success "Redis response time: ${REDIS_TIME}ms"

echo ""
echo "======================================================================="
echo "                        TESTE DE CONECTIVIDADE CONCLUÍDO"
echo "======================================================================="
echo ""

# Resumo final
TOTAL_SERVICES=3
RUNNING_SERVICES=0
[ "$POSTGRES_RUNNING" -eq 1 ] && RUNNING_SERVICES=$((RUNNING_SERVICES + 1))
[ "$REDIS_RUNNING" -eq 1 ] && RUNNING_SERVICES=$((RUNNING_SERVICES + 1))
[ "$CHROMADB_RUNNING" -eq 1 ] && RUNNING_SERVICES=$((RUNNING_SERVICES + 1))

echo "Serviços em execução: $RUNNING_SERVICES/$TOTAL_SERVICES"

if [ "$RUNNING_SERVICES" -eq "$TOTAL_SERVICES" ]; then
    log_success "✅ TODOS OS SERVIÇOS ESTÃO OPERACIONAIS"
    exit 0
else
    log_error "❌ ALGUNS SERVIÇOS NÃO ESTÃO FUNCIONANDO"
    exit 1
fi