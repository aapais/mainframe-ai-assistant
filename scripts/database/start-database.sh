#!/bin/bash

# PostgreSQL with pgvector Setup - Quick Start Script
# This script helps you start and manage the PostgreSQL database with pgvector

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="../../docker-compose.yml"
PROJECT_NAME="mainframe-ai"

echo -e "${BLUE}🚀 PostgreSQL with pgvector Setup - Phase 6${NC}"
echo "=============================================="

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to check if docker-compose is available
check_compose() {
    if ! command -v docker-compose &> /dev/null; then
        if ! docker compose version &> /dev/null; then
            echo -e "${RED}❌ Docker Compose is not available. Please install Docker Compose.${NC}"
            exit 1
        else
            DOCKER_COMPOSE_CMD="docker compose"
        fi
    else
        DOCKER_COMPOSE_CMD="docker-compose"
    fi
    echo -e "${GREEN}✅ Docker Compose is available${NC}"
}

# Function to start PostgreSQL and Redis
start_database() {
    echo -e "\n${BLUE}📦 Starting PostgreSQL with pgvector and Redis...${NC}"

    cd "$(dirname "$0")"

    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE up -d postgres redis

    echo -e "${GREEN}✅ Database services started${NC}"

    # Wait for services to be healthy
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"

    # Wait for PostgreSQL
    echo -n "Waiting for PostgreSQL"
    until docker exec mainframe-ai-postgres pg_isready -U mainframe_user -d mainframe_ai > /dev/null 2>&1; do
        echo -n "."
        sleep 2
    done
    echo -e " ${GREEN}✅${NC}"

    # Wait for Redis
    echo -n "Waiting for Redis"
    until docker exec mainframe-ai-redis redis-cli ping > /dev/null 2>&1; do
        echo -n "."
        sleep 2
    done
    echo -e " ${GREEN}✅${NC}"
}

# Function to run migration
run_migration() {
    echo -e "\n${BLUE}📊 Running database migration...${NC}"

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}⚠️  Node.js not found. Skipping migration script.${NC}"
        echo -e "${YELLOW}   You can run it manually later with: node migrate-to-postgresql.js${NC}"
        return
    fi

    # Check if required packages are installed
    if [ ! -d "../../node_modules" ]; then
        echo -e "${YELLOW}⚠️  Node modules not found. Running npm install first...${NC}"
        cd ../..
        npm install
        cd scripts/database
    fi

    # Set environment variables for migration
    export DB_HOST=localhost
    export DB_PORT=5432
    export DB_NAME=mainframe_ai
    export DB_USER=mainframe_user
    export DB_PASSWORD=mainframe_pass

    # Run migration script
    if [ -n "$OPENAI_API_KEY" ]; then
        echo -e "${GREEN}✅ OpenAI API key found - embeddings will be generated${NC}"
        node migrate-to-postgresql.js
    else
        echo -e "${YELLOW}⚠️  No OpenAI API key found - sample data will be created without embeddings${NC}"
        node migrate-to-postgresql.js
    fi
}

# Function to test the setup
test_setup() {
    echo -e "\n${BLUE}🧪 Testing database setup...${NC}"

    # Test PostgreSQL connection
    echo -n "Testing PostgreSQL connection"
    if docker exec mainframe-ai-postgres psql -U mainframe_user -d mainframe_ai -c "SELECT version();" > /dev/null 2>&1; then
        echo -e " ${GREEN}✅${NC}"
    else
        echo -e " ${RED}❌${NC}"
        return 1
    fi

    # Test pgvector extension
    echo -n "Testing pgvector extension"
    if docker exec mainframe-ai-postgres psql -U mainframe_user -d mainframe_ai -c "SELECT extname FROM pg_extension WHERE extname = 'vector';" | grep -q vector; then
        echo -e " ${GREEN}✅${NC}"
    else
        echo -e " ${RED}❌${NC}"
        return 1
    fi

    # Test sample data
    echo -n "Testing sample data"
    INCIDENT_COUNT=$(docker exec mainframe-ai-postgres psql -U mainframe_user -d mainframe_ai -t -c "SELECT COUNT(*) FROM incidents_enhanced;" | tr -d ' ')
    if [ "$INCIDENT_COUNT" -gt 0 ]; then
        echo -e " ${GREEN}✅ (${INCIDENT_COUNT} incidents)${NC}"
    else
        echo -e " ${YELLOW}⚠️  (No incidents found)${NC}"
    fi

    # Test Redis connection
    echo -n "Testing Redis connection"
    if docker exec mainframe-ai-redis redis-cli ping | grep -q PONG; then
        echo -e " ${GREEN}✅${NC}"
    else
        echo -e " ${RED}❌${NC}"
        return 1
    fi
}

# Function to show connection info
show_connection_info() {
    echo -e "\n${BLUE}📋 Connection Information${NC}"
    echo "=========================="
    echo -e "${GREEN}PostgreSQL:${NC}"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: mainframe_ai"
    echo "  Username: mainframe_user"
    echo "  Password: mainframe_pass"
    echo ""
    echo -e "${GREEN}Redis:${NC}"
    echo "  Host: localhost"
    echo "  Port: 6379"
    echo "  Password: redis_pass"
    echo ""
    echo -e "${GREEN}Management Tools:${NC}"
    echo "  pgAdmin: docker-compose --profile admin up -d"
    echo "           Then visit: http://localhost:5050"
    echo ""
    echo -e "${GREEN}Direct Database Access:${NC}"
    echo "  docker exec -it mainframe-ai-postgres psql -U mainframe_user -d mainframe_ai"
    echo ""
    echo -e "${GREEN}Sample Vector Search Query:${NC}"
    echo "  SELECT * FROM search_similar_incidents("
    echo "    '[0.1,0.2,0.3,...]'::vector,"
    echo "    'CICS timeout',"
    echo "    5,"
    echo "    0.7"
    echo "  );"
}

# Function to stop services
stop_database() {
    echo -e "\n${BLUE}🛑 Stopping database services...${NC}"
    cd "$(dirname "$0")"
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE down
    echo -e "${GREEN}✅ Services stopped${NC}"
}

# Function to show logs
show_logs() {
    echo -e "\n${BLUE}📋 Showing database logs...${NC}"
    cd "$(dirname "$0")"
    $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f postgres redis
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start PostgreSQL and Redis services"
    echo "  stop      Stop all services"
    echo "  test      Test database connectivity and setup"
    echo "  migrate   Run database migration script"
    echo "  logs      Show service logs"
    echo "  info      Show connection information"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start          # Start database services"
    echo "  $0 test           # Test the setup"
    echo "  $0 info           # Show connection details"
    echo "  $0 stop           # Stop services"
}

# Main script logic
case "${1:-start}" in
    start)
        check_docker
        check_compose
        start_database
        test_setup
        show_connection_info
        ;;
    stop)
        check_docker
        check_compose
        stop_database
        ;;
    test)
        test_setup
        ;;
    migrate)
        run_migration
        ;;
    logs)
        check_compose
        show_logs
        ;;
    info)
        show_connection_info
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac

echo -e "\n${GREEN}🎉 Phase 6 PostgreSQL with pgvector setup complete!${NC}"