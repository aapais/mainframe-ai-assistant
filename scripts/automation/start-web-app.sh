#!/bin/bash

echo "🚀 Iniciando Sistema de Gestão de Incidentes com IA"
echo "=================================================="

# Kill any existing processes on our ports
echo "🔧 Limpando portas antigas..."
pkill -f "http.server 8080" 2>/dev/null
pkill -f "simple-backend.js" 2>/dev/null
sleep 2

# Start backend API
echo "📡 Iniciando Backend (API REST)..."
cd /mnt/c/mainframe-ai-assistant
node scripts/simple-backend.js &
BACKEND_PID=$!
echo "   ✅ Backend rodando na porta 3001"

# Wait for backend to start
sleep 3

# Start frontend server
echo "🌐 Iniciando Frontend (Interface Web)..."
python3 -m http.server 8080 &
FRONTEND_PID=$!
echo "   ✅ Frontend rodando na porta 8080"

echo ""
echo "=================================================="
echo "✨ APLICAÇÃO PRONTA!"
echo "=================================================="
echo ""
echo "📌 Acesse a aplicação em:"
echo "   🔗 http://localhost:8080/Accenture-Mainframe-AI-Assistant-Integrated.html"
echo ""
echo "📋 Funcionalidades Disponíveis:"
echo "   ✅ Gestão de Incidentes"
echo "   ✅ Campos technical_area e business_area"
echo "   ✅ Integração com IA (configure API keys no Settings)"
echo "   ✅ Validação de dados enriquecidos"
echo "   ✅ Base de conhecimento"
echo "   ✅ Painel de resolução com IA"
echo ""
echo "🔑 Para usar IA, configure no menu Settings (⚙️):"
echo "   - Provider: Gemini, OpenAI ou Azure"
echo "   - API Key: Sua chave de API"
echo ""
echo "⚠️  Para parar os serviços, pressione Ctrl+C"
echo ""

# Keep script running
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '🛑 Serviços parados'; exit" INT
wait