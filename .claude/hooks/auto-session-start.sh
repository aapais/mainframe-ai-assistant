#!/bin/bash
# Executado automaticamente quando Claude Code inicia
echo "🚀 Inicializando sessão automática..." >&2
npx claude-flow@alpha hooks session-start --load-context --restore-memory >/dev/null 2>&1 &
echo "✅ Contexto carregado automaticamente" >&2