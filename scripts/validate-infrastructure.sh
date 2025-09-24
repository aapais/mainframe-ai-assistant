#!/bin/bash

# =======================================================================
# VALIDAÇÃO COMPLETA DA INFRAESTRUTURA
# Accenture Mainframe AI Assistant v2.0
# =======================================================================

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Contadores
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

echo "======================================================================="
echo "              VALIDAÇÃO COMPLETA DA INFRAESTRUTURA"
echo "                    FASE 1 - CONSOLIDAÇÃO E SETUP"
echo "======================================================================="
echo ""

# 1. VERIFICAR ARQUIVOS PRINCIPAIS
log "1. Verificando arquivos principais..."

check
if [ -f "main.js" ]; then
    log_success "main.js encontrado"
else
    log_error "main.js não encontrado"
fi

check
if [ -f "package.json" ]; then
    log_success "package.json encontrado"
else
    log_error "package.json não encontrado"
fi

check
if [ -f "docker-compose.yml" ]; then
    log_success "docker-compose.yml encontrado"
else
    log_error "docker-compose.yml não encontrado"
fi

check
if [ -f ".env" ]; then
    log_success ".env encontrado"
else
    log_error ".env não encontrado"
fi

check
if [ -f "scripts/init-db.sql" ]; then
    log_success "init-db.sql encontrado"
else
    log_error "init-db.sql não encontrado"
fi

# 2. VERIFICAR SCRIPTS
log "2. Verificando scripts de automação..."

SCRIPTS=(
    "scripts/start-ai-system.sh"
    "scripts/health-check.sh"
    "scripts/connectivity-test.sh"
    "scripts/fix-docker-permissions.sh"
)

for script in "${SCRIPTS[@]}"; do
    check
    if [ -f "$script" ] && [ -x "$script" ]; then
        log_success "$(basename $script) existe e é executável"
    elif [ -f "$script" ]; then
        log_warning "$(basename $script) existe mas não é executável"
        chmod +x "$script" 2>/dev/null && log_success "Permissão corrigida" || log_error "Falha ao corrigir permissão"
    else
        log_error "$(basename $script) não encontrado"
    fi
done

# 3. VERIFICAR ESTRUTURA DE DIRETÓRIOS
log "3. Verificando estrutura de diretórios..."

DIRS=(
    "logs"
    "data"
    "data/chroma"
    "data/postgres"
    "data/redis"
    "data/backups"
    "docs"
    "scripts"
)

for dir in "${DIRS[@]}"; do
    check
    if [ -d "$dir" ]; then
        log_success "Diretório $dir existe"
    else
        log_warning "Diretório $dir não existe - criando..."
        mkdir -p "$dir" && log_success "Diretório $dir criado" || log_error "Falha ao criar $dir"
    fi
done

# 4. VERIFICAR CONFIGURAÇÃO PACKAGE.JSON
log "4. Verificando configuração package.json..."

check
if grep -q '"main": "main.js"' package.json; then
    log_success "package.json main entry configurado corretamente"
else
    log_error "package.json main entry incorreto"
fi

check
if grep -q '"electron"' package.json; then
    log_success "Dependência Electron encontrada"
else
    log_error "Dependência Electron não encontrada"
fi

check
if grep -q '"electron-builder"' package.json; then
    log_success "Dependência electron-builder encontrada"
else
    log_error "Dependência electron-builder não encontrada"
fi

# 5. VERIFICAR CONFIGURAÇÃO .ENV
log "5. Verificando configuração de ambiente..."

if [ -f ".env" ]; then
    source .env 2>/dev/null || true

    ENV_VARS=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "ENCRYPTION_KEY"
        "JWT_SECRET"
    )

    for var in "${ENV_VARS[@]}"; do
        check
        if [ -n "${!var}" ]; then
            log_success "Variável $var está definida"
        else
            log_error "Variável $var não está definida"
        fi
    done
fi

# 6. VERIFICAR DOCKER COMPOSE
log "6. Verificando configuração Docker Compose..."

check
if command -v docker &> /dev/null; then
    log_success "Docker está instalado"
else
    log_error "Docker não está instalado"
fi

check
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    log_success "Docker Compose está disponível"
else
    log_error "Docker Compose não está disponível"
fi

check
if docker compose config --quiet 2>/dev/null; then
    log_success "docker-compose.yml é válido"
else
    log_error "docker-compose.yml tem erros de configuração"
fi

# 7. VERIFICAR NODE.JS
log "7. Verificando Node.js e dependências..."

check
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js instalado: $NODE_VERSION"
else
    log_error "Node.js não está instalado"
fi

check
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_success "NPM instalado: $NPM_VERSION"
else
    log_error "NPM não está instalado"
fi

check
if [ -d "node_modules" ]; then
    log_success "node_modules existe"
else
    log_warning "node_modules não existe - execute npm install"
fi

# 8. VERIFICAR DOCUMENTAÇÃO
log "8. Verificando documentação..."

check
if [ -f "docs/infrastructure-setup.md" ]; then
    log_success "Documentação de infraestrutura criada"
else
    log_error "Documentação de infraestrutura não encontrada"
fi

check
if [ -f "scripts/logging-config.json" ]; then
    log_success "Configuração de logging encontrada"
else
    log_error "Configuração de logging não encontrada"
fi

# 9. VERIFICAR LOGS
log "9. Verificando sistema de logs..."

check
if [ -f "logs/infrastructure-validation.log" ]; then
    log_success "Log de validação encontrado"
else
    log_warning "Log de validação será criado"
fi

# 10. TESTE DE CONFIGURAÇÃO FINAL
log "10. Executando testes finais..."

# Verificar se main.js tem configuração básica do Electron
check
if grep -q "electron" main.js && grep -q "BrowserWindow" main.js; then
    log_success "main.js tem configuração Electron válida"
else
    log_error "main.js não tem configuração Electron válida"
fi

# Verificar se init-db.sql tem estrutura correta
check
if grep -q "CREATE SCHEMA" scripts/init-db.sql && grep -q "incidents" scripts/init-db.sql; then
    log_success "init-db.sql tem estrutura de banco válida"
else
    log_error "init-db.sql não tem estrutura de banco válida"
fi

# RESUMO FINAL
echo ""
echo "======================================================================="
echo "                        RESUMO DA VALIDAÇÃO"
echo "======================================================================="
echo ""

SUCCESS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo "Total de verificações: $TOTAL_CHECKS"
echo -e "${GREEN}Sucessos: $PASSED_CHECKS${NC}"
echo -e "${RED}Falhas: $FAILED_CHECKS${NC}"
echo "Taxa de sucesso: ${SUCCESS_RATE}%"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
    log_success "✅ INFRAESTRUTURA TOTALMENTE VALIDADA"
    echo ""
    echo "🚀 Próximos passos:"
    echo "  1. ./scripts/start-ai-system.sh start"
    echo "  2. ./scripts/health-check.sh"
    echo "  3. ./scripts/connectivity-test.sh"
    echo ""
    exit 0
elif [ "$FAILED_CHECKS" -le 3 ]; then
    log_warning "⚠️ INFRAESTRUTURA PARCIALMENTE VALIDADA"
    echo ""
    echo "🔧 Corrija as falhas acima e execute novamente"
    echo ""
    exit 1
else
    log_error "❌ INFRAESTRUTURA COM MUITAS FALHAS"
    echo ""
    echo "🛠️ Necessária correção antes de prosseguir"
    echo ""
    exit 2
fi