#!/bin/bash
# Script para corrigir automaticamente erros antes de fazer commit

echo "🔧 Corrigindo erros automaticamente antes do commit..."

# 1. Corrigir formatação com Prettier
echo "📝 Formatando código com Prettier..."
npx prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}" 2>/dev/null || true

# 2. Corrigir erros do ESLint
echo "🔍 Corrigindo erros do ESLint..."
npx eslint "src/**/*.{js,jsx,ts,tsx}" --fix 2>/dev/null || true

# 3. Adicionar alterações
echo "📦 Adicionando arquivos corrigidos..."
git add -A

# 4. Verificar se há alterações para commitar
if git diff --cached --quiet; then
    echo "❌ Nenhuma alteração para commitar"
    exit 0
fi

# 5. Fazer commit com mensagem fornecida ou padrão
if [ -z "$1" ]; then
    echo "💬 Digite a mensagem do commit (ou pressione Enter para mensagem padrão):"
    read -r commit_message
    if [ -z "$commit_message" ]; then
        commit_message="chore: auto-fix code formatting and linting issues"
    fi
else
    commit_message="$*"
fi

echo "🚀 Fazendo commit..."
git commit -m "$commit_message"

# 6. Perguntar se deseja fazer push
echo "📤 Deseja fazer push para o GitHub? (s/n)"
read -r push_answer
if [ "$push_answer" = "s" ] || [ "$push_answer" = "S" ]; then
    git push origin master
    echo "✅ Push concluído!"
else
    echo "⏸️  Push cancelado. Use 'git push' quando estiver pronto."
fi

echo "✨ Processo concluído!"