#!/bin/bash
# Wrapper script para evitar erro EPERM do Claude Code

set -e

# Função para capturar sinais sem causar EPERM
trap 'echo "Recebido sinal de término"; exit 0' SIGTERM SIGINT

# Diretório de trabalho
WORKDIR="/mnt/c/mainframe-ai-assistant"
cd "$WORKDIR"

# Função para executar com timeout suave
run_with_timeout() {
    timeout --preserve-status --foreground 300 "$@" || {
        code=$?
        if [ $code -eq 124 ]; then
            echo "Timeout alcançado (5 min)"
        fi
        return $code
    }
}

# Opções de execução
case "${1:-docker}" in
    docker)
        echo "🚀 Iniciando Playwright via Docker Compose..."
        
        # Para containers antigos suavemente
        docker-compose -f docker-compose.playwright.yml down --timeout 10 2>/dev/null || true
        
        # Inicia novo container
        run_with_timeout docker-compose -f docker-compose.playwright.yml up -d
        
        # Aguarda container ficar saudável
        echo "⏳ Aguardando container..."
        for i in {1..30}; do
            if docker-compose -f docker-compose.playwright.yml ps | grep -q "healthy"; then
                echo "✅ Container saudável!"
                break
            fi
            sleep 2
        done
        
        # Mostra logs
        docker-compose -f docker-compose.playwright.yml logs --tail=20
        ;;
        
    local)
        echo "💻 Iniciando Playwright localmente..."
        
        # Mata processos antigos suavemente
        pkill -TERM -f playwright-mcp-server 2>/dev/null || true
        sleep 2
        
        # Instala se necessário
        if ! command -v playwright-mcp-server &> /dev/null; then
            echo "📦 Instalando Playwright MCP Server..."
            npm install -g @executeautomation/playwright-mcp-server
        fi
        
        # Inicia em background com nohup
        nohup playwright-mcp-server > /tmp/playwright-mcp.log 2>&1 &
        PID=$!
        echo "PID: $PID" > /tmp/playwright-mcp.pid
        
        echo "✅ Servidor iniciado (PID: $PID)"
        echo "📝 Logs: tail -f /tmp/playwright-mcp.log"
        ;;
        
    stop)
        echo "🚮 Parando Playwright..."
        
        # Para Docker
        if [ -f docker-compose.playwright.yml ]; then
            docker-compose -f docker-compose.playwright.yml down --timeout 10 2>/dev/null || true
        fi
        
        # Para processo local
        if [ -f /tmp/playwright-mcp.pid ]; then
            PID=$(cat /tmp/playwright-mcp.pid)
            kill -TERM "$PID" 2>/dev/null || true
            rm -f /tmp/playwright-mcp.pid
        fi
        
        # Limpa processos órfãos
        pkill -TERM -f playwright-mcp-server 2>/dev/null || true
        
        echo "✅ Playwright parado"
        ;;
        
    status)
        echo "📊 Status do Playwright:"
        echo ""
        echo "Docker:"
        docker-compose -f docker-compose.playwright.yml ps 2>/dev/null || echo "  Não rodando"
        echo ""
        echo "Local:"
        if [ -f /tmp/playwright-mcp.pid ]; then
            PID=$(cat /tmp/playwright-mcp.pid)
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "  Rodando (PID: $PID)"
            else
                echo "  PID arquivo existe mas processo morto"
            fi
        else
            echo "  Não rodando"
        fi
        ;;
        
    *)
        echo "Uso: $0 {docker|local|stop|status}"
        echo ""
        echo "  docker  - Executa via Docker Compose (recomendado)"
        echo "  local   - Executa localmente"
        echo "  stop    - Para todos os serviços"
        echo "  status  - Mostra status"
        exit 1
        ;;
esac

# Evita que o script termine abruptamente
exit 0