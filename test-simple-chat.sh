#!/bin/bash

echo "🔐 Fazendo login..."
TOKEN=$(curl -X POST http://localhost:3001/api/auth/windows/login \
  -H "Content-Type: application/json" \
  -s | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

echo "Token obtido: ${TOKEN:0:50}..."

echo -e "\n💬 Testando endpoint /api/chat/simple..."
curl -X POST http://localhost:3001/api/chat/simple \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá, teste do chat!"}' \
  -s | python3 -m json.tool