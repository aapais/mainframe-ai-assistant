@echo off
REM Script para corrigir automaticamente TODOS os erros antes de fazer commit (Windows)
setlocal enabledelayedexpansion

echo 🔧 Corrigindo erros automaticamente antes do commit...

REM 0. Verificar e corrigir configurações de build
echo 🏗️ Verificando configuração de build...
findstr /C:"\"build\": \"electron-builder\"" package.json >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo   ➡️ Atualizando script de build para desabilitar publicação...
    powershell -Command "(Get-Content package.json) -replace '\"build\": \"electron-builder\"', '\"build\": \"electron-builder --publish=never\"' | Set-Content package.json"
)

REM Garantir que publish está configurado como null
findstr /C:"\"publish\": null" package.json >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   ➡️ Adicionando publish: null ao build config...
    powershell -Command "(Get-Content package.json) -replace '\"build\": \{', '\"build\": \{`n    \"publish\": null,' | Set-Content package.json"
)

REM 1. Corrigir formatação com Prettier
echo 📝 Formatando código com Prettier...
call npx prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}" 2>nul

REM 2. Corrigir erros do ESLint
echo 🔍 Corrigindo erros do ESLint...
call npx eslint "src/**/*.{js,jsx,ts,tsx}" --fix 2>nul

REM 3. Adicionar alterações
echo 📦 Adicionando arquivos corrigidos...
git add -A

REM 4. Verificar se há alterações
git diff --cached --quiet
if %ERRORLEVEL% == 0 (
    echo ❌ Nenhuma alteração para commitar
    exit /b 0
)

REM 5. Fazer commit com mensagem
if "%~1"=="" (
    set /p commit_message="💬 Digite a mensagem do commit: "
    if "!commit_message!"=="" set commit_message=chore: auto-fix code formatting and linting issues
) else (
    set commit_message=%*
)

echo 🚀 Fazendo commit...
git commit -m "%commit_message%"

REM 6. Perguntar sobre push
set /p push_answer="📤 Deseja fazer push para o GitHub? (s/n): "
if /i "%push_answer%"=="s" (
    git push origin master
    echo ✅ Push concluído!
) else (
    echo ⏸️ Push cancelado. Use 'git push' quando estiver pronto.
)

echo ✨ Processo concluído!