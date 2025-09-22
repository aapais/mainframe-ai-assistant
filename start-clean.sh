#!/bin/bash

echo "🧹 Limpando processos anteriores..."
pkill -f "python3 scripts/real-db-server" 2>/dev/null || true
pkill -f "python3 -m http.server" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
pkill -f "electron" 2>/dev/null || true
sleep 2

echo "🚀 Iniciando backend da base de dados..."
python3 scripts/real-db-server.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "📱 Iniciando servidor frontend..."
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