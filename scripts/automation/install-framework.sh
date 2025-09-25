#!/bin/bash
echo "🌊 Instalando Claude Flow Framework..."

# Instalar Claude Flow Alpha
npm install -g claude-flow@alpha

# Verificar instalação
npx claude-flow@alpha --version

# Inicializar projeto
PROJECT_NAME=$(basename "$PWD")
npx claude-flow@alpha init --force --hive-mind --neural-enhanced --project-name "$PROJECT_NAME"

# Configurar MCP servers
npx claude-flow@alpha mcp setup --auto-permissions --87-tools

# Configurar Puppeteer se não estiver
claude mcp add puppeteer -- npx puppeteer-mcp-claude serve

# Testar sistema
npx claude-flow@alpha hive-mind test --agents 3 --coordination-test

echo "✅ Framework instalado com sucesso!"
