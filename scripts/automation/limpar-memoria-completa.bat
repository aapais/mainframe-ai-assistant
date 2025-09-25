@echo off
echo 🧹 LIMPEZA COMPLETA DA MEMÓRIA CLAUDE FLOW
echo ==========================================

cd /d "C:\mainframe-ai-assistant"

echo.
echo ⚠️ AVISO: Esta operação irá limpar TODA a memória persistente!
echo Será criado um backup antes da limpeza.
echo.
set /p CONFIRM="Deseja continuar? (S/N): "
if /i not "%CONFIRM%"=="S" (
    echo Operação cancelada.
    pause
    exit /b
)

echo.
echo 💾 CRIANDO BACKUP DA MEMÓRIA...
echo ================================
mkdir backups_memoria_pre_limpeza 2>nul
if exist .swarm\memory.db (
    copy .swarm\memory.db "backups_memoria_pre_limpeza\memory_backup_%DATE%_%TIME::=%.db"
    echo ✅ Backup da memória criado
)
if exist .hive-mind\memory.db (
    copy .hive-mind\memory.db "backups_memoria_pre_limpeza\hive_memory_backup_%DATE%_%TIME::=%.db"
    echo ✅ Backup da hive-mind criado
)

echo.
echo 🔄 PARANDO PROCESSOS CLAUDE FLOW...
echo ===================================
taskkill /f /im node.exe /fi "WINDOWTITLE eq *claude-flow*" 2>nul
timeout /t 2 /nobreak >nul

echo.
echo 🗑️ LIMPEZA DOS ARQUIVOS DE MEMÓRIA...
echo ====================================

REM Limpar arquivos de memória SQLite
if exist .swarm\memory.db del /f .swarm\memory.db
if exist .swarm\memory.db-wal del /f .swarm\memory.db-wal  
if exist .swarm\memory.db-shm del /f .swarm\memory.db-shm

REM Limpar sessões antigas
if exist .swarm\sessions rmdir /s /q .swarm\sessions
mkdir .swarm\sessions 2>nul

REM Limpar hive-mind
if exist .hive-mind\memory.db del /f .hive-mind\memory.db
if exist .hive-mind\hive.db del /f .hive-mind\hive.db
if exist .hive-mind\sessions rmdir /s /q .hive-mind\sessions
mkdir .hive-mind\sessions 2>nul

REM Limpar logs antigos
if exist .hive-mind\logs rmdir /s /q .hive-mind\logs
mkdir .hive-mind\logs 2>nul

echo ✅ Arquivos de memória removidos

echo.
echo 🔄 REINICIALIZANDO SISTEMA...
echo =============================
npx claude-flow@alpha init --force --reset-memory --hive-mind --neural-enhanced --project-name "mainframe-ai-assistant"

echo.
echo 🔧 RECONFIGURANDO MCP SERVERS...
echo ================================
npx claude-flow@alpha mcp setup --auto-permissions --87-tools

echo.
echo 🕷️ CONFIGURANDO PUPPETEER...
echo =============================
claude mcp add puppeteer -- npx puppeteer-mcp-claude serve

echo.
echo 🧪 TESTANDO CONFIGURAÇÃO...
echo ===========================
npx claude-flow@alpha memory stats
npx claude-flow@alpha hive-mind test --agents 3 --coordination-test

echo.
echo ✅ LIMPEZA E RECONFIGURAÇÃO COMPLETAS!
echo ======================================
echo.
echo 📊 Status final:
claude mcp status
echo.
echo 💡 Agora execute: verificar-framework.bat para confirmar tudo
pause
