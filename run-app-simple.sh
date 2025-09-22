#!/bin/bash

echo "🔧 Limpando processos anteriores..."
# Mata qualquer processo nas portas 3000 e 8089
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 8089/tcp 2>/dev/null || true
sleep 1

echo "🚀 Iniciando servidor backend..."
python3 scripts/real-db-server.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "📦 Iniciando servidor frontend..."
# Servidor simples Python para servir o HTML
python3 -m http.server 3000 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Aplicação iniciada com sucesso!"
echo "=================================="
echo "📱 Frontend: http://localhost:3000/Accenture-Mainframe-AI-Assistant-Integrated.html"
echo "🔌 Backend API: http://localhost:8089"
echo "=================================="
echo ""
echo "Pressione Ctrl+C para parar os servidores..."

# Aguarda término
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait