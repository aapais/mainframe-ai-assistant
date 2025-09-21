#!/bin/bash

# Script para forçar instalação de dependências
# Tenta npm, yarn e pnpm em sequência até conseguir

set -e

echo "🚀 Iniciando instalação forçada de dependências..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para limpar cache e arquivos
cleanup() {
    echo -e "${YELLOW}🧹 Limpando arquivos existentes...${NC}"

    # Remove node_modules
    if [ -d "node_modules" ]; then
        echo "Removendo node_modules..."
        rm -rf node_modules
    fi

    # Remove lock files
    if [ -f "package-lock.json" ]; then
        echo "Removendo package-lock.json..."
        rm -f package-lock.json
    fi

    if [ -f "yarn.lock" ]; then
        echo "Removendo yarn.lock..."
        rm -f yarn.lock
    fi

    if [ -f "pnpm-lock.yaml" ]; then
        echo "Removendo pnpm-lock.yaml..."
        rm -f pnpm-lock.yaml
    fi

    # Limpa caches
    echo "Limpando caches..."
    npm cache clean --force 2>/dev/null || true
    yarn cache clean 2>/dev/null || true
    pnpm store prune 2>/dev/null || true
}

# Função para instalar dependências essenciais primeiro
install_essential() {
    local pkg_manager=$1
    echo -e "${YELLOW}📦 Instalando dependências essenciais com $pkg_manager...${NC}"

    case $pkg_manager in
        "npm")
            npm install react react-dom typescript @types/react @types/react-dom --save
            ;;
        "yarn")
            yarn add react react-dom typescript @types/react @types/react-dom
            ;;
        "pnpm")
            pnpm add react react-dom typescript @types/react @types/react-dom
            ;;
    esac
}

# Função para instalação completa
install_all() {
    local pkg_manager=$1
    echo -e "${YELLOW}📦 Instalação completa com $pkg_manager...${NC}"

    case $pkg_manager in
        "npm")
            npm install --legacy-peer-deps --no-audit --no-fund
            ;;
        "yarn")
            yarn install --ignore-engines
            ;;
        "pnpm")
            pnpm install --shamefully-hoist
            ;;
    esac
}

# Função principal de instalação
try_install() {
    local pkg_manager=$1
    echo -e "${GREEN}🔧 Tentando instalação com $pkg_manager...${NC}"

    # Verifica se o package manager está disponível
    if ! command -v $pkg_manager &> /dev/null; then
        echo -e "${RED}❌ $pkg_manager não encontrado${NC}"
        return 1
    fi

    # Limpa tudo antes de tentar
    cleanup

    # Tenta instalar essenciais primeiro
    if install_essential $pkg_manager; then
        echo -e "${GREEN}✅ Dependências essenciais instaladas${NC}"

        # Tenta instalação completa
        if install_all $pkg_manager; then
            echo -e "${GREEN}🎉 Instalação completa com $pkg_manager foi bem-sucedida!${NC}"
            return 0
        else
            echo -e "${RED}❌ Falha na instalação completa com $pkg_manager${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Falha na instalação essencial com $pkg_manager${NC}"
        return 1
    fi
}

# Função para verificar instalação
verify_install() {
    echo -e "${YELLOW}🔍 Verificando instalação...${NC}"

    if [ ! -d "node_modules" ]; then
        echo -e "${RED}❌ node_modules não encontrado${NC}"
        return 1
    fi

    if [ ! -f "node_modules/react/package.json" ]; then
        echo -e "${RED}❌ React não instalado corretamente${NC}"
        return 1
    fi

    echo -e "${GREEN}✅ Instalação verificada com sucesso${NC}"
    return 0
}

# Main execution
echo -e "${GREEN}🚀 Iniciando processo de instalação forçada...${NC}"

# Lista de package managers para tentar
PACKAGE_MANAGERS=("npm" "yarn" "pnpm")

for pm in "${PACKAGE_MANAGERS[@]}"; do
    echo -e "\n${YELLOW}=== Tentando com $pm ===${NC}"

    if try_install $pm; then
        if verify_install; then
            echo -e "\n${GREEN}🎉 SUCESSO! Dependências instaladas com $pm${NC}"

            # Mostra estatísticas
            echo -e "\n${YELLOW}📊 Estatísticas da instalação:${NC}"
            echo "Package Manager usado: $pm"
            echo "Tamanho do node_modules: $(du -sh node_modules 2>/dev/null | cut -f1 || echo 'N/A')"
            echo "Número de pacotes: $(find node_modules -name package.json 2>/dev/null | wc -l || echo 'N/A')"

            exit 0
        fi
    fi

    echo -e "${RED}❌ Falha com $pm, tentando próximo...${NC}"
done

echo -e "\n${RED}💥 ERRO: Todos os package managers falharam!${NC}"
echo -e "${YELLOW}📝 Sugestões:${NC}"
echo "1. Verifique sua conexão com a internet"
echo "2. Verifique se o package.json está válido"
echo "3. Tente instalar Node.js mais recente"
echo "4. Execute como administrador se necessário"

exit 1