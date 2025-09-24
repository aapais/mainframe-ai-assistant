#!/bin/bash

# Script para iniciar a aplicação sempre na porta 3000
# Mata processos existentes e liberta a porta antes de iniciar

echo "🧹 Limpando processos existentes..."

# Mata todos os processos node e vite
pkill -f node 2>/dev/null
pkill -f vite 2>/dev/null
pkill -f "npm start" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null

# Espera um pouco para os processos terminarem
sleep 2

# Força libertação das portas 3000-3004
for port in 3000 3001 3002 3003 3004; do
  lsof -ti:$port | xargs -r kill -9 2>/dev/null
done

# Limpa a cache do Vite
rm -rf node_modules/.vite 2>/dev/null

echo "✅ Processos limpos"
echo "🚀 Iniciando aplicação na porta 3000..."

# Inicia a aplicação
npm start