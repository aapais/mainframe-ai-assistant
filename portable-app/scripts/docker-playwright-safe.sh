#!/bin/bash
# Safe Docker Playwright Setup - Evita conflitos de permissão

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🎭 Playwright MCP Docker Setup (Safe Mode)${NC}"

# Função para cleanup seguro
cleanup() {
    echo -e "${YELLOW}🧹 Limpando processos antigos...${NC}"
    
    # Para processos playwright locais sem forçar
    pkill -f playwright-mcp-server 2>/dev/null || true
    
    # Se tiver permissão Docker, limpa containers
    if docker info >/dev/null 2>&1; then
        docker stop playwright-mcp 2>/dev/null || true
        docker rm playwright-mcp 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠️  Docker requer sudo. Pulando limpeza de containers.${NC}"
    fi
    
    sleep 2
}

# Função para verificar Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker não instalado${NC}"
        return 1
    fi
    
    # Testa com sudo se necessário
    if docker info >/dev/null 2>&1; then
        DOCKER_CMD="docker"
    elif sudo docker info >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
        echo -e "${YELLOW}🔐 Usando sudo para Docker${NC}"
    else
        echo -e "${RED}❌ Docker não acessível${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Docker disponível${NC}"
    return 0
}

# Menu de opções
echo -e "\n${YELLOW}Escolha o modo de execução:${NC}"
echo "1) Docker com isolamento completo (recomendado)"
echo "2) Docker com modo usuário"
echo "3) Local sem Docker (fallback)"
echo "4) Limpar tudo e sair"
read -p "Opção [1-4]: " choice

case $choice in
    1)
        echo -e "${GREEN}🚀 Modo Docker Isolado${NC}"
        cleanup
        
        if ! check_docker; then
            echo -e "${RED}Falha ao verificar Docker${NC}"
            exit 1
        fi
        
        # Cria Dockerfile temporário
        cat > /tmp/Dockerfile.playwright <<EOF
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Instala MCP server
RUN npm install -g @executeautomation/playwright-mcp-server

# Cria usuário não-root
RUN useradd -m -s /bin/bash playwright && \
    mkdir -p /app/downloads && \
    chown -R playwright:playwright /app

USER playwright

# Configura browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["playwright-mcp-server"]
EOF
        
        echo -e "${YELLOW}🔨 Construindo imagem...${NC}"
        $DOCKER_CMD build -t playwright-mcp:safe -f /tmp/Dockerfile.playwright .
        
        echo -e "${GREEN}🎯 Iniciando container...${NC}"
        $DOCKER_CMD run -d \
            --name playwright-mcp \
            --restart unless-stopped \
            -p 3000:3000 \
            --shm-size=2gb \
            --cap-drop ALL \
            --security-opt no-new-privileges \
            playwright-mcp:safe
        
        echo -e "${GREEN}✅ Container iniciado com sucesso${NC}"
        ;;
        
    2)
        echo -e "${GREEN}🚀 Modo Docker Usuário${NC}"
        cleanup
        
        if ! check_docker; then
            echo -e "${RED}Falha ao verificar Docker${NC}"
            exit 1
        fi
        
        echo -e "${YELLOW}🎯 Iniciando com usuário atual...${NC}"
        $DOCKER_CMD run -d \
            --name playwright-mcp \
            --user $(id -u):$(id -g) \
            -p 3000:3000 \
            --shm-size=2gb \
            mcr.microsoft.com/playwright:v1.48.0-jammy \
            npx -y @executeautomation/playwright-mcp-server
        
        echo -e "${GREEN}✅ Container iniciado${NC}"
        ;;
        
    3)
        echo -e "${GREEN}🚀 Modo Local (sem Docker)${NC}"
        cleanup
        
        echo -e "${YELLOW}📦 Instalando localmente...${NC}"
        npm install -g @executeautomation/playwright-mcp-server
        
        echo -e "${YELLOW}🎭 Instalando browsers...${NC}"
        npx playwright install chromium
        
        echo -e "${GREEN}🎯 Iniciando servidor local...${NC}"
        nohup playwright-mcp-server > /tmp/playwright-mcp.log 2>&1 &
        
        echo -e "${GREEN}✅ Servidor local iniciado (PID: $!)${NC}"
        echo -e "${YELLOW}📝 Logs em: /tmp/playwright-mcp.log${NC}"
        ;;
        
    4)
        echo -e "${YELLOW}🧹 Limpando...${NC}"
        cleanup
        echo -e "${GREEN}✅ Limpeza completa${NC}"
        exit 0
        ;;
        
    *)
        echo -e "${RED}❌ Opção inválida${NC}"
        exit 1
        ;;
esac

# Verifica status
echo -e "\n${YELLOW}📊 Status:${NC}"
if [[ "$choice" != "3" ]]; then
    $DOCKER_CMD ps | grep playwright-mcp || echo "Container não está rodando"
else
    ps aux | grep playwright-mcp-server | grep -v grep || echo "Processo não encontrado"
fi

echo -e "\n${GREEN}✅ Setup completo!${NC}"
echo -e "${YELLOW}💡 Para parar: ./scripts/docker-playwright-safe.sh e escolha opção 4${NC}"