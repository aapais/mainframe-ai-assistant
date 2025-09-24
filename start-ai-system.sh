#!/bin/bash

# AI Incident Resolution System - Unified Startup Script
# Accenture Mainframe AI Assistant v2.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="AI Incident Resolution System"
VERSION="2.0.0"
DOCKER_COMPOSE_FILE="docker compose.yml"
ENV_FILE=".env"
LOG_DIR="./logs"
DATA_DIR="./data"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║             AI Incident Resolution System v2.0              ║"
    echo "║                   Accenture Implementation                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed. Please install Python 3 first."
        exit 1
    fi

    log_success "All prerequisites are installed"
}

setup_directories() {
    log_info "Setting up directories..."

    # Create directories if they don't exist
    mkdir -p "$LOG_DIR"
    mkdir -p "$DATA_DIR/chroma"
    mkdir -p "$DATA_DIR/postgres"
    mkdir -p "$DATA_DIR/redis"
    mkdir -p "backups"
    mkdir -p "temp"

    # Set permissions
    chmod 755 "$LOG_DIR"
    chmod 755 "$DATA_DIR"

    log_success "Directories created and configured"
}

check_environment() {
    log_info "Checking environment configuration..."

    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning ".env file not found. Creating from template..."
        if [[ -f ".env.example" ]]; then
            cp ".env.example" "$ENV_FILE"
            log_info "Please configure your .env file with appropriate values"
        else
            log_error ".env.example file not found"
            exit 1
        fi
    fi

    log_success "Environment configuration checked"
}

start_infrastructure() {
    log_info "Starting infrastructure services..."

    # Stop any existing services
    docker compose down --remove-orphans > /dev/null 2>&1 || true

    # Start infrastructure services
    docker compose up -d

    log_success "Infrastructure services started"
}

wait_for_services() {
    log_info "Waiting for services to be ready..."

    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    until docker compose exec -T postgres pg_isready -U ai_user -d ai_incident_system > /dev/null 2>&1; do
        sleep 2
    done
    log_success "PostgreSQL is ready"

    # Wait for Redis
    log_info "Waiting for Redis..."
    until docker compose exec -T redis redis-cli -a redis_secure_2025 ping > /dev/null 2>&1; do
        sleep 2
    done
    log_success "Redis is ready"

    # Wait for ChromaDB
    log_info "Waiting for ChromaDB..."
    until curl -f http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; do
        sleep 2
    done
    log_success "ChromaDB is ready"
}

initialize_database() {
    log_info "Initializing database..."

    # Check if database is already initialized
    if docker compose exec -T postgres psql -U ai_user -d ai_incident_system -c "SELECT 1 FROM information_schema.tables WHERE table_name = 'incidents'" > /dev/null 2>&1; then
        log_info "Database already initialized"
    else
        log_info "Running database initialization script..."
        docker compose exec -T postgres psql -U ai_user -d ai_incident_system -f /docker-entrypoint-initdb.d/init-db.sql
        log_success "Database initialized"
    fi
}

start_application() {
    log_info "Starting application services..."

    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing Node.js dependencies..."
        npm install
    fi

    # Start the main application in background
    log_info "Starting backend API server..."
    nohup node src/api/server.js > "$LOG_DIR/api-server.log" 2>&1 &
    echo $! > "$LOG_DIR/api-server.pid"

    # Start the frontend server
    log_info "Starting frontend server..."
    nohup python3 scripts/integrated-server.py > "$LOG_DIR/frontend-server.log" 2>&1 &
    echo $! > "$LOG_DIR/frontend-server.pid"

    sleep 5

    log_success "Application services started"
}

run_health_checks() {
    log_info "Running health checks..."

    # Check API health
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        log_success "API server is healthy"
    else
        log_warning "API server health check failed"
    fi

    # Check frontend
    if curl -f http://localhost:8091 > /dev/null 2>&1; then
        log_success "Frontend server is healthy"
    else
        log_warning "Frontend server health check failed"
    fi

    # Check ChromaDB
    if curl -f http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
        log_success "ChromaDB is healthy"
    else
        log_warning "ChromaDB health check failed"
    fi
}

show_status() {
    echo
    log_info "System Status:"
    echo "----------------------------------------"

    # Docker services
    echo "Infrastructure Services:"
    docker compose ps
    echo

    # Application processes
    echo "Application Services:"
    if [[ -f "$LOG_DIR/api-server.pid" ]] && kill -0 $(cat "$LOG_DIR/api-server.pid") 2>/dev/null; then
        echo "  ✓ API Server: Running (PID: $(cat "$LOG_DIR/api-server.pid"))"
    else
        echo "  ✗ API Server: Not Running"
    fi

    if [[ -f "$LOG_DIR/frontend-server.pid" ]] && kill -0 $(cat "$LOG_DIR/frontend-server.pid") 2>/dev/null; then
        echo "  ✓ Frontend Server: Running (PID: $(cat "$LOG_DIR/frontend-server.pid"))"
    else
        echo "  ✗ Frontend Server: Not Running"
    fi

    echo
    echo "Access URLs:"
    echo "  • Frontend:    http://localhost:8091"
    echo "  • API:         http://localhost:3001"
    echo "  • ChromaDB:    http://localhost:8000"
    echo "  • PostgreSQL:  localhost:5432"
    echo "  • Redis:       localhost:6379"
    echo
}

stop_services() {
    log_info "Stopping all services..."

    # Stop application processes
    if [[ -f "$LOG_DIR/api-server.pid" ]]; then
        kill $(cat "$LOG_DIR/api-server.pid") 2>/dev/null || true
        rm -f "$LOG_DIR/api-server.pid"
    fi

    if [[ -f "$LOG_DIR/frontend-server.pid" ]]; then
        kill $(cat "$LOG_DIR/frontend-server.pid") 2>/dev/null || true
        rm -f "$LOG_DIR/frontend-server.pid"
    fi

    # Stop Docker services
    docker compose down

    log_success "All services stopped"
}

restart_services() {
    log_info "Restarting all services..."
    stop_services
    sleep 3
    start_system
}

clean_start() {
    log_info "Performing clean start..."
    stop_services

    # Clean up data (optional)
    log_warning "This will remove all data. Continue? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        docker compose down -v
        rm -rf "$DATA_DIR"
        log_info "Data cleaned"
    fi

    start_system
}

backup_data() {
    log_info "Creating backup..."

    BACKUP_FILE="backups/ai-system-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

    # Create backup
    tar -czf "$BACKUP_FILE" \
        --exclude='node_modules' \
        --exclude='logs/*.log' \
        --exclude='temp/*' \
        data/ src/ scripts/ docs/ *.json *.yml *.md .env 2>/dev/null || true

    log_success "Backup created: $BACKUP_FILE"
}

show_logs() {
    echo "Available logs:"
    echo "1. API Server"
    echo "2. Frontend Server"
    echo "3. PostgreSQL"
    echo "4. Redis"
    echo "5. ChromaDB"
    echo "6. Docker Compose"
    echo "Choose (1-6): "
    read -r choice

    case $choice in
        1) tail -f "$LOG_DIR/api-server.log" ;;
        2) tail -f "$LOG_DIR/frontend-server.log" ;;
        3) docker compose logs -f postgres ;;
        4) docker compose logs -f redis ;;
        5) docker compose logs -f chromadb ;;
        6) docker compose logs -f ;;
        *) log_error "Invalid choice" ;;
    esac
}

start_system() {
    print_header
    check_prerequisites
    setup_directories
    check_environment
    start_infrastructure
    wait_for_services
    initialize_database
    start_application
    run_health_checks
    show_status

    log_success "AI Incident Resolution System started successfully!"
    log_info "System is ready for use."
}

# Main script logic
case "${1:-start}" in
    "start")
        start_system
        ;;
    "stop")
        print_header
        stop_services
        ;;
    "restart")
        print_header
        restart_services
        ;;
    "status")
        print_header
        show_status
        ;;
    "clean-start")
        print_header
        clean_start
        ;;
    "backup")
        print_header
        backup_data
        ;;
    "logs")
        print_header
        show_logs
        ;;
    "health")
        print_header
        run_health_checks
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|clean-start|backup|logs|health}"
        echo ""
        echo "Commands:"
        echo "  start       - Start all services"
        echo "  stop        - Stop all services"
        echo "  restart     - Restart all services"
        echo "  status      - Show system status"
        echo "  clean-start - Clean data and start fresh"
        echo "  backup      - Create system backup"
        echo "  logs        - View service logs"
        echo "  health      - Run health checks"
        exit 1
        ;;
esac