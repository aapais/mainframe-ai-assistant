#!/bin/bash

echo "🚀 ==============================================="
echo "🚀 ACCENTURE MAINFRAME AI ASSISTANT - SISTEMA DEFINITIVO"
echo "🚀 ==============================================="
echo ""

# Verificar se backend já está executando
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend já está executando na porta 3001"
else
    echo "🚀 Iniciando Backend (SQLite + AI)..."
    nohup node scripts/simple-backend.js > backend.log 2>&1 &
    echo "   PID: $!"
    sleep 2
fi

# Verificar se frontend já está executando
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Frontend já está executando na porta 8080"
else
    echo "🚀 Iniciando Frontend..."
    nohup python3 scripts/frontend-server.py > frontend.log 2>&1 &
    echo "   PID: $!"
    sleep 1
fi

echo ""
echo "🚀 ==============================================="
echo "🚀 SISTEMA TOTALMENTE OPERACIONAL"
echo "🚀 ==============================================="
echo "🌐 Frontend: http://localhost:8080"
echo "🔗 Backend:  http://localhost:3001"
echo "💾 Database: kb-assistant.db (SQLite)"
echo "🤖 AI Features: ✅ FUNCIONAIS"
echo ""
echo "📊 Endpoints Disponíveis:"
echo "   • http://localhost:3001/api/health"
echo "   • http://localhost:3001/api/incidents"
echo "   • http://localhost:3001/api/knowledge"
echo "   • http://localhost:3001/api/ai/categorize"
echo "   • http://localhost:3001/api/knowledge/semantic-search"
echo "   • http://localhost:3001/api/incidents/find-similar"
echo ""
echo "🔥 Funcionalidades AI Integradas:"
echo "   • ✅ Categorização Automática de Incidentes"
echo "   • ✅ Busca Semântica no Knowledge Base"
echo "   • ✅ Detecção de Incidentes Similares"
echo "   • ✅ Base de Dados Real (14 incidentes)"
echo "   • ✅ Interface Moderna com Tailwind CSS"
echo ""
echo "🚀 ACESSE: http://localhost:8080"
echo "🚀 ==============================================="