#!/bin/bash

# =======================================================================
# HEALTH CHECK COMPLETO DO SISTEMA AI
# Accenture Mainframe AI Assistant v2.0
# =======================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
LOG_FILE="./logs/health-check-$(date +%Y%m%d_%H%M%S).log"

# Função de log
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓ SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[⚠ WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[✗ ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Criar diretório de logs
mkdir -p ./logs

# Inicializar contadores
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Função para incrementar contadores
check_result() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    case $1 in
        "pass") PASSED_CHECKS=$((PASSED_CHECKS + 1)) ;;
        "fail") FAILED_CHECKS=$((FAILED_CHECKS + 1)) ;;
        "warn") WARNING_CHECKS=$((WARNING_CHECKS + 1)) ;;
    esac
}

echo "======================================================================="
echo "              HEALTH CHECK - SISTEMA AI INCIDENT RESOLUTION"
echo "======================================================================="
echo ""

# 1. VERIFICAR DOCKER E DOCKER COMPOSE
log "1. Verificando Docker e Docker Compose..."

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_success "Docker instalado: $DOCKER_VERSION"
    check_result "pass"
else
    log_error "Docker não está instalado"
    check_result "fail"
fi

if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
    else
        COMPOSE_VERSION=$(docker compose version)
    fi
    log_success "Docker Compose disponível: $COMPOSE_VERSION"
    check_result "pass"
else
    log_error "Docker Compose não está disponível"
    check_result "fail"
fi

# 2. VERIFICAR SERVIÇOS DOCKER
log "2. Verificando status dos containers..."

POSTGRES_STATUS=$(docker-compose ps postgres 2>/dev/null | grep -o "Up" || echo "Down")
REDIS_STATUS=$(docker-compose ps redis 2>/dev/null | grep -o "Up" || echo "Down")
CHROMADB_STATUS=$(docker-compose ps chromadb 2>/dev/null | grep -o "Up" || echo "Down")

if [ "$POSTGRES_STATUS" = "Up" ]; then
    log_success "PostgreSQL container está executando"
    check_result "pass"
else
    log_error "PostgreSQL container não está executando"
    check_result "fail"
fi

if [ "$REDIS_STATUS" = "Up" ]; then
    log_success "Redis container está executando"
    check_result "pass"
else
    log_error "Redis container não está executando"
    check_result "fail"
fi

if [ "$CHROMADB_STATUS" = "Up" ]; then
    log_success "ChromaDB container está executando"
    check_result "pass"
else
    log_error "ChromaDB container não está executando"
    check_result "fail"
fi

# 3. VERIFICAR CONECTIVIDADE DOS SERVIÇOS
log "3. Verificando conectividade dos serviços..."

# PostgreSQL
if docker-compose exec -T postgres pg_isready -U ai_user -d ai_incident_system &>/dev/null; then
    log_success "PostgreSQL está aceitando conexões"
    check_result "pass"
else
    log_error "PostgreSQL não está aceitando conexões"
    check_result "fail"
fi

# Redis
if docker-compose exec -T redis redis-cli -a redis_secure_2025 ping 2>/dev/null | grep -q PONG; then
    log_success "Redis está respondendo"
    check_result "pass"
else
    log_error "Redis não está respondendo"
    check_result "fail"
fi

# ChromaDB
if curl -s http://localhost:8000/api/v1/heartbeat 2>/dev/null | grep -q "OK"; then
    log_success "ChromaDB está respondendo"
    check_result "pass"
else
    log_error "ChromaDB não está respondendo"
    check_result "fail"
fi

# 4. VERIFICAR ESTRUTURA DE BANCO DE DADOS
log "4. Verificando estrutura do banco de dados..."

# Verificar schemas
if docker-compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('incident_system', 'audit_system', 'ml_system');" 2>/dev/null | grep -q incident_system; then
    log_success "Schemas do banco criados corretamente"
    check_result "pass"
else
    log_error "Schemas do banco não encontrados"
    check_result "fail"
fi

# Verificar tabelas principais
MAIN_TABLES="incidents business_areas technology_areas knowledge_base"
for table in $MAIN_TABLES; do
    if docker-compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT 1 FROM incident_system.$table LIMIT 1;" &>/dev/null; then
        log_success "Tabela incident_system.$table existe e está acessível"
        check_result "pass"
    else
        log_error "Tabela incident_system.$table não encontrada ou inacessível"
        check_result "fail"
    fi
done

# 5. VERIFICAR DADOS INICIAIS
log "5. Verificando dados iniciais..."

# Business Areas
BA_COUNT=$(docker-compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT COUNT(*) FROM incident_system.business_areas;" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")
if [ "$BA_COUNT" -gt 0 ]; then
    log_success "Business Areas carregadas: $BA_COUNT registros"
    check_result "pass"
else
    log_warning "Nenhuma Business Area encontrada"
    check_result "warn"
fi

# Technology Areas
TA_COUNT=$(docker-compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT COUNT(*) FROM incident_system.technology_areas;" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")
if [ "$TA_COUNT" -gt 0 ]; then
    log_success "Technology Areas carregadas: $TA_COUNT registros"
    check_result "pass"
else
    log_warning "Nenhuma Technology Area encontrada"
    check_result "warn"
fi

# 6. VERIFICAR PORTAS E CONECTIVIDADE
log "6. Verificando portas de rede..."

check_port() {
    local port=$1
    local service=$2
    if netstat -tuln 2>/dev/null | grep ":$port " &>/dev/null || ss -tuln 2>/dev/null | grep ":$port " &>/dev/null; then
        log_success "Porta $port ($service) está disponível"
        check_result "pass"
    else
        log_error "Porta $port ($service) não está disponível"
        check_result "fail"
    fi
}

check_port 5432 "PostgreSQL"
check_port 6379 "Redis"
check_port 8000 "ChromaDB"

# 7. VERIFICAR ARQUIVOS DE CONFIGURAÇÃO
log "7. Verificando arquivos de configuração..."

CONFIG_FILES=".env docker-compose.yml scripts/init-db.sql package.json main.js"
for file in $CONFIG_FILES; do
    if [ -f "$file" ]; then
        log_success "Arquivo $file existe"
        check_result "pass"
    else
        log_error "Arquivo $file não encontrado"
        check_result "fail"
    fi
done

# 8. VERIFICAR VARIÁVEIS DE AMBIENTE CRÍTICAS
log "8. Verificando variáveis de ambiente..."

if [ -f ".env" ]; then
    source .env 2>/dev/null || true

    ENV_VARS="POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD REDIS_PASSWORD"
    for var in $ENV_VARS; do
        if [ -n "${!var}" ]; then
            log_success "Variável $var está definida"
            check_result "pass"
        else
            log_warning "Variável $var não está definida"
            check_result "warn"
        fi
    done
else
    log_error "Arquivo .env não encontrado"
    check_result "fail"
fi

# 9. VERIFICAR ESPAÇO EM DISCO
log "9. Verificando espaço em disco..."

DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    log_success "Espaço em disco OK: ${DISK_USAGE}% usado"
    check_result "pass"
elif [ "$DISK_USAGE" -lt 95 ]; then
    log_warning "Espaço em disco baixo: ${DISK_USAGE}% usado"
    check_result "warn"
else
    log_error "Espaço em disco crítico: ${DISK_USAGE}% usado"
    check_result "fail"
fi

# 10. VERIFICAR LOGS DE ERRO
log "10. Verificando logs por erros recentes..."

ERROR_COUNT=0
if [ -d "./logs" ]; then
    ERROR_COUNT=$(grep -r "ERROR\|FATAL\|CRITICAL" ./logs/ 2>/dev/null | wc -l || echo "0")
fi

if [ "$ERROR_COUNT" -eq 0 ]; then
    log_success "Nenhum erro crítico encontrado nos logs"
    check_result "pass"
elif [ "$ERROR_COUNT" -lt 5 ]; then
    log_warning "$ERROR_COUNT erros encontrados nos logs"
    check_result "warn"
else
    log_error "$ERROR_COUNT erros encontrados nos logs"
    check_result "fail"
fi

# RESUMO FINAL
echo ""
echo "======================================================================="
echo "                            RESUMO DO HEALTH CHECK"
echo "======================================================================="
echo ""

PASS_PERCENT=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo "Total de verificações: $TOTAL_CHECKS"
echo -e "${GREEN}Passou: $PASSED_CHECKS${NC}"
echo -e "${YELLOW}Avisos: $WARNING_CHECKS${NC}"
echo -e "${RED}Falhas: $FAILED_CHECKS${NC}"
echo ""
echo "Taxa de sucesso: ${PASS_PERCENT}%"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
    if [ "$WARNING_CHECKS" -eq 0 ]; then
        log_success "✅ SISTEMA TOTALMENTE OPERACIONAL"
        exit 0
    else
        log_warning "⚠️ SISTEMA OPERACIONAL COM AVISOS"
        exit 1
    fi
else
    log_error "❌ SISTEMA COM FALHAS CRÍTICAS"
    exit 2
fi