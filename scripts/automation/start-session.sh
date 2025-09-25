#!/bin/bash
echo "🌅 Iniciando sessão de trabalho..."
npx claude-flow@alpha hooks session-start --load-context --restore-memory
npx claude-flow@alpha memory query --filter "pendente,contexto" --recent --limit 5
npx claude-flow@alpha hive-mind status
echo "✅ Pronto para trabalhar!"
