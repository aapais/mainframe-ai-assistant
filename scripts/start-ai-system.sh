#!/bin/bash

# =======================================================================
# SISTEMA DE RESOLUÇÃO DE INCIDENTES COM IA - SCRIPT DE INICIALIZAÇÃO
# Accenture Mainframe AI Assistant v2.0
# =======================================================================

set -e  # Exit on any error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
PROJECT_NAME="mainframe-ai-assistant"
LOG_DIR="./logs"
DATA_DIR="./data"
ENV_FILE=".env"

# Função de log
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Função para criar diretórios necessários
create_directories() {
    log "Criando estrutura de diretórios..."

    mkdir -p "$LOG_DIR" 2>/dev/null || true
    mkdir -p "$DATA_DIR/chroma" 2>/dev/null || true
    mkdir -p "$DATA_DIR/postgres" 2>/dev/null || true
    mkdir -p "$DATA_DIR/redis" 2>/dev/null || true
    mkdir -p "$DATA_DIR/backups" 2>/dev/null || true

    log_success "Diretórios criados com sucesso"
}

# Função para verificar dependências
check_dependencies() {
    log "Verificando dependências do sistema..."

    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker não está instalado. Instalação necessária."
        exit 1
    fi

    # Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose não está instalado. Instalação necessária."
        exit 1
    fi

    # Node.js
    if ! command -v node &> /dev/null; then
        log_warning "Node.js não encontrado. Necessário para Electron."
    fi

    # Python3
    if ! command -v python3 &> /dev/null; then
        log_warning "Python3 não encontrado. Necessário para alguns scripts."
    fi

    log_success "Dependências verificadas"
}

# Função para validar arquivo .env
validate_env() {
    log "Validando configuração de ambiente..."

    if [ ! -f "$ENV_FILE" ]; then
        if [ -f ".env.example" ]; then
            log_warning "Arquivo .env não encontrado. Copiando de .env.example..."
            cp .env.example .env
        else
            log_error "Arquivo .env.example não encontrado!"
            exit 1
        fi
    fi

    # Verificar variáveis críticas
    source .env 2>/dev/null || true

    if [ -z "$POSTGRES_PASSWORD" ]; then
        log_warning "POSTGRES_PASSWORD não definida no .env"
    fi

    if [ -z "$REDIS_PASSWORD" ]; then
        log_warning "REDIS_PASSWORD não definida no .env"
    fi

    log_success "Arquivo .env validado"
}

# Função para inicializar serviços Docker
start_docker_services() {
    log "Iniciando serviços Docker..."

    # Parar serviços existentes
    docker-compose down 2>/dev/null || true

    # Limpar volumes antigos se necessário
    if [ "$1" = "--clean" ]; then
        log_warning "Removendo volumes existentes..."
        docker-compose down -v 2>/dev/null || true
        sudo rm -rf ./data/postgres/* 2>/dev/null || true
        sudo rm -rf ./data/chroma/* 2>/dev/null || true
        sudo rm -rf ./data/redis/* 2>/dev/null || true
    fi

    # Iniciar serviços
    log "Iniciando Docker Compose..."
    docker-compose up -d

    log_success "Serviços Docker iniciados"
}

# Função para aguardar serviços ficarem prontos
wait_for_services() {
    log "Aguardando serviços ficarem prontos..."

    # PostgreSQL
    log "Aguardando PostgreSQL..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U ai_user -d ai_incident_system &>/dev/null; then
            log_success "PostgreSQL está pronto"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Timeout aguardando PostgreSQL"
            exit 1
        fi
        sleep 2
    done

    # Redis
    log "Aguardando Redis..."
    for i in {1..30}; do
        if docker-compose exec -T redis redis-cli -a redis_secure_2025 ping &>/dev/null; then
            log_success "Redis está pronto"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Timeout aguardando Redis"
            exit 1
        fi
        sleep 2
    done

    # ChromaDB
    log "Aguardando ChromaDB..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/api/v1/heartbeat &>/dev/null; then
            log_success "ChromaDB está pronto"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Timeout aguardando ChromaDB"
            exit 1
        fi
        sleep 2
    done
}

# Função para executar health checks
run_health_checks() {
    log "Executando health checks..."

    # PostgreSQL Health Check
    if docker-compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT 1;" &>/dev/null; then
        log_success "PostgreSQL: Health check OK"
    else
        log_error "PostgreSQL: Health check FAILED"
    fi

    # Redis Health Check
    if docker-compose exec -T redis redis-cli -a redis_secure_2025 ping | grep -q PONG; then
        log_success "Redis: Health check OK"
    else
        log_error "Redis: Health check FAILED"
    fi

    # ChromaDB Health Check
    if curl -s http://localhost:8000/api/v1/heartbeat | grep -q "OK"; then
        log_success "ChromaDB: Health check OK"
    else
        log_error "ChromaDB: Health check FAILED"
    fi
}

# Função para exibir status dos serviços
show_service_status() {
    log "Status dos serviços:"
    echo ""
    docker-compose ps
    echo ""

    log "Endpoints disponíveis:"
    echo "  PostgreSQL: localhost:5432 (Database: ai_incident_system, User: ai_user)"
    echo "  Redis: localhost:6379 (Password: redis_secure_2025)"
    echo "  ChromaDB: http://localhost:8000"
    echo ""

    log "Logs dos serviços:"
    echo "  docker-compose logs postgres"
    echo "  docker-compose logs redis"
    echo "  docker-compose logs chromadb"
}

# Função para inicializar base de dados
initialize_database() {
    log "Inicializando base de dados..."

    # Verificar se init-db.sql existe
    if [ ! -f "scripts/init-db.sql" ]; then
        log_error "Arquivo scripts/init-db.sql não encontrado!"
        exit 1
    fi

    # O PostgreSQL automaticamente executa scripts em /docker-entrypoint-initdb.d/
    # Verificar se a inicialização foi bem-sucedida
    if docker-compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT COUNT(*) FROM incident_system.business_areas;" &>/dev/null; then
        log_success "Base de dados inicializada com sucesso"
    else
        log_warning "Base de dados pode não ter sido inicializada completamente"
    fi
}

# Função para backup
create_backup() {
    log "Criando backup da configuração atual..."

    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="./data/backups/$BACKUP_DATE"

    mkdir -p "$BACKUP_DIR"

    # Backup PostgreSQL
    docker-compose exec -T postgres pg_dump -U ai_user ai_incident_system > "$BACKUP_DIR/postgres_backup.sql" 2>/dev/null || log_warning "Backup PostgreSQL falhou"

    # Backup Redis
    docker-compose exec -T redis redis-cli -a redis_secure_2025 BGSAVE &>/dev/null || log_warning "Backup Redis falhou"

    # Backup configurações
    cp .env "$BACKUP_DIR/" 2>/dev/null || true
    cp docker-compose.yml "$BACKUP_DIR/" 2>/dev/null || true

    log_success "Backup criado em $BACKUP_DIR"
}

# Função para cleanup
cleanup() {
    log "Executando cleanup..."
    docker-compose down
    log_success "Cleanup concluído"
}

# Função principal
main() {
    echo "======================================================================="
    echo "           SISTEMA DE RESOLUÇÃO DE INCIDENTES COM IA v2.0"
    echo "                    Accenture Mainframe AI Assistant"
    echo "======================================================================="
    echo ""

    case "${1:-start}" in
        "start")
            create_directories
            check_dependencies
            validate_env
            start_docker_services
            wait_for_services
            initialize_database
            run_health_checks
            show_service_status
            log_success "Sistema iniciado com sucesso!"
            ;;
        "stop")
            cleanup
            ;;
        "restart")
            cleanup
            sleep 2
            main start
            ;;
        "clean-start")
            create_directories
            check_dependencies
            validate_env
            start_docker_services --clean
            wait_for_services
            initialize_database
            run_health_checks
            show_service_status
            log_success "Sistema iniciado com dados limpos!"
            ;;
        "status")
            show_service_status
            run_health_checks
            ;;
        "backup")
            create_backup
            ;;
        "logs")
            docker-compose logs -f
            ;;
        *)
            echo "Uso: $0 {start|stop|restart|clean-start|status|backup|logs}"
            echo ""
            echo "Comandos:"
            echo "  start       - Inicia todos os serviços"
            echo "  stop        - Para todos os serviços"
            echo "  restart     - Reinicia todos os serviços"
            echo "  clean-start - Inicia com dados limpos"
            echo "  status      - Mostra status dos serviços"
            echo "  backup      - Cria backup dos dados"
            echo "  logs        - Mostra logs em tempo real"
            exit 1
            ;;
    esac
}

# Trap para cleanup em caso de interrupção
trap cleanup INT TERM

# Executar função principal
main "$@"