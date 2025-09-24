#!/bin/bash

# =======================================================================
# CORREÇÃO DE PERMISSÕES DOCKER
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
echo "              CORREÇÃO DE PERMISSÕES DOCKER"
echo "======================================================================="
echo ""

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    log_error "Docker não está instalado!"
    exit 1
fi

log_success "Docker está instalado"

# Verificar se Docker daemon está rodando
if ! docker info &> /dev/null; then
    log_warning "Docker daemon não está rodando ou sem permissões"

    # Tentar iniciar Docker daemon
    log "Tentando iniciar Docker daemon..."

    if command -v systemctl &> /dev/null; then
        sudo systemctl start docker || log_error "Falha ao iniciar Docker via systemctl"
        sudo systemctl enable docker || log_warning "Falha ao habilitar Docker no boot"
    elif command -v service &> /dev/null; then
        sudo service docker start || log_error "Falha ao iniciar Docker via service"
    else
        log_error "Não foi possível iniciar Docker daemon automaticamente"
    fi
fi

# Verificar se usuário está no grupo docker
if ! groups $USER | grep -q docker; then
    log_warning "Usuário $USER não está no grupo docker"

    # Adicionar usuário ao grupo docker
    log "Adicionando usuário $USER ao grupo docker..."
    sudo usermod -aG docker $USER

    log_success "Usuário adicionado ao grupo docker"
    log_warning "IMPORTANTE: É necessário fazer logout/login ou reiniciar para aplicar as mudanças"

    # Verificar se newgrp está disponível para aplicar mudanças imediatamente
    if command -v newgrp &> /dev/null; then
        log "Tentando aplicar mudanças de grupo imediatamente..."
        newgrp docker << EOF
        docker info &> /dev/null && echo "✅ Permissões Docker funcionando" || echo "❌ Ainda sem permissões"
EOF
    fi
else
    log_success "Usuário já está no grupo docker"
fi

# Verificar permissões do socket Docker
DOCKER_SOCK="/var/run/docker.sock"
if [ -e "$DOCKER_SOCK" ]; then
    SOCK_OWNER=$(stat -c "%U" $DOCKER_SOCK)
    SOCK_GROUP=$(stat -c "%G" $DOCKER_SOCK)
    SOCK_PERMS=$(stat -c "%a" $DOCKER_SOCK)

    log "Socket Docker: $DOCKER_SOCK"
    log "Owner: $SOCK_OWNER, Group: $SOCK_GROUP, Permissions: $SOCK_PERMS"

    if [ "$SOCK_GROUP" = "docker" ] && [ "$SOCK_PERMS" -ge 660 ]; then
        log_success "Permissões do socket Docker estão corretas"
    else
        log_warning "Permissões do socket Docker podem estar incorretas"

        # Tentar corrigir permissões
        log "Tentando corrigir permissões do socket..."
        sudo chgrp docker $DOCKER_SOCK || log_error "Falha ao mudar grupo do socket"
        sudo chmod 664 $DOCKER_SOCK || log_error "Falha ao mudar permissões do socket"
    fi
else
    log_error "Socket Docker não encontrado em $DOCKER_SOCK"
fi

# Teste final
log "Testando acesso Docker..."
if docker info &> /dev/null; then
    log_success "✅ Docker está funcionando corretamente!"

    # Mostrar informações do Docker
    echo ""
    log "Informações do Docker:"
    docker version --format "  Client Version: {{.Client.Version}}"
    docker version --format "  Server Version: {{.Server.Version}}"

else
    log_error "❌ Docker ainda não está funcionando"
    echo ""
    log "Possíveis soluções:"
    echo "  1. Fazer logout/login ou reiniciar o sistema"
    echo "  2. Executar: sudo systemctl restart docker"
    echo "  3. Verificar se o Docker daemon está rodando"
    echo "  4. Executar com sudo temporariamente: sudo docker info"
    echo ""

    # Tentar com sudo como teste
    log "Testando com sudo..."
    if sudo docker info &> /dev/null; then
        log_warning "Docker funciona com sudo - problema de permissões de usuário"
    else
        log_error "Docker não funciona nem com sudo - problema no daemon"
    fi
fi

echo ""
echo "======================================================================="
echo "                        CORREÇÃO CONCLUÍDA"
echo "======================================================================="