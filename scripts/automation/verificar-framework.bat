@echo off
echo 🔍 VERIFICAÇÃO COMPLETA DO FRAMEWORK CLAUDE FLOW
echo ================================================

cd /d "C:\mainframe-ai-assistant"

echo.
echo 📍 Diretório atual: %CD%
echo.

echo 🔍 VERIFICANDO INSTALAÇÕES:
echo ===========================

echo Verificando Node.js...
node --version || echo ❌ Node.js não encontrado!

echo Verificando NPM...
npm --version || echo ❌ NPM não encontrado!

echo Verificando Claude Code...
claude --version 2>nul || echo ⚠️ Claude Code não encontrado

echo Verificando Claude Flow...
npx claude-flow@alpha --version || echo ⚠️ Claude Flow não encontrado

echo.
echo 🧠 VERIFICANDO MEMÓRIA PERSISTENTE:
echo ===================================

echo Status da memória:
npx claude-flow@alpha memory stats

echo.
echo Últimas entradas na memória:
npx claude-flow@alpha memory query --recent --limit 5

echo.
echo 🔌 VERIFICANDO MCP SERVERS:
echo ===========================
claude mcp status

echo.
echo 📊 VERIFICANDO COORDENAÇÃO:
echo ===========================
npx claude-flow@alpha hive-mind status

echo.
echo ✅ VERIFICAÇÃO CONCLUÍDA!
pause
